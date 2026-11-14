/**
 * Ce que l'app tient dans le fil d'une conversation, à côté de ce que dit l'agent : la consommation
 * cumulée, le plafond de coût (fiche 157), l'historique de la saisie (fiche 227).
 */
import { addSentEntry, type SentEntry } from './sent-history'
import type { TranscriptState } from './transcript'

/** Ce que garde le fil au rejeu d'une session rechargée (`reset`). */
export function keptOnReset(
  state: TranscriptState
): Pick<TranscriptState, 'usage' | 'costCap' | 'sentHistory'> {
  return {
    ...(state.usage ? { usage: state.usage } : {}),
    ...(state.costCap ? { costCap: state.costCap } : {}),
    ...(state.sentHistory ? { sentHistory: state.sentHistory } : {})
  }
}

/** Fil avec une entrée de plus dans son historique (`sent-recorded`) ; un historique abîmé repart. */
export function withSentEntry(state: TranscriptState, entry: SentEntry): TranscriptState {
  const list = Array.isArray(state.sentHistory) ? state.sentHistory : []
  return { ...state, sentHistory: addSentEntry(list, entry) }
}
