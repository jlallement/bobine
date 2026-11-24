/**
 * Options de l'hôte d'agent d'une conversation (sorties de `ConversationManager.ensureLive`, fiche
 * 108) : profil et dossier, réglages de la conversation (sinon du profil, fiche 256), clés, contexte joint au prochain
 * message (échange d'avant une bascule, nouvelles des filles), contexte de session (ce que l'app
 * offre, fiche 118), session à rouvrir.
 */
import type { ControlValue } from '@shared/agent'
import { DISCUSSION_CONTEXT, ensureDiscussionFolder } from './discussion-space'
import {
  capabilitiesReminder,
  childContext,
  childNews,
  childrenSessionContext
} from '@shared/children'
import { mentionedRoles, ROLE_KEPT_FAMILIES, type RoleStamp } from '@shared/roles'
import { ROUNDTABLE_PARTICIPANT_ROLE } from '@shared/roundtable'
import { roundtableChildIds } from '../roundtable/participants'
import type { AppToolModule } from '../mcp/tools'
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
import { openingControls } from './conversation-controls'
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
    | 'subagentFollowMs'
    | 'memory'
    | 'agentHome'
    | 'roles'
  > &
    Partial<Pick<ConversationManagerOptions, 'conversationsDir'>>
  settings: SettingsStore
  /** Fil de la conversation au moment de l'envoi. */
  items: () => readonly TranscriptItem[]
  /** Session à rouvrir ; absente : session neuve (aparté, fiche 180). */
  reopen?: AgentHostOptions['reopen']
  emit: AgentHostOptions['emit']
  /** Travail des sous-agents rejoué à part (fiche 053), pour suivre ceux en arrière-plan. */
  works?: SubagentWorks
  /**
   * La conversation existe encore (pas mise à la corbeille) : les nouvelles d'un travail supprimé
   * ne partent plus à l'agent (fiche 272). Absent : toutes partent.
   */
  exists?: (conversationId: string) => boolean
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

/**
 * Valeurs de réglage plus proposées par l'agent, déjà dites à chaque conversation (fiche 266, D32) :
 * en mémoire, par fiche de conversation ; un seul avis, puis la valeur n'est plus renvoyée.
 */
const warned = new WeakMap<object, Set<string>>()
const warnedOf = (record: object): Set<string> => {
  const set = warned.get(record) ?? new Set<string>()
  warned.set(record, set)
  return set
}

/** Réglages de départ, sans les valeurs déjà dites plus proposées. */
export function withoutWarned(
  controls: Record<string, ControlValue> | undefined,
  told: ReadonlySet<string> | undefined
): Record<string, ControlValue> | undefined {
  if (!controls || !told?.size) return controls
  return Object.fromEntries(
    Object.entries(controls).filter(([id, value]) => !told.has(`${id}=${String(value)}`))
  )
}

export function hostOptions(input: HostOptionsInput): AgentHostOptions {
  const { profile, record, app, settings, works } = input
  // Discussion dont le dossier a disparu (Finder) : recréé avant que l'agent y démarre (fiche 224).
  if (app.conversationsDir) ensureDiscussionFolder(app.conversationsDir, record)
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
  // Rôles actifs du dossier de la conversation, relus à chaque envoi (fichiers changés à chaud).
  const roles = () => app.roles?.active(record.workspace) ?? []
  const mentionReminder = (text: string) => {
    const named = text.includes('@') ? mentionedRoles(text, roles()) : []
    if (named.length === 0) return undefined
    return capabilitiesReminder(settings.preferences().childProposals, named)
  }
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
    // Rôle (fiche 223) : seulement ses familles d'outils s'il les choisit ; écritures refusées.
    // Discussion (fiche 224) : aucun outil de Bobine ; écritures accordées dans ses documents.
    toolModules: record.space === 'discussion' ? [] : roleToolModules(app.toolModules, record.role),
    ...(record.role?.readOnly ? { readOnly: true } : {}),
    ...(record.space === 'discussion' ? { writeArea: record.workspace } : {}),
    // Ceux de la conversation, sinon (nouvelle conversation) le dernier choix fait avec ce profil ;
    // lus à chaque ouverture de session, jamais figés à la création de l'hôte (fiche 256).
    initialControls: (session) =>
      withoutWarned(
        openingControls(record, profile, settings.current.controls?.[profile.id], session),
        warned.get(record)
      ),
    // Modèles retenus (fiche 108) : l'avis d'un modèle plus proposé le nomme ; une fois prévenu, la
    // valeur n'est plus renvoyée à cette conversation (fiche 266, D32).
    controlNotices: {
      knownName: (controlId, value) => {
        const seen = settings.current.models?.[profile.id]
        return seen?.controlId === controlId
          ? seen.options.find((o) => o.value === value)?.name
          : undefined
      },
      warned: (controlId, value) => warnedOf(record).add(`${controlId}=${value}`)
    },
    credentials: () => settings.credentials(profile),
    networkNow: { env: () => settings.networkEnv(), onChange: (l) => settings.onChange(l) },
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
    // Rappel des rôles quand le message en nomme un (`@nom`, fiche 223), à une mère possible.
    extraContext: (text, tools, about) => {
      const items = input.items()
      // Participants d'un tour de table (fiche 285) : leurs avis partent seulement par la synthèse.
      const participants = roundtableChildIds(items)
      return joinContext(
        handoverContext(items),
        childContext(
          childNews(items).filter(
            (news) => (input.exists?.(news.childId) ?? true) && !participants.has(news.childId)
          ),
          items,
          about
        ),
        memoryOutcomeContext(memoryOutcomes(items)),
        tools.includes('start_child') ? mentionReminder(text) : undefined
      )
    },
    // Ce que l'app offre, au premier message de chaque session (fiche 118) : à une mère possible,
    // c'est-à-dire une session qui a reçu `start_child` (dépôt git, pas une fille, outils actifs) :
    // en entier à une session neuve, en rappel court à une reprise ou après une compaction (223).
    // Index de la mémoire (fiche 182) : à une session qui a reçu `remember` (mémoire activée, pas
    // un relecteur, famille « Mémoire » pas coupée).
    sessionContext: (tools, moment) => {
      // Discussion (fiche 224) : ni filles ni mémoire ; seulement où elle se passe.
      if (record.space === 'discussion') return DISCUSSION_CONTEXT
      const capabilities = tools.includes('start_child')
        ? childrenSessionContext(settings.preferences().childProposals, moment, roles())
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
    ...(app.subagentFollowMs ? { subagentFollowMs: app.subagentFollowMs } : {}),
    reopen: input.reopen,
    emit
  }
}

/** Familles d'outils de Bobine d'une fille avec un rôle qui les choisit (`mcp`), sinon toutes. */
export function roleToolModules(
  modules: readonly AppToolModule[] | undefined,
  role: RoleStamp | undefined
): readonly AppToolModule[] | undefined {
  const wanted = role?.mcp
  // Participant d'un tour de table (fiche 285) : aucun outil de Bobine, pas même `message_parent`.
  if (modules && role?.name === ROUNDTABLE_PARTICIPANT_ROLE) return []
  if (!modules || !wanted) return modules
  return modules.filter((m) => ROLE_KEPT_FAMILIES.includes(m.id) || wanted.includes(m.id))
}
