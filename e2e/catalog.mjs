/**
 * Catalogue des suites e2e (fiche 115) : nom, fichier, thèmes, et la carte des fichiers sources
 * dont chacune dépend, pour `pnpm e2e --changed`. Lu par `run.mjs` sans charger les suites.
 *
 * Carte écrite en lisant chaque suite : ses `data-testid` rapportés aux composants qui les posent,
 * les modules du main qu'elle exerce, ses fixtures. Motifs : `*` sans `/`, `**` avec, `/` final
 * pour tout un dossier. Le fichier de la suite s'y ajoute toujours. Une suite sans `sources` est
 * jouée à chaque `--changed`. Un fichier de `GLOBAL_SOURCES` modifié fait jouer toutes les suites.
 * Une carte incomplète n'est pas grave : `pnpm e2e --if-needed` joue tout avant le push.
 */

const BOTH = ['light', 'dark']
const R = 'src/renderer/src/'
const C = `${R}components/`

/**
 * Fichiers dont dépendent toutes les suites : l'app entière (fenêtre, IPC, réglages, agent et sa
 * session), ce que chaque essai touche (`send`, `ready` : zone de saisie, barre latérale, fil,
 * Markdown des réponses), l'agent factice, les outils des essais, les dépendances.
 */
export const GLOBAL_SOURCES = [
  `${R}styles.css`,
  `${R}themes.generated.css`,
  `${R}syntax.css`,
  'src/shared/themes.ts',
  'e2e/palette.mjs',
  `${R}App.tsx`,
  `${C}Welcome.tsx`,
  `${R}main.tsx`,
  'src/renderer/index.html',
  `${R}useConversations.ts`,
  `${C}composer/Composer.tsx`,
  `${C}sidebar/Sidebar.tsx`,
  `${C}common/ConversationState.tsx`,
  `${C}thread/Transcript.tsx`,
  `${C}thread/Markdown.tsx`,
  'src/shared/transcript.ts',
  'src/shared/ipc.ts',
  'src/shared/agent.ts',
  'src/shared/preferences.ts',
  'src/shared/i18n/**',
  'src/preload/**',
  'src/main/index.ts',
  'src/main/ipc.ts',
  'src/main/app-windows.ts',
  'src/main/renderer-windows.ts',
  'src/main/app-ipc.ts',
  'src/main/window-state.ts',
  'src/main/settings.ts',
  'src/main/settings-store.ts',
  // Capacités de la plateforme (fiche 145) : ce que toutes les fenêtres affichent ou masquent.
  'src/shared/platform.ts',
  'src/main/platform.ts',
  `${R}platform-features.ts`,
  'src/main/conversations/manager.ts',
  'src/main/conversations/settings-view.ts',
  'src/main/agent/agent-host.ts',
  'src/main/agent/initial-controls.ts',
  'src/main/agent/turn-retry.ts',
  'src/main/agent/silence-watch.ts',
  'src/main/agent/agent-process.ts',
  'src/main/agent/adapters.ts',
  'src/main/agent/profiles.ts',
  'src/main/agent/session-updates.ts',
  'src/mock-agent/**',
  'e2e/lib.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'electron.vite.config.ts'
]

/** Cartes d'outils de l'agent (permission, sortie, groupes). */
const TOOLS = [
  `${C}thread/ToolCall.tsx`,
  `${C}thread/ToolGroup.tsx`,
  'src/shared/tool-groups.ts',
  'src/shared/tool-label.ts'
]
/** Outils de l'app servis à l'agent par MCP (navigateur, appareils, filles). */
/** Suivi de la PR et de la CI (fiche 176) : ce que ses deux suites exercent. */
const PR_SOURCES = [
  'e2e/fake-gh.mjs',
  'e2e/pr-repo.mjs',
  `${C}panel/PrCard.tsx`,
  `${C}panel/WorktreeBar.tsx`,
  `${R}usePrTrack.ts`,
  `${R}pr-card.css`,
  'src/main/changes/pr-watch*.ts',
  'src/main/changes/worktree-ipc.ts',
  'src/main/changes/worktree-cycle.ts',
  'src/main/conversations/folder-fallback.ts',
  'src/shared/pr-tracking.ts'
]
const APP_TOOLS = ['src/main/mcp/', 'src/main/agent/app-tools-bridge.ts', 'src/shared/app-tools.ts']
/** Panneau latéral et ses onglets. */
const PANEL = [
  `${C}panel/SidePanel.tsx`,
  `${C}panel/PanelIcons.tsx`,
  `${R}panel-tabs.ts`,
  `${R}usePanel.ts`
]
/** Appareils (simulateur iOS, Android) : cadre, gestes, planche contact. */
const DEVICE = [
  `${C}panel/DeviceControls.tsx`,
  `${C}panel/AttachImageButton.tsx`,
  `${R}device-*.ts`,
  `${R}screen-gestures.ts`,
  'src/main/filmstrip/'
]
/** Réglages (fenêtre et onglets). */
const SETTINGS = [
  `${C}settings/SettingsDialog.tsx`,
  `${C}settings/SettingsBody.tsx`,
  `${C}settings/rows.tsx`
]
/** Réglages › Apparence (fiche 136). */
const APPEARANCE = [
  `${C}settings/AppearanceSettings.tsx`,
  `${C}settings/AppearanceParts.tsx`,
  `${R}appearance.ts`,
  // Police des icônes du terminal (fiche 201).
  `${R}terminal-symbols.css`,
  `${R}assets/fonts/`
]
/** Autorisations retenues : Réglages › Confidentialité (fiche 136). */
const PRIVACY = [`${C}settings/PrivacySettings.tsx`, `${C}settings/RememberedApprovals.tsx`]
/** Liste des agents et page d'un agent (fiche 136). */
const AGENT_PAGES = [
  `${C}settings/AgentsSettings.tsx`,
  `${C}settings/AgentPage.tsx`,
  `${C}settings/ApiKeys.tsx`
]
/** Git : dépôt, modifications, worktrees. */
const GIT = ['src/main/changes/', 'src/main/git/', 'src/shared/git.ts', `${R}useGitStatus.ts`]
/** Conversations gardées et rejouées. */
const REPLAY = [
  'src/main/conversations/store.ts',
  'src/main/conversations/history-writer.ts',
  'src/main/agent/session-replay.ts',
  'src/main/agent/replay-buffer.ts',
  'src/shared/replay-tail.ts'
]

/**
 * Suites, dans l'ordre de `pnpm e2e --jobs 1`. `run` : nom de la fonction exportée par le fichier.
 * `alone` : la suite prend une ressource de toute la machine et tourne seule ; `locks` : deux
 * suites au même verrou ne tournent pas en même temps (fiche 115) ; `needs` : capacités de la
 * plateforme sans lesquelles elle est sautée (fiche 145).
 */
export const SUITES = [
  {
    name: 'base',
    file: 'base.mjs',
    run: 'suite',
    themes: BOTH,
    sources: [
      `${C}common/Menus.tsx`,
      `${C}common/ModelMenu.tsx`,
      `${C}common/SpoolMark.tsx`,
      `${C}composer/AgentMenu.tsx`,
      `${C}composer/ComposerBar.tsx`,
      `${C}thread/WorkingIndicator.tsx`,
      `${C}thread/PlanList.tsx`,
      ...TOOLS,
      'src/main/approvals.ts',
      'src/shared/permissions.ts',
      'src/shared/models.ts'
    ]
  },
  {
    name: 'composer',
    file: 'composer.mjs',
    run: 'composerSuite',
    themes: BOTH,
    sources: [
      `${C}composer/`,
      `${C}common/`,
      `${C}thread/PlanDocument.tsx`,
      `${R}composer-*.ts`,
      `${R}useTextareaLayout.ts`,
      `${R}drafts.ts`,
      `${R}useComposerDraft.ts`,
      `${R}app-commands.ts`,
      'src/shared/app-commands.ts'
    ]
  },
  {
    name: 'restart',
    file: 'restart.mjs',
    run: 'restartSuite',
    themes: [null],
    sources: [
      ...REPLAY,
      'src/main/conversations/live-agents.ts',
      'src/main/agent/session-list.ts',
      'src/main/storage.ts',
      `${C}sidebar/ConversationMenu.tsx`,
      `${C}sidebar/SidebarSection.tsx`,
      `${C}composer/UsageMeter.tsx`
    ]
  },
  {
    name: 'startup',
    file: 'startup.mjs',
    run: 'startupSuite',
    themes: BOTH,
    sources: [
      `${C}composer/BlockerPanel.tsx`,
      `${C}composer/AgentMenu.tsx`,
      `${C}sidebar/AgentQuotaStatus.tsx`,
      'src/main/menu.ts',
      'src/main/dialogs.ts',
      'src/main/is-directory.ts',
      'src/main/user-data-migration.ts',
      'src/main/conversations/agentless.ts'
    ]
  },
  {
    name: 'bob',
    file: 'bob.mjs',
    run: 'bobSuite',
    themes: BOTH,
    sources: [
      `${C}composer/BlockerPanel.tsx`,
      `${C}composer/AgentMenu.tsx`,
      `${C}thread/ElicitationCard.tsx`,
      'src/shared/elicitation.ts',
      'src/main/agent/bob-*.ts',
      'src/main/agent/agent-check.ts',
      'src/main/agent/capabilities.ts'
    ]
  },
  {
    name: 'questions',
    file: 'questions.mjs',
    run: 'questionsSuite',
    themes: BOTH,
    sources: [
      `${C}thread/QuestionCard.tsx`,
      `${C}thread/PlanApproval.tsx`,
      `${C}thread/ElicitationCard.tsx`,
      `${C}thread/PlanDocument.tsx`,
      ...TOOLS,
      'src/shared/questions.ts',
      'src/shared/ask-user.ts',
      'src/shared/elicitation.ts',
      'src/main/mcp/ask-user-tool.ts',
      'src/main/agent/pending-requests.ts'
    ]
  },
  {
    name: 'usage',
    file: 'usage.mjs',
    run: 'usageSuite',
    themes: BOTH,
    sources: [`${C}composer/UsageMeter.tsx`, 'src/shared/usage.ts']
  },
  {
    name: 'usage-bob',
    file: 'usage.mjs',
    run: 'usageBobSuite',
    themes: BOTH,
    sources: [
      `${C}composer/UsageMeter.tsx`,
      'src/shared/usage.ts',
      'src/main/agent/bob-*.ts',
      'src/main/usage/*.ts',
      `${C}thread/TurnSummary.tsx`,
      'src/shared/turn-duration.ts',
      'src/main/agent/replay-buffer.ts'
    ]
  },
  {
    // Recommencer à neuf : profil temporaire, réinitialisation (fiche 148).
    name: 'fresh-start',
    file: 'fresh-start.mjs',
    run: 'freshStartSuite',
    themes: BOTH,
    sources: [
      `${C}settings/FreshStart.tsx`,
      `${C}settings/DataSettings.tsx`,
      `${R}fresh-start.ts`,
      'src/main/fresh-start.ts',
      'src/main/fresh-start-app.ts',
      'src/main/reset.ts',
      'src/shared/fresh-start.ts'
    ]
  },
  {
    name: 'usage-board',
    file: 'usage-board.mjs',
    run: 'usageBoardSuite',
    themes: BOTH,
    sources: [
      ...SETTINGS,
      `${C}activity/`,
      `${C}sidebar/Sidebar.tsx`,
      `${C}settings/UsageReset.tsx`,
      `${C}settings/DataSettings.tsx`,
      `${C}settings/ConfirmRow.tsx`,
      `${R}useActivityPage.ts`,
      'src/shared/usage-periods.ts',
      'src/shared/shortcuts.ts',
      'src/main/menu.ts',
      `${C}composer/UsageMeter.tsx`,
      `${R}usage-board.ts`,
      `${R}usage-board.css`,
      `${R}settings-search.ts`,
      'src/shared/usage-stats.ts',
      'src/shared/usage.ts',
      'src/main/usage/*.ts',
      'src/main/dialogs.ts'
    ]
  },
  {
    name: 'quota',
    file: 'quota.mjs',
    run: 'quotaSuite',
    themes: BOTH,
    sources: [
      `${C}sidebar/AgentQuotaStatus.tsx`,
      `${R}useAgentQuotas.ts`,
      'src/main/agent/quota*.ts',
      'src/main/agent/bob-status.ts'
    ]
  },
  {
    name: 'commands',
    file: 'commands.mjs',
    run: 'commandsSuite',
    themes: BOTH,
    sources: [
      `${C}composer/CommandMenu.tsx`,
      `${C}settings/CommandsSettings.tsx`,
      `${R}useCommandMenu.ts`,
      `${R}app-commands.ts`,
      'src/shared/commands.ts',
      'src/shared/app-commands.ts',
      'src/main/agent/compaction.ts'
    ]
  },
  {
    name: 'user-commands',
    file: 'user-commands.mjs',
    run: 'userCommandsSuite',
    themes: BOTH,
    sources: [
      `${C}composer/CommandMenu.tsx`,
      `${C}settings/CommandsSettings.tsx`,
      `${R}useCommandMenu.ts`,
      `${R}useProjectCommands.ts`,
      'src/shared/commands.ts',
      'src/shared/user-commands.ts',
      'src/main/user-commands.ts'
    ]
  },
  {
    name: 'attachments',
    file: 'attachments.mjs',
    run: 'attachmentsSuite',
    themes: BOTH,
    sources: [
      `${C}composer/FileMenu.tsx`,
      `${C}composer/ComposerAttachments.tsx`,
      `${C}composer/DropOverlay.tsx`,
      `${C}composer/AttachButton.tsx`,
      `${R}useAttachments.ts`,
      `${R}useFileDrop.ts`,
      `${R}useMentions.ts`,
      'src/shared/attachments.ts',
      'src/shared/context-mentions.ts',
      'src/main/agent/prompt-content.ts',
      'src/main/workspace-files.ts',
      `${C}composer/PastedText.tsx`,
      `${C}composer/ExcludedConfirm.tsx`,
      'src/main/agent-config/exclusions.ts',
      'src/main/agent-config/bob-exclusions.ts'
    ]
  },
  {
    // Tâches planifiées (fiche 178) : page, formulaire, échéances, plafond, repère de la barre.
    name: 'scheduled',
    file: 'scheduled.mjs',
    run: 'scheduledSuite',
    themes: BOTH,
    sources: [
      `${C}scheduled/`,
      'src/main/scheduler/',
      'src/shared/schedule.ts',
      `${R}useActivityPage.ts`,
      `${C}sidebar/HistoryItem.tsx`,
      `${C}sidebar/Sidebar.tsx`,
      'src/main/conversations/cost-cap.ts',
      'src/shared/cost-cap.ts',
      `${C}thread/CostCapCard.tsx`
    ]
  },
  {
    name: 'activity',
    file: 'activity.mjs',
    run: 'activitySuite',
    themes: BOTH,
    sources: [
      ...TOOLS,
      `${C}thread/WorkingIndicator.tsx`,
      `${C}thread/TerminalView.tsx`,
      'src/shared/activity.ts',
      'src/shared/json-output.ts'
    ]
  },
  {
    name: 'command-output',
    file: 'command-output.mjs',
    run: 'terminalSuite',
    themes: BOTH,
    sources: [
      ...TOOLS,
      `${C}thread/TerminalView.tsx`,
      'src/shared/terminal-output.ts',
      'src/main/terminal/',
      'src/main/jobs/'
    ]
  },
  {
    name: 'queue',
    file: 'queue.mjs',
    run: 'queueSuite',
    themes: BOTH,
    sources: [
      `${C}composer/QueuedMessages.tsx`,
      `${R}useComposerInbox.ts`,
      'src/main/agent/message-queue.ts'
    ]
  },
  {
    name: 'panel',
    file: 'panel.mjs',
    run: 'panelSuite',
    themes: BOTH,
    sources: [
      `${C}panel/`,
      `${C}thread/BesidePane.tsx`,
      ...PANEL,
      `${R}useBeside.ts`,
      'src/shared/panel.ts'
    ]
  },
  {
    // Onglet « Session » (fiche 166) : ouvert d'office, contexte, modifications, en cours.
    name: 'session',
    file: 'session.mjs',
    run: 'sessionSuite',
    themes: BOTH,
    sources: [
      `${C}panel/Session*.tsx`,
      `${C}panel/DevServersBar.tsx`,
      `${C}common/ModelMenu.tsx`,
      `${C}common/Menus.tsx`,
      ...PANEL,
      ...GIT,
      `${R}session-*.ts`,
      `${R}session-tab.css`,
      `${R}useSessionRunning.ts`,
      `${R}mcp-status.ts`,
      `${R}components/sidebar/sidebar-width.ts`,
      'src/shared/context-breakdown.ts',
      'src/shared/usage.ts',
      'src/shared/panel.ts',
      'src/shared/launch.ts',
      'src/shared/terminal.ts',
      'src/main/preview/',
      'src/main/terminal/',
      'src/main/agent-config/mcp-probe.ts',
      'src/main/mcp/catalog.ts'
    ]
  },
  {
    // Plusieurs dossiers par conversation (fiche 179) : ajout, retrait, agent sans la capacité.
    name: 'dossiers',
    file: 'dossiers.mjs',
    run: 'dossiersSuite',
    themes: BOTH,
    sources: [
      `${C}panel/SessionFolders.tsx`,
      `${C}panel/SessionEnvironment.tsx`,
      `${C}panel/SessionTab.tsx`,
      `${R}session-tab.css`,
      'src/main/conversations/additional-directories.ts',
      'src/main/conversations/additional-directories-ipc.ts',
      'src/main/agent/additional-directories.ts',
      'src/main/conversations/store.ts',
      'src/main/conversations/helpers.ts',
      'src/main/conversations/host-options.ts',
      'src/main/dialogs.ts'
    ]
  },
  {
    // Finitions de la 0.9.1 (fiche 185) : bilan du tour, « ↓ N nouveaux ».
    name: 'finitions',
    file: 'finitions.mjs',
    run: 'finitionsSuite',
    themes: BOTH,
    sources: [
      `${C}thread/TurnSummary.tsx`,
      `${C}thread/ScrollDownButton.tsx`,
      `${R}useNewSinceScroll.ts`,
      `${R}useThreadScroll.ts`,
      `${R}motion.css`
    ]
  },
  {
    // Onglets du panneau au plus étroit, en français puis en anglais (fiche 185, D25, D26).
    name: 'onglets-etroits',
    file: 'onglets-etroits.mjs',
    run: 'narrowTabsSuite',
    themes: BOTH,
    sources: [
      `${C}panel/SidePanel.tsx`,
      `${C}panel/compact-tabs.ts`,
      `${C}composer/useBarFold.ts`,
      `${C}composer/AgentMenu.tsx`,
      'src/mock-agent/scenarios-debordements.mts'
    ]
  },
  {
    name: 'pinned-plan',
    file: 'pinned-plan.mjs',
    run: 'pinnedPlanSuite',
    themes: BOTH,
    sources: [
      `${C}thread/PinnedPlan.tsx`,
      `${C}thread/PlanList.tsx`,
      `${C}thread/BesidePane.tsx`,
      `${R}useBeside.ts`
    ]
  },
  {
    // Aparté (fiche 180) : question à côté pendant le tour, session à part, « Ajouter au fil ».
    name: 'aparte',
    file: 'aparte.mjs',
    run: 'asideSuite',
    themes: BOTH,
    sources: [
      `${C}thread/AsideCard.tsx`,
      `${R}useAside.ts`,
      `${R}aside.css`,
      `${R}app-commands.ts`,
      `${R}useFileDrop.ts`,
      `${C}composer/CommandMenu.tsx`,
      'src/shared/aside.ts',
      'src/shared/app-commands.ts',
      'src/shared/shortcuts.ts',
      'src/shared/usage.ts',
      'src/main/conversations/aside.ts',
      'src/main/conversations/aside-ipc.ts',
      'src/main/conversations/host-options.ts',
      'src/main/conversations/agent-outside.ts',
      'src/main/menu.ts'
    ]
  },
  {
    name: 'browser',
    file: 'browser.mjs',
    run: 'browserSuite',
    themes: BOTH,
    sources: [
      `${C}panel/BrowserTab.tsx`,
      ...PANEL,
      ...DEVICE,
      ...TOOLS,
      ...APP_TOOLS,
      'src/main/browser/',
      'src/shared/browser.ts',
      'e2e/pages.mjs'
    ]
  },
  {
    // Défilement, zoom, la page suit le panneau, taille imposée par l'agent (fiche 129).
    name: 'browser-view',
    file: 'browser-view.mjs',
    run: 'browserViewSuite',
    themes: BOTH,
    sources: [
      `${C}panel/BrowserTab.tsx`,
      `${C}panel/SidePanel.tsx`,
      'src/main/browser/',
      'src/main/menu.ts',
      'src/shared/browser.ts',
      'e2e/pages.mjs'
    ]
  },
  {
    // Annoter la page au clic, façon Figma (fiche 132), page vivante (fiche 146).
    name: 'browser-annotate',
    file: 'browser-annotate.mjs',
    run: 'browserAnnotateSuite',
    themes: BOTH,
    sources: [
      `${C}panel/BrowserTab.tsx`,
      `${C}panel/PageAnnotator.tsx`,
      `${C}panel/SidePanel.tsx`,
      `${R}page-annotation.ts`,
      `${R}page-notes-store.ts`,
      `${R}usePageAnnotation.ts`,
      `${R}annotation.ts`,
      'src/main/browser/',
      'src/shared/page-notes.ts'
    ]
  },
  {
    name: 'launch',
    file: 'launch.mjs',
    run: 'launchSuite',
    themes: BOTH,
    sources: [
      `${C}panel/DevServersBar.tsx`,
      `${C}panel/BrowserTab.tsx`,
      ...PANEL,
      'src/main/preview/',
      'src/main/jobs/',
      'src/shared/launch.ts'
    ]
  },
  {
    name: 'simulator',
    file: 'simulator.mjs',
    run: 'simulatorSuite',
    themes: BOTH,
    needs: ['simulator'],
    sources: [
      'src/main/device-ipc.ts',
      `${C}panel/SimulatorTab.tsx`,
      ...PANEL,
      ...DEVICE,
      ...TOOLS,
      ...APP_TOOLS,
      'src/main/simulator/',
      'src/shared/simulator.ts',
      'e2e/fixtures/simulateur.jpg'
    ]
  },
  {
    name: 'android',
    file: 'android.mjs',
    run: 'androidSuite',
    themes: BOTH,
    sources: [
      'src/main/device-ipc.ts',
      `${C}panel/AndroidTab.tsx`,
      ...PANEL,
      ...DEVICE,
      ...TOOLS,
      ...APP_TOOLS,
      `${R}android-chassis.ts`,
      'src/main/android/',
      'src/shared/android.ts',
      'e2e/fixtures/android*'
    ]
  },
  {
    name: 'acp',
    file: 'acp.mjs',
    run: 'acpSuite',
    themes: BOTH,
    sources: [
      `${C}panel/AcpTab.tsx`,
      `${C}common/CopyButton.tsx`,
      ...PANEL,
      `${R}acp-view.ts`,
      `${R}useAcpExchanges.ts`,
      'src/main/agent/acp-exchanges.ts',
      'src/main/agent/acp-exchanges-ipc.ts',
      'src/main/agent/acp-log.ts',
      'src/main/log-redact.ts',
      'src/shared/acp-exchanges.ts',
      'src/shared/panel.ts'
    ]
  },
  {
    name: 'terminal',
    file: 'terminal.mjs',
    run: 'terminalPanelSuite',
    themes: BOTH,
    sources: [
      `${C}panel/TerminalTab.tsx`,
      `${R}theme.ts`,
      ...PANEL,
      ...SETTINGS,
      ...APPEARANCE,
      ...PRIVACY,
      'src/main/terminal/',
      'src/shared/terminal.ts'
    ]
  },
  {
    name: 'notifications',
    file: 'notifications.mjs',
    run: 'notificationsSuite',
    themes: BOTH,
    sources: [
      'src/main/notifications/',
      'src/shared/attention.ts',
      'src/shared/inbox.ts',
      `${C}sidebar/`,
      ...TOOLS
    ]
  },
  {
    name: 'inbox',
    file: 'inbox.mjs',
    run: 'inboxSuite',
    themes: BOTH,
    sources: [
      'e2e/sidebar-tooltip.mjs',
      'src/main/notifications/',
      'src/shared/attention.ts',
      'src/shared/inbox.ts',
      'src/shared/questions.ts',
      `${C}sidebar/`,
      `${C}thread/QuestionCard.tsx`,
      `${C}settings/GeneralSettings.tsx`,
      `${R}settings-search.ts`,
      'src/main/conversations/children.ts',
      ...TOOLS,
      ...SETTINGS
    ]
  },
  {
    name: 'changes',
    file: 'changes.mjs',
    run: 'changesSuite',
    themes: BOTH,
    sources: [
      `${C}panel/ChangesTab.tsx`,
      `${C}thread/DiffView.tsx`,
      ...PANEL,
      ...GIT,
      'src/shared/changes.ts',
      'src/shared/diff.ts',
      'src/shared/diff-notes.ts',
      `${R}diff-notes-store.ts`
    ]
  },
  {
    name: 'replay-changes',
    file: 'replay-changes.mjs',
    run: 'replayChangesSuite',
    themes: BOTH,
    sources: [
      `${C}panel/ChangesTab.tsx`,
      `${C}thread/DiffView.tsx`,
      ...REPLAY,
      'src/main/agent/opencode-diffs.ts',
      'src/shared/changes.ts',
      'src/shared/diff.ts'
    ]
  },
  {
    name: 'git',
    file: 'git.mjs',
    run: 'gitSuite',
    themes: BOTH,
    sources: [
      `${C}sidebar/ConversationTitle.tsx`,
      `${C}sidebar/ConversationMenu.tsx`,
      `${C}composer/ComposerBar.tsx`,
      `${C}panel/ChangesTab.tsx`,
      ...PANEL,
      ...GIT
    ]
  },
  {
    name: 'settings',
    file: 'settings.mjs',
    run: 'settingsSuite',
    themes: BOTH,
    sources: [
      `${C}settings/`,
      `${C}dialogs/SearchDialog.tsx`,
      `${C}thread/FindBar.tsx`,
      `${R}settings-search.ts`,
      `${R}useMenuCommands.ts`,
      `${R}appearance.ts`,
      'src/main/menu.ts',
      'src/shared/shortcuts.ts'
    ]
  },
  {
    name: 'language',
    file: 'language.mjs',
    run: 'languageSuite',
    themes: BOTH,
    sources: [
      ...SETTINGS,
      `${C}settings/GeneralSettings.tsx`,
      `${R}i18n.ts`,
      'src/main/i18n.ts',
      'src/main/native-language.ts',
      'src/main/menu.ts'
    ]
  },
  {
    name: 'history',
    file: 'history.mjs',
    run: 'historySuite',
    themes: BOTH,
    sources: [
      'e2e/sidebar-tooltip.mjs',
      `${C}dialogs/SearchDialog.tsx`,
      `${C}thread/FindBar.tsx`,
      `${C}sidebar/`,
      `${R}useThreadFind.ts`,
      `${R}thread-find.ts`,
      `${R}drafts.ts`,
      'src/main/conversations/content-search.ts',
      'src/shared/conversation-search.ts'
    ]
  },
  {
    name: 'worktree-setup',
    file: 'worktree-setup.mjs',
    run: 'worktreeSetupSuite',
    themes: BOTH,
    sources: [
      `${C}thread/WorktreeSetup.tsx`,
      `${C}thread/WorktreeStart.tsx`,
      'src/shared/worktree-setup.ts',
      'src/main/changes/worktree-setup.ts',
      'src/main/changes/worktree-include.ts',
      'src/main/changes/worktree-setup-wiring.ts',
      'src/main/changes/worktree-setup-ipc.ts',
      'src/main/changes/worktrees.ts',
      'src/main/approvals.ts',
      'src/main/scheduler/scheduler.ts'
    ]
  },
  {
    name: 'parallel',
    file: 'parallel.mjs',
    run: 'parallelSuite',
    themes: BOTH,
    sources: [
      'e2e/sidebar-tooltip.mjs',
      `${C}sidebar/HistoryItem.tsx`,
      `${C}thread/BesidePane.tsx`,
      `${C}sidebar/ConversationMenu.tsx`,
      `${R}useBeside.ts`,
      'src/main/conversations/live-agents.ts',
      'src/main/changes/worktrees.ts'
    ]
  },
  {
    name: 'worktree-cycle',
    file: 'worktree-cycle.mjs',
    run: 'worktreeCycleSuite',
    themes: BOTH,
    sources: [
      `${C}panel/WorktreeBar.tsx`,
      `${C}panel/ChangesTab.tsx`,
      `${C}settings/OrphanWorktrees.tsx`,
      `${C}settings/DataSettings.tsx`,
      `${R}useWorktreeCycle.ts`,
      ...GIT,
      'src/shared/worktree-cycle.ts'
    ]
  },
  {
    // Suivi de la PR et de la CI (fiche 176) : faux `gh` (`BOBINE_GH`), jamais GitHub.
    name: 'pr-ci',
    file: 'pr-ci.mjs',
    run: 'prCiSuite',
    themes: BOTH,
    sources: [
      ...PR_SOURCES,
      `${C}panel/SessionTab.tsx`,
      `${C}panel/WorktreeCleaned.tsx`,
      `${C}panel/ChangesTab.tsx`,
      `${R}useWorktreeCycle.ts`
    ]
  },
  {
    // Dépôt sans CI (fiche 176, 0.9.1) : « Aucune CI détectée », « Fusionner maintenant ».
    name: 'pr-ci-sans-ci',
    file: 'pr-ci-sans-ci.mjs',
    run: 'prCiNoCiSuite',
    themes: BOTH,
    sources: PR_SOURCES
  },
  {
    // GitLab auto-hébergé (fiche 189) : faux `glab` (`BOBINE_GLAB`), jamais GitLab.
    name: 'gitlab',
    file: 'gitlab.mjs',
    run: 'gitlabSuite',
    themes: BOTH,
    sources: [
      'e2e/fake-glab.mjs',
      'e2e/pr-repo.mjs',
      `${C}panel/WorktreeBar.tsx`,
      `${C}panel/ChangesTab.tsx`,
      `${R}useWorktreeCycle.ts`,
      'src/main/changes/forge*.ts',
      `${C}panel/worktree-outcome.ts`,
      'src/main/changes/worktree-ipc.ts',
      'src/main/changes/worktree-cycle.ts',
      'src/shared/worktree-cycle.ts'
    ]
  },
  {
    name: 'filles',
    file: 'filles.mjs',
    run: 'fillesSuite',
    themes: BOTH,
    sources: [
      'e2e/sidebar-tooltip.mjs',
      `${C}thread/ChildProposals.tsx`,
      `${C}thread/Subtasks.tsx`,
      `${C}panel/ChildrenView.tsx`,
      'src/shared/children-rows.ts',
      `${R}useThreadScroll.ts`,
      `${C}sidebar/`,
      `${C}settings/ConversationSettings.tsx`,
      `${C}composer/QueuedMessages.tsx`,
      'src/main/conversations/children*.ts',
      'src/main/mcp/children-tools.ts',
      'src/main/conversations/host-options.ts',
      'src/main/changes/worktrees.ts',
      'src/shared/children.ts',
      'src/shared/app-commands.ts',
      `${R}app-commands.ts`
    ]
  },
  {
    name: 'relecture',
    file: 'relecture.mjs',
    run: 'relectureSuite',
    themes: BOTH,
    sources: [
      `${C}panel/ChangesTab.tsx`,
      `${C}panel/ChangesBars.tsx`,
      `${C}panel/ChildrenView.tsx`,
      `${C}panel/ReviewDialog.tsx`,
      `${C}panel/ReviewNotes.tsx`,
      `${C}thread/ReviewCard.tsx`,
      `${C}thread/DiffView.tsx`,
      `${C}sidebar/child-options.tsx`,
      `${C}dialogs/AppDialogs.tsx`,
      `${R}diff-notes-store.ts`,
      'src/shared/review.ts',
      'src/shared/diff-notes.ts',
      'src/main/conversations/children*.ts',
      'src/main/mcp/children-tools.ts',
      'src/main/mcp/review-tools.ts',
      'src/mock-agent/scenarios-relecture.mts'
    ]
  },
  {
    name: 'libelles',
    file: 'libelles.mjs',
    run: 'libellesSuite',
    themes: BOTH,
    sources: [
      'src/shared/permissions.ts',
      'src/shared/presentation.ts',
      `${C}settings/DataSettings.tsx`,
      `${C}thread/ToolCall.tsx`
    ]
  },
  {
    name: 'memoire',
    file: 'memoire.mjs',
    run: 'memoireSuite',
    themes: BOTH,
    sources: [
      'src/shared/app-tools.ts',
      `${C}thread/MemoryProposalCard.tsx`,
      `${C}settings/MemorySettings.tsx`,
      `${C}settings/MemoryEntryRow.tsx`,
      `${C}settings/AppToolsTab.tsx`,
      `${C}panel/SessionContext.tsx`,
      `${R}memory.css`,
      `${R}memory-focus.ts`,
      `${R}useTurnGuards.ts`,
      'src/shared/memory.ts',
      'src/main/memory/',
      'src/main/mcp/memory-tools.ts',
      'src/main/secret-scan.ts',
      'src/mock-agent/scenarios-memoire.mts'
    ]
  },
  {
    name: 'filles-visibilite',
    file: 'filles-visibilite.mjs',
    run: 'fillesVisibilitySuite',
    themes: BOTH,
    sources: [
      `${C}sidebar/`,
      'src/main/conversations/children.ts',
      'src/main/conversations/manager.ts',
      'src/main/changes/worktrees.ts'
    ]
  },
  {
    name: 'filles-tech-lead',
    file: 'filles-tech-lead.mjs',
    run: 'fillesTechLeadSuite',
    themes: BOTH,
    sources: [
      `${C}thread/ChildProposals.tsx`,
      `${C}thread/Subtasks.tsx`,
      `${C}thread/SubtasksMerge.tsx`,
      'src/main/conversations/children.ts',
      'src/main/mcp/children-tools.ts',
      'src/shared/children.ts',
      'src/mock-agent/scenarios-filles.mts'
    ]
  },
  {
    name: 'filles-fusion',
    file: 'filles-fusion.mjs',
    run: 'fillesFusionSuite',
    themes: BOTH,
    sources: [
      `${C}thread/Subtasks.tsx`,
      `${C}thread/SubtasksMerge.tsx`,
      'src/main/conversations/children-merge*.ts',
      'src/main/conversations/children.ts',
      'src/main/changes/worktree-cycle.ts',
      'src/main/changes/worktrees.ts',
      'src/shared/children-merge.ts',
      'src/shared/worktree-cycle.ts'
    ]
  },
  {
    name: 'plan',
    file: 'plan.mjs',
    run: 'planSuite',
    themes: BOTH,
    sources: [
      `${C}thread/PlanDocument.tsx`,
      `${C}thread/PlanApproval.tsx`,
      `${R}plan-notes.ts`,
      'src/shared/plan-doc.ts'
    ]
  },
  {
    name: 'network',
    file: 'network.mjs',
    run: 'networkSuite',
    themes: BOTH,
    sources: [
      `${C}thread/TurnRetryBanner.tsx`,
      `${R}turn-retry.css`,
      'src/main/agent/turn-failure.ts',
      'src/main/network-watch.ts',
      'src/main/network-watch-electron.ts'
    ]
  },
  {
    name: 'failures',
    file: 'failures.mjs',
    run: 'failuresSuite',
    themes: BOTH,
    sources: [
      ...REPLAY,
      `${C}common/ErrorBoundary.tsx`,
      `${R}ipc-errors.ts`,
      'src/main/agent/process-utils.ts',
      'src/main/log.ts',
      'src/main/log-redact.ts',
      'src/shared/errors.ts'
    ]
  },
  {
    name: 'pannes-visibles',
    file: 'pannes-visibles.mjs',
    run: 'failuresVisibleSuite',
    themes: BOTH,
    sources: [
      ...REPLAY,
      `${C}common/SafeBoundary.tsx`,
      `${C}common/AppAlertsBar.tsx`,
      `${C}thread/SilenceBanner.tsx`,
      `${C}thread/TurnFooter.tsx`,
      `${R}silence-banner.css`,
      `${R}safe-boundary.css`,
      `${R}app-alerts.css`,
      'src/shared/app-alerts.ts',
      'src/main/app-alerts.ts',
      'src/main/app-failures.ts',
      'src/main/crash-marker.ts',
      'src/main/quit-guard.ts',
      'src/main/process-group.ts',
      'src/main/process-registry.ts',
      'src/main/agent/stop-watch.ts',
      'src/main/agent/process-utils.ts',
      'src/mock-agent/scenarios-pannes.mts'
    ]
  },
  {
    name: 'branch',
    file: 'branch.mjs',
    run: 'branchSuite',
    themes: BOTH,
    sources: [
      'e2e/sidebar-tooltip.mjs',
      `${C}sidebar/HistoryItem.tsx`,
      `${C}dialogs/BranchDialog.tsx`,
      'src/main/conversations/branching.ts',
      'src/main/conversations/restore-files.ts',
      'src/shared/branch.ts'
    ]
  },
  {
    name: 'custom-agent',
    file: 'custom-agent.mjs',
    run: 'customAgentSuite',
    themes: BOTH,
    sources: [
      ...SETTINGS,
      ...AGENT_PAGES,
      `${C}settings/CustomAgentForm.tsx`,
      `${C}settings/ConfirmRow.tsx`,
      `${C}composer/AgentMenu.tsx`,
      `${R}custom-agent.css`,
      'src/shared/custom-agents.ts',
      'src/shared/handover.ts',
      'src/shared/session-renewal.ts',
      'src/main/agent/custom-profiles.ts'
    ]
  },
  {
    name: 'handover',
    file: 'handover.mjs',
    run: 'handoverSuite',
    themes: BOTH,
    sources: [
      `${C}composer/HandoverDialog.tsx`,
      `${C}composer/AgentMenu.tsx`,
      `${C}common/ModelMenu.tsx`,
      'src/main/conversations/handover.ts',
      'src/main/agent-config/provider-files.ts',
      'src/main/agent/models-seen.ts',
      'src/shared/handover.ts',
      'src/shared/models.ts'
    ]
  },
  {
    name: 'mcp',
    file: 'mcp.mjs',
    run: 'mcpSuite',
    themes: BOTH,
    sources: [
      ...SETTINGS,
      `${C}settings/McpSettings.tsx`,
      `${C}settings/AppToolsTab.tsx`,
      `${C}common/Menus.tsx`,
      `${R}mcp-status.ts`,
      'src/main/agent-config/mcp-*.ts',
      'src/main/agent-config/*-mcp.ts',
      ...APP_TOOLS,
      'src/shared/mcp.ts',
      'e2e/fixtures/mcp-serveur.mjs'
    ]
  },
  {
    // Règles d'approbation de Bob (fiche 215) : IPC, section des cartes de commande, réglages.
    name: 'regles-approbation',
    file: 'regles-approbation.mjs',
    run: 'approvalRulesSuite',
    themes: BOTH,
    sources: [
      'src/main/agent-config/*approval-rules*.ts',
      'src/main/agent-config/config-prune.ts',
      'src/main/storage.ts',
      'src/main/read-only-guard.ts',
      'src/shared/approval-rules*.ts',
      'src/shared/command-view.ts',
      'src/main/agent/profiles.ts',
      `${C}thread/ToolCall.tsx`,
      `${C}thread/GlobalRuleSection.tsx`,
      `${C}thread/global-rules.ts`,
      `${C}thread/useArmedCard.ts`,
      `${C}settings/ApprovalRulesPage.tsx`,
      `${C}settings/AgentPage.tsx`,
      `${C}settings/SettingsDialog.tsx`,
      `${C}settings/SettingsBody.tsx`,
      `${C}settings/ConfirmRow.tsx`,
      `${C}dialogs/AppDialogs.tsx`,
      `${R}approval-rules.css`,
      `${C}thread/PermissionRisks.tsx`,
      'src/main/mcp/command-approval.ts',
      'src/main/agent/app-tools-bridge.ts',
      'src/main/conversations/host-options.ts',
      'src/mock-agent/scenarios-commandes.mts',
      'src/mock-agent/scenarios.mts'
    ]
  },
  {
    name: 'providers',
    file: 'providers.mjs',
    run: 'providersSuite',
    themes: BOTH,
    sources: [
      ...SETTINGS,
      `${C}settings/ProvidersSettings.tsx`,
      `${C}settings/NetworkSettings.tsx`,
      `${C}settings/DiagnosticsSettings.tsx`,
      ...AGENT_PAGES,
      'src/main/agent-config/provider*.ts',
      'src/main/agent-config/opencode-providers.ts',
      'src/main/agent-config/network-env.ts',
      'src/main/agent-config/api-keys.ts',
      'src/main/shell-env.ts',
      'src/main/diagnostics.ts',
      'src/shared/providers.ts',
      'e2e/fixtures/openai-compatible.mts'
    ]
  },
  {
    // « Autoriser cette commande ? » : la commande entière avant d'accepter (0.11, M1) ; cartes
    // « commande » et « fichier » de la recette OpenCode (fiche 203) ; cartes à risque (fiche 211).
    name: 'autorisation-commande',
    file: 'autorisation-commande.mjs',
    run: 'autorisationCommandeSuite',
    themes: BOTH,
    sources: [
      ...TOOLS,
      `${C}thread/CommandBlock.tsx`,
      `${C}thread/DiffView.tsx`,
      `${C}thread/PermissionRisks.tsx`,
      `${C}thread/workspace-context.ts`,
      'src/shared/command-view.ts',
      'src/shared/permissions.ts',
      'src/shared/presentation.ts',
      'src/main/agent/permission-risk.ts',
      'src/main/agent/command-writes.ts',
      'src/main/agent/shell-words.ts',
      'src/mock-agent/scenarios-commandes.mts'
    ]
  },
  {
    name: 'permissions',
    file: 'permissions.mjs',
    run: 'permissionsSuite',
    themes: BOTH,
    sources: [
      ...SETTINGS,
      ...PRIVACY,
      ...TOOLS,
      'src/main/approvals.ts',
      'src/main/mcp/command-approval.ts',
      'src/shared/approvals.ts',
      'src/shared/permissions.ts'
    ]
  },
  {
    name: 'presentation',
    file: 'presentation.mjs',
    run: 'presentationSuite',
    themes: BOTH,
    sources: [
      `${C}common/PresentationPill.tsx`,
      `${C}composer/UsageMeter.tsx`,
      `${C}sidebar/AgentQuotaStatus.tsx`,
      ...SETTINGS,
      ...APPEARANCE,
      `${R}presentation.ts`,
      'src/shared/presentation.ts',
      'src/main/presentation.ts',
      'src/main/menu.ts',
      'scripts/themes-css.mts'
    ]
  },
  {
    name: 'touches',
    file: 'touches.mjs',
    run: 'touchesSuite',
    themes: BOTH,
    // Copie dans le presse-papiers de la machine, relu ensuite (comme `diagnostic`).
    locks: ['presse-papiers'],
    sources: [
      `${C}common/CopyButton.tsx`,
      `${C}composer/ComposerBar.tsx`,
      `${C}composer/ComposerContext.tsx`,
      `${C}sidebar/ConversationMenu.tsx`,
      ...SETTINGS,
      `${C}settings/ConversationSettings.tsx`,
      `${C}settings/GeneralSettings.tsx`,
      ...AGENT_PAGES,
      ...APPEARANCE,
      `${R}time.ts`,
      'src/main/quit-guard.ts'
    ]
  },
  {
    name: 'fun',
    file: 'fun.mjs',
    run: 'funSuite',
    themes: BOTH,
    sources: [
      ...SETTINGS,
      ...APPEARANCE,
      `${C}composer/UsageMeter.tsx`,
      `${C}thread/ConversationOutline.tsx`,
      'src/main/agent/bob-costs.ts'
    ]
  },
  {
    name: 'auth',
    file: 'auth.mjs',
    run: 'authSuite',
    themes: BOTH,
    sources: [
      `${C}composer/BlockerPanel.tsx`,
      `${C}dialogs/InstallDialog.tsx`,
      ...SETTINGS,
      ...AGENT_PAGES,
      'src/main/agent-config/api-keys.ts',
      'src/main/agent/agent-check.ts',
      'src/main/terminal/',
      'src/shared/install.ts'
    ]
  },
  {
    name: 'versions',
    file: 'versions.mjs',
    run: 'versionsSuite',
    themes: BOTH,
    sources: [
      'src/main/agent/agent-version.ts',
      'src/main/agent/version-check.ts',
      'src/main/conversations/host-options.ts',
      'src/mock-agent/scenarios-limites.mts',
      `${R}open-settings.ts`,
      `${C}thread/Transcript.tsx`
    ]
  },
  {
    name: 'onboarding',
    file: 'onboarding.mjs',
    run: 'onboardingSuite',
    themes: BOTH,
    sources: [
      `${C}onboarding/`,
      `${R}onboarding.css`,
      `${C}composer/BlockerPanel.tsx`,
      'src/shared/onboarding.ts',
      'src/main/onboarding/',
      'src/main/agent/short-lived-agent.ts',
      'src/main/agent/session-blocker.ts',
      'src/main/agent/turn-auth.ts'
    ]
  },
  {
    name: 'connexion-expiree',
    file: 'connexion-expiree.mjs',
    run: 'connexionExpireeSuite',
    themes: BOTH,
    sources: [
      `${C}composer/BlockerPanel.tsx`,
      `${C}composer/Composer.tsx`,
      `${C}sidebar/Sidebar.tsx`,
      'src/main/agent/turn-auth.ts',
      'src/main/agent/session-blocker.ts',
      'src/main/agent/app-tools-bridge.ts'
    ]
  },
  {
    name: 'subagents',
    file: 'subagents.mjs',
    run: 'subagentsSuite',
    themes: BOTH,
    sources: [
      ...TOOLS,
      `${C}thread/WorkingIndicator.tsx`,
      `${R}subagent-work.ts`,
      'src/main/agent/subagent-*.ts',
      'src/main/agent/*-subagents.ts',
      'src/main/agent/profile-updates.ts',
      'src/main/agent/bob-costs.ts',
      'src/shared/subagent.ts'
    ]
  },
  { name: 'tables', file: 'tables.mjs', run: 'tablesSuite', themes: BOTH, sources: [] },
  {
    name: 'debordements',
    file: 'debordements.mjs',
    run: 'overflowSuite',
    themes: BOTH,
    // Fiche 173 : tout ce que le fil affiche peut déborder ; styles.css est déjà global.
    sources: [
      ...TOOLS,
      `${C}thread/SubagentsCard.tsx`,
      `${C}thread/MermaidBlock.tsx`,
      `${C}thread/TerminalView.tsx`,
      `${C}thread/DiffView.tsx`,
      `${C}thread/ImageZoom.tsx`
    ]
  },
  {
    name: 'sommaire',
    file: 'sommaire.mjs',
    run: 'outlineSuite',
    themes: BOTH,
    sources: [`${C}thread/ConversationOutline.tsx`]
  },
  {
    name: 'profil',
    file: 'profil.mjs',
    run: 'profileSuite',
    themes: BOTH,
    sources: [
      'e2e/fixtures/profils/',
      `${C}common/Profile.tsx`,
      `${C}settings/ProfileData.tsx`,
      `${C}settings/DataSettings.tsx`,
      `${C}settings/SettingsDialog.tsx`,
      `${C}sidebar/ConversationMenu.tsx`,
      `${C}scheduled/ScheduledPage.tsx`,
      `${R}profile.css`,
      'src/main/storage.ts',
      'src/main/settings.ts',
      'src/main/approvals.ts',
      'src/main/profile-*.ts',
      'src/main/unsaved-at-quit.ts',
      'src/main/conversations/store.ts',
      'src/main/conversations/trash.ts',
      'src/main/conversations/backup.ts',
      'src/main/conversations/history-writer.ts',
      'src/main/scheduler/scheduler-ipc.ts',
      'src/shared/profile.ts'
    ]
  },
  {
    name: 'export',
    file: 'export.mjs',
    run: 'exportSuite',
    themes: [null],
    sources: [
      `${C}settings/GeneralSettings.tsx`,
      'src/main/conversations/backup.ts',
      'src/main/dialogs.ts',
      'src/shared/export.ts'
    ]
  },
  {
    name: 'long-thread',
    file: 'long-thread.mjs',
    run: 'longThreadSuite',
    themes: BOTH,
    sources: [...TOOLS, `${R}useThreadScroll.ts`]
  },
  {
    name: 'perf',
    file: 'perf.mjs',
    run: 'perfSuite',
    themes: BOTH,
    sources: [
      ...TOOLS,
      `${R}useThreadScroll.ts`,
      `${C}thread/DiffView.tsx`,
      `${C}thread/DiffCap.tsx`,
      `${C}thread/CappedText.tsx`,
      `${C}thread/TerminalView.tsx`,
      `${C}thread/useEntryWindow.ts`,
      `${C}thread/useReveal.ts`,
      `${C}thread/ConversationOutline.tsx`,
      `${C}common/LazyDetails.tsx`,
      'src/shared/display-cap.ts',
      'src/shared/terminal-output.ts',
      'src/main/editors/output-file.ts',
      'src/shared/diff.ts',
      'src/shared/changes.ts',
      'src/main/conversations/',
      'src/mock-agent/scenarios-limites.mts',
      'e2e/perf-fixtures.mjs'
    ]
  },
  {
    name: 'links',
    file: 'links.mjs',
    run: 'linksSuite',
    themes: BOTH,
    sources: [
      `${C}thread/FileLink.tsx`,
      `${C}panel/DocumentTab.tsx`,
      ...PANEL,
      `${R}useFileLinks.ts`,
      'src/main/files/',
      'src/shared/file-links.ts'
    ]
  },
  {
    // Fil (fiche 156) : durée du tour, copie d'un message, images, éditeur, « Où en était-on ? ».
    name: 'fil',
    file: 'fil.mjs',
    run: 'filSuite',
    themes: BOTH,
    // Copie dans le presse-papiers de la machine, relu ensuite (comme `touches`).
    locks: ['presse-papiers'],
    sources: [
      `${C}common/CopyButton.tsx`,
      `${C}thread/ImageZoom.tsx`,
      `${C}thread/OpenInEditor.tsx`,
      `${C}thread/ResumeCard.tsx`,
      `${C}thread/ConversationScope.tsx`,
      `${C}thread/FileLink.tsx`,
      `${C}thread/DiffView.tsx`,
      `${C}thread/ToolCall.tsx`,
      `${C}settings/EditorRow.tsx`,
      `${C}settings/GeneralSettings.tsx`,
      `${R}useEditor.ts`,
      `${R}thread-extras.css`,
      `${R}time.ts`,
      'src/main/editors/',
      'src/main/images/',
      'src/main/thread-ipc.ts',
      'src/main/thread-ipc-electron.ts',
      'src/shared/editors.ts',
      'src/shared/images.ts',
      'src/shared/resume-card.ts',
      'src/shared/turn-duration.ts',
      ...GIT
    ]
  },
  {
    name: 'resume',
    file: 'resume.mjs',
    run: 'resumeSuite',
    themes: BOTH,
    sources: [`${C}dialogs/ResumeDialog.tsx`, 'src/main/agent/session-list.ts', ...REPLAY]
  },
  {
    name: 'rules',
    file: 'rules.mjs',
    run: 'rulesSuite',
    themes: BOTH,
    sources: [
      `${C}panel/DocumentTab.tsx`,
      `${C}common/Menus.tsx`,
      `${C}thread/ConversationScope.tsx`,
      'src/main/agent-config/rules.ts',
      'src/main/agent-config/*-rules.ts',
      'src/shared/rules.ts'
    ]
  },
  {
    name: 'mentions',
    file: 'mentions.mjs',
    run: 'mentionsSuite',
    themes: BOTH,
    sources: [
      `${C}composer/FileMenu.tsx`,
      `${C}composer/ComposerAttachments.tsx`,
      `${R}useMentions.ts`,
      'src/shared/context-mentions.ts',
      'src/main/terminal/terminal-context.ts',
      'src/main/changes/git-context.ts',
      'src/main/agent/prompt-content.ts',
      'src/main/workspace-files.ts',
      'src/main/agent-config/exclusions.ts',
      'src/main/agent-config/bob-exclusions.ts'
    ]
  },
  {
    name: 'diagnostic',
    file: 'diagnostic.mjs',
    run: 'diagnosticSuite',
    themes: BOTH,
    // Rapport copié dans le presse-papiers de la machine, relu ensuite (comme `touches`).
    locks: ['presse-papiers'],
    sources: [
      ...SETTINGS,
      `${C}settings/DiagnosticsSettings.tsx`,
      `${C}settings/LogSettings.tsx`,
      `${R}diagnostics-view.ts`,
      'src/main/diagnostics.ts',
      'src/main/log.ts',
      'src/main/diagnostics-ipc.ts',
      'src/main/log-redact.ts',
      'src/main/shell-env.ts',
      'src/main/agent/acp-log.ts',
      'src/main/agent/agent-check.ts',
      'src/shared/diagnostics.ts',
      'src/shared/log-level.ts',
      'src/shared/issue-url.ts'
    ]
  },
  {
    name: 'quick',
    file: 'quick.mjs',
    run: 'quickSuite',
    themes: BOTH,
    // Vérifie que le raccourci global ⌥⌘B est à elle : toute autre app d'essai le prendrait.
    alone: true,
    sources: [
      `${C}composer/QuickEntry.tsx`,
      `${C}composer/AttachButton.tsx`,
      `${C}composer/CaptureProblem.tsx`,
      `${C}composer/useScreenCapture.tsx`,
      `${C}settings/GeneralSettings.tsx`,
      'src/main/quick-entry.ts',
      'src/main/screen-capture.ts',
      'src/main/menu.ts',
      'src/shared/quick-entry.ts',
      'e2e/fixtures/capture.png'
    ]
  },
  {
    name: 'mermaid',
    file: 'mermaid.mjs',
    run: 'mermaidSuite',
    themes: BOTH,
    sources: [`${C}thread/MermaidBlock.tsx`, `${R}mermaid-render.ts`, `${R}theme.ts`]
  },
  {
    name: 'annotate',
    file: 'annotate.mjs',
    run: 'annotateSuite',
    themes: BOTH,
    sources: [
      `${C}composer/ImageAnnotator.tsx`,
      `${C}composer/AttachButton.tsx`,
      `${C}composer/ComposerAttachments.tsx`,
      `${C}composer/QuickEntry.tsx`,
      `${R}annotation.ts`,
      'src/main/screen-capture.ts',
      'e2e/fixtures/capture.png'
    ]
  },
  {
    // Capacités de la plateforme (fiche 145) : Mac puis Linux imposé, dans la même suite.
    name: 'platform',
    file: 'platform.mjs',
    run: 'platformSuite',
    themes: [null],
    sources: [
      ...PANEL,
      `${C}composer/AttachButton.tsx`,
      `${C}settings/DiagnosticsSettings.tsx`,
      'src/main/diagnostics.ts'
    ]
  },
  {
    // Dossier et lancement (fiche 158) : menu du dossier, `bobine <dossier>`, commande installée.
    name: 'command',
    file: 'command.mjs',
    run: 'commandSuite',
    themes: BOTH,
    // « Copier le chemin » écrit dans le presse-papiers de la machine, relu ensuite.
    locks: ['presse-papiers'],
    sources: [
      `${C}common/Menus.tsx`,
      `${C}composer/ComposerContext.tsx`,
      `${C}settings/CommandLineRow.tsx`,
      `${C}settings/GeneralSettings.tsx`,
      `${R}usePanel.ts`,
      `${R}useComposerInbox.ts`,
      'src/main/launch-request.ts',
      'src/main/launch-app.ts',
      'src/main/command-line.ts',
      'src/shared/command-line.ts'
    ]
  },
  {
    // Aide intégrée (fiche 186) : fenêtre d'aide, recherche, liens « ? ».
    name: 'aide',
    file: 'aide.mjs',
    run: 'helpSuite',
    themes: BOTH,
    sources: [
      `${C}help/`,
      `${R}help/`,
      `${R}help.css`,
      `${R}help-link.css`,
      `${C}settings/rows.tsx`,
      `${C}settings/PrivacySettings.tsx`,
      `${C}settings/RememberedApprovals.tsx`,
      'src/shared/help-topics.ts',
      'src/shared/shortcuts.ts',
      'src/main/help-window.ts',
      'src/main/secondary-windows.ts',
      'src/main/app-ipc.ts',
      'src/main/renderer-windows.ts',
      'src/main/menu.ts',
      'docs/guide/'
    ]
  },
  {
    // Astuces de Bobine (fiche 191) : aparté, contexte, réglage, relance.
    name: 'astuces',
    file: 'astuces.mjs',
    run: 'tipsSuite',
    themes: BOTH,
    sources: [
      `${C}tips/`,
      `${R}useTips.ts`,
      `${R}tips.css`,
      `${C}settings/TipsRow.tsx`,
      `${C}settings/GeneralSettings.tsx`,
      `${C}composer/Composer.tsx`,
      'src/shared/tips.ts',
      'src/main/settings-store.ts',
      'src/main/settings.ts',
      'src/main/ipc.ts'
    ]
  },
  {
    name: 'about',
    file: 'about.mjs',
    run: 'aboutSuite',
    themes: BOTH,
    sources: [
      `${C}about/AboutWindow.tsx`,
      'src/main/about-window.ts',
      'src/main/secondary-windows.ts',
      'src/main/app-ipc.ts',
      'src/main/build-info.ts',
      'src/main/technical-info.ts',
      'src/main/renderer-windows.ts',
      'src/main/menu.ts'
    ]
  },
  {
    // Pendant le tour (fiche 157) : commande sans sortie, « Compacter », plafond de coût.
    name: 'turn-guards',
    file: 'pendant-tour.mjs',
    run: 'turnGuardsSuite',
    themes: BOTH,
    sources: [
      `${C}thread/StalledNotice.tsx`,
      `${C}thread/CostCapCard.tsx`,
      `${C}thread/ToolCall.tsx`,
      `${C}composer/UsageMeter.tsx`,
      `${C}composer/UsageGuards.tsx`,
      `${C}settings/ConversationSettings.tsx`,
      `${R}turn-controls.ts`,
      `${R}turn-guards.css`,
      `${R}useTurnGuards.ts`,
      'src/shared/cost-cap.ts',
      'src/shared/usage.ts',
      'src/shared/terminal-output.ts',
      'src/main/conversations/cost-cap.ts',
      'src/main/settings-store.ts'
    ]
  },
  {
    // Limite d'étapes de l'agent (fiche 209) : Continuer, rouvrir la session, session neuve.
    name: 'limite-etapes',
    file: 'limite-etapes.mjs',
    run: 'limiteEtapesSuite',
    themes: BOTH,
    sources: [
      `${C}thread/TurnLimitCard.tsx`,
      `${C}thread/TurnSummary.tsx`,
      `${R}turn-controls.ts`,
      `${R}turn-guards.css`,
      `${R}useTurnGuards.ts`,
      'src/shared/turn-limit.ts',
      'src/shared/handover.ts',
      'src/main/agent/turn-limit.ts',
      'src/main/agent/turn-auth.ts',
      'src/main/agent/replay-buffer.ts',
      'src/main/conversations/turn-limit.ts',
      'src/main/conversations/cost-cap.ts'
    ]
  },
  {
    // Pilote de Bobine (fiche 206) : la commande, sur un profil temporaire ; ce qu'elle lit.
    name: 'pilote',
    file: 'pilote.mjs',
    run: 'piloteSuite',
    themes: [null],
    sources: [
      'scripts/pilote/',
      `${C}onboarding/`,
      `${C}thread/ToolCall.tsx`,
      `${C}thread/WorkingIndicator.tsx`,
      `${C}composer/ComposerBar.tsx`,
      `${C}panel/SidePanel.tsx`,
      `${C}panel/SessionTab.tsx`,
      `${C}sidebar/HistoryItem.tsx`,
      'src/main/fresh-start.ts',
      'src/main/onboarding/'
    ]
  }
]
