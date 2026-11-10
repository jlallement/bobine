import { ReviewCard } from './ReviewCard'
import {
  ArrowRightLeft,
  BellRing,
  Brain,
  ChevronRight,
  GitBranch,
  Pencil,
  RefreshCw,
  RotateCcw,
  CircleExclamationPoint,
  CircleCheck,
  Info,
  ListChecks,
  TriangleExclamationPoint,
  FoldVertical,
  FileText,
  LoaderCircle,
  Split
} from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { planVersions } from '@shared/plan-doc'
import { groupTools, type ThreadEntry } from '@shared/tool-groups'
import { noticeText, type TranscriptItem } from '@shared/transcript'
import { handoverName } from '@shared/handover'
import { childProposalGroups, type MessageOrigin as MessageOriginType } from '@shared/children'
import type { TerminalState } from '@shared/terminal-output'
import { fullTime, messageTime, turnDuration } from '../../time'
import { turnDurations } from '@shared/turn-duration'
import type { ConversationUsage } from '@shared/usage'
import { lastTurnFacts, TurnSummary } from './TurnSummary'
import { CopyButton } from '../common/CopyButton'
import { ContextIcon } from '../composer/ContextIcon'
import { PastedTextDialog, PastedTextLabel } from '../composer/PastedText'
import { Markdown } from './Markdown'
import { PlanList } from './PlanList'
import { PlanDocument, type PlanActions } from './PlanDocument'
import { ElicitationCard, type RespondElicitation } from './ElicitationCard'
import { ToolCall, WorkspaceContext, type RespondPermission } from './ToolCall'
import { AgentCardContext, type AgentCardInfo } from './agent-card-context'
import { ToolGroup } from './ToolGroup'
import { ZoomableImage } from './ImageZoom'
import { SubagentsCard } from './SubagentsCard'
import { WorktreeStart } from './WorktreeStart'
import { WorktreeSetup, type WorktreeSetupActions } from './WorktreeSetup'
import {
  ChildInstructionItem,
  ChildRecommendationItem,
  ChildReportItem,
  ChildStarted,
  type SubtasksInfo
} from './Subtasks'
import { ChildProposals, type ProposalsInfo } from './ChildProposals'
import { useTranslation } from 'react-i18next'
import { stripAppContext } from '@shared/app-context'
import { CostCapCard } from './CostCapCard'
import { TurnLimitCard } from './TurnLimitCard'
import { entryKey, entryKind, ItemBoundary } from '../common/SafeBoundary'

/** Avis de l'app qui renvoient au journal (fiche 194) : un lien « Afficher le journal ». */
const SHOW_LOG_NOTICES: ReadonlySet<string> = new Set(['appTools.serverDown'])
import { useEntryWindow } from './useEntryWindow'
import { FindQueryContext } from './CappedText'
import type { NoticeLink as NoticeLinkTarget } from '@shared/agent'
import { requestSettings } from '../../open-settings'
import { MemoryProposalCard } from './MemoryProposalCard'

const NOTICE_ICONS = {
  info: Info,
  warning: TriangleExclamationPoint,
  error: CircleExclamationPoint,
  success: CircleCheck
} as const
/** Même objet d'un rendu à l'autre quand il n'y a aucun terminal (éléments mémoïsés). */
const NO_TERMINALS: Record<string, TerminalState> = {}
/** Premier élément du fil d'une entrée (fiche 193). */
const entryId = (entry: ThreadEntry) => (entry.kind === 'item' ? entry.item.id : entry.key)

/** Repartir d'un message de l'utilisateur (fiche 023). */
export interface MessageActions {
  /** L'agent travaille : pas de modification pour l'instant. */
  busy: boolean
  /**
   * Le dernier message a été refusé et sa carte attend (connexion, fiche 210) : pas de « Réessayer »
   * en branche, qui repartirait avec le même refus ; la carte renvoie le message en place.
   */
  refused?: boolean
  /** Nouveau texte pour le message `itemId` : une branche repart de ce point. */
  onEdit: (itemId: number, text: string) => void
  /** Bandeau d'une branche : ouvrir la conversation d'origine. */
  onOpenConversation: (id: string) => void
}

export function Transcript({
  items,
  terminals = NO_TERMINALS,
  onRespondPermission,
  onRespondElicitation,
  planActions,
  messageActions,
  hiddenPlanId,
  subtasks,
  proposals,
  workspace,
  agent,
  onOpenGitView,
  worktreeSetup,
  usage,
  streaming = false,
  findQuery,
  reveal
}: {
  items: TranscriptItem[]
  /** Sortie des commandes, par terminal. */
  terminals?: Record<string, TerminalState>
  onRespondPermission: RespondPermission
  onRespondElicitation: RespondElicitation
  /** Plan annoté (fiche 040) : remarques et exécution ; absent, les plans sont en lecture seule. */
  planActions?: PlanActions
  /** Modifier / réessayer un message (fiche 023) ; absent, les messages sont en lecture seule. */
  messageActions?: MessageActions
  /** Plan du tour épinglé au-dessus de la zone de saisie (fiche 077) : pas de carte dans le fil. */
  hiddenPlanId?: number
  /** Conversations filles de celle-ci (fiche 097) : carte « Sous-tâches », comptes rendus. */
  subtasks?: SubtasksInfo
  /** Propositions de filles par l'agent (fiche 112) : la mère et les agents, pour la carte. */
  proposals?: ProposalsInfo
  /** Dossier de la conversation : chemins relatifs sur les cartes d'outils (fiche 107). */
  workspace?: string
  /** L'agent de la conversation : nom et portée de son « Toujours » sur les cartes (fiche 214). */
  agent?: AgentCardInfo
  /** « Vue Git » de la carte de départ d'un worktree (fiche 117) : l'onglet Modifications. */
  onOpenGitView?: () => void
  /** « Autoriser et lancer », « Continuer sans préparer » (préparation du worktree, fiche 175). */
  worktreeSetup?: WorktreeSetupActions
  /** Consommation de la conversation : coût du dernier tour dans son bilan (fiche 185, P4). */
  usage?: ConversationUsage | undefined
  /** L'agent répond : sa dernière réponse s'écrit encore (fiche 192). */
  streaming?: boolean
  /**
   * Recherche dans le fil ouverte (ce qu'on cherche) : tout le fil rendu, et le début masqué des
   * sorties plafonnées qui le contient (fiches 192, 193) ; sinon il s'ouvre par la fin.
   */
  findQuery?: string | undefined
  /** Élément pas encore rendu à rendre et à montrer (sommaire, fiche 193). */
  reveal?: number | undefined
}) {
  // Fonctions stables pour les éléments du fil (fiche 047) : les parents les recréent à chaque
  // rendu, et un élément inchangé ne doit pas refaire son rendu à chaque morceau de réponse.
  const latest = useRef({ onRespondPermission, onRespondElicitation, messageActions })
  useLayoutEffect(() => {
    latest.current = { onRespondPermission, onRespondElicitation, messageActions }
  })
  const respondPermission = useCallback<RespondPermission>(
    (requestId, optionId) => latest.current.onRespondPermission(requestId, optionId),
    []
  )
  const respondElicitation = useCallback<RespondElicitation>(
    (requestId, answer) => latest.current.onRespondElicitation(requestId, answer),
    []
  )
  const editMessage = useCallback(
    (itemId: number, text: string) => latest.current.messageActions?.onEdit(itemId, text),
    []
  )
  const openConversation = useCallback(
    (id: string) => latest.current.messageActions?.onOpenConversation(id),
    []
  )
  // Plans des tours en mode plan : une carte à la fin du tour, ou à la place de la réponse.
  const plans = useMemo(() => planVersions(items), [items])
  // Durée de chaque tour, sous sa dernière réponse (fiche 156).
  const durations = useMemo(() => turnDurations(items), [items])
  // Bilan du tour fini, sous sa dernière réponse ; parti dès le message suivant (fiche 185, P4).
  const finished = !!messageActions && !messageActions.busy
  const summary = useMemo(
    () => (finished ? lastTurnFacts(items, durations, usage) : undefined),
    [finished, items, durations, usage]
  )
  const planAt = new Map(plans.map((p) => [p.anchorId, p]))
  const replaced = new Set(plans.flatMap((p) => p.replyIds))
  // L'appel d'outil qui pose une question (ex. AskUserQuestion) est remplacé par la carte de questions.
  const lastUser = items.findLast((i) => i.kind === 'user')?.id
  // Réponse en cours d'écriture : son bloc de code ouvert attend sa clôture pour être coloré.
  const writing = streaming && items.at(-1)?.kind === 'agent' ? items.at(-1)?.id : undefined
  const asking = new Set(
    items.flatMap((item) =>
      item.kind === 'elicitation' && item.prompt.mode === 'form' && item.prompt.toolCallId
        ? [item.prompt.toolCallId]
        : []
    )
  )
  // Propositions de filles d'un même tour : une carte à la place de la première (fiche 112).
  const proposed = useMemo(() => childProposalGroups(items), [items])
  const shown = items.filter(
    (item) =>
      !(
        item.kind === 'tool' &&
        (asking.has(item.toolCallId) || proposed.toolCallIds.has(item.toolCallId))
      ) &&
      !(item.kind === 'plan' && item.id === hiddenPlanId) &&
      // Fusion des filles (fiche 120) : montrée par la carte « Sous-tâches », pas à sa place.
      item.kind !== 'children-merge' &&
      !proposed.hidden.has(item.id)
  )
  // Outils consécutifs regroupés (fiche 047), sauf ceux auxquels une carte de plan est rattachée.
  const entries = groupTools(shown, (item) => planAt.has(item.id) || replaced.has(item.id))
  // Long fil ouvert par la fin : les éléments précédents se rendent en remontant (fiche 193).
  const { start, sentinel } = useEntryWindow(entries, entryId, {
    complete: findQuery !== undefined,
    reveal
  })
  const thread = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reveal === undefined) return
    thread.current?.querySelector(`[data-item-id="${reveal}"]`)?.scrollIntoView({ block: 'start' })
  }, [reveal])
  // Carte « Sous-tâches » au dernier lancement d'une fille (fiche 097) ; filles lancées par l'agent,
  // dont les comptes rendus partiront à son réveil.
  const lastLaunch = items.findLast((i) => i.kind === 'child-started')?.id
  const byAgent = new Set(
    items.flatMap((i) => (i.kind === 'child-started' && i.by === 'agent' ? [i.childId] : []))
  )
  const renderEntry = (entry: (typeof entries)[number]) => {
    if (entry.kind === 'tools') {
      return (
        <ToolGroup
          key={entry.key}
          items={entry.items}
          terminals={terminals}
          onRespond={respondPermission}
        />
      )
    }
    if (entry.kind === 'subagents') {
      return <SubagentsCard key={entry.key} items={entry.items} onRespond={respondPermission} />
    }
    const { item } = entry
    const plan = planAt.get(item.id)
    const card = plan && (
      <PlanDocument
        key={`plan-${item.id}`}
        plan={plan}
        {...(planActions ? { actions: planActions } : {})}
      />
    )
    if (replaced.has(item.id)) return card ?? null
    const proposalGroup = proposed.groups.get(item.id)
    if (proposalGroup) {
      return (
        <ChildProposals
          key={item.id}
          items={proposalGroup}
          {...(proposals ? { info: proposals } : {})}
          onRespond={respondElicitation}
        />
      )
    }
    if (item.kind === 'child-instruction') {
      return <ChildInstructionItem key={item.id} item={item} />
    }
    if (item.kind === 'review') {
      return (
        <ReviewCard
          key={item.id}
          item={item}
          {...(messageActions ? { onOpen: openConversation } : {})}
          {...(onOpenGitView ? { onShowNotes: onOpenGitView } : {})}
        />
      )
    }
    if (item.kind === 'child-recommendation') {
      return <ChildRecommendationItem key={item.id} item={item} />
    }
    if (item.kind === 'child-started') {
      return (
        <ChildStarted
          key={item.id}
          item={item}
          items={items}
          {...(subtasks && item.id === lastLaunch ? { info: subtasks } : {})}
        />
      )
    }
    if (item.kind === 'worktree-start') {
      return <WorktreeStart key={item.id} item={item} onOpenGit={onOpenGitView} />
    }
    if (item.kind === 'worktree-setup') {
      return <WorktreeSetup key={item.id} item={item} {...worktreeSetup} />
    }
    if (item.kind === 'child-report') {
      const open = subtasks?.children.some((c) => c.id === item.childId)
      return (
        <ChildReportItem
          key={item.id}
          item={item}
          pending={lastUser === undefined || item.id > lastUser}
          byAgent={byAgent.has(item.childId)}
          {...(open && subtasks ? { onOpen: () => subtasks.onOpen(item.childId) } : {})}
        />
      )
    }
    if (item.kind === 'user' || item.kind === 'branch') {
      return (
        <MessageItem
          key={item.id}
          item={item}
          last={item.id === lastUser}
          {...(messageActions
            ? {
                busy: messageActions.busy,
                refused: messageActions.refused === true,
                onEdit: editMessage,
                onOpenConversation: openConversation
              }
            : {})}
        />
      )
    }
    const rendered = (
      <Item
        key={item.id}
        item={item}
        terminal={item.kind === 'tool' && item.terminalId ? terminals[item.terminalId] : undefined}
        duration={durations.get(item.id)}
        streaming={item.id === writing}
        onRespondPermission={respondPermission}
        onRespondElicitation={respondElicitation}
      />
    )
    return card ? [rendered, card] : rendered
  }
  return (
    <WorkspaceContext.Provider value={workspace}>
      <AgentCardContext.Provider value={agent}>
        <FindQueryContext.Provider value={findQuery}>
          <div className="thread" data-testid="thread" ref={thread}>
            {start > 0 && <div ref={sentinel} className="thread-older" aria-hidden />}
            {entries.slice(start).map((entry) => (
              <ItemBoundary key={entryKey(entry)} kind={entryKind(entry)}>
                {renderEntry(entry)}
              </ItemBoundary>
            ))}
            {summary && <TurnSummary facts={summary} />}
          </div>
        </FindQueryContext.Provider>
      </AgentCardContext.Provider>
    </WorkspaceContext.Provider>
  )
}

/**
 * Message de l'utilisateur (modifiable, fiche 023) ou début d'une branche. Sans `onEdit`, en
 * lecture seule.
 */
const MessageItem = memo(function MessageItem({
  item,
  last,
  busy = false,
  refused = false,
  onEdit,
  onOpenConversation
}: {
  item: Extract<TranscriptItem, { kind: 'user' | 'branch' }>
  last: boolean
  busy?: boolean
  refused?: boolean
  onEdit?: (itemId: number, text: string) => void
  onOpenConversation?: (id: string) => void
}) {
  const { t } = useTranslation()
  const actions = onEdit && onOpenConversation ? { busy, onEdit, onOpenConversation } : undefined
  const [editing, setEditing] = useState<string | null>(null)
  if (item.kind === 'branch') {
    const files =
      item.restored > 0 ? ` ${t('transcript.branch.restored', { count: item.restored })}` : ''
    const skipped =
      item.skipped > 0 ? ` ${t('transcript.branch.skipped', { count: item.skipped })}` : ''
    return (
      <div className="branch-banner" data-testid="branch-banner">
        <GitBranch size={14} />
        <span>
          {/* Titre de l'original : jamais ce que l'app a joint au message (fiche 125). */}
          {t('transcript.branch.banner', {
            title: stripAppContext(item.fromTitle) ?? item.fromTitle
          })}
          {files}
          {skipped}
        </span>
        {actions && (
          <button
            className="link-button"
            onClick={() => actions.onOpenConversation(item.fromId)}
            data-testid="branch-original"
          >
            {t('transcript.branch.original')}
          </button>
        )}
      </div>
    )
  }
  if (editing !== null && actions) {
    const submit = () => {
      if (!editing.trim() && !item.attachments?.length) return
      actions.onEdit(item.id, editing)
      setEditing(null)
    }
    return (
      <div className="msg-user-group editing" data-testid="message-editor">
        <textarea
          className="msg-user-edit"
          autoFocus
          value={editing}
          rows={Math.min(10, Math.max(2, editing.split('\n').length))}
          onChange={(e) => setEditing(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape') setEditing(null)
          }}
          data-testid="message-edit-input"
        />
        <div className="msg-user-edit-actions">
          <span className="muted">{t('transcript.edit.hint')}</span>
          <button className="btn small ghost" onClick={() => setEditing(null)}>
            {t('common.cancel')}
          </button>
          <button
            className="btn small primary"
            disabled={actions.busy || (!editing.trim() && !item.attachments?.length)}
            onClick={submit}
            data-testid="message-edit-send"
          >
            {t('transcript.edit.send')}
          </button>
        </div>
      </div>
    )
  }
  // Message d'une autre conversation (fiche 097) : ni « Modifier » ni « Réessayer ».
  if (item.from?.kind === 'wake') return <WakeLine at={item.at} />
  const own = actions && !item.from ? actions : undefined
  return (
    <div className="msg-user-group" data-testid="user-message" data-item-id={item.id}>
      {item.from && <MessageOrigin from={item.from} onOpen={actions?.onOpenConversation} />}
      <UserMessage item={item} />
      <div className="msg-user-actions">
        {item.at && <MessageTime at={item.at} />}
        {copiedText(item) !== undefined && (
          <CopyButton
            text={() => copiedText(item) ?? ''}
            label={t('transcript.copyMessage')}
            testId="copy-message"
          />
        )}
        {/* Branche (fiche 023) : nom distinct du « Réessayer » d'une carte (fiche 210). */}
        {own && !own.busy && last && !refused && (
          <button
            className="icon-button small"
            title={t('transcript.retryBranch')}
            aria-label={t('transcript.retryBranch')}
            onClick={() => own.onEdit(item.id, item.text)}
            data-testid="message-retry"
          >
            <RotateCcw size={13} />
          </button>
        )}
        {own && !own.busy && (
          <button
            className="icon-button small"
            title={t('transcript.edit.action')}
            aria-label={t('transcript.edit.action')}
            onClick={() => setEditing(item.text)}
            data-testid="message-edit"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
    </div>
  )
})

/**
 * Provenance d'un message venu d'une autre conversation (fiche 097) : « De la conversation mère »,
 * « De la conversation fille « … » », avec un lien vers elle.
 */
function MessageOrigin({
  from,
  onOpen
}: {
  from: Extract<MessageOriginType, { id: string }>
  onOpen?: ((id: string) => void) | undefined
}) {
  const { t } = useTranslation()
  const label = t(from.kind === 'parent' ? 'children.from.parent' : 'children.from.child', {
    title: from.title
  })
  return (
    <div className="msg-origin" data-testid="message-origin" data-origin={from.kind}>
      <Split size={12} />
      {onOpen ? (
        <button className="link-button" onClick={() => onOpen(from.id)}>
          {label}
        </button>
      ) : (
        <span>{label}</span>
      )}
    </div>
  )
}

/** Réveil groupé de la mère (fiche 097) : une ligne de l'app, pas une bulle. */
function WakeLine({ at }: { at?: number | undefined }) {
  const { t } = useTranslation()
  return (
    <div className="subtask-launch wake-line" data-testid="wake-message">
      <BellRing size={14} />
      <span>{t('children.from.wake')}</span>
      {at && <MessageTime at={at} />}
    </div>
  )
}

/**
 * Ce que « Copier le message » met dans le presse-papiers (fiche 156) : le texte affiché, puis
 * les textes collés en pièce jointe (fiche 155) ; `undefined` s'il n'y a rien à copier (pas de
 * bouton).
 */
function copiedText(item: Extract<TranscriptItem, { kind: 'user' }>): string | undefined {
  const pasted = (item.attachments ?? []).flatMap((a) => (a.kind === 'text' ? [a.text] : []))
  const parts = [item.text, ...pasted].filter((part) => !!part)
  return parts.length > 0 ? parts.join('\n\n') : undefined
}

/** Durée du tour, à côté de l'heure de sa dernière réponse (fiche 156). */
function MessageDuration({ ms }: { ms: number }) {
  const { t } = useTranslation()
  const text = turnDuration(ms)
  return (
    <span
      className="msg-duration"
      title={t('transcript.duration.title', { duration: text })}
      data-testid="turn-duration"
    >
      {text}
    </span>
  )
}

/** Heure d'un message, au survol (date complète dans l'infobulle). */
function MessageTime({ at }: { at: number }) {
  return (
    <time className="msg-time" dateTime={new Date(at).toISOString()} title={fullTime(at)}>
      {messageTime(at)}
    </time>
  )
}

function UserMessage({ item }: { item: Extract<TranscriptItem, { kind: 'user' }> }) {
  // Texte collé ouvert en aperçu (fiche 155).
  const [reading, setReading] = useState<number | null>(null)
  const read = reading === null ? undefined : item.attachments?.[reading]
  return (
    <>
      {item.attachments && item.attachments.length > 0 && (
        <div className="msg-attachments" data-testid="msg-attachments">
          {item.attachments.map((a, i) =>
            a.kind === 'text' ? (
              <button
                key={i}
                type="button"
                className="attachment file attachment-open attachment-text"
                title={a.text.slice(0, 200)}
                onClick={() => setReading(i)}
              >
                <PastedTextLabel name={a.name} text={a.text} />
              </button>
            ) : a.kind === 'image' ? (
              <ZoomableImage key={i} image={a} className="msg-image" alt={a.name} />
            ) : (
              <span
                key={i}
                className="attachment file"
                title={a.kind === 'context' ? `@${a.source}` : (a.path ?? a.name)}
              >
                {a.kind === 'context' ? <ContextIcon source={a.source} /> : <FileText size={14} />}
                <span>{a.name}</span>
              </span>
            )
          )}
        </div>
      )}
      {item.text && <div className="msg-user">{item.text}</div>}
      {read?.kind === 'text' && (
        <PastedTextDialog name={read.name} text={read.text} onClose={() => setReading(null)} />
      )}
    </>
  )
}

/** Un élément du fil : refait son rendu seulement s'il change (fiche 047). */
const Item = memo(function Item({
  item,
  terminal,
  duration,
  streaming,
  onRespondPermission,
  onRespondElicitation
}: {
  item: TranscriptItem
  terminal?: TerminalState
  /** Dernière réponse d'un tour : sa durée (fiche 156). */
  duration?: number | undefined
  /** Réponse en cours d'écriture (fiche 192). */
  streaming: boolean
  onRespondPermission: RespondPermission
  onRespondElicitation: RespondElicitation
}) {
  const { t } = useTranslation()
  switch (item.kind) {
    case 'user':
      return (
        <div className="msg-user-group">
          <UserMessage item={item} />
        </div>
      )
    case 'agent':
      return (
        <div className="msg-agent-group">
          <div className="msg-agent">
            <Markdown text={item.text} streaming={streaming} />
          </div>
          <div className="msg-agent-actions">
            <CopyButton
              text={() => item.text}
              label={t('transcript.copyReply')}
              testId="copy-reply"
            />
            {item.at && <MessageTime at={item.at} />}
            {duration !== undefined && <MessageDuration ms={duration} />}
          </div>
        </div>
      )
    case 'thought':
      return (
        <details className="thought">
          <summary>
            <Brain size={14} />

            {t('transcript.thought')}
            <ChevronRight size={13} className="chevron" />
          </summary>
          <div className="thought-body">{item.text}</div>
        </details>
      )
    case 'tool':
      // Sous-agent laissé seul (carte de plan rattachée) : sa carte « Sous-agents » quand même.
      return item.subagent ? (
        <SubagentsCard items={[item]} onRespond={onRespondPermission} />
      ) : (
        <ToolCall item={item} terminal={terminal} onRespond={onRespondPermission} />
      )
    case 'plan':
      return (
        <div className="plan">
          <div className="plan-title">
            <ListChecks size={15} /> {t('transcript.plan')}
          </div>
          <PlanList entries={item.entries} />
        </div>
      )
    case 'notice': {
      const Icon = NOTICE_ICONS[item.level]
      const text = noticeText(item)
      const block = !!item.title || text.includes('\n')
      return (
        <div
          className={`notice notice-${item.level}${block ? ' notice-block' : ''}${item.link ? ' notice-linked' : ''}`}
          data-testid={item.title ? 'notice-report' : undefined}
        >
          {item.level !== 'info' && <Icon size={15} />}
          {item.title ? (
            <div className="notice-body">
              <strong className="notice-title">{item.title}</strong>
              <span>{text}</span>
            </div>
          ) : (
            <span>
              {text}
              {item.link && <NoticeLink link={item.link} />}
            </span>
          )}
          {item.message && SHOW_LOG_NOTICES.has(item.message.key) && (
            <button
              className="link-button notice-action"
              onClick={() => void window.api.app.showLog()}
            >
              {t('errorBoundary.showLog')}
            </button>
          )}
        </div>
      )
    }
    case 'elicitation':
      return <ElicitationCard item={item} onRespond={onRespondElicitation} />
    case 'compaction':
      return <Compaction item={item} />
    case 'handover':
      return <HandoverDivider item={item} />
    case 'cost-cap':
      return <CostCapCard item={item} />
    case 'turn-limit':
      return <TurnLimitCard item={item} />
    case 'memory-proposal':
      return <MemoryProposalCard item={item} />
  }
})

/**
 * La conversation continue avec un autre agent (fiche 108), ou dans une session neuve du même agent
 * (ADR-0030) : un trait, l'agent d'après, et pourquoi.
 */
/** Lien à la suite d'un avis (fiche 198) : ouvre la section des Réglages qu'il nomme. */
function NoticeLink({ link }: { link: NoticeLinkTarget }) {
  const { t } = useTranslation()
  return (
    <>
      {' '}
      <button
        type="button"
        className="link-button notice-link"
        data-testid="notice-link"
        onClick={() => requestSettings(link)}
      >
        {t('transcript.notice.diagnosticsLink')}
      </button>
    </>
  )
}

function HandoverDivider({ item }: { item: Extract<TranscriptItem, { kind: 'handover' }> }) {
  const { t } = useTranslation()
  const agent = item.to.label
  return (
    <div className="handover-divider" data-testid="handover-divider" data-reason={item.reason}>
      <div className="handover-divider-line">
        {item.reason ? <RefreshCw size={14} /> : <ArrowRightLeft size={14} />}
        <span>
          {item.reason
            ? t('handover.thread.renewTitle', { agent })
            : t('handover.thread.title', { agent: handoverName(item) })}
        </span>
      </div>
      <div className="handover-divider-detail">
        {item.reason === 'no-resume' && t('handover.thread.renewDetailNoResume', { agent })}
        {item.reason === 'session-lost' && t('handover.thread.renewDetailLost', { agent })}
        {item.reason === 'turn-limit' && t('handover.thread.renewDetailTurnLimit', { agent })}
        {!item.reason && t('handover.thread.detail', { from: item.from.label })}
      </div>
    </div>
  )
}

/** L'agent a résumé l'échange pour libérer du contexte. */
function Compaction({ item }: { item: Extract<TranscriptItem, { kind: 'compaction' }> }) {
  const { t } = useTranslation()
  const running = item.status === 'in_progress'
  const failed = item.status === 'failed' || item.status === 'cancelled'
  const label = running
    ? t('transcript.compaction.running')
    : failed
      ? t(
          item.status === 'failed'
            ? 'transcript.compaction.failed'
            : 'transcript.compaction.cancelled'
        )
      : t('transcript.compaction.done')
  return (
    <details className="compaction" data-testid="compaction" data-status={item.status}>
      <summary>
        {running ? <LoaderCircle size={14} className="spin" /> : <FoldVertical size={14} />}
        <span>{label}</span>
        {item.summary && <ChevronRight size={13} className="chevron" />}
      </summary>
      {item.summary && (
        <div className="compaction-summary">
          <Markdown text={item.summary} />
        </div>
      )}
      {item.error && <div className="compaction-summary error">{item.error}</div>}
    </details>
  )
}
