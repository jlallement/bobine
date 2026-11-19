import {
  Check,
  Eye,
  EyeOff,
  GitBranch,
  LoaderCircle,
  Pencil,
  Reply,
  Send,
  TriangleAlert
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { RoleRequestItem, WorkCardData } from '@shared/role-request'
import type { RoleBadge } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import { usePresentation } from '../../presentation'
import { ipcErrorText } from '../../ipc-errors'
import { invokeRole } from '../../roles/roles-store'
import { messageTime, turnDuration } from '../../time'
import { CopyButton } from '../common/CopyButton'
import { Tip } from '../common/Menus'
import { RoleAvatar, useRoleStyle, type RoleAvatarState } from '../roles/RoleAvatar'
import { childReadOnly } from '../roles/RoleWork'
import { useWorkActivity } from '../roles/useWorkActivity'
import { Markdown } from './Markdown'
import { MessageTime } from './MessageTime'
import { Branch, FileStats, useUsageText, type SubtasksInfo } from './Subtasks'
import {
  answerText,
  currentReport,
  exchangeStart,
  relayOf,
  workState,
  workUsage,
  type WorkState
} from './work-card'
import '../../work-card.css'

/**
 * Bulle « @Rôle … » et cartes-réponses (fiche 263, écran A des maquettes de la fiche 260) : la
 * demande reste dans le fil, et juste dessous une carte par travail, à cette place pour toujours.
 * La carte dit ce que fait le travail, puis montre sa réponse entière, et ce qu'on peut en faire.
 */

type Report = Extract<TranscriptItem, { kind: 'child-report' }>

/** La bulle d'ouverture et ses cartes, à la place de l'élément `role-request` du fil. */
export function RoleRequestEntry({
  item,
  cards,
  items,
  info
}: {
  item: RoleRequestItem
  cards: readonly WorkCardData[] | undefined
  items: readonly TranscriptItem[]
  info: SubtasksInfo | undefined
}) {
  return (
    <>
      <RoleRequestBubble item={item} />
      {cards?.map((card) => (
        <WorkCard key={card.childId} card={card} items={items} info={info} />
      ))}
    </>
  )
}

/** La bulle de l'utilisateur : la puce de chaque rôle, puis le texte demandé. */
export function RoleRequestBubble({
  item,
  inCard = false
}: {
  item: RoleRequestItem
  inCard?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div
      className={`msg-user-group role-request${inCard ? ' in-card' : ''}`}
      data-testid={inCard ? 'work-ask' : 'role-request'}
      data-item-id={item.id}
    >
      <div className="msg-user role-request-bubble">
        {!inCard && item.works.map((work) => <RoleMention key={work.childId} role={work.role} />)}
        <span className="role-request-text">{item.text}</span>
      </div>
      {!inCard && (
        <div className="msg-user-actions">
          <MessageTime at={item.at} />
          <CopyButton
            text={() => item.text}
            label={t('transcript.copyMessage')}
            testId="copy-message"
          />
        </div>
      )}
    </div>
  )
}

function RoleMention({ role }: { role: RoleBadge }) {
  const style = useRoleStyle(role.color)
  return (
    <span className="role-mention" style={style} data-testid="role-mention" data-role={role.name}>
      <RoleAvatar role={role} size={18} />
      {role.label}
    </span>
  )
}

const AVATAR: Record<WorkState, RoleAvatarState> = {
  running: 'running',
  waiting: 'waiting',
  replied: 'done',
  stopped: 'error',
  error: 'error',
  gone: 'idle'
}

/** L'heure qui avance pendant qu'un travail travaille (temps écoulé, délai d'un envoi). */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])
  return now
}

/** Temps écoulé « 0:42 », « 12:05 », « 1:02:09 ». */
export function elapsedText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

/** La carte-réponse d'un travail. */
export function WorkCard({
  card,
  items,
  info
}: {
  card: WorkCardData
  items: readonly TranscriptItem[]
  info: SubtasksInfo | undefined
}) {
  const child = info?.children.find((c) => c.id === card.childId)
  const attention = child ? info?.attention[child.id] : undefined
  // L'heure n'avance que pendant le travail : un état figé n'en a pas besoin.
  const [busy, setBusy] = useState(true)
  const now = useNow(busy)
  const state = workState(card, child, attention, now)
  if (busy !== (state === 'running')) setBusy(state === 'running')
  const style = useRoleStyle(card.role.color)
  const report = currentReport(card)
  return (
    <div
      className={`work-card${state === 'running' ? ' running' : ''}`}
      style={style}
      data-testid="work-card"
      data-work-anchor={card.anchor}
      data-child-id={card.childId}
      data-role={card.role.name}
      data-state={state}
    >
      <WorkHead card={card} child={child} info={info} state={state} now={now} report={report} />
      <LeftBehindLine card={card} />
      <WorkSteps card={card} items={items} state={state} />
      {(state === 'running' || state === 'waiting') && card.steps.at(-1)?.kind !== 'report' && (
        <WorkLive childId={child?.id} state={state} />
      )}
      <WorkFoot card={card} child={child} info={info} state={state} report={report} items={items} />
    </div>
  )
}

function WorkHead({
  card,
  child,
  info,
  state,
  now,
  report
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  now: number
  report: Report | undefined
}) {
  const { t } = useTranslation()
  return (
    <div className="work-head">
      <RoleAvatar role={card.role} size={24} state={AVATAR[state]} />
      <strong className="work-name">{card.role.label}</strong>
      <WorkPlace card={card} child={child} info={info} />
      <span className="grow" />
      <span className="work-state" data-testid="work-state" data-state={state}>
        {state === 'running' ? (
          <>
            <LoaderCircle size={13} className="spin" aria-hidden />
            <span
              className="work-elapsed"
              aria-label={t('workCard.elapsed', { time: elapsedText(now - exchangeStart(card)) })}
            >
              {elapsedText(now - exchangeStart(card))}
            </span>
          </>
        ) : state === 'replied' && report ? (
          t('workCard.state.replied', { time: messageTime(report.at) })
        ) : state === 'replied' ? (
          t('workCard.state.answered')
        ) : (
          t(`workCard.state.${state}`)
        )}
      </span>
    </div>
  )
}

/** Où travaille le rôle : lecture seule dans ce dossier, ou il écrit (sa branche, ce dossier). */
function WorkPlace({
  card,
  child,
  info
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
}) {
  const { t } = useTranslation()
  if (card.role.readOnly) {
    const level = child ? childReadOnly(child, info?.profiles ?? []) : 'enforced'
    const requested = level === 'requested'
    const tag = (
      <span
        className="work-place"
        data-testid="work-place"
        data-level={level}
        tabIndex={requested ? 0 : undefined}
      >
        {requested ? <EyeOff size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
        {t(requested ? 'workCard.readOnlyRequested' : 'workCard.readOnly')}
      </span>
    )
    return requested ? <Tip label={t('workCard.readOnlyRequestedHint')}>{tag}</Tip> : tag
  }
  const branch = child?.branch ?? card.started?.branch
  return (
    <span
      className="work-place"
      data-testid="work-place"
      data-writes={branch ? 'branch' : 'folder'}
    >
      {branch ? <GitBranch size={12} aria-hidden /> : <Pencil size={12} aria-hidden />}
      {t(branch ? 'workCard.inBranch' : 'workCard.inFolder')}
    </span>
  )
}

/** Rôle qui écrit parti sans le non commité de la mère (fiche 240) : rappelé sous l'en-tête. */
function LeftBehindLine({ card }: { card: WorkCardData }) {
  const left = card.started?.leftBehind
  if (!left) return null
  return (
    <div className="work-left-behind" data-testid="work-left-behind">
      <TriangleAlert size={13} aria-hidden />
      <span>
        <Trans
          i18nKey="children.leftBehind.line"
          values={{ ...left }}
          components={{ code: <code /> }}
        />
      </span>
    </div>
  )
}

/** Réponses et suites du travail, dans l'ordre ; la dernière réponse seule est dépliable en grand. */
function WorkSteps({
  card,
  items,
  state
}: {
  card: WorkCardData
  items: readonly TranscriptItem[]
  state: WorkState
}) {
  return (
    <>
      {card.steps.map((step) =>
        step.kind === 'ask' ? (
          <RoleRequestBubble key={step.item.id} item={step.item} inCard />
        ) : (
          <WorkAnswer
            key={step.item.id}
            report={step.item}
            relayed={relayOf(step.item, items)?.sent === true}
            writes={!card.role.readOnly}
            state={state}
          />
        )
      )}
    </>
  )
}

/** Ce que fait le travail en ce moment : l'outil en cours et les derniers faits. */
function WorkLive({ childId, state }: { childId: string | undefined; state: WorkState }) {
  const { t } = useTranslation()
  const activity = useWorkActivity(state === 'running' ? childId : undefined)
  if (state === 'waiting') {
    return (
      <div className="work-live" data-testid="work-live">
        {t('workCard.waitingLine')}
      </div>
    )
  }
  if (!activity.current && activity.done.length === 0) return null
  return (
    <div className="work-activity" data-testid="work-live">
      {activity.current && (
        <div className="work-live" data-testid="work-live-current">
          <span>{activity.current}…</span>
        </div>
      )}
      {activity.done.length > 0 && (
        <ul className="work-facts-done" data-testid="work-live-done">
          {activity.done.map((fact) => (
            <li key={fact}>
              <Check size={12} aria-hidden />
              {fact}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Une réponse du travail : entière, en Markdown, repliée après une dizaine de lignes (« Lire la
 * suite ») ; plus courte une fois transmise à l'agent de la mère (maquette A, état 3).
 */
function WorkAnswer({
  report,
  relayed,
  writes,
  state
}: {
  report: Report
  relayed: boolean
  writes: boolean
  state: WorkState
}) {
  const { t } = useTranslation()
  const text = answerText(report)
  return (
    <div className="work-answer" data-testid="work-answer" data-outcome={report.outcome}>
      {report.outcome === 'error' ? (
        <div className="work-error" data-testid="work-error">
          {text}
        </div>
      ) : text ? (
        <FoldedAnswer text={text} relayed={relayed} />
      ) : (
        <div className="work-note">{t('workCard.noReply')}</div>
      )}
      {report.replyCut && (
        <div className="work-note" data-testid="work-cut">
          {t('workCard.cut', {
            shown: (report.reply?.length ?? 0).toLocaleString(),
            total: (report.replyChars ?? 0).toLocaleString()
          })}
        </div>
      )}
      {report.outcome === 'stopped' && <div className="work-note">{t('workCard.stoppedLine')}</div>}
      {writes && state !== 'running' && (report.branch || report.fileCount > 0) && (
        <div className="work-changes" data-testid="work-changes">
          {report.branch && <Branch name={report.branch} />}
          <FileStats report={report} />
        </div>
      )}
    </div>
  )
}

function FoldedAnswer({ text, relayed }: { text: string; relayed: boolean }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  // Replié : le bouton n'est là que si la hauteur bornée coupe vraiment quelque chose.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || open) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, relayed, open])
  return (
    <>
      <div
        ref={ref}
        className={`work-body${open ? '' : ' folded'}${relayed ? ' relayed' : ''}`}
        data-testid="work-body"
        data-folded={(!open && overflows) || undefined}
      >
        <Markdown text={text} />
      </div>
      {(overflows || open) && (
        <button
          type="button"
          className="btn ghost small work-more"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          data-testid="work-more"
        >
          {t(open ? 'workCard.collapse' : 'workCard.readMore')}
        </button>
      )}
    </>
  )
}

/** Pied : durée et coût, actions, puis la ligne de transmission à l'agent de la mère. */
function WorkFoot({
  card,
  child,
  info,
  state,
  report,
  items
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: Report | undefined
  items: readonly TranscriptItem[]
}) {
  const { t } = useTranslation()
  const relay = relayOf(report, items)
  const agent = info?.agentLabel ?? t('workCard.mainAgent')
  // Agir sur le travail : sa conversation existe encore, rattachée à celle-ci.
  const live = !!info && !!child && !child.archived
  const warn = (error: unknown) => info?.onWarn?.(ipcErrorText(error))
  return (
    <>
      {(state === 'replied' || state === 'stopped' || state === 'error') && (
        <div className="work-foot">
          <WorkFacts card={card} child={child} report={report} />
          <span className="grow" />
          <WorkActions
            card={card}
            child={child}
            info={info}
            state={state}
            report={report}
            pending={relay?.sent === false}
            agent={agent}
            live={live}
            warn={warn}
          />
        </div>
      )}
      {live && (
        <div className="work-foot work-links">
          <span className="grow" />
          {state === 'running' && (
            <button
              type="button"
              className="btn ghost small"
              title={t('workCard.stopLabel')}
              onClick={() => window.api.agent.cancel(card.childId).catch(warn)}
              data-testid="work-stop"
            >
              {t('workCard.stop')}
            </button>
          )}
          <button
            type="button"
            className="link-button work-open"
            onClick={() => info?.onOpen(card.childId)}
            data-testid="work-open"
          >
            {t('workCard.open')}
          </button>
        </div>
      )}
      {relay && (
        <div
          className={`work-relay${relay.sent ? ' sent' : ''}`}
          data-testid="work-relay"
          data-sent={relay.sent}
        >
          {relay.sent ? <Check size={13} aria-hidden /> : <span className="work-dot" aria-hidden />}
          {relay.sent
            ? relay.at
              ? t('workCard.relayDoneAt', { agent, time: messageTime(relay.at) })
              : t('workCard.relayDone', { agent })
            : t('workCard.relayPending', { agent })}
        </div>
      )}
    </>
  )
}

/** « 1 min 38 s · gratuit » : durée de l'échange en cours et ce qu'a coûté le travail. */
function WorkFacts({
  card,
  child,
  report
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  report: Report | undefined
}) {
  const { t } = useTranslation()
  const usageText = useUsageText()
  // Mode présentation (fiche 159) : aucun montant, pas même « gratuit ».
  const presenting = usePresentation()
  if (!report) return null
  const usage = workUsage(report, child)
  const facts = [
    turnDuration(Math.max(0, report.at - exchangeStart(card))),
    usage?.cost?.amount === 0 && !presenting ? t('workCard.free') : usageText(usage)
  ].filter(Boolean)
  return (
    <span className="work-facts" data-testid="work-facts">
      {facts.join(' · ')}
    </span>
  )
}

/**
 * Actions d'un travail qui a répondu, s'est arrêté ou a échoué : l'appliquer (rôle de conseil,
 * réponse pas encore transmise), voir ses modifications (rôle qui écrit), relancer, répondre.
 */
function WorkActions({
  card,
  child,
  info,
  state,
  report,
  pending,
  agent,
  live,
  warn
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: Report | undefined
  pending: boolean
  agent: string
  live: boolean
  warn: (error: unknown) => void
}) {
  const { t } = useTranslation()
  const onAsk = info?.onAsk
  const applies =
    state === 'replied' &&
    report?.outcome === 'done' &&
    card.role.readOnly &&
    pending &&
    !!answerText(report).trim()
  const lastAsk = card.steps.findLast((s) => s.kind === 'ask')
  const askText = lastAsk?.kind === 'ask' ? lastAsk.item.text : card.request.text
  const motherId = info?.motherId
  const openGit = info?.merge?.openGit
  return (
    <>
      {applies && onAsk && (
        <button
          type="button"
          className="btn primary small"
          onClick={() => onAsk(t('workCard.applyMessage', { role: card.role.label }))}
          data-testid="work-apply"
        >
          <Send size={13} aria-hidden />
          {t('workCard.apply', { agent })}
        </button>
      )}
      {/* Rôle qui écrit : « Faire relire » et « Fusionner dans main » viendront ici (fiche 264). */}
      {live && !card.role.readOnly && child?.branch && openGit && (
        <button
          type="button"
          className="btn small"
          onClick={() => openGit(card.childId)}
          data-testid="work-changes-open"
        >
          {t('workCard.changes')}
        </button>
      )}
      {live && motherId && (state === 'stopped' || state === 'error') && (
        <button
          type="button"
          className="btn small"
          title={t('workCard.retryLabel', { role: card.role.label })}
          onClick={() =>
            window.api.roles.reply(motherId, { childId: card.childId, text: askText }).catch(warn)
          }
          data-testid="work-retry"
        >
          {t('workCard.retry')}
        </button>
      )}
      {live && (
        <button
          type="button"
          className="btn small"
          onClick={() => invokeRole(card.role.name, { replyTo: card.childId })}
          data-testid="work-reply"
        >
          <Reply size={13} aria-hidden />
          {t('workCard.reply', { role: card.role.label })}
        </button>
      )}
    </>
  )
}
