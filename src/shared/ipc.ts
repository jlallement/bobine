/**
 * Contrat IPC entre le renderer et le main process.
 * Toute nouvelle capacité exposée au renderer s'ajoute ici, et nulle part ailleurs.
 * Les actions sur un agent désignent toujours leur conversation (`id`).
 */
import type { AppAlert, AppAlertKind } from './app-alerts'
import type { TipAction, TipId, TipsView } from './tips'
import type { HelpTarget, HelpTopic } from './help-topics'
import type { ScheduledTask, ScheduledTaskInput } from './schedule'
import type { FreshStartInfo, ResetPlan } from './fresh-start'
import type { InstallOffer, InstallScope } from './install'
import type {
  ExcludedPaths,
  ImageAttachment,
  PromptAttachment,
  ScreenCaptureResult,
  WorkspaceFile
} from './attachments'
import type {
  BrowserBounds,
  BrowserCommand,
  BrowserDownload,
  BrowserGo,
  BrowserState,
  BrowserZoom
} from './browser'
import type { DevServersChange, DevServerView } from './launch'
import type { PageFreeze, PageLayerEvent, PageLayerTheme, PagePin } from './page-notes'
import type { SimulatorState } from './simulator'
import type { AndroidState } from './android'
import type { CommandLineStatus, LaunchPrefill } from './command-line'
import type { TerminalsChange, TerminalTabInfo } from './terminal'
import type { AttentionDetails, AttentionState, NotificationStatus } from './attention'
import type { ChildCapacity, ChildLaunchState } from './children'
import type { ChildrenMerge, ChildrenMergePlan } from './children-merge'
import type { CustomAgentDraft } from './custom-agents'
import type { ConversationCap } from './cost-cap'
import type { HandoverTarget } from './handover'
import { MEMORY_CHANNELS, type MemoryIpcContract } from './memory-ipc'
import type { GitChanges, GitFileDiff, RevertOutcome } from './changes'
import type { FileLinkOutcome, FileOpenOutcome, MarkdownDocument } from './file-links'
import type { EditorInfo, EditorOpenOutcome } from './editors'
import type { DraggedImage } from './images'
import type { GitStatus } from './git'
import type {
  CommitOutcome,
  MergeOutcome,
  OrphanWorktree,
  PrOutcome,
  RemoteBranchOutcome,
  WorktreeCycleView
} from './worktree-cycle'
import type { PrOptions, PrTrack } from './pr-tracking'
import type { UserCommand } from './user-commands'
import type { ExportFormat } from './export'
import type { Preferences } from './preferences'
import type { ContentHit } from './conversation-search'
import type { TranscriptItem } from './transcript'
import type { RuleFileView } from './rules'
import type { AgentQuota } from './usage'
import type {
  AgentSpendView,
  UsageExportKind,
  UsageHeatmap,
  UsageHeatQuery,
  UsageQuery,
  UsageStats
} from './usage-stats'
import type { MenuCommand } from './shortcuts'
import type { Language } from './i18n/language'
import type { LogStatus, Verbosity } from './log-level'
import type { AcpExchangesBatch, AcpExchangesSnapshot } from './acp-exchanges'
import type {
  AppToolFamily,
  ConversationAppTools,
  McpAgentView,
  McpScope,
  McpServer,
  McpTestResult
} from './mcp'
import type { DiagnosticGroup } from './diagnostics'
import type {
  ModelProvider,
  NetworkSettings,
  NetworkView,
  ProvidersView,
  ProviderTestResult
} from './providers'
import type { AsideRequest, AsideView } from './aside'
import type { AgentReadiness, CheckRequest, FolderHints, OnboardingState } from './onboarding'
import type { QuickEntryInfo } from './quick-entry'
import type { ProfileStatus } from './profile'
import { PROFILE_CHANNELS, type ProfileIpcContract } from './profile-ipc'
import { APPROVAL_RULES_CHANNELS, type ApprovalRulesIpcContract } from './approval-rules-ipc'
import type {
  AgentConfigureRequest,
  AgentSessionView,
  AgentSettingsView,
  BranchPreview,
  NewConversationDefaults,
  ControlValue,
  ConversationEvent,
  CostCapAnswer,
  ElicitationAnswer,
  ConversationsState,
  ConversationSummary,
  ConversationView,
  QueuedMessage,
  PromptRequest,
  WorktreeStatusView
} from './agent'

/** Erreur survenue dans l'interface (renderer), pour le journal. */
export interface UiErrorReport {
  /** `error`, `unhandledrejection`, `react`. */
  source: string
  message: string
  stack?: string
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  platform: string
  /** Jour du build, `AAAA-MM-JJ` (fiche 116) ; en développement, le jour du lancement. */
  buildDate: string
  /** Commit court du build (`dev` en développement) : copié, jamais affiché (fiche 116). */
  commit: string
  /**
   * Langue des fenêtres de macOS et de Chromium pour ce lancement (fiche 074) ; absente quand
   * l'app ne la règle pas (développement).
   */
  nativeLanguage?: Language
  /** Profil temporaire, `--reinitialiser` (fiche 148). */
  freshStart?: FreshStartInfo
}

/** Polices installées sur le Mac (fiche 136) : toutes les familles, et celles à chasse fixe. */
export interface InstalledFonts {
  families: string[]
  monospace: string[]
}

/** Canaux "invoke" : le renderer demande, le main répond. */
export interface IpcInvokeContract
  extends MemoryIpcContract, ProfileIpcContract, ApprovalRulesIpcContract {
  'app:getInfo': { args: []; result: AppInfo }
  /** Polices installées (fiche 136), lues une fois par le main. */
  'app:fonts': { args: []; result: InstalledFonts }
  /** Mode présentation actif (fiche 159) ; jamais enregistré. */
  'app:presentation': { args: []; result: boolean }
  'app:setPresentation': { args: [active: boolean]; result: undefined }
  /** Fenêtre À propos (fiche 116) : bloc d'infos techniques à copier (anglais, non traduit). */
  'about:technicalInfo': { args: []; result: string }
  /** Ferme la fenêtre À propos (Échap). */
  'about:close': { args: []; result: undefined }
  /** Ferme la fenêtre À propos et ouvre Réglages › À propos dans la fenêtre principale. */
  'about:showChangelog': { args: []; result: undefined }
  /** Ouvre (ou ramène) la fenêtre d'aide à un sujet, l'accueil avec `null` (fiche 186). */
  'help:open': { args: [topic: HelpTopic | null]; result: undefined }
  /** Première page de la fenêtre d'aide qui vient de se charger ; `search` : curseur dans la recherche. */
  'help:target': { args: []; result: { target: HelpTarget; search: boolean } }
  /** Lien « Nouveautés » de l'aide : Réglages › Nouveautés dans la fenêtre principale. */
  'help:showChangelog': { args: []; result: undefined }
  /** Tableau de consommation (fiche 137) : statistiques d'une période et d'un agent. */
  'usage:stats': { args: [query: UsageQuery]; result: UsageStats }
  /** Grille d'activité de « Mon activité » (fiche 144). */
  'usage:heatmap': { args: [query: UsageHeatQuery]; result: UsageHeatmap }
  /** Export CSV par « Enregistrer sous » : chemin écrit, ou `null` si annulé. */
  'usage:export': { args: [query: UsageQuery, kind: UsageExportKind]; result: string | null }
  /** « Remettre à zéro » : vide le journal de consommation (le quota des agents n'est pas touché). */
  'usage:reset': { args: []; result: undefined }
  /** Dépense récente sur ce Mac des agents dont le profil sait la lire (Bob : sa base). */
  'usage:spends': { args: []; result: AgentSpendView[] }
  /** Le journal a-t-il au moins un tour ? État vide de « Mon activité » (fiche 185, F9). */
  'usage:hasAny': { args: []; result: boolean }
  /** Derniers quotas lus (fiche 091). */
  'usage:quotas': { args: []; result: AgentQuota[] }
  /** Relit le quota d'un agent (ou de tous), puis rend les derniers quotas lus. */
  'usage:refreshQuota': { args: [profileId?: string]; result: AgentQuota[] }
  /** Tâches planifiées (fiche 178). */
  'schedule:list': { args: []; result: ScheduledTask[] }
  /** Crée (`id` nul) ou modifie une tâche ; rend la liste à jour. */
  'schedule:save': { args: [id: string | null, task: ScheduledTaskInput]; result: ScheduledTask[] }
  'schedule:setPaused': { args: [id: string, paused: boolean]; result: ScheduledTask[] }
  /** « Lancer maintenant » : refusé si une exécution de la tâche tourne encore. */
  'schedule:runNow': { args: [id: string]; result: ScheduledTask[] }
  'schedule:remove': { args: [id: string]; result: ScheduledTask[] }
  /** Serveurs MCP des agents (fiche 025), pour le dossier de la conversation affichée. */
  'mcp:list': { args: []; result: McpAgentView[] }
  'mcp:save': {
    args: [profileId: string, scope: McpScope, server: McpServer, previousName?: string]
    result: McpAgentView[]
  }
  'mcp:remove': { args: [profileId: string, scope: McpScope, name: string]; result: McpAgentView[] }
  'mcp:setEnabled': {
    args: [profileId: string, scope: McpScope, name: string, enabled: boolean]
    result: McpAgentView[]
  }
  /** « Tester » un serveur (fiche 060) : connexion, outils proposés, ou l'erreur. */
  'mcp:test': { args: [profileId: string, scope: McpScope, name: string]; result: McpTestResult }
  /** Outils de Bobine, par famille (fiche 099), avec leur poids et leur état (fiche 109). */
  'mcp:appTools': { args: []; result: AppToolFamily[] }
  /** Coupe ou rallume une famille d'outils de Bobine (fiche 109) ; rend les familles. */
  'mcp:setAppToolFamily': { args: [id: string, enabled: boolean]; result: AppToolFamily[] }
  /** Fournisseurs de modèles des agents (fiche 104), dans leur fichier global. */
  'providers:list': { args: []; result: ProvidersView[] }
  'providers:save': {
    args: [profileId: string, provider: ModelProvider, previousId?: string]
    result: ProvidersView[]
  }
  'providers:remove': { args: [profileId: string, id: string]; result: ProvidersView[] }
  'providers:setEnabled': {
    args: [profileId: string, id: string, enabled: boolean]
    result: ProvidersView[]
  }
  /** « Seulement ces fournisseurs » (`enabled_providers`). */
  'providers:setOnly': { args: [profileId: string, only: boolean]; result: ProvidersView[] }
  /** Clé du fournisseur, chiffrée dans le trousseau ; jamais renvoyée. */
  'providers:setKey': {
    args: [profileId: string, id: string, value: string]
    result: ProvidersView[]
  }
  'providers:removeKey': { args: [profileId: string, id: string]; result: ProvidersView[] }
  /** « Tester » : `GET /models` avec la clé, proxy et certificats des agents. */
  'providers:test': { args: [profileId: string, id: string]; result: ProviderTestResult }
  /** Groupe du Diagnostic : une ligne par fournisseur activé des agents installés. */
  'providers:diagnose': { args: []; result: DiagnosticGroup }
  /** Réseau d'entreprise (fiche 104) : proxy et certificats saisis, et ceux du shell. */
  'settings:network': { args: []; result: NetworkView }
  'settings:setNetwork': { args: [change: NetworkSettings]; result: NetworkView }
  /** Diagnostic (fiche 061) : l'app, son environnement, les simulateurs. */
  'diagnostics:system': { args: []; result: DiagnosticGroup[] }
  /** Journal (fiche 080) : niveau, taille des fichiers. */
  'log:status': { args: []; result: LogStatus }
  /** Change le niveau du journal, tout de suite ; Trace n'est pas enregistré. */
  'log:setLevel': { args: [level: Verbosity]; result: LogStatus }
  /** Ouvre `main.log` ou `agents.log` dans l'app par défaut (Console). */
  'log:open': { args: [file: 'main' | 'agents']; result: undefined }
  /** Onglet « Échanges ACP » ouvert (fiche 135) : messages gardés, puis lots `acp:messages`. */
  'acp:watch': { args: [id: string]; result: AcpExchangesSnapshot }
  'acp:unwatch': { args: [id: string]; result: undefined }
  /** Montre `main.log` ou `agents.log` dans le Finder (fiche 133). */
  'log:reveal': { args: [file: 'main' | 'agents']; result: undefined }
  /**
   * Diagnostic d'un agent : démarré hors conversation, session d'essai dans le dossier courant
   * (`trySession` : même s'il ne sait pas la supprimer ensuite).
   */
  'diagnostics:agent': { args: [profileId: string, trySession: boolean]; result: DiagnosticGroup }
  /** Fenêtre rapide (fiche 062) : où partira le message (réglages « Nouvelle conversation »). */
  'quick:info': { args: []; result: QuickEntryInfo }
  /** Envoie le message dans une nouvelle conversation et ouvre la fenêtre principale dessus. */
  'quick:send': { args: [text: string, attachments: PromptAttachment[]]; result: undefined }
  'quick:hide': { args: []; result: undefined }
  /** Hauteur voulue par le contenu de la fenêtre rapide. */
  'quick:resize': { args: [height: number]; result: undefined }
  /** Fait entendre un son du système (réglage du son d'attente, fiche 068). */
  'sound:preview': { args: [sound: string]; result: undefined }
  /**
   * Capture d'une zone de l'écran (fiche 062) ; `null` si l'utilisateur a annulé ; empêchement
   * (autorisation de macOS, échec) dit à l'utilisateur (fiche 124).
   */
  'capture:screen': { args: []; result: ScreenCaptureResult }
  /** Ouvre le réglage « Enregistrement de l'écran » de macOS (fiche 124). */
  'capture:openSettings': { args: []; result: undefined }
  /** Erreur de l'interface, écrite dans le journal de l'app (fiche 041). */
  'app:reportError': { args: [report: UiErrorReport]; result: undefined }
  /** Ouvre le journal de l'app (Console.app). */
  'app:showLog': { args: []; result: undefined }
  /** Avis de l'app en cours : erreur interne, plantage précédent (fiche 194). */
  'app:alerts': { args: []; result: AppAlert[] }
  /** Avis fermé par ✕ (fiche 194). */
  'app:dismissAlert': { args: [kind: AppAlertKind]; result: undefined }
  /** Montre le rapport du plantage précédent dans le Finder (fiche 194). */
  'app:showCrashReport': { args: []; result: undefined }
  /** Quitte puis relance l'app (langue des fenêtres de macOS, fiche 074). */
  'app:relaunch': { args: []; result: undefined }
  /** L'app s'installe elle-même dans Applications (fiche 073). */
  'app:installOffer': { args: []; result: InstallOffer | null }
  'app:install': { args: [scope: InstallScope]; result: undefined }
  'app:dismissInstall': { args: []; result: undefined }
  /** Ce que « Réinitialiser Bobine » mettra à la corbeille, avec les tailles (fiche 148). */
  'app:resetPlan': { args: []; result: ResetPlan }
  /** Réinitialise Bobine : l'assistant prend la main, l'app quitte (fiche 148). */
  'app:reset': { args: [uninstall: boolean]; result: undefined }
  /** Seconde Bobine sur un profil temporaire (fiche 148). */
  'app:openTemporaryProfile': { args: [freshAgents: boolean]; result: undefined }
  /**
   * `bobine <dossier> "message"` au premier lancement (fiche 158) : le message à poser dans la zone
   * de saisie de la conversation ouverte, rendu une seule fois ; l'interface est ensuite « prête ».
   */
  'app:takeLaunch': { args: []; result: LaunchPrefill | null }
  /** Commande `bobine` du terminal : état, installation, désinstallation (fiche 158). */
  /** `null` : commande indisponible (app lancée depuis les sources). */
  'app:commandStatus': { args: []; result: CommandLineStatus | null }
  'app:installCommand': { args: []; result: CommandLineStatus }
  'app:uninstallCommand': { args: []; result: CommandLineStatus }
  /** Liste des conversations et conversation active (au chargement de l'UI). */
  'conversations:get': { args: []; result: ConversationsState }
  /** Contenu d'une conversation, sans changer la conversation active. */
  'conversation:view': { args: [id: string]; result: ConversationView }
  /** Affiche une conversation et (re)démarre son agent si besoin. */
  'conversation:select': { args: [id: string]; result: ConversationView }
  /** Nouvelle conversation (éventuellement avec un autre agent ou dossier). */
  'conversation:create': { args: [request: AgentConfigureRequest]; result: ConversationView }
  'conversation:rename': { args: [id: string, title: string]; result: undefined }
  /** Supprime une conversation ; `fromAgent` (par défaut) : aussi dans l'historique de l'agent. */
  'conversation:delete': {
    args: [id: string, options?: { fromAgent?: boolean; removeWorktree?: boolean }]
    result: ConversationsState
  }
  /** Nouvelle conversation dans un worktree git, depuis le dossier de `id` (fiche 036). */
  'conversation:createWorktree': { args: [id: string]; result: ConversationView }
  /**
   * « Autoriser et lancer » la préparation du worktree de `id` (fiche 175) : `signature`, celle
   * des commandes montrées ; rien ne tourne si le fichier a changé depuis.
   */
  'conversation:approveWorktreeSetup': { args: [id: string, signature: string]; result: undefined }
  /**
   * « Continuer sans préparer » (commande non lancée) ou « Continuer sans attendre » (commande en
   * cours) : les messages retenus partent.
   */
  'conversation:skipWorktreeSetup': { args: [id: string]; result: undefined }
  /** « Arrêter » la commande de préparation en cours : les messages retenus partent. */
  'conversation:stopWorktreeSetup': { args: [id: string]; result: undefined }
  /** Préparations en cours, pendant la création des worktrees (fiche 149). */
  'conversation:childLaunches': { args: []; result: ChildLaunchState }
  /**
   * « Lancer en parallèle… » (fiche 097) : conversation fille de `id`, dans un nouveau worktree,
   * avec la consigne comme premier message ; la conversation affichée ne change pas.
   */
  'conversation:startChild': {
    args: [
      id: string,
      request: {
        text: string
        /** Titre de la fille (proposition expirée relancée, fiche 112) ; absent : le début de la consigne. */
        title?: string
        profileId?: string
        model?: { controlId: string; value: string }
      }
    ]
    result: ConversationSummary
  }
  /**
   * « Lancer en parallèle… » possible ? Dépôt git, filles en cours et plafond réglé (fiche 097,
   * ADR-0020), lus à l'ouverture du menu.
   */
  'conversation:childCapacity': { args: [id: string]; result: ChildCapacity }
  /**
   * « Faire relire… » (fiche 177) : relecteur du travail de `id`, une fille dans son dossier ;
   * agent et modèle confirmés par l'utilisateur. La conversation affichée ne change pas.
   */
  'conversation:startReview': {
    args: [
      id: string,
      request: {
        focus?: string
        profileId?: string
        model?: { controlId: string; value: string }
      }
    ]
    result: ConversationSummary
  }
  /** Ce qui serait perdu en supprimant le worktree d'une conversation ; `null` sans worktree. */
  'conversation:worktreeStatus': { args: [id: string]; result: WorktreeStatusView | null }
  /** Ouvre une conversation à côté de l'active (vue côte à côte), sans changer l'active. */
  'conversation:open': { args: [id: string]; result: ConversationView }
  /** Conversation d'à côté refermée. */
  'conversation:release': { args: [id: string]; result: undefined }
  /** Archive une conversation, ou la ressort. */
  'conversation:archive': { args: [id: string, archived: boolean]; result: ConversationsState }
  /** Fichiers modifiés depuis un message, avant d'en repartir (fiche 023). */
  'conversation:branchPreview': { args: [id: string, itemId: number]; result: BranchPreview }
  /** Repartir d'un message avec un nouveau texte : nouvelle conversation (branche, fiche 023). */
  'conversation:branch': {
    args: [id: string, itemId: number, text: string, options?: { restoreFiles?: boolean }]
    result: ConversationView
  }
  /** Agents vers qui continuer la conversation, leurs modèles et où partiraient les messages (fiche 108). */
  'conversation:handoverTargets': { args: [id: string]; result: HandoverTarget[] }
  /** Continue la conversation avec un autre agent, et le modèle choisi (fiche 108). */
  'conversation:continueWith': {
    args: [id: string, profileId: string, model?: string]
    result: ConversationView
  }
  /** Règles actives de la conversation (fiche 056). */
  'conversation:rules': { args: [id: string]; result: RuleFileView[] }
  /** Outils de Bobine que reçoit la conversation (fiche 099), leur poids, le prochain (fiche 109). */
  'conversation:appTools': { args: [id: string]; result: ConversationAppTools }
  /** Sessions gardées par un agent, absentes de l'historique (fiche 055) ; `only` : un dossier. */
  'agent:listSessions': { args: [profileId: string, only?: string]; result: AgentSessionView[] }
  /** Reprend une session de l'agent comme conversation de l'historique (fiche 055). */
  'conversation:resumeSession': {
    args: [profileId: string, session: AgentSessionView]
    result: ConversationView
  }
  /** Travail d'un sous-agent, rejoué à part quand l'agent garde sa session (fiche 053). */
  'conversation:subagentWork': { args: [id: string, toolCallId: string]; result: TranscriptItem[] }
  /** Épingle une conversation en tête de la barre latérale (fiche 026). */
  'conversation:pin': { args: [id: string, pinned: boolean]; result: undefined }
  /**
   * Autres dossiers de la conversation (fiche 179) : ajout par le dialogue natif (chemin choisi,
   * `null` si annulé), retrait ; la session est rouverte si l'agent est prêt.
   */
  'conversation:addFolder': { args: [id: string]; result: string | null }
  'conversation:removeFolder': { args: [id: string, folder: string]; result: undefined }
  /** Plafond de coût propre à la conversation, ou `null` pour celui des réglages (fiche 157). */
  'conversation:setCostCap': { args: [id: string, cap: ConversationCap | null]; result: undefined }
  /** Réponse à la carte « Plafond atteint » (fiche 157). */
  'conversation:answerCostCap': {
    args: [id: string, itemId: number, answer: CostCapAnswer]
    result: undefined
  }
  /** Réponse à la carte « limite d'étapes » (fiche 209). */
  'conversation:answerTurnLimit': {
    args: [id: string, itemId: number, answer: import('./turn-limit').TurnLimitAnswer]
    result: undefined
  }
  /** Recherche dans le contenu des conversations (fiche 026). */
  'conversations:search': { args: [query: string]; result: ContentHit[] }
  /** Envoie un prompt ; se résout à la fin du tour (le contenu arrive par `agent:event`). */
  'agent:prompt': {
    args: [id: string, text: string, attachments?: PromptAttachment[], options?: PromptRequest]
    result: undefined
  }
  /** Retire un message de la file d'attente et le rend (pour le modifier ou le supprimer). */
  'agent:unqueue': { args: [id: string, messageId: string]; result: QueuedMessage }
  /** Interrompt la réponse en cours et envoie la file d'attente, ce message en premier. */
  'agent:sendNow': { args: [id: string, messageId: string]; result: undefined }
  'agent:cancel': { args: [id: string]; result: undefined }
  /** Renvoie tout de suite le message d'un tour en panne réseau (fiche 142). */
  'agent:retryTurn': { args: [id: string]; result: undefined }
  'agent:restart': { args: [id: string]; result: undefined }
  /** Réponse à une demande de permission : option choisie, ou `null` pour annuler. */
  'agent:respondPermission': {
    args: [id: string, requestId: string, optionId: string | null]
    result: undefined
  }
  /** Réponse à un formulaire ou une page demandés par l'agent (élicitation). */
  'agent:respondElicitation': {
    args: [id: string, requestId: string, answer: ElicitationAnswer]
    result: undefined
  }
  /** Connexion demandée par l'agent (ex. « Log in with SSO » de Bob). */
  'agent:authenticate': { args: [id: string, methodId: string]; result: undefined }
  /** Réessaie d'ouvrir la session après une action de l'utilisateur. */
  'agent:retrySession': { args: [id: string]; result: undefined }
  /** Clé d'API saisie dans « Connexion requise » : enregistrée (chiffrée), agent relancé avec. */
  'agent:useApiKey': { args: [id: string, env: string, value: string]; result: undefined }
  /** Étape du profil (connexion, licence) lancée dans le terminal de l'app ; rend l'onglet. */
  'agent:runStep': { args: [id: string, stepId: string]; result: string }
  /** Relance l'agent en faisant confiance au dossier pour cette session (`--trust`). */
  'agent:trustForSession': { args: [id: string]; result: undefined }
  /** Ouvre Terminal.app dans le dossier de la conversation. */
  'workspace:openTerminal': { args: [id: string]; result: undefined }
  /** Change un réglage de session (mode, modèle…) ; mémorisé pour le profil. */
  'agent:setControl': {
    args: [id: string, controlId: string, value: ControlValue]
    result: undefined
  }
  /**
   * Change d'agent et/ou de dossier : reconfigure une conversation vide, sinon en ouvre une nouvelle.
   */
  'agent:configure': {
    args: [id: string, request: AgentConfigureRequest]
    result: ConversationView
  }
  /** Profils disponibles, profil et dossier de la conversation active, dossiers récents. */
  'settings:get': { args: []; result: AgentSettingsView }
  /** Thème, police du terminal (fiche 027) ; champs invalides ignorés. */
  'settings:setPreferences': { args: [change: Partial<Preferences>]; result: AgentSettingsView }
  /** Astuces de Bobine (fiche 191) : état, une astuce montrée / masquée / utilisée, tout réafficher. */
  'tips:state': { args: []; result: TipsView }
  'tips:record': { args: [id: TipId, action: TipAction]; result: TipsView }
  'tips:reset': { args: []; result: TipsView }
  /** Message envoyé dans ce dossier : vrai au troisième jour différent (« Planifier… »). */
  'tips:noteMessage': { args: [folder: string, text: string]; result: boolean }
  /** Retire un dossier de la liste des récents. */
  'settings:forgetWorkspace': { args: [workspace: string]; result: AgentSettingsView }
  /** Réglages d'une nouvelle conversation : agent, dossier, mode. */
  'settings:setNewConversation': {
    args: [defaults: NewConversationDefaults]
    result: AgentSettingsView
  }
  /** Un outil n'est plus autorisé d'office pour cet agent (fiche 042). */
  'settings:forgetTool': { args: [profileId: string, tool: string]; result: AgentSettingsView }
  /** Autorisations retenues de l'app (fiche 072). */
  'settings:forgetSite': { args: [site: string]; result: AgentSettingsView }
  'settings:forgetCommand': {
    args: [workspace: string, command: string]
    result: AgentSettingsView
  }
  /** Préparation des worktrees d'un dépôt plus autorisée (fiche 175). */
  'settings:forgetWorktreeSetup': { args: [root: string]; result: AgentSettingsView }
  /**
   * Relit le PATH du shell de connexion (agent installé mais introuvable, fiche 043) et rend les
   * réglages à jour ; rejette avec la raison si le shell ne répond pas.
   */
  'settings:reloadShellEnv': { args: []; result: AgentSettingsView }
  /** Commandes « / » personnelles (fiche 045) : liste entière remplacée. */
  'settings:setCommands': { args: [commands: UserCommand[]]; result: AgentSettingsView }
  /** Commandes du projet de la conversation (`.bobine/commands/*.md`). */
  'commands:project': { args: [id: string]; result: UserCommand[] }
  'settings:setApiKey': {
    args: [profileId: string, env: string, value: string]
    result: AgentSettingsView
  }
  'settings:removeApiKey': { args: [profileId: string, env: string]; result: AgentSettingsView }
  /** Ajoute (`id` absent) ou modifie un agent ACP déclaré (fiche 141) ; rend son identifiant. */
  'settings:saveCustomAgent': {
    args: [draft: CustomAgentDraft, id?: string]
    result: { id: string; settings: AgentSettingsView }
  }
  'settings:removeCustomAgent': { args: [id: string]; result: AgentSettingsView }
  /** Active ou coupe les notifications macOS et le badge du Dock (fiche 024). */
  'settings:setNotifications': { args: [enabled: boolean]; result: AgentSettingsView }
  /** Conversations qui attendent l'utilisateur (pastilles de la barre latérale). */
  'attention:get': { args: []; result: AttentionState }
  /** Ce qu'attend chaque conversation : raison, détail, depuis quand (« À traiter », fiche 119). */
  'attention:details': { args: []; result: AttentionDetails }
  /** macOS accepte-t-il les notifications de l'app ? (connu après la première envoyée) */
  'notifications:status': { args: []; result: NotificationStatus }
  /** Ouvre les réglages de notifications de macOS. */
  'notifications:openSettings': { args: []; result: undefined }
  /** Modifications du dossier par rapport au dernier commit ; `null` hors d'un dépôt (fiche 021). */
  'changes:git': { args: [id: string]; result: GitChanges | null }
  /** Contenu au dernier commit et sur le disque d'un fichier du dossier (`from` : renommage). */
  'changes:gitFile': { args: [id: string, path: string, from?: string]; result: GitFileDiff }
  /** Ouvre un fichier du dossier dans son application par défaut. */
  'changes:open': { args: [id: string, path: string]; result: FileOpenOutcome }
  /** Montre un fichier du dossier dans le Finder. */
  'changes:reveal': { args: [id: string, path: string]; result: undefined }
  /**
   * Clic sur un lien de fichier dans la conversation (fiche 052) : aperçu d'un `.md`, ouverture
   * dans l'app par défaut, ou le Finder (dossier, exécutable, hors du dossier, ⌥-clic).
   */
  'files:openLink': {
    args: [id: string, href: string, options?: { base?: string; reveal?: boolean }]
    result: FileLinkOutcome
  }
  /** Relit un document Markdown du dossier pour l'aperçu. */
  'files:readMarkdown': { args: [id: string, path: string]; result: MarkdownDocument }
  /** Éditeurs installés (fiche 156), détectés par le main. */
  'editors:list': { args: []; result: EditorInfo[] }
  /**
   * Ouvre un fichier du dossier de la conversation dans cet éditeur, à la ligne (fiche 156) ;
   * `base` : dossier des chemins relatifs (celui du document en aperçu).
   */
  'editors:open': {
    args: [id: string, editorId: string, path: string, options?: { line?: number; base?: string }]
    result: EditorOpenOutcome
  }
  /**
   * Ouvre dans cet éditeur une sortie d'outil trop grosse pour le fil (fiche 192), par un fichier
   * temporaire de l'app (jamais dans le dossier de l'utilisateur) ; l'éditeur l'ouvre avec le
   * dossier de la conversation comme projet, jamais le dossier de l'app.
   */
  'editors:openText': {
    args: [id: string, editorId: string, text: string]
    result: EditorOpenOutcome
  }
  /** Glisser natif d'une image du fil vers le Finder, par un fichier temporaire (fiche 156). */
  'images:startDrag': { args: [image: DraggedImage]; result: undefined }
  /**
   * Annule une modification de l'agent (fiche 043) : le fichier, désigné par le chemin d'un diff de
   * la conversation, revient à son état d'avant si rien ne l'a modifié depuis.
   */
  'changes:revert': { args: [id: string, path: string]; result: RevertOutcome }
  /** Branche du dossier de la conversation (puce de la zone de saisie, fiches 037 et 049). */
  'git:status': { args: [id: string]; result: GitStatus | null }
  /** État du worktree d'une conversation pour la vue « Git » (fiche 110) ; `null` sans worktree. */
  /** `fresh` (« Actualiser ») : l'état de `gh` est relu aussi (0.9.1, D7). */
  'worktree:info': {
    args: [id: string, options?: { fresh?: boolean }]
    result: WorktreeCycleView | null
  }
  /** Committe les fichiers cochés du worktree avec ce message. */
  'worktree:commit': {
    args: [id: string, request: { message: string; files: string[] }]
    result: CommitOutcome
  }
  /** Défait ce commit, s'il est encore le dernier et pas dans la base (`git reset --soft`). */
  'worktree:undoCommit': { args: [id: string, hash: string]; result: undefined }
  /**
   * Fusionne la branche dans la base (ADR-0022) : fait, rien à faire, conflits, à committer, ou
   * dossier principal non commité (fiche 123) ; `stash` : « Mettre de côté » le temps de la fusion.
   */
  'worktree:merge': { args: [id: string, options?: { stash?: boolean }]; result: MergeOutcome }
  /** Reprend une fusion arrêtée sur des conflits, une fois les marqueurs retirés. */
  'worktree:mergeContinue': {
    args: [id: string, options?: { stash?: boolean }]
    result: MergeOutcome
  }
  /** « Committer d'abord » (fiche 123) : ces fichiers, dans le dossier principal du dépôt. */
  'worktree:commitMain': {
    args: [id: string, request: { message: string; files: string[] }]
    result: CommitOutcome
  }
  /** « Committer » hors worktree (fiche 123) : les fichiers cochés, dans le dossier de `id`. */
  'changes:commit': {
    args: [id: string, request: { message: string; files: string[] }]
    result: CommitOutcome
  }
  /** Défait ce commit du dossier de `id`, s'il est encore le dernier et pas poussé. */
  'changes:undoCommit': { args: [id: string, hash: string]; result: undefined }
  /** Abandonne une fusion arrêtée sur des conflits. */
  'worktree:mergeAbort': { args: [id: string]; result: undefined }
  /**
   * « Laisser l'agent résoudre » : envoie à la conversation les fichiers en conflit, attend la fin
   * de son tour, puis reprend la fusion.
   */
  'worktree:resolveWithAgent': {
    args: [id: string, options?: { stash?: boolean }]
    result: MergeOutcome
  }
  /** Pousse la branche et ouvre une PR vers la base par `gh` (détecté, jamais requis). */
  'worktree:pullRequest': {
    args: [id: string, request: { title: string; body: string }]
    result: PrOutcome
  }
  /** Suivi de la PR et de la CI (fiche 176) : état connu, relu au besoin ; commence le suivi. */
  'pr:status': { args: [id: string]; result: PrTrack }
  /** « Actualiser » : relit la PR tout de suite. */
  'pr:refresh': { args: [id: string]; result: PrTrack }
  /** « Corriger d'office », « Fusionner quand tout est vert » (décochés par défaut). */
  'pr:options': { args: [id: string, options: Partial<PrOptions>]; result: PrTrack }
  /** « Corriger les contrôles en échec » : consigne et extraits des journaux, à l'agent. */
  'pr:fixChecks': { args: [id: string]; result: PrTrack }
  /** « Fusionner maintenant » : dépôt sans CI seulement (0.9.1, D20). */
  'pr:mergeNow': { args: [id: string]; result: PrTrack }
  /**
   * Après la fusion : archive la conversation, supprime le worktree et la branche ; PR fusionnée,
   * aussi la branche distante (`remote`, 0.9.1, D19 ; son échec n'empêche pas le reste).
   */
  'worktree:cleanup': {
    args: [id: string]
    result: { state: ConversationsState; remote?: RemoteBranchOutcome }
  }
  /** Worktrees de Bobine sans conversation (Réglages › Agents et dossiers). */
  'worktree:orphans': { args: []; result: OrphanWorktree[] }
  /** Supprime un worktree orphelin et sa branche ; rend la liste à jour. */
  'worktree:removeOrphan': {
    args: [orphan: { root: string; path: string; branch: string }]
    result: OrphanWorktree[]
  }
  /**
   * Fusion de toutes les filles finies depuis la carte « Sous-tâches » (fiche 120) : ce que le pied
   * de carte montre (filles dans l'ordre de lancement, état git, recouvrements, refus).
   */
  'children:mergePlan': { args: [motherId: string]; result: ChildrenMergePlan }
  /**
   * Lance la fusion enchaînée de ces filles dans la base, l'une après l'autre ; son état suit
   * dans le fil de la mère (élément `children-merge`). `cleanup` : « Puis nettoyer ».
   */
  'children:merge': {
    args: [motherId: string, ids: string[], options: { cleanup: boolean; stash?: boolean }]
    result: ChildrenMerge
  }
  /** « Committer d'abord » (fiche 123) : ces fichiers, dans le dossier principal du dépôt. */
  'children:commitMain': {
    args: [motherId: string, request: { message: string; files: string[] }]
    result: CommitOutcome
  }
  /** « Arrêter » : la fusion en cours finit, les autres filles restent en attente. */
  'children:mergeStop': { args: [motherId: string]; result: undefined }
  /**
   * Aparté (fiche 180) : question posée au même agent dans une session à part, hors du fil ; la
   * réponse suit par `aside:changed`. `aside:view` : l'aparté ouvert de cette conversation.
   */
  'aside:ask': { args: [id: string, request: AsideRequest]; result: undefined }
  'aside:close': { args: [id: string]; result: undefined }
  'aside:view': { args: [id: string]; result: AsideView | null }
  /**
   * Accueil du premier lancement (fiche 188) : le montrer ou non, avec quels agents ; essai d'un
   * agent (un seul à la fois, annulable) ; fin ou « Passer », jamais défaite.
   */
  'onboarding:state': { args: []; result: OnboardingState }
  'onboarding:check': { args: [request: CheckRequest]; result: AgentReadiness }
  'onboarding:cancel': { args: []; result: undefined }
  /** Étape de connexion du profil, lancée dans le terminal de la conversation ; rend l'onglet. */
  'onboarding:runStep': { args: [id: string, profileId: string, stepId: string]; result: string }
  /** Crée le dossier d'essai vide (`~/Bobine/essai`, sinon `essai-2`…) ; rend son chemin. */
  'onboarding:trialFolder': { args: []; result: string }
  /** Suggestions de la première conversation, d'après son dossier. */
  'onboarding:hints': { args: [id: string]; result: FolderHints }
  'onboarding:finish': { args: [outcome: 'finished' | 'skipped']; result: undefined }
  /**
   * Exporte une conversation en Markdown ou en JSON (fiche 043) : dialogue d'enregistrement, puis le
   * fichier est montré dans le Finder ; `null` si l'utilisateur annule.
   */
  'conversation:export': { args: [id: string, format: ExportFormat]; result: string | null }
  /** Copie datée de l'historique et des réglages dans un dossier choisi ; `null` si annulé. */
  'app:backupHistory': { args: []; result: string | null }
  /** Ouvre le dialogue natif de choix de dossier ; `null` si annulé. */
  'workspace:choose': { args: []; result: string | null }
  /** Fichiers du dossier de la conversation correspondant à une recherche (mentions `@`). */
  'workspace:searchFiles': { args: [id: string, query: string]; result: WorkspaceFile[] }
  /** Dialogue natif de choix de fichiers à joindre (part du dossier de la conversation). */
  'workspace:pickFiles': { args: [id: string]; result: string[] }
  /** Chemins que les fichiers d'exclusion de l'agent de la conversation écartent (fiche 155). */
  'workspace:excludedPaths': { args: [id: string, paths: string[]]; result: ExcludedPaths }
  /** Affiche la page du navigateur de la conversation à l'emplacement de l'onglet (fiche 007). */
  'browser:show': { args: [id: string, bounds: BrowserBounds]; result: undefined }
  /** Onglet masqué ou panneau fermé : plus de page affichée. */
  /** « Effacer les données du navigateur » (fiche 072). */
  'browser:clearData': { args: []; result: undefined }
  'browser:hide': { args: []; result: undefined }
  /** Adresse saisie par l'utilisateur dans la barre de l'onglet. */
  'browser:navigate': { args: [id: string, input: string]; result: undefined }
  /** Image de la page affichée, à joindre au message (fiche 066) ; `null` sans page. */
  'browser:capture': { args: [id: string]; result: ImageAttachment | null }
  'browser:go': { args: [id: string, action: BrowserGo]; result: undefined }
  'browser:getState': { args: [id: string]; result: BrowserState | null }
  'browser:selectTab': { args: [id: string, tabId: string]; result: undefined }
  'browser:closeTab': { args: [id: string, tabId: string]; result: undefined }
  /** « Afficher dans le Finder » un fichier téléchargé et enregistré (fiche 094). */
  'browser:showDownload': { args: [id: string, path: string]; result: undefined }
  /** Zoom de la page de l'onglet actif (fiche 129 : puce « 110 % » du champ d'adresse). */
  'browser:zoom': { args: [id: string, action: BrowserZoom]; result: undefined }
  /** La page reprend la largeur du panneau (taille imposée par l'agent, fiche 129). */
  'browser:clearEmulation': { args: [id: string]; result: undefined }
  /** Page figée le temps d'écrire une remarque (fiches 132, 146) ; `null` sans page. */
  'browser:freeze': { args: [id: string]; result: PageFreeze | null }
  /** Capture propre d'une remarque, sans ce que l'app dessine dans la page (fiche 146). */
  'browser:noteShot': { args: [id: string]; result: PageFreeze | null }
  /** Mode Annoter sur la page vivante (fiche 146) : script de la page, couleurs du thème. */
  'browser:annotate': {
    args: [id: string, on: boolean, theme: PageLayerTheme | null]
    result: undefined
  }
  /** Épingles dessinées dans la page (fiche 146). */
  'browser:pagePins': { args: [id: string, pins: PagePin[]]; result: undefined }
  /** Serveurs de dev lancés pour le dossier de la conversation (fiche 030). */
  'preview:list': { args: [id: string]; result: DevServerView[] }
  'preview:stop': { args: [id: string, name: string]; result: undefined }
  /** Dernières lignes du journal d'un serveur. */
  'preview:logs': { args: [id: string, name: string]; result: string[] }
  /** Simulateur iOS de la conversation (fiche 008). */
  'simulator:getState': { args: [id: string]; result: SimulatorState }
  /** Capture en points (data JPEG base64), `null` sans appareil démarré. */
  'simulator:screenshot': {
    args: [id: string]
    result: { data: string; width: number; height: number } | null
  }
  /** Clic de l'utilisateur sur la capture : toucher en points. */
  'simulator:tap': { args: [id: string, x: number, y: number]; result: undefined }
  /** Glisser de l'utilisateur sur l'écran : balayage en points, durée en secondes (fiche 044). */
  'simulator:swipe': {
    args: [id: string, fromX: number, fromY: number, toX: number, toY: number, duration: number]
    result: undefined
  }
  'simulator:button': { args: [id: string, button: string]; result: undefined }
  /** Flux vidéo de l'appareil (fiche 009) ; `false` : rester aux captures successives. */
  'simulator:startStream': { args: [id: string]; result: boolean }
  'simulator:stopStream': { args: []; result: undefined }
  /** Émulateur Android de la conversation (fiche 032) ; coordonnées en dp. */
  'android:getState': { args: [id: string]; result: AndroidState }
  'android:screenshot': {
    args: [id: string]
    result: { data: string; width: number; height: number } | null
  }
  /** Toucher en dp ; appui long si `holdMs` (fiche 081). */
  'android:tap': { args: [id: string, x: number, y: number, holdMs?: number]; result: undefined }
  /** Glisser de l'utilisateur sur l'écran : balayage en dp, durée en millisecondes (fiche 081). */
  'android:swipe': {
    args: [id: string, fromX: number, fromY: number, toX: number, toY: number, ms: number]
    result: undefined
  }
  /** Retour, Accueil, Apps récentes ; marche/arrêt et volume (boutons de la tranche, fiche 081). */
  'android:key': { args: [id: string, key: string]; result: undefined }
  /** Flux vidéo H.264 de l'appareil ; `false` : rester aux captures successives. */
  'android:startStream': { args: [id: string]; result: boolean }
  'android:stopStream': { args: []; result: undefined }
  /** Terminaux de la conversation (fiche 034). */
  'terminal:list': { args: [id: string]; result: TerminalTabInfo[] }
  'terminal:create': { args: [id: string, cols: number, rows: number]; result: TerminalTabInfo }
  'terminal:write': { args: [id: string, tabId: string, data: string]; result: undefined }
  'terminal:resize': {
    args: [id: string, tabId: string, cols: number, rows: number]
    result: undefined
  }
  'terminal:close': { args: [id: string, tabId: string]; result: undefined }
  /** Arrête la commande au premier plan, pas l'onglet (« Arrêter » de l'onglet Session, fiche 166). */
  'terminal:stop': { args: [id: string, tabId: string]; result: undefined }
  /** Image de l'écran et de l'historique (séquences ANSI) pour un affichage qui s'ouvre. */
  'terminal:snapshot': { args: [id: string, tabId: string]; result: string }
}

/** Canaux d'événements : le main pousse, le renderer écoute. */
export interface IpcEventContract {
  'agent:event': ConversationEvent
  'conversations:changed': ConversationsState
  /** Quota d'un agent relu (fiche 091). */
  'usage:quotasChanged': AgentQuota[]
  /** Journal de consommation changé : un tour écrit, une reprise, une remise à zéro (fiche 144). */
  'usage:changed': null
  /** État du profil changé : un avis fermé ou ajouté (fiche 196). */
  'profile:changed': ProfileStatus
  /** Tâches planifiées changées : échéance, exécution, modification (fiche 178). */
  'schedule:changed': ScheduledTask[]
  /** Aparté d'une conversation : question, réponse au fil de l'eau, coût ; `closed` à la fin. */
  'aside:changed': AsideView
  /** Page du navigateur d'une conversation (adresse, titre, chargement). */
  'browser:state': BrowserState
  /** Téléchargement de la page enregistré ou en échec (fiche 094). */
  'browser:download': BrowserDownload
  /** Raccourci tapé dans la page pour l'onglet du panneau (fiche 129 : ⌘L). */
  'browser:command': BrowserCommand
  /** Clic ou épingle dans la page en mode Annoter (fiche 146). */
  'browser:annotate': PageLayerEvent
  /** Les serveurs de dev d'un dossier ont changé (démarrage, arrêt…). */
  'preview:changed': DevServersChange
  /** L'appareil d'une conversation a changé (démarrage, action de l'agent…). */
  'simulator:state': SimulatorState
  /** Image JPEG du flux vidéo du simulateur. */
  'simulator:frame': { conversationId: string; data: Uint8Array }
  /** Fin du flux (erreur, appareil arrêté) : l'onglet repasse aux captures. */
  'simulator:streamEnded': { conversationId: string; reason: string }
  'android:state': AndroidState
  /** Image H.264 (Annex B) du flux de l'émulateur. */
  'android:frame': { conversationId: string; data: Uint8Array; key: boolean; codec?: string }
  'android:streamEnded': { conversationId: string; reason: string }
  'terminal:data': { conversationId: string; tabId: string; data: string }
  'terminal:changed': TerminalsChange
  /** Nouveaux échanges ACP d'une conversation regardée (fiche 135). */
  'acp:messages': AcpExchangesBatch
  'attention:changed': AttentionState
  /** État de la PR d'une conversation relu (fiche 176). */
  'pr:changed': { id: string; track: PrTrack }
  /** La forge du dépôt distant d'une conversation a répondu après `worktree:info` : à relire (fiche 189). */
  'worktree:forge': { id: string }
  'attention:detailsChanged': AttentionDetails
  'conversation:childLaunchesChanged': ChildLaunchState
  'notifications:status': NotificationStatus
  /** Clic sur une notification : afficher cette conversation. */
  'app:openConversation': string
  /**
   * Message de la fenêtre rapide que l'agent n'a pas pu recevoir (il attend une action) : remis
   * dans la zone de saisie de cette conversation (fiche 062).
   */
  'app:prefill': { id: string; text: string; attachments: PromptAttachment[] }
  /** La fenêtre rapide vient de s'ouvrir : relire où part le message, reprendre le clavier. */
  'quick:shown': null
  /** Entrée du menu macOS (ou son raccourci) choisie (fiche 027). */
  'app:command': MenuCommand
  /** Langue de l'interface changée dans les Réglages (fiche 074) : chaque fenêtre suit. */
  'app:language': Language
  /** Mode présentation changé, par le menu ou les Réglages (fiche 159). */
  'app:presentationChanged': boolean
  /** « Nouveautés » de la fenêtre À propos : ouvrir Réglages › À propos (fiche 116). */
  'app:showChangelog': null
  /** Avis de l'app changés (fiche 194). */
  'app:alerts': AppAlert[]
  /** Astuces masquées ou réaffichées (fiche 191) : l'état à relire. */
  'tips:changed': TipsView
  /** Fenêtre d'aide déjà ouverte : page à afficher (fiche 186). */
  'help:navigate': HelpTarget
  /** ⌘? quand l'aide est ouverte : curseur dans sa recherche (fiche 186). */
  'help:focusSearch': null
  /** Réglages changés ailleurs (thème, police…) : à relire. */
  'settings:changed': AgentSettingsView
}

export type IpcChannel = keyof IpcInvokeContract
export type IpcArgs<C extends IpcChannel> = IpcInvokeContract[C]['args']
export type IpcResult<C extends IpcChannel> = IpcInvokeContract[C]['result']
export type IpcEventChannel = keyof IpcEventContract

export type IpcHandlers = {
  [C in IpcChannel]: (...args: IpcArgs<C>) => IpcResult<C> | Promise<IpcResult<C>>
}

/**
 * Canaux permis. Un canal ajouté ici se range aussi dans `READ_ONLY_SAFE` ou `PROFILE_CHANGING`
 * (`src/main/read-only-guard.ts`) : profil en lecture seule (fiche 196), tout canal non déclaré
 * sûr est refusé, et un essai échoue tant qu'il n'est pas classé.
 */
export const IPC_CHANNELS = [
  'app:getInfo',
  'app:fonts',
  'app:presentation',
  'app:setPresentation',
  'about:technicalInfo',
  'about:close',
  'about:showChangelog',
  'help:open',
  'help:target',
  'help:showChangelog',
  'app:reportError',
  'app:showLog',
  'app:alerts',
  'app:dismissAlert',
  'app:showCrashReport',
  'app:relaunch',
  'app:installOffer',
  'app:install',
  'app:dismissInstall',
  'app:resetPlan',
  'app:reset',
  'app:openTemporaryProfile',
  'app:takeLaunch',
  'app:commandStatus',
  'app:installCommand',
  'app:uninstallCommand',
  'usage:stats',
  'usage:heatmap',
  'usage:export',
  'usage:reset',
  'usage:spends',
  'usage:hasAny',
  'usage:quotas',
  'usage:refreshQuota',
  'schedule:list',
  'schedule:save',
  'schedule:setPaused',
  'schedule:runNow',
  'schedule:remove',
  'mcp:list',
  'mcp:save',
  'mcp:remove',
  'mcp:setEnabled',
  'mcp:test',
  'mcp:appTools',
  'mcp:setAppToolFamily',
  'providers:list',
  'providers:save',
  'providers:remove',
  'providers:setEnabled',
  'providers:setOnly',
  'providers:setKey',
  'providers:removeKey',
  'providers:test',
  'providers:diagnose',
  'settings:network',
  'settings:setNetwork',
  'diagnostics:system',
  'log:status',
  'log:setLevel',
  'log:open',
  'acp:watch',
  'acp:unwatch',
  'log:reveal',
  'diagnostics:agent',
  'quick:info',
  'quick:send',
  'quick:hide',
  'quick:resize',
  'capture:screen',
  'capture:openSettings',
  'sound:preview',
  'conversations:get',
  'conversation:view',
  'conversation:select',
  'conversation:create',
  'conversation:rename',
  'conversation:delete',
  'conversation:pin',
  'conversation:addFolder',
  'conversation:removeFolder',
  'conversation:setCostCap',
  'conversation:answerCostCap',
  'conversation:answerTurnLimit',
  'conversation:createWorktree',
  'conversation:startChild',
  'conversation:approveWorktreeSetup',
  'conversation:skipWorktreeSetup',
  'conversation:stopWorktreeSetup',
  'conversation:childLaunches',
  'conversation:childCapacity',
  'conversation:startReview',
  'conversation:worktreeStatus',
  'conversation:open',
  'conversation:release',
  'conversation:archive',
  'conversation:branchPreview',
  'conversation:branch',
  'conversation:handoverTargets',
  'conversation:continueWith',
  'conversation:subagentWork',
  'agent:listSessions',
  'conversation:rules',
  'conversation:appTools',
  'conversation:resumeSession',
  'conversations:search',
  'agent:prompt',
  'agent:unqueue',
  'agent:sendNow',
  'agent:cancel',
  'agent:retryTurn',
  'agent:restart',
  'agent:respondPermission',
  'agent:respondElicitation',
  'agent:authenticate',
  'agent:retrySession',
  'agent:useApiKey',
  'agent:runStep',
  'agent:trustForSession',
  'workspace:openTerminal',
  'agent:setControl',
  'agent:configure',
  'settings:get',
  'settings:setNotifications',
  'settings:setPreferences',
  'tips:state',
  'tips:record',
  'tips:reset',
  'tips:noteMessage',
  'settings:forgetWorkspace',
  'settings:forgetTool',
  'settings:forgetSite',
  'settings:forgetCommand',
  'settings:forgetWorktreeSetup',
  'settings:reloadShellEnv',
  'settings:setCommands',
  'commands:project',
  'settings:setApiKey',
  'settings:removeApiKey',
  'settings:saveCustomAgent',
  'settings:removeCustomAgent',
  'settings:setNewConversation',
  'attention:get',
  'attention:details',
  'notifications:status',
  'notifications:openSettings',
  'changes:git',
  'git:status',
  'worktree:info',
  'pr:status',
  'pr:refresh',
  'pr:options',
  'pr:fixChecks',
  'pr:mergeNow',
  'worktree:commit',
  'worktree:undoCommit',
  'worktree:commitMain',
  'changes:commit',
  'changes:undoCommit',
  'worktree:merge',
  'worktree:mergeContinue',
  'worktree:mergeAbort',
  'worktree:resolveWithAgent',
  'worktree:pullRequest',
  'worktree:cleanup',
  'worktree:orphans',
  'worktree:removeOrphan',
  'children:mergePlan',
  'children:merge',
  'children:mergeStop',
  'children:commitMain',
  'aside:ask',
  'aside:close',
  'aside:view',
  'onboarding:state',
  'onboarding:check',
  'onboarding:cancel',
  'onboarding:finish',
  'onboarding:runStep',
  'onboarding:trialFolder',
  'onboarding:hints',
  'changes:gitFile',
  'changes:open',
  'changes:reveal',
  'files:openLink',
  'files:readMarkdown',
  'editors:list',
  'editors:open',
  'editors:openText',
  'images:startDrag',
  'changes:revert',
  'conversation:export',
  'app:backupHistory',
  'workspace:choose',
  'workspace:searchFiles',
  'workspace:pickFiles',
  'workspace:excludedPaths',
  'browser:show',
  'browser:clearData',
  'browser:hide',
  'browser:navigate',
  'browser:capture',
  'browser:go',
  'browser:getState',
  'browser:selectTab',
  'browser:closeTab',
  'browser:showDownload',
  'browser:zoom',
  'browser:clearEmulation',
  'browser:freeze',
  'browser:noteShot',
  'browser:annotate',
  'browser:pagePins',
  'preview:list',
  'preview:stop',
  'preview:logs',
  'simulator:getState',
  'simulator:screenshot',
  'simulator:tap',
  'simulator:swipe',
  'simulator:button',
  'simulator:startStream',
  'simulator:stopStream',
  'android:getState',
  'android:screenshot',
  'android:tap',
  'android:swipe',
  'android:key',
  'android:startStream',
  'android:stopStream',
  'terminal:list',
  'terminal:create',
  'terminal:write',
  'terminal:resize',
  'terminal:close',
  'terminal:stop',
  'terminal:snapshot',
  ...MEMORY_CHANNELS,
  ...PROFILE_CHANNELS,
  ...APPROVAL_RULES_CHANNELS
] as const satisfies readonly IpcChannel[]
