/**
 * Élément d'un tour qui part (fiche 285), sorti de `roundtables.ts` (taille bornée) : participants
 * nommés d'après ce que leur agent a annoncé, lettres tirées, arbitre relevé au lancement.
 */
import { randomUUID } from 'node:crypto'
import type { ConversationSummary } from '@shared/agent'
import { attachmentName } from '@shared/attachments'
import { newSeats, type Roundtable, type RoundtableParticipant } from '@shared/roundtable'
import type { RoundtableStartRequest } from '@shared/roundtable-ipc'
import { shortModelName } from '@shared/models'
import { modelControl } from '../agent/models-seen'
import type { ConversationManager } from '../conversations/manager'

export interface NewRoundtableDeps {
  conversations: Pick<ConversationManager, 'view' | 'settingsView' | 'settings'>
  random: () => number
  now: number
}

export function newRoundtable(
  deps: NewRoundtableDeps,
  summary: ConversationSummary,
  request: RoundtableStartRequest
): Roundtable {
  const profiles = deps.conversations.settingsView().profiles
  const control = modelControl(deps.conversations.view(summary.id).snapshot?.controls ?? [])
  const seen = deps.conversations.settings.current.models ?? {}
  // Nom du modèle d'après ce que l'agent a annoncé (session de la conversation, sinon modèles
  // vus), jamais d'après le renderer ; inconnu : son identifiant.
  const nameOf = (profileId: string, value: string) =>
    (profileId === summary.profileId
      ? control?.options.find((o) => o.value === value)?.name
      : undefined) ??
    seen[profileId]?.options.find((o) => o.value === value)?.name ??
    value
  const participants: RoundtableParticipant[] = request.participants.map((choice) => {
    const agentLabel = profiles.find((p) => p.id === choice.profileId)?.label ?? choice.profileId
    if (!choice.model) return { ...choice, label: agentLabel, agentLabel }
    const name = nameOf(choice.profileId, choice.model.value)
    return { ...choice, model: { ...choice.model, name }, label: name, agentLabel }
  })
  const name = control?.options.find((o) => o.value === control.currentValue)?.name
  const model = name ? shortModelName(name) : undefined
  const names = (request.attachments ?? []).map(attachmentName)
  return {
    roundtableId: randomUUID(),
    question: request.question,
    ...(names.length ? { attachments: names } : {}),
    synthesizer: {
      profileId: summary.profileId,
      label: summary.profileLabel,
      ...(model ? { model } : {})
    },
    seats: newSeats(participants, deps.random),
    phase: 'collecting',
    at: deps.now
  }
}
