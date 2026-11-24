import { useEffect, useState } from 'react'

const NONE: ReadonlySet<string> = new Set()

/**
 * Conversations à la corbeille parmi `missing` (S1, S2) : la corbeille n'est lue que quand une
 * conversation de participant manque à la liste, et relue quand cet ensemble change (mise à la
 * corbeille, restauration, effacement d'une autre). `undefined` tant qu'elle n'est pas lue.
 */
export function useTrashedIds(missing: readonly string[]): ReadonlySet<string> | undefined {
  const key = [...missing].sort().join('\n')
  const [read, setRead] = useState<{ key: string; ids: ReadonlySet<string> }>()
  useEffect(() => {
    if (!key) return
    let live = true
    window.api.profile
      .trash()
      .then((entries) => live && setRead({ key, ids: new Set(entries.map((e) => e.id)) }))
      // Corbeille illisible : la conversation est dite supprimée, jamais ouverte.
      .catch(() => live && setRead({ key, ids: new Set() }))
    return () => {
      live = false
    }
  }, [key])
  if (!key) return NONE
  return read?.key === key ? read.ids : undefined
}
