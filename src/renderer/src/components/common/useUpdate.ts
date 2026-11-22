import { useEffect, useState } from 'react'
import type { UpdateView } from '@shared/update-check'

/** État de l'avis de nouvelle version (fiche 274), relu à chaque changement envoyé par le main. */
export function useUpdate(): UpdateView | null {
  const [view, setView] = useState<UpdateView | null>(null)
  useEffect(() => {
    let live = true
    void window.api.app
      .update()
      .then((next) => live && setView(next))
      .catch(() => {})
    const off = window.api.app.onUpdate(setView)
    return () => {
      live = false
      off()
    }
  }, [])
  return view
}
