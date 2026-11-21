import { LoaderCircle } from 'lucide-react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { elapsedLabel } from '@shared/activity'
import { useTranslation } from 'react-i18next'
import { conversationChanges } from '@shared/changes'
import { endedBadly } from '@shared/turn-end'
import type { TranscriptItem } from '@shared/transcript'
import { turnTimes, type TurnTime } from '@shared/turn-duration'
import { formatEstimate, turnCost, type ConversationUsage } from '@shared/usage'
import { usePresentation } from '../../presentation'
import { turnDuration } from '../../time'
import { CopyButton } from '../common/CopyButton'
import { LineTotals } from '../common/LineTotals'
import { MessageDuration, MessageTime } from './MessageTime'

export interface TurnFacts {
  /** Temps de travail de l'agent (ms), attente de l'utilisateur retirée (fiche 255). */
  ms: number
  /** Temps passé à attendre l'utilisateur (ms), affiché à part dès 1 s. */
  waitedMs?: number
  files: number
  added: number
  removed: number
  /** Fichiers écrits sans diff connu (fiche 272), parmi `files`. */
  unknown?: number
  cost?: { amount: number; currency: string }
}

/**
 * Pied de la réponse qui finit un tour (fiche 261, écran F) : le bilan du tour fini (`done`), ou
 * « Travaille encore… » tant que l'agent y travaille (`working`).
 */
export type ReplyFootState =
  | { kind: 'done'; facts: TurnFacts }
  /** `since` : envoi du message du tour, pour le temps écoulé. */
  | { kind: 'working'; since?: number }

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
 * Pied de chaque tour (fiches 185, 255, 261), rangé sous sa réponse (id de la réponse → pied) :
 * - tour en cours (le dernier, l'agent répond et rien n'est encore daté) : aucun pied,
 *   l'indicateur du bas suffit (règle 5 de la fiche 260) ;
 * - travail après le tour, seulement tant que l'agent est actif (`busy` ou `background`) :
 *   « Travaille encore… » sous la dernière réponse du tour qui a lancé un sous-agent en arrière-plan
 *   pas encore fini (fiche 122), ou, sans sous-agent, du dernier tour (réponse hors tour attendue,
 *   fiche 255). Un seul tour à la fois : les autres gardent leur bilan. Agent arrêté ou planté :
 *   jamais (un suivi perdu ne laisse pas le pied tourner pour toujours) ;
 * - tour fini : le bilan (durée, fichiers, coût), sous la réponse qui l'a fini. Un tour dont une
 *   réponse est datée est fini (les réponses sont datées à la fin du tour) : le statut « occupé »
 *   d'un nouveau message, qui arrive avant ce message (fiche 095), ne lui retire pas son bilan ;
 * - tour arrêté, refusé, coupé, en erreur, ou sans réponse finie : aucun pied (l'heure et la
 *   durée restent au survol, comme avant). Un tour en erreur repris par « Réessayer » (fiche 142)
 *   et fini ensuite a son bilan : une réponse datée suit l'erreur.
 */
export function replyFeet(
  items: readonly TranscriptItem[],
  times: ReadonlyMap<number, TurnTime>,
  usage: ConversationUsage | undefined,
  live: AgentLive
): Map<number, ReplyFootState> {
  const feet = new Map<number, ReplyFootState>()
  const active = live.busy || live.background
  const running = active && items.some(stillInBackground)
  eachTurn(items, (turn, { sentAt, nextAt, last }) => {
    // Tour arrêté, refusé, coupé ou en erreur : son avis le dit déjà, pas de bilan.
    if (endedBadly(turn)) return
    const ended = turn.some((item) => item.kind === 'agent' && item.at !== undefined)
    if (last && live.busy && !ended) return
    const working = running ? turn.some(stillInBackground) : last && live.background
    if (working) {
      const reply = turn.findLast((item) => item.kind === 'agent')
      if (reply) feet.set(reply.id, { kind: 'working', ...(sentAt ? { since: sentAt } : {}) })
      return
    }
    const fact = factsOf(turn, times, usage, sentAt, nextAt)
    if (fact) feet.set(fact.replyId, { kind: 'done', facts: fact.facts })
  })
  return feet
}

/** Un pied « Travaille encore… » est rendu dans le fil (l'indicateur du bas se tait alors). */
export function hasWorkingFoot(items: readonly TranscriptItem[], live: AgentLive): boolean {
  return [...replyFeet(items, turnTimes(items), undefined, live).values()].some(
    (foot) => foot.kind === 'working'
  )
}

/**
 * Même pied (les réponses mémoïsées, fiche 047, ne refont pas leur rendu à chaque morceau de
 * réponse pour un bilan recalculé à l'identique).
 */
export function sameFoot(a: ReplyFootState | undefined, b: ReplyFootState | undefined): boolean {
  if (!a || !b) return a === b
  if (a.kind === 'working' || b.kind === 'working') {
    return a.kind === 'working' && b.kind === 'working' && a.since === b.since
  }
  const x = a.facts
  const y = b.facts
  return (
    x.ms === y.ms &&
    x.waitedMs === y.waitedMs &&
    x.files === y.files &&
    x.added === y.added &&
    x.removed === y.removed &&
    x.unknown === y.unknown &&
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
      ...(changes.some((c) => c.unknown)
        ? { unknown: changes.filter((c) => c.unknown).length }
        : {}),
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

/**
 * Pied de la réponse qui finit un tour (fiche 261, écran F), toujours visible, à sa place : la
 * rangée des actions de la réponse (copier) suivie du bilan, « 21:17 · 2 min 29 s · 9 fichiers
 * +346 −0 · coût », l'attente de l'utilisateur à part (fiche 255) ; ou « Travaille encore… » tant
 * que l'agent y travaille. Ce qui arrive après se met dessous.
 */
export function ReplyFoot({
  foot,
  text,
  at,
  onOpenChanges
}: {
  foot: ReplyFootState
  /** Texte de la réponse, pour « Copier ». */
  text: () => string
  /** Heure de la réponse. */
  at: number | undefined
  /** Ouvrir l'onglet Modifications (maquette 260, écran F) ; absent, les fichiers sont un texte. */
  onOpenChanges?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  // Mode présentation (fiche 159) : aucun montant à l'écran.
  const presenting = usePresentation()
  if (foot.kind === 'working') return <WorkingFoot since={foot.since} />
  const copy = <CopyButton text={text} label={t('transcript.copyReply')} testId="copy-reply" />
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
    const files = (
      <>
        {t('turnSummary.fileCount', { count: facts.files })} <LineTotals {...facts} />
      </>
    )
    parts.push({
      key: 'files',
      node: onOpenChanges ? (
        <button
          type="button"
          className="link-button reply-foot-files"
          title={t('turnSummary.openChanges')}
          onClick={onOpenChanges}
          data-testid="turn-files"
        >
          {files}
        </button>
      ) : (
        <span className="reply-foot-files" data-testid="turn-files">
          {files}
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
            {i > 0 && <Separator />}
            {part.node}
          </Fragment>
        ))}
      </span>
    </div>
  )
}

/**
 * « Travaille encore… · 32 s » (fiche 261) : le travail après le tour, dit une seule fois (l'indicateur
 * du bas est masqué), avec le temps depuis l'envoi du message. Rien à copier encore.
 */
function WorkingFoot({ since }: { since: number | undefined }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="msg-agent-actions reply-foot working" data-testid="turn-working">
      <LoaderCircle size={12} className="spin reply-foot-spin" aria-hidden />
      <span className="reply-foot-facts">
        {t('turnSummary.working')}
        {since !== undefined && (
          <>
            <Separator />
            <span className="reply-foot-elapsed">{elapsedLabel(now - since)}</span>
          </>
        )}
      </span>
    </div>
  )
}

/**
 * « · » entre deux éléments du pied : collé au précédent (espace insécable), la ligne ne se coupe
 * qu'après lui. Le texte lu reste « a · b » (pilote, fiche 206).
 */
function Separator() {
  return (
    <>
      <span className="reply-foot-sep">{'\u00a0·'}</span>{' '}
    </>
  )
}
