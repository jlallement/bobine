import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDuration } from '@shared/subagent'
import { formatCost, formatTokens } from '@shared/usage'
import type { DatedScope } from '@shared/usage-periods'
import type { UsageBucket, UsageBucketKind, UsageSeries } from '@shared/usage-stats'
import {
  axisBuckets,
  bucketLabel,
  cellValue,
  durationScale,
  durationTick,
  isOther,
  niceScale,
  seriesColor,
  tickLabel,
  type ChartGrouping,
  type ChartMetric
} from '../../usage-board'

const HEIGHT = 170
const PAD_LEFT = 34
/** Graduations de durée (« 1 h 30 ») : un peu plus de place à gauche. */
const PAD_LEFT_TIME = 46
const PAD_TOP = 8
const PAD_BOTTOM = 20
/** Filet entre deux segments empilés (fond de la carte). */
const GAP = 2

/** Barre à coins arrondis en haut seulement (le bas repose sur la base ou le segment du dessous). */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h))
  return (
    `M${x},${y + h}V${y + radius}` +
    `Q${x},${y} ${x + radius},${y}H${x + w - radius}` +
    `Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`
  )
}

/** Largeur réelle du graphique (le texte reste net, sans étirement). */
function useWidth(): [(element: HTMLDivElement | null) => void, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0)
      if (next > 0) setWidth(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, width]
}

/**
 * Graphique de « Mon activité » (fiches 137 et 144), en SVG fait maison : barres empilées par
 * série (agent ou modèle), séparées d'un filet, grille discrète, axe des seaux (heures d'un jour,
 * jours d'une semaine ou d'un mois, mois de l'année), et une infobulle au survol d'un seau. Les
 * couleurs viennent des jetons `--chart-*` : une série garde la sienne, quelle que soit la période.
 */
export function UsageChart({
  buckets: days,
  kind,
  scope,
  series,
  grouping,
  metric
}: {
  buckets: readonly UsageBucket[]
  kind: UsageBucketKind
  scope: DatedScope | 'all'
  series: readonly UsageSeries[]
  grouping: ChartGrouping
  metric: ChartMetric
}) {
  const { t } = useTranslation()
  const [box, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const cellsOf = (day: UsageBucket) => (grouping === 'agent' ? day.byAgent : day.byModel)
  const totals = days.map((day) =>
    series.reduce((sum, s) => sum + cellValue(cellsOf(day)[s.key], metric), 0)
  )
  const max = Math.max(0, ...totals)
  if (days.length === 0 || max === 0) {
    return (
      <div className="usage-chart" ref={box}>
        <div className="usage-chart-empty" data-testid="usage-chart-empty">
          {t('usage.board.chart.empty')}
        </div>
      </div>
    )
  }
  const time = metric.kind === 'time'
  const { top, step } = time ? durationScale(max) : niceScale(max)
  const padLeft = time ? PAD_LEFT_TIME : PAD_LEFT
  const plot = HEIGHT - PAD_TOP - PAD_BOTTOM
  const y = (value: number) => PAD_TOP + plot - (value / top) * plot
  const slot = (width - padLeft) / days.length
  const barWidth = Math.max(1, Math.min(28, slot - Math.min(6, slot * 0.25)))
  const xOf = (i: number) => padLeft + i * slot + (slot - barWidth) / 2
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const format = (value: number) =>
    metric.kind === 'cost'
      ? formatCost({ amount: value, currency: metric.unit })
      : metric.kind === 'tokens'
        ? formatTokens(value, true)
        : time
          ? formatDuration(value * 60_000)
          : String(value)
  const hovered = hover === null ? undefined : days[hover]
  return (
    <div className="usage-chart" ref={box} onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={t('activity.chart.label')}
        data-testid="usage-chart"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="usage-chart-grid" x1={padLeft} x2={width} y1={y(tick)} y2={y(tick)} />
            <text x={padLeft - 6} y={y(tick) + 4} textAnchor="end">
              {time ? durationTick(tick) : tickLabel(tick)}
            </text>
          </g>
        ))}
        {hover !== null && (
          <rect
            className="usage-chart-hover"
            x={padLeft + hover * slot + 1}
            y={PAD_TOP}
            width={Math.max(1, slot - 2)}
            height={plot}
            rx={3}
          />
        )}
        {days.map((day, i) => {
          let base = 0
          const stacked = series
            .map((s) => ({ s, value: cellValue(cellsOf(day)[s.key], metric) }))
            .filter((part) => part.value > 0)
          return (
            <g key={day.key} data-testid="usage-bar" data-bucket={day.key}>
              {stacked.map(({ s, value }, k) => {
                const bottom = y(base)
                base += value
                const topY = y(base)
                // Un filet sous chaque segment posé sur un autre.
                const h = Math.max(0, bottom - topY - (k > 0 ? GAP : 0))
                return (
                  <path
                    key={s.key}
                    d={barPath(xOf(i), topY, barWidth, h, k === stacked.length - 1 ? 3 : 0)}
                    fill={seriesColor(s.slot)}
                    data-series={s.key}
                  />
                )
              })}
            </g>
          )
        })}
        {axisBuckets(kind, days.length).map((i) => (
          <text
            key={i}
            x={Math.min(width - 2, Math.max(padLeft, xOf(i) + barWidth / 2))}
            y={HEIGHT - 4}
            textAnchor={i === days.length - 1 && days.length > 7 ? 'end' : 'middle'}
          >
            {bucketLabel(kind, days[i]?.key ?? '', scope)}
          </text>
        ))}
        {days.map((day, i) => (
          <rect
            key={day.key}
            className="usage-chart-hit"
            x={padLeft + i * slot}
            y={0}
            width={slot}
            height={HEIGHT - PAD_BOTTOM}
            onMouseEnter={() => setHover(i)}
            data-testid="usage-day"
          />
        ))}
      </svg>
      {hovered && hover !== null && (
        <div
          className={`usage-chart-tip${hover > days.length / 2 ? ' left' : ''}`}
          style={{ left: padLeft + (hover + 0.5) * slot }}
          data-testid="usage-chart-tip"
        >
          <strong>{bucketLabel(kind, hovered.key, scope, true)}</strong>
          {series.map((s) => {
            const value = cellValue(cellsOf(hovered)[s.key], metric)
            return (
              <span key={s.key} className={value ? '' : 'none'}>
                <i style={{ background: seriesColor(s.slot) }} />
                {isOther(s) ? t('usage.board.other') : s.label} · {format(value)}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
