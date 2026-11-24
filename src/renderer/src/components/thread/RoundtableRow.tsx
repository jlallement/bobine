/**
 * Ligne d'un participant dans la carte du tour de table (fiche 285, maquettes `carte-en-cours`,
 * `avis-liste`, `degrade-*`, `replique`) : la cousine de la ligne lancée d'une carte de groupe
 * (`WorkGroupRow`), mêmes classes et mêmes morceaux (activité en direct, durée, avis déplié par la
 * carte-réponse). Une ligne = qui, et où il en est : nom du modèle et de l'agent, état, ce qu'il
 * fait, durée ; une fois l'avis rendu, sa réponse courte et sa confiance, en mots.
 */
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  Square,
  TriangleAlert
} from 'lucide-react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import {
  opinionDigest,
  type OpinionDigest,
  type RoundtableConfidence
} from '@shared/roundtable-prompts'
import type {
  RoundtableReadOnly,
  RoundtableRebuttal,
  RoundtableSeat,
  RoundtableSeatError,
  RoundtableStance,
  RoundtableStopReason
} from '@shared/roundtable'
import type { ChildTool } from '../roles/RoleWork'
import { rebuttalSummary, reportText, seatElapsed } from '../roundtable/roundtable-view'
import { FoldedAnswer } from './WorkAnswer'
import { RowActivity } from './WorkGroupRow'
import { elapsedText, useNow } from './WorkCard'

type Report = Parameters<typeof reportText>[0]

/** Icône d'état : coche, roue, croix, alerte (modèle refusé), carré (arrêté). */
type IconState = 'answered' | 'working' | 'waiting' | 'error' | 'warning' | 'stopped'

const MODEL_ERRORS = new Set(['model-not-found', 'model-not-applied'])

const REASON_KEYS = {
  'model-not-found': 'roundtable.state.reason.model-not-found',
  'model-not-applied': 'roundtable.state.reason.model-not-applied',
  'agent-error': 'roundtable.state.reason.agent-error',
  'start-failed': 'roundtable.state.reason.start-failed',
  unavailable: 'roundtable.state.reason.unavailable'
} as const satisfies Record<RoundtableSeatError, string>

const STOP_KEYS = {
  user: 'roundtable.state.stopped.user',
  'early-synthesis': 'roundtable.state.stopped.early-synthesis',
  'roundtable-stopped': 'roundtable.state.stopped.roundtable-stopped',
  'cost-cap': 'roundtable.state.stopped.cost-cap',
  restart: 'roundtable.state.stopped.restart',
  removed: 'roundtable.state.stopped.removed'
} as const satisfies Record<RoundtableStopReason, string>

const READ_ONLY_KEYS = {
  enforced: 'roundtable.state.readOnly.enforced',
  native: 'roundtable.state.readOnly.native',
  requested: 'roundtable.state.readOnly.requested',
  unverified: 'roundtable.state.readOnly.unverified'
} as const satisfies Record<RoundtableReadOnly, string>

const CONFIDENCE_KEYS = {
  high: 'roundtable.confidence.high',
  medium: 'roundtable.confidence.medium',
  low: 'roundtable.confidence.low'
} as const satisfies Record<RoundtableConfidence, string>

const STANCE_KEYS = {
  maintains: 'roundtable.rebuttal.stance.maintains',
  nuances: 'roundtable.rebuttal.stance.nuances',
  rallies: 'roundtable.rebuttal.stance.rallies'
} as const satisfies Record<RoundtableStance, string>

/** Ce qu'une ligne propose à droite (seulement ce que la phase permet). */
export interface RowActions {
  /** « Arrêter » ce participant (au travail pendant le recueil). */
  stop?: () => void
  /** « Relancer » (sans avis, pendant le recueil ou faute d'avis). */
  relaunch?: () => void
  /** « Choisir un autre modèle » (modèle refusé) : le menu des participants. */
  otherModel?: () => void
  /** « Ouvrir sa conversation » (sous l'avis déplié). */
  open?: () => void
}

function StateIcon({ state }: { state: IconState }) {
  const props = { size: 16, 'aria-hidden': true as const }
  const icon =
    state === 'answered' ? (
      <CircleCheck {...props} />
    ) : state === 'working' || state === 'waiting' ? (
      <LoaderCircle {...props} className="spin" />
    ) : state === 'warning' ? (
      <TriangleAlert {...props} />
    ) : state === 'error' ? (
      <CircleX {...props} />
    ) : (
      <Square {...props} size={14} />
    )
  return (
    <span className="roundtable-state-icon" data-state={state}>
      {icon}
    </span>
  )
}

const iconOf = (seat: Pick<RoundtableSeat, 'state' | 'error'>): IconState =>
  seat.state === 'error' ? (MODEL_ERRORS.has(seat.error ?? '') ? 'warning' : 'error') : seat.state

/** Nom du participant, et son agent en gris quand il diffère (« GLM 5.3 Flash · OpenCode »). */
function SeatName({ seat }: { seat: Pick<RoundtableSeat, 'label' | 'agentLabel'> }) {
  return (
    <span className="work-group-name" data-testid="roundtable-row-name">
      {seat.label}
      {seat.agentLabel !== seat.label && (
        <span className="work-group-sub"> · {seat.agentLabel}</span>
      )}
    </span>
  )
}

/** Pourquoi un participant n'a pas d'avis : la raison en clair (celle de l'agent d'abord). */
function useSeatTrouble() {
  const { t } = useTranslation()
  return (seat: RoundtableSeat, now: number): string | undefined => {
    if (seat.removed) return t('roundtable.state.removed')
    if (seat.state === 'stopped' && seat.stopped) return t(STOP_KEYS[seat.stopped])
    if (seat.state !== 'error') return undefined
    if (MODEL_ERRORS.has(seat.error ?? ''))
      return t('roundtable.state.modelNotOffered', { agent: seat.agentLabel })
    const reason = seat.detail ?? t(REASON_KEYS[seat.error ?? 'agent-error'])
    const ms = seatElapsed(seat, now)
    return ms !== undefined && ms >= 1000
      ? t('roundtable.state.errorAfter', { reason, duration: elapsedText(ms) })
      : t('roundtable.state.error', { reason })
  }
}

/** Lecture seule seulement demandée, non vérifiée, ou tenue par le rôle : dite, discrètement. */
function readOnlyNote(seat: RoundtableSeat): string | undefined {
  return seat.readOnly && seat.readOnly !== 'enforced'
    ? i18next.t(READ_ONLY_KEYS[seat.readOnly])
    : undefined
}

/** Sous le nom : ce qu'il fait, ce qui l'a empêché, ou sa réponse courte ; puis les marques. */
function seatMeta(
  seat: RoundtableSeat,
  c: {
    running: boolean
    activity: ChildTool | undefined
    child: ConversationSummary | undefined
    trouble: string | undefined
    digest: OpinionDigest | undefined
  }
): ReactNode[] {
  const t = i18next.t
  const meta: ReactNode[] = []
  if (c.running) {
    meta.push(
      c.activity ? (
        <RowActivity activity={c.activity} workspace={c.child?.workspace} />
      ) : seat.state === 'waiting' ? (
        t('roundtable.state.waiting')
      ) : (
        t('roundtable.state.working')
      )
    )
  } else if (c.trouble) meta.push(c.trouble)
  else if (c.digest?.short) meta.push(c.digest.short)
  const note = readOnlyNote(seat)
  if (note && (c.running || seat.state === 'answered')) meta.push(note)
  if (seat.changedFolder) {
    meta.push(
      <span className="roundtable-row-mark" data-testid="roundtable-changed">
        <TriangleAlert size={12} aria-hidden /> {t('roundtable.state.changedFolder')}
      </span>
    )
  }
  return meta
}

/** À droite : « a répondu · 0:51 » pendant le recueil, puis la confiance ; la durée en cours. */
function seatSide(
  seat: RoundtableSeat,
  c: {
    running: boolean
    collecting: boolean
    digest: OpinionDigest | undefined
    elapsed: number | undefined
    actions: RowActions
  }
): ReactNode[] {
  const t = i18next.t
  const side: ReactNode[] = []
  const duration = c.elapsed !== undefined ? elapsedText(c.elapsed) : undefined
  if (seat.state === 'answered' && !seat.removed) {
    if (c.collecting)
      side.push(`${t('roundtable.state.answered')}${duration ? ` · ${duration}` : ''}`)
    else if (c.digest?.confidence) side.push(t(CONFIDENCE_KEYS[c.digest.confidence]))
    else if (c.digest && !c.digest.followed)
      side.push(
        <span className="roundtable-format" data-testid="roundtable-format">
          {t('roundtable.formatNotFollowed')}
        </span>
      )
  }
  if (c.running && duration) side.push(duration)
  if (!c.running && seat.state !== 'answered' && !c.collecting && !c.actions.relaunch)
    side.push(t('roundtable.state.noOpinion'))
  return side
}

/** Des morceaux séparés par « · ». */
function Dotted({ parts }: { parts: ReactNode[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden> · </span>}
          {part}
        </span>
      ))}
    </>
  )
}

/** Une ligne d'un participant : son avis (ou ce qui l'en empêche), dépliable sur l'avis entier. */
export function RoundtableRow({
  seat,
  report,
  child,
  activity,
  collecting,
  open,
  onToggle,
  actions
}: {
  seat: RoundtableSeat
  /** Son avis, une fois rendu. */
  report: Report | undefined
  child: ConversationSummary | undefined
  activity: ChildTool | undefined
  /** Recueil en cours : « a répondu · 0:51 » ; ensuite, la confiance. */
  collecting: boolean
  open: boolean
  onToggle: () => void
  actions: RowActions
}) {
  const { t } = useTranslation()
  const running = seat.state === 'working' || seat.state === 'waiting'
  const now = useNow(running)
  const trouble = useSeatTrouble()(seat, now)
  const text = report ? reportText(report) : undefined
  const digest = seat.state === 'answered' && text ? opinionDigest(text) : undefined
  const elapsed = seatElapsed(seat, now)
  const expandable = !!text && seat.state === 'answered'
  const meta = seatMeta(seat, { running, activity, child, trouble, digest })
  const side = seatSide(seat, { running, collecting, digest, elapsed, actions })
  const name = (
    <span className="work-group-text">
      <SeatName seat={seat} />
      {meta.length > 0 && (
        <span
          className="work-group-meta"
          data-testid="roundtable-row-meta"
          {...(trouble ? { 'data-wrap': '' } : {})}
        >
          <Dotted parts={meta} />
        </span>
      )}
    </span>
  )
  return (
    <div
      className={`work-group-item roundtable-row${open ? ' open' : ''}`}
      data-testid="roundtable-row"
      data-letter={seat.letter}
      data-state={seat.state}
      data-scroll-hold=""
    >
      <div className="work-group-row">
        {expandable ? (
          <button
            type="button"
            className="work-group-toggle"
            aria-expanded={open}
            aria-label={t('roundtable.card.toggleSeat', { name: seat.label })}
            onClick={onToggle}
            data-testid="roundtable-row-toggle"
          >
            {collecting ? (
              <StateIcon state="answered" />
            ) : open ? (
              <ChevronDown size={14} aria-hidden />
            ) : (
              <ChevronRight size={14} aria-hidden />
            )}
            {name}
          </button>
        ) : (
          <span className="work-group-toggle" aria-busy={running || undefined}>
            <StateIcon state={iconOf(seat)} />
            {name}
          </span>
        )}
        <span className="roundtable-row-side" data-testid="roundtable-row-side">
          {side.length > 0 && <Dotted parts={side} />}
          <ReadOnlyMark seat={seat} />
          <RowButtons seat={seat} actions={actions} />
        </span>
      </div>
      {open && text && (
        <div className="work-group-open roundtable-row-open" data-testid="roundtable-row-open">
          <FoldedAnswer text={text} relayed={false} />
          {actions.open && (
            <div className="roundtable-open-links">
              <button
                type="button"
                className="link-button"
                onClick={actions.open}
                data-testid="roundtable-open"
              >
                {t('roundtable.card.open')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Lecture seule du participant, discrètement (décision C3) : un bouclier, plein quand elle est
 * garantie (`enforced`, `native`), barré d'un point quand elle n'est que demandée (`requested`,
 * `unverified`) ; le niveau en clair au survol et pour un lecteur d'écran.
 */
function ReadOnlyMark({ seat }: { seat: RoundtableSeat }) {
  const level = seat.readOnly
  if (!level || seat.removed) return null
  const label = i18next.t(READ_ONLY_KEYS[level])
  const Icon = level === 'enforced' || level === 'native' ? ShieldCheck : ShieldAlert
  return (
    <span
      className="roundtable-readonly"
      role="img"
      aria-label={label}
      title={label}
      data-level={level}
      data-testid="roundtable-readonly"
    >
      <Icon size={13} aria-hidden />
    </span>
  )
}

function RowButtons({ seat, actions }: { seat: RoundtableSeat; actions: RowActions }) {
  const { t } = useTranslation()
  return (
    <>
      {actions.stop && (
        <button
          type="button"
          className="icon-button small"
          aria-label={t('roundtable.card.stopSeat', { name: seat.label })}
          title={t('roundtable.card.stop')}
          onClick={actions.stop}
          data-testid="roundtable-stop-seat"
        >
          <Square size={11} aria-hidden />
        </button>
      )}
      {actions.otherModel ? (
        <button
          type="button"
          className="btn small quiet"
          onClick={actions.otherModel}
          data-testid="roundtable-other-model"
        >
          {t('roundtable.card.otherModel')}
        </button>
      ) : (
        actions.relaunch && (
          <button
            type="button"
            className="btn small quiet"
            onClick={actions.relaunch}
            data-testid="roundtable-relaunch"
          >
            {t('roundtable.card.relaunch')}
          </button>
        )
      )}
    </>
  )
}

/** Ligne d'une réplique (maquette `replique`) : ce qui a changé, et la position en mots. */
export function RebuttalRow({
  seat,
  rebuttal,
  report,
  child,
  activity,
  open,
  onToggle,
  onOpen
}: {
  seat: RoundtableSeat
  rebuttal: RoundtableRebuttal
  report: Report | undefined
  child: ConversationSummary | undefined
  activity: ChildTool | undefined
  open: boolean
  onToggle: () => void
  onOpen: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const running = rebuttal.state === 'working' || rebuttal.state === 'waiting'
  const text = report ? reportText(report) : undefined
  const done = rebuttal.state === 'answered' && !!text
  const meta = rebuttal.held
    ? t('roundtable.rebuttal.held')
    : running
      ? activity
        ? undefined
        : t('roundtable.state.working')
      : rebuttal.state === 'stopped' && rebuttal.stopped
        ? t(STOP_KEYS[rebuttal.stopped])
        : rebuttal.state === 'error'
          ? t('roundtable.state.error', {
              reason:
                rebuttal.detail ?? t(`roundtable.state.reason.${rebuttal.error ?? 'agent-error'}`)
            })
          : text && rebuttalSummary(text)
  const asRow = {
    ...seat,
    state: rebuttal.state,
    ...(rebuttal.error ? { error: rebuttal.error } : {})
  }
  return (
    <RoundtableRowFrame
      seat={seat}
      open={open && done}
      expandable={done}
      onToggle={onToggle}
      icon={<StateIcon state={iconOf(asRow)} />}
      meta={
        running && activity ? (
          <RowActivity activity={activity} workspace={child?.workspace} />
        ) : (
          meta
        )
      }
      side={rebuttal.stance ? t(STANCE_KEYS[rebuttal.stance]) : undefined}
      body={
        done && text ? (
          <>
            <FoldedAnswer text={text} relayed={false} />
            {onOpen && (
              <div className="roundtable-open-links">
                <button type="button" className="link-button" onClick={onOpen}>
                  {t('roundtable.card.open')}
                </button>
              </div>
            )}
          </>
        ) : undefined
      }
    />
  )
}

/** Cadre commun d'une ligne simple (réplique) : dépliable, une méta, un côté. */
function RoundtableRowFrame({
  seat,
  open,
  expandable,
  onToggle,
  icon,
  meta,
  side,
  body
}: {
  seat: RoundtableSeat
  open: boolean
  expandable: boolean
  onToggle: () => void
  icon: ReactNode
  meta: ReactNode
  side: ReactNode
  body: ReactNode
}) {
  const { t } = useTranslation()
  const name = (
    <span className="work-group-text">
      <SeatName seat={seat} />
      {meta && (
        <span className="work-group-meta" data-testid="roundtable-row-meta">
          {meta}
        </span>
      )}
    </span>
  )
  return (
    <div
      className={`work-group-item roundtable-row${open ? ' open' : ''}`}
      data-testid="roundtable-rebuttal-row"
      data-letter={seat.letter}
    >
      <div className="work-group-row">
        {expandable ? (
          <button
            type="button"
            className="work-group-toggle"
            aria-expanded={open}
            aria-label={t('roundtable.card.toggleSeat', { name: seat.label })}
            onClick={onToggle}
          >
            {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            {name}
          </button>
        ) : (
          <span className="work-group-toggle">
            {icon}
            {name}
          </span>
        )}
        <span className="roundtable-row-side" data-testid="roundtable-row-side">
          {side}
        </span>
      </div>
      {open && body && <div className="work-group-open roundtable-row-open">{body}</div>}
    </div>
  )
}
