/**
 * Événements émis par le main process (AgentHost) vers le renderer.
 * Les types ACP sont importés en `import type` uniquement : aucun code du SDK dans le renderer.
 */
import type { ApprovalsView } from './approvals'
import type {
  ElicitationSchema,
  PermissionOption,
  SessionUpdate,
  StopReason,
  ToolCallUpdate,
  Usage
} from './acp-sdk.mts'
import type { AppToolLabel } from './app-tools'
import type { Message } from './i18n/message'
import type { AttachmentView, PromptAttachment, PromptCapabilities } from './attachments'
import type { PanelTab } from './panel'
import type { PermissionRisk } from './permissions'
import type { Preferences } from './preferences'
import type { QuickEntryStatus } from './quick-entry'
import type { SubagentRun } from './subagent'
import type { TranscriptItem } from './transcript'
import type {
  ChildInstruction,
  ChildProposal,
  ChildRecommendation,
  ChildReport,
  ChildStart,
  MessageOrigin
} from './children'
import type { ChildrenMerge } from './children-merge'
import type { ConversationCap, CostCapReached } from './cost-cap'
import type { CustomAgent } from './custom-agents'
import type { Handover } from './handover'
import type { WorktreeStart } from './worktree-cycle'
import type { WorktreeSetup } from './worktree-setup'

import type { UserCommand } from './user-commands'

export type AgentStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'busy'
  | 'error'
  | 'exited'
  /** L'agent tourne mais la session attend une action de l'utilisateur (voir `blocker`). */
  | 'needs-action'
  /** Conversation consultable mais impossible à reprendre avec cet agent (voir `detail`). */
  | 'read-only'

/** Commande que l'app propose de lancer dans son terminal (l'utilisateur y répond lui-même). */
export interface TerminalStep {
  id: string
  label: string
  /** Commande affichée, telle qu'elle sera tapée dans le terminal. */
  command: string
}

/**
 * Marque de l'erreur « le trousseau n'a pas répondu à temps » (fiche 207) : le renderer y propose
 * « Réessayer » en gardant la valeur saisie.
 */
export const KEYCHAIN_TIMEOUT_ERROR = 'BOBINE_KEYCHAIN_TIMEOUT'

/** Clé d'API qu'un agent accepte (variable d'environnement), sans jamais sa valeur. */
export interface ApiKeyInfo {
  env: string
  label: string
  /** Où l'obtenir. */
  help?: string
  /** Enregistrée dans l'app (chiffrée). */
  stored: boolean
  /**
   * Enregistrée, mais le trousseau n'a pas su la déchiffrer au lancement de l'agent (nom de l'app
   * changé) : à ressaisir. Inconnu tant qu'aucun agent ne l'a lue (fiche 100).
   */
  unreadable?: boolean
  /** Présente dans l'environnement de l'app (sous ce nom ou un ancien nom). */
  fromEnvironment: boolean
}

/** Ce qui empêche d'ouvrir la session (Bob : SSO, dossier non approuvé, licence). */
export type AgentBlocker =
  | {
      kind: 'auth'
      /**
       * Connexions proposées par l'agent. `step` : elle se fait dans un terminal (OpenCode :
       * `opencode auth login`) ; sinon l'agent s'en charge (`authenticate`, ex. SSO de Bob).
       */
      methods: { id: string; name: string; description?: string; step?: TerminalStep }[]
      /** Clé d'API acceptée à la place (Bob : `BOB_API_KEY`). */
      apiKey?: ApiKeyInfo
      /** Authentification en cours (ex. navigateur SSO ouvert). */
      authenticating: boolean
      error?: string
      /**
       * Refusée à un message, la session déjà ouverte (connexion expirée, recette 0.9 D10) :
       * « Réessayer » renvoie ce message.
       */
      atTurn?: true
      /** Le tour refusé avait déjà lancé des outils : « Réessayer » le reprend depuis le début. */
      toolsRan?: true
      /**
       * Modèle de la session refusé au tour (réglage de catégorie `model`, fiche 210) : la carte le
       * nomme et propose d'en choisir un autre.
       */
      model?: { id: string; name: string }
    }
  | {
      kind: 'license'
      /** Message de l'agent, tel quel. */
      message: string
      /** Pour lire la licence (Bob : `bob --show-license`) ; l'acceptation reste à l'utilisateur. */
      steps: TerminalStep[]
    }
  | {
      kind: 'trust'
      /** Message de l'agent, tel quel. */
      message: string
      /** Le profil a un flag de confiance (`--trust` pour Bob). */
      canTrustForSession: boolean
      /** L'agent mémorise cette confiance (Bob 2.0.6 l'écrit dans ses dossiers approuvés). */
      trustRemembered: boolean
      /** Commande à lancer dans le dossier pour l'approuver durablement (Bob : `bob`). */
      approveCommand?: string
    }
  /**
   * Aucun dossier choisi (premier lancement, dossier mémorisé disparu, fiche 093) : l'agent ne
   * démarre qu'une fois le dossier choisi. Posé par l'app, jamais par l'agent.
   */
  | { kind: 'workspace' }

/** Demande d'information de l'agent (élicitation ACP). */
export type ElicitationPrompt =
  | {
      mode: 'form'
      message: string
      schema: ElicitationSchema
      /** Appel d'outil qui pose la question (ex. `AskUserQuestion`), s'il est indiqué. */
      toolCallId?: string
      /**
       * Question posée par l'outil `ask_user` de l'app (fiche 028) : elle reste ouverte après la fin
       * du tour, la réponse tardive étant envoyée comme message de l'utilisateur.
       */
      outlivesTurn?: boolean
      /**
       * Proposition de conversation fille (`start_child`, fiche 112) : la carte de propositions
       * remplace la carte de questions ; `schema` reste celui de `childProposalSchema()`.
       */
      child?: ChildProposal
    }
  | { mode: 'url'; message: string; url: string }

export type ElicitationAction = 'accept' | 'decline' | 'cancel'

/** Réponse de l'utilisateur à une élicitation ; `content` seulement pour un formulaire accepté. */
export interface ElicitationAnswer {
  action: ElicitationAction
  content?: Record<string, unknown>
}

/**
 * Ce que couvre le « Toujours » que l'agent retient lui-même, DÉCLARÉ par son profil (fiche 214,
 * ADR-0011) : l'interface ne le devine jamais (le « always » d'OpenCode survit à une nouvelle
 * session, pas celui de Bob). Bob 2.0.9, relevé fiche 213 : tout le groupe pour la tâche
 * (modifications), la commande et chacune de ses parties.
 */
export interface AlwaysScope {
  /** Le « Toujours » vaut jusqu'à la fin de la conversation. */
  lasts: 'conversation'
  /** Précisions par genre d'outil (`parts` : la commande et chacune de ses parties). */
  covers: { execute?: 'parts'; edit?: 'all-edits' }
}

export interface AgentInfo {
  profileId: string
  profileLabel: string
  /** Nom affiché de l'agent : celui du profil (recette 0.11, C4), pas le titre de `initialize`. */
  agentName?: string
  /** Portée de « Toujours » déclarée par le profil ; absente : l'agent décide, l'app ne dit rien de plus. */
  alwaysScope?: AlwaysScope
  workspace: string
  /** Astuce de la page d'accueil tirée du profil, `code` entre accents graves (agent factice). */
  welcomeHint?: string
}

/** Valeur d'un contrôle de session : identifiant d'option (`select`) ou booléen. */
export type ControlValue = string | boolean

/**
 * Réglage de session exposé par l'agent : option de configuration ACP, ou modes ACP (contrôle `mode`).
 */
export interface SessionControl {
  id: string
  name: string
  description?: string
  /** Catégorie ACP : `mode`, `model`, `thought_level`… */
  category?: string
  type: 'select' | 'boolean'
  currentValue: ControlValue
  /**
   * Options d'un `select` (groupes ACP aplatis, nom du groupe conservé). `authRequired` : modèle
   * refusé faute de connexion avec ce profil d'agent (fiche 210), marqué par l'app, jamais par l'agent.
   */
  options: {
    value: string
    name: string
    description?: string
    group?: string
    authRequired?: true
  }[]
}

/** Commande « / » annoncée par l'agent (`available_commands_update`). */
export interface AgentCommand {
  name: string
  description: string
  /** Indication de l'argument attendu, s'il y en a un. */
  hint?: string
  /**
   * Commande traitée par l'app elle-même (fiche 039), personnelle ou du projet (fiche 045 :
   * consigne développée puis envoyée) ; absente : commande de l'agent.
   */
  source?: 'app' | 'user' | 'project'
}

export interface AgentSnapshot {
  status: AgentStatus
  info: AgentInfo
  /** Réglages de la session en cours (vide sans session). */
  controls: SessionControl[]
  /** Commandes « / » de la session en cours. */
  commands: AgentCommand[]
  /** Message qui fait compacter la conversation à l'agent (`/compress` pour Bob), s'il y en a un. */
  compactCommand?: string
  /** Ce que l'agent accepte dans un message (images, fichiers embarqués). */
  promptCapabilities: PromptCapabilities
  /**
   * L'agent prend d'autres dossiers que le dossier de travail (`additionalDirectories`, fiche
   * 179) ; absent : il ne l'annonce pas, ou n'a pas encore répondu à `initialize`.
   */
  additionalDirectories?: true
  /** Messages écrits pendant une réponse, envoyés ensemble à la fin du tour (fiche 020). */
  queued: QueuedMessageView[]
  /** Présent quand `status` vaut `needs-action`. */
  blocker?: AgentBlocker
  /** Explication du statut (erreur, code de sortie…). */
  detail?: string
  /** Tour à réessayer après une panne réseau ou une limite de débit (fiche 142). */
  retry?: TurnRetryView
  /**
   * L'agent n'a rien envoyé depuis cette heure (ms), au-delà du seuil du bandeau, pendant un tour et
   * hors attente de l'utilisateur (fiche 194).
   */
  silentSince?: number
}

/**
 * Bandeau d'un tour qui attend pour réessayer (fiche 142). Pendant l'attente, l'agent reste
 * « répond… » (`busy`) : Stop annule, un message rejoint la file.
 */
export interface TurnRetryView {
  cause: 'network' | 'rate-limit'
  /** Tentative attendue, de 1 à `max` ; `max` une fois les tentatives épuisées. */
  attempt: number
  max: number
  /** Heure de la tentative (ms) ; absente : tentatives épuisées, seul « Réessayer » reste. */
  at?: number
}

/** Message en file d'attente, tel que l'UI l'affiche (sans le contenu des pièces jointes). */
export interface QueuedMessageView {
  id: string
  text: string
  attachments: { kind: PromptAttachment['kind']; name: string }[]
  /** Message d'une autre conversation (fiche 097) ; absent : de l'utilisateur. */
  from?: MessageOrigin
}

/** Options d'un message envoyé par l'interface (`agent:prompt`). */
export interface PromptRequest {
  /** `/split` (fiche 118) : demander à l'agent de découper le message en conversations filles. */
  askChildren?: boolean
}

/** Options venues du renderer : seules les valeurs vérifiées sont gardées. */
export function parsePromptRequest(value: unknown): PromptRequest {
  const askChildren = typeof value === 'object' && value !== null && 'askChildren' in value
  return askChildren && value.askChildren === true ? { askChildren: true } : {}
}

/** Message en file d'attente rendu à la zone de saisie (« Modifier »). */
export interface QueuedMessage {
  text: string
  attachments: PromptAttachment[]
  from?: MessageOrigin
  /** Écrit avec `/split` (fiche 118) : la demande de découpage part avec lui. */
  askChildren?: boolean
}

/** `success` : action réussie (fiche 194, variante `.notice-success` du composant partagé). */
export type NoticeLevel = 'info' | 'warning' | 'error' | 'success'
/** Lien à la suite d'un avis (fiche 198) : ouvre une section des Réglages. */
export type NoticeLink = 'diagnostics'

/** Profil d'agent tel que l'UI le voit (sans commande ni environnement). */
export interface ProfileSummary {
  id: string
  label: string
  available: boolean
  /** Pourquoi le profil est indisponible. */
  reason?: string
  /** Ce que Bobine sait faire avec cet agent (fiche 054). */
  capabilities: AgentCapabilitiesView
  /** Où partent les messages, en clair, faute de fournisseur de modèle connu (fiche 108). */
  destination?: string
  /** Commande lancée, affichée sur la page de l'agent (fiche 136) : chemins réduits à leur nom. */
  command: string
  /** Le profil déclare des fournisseurs de modèles modifiables (fiche 104). */
  providers?: boolean
  /**
   * Le modèle d'une conversation fille peut se choisir (`childModelChoice`, fiche 160) : suggéré
   * par la mère, confirmé par l'utilisateur ; absent, l'agent prend toujours le sien.
   */
  childModel?: boolean
  /**
   * Le profil déclare des règles d'approbation globales (fiche 215) : `approvalRules:get` /
   * `approvalRules:change` les lisent et les changent.
   */
  approvalRules?: boolean
  /** Agent déclaré par l'utilisateur (fiche 141) : sa déclaration, pour la modifier. */
  custom?: CustomAgent
}

/** Session gardée par un agent, qu'on peut reprendre dans l'app (fiche 055). */
export interface AgentSessionView {
  sessionId: string
  /** Dossier de la session. */
  cwd: string
  /** Titre donné par l'agent (Bob : premier message). */
  title?: string
  /** Dernière activité (ISO). */
  updatedAt?: string
}

/** Une ligne de « Ce que Bobine sait faire avec cet agent » (fiche 054). */
export interface CapabilityItem {
  /** Repère stable, celui de la matrice de `docs/agents.md`. */
  id: string
  label: string
  /** Ce que ça change, ou d'où ça vient. */
  detail?: string
  /** Annoncé par l'agent : oui ou non. Absent pour ce que le profil sait de l'agent. */
  supported?: boolean
}

export interface AgentCapabilitiesView {
  /** Annonce du dernier démarrage de l'agent ; absente s'il n'a jamais démarré dans l'app. */
  announced?: { name?: string; version?: string; seenAt: string; items: CapabilityItem[] }
  /** Ce que l'app sait de cet agent en propre, tiré de son profil (ADR-0011). */
  specific: CapabilityItem[]
}

/** Réglages actuels, pour les sélecteurs de l'UI. */
export interface AgentSettingsView {
  profiles: ProfileSummary[]
  profileId: string
  workspace: string
  recentWorkspaces: string[]
  /** Notifications macOS et badge du Dock (fiche 024). */
  notifications: boolean
  /** Apparence : thème, police du terminal (fiche 027). */
  preferences: Preferences
  /** Le dossier de la conversation active est dans un dépôt git (worktrees, fiche 036). */
  inGitRepo: boolean
  /** Réglages d'une nouvelle conversation (absents : comme la conversation en cours). */
  newConversation: NewConversationDefaults
  /** Outils « toujours autorisés » retenus d'une conversation à l'autre, par agent (fiche 042). */
  rememberedTools: { profileId: string; profileLabel: string; tools: string[] }[]
  /** Sites et commandes « toujours autorisés » de l'app (fiche 072). */
  approvals: ApprovalsView
  /**
   * Clés d'API que chaque agent accepte (fiche 022), sans leurs valeurs. Le trousseau n'est pas
   * consulté pour les lister : il l'est à la saisie d'une clé (fiche 100).
   */
  apiKeys: { profileId: string; profileLabel: string; keys: ApiKeyInfo[] }[]
  /** Commandes « / » personnelles, tous dossiers (fiche 045). */
  commands: UserCommand[]
  /** Raccourci global de la fenêtre rapide et s'il a été accepté par macOS (fiche 062). */
  quickEntry?: QuickEntryStatus
}

/** Avant de supprimer une conversation en worktree : ce qui serait perdu (fiche 036). */
export interface WorktreeStatusView {
  branch: string
  path: string
  dirty: number
  ahead: number
  missing?: boolean
}

/**
 * Avant de repartir d'un message (fiche 023) : fichiers modifiés par l'agent depuis ce point, et ce
 * qu'il adviendrait de chacun si on les remettait dans leur état d'alors.
 */
export interface BranchPreview {
  files: {
    path: string
    /** `restore` : sera remis ; `unchanged` : déjà dans cet état ; `conflict` : modifié depuis
     * par quelqu'un d'autre, pas touché ; `outside` : hors du dossier, pas touché. */
    status: 'restore' | 'unchanged' | 'conflict' | 'outside'
    /** Créé par l'agent : il sera supprimé. */
    created: boolean
  }[]
  /** Commandes lancées depuis ce point (elles ne s'annulent pas). */
  commands: number
}

/**
 * Nouvelle conversation (« Nouvelle conversation », lancement) : agent, dossier, mode. Un champ
 * absent : comme la conversation en cours (agent, dossier) ou comme la dernière fois (mode).
 */
export interface NewConversationDefaults {
  profileId?: string
  workspace?: string
  /** `plan` : mode plan de l'agent ; `execute` : son mode de travail (Bob `agent`, OpenCode `build`). */
  mode?: 'plan' | 'execute'
}

/** Changement de configuration ; un champ omis garde sa valeur actuelle. */
export interface AgentConfigureRequest {
  profileId?: string
  workspace?: string
}

export type AgentEvent =
  | { type: 'status'; snapshot: AgentSnapshot }
  /** Nouvelle conversation : le fil est vidé. */
  | { type: 'reset' }
  | {
      type: 'user-message'
      text: string
      attachments?: AttachmentView[]
      /** Mode actif à l'envoi (contrôle de catégorie `mode`), pour reconnaître un plan (fiche 040). */
      mode?: { id: string; name: string }
      /** Modèle de la session à l'envoi (réglage de catégorie `model`), s'il y en a un (fiche 130). */
      model?: { id: string; name: string }
      /** Heure d'envoi (ms depuis l'époque Unix). */
      at?: number
      /** Message d'une autre conversation, ou réveil de la mère (fiche 097). */
      from?: MessageOrigin
      /** Commande de compaction de la session, reconnue par l'hôte d'agent (fiches 126, 140). */
      compaction?: true
    }
  | { type: 'update'; update: SessionUpdate }
  /**
   * Rejeu d'une session dont le fil de l'app est gardé (fiche 103) : le fil tel que l'agent le
   * rejoue, pour n'en ajouter que ce que le fil n'a pas (session continuée ailleurs).
   */
  | { type: 'replayed'; items: TranscriptItem[] }
  /**
   * Le dernier message, refusé faute de connexion, renvoyé à l'agent (recette 0.9, D10) : il peut
   * figurer deux fois dans l'historique de l'agent, qu'un rejeu ne doit pas prendre pour un tour
   * venu d'ailleurs. `fresh` : dans une session neuve (ADR-0030), recopié après la bascule.
   */
  | { type: 'resent'; fresh?: true }
  /** `at` : heure de fin de la réponse (ms). */
  | {
      type: 'turn-end'
      stopReason: StopReason
      usage?: Usage
      at?: number
      /** `max_turn_requests` : ce que le main a vu du tour (fiche 209). */
      limit?: import('./turn-limit').TurnLimitSeen
    }
  /** Coût cumulé de la session, obtenu hors protocole (ex. base locale de Bob). */
  | { type: 'usage-report'; cost: { amount: number; currency: string } }
  | { type: 'turn-error'; message: string }
  /**
   * Une tentative du tour a échoué et une autre est prévue (fiche 142) : ses outils en cours sont
   * interrompus, le tour continue, sans avis.
   */
  | { type: 'attempt-failed' }
  /**
   * L'utilisateur arrête la réponse (Échap, ■, « Interrompre et envoyer ») : un outil qui échoue
   * ensuite dans ce tour est interrompu, pas en échec (fiche 126).
   */
  | { type: 'cancel-requested' }
  /**
   * `message` : texte tel quel, ou code traduit à l'affichage (ADR-0014). `title` : titre de
   * l'encadré (sortie d'une commande de l'app, fiche 126).
   */
  | {
      type: 'notice'
      level: NoticeLevel
      message: string | Message
      title?: string
      link?: NoticeLink
    }
  /** L'agent demande l'autorisation d'exécuter un outil ; on attend `agent:respondPermission`. */
  | {
      type: 'permission-request'
      requestId: string
      toolCall: ToolCallUpdate
      options: PermissionOption[]
      /** Ce que l'appel a de risqué (fiche 211) ; absent : rien de repéré. */
      risks?: PermissionRisk[]
    }
  /**
   * Demande traitée : `optionId` choisi, ou `null` si annulée (Stop, arrêt de l'agent…).
   * `cancelledBy: 'agent'` : l'agent a retiré sa demande lui-même (`$/cancel_request`, fiche 214) ;
   * la carte disparaît sans bruit (le fil ne garde rien) ; l'outil garde l'état que l'agent lui donne.
   */
  | {
      type: 'permission-resolved'
      requestId: string
      optionId: string | null
      cancelledBy?: 'agent'
    }
  /** L'agent demande une information ; on attend `agent:respondElicitation`. */
  | { type: 'elicitation-request'; requestId: string; prompt: ElicitationPrompt }
  | {
      type: 'elicitation-resolved'
      requestId: string
      action: ElicitationAction
      content?: Record<string, unknown>
    }
  /** Images renvoyées par un outil de l'app, à montrer dans la carte de l'appel (fiche 029). */
  | { type: 'tool-media'; toolCallId: string; images: ToolImage[] }
  /** Libellé lisible d'un appel à un outil de l'app, d'après ses arguments (fiche 047). */
  | { type: 'tool-app'; toolCallId: string; appTool: AppToolLabel }
  /**
   * Issue d'un outil de l'app vue par l'app (fiche 122) : refusé par l'utilisateur, ou en erreur.
   * Elle l'emporte sur la fin que l'agent annonce (OpenCode dit « completed » à un refus).
   */
  | { type: 'tool-outcome'; toolCallId: string; outcome: ToolOutcome }
  /** Sous-agent suivi en direct (fiche 053) : début, fin, coût, session à rejouer. */
  | { type: 'subagent-run'; toolCallId: string; run: SubagentRun }
  /**
   * Travail d'un sous-agent reçu en direct (OpenCode 2, fiche 078) : rangé sous sa carte, pas dans
   * le fil de la conversation.
   */
  | { type: 'subagent-update'; toolCallId: string; update: SessionUpdate }
  /** L'agent se sert d'un outil de l'app : afficher l'onglet correspondant du panneau latéral. */
  | { type: 'panel-open'; tab: PanelTab }
  /** Conversation fille lancée depuis celle-ci, posé par l'app dans son fil (fiche 097). */
  | { type: 'child-started'; child: ChildStart }
  /** Consigne adressée à une fille existante, posée dans le fil de sa mère (fiche 150). */
  | { type: 'child-instruction'; instruction: ChildInstruction }
  /** Compte rendu d'une conversation fille à la fin d'un de ses tours (fiche 097). */
  | { type: 'child-report'; report: ChildReport }
  /** Recommandation de fusion d'une fille par l'agent de la mère (`recommend_merge`, fiche 160). */
  | { type: 'child-recommendation'; recommendation: ChildRecommendation }
  /**
   * Relecture du travail de cette conversation (fiche 177), posée par l'app dans son fil, puis
   * remplacée à chaque étape (même `reviewId`).
   */
  | { type: 'review'; review: import('./review').Review }
  /**
   * Proposition de mémoire (fiche 182), posée par l'app dans le fil quand l'agent appelle `remember`
   * ou `forget`, puis remplacée à la décision de l'utilisateur (même `proposalId`).
   */
  | { type: 'memory-proposal'; proposal: import('./memory').MemoryProposal }
  /** Index de la mémoire joint à la session (fiche 182) : son poids, pour l'onglet Session. */
  | { type: 'memory-context'; tokens: number }
  /** La conversation continue avec un autre agent (fiche 108), posé par l'app dans son fil. */
  | { type: 'handover'; handover: Handover }
  /** Départ du worktree de la conversation (fiches 110, 117), posé par l'app en tête de son fil. */
  | { type: 'worktree-start'; start: WorktreeStart }
  /** Préparation du worktree (fiche 175) : un seul élément, remplacé à chaque étape. */
  | { type: 'worktree-setup'; setup: WorktreeSetup }
  /**
   * Fusion de toutes les filles finies (fiche 120), posée dans le fil de la mère, puis remplacée à
   * chaque étape (même `runId`).
   */
  | { type: 'children-merge'; merge: ChildrenMerge }
  /**
   * L'app attend l'utilisateur pour cette conversation, hors du fil : fenêtre « Enregistrer sous »
   * d'un téléchargement (fiche 094), boîte d'une page du navigateur. Pour la liste et les
   * notifications (fiche 024) ; rien dans le fil.
   */
  | { type: 'waiting-user'; key: string; waiting: boolean; reason: 'save' | 'page-dialog' }
  /** Plafond de coût de la conversation (fiche 157) : le sien, ou `null` pour celui des réglages. */
  | { type: 'cost-cap-set'; cap: ConversationCap | null }
  /** Plafond franchi (fiche 157), posé par l'app : carte « Continuer » / « Arrêter ». */
  | { type: 'cost-cap-reached'; reached: CostCapReached }
  /** Réponse à la carte du plafond. */
  | { type: 'cost-cap-answer'; itemId: number; answer: CostCapAnswer; raisedTo?: number }
  /** Réponse à la carte « limite d'étapes » (fiche 209). */
  | { type: 'turn-limit-answer'; itemId: number; answer: import('./turn-limit').TurnLimitAnswer }
  /**
   * Coût d'un aparté (fiche 180), posé par l'app : ajouté au coût des autres sessions de la
   * conversation (`usage.earlier`), rien dans le fil.
   */
  | { type: 'aside-cost'; cost: { amount: number; currency: string } }

/** Réponse à la carte « Plafond atteint » (fiche 157). */
export type CostCapAnswer = 'continue' | 'stop'

/** Issue d'un outil connue de l'app, qui l'emporte sur celle dite par l'agent (fiche 122). */
export type ToolOutcome = 'refused' | 'failed'

/** Image affichée dans une carte d'outil (capture d'écran…). */
export interface ToolImage {
  mimeType: string
  data: string
}

/** Conversation telle que la barre latérale la liste. */
export interface ConversationSummary {
  id: string
  title: string
  profileId: string
  profileLabel: string
  /**
   * L'agent sait supprimer une session de son historique (`session/delete`, vu à son dernier
   * démarrage) : la boîte de suppression le propose (fiche 196).
   */
  agentDeletes?: boolean
  workspace: string
  /** Autres dossiers de la conversation (fiche 179), chemins absolus. */
  additionalDirectories?: string[]
  /**
   * Projet de la conversation (fiche 131) : racine du dépôt pour une conversation en worktree,
   * `workspace` sinon. Le mode « Dossiers » de la barre latérale regroupe par projet ; absent
   * (données anciennes ou d'essai), `workspace` en tient lieu.
   */
  project?: string
  /** ISO 8601 — dernière activité. */
  updatedAt: string
  /** ISO 8601 — création (astuces : pas pendant les deux premières minutes, fiche 191). */
  createdAt?: string
  /** Statut de son agent ; `stopped` si aucun processus ne tourne pour elle. */
  status: AgentStatus | 'stopped'
  /** Conversation encore vide (pas dans l'historique). */
  draft: boolean
  /** Épinglée en tête de la barre latérale (fiche 026). */
  pinned?: boolean
  /** Branche du worktree git de la conversation (fiche 036). */
  branch?: string
  /** Conversation d'origine d'une branche (fiche 023). */
  branchedFrom?: { id: string; title: string }
  /**
   * Mère d'une conversation fille (fiche 097) ; absente quand la mère a été supprimée ou archivée :
   * la fille est alors une conversation ordinaire.
   */
  startedFrom?: { id: string; title: string }
  /** Relecteur (fiche 177) : la conversation dont il relit le travail. */
  reviewOf?: { id: string; title: string }
  /** Archivée : rangée à part dans la barre latérale. */
  archived?: boolean
  /** Exécution d'une tâche planifiée (fiche 178) : la tâche et son nom au lancement. */
  scheduled?: { taskId: string; name: string }
  /** Consommation rapportée par l'agent, résumée (fiche 109). */
  usage?: import('./usage').UsageDigest
  /** Cartes « Retenir ce souvenir ? » en attente (fiche 182) : pastille « Mémoire ». */
  memoryPending?: number
}

export interface ConversationsState {
  conversations: ConversationSummary[]
  activeId: string
}

/** Tout ce qu'il faut pour afficher une conversation. */
export interface ConversationView {
  summary: ConversationSummary
  snapshot: AgentSnapshot | null
  transcript: import('./transcript').TranscriptState
  /** Numéro du dernier évènement compris dans ce fil (voir `ConversationEvent.seq`). */
  seq?: number
}

/** Événement d'agent rattaché à sa conversation. */
export interface ConversationEvent {
  conversationId: string
  event: AgentEvent
  /**
   * Numéro croissant par conversation : un évènement déjà compris dans la vue chargée (arrivée
   * avant lui) est ignoré.
   */
  seq?: number
}
