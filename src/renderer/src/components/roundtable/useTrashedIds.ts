import { useEffect, useState } from 'react'
import { onTrashChanged } from '../../trash-events'

const NONE: ReadonlySet<string> = new Set()

/**
 * Conversations à la corbeille parmi `missing` (S1, S2) : la corbeille n'est lue que quand une
 * conversation de participant manque à la liste, et relue quand cet ensemble change (mise à la
 * corbeille, restauration, effacement d'une autre), quand la corbeille change dans la fenêtre
 * (Réglages › Données), et à chaque changement de `opened` (la carte rouverte) : un participant
 * effacé pour de bon ne reste pas « à la corbeille » (N10). `undefined` tant qu'elle n'est pas lue.
 */
export function useTrashedIds(
  missing: readonly string[],
  opened = true
): ReadonlySet<string> | undefined {
  const [changes, setChanges] = useState(0)
  useEffect(() => onTrashChanged(() => setChanges((n) => n + 1)), [])
  const key = [...missing].sort().join('\n')
  const [read, setRead] = useState<{ key: string; ids: ReadonlySet<string> }>()
  useEffect(() => {
    if (!key || !opened) return
    let live = true
    window.api.profile
      .trash()
      .then((entries) => live && setRead({ key, ids: new Set(entries.map((e) => e.id)) }))
      // Corbeille illisible : la conversation est dite supprimée, jamais ouverte.
      .catch(() => live && setRead({ key, ids: new Set() }))
    return () => {
      live = false
    }
  }, [key, opened, changes])
  if (!key) return NONE
  // Relue : l'ancienne lecture reste affichée jusqu'à la nouvelle (pas de clignotement).
  return read?.key === key ? read.ids : undefined
}
