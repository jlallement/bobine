import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { usePresentation } from '../../presentation'
import { numberFormat } from '@shared/i18n/format'
import { formatDuration } from '@shared/subagent'
import { formatCost, formatTokens } from '@shared/usage'
import type { UsageStats } from '@shared/usage-stats'
import {
  agentsWithUnit,
  deltaOf,
  metricCoverage,
  previousMonthName,
  weekdayName,
  type Delta
} from '../../usage-board'

/**
 * Les quatre chiffres clés de « Mon activité » (fiches 137, 144 et 147) : échanges et temps de
 * travail, comparables entre agents, puis jetons traités (avec les agents qui les communiquent,
 * s'ils ne le font pas tous) et coût par unité ; sous chacun, l'écart à la période de comparaison,
 * en texte discret (jamais vert ni rouge : plus d'échanges n'est ni bien ni mal).
 */
export function ActivityKpis({ stats, units }: { stats: UsageStats; units: string[] }) {
  const { t } = useTranslation()
  // Mode présentation (fiche 159) : ni coût ni compte.
  const presenting = usePresentation()
  const { totals, comparison } = stats
  const before = comparison?.totals
  const noTokens = totals.turns > 0 && totals.turnsWithoutTokens === totals.turns
  const [main, ...others] = units
  const mainCost = main === undefined ? undefined : totals.costs[main]
  const average = totals.finishedTurns ? totals.durationMs / totals.finishedTurns : undefined
  const tokensBy = metricCoverage(stats.byModel, { kind: 'tokens' }).covered
  // Un jour ne montre que le rapport de ses échanges à la moyenne de son jour de la semaine.
  const weekday = comparison?.kind === 'weekday'
  const turnsDelta = deltaOf(totals.turns, before?.turns)
  const turnsText = (delta: Delta): string => {
    const amount = deltaText(t, delta)
    if (weekday) {
      const ratio = numberFormat({ maximumFractionDigits: 1 }).format(delta.ratio)
      return t('activity.delta.weekday', { ratio, weekday: weekdayName(stats.query.date) })
    }
    if (stats.query.scope === 'month') {
      const month = previousMonthName(stats.query.date)
      return comparison?.sameDate
        ? t('activity.delta.monthToDate', { delta: amount, month })
        : t('activity.delta.month', { delta: amount, month })
    }
    return comparison?.sameDate
      ? t('activity.delta.weekToDate', { delta: amount })
      : t('activity.delta.week', { delta: amount })
  }
  const other = (current: number, previous: number | undefined, show: (n: number) => string) => {
    if (weekday) return undefined
    const delta = deltaOf(current, previous)
    return (
      delta && <DeltaLine delta={delta} text={deltaText(t, delta)} before={show(previous ?? 0)} />
    )
  }
  return (
    <div className="usage-kpis" data-testid="usage-kpis">
      <Kpi
        label={t('usage.board.kpi.turns')}
        value={String(totals.turns)}
        sub={t('usage.board.kpi.conversations', { count: totals.conversations })}
        delta={
          turnsDelta && (
            <DeltaLine
              delta={turnsDelta}
              text={turnsText(turnsDelta)}
              before={numberFormat({ maximumFractionDigits: 1 }).format(before?.turns ?? 0)}
            />
          )
        }
        testId="usage-kpi-turns"
      />
      <Kpi
        label={t('usage.board.kpi.time')}
        value={totals.durationMs ? formatDuration(totals.durationMs) : '—'}
        sub={
          average === undefined
            ? ''
            : t('usage.board.kpi.perTurn', { duration: formatDuration(average) })
        }
        delta={other(totals.durationMs, before?.durationMs, (n) => formatDuration(n))}
        testId="usage-kpi-time"
      />
      <Kpi
        label={
          tokensBy.length > 0
            ? t('usage.board.kpi.tokensOf', { agents: tokensBy.join(', ') })
            : t('usage.board.kpi.tokens')
        }
        value={
          totals.turns === 0
            ? '—'
            : noTokens
              ? t('usage.board.unknown')
              : formatTokens(totals.input + totals.output, true)
        }
        sub={
          totals.turns === 0
            ? ''
            : noTokens
              ? t('usage.board.kpi.tokensUnknown')
              : t('usage.board.kpi.inOut', {
                  input: formatTokens(totals.input, true),
                  output: formatTokens(totals.output, true)
                })
        }
        delta={
          !noTokens &&
          other(totals.input + totals.output, before?.tokens, (n) =>
            formatTokens(Math.round(n), true)
          )
        }
        testId="usage-kpi-tokens"
      />
      {!presenting && (
        <Kpi
          label={t('usage.board.kpi.cost')}
          value={
            totals.turns === 0
              ? '—'
              : main === undefined || mainCost === undefined
                ? t('usage.board.unknown')
                : formatCost({ amount: mainCost, currency: main })
          }
          sub={
            others.length > 0
              ? others
                  .map((unit) =>
                    t('usage.board.kpi.andCost', {
                      cost: formatCost({ amount: totals.costs[unit] ?? 0, currency: unit }),
                      agents: agentsWithUnit(stats.byModel, unit).join(', ')
                    })
                  )
                  .join(' · ')
              : totals.turnsWithoutCost > 0 && totals.turns > 0
                ? t('usage.board.kpi.withoutCost', { count: totals.turnsWithoutCost })
                : main !== undefined && mainCost !== undefined && totals.turns > 0
                  ? t('usage.board.kpi.costPerTurn', {
                      cost: formatCost({ amount: mainCost / totals.turns, currency: main })
                    })
                  : ''
          }
          delta={
            main !== undefined &&
            mainCost !== undefined &&
            other(mainCost, before?.costs[main], (n) => formatCost({ amount: n, currency: main }))
          }
          testId="usage-kpi-cost"
        />
      )}
    </div>
  )
}

/** « 18 % », ou « stable ». */
function deltaText(t: TFunction, delta: Delta): string {
  return delta.direction === 'flat'
    ? t('activity.delta.stable')
    : t('activity.delta.percent', { percent: delta.percent })
}

function DeltaLine({ delta, text, before }: { delta: Delta; text: string; before: string }) {
  const { t } = useTranslation()
  const Arrow =
    delta.direction === 'up'
      ? ArrowUpRight
      : delta.direction === 'down'
        ? ArrowDownRight
        : ArrowRight
  return (
    <div
      className="activity-delta"
      title={t('activity.delta.tip', { value: before })}
      data-direction={delta.direction}
      data-testid="activity-delta"
    >
      <Arrow size={13} aria-hidden />
      {text}
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  delta,
  testId
}: {
  label: string
  value: string
  sub: string
  delta?: ReactNode
  testId: string
}) {
  return (
    <div className="usage-kpi" data-testid={testId}>
      <div className="usage-kpi-label">{label}</div>
      <div className="usage-kpi-value">{value}</div>
      {sub && <div className="usage-kpi-sub">{sub}</div>}
      {delta}
    </div>
  )
}
