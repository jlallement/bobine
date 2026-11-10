/**
 * Disposition des traits du sommaire (fiche 173). Un trait par message de l'utilisateur, 7 px
 * d'écart ; quand la colonne dépasserait sa hauteur maximale, l'écart se resserre jusqu'à 3 px,
 * puis un trait représente plusieurs messages consécutifs : la colonne garde toute la conversation
 * sous les yeux, le trait courant reste celui du message lu.
 */

/** Épaisseur d'un trait (px), comme `.outline-bar`. */
export const OUTLINE_BAR = 2
/** Écart entre deux traits, au large. */
export const OUTLINE_GAP = 7
/** Écart minimal : en dessous, les traits se confondent en une bande grise. */
export const OUTLINE_MIN_GAP = 3
/** Hauteur maximale de la colonne de traits : 240 px, et pas plus de 30 % de la hauteur du fil. */
export const OUTLINE_MAX_HEIGHT = 240
export const OUTLINE_MAX_SHARE = 0.3

/** Un trait : les messages qu'il représente, de `first` à `last` (rangs dans la liste). */
export type OutlineBar = { first: number; last: number }

export function outlineHeight(threadHeight: number): number {
  return Math.min(OUTLINE_MAX_HEIGHT, Math.floor(threadHeight * OUTLINE_MAX_SHARE))
}

/** Traits et écart pour `count` messages dans une colonne de `height` px au plus. */
export function outlineLayout(count: number, height: number): { gap: number; bars: OutlineBar[] } {
  const span = (n: number, gap: number) => n * OUTLINE_BAR + (n - 1) * gap
  if (count <= 1 || span(count, OUTLINE_GAP) <= height) {
    return { gap: OUTLINE_GAP, bars: perMessage(count) }
  }
  const gap = Math.floor((height - count * OUTLINE_BAR) / (count - 1))
  if (gap >= OUTLINE_MIN_GAP) return { gap, bars: perMessage(count) }
  // Autant de traits que la hauteur en tient à l'écart minimal, deux au moins.
  const n = Math.max(2, Math.floor((height + OUTLINE_MIN_GAP) / (OUTLINE_BAR + OUTLINE_MIN_GAP)))
  const bars = Array.from({ length: n }, (_, i) => ({
    first: Math.floor((i * count) / n),
    last: Math.floor(((i + 1) * count) / n) - 1
  }))
  return { gap: OUTLINE_MIN_GAP, bars }
}

function perMessage(count: number): OutlineBar[] {
  return Array.from({ length: count }, (_, i) => ({ first: i, last: i }))
}
