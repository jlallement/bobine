import type { ImageAttachment } from '@shared/attachments'
import { PaneBoundary } from '../common/SafeBoundary'
import { Check, ListChecks, Maximize2, Minimize2, PanelLeft, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { PANEL_TABS, type PanelTab } from '@shared/panel'
import { hiddenPanelTabs, PANEL_MIN_WIDTH, unavailablePanelTabs } from '../../panel-tabs'
import { platformFeatures } from '../../platform-features'
import type { Preferences } from '@shared/preferences'
import type { TranscriptItem } from '@shared/transcript'
import { AcpTab } from './AcpTab'
import { AndroidTab } from './AndroidTab'
import { BrowserTab } from './BrowserTab'
import { ChangesTab, type ChangesView, type ChildWorktrees } from './ChangesTab'
import { DocumentTab } from './DocumentTab'
import { SessionTab, type SessionTabData } from './SessionTab'
import type { OpenFileLink } from '../thread/FileLink'
import type { MarkdownDocument } from '@shared/file-links'
import { Tip } from '../common/Menus'
import { PANEL_ICONS } from './PanelIcons'
import { SimulatorTab } from './SimulatorTab'
import { TerminalTab } from './TerminalTab'
import { lastPlan, PlanList } from '../thread/PlanList'
import { useTranslation } from 'react-i18next'
import { useCompactTabs } from './compact-tabs'
import { PanelMoreMenu } from './PanelMoreMenu'

/** Durée de « Page jointe au message » dans l'en-tête du panneau agrandi (fiche 094). */
const ATTACHED_NOTICE_MS = 3000

/** Dernière ouverture déjà animée (P1) : un panneau remonté sans nouvelle ouverture ne glisse pas. */
let animatedOpening = 0

interface Props {
  /** Numéro de l'ouverture réelle du panneau (`usePanel`) : il glisse en arrivant (fiche 185, P1). */
  opening?: number
  /** Conversation affichée (son navigateur, sa liste de tâches). */
  conversationId: string | null
  /** Dossier de la conversation (chemins des modifications). */
  workspace?: string
  /** Titre de la conversation : message de commit proposé hors worktree (fiche 123). */
  title?: string
  tab: PanelTab
  /** Onglets affichés, dans l'ordre (fiche 082) ; les autres sont dans le menu « + ». */
  tabs: PanelTab[]
  /** Compte affiché après le nom d'un onglet (« 2 » modifications, « 3/5 » tâches). */
  counts?: Partial<Record<PanelTab, string>>
  width: number
  /** Largeur maximale à la poignée : la conversation garde sa place (fiches 113, 173). */
  maxWidth: number
  /** Agrandi : le panneau prend la place de la conversation (fiche 082). */
  maximized: boolean
  onMaximize: (maximized: boolean) => void
  /** Agrandi : ce que fait l'agent de la conversation, qu'on ne voit plus. */
  agentStatus?: 'busy' | 'request'
  /** Réduit le panneau pour revenir au fil (clic sur l'état de l'agent). */
  onShowConversation?: () => void
  /** Agrandi, barre latérale masquée : le bouton pour la rouvrir est dans l'en-tête du panneau. */
  onShowSidebar?: () => void
  /** ✕ d'un onglet (ou clic molette) : il quitte le panneau, l'outil continue (fiche 082). */
  onCloseTab: (tab: PanelTab) => void
  /** Remarques sur les modifications (fiche 085) : message envoyé à l'agent. */
  onSendDiffNotes?: (text: string) => void
  /** Filles de la conversation : vue « Filles » des Modifications (fiche 161). */
  childWorktrees?: ChildWorktrees
  /** « Faire relire… » la conversation (fiche 177). */
  onReview?: () => void
  /** Remarques sur la page du navigateur (fiche 132) : message et capture annotée. */
  onSendPageNotes?: (text: string, images: ImageAttachment[]) => void
  items: TranscriptItem[]
  /** Terminal ouvert par l'utilisateur (bouton « >_ ») : il prend le clavier. */
  focusTerminal?: boolean
  onTerminalFocused?: () => void
  /** Police du terminal (réglages, fiche 027). */
  preferences?: Preferences
  /** « Modifications » ouvert par la puce de branche : sur l'état git (fiche 049). */
  changesRequest?: { view: ChangesView; seq: number }
  /** Image de l'onglet (page, écran d'un simulateur) jointe au message (fiche 066). */
  onAttachImage?: (image: ImageAttachment) => void
  /** Document Markdown en aperçu (fiche 052) : l'onglet « Aperçu » n'existe que s'il y en a un. */
  preview?: {
    conversationId: string
    document: MarkdownDocument
    onDocument: (document: MarkdownDocument) => void
    onOpenLink: OpenFileLink
    onClose: () => void
  }
  /** Onglet « Session » (fiche 166) : ce qu'il montre de la conversation active. */
  session?: SessionTabData
  onTab: (tab: PanelTab) => void
  onClose: () => void
  onResize: (width: number) => void
}

/**
 * Panneau latéral à onglets (fiche 029) : ce que l'agent fait avec les outils de l'app, à côté de
 * la conversation. Premier onglet : la session en un coup d'œil (fiche 166), puis la liste de
 * tâches de l'agent (fiche 035). Onglets nommés pour
 * les outils qui servent, les autres dans le menu « + » ; agrandi à la place de la conversation
 * (fiche 082).
 */
export function SidePanel({
  conversationId,
  workspace,
  title,
  tab,
  tabs,
  counts,
  width,
  maxWidth,
  maximized,
  onMaximize,
  agentStatus,
  onShowConversation,
  onShowSidebar,
  onCloseTab,
  onSendDiffNotes,
  childWorktrees,
  onReview,
  onSendPageNotes,
  items,
  focusTerminal,
  onTerminalFocused,
  preferences,
  changesRequest,
  preview,
  onAttachImage,
  session,
  onTab,
  onClose,
  onResize,
  opening = 0
}: Props) {
  const { t } = useTranslation()
  // Pas de glissé pour un panneau ouvert agrandi (pas d'animation, donc pas de fin pour la retirer).
  const [entering, setEntering] = useState(() => opening > animatedOpening && !maximized)
  if (entering && maximized) setEntering(false)
  useEffect(() => {
    animatedOpening = Math.max(animatedOpening, opening)
  }, [opening])
  const dragging = useRef(false)
  // Agrandi, la zone de saisie est cachée : l'image jointe se signale dans l'en-tête (fiche 094).
  const [attached, setAttached] = useState<{ kind: 'page' | 'screen'; at: number } | null>(null)
  useEffect(() => {
    if (!attached) return
    const timer = setTimeout(() => setAttached(null), ATTACHED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [attached])
  const attach =
    onAttachImage &&
    ((image: ImageAttachment) => {
      onAttachImage(image)
      if (maximized) setAttached({ kind: tab === 'browser' ? 'page' : 'screen', at: Date.now() })
    })
  const attachedText = maximized && attached ? t(`sidePanel.attached.${attached.kind}`) : ''
  // Panneau étroit : les onglets défilent, l'onglet actif reste visible.
  const tabList = useRef<HTMLDivElement>(null)
  useEffect(() => {
    tabList.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [tab, width, maximized])
  // Onglets que la rangée n'a pas la place de montrer : dans le menu « + » (fiche 185, maquette 7).
  const overflow = useCompactTabs(
    tabList,
    `${tabs.join(',')}|${JSON.stringify(counts ?? {})}`,
    tab
  ) as PanelTab[]
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    onResize(Math.min(maxWidth, Math.max(PANEL_MIN_WIDTH, window.innerWidth - event.clientX)))
  }
  const stopDrag = () => (dragging.current = false)

  const hidden = hiddenPanelTabs(tabs, unavailablePanelTabs(platformFeatures()))
  const label = (id: PanelTab) => PANEL_TABS.find((entry) => entry.id === id)?.label ?? id
  const sizeLabel = maximized ? t('sidePanel.restore') : t('sidePanel.maximize')

  return (
    <aside
      className={`side-panel${maximized ? ' maximized' : ''}${entering ? ' entering' : ''}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setEntering(false)
      }}
      style={maximized ? undefined : { width }}
      data-testid="side-panel"
    >
      {!maximized && (
        <div
          className="side-panel-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('sidePanel.resize')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          // Double-clic sur la poignée : agrandi (fiche 082).
          onDoubleClick={() => onMaximize(true)}
        />
      )}
      <header className={`side-panel-head drag${onShowSidebar ? ' with-lights' : ''}`}>
        {onShowSidebar && (
          <Tip label={t('app.showSidebar')} command="toggle-sidebar">
            <button
              className="icon-button no-drag"
              onClick={onShowSidebar}
              aria-label={t('app.showSidebar')}
            >
              <PanelLeft size={18} />
            </button>
          </Tip>
        )}
        <div className="side-panel-tabs no-drag" role="tablist" ref={tabList}>
          {tabs.map((id) => {
            const Icon = PANEL_ICONS[id]
            const count = counts?.[id]
            const closeLabel = t('sidePanel.closeTab', { tab: label(id) })
            return (
              <div
                key={id}
                className={`side-panel-tab${id === tab ? ' active' : ''}`}
                data-tab={id}
                // Clic molette : ferme l'onglet, comme dans un navigateur.
                onAuxClick={(event) => {
                  if (event.button === 1) onCloseTab(id)
                }}
              >
                <Tip label={label(id)}>
                  <button
                    role="tab"
                    aria-selected={id === tab}
                    aria-label={label(id)}
                    className="side-panel-tab-main"
                    onClick={() => onTab(id)}
                    data-tab={id}
                  >
                    <Icon size={15} />
                    <span className="side-panel-tab-label">{label(id)}</span>
                    {count && <span className="side-panel-tab-count">{count}</span>}
                  </button>
                </Tip>
                <Tip label={closeLabel}>
                  <button
                    className="side-panel-tab-close"
                    aria-label={closeLabel}
                    onClick={() => onCloseTab(id)}
                    data-testid="panel-tab-close"
                  >
                    <X size={13} />
                  </button>
                </Tip>
              </div>
            )
          })}
        </div>
        <PanelMoreMenu
          overflow={overflow}
          closed={hidden}
          {...(counts ? { counts } : {})}
          label={label}
          onTab={onTab}
          onCloseTab={onCloseTab}
        />
        <span className="grow" />
        <span className="sr-only" aria-live="polite">
          {attachedText}
        </span>
        {attachedText && onShowConversation && (
          <Tip label={t('sidePanel.agent.back')}>
            <button
              className="side-panel-agent attached no-drag"
              onClick={onShowConversation}
              data-testid="panel-attached"
            >
              <Check size={13} />
              {attachedText}
            </button>
          </Tip>
        )}
        {maximized && agentStatus && onShowConversation && (
          <Tip label={t('sidePanel.agent.back')}>
            <button
              className={`side-panel-agent no-drag ${agentStatus}`}
              onClick={onShowConversation}
              data-testid="panel-agent-status"
            >
              <span className="side-panel-agent-dot" />
              {t(`sidePanel.agent.${agentStatus}`)}
            </button>
          </Tip>
        )}
        <Tip label={sizeLabel} command="maximize-panel">
          <button
            className="icon-button no-drag"
            onClick={() => onMaximize(!maximized)}
            aria-label={sizeLabel}
            aria-pressed={maximized}
            data-testid="panel-maximize"
          >
            {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </Tip>
        <Tip label={t('sidePanel.close')}>
          <button
            className="icon-button no-drag"
            onClick={onClose}
            aria-label={t('sidePanel.close')}
          >
            <X size={16} />
          </button>
        </Tip>
      </header>
      <div className={`side-panel-body${tab === 'tasks' || tab === 'session' ? '' : ' flush'}`}>
        {/* Un onglet qui ne s'affiche pas n'emporte ni les autres ni la conversation (fiche 194). */}
        <PaneBoundary what="panel" resetKey={`${tab}:${String(conversationId)}`}>
          {tab === 'tasks' && <TasksTab items={items} />}
          {tab === 'session' && conversationId && session && (
            <SessionTab key={conversationId} conversationId={conversationId} data={session} />
          )}
          {tab === 'changes' && conversationId && (
            <ChangesTab
              // Nouvelle demande (puce de branche, pastille des modifications) : vue demandée.
              key={`${conversationId}:${changesRequest?.seq ?? 0}`}
              conversationId={conversationId}
              items={items}
              {...(changesRequest
                ? { initialView: changesRequest.view, initialViewSeq: changesRequest.seq }
                : {})}
              {...(workspace ? { workspace } : {})}
              title={title}
              {...(onSendDiffNotes ? { onSendNotes: onSendDiffNotes } : {})}
              childWorktrees={childWorktrees}
              onReview={onReview}
            />
          )}
          {tab === 'document' && preview && (
            <DocumentTab
              conversationId={preview.conversationId}
              document={preview.document}
              items={items}
              onDocument={preview.onDocument}
              onOpenLink={preview.onOpenLink}
              onClose={preview.onClose}
            />
          )}
          {conversationId && (
            <ToolTab
              tab={tab}
              conversationId={conversationId}
              focusTerminal={focusTerminal}
              onTerminalFocused={onTerminalFocused}
              onSendPageNotes={onSendPageNotes}
              {...(preferences ? { preferences } : {})}
              {...(attach ? { onAttach: attach } : {})}
            />
          )}
        </PaneBoundary>
      </div>
    </aside>
  )
}

/** Outils de l'app d'une conversation (un par onglet), montés seulement s'ils sont affichés. */
function ToolTab({
  tab,
  conversationId,
  focusTerminal,
  onTerminalFocused,
  preferences,
  onAttach,
  onSendPageNotes
}: {
  tab: PanelTab
  conversationId: string
  focusTerminal: boolean | undefined
  onTerminalFocused: (() => void) | undefined
  preferences?: Preferences
  onAttach?: (image: ImageAttachment) => void
  /** Remarques sur la page, envoyées à l'agent (fiche 132). */
  onSendPageNotes?: ((text: string, images: ImageAttachment[]) => void) | undefined
}) {
  const attach = onAttach ? { onAttach } : {}
  switch (tab) {
    case 'browser':
      return (
        <BrowserTab
          key={conversationId}
          conversationId={conversationId}
          {...attach}
          onSendNotes={onSendPageNotes}
        />
      )
    case 'simulator':
      return <SimulatorTab key={conversationId} conversationId={conversationId} {...attach} />
    case 'android':
      return <AndroidTab key={conversationId} conversationId={conversationId} {...attach} />
    case 'terminal':
      return (
        <TerminalTab
          key={conversationId}
          conversationId={conversationId}
          focusRequested={focusTerminal}
          {...(preferences ? { preferences } : {})}
          onFocused={onTerminalFocused}
        />
      )
    case 'acp':
      return <AcpTab key={conversationId} conversationId={conversationId} />
    default:
      return null
  }
}

function TasksTab({ items }: { items: TranscriptItem[] }) {
  const { t } = useTranslation()
  const plan = lastPlan(items)
  if (!plan || plan.entries.length === 0) {
    return (
      <div className="side-panel-empty" data-testid="tasks-empty">
        <ListChecks size={22} />
        <p>{t('sidePanel.noTasks')}</p>
      </div>
    )
  }
  return (
    <div className="tasks-tab" data-testid="tasks">
      <PlanProgress entries={plan.entries} />
      <PlanList entries={plan.entries} />
    </div>
  )
}

/** « 2 / 5 tâches faites » avec une barre de progression. */
export function PlanProgress({ entries }: { entries: { status: string }[] }) {
  const { t } = useTranslation()
  const done = entries.filter((e) => e.status === 'completed').length
  return (
    <div className="plan-progress">
      <span>{t('sidePanel.progress', { done, count: entries.length })}</span>
      <div className="plan-progress-bar">
        <div style={{ width: `${(done / entries.length) * 100}%` }} />
      </div>
    </div>
  )
}
