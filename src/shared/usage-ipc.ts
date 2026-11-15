/** Canaux de la consommation et des quotas (fiches 091, 137, 144), rangés avec `IpcInvokeContract`. */
import type { AgentQuota } from './usage'
import type {
  AgentSpendView,
  UsageExportKind,
  UsageHeatmap,
  UsageHeatQuery,
  UsageQuery,
  UsageStats
} from './usage-stats'

export interface UsageIpcContract {
  /** Tableau de consommation (fiche 137) : statistiques d'une période et d'un agent. */
  'usage:stats': { args: [query: UsageQuery]; result: UsageStats }
  /** Grille d'activité de « Mon activité » (fiche 144). */
  'usage:heatmap': { args: [query: UsageHeatQuery]; result: UsageHeatmap }
  /** Export CSV par « Enregistrer sous » : chemin écrit, ou `null` si annulé. */
  'usage:export': { args: [query: UsageQuery, kind: UsageExportKind]; result: string | null }
  /** « Remettre à zéro » : vide le journal de consommation (le quota des agents n'est pas touché). */
  'usage:reset': { args: []; result: undefined }
  /** Dépense récente sur ce Mac des agents dont le profil sait la lire (Bob : sa base). */
  'usage:spends': { args: []; result: AgentSpendView[] }
  /** Le journal a-t-il au moins un tour ? État vide de « Mon activité » (fiche 185, F9). */
  'usage:hasAny': { args: []; result: boolean }
  /** Derniers quotas lus (fiche 091). */
  'usage:quotas': { args: []; result: AgentQuota[] }
  /** Relit le quota d'un agent (ou de tous), puis rend les derniers quotas lus. */
  'usage:refreshQuota': { args: [profileId?: string]; result: AgentQuota[] }
}

export const USAGE_CHANNELS = [
  'usage:stats',
  'usage:heatmap',
  'usage:export',
  'usage:reset',
  'usage:spends',
  'usage:hasAny',
  'usage:quotas',
  'usage:refreshQuota'
] as const
