/**
 * Lecture du journal de consommation (fiche 130) pour le tableau à venir (fiche 137) : les tours
 * d'une période, d'un agent ou d'un modèle, regroupés par jour, par modèle et par projet.
 *
 * Fonctions pures sur les lignes : le découpage par jour se fait ici, dans le fuseau de
 * l'utilisateur (la base ne garde que des millisecondes UTC). Les coûts restent rangés par unité :
 * des dollars et des bobcoins ne s'additionnent jamais.
 */
import type { TurnFilter, TurnRow, UsageDb } from './usage-db'

export interface UsageTotals {
  /** Échanges (tours). */
  turns: number
  /** Temps des tours finis (ms). */
  durationMs: number
  input: number
  output: number
  cachedRead: number
  cachedWrite: number
  thought: number
  total: number
  /** Coût par unité (« USD », « bobcoins »…), jamais additionné d'une unité à l'autre. */
  costs: Record<string, number>
  /** Tours sans aucun jeton rapporté (Bob : rien par ACP). */
  turnsWithoutTokens: number
}

export interface UsageGroup extends UsageTotals {
  key: string
  /** Libellé lisible : nom du modèle, dossier du projet ; la clé si rien de mieux. */
  label: string
}

export interface UsageReport {
  totals: UsageTotals
  /** Par jour (`AAAA-MM-JJ` local), dans l'ordre. */
  byDay: UsageGroup[]
  /** Par modèle (`<profil>:<modèle>`, ou le profil seul s'il n'en annonce pas). */
  byModel: UsageGroup[]
  /** Par projet : racine du dépôt (worktrees regroupés), sinon le dossier. */
  byProject: UsageGroup[]
  /** Par agent (profil). */
  byAgent: UsageGroup[]
}

export const emptyTotals = (): UsageTotals => ({
  turns: 0,
  durationMs: 0,
  input: 0,
  output: 0,
  cachedRead: 0,
  cachedWrite: 0,
  thought: 0,
  total: 0,
  costs: {},
  turnsWithoutTokens: 0
})

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Jour local d'une heure UTC (ms), en `AAAA-MM-JJ`. */
export function localDay(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function add(totals: UsageTotals, row: TurnRow): void {
  totals.turns += 1
  if (row.endedAt !== undefined && row.endedAt >= row.startedAt) {
    totals.durationMs += row.endedAt - row.startedAt
  }
  const t = row.tokens
  totals.input += t.input ?? 0
  totals.output += t.output ?? 0
  totals.cachedRead += t.cachedRead ?? 0
  totals.cachedWrite += t.cachedWrite ?? 0
  totals.thought += t.thought ?? 0
  totals.total += t.total ?? 0
  if (Object.keys(t).length === 0) totals.turnsWithoutTokens += 1
  if (row.cost) {
    const { amount, currency } = row.cost
    totals.costs[currency] = round6((totals.costs[currency] ?? 0) + amount)
  }
}

const modelKey = (row: TurnRow) => (row.model ? `${row.profileId}:${row.model.id}` : row.profileId)
const modelLabel = (row: TurnRow) => row.model?.name ?? row.profileLabel ?? row.profileId
const projectKey = (row: TurnRow) => row.repoRoot ?? row.workspace ?? ''

function grouped(
  rows: readonly TurnRow[],
  keyOf: (row: TurnRow) => string,
  labelOf: (row: TurnRow) => string
): UsageGroup[] {
  const groups = new Map<string, UsageGroup>()
  for (const row of rows) {
    const key = keyOf(row)
    let group = groups.get(key)
    if (!group) {
      group = { key, label: labelOf(row), ...emptyTotals() }
      groups.set(key, group)
    }
    add(group, row)
  }
  return [...groups.values()]
}

/** Regroupe des tours (pur) ; `dayOf` donne le jour d'une heure UTC (fuseau local par défaut). */
export function aggregateTurns(
  rows: readonly TurnRow[],
  dayOf: (ms: number) => string = localDay
): UsageReport {
  const totals = emptyTotals()
  for (const row of rows) add(totals, row)
  const byDay = grouped(
    rows,
    (r) => dayOf(r.startedAt),
    (r) => dayOf(r.startedAt)
  ).sort((a, b) => a.key.localeCompare(b.key))
  const byTurns = (a: UsageGroup, b: UsageGroup) => b.turns - a.turns || a.key.localeCompare(b.key)
  return {
    totals,
    byDay,
    byModel: grouped(rows, modelKey, modelLabel).sort(byTurns),
    byProject: grouped(rows, projectKey, (r) => projectKey(r)).sort(byTurns),
    byAgent: grouped(
      rows,
      (r) => r.profileId,
      (r) => r.profileLabel ?? r.profileId
    ).sort(byTurns)
  }
}

/** Requête du tableau : tours de la période (agent, modèle) lus dans la base, puis regroupés. */
export function usageReport(
  db: Pick<UsageDb, 'select'>,
  filter: TurnFilter = {},
  dayOf?: (ms: number) => string
): UsageReport {
  return aggregateTurns(db.select(filter), dayOf)
}
