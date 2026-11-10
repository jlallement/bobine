import { useState } from 'react'

/**
 * Blocs arrivés dans le fil depuis qu'on l'a remonté (fiche 185, idée P8) : le bouton « Aller en
 * bas » dit combien, au lieu d'une flèche muette. Remis à zéro en bas du fil et d'une
 * conversation à l'autre. Ajustement pendant le rendu, sans effet.
 */
export function useNewSinceScroll(
  atBottom: boolean,
  count: number,
  conversation: string | null
): number {
  const [mark, setMark] = useState<{ conversation: string | null; count: number } | null>(null)
  const stale = mark && mark.conversation !== conversation
  if (atBottom || stale) {
    if (mark) setMark(null)
    return 0
  }
  if (!mark) {
    setMark({ conversation, count })
    return 0
  }
  return Math.max(0, count - mark.count)
}
