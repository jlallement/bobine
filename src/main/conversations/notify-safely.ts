import type { ConversationEvent } from '@shared/agent'
import { log } from '../log'

type Listener = ((payload: ConversationEvent) => void) | undefined

/**
 * Évènement remis au renderer (`emit`) puis à chaque abonné du gestionnaire (revue QA de la fiche
 * 263) : un abonné qui lève ne prive pas les suivants de l'évènement ; l'échec est journalisé.
 */
export function notifyAll(
  emit: Listener,
  listeners: Iterable<{ event?: Listener }>,
  payload: ConversationEvent
): void {
  for (const listener of [emit, ...[...listeners].map((l) => l.event)]) {
    try {
      listener?.(payload)
    } catch (error) {
      log.error(`Abonné aux évènements en échec (${payload.event.type}) :`, error)
    }
  }
}
