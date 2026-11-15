/**
 * Risques d'une demande d'autorisation sous Windows (fiche 229, lot 3) : le pendant de
 * `permission-risk.ts` pour des chemins `C:\…`, que la version POSIX ne lit pas (aucun
 * signalement : échec ouvert). Mêmes genres de risque, mêmes règles de priorité (système, puis
 * fichier de configuration personnel, puis hors du dossier, puis lien physique), comparaisons sans
 * casse, `\` et `/` acceptés. Appelé par `permissionRisks` seulement sous Windows (`windows`).
 *
 * Dossiers du système : `%SystemRoot%`, `%ProgramFiles%` (et `(x86)`, `(Arm)`), `%ProgramData%`,
 * `\Recovery`, `\$Recycle.Bin`, `\System Volume Information`, `\Boot` du lecteur système, et les
 * périphériques (`\\.\…`). « Configuration personnelle » (l'équivalent des fichiers cachés du
 * dossier personnel) : un nom à point sous `%USERPROFILE%` (`.ssh`, `.gitconfig`, `.bob`),
 * `AppData` (réglages des applications, dossier Démarrage, `npm` du PATH) et les profils PowerShell
 * (`Documents\PowerShell`, `Documents\WindowsPowerShell`, y compris sous OneDrive) — sauf le
 * dossier temporaire (`%TEMP%`), seulement hors du dossier. Registre et commandes non lues : voir
 * `windows-command-writes.ts`.
 *
 * Vrai chemin : `realpath` natif par défaut (`GetFinalPathNameByHandle`, relevé dans la VM) : il
 * suit jonctions et liens et rend le nom long d'un nom court (`PROGRA~1` → `Program Files`) et la
 * vraie casse ; la version JS de Node garde les noms courts tels quels.
 */
import { realpathSync } from 'node:fs'
import { win32 } from 'node:path'
import type { PermissionRisk } from '@shared/permissions'
import { toolCommandOf } from '@shared/command-view'
import { isDriveAbsolute, windowsWithin } from '@shared/windows-paths'
import { hasOtherNames } from './hard-links'
import { windowsCommandWrites } from './windows-command-writes'
import type { RiskContext, RiskToolCall } from './permission-risk'

/** Variables d'environnement utiles, noms sans casse ; `process.env` par défaut. */
type Env = Readonly<Record<string, string | undefined>>

const envOf = (env: Env) => {
  const lower = new Map(Object.entries(env).map(([k, v]) => [k.toLowerCase(), v]))
  return (name: string) => lower.get(name.toLowerCase())
}

/** Retire `\\?\` (et `\\?\UNC\` → `\\`) : la même cible que le chemin ordinaire. */
const unprefixed = (path: string) =>
  path.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^[\\/]{2}\?[\\/](?=[a-z]:)/i, '')

/** Normalisé sans `\` final (sauf `C:\`). */
const tidy = (path: string) => {
  const normal = win32.normalize(path)
  return /^[a-z]:\\$/i.test(normal) ? normal : normal.replace(/\\+$/, '')
}

/**
 * Variables d'emplacement développées pour juger une cible (lot 3b) ; toute autre (`%PATH%`,
 * `$env:FOO`) laisse le chemin inconnu.
 */
const KNOWN_VARIABLES = new Set(
  [
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
    'APPDATA',
    'LOCALAPPDATA',
    'TEMP',
    'TMP',
    'SystemRoot',
    'windir',
    'SystemDrive',
    'ProgramFiles',
    'ProgramFiles(x86)',
    'ProgramFiles(Arm)',
    'ProgramW6432',
    'ProgramData',
    'ALLUSERSPROFILE',
    'PUBLIC',
    'OneDrive'
  ].map((name) => name.toLowerCase())
)

/**
 * Chemin absolu d'un texte de chemin Windows : `~`, `%VAR%`, `$env:VAR`, `${env:VAR}`, `$HOME`,
 * relatif au dossier `base`, `\…` (racine du lecteur de `base`), `/c/…` (Git Bash). `undefined`
 * quand on ne sait pas : variable hors de `KNOWN_VARIABLES`, relatif au lecteur (`C:x`), relatif sans dossier.
 */
export function windowsAbsolute(
  value: string,
  base: string | undefined,
  home: string,
  env: (name: string) => string | undefined
): string | undefined {
  let unknown = false
  const variable = (name: string) => {
    const lower = name.toLowerCase()
    const found = lower === 'home' ? home : KNOWN_VARIABLES.has(lower) ? env(name) : undefined
    if (found === undefined) unknown = true
    return found ?? ''
  }
  const expanded = value
    .replace(/^~(?=[\\/]|$)/, home)
    .replace(/%([^%\s]+)%/g, (_, name: string) => variable(name))
    .replace(/\$\{env:([^}]+)\}/gi, (_, name: string) => variable(name))
    .replace(/\$env:([a-z_][a-z0-9_()]*)/gi, (_, name: string) => variable(name))
    .replace(/^\$HOME(?=[\\/]|$)/i, home)
  if (unknown || /[%$]/.test(expanded)) return undefined
  const path = unprefixed(expanded)
  if (/^[\\/]{2}/.test(path)) return tidy(path) // UNC ou périphérique (`\\.\`)
  if (isDriveAbsolute(path)) return tidy(path)
  const bash = /^\/([a-z])(?=\/|$)(.*)$/i.exec(path)
  if (bash) return tidy(`${bash[1]?.toUpperCase()}:\\${bash[2] ?? ''}`)
  if (/^[a-z]:/i.test(path)) return undefined // `C:x` : relatif au dossier courant du lecteur
  if (!base || !isDriveAbsolute(base)) return undefined
  if (/^[\\/]/.test(path)) return tidy(`${base.slice(0, 2)}${path}`)
  return tidy(win32.join(base, path))
}

/** Vrai chemin de l'ancêtre existant le plus proche, suivi du reste ; le chemin tel quel sinon. */
function realOf(path: string, realpath: (path: string) => string): string {
  if (/^\\\\\.\\/.test(path)) return path
  const rest: string[] = []
  for (let current = path; ;) {
    try {
      return tidy(win32.join(unprefixed(realpath(current)), ...rest))
    } catch {
      const parent = win32.dirname(current)
      if (parent === current) return path
      rest.unshift(win32.basename(current))
      current = parent
    }
  }
}

/** Dossiers du système Windows, d'après l'environnement (repli : `C:\Windows`…). */
function systemFolders(env: (name: string) => string | undefined): string[] {
  const root = env('SystemRoot') ?? env('windir') ?? 'C:\\Windows'
  const drive = env('SystemDrive') ?? root.slice(0, 2)
  return [
    root,
    env('ProgramFiles') ?? `${drive}\\Program Files`,
    env('ProgramFiles(x86)') ?? `${drive}\\Program Files (x86)`,
    env('ProgramFiles(Arm)') ?? `${drive}\\Program Files (Arm)`,
    env('ProgramW6432') ?? `${drive}\\Program Files`,
    env('ProgramData') ?? `${drive}\\ProgramData`,
    `${drive}\\Recovery`,
    `${drive}\\$Recycle.Bin`,
    `${drive}\\System Volume Information`,
    `${drive}\\Boot`
  ].map(tidy)
}

/** Sous le dossier personnel : configuration (`.ssh`, `AppData`, profils PowerShell) ? */
function personalConfig(path: string, home: string, temp: readonly string[]): boolean {
  if (!windowsWithin(path, home) || temp.some((t) => windowsWithin(path, t))) return false
  const names = path.slice(tidy(home).length).split(/[\\/]/).filter(Boolean)
  const first = names[0]?.toLowerCase()
  if (first === undefined) return false
  if (first.startsWith('.') || first === 'appdata') return true
  // Profils PowerShell : `Documents\…` ou `OneDrive\Documents\…`.
  const docs = names.findIndex((n) => n.toLowerCase() === 'documents')
  const next = names[docs + 1]?.toLowerCase()
  return docs >= 0 && docs <= 1 && (next === 'powershell' || next === 'windowspowershell')
}

/** Chemins que modifie un outil qui écrit, déjà extraits par `permission-risk.ts`. */
export interface WindowsRiskInput {
  edited: readonly string[]
  /** Contexte de la conversation, avec `env` (variables Windows). */
  context: RiskContext & { env?: Env }
}

/** Les risques d'un appel sous Windows. */
export function windowsPermissionRisks(
  toolCall: RiskToolCall,
  { edited, context }: WindowsRiskInput
): PermissionRisk[] {
  const env = envOf(context.env ?? process.env)
  const { workspace, home } = context
  const realpath = context.realpath ?? ((path: string) => realpathSync.native(path))
  const otherNames = context.otherNames ?? hasOtherNames
  const kind = toolCall.kind ?? undefined
  const risks: PermissionRisk[] = []
  const base = workspace && isDriveAbsolute(workspace) ? tidy(workspace) : undefined
  let unknown = false
  let paths: string[] = []
  if (kind === 'execute' || kind === undefined) {
    const command = toolCommandOf(toolCall.rawInput)
    const text = command?.text ?? (kind === 'execute' ? toolCall.title : undefined)
    if (text) {
      const cwd = command?.cwd ? windowsAbsolute(command.cwd, base, home, env) : base
      const found = windowsCommandWrites(text, cwd)
      risks.push(...found.privilege.map((via) => ({ kind: 'privilege' as const, via })))
      risks.push(
        ...[...new Set(found.registry)].map((path) => ({ kind: 'registry' as const, path }))
      )
      unknown = found.unknown || (command?.cwd !== undefined && cwd === undefined)
      for (const write of found.writes) {
        const absolute = windowsAbsolute(write.path, write.cwd, home, env)
        if (absolute === undefined) unknown = true
        else paths.push(absolute)
      }
    }
  } else if (kind === 'edit' || kind === 'delete' || kind === 'move') {
    paths = edited.flatMap((v) => windowsAbsolute(v, base, home, env) ?? [])
  }
  risks.push(...pathRisks(paths, { base, home, env, realpath, otherNames }))
  if (unknown) risks.push({ kind: 'unknown-writes' })
  return risks
}

interface PathRiskContext {
  base: string | undefined
  home: string
  env: (name: string) => string | undefined
  realpath: (path: string) => string
  otherNames: (path: string) => boolean
}

/** Une ligne par chemin, la raison la plus précise (même ordre que sous macOS et Linux). */
function pathRisks(paths: readonly string[], ctx: PathRiskContext): PermissionRisk[] {
  const { base, home, env, realpath, otherNames } = ctx
  const realBase = base ? realOf(base, realpath) : undefined
  const realHome = realOf(tidy(home), realpath)
  const system = systemFolders(env)
  const temp = [env('TEMP'), env('TMP'), `${tidy(home)}\\AppData\\Local\\Temp`].flatMap((t) =>
    t ? [tidy(t)] : []
  )
  const tilde = (path: string) =>
    windowsWithin(path, home) && tidy(path).length > tidy(home).length
      ? `~${path.slice(tidy(home).length)}`
      : path
  const seen = new Set<string>()
  const risks: PermissionRisk[] = []
  for (const lexical of paths) {
    const real = realOf(lexical, realpath)
    const inBase = base !== undefined && windowsWithin(lexical, base)
    const outside = realBase !== undefined && !windowsWithin(real, realBase)
    const away = realBase === undefined || outside
    const shown = tilde(inBase && outside ? real : lexical)
    const device = /^\\\\\.\\/.test(lexical)
    const isSystem =
      away && (device || [lexical, real].some((p) => system.some((s) => windowsWithin(p, s))))
    const config =
      away && (personalConfig(real, realHome, temp) || personalConfig(lexical, home, temp))
    const riskKind = isSystem
      ? 'system-path'
      : config
        ? 'home-dotfile'
        : outside
          ? 'outside-folder'
          : otherNames(real)
            ? 'shared-file'
            : null
    if (!riskKind) continue
    const path =
      riskKind === 'shared-file' && base && inBase && tidy(lexical) !== base
        ? lexical.slice(base.length + 1)
        : shown
    const key = path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    risks.push({ kind: riskKind, path })
  }
  return risks
}
