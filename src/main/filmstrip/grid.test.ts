import { describe, expect, it } from 'vitest'
import { GAP, MAX_AREA, MAX_SIDE, composeGrid, gridLayout } from './grid'
import type { Bitmap } from './select'

const solid = (gray: number, width: number, height: number): Bitmap => {
  const data = new Uint8Array(width * height * 4).fill(gray)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  return { width, height, data }
}
const pixel = (image: Bitmap, x: number, y: number) => image.data[(y * image.width + x) * 4] ?? -1

describe('planche contact : grille (fiche 075)', () => {
  it('un écran de téléphone en hauteur donne plusieurs colonnes', () => {
    const layout = gridLayout(8, { width: 393, height: 852 })
    expect(layout.columns).toBeGreaterThanOrEqual(4)
    expect(layout.width).toBeLessThanOrEqual(MAX_SIDE)
    expect(layout.height).toBeLessThanOrEqual(MAX_SIDE)
    expect(layout.width * layout.height).toBeLessThanOrEqual(MAX_AREA * 1.1)
    expect(layout.scale).toBeCloseTo(layout.cellWidth / 393)
  })

  it('une page large tient en peu de colonnes ; une petite image n’est jamais agrandie', () => {
    const wide = gridLayout(8, { width: 1280, height: 800 })
    expect(wide.columns).toBeLessThanOrEqual(3)
    expect(wide.width).toBeLessThanOrEqual(MAX_SIDE)
    const small = gridLayout(4, { width: 100, height: 100 })
    expect(small.scale).toBe(1)
    // À taille égale, la plus ramassée : 2 × 2 plutôt qu'une ligne de 4.
    expect([small.columns, small.rows]).toEqual([2, 2])
  })

  it('pose chaque image dans sa case, dans l’ordre de lecture, avec son numéro', () => {
    const layout = gridLayout(3, { width: 200, height: 100 })
    const sheet = composeGrid(layout, [
      solid(50, 200, 100),
      solid(150, 200, 100),
      solid(220, 200, 100)
    ])
    expect(sheet.width).toBe(layout.width)
    expect(sheet.data.length).toBe(layout.width * layout.height * 4)
    const center = (index: number) => {
      const x = GAP + (index % layout.columns) * (layout.cellWidth + GAP) + 150
      const y = GAP + Math.floor(index / layout.columns) * (layout.cellHeight + GAP) + 60
      return pixel(sheet, x, y)
    }
    expect([center(0), center(1), center(2)]).toEqual([50, 150, 220])
    // Fond gris entre les cases, pastille noire et chiffre blanc dans le coin de la première.
    expect(pixel(sheet, 1, 1)).toBe(128)
    const corner = [...Array(30).keys()].flatMap((dy) =>
      [...Array(30).keys()].map((dx) => pixel(sheet, GAP + dx, GAP + dy))
    )
    expect(corner).toContain(0)
    expect(corner).toContain(255)
  })
})
