import { useCallback, useEffect, useState } from 'react'
import type { GitStatus } from '@shared/git'

/**
 * État git du dossier de la conversation active (puce de branche, fiches 037 et 049) : relu au
 * changement de conversation, au début et à la fin de chaque tour de l'agent, et au retour dans
 * l'app (une branche changée dans un autre terminal).
 */
export function useGitStatus(conversationId: string | null, agentBusy: boolean): GitStatus | null {
  const [loaded, setLoaded] = useState<{ id: string; status: GitStatus | null } | null>(null)
  const refresh = useCallback(() => {
    if (!conversationId) return
    const id = conversationId
    window.api.git
      .status(id)
      .then((status) => setLoaded({ id, status }))
      // git absent ou dépôt refusé : pas de puce (l'onglet « Modifications » dit pourquoi).
      .catch(() => setLoaded({ id, status: null }))
  }, [conversationId])
  useEffect(() => refresh(), [refresh, agentBusy])
  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  // État d'une autre conversation : pas montré le temps que la bonne arrive.
  return loaded && loaded.id === conversationId ? loaded.status : null
}
