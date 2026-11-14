import {
  isTipId,
  localDay,
  TIP_ACTIONS,
  TIP_QUIET_MS,
  type TipsState,
  type TipsView
} from '@shared/tips'
import {
  parseAttachments,
  type PromptAttachment,
  type ScreenCaptureResult,
  type WorkspaceFile
} from '@shared/attachments'
import { exclusionsFor } from './agent-config/exclusions'
import { worktreeSetupHandlers, type WorktreeSetupControl } from './changes/worktree-setup-ipc'
import { deviceHandlers, type AndroidController, type SimulatorController } from './device-ipc'
import type { AttentionDetails, AttentionState, NotificationStatus } from '@shared/attention'
import type { GitStatus } from '@shared/git'
import type { UserCommand } from '@shared/user-commands'
import type { BrowserController } from './browser/browser-controller'
import { browserHandlers } from './browser/browser-ipc'
import type { GitChangesReader } from './changes/git'
import { insideWorkspace } from './changes/git'
import { openFileLink, openWorkspaceFile } from './files/file-links'
import { webLinkTarget } from '@shared/file-links'
import { threadHandlers, type ThreadIpcDeps } from './thread-ipc'
import {
  IPC_CHANNELS,
  type IpcEventChannel,
  type IpcEventContract,
  type IpcHandlers
} from '@shared/ipc'
import type { AgentConfigureRequest, AgentSessionView, ElicitationAnswer } from '@shared/agent'
import { parsePromptRequest } from '@shared/agent'
import type { ConversationManager } from './conversations/manager'
import { childHandlers, type ChildConversations } from './conversations/children'
import { reviewHandlers } from './conversations/children-review'
import { worktreeHandlers, type WorktreeCycleDeps } from './changes/worktree-ipc'
import { childrenMergeHandlers } from './conversations/children-merge-ipc'
import { asideHandlers } from './conversations/aside-ipc'
import { onboardingHandlers, type OnboardingIpc } from './onboarding/onboarding-ipc'
import { Asides, type AsideConversations } from './conversations/aside'
import type { ChildrenMerger } from './conversations/children-merge'
import { handoverHandlers } from './conversations/handover'
import { costCapHandlers, type CostCapGuard } from './conversations/cost-cap'
import { turnLimitHandlers } from './conversations/turn-limit'
import { scheduleHandlers } from './scheduler/scheduler-ipc'
import { profileHandlers, type ProfileIpcDeps } from './profile-ipc'
import { translate } from '@shared/i18n/message'
import { plainError } from './profile-status'
import { mcpHandlers } from './agent-config/mcp-ipc'
import {
  approvalRulesHandlers,
  type ApprovalRulesSettings
} from './agent-config/approval-rules-settings'
import {
  providersHandlers,
  type NetworkController,
  type ProvidersController
} from './agent-config/providers-ipc'
import type { SettingsStore } from './settings-store'
import type { DevServers } from './preview/dev-servers'
import type { TerminalManager } from './terminal/terminal-manager'
import { log } from './log'
import { messageOf } from '@shared/errors'
import type { McpSettings } from './agent-config/mcp-settings'
import type { ApprovalStore } from './approvals'
import { appHandlers, type AppIpcDeps } from './app-ipc'
import { acpExchanges, type AcpExchanges } from './agent/acp-exchanges'
import { acpExchangeHandlers } from './agent/acp-exchanges-ipc'
import { diagnosticsHandlers, type DiagnosticsIpcDeps } from './diagnostics-ipc'
import type { QuickEntryInfo } from '@shared/quick-entry'
import { ATTENTION_SOUNDS } from '@shared/preferences'
import { usageHandlers, type UsageIpcDeps } from './usage/usage-ipc'
import { exportConversation, exportFileName, type ExportFormat } from '@shared/export'
import { writeFile } from 'node:fs/promises'
import { t } from 'i18next'
import { folderHandlers } from './conversations/additional-directories-ipc'
import { memoryHandlers, type MemoryIpcDeps } from './memory/memory-ipc'
import type { MemoryService } from './memory/service'
import { rolesHandlers, type RolesIpcDeps } from './roles/ipc'

/** Sous-ensemble d'`ipcMain` dont on a besoin : permet de tester sans Electron. */
/** Envoie un évènement aux fenêtres de l'app (rien pendant la fermeture : à l'appelant de voir). */
export type SendEvent = <C extends IpcEventChannel>(
  channel: C,
  payload: IpcEventContract[C]
) => void

export interface IpcMainLike {
  handle(channel: string, listener: (event: IpcSenderEvent, ...args: unknown[]) => unknown): void
}

/** Ce qui identifie l'émetteur d'un appel (`IpcMainInvokeEvent` d'Electron, a minima). */
export interface IpcSenderEvent {
  /** `webContents` qui appelle. */
  sender: object
  /** Cadre qui appelle (principal ou `iframe`), `null` s'il a disparu. */
  senderFrame: object | null
}

export interface RegisterOptions {
  /** L'appel vient-il d'une fenêtre de l'app (fiche 114) ? Sinon : journal, erreur, rien d'appelé. */
  trusted: (event: IpcSenderEvent) => boolean
}

/** Ce dont les handlers ont besoin (implémenté par ConversationManager). */
export type ConversationController = Pick<
  ConversationManager,
  | 'state'
  | 'view'
  | 'subagentWork'
  | 'rules'
  | 'readDocument'
  | 'agentSessions'
  | 'resumeSession'
  | 'select'
  | 'create'
  | 'configure'
  | 'rename'
  | 'delete'
  | 'prompt'
  | 'cancel'
  | 'retryTurn'
  | 'answerTurnLimit'
  | 'unqueue'
  | 'sendNow'
  | 'restart'
  | 'respondPermission'
  | 'respondElicitation'
  | 'authenticate'
  | 'retrySession'
  | 'useApiKey'
  | 'stepCommand'
  | 'trustForSession'
  | 'workspaceOf'
  | 'profileOf'
  | 'readFolder'
  | 'setControl'
  | 'settingsView'
  | 'setPinned'
  | 'updateRecord'
  | 'search'
  | 'createInWorktree'
  | 'worktreeStatus'
  | 'open'
  | 'release'
  | 'branchPreview'
  | 'setArchived'
  | 'branch'
  | 'revertFile'
  | 'settled'
  | 'appToolsCatalog'
  | 'appToolNames'
  | 'switchAgent'
  | 'ready'
  | 'post'
  | 'settings'
>

/** Réglages de l'app que les handlers changent (implémenté par SettingsStore, fiche 089). */
export type SettingsController = Pick<
  SettingsStore,
  | 'setNotifications'
  | 'setPreferences'
  | 'forgetWorkspace'
  | 'forgetTool'
  | 'setNewConversation'
  | 'setCommands'
  | 'setApiKey'
  | 'removeApiKey'
  | 'setAppToolFamily'
  | 'saveCustomAgent'
  | 'removeCustomAgent'
  | 'tips'
  | 'recordTip'
  | 'resetTips'
  | 'noteSentMessage'
  | 'tipsSince'
>

export function registerIpcHandlers(
  ipcMain: IpcMainLike,
  handlers: IpcHandlers,
  options: RegisterOptions
): void {
  for (const channel of IPC_CHANNELS) {
    const handler = handlers[channel] as (...args: unknown[]) => unknown
    // Une erreur repart vers l'interface ; elle laisse aussi une trace dans le journal.
    const report = (error: unknown): never => {
      log.warn(`IPC ${channel} :`, error)
      throw error
    }
    ipcMain.handle(channel, (event, ...args) => {
      // Défense en profondeur : seul le cadre principal d'une fenêtre de l'app appelle (fiche 114).
      if (!options.trusted(event)) {
        log.warn(`IPC ${channel} : refused, the caller is not an app window`)
        throw new Error('IPC call refused: untrusted sender')
      }
      try {
        const result = handler(...args)
        return result instanceof Promise ? result.catch(report) : result
      } catch (error) {
        return report(error)
      }
    })
  }
}

/* Les arguments IPC viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie. */

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

function int(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('Paramètre invalide : itemId')
  }
  return value
}

/** Taille de terminal valide (colonnes, lignes). */
function terminalSize(cols: unknown, rows: unknown): { cols: number; rows: number } {
  const n = (v: unknown, max: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('Paramètre invalide : taille')
    return Math.min(max, Math.max(2, Math.round(v)))
  }
  return { cols: n(cols, 1000), rows: n(rows, 500) }
}

export type { AndroidController, SimulatorController } from './device-ipc'

/** Ce que l'IPC demande au dépôt git : la branche du dossier (fiches 037 et 049). */
export interface GitController {
  status: (workspace: string) => Promise<GitStatus | null>
}

/** Session choisie dans « Reprendre une session… » (fiche 055). */
function parseAgentSession(value: unknown): AgentSessionView {
  if (typeof value !== 'object' || value === null) throw new Error('Session invalide')
  const { sessionId, cwd, title, updatedAt } = value as Record<string, unknown>
  return {
    sessionId: str(sessionId, 'sessionId'),
    cwd: str(cwd, 'cwd'),
    ...(typeof title === 'string' && title ? { title } : {}),
    ...(typeof updatedAt === 'string' && updatedAt ? { updatedAt } : {})
  }
}

function parseConfigureRequest(value: unknown): AgentConfigureRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { profileId, workspace } = value as Record<string, unknown>
  return {
    profileId: profileId === undefined ? undefined : str(profileId, 'profileId'),
    workspace: workspace === undefined ? undefined : str(workspace, 'workspace')
  }
}

function parseElicitationAnswer(value: unknown): ElicitationAnswer {
  if (typeof value !== 'object' || value === null) throw new Error('Réponse invalide')
  const { action, content } = value as Record<string, unknown>
  if (action !== 'accept' && action !== 'decline' && action !== 'cancel') {
    throw new Error('Réponse invalide')
  }
  if (
    content !== undefined &&
    (typeof content !== 'object' || content === null || Array.isArray(content))
  ) {
    throw new Error('Réponse invalide')
  }
  // Le contenu lui-même est validé contre le schéma par l'AgentHost.
  return { action, content: content as Record<string, unknown> | undefined }
}

// Nouveau canal : le ranger aussi dans `read-only-guard.ts` (sûr en lecture seule, ou il change le
// profil) ; un essai le vérifie (fiche 196).
export function createHandlers(
  deps: AppIpcDeps &
    DiagnosticsIpcDeps & {
      /** Serveurs MCP des agents (fiche 025). */
      mcp?: Pick<McpSettings, 'list' | 'save' | 'remove' | 'setEnabled' | 'test'>
      /** Règles d'approbation globales des agents (fiche 215). */
      approvalRules?: Pick<ApprovalRulesSettings, 'get' | 'change' | 'file'>
      /** Fournisseurs de modèles des agents, et réseau d'entreprise (fiche 104). */
      providers?: ProvidersController
      /** Échanges ACP en mémoire (fiche 135) ; le relevé partagé par défaut. */
      acpExchanges?: AcpExchanges
      /** Évènements pour les fenêtres : lots des échanges ACP regardés. */
      send?: SendEvent
      network?: NetworkController
      /** Relit l'environnement du shell de connexion (PATH…) ; rejette si le shell ne répond pas. */
      reloadShellEnv?: () => Promise<void>
      /** Fenêtre rapide (fiche 062, injectée : fenêtres, conversations). */
      quick?: {
        info: () => QuickEntryInfo
        send: (text: string, attachments: PromptAttachment[]) => Promise<void>
        hide: () => void
        resize: (height: number) => void
      }
      /** Joue un son du système (fiche 068). */
      playSound?: (sound: (typeof ATTENTION_SOUNDS)[number]) => void
      /** Adresse d'aperçu d'une page HTML, servie depuis son dossier (fiche 064). */
      previewHtml?: (dir: string, file: string) => Promise<string>
      /** Éditeur de l'utilisateur et glisser d'image (fiche 156). */
      thread?: ThreadIpcDeps
      /** Capture d'une zone de l'écran (fiche 062) ; `null` si annulée ; empêchement (fiche 124). */
      captureScreen?: () => Promise<ScreenCaptureResult>
      /** Ouvre le réglage « Enregistrement de l'écran » de macOS (fiche 124). */
      openCaptureSettings?: () => Promise<void>
      /** « Autoriser et lancer » la préparation d'un worktree (fiche 175). */
      worktreeSetup?: WorktreeSetupControl
      /** Sites et commandes « toujours autorisés » (fiche 072). */
      approvals?: Pick<ApprovalStore, 'forgetSite' | 'forgetCommand' | 'forgetWorktreeSetup'>
      /** Quotas des agents (fiche 091) : derniers lus, et relecture en tâche de fond. */
      quotas?: UsageIpcDeps['quotas']
      /** Tableau de consommation (fiche 137) et « Enregistrer sous » de son export CSV. */
      usage?: UsageIpcDeps['board']
      saveCsv?: UsageIpcDeps['saveCsv']
      conversations: ConversationController
      /** Conversations filles (fiche 097). */
      children?: Pick<ChildConversations, 'start' | 'capacity' | 'launchState' | 'reviews'>
      /** Cycle complet d'un worktree (fiche 110). */
      worktree?: WorktreeCycleDeps
      /** Fusion de toutes les filles finies (fiche 120). */
      childrenMerge?: Pick<ChildrenMerger, 'plan' | 'start' | 'stop' | 'commitMain'>
      /** Aparté (fiche 180) : ce qu'il demande aux conversations ; sa vue part par `send`. */
      asides?: AsideConversations
      /** Accueil du premier lancement (fiche 188). */
      onboarding?: OnboardingIpc
      /** Plafond de coût des conversations (fiche 157). */
      costCap?: Pick<CostCapGuard, 'setCap' | 'answer'>
      /** Mémoire commune aux agents (fiche 182) et ses dialogues. */
      memory?: MemoryService
      memoryIpc?: MemoryIpcDeps
      /** Rôles (fiche 223). */
      roles?: RolesIpcDeps
      /** Tâches planifiées (fiche 178). */
      scheduler?: Parameters<typeof scheduleHandlers>[0]
      /** Intégrité du profil : avis, corbeille, restauration (fiches 196, 197). */
      profile?: ProfileIpcDeps
      /** Réglages de l'app ; la vue rendue après un changement vient des conversations. */
      settings: SettingsController
      /** Dialogue natif de choix de dossier (injecté : testable sans Electron). */
      chooseDirectory: (options?: { title: string; buttonLabel: string }) => Promise<string | null>
      /** Dialogue natif d'enregistrement pour l'export (injecté) : chemin choisi, ou `null`. */
      saveFile?: (defaultName: string, format: ExportFormat) => Promise<string | null>
      /** Écriture de l'export (injectée pour les tests ; `writeFile` sinon). */
      writeExport?: (path: string, content: string) => Promise<void>
      /** Sauvegarde de l'historique dans ce dossier (fiche 043) ; rend le dossier créé. */
      backupHistory?: (targetDir: string) => Promise<string>
      /** Ouvre un terminal dans un dossier (injecté). */
      openTerminal: (path: string) => Promise<void>
      /** Dialogue natif de choix de fichiers, ouvert dans un dossier (injecté). */
      chooseFiles: (defaultPath: string) => Promise<string[]>
      /** Recherche de fichiers dans un dossier (injectée). */
      searchFiles: (
        root: string,
        query: string,
        limit?: number,
        isExcluded?: (path: string) => Promise<boolean>
      ) => Promise<WorkspaceFile[]>
      /** Navigateur intégré (injecté : Electron). */
      browser: BrowserController
      /** Serveurs de dev lancés par l'app (fiche 030). */
      devServers: Pick<DevServers, 'list' | 'stop' | 'logs'>
      /** Simulateur iOS (fiche 008, injecté). */
      simulator: SimulatorController
      /** Émulateur Android (fiche 032, injecté). */
      android: AndroidController
      /** Terminaux (fiche 034). */
      terminals: Pick<
        TerminalManager,
        'list' | 'create' | 'write' | 'resize' | 'close' | 'stop' | 'snapshot' | 'run'
      >
      /** Conversations qui attendent l'utilisateur (fiche 024). */
      attention: () => AttentionState
      /** Ce qu'attend chaque conversation (fiche 119). */
      attentionDetails: () => AttentionDetails
      /** Notifications macOS : refus éventuel, réglages du système (injecté). */
      notifications: { status: () => NotificationStatus; openSettings: () => Promise<void> }
      /** Branche du dossier (fiches 037 et 049, injecté). */
      git: GitController
      /** Commandes du projet (fiche 045, injecté). */
      commands: { project: (workspace: string) => Promise<UserCommand[]> }
      /** Récapitulatif des modifications (fiche 021) : git, éditeur, Finder (injectés). */
      changes: {
        git: Pick<GitChangesReader, 'changes' | 'fileDiff'>
        /** Rend un message d'erreur, vide si le fichier s'est ouvert (comme `shell.openPath`). */
        openPath: (path: string) => Promise<string>
        reveal: (path: string) => void
        /** Ouvre une adresse web dans le navigateur du Mac (liens du fil, fiche 154). */
        openExternal: (url: string) => Promise<void>
      }
    }
): IpcHandlers {
  const c = deps.conversations
  const { settings } = deps
  const quick = () => {
    if (!deps.quick) throw new Error(t('ipc.unavailable.quick'))
    return deps.quick
  }
  const approvals = () => {
    if (!deps.approvals) throw new Error(t('ipc.unavailable.approvals'))
    return deps.approvals
  }
  return {
    ...appHandlers(deps),
    ...acpExchangeHandlers(deps.acpExchanges ?? acpExchanges, deps.send),
    ...usageHandlers({
      ...(deps.quotas ? { quotas: deps.quotas } : {}),
      ...(deps.usage ? { board: deps.usage } : {}),
      ...(deps.saveCsv ? { saveCsv: deps.saveCsv } : {}),
      ...(deps.writeExport ? { write: deps.writeExport } : {})
    }),
    'quick:info': () => quick().info(),
    'quick:send': async (text, attachments) => {
      if (typeof text !== 'string') throw new Error('Message invalide')
      const files = parseAttachments(attachments)
      if (!text.trim() && files.length === 0) throw new Error(t('ipc.emptyMessage'))
      await quick().send(text, files)
      return undefined
    },
    'quick:hide': () => {
      quick().hide()
      return undefined
    },
    'quick:resize': (height) => {
      if (typeof height !== 'number' || !Number.isFinite(height)) {
        throw new Error('Paramètre invalide : height')
      }
      quick().resize(height)
      return undefined
    },
    'sound:preview': (sound) => {
      const known = ATTENTION_SOUNDS.find((s) => s === sound)
      if (!known) throw new Error('Paramètre invalide : sound')
      deps.playSound?.(known)
      return undefined
    },
    'capture:screen': () => {
      if (!deps.captureScreen) throw new Error(t('ipc.unavailable.capture'))
      return deps.captureScreen()
    },
    'capture:openSettings': async () => {
      if (!deps.openCaptureSettings) throw new Error(t('ipc.unavailable.capture'))
      await deps.openCaptureSettings()
      return undefined
    },
    ...diagnosticsHandlers(deps),
    'conversations:get': () => c.state(),
    'conversation:view': (id) => c.view(str(id, 'id')),
    'conversation:select': (id) => c.select(str(id, 'id')),
    'conversation:create': (request) => c.create(parseConfigureRequest(request)),
    'conversation:rename': (id, title) => {
      c.rename(str(id, 'id'), str(title, 'title'))
      return undefined
    },
    'conversation:delete': (id, options) => {
      const o = typeof options === 'object' && options !== null ? options : {}
      return c.delete(str(id, 'id'), {
        fromAgent: o.fromAgent !== false,
        removeWorktree: o.removeWorktree === true
      })
    },
    'conversation:createWorktree': (id) => c.createInWorktree(str(id, 'id')),
    ...worktreeSetupHandlers({
      control: deps.worktreeSetup,
      forget: (root) => approvals().forgetWorktreeSetup(root),
      settingsView: () => c.settingsView()
    }),
    ...childHandlers(deps.children),
    ...reviewHandlers(deps.children?.reviews),
    ...worktreeHandlers(deps.worktree),
    ...deviceHandlers(deps.simulator, deps.android),
    ...childrenMergeHandlers(deps.childrenMerge),
    ...asideHandlers(
      deps.asides &&
        new Asides({
          conversations: deps.asides,
          emit: (view) => deps.send?.('aside:changed', view)
        })
    ),
    ...onboardingHandlers(deps.onboarding),
    ...costCapHandlers(deps.costCap),
    ...turnLimitHandlers(c),
    ...memoryHandlers(deps.memory, deps.memoryIpc),
    ...rolesHandlers(deps.roles),
    ...scheduleHandlers(deps.scheduler),
    ...profileHandlers(deps.profile),
    ...handoverHandlers(c, () => deps.providers?.list() ?? []),
    ...threadHandlers(deps.thread, (id) => c.workspaceOf(id)),
    ...mcpHandlers(deps.mcp, c, settings),
    ...approvalRulesHandlers(deps.approvalRules, deps.changes.openPath),
    ...providersHandlers(deps.providers, deps.network, () =>
      c
        .settingsView()
        .profiles.filter((p) => p.available)
        .map((p) => p.id)
    ),
    'conversation:worktreeStatus': (id) => c.worktreeStatus(str(id, 'id')),
    'conversation:open': (id) => c.open(str(id, 'id')),
    'conversation:archive': (id, archived) => {
      if (typeof archived !== 'boolean') throw new Error('Paramètre invalide : archived')
      return c.setArchived(str(id, 'id'), archived)
    },
    'conversation:branchPreview': (id, itemId) => c.branchPreview(str(id, 'id'), int(itemId)),
    'agent:listSessions': (profileId, only) =>
      c.agentSessions(
        str(profileId, 'profileId'),
        only === undefined ? undefined : str(only, 'only')
      ),
    'conversation:resumeSession': (profileId, session) =>
      c.resumeSession(str(profileId, 'profileId'), parseAgentSession(session)),
    'conversation:subagentWork': (id, toolCallId) =>
      c.subagentWork(str(id, 'id'), str(toolCallId, 'toolCallId')),
    'conversation:branch': async (id, itemId, text, options) => {
      if (typeof text !== 'string') throw new Error('Paramètre invalide : text')
      const o = typeof options === 'object' && options !== null ? options : {}
      const view = await c.branch(str(id, 'id'), int(itemId), text, {
        restoreFiles: (o as { restoreFiles?: unknown }).restoreFiles === true
      })
      deps.browser.inherit?.(view.summary.id, str(id, 'id'))
      return view
    },
    'conversation:release': (id) => {
      c.release(str(id, 'id'))
      return undefined
    },
    'conversation:pin': (id, pinned) => {
      if (typeof pinned !== 'boolean') throw new Error('Paramètre invalide : pinned')
      c.setPinned(str(id, 'id'), pinned)
      return undefined
    },
    ...folderHandlers(c, deps.chooseDirectory),
    'conversations:search': async (query) =>
      typeof query === 'string' ? c.search(query.slice(0, 200)) : [],
    'agent:prompt': async (id, text, attachments, options) => {
      if (typeof text !== 'string') throw new Error('Prompt invalide')
      const files = parseAttachments(attachments)
      if (!text.trim() && files.length === 0) throw new Error(t('ipc.emptyPrompt'))
      await c.prompt(str(id, 'id'), text, files, parsePromptRequest(options))
      return undefined
    },
    'agent:unqueue': (id, messageId) => c.unqueue(str(id, 'id'), str(messageId, 'messageId')),
    'agent:sendNow': async (id, messageId) => {
      await c.sendNow(str(id, 'id'), str(messageId, 'messageId'))
      return undefined
    },
    'agent:cancel': async (id) => {
      await c.cancel(str(id, 'id'))
      return undefined
    },
    'agent:retryTurn': (id) => {
      c.retryTurn(str(id, 'id'))
      return undefined
    },
    'agent:restart': async (id) => {
      await c.restart(str(id, 'id'))
      return undefined
    },
    'agent:respondPermission': (id, requestId, optionId) => {
      if (optionId !== null && typeof optionId !== 'string') {
        throw new Error('Réponse de permission invalide')
      }
      c.respondPermission(str(id, 'id'), str(requestId, 'requestId'), optionId)
      return undefined
    },
    'agent:respondElicitation': (id, requestId, answer) => {
      c.respondElicitation(
        str(id, 'id'),
        str(requestId, 'requestId'),
        parseElicitationAnswer(answer)
      )
      return undefined
    },
    'agent:authenticate': async (id, methodId) => {
      await c.authenticate(str(id, 'id'), str(methodId, 'methodId'))
      return undefined
    },
    'agent:retrySession': async (id) => {
      await c.retrySession(str(id, 'id'))
      return undefined
    },
    // La valeur de la clé ne fait que passer : jamais renvoyée, ni journalisée.
    'agent:useApiKey': async (id, env, value) => {
      await c.useApiKey(str(id, 'id'), str(env, 'env'), str(value, 'value'))
      return undefined
    },
    // Le renderer désigne une étape du profil, jamais une commande.
    'agent:runStep': (id, stepId) => {
      const conversation = str(id, 'id')
      const command = c.stepCommand(conversation, str(stepId, 'stepId'))
      return deps.terminals.run(conversation, c.workspaceOf(conversation), command).id
    },
    'agent:trustForSession': async (id) => {
      await c.trustForSession(str(id, 'id'))
      return undefined
    },
    // Le renderer désigne une conversation, jamais un chemin : seul son dossier peut être ouvert.
    'workspace:openTerminal': async (id) => {
      await deps.openTerminal(c.workspaceOf(str(id, 'id')))
      return undefined
    },
    'agent:setControl': async (id, controlId, value) => {
      if (typeof value !== 'string' && typeof value !== 'boolean') {
        throw new Error('Réglage invalide')
      }
      await c.setControl(str(id, 'id'), str(controlId, 'controlId'), value)
      return undefined
    },
    'agent:configure': (id, request) => c.configure(str(id, 'id'), parseConfigureRequest(request)),
    'settings:get': () => c.settingsView(),
    'settings:setNotifications': (enabled) => {
      if (typeof enabled !== 'boolean') throw new Error('enabled : booléen attendu')
      settings.setNotifications(enabled)
      return c.settingsView()
    },
    'settings:setPreferences': (change) => {
      settings.setPreferences(change)
      return c.settingsView()
    },
    'tips:state': () => tipsView(settings.tipsSince(localDay(new Date()))),
    'tips:record': (id, action) => {
      if (!isTipId(id) || !TIP_ACTIONS.includes(action)) throw new Error('Astuce invalide')
      // Le jour est celui du main : le renderer ne choisit pas la date du quota.
      const view = tipsView(settings.recordTip(id, action, localDay(new Date())))
      // Masquée pour toujours : les autres vues (Réglages › Général) relisent leur compte.
      if (action !== 'shown') deps.send?.('tips:changed', view)
      return view
    },
    'tips:reset': () => {
      const view = tipsView(settings.resetTips())
      // « Tout réafficher » : les astuces peuvent revenir sans relancer l'app.
      deps.send?.('tips:changed', view)
      return view
    },
    'tips:noteMessage': (folder, text) => {
      if (typeof folder !== 'string' || typeof text !== 'string' || text.length > 100_000) {
        throw new Error('Message invalide')
      }
      return settings.noteSentMessage(folder, text, localDay(new Date()))
    },
    'settings:forgetWorkspace': (workspace) => {
      settings.forgetWorkspace(str(workspace, 'workspace'))
      return c.settingsView()
    },
    'settings:setNewConversation': (defaults) => {
      settings.setNewConversation(defaults)
      return c.settingsView()
    },
    'settings:forgetTool': (profileId, tool) => {
      settings.forgetTool(str(profileId, 'profileId'), str(tool, 'tool'))
      return c.settingsView()
    },
    'settings:forgetSite': (site) => {
      approvals().forgetSite(str(site, 'site'))
      return c.settingsView()
    },
    'settings:forgetCommand': (workspace, command) => {
      approvals().forgetCommand(str(workspace, 'workspace'), str(command, 'command'))
      return c.settingsView()
    },
    'settings:setCommands': (commands) => {
      settings.setCommands(commands)
      return c.settingsView()
    },
    // Lus en tâche de fond : sans dossier choisi (fiche 093), rien, et pas d'erreur au journal.
    'commands:project': (id) => c.readFolder(str(id, 'id'), deps.commands.project, []),
    'settings:reloadShellEnv': async () => {
      await deps.reloadShellEnv?.()
      return c.settingsView()
    },
    'settings:setApiKey': async (profileId, env, value) => {
      await settings.setApiKey(str(profileId, 'profileId'), str(env, 'env'), str(value, 'value'))
      return c.settingsView()
    },
    'settings:removeApiKey': (profileId, env) => {
      settings.removeApiKey(str(profileId, 'profileId'), str(env, 'env'))
      return c.settingsView()
    },
    // Formulaire vérifié par le main (`draftProblems`) : le renderer n'est pas cru sur parole.
    'settings:saveCustomAgent': (draft, id) => {
      const saved = settings.saveCustomAgent(draft, id === undefined ? undefined : str(id, 'id'))
      return { id: saved, settings: c.settingsView() }
    },
    'settings:removeCustomAgent': (id) => {
      settings.removeCustomAgent(str(id, 'id'))
      return c.settingsView()
    },
    'attention:get': () => deps.attention(),
    'attention:details': () => deps.attentionDetails(),
    // Le renderer désigne un fichier ; le main vérifie qu'il est dans le dossier de la conversation.
    'git:status': (id) => c.readFolder(str(id, 'id'), (folder) => deps.git.status(folder), null),
    'changes:git': (id) => deps.changes.git.changes(c.workspaceOf(str(id, 'id'))),
    'changes:gitFile': (id, path, from) =>
      deps.changes.git.fileDiff(
        c.workspaceOf(str(id, 'id')),
        str(path, 'path'),
        from === undefined ? undefined : str(from, 'from')
      ),
    // Mêmes garde-fous que les liens du fil : un fichier qui peut s'exécuter n'est que montré.
    'changes:open': (id, path) =>
      openWorkspaceFile(c.workspaceOf(str(id, 'id')), str(path, 'path'), deps.changes),
    'files:openLink': async (id, href, options) => {
      const o = typeof options === 'object' && options !== null ? options : {}
      const conversationId = str(id, 'id')
      const { openTab } = deps.browser
      // Lien web (fiche 154) : adresse du poste dans le navigateur intégré (⌥-clic : celui du
      // Mac), toute autre http(s) dans celui du Mac. Jamais la fenêtre de l'app.
      const web = webLinkTarget(str(href, 'href'))
      if (web) {
        if (web === 'integrated' && o.reveal !== true && openTab) {
          // Serveur local arrêté (ERR_CONNECTION_REFUSED…) : l'onglet s'ouvre quand même, sur la
          // page d'erreur du navigateur, à recharger une fois le serveur lancé.
          await openTab(conversationId, href as string).catch((error: unknown) =>
            log.warn(`files:openLink: local link not loaded: ${messageOf(error)}`)
          )
          return { kind: 'browser', path: href as string, url: href as string }
        }
        await deps.changes.openExternal(href as string)
        return { kind: 'opened', path: href as string }
      }
      const outcome = await openFileLink(
        c.workspaceOf(conversationId),
        str(href, 'href'),
        {
          ...(typeof o.base === 'string' ? { base: o.base } : {}),
          ...(o.reveal === true ? { reveal: true } : {})
        },
        {
          openPath: deps.changes.openPath,
          reveal: deps.changes.reveal,
          ...(deps.previewHtml && openTab ? { previewHtml: deps.previewHtml } : {})
        }
      )
      // Page HTML (fiche 064) : dans le navigateur de la conversation.
      if (outcome.kind === 'browser' && openTab) await openTab(conversationId, outcome.url)
      return outcome
    },
    'files:readMarkdown': (id, path) => c.readDocument(str(id, 'id'), str(path, 'path')),
    'conversation:rules': (id) => c.rules(str(id, 'id')),
    'changes:reveal': (id, path) => {
      deps.changes.reveal(insideWorkspace(c.workspaceOf(str(id, 'id')), str(path, 'path')))
      return undefined
    },
    // Le chemin doit être celui d'un diff de la conversation : vérifié par le gestionnaire.
    'changes:revert': (id, path) => c.revertFile(str(id, 'id'), str(path, 'path')),
    'conversation:export': async (id, format) => {
      if (format !== 'markdown' && format !== 'json') throw new Error('Paramètre invalide : format')
      const view = c.view(str(id, 'id'))
      const path = await deps.saveFile?.(exportFileName(view.summary, format), format)
      if (!path) return null
      const write = deps.writeExport ?? ((file, content) => writeFile(file, content))
      await write(path, exportConversation(view.summary, view.transcript, format))
      deps.changes.reveal(path)
      return path
    },
    'app:backupHistory': async () => {
      if (!deps.backupHistory) throw new Error(t('ipc.unavailable.backup'))
      // Écritures de fils en cours terminées avant la copie.
      await c.settled()
      const target = await deps.chooseDirectory({
        title: t('dialogs.backup.title'),
        buttonLabel: t('dialogs.backup.button')
      })
      if (!target) return null
      // Échec du disque (plein, droits) : dit en clair ; la sauvegarde n'a rien laissé à moitié.
      return deps.backupHistory(target).catch((error: unknown) => {
        if (!(error as { code?: unknown } | null)?.code) throw error
        throw new Error(t('profile.backup.failed', { reason: translate(plainError(error)) }))
      })
    },
    'notifications:status': () => deps.notifications.status(),
    'notifications:openSettings': async () => {
      await deps.notifications.openSettings()
      return undefined
    },
    'workspace:choose': () => deps.chooseDirectory(),
    // Comme pour le terminal : le renderer désigne une conversation, le main en déduit le dossier.
    'workspace:searchFiles': async (id, query) => {
      if (typeof query !== 'string' || query.length > 200) throw new Error('Recherche invalide')
      const workspace = c.workspaceOf(str(id, 'id'))
      // Fichiers que l'agent exclut (`.bobignore`…) : pas proposés (fiche 155).
      const exclusions = exclusionsFor(c.profileOf(String(id))?.exclusions, workspace)
      return deps.searchFiles(workspace, query, undefined, exclusions?.isExcluded)
    },
    'workspace:excludedPaths': async (id, paths) => {
      if (!Array.isArray(paths) || paths.length > 100 || paths.some((p) => typeof p !== 'string')) {
        throw new Error('Chemins invalides')
      }
      const workspace = c.workspaceOf(str(id, 'id'))
      const exclusions = exclusionsFor(c.profileOf(String(id))?.exclusions, workspace)
      if (!exclusions) return { paths: [], files: [] }
      return { paths: await exclusions.excluded(paths), files: exclusions.files }
    },
    'workspace:pickFiles': (id) => deps.chooseFiles(c.workspaceOf(str(id, 'id'))),
    ...browserHandlers(deps.browser),
    'preview:list': (id) =>
      c.readFolder(str(id, 'id'), (folder) => deps.devServers.list(folder), []),
    'preview:stop': async (id, name) => {
      deps.devServers.stop(c.workspaceOf(str(id, 'id')), str(name, 'name'))
      return undefined
    },
    'terminal:list': async (id) => deps.terminals.list(str(id, 'id')),
    'terminal:create': async (id, cols, rows) =>
      deps.terminals.create(str(id, 'id'), c.workspaceOf(str(id, 'id')), terminalSize(cols, rows)),
    'terminal:write': async (id, tabId, data) => {
      if (typeof data !== 'string' || data.length > 1_000_000)
        throw new Error('Paramètre invalide : data')
      deps.terminals.write(str(id, 'id'), str(tabId, 'tabId'), data)
      return undefined
    },
    'terminal:resize': async (id, tabId, cols, rows) => {
      const size = terminalSize(cols, rows)
      deps.terminals.resize(str(id, 'id'), str(tabId, 'tabId'), size.cols, size.rows)
      return undefined
    },
    'terminal:close': async (id, tabId) => {
      deps.terminals.close(str(id, 'id'), str(tabId, 'tabId'))
      return undefined
    },
    'terminal:stop': async (id, tabId) => {
      deps.terminals.stop(str(id, 'id'), str(tabId, 'tabId'))
      return undefined
    },
    'terminal:snapshot': (id, tabId) => deps.terminals.snapshot(str(id, 'id'), str(tabId, 'tabId')),
    'preview:logs': async (id, name) =>
      deps.devServers.logs(c.workspaceOf(str(id, 'id')), str(name, 'name'), { lines: 300 })
  }
}

/**
 * État des astuces pour l'interface (fiche 191) : calme d'une conversation neuve, et aucune astuce
 * le jour du premier lancement. `BOBINE_TIPS_QUIET_MS` raccourcit le premier et lève le second, pour
 * les essais de bout en bout seulement ; jamais enregistré.
 */
export function tipsView(state: TipsState, env: NodeJS.ProcessEnv = process.env): TipsView {
  const raw = env['BOBINE_TIPS_QUIET_MS']
  const override = Number(raw)
  const forTests = Boolean(raw) && Number.isFinite(override) && override >= 0
  // Les empreintes des messages et leur clé restent au main : l'interface n'en a pas besoin.
  const { sent: _sent, salt: _salt, ...shown } = state
  return { ...shown, quietMs: forTests ? override : TIP_QUIET_MS, firstDayRule: !forTests }
}
