import type { SessionUpdate } from './acp-sdk.mts'
import type { TranscriptItem } from './transcript'

/**
 * Message de l'agent auquel appartient un morceau (`messageId` d'ACP : « a change in `messageId`
 * indicates a new message has started », champ stable du schéma, SDK 2.4 et 2.7). OpenCode 2.3.0
 * l'envoie sur chaque morceau, y compris ses réponses hors tour (fiche 232).
 */
export interface MessageMark {
  messageId?: string
}

/** Élément de texte du fil, que prolonge un morceau. */
type TextItem = Extract<TranscriptItem, { kind: 'agent' | 'thought' | 'user' }>

/** Le `messageId` d'un morceau de l'agent, à garder avec son message (pas pour l'utilisateur). */
export function messageMarkOf(update: SessionUpdate, kind: TextItem['kind']): MessageMark {
  if (kind === 'user' || !('messageId' in update)) return {}
  const id = update.messageId
  return typeof id === 'string' && id !== '' ? { messageId: id } : {}
}

/**
 * Un morceau de texte de l'agent (`agent`, `thought`) ou de l'utilisateur rejoué (`user`) prolonge-t-il
 * le dernier élément du fil ? Oui s'il est du même genre, sauf :
 * - un autre `messageId` que celui du message en cours : l'agent a commencé un autre message
 *   (signal du protocole ; OpenCode 2.3.0 répond ainsi deux fois hors tour, un rapport de
 *   sous-agent après l'autre, fiche 232) ;
 * - une réponse datée par sa fin de tour : elle est close, et l'agent qui reparle ensuite de
 *   lui-même, hors tour, commence un autre message (pour un agent qui n'envoie pas `messageId`).
 */
export function continuesText(
  last: TranscriptItem,
  kind: TextItem['kind'],
  messageId?: string
): last is TextItem {
  if (last.kind !== kind) return false
  if (last.kind !== 'user' && last.messageId && messageId && last.messageId !== messageId) {
    return false
  }
  return !(last.kind === 'agent' && last.at !== undefined)
}
