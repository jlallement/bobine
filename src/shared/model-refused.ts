/**
 * Travail ou conversation bloqué parce que son modèle a été refusé au dernier message (fiches 259,
 * 267) : « quota épuisé » ou « modèle refusé », partout où son état se dit (carte, barre latérale,
 * Session › En cours), au lieu de « attend votre accord ».
 */
import { t } from 'i18next'
import type { ConversationSummary } from './agent'

/** Le refus de modèle d'une conversation qui attend, s'il y en a un. */
export const refusedModel = (
  conversation: Pick<ConversationSummary, 'status' | 'modelRefused'> | undefined
): ConversationSummary['modelRefused'] =>
  conversation?.status === 'needs-action' ? conversation.modelRefused : undefined

/** « quota épuisé », « modèle refusé » : l'état court d'un travail bloqué. */
export const refusedCue = (refused: NonNullable<ConversationSummary['modelRefused']>): string =>
  t(refused.quota ? 'workCard.cue.quota' : 'workCard.cue.modelRefused')
