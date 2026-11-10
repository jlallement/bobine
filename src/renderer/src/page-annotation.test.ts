import { describe, expect, it } from 'vitest'
import {
  BUBBLE,
  bubbleAt,
  frozenLayout,
  pinShapes,
  toAreaPoint,
  toPagePoint
} from './page-annotation'

describe('annoter la page (fiche 132)', () => {
  it('capture posée comme la vue : toute la largeur, zoom de la page compris', () => {
    const plain = frozenLayout(
      { width: 500, height: 700 },
      { width: 500, height: 700, emulated: false }
    )
    expect(plain).toEqual({ scale: 1, left: 0, top: 0, width: 500, height: 700 })
    // Page zoomée à 150 % : 333 px CSS sur 500 px de zone.
    const zoomed = frozenLayout(
      { width: 500, height: 700 },
      { width: 333, height: 466, emulated: false }
    )
    expect(zoomed.scale).toBeCloseTo(1.5, 2)
    expect(toPagePoint({ x: 150, y: 300 }, zoomed)).toEqual({ x: 100, y: 200 })
  })

  it('taille imposée par l’agent : réduite pour tenir, centrée en haut, jamais agrandie', () => {
    const small = frozenLayout(
      { width: 500, height: 700 },
      { width: 375, height: 812, emulated: true }
    )
    expect(small.scale).toBeCloseTo(700 / 812, 5)
    expect(small.left).toBe(Math.floor((500 - 375 * small.scale) / 2))
    const tiny = frozenLayout(
      { width: 900, height: 900 },
      { width: 375, height: 600, emulated: true }
    )
    expect(tiny.scale).toBe(1)
    expect(tiny.left).toBe(262)
    expect(toPagePoint({ x: 100, y: 10 }, tiny)).toBeNull()
    expect(toPagePoint({ x: 300, y: 650 }, tiny)).toBeNull()
    expect(toPagePoint({ x: 272, y: 10 }, tiny)).toEqual({ x: 10, y: 10 })
    expect(toAreaPoint({ x: 10, y: 10 }, tiny)).toEqual({ x: 272, y: 10 })
  })

  it('bulle : à gauche de l’épingle, à droite près du bord, toujours dans la zone', () => {
    const area = { width: 600, height: 400 }
    expect(bubbleAt({ x: 505, y: 205 }, area)).toEqual({ left: 245, top: 216 })
    expect(bubbleAt({ x: 100, y: 50 }, area)).toEqual({ left: 136, top: 61 })
    expect(bubbleAt({ x: 590, y: 390 }, { width: 260, height: 400 }).left).toBe(8)
    expect(bubbleAt({ x: 505, y: 390 }, area).top).toBe(400 - BUBBLE.height - 8)
  })

  it('épingles avec le numéro de leur remarque (fiche 146 : pas forcément 1, 2…)', () => {
    const shapes = pinShapes(
      [
        { n: 2, at: { x: 1, y: 2 } },
        { n: 3, at: { x: 3, y: 4 } }
      ],
      '#c96442'
    )
    expect(shapes).toEqual([
      { kind: 'pin', color: '#c96442', at: { x: 1, y: 2 }, label: '2' },
      { kind: 'pin', color: '#c96442', at: { x: 3, y: 4 }, label: '3' }
    ])
  })
})
