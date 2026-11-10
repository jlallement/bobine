/**
 * Risques d'une demande d'autorisation (fiche 211), calculés dans le main à la réception de
 * `session/request_permission` (`AgentHost.onPermissionRequest`) et portés par la carte : écriture
 * hors du dossier de la conversation, dans un fichier caché du dossier personnel, dans un dossier
 * du système ; droits d'administrateur. Générique ACP : `kind`, `rawInput`, `locations`, diffs,
 * titre ; aucun agent n'a de cas à part.
 *
 * Chemins considérés : pour un outil qui modifie (`edit`, `delete`, `move`), ses emplacements,
 * les chemins de `rawInput` et ceux des diffs ; pour une commande (`execute`), seulement ce
 * qu'elle ÉCRIT d'après sa ligne de shell (`commandWrites`, lecture prudente). Bob 2.0.9 n'envoie
 * pour une commande que `rawInput.command` (trace `commande-hors-dossier-et-sudo-refusees`) : sans
 * cette lecture, rien ne dirait qu'elle écrit hors du dossier.
 *
 * Résolution : `~`, `$HOME`, `..`, relatif au dossier de la commande ; puis le vrai chemin
 * (`realpath`) de l'ancêtre existant le plus proche, pour qu'un lien symbolique du projet vers
 * `~/.ssh` se voie. Un avertissement, jamais une garantie : l'absence de risque ne dit pas que
 * l'appel est sûr.
 */
import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PermissionRisk } from '@shared/permissions'
import { normalizePath, toolCommandOf } from '@shared/command-view'
import { commandWrites } from './command-writes'

/** Ce qu'il faut d'un appel d'outil (forme ACP de `ToolCallUpdate`). */
export interface RiskToolCall {
  kind?: string | null
  title?: string | null
  rawInput?: unknown
  locations?: readonly { path: string }[] | null
  content?: readonly { type: string; path?: string }[] | null
}

export interface RiskContext {
  /** Dossier de la conversation (absolu). */
  workspace?: string | undefined
  home: string
  /** Vrai chemin d'un chemin existant ; lève une erreur sinon (par défaut, `fs.realpathSync`). */
  realpath?: (path: string) => string
}

/** Genres d'outils qui modifient les fichiers qu'ils désignent. */
const WRITING_KINDS = new Set(['edit', 'delete', 'move'])

/** Champs de `rawInput` qui désignent un fichier modifié (Bob : `path` ; OpenCode : `filePath`). */
const PATH_KEYS = [
  'path',
  'filePath',
  'file_path',
  'filepath',
  'source',
  'destination',
  'target',
  'newPath',
  'new_path',
  'oldPath',
  'old_path'
]

/** Dossiers du système (macOS et Linux). `/private/…` : où mènent `/etc`, `/var`, `/tmp` sur macOS. */
const SYSTEM = [
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/opt',
  '/lib',
  '/lib64',
  '/boot',
  '/root',
  '/Library',
  '/System',
  '/Applications',
  '/private/etc',
  '/private/var'
]
/** Dossiers temporaires des utilisateurs : hors du dossier, mais pas du système. */
const NOT_SYSTEM = ['/var/folders', '/var/tmp', '/private/var/folders', '/private/var/tmp']

const within = (path: string, base: string) =>
  path === base || path.startsWith(base === '/' ? '/' : `${base}/`)

/** Chemin sous le dossier personnel, sans lui (`.zshrc`) ; `undefined` ailleurs. */
const homeRelative = (path: string, home: string) =>
  within(path, home) && path !== home ? path.slice(home.length + 1) : undefined

/** Vrai chemin de l'ancêtre existant le plus proche, suivi du reste ; le chemin tel quel sinon. */
function realOf(path: string, realpath: (path: string) => string): string {
  const rest: string[] = []
  let current = path
  for (;;) {
    try {
      const real = realpath(current)
      return normalizePath([real, ...rest].join('/')) ?? path
    } catch {
      const parent = dirname(current)
      if (parent === current) return path
      rest.unshift(current.slice(parent.length + (parent === '/' ? 0 : 1)))
      current = parent
    }
  }
}

/** Chemin absolu d'un texte de chemin : `~`, `$HOME`, relatif au dossier `base`. */
function absolute(value: string, base: string | undefined, home: string): string | undefined {
  const expanded = value.replace(/^~(?=\/|$)/, home).replace(/^\$\{?HOME\}?(?=\/|$)/, home)
  if (/^~|\$/.test(expanded)) return undefined
  if (expanded.startsWith('/')) return normalizePath(expanded)
  return base ? normalizePath(`${base}/${expanded}`) : undefined
}

/** Chemins que modifie un outil qui écrit : emplacements, `rawInput`, diffs. */
function editedPaths(toolCall: RiskToolCall, workspace: string | undefined, home: string) {
  const raw =
    typeof toolCall.rawInput === 'object' && toolCall.rawInput !== null
      ? (toolCall.rawInput as Record<string, unknown>)
      : {}
  const values = [
    ...(toolCall.locations ?? []).map((l) => l.path),
    ...PATH_KEYS.map((key) => raw[key]).filter((v): v is string => typeof v === 'string'),
    ...(toolCall.content ?? []).flatMap((c) => (c.type === 'diff' && c.path ? [c.path] : []))
  ]
  return values.flatMap((v) => absolute(v, workspace, home) ?? [])
}

/** Ce qu'écrit la commande d'un outil `execute`, et les droits qu'elle demande. */
function commandRisks(toolCall: RiskToolCall, workspace: string | undefined, home: string) {
  const command = toolCommandOf(toolCall.rawInput)
  const text = command?.text ?? (toolCall.kind === 'execute' ? toolCall.title : undefined)
  if (!text) return undefined
  const cwd = command?.cwd ? absolute(command.cwd, workspace, home) : workspace
  return commandWrites(text, { cwd, home })
}

/** Risques de l'appel d'outil ; vide s'il n'y a rien à dire (ou au moindre doute). */
export function permissionRisks(toolCall: RiskToolCall, context: RiskContext): PermissionRisk[] {
  const { workspace, home } = context
  const realpath = context.realpath ?? ((path: string) => realpathSync(path))
  const kind = toolCall.kind ?? undefined
  const risks: PermissionRisk[] = []
  let paths: string[] = []
  if (kind === 'execute' || kind === undefined) {
    const found = commandRisks(toolCall, workspace, home)
    if (found) {
      risks.push(...found.privilege.map((via) => ({ kind: 'privilege' as const, via })))
      paths = found.writes
    }
  } else if (WRITING_KINDS.has(kind)) {
    paths = editedPaths(toolCall, workspace, home)
  }
  const base = workspace ? normalizePath(workspace) : undefined
  const realBase = base ? realOf(base, realpath) : undefined
  const realHome = realOf(home, realpath)
  const tilde = (path: string) =>
    within(path, home) && path !== home ? `~${path.slice(home.length)}` : path
  const seen = new Set<string>()
  const add = (risk: PermissionRisk & { path: string }) => {
    if (seen.has(risk.path)) return
    seen.add(risk.path)
    risks.push(risk)
  }
  for (const lexical of paths) {
    const real = realOf(lexical, realpath)
    // Le vrai chemin décide : un lien du projet vers `~/.ssh` sort du dossier.
    const outside = realBase !== undefined && !within(real, realBase)
    // Sans dossier de conversation connu, les autres risques restent dits.
    const away = realBase === undefined || outside
    // Un lien du projet qui mène ailleurs : montrer où il mène, pas le chemin du projet.
    const shown = tilde(base && within(lexical, base) && outside ? real : lexical)
    const relative = homeRelative(real, realHome) ?? homeRelative(lexical, home)
    const dotfile = away && relative?.startsWith('.') === true
    const system =
      away &&
      [lexical, real].some(
        (p) => SYSTEM.some((s) => within(p, s)) && !NOT_SYSTEM.some((s) => within(p, s))
      )
    // Une ligne par chemin, la raison la plus précise : système, puis fichier caché du dossier
    // personnel, puis « hors du dossier » (les deux premiers sont aussi hors du dossier).
    const kind = system
      ? 'system-path'
      : dotfile
        ? 'home-dotfile'
        : outside
          ? 'outside-folder'
          : null
    if (kind) add({ kind, path: shown })
  }
  return risks
}
