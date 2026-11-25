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
  ShieldCheck,
  Square,
  TriangleAlert
} from 'lucide-react'
import i18next from 'i18next'
import { createContext, useContext, type ReactNode } from 'react'
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
  withoutShortAnswer,
  type SeatPresence
} from '../roundtable/roundtable-view'
import { Tip } from '../common/Menus'
import { Markdown } from './Markdown'
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

/**
 * La synthèse existe : chaque ligne montre sa lettre (« A »), pour faire le lien avec la synthèse
 * même quand le modèle écrit la lettre seule (recette du 2026-11-25, S3).
 */
export const SeatLetters = createContext(false)

/**
 * Agents qui se choisissent un modèle (`childModel`) : un participant sans modèle retenu y est
 * « <agent> · modèle par défaut », comme dans le menu (contre-recette N2).
 */
export const ModelChoiceAgents = createContext<ReadonlySet<string>>(new Set())

export const modelChoiceAgents = (
  info: { profiles?: readonly { id: string; childModel?: boolean }[] } | undefined
): ReadonlySet<string> =>
  new Set((info?.profiles ?? []).filter((p) => p.childModel).map((p) => p.id))

/** Nom du participant, et son agent en gris quand il diffère (« GLM 5.3 Flash · OpenCode »). */
function SeatName({
  seat
}: {
  seat: Pick<RoundtableSeat, 'label' | 'agentLabel' | 'letter' | 'model' | 'profileId'>
}) {
  const lettered = useContext(SeatLetters)
  const choosing = useContext(ModelChoiceAgents)
  const byDefault = !seat.model && choosing.has(seat.profileId)
  return (
    <span className="roundtable-row-title">
      {lettered && (
        <span
          className="roundtable-seat-letter"
          role="img"
          aria-label={i18next.t('roundtable.card.letter', { letter: seat.letter })}
          data-testid="roundtable-seat-letter"
        >
          {seat.letter}
        </span>
      )}
      <span className="work-group-name" data-testid="roundtable-row-name">
        {byDefault
          ? i18next.t('roundtable.menu.defaultModel', { agent: seatLabel(seat) })
          : seatLabel(seat)}
        {seat.agentLabel !== seat.label && !byDefault && (
          <span className="work-group-sub"> · {seat.agentLabel}</span>
        )}
      </span>
    </span>
  )
}

/** Pourquoi un participant n'a pas d'avis : la raison en clair (celle de l'agent d'abord). */
function useSeatTrouble() {
  const { t } = useTranslation()
  return (seat: RoundtableSeat, now: number, presence: SeatPresence): string | undefined => {
    // Conversation à la corbeille ou supprimée (lue de son existence, S1/S2 ; `removed` : élément
    // écrit par une version précédente) ; restaurée, la ligne redevient ce qu'elle était.
    if (presence === 'trash') return t('roundtable.state.trashed')
    if (presence === 'gone' || (seat.removed && presence !== 'here'))
      return t('roundtable.state.removed')
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
  if (c.running && seat.held && !c.trouble) {
    // Question retenue par le plafond de sa conversation : « Continuer » se donne là-bas.
    meta.push(t('roundtable.state.held'))
  } else if (c.running && !c.trouble) {
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
  if (seat.state === 'answered') {
    if (c.collecting)
      side.push(
        <span className="roundtable-answered">
          {t('roundtable.state.answered')}
          {duration && <span className="roundtable-duration"> · {duration}</span>}
        </span>
      )
    // Format non suivi (sans réponse courte lue, recette C3) : dit d'abord, la confiance seule
    // ne suffit pas à résumer l'avis.
    else if (c.digest && !c.digest.followed)
      side.push(
        <span className="roundtable-format" data-testid="roundtable-format">
          {t('roundtable.formatNotFollowed')}
        </span>
      )
    else if (c.digest?.confidence) side.push(t(CONFIDENCE_KEYS[c.digest.confidence]))
  }
  // La durée en cours ; masquée en carte étroite (rien n'est coupé au milieu d'un mot, M1).
  if (c.running && duration) side.push(<span className="roundtable-duration">{duration}</span>)
  // « sans avis » n'est pas répété à droite : la sous-ligne le dit déjà (simplification 3).
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
  shield = false,
  presence = 'here'
}: {
  seat: RoundtableSeat
  /** Où est sa conversation (S1, S2) : à la corbeille ou supprimée, l'avis reste lisible. */
  presence?: SeatPresence
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
  const trouble = useSeatTrouble()(seat, now, presence)
  const text = report ? reportText(report) : undefined
  const digest = seat.state === 'answered' && text ? opinionDigest(text) : undefined
  const elapsed = seatElapsed(seat, now)
  // Toute ligne se déplie (simplification 2) : l'avis entier, ou le détail d'une erreur ou d'un
  // arrêt, et « Ouvrir sa conversation », seul accès à la conversation du participant.
  const expandable = (!!text && seat.state === 'answered') || !!actions.open || !!trouble
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
      lead={
        collecting || seat.state !== 'answered' ? <StateIcon state={iconOf(seat)} /> : undefined
      }
      meta={meta.length > 0 ? <Dotted parts={meta} /> : undefined}
      wrap={!!trouble}
      fullText={trouble}
      {...(seat.state === 'error' && seat.detail ? { detail: seat.detail } : {})}
      mark={seat.changedFolder}
      side={
        <>
          {side.length > 0 && <Dotted parts={side} />}
          {shield && presence === 'here' && <ReadOnlyMark seat={seat} />}
          <RowButtons seat={seat} actions={actions} />
        </>
      }
      // La réponse courte a servi au résumé de la ligne : pas répétée dans l'avis déplié (B9).
      body={
        <OpenAnswer
          text={
            seat.state === 'answered' && text
              ? digest?.short
                ? withoutShortAnswer(text)
                : text
              : undefined
          }
          detail={
            seat.state === 'answered'
              ? undefined
              : [trouble, seat.detail].filter(Boolean).join('\n')
          }
          onOpen={actions.open}
        />
      }
    />
  )
}

/** L'avis (la réplique) déplié : en entier (simplification 6), ou le détail, et sa conversation. */
function OpenAnswer({
  text,
  detail,
  onOpen
}: {
  text: string | undefined
  detail?: string | undefined
  onOpen: (() => void) | undefined
}) {
  const { t } = useTranslation()
  return (
    <>
      {text && (
        <div className="work-body" data-testid="work-body">
          <Markdown text={text} />
        </div>
      )}
      {!text && detail && (
        <p className="roundtable-row-detail" data-testid="roundtable-row-detail">
          {detail}
        </p>
      )}
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
  if (!level) return null
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
      {actions.relaunch && (
        <button
          type="button"
          className="btn small ghost"
          onClick={actions.relaunch}
          disabled={actions.busy}
          data-testid="roundtable-relaunch"
        >
          {t('roundtable.card.relaunch')}
        </button>
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
    : rebuttal.state === 'waiting'
      ? // Pas encore partie : le participant finit ce qu'il faisait (elle part à son repos).
        t('roundtable.rebuttal.waiting')
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
        running && activity && rebuttal.state !== 'waiting' ? (
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
  fullText,
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
  /** La méta est une raison : son texte entier en infobulle (la ligne garde sa hauteur). */
  wrap: boolean
  /** Texte entier de la méta, en infobulle quand elle est coupée. */
  fullText?: string | undefined
  /** Texte brut d'une erreur, en infobulle de la méta (la ligne dit la raison traduite). */
  detail?: string
  /** Le dossier a changé pendant ce tour : une ligne à elle, jamais coupée (B14). */
  mark?: boolean | undefined
  side: ReactNode
  body: ReactNode
}) {
  const title = [wrap ? fullText : undefined, detail].filter(Boolean).join('\n')
  // Hauteur de ligne constante (aucune ligne ne pousse les suivantes quand un participant change
  // d'état) : le nom, puis une seconde ligne toujours là, coupée au besoin, son texte entier en
  // infobulle. La marque du dossier et les gestes vont dans la colonne de droite.
  const name = (
    <span className="work-group-text">
      <SeatName seat={seat} />
      {meta ? (
        <span
          className="work-group-meta"
          data-testid="roundtable-row-meta"
          {...(title ? { title } : {})}
        >
          {meta}
        </span>
      ) : (
        <span className="work-group-meta" aria-hidden>
          {'\u00a0'}
        </span>
      )}
    </span>
  )
  const changed = i18next.t('roundtable.state.changedFolder')
  const marked = mark && (
    <span
      className="roundtable-row-mark"
      role="img"
      aria-label={changed}
      title={changed}
      data-testid="roundtable-changed"
    >
      <TriangleAlert size={12} aria-hidden /> {i18next.t('roundtable.state.changedFolderShort')}
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
          {marked}
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
