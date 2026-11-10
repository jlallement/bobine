/**
 * Planche contact (fiche 075) : quelles images d'un film garder. Pur, pour les tests.
 *
 * Les images arrivent à chaque changement de l'écran (navigateur) ou à cadence fixe (flux d'AXe) :
 * on écarte celles qui ne changent rien, puis on en garde au plus N, réparties sur la durée.
 */

/** Image en pixels bruts, 4 octets par pixel (BGRA ou RGBA : rien ici ne dépend de l'ordre). */
export interface Bitmap {
  width: number
  height: number
  data: Uint8Array
}

export interface TimedFrame<T> {
  /** Moment de l'image, en millisecondes depuis le début du film. */
  at: number
  frame: T
  /** Vignette de même taille pour toutes les images du film, pour les comparer. */
  thumb: Bitmap
}

/** En dessous de cet écart moyen (sur 255), deux vignettes montrent le même écran. */
export const SAME_SCREEN = 1.5

/** Écart moyen entre deux vignettes, de 0 (identiques) à 255 ; tailles différentes : 255. */
export function difference(a: Bitmap, b: Bitmap): number {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return 255
  const pixels = a.data.length / 4
  if (pixels === 0) return 0
  let sum = 0
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c++) sum += Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0))
  }
  return sum / (pixels * 3)
}

/** Les images qui changent quelque chose : chacune diffère de la dernière gardée. */
export function distinctFrames<T>(
  frames: readonly TimedFrame<T>[],
  threshold = SAME_SCREEN
): TimedFrame<T>[] {
  const kept: TimedFrame<T>[] = []
  for (const frame of frames) {
    const last = kept.at(-1)
    if (!last || difference(last.thumb, frame.thumb) >= threshold) kept.push(frame)
  }
  return kept
}

/**
 * Au plus `count` images, la première et la dernière comprises, les autres au plus près de
 * moments également espacés entre elles.
 */
export function spread<T>(frames: readonly TimedFrame<T>[], count: number): TimedFrame<T>[] {
  if (count <= 0) return []
  if (frames.length <= count) return [...frames]
  if (count === 1) return frames.slice(-1)
  const first = frames[0]
  const last = frames.at(-1)
  if (!first || !last) return []
  const chosen: TimedFrame<T>[] = [first]
  let from = 1
  for (let k = 1; k < count - 1; k++) {
    const target = first.at + ((last.at - first.at) * k) / (count - 1)
    // Il faut laisser assez d'images pour les cases suivantes et la dernière.
    const until = frames.length - (count - k)
    let best = from
    for (let i = from; i <= until; i++) {
      const frame = frames[i]
      const current = frames[best]
      if (frame && current && Math.abs(frame.at - target) < Math.abs(current.at - target)) best = i
    }
    const frame = frames[best]
    if (frame) chosen.push(frame)
    from = best + 1
  }
  chosen.push(last)
  return chosen
}
