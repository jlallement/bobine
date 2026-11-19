/**
 * Adaptateur du repère (fiche 261) : un travail délégué est une conversation fille lancée depuis ce
 * fil (`child-started`, fiche 097 ; rôle, fiche 223). Lancé par une bulle « @Rôle … » (fiche 263),
 * sa carte est sa carte-réponse, à place fixe (ancre : son lancement, `workCards`). Sinon (lancé par
 * l'agent, ancienne conversation), sa carte est son dernier compte rendu, ou à défaut sa carte de
 * lancement. Son état vient de la liste des conversations (`childState`).
 */
import type { ConversationSummary } from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import { childState, type ChildState } from '@shared/children'
import { workCards } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import type { CueState, CueTarget } from './work-cue'

type Started = Extract<TranscriptItem, { kind: 'child-started' }>

/** Les travaux délégués de ce fil, dans l'ordre des filles connues de la liste. */
export function delegatedWorkTargets(
  items: readonly TranscriptItem[],
  children: readonly Pick<ConversationSummary, 'id' | 'status' | 'turnStopped'>[],
  attention: AttentionState
): CueTarget[] {
  const launches = new Map<string, Started>()
  const reports = new Map<string, number>()
  for (const item of items) {
    if (item.kind === 'child-started') launches.set(item.childId, item)
    else if (item.kind === 'child-report') reports.set(item.childId, item.id)
  }
  const carded = workCards(items)
  const anchors = new Map(
    [...carded.byRequest.values()].flat().map((card) => [card.childId, card.anchor])
  )
  return children.flatMap((child) => {
    const launch = launches.get(child.id)
    if (!launch) return []
    return [
      {
        key: child.id,
        itemId: anchors.get(child.id) ?? reports.get(child.id) ?? launch.id,
        label: launch.role?.label ?? launch.title,
        ...(launch.role ? { role: launch.role } : {}),
        state: cueState(childState(child, attention[child.id]), !!launch.role)
      }
    ]
  })
}

/**
 * Un rôle « a répondu » (il rend un avis) ; une autre fille « a fini » (son tour). Une fille qui
 * attend l'utilisateur travaille encore ; arrêtée ou en erreur, le repère ne dit rien.
 */
function cueState(state: ChildState, role: boolean): CueState {
  if (state === 'running' || state === 'waiting') return 'working'
  if (state === 'unread' || state === 'done') return role ? 'replied' : 'finished'
  return 'idle'
}
