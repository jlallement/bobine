import { memoryProposals } from '@shared/memory'
/**
 * ConversationManager : l'historique des conversations et leurs agents.
 *
 * - Une conversation = un enregistrement persisté + son fil + (si elle est vivante) un AgentHost
 *   lancé dans son dossier. Un brouillon (conversation vide) n'entre dans l'historique qu'au
 *   premier message.
 * - Le fil est tenu à jour ici, avec le réducteur partagé : c'est la source de vérité.
 * - Au plus N agents vivants (réglage « Conversations gardées actives », `live-agents.ts`) : les
 *   conversations inactives les plus anciennes sont mises en veille et rouvertes à la demande
 *   (`session/load` / `session/resume`, sinon lecture seule).
 *
 * N'importe pas `electron` : testable sous Vitest contre l'agent factice.
 */
import type { ApprovalsView } from '@shared/approvals'
import { attachmentName, type PromptAttachment } from '@shared/attachments'
import { randomUUID } from 'node:crypto'
import { join, relative } from 'node:path'
import { ConversationTrash, TrashLink } from './trash'
import type { ExclusionSource } from '../agent/adapters'
import type {
  AgentConfigureRequest,
  AgentEvent,
  AgentSessionView,
  AgentSettingsView,
  AgentSnapshot,
  AgentStatus,
  ControlValue,
  ConversationEvent,
  ElicitationAnswer,
  ConversationsState,
  ConversationSummary,
  ConversationView,
  BranchPreview,
  QueuedMessage,
  WorktreeStatusView
} from '@shared/agent'
import {
  emptyTranscript,
  reduceTranscript,
  settleTranscript,
  type TranscriptItem,
  type TranscriptState
} from '@shared/transcript'
import { AgentHost, type AgentHostOptions, type PromptOptions } from '../agent/agent-host'
import { isDirectory } from '../agent/process-utils'
import { folderNeededSnapshot, hasFolder, NO_FOLDER, retiredSnapshot } from './agentless'
import { folderGoneMessage, usableFolder } from './folder-fallback'
import { settingsViewOf } from './settings-view'
import { addAsideSession, agentSessions, checkAgentIn } from './agent-outside'
import { SubagentWorks } from '../agent/subagent-works'
import { readRuleDocument } from '../agent-config/rules'
import { readMarkdown } from '../files/file-links'
import type { MarkdownDocument } from '@shared/file-links'
import type { RuleFileView } from '@shared/rules'
import type { ContextSource } from '@shared/context-mentions'
import type { AgentProfile } from '../agent/profiles'
import { loadSettings } from '../settings'
import { SettingsStore } from '../settings-store'
import type { ContentHit } from '@shared/conversation-search'
import type { RevertOutcome } from '@shared/changes'
import type { WorktreeInfo, Worktrees } from '../changes/worktrees'
import type { CycleTarget } from '../changes/worktree-cycle'
import { log } from '../log'
import { ContentSearch } from './content-search'
import { HistoryWriter } from './history-writer'
import { prepareBranch, previewBranch, revertChange } from './branching'
import { ConversationStore, type ConversationRecord } from './store'
import {
  damagedTranscriptNotice,
  proposedTitle,
  dropDraftSession,
  trackDraftDrop,
  profileOrDefault,
  warnIfStopped,
  resumedRecord,
  sharesWorktree,
  draftRecord,
  summaryOf,
  titleFrom,
  withTimeout,
  worktreeStartEvent,
  rulesOf,
  childDetachedRequest,
  type ChildLink,
  type DetachedRequest,
  type Origin
} from './helpers'
import { hostOptions } from './host-options'
import { answerTurnLimit, type TurnLimitAnswer } from './turn-limit'
import { agentsToStop, releaseAgent } from './live-agents'
import type { ApiKeyStore } from '../agent-config/api-keys'
import type { AgentCheck } from '../diagnostics'
import type { QuickEntryStatus } from '@shared/quick-entry'
import { t } from 'i18next'
import type { Message } from '@shared/i18n/message'
import { messageOf } from '@shared/errors'
import { sameDigest, usageDigest } from '@shared/usage'
import type { AppToolFamily, ConversationAppTools } from '@shared/mcp'
import { appToolsCatalog, conversationAppTools, switchedOff } from '../mcp/catalog'
import type { AppToolModule } from '../mcp/tools'
import type { RoleLibrary } from '../roles/library'

export interface ConversationManagerOptions {
  profiles: AgentProfile[]
  settingsFile: string
  conversationsDir: string
  /**
   * Dossier d'une conversation quand rien n'est choisi, ou si le dossier choisi a disparu : pour les
   * essais seulement. Absent (l'app), la conversation attend que l'utilisateur en choisisse un, sans
   * démarrer d'agent (fiche 093).
   */
  defaultWorkspace?: string
  /**
   * Dossier neutre où lancer un agent hors conversation (diagnostic, sessions à reprendre) quand la
   * conversation active n'a pas de dossier ; jamais celui d'une conversation (fiche 093).
   */
  neutralFolder: string
  /** Sessions de l'agent à ne jamais proposer (essais du premier lancement, fiche 188). */
  hiddenSessions?: (profileId: string) => readonly string[]
  /** Dossier personnel où les agents rangent leurs fichiers (règles, fiche 056) ; `~` par défaut. */
  agentHome?: string
  /** Contenu de `@git-changes` / `@terminal` d'une conversation (fiche 057), lu à l'envoi. */
  contextText?: (
    conversationId: string,
    workspace: string,
    source: ContextSource,
    /** Fichiers d'exclusion de l'agent (fiche 155), que `@git-changes` respecte. */
    exclusions?: ExclusionSource
  ) => Promise<string>
  /**
   * Réglages de l'app (fiche 089) ; absents, le gestionnaire les lit dans `settingsFile` et les fait
   * écrire par son écrivain.
   */
  settings?: SettingsStore
  /**
   * Historique déjà ouvert (fiche 089) : son index et l'écrivain partagé avec les réglages ;
   * absent, le gestionnaire les ouvre d'après `conversationsDir` et `settingsFile`.
   */
  history?: { store: ConversationStore; writer: HistoryWriter }
  /** Clés d'API des agents, chiffrées (fiche 022) ; pour les réglages créés ici. */
  apiKeys?: ApiKeyStore
  /** Environnement de l'app (clés fournies hors de l'app) ; pour les réglages créés ici. */
  env?: NodeJS.ProcessEnv
  /** Valeurs imposées au lancement (variables d'environnement), prioritaires sur les réglages. */
  overrides?: { profileId?: string; workspace?: string }
  pathEnv: () => string | undefined
  /** Évènement d'une conversation ; on peut aussi s'abonner (`subscribe`). */
  emit?: (payload: ConversationEvent) => void
  /** Liste des conversations changée ; on peut aussi s'abonner (`subscribe`). */
  emitList?: (state: ConversationsState) => void
  clientVersion?: string
  /** Ouvre un lien https dans le navigateur système (élicitation en mode URL). */
  openExternal?: (url: string) => void
  /**
   * Nombre maximal d'agents vivants imposé (`BOBINE_MAX_LIVE`, essais) : prioritaire sur le réglage
   * « Conversations gardées actives » (fiche 102), qui vaut sinon.
   */
  maxLive?: number
  /**
   * Fils gardés en mémoire en plus de ceux des conversations affichées ou vivantes (défaut : 4,
   * fiche 046) ; les autres sont relus sur le disque à la demande.
   */
  maxIdleTranscripts?: number
  /** Serveur MCP de l'app et modules d'outils fournis aux agents (fiches 028, 029). */
  toolServer?: AgentHostOptions['toolServer']
  toolModules?: AgentHostOptions['toolModules']
  /** Rôles actifs d'un dossier (fiche 223), pour le contexte de session et `@rôle`. */
  roles?: Pick<RoleLibrary, 'active'>
  /** Retour du réseau, pour les tours qui attendent de réessayer (fiche 142). */
  networkWatch?: AgentHostOptions['network']
  /** Attentes entre les tentatives (raccourcies en test, sinon `RETRY_DELAYS_MS`). */
  retryDelaysMs?: AgentHostOptions['retryDelaysMs']
  /** Mémoire commune (fiche 182) : index joint au début de chaque session qui a reçu `remember`. */
  memory?: Pick<import('../memory/service').MemoryService, 'sessionContext'>
  /** Conversation supprimée (pour libérer ce qui lui est attaché : page du navigateur…). */
  onDeleted?: (id: string) => void
  /**
   * Conversation qui n'a plus d'agent (archivée, ou évincée pour faire de la place, fiche 043) :
   * pour libérer ce qui lui est attaché (pages du navigateur, terminaux…).
   */
  onReleased?: (id: string, reason: 'archived' | 'evicted') => void
  /** Réglage des notifications changé (fiche 024). */
  onSettingsChanged?: () => void
  /** Raccourci global de la fenêtre rapide, accepté ou non par macOS (fiche 062). */
  quickEntryStatus?: () => QuickEntryStatus
  /** Worktrees git des conversations en parallèle (fiche 036). */
  worktrees?: Pick<Worktrees, 'create' | 'status' | 'remove' | 'removeIfUntouchedSync'>
  /** Sites et commandes « toujours autorisés » de l'app, pour les Réglages (fiche 072). */
  approvals?: () => ApprovalsView
  /**
   * Conversation à ne pas évincer (fiche 097) : une fille en cours, ou une mère qui attend ses
   * filles (rouverte par `session/load`, elle perdrait les comptes rendus de son fil). `maxLive`
   * reste une limite souple : ce sont les conversations ordinaires au repos qui laissent la place.
   */
  keepLive?: (id: string) => boolean
  /** Corbeille des conversations supprimées (fiche 196) ; celle de `conversationsDir` sinon. */
  trash?: ConversationTrash
}

/** Ce qu'on peut suivre du gestionnaire en plus de `emit` et `emitList` (fiche 089). */
export interface ConversationListeners {
  event?: (payload: ConversationEvent) => void
  list?: (state: ConversationsState) => void
  deleted?: (id: string) => void
  /** Sortie de l'app : tout s'arrête (apartés, fiche 180). */
  stopped?: () => void
}

interface Conversation {
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

const MAX_IDLE_TRANSCRIPTS = 4
/** Démarrage d'un agent arrêté, puis `session/delete` : au-delà, on abandonne. */
const AGENT_DELETE_TIMEOUT_MS = 20_000

export class ConversationManager {
  private readonly options: ConversationManagerOptions
  private readonly store: ConversationStore
  /** Réglages de l'app (fiche 089, ADR-0016). */
  readonly settings: SettingsStore
  private readonly conversations = new Map<string, Conversation>()
  /** Sessions de conversations vides quittées, en cours de suppression chez leur agent. */
  private readonly dropping = new Set<Promise<void>>()
  private activeId = ''
  private readonly writer: HistoryWriter
  private readonly trashed: TrashLink
  private readonly contentSearch: ContentSearch
  /** Conversations ouvertes à côté de l'active (vue côte à côte, fiche 036). */
  private readonly beside = new Set<string>()
  /** Avis à montrer dans la première conversation affichée (dossier disparu, fichier abîmé…). */
  private readonly pendingNotices: Message[] = []
  private readonly listeners = new Set<ConversationListeners>()
  /** Travail des sous-agents déjà rejoué (fiche 053), par profil et session ; les plus récents. */
  private readonly subagentWorks = new SubagentWorks()

  /** Modules d'outils des sessions, sans les familles coupées par l'utilisateur (fiche 109). */
  private readonly toolModules: AppToolModule[]

  constructor(options: ConversationManagerOptions) {
    this.options = options
    this.toolModules = switchedOff(options.toolModules ?? [], () => this.settings.appToolsOff())
    this.settings =
      options.settings ??
      new SettingsStore({
        initial: loadSettings(options.settingsFile),
        // Même écrivain que l'historique (créé juste après, avant toute écriture).
        save: (settings) => this.writer.settings(settings),
        profiles: options.profiles,
        ...(options.apiKeys ? { apiKeys: options.apiKeys } : {}),
        ...(options.env ? { env: options.env } : {})
      })
    // Plafond des agents vivants baissé (fiche 102) : les agents en trop sont mis en veille aussitôt.
    let liveLimit = this.liveLimit()
    this.settings.onChange(() => {
      options.onSettingsChanged?.()
      const lowered = this.liveLimit() < liveLimit
      liveLimit = this.liveLimit()
      if (lowered && this.evict()) this.emitList()
    })
    this.store = options.history?.store ?? new ConversationStore(options.conversationsDir)
    this.contentSearch = new ContentSearch(this.store)
    this.writer =
      options.history?.writer ??
      new HistoryWriter({ store: this.store, settingsFile: options.settingsFile })
    // Un fil enfin à jour sur le disque peut être libéré (fiche 046).
    this.writer.onIdle(() => this.releaseTranscripts())
    // Dans le fil affiché (même chemin que les autres évènements) ; l'écriture qui en découle
    // échouera aussi, sans nouvel avis tant que l'échec dure.
    this.writer.onFailure((message) => {
      const shown = this.conversations.get(this.activeId)
      if (shown) this.onEvent(shown, { type: 'notice', level: 'error', message })
    })

    // Chaque fil écrit garde une copie de son enregistrement (fiche 197).
    this.store.attachRecords((id) => this.conversations.get(id)?.record)
    const trash = options.trash ?? new ConversationTrash(options.conversationsDir)
    this.trashed = new TrashLink(trash, this.store, this.writer)
    // Suppressions laissées en route par un arrêt brutal : finies (fiche 196).
    const records = trash.settle(this.store.loadIndex(), (id) => this.store.fileOf(id))
    // Seul l'index est lu au démarrage ; chaque fil l'est à sa première demande (fiche 043).
    for (const record of records) {
      this.conversations.set(record.id, { record, lastUsed: 0, readAt: 0, draft: false })
    }

    // Au lancement, comme Claude Desktop : une nouvelle conversation, l'historique à côté.
    const { profiles, overrides } = options
    const settings = this.settings.current
    const defaults = settings.newConversation
    const profileId = this.profileOrDefault(
      overrides?.profileId ?? defaults?.profileId ?? settings.profileId
    ).id
    // Rien de choisi (premier lancement) : pas de dossier, l'agent attend le choix (fiche 093).
    const fallback = options.defaultWorkspace ?? NO_FOLDER
    const wanted = overrides?.workspace ?? defaults?.workspace ?? settings.workspace ?? fallback
    const { workspace, gone } = usableFolder(wanted, [fallback])
    if (gone) this.pendingNotices.push(folderGoneMessage(gone, workspace))
    // Fichiers d'historique abîmés : dits par l'état du profil (fiche 196), pas dans le fil.
    if (this.store.damaged.length > 0) {
      log.warn('Fichiers d’historique illisibles mis de côté :', this.store.damaged)
    }
    if (!profiles.length) throw new Error(t('conversations.error.noProfile'))
    this.activeId = this.createDraft(profileId, workspace).record.id
  }

  /** Suit les évènements, la liste et les suppressions (fiche 089) ; rend le désabonnement. */
  subscribe(listeners: ConversationListeners): () => void {
    this.listeners.add(listeners)
    return () => this.listeners.delete(listeners)
  }

  /* ---------- Lecture ---------- */

  state(): ConversationsState {
    const conversations = [...this.conversations.values()]
      .filter((c) => !c.draft || c.record.id === this.activeId)
      .sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt))
      .map((c) => this.summary(c))
    return { conversations, activeId: this.activeId }
  }

  view(id: string): ConversationView {
    const conversation = this.get(id)
    return {
      summary: this.summary(conversation),
      snapshot: conversation.snapshot ?? null,
      transcript: this.transcriptOf(conversation),
      seq: conversation.seq ?? 0
    }
  }

  /** Réglages globaux pour les menus, rapportés à la conversation active. */
  settingsView(): AgentSettingsView {
    return settingsViewOf(this.get(this.activeId).record, this.settings, this.options)
  }

  /** Où partirait une « Nouvelle conversation » : agent et dossier (fenêtre rapide, fiche 062). */
  newConversationTarget(): { profileId: string; profileLabel: string; workspace: string } {
    const active = this.get(this.activeId)
    const defaults = this.settings.current.newConversation
    const profile = this.profileOrDefault(defaults?.profileId ?? active.record.profileId)
    return {
      profileId: profile.id,
      profileLabel: profile.label,
      workspace: defaults?.workspace ?? active.record.workspace
    }
  }

  /** Clé d'API saisie dans « Connexion requise » : enregistrée, puis l'agent relancé avec. */
  async useApiKey(id: string, env: string, value: string): Promise<void> {
    await this.settings.setApiKey(this.get(id).record.profileId, env, value)
    await this.liveHost(id).restart()
  }

  /** Commande d'une étape du profil (connexion, licence), à lancer dans le terminal de l'app. */
  stepCommand(id: string, stepId: string): string {
    const step = this.profileOf(id)?.terminalSteps?.[stepId]
    if (!step) throw new Error(t('conversations.error.unknownStep', { step: stepId }))
    return step.command
  }

  /* ---------- Navigation ---------- */

  /** Affiche une conversation et (re)démarre son agent si besoin. */
  select(id: string): ConversationView {
    const conversation = this.get(id)
    const previous = this.conversations.get(this.activeId)
    this.activeId = id
    // Un brouillon vide quitté n'a pas d'intérêt : on le jette.
    if (previous && previous !== conversation && previous.draft) this.discard(previous)
    if (this.startable(conversation)) this.ensureLive(conversation)
    this.emitList()
    const view = this.view(id)
    this.releaseTranscripts()
    return view
  }

  /**
   * Nouvelle conversation. Si la conversation active est encore vide, elle est simplement
   * reconfigurée (pas de brouillons qui s'accumulent).
   */
  async create(request: AgentConfigureRequest = {}): Promise<ConversationView> {
    const active = this.get(this.activeId)
    // « Nouvelle conversation » (rien de demandé) : réglages par défaut, sinon comme l'active.
    const fresh = request.profileId === undefined && request.workspace === undefined
    const defaults = fresh ? this.settings.current.newConversation : undefined
    const profileId = this.profileOrDefault(
      request.profileId ?? defaults?.profileId ?? active.record.profileId
    ).id
    const wanted = request.workspace ?? defaults?.workspace ?? active.record.workspace
    // Dossier demandé introuvable : refusé. Hérité et disparu (worktree nettoyé, 0.9.1, D21) :
    // la conversation part d'un dossier qui existe, et le dit (`createDraft`).
    if (request.workspace !== undefined && hasFolder(wanted) && !isDirectory(wanted))
      throw new Error(t('conversations.error.folderMissing', { folder: wanted }))
    const { workspace } = usableFolder(wanted, this.fallbackFolders())
    // Toujours pas de dossier (agent changé avant d'en choisir un) : rien à retenir (fiche 093).
    if (hasFolder(workspace)) this.settings.rememberWorkspace(profileId, workspace)

    const same = active.record.profileId === profileId && active.record.workspace === workspace
    if (active.draft && same) return this.view(active.record.id) // Déjà une conversation vide.
    if (active.draft) this.discard(active)
    const conversation = this.createDraft(profileId, wanted)
    this.activeId = conversation.record.id
    if (this.startable(conversation)) this.ensureLive(conversation)
    this.emitList()
    await conversation.host?.start()
    return this.view(this.activeId) // Autre conversation choisie pendant le démarrage : celle-là.
  }

  /**
   * Nouvelle conversation dans un worktree git (fiche 036) : nouvelle branche depuis le commit
   * courant du dossier de `fromId`, même agent. Le dossier n'entre pas dans les dossiers récents.
   */
  async createInWorktree(fromId: string): Promise<ConversationView> {
    const conversation = await this.inNewWorktree(this.get(fromId).record)
    const active = this.get(this.activeId)
    if (active.draft) this.discard(active)
    this.activeId = conversation.record.id
    this.ensureLive(conversation)
    this.emitList()
    await conversation.host?.start()
    return this.view(conversation.record.id)
  }

  /**
   * Conversation fille (fiche 097) : dans un nouveau worktree depuis le dossier de la mère. Son
   * agent démarre ; la consigne est envoyée par l'appelant (`children.ts`), qui attend son
   * démarrage s'il le faut (`ready`).
   */
  async createChild(
    motherId: string,
    text: string,
    profileId?: string,
    onCreated?: (child: ConversationSummary) => void,
    link: ChildLink = {}
  ): Promise<ConversationSummary> {
    const author = link.of ? this.get(link.of).record : undefined
    return this.createDetached(
      childDetachedRequest(this.get(motherId).record, author, {
        text,
        ...(profileId ? { profileId } : {}),
        ...(onCreated ? { onCreated } : {}),
        ...(link.role ? { role: link.role } : {})
      })
    )
  }

  /**
   * Conversation hors de l'active (filles, relecteurs, tâches planifiées de la fiche 178) : dans
   * le dossier de départ ou un nouveau worktree de ce dossier, dans l'historique tout de suite (un
   * brouillon serait jeté quand on va ailleurs). Son agent démarre sans être attendu (`ready`).
   */
  async createDetached(request: DetachedRequest): Promise<ConversationSummary> {
    const conversation = request.worktree
      ? await this.inNewWorktree(request.from, request.profileId)
      : this.createDraft(this.profileById(request.from.profileId).id, request.from.workspace)
    Object.assign(conversation.record, request.record, { title: request.title })
    conversation.draft = false
    request.onCreated?.(this.summary(conversation))
    this.touch(conversation)
    this.ensureLive(conversation)
    this.emitList()
    return this.summary(conversation)
  }

  /** Démarre l'agent d'une conversation s'il le faut, et attend qu'il soit prêt (filles). */
  ready(id: string): Promise<void> {
    return this.ensureLive(this.get(id)).start()
  }

  /**
   * Continuer avec un autre agent (fiche 108, ADR-0024, orchestré par `handover.ts`) : même
   * conversation et même fil, l'agent d'avant arrêté, une nouvelle session chez `profileId`. La
   * bascule est posée dans le fil ; l'échange d'avant part avec le prochain message.
   */
  switchAgent(id: string, profileId: string, handover: AgentEvent): void {
    const conversation = this.get(id)
    if (conversation.snapshot?.status === 'busy') throw new Error(t('handover.error.busy'))
    releaseAgent(conversation)
    // Le titre que l'utilisateur reconnaît reste : le nouvel agent ne le remplace pas (fiche 125).
    if (conversation.record.titleSource !== 'user') conversation.record.titleSource = 'app'
    conversation.record.profileId = this.profileById(profileId).id
    delete conversation.record.sessionId
    this.onEvent(conversation, handover)
    this.touch(conversation)
    if (this.startable(conversation)) this.ensureLive(conversation)
    this.emitList()
  }

  /** Évènement de l'app posé dans le fil d'une conversation (conversations filles, fiche 097). */
  post(id: string, event: AgentEvent): void {
    this.onEvent(this.get(id), event)
  }

  /** Options d'hôte d'une conversation, pour son aparté (fiche 180, `aside.ts` les restreint). */
  asideHost(id: string, emit: AgentHostOptions['emit']): AgentHostOptions {
    const conversation = this.get(id)
    return hostOptions({
      profile: this.profileOrDefault(conversation.record.profileId),
      record: conversation.record,
      app: this.options,
      settings: this.settings,
      items: () => [],
      emit
    })
  }

  /** Session d'aparté gardée par l'agent (fiche 180) : retenue pour ne pas la proposer. */
  noteAsideSession(id: string, profileId: string, sessionId: string): void {
    addAsideSession(this.get(id).record, profileId, sessionId)
    this.saveIndex()
  }

  /**
   * Ouvre une conversation à côté de l'active (vue côte à côte) : son agent démarre si besoin et
   * n'est pas arrêté pour faire de la place tant qu'elle reste affichée.
   */
  open(id: string): ConversationView {
    const conversation = this.get(id)
    this.beside.add(id)
    if (this.startable(conversation)) this.ensureLive(conversation)
    this.emitList()
    const view = this.view(id)
    this.releaseTranscripts()
    return view
  }

  /** Conversation d'à côté refermée. */
  release(id: string): void {
    this.beside.delete(id)
    this.releaseTranscripts()
  }

  /** Conversations sous les yeux de l'utilisateur : l'active et celles ouvertes à côté. */
  shownIds(): string[] {
    return [this.activeId, ...[...this.beside].filter((id) => id !== this.activeId)]
  }

  /** Conversation en worktree (fiche 110) : dossier et worktree ; `null` sinon ou partagé. */
  worktreeOf(id: string): CycleTarget | null {
    const conversation = this.get(id)
    const { worktree, workspace, title } = conversation.record
    return worktree && !sharesWorktree(conversation, this.conversations.values())
      ? { id, title, workspace, worktree }
      : null
  }

  /** Worktrees que des conversations tiennent encore, archivées comprises. */
  worktreePaths(): WorktreeInfo[] {
    return [...this.conversations.values()].flatMap((c) => c.record.worktree ?? [])
  }

  /**
   * Nettoyage après fusion (fiche 110) : la conversation est archivée et repart dans le dossier
   * principal ; l'appelant supprime le worktree et la branche une fois l'agent arrêté.
   */
  leaveWorktree(id: string): WorktreeInfo {
    const conversation = this.get(id)
    const { worktree, workspace } = conversation.record
    if (!worktree) throw new Error(t('worktreeCycle.error.noWorktree'))
    // Ressortie d'abord, archivée ensuite : la nouvelle conversation affichée à sa place part du
    // dépôt principal, pas du worktree qui va être supprimé (0.9.1, D21).
    conversation.record.workspace = join(worktree.root, relative(worktree.path, workspace))
    delete conversation.record.worktree
    if (!conversation.record.archived) this.setArchived(id, true)
    this.saveIndex()
    this.emitList()
    return worktree
  }

  /** Ce qui serait perdu en supprimant le worktree d'une conversation ; `null` sans worktree. */
  async worktreeStatus(id: string): Promise<WorktreeStatusView | null> {
    const target = this.worktreeOf(id)
    return target && this.options.worktrees ? this.options.worktrees.status(target.worktree) : null
  }

  /**
   * Changer d'agent ou de dossier : sur une conversation vide, elle est reconfigurée ; sur une
   * conversation commencée, une nouvelle conversation est ouverte (l'ancienne est conservée).
   */
  configure(id: string, request: AgentConfigureRequest): Promise<ConversationView> {
    if (id !== this.activeId) this.select(id)
    return this.create(request)
  }

  /* ---------- Actions sur une conversation ---------- */

  /** Garde avant chaque envoi (plafond de coût, fiche 157) : vrai si le message est retenu. */
  promptGate?: (...args: Parameters<ConversationManager['prompt']>) => boolean

  async prompt(
    id: string,
    text: string,
    attachments: PromptAttachment[] = [],
    options: PromptOptions = {}
  ): Promise<void> {
    if (this.promptGate?.(id, text, attachments, options)) return
    const conversation = this.get(id)
    // Agent arrêté (panne) ou en échec au démarrage : relancé avant d'envoyer, fil gardé.
    const status = conversation.snapshot?.status
    if (conversation.host && (status === 'exited' || status === 'error')) await this.restart(id)
    const host = this.ensureLive(conversation)
    await host.start()
    if (conversation.record.archived) {
      // Écrire dans une conversation archivée la ressort.
      delete conversation.record.archived
      this.saveIndex()
      this.emitList()
    }
    if (conversation.draft) {
      // Premier message : la conversation entre dans l'historique.
      conversation.draft = false
      conversation.record.title = titleFrom(text || attachments.map(attachmentName).join(', '))
      conversation.record.titleSource = 'message'
      conversation.record.sessionId = host.currentSessionId
      this.touch(conversation)
    }
    // `/split` (fiche 118) : sans `start_child` dans la session, rien ne part.
    const tools = host.appToolNames
    if (options.askChildren && tools && !tools.includes('start_child')) {
      throw new Error(t('children.error.noStartChild'))
    }
    // Contexte d'une branche (fiche 023), message d'une autre conversation (fiche 097).
    await host.send(text, attachments, options)
  }

  /** Règles actives de la conversation (fiche 056) : selon le profil et le mode actif. */
  rules(id: string): Promise<RuleFileView[]> {
    const { record, snapshot } = this.get(id)
    const profile = this.profileOf(id)
    const version = profile && this.settings.current.agentsSeen?.[profile.id]?.version
    return rulesOf(record.workspace, profile, snapshot, version, this.options.agentHome)
  }

  /**
   * Document en aperçu (fiche 052) : un `.md` du dossier de la conversation, ou une de ses règles
   * actives, même hors du dossier (fiche 056). Rien d'autre.
   */
  async readDocument(id: string, path: string): Promise<MarkdownDocument> {
    const rule = (await this.rules(id)).find((r) => !r.url && r.path === path)
    if (rule) return readRuleDocument(rule)
    return readMarkdown(this.get(id).record.workspace, path)
  }

  /**
   * Essai d'un agent pour le diagnostic (fiche 061), hors de toute conversation, dans le dossier de
   * la conversation affichée (`agent-check.ts`).
   */
  async checkAgent(profileId: string, options: { trySession?: boolean } = {}): Promise<AgentCheck> {
    const workspace = this.get(this.activeId).record.workspace || this.options.neutralFolder
    const { settings, options: app } = this
    const env = { settings, pathEnv: app.pathEnv(), clientVersion: app.clientVersion }
    return checkAgentIn(this.profileById(profileId), workspace, env, options)
  }

  /**
   * Sessions que l'agent `profileId` garde et que l'historique ne connaît pas (fiche 055) : celles
   * du dossier `only`, ou toutes (`agent-check.ts`).
   */
  async agentSessions(profileId: string, only?: string): Promise<AgentSessionView[]> {
    return agentSessions({
      profile: this.profileById(profileId),
      only,
      records: [...this.conversations.values()].map((c) => c.record),
      settings: this.settings,
      neutralFolder: this.options.neutralFolder,
      clientVersion: this.options.clientVersion,
      hidden: this.options.hiddenSessions?.(profileId) ?? []
    })
  }

  /**
   * Reprend une session de l'agent (fiche 055) : nouvelle conversation de l'historique, que l'agent
   * rejoue en s'ouvrant (`session/load`, sinon `session/resume`). Déjà reprise : elle est ouverte.
   */
  resumeSession(profileId: string, session: AgentSessionView): ConversationView {
    const existing = [...this.conversations.values()].find(
      (c) => c.record.profileId === profileId && c.record.sessionId === session.sessionId
    )
    if (existing) return this.select(existing.record.id)
    this.profileById(profileId)
    if (!isDirectory(session.cwd))
      throw new Error(t('conversations.error.folderMissing', { folder: session.cwd }))
    const conversation: Conversation = {
      record: resumedRecord(randomUUID(), profileId, session),
      transcript: emptyTranscript,
      lastUsed: Date.now(),
      readAt: Date.now(),
      draft: false
    }
    this.conversations.set(conversation.record.id, conversation)
    this.saveIndex()
    log.info(`Session reprise (${profileId}) : ${session.sessionId} dans ${session.cwd}`)
    return this.select(conversation.record.id)
  }

  /**
   * Travail d'un sous-agent dont l'agent garde la session (profil `subagentReplay`, fiche 053) :
   * rejoué dans un agent à part, sans appel au modèle ; la consigne, déjà sur la carte, est retirée.
   */
  subagentWork(id: string, toolCallId: string): Promise<TranscriptItem[]> {
    const conversation = this.get(id)
    const tool = this.transcriptOf(conversation).items.find(
      (item) => item.kind === 'tool' && item.toolCallId === toolCallId
    )
    const run = tool?.kind === 'tool' ? tool.subagentRun : undefined
    const profile = this.profileOf(id)
    if (!run?.sessionId || !profile?.subagentReplay) {
      return Promise.reject(new Error(t('conversations.error.noSubagentWork')))
    }
    return this.subagentWorks.load(
      {
        profile,
        workspace: conversation.record.workspace,
        clientVersion: this.options.clientVersion,
        sessionId: run.sessionId,
        credentials: () => this.settings.credentials(profile)
      },
      // Sous-agent qui travaille encore (fiche 122) : relu, pas gardé.
      { fresh: !!run.background && run.endedAt === undefined }
    )
  }

  /**
   * Avant de repartir d'un message (fiche 023) : fichiers modifiés par l'agent depuis ce point et
   * ce qu'il adviendrait de chacun, commandes lancées depuis.
   */
  async branchPreview(id: string, itemId: number): Promise<BranchPreview> {
    const conversation = this.get(id)
    return previewBranch(
      this.transcriptOf(conversation).items,
      itemId,
      conversation.record.workspace
    )
  }

  /**
   * Repartir d'un message de l'utilisateur avec un nouveau texte (fiche 023). ACP ne sait pas
   * couper une session : une nouvelle conversation (même agent, même dossier) reprend l'échange
   * antérieur, que l'agent reçoit en contexte. L'originale reste intacte. `restoreFiles` : les
   * fichiers modifiés par l'agent depuis ce point sont remis dans leur état d'alors.
   */
  async branch(
    id: string,
    itemId: number,
    text: string,
    options: { restoreFiles?: boolean } = {}
  ): Promise<ConversationView> {
    const source = this.get(id)
    if (source.host && source.snapshot?.status === 'busy') {
      throw new Error(t('conversations.error.busyBranch'))
    }
    const prepared = await prepareBranch(
      {
        id: source.record.id,
        title: source.record.title,
        workspace: source.record.workspace,
        transcript: this.transcriptOf(source)
      },
      itemId,
      text,
      options
    )

    const active = this.get(this.activeId)
    if (active.draft) this.discard(active)
    const conversation = this.createDraft(source.record.profileId, source.record.workspace)
    conversation.transcript = prepared.transcript
    conversation.record.branchedFrom = { id: source.record.id, title: source.record.title }
    // Même worktree que l'originale : il reste à elle (voir `sharesWorktree`).
    if (source.record.worktree) conversation.record.worktree = source.record.worktree
    // Dans l'historique tout de suite (un brouillon serait jeté si l'on va ailleurs pendant que
    // l'agent démarre).
    conversation.draft = false
    conversation.record.title = prepared.title
    // Titre de l'original et sa marque : l'agent de la branche ne le remplace pas (fiche 125).
    conversation.record.titleSource = 'app'
    this.touch(conversation)
    this.flush(conversation)
    this.activeId = conversation.record.id
    this.ensureLive(conversation)
    this.emitList()

    // Le tour part sans être attendu : l'interface affiche la branche tout de suite.
    void this.prompt(conversation.record.id, prepared.text, prepared.attachments, {
      context: prepared.context
    }).catch((error: unknown) => {
      this.onEvent(conversation, {
        type: 'notice',
        level: 'error',
        message: messageOf(error)
      })
    })
    return this.view(conversation.record.id)
  }

  /** Retire un message de la file d'attente (fiche 020) et le rend à la zone de saisie. */
  unqueue(id: string, messageId: string): QueuedMessage {
    const host = this.get(id).host
    if (!host) throw new Error(t('conversations.error.queuedMissing'))
    return host.unqueue(messageId)
  }

  /** Envoie la file d'attente tout de suite (interrompt la réponse en cours). */
  sendNow(id: string, messageId: string): Promise<void> {
    const host = this.interrupting(id)
    if (!host) throw new Error(t('conversations.error.queuedMissing'))
    return host.sendNow(messageId)
  }

  cancel(id: string): Promise<void> {
    return this.interrupting(id)?.cancel() ?? Promise.resolve()
  }

  /** L'utilisateur arrête la réponse : un outil qui échoue ensuite est interrompu (fiche 126). */
  private interrupting(id: string): AgentHost | undefined {
    const conversation = this.get(id)
    const busy = conversation.host?.snapshot().status === 'busy'
    if (busy) this.onEvent(conversation, { type: 'cancel-requested' })
    return conversation.host
  }

  /** « Réessayer » un tour après une panne réseau ou une limite de débit (fiche 142). */
  retryTurn(id: string): void {
    this.liveHost(id).retryTurn()
  }

  /** « Relancer » après une panne : même session, fil de l'app gardé tel quel. */
  async restart(id: string): Promise<void> {
    const conversation = this.get(id)
    // La file d'attente passe au nouvel hôte (fiche 043) ; elle repart à la demande de l'utilisateur.
    const old = conversation.host
    const queued = old?.takeQueued() ?? []
    conversation.host = undefined
    // Avant le premier message, la session rouverte est neuve : l'ancienne, vide, est supprimée.
    if (old && conversation.draft) trackDraftDrop(this.dropping, old, AGENT_DELETE_TIMEOUT_MS)
    else old?.stop()
    const host = this.ensureLive(conversation, { keepTranscript: true })
    if (queued.length > 0) host.restoreQueued(queued)
    await host.start()
  }

  /**
   * Annule une modification de l'agent (fiche 021, levée par la 043) : le fichier revient à son
   * état d'avant la conversation si rien ne l'a modifié depuis ; sinon il n'est pas touché. Le fil
   * le dit dans les deux cas.
   */
  async revertFile(id: string, path: string): Promise<RevertOutcome> {
    const conversation = this.get(id)
    const { outcome, notice } = await revertChange(
      this.transcriptOf(conversation).items,
      path,
      conversation.record.workspace
    )
    this.onEvent(conversation, { type: 'notice', ...notice })
    return outcome
  }

  respondPermission(id: string, requestId: string, optionId: string | null): void {
    this.liveHost(id).respondPermission(requestId, optionId)
  }

  respondElicitation(id: string, requestId: string, answer: ElicitationAnswer): void {
    this.liveHost(id).respondElicitation(requestId, answer)
  }

  /** Connexion demandée par l'agent (ex. SSO de Bob). */
  authenticate(id: string, methodId: string): Promise<void> {
    return this.liveHost(id).authenticate(methodId)
  }

  /** Réponse à la carte « limite d'étapes » (fiche 209). */
  answerTurnLimit(id: string, itemId: number, answer: TurnLimitAnswer): Promise<void> {
    return answerTurnLimit(this, (how) => this.liveHost(id).afterTurnLimit(how), id, itemId, answer)
  }

  /** Réessaie d'ouvrir la session (ex. dossier approuvé entre-temps dans Bob). */
  retrySession(id: string): Promise<void> {
    return this.liveHost(id).retrySession()
  }

  /** Confiance ponctuelle au dossier (`--trust`), pour cette conversation seulement. */
  trustForSession(id: string): Promise<void> {
    return this.liveHost(id).trustForSession()
  }

  /** Profil d'agent d'une conversation (absent si la conversation ou le profil n'existe plus). */
  profileOf(id: string): AgentProfile | undefined {
    const profileId = this.conversations.get(id)?.record.profileId
    return this.options.profiles.find((p) => p.id === profileId)
  }

  /**
   * Dossier de travail d'une conversation (terminal, fichiers, git) ; refusé sans dossier choisi
   * (fiche 093) : rien ne doit partir du dossier courant du processus.
   */
  workspaceOf(id: string): string {
    const { workspace } = this.get(id).record
    if (!hasFolder(workspace)) throw new Error(t('conversations.error.noFolder'))
    return workspace
  }

  /** Lecture en tâche de fond du dossier : `none` tant qu'aucun n'est choisi, sans erreur. */
  readFolder<T>(id: string, read: (folder: string) => T | Promise<T>, none: T): Promise<T> {
    const { workspace } = this.get(id).record
    return Promise.resolve(hasFolder(workspace) ? read(workspace) : none)
  }

  /** Outils de Bobine, par famille (Réglages › Serveurs MCP, fiches 099 et 109). */
  appToolsCatalog(): AppToolFamily[] {
    return appToolsCatalog(this.options.toolModules ?? [], this.settings.appToolsOff())
  }

  /** Outils de Bobine que reçoit la conversation : ceux de sa session, sinon ceux de son dossier. */
  appToolNames(id: string): ConversationAppTools {
    const { host, record } = this.get(id)
    return conversationAppTools(this.toolModules, record.workspace, id, host?.appToolNames)
  }

  /** Change un réglage et le mémorise pour ce profil (réappliqué aux prochaines sessions). */
  async setControl(
    id: string,
    controlId: string,
    value: ControlValue,
    { remember = true }: { remember?: boolean } = {}
  ): Promise<void> {
    const conversation = this.get(id)
    if (!conversation.host) throw new Error(t('conversations.error.noLiveAgent'))
    await conversation.host.setControl(controlId, value)
    // Mode d'un rôle, modèle d'une fille (fiche 223) : pour cette conversation seulement.
    if (remember) this.settings.rememberControl(conversation.record.profileId, controlId, value)
  }

  rename(id: string, title: string): void {
    const clean = title.trim().slice(0, 200)
    if (!clean) throw new Error(t('conversations.error.emptyTitle'))
    const renamed: Partial<ConversationRecord> = { title: clean, titleSource: 'user' }
    this.updateRecord(id, (record) => Object.assign(record, renamed))
  }

  /**
   * Change la fiche d'une conversation, enregistrée (sauf conversation vide, gardée en mémoire)
   * puis la liste prévenue. `change` reçoit le statut de son agent (`undefined` sans agent), qu'il
   * rend ; une erreur levée par `change` laisse tout tel quel.
   */
  updateRecord(
    id: string,
    change: (record: ConversationRecord, status: AgentStatus | undefined) => void
  ): AgentStatus | undefined {
    const conversation = this.get(id)
    const status = conversation.host?.snapshot().status
    change(conversation.record, status)
    if (!conversation.draft) this.saveIndex()
    this.emitList()
    return status
  }

  /**
   * Supprime une conversation. `fromAgent` (par défaut) : la session est aussi supprimée de
   * l'historique de l'agent (`session/delete`, s'il l'annonce) ; un agent arrêté est démarré
   * brièvement pour cela.
   */
  async delete(
    id: string,
    options: { fromAgent?: boolean; removeWorktree?: boolean } = {}
  ): Promise<ConversationsState> {
    // Lecture seule (fiche 196) : refusé avant tout (rien chez l'agent, worktree gardé).
    this.trashed.writable()
    const conversation = this.get(id)
    const { sessionId } = conversation.record
    let agentDeleted = false
    if (options.fromAgent !== false && sessionId && !conversation.draft) {
      try {
        const host =
          conversation.host ??
          (this.retired(conversation) ? undefined : this.ensureLive(conversation))
        if (host) {
          await withTimeout(host.start(), AGENT_DELETE_TIMEOUT_MS)
          agentDeleted = await withTimeout(host.deleteSession(), AGENT_DELETE_TIMEOUT_MS)
        }
      } catch {
        // Best-effort : l'agent peut refuser ou ne pas démarrer ; la conversation disparaît quand
        // même de l'app.
      }
    }
    conversation.host?.stop()
    // Worktree supprimé à la demande, une fois l'agent arrêté (il y travaillait).
    const { worktree } = conversation.record
    if (
      options.removeWorktree &&
      worktree &&
      this.options.worktrees &&
      !sharesWorktree(conversation, this.conversations.values())
    ) {
      await this.options.worktrees.remove(worktree, { force: true }).catch((error: unknown) => {
        log.warn('Worktree non supprimé :', error)
      })
    }
    this.conversations.delete(id)
    this.beside.delete(id)
    this.options.onDeleted?.(id)
    for (const listener of [...this.listeners]) listener.deleted?.(id)
    // Corbeille (fiche 196) : plus aucune écriture du fil, celles en vol finies, puis il y part.
    if (!conversation.draft) await this.trashed.put(conversation, agentDeleted)
    this.contentSearch.forget(id)
    this.saveIndex()
    if (id === this.activeId) {
      const { profileId, workspace } = conversation.record
      // Conversation en worktree : la suivante repart dans le dépôt principal (même sous-dossier).
      const next = worktree ? join(worktree.root, relative(worktree.path, workspace)) : workspace
      const draft = this.createDraft(
        this.profileOrDefault(profileId).id,
        isDirectory(next) ? next : (this.options.defaultWorkspace ?? NO_FOLDER)
      )
      this.activeId = draft.record.id
      if (this.startable(draft)) this.ensureLive(draft)
    }
    this.emitList()
    return this.state()
  }

  /**
   * Archive une conversation (hors des « Récents », son agent est arrêté) ou la ressort. La
   * conversation affichée archivée laisse place à une nouvelle conversation.
   */
  setArchived(id: string, archived: boolean): ConversationsState {
    const conversation = this.get(id)
    if (conversation.draft) return this.state()
    if (archived) {
      if (conversation.snapshot?.status === 'busy') {
        throw new Error(t('conversations.error.busyArchive'))
      }
      conversation.record.archived = true
      delete conversation.record.pinned
      releaseAgent(conversation)
      this.options.onReleased?.(id, 'archived')
      this.beside.delete(id)
      if (id === this.activeId) {
        const draft = this.createDraft(conversation.record.profileId, conversation.record.workspace)
        this.activeId = draft.record.id
        if (this.startable(draft)) this.ensureLive(draft)
      }
    } else {
      delete conversation.record.archived
    }
    this.saveIndex()
    this.emitList()
    this.releaseTranscripts()
    return this.state()
  }

  /** Épingle une conversation en tête de la barre latérale, ou la détache. */
  setPinned(id: string, pinned: boolean): void {
    if (this.get(id).draft) return
    this.updateRecord(id, (record) => (pinned ? (record.pinned = true) : delete record.pinned))
  }

  /**
   * Recherche dans le contenu des conversations (messages de l'utilisateur et de l'agent), des plus
   * récentes aux plus anciennes ; tous les mots, sans casse ni accents. Ne charge aucun fil : ceux
   * qui ne sont pas en mémoire sont lus sur le disque sans être gardés (fiche 046).
   */
  search(query: string): Promise<ContentHit[]> {
    return this.contentSearch.searchConversations(this.conversations.values(), query)
  }

  /** Conversations de l'historique dont le fil est en mémoire (tests). */
  loadedTranscripts(): string[] {
    return [...this.conversations.values()]
      .filter((c) => !c.draft && c.transcript)
      .map((c) => c.record.id)
  }

  /**
   * Sort une conversation de la corbeille (fiche 196). Sa session supprimée chez l'agent : elle
   * continuera dans une session neuve, et son fil le dit.
   */
  restoreFromTrash(id: string): ConversationsState {
    // Lecture seule : la corbeille refuse elle-même (`ConversationTrash`).
    if (this.conversations.has(id)) throw new Error(t('profile.trash.alreadyThere'))
    const { record, notice } = this.trashed.restore(id, (p) => this.profileOrDefault(p).label)
    const conversation: Conversation = { record, lastUsed: 0, readAt: 0, draft: false }
    this.conversations.set(id, conversation)
    if (notice) this.onEvent(conversation, notice)
    this.saveIndex()
    this.emitList()
    return this.state()
  }

  /** Arrête tous les agents (fermeture de l'app) et écrit les fils en attente. */
  stopAll(): void {
    for (const listener of [...this.listeners]) listener.stopped?.()
    this.writer.cancelPending()
    for (const conversation of this.conversations.values()) {
      conversation.host?.stop()
      // Plus de boucle d'évènements après : écriture synchrone.
      this.flush(conversation, { sync: true })
      // Conversation en worktree jamais commencée : son worktree ne doit pas survivre à l'app.
      const { worktree } = conversation.record
      if (conversation.draft && worktree) this.options.worktrees?.removeIfUntouchedSync(worktree)
    }
  }

  /**
   * Des conversations vides ont une session chez leur agent (ou en ouvrent une), ou une session de
   * conversation vide quittée est en cours de suppression.
   */
  hasDraftSessions(): boolean {
    const opening = (c: Conversation) =>
      c.draft && c.host && (c.host.currentSessionId || c.host.snapshot().status === 'starting')
    return this.dropping.size > 0 || [...this.conversations.values()].some(opening)
  }

  /**
   * Avant de quitter : la session de chaque conversation vide est supprimée chez son agent (voir
   * `dropDraftSession`), dans la limite de `timeoutMs` en tout.
   */
  async dropDraftSessions(timeoutMs: number): Promise<void> {
    const drops: Promise<void>[] = []
    for (const conversation of this.conversations.values()) {
      const host = conversation.host
      if (!conversation.draft || !host) continue
      conversation.host = undefined
      drops.push(dropDraftSession(host, timeoutMs))
    }
    // Celles des conversations vides déjà quittées, encore en cours.
    const pending = Promise.all([...this.dropping])
    await Promise.all([...drops, withTimeout(pending, timeoutMs).catch(() => {})])
  }

  /** Avis montré dans la conversation de l'accueil au lancement (avant `startActive`). */
  addStartupNotice(message: Message): void {
    this.pendingNotices.push(message)
  }

  /** Démarre l'agent de la conversation active (au lancement de l'app). */
  async startActive(): Promise<ConversationView> {
    const conversation = this.get(this.activeId)
    for (const message of this.pendingNotices.splice(0)) {
      this.onEvent(conversation, { type: 'notice', level: 'warning', message })
    }
    // Pas de dossier choisi : l'agent attend ce choix (fiche 093).
    if (this.startable(conversation)) await this.ensureLive(conversation).start()
    return this.view(this.activeId)
  }

  /* ---------- Interne ---------- */

  private get(id: string): Conversation {
    const conversation = this.conversations.get(id)
    if (!conversation) throw new Error(t('conversations.error.unknown', { id }))
    return conversation
  }

  private liveHost(id: string): AgentHost {
    const host = this.get(id).host
    if (!host) throw new Error(t('conversations.error.noLiveAgent'))
    return host
  }

  /** Profil demandé par son identifiant ; erreur s'il n'est pas (ou plus) proposé. */
  private profileById(id: string): AgentProfile {
    const profile = this.options.profiles.find((p) => p.id === id)
    if (!profile) throw new Error(t('conversations.error.unknownAgent', { agent: id }))
    return profile
  }

  private profileOrDefault(id: string | undefined): AgentProfile {
    return profileOrDefault(this.options.profiles, id, this.options.pathEnv())
  }

  /** Brouillon dans un nouveau worktree depuis le dossier de `fromId`, son agent ou `profileId`. */
  private async inNewWorktree(from: Origin, profileId?: string): Promise<Conversation> {
    const worktrees = this.options.worktrees
    if (!worktrees) throw new Error(t('conversations.error.noWorktrees'))
    const profile = profileId ? this.profileById(profileId) : this.profileOrDefault(from.profileId)
    const { workspace, ...worktree } = await worktrees.create(from.workspace)
    const conversation = this.createDraft(profile.id, workspace)
    conversation.record.worktree = worktree
    // Départ explicite (fiche 110) : d'où part le worktree, et ce qui n'y est pas.
    this.onEvent(conversation, worktreeStartEvent(worktree))
    return conversation
  }

  /**
   * Dossier par défaut, d'où repartir quand celui d'une nouvelle conversation a disparu ; jamais
   * un dossier récent pris au hasard (un autre projet) : sinon, l'app demande le dossier.
   */
  private fallbackFolders(): (string | undefined)[] {
    return [this.settings.current.newConversation?.workspace, this.options.defaultWorkspace]
  }

  private createDraft(profileId: string, wanted: string): Conversation {
    const { workspace, gone } = usableFolder(wanted, this.fallbackFolders())
    const conversation: Conversation = {
      record: draftRecord(profileId, workspace, t('conversations.newTitle')),
      transcript: emptyTranscript,
      lastUsed: Date.now(),
      readAt: Date.now(),
      draft: true
    }
    this.conversations.set(conversation.record.id, conversation)
    this.awaitsFolder(conversation)
    const message = gone && folderGoneMessage(gone, workspace)
    if (message) this.onEvent(conversation, { type: 'notice', level: 'warning', message })
    return conversation
  }

  private discard(conversation: Conversation): void {
    const host = conversation.host
    // Plus rien n'est émis pour elle (l'hôte peut encore vivre le temps de supprimer sa session).
    conversation.host = undefined
    if (host) trackDraftDrop(this.dropping, host, AGENT_DELETE_TIMEOUT_MS)
    this.conversations.delete(conversation.record.id)
    // Conversation en worktree quittée sans message : le worktree, encore intact, disparaît aussi
    // (sans `force` : s'il a été modifié entre-temps, il reste).
    const { worktree } = conversation.record
    if (worktree && this.options.worktrees) {
      void this.options.worktrees.remove(worktree).catch(() => {})
    }
  }

  /** Agent vivant pour cette conversation (créé si besoin), puis éviction des plus anciens. */
  /**
   * Conversation dont l'agent n'est plus proposé (profil retiré, ex. Codex) : jamais rouverte avec un
   * autre agent, mais affichée en lecture seule.
   */
  private retired(conversation: Conversation): boolean {
    const { profileId, workspace } = conversation.record
    if (this.options.profiles.some((p) => p.id === profileId)) return false
    conversation.snapshot = retiredSnapshot(profileId, workspace)
    return true
  }

  /** Conversation sans dossier (fiche 093) : pas d'agent, la carte « Choisissez le dossier… ». */
  private awaitsFolder(conversation: Conversation): boolean {
    const { profileId, workspace } = conversation.record
    if (hasFolder(workspace)) return false
    conversation.snapshot = folderNeededSnapshot(this.profileOrDefault(profileId))
    return true
  }

  /** Son agent peut démarrer : profil encore proposé, dossier choisi. */
  private startable(conversation: Conversation): boolean {
    return !this.retired(conversation) && !this.awaitsFolder(conversation)
  }

  private ensureLive(
    conversation: Conversation,
    options: { keepTranscript?: boolean } = {}
  ): AgentHost {
    conversation.lastUsed = Date.now()
    if (!conversation.host) {
      if (this.retired(conversation)) {
        throw new Error(t('conversations.retired.error', { agent: conversation.record.profileId }))
      }
      if (this.awaitsFolder(conversation)) throw new Error(t('conversations.error.noFolder'))
      const profile = this.profileOrDefault(conversation.record.profileId)
      const { sessionId } = conversation.record
      const host: AgentHost = new AgentHost(
        hostOptions({
          profile,
          record: conversation.record,
          // Modules d’outils sans les familles coupées par l’utilisateur (fiche 109).
          app: { ...this.options, toolModules: this.toolModules },
          settings: this.settings,
          works: this.subagentWorks,
          items: () => this.transcriptOf(conversation).items,
          // Fil gardé dès qu'il contient quelque chose (fiche 103, ADR-0021) : le rejeu de
          // l'agent ne refait un fil que s'il n'y en a pas (session reprise d'ailleurs, fichier
          // illisible).
          reopen:
            sessionId && !conversation.draft
              ? {
                  sessionId,
                  ...(options.keepTranscript || this.transcriptOf(conversation).items.length > 0
                    ? { keepTranscript: true }
                    : {})
                }
              : undefined,
          // Un hôte remplacé ou arrêté ne doit plus rien émettre.
          emit: (event) => {
            if (conversation.host === host) this.onEvent(conversation, event)
          }
        })
      )
      conversation.host = host
      void host.start()
      // Jamais elle-même : son agent vient de démarrer (une fille lancée en arrière-plan, fiche 097).
      this.evict(conversation)
    }
    return conversation.host
  }

  /** Agents vivants au plus : celui imposé au lancement, sinon le réglage (fiche 102). */
  private liveLimit(): number {
    return this.options.maxLive ?? this.settings.preferences().maxLive
  }

  /** Met en veille les agents en trop (fiche 043), jamais une conversation gardée ; rend s'il y en a. */
  private evict(starting?: Conversation): boolean {
    const live = [...this.conversations.values()].filter((c) => c.host)
    const stopped = agentsToStop(live, this.liveLimit(), (conversation) => {
      const id = conversation.record.id
      if (id === this.activeId || this.beside.has(id)) return true
      if (conversation.snapshot?.status === 'busy' || conversation === starting) return true
      return this.options.keepLive?.(id) ?? false
    })
    for (const conversation of stopped) {
      releaseAgent(conversation)
      this.options.onReleased?.(conversation.record.id, 'evicted')
    }
    this.releaseTranscripts()
    return stopped.length > 0
  }

  /**
   * Libère les fils dont rien n'a besoin (fiche 046) : conversation ni affichée, ni rattachée à un
   * agent, et fil à jour sur le disque (aucune écriture prévue, en cours ou en échec). Les
   * `maxIdleTranscripts` lus le plus récemment restent en mémoire ; les autres seront relus à la
   * demande.
   */
  private releaseTranscripts(): void {
    const max = this.options.maxIdleTranscripts ?? MAX_IDLE_TRANSCRIPTS
    const shown = new Set(this.shownIds())
    const idle = [...this.conversations.values()]
      .filter((c) => c.transcript && !c.draft && !c.host && !shown.has(c.record.id))
      .sort((a, b) => b.readAt - a.readAt)
    for (const conversation of idle.slice(max)) {
      if (this.writer.idle(conversation.record.id)) conversation.transcript = undefined
    }
  }

  private onEvent(conversation: Conversation, event: AgentEvent): void {
    conversation.transcript = reduceTranscript(this.transcriptOf(conversation), event)
    let listChanged = this.syncUsage(conversation)

    if (event.type === 'status') {
      const before = conversation.snapshot?.status
      conversation.snapshot = event.snapshot
      this.settings.noteModels(conversation.record.profileId, event.snapshot.controls)
      // L'identifiant de session est connu une fois la session ouverte.
      const sessionId = conversation.host?.currentSessionId
      if (sessionId && sessionId !== conversation.record.sessionId && !conversation.draft) {
        conversation.record.sessionId = sessionId
        this.saveIndex()
      }
      listChanged = before !== event.snapshot.status
      if (listChanged) warnIfStopped(conversation.record, event.snapshot)
    }
    if (event.type === 'turn-error') {
      log.warn(`Tour en échec (${conversation.record.id}) :`, event.message)
    }
    if (event.type === 'memory-proposal' && notePendingMemory(conversation)) {
      listChanged = true
      if (!conversation.draft) this.saveIndex()
    }
    const proposed = proposedTitle(conversation.record, event)
    if (proposed) {
      conversation.record.title = proposed
      conversation.record.titleSource = 'agent'
      listChanged = true
    }
    if (!conversation.draft) {
      if (event.type === 'user-message' || event.type === 'turn-end') {
        this.touch(conversation)
        listChanged = true
      }
      this.scheduleSave(conversation, event.type === 'turn-end' || event.type === 'turn-error')
    }

    conversation.seq = (conversation.seq ?? 0) + 1
    const payload = { conversationId: conversation.record.id, event, seq: conversation.seq }
    this.options.emit?.(payload)
    for (const listener of [...this.listeners]) listener.event?.(payload)
    if (listChanged) this.emitList()
  }

  /**
   * Résumé de consommation de l'index (fiche 109), recalculé depuis le fil ; écrit s'il a changé.
   * Vrai si la liste est à renvoyer.
   */
  private syncUsage(conversation: Conversation): boolean {
    const digest = usageDigest(conversation.transcript?.usage)
    if (sameDigest(digest, conversation.record.usage)) return false
    if (digest) conversation.record.usage = digest
    else delete conversation.record.usage
    if (!conversation.draft) this.saveIndex()
    return true
  }

  private touch(conversation: Conversation): void {
    conversation.record.updatedAt = new Date().toISOString()
    this.saveIndex()
  }

  /** Écrit le fil tout de suite (fin de tour) ou un peu plus tard (pendant le streaming). */
  private scheduleSave(conversation: Conversation, now: boolean): void {
    this.writer.transcript(conversation.record.id, () => this.saveable(conversation), now)
  }

  private flush(conversation: Conversation, options: { sync?: boolean } = {}): void {
    const transcript = this.saveable(conversation)
    if (transcript) this.writer.transcript(conversation.record.id, () => transcript, true, options)
  }

  /**
   * Fil à écrire, sauf brouillon, conversation supprimée entre-temps, ou fil jamais chargé (il est
   * intact sur le disque).
   */
  private saveable(conversation: Conversation): TranscriptState | undefined {
    if (conversation.draft || !this.conversations.has(conversation.record.id)) return undefined
    return conversation.transcript
  }

  /** Attend les écritures asynchrones en cours (tests). */
  settled(): Promise<void> {
    return this.writer.settled()
  }

  /**
   * Fil de la conversation, lu du disque à la première demande. Un fichier abîmé est mis de côté
   * (jamais écrasé) et la conversation le dit, puis repart vide.
   */
  private transcriptOf(conversation: Conversation): TranscriptState {
    conversation.readAt = Date.now()
    if (conversation.transcript) return conversation.transcript
    const before = this.store.damaged.length
    const loaded = this.store.loadTranscript(conversation.record.id)
    conversation.transcript = settleTranscript(loaded ?? emptyTranscript)
    // Conversation d'avant la fiche 109 : son résumé vient du fil, à sa première lecture.
    if (this.syncUsage(conversation)) this.emitList()
    const damaged = this.store.damaged.slice(before)
    if (damaged.length > 0) {
      log.warn(`Fil illisible mis de côté (${conversation.record.id}) :`, damaged)
      this.onEvent(conversation, damagedTranscriptNotice(damaged))
    }
    // Un fil de plus en mémoire : les plus anciens dont rien n'a besoin laissent la place.
    const transcript = conversation.transcript
    this.releaseTranscripts()
    return transcript
  }

  private saveIndex(): void {
    this.writer.index([...this.conversations.values()].filter((c) => !c.draft).map((c) => c.record))
  }

  private summary(conversation: Conversation): ConversationSummary {
    const seen = this.settings.current.agentsSeen
    return summaryOf(conversation, this.options.profiles, (id) => this.conversations.get(id), seen)
  }

  private emitList(): void {
    const state = this.state()
    this.options.emitList?.(state)
    for (const listener of [...this.listeners]) listener.list?.(state)
  }
}

/** Cartes de mémoire en attente (fiche 182), gardées dans la fiche pour la pastille ; vrai si changé. */
function notePendingMemory(conversation: Conversation): boolean {
  const pending = memoryProposals(conversation.transcript?.items ?? []).filter(
    (p) => p.status === 'pending'
  ).length
  if ((conversation.record.memoryPending ?? 0) === pending) return false
  if (pending) conversation.record.memoryPending = pending
  else delete conversation.record.memoryPending
  return true
}
