import { CircleCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { conversationChanges } from '@shared/changes'
import type { TranscriptItem } from '@shared/transcript'
import { formatCost, turnCost, type ConversationUsage } from '@shared/usage'
import { usePresentation } from '../../presentation'
import { turnDuration } from '../../time'
import { countText } from '@shared/i18n/format'

export interface TurnFacts {
  ms: number
  files: number
  added: number
  removed: number
  cost?: { amount: number; currency: string }
}

/**
 * Bilan du dernier tour (fiche 185, idée P4) : sa durée, les fichiers qu'il a modifiés et son
 * coût, quand l'agent le donne. Rien tant que le tour n'a pas de réponse finie.
 */
export function lastTurnFacts(
  items: readonly TranscriptItem[],
  durations: ReadonlyMap<number, number>,
  usage: ConversationUsage | undefined
): TurnFacts | undefined {
  const start = items.findLastIndex((item) => item.kind === 'user')
  if (start < 0) return undefined
  const turn = items.slice(start + 1)
  // Tour arrêté, refusé, coupé ou en erreur : son avis le dit déjà, pas de « Terminé ✓ ».
  if (turn.some(endedBadly)) return undefined
  const reply = turn.findLast((item) => item.kind === 'agent')
  const ms = reply && durations.get(reply.id)
  if (ms === undefined || !reply) return undefined
  const changes = conversationChanges(turn)
  const added = changes.reduce((sum, change) => sum + change.added, 0)
  const removed = changes.reduce((sum, change) => sum + change.removed, 0)
  const sentAt = (items[start] as Extract<TranscriptItem, { kind: 'user' }>).at ?? 0
  const last = usage?.turns?.at(-1)
  const amount = last && (last.at ?? 0) >= sentAt ? turnCost(last) : undefined
  const currency = usage?.cost?.currency
  return {
    ms,
    files: changes.length,
    added,
    removed,
    ...(amount !== undefined && amount > 0 && currency ? { cost: { amount, currency } } : {})
  }
}

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
  if (facts.files > 0) {
    parts.push(
      t('turnSummary.files', {
        count: facts.files,
        added: countText(facts.added),
        removed: countText(facts.removed)
      })
    )
  }
  if (facts.cost && !presenting) parts.push(t('turnSummary.cost', { cost: formatCost(facts.cost) }))
  return (
    <div className="turn-summary" data-testid="turn-summary">
      <CircleCheck size={13} />
      <span>{parts.join(' · ')}</span>
    </div>
  )
}
