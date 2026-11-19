import { LoaderCircle } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { conversationChanges } from '@shared/changes'
import type { TranscriptItem } from '@shared/transcript'
import type { TurnTime } from '@shared/turn-duration'
import { formatEstimate, turnCost, type ConversationUsage } from '@shared/usage'
import { usePresentation } from '../../presentation'
import { turnDuration } from '../../time'
import { countText } from '@shared/i18n/format'
import { CopyButton } from '../common/CopyButton'
import { MessageDuration, MessageTime } from './MessageTime'

export interface TurnFacts {
  /** Temps de travail de l'agent (ms), attente de l'utilisateur retirée (fiche 255). */
  ms: number
  /** Temps passé à attendre l'utilisateur (ms), affiché à part dès 1 s. */
  waitedMs?: number
  files: number
  added: number
  removed: number
  cost?: { amount: number; currency: string }
}

/**
 * Pied de la réponse qui finit un tour (fiche 261, écran F) : le bilan du tour fini (`done`), ou
 * « Travaille encore… » tant que l'agent y travaille (`working`).
 */
export type ReplyFootState = { kind: 'done'; facts: TurnFacts } | { kind: 'working' }

const WORKING: ReplyFootState = { kind: 'working' }

type TurnVisit = (
  turn: readonly TranscriptItem[],
  bounds: { sentAt: number; nextAt: number | undefined; last: boolean }
) => void

/** Chaque tour du fil : ses éléments après le message de l'utilisateur, jusqu'au suivant. */
function eachTurn(items: readonly TranscriptItem[], visit: TurnVisit) {
  const starts = items.flatMap((item, i) => (item.kind === 'user' ? [i] : []))
  starts.forEach((start, k) => {
    const next = starts[k + 1]
    const sentAt = (items[start] as Extract<TranscriptItem, { kind: 'user' }>).at ?? 0
    const nextAt = next === undefined ? undefined : (items[next] as { at?: number }).at
    visit(items.slice(start + 1, next), { sentAt, nextAt, last: next === undefined })
  })
}

/** Ce que fait l'agent maintenant (statut de l'hôte, travail après le tour de la fiche 255). */
export interface AgentLive {
  /** Un tour est en cours (`busy`). */
  busy: boolean
  /** Tour fini, l'agent travaille encore : sous-agent en arrière-plan, réponse hors tour. */
  background: boolean
}

/**
 * Bilan de chaque tour fini (fiche 185, idée P4 ; un par tour, fiche 255) : sa durée, les fichiers
 * qu'il a modifiés et son coût, quand l'agent le donne ; rangé sous la réponse qui finit le tour
 * (id de cette réponse → bilan). Rien pour un tour sans réponse finie, ni pour un tour où l'agent
 * travaille encore (voir `replyFeet`).
 */
export function turnFacts(
  items: readonly TranscriptItem[],
  times: ReadonlyMap<number, TurnTime>,
  usage: ConversationUsage | undefined,
  live: AgentLive
): Map<number, TurnFacts> {
  const facts = new Map<number, TurnFacts>()
  for (const [id, foot] of replyFeet(items, times, usage, live)) {
    if (foot.kind === 'done') facts.set(id, foot.facts)
  }
  return facts
}

/**
 * Pied de chaque tour (fiche 261), rangé sous sa réponse (id de la réponse → pied) :
 * - tour en cours (le dernier, l'agent répond et rien n'est encore daté) : aucun pied,
 *   l'indicateur du bas suffit (règle 5 de la fiche 260) ;
 * - travail après le tour (le dernier quand `background`, ou un tour dont un sous-agent en
 *   arrière-plan n'a pas fini, fiche 255) : « Travaille encore… » sous sa dernière réponse ;
 * - tour fini : le bilan, sous la réponse qui l'a fini. Un tour dont la réponse est datée est fini
 *   (les réponses sont datées à la fin du tour) : le statut « occupé » d'un nouveau message, qui
 *   arrive avant ce message (fiche 095), ne lui retire pas son bilan ;
 * - tour arrêté, refusé, coupé, en erreur, ou sans réponse finie : aucun pied (l'heure et la
 *   durée restent au survol, comme avant).
 */
export function replyFeet(
  items: readonly TranscriptItem[],
  times: ReadonlyMap<number, TurnTime>,
  usage: ConversationUsage | undefined,
  live: AgentLive
): Map<number, ReplyFootState> {
  const feet = new Map<number, ReplyFootState>()
  eachTurn(items, (turn, { sentAt, nextAt, last }) => {
    // Tour arrêté, refusé, coupé ou en erreur : son avis le dit déjà, pas de bilan.
    if (turn.some(endedBadly)) return
    const ended = turn.some((item) => item.kind === 'agent' && item.at !== undefined)
    if (last && live.busy && !ended) return
    if ((last && live.background) || turn.some(stillInBackground)) {
      const reply = turn.findLast((item) => item.kind === 'agent')
      if (reply) feet.set(reply.id, WORKING)
      return
    }
    const fact = factsOf(turn, times, usage, sentAt, nextAt)
    if (fact) feet.set(fact.replyId, { kind: 'done', facts: fact.facts })
  })
  return feet
}

/**
 * Même pied (les réponses mémoïsées, fiche 047, ne refont pas leur rendu à chaque morceau de
 * réponse pour un bilan recalculé à l'identique).
 */
export function sameFoot(a: ReplyFootState | undefined, b: ReplyFootState | undefined): boolean {
  if (!a || !b) return a === b
  if (a.kind === 'working' || b.kind === 'working') return a.kind === b.kind
  const x = a.facts
  const y = b.facts
  return (
    x.ms === y.ms &&
    x.waitedMs === y.waitedMs &&
    x.files === y.files &&
    x.added === y.added &&
    x.removed === y.removed &&
    x.cost?.amount === y.cost?.amount &&
    x.cost?.currency === y.cost?.currency
  )
}

function factsOf(
  turn: readonly TranscriptItem[],
  times: ReadonlyMap<number, TurnTime>,
  usage: ConversationUsage | undefined,
  sentAt: number,
  nextAt: number | undefined
): { replyId: number; facts: TurnFacts } | undefined {
  // Réponse qui a fini le tour : pas celle que l'agent a donnée ensuite, hors tour (fiche 232).
  const reply = turn.findLast((item) => item.kind === 'agent' && times.has(item.id))
  const time = reply && times.get(reply.id)
  if (!time || !reply) return undefined
  const changes = conversationChanges(turn)
  const added = changes.reduce((sum, change) => sum + change.added, 0)
  const removed = changes.reduce((sum, change) => sum + change.removed, 0)
  // Le tour de la consommation fini entre ce message et le suivant.
  const counted = usage?.turns?.findLast(
    (t) => (t.at ?? 0) >= sentAt && (nextAt === undefined || (t.at ?? 0) <= nextAt)
  )
  const amount = counted ? turnCost(counted) : undefined
  const currency = usage?.cost?.currency
  return {
    replyId: reply.id,
    facts: {
      ms: time.ms,
      ...(time.waitedMs > 0 ? { waitedMs: time.waitedMs } : {}),
      files: changes.length,
      added,
      removed,
      ...(amount !== undefined && amount > 0 && currency ? { cost: { amount, currency } } : {})
    }
  }
}

/** Sous-agent en arrière-plan qui travaille encore (fiche 122) : le tour n'est pas fini. */
const stillInBackground = (item: TranscriptItem): boolean =>
  item.kind === 'tool' &&
  !!item.subagentRun?.background &&
  item.subagentRun.endedAt === undefined &&
  !item.subagentRun.lost

/** Avis de fin anormale d'un tour (`STOP_MESSAGES` et `turn-error` de `shared/transcript`, fils d'avant). */
const BAD_ENDS = new Set<string>([
  'transcript.notice.cancelled',
  'transcript.notice.refusal',
  'transcript.notice.maxTokens',
  'transcript.notice.maxTurnRequests',
  'transcript.notice.error'
])

function endedBadly(item: TranscriptItem): boolean {
  // Limite d'étapes (fiche 209) : la carte le dit (l'avis `maxTurnRequests` des fils d'avant aussi).
  if (item.kind === 'turn-limit') return true
  return (
    item.kind === 'notice' &&
    (item.level === 'error' || (!!item.message && BAD_ENDS.has(item.message.key)))
  )
}

/**
 * Pied de la réponse qui finit un tour (fiche 261, écran F), toujours visible, à sa place : la
 * rangée des actions de la réponse (copier) suivie du bilan, « 21:17 · 2 min 29 s · 9 fichiers
 * +346 −0 · coût », l'attente de l'utilisateur à part (fiche 255) ; ou « Travaille encore… » tant
 * que l'agent y travaille. Ce qui arrive après se met dessous.
 */
export function ReplyFoot({
  foot,
  text,
  at
}: {
  foot: ReplyFootState
  /** Texte de la réponse, pour « Copier ». */
  text: () => string
  /** Heure de la réponse. */
  at: number | undefined
}) {
  const { t } = useTranslation()
  // Mode présentation (fiche 159) : aucun montant à l'écran.
  const presenting = usePresentation()
  const copy = <CopyButton text={text} label={t('transcript.copyReply')} testId="copy-reply" />
  if (foot.kind === 'working') {
    return (
      <div className="msg-agent-actions reply-foot" data-testid="turn-working">
        {copy}
        <LoaderCircle size={12} className="spin reply-foot-spin" aria-hidden />
        <span>{t('turnSummary.working')}</span>
      </div>
    )
  }
  const { facts } = foot
  const parts: { key: string; node: ReactNode }[] = []
  if (at !== undefined) parts.push({ key: 'at', node: <MessageTime at={at} /> })
  parts.push({ key: 'ms', node: <MessageDuration ms={facts.ms} /> })
  // Attente de l'utilisateur, hors de la durée (fiche 255) ; sous la seconde, rien.
  if (facts.waitedMs !== undefined && facts.waitedMs >= 1000) {
    parts.push({
      key: 'waited',
      node: (
        <span data-testid="turn-waited">
          {t('turnSummary.waited', { duration: turnDuration(facts.waitedMs) })}
        </span>
      )
    })
  }
  if (facts.files > 0) {
    parts.push({
      key: 'files',
      node: (
        <span className="reply-foot-files">
          {t('turnSummary.fileCount', { count: facts.files })}{' '}
          <span className="diff-added">+{countText(facts.added)}</span>{' '}
          <span className="diff-removed">−{countText(facts.removed)}</span>
        </span>
      )
    })
  }
  if (facts.cost && !presenting) {
    parts.push({ key: 'cost', node: <span>{formatEstimate(facts.cost)}</span> })
  }
  return (
    <div className="msg-agent-actions reply-foot" data-testid="turn-summary">
      {copy}
      {/* Une seule ligne de texte (lue telle quelle par le pilote, fiche 206). */}
      <span className="reply-foot-facts">
        {parts.map((part, i) => (
          <Fragment key={part.key}>
            {i > 0 && ' · '}
            {part.node}
          </Fragment>
        ))}
      </span>
    </div>
  )
}
