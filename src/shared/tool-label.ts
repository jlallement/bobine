/**
 * Libellés lisibles des outils de l'agent (fiche 107) : l'agent titre ses cartes à sa façon
 * (OpenCode 2 : « read », vingt fois ; Bob : « Reading file… »), mais le protocole dit ce que
 * l'outil fait (`kind`) et sur quoi (`locations`, `rawInput`). L'app en tire « Lecture de
 * src/books.js », « Recherche « TODO » », « Page example.com/doc ». Générique : rien de propre à un
 * agent (ADR-0011) ; sans genre connu ou sans cible, le titre de l'agent reste.
 */
import { t } from 'i18next'
import type { ToolKind } from './acp-sdk.mts'
import { visibleText } from './invisible-chars.ts'
import { currentHomeFolder, shortenHomeIn, shortFolderPath } from './path-display.ts'
import { abbreviateHome } from './presentation.ts'

/** Ce que `rawInput` dit de la cible d'un outil, sous ses noms usuels. */
export interface ToolInput {
  path?: string
  pattern?: string
  url?: string
  command?: string
  /**
   * Code qu'exécute l'outil (« Code Mode » d'OpenCode, `rawInput.code`) : pas affiché, gardé pour
   * repérer ce qu'il appelle (contenu externe d'une proposition de mémoire, fiche 182).
   */
  code?: string
  /** Lignes d'une liste de tâches que l'outil écrit (fiche 125). */
  todos?: string[]
}

type TextInput = Exclude<keyof ToolInput, 'todos'>

/**
 * Noms usuels de chaque cible dans `rawInput`, quel que soit l'agent : règle générique (fiche 140),
 * la première clé présente l'emporte. Un nom nouveau s'ajoute ici, pour tous les agents.
 */
const INPUT_KEYS: Record<TextInput, readonly string[]> = {
  path: ['filePath', 'file_path', 'path', 'file', 'directory', 'dir'],
  pattern: ['pattern', 'query', 'regex', 'glob'],
  url: ['url', 'uri'],
  command: ['command', 'cmd'],
  code: ['code']
}

const MAX_INPUT = 200
/** Lignes gardées d'une liste de tâches (infobulle). */
const MAX_TODOS = 30

/** Une valeur de `rawInput` : texte sur une ligne, raccourci ; absent sinon. */
function inputText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const line = String(value).replace(/\s+/g, ' ').trim()
  if (!line) return undefined
  return line.length > MAX_INPUT ? `${line.slice(0, MAX_INPUT - 1)}…` : line
}

/**
 * Liste de tâches écrite par un outil (`todos`) : texte à cases, une tâche par ligne (Bob 2.0.6 :
 * « [-] Lire… ») ou tableau de tâches (texte, ou objet avec `content` / `text`).
 */
function todoLines(value: unknown): string[] | undefined {
  const items = Array.isArray(value)
    ? value.map((todo: unknown) =>
        typeof todo === 'object' && todo !== null
          ? ((todo as Record<string, unknown>)['content'] ??
            (todo as Record<string, unknown>)['text'])
          : todo
      )
    : typeof value === 'string'
      ? value.split('\n')
      : []
  const lines = items.flatMap((item) => inputText(item) ?? [])
  return lines.length ? lines.slice(0, MAX_TODOS) : undefined
}

/** Résumé de `rawInput` gardé dans le fil (le reste de `rawInput` ne l'est pas). */
export function toolInputOf(rawInput: unknown): ToolInput | undefined {
  if (typeof rawInput !== 'object' || rawInput === null) return undefined
  const raw = rawInput as Record<string, unknown>
  const input: ToolInput = {}
  const todos = todoLines(raw['todos'])
  if (todos) input.todos = todos
  for (const name of Object.keys(INPUT_KEYS) as TextInput[]) {
    for (const key of INPUT_KEYS[name]) {
      const text = inputText(raw[key])
      if (text) {
        input[name] = text
        break
      }
    }
  }
  return Object.keys(input).length ? input : undefined
}

/** Texte du plan dans `rawInput` (`{ plan: "..." }`), s'il y en a un. */
export function planOf(rawInput: unknown): string | undefined {
  if (typeof rawInput !== 'object' || rawInput === null) return undefined
  const plan = (rawInput as Record<string, unknown>)['plan']
  return typeof plan === 'string' && plan.trim() ? plan : undefined
}

export interface ToolLabel {
  /** Ce que l'outil a fait et sur quoi (« Lecture de src/books.js »). */
  text: string
  /** La cible en entier (chemin complet, adresse entière), pour l'infobulle. */
  detail?: string
  /** Une commande : affichée en code. */
  code?: boolean
  /** L'outil crée le fichier (fiche 203) : « Création de notes.md », icône « fichier + ». */
  created?: true
  /**
   * Le libellé d'un outil de fichier découpé pour la ligne d'outil (fiche 203, correctif de
   * recette) : le texte avant et après la cible, son dossier (coupé en premier, par le début) et
   * son nom (coupé à la fin seulement s'il ne tient pas seul) — l'extension reste visible.
   */
  file?: LabelFile
}

/** Libellé d'un outil de fichier, en morceaux : `before` + `dir` + `name` + `after` = le libellé. */
export interface LabelFile {
  before: string
  dir: string
  name: string
  after: string
}

/** Contenu d'une carte d'outil : seul l'ancien texte d'un diff compte ici. */
export interface LabelledContent {
  type: string
  oldText?: string | null
}

/**
 * L'outil crée-t-il un fichier (fiche 203) ? Générique ACP : un outil `edit` dont chaque diff n'a
 * pas d'ancien texte (`oldText` nul ou absent : la règle de `DiffView`, badge « nouveau fichier »).
 * Rien n'est deviné ici pour `oldText: ""` (fichier vide existant, ou nouveau) : le main l'a déjà
 * remis à `null` s'il a vu le fichier absent quand l'outil a été proposé (`main/agent/new-files.ts`).
 */
export function createsFile(item: {
  toolKind?: ToolKind | undefined
  content?: readonly LabelledContent[] | undefined
}): boolean {
  if (item.toolKind !== 'edit') return false
  const diffs = (item.content ?? []).filter((c) => c.type === 'diff')
  return diffs.length > 0 && diffs.every((d) => d.oldText == null)
}

/** Ce qu'il faut d'une carte d'outil pour la libeller. */
export interface LabelledTool {
  title: string
  toolKind?: ToolKind
  locations: readonly { path: string }[]
  input?: ToolInput
  /** État de la carte : un outil `pending` sans cible se libelle d'après son genre (fiche 128). */
  status?: string
  /** Autorisation de la carte : en attente, la carte dit déjà ce qu'on demande (fiche 128). */
  permission?: { state: unknown }
  /** Contenu de la carte : un diff sans ancien texte fait une création (fiche 203). */
  content?: readonly LabelledContent[]
}

/** Au-delà, un chemin est tronqué au milieu, le nom du fichier toujours entier. */
const MAX_PATH = 48
const MAX_TARGET = 60

/** Chemin relatif au dossier de la conversation ; hors du dossier, tel quel. */
export function relativePath(path: string, workspace: string | undefined): string {
  if (!workspace) return path
  const base = workspace.replace(/\/+$/, '')
  if (path === base) return `${base.split('/').filter(Boolean).at(-1) ?? ''}/`
  return path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path
}

/**
 * Chemin d'un fichier tel que l'en-tête d'un diff l'affiche (fiche 203) : relatif au dossier de la
 * conversation, sinon avec `~` pour le dossier personnel ; coupé en `dir` (le début, grisé, qui
 * peut être coupé par le début à l'affichage) et `name` (le nom, jamais coupé). Les deux passent
 * par `visibleText` : un caractère invisible ou bidi d'un chemin est rendu visible.
 */
export function filePathParts(
  path: string,
  workspace: string | undefined
): { dir: string; name: string } {
  const relative = relativePath(path, workspace)
  // Hors du dossier : `~` pour le dossier personnel, exact quand l'app le connaît (fiche 214).
  const shown =
    relative === path
      ? (shortFolderPath(path, { home: currentHomeFolder() }) ?? abbreviateHome(path))
      : relative
  const cut = shown.endsWith('/') ? -1 : shown.lastIndexOf('/')
  return {
    dir: visibleText(shown.slice(0, cut + 1)),
    name: visibleText(shown.slice(cut + 1))
  }
}

/** Chemin raccourci au milieu : « src/components/…/ToolCall.tsx ». */
export function shortenPath(path: string, max = MAX_PATH): string {
  if (path.length <= max) return path
  const slash = path.lastIndexOf('/')
  const tail = slash === -1 ? path : path.slice(slash)
  if (tail.length >= max - 1) return `…${tail.slice(tail.length - max + 1)}`
  const head = path.slice(0, max - tail.length - 1)
  const cut = head.lastIndexOf('/')
  return `${cut > 0 ? head.slice(0, cut + 1) : head}…${tail}`
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Chemins du dossier de la conversation rendus relatifs dans un texte (titre d'un outil, commande) :
 * « /Users/ada/livres/src/a.js » → « src/a.js », le dossier seul → « . » (fiche 125). Un dossier
 * voisin au nom qui commence pareil (« livres-copie ») n'est pas touché.
 */
function relativeIn(text: string, workspace: string | undefined): string {
  const base = workspace?.replace(/\/+$/, '')
  if (!base) return text
  const at = escapeRegExp(base)
  return text
    .replace(new RegExp(`${at}/(?=[^\\s/])`, 'g'), '')
    .replace(new RegExp(`${at}/?(?=$|[\\s"'\`;&|)])`, 'g'), '.')
}

/**
 * Commande lisible (fiche 125) : un `cd` de tête vers le dossier de la conversation disparaît (Bob :
 * « cd /Users/…/projet && npm test »), vers un sous-dossier il devient relatif ; les autres chemins
 * du dossier aussi. Ailleurs que dans le dossier, la commande ne change pas.
 */
export function cleanCommand(command: string, workspace: string | undefined): string {
  const base = workspace?.replace(/\/+$/, '')
  if (!base) return shortenHomeIn(command, currentHomeFolder())
  const cd = /^cd\s+("([^"]+)"|'([^']+)'|(\S+))\s*(&&|;)\s*/.exec(command)
  const dir = cd ? (cd[2] ?? cd[3] ?? cd[4] ?? '').replace(/\/+$/, '') : undefined
  const rest = cd && dir === base ? command.slice(cd[0].length) : command
  // Le dossier personnel en `~` (fiche 214) : libellé seulement, le bloc de la commande reste entier.
  return shortenHomeIn(relativeIn(rest, base), currentHomeFolder())
}

/** Titre brut d'un outil sans libellé : les chemins du dossier rendus relatifs (fiche 125). */
export function cleanTitle(title: string, workspace: string | undefined): string {
  return shortenHomeIn(relativeIn(title, workspace), currentHomeFolder())
}

/** Valeur citée (motif, commande) : raccourcie à la fin. */
const shorten = (value: string, max = MAX_TARGET) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

/** Adresse sans le protocole ni la barre finale, raccourcie. */
const shortUrl = (url: string) => shorten(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))

/** Cible d'un outil de fichier : le premier chemin, combien d'autres, le texte et le détail. */
interface FileTarget {
  text: string
  detail: string
  first: string
  others: number
}

/** Cible d'un outil de fichier : le premier emplacement, sinon le chemin de `rawInput`. */
function fileTarget(item: LabelledTool, workspace: string | undefined): FileTarget | undefined {
  const paths = item.locations.length ? item.locations.map((l) => l.path) : []
  const first = paths[0] ?? item.input?.path
  if (!first) return undefined
  const shown = shortenPath(relativePath(first, workspace))
  const others = paths.length - 1
  return {
    text: others > 0 ? t('toolCall.label.others', { target: shown, count: others }) : shown,
    detail: paths.length > 1 ? paths.join('\n') : first,
    first,
    others
  }
}

/** Repère de la cible dans un libellé traduit (jamais dans un chemin ni une traduction). */
const SLOT = '\u0000'

type FileKey =
  | 'toolCall.label.read'
  | 'toolCall.label.create'
  | 'toolCall.label.edit'
  | 'toolCall.label.delete'
  | 'toolCall.label.move'
  | 'toolCall.label.list'
  | 'toolCall.label.searchIn'

/**
 * Libellé d'un outil de fichier : le texte (chemin raccourci au milieu, pour l'infobulle, la
 * notification…) et ses morceaux pour la ligne d'outil (`file`). Les morceaux : le texte traduit
 * autour de la cible, et la cible coupée en dossier et nom (`filePathParts` : relatif, `~`,
 * `visibleText`). Une traduction sans la cible une seule fois : pas de morceaux.
 */
function fileLabel(
  key: FileKey,
  target: FileTarget,
  workspace: string | undefined
): Pick<ToolLabel, 'text' | 'detail' | 'file'> {
  const slot =
    target.others > 0 ? t('toolCall.label.others', { target: SLOT, count: target.others }) : SLOT
  const around = t(key, { target: slot }).split(SLOT)
  const { dir, name } = filePathParts(target.first, workspace)
  return {
    text: t(key, { target: target.text }),
    detail: target.detail,
    ...(around.length === 2 && name
      ? { file: { before: around[0] ?? '', dir, name, after: around[1] ?? '' } }
      : {})
  }
}

/** Le titre est le nom nu d'un outil de liste de dossier (« list », « ls »). */
const isListTitle = (title: string) => /^(list|ls)$/i.test(title.trim())

const FILE_KINDS = {
  read: 'toolCall.label.read',
  edit: 'toolCall.label.edit',
  delete: 'toolCall.label.delete',
  move: 'toolCall.label.move'
} as const

/** Clé du libellé « Prépare… » d'un outil encore annoncé sans rien d'autre (fiche 128). */
const PREPARING = {
  edit: 'toolCall.label.preparing.edit',
  execute: 'toolCall.label.preparing.execute',
  read: 'toolCall.label.preparing.read',
  search: 'toolCall.label.preparing.search'
} as const

/** Nom du genre d'un outil interrompu ou en échec sans cible (« Modification · interrompu »). */
const KIND_NAMES = {
  read: 'toolCall.label.kindName.read',
  edit: 'toolCall.label.kindName.edit',
  create: 'toolCall.label.kindName.create',
  delete: 'toolCall.label.kindName.delete',
  move: 'toolCall.label.kindName.move',
  search: 'toolCall.label.kindName.search',
  execute: 'toolCall.label.kindName.execute',
  fetch: 'toolCall.label.kindName.fetch'
} as const

const ENDED_WITHOUT_RESULT = new Set(['failed', 'cancelled', 'refused'])

/**
 * Outil sans cible (fiche 128) : OpenCode annonce « patch » en `pending` avec `rawInput: {}` puis se
 * tait le temps que le modèle écrive le patch ; le titre brut ne dit rien. Tant qu'il est annoncé, il
 * prend le libellé de son genre ; interrompu ou en échec, le nom de son genre, la carte disant
 * l'état. Le titre brut reste en infobulle. Générique : seuls `kind`, `status` et l'autorisation
 * comptent. Un `execute` titré d'une commande (plusieurs mots) garde son titre : c'est sa cible.
 */
function untargetedLabel(item: LabelledTool): ToolLabel | undefined {
  const kind = item.toolKind ?? 'other'
  if (kind === 'think' || kind === 'switch_mode') return undefined
  if (kind === 'execute' && /\s/.test(item.title.trim())) return undefined
  if (item.permission?.state === 'pending') return undefined
  const detail = item.title.trim() ? { detail: item.title } : {}
  if (item.status === 'pending') {
    const key =
      kind === 'edit' || kind === 'execute' || kind === 'read' || kind === 'search'
        ? PREPARING[kind]
        : 'toolCall.label.preparing.other'
    return { text: t(key), ...detail }
  }
  if (item.status && ENDED_WITHOUT_RESULT.has(item.status) && kind in KIND_NAMES) {
    if (createsFile(item)) {
      return { text: t(KIND_NAMES.create), created: true, ...detail }
    }
    return { text: t(KIND_NAMES[kind as keyof typeof KIND_NAMES]), ...detail }
  }
  return undefined
}

/**
 * Libellé lisible d'un outil de l'agent, d'après son genre et sa cible ; `undefined` quand le
 * titre de l'agent doit rester (genre inconnu, sans cible).
 */
export function toolLabel(item: LabelledTool, workspace?: string): ToolLabel | undefined {
  return targetLabel(item, workspace) ?? untargetedLabel(item)
}

function targetLabel(item: LabelledTool, workspace: string | undefined): ToolLabel | undefined {
  const kind = item.toolKind ?? 'other'
  // Liste de tâches (Bob : « Updating todo list », genre « other ») : quoi, et combien.
  const todos = item.input?.todos
  if (todos) {
    return { text: t('toolCall.label.todos', { count: todos.length }), detail: todos.join('\n') }
  }
  if (kind === 'execute') return commandLabel(item, workspace)
  if (kind === 'fetch') {
    const url = item.input?.url
    return url
      ? { text: t('toolCall.label.fetch', { target: shortUrl(url) }), detail: url }
      : undefined
  }
  if (kind === 'search') {
    const pattern = item.input?.pattern
    if (pattern) {
      const where = fileTarget(item, workspace)
      return {
        text: t('toolCall.label.search', { target: shorten(pattern) }),
        detail: where ? `${pattern}\n${where.detail}` : pattern
      }
    }
    const where = fileTarget(item, workspace)
    if (!where) return undefined
    const key = isListTitle(item.title) ? 'toolCall.label.list' : 'toolCall.label.searchIn'
    return fileLabel(key, where, workspace)
  }
  if (kind === 'read' || kind === 'edit' || kind === 'delete' || kind === 'move') {
    const target = fileTarget(item, workspace)
    if (!target) return undefined
    if (createsFile(item)) {
      return { ...fileLabel('toolCall.label.create', target, workspace), created: true }
    }
    const key =
      kind === 'read' && isListTitle(item.title) ? 'toolCall.label.list' : FILE_KINDS[kind]
    return fileLabel(key, target, workspace)
  }
  return undefined
}

/**
 * Commande : son texte nettoyé, en code (`rawInput.command`, sinon le titre, qui est la commande
 * chez Bob) ; en détail, la commande entière et le titre s'il en diffère. Rien quand ni l'un ni
 * l'autre ne dit plus que le titre.
 */
function commandLabel(item: LabelledTool, workspace: string | undefined): ToolLabel | undefined {
  const command = item.input?.command ?? item.title
  const text = cleanCommand(command, workspace)
  const details = [
    ...(text !== command ? [command] : []),
    ...(item.title !== command ? [item.title] : [])
  ]
  if (!item.input?.command && details.length === 0) return undefined
  return { text, code: true, ...(details.length ? { detail: details.join('\n') } : {}) }
}

/** Ce que la carte affiche : le libellé, sinon le titre de l'agent nettoyé (fiche 125). */
export function toolText(item: LabelledTool, workspace?: string): string {
  return toolLabel(item, workspace)?.text ?? cleanTitle(item.title, workspace)
}
