import { describe, expect, it } from 'vitest'
import { FixedFrames, looksLikeOpaqueBgra, streamGeometry } from './bgra-frames'

const bytes = (n: number, from = 0) => Buffer.from(Array.from({ length: n }, (_, i) => from + i))

describe('streamGeometry', () => {
  it('asks for a width that is a multiple of 16 pixels, around half the device (iPhone 17)', () => {
    const g = streamGeometry({ width: 1206, height: 2622 })
    expect(g).toEqual({ width: 608, height: 1322, scale: 0.504561, frameSize: 608 * 1322 * 4 })
    // La troncature d'AXe retombe bien sur la largeur voulue.
    const scale = g?.scale ?? 0
    expect(Math.floor(1206 * scale)).toBe(608)
    expect(Math.floor(2622 * scale)).toBe(1322)
  })

  it('works for an iPad and an old iPhone', () => {
    expect(streamGeometry({ width: 2048, height: 2732 })).toMatchObject({
      width: 1024,
      height: 1366
    })
    expect(streamGeometry({ width: 750, height: 1334 })).toMatchObject({ width: 368, height: 655 })
  })

  it('refuses absurd sizes', () => {
    expect(streamGeometry({ width: 0, height: 0 })).toBeNull()
    expect(streamGeometry({ width: 20, height: 2000 })).toBeNull()
  })
})

describe('looksLikeOpaqueBgra', () => {
  const frame = (pixels: number, alpha: number) => {
    const b = Buffer.alloc(pixels * 4, 7)
    for (let p = 0; p < pixels; p++) b[p * 4 + 3] = alpha
    return b
  }

  it('accepts an opaque image and rejects a skewed one', () => {
    expect(looksLikeOpaqueBgra(frame(5000, 0xff))).toBe(true)
    // Lignes plus longues qu'attendu : les octets lus comme alpha tombent sur des couleurs.
    const skewed = frame(5000, 0xff)
    skewed.copy(skewed, 0, 1)
    expect(looksLikeOpaqueBgra(skewed)).toBe(false)
    expect(looksLikeOpaqueBgra(Buffer.alloc(0))).toBe(false)
  })
})

describe('FixedFrames', () => {
  it('returns nothing until a whole frame has arrived', () => {
    const frames = new FixedFrames(8)
    expect(frames.push(bytes(3))).toEqual([])
    expect(frames.push(bytes(4, 3))).toEqual([])
    expect(frames.push(bytes(1, 7))).toEqual([bytes(8)])
  })

  it('splits several frames and keeps the remainder', () => {
    const frames = new FixedFrames(4)
    expect(frames.push(bytes(10))).toEqual([bytes(4), bytes(4, 4)])
    expect(frames.push(bytes(2, 10))).toEqual([bytes(4, 8)])
    expect(frames.push(bytes(4, 12))).toEqual([bytes(4, 12)])
  })

  it('copies frames so later chunks cannot change them', () => {
    const frames = new FixedFrames(2)
    const chunk = bytes(4)
    const [first] = frames.push(chunk)
    chunk.fill(0)
    expect(first).toEqual(Buffer.from([0, 1]))
  })

  it('rejects an impossible frame size', () => {
    expect(() => new FixedFrames(0)).toThrow('invalide')
    expect(() => new FixedFrames(2.5)).toThrow('invalide')
  })
})
