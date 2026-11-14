/**
 * AgentHost : cycle de vie d'un agent ACP (processus + connexion + session) côté main process.
 * N'importe pas `electron` : testable sous Vitest contre l'agent factice.
 */
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { homedir } from 'node:os'
import { client, methods, ndJsonStream } from '../../shared/acp-sdk.mts'
import type {
  ClientConnection,
  ContentBlock,
  CreateElicitationRequest,
  CreateElicitationResponse,
  InitializeResponse,
  McpServer,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionConfigOption,
  SessionModeState,
  SessionNotification,
  SessionUpdate
} from '../../shared/acp-sdk.mts'
import type {
  AgentBlocker,
  AgentCommand,
  ApiKeyInfo,
  AgentEvent,
  AgentSnapshot,
  AgentStatus,
  ControlValue,
  ElicitationAnswer,
  QueuedMessage,
  TerminalStep
} from '@shared/agent'
import type { PromptAttachment, PromptCapabilities } from '@shared/attachments'
import type { ContextSource } from '@shared/context-mentions'
import type { TranscriptItem } from '@shared/transcript'
import type { Handover } from '@shared/handover'
import { rememberableTool } from '@shared/permissions'
import type { ToolEndpoint } from '../mcp/tool-server'
import { APP_TOOLS_SERVER_NAME, type AppTool, type AppToolModule } from '../mcp/tools'
import type { EnvChanges } from '../agent-config/api-keys'
import type { NetworkWatch } from '../network-watch'
import { log, type LogScope } from '../log'
import { formatDuration, hostScope, scopeText } from './acp-log'
import { watchSilence } from './silence-watch'
import type { ChildSession, SubagentStream } from './adapters'
import { launchAgent, type AgentProcess } from './agent-process'
import { AppToolsBridge } from './app-tools-bridge'
import { announcementOf, type AgentAnnouncement } from './capabilities'
import { AgentIncompatible, refuseIncompatible } from './version-check'
import { applyInitialSettings, openWithStartMode } from './initial-controls'
import { MessageQueue } from './message-queue'
import { PendingRequests } from './pending-requests'
import { permissionRisks } from './permission-risk'
import { errorMessage, isDirectory, killTree, race, settleNotifications } from './process-utils'
import { StopWatch } from './stop-watch'
import type { SessionDirectories } from './additional-directories'
import { buildPrompt, sessionContextOf, withContext, type SessionContext } from './prompt-content'
import { CHILDREN_REQUEST, originContext, type MessageOrigin } from '@shared/children'
import type { AgentProfile } from './profiles'
import { markRefused, noteAnswered, type RefusedModelsOfProfile } from './refused-models'
import { buildControls, isValidValue, MODE_CONTROL_ID, sessionChoices } from './session-controls'
import { routeUpdate } from './session-updates'
import { SessionCost } from './session-cost'
import { ReplayBuffer } from './replay-buffer'
import { SubagentTracker } from './subagent-tracker'
import { ProfileUpdates } from './profile-updates'
import { compactCommandOf, isCompactionRequest } from './compaction'
import { TurnRetry } from './turn-retry'
import { TurnLimitWatch } from './turn-limit'
import {
  NO_SESSION_SUPPORT,
  elicitationPrompt,
  initializeParams,
  authMethodsOf,
  promptCapabilitiesOf,
  sessionSupportOf,
  type SessionSupport
} from './announced'
import { sessionBlocker } from './session-blocker'
import { TurnAuth, authExpiredNotice, turnAuthBlocker, type BlockedTurn } from './turn-auth'
import { t } from 'i18next'

export interface AgentHostOptions {
  profile: AgentProfile
  /** Dossier de travail de la session (`cwd` de `session/new`). */
  workspace: string
  /** Autres dossiers de la conversation (fiche 179) : à l'ouverture de session, puis au message. */
  directories?: SessionDirectories
  emit: (event: AgentEvent) => void
  clientVersion?: string
  /** Ouvre un lien dans le navigateur système (élicitation en mode URL). */
  openExternal?: (url: string) => void
  /** Réglages à appliquer à l'ouverture de session (préférences, sinon défauts du profil). */
  initialControls?: Record<string, ControlValue>
  /**
   * Session existante à rouvrir (conversation de l'historique) : `session/load` si l'agent sait la
   * rejouer, sinon `session/resume`, sinon une session neuve qui reçoit l'échange d'avant au
   * prochain message (ADR-0030). Absent : nouvelle session.
   */
  reopen?: {
    sessionId: string
    /**
     * Garder le fil de l'app tel quel (« Relancer » après une panne) : `session/resume` si l'agent
     * le permet, sinon `session/load` dont le rejeu est ignoré. Le fil de l'app contient aussi ce
     * que l'agent n'a pas enregistré (tour interrompu, avis de panne).
     */
    keepTranscript?: boolean
  }
  /** Serveur MCP de l'app qui fournit ses outils à l'agent (fiches 028, 029). */
  toolServer?: {
    register: (tools: readonly AppTool[], scope?: LogScope) => ToolEndpoint | undefined
  }
  /** Conversation servie par cet agent (outils de l'app : un navigateur par conversation…). */
  conversationId?: string
  /**
   * Partie d'une commande que les règles de l'agent refusent partout (fiche 215) : les outils de
   * l'app ne la lancent pas. Absent : agent sans règles d'approbation.
   */
  deniedCommand?: (command: string) => string | undefined
  /** Modules d'outils de l'app proposés en plus de `ask_user` (navigateur, simulateur…). */
  toolModules?: readonly AppToolModule[]
  /** Demander l'autorisation même pour les outils de l'app qui n'agissent que dans l'app. */
  confirmAppTools?: boolean
  /** Attente maximale d'une réponse à `ask_user` avant de laisser l'agent finir son tour. */
  askUserWaitMs?: number
  /**
   * Outils autorisés d'office pour cet agent (« Toujours autoriser » retenu par l'app, fiche 042) :
   * consultés à chaque demande, enrichis quand l'utilisateur choisit « Toujours autoriser ».
   */
  rememberedTools?: { has: (title: string) => boolean; add: (title: string) => void }
  /** Modèles refusés faute de connexion avec ce profil (fiche 210), partagés par ses hôtes. */
  refusedModels?: RefusedModelsOfProfile
  /**
   * Mode d'une nouvelle session (réglage « Nouvelle conversation ») : le mode plan de l'agent, ou
   * son mode de travail ; appliqué après les réglages initiaux.
   */
  initialMode?: 'plan' | 'execute'
  /** Délais de démarrage et d'arrêt (remplaçables pour les tests) ; voir `TIMEOUTS`. */
  timeouts?: Partial<typeof TIMEOUTS>
  /**
   * Clés d'API enregistrées dans l'app (fiche 022) : variables posées ou retirées dans
   * l'environnement de l'agent, relues à chaque lancement.
   */
  credentials?: () => Promise<EnvChanges>
  /** État de la clé d'API de l'agent, proposée dans « Connexion requise » (sans sa valeur). */
  apiKeyInfo?: () => ApiKeyInfo | undefined
  /** Contenu de `@git-changes` / `@terminal` (fiche 057), lu à l'envoi du message. */
  contextText?: (source: ContextSource) => Promise<string>
  /**
   * Texte joint avant le prochain message envoyé, lu à l'envoi (file d'attente comprise) :
   * nouvelles des conversations filles (fiche 097).
   */
  extraContext?: () => string | undefined
  /**
   * Texte joint au premier message de chaque session ouverte (nouvelle, rouverte, après un
   * redémarrage) et après une compaction, d'après les outils de l'app qu'elle a reçus et le moment
   * (fiche 223) : ce que l'app offre (fiche 118), index de la mémoire (fiche 182, asynchrone).
   */
  sessionContext?: SessionContext
  /** Ce que l'agent annonce à `initialize` (fiche 054), à chaque démarrage. */
  onAnnounced?: (announcement: AgentAnnouncement) => void
  /**
   * Session d'essai du diagnostic (fiche 061) : `if-deletable`, pas de session si l'agent ne sait
   * pas la supprimer ensuite (elle resterait dans son historique) — prêt, sans session.
   */
  newSession?: 'always' | 'if-deletable'
  /** Relit la session d'un sous-agent (profil `subagentReplay`) : suit ceux en arrière-plan (fiche 122). */
  loadSubagentWork?: (sessionId: string) => Promise<TranscriptItem[]>
  /** Retour du réseau et sortie de veille : un tour en attente réessaie tout de suite (fiche 142). */
  network?: NetworkWatch
  /** Attentes avant chaque nouvelle tentative (remplaçables en test) ; voir `RETRY_DELAYS_MS`. */
  retryDelaysMs?: readonly number[]
}

/**
 * Délais au-delà desquels l'agent est considéré comme bloqué. Larges : Bob met quelques secondes à
 * démarrer, et rejouer une longue conversation (`session/load`) peut prendre du temps.
 */
export const TIMEOUTS = {
  /** Réponse à `initialize`. */
  initializeMs: 60_000,
  /** Réponse à `session/new`, `session/load` ou `session/resume`. */
  sessionMs: 120_000,
  /** Après « Stop », le tour doit se terminer dans ce délai ; sinon le processus est arrêté. */
  cancelGraceMs: 8_000,
  /**
   * Un message envoyé dès la relance attend au plus ce délai le rejeu de `session/load` (fil
   * gardé, fiche 121) ; au-delà, il part quand même.
   */
  replayWaitMs: 2_000
}

export interface PromptOptions {
  /** Texte envoyé à l'agent avant le message, sans apparaître dans le fil (branche, fiche 023). */
  context?: string
  /** Message d'une autre conversation, ou réveil de la mère (fiche 097). */
  from?: MessageOrigin
  /** `/split` (fiche 118) : demander de découper le message en conversations filles. */
  askChildren?: boolean
}

/** Session à rouvrir (option `reopen`). */
type Reopen = NonNullable<AgentHostOptions['reopen']>

/** Session ouverte, avec l'état que l'agent annonce (`session/new`, `load`, `resume`). */
interface OpenedSession {
  sessionId: string
  modes?: SessionModeState | null
  configOptions?: SessionConfigOption[] | null
}

export class AgentHost {
  private status: AgentStatus = 'idle'
  private detail: string | undefined
  private child: ChildProcessWithoutNullStreams | undefined
  private connection: ClientConnection | undefined
  private sessionId: string | undefined
  private starting: Promise<void> | undefined
  /** Lancement en cours (le temps de lire les clés d'API) ; retiré par `stop`. */
  private launchToken: object | undefined
  /** Processus de l'agent et son journal : fin de la sortie d'erreur, relevé ACP (fiche 080). */
  private launched: AgentProcess | undefined
  /** Dernier octet reçu de l'agent : un agent qui se tait pendant un tour est signalé. */
  private lastAgentActivity = 0
  /** Silence de l'agent pendant le tour, au-delà du seuil du bandeau (fiche 194). */
  private silentSince: number | undefined
  private readonly options: AgentHostOptions
  /** Autorisations, formulaires et questions en attente de l'utilisateur. */
  private readonly requests: PendingRequests
  /** Outils de l'app fournis à l'agent (fiches 028, 029). */
  private readonly appTools: AppToolsBridge
  /** Sous-agents suivis en direct : durée, coût (fiche 053). */
  private readonly subagents: SubagentTracker
  /** Mises à jour remises en forme générique d'après le profil (fiches 096, 122, 140). */
  private readonly updates: ProfileUpdates
  /** Modes et options de configuration de la session, tels que l'agent les annonce. */
  private modes: SessionModeState | undefined
  private configOptions: SessionConfigOption[] | undefined
  private commands: AgentCommand[] = []
  /** Coût de la session lu hors protocole (fiche 157). */
  private readonly cost: SessionCost
  private toolEndpoint: ToolEndpoint | undefined
  /** Messages pour l'agent à envoyer dès qu'il est prêt (réponse tardive à une question…). */
  private readonly lateAnswers: string[] = []
  /** Messages écrits pendant une réponse (fiche 020) : envoyés ensemble à la fin du tour. */
  private readonly queue = new MessageQueue()
  /** « Envoyer maintenant » : le tour en cours est annulé, puis la file part. */
  private sendNowPending = false
  /** Un message est en préparation (pièces jointes lues) : l'agent est encore « prêt ». */
  private preparing = false
  /**
   * Contexte de session dû au prochain message (fiche 118), et à quel moment (fiche 223) : session
   * neuve, rouverte, ou compaction ; absent : rien à joindre.
   */
  private sessionContextDue?: Parameters<SessionContext>[1]
  private promptCaps: PromptCapabilities = { image: false, embeddedContext: false }
  private support: SessionSupport = NO_SESSION_SUPPORT
  /** Rejeu en cours (`session/load`) : seuls moments où les messages utilisateur viennent de l'agent. */
  private replaying = false
  /** Rejeu à réconcilier avec le fil de l'app gardé (fiche 103), jusqu'au prochain message envoyé. */
  private ignoreReplay = false
  /** Rejeu tenu à part pendant que le fil de l'app est gardé, réconcilié une fois calme (fiche 103). */
  private readonly replay = new ReplayBuffer((items) =>
    this.options.emit({ type: 'replayed', items })
  )
  /** Rejet à la mort du processus courant (pour les requêtes lancées après le démarrage). */
  private failed: Promise<never> | undefined
  private authMethods: { id: string; name: string; description?: string }[] = []
  /** Ce qui bloque l'ouverture de session (`needs-action`). */
  private blocker: AgentBlocker | undefined
  /** Message refusé faute de connexion (D10), jusqu'à son renvoi. */
  private readonly turnAuth = new TurnAuth()
  /** Limite d'étapes de l'agent (fiche 209) : refus vu, réouverture, session neuve. */
  private readonly turnLimit = new TurnLimitWatch()
  /** Arguments ajoutés pour ce seul hôte (ex. `--trust` choisi par l'utilisateur). */
  private extraArgs: string[] = []
  /** Délai de grâce après « Stop », et pourquoi l'app a arrêté le processus (fiche 195). */
  private readonly stopWatch = new StopWatch()
  /** Reconnexion progressive après une panne réseau ou une limite de débit (fiche 142). */
  private readonly retry: TurnRetry

  constructor(options: AgentHostOptions) {
    this.options = options
    this.retry = new TurnRetry({
      resend: (blocks) => this.resendTurn(blocks),
      changed: () => this.emitSnapshot(),
      network: options.network,
      delaysMs: options.retryDelaysMs,
      agentProcess: () => this.launched,
      transientError: options.profile.transientError,
      scope: () => scopeText(this.logScope())
    })
    this.requests = new PendingRequests(options.emit, options.openExternal)
    this.cost = new SessionCost(options.profile.costSource, () => this.sessionId, options.emit)
    this.updates = new ProfileUpdates(options.profile, options.workspace)
    this.subagents = new SubagentTracker({
      emit: (toolCallId, run) => this.options.emit({ type: 'subagent-run', toolCallId, run }),
      ...this.cost.subagentOptions(),
      replay: options.profile.subagentReplay === true,
      background: options.profile.subagentStream?.background,
      follow: options.loadSubagentWork
    })
    this.appTools = new AppToolsBridge({
      workspace: options.workspace,
      conversationId: options.conversationId,
      toolModules: options.toolModules,
      confirmAppTools: options.confirmAppTools,
      askUserWaitMs: options.askUserWaitMs,
      emit: options.emit,
      requests: this.requests,
      connected: () => this.connection !== undefined,
      tellAgent: (text) => {
        this.lateAnswers.push(text)
        this.flushLateAnswer()
      },
      ...(options.deniedCommand ? { deniedCommand: options.deniedCommand } : {})
    })
  }

  snapshot(): AgentSnapshot {
    const { profile, workspace } = this.options
    return {
      status: this.status,
      detail: this.detail,
      info: {
        profileId: profile.id,
        profileLabel: profile.label,
        // Un seul nom pour l'agent, partout : celui du profil (recette 0.11, C4), pas le titre
        // qu'il annonce à `initialize` (« Bob » pour le profil « IBM Bob »).
        agentName: this.options.profile.label,
        workspace,
        ...(profile.alwaysScope ? { alwaysScope: profile.alwaysScope } : {}),
        ...(profile.welcomeHint ? { welcomeHint: profile.welcomeHint } : {})
      },
      controls: markRefused(
        buildControls(this.modes, this.configOptions),
        this.options.refusedModels
      ),
      commands: this.commands,
      ...(this.compactCommand() ? { compactCommand: this.compactCommand() } : {}),
      promptCapabilities: this.promptCaps,
      ...(this.support.additionalDirectories ? { additionalDirectories: true } : {}),
      queued: this.queue.views(),
      blocker: this.status === 'needs-action' ? this.blocker : undefined,
      retry: this.retry.view(),
      ...(this.silentSince !== undefined ? { silentSince: this.silentSince } : {})
    }
  }

  /** Bandeau de silence (fiche 194) : depuis quand l'agent se tait, ou `undefined`. */
  private setSilent(since: number | undefined): void {
    if (this.silentSince === since) return
    this.silentSince = since
    // Hors tour (arrêt, fin), l'instantané suivant le dira : pas de statut réémis (un `exited`
    // répété ajouterait un avis au fil, fiche 194).
    if (this.is('busy')) this.emitSnapshot()
  }

  /** Commande de compaction : celle que l'agent annonce, sinon celle du profil (fiche 039). */
  private compactCommand(): string | undefined {
    return compactCommandOf(this.commands, this.options.profile.compactCommand)
  }

  /** Outils de l'app que la session ouverte a reçus (fiche 099) ; `undefined` sans session. */
  get appToolNames(): string[] | undefined {
    return this.sessionId ? this.appTools.names(this.toolEndpoint !== undefined) : undefined
  }

  /** Identifiant de la session ACP en cours (à mémoriser pour la rouvrir plus tard). */
  get currentSessionId(): string | undefined {
    return this.sessionId
  }

  get sessionSupport(): SessionSupport {
    return this.support
  }

  /** Ferme la session côté agent (s'il le permet) ; l'agent la garde dans son historique. */
  async closeSession(): Promise<void> {
    const { connection, sessionId } = this
    if (!connection || !sessionId || !this.support.close) return
    await connection.agent.request(methods.agent.session.close, { sessionId })
  }

  /** Supprime la session de l'historique de l'agent (s'il le permet) ; rend vrai si c'est fait. */
  async deleteSession(): Promise<boolean> {
    const { connection, sessionId } = this
    if (!connection || !sessionId || !this.support.delete) return false
    return connection.agent.request(methods.agent.session.delete, { sessionId }).then(() => true)
  }

  /**
   * Change un réglage de session (mode, modèle…) à la demande de l'utilisateur. Autre modèle choisi
   * sur la carte d'un message refusé faute de connexion (fiche 210) : le message repart avec lui.
   */
  async setControl(id: string, value: ControlValue): Promise<void> {
    const { connection, sessionId, blocker } = this
    const refused =
      this.is('needs-action') && TurnAuth.retriesWithModel(blocker, this.snapshot().controls, id)
    if ((this.status !== 'ready' && !refused) || !connection || !sessionId) {
      throw new Error(t('agentHost.control.unavailable', { status: this.status }))
    }
    await this.applyControl(connection, sessionId, id, value)
    // Renvoi du message refusé avec ce modèle : même session, sans relancer l'agent. Seulement si
    // rien n'a bougé pendant l'appel (même agent, même carte) : sinon le message est déjà ailleurs
    // (« Réessayer », connexion) et n'est pas pris ici.
    const same = this.connection === connection && this.blocker === blocker
    if (!refused || !same || !this.is('needs-action')) return
    const turn = this.turnAuth.resendNow(blocker)
    if (!turn) return
    this.blocker = undefined
    await this.resendBlocked(connection, sessionId, turn)
  }

  /** Valide puis envoie le réglage à l'agent, et met à jour l'état local. */
  private async applyControl(
    connection: ClientConnection,
    sessionId: string,
    id: string,
    value: ControlValue
  ): Promise<void> {
    const control = this.snapshot().controls.find((c) => c.id === id)
    if (!control) throw new Error(t('agentHost.control.unknown', { id }))
    if (!isValidValue(control, value)) {
      throw new Error(t('agentHost.control.badValue', { name: control.name, value: String(value) }))
    }
    const fromModes = id === MODE_CONTROL_ID && !this.configOptions?.some((o) => o.id === id)
    if (fromModes && typeof value === 'string') {
      await connection.agent.request(methods.agent.session.setMode, { sessionId, modeId: value })
      if (this.modes) this.modes = { ...this.modes, currentModeId: value }
    } else {
      const response = await connection.agent.request(
        methods.agent.session.setConfigOption,
        typeof value === 'boolean'
          ? { sessionId, configId: id, type: 'boolean', value }
          : { sessionId, configId: id, value }
      )
      this.configOptions = response.configOptions
    }
    this.emitSnapshot()
  }

  /** Démarre l'agent si besoin. Idempotent : des appels concurrents partagent le même démarrage. */
  start(): Promise<void> {
    // Carte d'action : l'agent est là et attend l'utilisateur, jamais un second processus.
    if (this.is('ready') || this.is('busy') || this.is('needs-action')) return Promise.resolve()
    return this.starting ?? this.tracked(this.doStart())
  }

  /**
   * Démarrage ou réouverture en cours (`this.starting`) : un `start()` demandé entre-temps l'attend
   * au lieu de lancer un second agent (D10, N1 : message écrit pendant le renvoi après une
   * connexion par SSO).
   */
  private tracked(work: Promise<void>): Promise<void> {
    const starting = work.finally(() => {
      if (this.starting === starting) this.starting = undefined
    })
    this.starting = starting
    return starting
  }

  async restart(): Promise<void> {
    this.stop()
    await this.start()
  }

  /**
   * Message de l'utilisateur : envoyé tout de suite si l'agent est prêt, sinon mis en file
   * d'attente pendant une réponse (envoyé à la fin du tour).
   */
  async send(
    text: string,
    attachments: PromptAttachment[] = [],
    options: PromptOptions = {}
  ): Promise<void> {
    // Un message en préparation compte comme une réponse (messages d'autres conversations).
    if (this.status !== 'busy' && !this.preparing) return this.prompt(text, attachments, options)
    if (options.context) throw new Error(t('agentHost.busy'))
    this.queue.add(text, attachments, options.from, options.askChildren)
    this.emitSnapshot()
  }

  /** Messages en attente retirés de cet hôte, pour le suivant (« Relancer », fiche 043). */
  takeQueued(): QueuedMessage[] {
    return this.queue.drain()
  }

  /** Messages en attente repris d'un hôte précédent ; ils partent à la demande de l'utilisateur. */
  restoreQueued(messages: readonly QueuedMessage[]): void {
    this.queue.restore(messages)
    this.emitSnapshot()
  }

  /** Retire un message de la file (pour le supprimer ou le modifier) et le rend. */
  unqueue(id: string): QueuedMessage {
    const message = this.queue.remove(id)
    this.emitSnapshot()
    return message
  }

  /**
   * Envoie la file sans attendre la fin du tour : le tour en cours est annulé, puis ce message part
   * en premier avec les autres.
   */
  async sendNow(id: string): Promise<void> {
    this.queue.promote(id)
    if (this.status !== 'busy') {
      this.flushQueue()
      return
    }
    this.sendNowPending = true
    this.emitSnapshot()
    await this.cancel()
  }

  /** Envoie un prompt texte. Se résout à la fin du tour ; les erreurs sont émises, pas levées. */
  async prompt(
    text: string,
    attachments: PromptAttachment[] = [],
    options: PromptOptions = {}
  ): Promise<void> {
    const { connection, sessionId } = this
    if (this.status !== 'ready' || !connection || !sessionId) {
      throw new Error(t('agentHost.notReady', { status: this.status }))
    }
    this.turnAuth.clear()
    const agentLabel = this.options.profile.label
    // Pièces jointes refusées (format non accepté, fichier absent…) : erreur avant tout envoi.
    // Pendant la préparation, un autre message attend dans la file (`send`, `flushQueue`).
    this.preparing = true
    let built: Awaited<ReturnType<typeof buildPrompt>>
    let session: string | undefined
    try {
      ;[built, , session] = await Promise.all([
        buildPrompt(text, attachments, this.promptCaps, agentLabel, this.options.contextText),
        // Relance avec fil gardé (fiche 121, D21) : le rejeu tardif ne doit pas croiser le tour.
        this.replay.waitCalm(this.timeout('replayWaitMs'), scopeText(this.logScope())),
        sessionContextOf(this.options, this.appToolNames, this.sessionContextDue)
      ])
    } finally {
      this.preparing = false
    }
    // Arrêté ou relancé pendant l'attente du rejeu : ce message n'est plus pour cette session.
    if (this.connection !== connection || this.status !== 'ready') {
      throw new Error(t('agentHost.notReady', { status: this.status }))
    }
    const { views } = built
    // Tout ce que l'app joint part après le message (fiche 125 : un agent titre sa session d'après
    // le début du premier message, Bob) ; le contexte de session, au premier message de la session
    // seulement (fiche 118), et après une compaction (fiche 182 : l'index a pu être résumé).
    const compaction = isCompactionRequest(text, this.compactCommand())
    this.sessionContextDue = compaction ? 'compacted' : undefined
    const blocks = withContext(built.blocks, [
      options.askChildren && CHILDREN_REQUEST,
      this.options.extraContext?.(),
      this.options.directories?.context(sessionId),
      options.from && originContext(options.from),
      options.context,
      session
    ])
    // D'abord « répond… », puis le message : l'UI ne voit jamais le message avec un agent « prêt ».
    this.replay.finish()
    this.ignoreReplay = false
    this.setStatus('busy')
    this.options.emit({
      type: 'user-message',
      text,
      ...(views.length > 0 ? { attachments: views } : {}),
      ...sessionChoices(this.snapshot().controls),
      at: Date.now(),
      ...(options.from ? { from: options.from } : {}),
      ...(compaction ? { compaction: true } : {})
    })
    await this.runTurn(connection, sessionId, blocks)
  }

  /**
   * Envoie le message du tour et attend la réponse. Rappelée par la reconnexion (fiche 142) avec
   * les mêmes blocs : le message est déjà dans le fil.
   */
  private async runTurn(
    connection: ClientConnection,
    sessionId: string,
    blocks: ContentBlock[]
  ): Promise<void> {
    this.retry.begin(blocks)
    this.turnLimit.turnStarted(sessionId, blocks)
    this.appTools.turnStarted()
    // La file part seule après un tour terminé normalement ; après un arrêt ou une erreur, elle
    // attend que l'utilisateur la renvoie. Une tentative prévue garde le tour en cours.
    let resumeQueue = false
    let retrying = false
    // Journal (fiche 080) : durée du tour, et un agent qui se tait pendant le tour.
    const turnStarted = Date.now()
    let stopReason = 'erreur'
    const silence = watchSilence({
      lastActivity: () => this.lastAgentActivity,
      waiting: () => this.requests.waiting(),
      scope: scopeText(this.logScope()),
      onSilent: (since) => this.setSilent(since)
    })
    try {
      const response = await connection.agent.request(methods.agent.session.prompt, {
        sessionId,
        prompt: blocks
      })
      stopReason = response.stopReason
      // Limite d'étapes (fiche 209) : la file attend l'utilisateur, comme après un arrêt ; elle
      // serait refusée de la même façon.
      resumeQueue = stopReason !== 'cancelled' && stopReason !== 'max_turn_requests'
      // Le modèle a répondu : plus « connexion à faire » (fiche 210).
      noteAnswered(this.options.refusedModels, buildControls(this.modes, this.configOptions))
      // La réponse et les `session/update` arrivent par des files distinctes du SDK : les derniers
      // morceaux déjà reçus passent avant la fin du tour (fil complet, notification exacte).
      await settleNotifications()
      const limit = this.turnLimit.ended(stopReason, this.support.load)
      this.options.emit({
        type: 'turn-end',
        at: Date.now(),
        stopReason: response.stopReason,
        ...(response.usage ? { usage: response.usage } : {}),
        ...(limit ? { limit } : {})
      })
      // Coût lu hors protocole : relu maintenant, puis un peu plus tard (fiche 157).
      this.cost.turnEnded()
    } catch (error) {
      // Comme à la fin d'un tour : les mises à jour reçues avant l'erreur passent avant elle, sinon
      // un outil annoncé juste avant resterait « en cours » après l'avis d'échec (fiche 139).
      await settleNotifications()
      retrying = this.turnFailed(connection, error, { sessionId, blocks })
    } finally {
      clearInterval(silence)
      this.setSilent(undefined)
      this.launched?.acpLog.flush()
      log.info(
        `Tour fini ${scopeText(this.logScope())} : ${stopReason} en ${formatDuration(Date.now() - turnStarted)}`
      )
      if (!retrying) this.afterTurn(connection, resumeQueue)
    }
  }

  /**
   * Échec d'un tour : avis dans le fil, sauf connexion coupée (la sortie de l'agent l'explique) ou
   * panne passagère (fiche 142), réessayée plus tard : `true`, le tour reste en cours.
   */
  private turnFailed(connection: ClientConnection, error: unknown, turn: BlockedTurn): boolean {
    // Connexion coupée : le processus est mort ou va l'être (`killIfConnectionLost`, fiche 195). Sa
    // sortie (statut `exited`, avec la fin de stderr) explique mieux qu'un « connection closed ».
    if (!connection.signal.aborted && this.connection === connection && this.is('busy')) {
      if (this.retry.failed(error) === 'waiting') {
        this.options.emit({ type: 'attempt-failed' })
        return true
      }
      // Connexion refusée au tour (D10) : carte de connexion, statut « action requise ».
      const controls = buildControls(this.modes, this.configOptions)
      const auth = turnAuthBlocker(error, (e) => this.blockerFor(e), this.options.profile, controls)
      if (auth) {
        this.blocker = this.turnAuth.block(auth, turn, this.appTools.toolCallsInTurn)
        if (auth.model) this.options.refusedModels?.add(auth.model.id)
        this.options.emit(authExpiredNotice(this.options.profile.label, auth.model))
        this.setStatus('needs-action')
        return false
      }
      this.options.emit({ type: 'turn-error', message: this.turnErrorMessage(error) })
    }
    return false
  }

  /**
   * Message d'un tour en échec. Licence refusée au tour (Bob 2.0.9 la demande par un formulaire
   * au premier message, fiche 163) : une explication plutôt que l'erreur brute.
   */
  private turnErrorMessage(error: unknown): string {
    const message = errorMessage(error)
    if (!this.options.profile.license?.pattern.test(message)) return message
    return t('agentHost.licenseAtPrompt', { name: this.options.profile.label })
  }

  /** Nouvelle tentative du tour (fiche 142) : l'agent répond de nouveau au même message. */
  private resendTurn(blocks: ContentBlock[]): void {
    const { connection, sessionId } = this
    const idle = this.is('ready') && !this.preparing
    if (!connection || !sessionId || !(this.is('busy') || idle)) return this.retry.clear()
    if (idle) this.setStatus('busy')
    void this.runTurn(connection, sessionId, blocks)
  }

  /** « Réessayer maintenant », ou « Réessayer » une fois les tentatives épuisées (fiche 142). */
  retryTurn(): void {
    this.retry.now()
  }

  /**
   * Après un tour fini, arrêté ou en échec : l'agent redevient prêt, puis partent la réponse
   * tardive et, si `resumeQueue` ou « Envoyer maintenant », la file d'attente.
   */
  private afterTurn(connection: ClientConnection, resumeQueue: boolean): void {
    this.stopWatch.clearCancel()
    // Tour fini, arrêté ou en échec : ses sous-agents aussi, et ses cartes en cours.
    this.subagents.settle()
    this.appTools.turnEnded()
    if (this.connection === connection && this.is('busy') && !connection.signal.aborted) {
      this.setStatus('ready')
    }
    const sendQueue = resumeQueue || this.sendNowPending
    this.sendNowPending = false
    this.flushLateAnswer()
    if (sendQueue) this.flushQueue()
  }

  /**
   * Envoie la file d'attente en un seul message (comme Claude Code), dans la limite des pièces
   * jointes d'un message ; le reste part au tour suivant.
   */
  private flushQueue(): void {
    if (!this.is('ready') || this.preparing) return
    const batch = this.queue.takeBatch()
    if (!batch) return
    const { from, askChildren } = batch
    const options = { ...(from ? { from } : {}), ...(askChildren ? { askChildren } : {}) }
    this.prompt(batch.text, batch.attachments, options).catch((error: unknown) => {
      // Rien n'est parti (pièce jointe refusée…) : les messages restent en attente.
      batch.restore()
      this.emitSnapshot()
      this.options.emit({ type: 'notice', level: 'error', message: errorMessage(error) })
    })
  }

  async cancel(): Promise<void> {
    const { connection, child, sessionId } = this
    if (this.status !== 'busy' || !connection || !sessionId) return
    // Une tentative attendait (fiche 142) : rien n'est en cours chez l'agent, le tour s'arrête là.
    if (this.retry.cancel()) {
      this.options.emit({ type: 'turn-end', stopReason: 'cancelled', at: Date.now() })
      return this.afterTurn(connection, false)
    }
    // ACP : en annulant un tour, le client répond `cancelled` à toutes les permissions en attente.
    this.cancelPermissions()
    // Agent figé qui ignore `session/cancel` : arrêté passé le délai de grâce (« Relancer » reprend).
    if (child) {
      this.stopWatch.armCancel(child, this.timeout('cancelGraceMs'), () => {
        return this.connection === connection && this.child === child && this.is('busy')
      })
    }
    await connection.agent.notify(methods.agent.session.cancel, { sessionId })
  }

  private timeout(name: keyof typeof TIMEOUTS): number {
    return this.options.timeouts?.[name] ?? TIMEOUTS[name]
  }

  /** Réponse de l'utilisateur à une demande de permission (`null` = annuler). */
  respondPermission(requestId: string, optionId: string | null): void {
    const choice = this.requests.permissionChoice(requestId, optionId)
    this.requests.respondPermission(requestId, optionId)
    // « Toujours autoriser » sur un outil sans effet sur les fichiers : retenu pour les prochaines
    // conversations (l'agent, lui, ne le garde que pour la tâche). Jamais une carte à risque.
    const title = choice && choice.risks.length === 0 && rememberableTool(choice.toolCall)
    if (title && choice.option?.kind === 'allow_always') this.options.rememberedTools?.add(title)
  }

  /** Réponse de l'utilisateur à un formulaire ou une page demandés par l'agent. */
  respondElicitation(requestId: string, answer: ElicitationAnswer): void {
    this.requests.respondElicitation(requestId, answer)
  }

  private cancelPermissions(): void {
    this.requests.cancelAll()
  }

  /** Arrête l'agent sans émettre d'erreur. */
  stop(): void {
    const { child, connection } = this
    this.launchToken = undefined
    this.child = undefined
    this.connection = undefined
    this.sessionId = undefined
    this.starting = undefined
    this.stopWatch.clearCancel()
    this.replay.clear()
    this.retry.clear()
    this.silentSince = undefined
    this.turnAuth.clear()
    this.cancelPermissions()
    this.toolEndpoint?.dispose()
    this.toolEndpoint = undefined
    this.appTools.clear()
    this.subagents.reset()
    this.updates.clear()
    connection?.close()
    if (child) killTree(child)
    if (this.status !== 'idle') this.setStatus('idle')
  }

  /**
   * Mise à jour d'un sous-agent : sous sa carte quand on la connaît ; sinon ses outils restent
   * visibles dans le fil (titrés « <tâche> : <outil> » par l'agent), et son texte, qui n'est pas
   * celui de la conversation, est écarté.
   */
  private routeChildUpdate(
    stream: SubagentStream,
    child: ChildSession,
    update: SessionUpdate
  ): void {
    const toolCallId = this.replaying ? undefined : this.subagents.cardFor(child)
    if (toolCallId) {
      this.options.emit({
        type: 'subagent-update',
        toolCallId,
        update: stream.forCard(update, child)
      })
      return
    }
    if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
      this.options.emit({ type: 'update', update })
    }
  }

  /**
   * Demande d'autorisation de l'agent : accordée d'office pour les outils de l'app qui n'agissent
   * que dans l'app et pour les outils « toujours autorisés » ; sinon posée à l'utilisateur.
   */
  private onPermissionRequest(
    params: RequestPermissionRequest,
    signal?: AbortSignal
  ): RequestPermissionResponse | Promise<RequestPermissionResponse> {
    // Outils de l'app qui n'agissent que dans l'app (question, panneau) : accordés sans demander.
    const allow = params.options.find((o) => o.kind === 'allow_once')
    if (allow && this.appTools.autoAllowed(params.toolCall)) {
      return { outcome: { outcome: 'selected', optionId: allow.optionId } }
    }
    // Écriture hors du dossier, droits d'administrateur… : dits sur la carte (fiche 211).
    const place = { workspace: this.options.workspace, home: homedir() }
    // Outil déjà « toujours autorisé » dans une conversation précédente (fiche 042), sauf risque.
    const remembered = rememberableTool(params.toolCall)
    if (
      remembered &&
      this.options.rememberedTools?.has(remembered) &&
      permissionRisks(params.toolCall, place).length === 0
    ) {
      const always = params.options.find((o) => o.kind === 'allow_always') ?? allow
      if (always) return { outcome: { outcome: 'selected', optionId: always.optionId } }
    }
    const toolCall = this.updates.permission(params.toolCall)
    const risks = permissionRisks(toolCall, place)
    return this.requests.permission({ ...params, toolCall }, risks, signal)
  }

  /** Formulaire ou page demandés par l'agent (`elicitation/create`), traduits pour l'interface. */
  private onElicitation(
    params: CreateElicitationRequest
  ): CreateElicitationResponse | Promise<CreateElicitationResponse> {
    const prompt = elicitationPrompt(params)
    if (!prompt) {
      this.options.emit({
        type: 'notice',
        level: 'warning',
        message: {
          key: 'agentHost.notice.elicitationUnsupported',
          params: { message: params.message }
        }
      })
      return { action: 'decline' }
    }
    return this.requests.elicitation(prompt)
  }

  /**
   * Mise à jour de session de l'agent : notée pour les outils de l'app, puis triée
   * (`routeUpdate`) — commandes, sous-agent, mode et options, fil.
   */
  private onSessionUpdate(notification: SessionNotification): void {
    // Diffs, échecs et sous-agents que l'agent décrit à sa façon, avant le reste.
    const update = this.updates.adapt(notification.update, !this.replaying)
    const params = { ...notification, update }
    if (params.sessionId === this.sessionId) {
      this.appTools.noteUpdate(update)
      if (this.is('busy') && !this.replaying) this.turnLimit.note(update)
    }
    const route = routeUpdate(params, {
      sessionId: this.sessionId,
      busy: this.is('busy'),
      replaying: this.replaying,
      ignoreReplay: this.ignoreReplay,
      subagentStream: this.options.profile.subagentStream
    })
    switch (route.kind) {
      case 'drop':
        return
      case 'replayed':
        this.replay.note(update)
        return
      case 'commands':
        this.commands = route.commands
        this.emitSnapshot()
        return
      case 'subagent':
        this.routeChildUpdate(route.stream, route.child, update)
        return
      case 'thread':
        if (route.mode !== undefined && this.modes) {
          this.modes = { ...this.modes, currentModeId: route.mode }
          this.emitSnapshot()
        } else if (route.configOptions) {
          this.configOptions = route.configOptions
          this.emitSnapshot()
        }
        this.options.emit({ type: 'update', update })
        // Compaction faite par l'agent (fiche 182) : le contexte de session repart au message suivant.
        if (update.sessionUpdate === 'compaction_update') this.sessionContextDue = 'compacted'
        if (route.trackSubagents) this.subagents.note(update)
        // Coût hors protocole relu à la fin d'un outil : le plafond le voit pendant le tour.
        this.cost.noteUpdate(update)
    }
  }

  private async doStart(): Promise<void> {
    const { profile, workspace } = this.options
    this.launched = undefined
    this.modes = undefined
    this.configOptions = undefined
    this.commands = []
    this.cost.reset()
    this.stopWatch.reset()
    this.ignoreReplay = false
    this.replay.clear()
    this.setStatus('starting')

    if (!isDirectory(workspace)) {
      this.setStatus('error', t('agentHost.workspaceMissing', { folder: workspace }))
      return
    }
    // Clés d'API déchiffrées (trousseau, asynchrone) : un arrêt pendant ce temps annule le lancement.
    const token = {}
    this.launchToken = token
    const credentials = (await this.options.credentials?.()) ?? {}
    if (this.launchToken !== token) return
    const launched = launchAgent({
      profile,
      cwd: workspace,
      extraArgs: this.extraArgs,
      credentials,
      scope: this.logScope(),
      label: scopeText(this.logScope()),
      onActivity: () => {
        this.lastAgentActivity = Date.now()
        if (this.silentSince !== undefined) this.setSilent(undefined)
      }
    })
    const { child, failed } = launched
    this.child = child
    this.launched = launched
    this.lastAgentActivity = launched.startedAt

    child.on('exit', (code, signal) => this.onAgentExit(child, code, signal))
    const connection = this.connect(launched)
    this.connection = connection
    this.stopWatch.watchConnection(connection.signal, child, () => this.child === child)

    this.failed = failed
    try {
      const init = await this.initializeRequest(connection, failed)
      this.readAnnouncement(init)
      if (
        this.options.newSession === 'if-deletable' &&
        !this.options.reopen &&
        !this.support.delete
      ) {
        this.setStatus('ready')
        return
      }
      await this.openSession(connection, child, failed)
    } catch (error) {
      if (this.child !== child) return // Arrêté pendant le démarrage.
      this.abandon(connection, child)
      this.setStatus('error', `${errorMessage(error)}${this.stderrHint(error)}`)
    }
  }

  /** Sortie du processus de l'agent : une panne, sauf s'il a été arrêté ou abandonné par l'app. */
  private onAgentExit(
    child: ChildProcessWithoutNullStreams,
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
    if (this.child !== child) return // Arrêt volontaire.
    // Sortie inattendue : ce que l'agent avait lancé (commande en cours) reste dans son groupe.
    killTree(child)
    this.child = undefined
    this.cancelPermissions()
    this.connection?.close()
    this.connection = undefined
    this.sessionId = undefined
    this.stopWatch.clearCancel()
    this.retry.clear()
    this.silentSince = undefined
    this.setStatus('exited', this.stopWatch.exitReason(code, signal, this.stderrHint()))
  }

  /** Connexion ACP sur les flux de l'agent, avec les gestionnaires de ses demandes. */
  private connect(launched: AgentProcess): ClientConnection {
    return (
      client({ name: 'bobine' })
        // `signal` : l'agent peut retirer sa demande (`$/cancel_request`, fiche 214).
        .onRequest(methods.client.session.requestPermission, ({ params, signal }) =>
          this.onPermissionRequest(params, signal)
        )
        .onRequest(methods.client.elicitation.create, ({ params }) => this.onElicitation(params))
        // Fin d'une élicitation par URL : rien à faire de plus côté app.
        .onNotification(methods.client.elicitation.complete, () => {})
        .onNotification(methods.client.session.update, ({ params }) => this.onSessionUpdate(params))
        .connect(ndJsonStream(launched.toAgent, launched.fromAgent))
    )
  }

  /** `initialize`, avec ce que l'app sait faire ; rend la réponse attendue, sans l'attendre. */
  private initializeRequest(
    connection: ClientConnection,
    failed: Promise<never>
  ): Promise<InitializeResponse> {
    return race(
      failed,
      this.timeout('initializeMs'),
      t('agentHost.timeout.initialize'),
      connection.agent.request(
        methods.agent.initialize,
        initializeParams(this.options.clientVersion)
      )
    )
  }

  /** Ce que l'agent annonce à `initialize` : nom, capacités, outils de l'app, connexions. */
  private readAnnouncement(init: InitializeResponse): void {
    // Protocole ou version refusés (fiche 198) : expliqué, avant toute annonce (pas d'avis).
    refuseIncompatible(this.options.profile, init, scopeText(this.logScope()))
    this.options.onAnnounced?.(announcementOf(init, new Date().toISOString()))
    const caps = init.agentCapabilities
    this.toolEndpoint?.dispose()
    const appTools = this.appTools.sessionTools()
    this.toolEndpoint =
      caps?.mcpCapabilities?.http === true
        ? this.options.toolServer?.register(appTools, this.logScope())
        : undefined
    this.promptCaps = promptCapabilitiesOf(init)
    this.support = sessionSupportOf(init)
    this.authMethods = authMethodsOf(init)
  }

  /**
   * Ouvre (ou rouvre) la session. Un refus « connexion requise » ou « dossier non approuvé » met la
   * conversation en attente d'une action (`needs-action`) sans arrêter l'agent ; les autres erreurs
   * remontent à l'appelant.
   */
  private async openSession(
    connection: ClientConnection,
    child: ChildProcessWithoutNullStreams,
    failed: Promise<never>
  ): Promise<void> {
    // Renvoi d'un message refusé (D10) : sa session, pour cette ouverture seulement.
    const reopen = this.turnAuth.reopen() ?? this.options.reopen
    // Agent qui ne sait pas reprendre, ou limite d'étapes de la session (fiche 209) : session
    // neuve dans la même conversation (ADR-0030).
    const limitRenewal = this.turnLimit.takeRenewal()
    const renew = reopen && (limitRenewal || (!this.support.load && !this.support.resume))
    const reopening = renew ? undefined : reopen

    // Les réponses sont attendues ici même : le rejeu se termine (`finally`) dès qu'elles arrivent.
    let session: OpenedSession | undefined
    try {
      if (reopening) {
        const reopened = await this.reopenRequest(connection, failed, reopening)
        // La réponse peut être vide (le SDK la type `void` possible).
        session = { sessionId: reopening.sessionId, ...(reopened ?? {}) }
      } else {
        session = await this.newSessionRequest(connection, failed, true)
      }
    } catch (error) {
      if (this.child !== child) return
      this.sessionId = undefined
      // Pas de session rouverte : aucun rejeu à attendre avant le prochain message (fiche 121).
      this.replay.clear()
      const blocker = this.blockerFor(error)
      if (blocker) {
        this.blocker = blocker
        this.setStatus('needs-action')
        return
      }
      if (!reopening) throw error
      session = await this.recoverLostSession(connection, child, failed, reopening, error)
    } finally {
      this.replaying = false
      // Fil gardé : le rejeu (tardif chez Bob) est réconcilié une fois calme (fiche 103).
      if (reopening?.keepTranscript) this.replay.loaded()
    }
    if (session && renew) this.renewed(limitRenewal ? 'turn-limit' : 'no-resume')
    if (session) await this.applySession(connection, child, failed, session, reopen)
  }

  /**
   * `session/new` dans le dossier de travail, avec les outils de l'app ; `withMode` : mode de
   * départ dans `_meta` si le profil le permet (fiche 163).
   */
  private newSessionRequest(
    connection: ClientConnection,
    failed: Promise<never>,
    withMode = false
  ): Promise<OpenedSession> {
    const open = (meta?: Record<string, string>) =>
      race(
        failed,
        this.timeout('sessionMs'),
        t('agentHost.timeout.session'),
        connection.agent.request(methods.agent.session.new, {
          cwd: this.options.workspace,
          ...this.options.directories?.param(this.support.additionalDirectories),
          mcpServers: this.mcpServers(),
          ...(meta ? { _meta: meta } : {})
        })
      )
    const wanted = withMode ? this.options.initialMode : undefined
    return openWithStartMode(open, this.options.profile.initialModeMeta, wanted)
  }

  /**
   * Rouvre une session de l'agent : `session/load`, dont le rejeu refait le fil (ou est ignoré si
   * le fil de l'app est gardé), sinon `session/resume`. Rend la réponse attendue (parfois vide), sans l'attendre.
   */
  private reopenRequest(connection: ClientConnection, failed: Promise<never>, reopen: Reopen) {
    // L'identifiant doit être connu avant le rejeu, qui arrive en notifications.
    this.sessionId = reopen.sessionId
    const request = {
      sessionId: reopen.sessionId,
      cwd: this.options.workspace,
      ...this.options.directories?.param(this.support.additionalDirectories),
      mcpServers: this.mcpServers()
    }
    // Fil de l'app gardé (fiche 103) : `session/load` quand même si l'agent sait rejouer, son
    // rejeu (sans appel au modèle) sert à retrouver ce qui a pu se passer ailleurs ; sinon
    // `session/resume`. Sans fil gardé, le rejeu refait le fil.
    if (this.support.load) {
      if (reopen.keepTranscript) {
        this.ignoreReplay = true
        this.replay.expect()
      } else this.options.emit({ type: 'reset' })
      this.replaying = true
    }
    const call = this.support.load
      ? connection.agent.request(methods.agent.session.load, request)
      : connection.agent.request(methods.agent.session.resume, request)
    return race(failed, this.timeout('sessionMs'), t('agentHost.timeout.resume'), call)
  }

  /**
   * « Relancer » : l'agent a perdu la session (plantage avant qu'il ne l'enregistre…). Le fil de
   * l'app est gardé et une nouvelle session continue la conversation, avec l'échange d'avant au
   * prochain message (ADR-0030) ; sinon, lecture seule.
   * Rend la nouvelle session, ou `undefined` s'il n'y a plus rien à ouvrir.
   */
  private async recoverLostSession(
    connection: ClientConnection,
    child: ChildProcessWithoutNullStreams,
    failed: Promise<never>,
    reopen: Reopen,
    error: unknown
  ): Promise<OpenedSession | undefined> {
    const fresh = reopen.keepTranscript
      ? await this.newSessionRequest(connection, failed).catch(() => undefined)
      : undefined
    if (this.child !== child) return undefined
    if (!fresh) {
      this.abandon(connection, child)
      this.setStatus('read-only', t('agentHost.resumeFailed', { error: errorMessage(error) }))
      return undefined
    }
    log.warn(`Session ${reopen.sessionId} perdue, nouvelle session :`, errorMessage(error))
    this.renewed('session-lost')
    return fresh
  }

  /**
   * La conversation continue dans une session neuve du même agent (ADR-0030) : repère dans le fil,
   * d'où se déduit l'échange d'avant joint au prochain message, comme après une bascule (fiche 108).
   */
  private renewed(reason: NonNullable<Handover['reason']>): void {
    const agent = { profileId: this.options.profile.id, label: this.options.profile.label }
    this.options.emit({ type: 'handover', handover: { from: agent, to: agent, reason } })
  }

  /** D'où viennent les lignes du journal : la conversation et l'agent. */
  private logScope(): LogScope {
    return hostScope(this.options.conversationId, this.options.profile.id)
  }

  /** Session ouverte : son état et ses réglages de départ, puis prête (sauf arrêt entre-temps). */
  private async applySession(
    connection: ClientConnection,
    child: ChildProcessWithoutNullStreams,
    failed: Promise<never>,
    session: OpenedSession,
    reopen: Reopen | undefined
  ): Promise<void> {
    if (this.child !== child) return // Arrêté pendant l'ouverture.
    this.blocker = undefined
    this.sessionId = session.sessionId
    // Session rouverte (même identifiant) : son historique a déjà le contexte complet (fiche 223).
    this.sessionContextDue = session.sessionId === reopen?.sessionId ? 'resumed' : 'opened'
    this.cost.report()
    this.modes = session.modes ?? undefined
    this.configOptions = session.configOptions ?? undefined
    await applyInitialSettings({
      controls: () => this.snapshot().controls,
      apply: (id, value) => this.applyControl(connection, session.sessionId, id, value),
      failed,
      emit: this.options.emit,
      initialControls: this.options.initialControls,
      initialMode: reopen ? undefined : this.options.initialMode
    })
    if (this.child !== child) return
    const resend = this.turnAuth.opened()
    if (resend) return this.resendBlocked(connection, session.sessionId, resend)
    this.setStatus('ready')
  }

  /**
   * Message refusé faute de connexion (D10), renvoyé une fois la session rouverte, sans passer par
   * « prêt » (rien d'autre ne peut partir entre-temps). Session neuve (ADR-0030) : l'échange d'avant
   * et le contexte de session le suivent ; sinon, il les avait déjà.
   */
  private async resendBlocked(
    connection: ClientConnection,
    sessionId: string,
    turn: BlockedTurn
  ): Promise<void> {
    await this.replay.waitCalm(this.timeout('replayWaitMs'), scopeText(this.logScope()))
    if (this.connection !== connection || this.sessionId !== sessionId) return
    this.replay.finish()
    this.ignoreReplay = false
    const fresh = sessionId !== turn.sessionId ? ('opened' as const) : undefined
    const session = await sessionContextOf(this.options, this.appToolNames, fresh)
    if (this.connection !== connection || this.sessionId !== sessionId) return
    const contexts = fresh ? [this.options.extraContext?.(), session] : []
    this.sessionContextDue = undefined
    this.options.emit({ type: 'resent', ...(fresh ? { fresh: true as const } : {}) })
    this.setStatus('busy')
    void this.runTurn(connection, sessionId, withContext(turn.blocks, contexts))
  }

  /** Refus de session qui appelle une action de l'utilisateur, ou `undefined`. */
  private blockerFor(error: unknown): AgentBlocker | undefined {
    return sessionBlocker(error, {
      profile: this.options.profile,
      authMethods: this.authMethods,
      apiKey: this.options.apiKeyInfo?.(),
      step: (id) => this.step(id),
      extraArgs: this.extraArgs.length > 0
    })
  }

  /** Commande du profil proposée dans le terminal de l'app (connexion, licence). */
  step(id: string): TerminalStep | undefined {
    const step = this.options.profile.terminalSteps?.[id]
    return step ? { id, ...step } : undefined
  }

  /** Lance la connexion proposée par l'agent (ex. SSO de Bob), puis réessaie d'ouvrir la session. */
  async authenticate(methodId: string): Promise<void> {
    const { connection, child, failed, blocker } = this
    if (
      this.status !== 'needs-action' ||
      blocker?.kind !== 'auth' ||
      !connection ||
      !child ||
      !failed
    ) {
      throw new Error(t('agentHost.auth.none'))
    }
    const method = blocker.methods.find((m) => m.id === methodId)
    if (!method) throw new Error(t('agentHost.auth.unknownMethod', { method: methodId }))
    // Connexion dans un terminal : jamais par `authenticate` (elle n'y ferait rien).
    if (method.step) throw new Error(t('agentHost.auth.inTerminal'))
    if (blocker.authenticating) return
    this.blocker = { ...blocker, authenticating: true, error: undefined }
    this.emitSnapshot()
    try {
      // Pas de délai : l'utilisateur peut prendre son temps dans le navigateur.
      await Promise.race([
        connection.agent.request(methods.agent.authenticate, { methodId }),
        failed
      ])
    } catch (error) {
      if (this.connection !== connection) return
      this.blocker = { ...blocker, authenticating: false, error: errorMessage(error) }
      this.emitSnapshot()
      return
    }
    // Refusé au tour (D10) : la même session est rouverte, et le message renvoyé.
    this.options.refusedModels?.clear()
    this.turnAuth.expect(this.turnAuth.take(blocker))
    await this.reopenAfterAction(connection, child, failed)
  }

  /**
   * Réessaie d'ouvrir la session (ex. après avoir approuvé le dossier dans Bob). Après une connexion
   * ou une licence acceptée dans un terminal, l'agent est relancé : il relit ses identifiants et sa
   * licence au démarrage.
   */
  async retrySession(): Promise<void> {
    const { connection, child, failed } = this
    if (this.status !== 'needs-action' || !connection || !child || !failed) {
      throw new Error(t('agentHost.noBlocker'))
    }
    if (this.blocker?.kind === 'auth' || this.blocker?.kind === 'license') {
      // Refusé au tour (D10) : la même session, rouverte, reçoit de nouveau le message, une fois.
      // Reconnecté peut-être : plus aucun modèle « connexion à faire » (refusé de nouveau, remarqué).
      if (this.blocker.kind === 'auth') this.options.refusedModels?.clear()
      return this.restartWith(this.turnAuth.take(this.blocker))
    }
    await this.reopenAfterAction(connection, child, failed)
  }

  /**
   * Limite d'étapes de la session (fiche 209) : l'agent est relancé, puis le message refusé renvoyé
   * une fois (comme D10), dans la même session rechargée (`reopen` : `session/load` reconstruit sa
   * tâche chez Bob 2.0.9) ou dans une session neuve avec l'échange d'avant (`renew`, ADR-0030).
   */
  async afterTurnLimit(answer: 'reopen' | 'renew'): Promise<void> {
    // Un message en préparation compte comme une réponse : rien n'est relancé sous lui.
    const { sessionId, support } = this
    const status = this.preparing ? 'busy' : this.status
    await this.restartWith(this.turnLimit.prepare(answer, { status, sessionId, support }))
  }

  /** Relance l'agent ; le message est renvoyé une fois la session ouverte (D10). */
  private async restartWith(turn: BlockedTurn | undefined): Promise<void> {
    this.stop()
    this.turnAuth.expect(turn)
    await this.start()
  }

  /**
   * Relance l'agent avec son flag de confiance (`--trust` pour Bob), pour cette session seulement.
   * Jamais par défaut ni mémorisé : la doc de Bob le réserve aux dossiers jetables.
   */
  async trustForSession(): Promise<void> {
    const flag = this.options.profile.trust?.flag
    if (this.blocker?.kind !== 'trust' || !flag) {
      throw new Error(t('agentHost.noSessionTrust'))
    }
    this.extraArgs = [flag]
    await this.restart()
  }

  private reopenAfterAction(
    connection: ClientConnection,
    child: ChildProcessWithoutNullStreams,
    failed: Promise<never>
  ): Promise<void> {
    // Suivie avant d'annoncer « démarrage » : un `start()` en réponse à ce statut l'attend.
    const reopening = this.tracked(
      this.openSession(connection, child, failed).catch((error: unknown) => {
        if (this.child !== child) return
        this.abandon(connection, child)
        this.setStatus('error', `${errorMessage(error)}${this.stderrHint()}`)
      })
    )
    this.setStatus('starting')
    return reopening
  }

  /**
   * Abandonne l'agent courant (échec du démarrage, lecture seule) : il n'est plus l'agent de cet
   * hôte avant d'être arrêté, et sa sortie n'est donc pas signalée comme une panne.
   */
  private abandon(connection: ClientConnection, child: ChildProcessWithoutNullStreams): void {
    this.child = undefined
    this.connection = undefined
    connection.close()
    killTree(child)
  }

  /** Lecture non rétrécie par TypeScript : le statut change pendant les `await`. */
  private is(status: AgentStatus): boolean {
    return this.status === status
  }

  /** Fin de la sortie d'erreur de l'agent ; rien après un refus déjà expliqué (fiche 198). */
  private stderrHint(error?: unknown): string {
    return error instanceof AgentIncompatible ? '' : (this.launched?.stderrHint() ?? '')
  }

  /** Serveurs MCP fournis à l'agent : les outils de l'app, si l'agent accepte le HTTP. */
  private mcpServers(): McpServer[] {
    const endpoint = this.toolEndpoint
    return endpoint
      ? [{ type: 'http', name: APP_TOOLS_SERVER_NAME, url: endpoint.url, headers: [] }]
      : []
  }

  private flushLateAnswer(): void {
    if (!this.is('ready') || this.preparing) return
    const next = this.lateAnswers.shift()
    if (!next) return
    this.prompt(next).catch((error: unknown) => {
      this.options.emit({ type: 'notice', level: 'error', message: errorMessage(error) })
    })
  }

  private emitSnapshot(): void {
    this.options.emit({ type: 'status', snapshot: this.snapshot() })
  }

  private setStatus(status: AgentStatus, detail?: string): void {
    this.status = status
    this.detail = detail
    this.options.emit({ type: 'status', snapshot: this.snapshot() })
  }
}

export type { SessionSupport } from './announced'
