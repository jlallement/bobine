import { describe, expect, it } from 'vitest'
import { difference, distinctFrames, spread, type Bitmap, type TimedFrame } from './select'

const solid = (gray: number, width = 4, height = 4): Bitmap => {
  const data = new Uint8Array(width * height * 4).fill(gray)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  return { width, height, data }
}
const frame = (at: number, gray: number): TimedFrame<number> => ({
  at,
  frame: at,
  thumb: solid(gray)
})

describe('planche contact : choix des images (fiche 075)', () => {
  it('écart moyen sur les couleurs, sans l’opacité ; tailles différentes : tout diffère', () => {
    expect(difference(solid(10), solid(10))).toBe(0)
    expect(difference(solid(10), solid(40))).toBe(30)
    expect(difference(solid(10), solid(10, 8, 2))).toBe(255)
  })

  it('écarte les images qui ne changent rien, garde un retour en arrière', () => {
    const frames = [frame(0, 10), frame(40, 10), frame(80, 11), frame(120, 90), frame(160, 10)]
    expect(distinctFrames(frames).map((f) => f.at)).toEqual([0, 120, 160])
  })

  it('au plus N images, la première et la dernière comprises, réparties sur la durée', () => {
    const frames = [0, 10, 20, 30, 500, 510, 990, 1000].map((at) => frame(at, at))
    expect(spread(frames, 3).map((f) => f.at)).toEqual([0, 500, 1000])
    expect(spread(frames, 4).map((f) => f.at)).toEqual([0, 500, 510, 1000])
    expect(spread(frames, 20)).toHaveLength(8)
    expect(spread(frames, 1).map((f) => f.at)).toEqual([1000])
    expect(spread(frames, 0)).toEqual([])
  })

  it('ne reprend jamais deux fois la même image, même groupées au même moment', () => {
    const frames = [0, 1, 2, 3, 4, 1000].map((at) => frame(at, at))
    const chosen = spread(frames, 5).map((f) => f.at)
    expect(new Set(chosen).size).toBe(5)
    expect(chosen[0]).toBe(0)
    expect(chosen.at(-1)).toBe(1000)
  })
})
