import { describe, expect, it } from 'vitest'
import { OUTLINE_GAP, OUTLINE_MIN_GAP, outlineHeight, outlineLayout } from './outline-layout'

const span = (l: ReturnType<typeof outlineLayout>) =>
  l.bars.length * 2 + (l.bars.length - 1) * l.gap

describe('outlineLayout (fiche 173)', () => {
  it('hauteur maximale : 30 % du fil, 240 px au plus', () => {
    expect(outlineHeight(500)).toBe(150)
    expect(outlineHeight(1200)).toBe(240)
  })

  it('peu de messages : un trait chacun, écart habituel', () => {
    const l = outlineLayout(10, 240)
    expect(l.gap).toBe(OUTLINE_GAP)
    expect(l.bars).toHaveLength(10)
    expect(l.bars[3]).toEqual({ first: 3, last: 3 })
  })

  it('davantage : l’écart se resserre, toujours un trait par message', () => {
    const l = outlineLayout(40, 240)
    expect(l.gap).toBeLessThan(OUTLINE_GAP)
    expect(l.gap).toBeGreaterThanOrEqual(OUTLINE_MIN_GAP)
    expect(l.bars).toHaveLength(40)
    expect(span(l)).toBeLessThanOrEqual(240)
  })

  it('beaucoup : un trait pour plusieurs messages, tous couverts une fois, dans la hauteur', () => {
    for (const [count, height] of [
      [100, 240],
      [500, 150],
      [61, 240]
    ] as const) {
      const l = outlineLayout(count, height)
      expect(l.gap).toBe(OUTLINE_MIN_GAP)
      expect(span(l)).toBeLessThanOrEqual(height)
      expect(l.bars[0]?.first).toBe(0)
      expect(l.bars.at(-1)?.last).toBe(count - 1)
      l.bars.slice(1).forEach((b, i) => expect(b.first).toBe((l.bars[i]?.last ?? 0) + 1))
      expect(l.bars.every((b) => b.last >= b.first)).toBe(true)
    }
  })
})
