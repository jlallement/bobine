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
  CircleSlash,
  CircleX,
  LoaderCircle,
  ShieldAlert,
  SquareArrowOutUpRight,
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
import {
  rebuttalSummary,
  reportText,
  seatElapsed,
  seatLabel,
  withoutShortAnswer
} from '../roundtable/roundtable-view'
import { Tip } from '../common/Menus'
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
  /** Un geste de cette ligne est parti : ses boutons attendent la réponse du main. */
  busy?: boolean
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
      // Arrêté : un cercle barré, jamais une case à cocher (B3).
      <CircleSlash {...props} />
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
      {seatLabel(seat)}
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
    // Modèle absent du catalogue : il n'est pas proposé ; refusé ou changé en cours de tour : non
    // appliqué, dit comme une erreur.
    if (seat.error === 'model-not-found')
      return t('roundtable.state.modelNotOffered', { agent: seat.agentLabel })
    // Une raison courte et traduite selon le genre d'erreur ; le texte brut de l'agent reste en
    // infobulle (`title` de la ligne).
    const reason = t(REASON_KEYS[seat.error ?? 'agent-error'])
    const ms = seatElapsed(seat, now)
    // « au bout de » seulement quand la durée dit quelque chose (5 s et plus, B1).
    return ms !== undefined && ms >= 5000
      ? t('roundtable.state.noOpinionAfter', { reason, duration: elapsedText(ms) })
      : t('roundtable.state.noOpinionBecause', { reason })
  }
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
  // La lecture seule est dite une fois, au pied de la carte (A3) ; le dossier modifié a sa ligne.
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
  actions,
  shield = false
}: {
  seat: RoundtableSeat
  /** Les participants n'ont pas tous la même lecture seule : le bouclier de chacun (A3). */
  shield?: boolean
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
  const running = seat.state === 'working' || seat.state === 'waiting'
  const now = useNow(running)
  const trouble = useSeatTrouble()(seat, now)
  const text = report ? reportText(report) : undefined
  const digest = seat.state === 'answered' && text ? opinionDigest(text) : undefined
  const elapsed = seatElapsed(seat, now)
  const expandable = !!text && seat.state === 'answered'
  const meta = seatMeta(seat, { running, activity, child, trouble, digest })
  const side = seatSide(seat, { running, collecting, digest, elapsed, actions })
  return (
    <RoundtableRowFrame
      seat={seat}
      testId="roundtable-row"
      state={seat.state}
      running={running}
      open={open && expandable}
      expandable={expandable}
      onToggle={onToggle}
      // Pendant le recueil, un avis rendu garde sa coche ; ensuite, le chevron du dépliage.
      lead={collecting || !expandable ? <StateIcon state={iconOf(seat)} /> : undefined}
      meta={meta.length > 0 ? <Dotted parts={meta} /> : undefined}
      wrap={!!trouble}
      {...(seat.state === 'error' && seat.detail ? { detail: seat.detail } : {})}
      mark={seat.changedFolder}
      side={
        <>
          {side.length > 0 && <Dotted parts={side} />}
          {shield && <ReadOnlyMark seat={seat} />}
          <RowButtons seat={seat} actions={actions} />
        </>
      }
      // La réponse courte a servi au résumé de la ligne : pas répétée dans l'avis déplié (B9).
      body={
        text && (
          <OpenAnswer
            text={digest?.short ? withoutShortAnswer(text) : text}
            onOpen={actions.open}
          />
        )
      }
    />
  )
}

/** L'avis (la réplique) déplié : en Markdown, replié après dix lignes, et sa conversation. */
function OpenAnswer({ text, onOpen }: { text: string; onOpen: (() => void) | undefined }) {
  const { t } = useTranslation()
  return (
    <>
      <FoldedAnswer text={text} relayed={false} />
      {onOpen && (
        <div className="roundtable-open-links">
          <button
            type="button"
            className="link-button"
            onClick={onOpen}
            data-testid="roundtable-open"
          >
            {t('roundtable.card.open')}
          </button>
        </div>
      )}
    </>
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
    <Tip label={label}>
      <span
        className="roundtable-readonly"
        role="img"
        aria-label={label}
        // Focalisable : le niveau se lit au clavier (A3).
        tabIndex={0}
        data-level={level}
        data-testid="roundtable-readonly"
      >
        <Icon size={13} aria-hidden />
      </span>
    </Tip>
  )
}

function RowButtons({ seat, actions }: { seat: RoundtableSeat; actions: RowActions }) {
  const { t } = useTranslation()
  return (
    <>
      {/* Sa conversation, quel que soit son état (au travail, en erreur, retenue…). */}
      {actions.open && (
        <button
          type="button"
          className="icon-button small"
          aria-label={t('roundtable.card.open')}
          title={t('roundtable.card.open')}
          onClick={actions.open}
          data-testid="roundtable-open-row"
        >
          <SquareArrowOutUpRight size={12} aria-hidden />
        </button>
      )}
      {actions.stop && (
        <Tip label={t('roundtable.card.stopSeat', { name: seatLabel(seat) })}>
          <button
            type="button"
            className="icon-button roundtable-stop-seat"
            aria-label={t('roundtable.card.stopSeat', { name: seatLabel(seat) })}
            onClick={actions.stop}
            disabled={actions.busy}
            data-testid="roundtable-stop-seat"
          >
            <Square size={11} aria-hidden />
          </button>
        </Tip>
      )}
      {actions.otherModel ? (
        <button
          type="button"
          className="btn small ghost"
          onClick={actions.otherModel}
          data-testid="roundtable-other-model"
        >
          {t('roundtable.card.otherModel')}
        </button>
      ) : (
        actions.relaunch && (
          <button
            type="button"
            className="btn small ghost"
            onClick={actions.relaunch}
            disabled={actions.busy}
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
              reason: t(REASON_KEYS[rebuttal.error ?? 'agent-error'])
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
      testId="roundtable-rebuttal-row"
      state={rebuttal.state}
      running={running}
      open={open && done}
      expandable={done}
      onToggle={onToggle}
      lead={done ? undefined : <StateIcon state={iconOf(asRow)} />}
      meta={
        running && activity ? (
          <RowActivity activity={activity} workspace={child?.workspace} />
        ) : (
          meta || undefined
        )
      }
      // Le dossier a changé pendant la réplique (celle de l'avis est sur la carte des avis).
      mark={rebuttal.changedFolder}
      wrap={false}
      side={rebuttal.stance ? t(STANCE_KEYS[rebuttal.stance]) : undefined}
      body={done && text && <OpenAnswer text={text} onOpen={onOpen} />}
    />
  )
}

/**
 * Cadre commun des lignes (avis et réplique) : cousin de la ligne lancée d'une carte de groupe.
 * Dépliable sur la réponse quand elle est là ; le nom et la méta font le nom accessible du bouton.
 */
function RoundtableRowFrame({
  seat,
  testId,
  state,
  running,
  open,
  expandable,
  onToggle,
  lead,
  meta,
  wrap,
  detail,
  mark,
  side,
  body
}: {
  seat: RoundtableSeat
  testId: string
  state: string
  running: boolean
  open: boolean
  expandable: boolean
  onToggle: () => void
  /** Icône d'état ; absente, le chevron du dépliage. */
  lead: ReactNode
  meta: ReactNode
  /** La méta est une raison : elle passe à la ligne plutôt que d'être coupée. */
  wrap: boolean
  /** Texte brut d'une erreur, en infobulle de la méta (la ligne dit la raison traduite). */
  detail?: string
  /** Le dossier a changé pendant ce tour : une ligne à elle, jamais coupée (B14). */
  mark?: boolean | undefined
  side: ReactNode
  body: ReactNode
}) {
  const name = (
    <span className="work-group-text">
      <SeatName seat={seat} />
      {meta && (
        <span
          className="work-group-meta"
          data-testid="roundtable-row-meta"
          {...(wrap ? { 'data-wrap': '' } : {})}
          {...(detail ? { title: detail } : {})}
        >
          {meta}
        </span>
      )}
      {mark && (
        <span className="roundtable-row-mark" data-testid="roundtable-changed">
          <TriangleAlert size={12} aria-hidden /> {i18next.t('roundtable.state.changedFolder')}
        </span>
      )}
    </span>
  )
  const chevron = open ? (
    <ChevronDown size={14} aria-hidden />
  ) : (
    <ChevronRight size={14} aria-hidden />
  )
  return (
    <div
      className={`work-group-item roundtable-row${open ? ' open' : ''}`}
      data-testid={testId}
      data-letter={seat.letter}
      data-state={state}
      // Pointeur sur la ligne : la dépliée reste sous lui (fiches 124, 266).
      data-scroll-hold=""
      aria-busy={running || undefined}
    >
      <div className="work-group-row">
        {expandable ? (
          <button
            type="button"
            className="work-group-toggle"
            aria-expanded={open}
            onClick={onToggle}
            data-testid="roundtable-row-toggle"
          >
            {lead ?? chevron}
            {name}
          </button>
        ) : (
          <span className="work-group-toggle">
            {lead}
            {name}
          </span>
        )}
        <span className="roundtable-row-side" data-testid="roundtable-row-side">
          {side}
        </span>
      </div>
      {open && body && (
        <div className="work-group-open roundtable-row-open" data-testid="roundtable-row-open">
          {body}
        </div>
      )}
    </div>
  )
}
