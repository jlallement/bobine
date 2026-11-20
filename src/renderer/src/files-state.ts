/**
 * État de l'onglet Fichiers (fiche 271), retenu par conversation d'un lancement à l'autre (Q2) :
 * dossiers dépliés, fichier ouvert et sa position, historique précédent / suivant (Q9). Réglages de
 * lecture communs à toutes les conversations : retour à la ligne (Q47), côté de l'arbre en agrandi
 * (Q58), arbre affiché (⇧⌘Y). Commodité : sans stockage, tout repart des défauts.
 */
import type { FileTarget } from '@shared/files'

export interface FilesState {
  /** Dossiers dépliés : `racine:chemin`. */
  expanded: string[]
  /** Fichier ouvert (Q9 : un seul à la fois). */
  open?: FileTarget
  /** Fichiers ouverts avant (le plus récent en dernier), et ceux quittés par « précédent ». */
  back: FileTarget[]
  forward: FileTarget[]
  /** Défilement du fichier ouvert (px). */
  scroll?: number
}

export type TreeSide = 'auto' | 'left' | 'right'

/** Évènement de ⇧⌘Y (menu Affichage) vers l'onglet Fichiers affiché. */
export const TOGGLE_TREE_EVENT = 'bobine:files-toggle-tree'

/** « Aller à la ligne… » du menu de l'onglet (point 11) vers le code affiché. */
export const FILE_GOTO_EVENT = 'bobine:files-goto'

/** Markdown en source plutôt que rendu, retenu le temps de la session (Q10, point 12). */
let markdownSource = false
export const markdownSourceWanted = () => markdownSource
export const setMarkdownSourceWanted = (source: boolean) => {
  markdownSource = source
}

/** Évènement de ⌘F quand le focus est dans le fichier ouvert (Q48). */
export const FILE_FIND_EVENT = 'bobine:files-find'

/** ⌘F dans le fichier ouvert : cherche dans le fichier ; `false` si le focus est ailleurs. */
export function findInOpenFile(): boolean {
  // Un fichier de code affiché (pas une image, un Markdown rendu, un binaire) : sinon, le fil.
  const view = document.activeElement?.closest('[data-testid=file-view]')
  if (!view?.querySelector('[data-testid=file-code]')) return false
  window.dispatchEvent(new Event(FILE_FIND_EVENT))
  return true
}

export interface FilesPreferences {
  wrap: boolean
  side: TreeSide
  /** Arbre affiché à côté du fichier ouvert (agrandi) ; panneau étroit : l'arbre ou le fichier. */
  tree: boolean
}

const STATE_KEY = 'bobine.files'
const PREFS_KEY = 'bobine.files.preferences'
/** Conversations dont on garde l'état (les plus récentes). */
const MAX_CONVERSATIONS = 50
/** Historique gardé. */
const MAX_HISTORY = 30

export const EMPTY_FILES_STATE: FilesState = { expanded: [], back: [], forward: [] }
export const DEFAULT_FILES_PREFERENCES: FilesPreferences = { wrap: true, side: 'auto', tree: true }

/** Clé d'un dossier déplié. */
export const dirKey = (root: number, path: string) => `${root}:${path}`

const isTarget = (value: unknown): value is FileTarget => {
  const v = value as Partial<FileTarget> | null
  return (
    !!v &&
    typeof v.root === 'number' &&
    Number.isInteger(v.root) &&
    v.root >= 0 &&
    typeof v.path === 'string' &&
    (v.line === undefined || (typeof v.line === 'number' && v.line > 0))
  )
}

/** État lu du stockage, vérifié (ce qui ne va pas est oublié). */
export function parseFilesState(value: unknown): FilesState {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const list = (key: string) => (Array.isArray(v[key]) ? (v[key] as unknown[]) : [])
  return {
    expanded: list('expanded').filter((k): k is string => typeof k === 'string'),
    ...(isTarget(v['open']) ? { open: v['open'] } : {}),
    back: list('back').filter(isTarget).slice(-MAX_HISTORY),
    forward: list('forward').filter(isTarget).slice(-MAX_HISTORY),
    ...(typeof v['scroll'] === 'number' && v['scroll'] >= 0 ? { scroll: v['scroll'] } : {})
  }
}

function readAll(): Record<string, unknown> {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}') as unknown
    return saved && typeof saved === 'object' && !Array.isArray(saved)
      ? (saved as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function loadFilesState(conversationId: string): FilesState {
  return parseFilesState(readAll()[conversationId])
}

export function saveFilesState(conversationId: string, state: FilesState): void {
  try {
    // La conversation enregistrée passe en dernier : on garde les plus récentes.
    const others = Object.entries(readAll()).filter(([id]) => id !== conversationId)
    const kept = [...others, [conversationId, state] as const].slice(-MAX_CONVERSATIONS)
    localStorage.setItem(STATE_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    // Stockage indisponible : l'onglet repartira replié.
  }
}

export function loadFilesPreferences(): FilesPreferences {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>
    return {
      wrap: typeof v['wrap'] === 'boolean' ? v['wrap'] : DEFAULT_FILES_PREFERENCES.wrap,
      side: v['side'] === 'left' || v['side'] === 'right' ? v['side'] : 'auto',
      tree: typeof v['tree'] === 'boolean' ? v['tree'] : DEFAULT_FILES_PREFERENCES.tree
    }
  } catch {
    return DEFAULT_FILES_PREFERENCES
  }
}

export function saveFilesPreferences(preferences: FilesPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(preferences))
  } catch {
    // Stockage indisponible : réglages par défaut au prochain lancement.
  }
}

const same = (a: FileTarget | undefined, b: FileTarget) =>
  !!a && a.root === b.root && a.path === b.path

/** Ouvre `target` : le fichier d'avant passe dans l'historique (Q9), « suivant » est oublié. */
export function openFile(state: FilesState, target: FileTarget): FilesState {
  if (same(state.open, target)) return { ...state, open: target }
  const { scroll: _scroll, ...rest } = state
  return {
    ...rest,
    open: target,
    back: state.open
      ? [...state.back, { root: state.open.root, path: state.open.path }].slice(-MAX_HISTORY)
      : state.back,
    forward: []
  }
}

/** Ferme le fichier ouvert (retour à l'arbre) ; il reste dans l'historique. */
export function closeFile(state: FilesState): FilesState {
  if (!state.open) return state
  const { open, scroll: _scroll, ...rest } = state
  return {
    ...rest,
    back: [...state.back, { root: open.root, path: open.path }].slice(-MAX_HISTORY),
    forward: []
  }
}

/** Fichier précédent (`-1`) ou suivant (`1`) ; rien s'il n'y en a pas. */
export function stepFile(state: FilesState, delta: -1 | 1): FilesState {
  const from = delta < 0 ? state.back : state.forward
  const target = from.at(-1)
  if (!target) return state
  const current = state.open ? [{ root: state.open.root, path: state.open.path }] : []
  const { scroll: _scroll, ...rest } = state
  return delta < 0
    ? {
        ...rest,
        open: target,
        back: state.back.slice(0, -1),
        forward: [...state.forward, ...current]
      }
    : {
        ...rest,
        open: target,
        forward: state.forward.slice(0, -1),
        back: [...state.back, ...current]
      }
}

/** Déplie (ou replie) un dossier. */
export function toggleDir(state: FilesState, key: string, open?: boolean): FilesState {
  const has = state.expanded.includes(key)
  const wanted = open ?? !has
  if (wanted === has) return state
  return {
    ...state,
    expanded: wanted ? [...state.expanded, key] : state.expanded.filter((k) => k !== key)
  }
}

/** Déplie les dossiers parents d'un fichier (il se voit dans l'arbre, Q31). */
export function revealIn(state: FilesState, root: number, dirs: readonly string[]): FilesState {
  const keys = [dirKey(root, ''), ...dirs.map((d) => dirKey(root, d))]
  const missing = keys.filter((k) => !state.expanded.includes(k))
  return missing.length ? { ...state, expanded: [...state.expanded, ...missing] } : state
}

/** Replie tout (Q32) ; la racine principale reste dépliée. */
export const collapseAll = (state: FilesState): FilesState => ({
  ...state,
  expanded: [dirKey(0, '')]
})
