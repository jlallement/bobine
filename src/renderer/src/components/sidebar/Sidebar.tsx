import i18next from 'i18next'
import { refusedTurnText } from '../../turn-auth-text'
import {
  Bell,
  BellOff,
  CalendarClock,
  ChartColumn,
  PanelLeft,
  Plus,
  Search,
  Settings
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type UIEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import { Tip } from '../common/Menus'
import { usePresentation } from '../../presentation'
import type { AgentSnapshot, ConversationSummary } from '@shared/agent'
import type { AgentQuota } from '@shared/usage'
import { AgentQuotaStatus } from './AgentQuotaStatus'
import type { AttentionDetails, AttentionState } from '@shared/attention'
import type { ChildLaunch } from '@shared/children'
import { launchRowId, useChildVisibility, withChildLaunches } from './child-visibility'
import type { ExportFormat } from '@shared/export'
import { HistoryItem } from './HistoryItem'
import { SHORTCUTS } from '@shared/shortcuts'
import {
  SIDEBAR_DEFAULT_WIDTH,
  clampSidebarWidth,
  fittedSidebarWidth,
  readSidebarWidth,
  writeSidebarWidth
} from './sidebar-width'
import {
  byProject,
  heldOrder,
  nestChildren,
  sidebarFamilies,
  useHeldOrder,
  useHolds,
  usePointerInside,
  type HistoryRow
} from './history-order'
import { GroupingMenu, NotificationsBlocked, type Grouping } from './SidebarMenus'
import { FolderGroup, SidebarSection, readLocal, useFoldedSet, writeLocal } from './SidebarSection'
import { useProfileStatus } from '../common/Profile'

interface Props {
  open: boolean
  onToggle: () => void
  conversations: ConversationSummary[]
  activeId: string | null
  /** Conversations qui attendent l'utilisateur (fiche 024). */
  attention: AttentionState
  /** Ce qu'attend chaque conversation : détails de son infobulle (fiche 149). */
  attentionDetails?: AttentionDetails
  childLaunches?: ChildLaunch[]
  childLaunchRows?: Record<string, string>
  /** Notifications macOS et badge du Dock activés. */
  notifications: boolean
  /** macOS refuse les notifications de l'app (son message). */
  notificationsBlocked?: string
  onNotificationsChange: (enabled: boolean) => void
  onOpenNotificationSettings: () => void
  onOpenSettings: () => void
  /** Agent de la conversation active (pied de la barre). */
  snapshot: AgentSnapshot | null
  /** Quota de cet agent, s'il sait le lire (fiche 091), et sa relecture. */
  quota?: AgentQuota
  onRefreshQuota?: () => Promise<void>
  onNew: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  /** Demande de suppression : la confirmation est montrée par l'app (fiche 049). */
  onRequestDelete: (conversation: ConversationSummary) => void
  /** Ouvrir une conversation à côté de l'active (vue côte à côte). */
  onOpenBeside: (id: string) => void
  /** « Lancer en parallèle… » depuis cette conversation (fiche 097). */
  onLaunchChild?: (conversation: ConversationSummary) => void
  onPin: (id: string, pinned: boolean) => void
  /** Archiver une conversation, ou la ressortir. */
  onArchive: (id: string, archived: boolean) => void
  /** Exporter une conversation en Markdown ou JSON (fiche 043). */
  onExport: (id: string, format: ExportFormat) => void
  /** Recherche (⌘K). */
  onSearch: () => void
  /** Page « Mon activité » (fiche 144) : ouverte (ligne en surbrillance), et pour l'ouvrir. */
  activityOpen?: boolean
  onActivity?: () => void
  /** Page « Tâches planifiées » (fiche 178), comme « Mon activité ». */
  scheduledOpen?: boolean
  onScheduled?: () => void
  /** « Reprendre une session… » (fiche 055). */
  onResumeSession: () => void
}

/** Raccourci de « Mon activité », tel que le menu l'affiche. */
const ACTIVITY_KEYS = SHORTCUTS.find((s) => s.command === 'activity')?.keys ?? ''
const GROUPING_KEY = 'bob:historique-regroupement'
/** Dossiers repliés : leur chemin (le projet, fiche 131 ; le dossier de travail avant). */
const FOLDED_KEY = 'bob:dossiers-replies'
/** Sections repliées (fiche 131) : `pinned`, `history`. Archivées a sa clé, repliée par défaut. */
const SECTIONS_KEY = 'bob:sections-repliees'
const ARCHIVE_OPEN_KEY = 'bob:archives-ouvertes'
const NO_LAUNCHES: ChildLaunch[] = []

export function Sidebar(props: Props) {
  const { t } = useTranslation()
  const presenting = usePresentation()
  // Largeur réglable à la poignée du bord droit (fiche 113), retenue sur ce poste.
  const [width, setWidth] = useState(readSidebarWidth)
  // Fenêtre étroite : la barre cède la place que la conversation réclame, sans oublier son réglage.
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const update = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const shownWidth = fittedSidebarWidth(width, windowWidth)
  const resizing = useRef<number | null>(null)
  const onResizeStart = (event: PointerEvent<HTMLDivElement>) => {
    resizing.current = width
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onResizeMove = (event: PointerEvent<HTMLDivElement>) => {
    if (resizing.current === null) return
    // La barre part du bord gauche de la fenêtre : sa largeur est l'abscisse du pointeur.
    resizing.current = clampSidebarWidth(event.clientX)
    setWidth(resizing.current)
  }
  const onResizeEnd = () => {
    if (resizing.current === null) return
    writeSidebarWidth(resizing.current)
    resizing.current = null
  }
  const resetWidth = () => {
    setWidth(SIDEBAR_DEFAULT_WIDTH)
    writeSidebarWidth(SIDEBAR_DEFAULT_WIDTH)
  }
  const { snapshot } = props
  const status = snapshot?.status ?? 'idle'
  const agentLabel = snapshot?.info.agentName ?? snapshot?.info.profileLabel ?? t('sidebar.agent')
  const statusText = agentStatusText(snapshot)
  const launches = props.childLaunches ?? NO_LAUNCHES
  const listed = withChildLaunches(
    props.conversations.filter((c) => !c.draft),
    launches
  )
  const preparing = new Set(launches.map((launch) => launchRowId(launch.id)))
  // Ordre figé sous le pointeur, ou tant qu'un menu de la liste est ouvert ou qu'un titre est en
  // cours de modification (fiche 095).
  const list = useRef<HTMLDivElement>(null)
  const pointerInside = usePointerInside(list)
  const { held, hold } = useHolds()
  const order = useHeldOrder(
    listed.map((c) => c.id),
    pointerInside || held
  )
  const replacements = {
    ...props.childLaunchRows,
    ...Object.fromEntries(
      launches.flatMap((launch) =>
        launch.conversationId ? [[launchRowId(launch.id), launch.conversationId]] : []
      )
    )
  }
  const all = heldOrder(listed, order?.map((id) => replacements[id] ?? id) ?? null)
  const titles = new Map(listed.map((c) => [c.id, c.title]))
  const { archived, pinned, others } = sidebarFamilies(all)
  const [archiveOpen, setArchiveOpen] = useState(
    () => readLocal<unknown>(ARCHIVE_OPEN_KEY, false) === true
  )
  const [grouping, setGrouping] = useState<Grouping>(() =>
    readLocal<Grouping>(GROUPING_KEY, 'recent') === 'folder' ? 'folder' : 'recent'
  )
  const folders = useFoldedSet(FOLDED_KEY)
  const sections = useFoldedSet(SECTIONS_KEY)
  useChildVisibility(props.conversations, launches, sections.unfold, folders.unfold, list)
  // Filet sous la zone du haut, seulement quand la liste a défilé (fiche 131).
  const [scrolled, setScrolled] = useState(false)
  const onScroll = (event: UIEvent<HTMLDivElement>) =>
    setScrolled(event.currentTarget.scrollTop > 0)

  const chooseGrouping = (next: Grouping) => {
    setGrouping(next)
    writeLocal(GROUPING_KEY, next)
  }
  const item = ({ conversation, nested, first, last }: HistoryRow) => (
    <HistoryItem
      key={conversation.id}
      conversation={conversation}
      {...(nested ? { link: { first: !!first, last: !!last } } : {})}
      preparing={preparing.has(conversation.id)}
      {...(conversation.branchedFrom
        ? {
            branchOf: titles.get(conversation.branchedFrom.id) ?? conversation.branchedFrom.title
          }
        : {})}
      onHold={hold}
      active={conversation.id === props.activeId}
      attention={props.attention[conversation.id]}
      {...(props.attentionDetails?.[conversation.id]
        ? { attentionDetail: props.attentionDetails[conversation.id] }
        : {})}
      onSelect={() => props.onSelect(conversation.id)}
      onRename={(title) => props.onRename(conversation.id, title)}
      onPin={() => props.onPin(conversation.id, !conversation.pinned)}
      onArchive={() => props.onArchive(conversation.id, !conversation.archived)}
      onExport={(format) => props.onExport(conversation.id, format)}
      {...(conversation.id !== props.activeId
        ? { onOpenBeside: () => props.onOpenBeside(conversation.id) }
        : {})}
      onDelete={() => props.onRequestDelete(conversation)}
      {...(props.onLaunchChild ? { onLaunchChild: () => props.onLaunchChild?.(conversation) } : {})}
    />
  )

  return (
    <aside
      className={`sidebar${props.open ? '' : ' collapsed'}`}
      aria-hidden={!props.open}
      style={{ '--sidebar-width': `${shownWidth}px` } as CSSProperties}
    >
      <div
        className="sidebar-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('sidebar.resize')}
        data-testid="sidebar-resize"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        // Double-clic sur la poignée : largeur par défaut (comme le panneau, fiche 082).
        onDoubleClick={resetWidth}
      />
      <div className="sidebar-header drag">
        {/* Rechercher en icône (fiche 144), à gauche du bouton qui masque la barre. */}
        <Tip label={t('sidebar.search')} command="search">
          <button
            className="icon-button no-drag"
            aria-label={t('sidebar.search')}
            onClick={props.onSearch}
            data-testid="open-search"
          >
            <Search size={17} />
          </button>
        </Tip>
        <Tip label={t('sidebar.hide')} command="toggle-sidebar">
          <button className="icon-button no-drag" onClick={props.onToggle}>
            <PanelLeft size={18} />
          </button>
        </Tip>
      </div>

      <nav className="sidebar-body">
        {/* Zone fixe (fiche 131) : ne défile pas avec la liste. */}
        <div className={`sidebar-fixed${scrolled ? ' scrolled' : ''}`} data-testid="sidebar-fixed">
          <NewConversationButton onNew={props.onNew} />

          <button
            className={`sidebar-item${props.activityOpen ? ' active' : ''}`}
            aria-current={props.activityOpen ? 'page' : undefined}
            onClick={props.onActivity}
            data-testid="open-activity"
          >
            <span className="icon-badge plain">
              <ChartColumn size={15} />
            </span>
            <span className="label">{t('sidebar.activity')}</span>
            <kbd className="sidebar-kbd">{ACTIVITY_KEYS}</kbd>
          </button>

          <button
            className={`sidebar-item${props.scheduledOpen ? ' active' : ''}`}
            aria-current={props.scheduledOpen ? 'page' : undefined}
            onClick={props.onScheduled}
            data-testid="open-scheduled"
          >
            <span className="icon-badge plain">
              <CalendarClock size={15} />
            </span>
            <span className="label">{t('sidebar.scheduled')}</span>
          </button>
        </div>

        <div className="sidebar-scroll" data-testid="history" ref={list} onScroll={onScroll}>
          {/* Les états restent sur place ; les liens mère-filles gardent leur tracé (fiche 149). */}
          {pinned.length > 0 && (
            <SidebarSection
              id="pinned"
              label={t('sidebar.pinned')}
              folded={sections.isFolded('pinned')}
              onToggle={() => sections.toggle('pinned')}
              testId="history-pinned"
            >
              {nestChildren(pinned).map(item)}
            </SidebarSection>
          )}
          {others.length > 0 && (
            <SidebarSection
              id="history"
              label={grouping === 'recent' ? t('sidebar.recent') : t('sidebar.byFolder')}
              folded={sections.isFolded('history')}
              onToggle={() => sections.toggle('history')}
              testId="history-list"
              tools={
                <GroupingMenu
                  grouping={grouping}
                  onChoose={chooseGrouping}
                  onResumeSession={props.onResumeSession}
                  onHold={hold}
                />
              }
            >
              {grouping === 'recent'
                ? nestChildren(others).map(item)
                : byProject(others).map(({ project, items }) => (
                    <FolderGroup
                      key={project}
                      project={project}
                      folded={folders.isFolded(project)}
                      onToggle={() => folders.toggle(project)}
                    >
                      {nestChildren(items).map(item)}
                    </FolderGroup>
                  ))}
            </SidebarSection>
          )}
          {archived.length > 0 && (
            <SidebarSection
              id="archived"
              label={t('sidebar.archived')}
              folded={!archiveOpen}
              onToggle={() => {
                setArchiveOpen(!archiveOpen)
                writeLocal(ARCHIVE_OPEN_KEY, !archiveOpen)
              }}
              testId="history-archived"
              toggleTestId="history-archived-toggle"
            >
              {nestChildren(archived).map(item)}
            </SidebarSection>
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="agent-avatar">
          {agentLabel.charAt(0).toUpperCase()}
          <span className={`status-dot ${status}`} />
        </div>
        {props.quota && props.onRefreshQuota && !presenting ? (
          <AgentQuotaStatus
            quota={props.quota}
            status={statusText}
            agentLabel={agentLabel}
            onRefresh={props.onRefreshQuota}
          />
        ) : (
          <div className="who">
            <div className="name">{agentLabel}</div>
            <div className="sub" data-testid="agent-status">
              {statusText}
            </div>
          </div>
        )}
        <Tip label={t('sidebar.settingsTip')} command="settings">
          <button
            className="icon-button small"
            aria-label={t('sidebar.settings')}
            onClick={props.onOpenSettings}
            data-testid="open-settings"
          >
            <Settings size={15} />
          </button>
        </Tip>
        {props.notifications && props.notificationsBlocked ? (
          <NotificationsBlocked
            reason={props.notificationsBlocked}
            onOpenSettings={props.onOpenNotificationSettings}
            onDisable={() => props.onNotificationsChange(false)}
          />
        ) : (
          <Tip
            label={
              props.notifications
                ? t('sidebar.notifications.onTip')
                : t('sidebar.notifications.offTip')
            }
          >
            <button
              className="icon-button small"
              aria-label={
                props.notifications
                  ? t('sidebar.notifications.turnOff')
                  : t('sidebar.notifications.turnOn')
              }
              aria-pressed={props.notifications}
              onClick={() => props.onNotificationsChange(!props.notifications)}
              data-testid="notifications-toggle"
            >
              {props.notifications ? <Bell size={15} /> : <BellOff size={15} />}
            </button>
          </Tip>
        )}
      </div>
    </aside>
  )
}

/** Statut de l'agent au pied de la barre ; connexion expirée en pleine conversation (recette 0.9, D10). */
function agentStatusText(snapshot: AgentSnapshot | null): string {
  const refused = refusedTurnText(snapshot?.blocker, 'status')
  if (refused) return refused
  return i18next.t(`sidebar.status.${snapshot?.status ?? 'idle'}`)
}

/**
 * « Nouvelle conversation ». Profil en lecture seule (fiche 196) : désactivée, la raison en
 * infobulle — rien de neuf ne s'y enregistrerait.
 */
function NewConversationButton({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation()
  const { readOnly } = useProfileStatus()
  return (
    <button
      className="sidebar-item primary"
      onClick={onNew}
      disabled={readOnly}
      title={readOnly ? t('profile.readOnly.line') : undefined}
      data-testid="new-conversation"
    >
      <span className="icon-badge">
        <Plus size={13} strokeWidth={2.5} />
      </span>
      <span className="label">{t('sidebar.newConversation')}</span>
    </button>
  )
}
