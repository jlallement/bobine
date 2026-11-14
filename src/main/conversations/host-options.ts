/**
 * Options de l'hôte d'agent d'une conversation (sorties de `ConversationManager.ensureLive`, fiche
 * 108) : profil et dossier, réglages retenus pour ce profil, clés, contexte joint au prochain
 * message (échange d'avant une bascule, nouvelles des filles), contexte de session (ce que l'app
 * offre, fiche 118), session à rouvrir.
 */
import { childContext, childNews, childrenSessionContext } from '@shared/children'
import { handoverContext } from '@shared/handover'
import { memoryOutcomeContext, memoryOutcomes } from '@shared/memory'
import { estimateTokens } from '@shared/usage'
import type { TranscriptItem } from '@shared/transcript'
import { SessionDirectories } from '../agent/additional-directories'
import { deniedCommandOf } from '../agent-config/approval-rules-settings'
import type { AgentHostOptions } from '../agent/agent-host'
import type { AgentProfile } from '../agent/profiles'
import { versionNotice as noticeFor } from '../agent/version-check'
import type { SubagentWorks } from '../agent/subagent-works'
import type { SettingsStore } from '../settings-store'
import { joinContext } from './helpers'
import type { ConversationManagerOptions } from './manager'
import type { ConversationRecord } from './store'

export interface HostOptionsInput {
  profile: AgentProfile
  record: ConversationRecord
  app: Pick<
    ConversationManagerOptions,
    | 'clientVersion'
    | 'openExternal'
    | 'toolServer'
    | 'toolModules'
    | 'contextText'
    | 'networkWatch'
    | 'retryDelaysMs'
    | 'memory'
    | 'agentHome'
  >
  settings: SettingsStore
  /** Fil de la conversation au moment de l'envoi. */
  items: () => readonly TranscriptItem[]
  /** Session à rouvrir ; absente : session neuve (aparté, fiche 180). */
  reopen?: AgentHostOptions['reopen']
  emit: AgentHostOptions['emit']
  /** Travail des sous-agents rejoué à part (fiche 053), pour suivre ceux en arrière-plan. */
  works?: SubagentWorks
}

/** Commandes refusées partout par les règles de l'agent (fiche 215), pour les outils de l'app. */
function deniedCommandOption(
  profile: AgentProfile,
  home: string | undefined,
  workspace: string
): Pick<AgentHostOptions, 'deniedCommand'> {
  const denied = home ? deniedCommandOf(profile, home) : undefined
  return denied ? { deniedCommand: (command) => denied(command, workspace) } : {}
}

export function hostOptions(input: HostOptionsInput): AgentHostOptions {
  const { profile, record, app, settings, works } = input
  const pending: { notice?: ReturnType<typeof noticeFor> } = {}
  // Avis de version montré au premier « prêt » qui suit l'annonce, s'il n'a jamais été vu : la
  // clé n'est retenue que quand l'avis entre dans le fil (fiche 198).
  const emit: AgentHostOptions['emit'] = (event) => {
    input.emit(event)
    const notice = pending.notice
    if (!notice || event.type !== 'status' || event.snapshot.status !== 'ready') return
    pending.notice = undefined
    if (settings.claimVersionNotice(profile.id, notice.key)) input.emit(notice.event)
  }
  const mode = settings.current.newConversation?.mode
  return {
    profile,
    workspace: record.workspace,
    // Lus à chaque ouverture de session : la fiche est modifiée sur place (fiche 179). Ce que
    // l'agent en a lu est gardé dans la fiche : l'hôte est recréé à chaque changement (D13).
    directories: new SessionDirectories(() => record.additionalDirectories, {
      get: () => record.toldDirectories,
      set: (told) => {
        record.toldDirectories = told
      }
    }),
    clientVersion: app.clientVersion,
    openExternal: app.openExternal,
    conversationId: record.id,
    // Commandes refusées partout par les règles de l'agent (fiche 215) : ni par lui, ni par l'app.
    ...deniedCommandOption(profile, app.agentHome, record.workspace),
    toolServer: app.toolServer,
    toolModules: app.toolModules,
    initialControls: { ...profile.defaultControls, ...settings.current.controls?.[profile.id] },
    credentials: () => settings.credentials(profile),
    apiKeyInfo: () => settings.keyInfo(profile)[0],
    onAnnounced: (announcement) => {
      settings.agentSeen(profile.id, announcement)
      // Version plus récente ou plus ancienne que celles essayées (fiche 198) : avis retenu, montré
      // une fois la session ouverte (après le rejeu d'une réouverture, qui recommence le fil).
      pending.notice = noticeFor(profile, announcement.version)
    },
    contextText: (source) =>
      app.contextText?.(record.id, record.workspace, source, profile.exclusions) ??
      Promise.resolve('Contenu indisponible.'),
    // Échange d'avant une bascule (fiche 108) et nouvelles des filles (fiche 097), joints au
    // prochain message.
    // Issue des propositions de mémoire décidées depuis (fiche 182).
    extraContext: () => {
      const items = input.items()
      return joinContext(
        handoverContext(items),
        childContext(childNews(items)),
        memoryOutcomeContext(memoryOutcomes(items))
      )
    },
    // Ce que l'app offre, au premier message de chaque session (fiche 118) : à une mère possible,
    // c'est-à-dire une session qui a reçu `start_child` (dépôt git, pas une fille, outils actifs) :
    // en entier à une session neuve, en rappel court à une reprise ou après une compaction (223).
    // Index de la mémoire (fiche 182) : à une session qui a reçu `remember` (mémoire activée, pas
    // un relecteur, famille « Mémoire » pas coupée).
    sessionContext: (tools, moment) => {
      const capabilities = tools.includes('start_child')
        ? childrenSessionContext(settings.preferences().childProposals, moment)
        : undefined
      // Relu à l'envoi : une mémoire coupée depuis l'ouverture de la session ne donne plus d'index.
      const memoryOn = settings.preferences().memoryEnabled
      if (!tools.includes('remember') || !app.memory || !memoryOn) return capabilities
      return app.memory.sessionContext(record.workspace).then((memory) => {
        input.emit({ type: 'memory-context', tokens: estimateTokens(memory) })
        return joinContext(capabilities, memory)
      })
    },
    rememberedTools: {
      has: (tool) => settings.hasRememberedTool(profile.id, tool),
      add: (tool) => settings.rememberTool(profile.id, tool)
    },
    refusedModels: settings.refusedModels.of(profile.id),
    ...(mode ? { initialMode: mode } : {}),
    // Sous-agents en arrière-plan suivis jusqu'à leur fin, leur session relue sans cache (fiche 122).
    ...(profile.subagentReplay && works
      ? {
          loadSubagentWork: (sessionId: string) =>
            works.load(
              {
                profile,
                workspace: record.workspace,
                clientVersion: app.clientVersion,
                sessionId,
                credentials: () => settings.credentials(profile)
              },
              { fresh: true }
            )
        }
      : {}),
    ...(app.networkWatch ? { network: app.networkWatch } : {}),
    ...(app.retryDelaysMs ? { retryDelaysMs: app.retryDelaysMs } : {}),
    reopen: input.reopen,
    emit
  }
}
