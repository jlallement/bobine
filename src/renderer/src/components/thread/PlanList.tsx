import { CircleCheck, CircleDashed, CircleDot, LoaderCircle } from 'lucide-react'
import type { PlanEntry } from '../../../../shared/acp-sdk.mts'
import type { TranscriptItem } from '@shared/transcript'

const PLAN_ICONS = {
  pending: CircleDashed,
  in_progress: CircleDot,
  completed: CircleCheck
} as const

/** Icône d'une tâche ; `live` : l'agent y travaille en ce moment, le cercle tourne. */
export function PlanIcon({
  status,
  live = false
}: {
  status: PlanEntry['status']
  live?: boolean
}) {
  if (live && status === 'in_progress') return <LoaderCircle size={14} className="spin" />
  const Icon = PLAN_ICONS[status]
  return <Icon size={14} />
}

/**
 * Entrées d'un plan de l'agent (fil, onglet « Tâches », liste épinglée). `live` : plan du tour en
 * cours, la tâche en cours a un cercle qui tourne (fiche 077).
 */
export function PlanList({ entries, live = false }: { entries: PlanEntry[]; live?: boolean }) {
  return (
    <ul className="plan-list">
      {entries.map((entry, i) => (
        <li
          key={i}
          className={entry.status}
          {...(entry.status === 'in_progress' ? { 'aria-current': 'step' as const } : {})}
        >
          <PlanIcon status={entry.status} live={live} />
          <span>{entry.content}</span>
        </li>
      ))}
    </ul>
  )
}

/** Dernier plan du fil, s'il y en a un. */
export function lastPlan<T extends { kind: string }>(
  items: readonly T[]
): Extract<T, { kind: 'plan' }> | undefined {
  return items.findLast((item): item is Extract<T, { kind: 'plan' }> => item.kind === 'plan')
}

/** Plan du tour en cours (après le dernier message de l'utilisateur), s'il y en a un. */
export function turnPlan<T extends { kind: string }>(
  items: readonly T[]
): Extract<T, { kind: 'plan' }> | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (!item || item.kind === 'user') return undefined
    if (item.kind === 'plan') return item as Extract<T, { kind: 'plan' }>
  }
  return undefined
}

/**
 * Plan à épingler au-dessus de la zone de saisie (fiche 077) : celui du tour, tant que l'agent
 * travaille. Son fil n'en montre alors pas la carte, ni l'en-tête le compteur.
 */
export function pinnedPlanOf(
  items: readonly TranscriptItem[],
  busy: boolean
): Extract<TranscriptItem, { kind: 'plan' }> | undefined {
  const plan = busy ? turnPlan(items) : undefined
  return plan && plan.entries.length > 0 ? plan : undefined
}

/** Tâche à montrer seule (liste repliée) : en cours, sinon la prochaine à faire, sinon la dernière. */
export function currentEntry(entries: readonly PlanEntry[]): PlanEntry | undefined {
  return (
    entries.find((e) => e.status === 'in_progress') ??
    entries.find((e) => e.status === 'pending') ??
    entries.at(-1)
  )
}
