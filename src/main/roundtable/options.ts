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
import { t } from 'i18next'
import {
  lastRoundtable,
  roundtableRunning,
  isArbiter,
  type Roundtable,
  type RoundtableArbiter,
  type RoundtableReadOnly
} from '@shared/roundtable'
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
): Exclude<RoundtableStartError, 'selection' | 'slots' | 'question'> | undefined {
  if (summary.startedFrom || summary.reviewOf) return 'task'
  if (summary.archived) return 'archived'
  if (summary.space === 'discussion' || !hasFolder(summary.workspace)) return 'discussion'
  const last = lastRoundtable(items)
  return last && roundtableRunning(last) ? 'running' : undefined
}

/**
 * Arbitre de la conversation : son agent, et le modèle de sa session si l'agent se choisit un
 * modèle (`childModel`) ; un modèle inconnu reste absent (rien n'est deviné).
 */
export function arbiterOf(
  profileId: string,
  controls: readonly SessionControl[],
  profiles: readonly Pick<ProfileSummary, 'id' | 'childModel'>[]
): RoundtableArbiter {
  const modelChoice = !!profiles.find((p) => p.id === profileId)?.childModel
  const current = modelChoice ? modelControl(controls)?.currentValue : undefined
  const model = typeof current === 'string' ? current : undefined
  return { profileId, ...(model ? { model } : {}) }
}

/** L'agent et le modèle de la conversation sont ceux d'un participant du tour (modèle changé). */
export function arbiterInSeats(
  conversations: Pick<ConversationManager, 'view' | 'settingsView'>,
  profileId: string,
  motherId: string,
  rt: Pick<Roundtable, 'seats'>
): boolean {
  const profiles = conversations.settingsView().profiles
  const arbiter = arbiterOf(
    profileId,
    conversations.view(motherId).snapshot?.controls ?? [],
    profiles
  )
  return rt.seats.some((seat) =>
    isArbiter(seat, arbiter, !!profiles.find((p) => p.id === seat.profileId)?.childModel)
  )
}

/**
 * Agents des participants arrêtés une fois au repos (recette réelle, G1) : rien ne les garde
 * vivants après leur avis. `release` revérifie le tour (une réplique repartie ne lâche rien) ;
 * une conversation affichée garde son agent (`releaseIdle`).
 */
export function releaseWhenIdle(
  rt: Pick<Roundtable, 'seats'>,
  idle: (childId: string) => Promise<void>,
  release: (childId: string) => void
): void {
  for (const seat of rt.seats) {
    const childId = seat.childId
    if (childId && !seat.removed) void idle(childId).then(() => release(childId))
  }
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
  // Hors dépôt git, rien n'est vérifiable : jamais promis, même avec le rôle installé.
  if (!inGit) return 'unverified'
  if (installed?.readOnly && !installed.stale) return 'native'
  return 'requested'
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
  const profiles = deps.conversations.settingsView().profiles
  const arbiter = arbiterOf(summary.profileId, view.snapshot?.controls ?? [], profiles)
  const agents = profiles.map((profile) => {
    const session = profile.id === summary.profileId ? ownSession : undefined
    const installed = deps.participantMode?.(profile.id, conversationId)
    const readOnly = expectedReadOnly(profile, inGit, installed)
    const option = agentOption(
      profile,
      modelSource(memory[profile.id], session),
      providers,
      readOnly
    )
    // Agent sans choix de modèle qui arbitre : il ne peut pas participer.
    return !option.modelChoice && profile.id === arbiter.profileId
      ? { ...option, available: false, reason: t('roundtable.error.selection.arbiter') }
      : option
  })
  const refused = refusalOf(summary, items)
  return {
    agents,
    freeSlots: Math.max(0, max - active),
    inGit,
    lastExchange: lastExchangeText(items) !== undefined,
    arbiter,
    ...(refused ? { refused } : {})
  }
}
