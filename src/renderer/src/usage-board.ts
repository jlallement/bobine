/**
 * Calculs d'affichage de « Mon activité » (fiches 137, 144 et 147), purs et testés : valeur d'une
 * métrique, échelle du graphique, unités de coût dans l'ordre de leur usage, agents qu'une mesure
 * couvre, dates et périodes, niveaux de la grille d'activité, écarts à la période précédente.
 */
import { currentLocale, numberFormat } from '@shared/i18n/format'
import { addDays, dateOfDay, mondayOf, type DatedScope } from '@shared/usage-periods'
import {
  OTHER_SERIES,
  type CostMap,
  type UsageBucketKind,
  type UsageCell,
  type UsageModelRow,
  type UsageSeries,
  type UsageStats
} from '@shared/usage-stats'

/** Métrique du graphique : échanges, temps de travail, jetons, ou coût dans une unité. */
export type ChartMetric =
  { kind: 'turns' } | { kind: 'time' } | { kind: 'tokens' } | { kind: 'cost'; unit: string }

/** Regroupement du graphique (et couleur des pastilles de « Par modèle »). */
export type ChartGrouping = 'agent' | 'model'

export const metricId = (metric: ChartMetric): string =>
  metric.kind === 'cost' ? `cost:${metric.unit}` : metric.kind

export function cellValue(cell: UsageCell | undefined, metric: ChartMetric): number {
  if (!cell) return 0
  if (metric.kind === 'turns') return cell.turns
  // Le temps se compte en minutes : graduations et barres en restent lisibles.
  if (metric.kind === 'time') return cell.durationMs / 60_000
  if (metric.kind === 'tokens') return cell.tokens
  return cell.costs[metric.unit] ?? 0
}

/** Variable CSS de la couleur d'une série : `--chart-1…3`, ou « Autres ». */
export const seriesColor = (slot: number | null): string =>
  slot === null ? 'var(--chart-other)' : `var(--chart-${slot + 1})`

/** Séries du regroupement choisi. */
export const seriesOf = (stats: UsageStats, grouping: ChartGrouping): UsageSeries[] =>
  grouping === 'agent' ? stats.agentSeries : stats.modelSeries

/**
 * Unités de coût de la période, la plus utilisée (en échanges) d'abord : c'est elle que montrent
 * le chiffre clé et la métrique « Coût » par défaut.
 */
export function costUnits(rows: readonly UsageModelRow[]): string[] {
  const uses = new Map<string, number>()
  for (const row of rows) {
    for (const [unit, turns] of Object.entries(row.costTurns)) {
      uses.set(unit, (uses.get(unit) ?? 0) + turns)
    }
  }
  return [...uses].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([unit]) => unit)
}

/**
 * Agents qu'une mesure couvre, et ceux qu'elle laisse de côté, dans la période (fiche 147) : des
 * jetons, ou un coût dans l'unité, sur au moins un de leurs tours. Lu dans le journal, jamais
 * d'après le nom de l'agent. Vide quand la mesure couvre tout le monde (échanges, temps compris).
 */
export function metricCoverage(
  rows: readonly UsageModelRow[],
  metric: ChartMetric
): { covered: string[]; missing: string[] } {
  if (metric.kind === 'turns' || metric.kind === 'time') return { covered: [], missing: [] }
  const agents = new Map<string, { label: string; covered: boolean }>()
  for (const row of rows) {
    const has =
      metric.kind === 'tokens' ? row.turns > row.turnsWithoutTokens : !!row.costTurns[metric.unit]
    const agent = agents.get(row.profileId) ?? { label: row.agentLabel, covered: false }
    agent.covered ||= has
    agents.set(row.profileId, agent)
  }
  const all = [...agents.values()]
  const covered = all.filter((a) => a.covered).map((a) => a.label)
  const missing = all.filter((a) => !a.covered).map((a) => a.label)
  return covered.length > 0 && missing.length > 0
    ? { covered, missing }
    : { covered: [], missing: [] }
}

/** Agents qui ont un coût dans cette unité (« et 0,00 $ (OpenCode) »). */
export function agentsWithUnit(rows: readonly UsageModelRow[], unit: string): string[] {
  return [...new Set(rows.filter((r) => r.costTurns[unit]).map((r) => r.agentLabel))]
}

/** Coût par échange d'une ligne, dans une unité ; `undefined` s'il est nul ou inconnu. */
export function costPerTurn(row: UsageModelRow, unit: string): number | undefined {
  const turns = row.costTurns[unit]
  const amount = row.costs[unit]
  if (!turns || amount === undefined || amount <= 0) return undefined
  return Math.round((amount / turns) * 1e6) / 1e6
}

/** Unités d'un relevé de coûts, dans l'ordre donné, puis les autres. */
export function orderedCosts(costs: CostMap, order: readonly string[]): [string, number][] {
  const rank = (unit: string) => {
    const i = order.indexOf(unit)
    return i < 0 ? order.length : i
  }
  return Object.entries(costs).sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
}

/** Graduation « ronde » au-dessus de `max` : 1, 2 ou 5 × 10^n par pas, trois ou quatre pas. */
export function niceScale(max: number): { top: number; step: number } {
  if (!(max > 0)) return { top: 1, step: 1 }
  const rough = max / 3
  const power = 10 ** Math.floor(Math.log10(rough))
  const clean = (n: number) => Math.round(n * 1e9) / 1e9
  const step = clean([1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power)
  return { top: clean(Math.ceil(clean(max / step)) * step), step }
}

/** Pas d'une graduation de durée, en minutes : des valeurs rondes à l'horloge. */
const DURATION_STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 480, 720, 1440]

/** Échelle d'un graphique en minutes : trois graduations environ, sur des valeurs d'horloge. */
export function durationScale(maxMinutes: number): { top: number; step: number } {
  if (!(maxMinutes > 0)) return { top: 1, step: 1 }
  const rough = maxMinutes / 3
  const step = DURATION_STEPS.find((s) => s >= rough) ?? Math.ceil(rough / 1440) * 1440
  return { top: Math.ceil(maxMinutes / step) * step, step }
}

/** Graduation d'une durée en minutes : « 20 min », « 1 h », « 1 h 30 ». */
export function durationTick(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const hours = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`
}

/** Date d'un jour `AAAA-MM-JJ` (minuit local). */
export const dateOf = dateOfDay

const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString(currentLocale(), options)

/** « 21 oct. » ; avec le jour de la semaine : « mar. 21 oct. ». */
export function dayLabel(day: string, weekday = false): string {
  return dateOf(day).toLocaleDateString(currentLocale(), {
    day: 'numeric',
    month: 'short',
    ...(weekday ? { weekday: 'short' } : {})
  })
}

/** Date d'un seau (`AAAA-MM-JJTHH`, `AAAA-MM-JJ`, `AAAA-MM`). */
function bucketDate(kind: UsageBucketKind, key: string): Date {
  if (kind === 'month') return dateOfDay(`${key}-01`)
  const date = dateOfDay(key.slice(0, 10))
  if (kind === 'hour') date.setHours(Number(key.slice(11, 13)))
  return date
}

/**
 * Libellé d'un seau sur l'axe : « 14 h » (« 2 PM »), « lun. 19 » dans une semaine, « 19 oct. »
 * dans un mois, « nov. » ; `long` pour l'infobulle : « mar. 20 oct., 14 h », « novembre 2025 ».
 */
export function bucketLabel(
  kind: UsageBucketKind,
  key: string,
  scope: DatedScope | 'all',
  long = false
): string {
  const date = bucketDate(kind, key)
  if (kind === 'hour') {
    // « 0 h » plutôt que « 00 h ».
    const hour = date
      .toLocaleTimeString(currentLocale(), { hour: 'numeric' })
      .replace(/^0(?=\d)/, '')
    return long ? `${dayLabel(key.slice(0, 10), true)}, ${hour}` : hour
  }
  if (kind === 'month') {
    return format(date, long ? { month: 'long', year: 'numeric' } : { month: 'short' })
  }
  if (long) return dayLabel(key, true)
  return scope === 'week' ? format(date, { weekday: 'short', day: 'numeric' }) : dayLabel(key)
}

/** Seaux dont l'axe montre le libellé : toutes les heures rondes de 6, tous les jours de la semaine… */
export function axisBuckets(kind: UsageBucketKind, count: number): number[] {
  if (kind === 'hour') return [0, 6, 12, 18].filter((h) => h < count)
  if (kind === 'month' || count <= 7) return [...Array(count).keys()]
  return axisDays(count)
}

/**
 * Libellé d'une période : « 19 – 25 oct. 2026 », « 28 sept. – 4 oct. 2026 », « octobre 2026 »,
 * « nov. 2025 – oct. 2026 », « mardi 20 octobre 2026 ».
 */
export function periodLabel(scope: DatedScope, day: string): string {
  const date = dateOfDay(day)
  switch (scope) {
    case 'day':
      return format(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    case 'month':
      return format(date, { month: 'long', year: 'numeric' })
    case 'year': {
      const from = new Date(date.getFullYear(), date.getMonth() - 11, 1)
      return range(from, date, { month: 'short', year: 'numeric' })
    }
    case 'week':
      return range(dateOfDay(mondayOf(day)), dateOfDay(addDays(mondayOf(day), 6)), {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
  }
}

/** Intervalle de dates à la manière de la langue : « 19–25 oct. 2026 », « Oct 19 – 25, 2026 ». */
function range(from: Date, to: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(currentLocale(), options).formatRange(from, to)
}

/** « mardi », pour la moyenne d'un jour de la semaine. */
export const weekdayName = (day: string): string => format(dateOfDay(day), { weekday: 'long' })

/** « septembre » : le mois d'avant, pour « vs septembre ». */
export function previousMonthName(day: string): string {
  const date = dateOfDay(day)
  return format(new Date(date.getFullYear(), date.getMonth() - 1, 1), { month: 'long' })
}

/**
 * Niveau d'un jour dans la grille (0 : rien, 1 à 4), d'après son rang parmi les valeurs des jours
 * actifs de la grille : le plus actif est au niveau 4, le moins actif au 1, et un jour
 * exceptionnel n'écrase pas les autres (ce n'est pas une échelle linéaire).
 */
export function heatLevels(counts: readonly number[]): (count: number) => number {
  const values = [...new Set(counts.filter((n) => n > 0))].sort((a, b) => a - b)
  const last = values.length - 1
  return (count) => {
    if (count <= 0 || last < 0) return 0
    if (last === 0) return 4
    const rank = values.filter((v) => v <= count).length - 1
    return 1 + Math.round((3 * Math.max(0, rank)) / last)
  }
}

/** Écart d'un chiffre à la période de comparaison : sens, et part (en %) ou rapport. */
export interface Delta {
  direction: 'up' | 'down' | 'flat'
  /** (actuel − avant) / avant, arrondi au pour cent. */
  percent: number
  /** actuel / avant. */
  ratio: number
}

export function deltaOf(current: number, previous: number | undefined): Delta | undefined {
  if (previous === undefined || !(previous > 0)) return undefined
  const percent = Math.round(((current - previous) / previous) * 100)
  return {
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
    percent: Math.abs(percent),
    ratio: Math.round((current / previous) * 10) / 10
  }
}

/** Jours dont l'axe montre la date : le premier, le dernier, et trois entre les deux. */
export function axisDays(count: number): number[] {
  if (count <= 0) return []
  if (count <= 5) return [...Array(count).keys()]
  const marks = [0, 1, 2, 3].map((i) => Math.round((i * (count - 1)) / 4))
  return [...new Set([...marks, count - 1])]
}

/** Valeur d'une graduation (« 1,5 », « 20 k »). */
export function tickLabel(value: number): string {
  if (value >= 10_000) {
    return value >= 1_000_000
      ? `${numberFormat({ maximumFractionDigits: 1 }).format(value / 1_000_000)} M`
      : `${numberFormat({ maximumFractionDigits: 0 }).format(value / 1000)} k`
  }
  return numberFormat({ maximumFractionDigits: 3 }).format(value)
}

/** La série « Autres » est-elle celle-ci ? */
export const isOther = (series: Pick<UsageSeries, 'key'>): boolean => series.key === OTHER_SERIES
