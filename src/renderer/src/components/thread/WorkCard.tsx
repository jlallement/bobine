import {
  Activity,
  Check,
  Eye,
  Hand,
  EyeOff,
  GitBranch,
  LoaderCircle,
  Pencil,
  TriangleAlert
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { RoleRequestItem, WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import { messageTime } from '../../time'
import { CopyButton } from '../common/CopyButton'
import { Tip } from '../common/Menus'
import { RoleAvatar, useRoleStyle, type RoleAvatarState } from '../roles/RoleAvatar'
import { childReadOnly } from '../roles/RoleWork'
import { useWorkActivity, type WorkTool } from '../roles/useWorkActivity'
import { RoleMention, WorkSteps } from './WorkAnswer'
import { WorkFoot } from './WorkFoot'
import i18next from 'i18next'
import { MessageTime } from './MessageTime'
import type { SubtasksInfo } from './Subtasks'
import { currentReport, exchangeStart, workState, type WorkState } from './work-card'
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
  // La bulle et ses cartes forment une paire : un même groupe, un écart plus serré que le fil.
  return (
    <div className="role-request-group" data-testid="role-request-group">
      <RoleRequestBubble item={item} />
      {cards?.map((card) => (
        <WorkCard key={card.childId} card={card} items={items} info={info} />
      ))}
    </div>
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
        {item.works.map((work) => (
          <RoleMention key={work.childId} role={work.role} />
        ))}
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

const AVATAR: Record<WorkState, RoleAvatarState> = {
  running: 'running',
  waiting: 'waiting',
  replied: 'done',
  pending: 'done',
  silent: 'idle',
  unknown: 'idle',
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
  const { t } = useTranslation()
  const child = info?.children.find((c) => c.id === card.childId)
  const attention = child ? info?.attention[child.id] : undefined
  // L'heure n'avance que pendant le travail : un état figé n'en a pas besoin.
  const [busy, setBusy] = useState(true)
  const now = useNow(busy)
  const state = workState(card, child, attention, now, {
    known: !!info,
    ...(info?.motherBusy ? { motherBusy: true } : {})
  })
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
      <WorkSteps card={card} child={child} items={items} state={state} />
      {(state === 'running' || state === 'waiting') && card.steps.at(-1)?.kind !== 'report' && (
        <WorkLive childId={child?.id} state={state} />
      )}
      {(state === 'pending' || state === 'silent') && (
        <div
          className="work-live work-waiting-answer"
          data-testid="work-no-answer"
          data-state={state}
        >
          {state === 'pending'
            ? t('workCard.pendingLine', { agent: info?.agentLabel ?? t('workCard.mainAgent') })
            : t('workCard.silentLine')}
        </div>
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
        ) : state === 'replied' || state === 'pending' ? (
          t('workCard.state.answered')
        ) : state === 'unknown' ? null : (
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
  // Sans sa conversation (fil côte à côte, travail supprimé) : rien plutôt qu'une supposition.
  if (!child) return null
  if (card.role.readOnly) {
    const level = childReadOnly(child, info?.profiles ?? [])
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
  const branch = child.branch ?? card.started?.branch
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

/** Ce que fait le travail en ce moment : l'outil en cours et les derniers faits, au passé. */
function WorkLive({ childId, state }: { childId: string | undefined; state: WorkState }) {
  const { t } = useTranslation()
  const activity = useWorkActivity(state === 'running' ? childId : undefined)
  if (state === 'waiting') {
    return (
      <div className="work-live" data-testid="work-live">
        <Hand size={13} aria-hidden />
        {t('workCard.waitingLine')}
      </div>
    )
  }
  return (
    <div className="work-activity" data-testid="work-live">
      {activity.done.length > 0 && (
        <ul className="work-facts-done" data-testid="work-live-done">
          {activity.done.map((fact) => (
            <li key={fact.title}>
              <Check size={12} aria-hidden />
              {factText(fact, true)}
            </li>
          ))}
        </ul>
      )}
      <div className="work-live" data-testid="work-live-current">
        <Activity size={13} aria-hidden />
        <span>{activity.current ? factText(activity.current, false) : t('workCard.working')}</span>
      </div>
    </div>
  )
}

const FACT_KINDS = ['read', 'edit', 'search', 'execute', 'fetch'] as const
type FactKind = (typeof FACT_KINDS)[number]

/**
 * Un outil en mots, au passé une fois fini (« A lu src/style.css »), au présent en cours (« Lit
 * src/style.css… ») : d'après son genre ACP et ce qu'il vise ; sinon son titre, tel que l'agent
 * le donne.
 */
function factText(tool: WorkTool, done: boolean): string {
  const kind = FACT_KINDS.find((k) => k === tool.kind)
  const target = kind === 'read' || kind === 'edit' ? shortPath(tool.path) : undefined
  if (!kind || ((kind === 'read' || kind === 'edit') && !target)) {
    return done ? tool.title : i18next.t('workCard.nowOther', { target: tool.title })
  }
  const name = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}` as Capitalize<FactKind>
  return i18next.t(done ? `workCard.fact${name}` : `workCard.now${name}`, {
    target: target ?? tool.title
  })
}

/** Chemin court : relatif tel quel, absolu réduit à ses deux derniers éléments. */
function shortPath(path: string | undefined): string | undefined {
  if (!path) return undefined
  if (!path.startsWith('/')) return path
  return path.split('/').filter(Boolean).slice(-2).join('/')
}
