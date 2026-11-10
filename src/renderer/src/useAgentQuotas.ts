import { useCallback, useEffect, useState } from 'react'
import type { AgentQuota } from '@shared/usage'

/**
 * Quotas des agents qui savent le lire (fiche 091) : derniers lus par le main au démarrage, suivis
 * à chaque relecture, et relus à la demande.
 */
export function useAgentQuotas(): {
  quotas: AgentQuota[]
  refresh: (profileId: string) => Promise<void>
} {
  const [quotas, setQuotas] = useState<AgentQuota[]>([])
  useEffect(() => {
    let alive = true
    window.api.usage.quotas().then(
      (list) => alive && setQuotas(list),
      () => {}
    )
    const off = window.api.usage.onQuotasChanged(setQuotas)
    return () => {
      alive = false
      off()
    }
  }, [])
  const refresh = useCallback(async (profileId: string) => {
    setQuotas(await window.api.usage.refreshQuota(profileId))
  }, [])
  return { quotas, refresh }
}

/** Quota de l'agent actif, s'il sait le lire (Bob : bobcoins), et de quoi le relire. */
export function useActiveQuota(
  profileId: string | undefined
): { quota: AgentQuota; onRefreshQuota: () => Promise<void> } | Record<string, never> {
  const { quotas, refresh } = useAgentQuotas()
  const quota = quotas.find((q) => q.profileId === profileId)
  return quota && profileId ? { quota, onRefreshQuota: () => refresh(profileId) } : {}
}
