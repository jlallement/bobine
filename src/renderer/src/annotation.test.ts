import { describe, expect, it } from 'vitest'
import {
  arrowHead,
  drawShapes,
  fontSize,
  isMeaningful,
  pinSize,
  strokeWidth,
  textFrame,
  toImagePoint,
  wrapText,
  type DrawContext,
  type Shape
} from './annotation'

/** Mesure simulée : 10 px par caractère. */
const measure = (part: string) => part.length * 10

/** Contexte 2D simulé : les appels de dessin, notés. */
function recorder() {
  const calls: string[] = []
  const note =
    (name: string) =>
    (...args: unknown[]) =>
      calls.push(
        `${name}(${args.map((a) => (typeof a === 'number' ? Math.round(a) : a)).join(',')})`
      )
  const ctx = {
    beginPath: note('beginPath'),
    arc: note('arc'),
    moveTo: note('moveTo'),
    lineTo: note('lineTo'),
    stroke: note('stroke'),
    fill: note('fill'),
    closePath: note('closePath'),
    strokeRect: note('strokeRect'),
    fillText: note('fillText'),
    strokeText: note('strokeText'),
    // Moitié de la taille du texte par caractère, à peu près celle d'une police proportionnelle.
    measureText: (part: string) => ({ width: part.length * fontSize(1000) * 0.5 }),
    save: note('save'),
    restore: note('restore'),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textBaseline: 'alphabetic'
  } as unknown as DrawContext
  return { ctx, calls }
}

describe('annotation (fiche 067)', () => {
  it('écran → image : échelle du canevas, bornée à l’image', () => {
    const box = { left: 100, top: 50 }
    const size = { width: 2000, height: 1000 }
    expect(toImagePoint({ x: 150, y: 75 }, box, 0.5, size)).toEqual({ x: 100, y: 50 })
    expect(toImagePoint({ x: 5000, y: -20 }, box, 0.5, size)).toEqual({ x: 2000, y: 0 })
  })

  it('traits proportionnés à l’image ; pointe de flèche de part et d’autre de la tige', () => {
    expect(strokeWidth(400)).toBe(3)
    expect(strokeWidth(2000)).toBe(8)
    const [a, b] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 20)
    expect(a.x).toBeLessThan(100)
    expect(b.x).toBeLessThan(100)
    expect(Math.sign(a.y)).toBe(-Math.sign(b.y))
  })

  it('un simple clic ne fait pas de forme ; un texte vide non plus', () => {
    const red = '#e5484d'
    expect(
      isMeaningful({ kind: 'rect', color: red, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }, 6)
    ).toBe(false)
    expect(
      isMeaningful({ kind: 'arrow', color: red, from: { x: 0, y: 0 }, to: { x: 30, y: 0 } }, 6)
    ).toBe(true)
    expect(isMeaningful({ kind: 'pen', color: red, points: [{ x: 0, y: 0 }] }, 6)).toBe(false)
    expect(isMeaningful({ kind: 'text', color: red, at: { x: 0, y: 0 }, text: '  ' }, 6)).toBe(
      false
    )
  })

  it('dessine chaque forme en coordonnées de l’image', () => {
    const shapes: Shape[] = [
      { kind: 'rect', color: '#e5484d', from: { x: 300, y: 200 }, to: { x: 100, y: 50 } },
      { kind: 'arrow', color: '#3b82f6', from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
      {
        kind: 'pen',
        color: '#1f1f1f',
        points: [
          { x: 1, y: 1 },
          { x: 5, y: 5 }
        ]
      },
      { kind: 'text', color: '#e5484d', at: { x: 10, y: 20 }, text: 'ici' }
    ]
    const { ctx, calls } = recorder()
    drawShapes(ctx, shapes, { width: 1000, height: 600 })
    expect(calls).toContain('strokeRect(100,50,200,150)')
    expect(calls).toContain('lineTo(100,0)')
    expect(calls).toContain('fill()')
    expect(calls).toContain('lineTo(5,5)')
    // Demi-interligne au-dessus du texte, comme à l'écran : (1,2 − 1) / 2 × 22 px.
    expect(calls).toContain('fillText(ici,10,22)')
    expect(calls.filter((c) => c === 'save()')).toHaveLength(4)
  })

  it('texte : retour à la ligne entre les mots, au milieu d’un mot trop long (fiche 094)', () => {
    expect(wrapText('un deux trois quatre', 100, measure)).toEqual(['un deux', 'trois', 'quatre'])
    expect(wrapText('anticonstitutionnellement', 100, measure)).toEqual([
      'anticonsti',
      'tutionnell',
      'ement'
    ])
    expect(wrapText('court\n\nsuite', 100, measure)).toEqual(['court', '', 'suite'])
    expect(wrapText('ici', 100, measure)).toEqual(['ici'])
  })

  it('texte : 20 tailles de texte au plus par ligne, jamais au-delà du bord droit', () => {
    const size = fontSize(1000)
    expect(textFrame({ x: 10, y: 0 }, 1000)).toEqual({ x: 10, width: size * 20 })
    // Près du bord : la ligne s'arrête au bord.
    expect(textFrame({ x: 700, y: 0 }, 1000)).toEqual({ x: 700, width: 300 })
    // Tout contre le bord : le texte se décale vers la gauche pour garder 8 tailles de texte.
    expect(textFrame({ x: 990, y: 0 }, 1000)).toEqual({ x: 1000 - size * 8, width: size * 8 })
    // Image plus étroite que 8 tailles de texte : toute sa largeur.
    expect(textFrame({ x: 50, y: 0 }, 100)).toEqual({ x: 0, width: 100 })
  })

  it('un texte long est dessiné sur plusieurs lignes, dans l’image', () => {
    const { ctx, calls } = recorder()
    const text = 'Le bouton Exporter ne fait rien quand on clique dessus, aucun message'
    drawShapes(ctx, [{ kind: 'text', color: '#e5484d', at: { x: 900, y: 590 }, text }], {
      width: 1000,
      height: 600
    })
    const lines = calls.filter((c) => c.startsWith('fillText('))
    expect(lines.length).toBeGreaterThan(1)
    const size = fontSize(1000)
    for (const line of lines) {
      const [, part, x, y] = /^fillText\((.*),(\d+),(\d+)\)$/.exec(line) ?? []
      expect(Number(x) + (part?.length ?? 0) * size * 0.5).toBeLessThanOrEqual(1000)
      // Bas de la ligne : y + taille + demi-interligne.
      expect(Number(y) + size * 1.1).toBeLessThanOrEqual(600 + 1)
    }
    // Contours d'abord, puis les couleurs.
    expect(calls.findLastIndex((c) => c.startsWith('strokeText('))).toBeLessThan(
      calls.findIndex((c) => c.startsWith('fillText('))
    )
  })

  it('épingle (fiche 132) : goutte pointée sur le clic, bord blanc, numéro centré', () => {
    const { ctx, calls } = recorder()
    const pin: Shape = { kind: 'pin', color: '#d97757', at: { x: 100, y: 80 }, label: '2' }
    expect(isMeaningful(pin, 10)).toBe(true)
    drawShapes(ctx, [pin], { width: 800, height: 600 })
    const size = pinSize(800)
    expect(size).toBe(24)
    expect(calls).toContain('moveTo(100,80)')
    expect(calls).toContain(`arc(${100 + size / 2},${80 - size / 2},${size / 2},3,8)`)
    expect(calls.indexOf('fill()')).toBeLessThan(calls.indexOf('stroke()'))
    expect(calls.some((c) => c.startsWith('fillText(2,'))).toBe(true)
    expect(pinSize(2000)).toBe(56)
  })
})
