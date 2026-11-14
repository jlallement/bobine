import type { BrowserManager } from './browser/browser-manager'
import { setupBrowser } from './browser/browser-setup'
import { ApprovalStore } from './approvals'
import { setupSelfInstall } from './self-install-setup'
import { AppToolServer } from './mcp/tool-server'
import { DevServers } from './preview/dev-servers'
import { spawnNodePty } from './terminal/node-pty'
import { TerminalManager } from './terminal/terminal-manager'
import { terminateForeground } from './terminal/foreground'
import { terminalText } from './terminal/terminal-context'
import { gitChangesText } from './changes/git-context'
import { exclusionsFor } from './agent-config/exclusions'
import { terminalToolsModule } from './terminal/terminal-tools'
import { setupAndroid } from './android/android-setup'
import { findAndroidSdk } from './android/sdk'
import { findAxe } from './simulator/axe'
import { runCommand } from './simulator/run'
import { gitRun } from './git/git-queue'
import { encodeBgra, resizeJpeg } from './simulator/images'
import { setupSimulator } from './simulator/simulator-setup'
import { previewToolsModule } from './preview/preview-tools'
import { AttentionTracker } from './notifications/attention'
import { GitChangesReader } from './changes/git'
import { GitRepo } from './git/repo'
import { threadIpcDeps } from './thread-ipc-electron'
import { fileOpeners } from './file-openers'
import { projectCommands } from './user-commands'
import { connectWorktreePreparation, preparedWorktrees } from './changes/worktree-setup-wiring'
import { worktreeCycleDeps } from './changes/worktree-ipc'
import { childrenMerger } from './conversations/children-merge-ipc'
import { CostCapGuard } from './conversations/cost-cap'
import { SystemNotifier } from './notifications/system-notifier'
import { searchWorkspaceFiles } from './workspace-files'
import { openTerminal } from './terminal/terminal-app'
import { attachLaunch, commandLineDeps, launch, readLaunchArguments } from './launch-app'
import { setupProcessSafety } from './process-safety'
import { stopTrackedChildren } from './process-registry'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  powerMonitor,
  powerSaveBlocker,
  safeStorage,
  screen,
  shell,
  systemPreferences,
  webContents
} from 'electron'
import { KeepAwake } from './keep-awake'
import { electronNetworkWatch } from './network-watch-electron'
import { QuitFlow } from './quit-guard'
import { stopAllJobs } from './jobs/command-job'
import { setupUsageJournal, USAGE_DB_FILE } from './usage/setup'
import { buildMenuTemplate, zoomInterface } from './menu'
import { Presentation } from './presentation'
import { followFullScreen } from './full-screen-menu'
import { McpSettings } from './agent-config/mcp-settings'
import { ApprovalRulesSettings } from './agent-config/approval-rules-settings'
import { ProvidersSettings } from './agent-config/providers-settings'
import { effectiveNetwork, networkController } from './agent-config/network-env'
import { ApiKeyStore } from './agent-config/api-keys'
import { keychainTestOptions, safeStorageCipher } from './agent-config/keychain-cipher'
import { homedir } from 'node:os'
import { setHomeFolder } from '@shared/path-display'
import * as failures from './app-failures'
import { getVerbosity, initLog, log, logFile, logSizes, setVerbosity, withLogFile } from './log'
import { isVerbosity, type LogStatus } from '@shared/log-level'
import { peekPreferences } from './settings'
import { SettingsStore } from './settings-store'
import { ConversationStore } from './conversations/store'
import { HistoryWriter } from './conversations/history-writer'
import { ConversationManager } from './conversations/manager'
import type { ChildConversations } from './conversations/children'
import { setupChildren } from './conversations/children-setup'
import { childrenToolsModule } from './mcp/children-tools'
import { appMemory } from './memory/setup'
import { appRoles } from './roles/setup'
import { conversationRelease } from './conversation-release'
import { backupProfile } from './conversations/backup'
import { AppProfile } from './profile-app'
import { setupScheduler } from './scheduler/scheduler-ipc'
import { resolveProfiles } from './agent/profiles'
import { setupQuotas } from './agent/quota-setup'
import { quotaAfterCheck, quotaOnReady } from './agent/quota'
import { createOnboarding, firstLaunchFacts } from './onboarding/onboarding'
import { quickEntryDeps } from './quick-entry-deps'
import { createHandlers, registerIpcHandlers, type SendEvent } from './ipc'
import { broadcast, trustedSender } from './app-windows'
import { applyShellEnv, loginShellEnv } from './shell-env'
import { migrateUserData } from './user-data-migration'
import { agentGroup, systemGroups } from './diagnostics'
import { QuickEntry, QuickShortcutRegistrar } from './quick-entry'
import { fontLister } from './fonts'
import { currentPlatformFeatures } from './platform'
import { createMainBrowserWindow, createQuickWindow, loadRenderer } from './renderer-windows'
import { technicalFacts } from './about-window'
import { appAboutWindow, appHelpWindow, helpIpc } from './secondary-windows'
import { technicalInfo } from './technical-info'
import { captureScreen, SCREEN_RECORDING_SETTINGS, screenAccessOf } from './screen-capture'
import { HtmlPreviewServer } from './files/html-preview'
import { systemAlerts } from './notifications/system-alerts'
import { inboxCount } from '@shared/inbox'
import { QUICK_SHORTCUTS } from '@shared/quick-entry'
import { changeLanguage, initI18n, resolveLanguage, savedLanguage } from './i18n'
import { freshStart, freshStartIpc, reportResetFailure } from './fresh-start-app'
import { launchLanguage, syncNativeLanguage, systemAppLanguage } from './native-language'
import { nativeCodec } from './filmstrip/native-codec'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import { revealWindow, showRestored, trackWindowState, visibleBounds } from './window-state'
import { defaultWorkspaceFor } from './conversations/agentless'
import { imposedLiveLimit } from './conversations/live-agents'
import { chooseDirectory, chooseFiles, saveCsv, saveFile } from './dialogs'

/** Fenêtres montrées sans prendre le focus (essais de bout en bout, fiche 106). */
const SHOW_INACTIVE = process.env['BOBINE_SHOW_INACTIVE'] === '1'

function createMainWindow(
  browser: BrowserManager,
  onFocusChange: () => void,
  memory: Pick<SettingsStore, 'windowState' | 'setWindowState' | 'preferences'>
): BrowserWindow {
  // Là où elle était au dernier lancement, ramenée sur un écran visible (fiche 093).
  const saved = memory.windowState()
  const screens = {
    workAreas: screen.getAllDisplays().map((display) => display.workArea),
    primary: screen.getPrimaryDisplay().workArea
  }
  const win = createMainBrowserWindow(
    saved ? visibleBounds(saved, screens) : undefined,
    memory.preferences(),
    features
  )

  win.once('ready-to-show', () => showRestored(win, saved, SHOW_INACTIVE))
  // Essais : la fenêtre montrée sans le focus compte comme au premier plan, comme sa page (fiche
  // 106) ; sinon chaque réponse irait dans « À traiter » (fiche 119). La suite `notifications`
  // impose son propre focus.
  if (SHOW_INACTIVE) win.isFocused = () => true
  trackWindowState(win, (state) => memory.setWindowState(state))
  // Interface plantée : rechargée trois fois par minute au plus, puis question (fiche 194). Les
  // conversations vivent dans le main : rien n'est perdu ; la relance repart de l'accueil.
  failures.watchRendererCrashes(win, showLog)
  win.webContents.on('unresponsive', () => log.warn('Interface sans réponse'))
  win.webContents.on('responsive', () => log.info('Interface de nouveau réactive'))
  // Ce qui est sous les yeux de l'utilisateur est « vu » (notifications, fiche 024).
  win.on('focus', onFocusChange)
  win.on('blur', onFocusChange)
  browser.setWindow(win)

  loadRenderer(win)
  mainWindow = win
  win.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) mainWindowGone?.()
  })
  win.on('closed', () => {
    mainWindowGone?.()
    if (mainWindow === win) mainWindow = undefined
    launch.windowClosed()
  })
  return win
}

let quitting = false
/** En quittant : attente maximale pour supprimer la session des conversations vides chez leur agent. */
const QUIT_DROP_MS = 3000

/** Évènement pour les fenêtres, sauf pendant la fermeture : elles disparaissent. */
const send: SendEvent = (channel, payload) => {
  if (!quitting) broadcast(channel, payload)
}

/** Ramène la fenêtre existante au premier plan (relance de l'app, clic dans le Dock…). */
/** Fenêtre principale (la fenêtre rapide n'en est pas une). */
let mainWindow: BrowserWindow | undefined
let mainWindowGone: (() => void) | undefined
/** Recrée la fenêtre principale fermée (macOS garde l'app ouverte) ; posé au démarrage. */
let reopenMainWindow: (() => void) | undefined

function focusMainWindow(): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) {
    reopenMainWindow?.()
    return
  }
  revealWindow(win, SHOW_INACTIVE)
}

// Nom affiché (menus, notifications), sans déplacer le dossier de données, tiré du nom du paquet :
// l'app packagée et `pnpm dev` partagent le même historique (`~/Library/Application Support/bobine`).
// Ce nom désigne aussi l'entrée du trousseau qui chiffre les clés d'API (« Bobine Safe Storage ») :
// le changer rend les clés enregistrées illisibles.
const userData = freshStart.userData(app.getPath('userData'))
app.setName('Bobine')
app.setPath('userData', userData)

// Journal (fiche 041) : `~/Library/Logs/Bobine/main.log` ; avec un dossier de données imposé
// (essais), le journal y reste aussi.
initLog(freshStart.isolated ? join(userData, 'logs') : app.getPath('logs'))
// Niveau du journal (fiche 080) : `BOBINE_LOG` l'impose (essais), sinon le niveau enregistré ;
// Trace ne l'est jamais (il revient au niveau enregistré au lancement suivant).
const imposedLog = isVerbosity(process.env['BOBINE_LOG']) ? process.env['BOBINE_LOG'] : undefined
setVerbosity(imposedLog ?? peekPreferences(join(userData, 'settings.json')).logLevel ?? 'normal')

// Langue de l'interface (fiche 074) : avant toute fenêtre, qui la reçoit à sa création. Réglage
// « Langue », sinon celle de macOS. Celle des fenêtres de macOS suit au lancement suivant : réglée
// par l'app packagée seulement, jamais par les essais (dossier de données imposé).
// Capacités de la plateforme (fiche 145) : ce qui n'existe que sur macOS est masqué ailleurs.
const features = currentPlatformFeatures(process.env, process.platform)
const managesNativeLanguage = features.nativeLanguage && app.isPackaged && !freshStart.isolated
const appLanguage = systemAppLanguage(systemPreferences)
const startLanguage = savedLanguage(join(userData, 'settings.json'))
if (managesNativeLanguage) syncNativeLanguage(appLanguage, startLanguage)
initI18n(resolveLanguage(startLanguage, app.getPreferredSystemLanguages()))
// Dossier personnel : les libellés de cartes (et des notifications) disent `~` (fiche 214).
setHomeFolder(homedir())

/**
 * Ancien nom (fiche 069, ADR-0013) : le dossier `bob-desktop` devient `bobine` au premier lancement.
 * Rend vrai si l'ancienne app est encore ouverte : elle écrit dans ce dossier, on attend qu'elle
 * soit fermée.
 */
function oldAppStillOpen(): boolean {
  if (freshStart.isolated) return false
  const previous = join(app.getPath('appData'), 'bob-desktop')
  try {
    const migration = migrateUserData(previous, userData)
    if (migration.kind === 'moved') log.info(`Dossier de données repris de ${previous}`)
    if (migration.kind === 'imported') {
      log.info(`Conversations reprises de ${previous} : ${migration.conversations}`)
    }
    if (migration.kind !== 'busy') return false
  } catch (error) {
    log.error('Reprise du dossier de données impossible :', error)
    return false
  }
  dialog.showErrorBox(t('dialogs.oldApp.title'), t('dialogs.oldApp.message'))
  return true
}
const blockedByOldApp = oldAppStillOpen()
// Erreurs non rattrapées : journal et avis, l'app continue (fiche 194).
failures.watchMainErrors()
app.on('child-process-gone', (_event, details) => {
  if (details.reason !== 'clean-exit') log.warn('Processus Electron arrêté :', details)
})

/** Niveau du journal et taille de ses fichiers, pour Réglages › Diagnostic (fiche 080). */
function logStatus(): LogStatus {
  return { level: getVerbosity(), imposed: imposedLog !== undefined, sizes: logSizes() }
}

function showLog(): void {
  const file = logFile()
  if (file) void shell.openPath(file)
}

// Une seule instance par dossier de données : deux instances écriraient le même historique et
// les mêmes réglages. Une relance ramène simplement la fenêtre existante, comme Claude Desktop.
const primaryInstance = !blockedByOldApp && app.requestSingleInstanceLock()
if (blockedByOldApp) {
  app.quit()
} else if (!primaryInstance) {
  // Sans ce message, la relance semble se fermer toute seule.
  console.log('Bobine est déjà ouverte : sa fenêtre a été ramenée au premier plan.')
  app.quit()
} else {
  // `bobine <dossier> "message"` (fiche 158) : au premier lancement, et par une relance
  // (`open -n -a Bobine --args …`) qui arrive ici au lieu d'ouvrir une seconde app.
  readLaunchArguments(process.argv, process.cwd())
  app.on('second-instance', (_event, argv, workingDirectory) => {
    focusMainWindow()
    readLaunchArguments(argv, workingDirectory)
  })
  void app
    .whenReady()
    .then(start)
    .catch((error: unknown) => {
      // Sans fenêtre, l'app resterait invisible dans le Dock : on le dit, puis on quitte.
      log.error('Démarrage impossible :', error)
      dialog.showErrorBox(
        t('dialogs.startFailed.title'),
        t('dialogs.startFailed.message', {
          error: messageOf(error),
          log: logFile() ?? '—'
        })
      )
      app.quit()
    })
}

// eslint-disable-next-line max-lines-per-function -- racine de composition : surtout l'assemblage des dépendances de createHandlers, une table (fiche 089)
async function start(): Promise<void> {
  // Profil (fiches 196, 197) : restauration demandée, version du format, ménage ; avant toute lecture
  // ou écriture (lecture seule : le rapport de plantage n'y écrit rien non plus).
  const profile = new AppProfile(userData, app.getVersion())
  // Lancement précédent arrêté sans quitter : rapport local, sans envoi (fiche 194).
  failures.setupCrashReports(userData)
  log.info(
    `Démarrage de Bobine ${app.getVersion()} (Electron ${process.versions.electron}), journal ${getVerbosity()}`
  )
  // Avant tout lancement : processus du lancement précédent, permissions (fiche 138).
  setupProcessSafety(userData)
  // Lancée depuis le Finder, l'app n'a qu'un environnement minimal : on reprend celui du shell
  // (PATH, et où OpenCode range sa configuration globale et ses skills).
  // Dernière lecture, pour le diagnostic (fiche 061).
  let shellProblem: string | undefined
  const readShellEnv = async (): Promise<string | undefined> => {
    const shell = await loginShellEnv()
    applyShellEnv(shell.values, process.env)
    if (shell.problem) log.warn(`Shell de connexion : ${shell.problem}`)
    else log.info(`Environnement du shell de connexion lu en ${shell.ms} ms`)
    shellProblem = shell.problem
    return shell.problem
  }
  await readShellEnv()
  freshStart.isolateAgents(process.env)

  // Dossier neutre où lancer un agent hors conversation (diagnostic, sessions à reprendre) ; celui
  // des conversations sans dossier choisi pour les essais seulement (fiche 093).
  const neutralFolder = join(app.getPath('userData'), 'workspace')
  mkdirSync(neutralFolder, { recursive: true })
  const testRun = app.commandLine.hasSwitch('user-data-dir')

  // Serveur MCP local qui fournit les outils de l'app aux agents (fiches 028, 029).
  const toolServer = new AppToolServer({ version: app.getVersion() })
  await toolServer.start().catch((error: unknown) => {
    log.error('Serveur d’outils de l’app indisponible :', error)
  })

  const profiles = resolveProfiles({
    appPath: app.getAppPath(),
    execPath: process.execPath,
    isPackaged: app.isPackaged,
    env: process.env,
    mockStore: join(app.getPath('userData'), 'mock-agent-sessions')
  })
  // Serveurs MCP déclarés dans les fichiers des agents (fiche 025). BOBINE_CONFIG_HOME : autre
  // dossier personnel, pour que les essais ne touchent jamais les vrais fichiers de Bob et d'OpenCode.
  const configHome = process.env['BOBINE_CONFIG_HOME']
  const agentFiles = {
    home: configHome ?? homedir(),
    ...(configHome ? {} : { xdgConfigHome: process.env['XDG_CONFIG_HOME'] })
  }
  const mcp = new McpSettings(profiles, agentFiles)
  // Règles d'approbation globales des agents (fiche 215) : même dossier personnel que les MCP.
  const approvalRules = new ApprovalRulesSettings(profiles, agentFiles)
  // Clés d'API des agents (fiche 022), chiffrées par le trousseau macOS. Rien n'est appelé ici :
  // le trousseau ne s'ouvre qu'à la saisie d'une clé ou quand un agent la lit (fiche 100).
  // Réglages d'essai du trousseau (fiche 207) : seulement avec le faux trousseau des essais.
  const keychainTest = keychainTestOptions(
    app.commandLine.hasSwitch('use-mock-keychain'),
    process.env
  )
  const apiKeys = new ApiKeyStore(
    join(app.getPath('userData'), 'api-keys.json'),
    safeStorageCipher(safeStorage, keychainTest),
    keychainTest
  )

  // Historique et réglages (fiche 089, ADR-0016) : ouverts d'abord, ce qui les lit vient après ;
  // un seul écrivain pour l'index, les fils et les réglages.
  const settingsFile = join(app.getPath('userData'), 'settings.json')
  // Premier lancement (fiche 188) : relevé avant que quoi que ce soit n'écrive les réglages.
  // Profil en lecture seule (fiche 196) : jamais d'accueil, rien à marquer.
  const firstLaunch = { ...firstLaunchFacts(app.getPath('userData')), readOnly: profile.readOnly() }
  const historyStore = new ConversationStore(join(app.getPath('userData'), 'conversations'))
  const writer = new HistoryWriter({ store: historyStore, settingsFile })
  const initialSettings = profile.readSettings(settingsFile)
  const settings: SettingsStore = new SettingsStore({
    initial: initialSettings,
    save: (values) => writer.settings(values),
    profiles,
    apiKeys,
    // Clés des fournisseurs de modèles déclarés chez l'agent (fiche 104), posées avec les siennes.
    providerKeys: (profile) => providers.keySpecs(profile)
  })
  // Fournisseurs de modèles (fiche 104) : dans les fichiers des agents ; « Tester » dans leurs
  // conditions réseau (réglages saisis, sinon le shell de connexion).
  const providers: ProvidersSettings = new ProvidersSettings({
    profiles,
    locations: agentFiles,
    apiKeys,
    network: () => effectiveNetwork(settings.network(), process.env)
  })

  // Quota des agents qui savent le lire (Bob : `/status`, fiche 091, ADR-0017), lu peu après.
  const quotas = setupQuotas(
    profiles,
    settings,
    (list) => {
      if (!quitting) broadcast('usage:quotasChanged', list)
    },
    { freshAgents: freshStart.freshAgents }
  )

  // Sites et commandes « toujours autorisés » (fiche 072) ; les Réglages ouverts suivent (plus bas).
  const approvals = new ApprovalStore(join(app.getPath('userData'), 'approvals.json'))
  // Navigateur intégré : une page par conversation, pilotée par l'agent (fiche 007).
  const {
    manager: browser,
    tools: browserTools,
    controller: browserController
  } = setupBrowser({
    keepCookies: () => settings.preferences().browserKeepCookies,
    alwaysSites: approvals.sites,
    imageCodec: nativeCodec,
    send,
    // « Enregistrer sous », boîte d'une page : la conversation attend l'utilisateur (fiche 097).
    onWaiting: (id, key, waiting, reason) => {
      // Conversation supprimée entre-temps : plus personne à prévenir.
      if (!conversations.state().conversations.some((c) => c.id === id)) return
      conversations.post(id, { type: 'waiting-user', key, waiting, reason })
    },
    titleOf: (id) => conversations.state().conversations.find((c) => c.id === id)?.title
  })
  // Serveurs de dev du projet, lancés à la demande de l'agent (fiche 030).
  const devServers = new DevServers((change) => send('preview:changed', change))
  const previewTools = previewToolsModule({
    servers: devServers,
    always: approvals.commands,
    openInBrowser: (id, url) => browser.driverFor(id).navigate(url)
  })

  // Simulateur iOS : simctl, et AXe pour les touchers s'il est installé (fiche 008).
  // BOBINE_AXE : commande imposée (essais de bout en bout ; vide = pas d'AXe). AXe livré avec l'app
  // (Contents/Resources/axe, ADR-0009) ou téléchargé par `pnpm fetch-axe` (vendor/axe), sinon
  // celui du PATH.
  const axeBinary =
    process.env['BOBINE_AXE'] ??
    findAxe(process.env, [
      join(process.resourcesPath, 'axe', 'axe'),
      join(app.getAppPath(), 'vendor', 'axe', 'axe')
    ])
  // En développement, AXe vient de l'archive du dépôt : `pnpm dev` l'extrait (predev).
  const axeInstallHint = app.isPackaged ? undefined : t('simulator.axeInstallHint')
  // BOBINE_XCRUN : commande imposée (essais de bout en bout sans simulateur).
  const xcrun = process.env['BOBINE_XCRUN'] ?? 'xcrun'
  const {
    manager: simulator,
    tools: simulatorTools,
    controller: simulatorController
  } = setupSimulator({
    axeBinary,
    axeInstallHint,
    xcrun,
    cacheDir: join(app.getPath('userData'), 'cache'),
    resize: resizeJpeg,
    encodeBgra,
    always: approvals.commands,
    imageCodec: nativeCodec,
    send
  })

  // Émulateur Android : tout vient du SDK de la machine, rien à installer (fiche 032).
  const androidSdk = findAndroidSdk(process.env)
  const {
    manager: android,
    tools: androidTools,
    controller: androidController
  } = setupAndroid({
    sdk: androidSdk,
    resize: resizeJpeg,
    encodeBgra,
    always: approvals.commands,
    imageCodec: nativeCodec,
    send
  })

  // Terminaux à côté de la conversation (fiche 034, ADR-0007).
  const terminals = new TerminalManager({
    spawn: spawnNodePty,
    env: () => process.env,
    terminateForeground,
    onData: (conversationId, tabId, data) => {
      if (!quitting) broadcast('terminal:data', { conversationId, tabId, data })
    },
    onChange: (change) => {
      if (!quitting) broadcast('terminal:changed', change)
    }
  })

  // Notifications macOS et badge du Dock (fiche 024), pour le suivi de l'attention (plus bas).
  const notifier = new SystemNotifier({
    onClick: (id) => {
      focusMainWindow()
      broadcast('app:openConversation', id)
    },
    onBlocked: (reason) => {
      log.warn(`Notifications refusées par macOS : ${reason}`)
      if (!quitting) broadcast('notifications:status', { blocked: reason })
    }
  })

  // Mac éveillé tant qu'un agent travaille (réglage « Empêcher la mise en veille »).
  const keepAwake = new KeepAwake(powerSaveBlocker)
  // Aperçu des pages HTML (fiche 064) : serveur local démarré à la première page.
  const htmlPreview = new HtmlPreviewServer()

  // Fenêtre rapide (fiche 062) : ouverte par un raccourci global depuis n'importe quelle app.
  const quickEntry = new QuickEntry({
    // Essais de bout en bout : montrée sans prendre le focus de la machine (fiche 106).
    inactive: SHOW_INACTIVE,
    create: () => createQuickWindow(features),
    workArea: () => screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  })
  const quickShortcut = new QuickShortcutRegistrar(globalShortcut, () => quickEntry.toggle())
  quickShortcut.apply(settings.preferences().quickEntryShortcut)
  // Fenêtres À propos (fiche 116) et d'aide (fiche 186).
  const about = appAboutWindow(() => mainWindow, settings, features, SHOW_INACTIVE)
  const help = appHelpWindow(() => mainWindow, settings, features, SHOW_INACTIVE)
  nativeTheme.themeSource = settings.preferences().theme
  // Mode présentation (fiche 159) : jamais enregistré ; le menu et les fenêtres le suivent.
  const presentation = new Presentation()

  // Menu macOS et raccourcis (fiche 027) : chaque entrée envoie sa commande à l'interface ;
  // reconstruit quand le raccourci de la fenêtre rapide ou la langue changent.
  const refreshMenu = () =>
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        buildMenuTemplate({
          appName: app.getName(),
          dev: !app.isPackaged,
          fullScreen: mainWindow?.isFullScreen() === true,
          toggleFullScreen: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
          presentation: { active: presentation.active, toggle: () => presentation.toggle() },
          showLog,
          about: () => about.show(),
          help: () => help.show(null, { search: true }),
          // La page du navigateur qui a le focus, sinon l'interface (fiche 129).
          zoom: (action) => {
            if (browser.zoomFocused(action)) return
            const target = webContents.getFocusedWebContents() ?? mainWindow?.webContents
            if (target && !target.isDestroyed()) zoomInterface(target, action)
          },
          send: (command) => {
            focusMainWindow()
            broadcast('app:command', command)
          },
          quickEntry: {
            open: () => quickEntry.show(),
            accelerator: QUICK_SHORTCUTS[quickShortcut.state.shortcut].accelerator
          }
        })
      )
    )
  refreshMenu()
  followFullScreen(refreshMenu)
  presentation.onChange((active) => {
    refreshMenu()
    send('app:presentationChanged', active)
  })

  // Conversations filles (fiche 097) : créées après le gestionnaire, dont elles ont besoin.
  let children: ChildConversations | undefined = undefined
  // Mémoire commune aux agents (fiche 182).
  const memory = appMemory(
    userData,
    () => conversations,
    () => children,
    settings
  )
  // Rôles (fiche 223) : fournis, personnels, du projet.
  const roles = appRoles(userData, settings, () => conversations)
  const { worktrees, preparation } = preparedWorktrees(gitRun, approvals.worktreeSetups)
  const conversations = new ConversationManager({
    settings,
    trash: profile.trash,
    hiddenSessions: (profileId) => onboarding.hiddenSessions(profileId),
    history: { store: historyStore, writer },
    agentHome: configHome ?? homedir(),
    // `@git-changes`, `@terminal` (fiche 057).
    contextText: (conversationId, workspace, source, exclusions) =>
      source === 'git-changes'
        ? gitChangesText(gitRun, workspace, 'git', exclusionsFor(exclusions, workspace))
        : terminalText(terminals, conversationId),
    toolServer,
    networkWatch: electronNetworkWatch(),
    toolModules: [
      terminalToolsModule(terminals, { always: approvals.commands }),
      browserTools,
      previewTools,
      ...(features.simulator ? [simulatorTools] : []),
      ...(androidTools ? [androidTools] : []),
      childrenToolsModule(() => children),
      memory.tools
    ],
    memory: memory.service,
    roles: roles.library,
    keepLive: (id) => children?.keepLive(id) ?? false,
    // Agents vivants au plus : le réglage, sauf `BOBINE_MAX_LIVE` (essais, e2e `filles`, fiche 102).
    maxLive: imposedLiveLimit(process.env),
    ...conversationRelease({ terminals, browser, browserTools }),
    profiles,
    settingsFile,
    conversationsDir: join(app.getPath('userData'), 'conversations'),
    neutralFolder,
    defaultWorkspace: defaultWorkspaceFor(process.env, testRun, neutralFolder),
    overrides: {
      profileId: process.env['BOBINE_AGENT_PROFILE'],
      workspace: process.env['BOBINE_WORKSPACE']
    },
    pathEnv: () => process.env['PATH'],
    clientVersion: app.getVersion(),
    openExternal: (url) => void shell.openExternal(url),
    worktrees,
    approvals: () => approvals.view(),
    quickEntryStatus: () => quickShortcut.state
  })

  // Son quand un agent attend (fiche 068), rebond du Dock (fiche 101) : macOS, ou un journal en essai.
  const alerts = systemAlerts(
    () => settings.preferences(),
    // Bannières et compteur coupés en mode présentation (fiche 159).
    () => settings.notificationsEnabled() && !presentation.active
  )
  // Compteur « À traiter » du Dock (fiche 119) : la règle de la barre latérale, comptée ici.
  const updateBadge = () =>
    alerts.badge.update(
      inboxCount(conversations.state().conversations, attention.state(), attention.details())
    )
  presentation.onChange(() => updateBadge())
  // Conversations qui attendent l'utilisateur : notifications, badge du Dock (fiche 024).
  const attention = new AttentionTracker({
    // Ce que la fenêtre principale montre (la fenêtre rapide n'affiche pas de conversation).
    isFocused: () => !!mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused(),
    shownIds: () => conversations.shownIds(),
    describe: (id) => {
      const summary = conversations.state().conversations.find((c) => c.id === id)
      return (
        summary && {
          title: summary.title,
          agent: summary.profileLabel,
          child: !!summary.startedFrom,
          workspace: summary.workspace
        }
      )
    },
    enabled: () => settings.notificationsEnabled() && !presentation.active,
    notify: (notice) => notifier.notify(notice),
    withdraw: (id) => notifier.withdraw(id),
    ...alerts.attention,
    // Ni son ni rebond du Dock en mode présentation (fiche 159).
    chime: () => !presentation.active && alerts.attention.chime?.(),
    bounce: (kind) => !presentation.active && alerts.attention.bounce?.(kind),
    emit: (state, details) => {
      send('attention:changed', state)
      send('attention:detailsChanged', details)
      updateBadge()
    }
  })
  const refreshAttention = () => attention.refresh()
  const updateKeepAwake = () =>
    keepAwake.update(
      conversations.state().conversations.some((conv) => conv.status === 'busy'),
      settings.preferences().keepAwake
    )

  // Abonnements (fiche 089) : dans l'ordre d'avant, le suivi de l'attention voit un évènement avant
  // les fenêtres, et une nouvelle liste après elles. Rien n'est émis avant `startActive`.
  conversations.subscribe({
    event: (payload) => attention.onEvent(payload.conversationId, payload.event),
    deleted: (id) => attention.forget(id)
  })
  // Fin d'un tour de l'agent : la taille d'écran qu'il a imposée à la page s'annule (fiche 129).
  conversations.subscribe({
    event: ({ conversationId, event }) => {
      if (event.type === 'turn-end' || event.type === 'turn-error') {
        void browser.endAgentTurn(conversationId).catch(() => {})
      }
    }
  })
  conversations.subscribe({
    event: (payload) => send('agent:event', payload),
    list: (state) => send('conversations:changed', state)
  })
  conversations.subscribe({
    list: () => {
      attention.refresh()
      updateBadge()
      updateKeepAwake()
    }
  })
  // Conversations filles (fiche 097) : compte rendu posé chez la mère à chaque fin de tour, après
  // l'évènement de la fille parti vers les fenêtres ; réveil groupé de la mère (étape 2).
  const childConversations = (children = setupChildren(conversations, {
    roles: roles.library,
    attention: () => attention.state(),
    launchesChanged: (state) => send('conversation:childLaunchesChanged', state)
  }))
  // Agent prêt (session ouverte) : quota encore inconnu relu malgré un échec récent (fiche 205).
  conversations.subscribe(quotaOnReady(quotas, (id) => conversations.profileOf(id)))
  // Plafond de coût par conversation (fiche 157, ADR-0035).
  const costCap = new CostCapGuard(conversations, () => settings.preferences())
  costCap.start()
  // Tâches planifiées (fiche 178, ADR-0039) : lancées tant que l'app est ouverte.
  // Ce que la lecture a mis de côté ou retrouvé (fiche 196, 197) : dit une fois.
  profile.loaded(approvals, historyStore, (status) => send('profile:changed', status))
  const scheduler = setupScheduler(conversations, userData, {
    readOnly: profile.readOnly,
    notifications: () => settings.notificationsEnabled() && !presentation.active,
    send: (tasks) => send('schedule:changed', tasks)
  })
  approvals.onChange(() => send('settings:changed', conversations.settingsView()))
  // Journal de consommation (fiche 130) : une ligne par tour, gardée après la conversation.
  const usageJournal = setupUsageJournal(conversations, join(userData, USAGE_DB_FILE), {
    profiles,
    history: historyStore,
    onChanged: () => send('usage:changed', null),
    readOnly: profile.readOnly()
  })

  /** Dernière valeur de « Garder les cookies du navigateur » (fiche 072). */
  let keptCookies = settings.preferences().browserKeepCookies
  /** Dernière valeur du réglage « Langue » (fiche 074). */
  let languagePreference = startLanguage
  settings.onChange(() => {
    attention.settingsChanged()
    // Cookies du navigateur plus gardés (fiche 072) : ce qui est sur le disque part tout de suite.
    const keepCookies = settings.preferences().browserKeepCookies
    if (keptCookies && !keepCookies) {
      void browser.clearData().catch((error: unknown) => log.warn('Navigateur :', error))
    }
    keptCookies = keepCookies
    updateKeepAwake()
    // Raccourci de la fenêtre rapide changé : réenregistré, et le menu l'affiche.
    const before = quickShortcut.state.shortcut
    quickShortcut.apply(settings.preferences().quickEntryShortcut)
    if (quickShortcut.state.shortcut !== before) refreshMenu()
    // Thème (fiche 027) : le CSS, xterm.js et les pages du navigateur suivent `nativeTheme`.
    nativeTheme.themeSource = settings.preferences().theme
    // Langue (fiche 074) : le main, le menu et chaque fenêtre suivent, sans relancer ; les
    // fenêtres de macOS, au prochain lancement (retirée d'abord : « Système » relit macOS).
    const preference = settings.preferences().language
    if (preference !== languagePreference && managesNativeLanguage) {
      syncNativeLanguage(appLanguage, preference, languagePreference)
    }
    languagePreference = preference
    const language = resolveLanguage(preference, app.getPreferredSystemLanguages())
    if (changeLanguage(language)) {
      refreshMenu()
      send('app:language', language)
    }
    send('settings:changed', conversations.settingsView())
  })
  // Quitter (fiche 089) : confirmation si un agent travaille (pas pour un arrêt du Mac ni un
  // signal), sessions des conversations vides supprimées chez leur agent, puis tout s'arrête.
  const quit = new QuitFlow({
    busyTitles: () =>
      conversations
        .state()
        .conversations.filter((conv) => conv.status === 'busy')
        .map((conv) => conv.title),
    ask: async (question) => {
      const parent = mainWindow
      const { response } = await (parent
        ? dialog.showMessageBox(parent, { type: 'warning', ...question })
        : dialog.showMessageBox({ type: 'warning', ...question }))
      return response === 0
    },
    hasDraftSessions: () => conversations.hasDraftSessions(),
    dropDraftSessions: () => conversations.dropDraftSessions(QUIT_DROP_MS),
    quit: () => app.quit(),
    // Disque plein : alerte tant que ça échoue (fiche 197), avant l'arrêt des processus.
    keepUnsaved: (interactive) =>
      profile.keepUnsaved(interactive, conversations, writer, async (question, signal) => {
        const options = { type: 'warning' as const, noLink: true, signal, ...question }
        const shown = mainWindow
          ? dialog.showMessageBox(mainWindow, options)
          : dialog.showMessageBox(options)
        return (await shown).response
      }),
    stopAsking: () => profile.stopAsking(),
    shutdown: (relaunch) => {
      quitting = true
      if (relaunch) app.relaunch()
      quickShortcut.dispose()
      quickEntry.destroy()
      htmlPreview.stop()
      keepAwake.update(false, false)
      conversations.stopAll()
      // Ce qui n'a toujours pas pu s'écrire : noté pour le lancement suivant (fiche 197).
      profile.noteUnsaved(conversations, writer)
      usageJournal.close()
      toolServer.stop()
      devServers.stopAll()
      stopAllJobs()
      simulator.stopStream(true)
      android?.stopStream()
      terminals.closeAll()
      onboarding.stop()
      quotas.stop()
      // Ce qu'aucun arrêt ci-dessus n'a visé (essai du diagnostic en cours…) : arrêté aussi (fiche 208).
      stopTrackedChildren()
    }
  })
  powerMonitor.on('shutdown', () => quit.confirm())
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      quit.confirm()
      app.quit()
    })
  }
  app.on('before-quit', (event) => quit.beforeQuit(event))
  failures.useQuitFlow(quit)
  // Agent qui ignore SIGTERM (fiche 195) : SIGKILL avant que le main ne sorte, attente bornée.
  failures.settleProcessesOnQuit()
  // Réinitialisation qui n'a rien fait (fiche 187) : dite dans la conversation de l'accueil.
  reportResetFailure((message) => conversations.addStartupNotice(message))
  // Serveur des outils de l'app pas démarré (fiche 195) : dit au lieu d'un silence.
  if (!toolServer.listening) conversations.addStartupNotice({ key: 'appTools.serverDown' })
  const onboarding = createOnboarding(firstLaunch, initialSettings, testRun, {
    settings,
    profiles: () => profiles,
    summaries: () => conversations.settingsView().profiles,
    cwd: neutralFolder,
    userData: app.getPath('userData'),
    workspaceOf: (id) => conversations.workspaceOf(id),
    runInTerminal: (id, cwd, command) => terminals.run(id, cwd, command).id,
    recordUsage: (row) => usageJournal.db.upsert(row),
    onReady: (profileId) => quotas.agentReady(profileId),
    version: app.getVersion()
  })
  // Fenêtre principale fermée ou rechargée : l'essai en cours s'arrête avec elle.
  mainWindowGone = () => onboarding.stop()
  void conversations.startActive()

  // L'app s'installe elle-même dans Applications (fiche 073), si la plateforme le permet.
  const installer = setupSelfInstall({
    enabled: features.selfInstall,
    isolated: freshStart.isolated,
    userData
  })

  registerIpcHandlers(
    ipcMain,
    // Lecture seule (fiche 196) : ce qui changerait le profil est refusé.
    profile.guard(
      createHandlers({
        appName: app.getName(),
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        platform: process.platform,
        ...(managesNativeLanguage ? { nativeLanguage: launchLanguage(app.getLocale()) } : {}),
        fonts: fontLister(),
        presentation: { active: () => presentation.active, set: (on) => presentation.set(on) },
        showLog,
        alerts: failures.alertsIpc,
        onboarding,
        // Lots de l'onglet « Échanges ACP » (fiche 135).
        send,
        about: {
          technicalInfo: () => technicalInfo(technicalFacts(conversations.settingsView().profiles)),
          close: () => about.close(),
          showChangelog: () => {
            about.close()
            focusMainWindow()
            broadcast('app:showChangelog', null)
          }
        },
        help: helpIpc(help, focusMainWindow),
        log: {
          status: logStatus,
          setLevel: (level) => {
            if (imposedLog) return logStatus()
            // Normal et Détaillé sont enregistrés ; Trace vaut jusqu'au prochain lancement.
            if (level !== 'trace') settings.setPreferences({ logLevel: level })
            setVerbosity(level)
            log.info(`Niveau du journal : ${level}`)
            return logStatus()
          },
          // « Afficher dans le Finder » (fiche 133) : le dossier des journaux n'est plus écrit au Diagnostic.
          open: (which) => withLogFile(which, (file) => void shell.openPath(file)),
          reveal: (which) => withLogFile(which, (file) => shell.showItemInFolder(file))
        },
        relaunch: () => quit.relaunchAfterQuit(),
        freshStart: freshStartIpc(() => quit.confirm()),
        mcp,
        approvalRules,
        providers,
        network: networkController(settings),
        approvals,
        installer,
        ...commandLineDeps(),
        takeLaunch: () => launch.take(),
        // « Relire le PATH » (Réglages › Agents, fiche 043) : l'agent était installé après le
        // lancement, ou le shell n'avait pas répondu à temps.
        reloadShellEnv: async () => {
          const problem = await readShellEnv()
          if (problem) throw new Error(problem)
          if (!quitting) broadcast('settings:changed', conversations.settingsView())
        },
        quick: quickEntryDeps({ conversations, quickEntry, focusMainWindow, broadcast }),
        previewHtml: (dir, file) => htmlPreview.urlFor(dir, file),
        thread: threadIpcDeps(),
        playSound: alerts.playSound,
        captureScreen: () =>
          captureScreen({
            run: runCommand,
            // BOBINE_SCREENCAPTURE : capture simulée (essais de bout en bout).
            command: process.env['BOBINE_SCREENCAPTURE'] || 'screencapture',
            decode: (data) => nativeImage.createFromBuffer(data),
            access: () => screenAccessOf(process.env, systemPreferences),
            // La fenêtre qui demande (et la fenêtre rapide) s'efface pendant la sélection.
            hideWindows: () => {
              // Fenêtre qui a le focus natif : `getFocusedWindow` passe par `isFocused`, que les
              // essais forcent à vrai sur la fenêtre principale (fiche 119) ; on lit le focus réel.
              const focusedContents = webContents.getFocusedWebContents()
              const focused = focusedContents
                ? BrowserWindow.fromWebContents(focusedContents)
                : null
              const hidden = BrowserWindow.getAllWindows().filter(
                (w) => w.isVisible() && (w === focused || w !== mainWindow)
              )
              quickEntry.setCapturing(true)
              for (const w of hidden) w.hide()
              return () => {
                for (const w of hidden) if (!w.isDestroyed()) w.show()
                if (focused && !focused.isDestroyed()) focused.focus()
                quickEntry.setCapturing(false)
              }
            }
          }),
        openCaptureSettings: () => shell.openExternal(SCREEN_RECORDING_SETTINGS),
        diagnostics: {
          system: () =>
            systemGroups({
              app: {
                version: app.getVersion(),
                electron: process.versions.electron,
                os: process.getSystemVersion(),
                packaged: app.isPackaged
              },
              workspace: conversations.settingsView().workspace,
              home: homedir(),
              shell: {
                path: process.env['SHELL'] || '/bin/zsh',
                ...(shellProblem ? { problem: shellProblem } : {})
              },
              run: runCommand,
              ...(features.simulator ? { xcrun } : {}),
              ...(axeBinary ? { axe: axeBinary } : {}),
              ...(axeInstallHint ? { axeInstallHint } : {}),
              ...(androidSdk ? { androidSdk: androidSdk.root } : {}),
              ...(features.screenCapture
                ? { screenAccess: screenAccessOf(process.env, systemPreferences) }
                : {})
            }),
          agent: async (profileId, trySession) => {
            const profile = profiles.find((p) => p.id === profileId)
            if (!profile) throw new Error(`Agent inconnu : ${profileId}`)
            const check = await conversations.checkAgent(profileId, { trySession })
            quotaAfterCheck(quotas, profileId, check)
            const installed = conversations.settingsView().profiles
            return agentGroup(profile, check, {
              home: homedir(),
              anotherInstalled: installed.some((p) => p.id !== profileId && p.available)
            })
          }
        },
        quotas,
        usage: usageJournal.board,
        saveCsv,
        conversations,
        children: childConversations,
        settings,
        chooseDirectory,
        saveFile,
        backupHistory: (target) => backupProfile(userData, target, app.getVersion()),
        profile: profile.ipc(conversations, fileOpeners(), chooseDirectory, quit),
        openTerminal,
        chooseFiles,
        searchFiles: searchWorkspaceFiles,
        devServers,
        terminals,
        attention: () => attention.state(),
        attentionDetails: () => attention.details(),
        // Branche du dossier (puce de la zone de saisie, fiches 037 et 049).
        git: new GitRepo(gitRun),
        commands: { project: projectCommands },
        changes: { git: new GitChangesReader(gitRun), ...fileOpeners() },
        worktree: worktreeCycleDeps(gitRun, conversations, worktrees, settings, send),
        childrenMerge: childrenMerger(gitRun, conversations, worktrees, () => attention.state()),
        // Aparté (fiche 180) : une session à part du même agent, hors du fil.
        asides: conversations,
        costCap,
        memory: memory.service,
        memoryIpc: memory.ipc,
        roles: roles.ipc,
        scheduler,
        // Après la garde du plafond de coût, qu'elle enchaîne (fiche 175).
        worktreeSetup: connectWorktreePreparation(conversations, preparation),
        notifications: notifier.controls(),
        android: androidController,
        simulator: simulatorController,
        browser: browserController
      })
    ),
    { trusted: trustedSender }
  )

  attachLaunch(conversations, {
    focus: focusMainWindow,
    show: ({ id, text }) => {
      send('app:openConversation', id)
      if (text) send('app:prefill', { id, text, attachments: [] })
    }
  })
  reopenMainWindow = () => void createMainWindow(browser, refreshAttention, settings)
  reopenMainWindow()

  app.on('activate', () => {
    // La fenêtre rapide, masquée, ne compte pas.
    if (!mainWindow || mainWindow.isDestroyed()) reopenMainWindow?.()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
