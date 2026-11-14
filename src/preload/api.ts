import type { AppAlert, AppAlertKind } from '@shared/app-alerts'
import type { TipAction, TipId, TipsView } from '@shared/tips'
import type { HelpTarget, HelpTopic } from '@shared/help-topics'
import type { ScheduledTaskInput } from '@shared/schedule'
import type { UserCommand } from '@shared/user-commands'
import type { CustomAgentDraft } from '@shared/custom-agents'
import type { PromptAttachment } from '@shared/attachments'
import type { BrowserBounds, BrowserGo, BrowserZoom } from '@shared/browser'
import type { PageLayerTheme, PagePin } from '@shared/page-notes'
import type {
  AgentConfigureRequest,
  AgentSessionView,
  ControlValue,
  CostCapAnswer,
  ElicitationAnswer,
  NewConversationDefaults,
  PromptRequest
} from '@shared/agent'
import type { AsideRequest } from '@shared/aside'
import type { MemoryDecision, MemoryPlace } from '@shared/memory'
import type { ApprovalRulesChange } from '@shared/approval-rules'
import type { CheckRequest } from '@shared/onboarding'
import type { ConversationCap } from '@shared/cost-cap'
import type { TurnLimitAnswer } from '@shared/turn-limit'
import type {
  IpcArgs,
  IpcChannel,
  IpcEventChannel,
  IpcEventContract,
  IpcResult,
  UiErrorReport
} from '@shared/ipc'
import type { Preferences } from '@shared/preferences'
import type { McpScope, McpServer } from '@shared/mcp'
import type { ModelProvider, NetworkSettings } from '@shared/providers'
import type { ExportFormat } from '@shared/export'
import type { UsageExportKind, UsageHeatQuery, UsageQuery } from '@shared/usage-stats'
import type { InstallScope } from '@shared/install'
import type { DraggedImage } from '@shared/images'
import { DEFAULT_LANGUAGE, type Language } from '@shared/i18n/language'
import { ALL_FEATURES, type PlatformFeatures } from '@shared/platform'
import type { Verbosity } from '@shared/log-level'

export type Invoke = <C extends IpcChannel>(
  channel: C,
  ...args: IpcArgs<C>
) => Promise<IpcResult<C>>

export type Subscribe = <C extends IpcEventChannel>(
  channel: C,
  listener: (payload: IpcEventContract[C]) => void
) => () => void

/** API exposée au renderer sous `window.api`. Volontairement minimale. */
export function createApi(
  invoke: Invoke,
  subscribe: Subscribe,
  /** Chemin d'un fichier glissé dans la fenêtre (`webUtils.getPathForFile`) ; '' s'il n'en a pas. */
  pathForFile: (file: File) => string = () => '',
  /** Langue de l'interface, passée par le main à la création de la fenêtre (fiche 074). */
  language: Language = DEFAULT_LANGUAGE,
  /** Capacités de la plateforme (fiche 145), passées par le main à la création de la fenêtre. */
  features: PlatformFeatures = ALL_FEATURES,
  /** Dossier personnel, passé de la même façon (fiche 214) : pour dire `~` dans les cartes ; '' si inconnu. */
  home = ''
) {
  return {
    files: {
      /** Chemin sur le disque d'un fichier glissé-déposé (le renderer ne lit pas le disque). */
      pathFor: (file: File) => pathForFile(file)
    },
    app: {
      language,
      features,
      home,
      getInfo: () => invoke('app:getInfo'),
      /** Polices installées (fiche 136). */
      fonts: () => invoke('app:fonts'),
      /** Mode présentation (fiche 159). */
      presentation: () => invoke('app:presentation'),
      setPresentation: (active: boolean) => invoke('app:setPresentation', active),
      onPresentation: (listener: (active: boolean) => void) =>
        subscribe('app:presentationChanged', listener),
      /** Erreur de l'interface, pour le journal de l'app (fiche 041). */
      reportError: (report: UiErrorReport) => invoke('app:reportError', report),
      showLog: () => invoke('app:showLog'),
      /** Avis de l'app : erreur interne, plantage précédent (fiche 194). */
      alerts: () => invoke('app:alerts'),
      dismissAlert: (kind: AppAlertKind) => invoke('app:dismissAlert', kind),
      showCrashReport: () => invoke('app:showCrashReport'),
      onAlerts: (listener: (alerts: AppAlert[]) => void) => subscribe('app:alerts', listener),
      /** Quitte puis relance l'app (fiche 074). */
      relaunch: () => invoke('app:relaunch'),
      /** Installation par l'app elle-même (fiche 073) : proposition, installation, « Ne plus proposer ». */
      installOffer: () => invoke('app:installOffer'),
      install: (scope: InstallScope) => invoke('app:install', scope),
      dismissInstall: () => invoke('app:dismissInstall'),
      /** Recommencer à neuf (fiche 148). */
      resetPlan: () => invoke('app:resetPlan'),
      reset: (uninstall: boolean) => invoke('app:reset', uninstall),
      openTemporaryProfile: (freshAgents: boolean) =>
        invoke('app:openTemporaryProfile', freshAgents),
      /** `bobine <dossier> "message"` au premier lancement : le message à poser (fiche 158). */
      takeLaunch: () => invoke('app:takeLaunch'),
      /** Commande `bobine` du terminal (fiche 158). */
      commandStatus: () => invoke('app:commandStatus'),
      installCommand: () => invoke('app:installCommand'),
      uninstallCommand: () => invoke('app:uninstallCommand'),
      /** Copie datée de l'historique dans un dossier choisi (fiche 043) ; `null` si annulé. */
      backupHistory: () => invoke('app:backupHistory'),
      /** Clic sur une notification : la conversation à afficher. */
      onOpenConversation: (listener: (id: string) => void) =>
        subscribe('app:openConversation', listener),
      /** Message de la fenêtre rapide à remettre dans la zone de saisie (fiche 062). */
      onPrefill: (listener: (prefill: IpcEventContract['app:prefill']) => void) =>
        subscribe('app:prefill', listener),
      /** Entrée du menu macOS ou son raccourci (fiche 027). */
      onCommand: (listener: (command: IpcEventContract['app:command']) => void) =>
        subscribe('app:command', listener),
      /** Langue changée dans les Réglages (fiche 074). */
      onLanguage: (listener: (language: Language) => void) => subscribe('app:language', listener),
      /** « Nouveautés » de la fenêtre À propos : Réglages › À propos (fiche 116). */
      onShowChangelog: (listener: () => void) => subscribe('app:showChangelog', () => listener())
    },
    /** Fenêtre À propos (fiche 116). */
    about: {
      technicalInfo: () => invoke('about:technicalInfo'),
      close: () => invoke('about:close'),
      showChangelog: () => invoke('about:showChangelog')
    },
    /** Astuces de Bobine (fiche 191). */
    tips: {
      state: () => invoke('tips:state'),
      record: (id: TipId, action: TipAction) => invoke('tips:record', id, action),
      reset: () => invoke('tips:reset'),
      noteMessage: (folder: string, text: string) => invoke('tips:noteMessage', folder, text),
      onChanged: (listener: (view: TipsView) => void) => subscribe('tips:changed', listener)
    },
    /** Fenêtre d'aide (fiche 186). */
    help: {
      open: (topic: HelpTopic | null) => invoke('help:open', topic),
      target: () => invoke('help:target'),
      showChangelog: () => invoke('help:showChangelog'),
      onNavigate: (listener: (target: HelpTarget) => void) => subscribe('help:navigate', listener),
      onFocusSearch: (listener: () => void) => subscribe('help:focusSearch', () => listener())
    },
    usage: {
      /** Tableau de consommation (fiche 137). */
      stats: (query: UsageQuery) => invoke('usage:stats', query),
      heatmap: (query: UsageHeatQuery) => invoke('usage:heatmap', query),
      exportCsv: (query: UsageQuery, kind: UsageExportKind) => invoke('usage:export', query, kind),
      reset: () => invoke('usage:reset'),
      spends: () => invoke('usage:spends'),
      hasAny: () => invoke('usage:hasAny'),
      /** Quotas des agents qui savent le lire (Bob : bobcoins), lus au démarrage (fiche 091). */
      quotas: () => invoke('usage:quotas'),
      refreshQuota: (profileId?: string) => invoke('usage:refreshQuota', profileId),
      onQuotasChanged: (listener: (quotas: IpcEventContract['usage:quotasChanged']) => void) =>
        subscribe('usage:quotasChanged', listener),
      /** Journal changé (fiche 144) : « Mon activité » se relit. */
      onChanged: (listener: () => void) => subscribe('usage:changed', () => listener())
    },
    /** Intégrité du profil (fiches 196, 197) : lecture seule, avis, corbeille, restauration. */
    profile: {
      status: () => invoke('profile:status'),
      dismiss: (id: string) => invoke('profile:dismiss', id),
      reveal: (id: string) => invoke('profile:reveal', id),
      openReleases: () => invoke('profile:openReleases'),
      onChanged: (listener: (status: IpcEventContract['profile:changed']) => void) =>
        subscribe('profile:changed', listener),
      trash: () => invoke('trash:list'),
      restoreFromTrash: (id: string) => invoke('trash:restore', id),
      eraseFromTrash: (id: string) => invoke('trash:erase', id),
      chooseBackup: () => invoke('backup:choose'),
      restoreBackup: (folder: string) => invoke('backup:restore', folder)
    },
    /** Tâches planifiées (fiche 178). */
    schedule: {
      list: () => invoke('schedule:list'),
      save: (id: string | null, task: ScheduledTaskInput) => invoke('schedule:save', id, task),
      setPaused: (id: string, paused: boolean) => invoke('schedule:setPaused', id, paused),
      runNow: (id: string) => invoke('schedule:runNow', id),
      remove: (id: string) => invoke('schedule:remove', id),
      onChanged: (listener: (tasks: IpcEventContract['schedule:changed']) => void) =>
        subscribe('schedule:changed', listener)
    },
    /** Serveurs MCP des agents (fiche 025). */
    mcp: {
      list: () => invoke('mcp:list'),
      save: (profileId: string, scope: McpScope, server: McpServer, previousName?: string) =>
        invoke('mcp:save', profileId, scope, server, ...(previousName ? [previousName] : [])),
      remove: (profileId: string, scope: McpScope, name: string) =>
        invoke('mcp:remove', profileId, scope, name),
      setEnabled: (profileId: string, scope: McpScope, name: string, enabled: boolean) =>
        invoke('mcp:setEnabled', profileId, scope, name, enabled),
      /** « Tester » un serveur (fiche 060). */
      test: (profileId: string, scope: McpScope, name: string) =>
        invoke('mcp:test', profileId, scope, name),
      /** Outils de Bobine, par famille (fiche 099). */
      appTools: () => invoke('mcp:appTools'),
      /** Coupe ou rallume une famille d'outils de Bobine (fiche 109). */
      setAppToolFamily: (id: string, enabled: boolean) =>
        invoke('mcp:setAppToolFamily', id, enabled)
    },
    /**
     * Règles d'approbation globales d'un agent (fiche 215, ADR-0044 ; Bob : celles de Bob IDE et
     * Bob Shell). Écriture sur une action explicite de l'utilisateur seulement.
     */
    approvalRules: {
      get: (profileId: string) => invoke('approvalRules:get', profileId),
      change: (profileId: string, change: ApprovalRulesChange) =>
        invoke('approvalRules:change', profileId, change),
      /** « Ouvrir le fichier » des règles (désigné par le profil, jamais par un chemin). */
      open: (profileId: string) => invoke('approvalRules:open', profileId)
    },
    /** Fournisseurs de modèles des agents (fiche 104). */
    providers: {
      list: () => invoke('providers:list'),
      save: (profileId: string, provider: ModelProvider, previousId?: string) =>
        invoke('providers:save', profileId, provider, ...(previousId ? [previousId] : [])),
      remove: (profileId: string, id: string) => invoke('providers:remove', profileId, id),
      setEnabled: (profileId: string, id: string, enabled: boolean) =>
        invoke('providers:setEnabled', profileId, id, enabled),
      setOnly: (profileId: string, only: boolean) => invoke('providers:setOnly', profileId, only),
      setKey: (profileId: string, id: string, value: string) =>
        invoke('providers:setKey', profileId, id, value),
      removeKey: (profileId: string, id: string) => invoke('providers:removeKey', profileId, id),
      /** « Tester » : `GET /models` avec la clé, dans les conditions réseau des agents. */
      test: (profileId: string, id: string) => invoke('providers:test', profileId, id),
      /** Groupe du Diagnostic : une ligne par fournisseur activé. */
      diagnose: () => invoke('providers:diagnose')
    },
    /** Fenêtre rapide (fiche 062). */
    quick: {
      info: () => invoke('quick:info'),
      send: (text: string, attachments: PromptAttachment[]) =>
        invoke('quick:send', text, attachments),
      hide: () => invoke('quick:hide'),
      resize: (height: number) => invoke('quick:resize', height),
      onShown: (listener: () => void) => subscribe('quick:shown', () => listener())
    },
    /** Fait entendre un son du système (fiche 068). */
    sound: {
      preview: (sound: string) => invoke('sound:preview', sound)
    },
    /** Capture d'une zone de l'écran (fiche 062) ; `null` si annulée ; empêchement (fiche 124). */
    capture: {
      screen: () => invoke('capture:screen'),
      openSettings: () => invoke('capture:openSettings')
    },
    /** Diagnostic (fiche 061). */
    /** Journal (fiche 080) : niveau réglable à chaud, fichiers. */
    log: {
      status: () => invoke('log:status'),
      setLevel: (level: Verbosity) => invoke('log:setLevel', level),
      open: (file: 'main' | 'agents') => invoke('log:open', file),
      reveal: (file: 'main' | 'agents') => invoke('log:reveal', file)
    },
    /** Échanges ACP bruts d'une conversation (fiche 135). */
    acp: {
      watch: (id: string) => invoke('acp:watch', id),
      unwatch: (id: string) => invoke('acp:unwatch', id),
      onMessages: (listener: (batch: IpcEventContract['acp:messages']) => void) =>
        subscribe('acp:messages', listener)
    },
    diagnostics: {
      system: () => invoke('diagnostics:system'),
      agent: (profileId: string, trySession = false) =>
        invoke('diagnostics:agent', profileId, trySession)
    },
    conversations: {
      get: () => invoke('conversations:get'),
      view: (id: string) => invoke('conversation:view', id),
      select: (id: string) => invoke('conversation:select', id),
      create: (request: AgentConfigureRequest = {}) => invoke('conversation:create', request),
      rename: (id: string, title: string) => invoke('conversation:rename', id, title),
      createWorktree: (id: string) => invoke('conversation:createWorktree', id),
      startChild: (id: string, request: IpcArgs<'conversation:startChild'>[1]) =>
        invoke('conversation:startChild', id, request),
      childCapacity: (id: string) => invoke('conversation:childCapacity', id),
      startReview: (id: string, request: IpcArgs<'conversation:startReview'>[1]) =>
        invoke('conversation:startReview', id, request),
      childLaunches: () => invoke('conversation:childLaunches'),
      onChildLaunches: (
        listener: (state: IpcEventContract['conversation:childLaunchesChanged']) => void
      ) => subscribe('conversation:childLaunchesChanged', listener),
      worktreeStatus: (id: string) => invoke('conversation:worktreeStatus', id),
      open: (id: string) => invoke('conversation:open', id),
      release: (id: string) => invoke('conversation:release', id),
      archive: (id: string, archived: boolean) => invoke('conversation:archive', id, archived),
      /** Repartir d'un message (fiche 023) : aperçu des fichiers, puis branche. */
      branchPreview: (id: string, itemId: number) =>
        invoke('conversation:branchPreview', id, itemId),
      /** Continuer avec un autre agent (fiche 108) : agents proposés, puis la bascule. */
      handoverTargets: (id: string) => invoke('conversation:handoverTargets', id),
      continueWith: (id: string, profileId: string, model?: string) =>
        invoke('conversation:continueWith', id, profileId, ...(model ? [model] : [])),
      /** Règles actives de la conversation (fiche 056). */
      rules: (id: string) => invoke('conversation:rules', id),
      /** Outils de Bobine que reçoit la conversation (fiche 099). */
      appTools: (id: string) => invoke('conversation:appTools', id),
      /** Reprend une session de l'agent (fiche 055). */
      resumeSession: (profileId: string, session: AgentSessionView) =>
        invoke('conversation:resumeSession', profileId, session),
      /** Travail d'un sous-agent, rejoué à part (fiche 053). */
      subagentWork: (id: string, toolCallId: string) =>
        invoke('conversation:subagentWork', id, toolCallId),
      branch: (id: string, itemId: number, text: string, options?: { restoreFiles?: boolean }) =>
        invoke('conversation:branch', id, itemId, text, ...(options ? [options] : [])),
      approveWorktreeSetup: (id: string, signature: string) =>
        invoke('conversation:approveWorktreeSetup', id, signature),
      skipWorktreeSetup: (id: string) => invoke('conversation:skipWorktreeSetup', id),
      stopWorktreeSetup: (id: string) => invoke('conversation:stopWorktreeSetup', id),
      delete: (id: string, options?: { fromAgent?: boolean; removeWorktree?: boolean }) =>
        invoke('conversation:delete', id, ...(options ? [options] : [])),
      pin: (id: string, pinned: boolean) => invoke('conversation:pin', id, pinned),
      /** Autres dossiers de la conversation (fiche 179). */
      addFolder: (id: string) => invoke('conversation:addFolder', id),
      removeFolder: (id: string, folder: string) => invoke('conversation:removeFolder', id, folder),
      /** Plafond de coût de la conversation, `null` : celui des réglages (fiche 157). */
      setCostCap: (id: string, cap: ConversationCap | null) =>
        invoke('conversation:setCostCap', id, cap),
      answerCostCap: (id: string, itemId: number, answer: CostCapAnswer) =>
        invoke('conversation:answerCostCap', id, itemId, answer),
      /** Réponse à la carte « limite d'étapes » (fiche 209). */
      answerTurnLimit: (id: string, itemId: number, answer: TurnLimitAnswer) =>
        invoke('conversation:answerTurnLimit', id, itemId, answer),
      /** Export en Markdown ou JSON (fiche 043) : chemin du fichier écrit, `null` si annulé. */
      export: (id: string, format: ExportFormat) => invoke('conversation:export', id, format),
      search: (query: string) => invoke('conversations:search', query),
      /** Liste mise à jour (titres, statuts, nouvelle conversation…). */
      onChanged: (listener: (state: IpcEventContract['conversations:changed']) => void) =>
        subscribe('conversations:changed', listener)
    },
    agent: {
      /** Sessions gardées par l'agent, absentes de l'historique (fiche 055). */
      listSessions: (profileId: string, only?: string) =>
        invoke('agent:listSessions', profileId, ...(only ? [only] : [])),
      prompt: (
        id: string,
        text: string,
        attachments?: PromptAttachment[],
        options?: PromptRequest
      ) => invoke('agent:prompt', id, text, attachments, options),
      unqueue: (id: string, messageId: string) => invoke('agent:unqueue', id, messageId),
      sendNow: (id: string, messageId: string) => invoke('agent:sendNow', id, messageId),
      cancel: (id: string) => invoke('agent:cancel', id),
      retryTurn: (id: string) => invoke('agent:retryTurn', id),
      restart: (id: string) => invoke('agent:restart', id),
      respondPermission: (id: string, requestId: string, optionId: string | null) =>
        invoke('agent:respondPermission', id, requestId, optionId),
      respondElicitation: (id: string, requestId: string, answer: ElicitationAnswer) =>
        invoke('agent:respondElicitation', id, requestId, answer),
      authenticate: (id: string, methodId: string) => invoke('agent:authenticate', id, methodId),
      retrySession: (id: string) => invoke('agent:retrySession', id),
      useApiKey: (id: string, env: string, value: string) =>
        invoke('agent:useApiKey', id, env, value),
      runStep: (id: string, stepId: string) => invoke('agent:runStep', id, stepId),
      trustForSession: (id: string) => invoke('agent:trustForSession', id),
      setControl: (id: string, controlId: string, value: ControlValue) =>
        invoke('agent:setControl', id, controlId, value),
      configure: (id: string, request: AgentConfigureRequest) =>
        invoke('agent:configure', id, request),
      /** Événements de tous les agents, chacun rattaché à sa conversation. */
      onEvent: (listener: (payload: IpcEventContract['agent:event']) => void) =>
        subscribe('agent:event', listener)
    },
    settings: {
      get: () => invoke('settings:get'),
      setNotifications: (enabled: boolean) => invoke('settings:setNotifications', enabled),
      setPreferences: (change: Partial<Preferences>) => invoke('settings:setPreferences', change),
      /** Commandes « / » personnelles (fiche 045). */
      setCommands: (commands: UserCommand[]) => invoke('settings:setCommands', commands),
      forgetWorkspace: (workspace: string) => invoke('settings:forgetWorkspace', workspace),
      setNewConversation: (defaults: NewConversationDefaults) =>
        invoke('settings:setNewConversation', defaults),
      forgetTool: (profileId: string, tool: string) =>
        invoke('settings:forgetTool', profileId, tool),
      /** Site ou commande « toujours autorisés » oubliés (fiche 072). */
      forgetSite: (site: string) => invoke('settings:forgetSite', site),
      forgetCommand: (workspace: string, command: string) =>
        invoke('settings:forgetCommand', workspace, command),
      forgetWorktreeSetup: (root: string) => invoke('settings:forgetWorktreeSetup', root),
      /** Relit le PATH du shell de connexion (agent installé mais introuvable, fiche 043). */
      reloadShellEnv: () => invoke('settings:reloadShellEnv'),
      setApiKey: (profileId: string, env: string, value: string) =>
        invoke('settings:setApiKey', profileId, env, value),
      removeApiKey: (profileId: string, env: string) =>
        invoke('settings:removeApiKey', profileId, env),
      /** Agents ACP déclarés (fiche 141). */
      saveCustomAgent: (draft: CustomAgentDraft, id?: string) =>
        invoke('settings:saveCustomAgent', draft, id),
      removeCustomAgent: (id: string) => invoke('settings:removeCustomAgent', id),
      /** Réseau d'entreprise : proxy, certificats (fiche 104). */
      network: () => invoke('settings:network'),
      setNetwork: (change: NetworkSettings) => invoke('settings:setNetwork', change),
      onChanged: (listener: (settings: IpcEventContract['settings:changed']) => void) =>
        subscribe('settings:changed', listener)
    },
    /** Récapitulatif des modifications (fiche 021). */
    /** Commandes du projet (fiche 045). */
    commands: {
      project: (id: string) => invoke('commands:project', id)
    },
    /** Branche du dossier de la conversation (fiches 037 et 049). */
    git: {
      status: (id: string) => invoke('git:status', id)
    },
    changes: {
      git: (id: string) => invoke('changes:git', id),
      gitFile: (id: string, path: string, from?: string) =>
        invoke('changes:gitFile', id, path, ...(from ? [from] : [])),
      open: (id: string, path: string) => invoke('changes:open', id, path),
      reveal: (id: string, path: string) => invoke('changes:reveal', id, path),
      /** Annule une modification de l'agent sur ce fichier (fiche 043). */
      revert: (id: string, path: string) => invoke('changes:revert', id, path),
      /** « Committer » hors worktree (fiche 123), dans le dossier de la conversation. */
      commit: (id: string, request: { message: string; files: string[] }) =>
        invoke('changes:commit', id, request),
      undoCommit: (id: string, hash: string) => invoke('changes:undoCommit', id, hash)
    },
    /** Cycle complet d'un worktree (fiche 110) : commit, PR, fusion, nettoyage, orphelins. */
    worktree: {
      info: (id: string, options?: { fresh?: boolean }) =>
        invoke('worktree:info', id, ...(options ? [options] : [])),
      commit: (id: string, request: { message: string; files: string[] }) =>
        invoke('worktree:commit', id, request),
      undoCommit: (id: string, hash: string) => invoke('worktree:undoCommit', id, hash),
      merge: (id: string, options?: { stash?: boolean }) =>
        invoke('worktree:merge', id, ...(options ? [options] : [])),
      mergeContinue: (id: string, options?: { stash?: boolean }) =>
        invoke('worktree:mergeContinue', id, ...(options ? [options] : [])),
      /** « Committer d'abord » dans le dossier principal (fiche 123). */
      commitMain: (id: string, request: { message: string; files: string[] }) =>
        invoke('worktree:commitMain', id, request),
      mergeAbort: (id: string) => invoke('worktree:mergeAbort', id),
      resolveWithAgent: (id: string, options?: { stash?: boolean }) =>
        invoke('worktree:resolveWithAgent', id, ...(options ? [options] : [])),
      pullRequest: (id: string, request: { title: string; body: string }) =>
        invoke('worktree:pullRequest', id, request),
      cleanup: (id: string) => invoke('worktree:cleanup', id),
      orphans: () => invoke('worktree:orphans'),
      removeOrphan: (orphan: { root: string; path: string; branch: string }) =>
        invoke('worktree:removeOrphan', orphan),
      /** La forge a répondu après coup (hôte lent) : l'état est à relire (fiche 189). */
      onForge: (listener: (change: IpcEventContract['worktree:forge']) => void) =>
        subscribe('worktree:forge', listener)
    },
    /** Suivi de la PR et de la CI d'une conversation en worktree (fiche 176). */
    pr: {
      status: (id: string) => invoke('pr:status', id),
      refresh: (id: string) => invoke('pr:refresh', id),
      setOptions: (id: string, options: { autoFix?: boolean; autoMerge?: boolean }) =>
        invoke('pr:options', id, options),
      fixChecks: (id: string) => invoke('pr:fixChecks', id),
      mergeNow: (id: string) => invoke('pr:mergeNow', id),
      onChanged: (listener: (change: IpcEventContract['pr:changed']) => void) =>
        subscribe('pr:changed', listener)
    },
    /** Fusion de toutes les filles finies depuis la carte « Sous-tâches » (fiche 120). */
    children: {
      mergePlan: (motherId: string) => invoke('children:mergePlan', motherId),
      merge: (motherId: string, ids: string[], options: { cleanup: boolean; stash?: boolean }) =>
        invoke('children:merge', motherId, ids, options),
      mergeStop: (motherId: string) => invoke('children:mergeStop', motherId),
      commitMain: (motherId: string, request: { message: string; files: string[] }) =>
        invoke('children:commitMain', motherId, request)
    },
    /** Aparté : question à côté, hors du fil (fiche 180). */
    /** Accueil du premier lancement (fiche 188). */
    onboarding: {
      state: () => invoke('onboarding:state'),
      check: (request: CheckRequest) => invoke('onboarding:check', request),
      cancel: () => invoke('onboarding:cancel'),
      finish: (outcome: 'finished' | 'skipped') => invoke('onboarding:finish', outcome),
      runStep: (id: string, profileId: string, stepId: string) =>
        invoke('onboarding:runStep', id, profileId, stepId),
      trialFolder: () => invoke('onboarding:trialFolder'),
      hints: (id: string) => invoke('onboarding:hints', id)
    },
    aside: {
      ask: (id: string, request: AsideRequest) => invoke('aside:ask', id, request),
      close: (id: string) => invoke('aside:close', id),
      view: (id: string) => invoke('aside:view', id),
      onChanged: (listener: (view: IpcEventContract['aside:changed']) => void) =>
        subscribe('aside:changed', listener)
    },
    /** Rôles (fiche 223) : Réglages › Rôles, menu `@`, assistant de création (phase 3). */
    roles: {
      list: (conversationId?: string) =>
        invoke('roles:list', ...(conversationId !== undefined ? [conversationId] : [])),
      read: (scope: IpcArgs<'roles:read'>[0], name: string, conversationId?: string) =>
        invoke(
          'roles:read',
          scope,
          name,
          ...(conversationId !== undefined ? [conversationId] : [])
        ),
      save: (
        scope: IpcArgs<'roles:save'>[0],
        role: IpcArgs<'roles:save'>[1],
        options?: IpcArgs<'roles:save'>[2]
      ) => invoke('roles:save', scope, role, ...(options !== undefined ? [options] : [])),
      setEnabled: (name: string, enabled: boolean) => invoke('roles:setEnabled', name, enabled),
      remove: (scope: IpcArgs<'roles:remove'>[0], name: string, conversationId?: string) =>
        invoke(
          'roles:remove',
          scope,
          name,
          ...(conversationId !== undefined ? [conversationId] : [])
        ),
      /** `@rôle …` de la saisie : une fille par rôle cité (phase 3B). */
      startChildren: (conversationId: string, request: IpcArgs<'roles:startChildren'>[1]) =>
        invoke('roles:startChildren', conversationId, request),
      /** « Installer dans… » un agent (phase 4, ADR-0047). */
      exportPreview: (role: IpcArgs<'roles:exportPreview'>[0], profileId: string) =>
        invoke('roles:exportPreview', role, profileId),
      export: (
        role: IpcArgs<'roles:export'>[0],
        target: IpcArgs<'roles:export'>[1],
        options: IpcArgs<'roles:export'>[2]
      ) => invoke('roles:export', role, target, options),
      exportStatus: (role: IpcArgs<'roles:exportStatus'>[0]) => invoke('roles:exportStatus', role),
      exportRemove: (key: string, force?: boolean) =>
        invoke('roles:exportRemove', key, ...(force !== undefined ? [force] : []))
    },
    /** Mémoire commune aux agents (fiche 182) : carte du fil, Réglages › Mémoire. */
    memory: {
      decide: (decision: MemoryDecision) => invoke('memory:decide', decision),
      projects: (workspace?: string) =>
        invoke('memory:projects', ...(workspace !== undefined ? [workspace] : [])),
      list: (place: MemoryPlace) => invoke('memory:list', place),
      save: (place: MemoryPlace, entry: IpcArgs<'memory:save'>[1], expected: string | null) =>
        invoke('memory:save', place, entry, expected),
      remove: (place: MemoryPlace, name: string, expected?: string) =>
        invoke('memory:remove', place, name, ...(expected !== undefined ? [expected] : [])),
      clear: (place: MemoryPlace) => invoke('memory:clear', place),
      approve: (place: MemoryPlace, name: string, version: string) =>
        invoke('memory:approve', place, name, version),
      move: (from: MemoryPlace, to: MemoryPlace, name: string, expected?: string) =>
        invoke('memory:move', from, to, name, ...(expected !== undefined ? [expected] : [])),
      attach: (projectId: string) => invoke('memory:attach', projectId),
      exportTo: (place: MemoryPlace) => invoke('memory:export', place),
      reveal: (place: MemoryPlace) => invoke('memory:reveal', place)
    },
    /** Liens de fichiers dans la conversation (fiche 052). */
    fileLinks: {
      open: (id: string, href: string, options?: { base?: string; reveal?: boolean }) =>
        invoke('files:openLink', id, href, ...(options ? [options] : [])),
      readMarkdown: (id: string, path: string) => invoke('files:readMarkdown', id, path)
    },
    /** Éditeur de l'utilisateur (fiche 156) : installés, et ouvrir un fichier à la ligne. */
    editors: {
      list: () => invoke('editors:list'),
      open: (
        id: string,
        editorId: string,
        path: string,
        options?: { line?: number; base?: string }
      ) => invoke('editors:open', id, editorId, path, ...(options ? [options] : [])),
      openText: (id: string, editorId: string, text: string) =>
        invoke('editors:openText', id, editorId, text)
    },
    /** Glisser une image du fil vers le Finder (fiche 156). */
    images: {
      startDrag: (image: DraggedImage) => invoke('images:startDrag', image)
    },
    /** Conversations qui attendent l'utilisateur (fiche 024). */
    attention: {
      get: () => invoke('attention:get'),
      /** Raison de chaque attente, pour la section « À traiter » (fiche 119). */
      details: () => invoke('attention:details'),
      onDetails: (listener: (details: IpcEventContract['attention:detailsChanged']) => void) =>
        subscribe('attention:detailsChanged', listener),
      /** Refus des notifications par macOS, et réglages du système. */
      notificationStatus: () => invoke('notifications:status'),
      onNotificationStatus: (
        listener: (status: IpcEventContract['notifications:status']) => void
      ) => subscribe('notifications:status', listener),
      openNotificationSettings: () => invoke('notifications:openSettings'),
      onChanged: (listener: (state: IpcEventContract['attention:changed']) => void) =>
        subscribe('attention:changed', listener)
    },
    workspace: {
      /** Dialogue natif ; renvoie le dossier choisi ou `null`. */
      choose: () => invoke('workspace:choose'),
      /** Ouvre Terminal.app dans le dossier de la conversation. */
      openTerminal: (id: string) => invoke('workspace:openTerminal', id),
      searchFiles: (id: string, query: string) => invoke('workspace:searchFiles', id, query),
      pickFiles: (id: string) => invoke('workspace:pickFiles', id),
      /** Chemins exclus par l'agent (`.bobignore`…), avant de les joindre (fiche 155). */
      excludedPaths: (id: string, paths: string[]) => invoke('workspace:excludedPaths', id, paths)
    },
    /** Navigateur intégré du panneau (fiche 007). */
    browser: {
      show: (id: string, bounds: BrowserBounds) => invoke('browser:show', id, bounds),
      hide: () => invoke('browser:hide'),
      /** « Effacer les données du navigateur » (fiche 072). */
      clearData: () => invoke('browser:clearData'),
      navigate: (id: string, input: string) => invoke('browser:navigate', id, input),
      /** Image de la page affichée, à joindre au message (fiche 066). */
      capture: (id: string) => invoke('browser:capture', id),
      go: (id: string, action: BrowserGo) => invoke('browser:go', id, action),
      getState: (id: string) => invoke('browser:getState', id),
      selectTab: (id: string, tabId: string) => invoke('browser:selectTab', id, tabId),
      closeTab: (id: string, tabId: string) => invoke('browser:closeTab', id, tabId),
      onState: (listener: (state: IpcEventContract['browser:state']) => void) =>
        subscribe('browser:state', listener),
      /** Téléchargement enregistré ou en échec (fiche 094), et « Afficher dans le Finder ». */
      onDownload: (listener: (download: IpcEventContract['browser:download']) => void) =>
        subscribe('browser:download', listener),
      showDownload: (id: string, path: string) => invoke('browser:showDownload', id, path),
      /** Zoom de la page et taille imposée par l'agent (fiche 129). */
      zoom: (id: string, action: BrowserZoom) => invoke('browser:zoom', id, action),
      clearEmulation: (id: string) => invoke('browser:clearEmulation', id),
      /** Page figée pour l'annoter (fiche 132). */
      freeze: (id: string) => invoke('browser:freeze', id),
      noteShot: (id: string) => invoke('browser:noteShot', id),
      annotate: (id: string, on: boolean, theme: PageLayerTheme | null) =>
        invoke('browser:annotate', id, on, theme),
      pagePins: (id: string, pins: PagePin[]) => invoke('browser:pagePins', id, pins),
      /** ⌘L tapé dans la page (fiche 129). */
      onCommand: (listener: (command: IpcEventContract['browser:command']) => void) =>
        subscribe('browser:command', listener),
      /** Clic ou épingle dans la page en mode Annoter (fiche 146). */
      onAnnotate: (listener: (event: IpcEventContract['browser:annotate']) => void) =>
        subscribe('browser:annotate', listener)
    },
    /** Simulateur iOS de la conversation (fiche 008). */
    simulator: {
      getState: (id: string) => invoke('simulator:getState', id),
      screenshot: (id: string) => invoke('simulator:screenshot', id),
      tap: (id: string, x: number, y: number) => invoke('simulator:tap', id, x, y),
      swipe: (
        id: string,
        from: { x: number; y: number },
        to: { x: number; y: number },
        duration: number
      ) => invoke('simulator:swipe', id, from.x, from.y, to.x, to.y, duration),
      button: (id: string, button: string) => invoke('simulator:button', id, button),
      onState: (listener: (state: IpcEventContract['simulator:state']) => void) =>
        subscribe('simulator:state', listener),
      startStream: (id: string) => invoke('simulator:startStream', id),
      stopStream: () => invoke('simulator:stopStream'),
      onFrame: (listener: (frame: IpcEventContract['simulator:frame']) => void) =>
        subscribe('simulator:frame', listener),
      onStreamEnded: (listener: (end: IpcEventContract['simulator:streamEnded']) => void) =>
        subscribe('simulator:streamEnded', listener)
    },
    /** Terminaux de la conversation (fiche 034). */
    terminal: {
      list: (id: string) => invoke('terminal:list', id),
      create: (id: string, cols: number, rows: number) => invoke('terminal:create', id, cols, rows),
      write: (id: string, tabId: string, data: string) => invoke('terminal:write', id, tabId, data),
      resize: (id: string, tabId: string, cols: number, rows: number) =>
        invoke('terminal:resize', id, tabId, cols, rows),
      close: (id: string, tabId: string) => invoke('terminal:close', id, tabId),
      /** Arrête la commande au premier plan ; l'onglet reste (fiche 166). */
      stop: (id: string, tabId: string) => invoke('terminal:stop', id, tabId),
      snapshot: (id: string, tabId: string) => invoke('terminal:snapshot', id, tabId),
      onData: (listener: (data: IpcEventContract['terminal:data']) => void) =>
        subscribe('terminal:data', listener),
      onChanged: (listener: (change: IpcEventContract['terminal:changed']) => void) =>
        subscribe('terminal:changed', listener)
    },
    /** Émulateur Android de la conversation (fiche 032). */
    android: {
      getState: (id: string) => invoke('android:getState', id),
      screenshot: (id: string) => invoke('android:screenshot', id),
      tap: (id: string, x: number, y: number, holdMs?: number) =>
        invoke('android:tap', id, x, y, holdMs),
      swipe: (
        id: string,
        from: { x: number; y: number },
        to: { x: number; y: number },
        ms: number
      ) => invoke('android:swipe', id, from.x, from.y, to.x, to.y, ms),
      key: (id: string, key: string) => invoke('android:key', id, key),
      startStream: (id: string) => invoke('android:startStream', id),
      stopStream: () => invoke('android:stopStream'),
      onState: (listener: (state: IpcEventContract['android:state']) => void) =>
        subscribe('android:state', listener),
      onFrame: (listener: (frame: IpcEventContract['android:frame']) => void) =>
        subscribe('android:frame', listener),
      onStreamEnded: (listener: (end: IpcEventContract['android:streamEnded']) => void) =>
        subscribe('android:streamEnded', listener)
    },
    /** Serveurs de dev du projet (fiche 030). */
    preview: {
      list: (id: string) => invoke('preview:list', id),
      stop: (id: string, name: string) => invoke('preview:stop', id, name),
      logs: (id: string, name: string) => invoke('preview:logs', id, name),
      onChanged: (listener: (change: IpcEventContract['preview:changed']) => void) =>
        subscribe('preview:changed', listener)
    }
  }
}

export type BobApi = ReturnType<typeof createApi>

/**
 * API de la fenêtre d'aide (fiche 186) : le strict nécessaire à cette vue (langue, apparence,
 * erreurs, aide), réglages en lecture seule. Le reste de l'app (agents, fichiers, terminal…) n'y
 * est pas exposé : une page du guide ne peut rien appeler d'autre.
 */
export function helpViewApi(api: BobApi) {
  const { app, settings, help } = api
  return {
    app: {
      language: app.language,
      features: app.features,
      onLanguage: app.onLanguage,
      presentation: app.presentation,
      onPresentation: app.onPresentation,
      reportError: app.reportError,
      showLog: app.showLog
    },
    settings: { get: settings.get, onChanged: settings.onChanged },
    help: {
      target: help.target,
      showChangelog: help.showChangelog,
      onNavigate: help.onNavigate,
      onFocusSearch: help.onFocusSearch
    }
  }
}
export type HelpViewApi = ReturnType<typeof helpViewApi>
