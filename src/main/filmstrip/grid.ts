/**
 * Planche contact (fiche 075) : grille d'images numérotées dans l'ordre de lecture. Pur, pour les
 * tests ; les images sont réduites à la taille des cases avant (`nativeImage`, dans `sheet.ts`).
 *
 * Fond gris, chiffres blancs sur fond noir : des couleurs qui ne dépendent pas de l'ordre des
 * octets (BGRA sur macOS).
 */
import type { Bitmap } from './select'

/** Plus grand côté de la planche : au-delà, le modèle la réduit lui-même. */
export const MAX_SIDE = 1568
/** Surface au plus (pixels) : même raison. */
export const MAX_AREA = 1_150_000
/** Écart entre les cases et autour d'elles. */
export const GAP = 6

export interface GridLayout {
  columns: number
  rows: number
  cellWidth: number
  cellHeight: number
  width: number
  height: number
  /** Taille d'une case par rapport à l'image d'origine (coordonnées des clics). */
  scale: number
}

/**
 * Colonnes et taille des cases : les plus grandes images qui tiennent dans la planche, jamais
 * agrandies ; à taille égale, la planche la plus ramassée.
 */
export function gridLayout(count: number, frame: { width: number; height: number }): GridLayout {
  const n = Math.max(1, count)
  let best: GridLayout | undefined
  for (let columns = 1; columns <= n; columns++) {
    const rows = Math.ceil(n / columns)
    const scale = Math.min(
      1,
      (MAX_SIDE - GAP * (columns + 1)) / (columns * frame.width),
      (MAX_SIDE - GAP * (rows + 1)) / (rows * frame.height),
      Math.sqrt(MAX_AREA / (columns * frame.width * rows * frame.height))
    )
    const cellWidth = Math.max(1, Math.floor(frame.width * scale))
    const cellHeight = Math.max(1, Math.floor(frame.height * scale))
    const layout: GridLayout = {
      columns,
      rows,
      cellWidth,
      cellHeight,
      width: columns * cellWidth + GAP * (columns + 1),
      height: rows * cellHeight + GAP * (rows + 1),
      scale: cellWidth / frame.width
    }
    const larger = !best || layout.cellWidth > best.cellWidth
    const sameButTighter =
      best !== undefined &&
      layout.cellWidth === best.cellWidth &&
      Math.max(layout.width, layout.height) < Math.max(best.width, best.height)
    if (larger || sameButTighter) best = layout
  }
  // `n` ≥ 1 : la boucle a toujours donné une mise en page.
  return best as GridLayout
}

/** Chiffres de 5 × 7 points, une chaîne par ligne. */
const DIGITS: Record<string, readonly string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100']
}

const BACKGROUND = 128

function fillRect(
  target: Bitmap,
  x: number,
  y: number,
  width: number,
  height: number,
  gray: number
): void {
  for (let row = Math.max(0, y); row < Math.min(target.height, y + height); row++) {
    for (let col = Math.max(0, x); col < Math.min(target.width, x + width); col++) {
      const i = (row * target.width + col) * 4
      target.data[i] = gray
      target.data[i + 1] = gray
      target.data[i + 2] = gray
      target.data[i + 3] = 255
    }
  }
}

/** Numéro d'une case, en blanc sur une pastille noire, dans son coin haut gauche. */
function drawNumber(target: Bitmap, label: string, x: number, y: number, size: number): void {
  const pad = 2 * size
  const width = label.length * 6 * size - size + 2 * pad
  const height = 7 * size + 2 * pad
  fillRect(target, x, y, width, height, 0)
  for (const [index, char] of [...label].entries()) {
    const glyph = DIGITS[char]
    if (!glyph) continue
    const left = x + pad + index * 6 * size
    for (const [row, bits] of glyph.entries()) {
      for (let col = 0; col < 5; col++) {
        if (bits[col] === '1')
          fillRect(target, left + col * size, y + pad + row * size, size, size, 255)
      }
    }
  }
}

/**
 * La planche : chaque case reçoit son image (déjà à la taille de la case ; plus petite, elle est
 * posée dans le coin), et son numéro (1, 2, 3… dans l'ordre de lecture).
 */
export function composeGrid(layout: GridLayout, cells: readonly Bitmap[]): Bitmap {
  const sheet: Bitmap = {
    width: layout.width,
    height: layout.height,
    data: new Uint8Array(layout.width * layout.height * 4)
  }
  fillRect(sheet, 0, 0, sheet.width, sheet.height, BACKGROUND)
  // Chiffres lisibles sans couvrir l'image : 2 à 3 points par pixel de police selon la case.
  const size = Math.max(
    1,
    Math.min(3, Math.floor(Math.min(layout.cellWidth, layout.cellHeight) / 90))
  )
  for (const [index, cell] of cells.entries()) {
    const x = GAP + (index % layout.columns) * (layout.cellWidth + GAP)
    const y = GAP + Math.floor(index / layout.columns) * (layout.cellHeight + GAP)
    const width = Math.min(cell.width, layout.cellWidth)
    const height = Math.min(cell.height, layout.cellHeight)
    for (let row = 0; row < height; row++) {
      const from = row * cell.width * 4
      sheet.data.set(cell.data.subarray(from, from + width * 4), ((y + row) * sheet.width + x) * 4)
    }
    drawNumber(sheet, String(index + 1), x + size * 2, y + size * 2, size)
  }
  return sheet
}
