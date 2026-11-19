/**
 * Adaptateur du repère (fiche 261) : un travail délégué est une conversation fille lancée depuis ce
 * fil (`child-started`, fiche 097 ; rôle, fiche 223). Lancé par une bulle « @Rôle … » (fiche 263),
 * ou avec une clé de carte (proposition, « Lancer en parallèle… », fiche 264), sa carte est à place
 * fixe : carte-réponse, ligne de sa carte de groupe, ou carte seule (ancre : son lancement,
 * `workCards`). Sinon (ancienne conversation), son dernier compte rendu, ou à défaut son lancement. Son état vient de la liste des conversations (`childState`).
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
  // Ancre de chaque travail rangé : sa carte-réponse, sa ligne de carte de groupe, ou sa carte
  // seule (fiche 264) ; toujours l'id de son lancement.
  const anchors = new Map(
    [...[...carded.byRequest.values()].flat(), ...carded.byCard.values()].flatMap((card) =>
      card.anchor === undefined ? [] : [[card.childId, card.anchor] as const]
    )
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
