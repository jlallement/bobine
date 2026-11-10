/**
 * Réinitialiser Bobine, façon désinstalleur (fiche 148) : ce que Bobine garde sur ce Mac part dans
 * un dossier daté de la corbeille, la clé du trousseau et les préférences de macOS de l'app sont
 * supprimées, puis Bobine redémarre comme au premier lancement (ou part elle aussi à la corbeille).
 *
 * Bobine ne peut pas déplacer son propre dossier pendant qu'elle tourne (Chromium y écrit jusqu'à
 * la dernière milliseconde). Un assistant (`RESET_HELPER`, un script `sh`) attend donc la fin de
 * l'app, fait le ménage (tout ou rien), écrit un `LISEZ-MOI.txt` qui dit d'où vient chaque
 * élément, puis relance l'app. Jamais touchés : les projets et leurs worktrees, les dossiers
 * des agents.
 */
import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { RESET_KINDS, type ResetItem, type ResetKind } from '@shared/fresh-start'

/** Entrées du dossier de données propres à l'interface (Chromium) : rangées avec les réglages. */
const UI_STORAGE = new Set(['Local Storage', 'Session Storage', 'IndexedDB', 'Preferences'])
/** Navigateur intégré : sa session gardée (fiche 072) et les téléchargements en attente (094). */
const BROWSER = new Set(['Partitions', 'downloads-pending'])

/** Groupe d'une entrée du dossier de données. */
export function classifyEntry(name: string): ResetKind {
  if (name === 'conversations') return 'conversations'
  if (name.startsWith('usage.sqlite')) return 'usage'
  if (name.endsWith('.json') || UI_STORAGE.has(name)) return 'settings'
  if (BROWSER.has(name)) return 'browser'
  return 'other'
}

/** Taille d'un fichier ou d'un dossier, liens symboliques non suivis. */
export async function sizeOf(path: string): Promise<number> {
  const info = await lstat(path).catch(() => undefined)
  if (!info) return 0
  if (!info.isDirectory()) return info.size
  const entries = await readdir(path).catch(() => [] as string[])
  let total = 0
  for (const entry of entries) total += await sizeOf(join(path, entry))
  return total
}

/**
 * Ce qui partira à la corbeille, par groupe, avec les tailles ; `extra` : dossiers hors du dossier
 * de données (journaux, ancien dossier), comptés avec « le reste ».
 */
export async function resetInventory(
  userData: string,
  extra: readonly string[]
): Promise<ResetItem[]> {
  const totals = new Map<ResetKind, ResetItem>(
    RESET_KINDS.map((kind) => [kind, { kind, bytes: 0 }])
  )
  for (const entry of await readdir(userData).catch(() => [] as string[])) {
    const item = totals.get(classifyEntry(entry)) as ResetItem
    item.bytes += await sizeOf(join(userData, entry))
  }
  for (const path of extra) (totals.get('other') as ResetItem).bytes += await sizeOf(path)
  const conversations = await readdir(join(userData, 'conversations')).catch(() => [] as string[])
  ;(totals.get('conversations') as ResetItem).count = conversations.filter((f) =>
    f.endsWith('.json')
  ).length
  return [...totals.values()]
}

/** Travail de l'assistant, passé en arguments de son script. */
export interface ResetJob {
  /** Processus de Bobine, dont l'assistant attend la fin. */
  pid: number
  /** Ce qui part à la corbeille, dans l'ordre (les absents sont ignorés). */
  paths: string[]
  trashDir: string
  /** Dossier daté de la corbeille. */
  folderName: string
  /** `LISEZ-MOI.txt` : son nom, son en-tête (traduit par le main). */
  readmeName: string
  readme: string
  /**
   * Fichier où l'assistant dit pourquoi il n'a rien fait (dans le dossier de données, remis en
   * place) ; la Bobine suivante le lit, l'affiche et le supprime (`takeResetFailure`).
   */
  failureFile: string
  /** Service du trousseau à supprimer (jamais avec un dossier de données imposé). */
  keychain?: string
  /** Domaine des préférences de macOS de l'app installée. */
  defaultsDomain?: string
  /** Commande qui relance Bobine ; absente : pas de relance (désinstallation, essais). */
  relaunch?: string[]
  /** Attente maximale de la fin de Bobine, en dixièmes de seconde (60 s ; les essais l'abrègent). */
  waitTenths?: number
}

/** Nom du dossier daté : « Bobine — données du 2026-10-24 20.15 » (pas de « : » sur macOS). */
export function resetFolderName(prefix: string, at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `${prefix} ${day} ${pad(at.getHours())}.${pad(at.getMinutes())}`
}

/** Nom du fichier d'échec, dans le dossier de données. */
export const RESET_FAILURE_NAME = 'reinitialisation-echouee.txt'

/**
 * Assistant de réinitialisation, en `sh` : `/bin/sh -c RESET_HELPER bobine-reset <arguments>`
 * (`resetHelperArgs`). Pas de mode Node : le fusible RunAsNode de l'app packagée est coupé
 * (`electron-builder.yml`), `ELECTRON_RUN_AS_NODE` y relancerait une seconde Bobine (fiche 187, R2).
 *
 * Tout ou rien : il attend la fin de Bobine (sinon il ne touche à rien), déplace chaque chemin dans
 * le dossier daté de la corbeille avec `mv` (qui ne supprime l'original d'un volume à l'autre
 * qu'une fois la copie réussie). Un déplacement qui échoue : ceux déjà faits sont remis en place,
 * ni le trousseau ni les préférences ne sont touchés, et la raison est écrite dans `failureFile`.
 * Sinon : `LISEZ-MOI.txt`, clé du trousseau et préférences supprimées. Puis la relance.
 */
export const RESET_HELPER = String.raw`
pid=$1 tenths=$2 trash=$3 name=$4 readme=$5 header=$6 keychain=$7 domain=$8 failure=$9
shift 9
fail() { mkdir -p "$(dirname "$failure")" 2>/dev/null; printf '%s\n' "$1" > "$failure"; }
waited=0
while kill -0 "$pid" 2>/dev/null; do
  if [ "$waited" -ge "$tenths" ]; then
    fail "Bobine (pid $pid) was still running: nothing was moved."
    rm -f "$header"
    exit 1
  fi
  sleep 0.1
  waited=$((waited + 1))
done
# Les processus auxiliaires de Chromium finissent juste après l'app.
sleep 0.5
failed=0 detail=''
folder="$trash/$name" n=2
while [ -e "$folder" ]; do folder="$trash/$name $n"; n=$((n + 1)); done
if ! detail=$(mkdir -p "$folder" 2>&1); then failed=1 detail="$folder: $detail"; fi
moved="$header.moved"
: > "$moved"
while [ $# -gt 0 ]; do
  if [ "$1" = -- ]; then shift; break; fi
  from=$1
  shift
  [ "$failed" = 0 ] || continue
  [ -e "$from" ] || [ -L "$from" ] || continue
  base=$(basename "$from") n=2
  to="$folder/$base"
  while [ -e "$to" ] || [ -L "$to" ]; do to="$folder/$base $n"; n=$((n + 1)); done
  if out=$(mv "$from" "$to" 2>&1); then
    printf '%s\n%s\n' "$from" "$to" >> "$moved"
  else
    failed=1 detail="$from: $out"
  fi
done
if [ "$failed" = 1 ]; then
  report=$detail
  while IFS= read -r from && IFS= read -r to; do
    back=''
    if [ -e "$from" ] || ! back=$(mv "$to" "$from" 2>&1); then
      report="$report
NOT PUT BACK: $to -> $from $back"
    fi
  done < "$moved"
  rmdir "$folder" 2>/dev/null
  fail "$report"
else
  {
    cat "$header"
    echo
    while IFS= read -r from && IFS= read -r to; do printf '%s  <-  %s\n' "$(basename "$to")" "$from"; done < "$moved"
    if [ -n "$keychain" ] && /usr/bin/security delete-generic-password -s "$keychain" >/dev/null 2>&1; then echo "- $keychain"; fi
    if [ -n "$domain" ] && /usr/bin/defaults delete "$domain" >/dev/null 2>&1; then echo "- $domain"; fi
  } > "$folder/.readme.tmp"
  # Écrit d'un coup : qui le lit (l'utilisateur, les essais) ne le voit jamais à moitié.
  mv "$folder/.readme.tmp" "$folder/$readme"
fi
rm -f "$header" "$moved"
if [ $# -gt 0 ]; then "$@" </dev/null >/dev/null 2>&1 & fi
exit 0
`

/** Arguments du script, après son nom : `header` est le fichier de l'en-tête du LISEZ-MOI. */
export function resetHelperArgs(job: ResetJob, header: string): string[] {
  return [
    String(job.pid),
    String(job.waitTenths ?? 600),
    job.trashDir,
    job.folderName,
    job.readmeName,
    header,
    job.keychain ?? '',
    job.defaultsDomain ?? '',
    job.failureFile,
    ...job.paths,
    '--',
    ...(job.relaunch ?? [])
  ]
}

/** Environnement d'un assistant : celui de l'app, jamais en mode Node. */
export function helperEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean = { ...env }
  delete clean['ELECTRON_RUN_AS_NODE']
  return clean
}

export interface ResetLaunchIo {
  /** Où écrire l'en-tête du LISEZ-MOI (les fichiers temporaires). */
  tmp: string
  spawn?: (command: string, args: string[], options: SpawnOptions) => { unref: () => void }
}

/**
 * Lance l'assistant par `/bin/sh`, détaché : il survit à la fin de Bobine, qui doit quitter juste
 * après. Rend le fichier de l'en-tête (supprimé par l'assistant).
 */
export function launchReset(job: ResetJob, io: ResetLaunchIo): string {
  const header = join(io.tmp, `bobine-reinitialisation-${job.pid}.txt`)
  writeFileSync(header, job.readme + '\n')
  const spawn = io.spawn ?? ((c, a, o) => nodeSpawn(c, a, o))
  spawn('/bin/sh', ['-c', RESET_HELPER, 'bobine-reset', ...resetHelperArgs(job, header)], {
    detached: true,
    stdio: 'ignore',
    env: helperEnv(process.env)
  }).unref()
  return header
}

/**
 * Échec d'une réinitialisation précédente (fichier de l'assistant), lu une fois : le fichier est
 * supprimé, son texte rendu ; rien s'il n'y en a pas.
 */
export function takeResetFailure(userData: string): string | undefined {
  const file = join(userData, RESET_FAILURE_NAME)
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
  rmSync(file, { force: true })
  return text.trim() || '?'
}

/** Chemins à mettre à la corbeille : ceux qui existent, sans doublon ni chemin contenu dans un autre. */
export function resetPaths(paths: readonly (string | undefined)[]): string[] {
  const unique = [...new Set(paths.filter((p): p is string => !!p && existsSync(p)))]
  return unique.filter((p) => !unique.some((other) => other !== p && p.startsWith(`${other}/`)))
}
