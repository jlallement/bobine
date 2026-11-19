import { CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { conversationChanges } from '@shared/changes'
import type { TranscriptItem } from '@shared/transcript'
import type { TurnTime } from '@shared/turn-duration'
import { formatEstimate, turnCost, type ConversationUsage } from '@shared/usage'
import { usePresentation } from '../../presentation'
import { turnDuration } from '../../time'
import { countText } from '@shared/i18n/format'

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
 * Bilan de chaque tour fini (fiche 185, idée P4 ; un par tour, fiche 255) : sa durée, les fichiers
 * qu'il a modifiés et son coût, quand l'agent le donne ; rangé sous la réponse qui finit le tour
 * (id de cette réponse → bilan). Rien pour un tour sans réponse finie, ni pour le dernier tant que
 * l'agent y travaille (`open` : il répond, ou travaille encore après la fin du tour), ni pour un
 * tour dont un sous-agent en arrière-plan travaille encore.
 */
export function turnFacts(
  items: readonly TranscriptItem[],
  times: ReadonlyMap<number, TurnTime>,
  usage: ConversationUsage | undefined,
  open: boolean
): Map<number, TurnFacts> {
  const facts = new Map<number, TurnFacts>()
  const starts = items.flatMap((item, i) => (item.kind === 'user' ? [i] : []))
  starts.forEach((start, k) => {
    const next = starts[k + 1]
    if (next === undefined && open) return
    const turn = items.slice(start + 1, next)
    const sentAt = (items[start] as Extract<TranscriptItem, { kind: 'user' }>).at ?? 0
    const nextAt = next === undefined ? undefined : (items[next] as { at?: number }).at
    const fact = factsOf(turn, times, usage, sentAt, nextAt)
    if (fact) facts.set(fact.replyId, fact.facts)
  })
  return facts
}

function factsOf(
  turn: readonly TranscriptItem[],
  times: ReadonlyMap<number, TurnTime>,
  usage: ConversationUsage | undefined,
  sentAt: number,
  nextAt: number | undefined
): { replyId: number; facts: TurnFacts } | undefined {
  // Tour arrêté, refusé, coupé ou en erreur : son avis le dit déjà, pas de « Terminé ✓ ».
  if (turn.some(endedBadly) || turn.some(stillInBackground)) return undefined
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

export function TurnSummary({ facts }: { facts: TurnFacts }) {
  const { t } = useTranslation()
  // Mode présentation (fiche 159) : aucun montant à l'écran.
  const presenting = usePresentation()
  // Sous la seconde, « Terminé » seul : « en 0 s » ne dit rien.
  const parts: string[] = [
    facts.ms < 1000
      ? t('turnSummary.doneQuick')
      : t('turnSummary.done', { duration: turnDuration(facts.ms) })
  ]
  // Attente de l'utilisateur, hors de la durée (fiche 255) ; sous la seconde, rien.
  if (facts.waitedMs !== undefined && facts.waitedMs >= 1000) {
    parts.push(t('turnSummary.waited', { duration: turnDuration(facts.waitedMs) }))
  }
  if (facts.files > 0) {
    parts.push(
      t('turnSummary.files', {
        count: facts.files,
        added: countText(facts.added),
        removed: countText(facts.removed)
      })
    )
  }
  if (facts.cost && !presenting) parts.push(formatEstimate(facts.cost))
  return (
    <div className="turn-summary" data-testid="turn-summary">
      <CircleCheck size={13} />
      <span>{parts.join(' · ')}</span>
    </div>
  )
}
