/**
 * Contenu et emplacements d'un `tool_call` reçu pour une carte qui existe déjà (fiche 203). La
 * demande d'autorisation peut atteindre le fil avant le `tool_call` qui l'a précédée : Bob 2.0.9
 * annonce son écriture sans le diff, que seule la demande porte. Un `tool_call` sans contenu (ou
 * sans emplacements) garde donc ceux de la carte ; s'il en a, ils remplacent les siens.
 */
import type { ToolCallContent, ToolCallLocation } from './acp-sdk.mts'
import type { TranscriptItem } from './transcript'

export function contentOrKept(
  update: {
    content?: ToolCallContent[] | null | undefined
    locations?: ToolCallLocation[] | null | undefined
  },
  known: TranscriptItem | undefined
): { content: ToolCallContent[]; locations: ToolCallLocation[] } {
  const tool = known?.kind === 'tool' ? known : undefined
  return {
    content: update.content?.length ? update.content : (tool?.content ?? []),
    locations: update.locations?.length ? update.locations : (tool?.locations ?? [])
  }
}
