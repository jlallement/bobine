import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorktreeCycleView } from '@shared/worktree-cycle'

/**
 * État du worktree de la conversation (fiche 110) pour la barre de la vue « Git » : relu quand
 * la conversation change, quand un outil finit (`key`), après chaque action git de la barre, à la
 * fin de chaque tour de l'agent et quand la fenêtre reprend la main (fiche 176, D15 : un commit
 * fait par l'agent ou dans un terminal ne passe pas par la barre).
 * `null` : pas de worktree (ou pas encore su) ; l'erreur est dite à part.
 */
export function useWorktreeCycle(
  conversationId: string,
  key: number
): {
  info: WorktreeCycleView | null
  /** Le main a répondu au moins une fois : `info` à `null` veut alors dire « pas de worktree ». */
  known: boolean
  error: string | null
  /** `fresh` (« Actualiser ») : le main relit aussi l'état de `gh` (0.9.1, D7). */
  refresh: (fresh?: boolean) => void
} {
  const [info, setInfo] = useState<WorktreeCycleView | null>(null)
  const [known, setKnown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Relectures numérotées : une réponse plus ancienne n'écrase jamais une plus récente (remarque 8).
  const sequence = useRef(0)
  const refresh = useCallback(
    (fresh = false) => {
      const mine = ++sequence.current
      let alive = true
      const current = () => alive && mine === sequence.current
      window.api.worktree
        .info(conversationId, ...(fresh ? [{ fresh }] : []))
        .then((next) => {
          if (!current()) return
          setInfo(next)
          setKnown(true)
          setError(null)
        })
        .catch((e: unknown) => {
          if (!current()) return
          setError(e instanceof Error ? e.message : String(e))
        })
      return () => {
        alive = false
      }
    },
    [conversationId]
  )
  useEffect(() => refresh(), [refresh, key])
  useEffect(() => {
    // Une seule relecture à la fois : la précédente, si elle n'a pas répondu, est oubliée.
    let cancel: (() => void) | undefined
    const again = () => {
      cancel?.()
      cancel = refresh()
    }
    // Fiche 189 : la forge (hôte lent) a répondu après la relecture.
    const offForge = window.api.worktree.onForge((change) => {
      if (change.id === conversationId) again()
    })
    const offEvent = window.api.agent.onEvent((payload) => {
      if (payload.conversationId !== conversationId) return
      if (payload.event.type === 'turn-end' || payload.event.type === 'turn-error') again()
    })
    window.addEventListener('focus', again)
    return () => {
      offEvent()
      offForge()
      window.removeEventListener('focus', again)
      cancel?.()
    }
  }, [refresh, conversationId])
  return { info, known, error, refresh: (fresh) => void refresh(fresh) }
}
