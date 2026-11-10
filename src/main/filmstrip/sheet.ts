/**
 * Planche contact (fiche 075) : d'un film (images JPEG datées) à une image en grille et au texte
 * qui l'accompagne pour l'agent. Le décodage passe par un `ImageCodec` (Electron dans l'app, faux
 * dans les tests).
 */
import { composeGrid, gridLayout } from './grid'
import { distinctFrames, spread, type Bitmap, type TimedFrame } from './select'

export interface FilmFrame {
  /** Moment de l'image, en millisecondes depuis le début du film. */
  at: number
  jpeg: Buffer
}

export interface ImageCodec {
  /** Image décodée puis réduite à cette taille exacte, en pixels bruts. */
  bitmap: (jpeg: Buffer, width: number, height: number) => Bitmap
  jpeg: (bitmap: Bitmap) => Buffer
}

export interface ContactSheet {
  image: { data: string; mimeType: 'image/jpeg'; width: number; height: number }
  /** Moment de chaque case, dans l'ordre de lecture. */
  times: number[]
  received: number
  distinct: number
  /** Taille d'une case par rapport aux coordonnées des clics ou des touchers. */
  scale: number
}

/** Largeur des vignettes qui servent à comparer les images. */
const THUMB_WIDTH = 32

/**
 * La planche : images qui changent quelque chose, au plus `maxFrames`, réparties sur la durée,
 * réduites dans la grille. `size` : taille de l'écran dans les coordonnées des clics (pixels CSS,
 * points) ; les images peuvent être plus fines (écran Retina), elles sont ramenées à cette taille.
 */
export function contactSheet(
  frames: readonly FilmFrame[],
  options: { maxFrames: number; size: { width: number; height: number } },
  codec: ImageCodec
): ContactSheet | null {
  const { size } = options
  if (frames.length === 0 || size.width <= 0 || size.height <= 0) return null
  const thumbHeight = Math.max(1, Math.round((THUMB_WIDTH * size.height) / size.width))
  const timed: TimedFrame<FilmFrame>[] = []
  for (const frame of [...frames].sort((a, b) => a.at - b.at)) {
    try {
      timed.push({ at: frame.at, frame, thumb: codec.bitmap(frame.jpeg, THUMB_WIDTH, thumbHeight) })
    } catch {
      // Image illisible (tronquée) : on fait sans.
    }
  }
  const distinct = distinctFrames(timed)
  const chosen = spread(distinct, options.maxFrames)
  if (chosen.length === 0) return null
  const layout = gridLayout(chosen.length, size)
  const cells = chosen.map((f) => codec.bitmap(f.frame.jpeg, layout.cellWidth, layout.cellHeight))
  const sheet = composeGrid(layout, cells)
  return {
    image: {
      data: codec.jpeg(sheet).toString('base64'),
      mimeType: 'image/jpeg',
      width: sheet.width,
      height: sheet.height
    },
    times: chosen.map((f) => Math.round(f.at)),
    received: frames.length,
    distinct: distinct.length,
    scale: Math.round(layout.scale * 1000) / 1000
  }
}

/**
 * Ce que l'agent lit à côté de la planche (en anglais, comme les autres résultats d'outils) :
 * moments, et comment revenir aux coordonnées de `clickTool`.
 */
export function sheetText(sheet: ContactSheet, durationMs: number, clickTool: string): string {
  if (sheet.times.length === 1) {
    return `Contact sheet: the screen did not change during the ${durationMs} ms (${sheet.received} frames received); one frame shown.`
  }
  const times = sheet.times.map((at, i) => `${i + 1} → ${at} ms`).join(', ')
  const scale =
    sheet.scale === 1
      ? 'Frames are at full size (same coordinates as'
      : `Each frame is scaled ×${sheet.scale}: divide by ${sheet.scale} for the coordinates of`
  return [
    `Contact sheet over ${durationMs} ms: ${sheet.times.length} frames, numbered in reading order (left to right, then top to bottom), out of ${sheet.distinct} different screens (${sheet.received} frames received).`,
    `Times: ${times}.`,
    `${scale} ${clickTool}).`
  ].join('\n')
}
