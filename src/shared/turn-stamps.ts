/**
 * Heures de fin des réponses d'un tour, et travail de l'agent après la fin du tour (fiche 255),
 * sortis de `transcript.ts` (taille bornée, fiche 089).
 */
import type { AgentEvent } from './agent'
import type { TranscriptItem, TranscriptState } from './transcript'

/** Index du dernier message utilisateur (début du tour courant), -1 s'il n'y en a pas. */
export function turnStart(items: readonly TranscriptItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (items[i]?.kind === 'user') return i
  return -1
}

/** Heure de fin de la réponse sur les messages de l'agent du tour qui n'en ont pas encore. */
export function stampReplies(state: TranscriptState, at: number | undefined): TranscriptState {
  if (!at) return state
  const start = turnStart(state.items)
  let changed = false
  const items = state.items.map((item, i) => {
    if (i <= start || item.kind !== 'agent' || item.at) return item
    changed = true
    return { ...item, at }
  })
  return changed ? { ...state, items } : state
}

/** Plus de travail après le tour : le même état s'il n'y en avait pas. */
export function withoutBackground(state: TranscriptState): TranscriptState {
  if (!state.backgroundWork) return state
  const { backgroundWork: _done, ...rest } = state
  return rest
}

/**
 * L'agent travaille encore après la fin du tour (`background-work`, fiche 255). À la fin, un tour
 * qui a lancé un sous-agent en arrière-plan finit avec la réponse que l'agent donne hors tour à son
 * rapport : elle reçoit son heure. Après un autre message, ce tour-là n'a rien lancé : la réponse
 * reste hors tour (fiche 232).
 */
export function backgroundWork(
  state: TranscriptState,
  event: Extract<AgentEvent, { type: 'background-work' }>
): TranscriptState {
  if (event.active) return state.backgroundWork ? state : { ...state, backgroundWork: true }
  const start = turnStart(state.items)
  const launched = state.items.some(
    (item, i) => i > start && item.kind === 'tool' && item.subagentRun?.background
  )
  const done = withoutBackground(state)
  return launched ? stampReplies(done, event.at) : done
}
