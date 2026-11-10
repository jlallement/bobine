/**
 * Commande à autoriser, lue en entier (0.11, M1, maquette validée) : la carte « Autoriser cette
 * commande ? » montre ce que l'agent lancera, brut, jamais coupé en silence. Générique ACP :
 * `rawInput.command` (ou `cmd`), retours à la ligne gardés, sinon le titre d'un outil `execute`
 * (Bob y met la commande). Le dossier : `rawInput.cwd` (ou `workdir`), sinon celui de la
 * conversation.
 *
 * Seule mise en évidence : les opérateurs d'enchaînement hors guillemets (`&&`, `||`, `;`, `|`,
 * `|&`, `&`). Le découpage est prudent : au moindre doute (heredoc, substitution, guillemets non
 * fermés…), rien n'est marqué.
 */

import { invisibleMarks, partsBetween, QUOTE_DOUBT, visibleText } from './invisible-chars.ts'

/** Ce que le fil garde de la commande d'un outil (le reste de `rawInput` ne l'est pas). */
export interface ToolCommand {
  /** La commande telle que l'agent l'a envoyée (au plus `KEPT_CHARS` caractères). */
  text: string
  /** Dossier annoncé par l'agent (`cwd`, `workdir`), tel quel. */
  cwd?: string
  /** Taille de la commande envoyée, quand le fil n'en garde qu'une partie. */
  total?: number
  /**
   * Tableau d'arguments (`["bash", "-lc", "…"]`, `command` + `args`) : chaque argument cité à la
   * façon POSIX, aucun opérateur marqué (rien n'y est interprété par un shell).
   */
  argv?: true
}

/** Au-delà, le fil ne garde que le début de la commande, et le dit (une commande de 1 Mio…). */
export const KEPT_CHARS = 1024 * 1024
/** Au-delà, la carte n'affiche que le début (l'app ne fige pas), le dit, et « Copier » copie tout. */
export const SHOWN_CHARS = 64 * 1024
/** Au-delà, la carte n'affiche que ces premières lignes (même note que pour les caractères). */
export const SHOWN_LINES = 2000
/** Infobulle de la ligne d'outil : au plus ces caractères, puis « … ». */
export const HINT_CHARS = 4096

const COMMAND_KEYS = ['command', 'cmd'] as const
const ARGS_KEYS = ['args', 'arguments'] as const
const CWD_KEYS = ['cwd', 'workdir'] as const

/** Argument sans rien à citer. */
const PLAIN_ARG = /^[A-Za-z0-9_@%+=:,./-]+$/

/**
 * Un argument tel qu'un shell POSIX le lirait : tel quel s'il n'a rien de spécial, sinon entre
 * guillemets simples (`'` → `'\''`), `''` s'il est vide ; ce qui n'est pas du texte en JSON.
 */
export function quoteArg(value: unknown): string {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value))
  if (text === '') return "''"
  return PLAIN_ARG.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`
}

const nonEmpty = (v: unknown) =>
  (typeof v === 'string' && v.trim() !== '') || (Array.isArray(v) && v.length > 0)

/**
 * Commande entière de `rawInput`, sinon rien. Texte : tel quel. Tableau d'arguments : chaque
 * argument cité. `command` (texte) suivi d'`args` / `arguments` (tableau) : tout, cité.
 */
export function toolCommandOf(rawInput: unknown): ToolCommand | undefined {
  if (typeof rawInput !== 'object' || rawInput === null) return undefined
  const raw = rawInput as Record<string, unknown>
  const value = COMMAND_KEYS.map((key) => raw[key]).find(nonEmpty)
  if (value === undefined) return undefined
  const args = ARGS_KEYS.map((key) => raw[key]).find((v) => Array.isArray(v) && v.length > 0)
  const argv = Array.isArray(value) || Array.isArray(args)
  const full = Array.isArray(value)
    ? value.map(quoteArg).join(' ')
    : Array.isArray(args)
      ? [quoteArg(value), ...args.map(quoteArg)].join(' ')
      : String(value)
  const cwd = CWD_KEYS.map((key) => raw[key]).find((v) => typeof v === 'string' && v.trim())
  return {
    text: full.length > KEPT_CHARS ? full.slice(0, KEPT_CHARS) : full,
    ...(typeof cwd === 'string' ? { cwd } : {}),
    ...(full.length > KEPT_CHARS ? { total: full.length } : {}),
    ...(argv ? { argv: true as const } : {})
  }
}

/** Pour le réducteur du fil : la commande de `rawInput`, sinon celle déjà gardée. */
export function withCommand(rawInput: unknown, previous?: ToolCommand): { command?: ToolCommand } {
  const command = toolCommandOf(rawInput) ?? previous
  return command ? { command } : {}
}

/** Ce qu'il faut d'une carte d'outil pour savoir quelle commande elle lance. */
export interface CommandTool {
  title: string
  toolKind?: string | undefined
  command?: ToolCommand | undefined
  input?: { code?: string | undefined } | undefined
}

/**
 * Commande que lance l'outil : celle de `rawInput`, sinon le titre d'un outil `execute` (Bob) ;
 * rien pour du code (« Code Mode » d'OpenCode, `rawInput.code`) ni pour un titre vide.
 */
export function commandOfTool(item: CommandTool): ToolCommand | undefined {
  if (item.command) return item.command
  if (item.toolKind !== 'execute' || item.input?.code || !item.title.trim()) return undefined
  return { text: item.title }
}

/** Chemin absolu sans `.`, `..`, ni barres en trop ; `undefined` s'il n'est pas absolu. */
export function normalizePath(path: string): string | undefined {
  if (!path.startsWith('/')) return undefined
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `/${parts.join('/')}`
}

/**
 * Le dossier de la commande est-il hors de celui de la conversation ? Comparaison de chemins
 * normalisés : un chemin relatif est pris depuis le dossier de la conversation ; rien n'est
 * deviné pour `~` ou une variable (`$HOME`), jamais signalés. Les liens symboliques ne sont pas
 * résolus (limite de la fiche 006).
 */
export function outsideWorkspace(cwd: string | undefined, workspace: string | undefined): boolean {
  if (!cwd || !workspace) return false
  if (/^~|\$/.test(cwd)) return false
  const base = normalizePath(workspace)
  const dir = normalizePath(cwd.startsWith('/') ? cwd : `${workspace}/${cwd}`)
  if (!dir || !base) return false
  return dir !== base && !dir.startsWith(base === '/' ? '/' : `${base}/`)
}

/** Un segment `..` : un lien symbolique peut le faire sortir du dossier (doute). */
const hasParentSegment = (path: string) => path.split('/').includes('..')

/**
 * Dossier de la commande dit court (fiche 203) : « projet » pour le dossier de la conversation,
 * « projet/src/renderer » pour un sous-dossier ; `undefined` sinon, et la carte montre alors le
 * chemin ENTIER. Sécurité (M1) : raccourci seulement quand le test « dans le dossier » de
 * `outsideWorkspace` (même normalisation) dit « dedans » ; au moindre doute — chemin relatif, `~`,
 * variable, segment `..`, chemin non normalisable, dossier de la conversation `/` — chemin entier.
 * Les liens symboliques ne sont pas résolus (limite de la fiche 006) : un lien `projet/lien` vers
 * `/etc` s'affiche « projet/lien » ; le chemin entier reste en infobulle et pour le lecteur d'écran.
 * Le texte passe par `visibleText` (caractères invisibles ou bidi rendus visibles).
 */
export function shortFolder(
  cwd: string | undefined,
  workspace: string | undefined
): string | undefined {
  if (!cwd || !workspace) return undefined
  if (!cwd.startsWith('/') || /^~|\$/.test(cwd) || hasParentSegment(cwd)) return undefined
  if (hasParentSegment(workspace) || outsideWorkspace(cwd, workspace)) return undefined
  const base = normalizePath(workspace)
  const dir = normalizePath(cwd)
  if (!base || !dir || base === '/') return undefined
  if (dir !== base && !dir.startsWith(`${base}/`)) return undefined
  const name = base.slice(base.lastIndexOf('/') + 1)
  return visibleText(`${name}${dir.slice(base.length)}`)
}

/**
 * Deux chemins absolus désignent le même dossier (normalisés, barres finales comprises) : un
 * emplacement (`locations`) égal au dossier de la commande n'est pas répété sous la commande
 * (OpenCode l'envoie). Au moindre doute (`..`, chemin relatif, `~`), « non » : l'emplacement reste.
 */
export function sameFolder(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || hasParentSegment(a) || hasParentSegment(b)) return false
  const x = normalizePath(a)
  return x !== undefined && x === normalizePath(b)
}

/** Un emplacement d'outil (`locations` d'ACP) : chemin, ligne éventuelle. */
export interface FolderLocation {
  path: string
  line?: number | null | undefined
}

/** Dossier de la commande tel que la carte le montre (fiche 203, correctif de recette). */
export interface CommandFolder {
  /** Chemin montré entier (jamais coupé) : absolu quand il est sûr, sinon la valeur brute. */
  full: string
  /** Forme courte (« projet/docs »), seulement sans aucun doute (`shortFolder`). */
  short?: string
  /** Chemin absolu sûr : un emplacement égal (`sameFolder`) n'est pas répété. */
  resolved?: string
  /** Hors du dossier de la conversation : l'alerte. */
  outside: boolean
}

/** `~` ou variable (`$HOME`) : rien n'est deviné. */
const UNRESOLVED = /^~|\$/

/**
 * Dossier où tourne la commande, résolu pour l'affichage seulement (fiche 203). Contrat réel
 * d'OpenCode 2.2.5 (trace `commande-dans-un-sous-dossier`) : `rawInput.workdir` RELATIF
 * (`"docs"`) et l'emplacement absolu (`locations: [{path: "<dossier>/docs"}]`).
 *
 * - Pas de dossier annoncé : celui de la conversation.
 * - Absolu : tel quel (`shortFolder`, `outsideWorkspace` comme avant).
 * - Relatif : résolu depuis le dossier de la conversation SEULEMENT s'il est confirmé par un
 *   emplacement de l'agent (sans numéro de ligne) égal au chemin résolu. Sans segment `..`, ni
 *   dans le chemin ni dans le dossier de la conversation : forme courte et emplacement masqué.
 *   Avec `..` : le chemin absolu entier, l'emplacement reste affiché.
 * - Sinon (pas d'emplacement, emplacement différent, `~`, `$`) : la valeur brute, l'emplacement
 *   reste affiché.
 *
 * L'alerte « hors du dossier » : `outsideWorkspace` sur le chemin (un relatif y est résolu, `..`
 * compris) ; et, pour un relatif non confirmé, aussi dès qu'un emplacement de l'agent est hors du
 * dossier (au moindre doute, on alerte).
 */
export function commandFolderOf(
  cwd: string | undefined,
  workspace: string | undefined,
  locations: readonly FolderLocation[] = []
): CommandFolder | undefined {
  const folder = cwd ?? workspace
  if (!folder) return undefined
  if (!cwd || cwd.startsWith('/')) {
    const short = shortFolder(folder, workspace)
    return {
      full: folder,
      ...(short ? { short } : {}),
      resolved: folder,
      outside: outsideWorkspace(cwd, workspace)
    }
  }
  const outside = outsideWorkspace(cwd, workspace)
  const lexical =
    workspace && !UNRESOLVED.test(cwd) ? normalizePath(`${workspace}/${cwd}`) : undefined
  const dirs = locations.filter((l) => l.line == null)
  const confirmed =
    lexical !== undefined &&
    dirs.some((l) => !hasParentSegment(l.path) && normalizePath(l.path) === lexical)
  if (!confirmed) {
    const away = dirs.some((l) => l.path.startsWith('/') && outsideWorkspace(l.path, workspace))
    return { full: cwd, outside: outside || away }
  }
  if (hasParentSegment(cwd) || (workspace !== undefined && hasParentSegment(workspace))) {
    return { full: lexical, outside }
  }
  const short = shortFolder(lexical, workspace)
  return { full: lexical, ...(short ? { short } : {}), resolved: lexical, outside }
}

/** Un morceau de commande : du texte, ou un opérateur d'enchaînement. */
export interface CommandPart {
  text: string
  op?: true
  /** Caractère invisible rendu visible (`loud`), ou signalé discrètement (`quiet`). */
  invisible?: 'loud' | 'quiet'
}

/**
 * Ce qu'un découpage simple lit mal : heredoc et chaîne ici (`<<`, `<<<`), substitution de
 * commande (`$(`, backtick), substitution de processus (`<(`, `>(`), guillemets ANSI-C (`$'`).
 */
const DOUBT = QUOTE_DOUBT

/**
 * Opérateurs d'enchaînement hors guillemets, ou `null` (aucun marquage) au moindre doute. Pas des
 * opérateurs : `\;` (échappé), `2>&1`, `<&`, `&>` et `&>>` (redirections), `>|` (écrasement),
 * ce qui est dans `${…}`.
 */
export function commandParts(command: string): CommandPart[] | null {
  if (DOUBT.test(command)) return null
  const parts: CommandPart[] = []
  let text = ''
  const flush = (op: string) => {
    if (text) parts.push({ text })
    parts.push({ text: op, op: true })
    text = ''
  }
  let quote: "'" | '"' | null = null
  for (let i = 0; i < command.length;) {
    const c = command[i] ?? ''
    if (quote) {
      // Entre guillemets doubles, `\"` ne ferme pas ; entre simples, rien ne s'échappe.
      if (quote === '"' && c === '\\') {
        text += command.slice(i, i + 2)
        i += 2
        continue
      }
      if (c === quote) quote = null
      text += c
      i++
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      text += c
      i++
      continue
    }
    if (c === '\\') {
      text += command.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '$' && command[i + 1] === '{') {
      const end = braceEnd(command, i + 2)
      if (end === -1) return null
      text += command.slice(i, end + 1)
      i = end + 1
      continue
    }
    const op = operatorAt(command, i)
    if (op) {
      flush(op)
      i += op.length
      continue
    }
    text += c
    i++
  }
  if (quote) return null
  if (text) parts.push({ text })
  return parts
}

/** Fin (`}`) d'un `${…}` commencé avant `from`, accolades imbriquées comprises ; -1 sinon. */
function braceEnd(command: string, from: number): number {
  let depth = 1
  for (let i = from; i < command.length; i++) {
    const c = command[i]
    if (c === '\\') i++
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  return -1
}

/** Opérateur d'enchaînement qui commence en `i`, s'il y en a un. */
function operatorAt(command: string, i: number): string | undefined {
  const c = command[i]
  const before = command[i - 1] ?? ''
  const after = command[i + 1] ?? ''
  if (c === '&') {
    if (after === '&') return '&&'
    // `2>&1`, `<&3` : redirection ; `&>fichier` : redirection aussi.
    if (before === '>' || before === '<' || after === '>') return undefined
    return '&'
  }
  if (c === '|') {
    if (after === '|') return '||'
    // `>|` : écrasement d'un fichier, pas un tube.
    if (before === '>') return undefined
    return after === '&' ? '|&' : '|'
  }
  if (c === ';') return after === ';' ? ';;' : ';'
  return undefined
}

/** Une ligne affichée : ses morceaux, opérateurs marqués. */
export type CommandLine = CommandPart[]

/**
 * Lignes de la commande à afficher (`\n`, `\r\n`), opérateurs marqués si le découpage est sûr.
 * `marked` : au moins un opérateur marqué.
 */
export function commandLines(
  command: string,
  operators = true
): { lines: CommandLine[]; marked: boolean } {
  // Tableau d'arguments (`operators` faux) : rien n'y est interprété par un shell, rien marqué.
  const parts = (operators ? commandParts(command) : null) ?? [{ text: command }]
  // Caractères invisibles : repérés sur la commande entière (le contexte compte), puis répartis.
  const marks = invisibleMarks(command)
  const lines: CommandLine[] = [[]]
  let offset = 0
  for (const part of parts) {
    if (part.op) {
      lines.at(-1)?.push(part)
      offset += part.text.length
      continue
    }
    const base = offset
    const end = base + part.text.length
    for (const newline of part.text.matchAll(/\r?\n/g)) {
      const at = base + newline.index
      lines.at(-1)?.push(...partsBetween(command, marks, offset, at))
      lines.push([])
      offset = at + newline[0].length
    }
    lines.at(-1)?.push(...partsBetween(command, marks, offset, end))
    offset = end
  }
  return { lines, marked: parts.some((p) => p.op) }
}

/** Titre ramené à une ligne, espaces réduits : pour comparer un titre et une commande. */
const flat = (text: string) => text.replace(/\s+/g, ' ').trim()

/**
 * Titres génériques d'un outil de commande (liste fermée, en minuscules) : ils ne disent rien de
 * la commande, inutile de les répéter. Tout autre titre qui diffère de la commande est montré.
 */
const GENERIC_TITLES = new Set([
  'shell',
  'terminal',
  'command',
  'run command',
  'run shell command',
  'execute command',
  'commande',
  'exécuter une commande',
  'lancer une commande',
  'commande shell'
])

/**
 * Titre d'un outil `execute` qui annonce autre chose que la commande qui sera lancée (0.11, M1) :
 * la carte le montre aussi, pour qu'on ne lise pas l'un en croyant autoriser l'autre. Seule une
 * courte liste de titres génériques ne l'est pas.
 */
export function announcedTitle(item: CommandTool): string | undefined {
  if (item.toolKind !== 'execute' || !item.command) return undefined
  const title = flat(item.title)
  if (!title || title === flat(item.command.text)) return undefined
  return GENERIC_TITLES.has(title.toLowerCase()) ? undefined : item.title
}

export { hasInvisible, visibleParts, visibleText, type VisiblePart } from './invisible-chars.ts'

/** Un morceau d'une ligne de commande : du texte, ou le dossier de la conversation (pastille). */
export type CommandChunk = string | { folder: string; name: string }

/** Avant le chemin : début, espace, guillemet, `=`, `(`, `:` ; après : `/`, espace, guillemet, `;&|)`, fin. */
const BEFORE_FOLDER = /[\s"'=(:]/
const AFTER_FOLDER = /[/\s"';&|)]/

/**
 * Le dossier de la conversation, écrit en toutes lettres dans une commande, découpé pour être
 * montré par une pastille portant son nom (fiche 214, décision de l'utilisateur) ; le texte reste
 * celui de l'agent, la pastille n'est qu'une façon de le montrer (« Copier » copie le texte exact,
 * le chemin entier est en infobulle). Seulement sur une frontière nette et jamais au moindre doute
 * (mêmes règles que `shortFolder`, fiche 203) : dossier racine, segment `..`, `$`, chemin non
 * absolu, voisin au nom qui commence pareil. Les autres chemins restent du texte.
 */
export function folderChunks(text: string, workspace: string | undefined): CommandChunk[] {
  const base = workspace ? normalizePath(workspace) : undefined
  if (!base || base === '/' || hasParentSegment(workspace ?? '') || /\$/.test(base)) return [text]
  const name = visibleText(base.slice(base.lastIndexOf('/') + 1))
  const chunks: CommandChunk[] = []
  let from = 0
  let at = text.indexOf(base)
  while (at !== -1) {
    const end = at + base.length
    const before = at === 0 ? ' ' : (text[at - 1] ?? '')
    const after = end === text.length ? ' ' : (text[end] ?? '')
    if (BEFORE_FOLDER.test(before) && AFTER_FOLDER.test(after)) {
      if (at > from) chunks.push(text.slice(from, at))
      chunks.push({ folder: base, name })
      from = end
    }
    at = text.indexOf(base, end)
  }
  if (from < text.length) chunks.push(text.slice(from))
  return chunks.length > 0 ? chunks : [text]
}
