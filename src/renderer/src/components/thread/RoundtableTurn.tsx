/**
 * Synthèse et décision d'un tour de table dans le fil (fiche 285, maquettes `synthese-actions`,
 * `apres-synthese`, `replique`) : ce sont des tours ordinaires de l'agent de la conversation, ouverts
 * par un message de l'app (provenance `roundtable`).
 *
 * - Le message de l'app (la consigne, en anglais) devient une ligne : « Synthèse demandée · 3 avis ».
 * - La réponse porte l'étiquette « Synthèse du tour de table · <modèle> » ; « Participant C » y
 *   montre le vrai nom au survol et au focus (table des lettres côté interface seulement).
 * - Sous la synthèse : « Demander à <agent> de l'appliquer » (un message ordinaire), et « Faire
 *   réagir les participants » avec le rappel en jetons ; une fois la réplique lancée, sa carte.
 * - Sous la décision : « Demander à <agent> de l'appliquer ».
 */
import { Pencil, Reply } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  answeredRebuttals,
  canRebut,
  rebuttalMultiplier,
  type RoundtableLetter
} from '@shared/roundtable'
import type { TranscriptItem } from '@shared/transcript'
import type { RoundtableGroupData, WorkLayout } from '@shared/work-groups'
import { ipcErrorText } from '../../ipc-errors'
import { useChildTools } from '../roles/RoleWork'
import { RoundtableIcon } from '../roundtable/RoundtableIcon'
import {
  letterNames,
  roundtableTurns,
  seatReports,
  type RoundtableTurn
} from '../roundtable/roundtable-view'
import { MessageTime } from './MessageTime'
import {
  GestureRefusal,
  RoundtableEntry,
  UsedLine,
  useRoundtableGestures,
  useRoundtableTotal,
  useSeatPresence
} from './RoundtableCard'
import { RebuttalRow } from './RoundtableRow'
import type { SubtasksInfo } from './Subtasks'

type UserItem = Extract<TranscriptItem, { kind: 'user' }>

/** Ligne de l'app à la place de la demande de synthèse ou de décision (jamais la consigne). */
function RoundtableRequestLine({
  item,
  turn,
  group
}: {
  item: UserItem
  turn: RoundtableTurn
  group: RoundtableGroupData | undefined
}) {
  const { t } = useTranslation()
  const step = turn.step === 'synthesis' ? group?.item.synthesis : group?.item.verdict
  const count = step?.count ?? 0
  return (
    <div
      className="subtask-launch roundtable-request"
      data-testid="roundtable-request"
      data-step={turn.step}
      data-item-id={item.id}
    >
      <RoundtableIcon size={14} />
      <span>
        {turn.step === 'synthesis'
          ? t('roundtable.synthesis.requested', { count })
          : turn.step === 'verdict'
            ? t('roundtable.decision.requested', { count })
            : t('roundtable.rebuttal.requested')}
      </span>
      {item.at && <MessageTime at={item.at} />}
    </div>
  )
}

/** Carte « Réplique » (maquette `replique`) : une ligne par participant, sa position en mots. */
function RebuttalCard({
  group,
  info
}: {
  group: RoundtableGroupData
  info: SubtasksInfo | undefined
}) {
  const { t } = useTranslation()
  const { item } = group
  const seats = item.seats.filter((s) => s.rebuttal)
  const [open, setOpen] = useState<RoundtableLetter | undefined>()
  const running = seats.filter(
    (s) => s.rebuttal?.state === 'working' || s.rebuttal?.state === 'waiting'
  )
  const activity = useChildTools(running.flatMap((s) => (s.childId ? [s.childId] : [])))
  const used = useRoundtableTotal(group, info)
  const presence = useSeatPresence(item, info)
  return (
    <div className="work-group roundtable-card" data-testid="roundtable-rebuttal">
      <div className="work-group-head">
        <Reply size={16} className="work-group-icon" aria-hidden />
        <strong className="work-group-title">{t('roundtable.rebuttal.title')}</strong>
        <span className="roundtable-progress">
          {t('roundtable.rebuttal.answers', { count: answeredRebuttals(item).length })}
        </span>
      </div>
      <div className="work-group-rows">
        {seats.map((seat) => {
          const childId = seat.childId
          const { rebuttal } = seatReports(group.works.get(seat.letter), seat)
          return (
            seat.rebuttal && (
              <RebuttalRow
                key={seat.letter}
                seat={seat}
                rebuttal={seat.rebuttal}
                report={rebuttal}
                child={info?.children.find((c) => c.id === childId)}
                activity={childId ? activity.get(childId) : undefined}
                open={open === seat.letter}
                onToggle={() => setOpen((l) => (l === seat.letter ? undefined : seat.letter))}
                onOpen={
                  childId && presence(seat) === 'here' && info
                    ? () => info.onOpen(childId)
                    : undefined
                }
              />
            )
          )
        })}
      </div>
      {used?.text && (
        <UsedLine
          label={t('roundtable.card.usedAll', { total: used.text })}
          detail={used.detail}
          testId="roundtable-used-all"
        />
      )}
    </div>
  )
}

/** Sous la synthèse ou la décision rendue : appliquer, et (synthèse) faire réagir. */
function RoundtableActions({
  group,
  step,
  info,
  followed
}: {
  group: RoundtableGroupData
  step: RoundtableTurn['step']
  info: SubtasksInfo | undefined
  /** Un message de l'utilisateur suit déjà ce tour : « Appliquer » ne se propose plus. */
  followed: boolean
}) {
  const { t } = useTranslation()
  const { item } = group
  const { gestures, refusal, pending } = useRoundtableGestures(info, item)
  // « Appliquer » : le motif de `WorkFoot` (un envoi à la fois, échec dit), fiche 263.
  const [acting, setActing] = useState(false)
  const act = (action: () => unknown) => {
    if (acting) return
    setActing(true)
    void Promise.resolve()
      .then(action)
      .catch((error: unknown) => info?.onWarn?.(ipcErrorText(error)))
      .finally(() => setActing(false))
  }
  const answered = (step === 'synthesis' ? item.synthesis : item.verdict)?.state === 'answered'
  if (!answered) return null
  const rebut = step === 'synthesis' && !!gestures && canRebut(item)
  // Un message attend déjà dans la file, ou a suivi : il emporte la suite, rien à proposer.
  const onAsk = followed || info?.motherQueued || info?.motherArchived ? undefined : info?.onAsk
  if (!onAsk && !rebut) return null
  return (
    <div className="roundtable-actions" data-testid="roundtable-actions">
      <GestureRefusal text={refusal} />
      {onAsk && (
        <button
          type="button"
          className="btn small primary"
          onClick={() => act(() => onAsk(t('roundtable.synthesis.applyDraft')))}
          disabled={acting}
          data-testid="roundtable-apply"
        >
          <Pencil size={13} aria-hidden />
          {t('roundtable.synthesis.apply', { agent: item.synthesizer.label })}
        </button>
      )}
      {!onAsk && rebut && (
        // Place gardée : « Faire réagir » ne glisse pas quand « Appliquer » disparaît (A4).
        <span className="btn small primary roundtable-apply-placeholder" aria-hidden>
          <Pencil size={13} aria-hidden />
          {t('roundtable.synthesis.apply', { agent: item.synthesizer.label })}
        </span>
      )}
      {rebut && (
        // Le bouton et son rappel d'un tenant : le rappel reste à droite du bouton, et passe à la
        // ligne avec lui (A4).
        <span className="roundtable-rebut-group">
          <button
            type="button"
            className="btn small"
            onClick={gestures.rebuttal}
            disabled={pending.has('rebuttal')}
            data-testid="roundtable-rebut"
          >
            <Reply size={13} aria-hidden />
            {t('roundtable.rebuttal.action')}
          </button>
          <span className="roundtable-actions-hint" data-testid="roundtable-rebut-cost">
            <span className="roundtable-hint-full">
              {t('roundtable.cost.full', { n: rebuttalMultiplier(item) })}
            </span>
            <span className="roundtable-hint-short">
              {t('roundtable.cost.short', { n: rebuttalMultiplier(item) })}
            </span>
          </span>
        </span>
      )}
    </div>
  )
}

/**
 * Réponse de l'agent dans un tour du tour de table : l'étiquette avant la première, puis, après la
 * dernière, les actions (ou, la réplique lancée, sa carte).
 */
function RoundtableAnswerFrame({
  turn,
  itemId,
  group,
  info,
  followed,
  children
}: {
  turn: RoundtableTurn
  itemId: number
  group: RoundtableGroupData | undefined
  info: SubtasksInfo | undefined
  followed: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const first = turn.answers[0] === itemId
  const last = turn.answers.at(-1) === itemId
  // Agent et modèle réellement utilisés pour cette demande (S3), relevés à son départ ; un tour
  // d'une version précédente : ceux de la conversation au lancement du tour.
  const step = turn.step === 'verdict' ? group?.item.verdict : group?.item.synthesis
  const by = step?.by ?? group?.item.synthesizer
  const model = by?.model ?? by?.label ?? ''
  const rebutted = !!group?.item.seats.some((s) => s.rebuttal)
  return (
    <div className="roundtable-answer" data-testid="roundtable-answer" data-step={turn.step}>
      {first && (
        <div className="roundtable-answer-label" data-testid="roundtable-answer-label">
          <RoundtableIcon size={14} />
          {turn.step === 'synthesis'
            ? t('roundtable.synthesis.label', { model })
            : t('roundtable.decision.label', { model })}
        </div>
      )}
      {children}
      {last &&
        group &&
        (turn.step === 'synthesis' && rebutted ? (
          <RebuttalCard group={group} info={info} />
        ) : (
          <RoundtableActions group={group} step={turn.step} info={info} followed={followed} />
        ))}
    </div>
  )
}

/**
 * Ce que le fil fait des éléments d'un tour de table (sorti de `Transcript`, taille bornée) : la
 * bulle et la carte à la place de l'élément, la ligne de l'app à la place d'une demande, et le cadre
 * d'une réponse de synthèse ou de décision avec ses lettres.
 */
export function useRoundtableThread(
  items: readonly TranscriptItem[],
  layout: Pick<WorkLayout, 'roundtables'>,
  info: SubtasksInfo | undefined
) {
  const byId = useMemo(
    () => new Map([...layout.roundtables.values()].map((g) => [g.item.roundtableId, g])),
    [layout.roundtables]
  )
  // La synthèse (la décision) s'arrête à sa fin rendue : une réponse d'après n'en est pas.
  const turns = useMemo(
    () =>
      roundtableTurns(items, (id, step) => {
        const item = byId.get(id)?.item
        return (step === 'synthesis' ? item?.synthesis : item?.verdict)?.answeredAt
      }),
    [items, byId]
  )
  // Tables des lettres gardées tant que leur contenu ne change pas : une synthèse qui s'écrit ne
  // refait pas le Markdown des autres, ni ne remonte ses lettres (focus, infobulle).
  const lettersKey = JSON.stringify(
    [...byId].map(([id, g]) => [id, letterNames(g.item.seats)] as const)
  )
  const letters = useMemo(
    () => new Map(JSON.parse(lettersKey) as [string, Record<string, string>][]),
    [lettersKey]
  )
  // Un message de l'utilisateur, ou un tour de table posé après (sa bulle en est un, B8).
  const lastUser = items.findLast(
    (i) => (i.kind === 'user' && !i.from) || i.kind === 'roundtable'
  )?.id
  return {
    /** Élément propre au tour de table : son rendu ; sinon `undefined` (rendu ordinaire). */
    entry: (item: TranscriptItem): ReactNode | undefined => {
      const group = layout.roundtables.get(item.id)
      if (group) return <RoundtableEntry key={item.id} group={group} info={info} />
      const turn = item.kind === 'user' ? turns.byRequest.get(item.id) : undefined
      if (turn && item.kind === 'user')
        return (
          <RoundtableRequestLine
            key={item.id}
            item={item}
            turn={turn}
            group={byId.get(turn.roundtableId)}
          />
        )
      return undefined
    },
    /** Table des lettres d'une réponse de synthèse ou de décision. */
    letters: (itemId: number) => {
      const turn = turns.byAnswer.get(itemId)
      return turn ? letters.get(turn.roundtableId) : undefined
    },
    /** Une réponse de synthèse ou de décision dans son cadre ; une autre, telle quelle. */
    frame: (itemId: number, rendered: ReactNode): ReactNode => {
      const turn = turns.byAnswer.get(itemId)
      if (!turn) return rendered
      return (
        <RoundtableAnswerFrame
          key={`roundtable-${itemId}`}
          turn={turn}
          itemId={itemId}
          group={byId.get(turn.roundtableId)}
          info={info}
          followed={(lastUser ?? -1) > itemId}
        >
          {rendered}
        </RoundtableAnswerFrame>
      )
    }
  }
}
