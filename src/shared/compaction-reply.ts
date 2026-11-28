/**
 * Réponse en texte à la commande de compaction (fiches 126, 140), sortie de `transcript.ts`
 * (taille bornée, fiche 089).
 */
import type { StopReason } from './acp-sdk.mts'
import { withCompactionEstimate } from './context-estimate'
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
  const replaced: TranscriptState = {
    ...state,
    items: state.items.flatMap((item) =>
      item === first ? [card] : item.kind === 'agent' && replies.includes(item) ? [] : [item]
    )
  }
  // Total estimé si l'agent ne l'a pas chiffré depuis la commande (fiche 257) ; un tour annulé
  // n'a rien résumé.
  return card.status === 'completed' ? withCompactionEstimate(replaced, user.id) : replaced
}

/**
 * Carte de compaction de cet identifiant dans le fil (la dernière), ou -1. Sortie de
 * `transcript.ts` (taille bornée, fiche 089).
 */
export function findCompaction(items: TranscriptItem[], compactionId: string): number {
  return items.findLastIndex(
    (item) => item.kind === 'compaction' && item.compactionId === compactionId
  )
}

/** Texte de blocs de contenu (les autres types sont signalés entre crochets). */
export function blocksText(blocks: { type: string; text?: string }[]): string {
  return blocks.map((b) => (b.type === 'text' ? (b.text ?? '') : `[${b.type}]`)).join('')
}
