import { useEffect, useState } from 'react'
import type { PrTrack } from '@shared/pr-tracking'

/**
 * État de la PR de la conversation (fiche 176), poussé par le main (`pr:changed`) et relu à
 * chaque changement de `key` (état du worktree relu : outil fini, action de la barre) : le main décide s'il interroge
 * GitHub ou rend ce qu'il sait. `null` : pas encore su, ou suivi impossible.
 */
export function usePrTrack(conversationId: string, key: unknown): PrTrack | null {
  const [loaded, setLoaded] = useState<{ id: string; track: PrTrack } | null>(null)
  useEffect(
    () =>
      window.api.pr.onChanged((change) => {
        if (change.id === conversationId) setLoaded({ id: change.id, track: change.track })
      }),
    [conversationId]
  )
  useEffect(() => {
    let alive = true
    window.api.pr
      .status(conversationId)
      .then((track) => alive && setLoaded({ id: conversationId, track }))
      // Pas de worktree, ou l'IPC refusée : pas de carte.
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [conversationId, key])
  return loaded?.id === conversationId ? loaded.track : null
}
