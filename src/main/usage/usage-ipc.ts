/**
 * Canaux de la consommation : quotas des agents (fiche 091) et tableau de Réglages › Consommation
 * (fiches 137 et 144). L'émetteur de chaque appel est vérifié par `registerIpcHandlers`, comme pour tous
 * les canaux (fiche 114) ; les arguments le sont ici.
 */
import { writeFile } from 'node:fs/promises'
import type { IpcHandlers } from '@shared/ipc'
import type { AgentQuota } from '@shared/usage'
import { parseUsageExportKind, parseUsageHeatQuery, parseUsageQuery } from '@shared/usage-stats'
import type { UsageBoard } from './setup'

export interface UsageIpcDeps {
  /** Quotas des agents (fiche 091) : derniers lus, et relecture en tâche de fond. */
  quotas?: { list: () => AgentQuota[]; refresh: (profileId?: string) => Promise<void> }
  /** Tableau de consommation (fiche 137). */
  board?: UsageBoard
  /** « Enregistrer sous » d'un CSV : chemin choisi, ou `null` si annulé. */
  saveCsv?: (defaultName: string) => Promise<string | null>
  /** Écriture du fichier (injectée pour les tests). */
  write?: (path: string, content: string) => Promise<void>
}

type UsageChannels =
  | 'usage:quotas'
  | 'usage:refreshQuota'
  | 'usage:stats'
  | 'usage:heatmap'
  | 'usage:export'
  | 'usage:reset'
  | 'usage:spends'
  | 'usage:hasAny'

export function usageHandlers(deps: UsageIpcDeps): Pick<IpcHandlers, UsageChannels> {
  const board = () => {
    if (!deps.board) throw new Error('Journal de consommation indisponible')
    return deps.board
  }
  return {
    'usage:quotas': () => deps.quotas?.list() ?? [],
    'usage:refreshQuota': async (profileId) => {
      if (profileId !== undefined && (typeof profileId !== 'string' || !profileId)) {
        throw new Error('Paramètre invalide : profileId')
      }
      await deps.quotas?.refresh(profileId)
      return deps.quotas?.list() ?? []
    },
    'usage:stats': (query) => board().stats(parseUsageQuery(query)),
    'usage:heatmap': (query) => board().heatmap(parseUsageHeatQuery(query)),
    'usage:export': async (query, kind) => {
      const { name, content } = board().csv(parseUsageQuery(query), parseUsageExportKind(kind))
      const path = await deps.saveCsv?.(name)
      if (!path) return null
      await (deps.write ?? ((file, text) => writeFile(file, text, 'utf8')))(path, content)
      return path
    },
    'usage:reset': () => {
      board().reset()
      return undefined
    },
    'usage:spends': () => deps.board?.spends() ?? [],
    'usage:hasAny': () => deps.board?.hasAny() ?? false
  }
}
