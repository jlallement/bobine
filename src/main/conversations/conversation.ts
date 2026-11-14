/**
 * Une conversation telle que le gestionnaire la tient (sorti de `manager.ts`, plafond de taille,
 * fiche 089), et ce qu'on peut en suivre.
 */
import type { AgentSnapshot, ConversationEvent, ConversationsState } from '@shared/agent'
import { emptyTranscript, type TranscriptState } from '@shared/transcript'
import type { AgentHost } from '../agent/agent-host'
import type { ConversationRecord } from './store'

/** Ce qu'on peut suivre du gestionnaire en plus de `emit` et `emitList` (fiche 089). */
export interface ConversationListeners {
  event?: (payload: ConversationEvent) => void
  list?: (state: ConversationsState) => void
  deleted?: (id: string) => void
  /** Sortie de l'app : tout s'arrête (apartés, fiche 180). */
  stopped?: () => void
}

export interface Conversation {
  record: ConversationRecord
  /** Fil de la conversation, lu du disque à la première demande (`transcriptOf`, fiche 043). */
  transcript?: TranscriptState
  host?: AgentHost
  snapshot?: AgentSnapshot
  lastUsed: number
  /** Dernière demande du fil (fiche 046) : les moins récents sont libérés en premier. */
  readAt: number
  draft: boolean
  /**
   * Numéro du dernier évènement émis : la vue le porte, et l'interface ignore un évènement déjà
   * compris dans une vue arrivée avant lui (sinon un morceau de réponse s'affichait deux fois).
   */
  seq?: number
}

/** Brouillon neuf : fil vide, pas encore dans l'historique. */
export function draftConversation(record: ConversationRecord): Conversation {
  const now = Date.now()
  return { record, transcript: emptyTranscript, lastUsed: now, readAt: now, draft: true }
}
