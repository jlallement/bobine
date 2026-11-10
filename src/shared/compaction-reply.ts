/**
 * Réponse en texte à la commande de compaction (fiches 126, 140), sortie de `transcript.ts`
 * (taille bornée, fiche 089).
 */
import type { StopReason } from './acp-sdk.mts'
import type { TranscriptItem, TranscriptState } from './transcript'

/**
 * Tour ouvert par la commande de compaction (message marqué par l'hôte d'agent, fiche 140), sans
 * `compaction_update` de l'agent (réponse en texte) : sa réponse devient la carte « Conversation
 * résumée », comme pour un agent qui l'annonce (fiche 126). Rien ne change si l'agent a envoyé sa
 * propre carte.
 */
export function compactionReply(state: TranscriptState, stopReason: StopReason): TranscriptState {
  const start = state.items.findLastIndex((item) => item.kind === 'user')
  const user = state.items[start]
  if (user?.kind !== 'user' || !user.compaction) return state
  const turn = state.items.slice(start + 1)
  if (turn.some((item) => item.kind === 'compaction')) return state
  const replies = turn.filter(
    (item): item is Extract<TranscriptItem, { kind: 'agent' }> => item.kind === 'agent'
  )
  const first = replies[0]
  if (!first) return state
  const summary = replies
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n\n')
  const card: TranscriptItem = {
    kind: 'compaction',
    id: first.id,
    compactionId: `reply-${first.id}`,
    status: stopReason === 'cancelled' ? 'cancelled' : 'completed',
    summary
  }
  return {
    ...state,
    items: state.items.flatMap((item) =>
      item === first ? [card] : item.kind === 'agent' && replies.includes(item) ? [] : [item]
    )
  }
}
