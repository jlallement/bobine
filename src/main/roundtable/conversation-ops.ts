/**
 * Petits gestes du tour de table sur une conversation, sortis de `roundtables.ts` (taille bornée) :
 * sans lever si la conversation est partie entre-temps.
 */
import { log } from '../log'
import type { RoundtableManager } from './roundtables'

/** Réplique de ce tour encore en file ou retenue au plafond chez ce participant : retirée. */
export function dropPending(
  conversations: Pick<RoundtableManager, 'view' | 'unqueue'>,
  dropHeld: ((conversationId: string, roundtableId: string) => void) | undefined,
  childId: string,
  roundtableId: string
): void {
  dropHeld?.(childId, roundtableId)
  try {
    const queued = conversations.view(childId).snapshot?.queued ?? []
    for (const message of queued) {
      if (message.from?.kind === 'roundtable' && message.from.id === roundtableId) {
        conversations.unqueue(childId, message.id)
      }
    }
  } catch {
    // Conversation partie entre-temps : plus rien en file.
  }
}

/** Arrête le tour en cours d'une conversation, sans lever. */
export function cancelQuietly(
  conversations: Pick<RoundtableManager, 'cancel'>,
  conversationId: string
): void {
  try {
    void conversations.cancel(conversationId).catch((error: unknown) => {
      log.warn(`Tour de table : arrêt de ${conversationId.slice(0, 8)} impossible :`, error)
    })
  } catch {
    // Conversation partie entre-temps : plus rien à arrêter.
  }
}
