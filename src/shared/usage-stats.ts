/**
 * Tableau de consommation (fiches 137 et 144) : ce que le main calcule à partir du journal
 * (`usage.sqlite`, ADR-0025) et que la page « Mon activité » affiche. Les coûts restent rangés par
 * unité (« USD », « bobcoins ») : deux unités ne s'additionnent jamais, et rien n'est estimé
 * (fiche 019).
 */
import { isDayKey, USAGE_SCOPES, type HeatRange, type UsageScope } from './usage-periods'

export interface UsageQuery {
  scope: UsageScope
  /** Un jour de la période (`AAAA-MM-JJ`, heure locale) ; ignoré pour « all ». */
  date: string
  /** Un seul agent (profil) ; tous sinon. */
  profileId?: string
}

/** Grille d'activité (fiche 144) : douze derniers mois ou une année civile, un agent ou tous. */
export interface UsageHeatQuery {
  range: HeatRange
  profileId?: string
}

/** Exports CSV : une ligne par tour, ou une ligne par jour. */
export const USAGE_EXPORTS = ['turns', 'days'] as const
export type UsageExportKind = (typeof USAGE_EXPORTS)[number]

/** Montant par unité. */
export type CostMap = Record<string, number>

/** Ce qu'une série pèse dans un seau (heure, jour ou mois) : échanges, jetons traités (entrée + sortie), coûts. */
export interface UsageCell {
  turns: number
  tokens: number
  costs: CostMap
  /** Temps des tours finis (ms) : mesure « Temps » du graphique (fiche 147). */
  durationMs: number
}

/** Clé de la série qui regroupe ce qui n'a pas de couleur propre. */
export const OTHER_SERIES = '__other__'

/** Nombre de couleurs du graphique (`--chart-1…3`) ; au-delà : « Autres » (`--chart-other`). */
export const CHART_SLOTS = 3

/** Une série du graphique : un agent, ou un modèle. */
export interface UsageSeries {
  key: string
  label: string
  /** Couleur (0 à `CHART_SLOTS` - 1), fixée par l'entité, jamais par son rang ; `null` : « Autres ». */
  slot: number | null
  /** Agent du modèle (séries par modèle). */
  agentLabel?: string
}

/** Seaux du graphique : par heure (un jour), par jour (semaine, mois), par mois (année). */
export type UsageBucketKind = 'hour' | 'day' | 'month'

export interface UsageBucket {
  /** `AAAA-MM-JJTHH`, `AAAA-MM-JJ` ou `AAAA-MM`, à l'heure locale. */
  key: string
  /** Par clé de série. */
  byAgent: Record<string, UsageCell>
  byModel: Record<string, UsageCell>
}

export interface UsageTotals {
  turns: number
  conversations: number
  /** Temps des tours finis (ms), et leur nombre (pour la moyenne). */
  durationMs: number
  finishedTurns: number
  input: number
  output: number
  costs: CostMap
  /** Tours sans aucun jeton rapporté (Bob), sans coût annoncé. */
  turnsWithoutTokens: number
  turnsWithoutCost: number
}

/** Une ligne de « Par modèle ». */
export interface UsageModelRow {
  key: string
  /** Nom du modèle ; absent si l'agent n'en annonce pas (Bob). */
  model?: string
  profileId: string
  agentLabel: string
  turns: number
  input: number
  output: number
  turnsWithoutTokens: number
  costs: CostMap
  /** Tours qui ont un coût, par unité : le coût par échange se calcule sur eux. */
  costTurns: Record<string, number>
}

/** Une ligne de « Par projet » : la racine du dépôt (worktrees regroupés), sinon le dossier. */
export interface UsageProjectRow {
  key: string
  name: string
  turns: number
  tokens: number
}

/** Une conversation parmi celles qui ont le plus consommé. */
export interface UsageConversationRow {
  id: string
  /** Titre dans l'historique ; absent si la conversation a été supprimée. */
  title?: string
  agentLabel: string
  turns: number
  tokens: number
  costs: CostMap
}

/** Ce qui se compare d'une période à l'autre (fiche 144). */
export interface UsageCompared {
  turns: number
  /** Jetons traités : entrée + sortie. */
  tokens: number
  durationMs: number
  costs: CostMap
}

/**
 * Période de comparaison : la précédente (à date égale si l'affichée est en cours), ou, pour un
 * jour, la moyenne du même jour de la semaine (`days` jours, ceux où le journal existait déjà).
 */
export interface UsageComparison {
  kind: 'previous' | 'weekday'
  sameDate: boolean
  days: number
  totals: UsageCompared
}

export interface UsageStats {
  query: UsageQuery
  /** Premier et dernier jour de la période (`AAAA-MM-JJ`). */
  range: { first: string; last: string }
  /** La période contient aujourd'hui. */
  current: boolean
  bucket: UsageBucketKind
  /** Seaux de la période, vides compris, dans l'ordre. */
  buckets: UsageBucket[]
  agentSeries: UsageSeries[]
  modelSeries: UsageSeries[]
  totals: UsageTotals
  comparison?: UsageComparison
  byModel: UsageModelRow[]
  byProject: UsageProjectRow[]
  conversations: UsageConversationRow[]
  /** Agents présents dans le journal, toutes périodes confondues (filtre). */
  agents: { profileId: string; label: string }[]
  /** Le journal ne contient aucun tour (période et agent ignorés). */
  journalEmpty: boolean
}

/** Un jour de la grille d'activité : ses échanges, par agent (profil) aussi. */
export interface UsageHeatDay {
  day: string
  turns: number
  byAgent: Record<string, number>
}

export interface UsageHeatmap {
  query: UsageHeatQuery
  /** Tous les jours de l'étendue (jusqu'à aujourd'hui pour les douze derniers mois). */
  days: UsageHeatDay[]
  total: number
  today: string
  /** Années civiles passées depuis le premier tour du journal, la plus récente d’abord. */
  years: number[]
  /** Nom de chaque agent du journal. */
  labels: Record<string, string>
}

/** Dépense récente d'un agent sur ce Mac, pour ceux dont le profil sait la lire (fiche 137). */
export interface AgentSpendView {
  profileId: string
  profileLabel: string
  currency: string
  today: number
  week: number
  month: number
}

const fields = (raw: unknown) =>
  (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>

function parseProfileId(raw: unknown): { profileId?: string } {
  if (raw === undefined || raw === null || raw === '') return {}
  if (typeof raw !== 'string' || raw.length > 200) throw new Error('Paramètre invalide : profileId')
  return { profileId: raw }
}

/** Requête venue du renderer, vérifiée champ par champ. */
export function parseUsageQuery(raw: unknown): UsageQuery {
  const r = fields(raw)
  const scope = USAGE_SCOPES.find((p) => p === r['scope'])
  if (!scope) throw new Error('Paramètre invalide : scope')
  const date = r['date']
  if (!isDayKey(date)) throw new Error('Paramètre invalide : date')
  return { scope, date, ...parseProfileId(r['profileId']) }
}

export function parseUsageHeatQuery(raw: unknown): UsageHeatQuery {
  const r = fields(raw)
  const range = r['range']
  if (
    range !== 'last12' &&
    !(Number.isInteger(range) && Number(range) >= 2000 && Number(range) < 3000)
  ) {
    throw new Error('Paramètre invalide : range')
  }
  return { range: range as HeatRange, ...parseProfileId(r['profileId']) }
}

export function parseUsageExportKind(raw: unknown): UsageExportKind {
  const kind = USAGE_EXPORTS.find((k) => k === raw)
  if (!kind) throw new Error('Paramètre invalide : kind')
  return kind
}
