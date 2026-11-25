/**
 * Carte « Tour de table » dans le fil (fiche 285, maquettes `carte-en-cours`, `avis-liste`,
 * `apres-synthese`, `degrade-*`) : à place fixe, sous la bulle de la question, cousine de la carte
 * de groupe (fiche 264). Une ligne par participant ; « Synthétiser sans attendre » dès deux avis,
 * « Arrêter » ; les lignes sans avis disent pourquoi et proposent « Relancer ». À l'arrivée de la
 * synthèse, elle se replie en une ligne (participants, « N avis ») qui la rouvre.
 *
 * L'état se lit de l'élément du tour, posé par le main (`reduceRoundtable`) ; un geste passe par
 * `window.api.roundtable`, et le main le refuse hors de sa phase.
 */
import { ChevronDown, ChevronRight, Square } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import {
  canRebut,
  canRelaunch,
  canSynthesize,
  hasQuorum,
  type Roundtable,
  roundtableTotal,
  usableSeats,
  type RoundtableLetter,
  type RoundtableSeat
} from '@shared/roundtable'
import type { RoundtableGroupData } from '@shared/work-groups'
import type { WorkCardData } from '@shared/role-request'
import { ipcErrorText } from '../../ipc-errors'
import { usePresentation } from '../../presentation'
import { Tip } from '../common/Menus'
import { useChildTools } from '../roles/RoleWork'
import { RoundtableIcon } from '../roundtable/RoundtableIcon'
import { RoundtableTag } from '../roundtable/RoundtableLine'
import { requestRoundtableMenu } from '../roundtable/roundtable-menu-request'
import {
  listText,
  type SeatPresence,
  seatLabel,
  seatPresence,
  seatReports,
  totalText
} from '../roundtable/roundtable-view'
import { useTrashedIds } from '../roundtable/useTrashedIds'
import { RoundtableRow } from './RoundtableRow'
import type { SubtasksInfo } from './Subtasks'
import { currentReport, workUsage } from './work-card'
import '../../roundtable.css'

type Gesture = 'synthesize' | 'rebuttal' | 'decide' | 'relaunch' | 'stop'

/**
 * Gestes de la carte (et de la synthèse) : chacun part au main ; son refus (phase dépassée, tour
 * inconnu, pièces jointes perdues au redémarrage…) est dit sur place, en clair. Sans conversation
 * connue (fil en lecture seule), aucun geste.
 */
export function useRoundtableGestures(info: SubtasksInfo | undefined, item: Roundtable) {
  const [refusal, setRefusal] = useState<string | undefined>()
  // Un geste à la fois par bouton : pas de second envoi sur un double clic (revue QA).
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const conversationId = info?.motherId
  // Conversation archivée : la carte se lit, aucun geste (le main les refuserait).
  if (!conversationId || info.motherArchived) return { gestures: undefined, refusal, pending }
  const { roundtableId } = item
  const run = (key: string, refused: string | undefined, call: () => Promise<unknown>) => {
    if (pending.has(key)) return
    // Hors de sa phase, le geste ne part pas : la raison est dite tout de suite.
    if (refused) return setRefusal(refused)
    setRefusal(undefined)
    setPending((p) => new Set([...p, key]))
    void call()
      .catch((error: unknown) => setRefusal(ipcErrorText(error)))
      .finally(() => setPending((p) => new Set([...p].filter((k) => k !== key))))
  }
  const api = () => window.api.roundtable
  const gestures = {
    synthesize: () =>
      run('synthesize', synthesizeRefusal(item), () =>
        api().synthesize(conversationId, roundtableId)
      ),
    rebuttal: () =>
      run('rebuttal', rebuttalRefusal(item), () => api().rebuttal(conversationId, roundtableId)),
    decide: () => run('decide', undefined, () => api().decide(conversationId, roundtableId)),
    relaunch: (letter: RoundtableLetter) =>
      run(
        `relaunch-${letter}`,
        canRelaunch(item, letter) ? undefined : i18next.t('roundtable.error.phase'),
        () => api().relaunch(conversationId, roundtableId, letter)
      ),
    stop: (letter?: RoundtableLetter) =>
      run(`stop-${letter ?? 'all'}`, undefined, () =>
        api().stop(conversationId, roundtableId, letter)
      )
  } satisfies Record<Gesture, unknown>
  return { gestures, refusal, pending }
}

/** « Synthétiser » hors de sa phase : pas assez d'avis, ou étape dépassée. */
function synthesizeRefusal(item: Roundtable): string | undefined {
  if (canSynthesize(item)) return undefined
  return i18next.t(
    hasQuorum(usableSeats(item).length) ? 'roundtable.error.phase' : 'roundtable.error.quorum'
  )
}

/** « Faire réagir » : une seule réplique par tour, et seulement après la synthèse. */
function rebuttalRefusal(item: Roundtable): string | undefined {
  if (canRebut(item)) return undefined
  return i18next.t(
    item.verdict || item.seats.some((s) => s.rebuttal)
      ? 'roundtable.error.rebuttalOnce'
      : 'roundtable.error.phase'
  )
}

/** Refus d'un geste, sur la carte : lu à voix haute, sans fenêtre. */
export function GestureRefusal({ text }: { text: string | undefined }) {
  if (!text) return null
  return (
    <div className="roundtable-refusal" role="alert" data-testid="roundtable-gesture-refusal">
      {text}
    </div>
  )
}

/** Total consommé du tour : chaque participant (sa conversation), puis la synthèse et la décision. */
export function useRoundtableTotal(group: RoundtableGroupData, info: SubtasksInfo | undefined) {
  const presenting = usePresentation()
  const { item } = group
  // Un participant encore au travail sans chiffre n'est pas « sans chiffre » : il n'a pas fini.
  const perSeat = item.seats.map((seat) => {
    const work = group.works.get(seat.letter)
    const child = info?.children.find((c) => c.id === seat.childId)
    const digest = workUsage(work ? currentReport(work) : undefined, child)
    return { seat, digest, running: seat.state === 'working' || seat.state === 'waiting' }
  })
  // `null` : encore au travail, ni chiffre ni « sans chiffre » (contrat de `roundtableTotal`, M5).
  const digests = perSeat.map((p) => (p.running && !p.digest ? null : p.digest))
  const total = roundtableTotal(digests, [item.synthesis?.usage, item.verdict?.usage])
  // Détail au survol et au focus : une ligne par participant (A6), ce qu'il a communiqué.
  const detail = perSeat
    .map(
      (p) => `${seatLabel(p.seat)} : ${(p.digest && totalText(roundtableTotal([p.digest]))) || '—'}`
    )
    .join('\n')
  // Mode présentation (fiche 159) : aucun montant.
  return presenting ? undefined : { text: totalText(total), detail }
}

/**
 * Où est la conversation de chaque participant (S1, S2) : dans la liste, à la corbeille, ou
 * supprimée. Lu de la liste des conversations, puis de la corbeille pour celles qui manquent.
 */
export function useSeatPresence(
  item: Roundtable,
  info: SubtasksInfo | undefined,
  /** Carte ouverte : la corbeille est relue à chaque réouverture (N10). */
  opened = true
): (seat: RoundtableSeat) => SeatPresence {
  const exists = info?.exists
  const missing = item.seats.flatMap((s) =>
    s.childId && exists && !exists(s.childId) ? [s.childId] : []
  )
  const trashed = useTrashedIds(missing, opened)
  return (seat) => seatPresence(seat, exists, trashed)
}

/** Bulle de la question, avec l'étiquette « Tour de table » (maquette `carte-en-cours`). */
function RoundtableBubble({ group }: { group: RoundtableGroupData }) {
  const { t } = useTranslation()
  const { item } = group
  return (
    <div className="msg-user-group" data-testid="roundtable-bubble" data-item-id={item.id}>
      <div className="msg-user roundtable-bubble">
        <RoundtableTag />
        {item.question}
        {(item.attachments?.length || item.withLastExchange) && (
          <div className="roundtable-bubble-files">
            {item.attachments?.length
              ? t('roundtable.card.attachments', { files: listText(item.attachments) })
              : null}
            {item.attachments?.length && item.withLastExchange ? ' · ' : null}
            {item.withLastExchange ? t('roundtable.card.withExchange') : null}
          </div>
        )}
      </div>
    </div>
  )
}

/** Pied « Consommé » : une ligne, le détail par participant au survol et au focus (A6). */
export function UsedLine({
  label,
  detail,
  testId = 'roundtable-used'
}: {
  label: string
  detail: string
  testId?: string
}) {
  return (
    <Tip label={detail} className="roundtable-used-tip">
      <div className="roundtable-used" tabIndex={0} data-testid={testId} aria-description={detail}>
        {label}
      </div>
    </Tip>
  )
}

/** La bulle, puis la carte, ensemble (comme une bulle « @Rôle » et sa carte). */
export function RoundtableEntry({
  group,
  info
}: {
  group: RoundtableGroupData
  info: SubtasksInfo | undefined
}) {
  return (
    <div className="roundtable-entry" data-testid="roundtable-entry">
      <RoundtableBubble group={group} />
      <RoundtableCard group={group} info={info} />
    </div>
  )
}

/**
 * Après un redémarrage, les pièces jointes d'un tour ne sont plus en mémoire : le main refuse
 * « Relancer » plutôt que de relancer sans elles (fiche 285, lot main). La carte le dit d'avance.
 */
const attachmentsLost = (item: RoundtableGroupData['item']) =>
  item.phase === 'interrupted' && !!item.attachments?.length

/**
 * La lecture seule du tour, dite une fois au pied (A3) : celle de tous les participants, sinon la
 * plus faible garantie quand elles diffèrent (le bouclier de chaque ligne détaille).
 */
function readOnlyLevel(item: RoundtableGroupData['item']): string {
  const levels = new Set(item.seats.map((s) => s.readOnly).filter(Boolean))
  const order = ['unverified', 'requested', 'native', 'enforced'] as const
  const weakest = order.find((l) => levels.has(l)) ?? 'enforced'
  return i18next.t(`roundtable.state.readOnlyShort.${weakest}`)
}

/** La synthèse est rendue (ou la réplique a commencé) : la carte se replie en une ligne. */
const settled = (phase: string) =>
  phase === 'synthesized' || phase === 'rebutting' || phase === 'deciding' || phase === 'decided'

/** « 2 avis sur 3 », « 3 avis · synthèse en cours » : ce que dit l'en-tête à droite. */
function useProgress(group: RoundtableGroupData): string {
  const { t } = useTranslation()
  const { item } = group
  const opinions = usableSeats(item).length
  const total = item.seats.length
  switch (item.phase) {
    case 'collecting':
    case 'insufficient': {
      const head = t('roundtable.card.progress', { count: opinions, total })
      // Arrêt demandé : les participants s'arrêtent d'abord, puis « arrêté ».
      return item.stopping ? `${head} · ${t('roundtable.card.stopping')}` : head
    }
    case 'synthesizing': {
      const step = item.synthesis?.state
      const key =
        step === 'held'
          ? 'roundtable.card.held'
          : step === 'waiting'
            ? 'roundtable.card.waitingAgent'
            : 'roundtable.card.synthesizing'
      return `${t('roundtable.card.opinions', { count: opinions })} · ${t(key)}`
    }
    case 'stopped':
      return t('roundtable.card.stopped')
    case 'interrupted':
      return t('roundtable.card.interrupted')
    default: {
      // Repliée : les avis reçus, et les absents s'il y en a (B15).
      const absent = total - opinions
      const head = t('roundtable.card.opinions', { count: opinions })
      return absent > 0 ? `${head} · ${t('roundtable.card.noOpinions', { count: absent })}` : head
    }
  }
}

export function RoundtableCard({
  group,
  info
}: {
  group: RoundtableGroupData
  info: SubtasksInfo | undefined
}) {
  const { t } = useTranslation()
  const { item } = group
  const folded = settled(item.phase)
  // Repliée d'office après la synthèse ; un clic la rouvre (et la replie).
  const [reopened, setReopened] = useState(false)
  const collapsed = folded && !reopened
  const [openLetter, setOpenLetter] = useState<RoundtableLetter | undefined>()
  const { gestures, refusal, pending } = useRoundtableGestures(info, item)
  const progress = useProgress(group)
  const used = useRoundtableTotal(group, info)
  const rebutted = item.seats.some((s) => s.rebuttal)
  const working = item.seats.filter((s) => s.state === 'working' || s.state === 'waiting')
  const activity = useChildTools(working.flatMap((s) => (s.childId ? [s.childId] : [])))
  const names = listText(item.seats.map(seatLabel))
  // Une seule lecture seule pour tous : dite au pied ; sinon, le bouclier de chacun (A3).
  const mixed = new Set(item.seats.map((s) => s.readOnly).filter(Boolean)).size > 1
  const presence = useSeatPresence(item, info, !collapsed)
  return (
    <div
      className="work-group roundtable-card"
      data-testid="roundtable-card"
      data-phase={item.phase}
      data-collapsed={collapsed || undefined}
    >
      <div className="work-group-head">
        {folded ? (
          <button
            type="button"
            className="roundtable-head-toggle"
            aria-expanded={!collapsed}
            onClick={() => setReopened((r) => !r)}
            data-testid="roundtable-head-toggle"
          >
            <RoundtableIcon size={16} className="work-group-icon" />
            <strong className="work-group-title">{t('roundtable.card.title')}</strong>
            {collapsed && <span className="work-group-sub roundtable-names">· {names}</span>}
            <span className="roundtable-progress" data-testid="roundtable-progress">
              {progress}
            </span>
            {collapsed ? (
              <ChevronRight size={14} aria-hidden />
            ) : (
              <ChevronDown size={14} aria-hidden />
            )}
          </button>
        ) : (
          <>
            <RoundtableIcon size={16} className="work-group-icon" />
            <strong className="work-group-title">{t('roundtable.card.title')}</strong>
            <span className="roundtable-progress" data-testid="roundtable-progress">
              {progress}
            </span>
          </>
        )}
      </div>
      {!collapsed && (
        <div className="work-group-rows">
          {item.seats.map((seat) => (
            <SeatRow
              key={seat.letter}
              seat={seat}
              group={group}
              info={info}
              work={group.works.get(seat.letter)}
              activity={seat.childId ? activity.get(seat.childId) : undefined}
              open={openLetter === seat.letter}
              onToggle={() => setOpenLetter((l) => (l === seat.letter ? undefined : seat.letter))}
              gestures={gestures}
              pending={pending}
              shield={mixed}
              presence={presence(seat)}
            />
          ))}
        </div>
      )}
      {!collapsed && <RoundtableFoot group={group} gestures={gestures} pending={pending} />}
      <GestureRefusal text={refusal} />
      {used?.text && !rebutted && (
        <UsedLine label={t('roundtable.card.used', { total: used.text })} detail={used.detail} />
      )}
    </div>
  )
}

function SeatRow({
  seat,
  group,
  info,
  work,
  activity,
  open,
  onToggle,
  gestures,
  pending,
  shield,
  presence
}: {
  seat: RoundtableSeat
  group: RoundtableGroupData
  info: SubtasksInfo | undefined
  work: WorkCardData | undefined
  activity: Parameters<typeof RoundtableRow>[0]['activity']
  open: boolean
  onToggle: () => void
  gestures: ReturnType<typeof useRoundtableGestures>['gestures']
  pending: ReadonlySet<string>
  shield: boolean
  presence: SeatPresence
}) {
  const { item } = group
  const child = info?.children.find((c) => c.id === seat.childId)
  const { opinion } = seatReports(work, seat)
  const collecting = item.phase === 'collecting'
  const running = seat.state === 'working' || seat.state === 'waiting'
  // Arrêt du tour en cours : plus aucun geste sur les lignes.
  const live = gestures && !item.stopping ? gestures : undefined
  const modelRefused =
    seat.state === 'error' &&
    (seat.error === 'model-not-found' || seat.error === 'model-not-applied')
  const relaunch = !!gestures && canRelaunch(item, seat.letter) && !attachmentsLost(item)
  const childId = seat.childId
  return (
    <RoundtableRow
      seat={seat}
      shield={shield}
      presence={presence}
      report={opinion}
      child={child}
      activity={activity}
      collecting={collecting}
      open={open}
      onToggle={onToggle}
      actions={{
        ...(live && collecting && running ? { stop: () => live.stop(seat.letter) } : {}),
        busy: pending.has(`stop-${seat.letter}`) || pending.has(`relaunch-${seat.letter}`),
        ...(relaunch && !modelRefused && live
          ? { relaunch: () => live.relaunch(seat.letter) }
          : {}),
        ...(modelRefused && live ? { otherModel: requestRoundtableMenu } : {}),
        // À la corbeille ou supprimée : l'avis se lit, sa conversation ne s'ouvre pas.
        ...(childId && presence === 'here' && info ? { open: () => info.onOpen(childId) } : {})
      }}
    />
  )
}

/** Pied de la carte : la mention de lecture seule et les gestes de la phase, ou ce qui s'est passé. */
function RoundtableFoot({
  group,
  gestures,
  pending
}: {
  group: RoundtableGroupData
  gestures: ReturnType<typeof useRoundtableGestures>['gestures']
  pending: ReadonlySet<string>
}) {
  const { t } = useTranslation()
  const { item } = group
  const opinions = usableSeats(item).length
  const absent = item.seats.length - opinions
  const synthesize = gestures && !item.stopping && canSynthesize(item)
  const lost = attachmentsLost(item) && item.seats.some((s) => canRelaunch(item, s.letter))
  const resumable = gestures && !lost && item.seats.some((s) => canRelaunch(item, s.letter))
  const from = item.interruptedFrom
  let note: string | undefined
  if (item.phase === 'insufficient')
    note = t(opinions === 1 ? 'roundtable.card.single' : 'roundtable.card.none')
  else if (item.phase === 'synthesizing' && absent > 0)
    note = t('roundtable.card.partial', { count: absent, opinions })
  if (item.phase === 'collecting') {
    return (
      <div className="work-group-foot roundtable-foot" data-testid="roundtable-foot">
        <span className="roundtable-foot-note" data-testid="roundtable-foot-note">
          <span className="roundtable-foot-full">
            {t('roundtable.card.footerLevel', { level: readOnlyLevel(item) })}
          </span>
          <span className="roundtable-foot-short">{readOnlyLevel(item)}</span>
        </span>
        <span className="grow" />
        {synthesize && (
          <button
            type="button"
            className="btn small"
            onClick={gestures.synthesize}
            disabled={pending.has('synthesize')}
            data-testid="roundtable-synthesize"
          >
            <span className="roundtable-foot-full">{t('roundtable.card.synthesizeNow')}</span>
            <span className="roundtable-foot-short">{t('roundtable.card.synthesizeNowShort')}</span>
          </button>
        )}
        {gestures && (
          <button
            type="button"
            className="btn small ghost roundtable-stop-all"
            aria-label={
              item.stopping ? t('roundtable.card.stopping') : t('roundtable.card.stopAll')
            }
            title={t('roundtable.card.stopAll')}
            onClick={() => gestures.stop()}
            // `roundtable:stop` rend la main une fois l'arrêt fini : le geste attend jusque-là.
            disabled={pending.has('stop-all') || !!item.stopping}
            data-testid="roundtable-stop"
          >
            <Square size={12} aria-hidden />
            <span className="roundtable-stop-label">
              {item.stopping ? t('roundtable.card.stopping') : t('roundtable.card.stop')}
            </span>
          </button>
        )}
      </div>
    )
  }
  const decide = gestures && (from === 'rebutting' || from === 'deciding')
  if (item.phase === 'interrupted' && (synthesize || resumable || decide || lost)) {
    return (
      <div className="work-group-foot roundtable-foot" data-testid="roundtable-foot">
        {lost && (
          <span className="roundtable-foot-note" data-testid="roundtable-attachments-lost">
            {t('roundtable.error.attachmentsLost')}
          </span>
        )}
        <span className="grow" />
        {synthesize && (
          <button
            type="button"
            className="btn small primary"
            onClick={gestures.synthesize}
            disabled={pending.has('synthesize')}
            data-testid="roundtable-synthesize"
          >
            {t('roundtable.card.synthesizeWith', { count: opinions })}
          </button>
        )}
        {decide && (
          <button
            type="button"
            className="btn small primary"
            onClick={gestures.decide}
            disabled={pending.has('decide')}
            data-testid="roundtable-decide"
          >
            {t('roundtable.decision.again')}
          </button>
        )}
        {resumable && (
          <button
            type="button"
            className="btn small"
            onClick={() => {
              for (const seat of item.seats)
                if (canRelaunch(item, seat.letter)) gestures.relaunch(seat.letter)
            }}
            disabled={[...pending].some((k) => k.startsWith('relaunch-'))}
            data-testid="roundtable-resume"
          >
            {t('roundtable.card.relaunchStopped', {
              count: item.seats.filter((s) => canRelaunch(item, s.letter)).length
            })}
          </button>
        )}
      </div>
    )
  }
  if (!note) return null
  return (
    <div className="work-group-foot roundtable-foot" data-testid="roundtable-foot">
      <span className="roundtable-foot-note" data-testid="roundtable-note">
        {note}
      </span>
    </div>
  )
}
