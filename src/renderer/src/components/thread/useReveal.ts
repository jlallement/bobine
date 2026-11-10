import { useCallback, useEffect, useState } from 'react'
import { REVEAL_STEP } from '@shared/display-cap'

/**
 * « Afficher tout » sans figer l'app (fiche 192) : `initial` lignes d'abord, puis, une fois
 * demandé, `REVEAL_STEP` de plus à chaque image jusqu'au but : `total` (« Afficher tout ») ou un
 * nombre de lignes (`revealTo`, ce que la recherche dans le fil a trouvé). Pas de « Réduire » :
 * refermer la carte et la rouvrir ne change rien (décision de l'expert UX).
 */
export function useReveal(total: number, initial: number) {
  const capped = Math.min(total, initial)
  /** Lignes visées ; `null` : plafond. */
  const [target, setTarget] = useState<number | null>(null)
  /** Lignes montrées une fois un but posé. */
  const [shown, setShown] = useState<number | null>(null)
  const goal = target === null ? capped : Math.min(total, Math.max(capped, target))
  const current = Math.min(goal, Math.max(capped, shown ?? capped))
  useEffect(() => {
    if (current >= goal) return
    const frame = requestAnimationFrame(() =>
      setShown((s) => Math.min(goal, Math.max(capped, s ?? capped) + REVEAL_STEP))
    )
    return () => cancelAnimationFrame(frame)
  }, [current, goal, capped])
  const revealTo = useCallback((lines: number) => setTarget((t) => Math.max(t ?? 0, lines)), [])
  return {
    shown: current,
    revealing: current < goal,
    revealed: target !== null && current >= total,
    /** Tout, par paquets ; le premier tout de suite. */
    reveal: () => {
      // Tout, même ce qui s'ajoutera (sortie qui arrive encore).
      setTarget(Number.POSITIVE_INFINITY)
      setShown(Math.min(total, capped + REVEAL_STEP))
    },
    /** Au moins `lines` lignes, par paquets (jamais moins que déjà montré). */
    revealTo
  }
}
