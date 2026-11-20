/**
 * Champs facultatifs d'un message de l'utilisateur, recopiés de l'évènement `user-message` dans
 * l'élément `user` du fil (fiches 040, 097, 126, 130, 263, 265) : seulement ceux qui sont là.
 */
import type { AgentEvent } from './agent'

type UserMessage = Extract<AgentEvent, { type: 'user-message' }>

export function userMessageFields(event: UserMessage) {
  return {
    ...(event.attachments?.length ? { attachments: event.attachments } : {}),
    ...(event.mode ? { mode: event.mode } : {}),
    ...(event.model ? { model: event.model } : {}),
    ...(event.at ? { at: event.at } : {}),
    ...(event.from ? { from: event.from } : {}),
    ...(event.compaction ? { compaction: true as const } : {}),
    ...(event.about ? { about: event.about } : {})
  }
}
