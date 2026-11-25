/**
 * Empreinte d'un dossier git (sortie de `children-review.ts`, fiche 177 ; reprise par les rôles en
 * lecture seule, fiche 223, et les participants d'un tour de table, fiche 285). Deux empreintes
 * différentes : le dossier a changé.
 *
 * Ce qui est vu : HEAD et la branche courante ; l'état (`git status`) ; le diff des fichiers suivis ;
 * taille et date des fichiers nouveaux (leur contenu n'est pas dans le diff) ; les entrées ignorées
 * du premier niveau où git les regroupe (`!! node_modules/`), et taille et date de celles qui sont
 * des fichiers (`.env`) ; le contenu de `.git/config` et la liste des crochets (`hooks/`, taille et
 * date), qu'un agent pourrait changer pour faire exécuter du code plus tard ; la valeur effective de
 * `core.hooksPath` (config du dépôt, personnelle ou système) et, s'il est dans le dossier, sa liste.
 *
 * Ce qui n'est **pas** vu, et ne se promet pas (faux négatifs connus, contre-revue N7) : les
 * écritures hors du dossier (dossier personnel, autre dépôt) ; le contenu des dossiers ignorés (un
 * fichier ajouté dans `node_modules/` ou `dist/`) ; le reste de `.git` (objets, références hors de
 * HEAD : une branche ou une étiquette créée) ; un fichier suivi écrit puis remis à l'identique
 * pendant le tour (même contenu : même diff) ; un changement fait entre deux tours. Coût mesuré le 2026-11-24 sur le dépôt de
 * Bobine (≈ 970 Mo de `node_modules`, Mac M-series) : ≈ 150 ms par empreinte contre ≈ 35 ms avant
 * (le `git status --ignored`, sans parcourir les dossiers ignorés) ; deux empreintes par tour.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { Run } from '../simulator/run'

/** Taille et date d'un fichier, ou `-1` s'il manque. */
async function stamp(path: string): Promise<string> {
  const info = await stat(path).catch(() => null)
  return `${info?.size ?? -1}\0${info?.mtimeMs ?? -1}`
}

/** Config et crochets du dépôt (`--git-common-dir` : le même pour un worktree). */
async function gitSetup(commonDir: string): Promise<string> {
  const config = await readFile(join(commonDir, 'config')).catch(() => Buffer.from('-'))
  const hooks = await readdir(join(commonDir, 'hooks')).catch(() => [] as string[])
  const stamps = await Promise.all(
    hooks.sort().map(async (name) => `${name}\0${await stamp(join(commonDir, 'hooks', name))}`)
  )
  return `${config.toString('base64')}\0${stamps.join('\0')}`
}

/** Dossier de crochets effectif s'il est réglé (`core.hooksPath`) : sa valeur et sa liste. */
async function hooksPath(run: Run, workspace: string): Promise<string> {
  const result = await run('git', ['config', '--get', 'core.hooksPath'], {
    cwd: workspace,
    timeoutMs: 30_000
  })
  // Code 1 : rien de réglé (attendu) ; tout autre échec lève, comme les autres commandes.
  if (result.timedOut || (result.code !== 0 && result.code !== 1)) {
    throw new Error(`git config : ${result.timedOut ? 'délai dépassé' : result.stderr}`)
  }
  const value = result.code === 0 ? result.stdout.toString('utf8').trim() : ''
  if (!value) return '-'
  // La liste seulement pour un dossier du projet : jamais rien lu hors du dossier de travail.
  const dir = resolve(workspace, value)
  if (
    value.startsWith('~') ||
    relative(workspace, dir).startsWith('..') ||
    isAbsolute(relative(workspace, dir))
  )
    return value
  const names = await readdir(dir).catch(() => [] as string[])
  const stamps = await Promise.all(
    names.sort().map(async (name) => `${name}\0${await stamp(join(dir, name))}`)
  )
  return `${value}\0${stamps.join('\0')}`
}

/** Empreinte d'un dossier, et ses lignes de `git status` (fichiers suivis et non suivis). */
export interface FolderState {
  fingerprint: string
  /** `git status --porcelain=v1 -z -uall`, une entrée par ligne. */
  status: string[]
}

/**
 * Lève si une commande git échoue ou dépasse son délai (dossier hors d'un dépôt, dépôt sans
 * commit…) : une empreinte partielle ferait croire à un changement, ou le cacherait.
 *
 * Cinq commandes git (au lieu de huit, CI Windows du 2026-11-25 : un processus git y coûte des
 * dizaines de millisecondes, et un tour de table en prend plusieurs par participant) : HEAD, la
 * branche et le dossier commun en une seule ; les fichiers non suivis lus dans `git status -uall`
 * (ce que listait `ls-files --others --exclude-standard`, mêmes règles d'exclusion, un fichier
 * par entrée, dossiers non suivis parcourus, noms bruts avec `-z`). Rien de moins n'est vu.
 */
export async function folderState(run: Run, workspace: string): Promise<FolderState> {
  const git = async (args: string[]) => {
    const result = await run('git', args, { cwd: workspace, timeoutMs: 30_000 })
    if (result.code !== 0 || result.timedOut) {
      throw new Error(`git ${args[0] ?? ''} : ${result.timedOut ? 'délai dépassé' : result.stderr}`)
    }
    return result.stdout
  }
  const lines = (out: Buffer | string) => out.toString('utf8').split('\0').filter(Boolean)
  const hash = createHash('sha256')
  // HEAD, branche courante, dossier commun (le même pour un worktree), racine du dépôt.
  const refs = (
    await git(['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD', '--git-common-dir', '--show-toplevel'])
  )
    .toString('utf8')
    .split('\n')
  // Les chemins de `git status --porcelain` partent de la racine du dépôt, pas du dossier de
  // travail (qui peut en être un sous-dossier) ; ceux de `ls-files` partaient du dossier.
  const top = (refs[3] ?? '').trim() || workspace
  hash.update(`${refs[0] ?? ''}\0${refs[1] ?? ''}\0`)
  const status = lines(await git(['status', '--porcelain=v1', '-z', '-uall', '--', '.']))
  hash.update(status.join('\0'))
  hash.update(await git(['diff', 'HEAD', '--binary', '--', '.']))
  // Fichiers non suivis : taille et date (leur contenu n'est pas dans le diff).
  for (const line of status) {
    if (!line.startsWith('?? ')) continue
    const file = line.slice(3)
    hash.update(`${file}\0${await stamp(join(top, file))}\0`)
  }
  // Ignorés regroupés par dossier (`traditional`, sans `-uall`) : jamais tout `node_modules/`.
  const ignored = lines(
    await git(['status', '--porcelain=v1', '-z', '--ignored=traditional', '-unormal', '--', '.'])
  ).filter((line) => line.startsWith('!! '))
  for (const line of ignored) {
    const path = line.slice(3)
    hash.update(`${line}\0${path.endsWith('/') ? '' : await stamp(join(top, path))}\0`)
  }
  const commonDir = (refs[2] ?? '').trim()
  hash.update(await gitSetup(resolve(workspace, commonDir || '.git')))
  hash.update(await hooksPath(run, workspace))
  return { fingerprint: hash.digest('hex'), status }
}

/** Empreinte seule (`folderState`). */
export async function folderFingerprint(run: Run, workspace: string): Promise<string> {
  return (await folderState(run, workspace)).fingerprint
}
