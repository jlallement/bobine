import { onSettingsRequest } from './open-settings'
import * as Tooltip from '@radix-ui/react-tooltip'
import { FileDiff, ListChecks, PanelLeft, PanelRight, SquarePen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { childRows, childrenOf } from '@shared/children-rows'
import { changesSummary, conversationChanges } from '@shared/changes'
import { applyAppearance } from './appearance'
import type { AppCommandName } from '@shared/app-commands'
import { appCommandActions, applyAppCommand, stepConversation } from './app-commands'
import { BesidePane } from './components/thread/BesidePane'
import { AppDialogs, useAppDialogs } from './components/dialogs/AppDialogs'
import { InstallDialog } from './components/dialogs/InstallDialog'
import { BranchOrigin, ConversationTitle } from './components/sidebar/ConversationTitle'
import { RoleTitleBadge } from './components/roles/RoleWork'
import { useComposerRoles } from './useComposerRoles'
import { ConversationScope } from './components/thread/ConversationScope'
import { ResumeCard } from './components/thread/ResumeCard'
import { Composer } from './components/composer/Composer'
import { FindBar } from './components/thread/FindBar'
import { useThreadFind } from './useThreadFind'
import { useThreadScroll } from './useThreadScroll'
import { usePanel } from './usePanel'
import { useSessionRunning } from './useSessionRunning'
import { excludedIn } from './useAttachments'
import { useFileLinks } from './useFileLinks'
import { useBeside } from './useBeside'
import { focusComposer, useAside } from './useAside'
import { TipsContext, useAppTips } from './useTips'
import { AsideCard } from './components/thread/AsideCard'
import { useMenuCommands } from './useMenuCommands'
import { Tip } from './components/common/Menus'
import { PinnedPlan } from './components/thread/PinnedPlan'
import { planActionsFor, planBadges } from './plan-badges'
import { Sidebar } from './components/sidebar/Sidebar'
import { SidePanel } from './components/panel/SidePanel'
import { ScrollDownButton } from './components/thread/ScrollDownButton'
import { Transcript } from './components/thread/Transcript'
import { useConversations } from './useConversations'
import { useActivityPage } from './useActivityPage'
import { ActivityPage } from './components/activity/ActivityPage'
import { ScheduledPage } from './components/scheduled/ScheduledPage'
import { useActiveQuota } from './useAgentQuotas'
import { useGitStatus } from './useGitStatus'
import { useProjectCommands } from './useProjectCommands'
import { ComposerInbox, useFileDrop } from './useFileDrop'
import { freshStartInfo } from './fresh-start'
import { TemporaryProfileChip } from './components/settings/FreshStart'
import { PresentationPill } from './components/common/PresentationPill'
import { DropOverlay } from './components/composer/DropOverlay'
import { TurnFooter } from './components/thread/TurnFooter'
import { ConversationOutline } from './components/thread/ConversationOutline'
import { childrenMergeActions } from './components/thread/SubtasksMerge'
import { countText } from '@shared/i18n/format'
import { Welcome } from './components/Welcome'
import { useOnboarding } from './components/onboarding/useOnboarding'
import { useTranslation } from 'react-i18next'
import { ipcErrorText } from './ipc-errors'
import { platformFeatures } from './platform-features'
import { useTurnGuards } from './useTurnGuards'
import { TurnControlsContext } from './turn-controls'
import { GlobalRulesContext, type GlobalRules } from './components/thread/global-rules'
import { ProfileNotices, ReadOnlyGate } from './components/common/Profile'

/** Actions de la carte « Préparation du worktree » (fiche 175) pour la conversation affichée. */
function worktreeSetupActions(id: string, warn: (message: string) => void) {
  const fail = (error: unknown) => warn(String(error))
  return {
    onApprove: (signature: string) =>
      void window.api.conversations.approveWorktreeSetup(id, signature).catch(fail),
    onSkip: () => void window.api.conversations.skipWorktreeSetup(id).catch(fail),
    onStop: () => void window.api.conversations.stopWorktreeSetup(id).catch(fail)
  }
}

// eslint-disable-next-line max-lines-per-function, complexity -- décision 4 de la fiche 089 : hooks dédiés, dialogues à part ; le reste est le JSX de la fenêtre, à découper si App grossit
export function App() {
  const { t } = useTranslation()
  // « Mon activité » (fiche 144) : refermée dès qu'une conversation s'ouvre, d'où `c` enveloppé.
  const activity = useActivityPage(useConversations())
  const c = activity.conversations
  const onboarding = useOnboarding({ conversationId: c.activeId, pageOpen: activity.open })
  const snapshot = c.active?.snapshot ?? null
  // Quota de l'agent actif, s'il sait le lire (Bob : bobcoins, fiche 091).
  const quota = useActiveQuota(snapshot?.info.profileId)
  const transcript = c.active?.transcript ?? { items: [], nextId: 1 }
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const empty = transcript.items.length === 0
  // Titre de la barre : seulement pour une conversation de l'historique (pas un brouillon).
  const activeTitle =
    c.activeSummary && !c.activeSummary.draft && !activity.open ? c.activeSummary : null

  // Modifications de l'agent dans la conversation : raccourci dans l'en-tête (fiche 021).
  const changes = useMemo(
    () => changesSummary(conversationChanges(transcript.items)),
    [transcript.items]
  )
  // Panneau latéral (fiche 029) : ouvert à la main, ou quand l'agent se sert d'un outil de l'app.
  const panel = usePanel({
    conversationId: c.activeId,
    request: c.panelRequest,
    items: transcript.items,
    hasChanges: changes.files > 0,
    // Ouvert d'office sur « Session » à l'ouverture d'une conversation (fiche 166).
    autoOpen: { eligible: !empty && !activity.open, sidebarOpen }
  })
  // Branche git du dossier, à côté du dossier dans la zone de saisie (fiche 049).
  const git = useGitStatus(c.activeId, snapshot?.status === 'busy')
  // « En cours » de l'onglet « Session » (fiche 166), suivi même panneau fermé.
  const running = useSessionRunning({
    conversationId: c.activeId,
    items: transcript.items,
    conversations: c.list,
    attention: c.attention
  })
  // Réglages, recherche, reprise, suppression, branche : leurs dialogues.
  const dialogs = useAppDialogs()
  // Règles pour tous les projets sur les cartes de commande (fiche 215) : agent qui les déclare.
  const activeProfile = c.settings?.profiles.find((p) => p.id === c.activeSummary?.profileId)
  const globalRules: GlobalRules | null = activeProfile?.approvalRules
    ? {
        profileId: activeProfile.id,
        onManage: () => dialogs.openAgentPage(activeProfile.id, 'approvals')
      }
    : null
  // « Faire relire… » (fiche 177) : le dialogue, sur la conversation relue.
  const reviewOf = (author: (typeof dialogs)['reviewing'] | undefined) =>
    author && dialogs.setReviewing(author)

  // Liens de fichiers dans le fil (fiche 052) et règles (fiche 056) ; fonctions stables pour les
  // éléments mémoïsés du fil.
  const links = useFileLinks({
    conversationId: c.activeId,
    previewConversation: panel.preview?.conversationId,
    panel,
    notices: c
  })
  // Commandes « / » personnelles et du projet (fiche 045).
  const projectCommands = useProjectCommands(c.activeId, snapshot?.status === 'busy')
  const globalCommands = c.settings?.commands
  const userCommands = useMemo(
    () => [...projectCommands, ...(globalCommands ?? [])],
    [projectCommands, globalCommands]
  )

  // Apparence : polices, tailles, thème et accent (Réglages › Apparence, fiche 136).
  const prefs = c.settings?.preferences
  useEffect(() => {
    if (prefs) applyAppearance({ preferences: prefs })
  }, [prefs])

  // Suivi du bas du fil, et l'élément qui défile (où cherche ⌘F).
  const { scroller, atBottom, onScroll, scrollToBottom, followSent, reveal } = useThreadScroll({
    conversation: c.activeId,
    items: transcript.items,
    empty
  })
  const aside = useAside(c.activeId, c.warn)
  // Astuces de Bobine (fiche 191) : aparté, « Faire relire », message répété.
  const { tips, startAside } = useAppTips(c, changes, {
    startAside: aside.start,
    openReview: () => reviewOf(c.activeSummary),
    showScheduled: activity.showScheduled,
    closePage: activity.close
  })
  // Tout envoi de l'utilisateur ramène le fil en bas : la bulle envoyée se voit (fiche 127, D26).
  const send: typeof c.send = (...args) => {
    followSent()
    return c.send(...args)
  }
  const sendNow: typeof c.sendNow = (messageId) => {
    followSent()
    return c.sendNow(messageId)
  }

  // Plan annoté (fiche 040) : remarques renvoyées à l'agent, ou retour en mode d'exécution.
  const planActions = planActionsFor(c.activeId, snapshot, transcript.items, send)

  // Modifier / réessayer un message (fiche 023) : branche, avec confirmation si des fichiers ont
  // changé depuis ce point.
  const editMessage = async (itemId: number, text: string) => {
    try {
      const preview = await c.branchPreview(itemId)
      const ask = preview.commands > 0 || preview.files.some((f) => f.status !== 'unchanged')
      if (ask) dialogs.setBranching({ itemId, text, preview })
      else await c.branch(itemId, text)
    } catch (error) {
      c.warn(ipcErrorText(error))
    }
  }
  const messageActions = c.activeId
    ? {
        busy: snapshot?.status === 'busy' || snapshot?.status === 'starting',
        // Message refusé, carte en attente (fiche 210) : pas de « Réessayer » en branche.
        refused:
          snapshot?.status === 'needs-action' &&
          snapshot.blocker?.kind === 'auth' &&
          snapshot.blocker.atTurn === true,
        onEdit: (itemId: number, text: string) => void editMessage(itemId, text),
        onOpenConversation: (id: string) => c.select(id)
      }
    : undefined

  // Vue côte à côte (fiche 036) : une seconde conversation à côté de l'active.
  const beside = useBeside({ conversations: c, openFileLink: links.openFileLink })

  // Recherche dans la conversation ouverte (⌘F, fiche 086) ; `focus` change à chaque ⌘F.
  const [find, setFind] = useState({ open: false, query: '', focus: 0 })
  const openFind = (query?: string) => {
    panel.setMaximized(false)
    setFind((f) => ({ open: true, query: query ?? f.query, focus: f.focus + 1 }))
  }
  // ⌘K → ⌘F : ouverte une fois la conversation affichée (son fil chargé), après la zone de saisie
  // qui prend le clavier en arrivant ; la barre le garde (ajustement pendant le rendu).
  const [pendingFind, setPendingFind] = useState<{ id: string; query: string } | null>(null)
  if (pendingFind && pendingFind.id === c.activeId && !empty) {
    setPendingFind(null)
    openFind(pendingFind.query)
  }
  const threadFind = useThreadFind({
    container: scroller,
    query: find.query,
    active: find.open,
    content: transcript.items,
    conversation: c.activeId
  })

  /** Commandes du menu macOS et de leurs raccourcis (fiche 027). */
  const goTo = (delta: number) => {
    const id = stepConversation(c.list, c.activeId, delta)
    if (id) c.select(id)
  }
  useMenuCommands({
    'new-conversation': () => c.create(),
    search: dialogs.openSearch,
    find: () => openFind(),
    'find-next': () => (find.open ? threadFind.next() : openFind()),
    'find-previous': () => (find.open ? threadFind.previous() : openFind()),
    'resume-session': () => dialogs.setResuming(true),
    settings: () => dialogs.setSettingsSection('general'),
    shortcuts: () => dialogs.setSettingsSection('shortcuts'),
    diagnostics: () => dialogs.setSettingsSection('diagnostics'),
    'focus-composer': focusComposer,
    aside: () => startAside(),
    stop: () => c.cancel(),
    'toggle-sidebar': () => setSidebarOpen((open) => !open),
    // Page des tâches planifiées : pas de panneau, rien à basculer (fiche 185, F3).
    'toggle-panel': () => activity.page !== 'scheduled' && panel.update({ open: !panel.open }),
    'maximize-panel': () => {
      if (activity.page === 'scheduled') return
      if (!panel.open) panel.update({ open: true })
      panel.setMaximized(!panel.maximized)
    },
    'toggle-terminal': () => panel.toggleTerminal(),
    'show-changes': () =>
      panel.changesOpen ? panel.update({ open: false }) : panel.openChanges('conversation'),
    'previous-conversation': () => goTo(-1),
    'next-conversation': () => goTo(1),
    activity: activity.show,
    // Traitée par le main (fenêtre d'aide, fiche 186) ; jamais envoyée ici.
    help: () => void window.api.help.open(null)
  })

  // Plan, liste épinglée, comptes des onglets, ce que fait l'agent (fiches 077, 082).
  const { plan, planDone, pinnedPlan, panelCounts, agentStatus } = planBadges(
    transcript.items,
    snapshot?.status === 'busy',
    changes.files,
    !!c.activeId && c.attention[c.activeId] === 'request'
  )

  /** Commandes « / » de l'app (fiche 039) : traitées ici, rien d'autre n'est envoyé à l'agent. */
  const runAppCommand = (name: AppCommandName, args: string) =>
    applyAppCommand(
      appCommandActions(name, args, {
        summary: c.activeSummary,
        snapshot,
        usage: transcript.usage
      }),
      { ...c, aside: startAside }
    )
  // Commande sans sortie, compaction en un clic, plafond de coût (fiche 157).
  const guards = useTurnGuards({
    conversationId: c.activeId,
    snapshot,
    costCap: transcript.costCap,
    preferences: c.settings?.preferences,
    cancel: c.cancel,
    compact: () => runAppCommand('compact', ''),
    warn: c.warn,
    openSettings: dialogs.setSettingsSection
  })

  // Fichiers déposés n'importe où sur la conversation : joints au message en cours.
  const [composerInbox] = useState(() => new ComposerInbox())
  // Message de la fenêtre rapide que l'agent n'a pas pu recevoir : dans la zone de saisie.
  useEffect(
    () => window.api.app.onPrefill((message) => composerInbox.prefill(message)),
    [composerInbox]
  )
  // `bobine <dossier> "message"` au premier lancement (fiche 158) : le message est posé dans la
  // saisie de la conversation ouverte, sans être envoyé ; les suivants arrivent par `onPrefill`.
  useEffect(() => {
    void window.api.app.takeLaunch().then((launch) => {
      if (launch) composerInbox.prefill({ id: launch.id, text: launch.text, attachments: [] })
    })
  }, [composerInbox])
  // « Nouveautés » de la fenêtre À propos (fiche 116) : Réglages › À propos. Un seul abonnement.
  const openSettings = useRef(dialogs.setSettingsSection)
  useEffect(() => {
    openSettings.current = dialogs.setSettingsSection
  })
  useEffect(() => window.api.app.onShowChangelog(() => openSettings.current('about')), [])
  // Lien « Diagnostic » d'un avis de version d'agent (fiche 198).
  useEffect(() => onSettingsRequest((section) => openSettings.current(section)), [])
  // `--reinitialiser` (fiche 148) : Réglages › Données, où la confirmation s'ouvre.
  useEffect(() => {
    void freshStartInfo().then((info) => info.askReset && openSettings.current('data'))
  }, [])
  const drop = useFileDrop(composerInbox)
  const revealWorkspace = () => {
    const id = c.activeId
    if (id) {
      window.api.fileLinks
        .open(id, '.', { reveal: true })
        .catch((error: unknown) => c.warn(ipcErrorText(error)))
    }
  }
  const loadMcp = async () => {
    const profileId = c.activeSummary?.profileId
    return (await window.api.mcp.list()).find((v) => v.profileId === profileId)
  }
  // Aparté (fiche 180) : au-dessus de la saisie, dans le fil comme sur l'accueil d'une conversation
  // vide (sinon l'aparté répondait, et se payait, sans carte où le lire).
  const asideCard = aside.visible && (
    <AsideCard aside={aside} items={transcript.items} inbox={composerInbox} />
  )
  // Rôles (fiche 223) : menu `@`, une fille par rôle cité ; « + Nouveau rôle » et « Gérer » viendront
  // avec l'assistant et Réglages › Rôles (phase 3A).
  const composerRoles = useComposerRoles(c.activeSummary, c.settings?.profiles ?? [], c.warn)
  const editor = (
    <Composer
      roles={composerRoles}
      composerInbox={composerInbox}
      // Capture d'une zone de l'écran, si la plateforme la permet (fiche 145).
      {...(platformFeatures().screenCapture
        ? { onCaptureScreen: () => window.api.capture.screen() }
        : {})}
      onOpenCaptureSettings={() => window.api.capture.openSettings()}
      key={c.activeId ?? ''}
      fresh={empty}
      {...(c.activeId ? { draftKey: c.activeId } : {})}
      {...(c.activeSummary?.branch ? { branch: c.activeSummary.branch } : {})}
      {...(git?.branch
        ? {
            gitBranch: {
              name: git.branch,
              dirty: git.dirty,
              ahead: git.ahead,
              behind: git.behind,
              onOpen: () => panel.openChanges('git')
            }
          }
        : {})}
      onNewWorktree={c.createWorktree}
      snapshot={snapshot}
      settings={c.settings}
      usage={transcript.usage}
      usageActions={guards.usageActions}
      autoFocus
      onSend={send}
      onSearchFiles={c.searchFiles}
      onPickFiles={c.pickFiles}
      onCheckExcluded={excludedIn(c.activeId)}
      onWarn={c.warn}
      onCancel={c.cancel}
      onUnqueue={c.unqueue}
      onSendNow={sendNow}
      onAppCommand={runAppCommand}
      userCommands={userCommands}
      onRestart={c.restart}
      onConfigure={c.configure}
      onChooseWorkspace={c.chooseWorkspace}
      onRevealWorkspace={revealWorkspace}
      onOpenTerminalHere={panel.showTerminal}
      onSetControl={c.setControl}
      onLoadRules={() =>
        c.activeId ? window.api.conversations.rules(c.activeId) : Promise.resolve([])
      }
      onOpenRule={links.openRule}
      onLoadMcp={loadMcp}
      onLoadAppTools={() =>
        c.activeId
          ? window.api.conversations.appTools(c.activeId)
          : Promise.resolve({ names: [], tokens: 0 })
      }
      // Outils de Bobine : leur onglet ; serveurs de l'agent : l'onglet de l'agent de la conversation.
      onOpenMcpSettings={(tab) => dialogs.openMcpSettings(tab ?? c.activeSummary?.profileId)}
      onOpenUsage={activity.show}
      onAuthenticate={c.authenticate}
      onRetry={c.retrySession}
      onUseApiKey={c.useApiKey}
      onRunStep={(stepId) => {
        c.runStep(stepId)
        panel.update({ open: true, tab: 'terminal' })
      }}
      onTrustForSession={c.trustForSession}
      onOpenTerminal={c.openTerminal}
      onContinueInNew={() =>
        c.create(
          c.activeSummary
            ? { profileId: c.activeSummary.profileId, workspace: c.activeSummary.workspace }
            : {}
        )
      }
    />
  ) // Profil en lecture seule (fiche 196) : la saisie est inerte, la raison dessous.
  const composer = <ReadOnlyGate>{editor}</ReadOnlyGate>

  return (
    <TipsContext.Provider value={tips}>
      <Tooltip.Provider>
        <div className="app">
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(false)}
            conversations={c.list}
            // Page ouverte : aucune conversation en surbrillance, la ligne « Mon activité » l'est.
            activeId={activity.open ? null : c.activeId}
            activityOpen={activity.page === 'activity'}
            onActivity={activity.show}
            scheduledOpen={activity.page === 'scheduled'}
            onScheduled={activity.showScheduled}
            attention={c.attention}
            attentionDetails={c.attentionDetails}
            childLaunches={c.childLaunches.entries}
            childLaunchRows={c.childLaunchRows}
            notifications={c.settings?.notifications ?? true}
            notificationsBlocked={c.notificationStatus.blocked}
            onNotificationsChange={c.setNotifications}
            onOpenSettings={() => dialogs.setSettingsSection('general')}
            onOpenNotificationSettings={c.openNotificationSettings}
            snapshot={snapshot}
            {...quota}
            onNew={() => c.create()}
            onSelect={c.select}
            onRename={c.rename}
            onRequestDelete={dialogs.setDeleting}
            onPin={c.pin}
            onArchive={c.archive}
            onExport={c.exportConversation}
            onOpenBeside={beside.open}
            onLaunchChild={dialogs.setLaunching}
            onSearch={dialogs.openSearch}
            onResumeSession={() => dialogs.setResuming(true)}
          />

          {/* Agrandi (fiche 082), le panneau recouvre la conversation : elle reste montée (fil, saisie,
            position), hors d'atteinte du clavier. */}
          <div
            className={`workarea${panel.maximized ? ' panel-maximized' : ''}${activity.open ? ' activity-open' : ''}`}
          >
            <ConversationScope
              conversationId={c.activeId}
              notices={c}
              openLink={links.openActiveLink}
              loadSubagentWork={links.loadActiveSubagentWork}
            >
              <main
                className={`main file-drop${drop.dragging ? ' dragging' : ''}`}
                {...drop.handlers}
                inert={panel.maximized}
                data-testid="conversation-drop"
              >
                {drop.dragging && <DropOverlay />}
                <header className={`main-header drag${sidebarOpen ? '' : ' with-lights'}`}>
                  {!sidebarOpen ? (
                    <>
                      <Tip label={t('app.showSidebar')} command="toggle-sidebar">
                        <button
                          className="icon-button no-drag"
                          onClick={() => setSidebarOpen(true)}
                        >
                          <PanelLeft size={18} />
                        </button>
                      </Tip>
                      <Tip label={t('app.newConversation')} command="new-conversation">
                        <button className="icon-button no-drag" onClick={() => c.create()}>
                          <SquarePen size={17} />
                        </button>
                      </Tip>
                    </>
                  ) : null}
                  {/* Titre à gauche, avec le menu de la conversation (fiche 049). */}
                  {activeTitle ? (
                    <ConversationTitle
                      key={activeTitle.id}
                      conversation={activeTitle}
                      onRename={(text) => c.rename(activeTitle.id, text)}
                      onPin={() => c.pin(activeTitle.id, !activeTitle.pinned)}
                      onExport={(format) => c.exportConversation(activeTitle.id, format)}
                      onArchive={() => c.archive(activeTitle.id, !activeTitle.archived)}
                      onDelete={() => dialogs.setDeleting(activeTitle)}
                      onLaunchChild={() => dialogs.setLaunching(activeTitle)}
                    />
                  ) : null}
                  {activeTitle?.role ? (
                    <RoleTitleBadge child={activeTitle} profiles={c.settings?.profiles ?? []} />
                  ) : null}
                  {/* Une fille dit d'où elle vient, et y ramène (fiche 117). */}
                  {activeTitle?.startedFrom ? (
                    <button
                      className="main-title-origin no-drag"
                      title={t('conversationTitle.fromTitle')}
                      onClick={() =>
                        activeTitle.startedFrom && c.select(activeTitle.startedFrom.id)
                      }
                      data-testid="title-origin"
                    >
                      {t('conversationTitle.from', { title: activeTitle.startedFrom.title })}
                    </button>
                  ) : null}
                  {/* Une branche aussi (fiche 131) : elle n'est plus rangée sous son origine. */}
                  {activeTitle?.branchedFrom && !activeTitle.startedFrom ? (
                    <BranchOrigin
                      origin={activeTitle.branchedFrom}
                      list={c.list}
                      onSelect={(id) => c.select(id)}
                    />
                  ) : null}
                  {activity.open && (
                    <span className="main-title static" data-testid="activity-title">
                      <span className="main-title-text">
                        {t(activity.page === 'scheduled' ? 'scheduled.title' : 'activity.title')}
                      </span>
                    </span>
                  )}
                  <span className="grow" />
                  <TemporaryProfileChip />
                  <PresentationPill />
                  {changes.files > 0 && !activity.open && (
                    <Tip
                      label={panel.changesOpen ? t('app.hideChanges') : t('app.showChanges')}
                      command="show-changes"
                    >
                      <button
                        className={`icon-button panel-toggle no-drag${panel.changesOpen ? ' active' : ''}`}
                        onClick={() =>
                          panel.changesOpen
                            ? panel.update({ open: false })
                            : panel.openChanges('conversation')
                        }
                        data-testid="changes-toggle"
                      >
                        <FileDiff size={15} />
                        {changes.files}
                        <span className="diff-added">+{countText(changes.added)}</span>
                        <span className="diff-removed">−{countText(changes.removed)}</span>
                      </button>
                    </Tip>
                  )}
                  {/* Page des tâches planifiées : pas de panneau de conversation (fiche 185, F3). */}
                  {activity.page === 'scheduled' ? null : plan &&
                    plan.entries.length > 0 &&
                    !panel.open &&
                    !pinnedPlan &&
                    !activity.open ? (
                    <Tip label={t('app.tasks')}>
                      <button
                        className="icon-button panel-toggle no-drag"
                        onClick={() => panel.update({ open: true, tab: 'tasks' })}
                        data-testid="panel-toggle"
                      >
                        <ListChecks size={16} />
                        {planDone} / {plan.entries.length}
                      </button>
                    </Tip>
                  ) : (
                    <Tip
                      label={panel.open ? t('app.hidePanel') : t('app.showPanel')}
                      command="toggle-panel"
                    >
                      <button
                        className="icon-button no-drag"
                        onClick={() => panel.update({ open: !panel.open })}
                        data-testid="panel-toggle"
                      >
                        <PanelRight size={18} />
                      </button>
                    </Tip>
                  )}
                </header>
                <InstallDialog />
                <ProfileNotices />

                {activity.page === 'scheduled' ? (
                  <ScheduledPage
                    onOpenConversation={c.select}
                    profiles={c.settings?.profiles ?? []}
                    defaultProfileId={
                      c.settings?.newConversation.profileId ?? c.settings?.profileId
                    }
                  />
                ) : activity.open ? (
                  <ActivityPage
                    onOpenConversation={c.select}
                    onNewConversation={() => c.create()}
                  />
                ) : empty ? (
                  <Welcome
                    userName={prefs?.userName ?? ''}
                    asideCard={asideCard}
                    composer={composer}
                    welcomeHint={snapshot?.info.welcomeHint}
                    fill={(text) => composerInbox.fill(text)}
                    onboarding={onboarding}
                    configure={c.configure}
                    workspace={c.activeSummary?.workspace ?? ''}
                    onShowTerminal={panel.showTerminal}
                  />
                ) : (
                  <>
                    <ConversationOutline
                      items={transcript.items}
                      scroller={scroller}
                      onGo={reveal.go}
                    />
                    {find.open && (
                      <FindBar
                        query={find.query}
                        count={threadFind.count}
                        pending={threadFind.pending}
                        current={threadFind.current}
                        focus={find.focus}
                        onQuery={(query) => setFind((f) => ({ ...f, query }))}
                        onNext={threadFind.next}
                        onPrevious={threadFind.previous}
                        onClose={() => setFind((f) => ({ ...f, open: false }))}
                      />
                    )}
                    <div className="scroll" ref={scroller} onScroll={onScroll}>
                      <div className="column">
                        <GlobalRulesContext.Provider value={globalRules}>
                          <TurnControlsContext.Provider value={guards.turnControls}>
                            <Transcript
                              key={c.activeId ?? ''} // rien de déplié ne passe à la suivante
                              items={transcript.items}
                              terminals={transcript.terminals}
                              onRespondPermission={c.respondPermission}
                              onRespondElicitation={c.respondElicitation}
                              {...(planActions ? { planActions } : {})}
                              {...(messageActions ? { messageActions } : {})}
                              {...(pinnedPlan ? { hiddenPlanId: pinnedPlan.id } : {})}
                              {...(c.activeSummary ? { workspace: c.activeSummary.workspace } : {})}
                              {...(snapshot
                                ? {
                                    agent: {
                                      name: snapshot.info.agentName,
                                      alwaysScope: snapshot.info.alwaysScope
                                    }
                                  }
                                : {})}
                              onOpenGitView={() => panel.openChanges('git')}
                              usage={transcript.usage}
                              streaming={snapshot?.status === 'busy'}
                              findQuery={find.open ? find.query : undefined}
                              reveal={reveal.id}
                              {...(c.activeId
                                ? { worktreeSetup: worktreeSetupActions(c.activeId, c.warn) }
                                : {})}
                              subtasks={{
                                children: childrenOf(c.activeId, c.list),
                                attention: c.attention,
                                onOpen: c.select,
                                profiles: c.settings?.profiles ?? [],
                                ...(c.activeId ? { motherId: c.activeId } : {}),
                                merge: childrenMergeActions((id) => {
                                  c.select(id)
                                  panel.openChanges('git')
                                })
                              }}
                              {...(c.activeSummary
                                ? {
                                    proposals: {
                                      mother: c.activeSummary,
                                      profiles: c.settings?.profiles ?? []
                                    }
                                  }
                                : {})}
                            />
                          </TurnControlsContext.Provider>
                        </GlobalRulesContext.Provider>
                        {c.activeId && (
                          <ResumeCard
                            key={c.activeId}
                            conversationId={c.activeId}
                            items={transcript.items}
                          />
                        )}
                        <TurnFooter
                          snapshot={snapshot}
                          conversationId={c.activeId}
                          items={transcript.items}
                          workspace={c.activeSummary?.workspace}
                          onRetry={c.retryTurn}
                          onStop={c.cancel}
                        />
                      </div>
                    </div>
                    <div className="column thread-dock" style={{ width: '100%' }}>
                      <ScrollDownButton
                        atBottom={atBottom}
                        items={transcript.items}
                        conversation={c.activeId}
                        onClick={scrollToBottom}
                      />
                      {pinnedPlan && (
                        <PinnedPlan key={`tasks-${c.activeId}`} entries={pinnedPlan.entries} />
                      )}
                      {asideCard}
                      {composer}
                    </div>
                  </>
                )}
              </main>
            </ConversationScope>
            {beside.summary && beside.view && (
              <ConversationScope
                conversationId={beside.summary.id}
                openLink={beside.openLink}
                loadSubagentWork={beside.loadSubagentWork}
              >
                <BesidePane
                  summary={beside.summary}
                  snapshot={beside.view.snapshot}
                  transcript={beside.view.transcript}
                  actions={c.actionsFor(beside.summary.id)}
                  onWarn={c.warn}
                  onFocus={beside.focus}
                  onClose={beside.close}
                  inert={panel.maximized}
                />
              </ConversationScope>
            )}
            {panel.open && activity.page !== 'scheduled' && (
              <SidePanel
                opening={panel.opening}
                conversationId={c.activeId}
                {...(c.activeSummary
                  ? { workspace: c.activeSummary.workspace, title: c.activeSummary.title }
                  : {})}
                tab={panel.tab}
                tabs={panel.tabs}
                counts={panelCounts}
                onCloseTab={panel.closeTab}
                // Remarques sur les modifications (fiche 085) : un message à la conversation active.
                onSendDiffNotes={(text) => send(text)}
                // Worktrees des filles directes (fiche 161), tenus à jour comme la carte du fil.
                childWorktrees={{
                  rows: childRows(childrenOf(c.activeId, c.list), c.attention, transcript.items),
                  onOpen: c.select,
                  onReview: (id) => reviewOf(c.list.find((s) => s.id === id))
                }}
                // « Faire relire… » (fiche 177) : pas une relecture, pas un brouillon.
                {...(c.activeSummary && !c.activeSummary.reviewOf && !c.activeSummary.draft
                  ? { onReview: () => reviewOf(c.activeSummary) }
                  : {})}
                // Remarques sur la page (fiche 132) : texte et capture annotée, en un message.
                onSendPageNotes={(text, images) => send(text, images)}
                width={panel.width}
                maxWidth={panel.maxWidth}
                maximized={panel.maximized}
                onMaximize={panel.setMaximized}
                {...(agentStatus ? { agentStatus } : {})}
                onShowConversation={() => {
                  panel.setMaximized(false)
                  scrollToBottom()
                }}
                {...(panel.maximized && !sidebarOpen
                  ? { onShowSidebar: () => setSidebarOpen(true) }
                  : {})}
                items={transcript.items}
                focusTerminal={panel.focusTerminal}
                {...(c.settings ? { preferences: c.settings.preferences } : {})}
                {...(panel.changesRequest ? { changesRequest: panel.changesRequest } : {})}
                {...(panel.preview
                  ? {
                      preview: {
                        ...panel.preview,
                        onDocument: panel.updateDocument,
                        onOpenLink: links.openPreviewLink,
                        onClose: () => panel.closeTab('document')
                      }
                    }
                  : {})}
                // Page ou écran d'un simulateur joint au message (fiche 066).
                onAttachImage={(image) => {
                  if (c.activeId)
                    composerInbox.prefill({ id: c.activeId, text: '', attachments: [image] })
                }}
                session={{
                  snapshot,
                  settings: c.settings,
                  transcript,
                  workspace: c.activeSummary?.workspace,
                  worktreeBranch: c.activeSummary?.branch,
                  gitBranch: git?.branch,
                  running,
                  onSetControl: c.setControl,
                  onRevealWorkspace: revealWorkspace,
                  additionalDirectories: c.activeSummary?.additionalDirectories,
                  onRevealFolder: (folder) => {
                    if (c.activeId)
                      window.api.fileLinks
                        .open(c.activeId, folder, { reveal: true })
                        .catch((error: unknown) => c.warn(ipcErrorText(error)))
                  },
                  onWarn: c.warn,
                  onOpenGit: () => panel.openChanges('git'),
                  onOpenConversationChanges: () => panel.openChanges('conversation'),
                  onOpenConversation: c.select,
                  onLoadMcp: loadMcp,
                  onOpenMemory: () => dialogs.setSettingsSection('memory')
                }}
                onTerminalFocused={panel.terminalFocused}
                onTab={(tab) => panel.update({ tab })}
                onClose={() => panel.update({ open: false })}
                onResize={(width) => panel.update({ width })}
              />
            )}
          </div>
        </div>
        <AppDialogs
          dialogs={dialogs}
          conversations={c}
          projectCommands={projectCommands}
          onFindIn={setPendingFind}
          onOpenActivity={activity.show}
        />
      </Tooltip.Provider>
    </TipsContext.Provider>
  )
}
