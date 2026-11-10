/**
 * Tableau de consommation (fiches 137 et 144) : statistiques calculées sur les lignes du journal
 * (fiche 130), pour une période de la page « Mon activité » (`usage-periods.ts`). Fonctions
 * pures : le jour d'une heure UTC est celui du fuseau de l'utilisateur (`localDay`), et `now` est
 * injecté.
 *
 * - Les coûts restent rangés par unité, jamais additionnés d'une unité à l'autre.
 * - « Jetons traités » = entrée + sortie (le cache et la réflexion n'y entrent pas).
 * - Couleurs du graphique : un agent prend l'emplacement que son profil déclare (`chartSlot`) ; un
 *   modèle, son rang dans la liste triée de **tous** les modèles du journal, pas de la période :
 *   une couleur suit l'entité, jamais son rang dans ce qui est affiché. Au-delà des emplacements :
 *   « Autres ».
 */
import { basename } from 'node:path'
import {
  CHART_SLOTS,
  OTHER_SERIES,
  type CostMap,
  type UsageBucket,
  type UsageBucketKind,
  type UsageCell,
  type UsageCompared,
  type UsageComparison,
  type UsageConversationRow,
  type UsageHeatDay,
  type UsageModelRow,
  type UsageProjectRow,
  type UsageQuery,
  type UsageSeries,
  type UsageStats,
  type UsageTotals
} from '@shared/usage-stats'
import {
  addDays,
  dateOfDay,
  dayKey,
  daysOf,
  isCurrent,
  previousRange,
  sameWeekdays,
  scopeRange
} from '@shared/usage-periods'
import { localDay } from './report'
import type { JournalSeries, TurnRow } from './usage-db'

/** Conversations listées dans « ont le plus consommé ». */
export const TOP_CONVERSATIONS = 10

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Bornes d'une requête (ms UTC) : début inclus, fin exclue. « all » va du premier tour du journal
 * (`first`) à demain minuit ; `undefined` si le journal est vide.
 */
export function queryRange(
  query: UsageQuery,
  now: Date,
  first: number | undefined
): { from: number; to: number } | undefined {
  if (query.scope === 'all') {
    if (first === undefined) return undefined
    const tomorrow = dateOfDay(addDays(dayKey(now), 1)).getTime()
    return { from: dateOfDay(dayKey(new Date(first))).getTime(), to: Math.max(tomorrow, first + 1) }
  }
  const { from, to } = scopeRange(query.scope, query.date)
  return { from: from.getTime(), to: to.getTime() }
}

/** Seau du graphique selon la période : heure pour un jour, mois pour l'année, jour sinon. */
export const bucketKind = (query: UsageQuery): UsageBucketKind =>
  query.scope === 'day' ? 'hour' : query.scope === 'year' ? 'month' : 'day'

const pad = (n: number) => String(n).padStart(2, '0')

/** Clé du seau d'une heure UTC. */
export function bucketOf(kind: UsageBucketKind, ms: number, dayOf: (ms: number) => string): string {
  if (kind === 'day') return dayOf(ms)
  if (kind === 'month') return dayOf(ms).slice(0, 7)
  return `${dayOf(ms)}T${pad(new Date(ms).getHours())}`
}

/** Clés des seaux d'une période, dans l'ordre. */
export function bucketKeys(kind: UsageBucketKind, from: number, to: number): string[] {
  const days = daysOf(new Date(from), new Date(to))
  if (kind === 'day') return days
  if (kind === 'month') return [...new Set(days.map((d) => d.slice(0, 7)))]
  return days.flatMap((day) => Array.from({ length: 24 }, (_, h) => `${day}T${pad(h)}`))
}

/**
 * Ce à quoi la période se compare (fiche 144) : la précédente (date égale si en cours) pour une
 * semaine ou un mois, le même jour de la semaine sur les douze semaines d'avant pour un jour (ceux
 * où le journal existait déjà). Rien pour l'année, « all », ou avant le premier tour du journal.
 */
export interface ComparisonPlan {
  kind: UsageComparison['kind']
  sameDate: boolean
  from: number
  to: number
  /** Jours retenus (même jour de la semaine) ; absent : toute la plage. */
  days?: string[]
}

export function comparisonPlan(
  query: UsageQuery,
  now: Date,
  first: number | undefined
): ComparisonPlan | undefined {
  if (first === undefined || query.scope === 'all' || query.scope === 'year') return undefined
  const firstDay = dayKey(new Date(first))
  if (query.scope === 'day') {
    const days = sameWeekdays(query.date).filter((d) => d >= firstDay)
    if (days.length === 0) return undefined
    const sorted = [...days].sort()
    return {
      kind: 'weekday',
      sameDate: false,
      from: dateOfDay(sorted[0] ?? query.date).getTime(),
      to: dateOfDay(addDays(sorted.at(-1) ?? query.date, 1)).getTime(),
      days
    }
  }
  const previous = previousRange(query.scope, query.date, now)
  if (!previous || previous.to.getTime() <= first) return undefined
  return {
    kind: 'previous',
    sameDate: previous.sameDate,
    from: previous.from.getTime(),
    to: previous.to.getTime()
  }
}

/** Totaux de la période de comparaison ; moyenne par jour pour le même jour de la semaine. */
export function compareRows(
  rows: readonly TurnRow[],
  plan: ComparisonPlan,
  dayOf: (ms: number) => string = localDay
): UsageComparison {
  const kept = plan.days ? new Set(plan.days) : undefined
  const totals: UsageCompared = { turns: 0, tokens: 0, durationMs: 0, costs: {} }
  for (const row of rows) {
    if (kept && !kept.has(dayOf(row.startedAt))) continue
    totals.turns += 1
    totals.tokens += tokensOf(row)
    if (row.endedAt !== undefined && row.endedAt >= row.startedAt) {
      totals.durationMs += row.endedAt - row.startedAt
    }
    addCost(totals.costs, row)
  }
  const days = plan.days?.length ?? 1
  if (days > 1) {
    totals.turns /= days
    totals.tokens /= days
    totals.durationMs /= days
    for (const unit of Object.keys(totals.costs)) {
      totals.costs[unit] = round6((totals.costs[unit] ?? 0) / days)
    }
  }
  return { kind: plan.kind, sameDate: plan.sameDate, days, totals }
}

export interface StatsContext {
  now: Date
  /** Début du premier tour du journal (« all »). */
  first?: number
  /** Comparaison déjà calculée (`comparisonPlan`, `compareRows`). */
  comparison?: UsageComparison
  /** Emplacement de couleur que le profil d'un agent déclare. */
  agentSlot: (profileId: string) => number | undefined
  /** Titre d'une conversation de l'historique ; `undefined` si elle a été supprimée. */
  title: (conversationId: string) => string | undefined
  /** Jour local d'une heure UTC (`localDay` par défaut). */
  dayOf?: (ms: number) => string
}

const tokensOf = (row: TurnRow) => (row.tokens.input ?? 0) + (row.tokens.output ?? 0)
const hasTokens = (row: TurnRow) => Object.keys(row.tokens).length > 0
const modelKey = (profileId: string, modelId: string | undefined) => `${profileId}:${modelId ?? ''}`

function addCost(costs: CostMap, row: TurnRow): void {
  if (!row.cost) return
  const { amount, currency } = row.cost
  costs[currency] = round6((costs[currency] ?? 0) + amount)
}

/** Durée d'un tour fini (ms) ; 0 pour un tour en cours ou à l'heure de fin incohérente. */
const durationOf = (row: TurnRow) =>
  row.endedAt !== undefined && row.endedAt >= row.startedAt ? row.endedAt - row.startedAt : 0

function addCell(cells: Record<string, UsageCell>, key: string, row: TurnRow): void {
  const cell = (cells[key] ??= { turns: 0, tokens: 0, costs: {}, durationMs: 0 })
  cell.turns += 1
  cell.tokens += tokensOf(row)
  cell.durationMs += durationOf(row)
  addCost(cell.costs, row)
}

/** Séries des agents et des modèles, à partir de tout le journal (couleurs fixes). */
export function seriesOf(
  journal: readonly JournalSeries[],
  agentSlot: StatsContext['agentSlot']
): { agents: UsageSeries[]; models: UsageSeries[] } {
  const labels = new Map<string, string>()
  for (const s of journal) {
    if (!labels.has(s.profileId) || s.profileLabel) {
      labels.set(s.profileId, s.profileLabel ?? labels.get(s.profileId) ?? s.profileId)
    }
  }
  const slotOf = (profileId: string) => {
    const slot = agentSlot(profileId)
    return slot !== undefined && slot >= 0 && slot < CHART_SLOTS ? slot : null
  }
  const rank = (profileId: string) => slotOf(profileId) ?? CHART_SLOTS
  const agents = [...labels].map(([key, label]) => ({ key, label, slot: slotOf(key) }))
  agents.sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label))
  const models = journal
    .map((s) => ({ profileId: s.profileId, model: s.model }))
    .sort(
      (a, b) =>
        rank(a.profileId) - rank(b.profileId) ||
        a.profileId.localeCompare(b.profileId) ||
        (a.model?.id ?? '').localeCompare(b.model?.id ?? '')
    )
    .map((s, i): UsageSeries => {
      const agentLabel = labels.get(s.profileId) ?? s.profileId
      return {
        key: modelKey(s.profileId, s.model?.id),
        label: s.model?.name ?? agentLabel,
        slot: i < CHART_SLOTS ? i : null,
        agentLabel
      }
    })
  return { agents, models }
}

/** Clé de série affichée : la sienne si elle a une couleur, « Autres » sinon. */
function seriesKey(series: ReadonlyMap<string, UsageSeries>, key: string): string {
  return series.get(key)?.slot === null || !series.has(key) ? OTHER_SERIES : key
}

/** Séries montrées : celles de la période, puis « Autres » s'il sert. */
function shownSeries(all: readonly UsageSeries[], used: ReadonlySet<string>): UsageSeries[] {
  const shown = all.filter((s) => s.slot !== null && used.has(s.key))
  if (used.has(OTHER_SERIES)) shown.push({ key: OTHER_SERIES, label: '', slot: null })
  return shown
}

const emptyTotals = (): UsageTotals => ({
  turns: 0,
  conversations: 0,
  durationMs: 0,
  finishedTurns: 0,
  input: 0,
  output: 0,
  costs: {},
  turnsWithoutTokens: 0,
  turnsWithoutCost: 0
})

function addTotals(totals: UsageTotals, row: TurnRow): void {
  totals.turns += 1
  if (row.endedAt !== undefined && row.endedAt >= row.startedAt) {
    totals.durationMs += row.endedAt - row.startedAt
    totals.finishedTurns += 1
  }
  totals.input += row.tokens.input ?? 0
  totals.output += row.tokens.output ?? 0
  if (!hasTokens(row)) totals.turnsWithoutTokens += 1
  if (row.cost) addCost(totals.costs, row)
  else totals.turnsWithoutCost += 1
}

function addModel(rows: Map<string, UsageModelRow>, row: TurnRow): void {
  const key = modelKey(row.profileId, row.model?.id)
  let entry = rows.get(key)
  if (!entry) {
    entry = {
      key,
      ...(row.model ? { model: row.model.name } : {}),
      profileId: row.profileId,
      agentLabel: row.profileLabel ?? row.profileId,
      turns: 0,
      input: 0,
      output: 0,
      turnsWithoutTokens: 0,
      costs: {},
      costTurns: {}
    }
    rows.set(key, entry)
  }
  entry.turns += 1
  entry.input += row.tokens.input ?? 0
  entry.output += row.tokens.output ?? 0
  if (!hasTokens(row)) entry.turnsWithoutTokens += 1
  if (row.cost) {
    addCost(entry.costs, row)
    entry.costTurns[row.cost.currency] = (entry.costTurns[row.cost.currency] ?? 0) + 1
  }
}

function addProject(rows: Map<string, UsageProjectRow>, row: TurnRow): void {
  const key = row.repoRoot ?? row.workspace ?? ''
  const entry = rows.get(key) ?? { key, name: key ? basename(key) : '', turns: 0, tokens: 0 }
  entry.turns += 1
  entry.tokens += tokensOf(row)
  rows.set(key, entry)
}

function addConversation(
  rows: Map<string, Omit<UsageConversationRow, 'title'>>,
  row: TurnRow
): void {
  const entry = rows.get(row.conversationId) ?? {
    id: row.conversationId,
    agentLabel: row.profileLabel ?? row.profileId,
    turns: 0,
    tokens: 0,
    costs: {}
  }
  entry.turns += 1
  entry.tokens += tokensOf(row)
  addCost(entry.costs, row)
  rows.set(row.conversationId, entry)
}

const byTurns = <T extends { turns: number; tokens?: number; key?: string; id?: string }>(
  a: T,
  b: T
) =>
  b.turns - a.turns ||
  (b.tokens ?? 0) - (a.tokens ?? 0) ||
  (a.key ?? a.id ?? '').localeCompare(b.key ?? b.id ?? '')

/**
 * Statistiques d'une période : `rows`, les tours de la période (et de l'agent filtré), du plus
 * ancien au plus récent ; `journal`, les couples agent, modèle de tout le journal.
 */
export function usageStats(
  rows: readonly TurnRow[],
  journal: readonly JournalSeries[],
  query: UsageQuery,
  context: StatsContext
): UsageStats {
  const dayOf = context.dayOf ?? localDay
  const { agents, models } = seriesOf(journal, context.agentSlot)
  const agentMap = new Map(agents.map((s) => [s.key, s]))
  const modelMap = new Map(models.map((s) => [s.key, s]))
  const kind = bucketKind(query)
  const range = queryRange(query, context.now, context.first ?? rows[0]?.startedAt)
  const buckets = new Map<string, UsageBucket>(
    (range ? bucketKeys(kind, range.from, range.to) : []).map((key) => [
      key,
      { key, byAgent: {}, byModel: {} }
    ])
  )
  const totals = emptyTotals()
  const conversations = new Map<string, Omit<UsageConversationRow, 'title'>>()
  const byModel = new Map<string, UsageModelRow>()
  const byProject = new Map<string, UsageProjectRow>()
  const usedAgents = new Set<string>()
  const usedModels = new Set<string>()
  for (const row of rows) {
    addTotals(totals, row)
    addModel(byModel, row)
    addProject(byProject, row)
    addConversation(conversations, row)
    const bucket = buckets.get(bucketOf(kind, row.startedAt, dayOf))
    if (!bucket) continue
    const agent = seriesKey(agentMap, row.profileId)
    const model = seriesKey(modelMap, modelKey(row.profileId, row.model?.id))
    usedAgents.add(agent)
    usedModels.add(model)
    addCell(bucket.byAgent, agent, row)
    addCell(bucket.byModel, model, row)
  }
  totals.conversations = conversations.size
  const today = dayKey(context.now)
  const days = range ? daysOf(new Date(range.from), new Date(range.to)) : [today]
  return {
    query,
    range: { first: days[0] ?? today, last: days.at(-1) ?? today },
    current: query.scope === 'all' || isCurrent(query.scope, query.date, context.now),
    bucket: kind,
    buckets: [...buckets.values()],
    agentSeries: shownSeries(agents, usedAgents),
    modelSeries: shownSeries(models, usedModels),
    totals,
    ...(context.comparison ? { comparison: context.comparison } : {}),
    byModel: [...byModel.values()].sort((a, b) => b.turns - a.turns || a.key.localeCompare(b.key)),
    byProject: [...byProject.values()].sort(byTurns),
    conversations: [...conversations.values()]
      .sort(byTurns)
      .slice(0, TOP_CONVERSATIONS)
      .map((c) => {
        const title = context.title(c.id)
        return title === undefined ? c : { ...c, title }
      }),
    agents: agents.map((s) => ({ profileId: s.key, label: s.label })),
    journalEmpty: journal.length === 0
  }
}

/**
 * Grille d'activité (fiche 144) : les échanges de chaque jour de l'étendue, et par agent ; `rows`,
 * les tours de l'étendue (et de l'agent filtré).
 */
export function heatmapOf(
  rows: readonly TurnRow[],
  days: readonly string[],
  dayOf: (ms: number) => string = localDay
): { days: UsageHeatDay[]; total: number } {
  const map = new Map<string, UsageHeatDay>(
    days.map((day) => [day, { day, turns: 0, byAgent: {} }])
  )
  let total = 0
  for (const row of rows) {
    const day = map.get(dayOf(row.startedAt))
    if (!day) continue
    day.turns += 1
    day.byAgent[row.profileId] = (day.byAgent[row.profileId] ?? 0) + 1
    total += 1
  }
  return { days: [...map.values()], total }
}

/** Années civiles passées (avant celle de `now`) depuis le premier tour, la plus récente d'abord. */
export function pastYears(first: number | undefined, now: Date): number[] {
  if (first === undefined) return []
  const years: number[] = []
  for (let y = now.getFullYear() - 1; y >= new Date(first).getFullYear(); y--) years.push(y)
  return years
}
