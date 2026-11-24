/**
 * Ce qu'il faut à la ligne du tour de table et au menu des participants (`roundtable:options`,
 * fiche 285) : les agents installés, leurs modèles (récents d'abord, décision C6), la lecture seule
 * attendue, la destination des données (fiche 108), les places libres et ce qui partira.
 *
 * Générique : le choix du modèle suit `childModelChoice` (ADR-0036), la lecture seule suit
 * `writesWithoutAsking` et le rôle « Participant » installé (décision C3). Rien de propre à un agent.
 */
import type { ConversationSummary, ProfileSummary, SessionControl } from '@shared/agent'
import type { HandoverModel } from '@shared/handover'
import { lastRoundtable, roundtableRunning, type RoundtableReadOnly } from '@shared/roundtable'
import type {
  RoundtableAgentOption,
  RoundtableOptions,
  RoundtableStartError
} from '@shared/roundtable-ipc'
import { lastExchangeText } from '@shared/roundtable-prompts'
import type { TranscriptItem } from '@shared/transcript'
import { modelControl, type ModelsSeen } from '../agent/models-seen'
import { hasFolder } from '../conversations/agentless'
import type { ChildConversations } from '../conversations/children'
import { destinationOf, type ProvidersList } from '../conversations/handover'
import { inGitRepo } from '../conversations/helpers'
import type { ConversationManager } from '../conversations/manager'
import type { InstalledMode } from '../roles/launch'

/** Mode installé pour le rôle « Participant » dans cet agent, pour ce dossier (décision C3). */
export type ParticipantMode = (profileId: string, motherId: string) => InstalledMode | undefined

export interface OptionsDeps {
  conversations: Pick<ConversationManager, 'view' | 'settingsView' | 'settings'>
  children: Pick<ChildConversations, 'capacity'>
  providers: ProvidersList
  participantMode?: ParticipantMode
}

/** Pourquoi aucun tour ne peut partir de cette conversation, quelle que soit la sélection. */
export function refusalOf(
  summary: ConversationSummary,
  items: readonly TranscriptItem[]
): Exclude<RoundtableStartError, 'selection' | 'slots'> | undefined {
  if (summary.startedFrom || summary.reviewOf) return 'task'
  if (summary.archived) return 'archived'
  if (summary.space === 'discussion' || !hasFolder(summary.workspace)) return 'discussion'
  const last = lastRoundtable(items)
  return last && roundtableRunning(last) ? 'running' : undefined
}

/** Le dossier de la conversation est dans un dépôt git (empreinte de la lecture seule possible). */
export const folderInGit = (workspace: string): boolean =>
  hasFolder(workspace) && inGitRepo(workspace)

/**
 * Lecture seule attendue d'un participant de cet agent (décision C3) : tenue par Bobine si l'agent
 * demande avant d'écrire ; tenue par l'agent si le rôle « Participant » y est installé en lecture
 * seule ; sinon seulement demandée, vérifiée hors git impossible.
 */
export function expectedReadOnly(
  profile: Pick<ProfileSummary, 'id' | 'writesWithoutAsking'> | undefined,
  inGit: boolean,
  installed: InstalledMode | undefined
): RoundtableReadOnly {
  // Profil introuvable : rien ne dit comment l'agent écrit, rien n'est promis.
  if (!profile) return 'unverified'
  if (!profile.writesWithoutAsking) return 'enforced'
  if (installed?.readOnly && !installed.stale) return 'native'
  return inGit ? 'requested' : 'unverified'
}

/**
 * La session est dans le mode installé `id` : la **valeur** du réglage de mode, jamais son nom (un
 * mode d'un autre identifiant, fourni par le dépôt, peut porter le même libellé).
 */
export function modeHeld(controls: readonly SessionControl[], id: string): boolean {
  return controls.some((c) => c.category === 'mode' && c.type === 'select' && c.currentValue === id)
}

interface ModelSource {
  controlId?: string
  options: { value: string; name: string }[]
  recent: string[]
}

/** Modèles connus d'un agent : ceux de la session de la conversation si c'est le sien, sinon les vus. */
function modelSource(
  seen: ModelsSeen | undefined,
  session: SessionControl | undefined
): ModelSource {
  const options = session
    ? session.options.map(({ value, name }) => ({ value, name }))
    : (seen?.options ?? [])
  return {
    ...((session?.id ?? seen?.controlId) ? { controlId: session?.id ?? seen?.controlId } : {}),
    options,
    recent: (seen?.recent ?? []).filter((value) => options.some((o) => o.value === value))
  }
}

function agentOption(
  profile: ProfileSummary,
  source: ModelSource,
  providers: ReturnType<ProvidersList>,
  readOnly: RoundtableReadOnly
): RoundtableAgentOption {
  const own = providers.find((v) => v.profileId === profile.id)?.providers ?? []
  const model = (value: string, name: string, recent?: true): HandoverModel => ({
    value,
    name,
    ...(recent ? { featured: 'recent' as const } : {}),
    destination: destinationOf(value, own, profile.destination)
  })
  const modelChoice = !!profile.childModel
  const nameOf = (value: string) => source.options.find((o) => o.value === value)?.name ?? value
  return {
    profileId: profile.id,
    label: profile.label,
    available: profile.available,
    ...(profile.reason ? { reason: profile.reason } : {}),
    modelChoice,
    ...(modelChoice && source.controlId ? { controlId: source.controlId } : {}),
    readOnly,
    destination: destinationOf(undefined, own, profile.destination),
    recent: modelChoice ? source.recent.map((value) => model(value, nameOf(value), true)) : [],
    others: modelChoice
      ? source.options
          .filter((o) => !source.recent.includes(o.value))
          .map((o) => model(o.value, o.name))
      : []
  }
}

/** `roundtable:options` pour la conversation `conversationId` (vérifiée par `view`, qui lève). */
export function roundtableOptions(deps: OptionsDeps, conversationId: string): RoundtableOptions {
  const view = deps.conversations.view(conversationId)
  const { summary } = view
  const items = view.transcript.items
  const inGit = folderInGit(summary.workspace)
  const { active, max } = deps.children.capacity(conversationId)
  const memory = deps.conversations.settings.current.models ?? {}
  const providers = deps.providers()
  const ownSession = modelControl(view.snapshot?.controls ?? [])
  const agents = deps.conversations.settingsView().profiles.map((profile) => {
    const session = profile.id === summary.profileId ? ownSession : undefined
    const installed = deps.participantMode?.(profile.id, conversationId)
    const readOnly = expectedReadOnly(profile, inGit, installed)
    return agentOption(profile, modelSource(memory[profile.id], session), providers, readOnly)
  })
  const refused = refusalOf(summary, items)
  return {
    agents,
    freeSlots: Math.max(0, max - active),
    inGit,
    lastExchange: lastExchangeText(items) !== undefined,
    ...(refused ? { refused } : {})
  }
}
