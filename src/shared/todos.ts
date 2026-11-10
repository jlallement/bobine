/**
 * Liste de tâches d'un outil (fiche 214) : `rawInput.todos`, que les agents envoient sous deux
 * formes. Bob 2.0.9 (`update_todo_list`, `kind: "other"`) : un texte à cases, une tâche par ligne
 * (`[x] fait`, `[-] en cours`, `[ ] à faire`). D'autres : un tableau (de textes, ou d'objets avec
 * un texte et un état). Fonction pure, sans cas particulier d'agent : la carte lit ce champ, pas le
 * titre ni le `kind`.
 */

import { toolArgsOf, type ToolArg } from './tool-args'

export type TodoState = 'pending' | 'in_progress' | 'completed'

export interface TodoItem {
  text: string
  state: TodoState
}

/** Plus de tâches que cela : le reste est ignoré (une carte n'est pas un tableau de bord). */
export const MAX_TODOS = 200
/** Texte d'une tâche tronqué à cette longueur. */
const MAX_TEXT = 500

/**
 * Marqueurs d'état d'un texte à cases, comme les lit Bob (`[ ]` à faire, `[x]` ou `[X]` fait, `[-]`
 * ou `[~]` en cours). La même expression que la sienne : une ligne qui n'est pas une case est
 * ignorée, jamais devinée.
 */
const CHECKBOX = /^\[\s*([ xX\-~])\s*\]\s+(.+)$/

const STATE_WORDS: Record<string, TodoState> = {
  pending: 'pending',
  todo: 'pending',
  open: 'pending',
  not_started: 'pending',
  in_progress: 'in_progress',
  inprogress: 'in_progress',
  doing: 'in_progress',
  active: 'in_progress',
  running: 'in_progress',
  completed: 'completed',
  complete: 'completed',
  done: 'completed',
  finished: 'completed'
}

const clip = (text: string): string =>
  text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text

function fromText(text: string): TodoItem[] {
  const items: TodoItem[] = []
  for (const raw of text.split(/\r?\n/)) {
    const match = CHECKBOX.exec(raw.trim())
    if (!match) continue
    const mark = match[1] ?? ' '
    const state: TodoState =
      mark === 'x' || mark === 'X'
        ? 'completed'
        : mark === '-' || mark === '~'
          ? 'in_progress'
          : 'pending'
    items.push({ text: clip((match[2] ?? '').trim()), state })
  }
  return items
}

const wordsOf = (value: string): TodoState | undefined =>
  STATE_WORDS[
    value
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  ]

/** État d'une entrée objet : `status` / `state` en mot, ou un booléen `done` / `completed`. */
function stateOf(entry: Record<string, unknown>): TodoState {
  for (const key of ['status', 'state']) {
    const value = entry[key]
    if (typeof value === 'string') {
      const known = wordsOf(value)
      if (known) return known
    }
  }
  if (entry['done'] === true || entry['completed'] === true) return 'completed'
  return 'pending'
}

const TEXT_KEYS = ['content', 'text', 'title', 'description', 'task', 'activeForm']

function fromEntry(entry: unknown): TodoItem | undefined {
  if (typeof entry === 'string') {
    // Un élément de tableau peut être une ligne à cases comme une phrase seule.
    const boxed = fromText(entry)[0]
    if (boxed) return boxed
    const text = entry.trim()
    return text ? { text: clip(text), state: 'pending' } : undefined
  }
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return undefined
  const record = entry as Record<string, unknown>
  const raw = TEXT_KEYS.map((key) => record[key]).find((v) => typeof v === 'string' && v.trim())
  if (typeof raw !== 'string') return undefined
  return { text: clip(raw.trim()), state: stateOf(record) }
}

/**
 * Les tâches d'un `todos` (texte à cases, ou tableau) ; liste vide si rien de lisible. Les lignes
 * et entrées illisibles sont ignorées, au plus `MAX_TODOS` tâches sont gardées.
 */
export function parseTodos(todos: unknown): TodoItem[] {
  if (typeof todos === 'string') return fromText(todos).slice(0, MAX_TODOS)
  if (!Array.isArray(todos)) return []
  const items: TodoItem[] = []
  for (const entry of todos) {
    const item = fromEntry(entry)
    if (item) items.push(item)
    if (items.length >= MAX_TODOS) break
  }
  return items
}

/** Les tâches de `rawInput.todos`, ou `undefined` : l'entrée n'est pas une liste de tâches. */
export function todosOf(rawInput: unknown): TodoItem[] | undefined {
  if (typeof rawInput !== 'object' || rawInput === null) return undefined
  const items = parseTodos((rawInput as Record<string, unknown>)['todos'])
  return items.length > 0 ? items : undefined
}

/** Pour le réducteur du fil : les tâches de `rawInput`, sinon celles déjà gardées. */
export function withTodos(
  rawInput: unknown,
  previous?: { todos?: TodoItem[] | undefined; args?: ToolArg[] | undefined },
  kind?: string | null
): { todos?: TodoItem[]; args?: ToolArg[] } {
  const todos = todosOf(rawInput) ?? previous?.todos
  const args = toolArgsOf(rawInput, kind) ?? previous?.args
  return { ...(todos ? { todos } : {}), ...(args ? { args } : {}) }
}
