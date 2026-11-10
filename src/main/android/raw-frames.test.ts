import { describe, expect, it } from 'vitest'
import { RawFrameSplitter, toBgra } from './raw-frames'

/** Une image au format `frames` : en-tête de 20 octets, puis les pixels. */
function frame(width: number, height: number, rgb: [number, number, number], format = 3) {
  const bytes = format === 3 ? 3 : 4
  const pixels = Buffer.alloc(width * height * bytes)
  for (let i = 0; i < width * height; i++) {
    pixels[i * bytes] = rgb[0]
    pixels[i * bytes + 1] = rgb[1]
    pixels[i * bytes + 2] = rgb[2]
  }
  const head = Buffer.alloc(20)
  head.writeUInt32LE(16 + pixels.length, 0)
  head.writeUInt32LE(width, 4)
  head.writeUInt32LE(height, 8)
  head.writeUInt32LE(width * bytes, 12)
  head.writeUInt32LE(format, 16)
  return Buffer.concat([head, pixels])
}

describe('images brutes de screenrecord (fiche 076)', () => {
  it('découpe le flux en images, quelle que soit la taille des morceaux reçus', () => {
    const stream = Buffer.concat([frame(3, 2, [255, 0, 0]), frame(3, 2, [0, 0, 255])])
    for (const size of [1, 7, 20, 25, stream.length]) {
      const splitter = new RawFrameSplitter()
      const frames = []
      for (let at = 0; at < stream.length; at += size) {
        frames.push(...splitter.push(stream.subarray(at, at + size)))
      }
      expect(frames.map((f) => [f.width, f.height, f.stride, f.format])).toEqual([
        [3, 2, 9, 3],
        [3, 2, 9, 3]
      ])
      expect(frames[1]?.pixels.subarray(0, 3)).toEqual(Buffer.from([0, 0, 255]))
    }
  })

  it('une image incomplète attend la suite', () => {
    const splitter = new RawFrameSplitter()
    const data = frame(2, 2, [1, 2, 3])
    expect(splitter.push(data.subarray(0, data.length - 1))).toEqual([])
    expect(splitter.push(data.subarray(data.length - 1))).toHaveLength(1)
  })

  it('RGB → BGRA opaque (ordre de nativeImage), lignes à pas plus large comprises', () => {
    const [rgb] = new RawFrameSplitter().push(frame(2, 1, [10, 20, 30]))
    expect(rgb && Array.from(toBgra(rgb).data)).toEqual([30, 20, 10, 255, 30, 20, 10, 255])
    const [bgra] = new RawFrameSplitter().push(frame(1, 1, [30, 20, 10], 5))
    expect(bgra && Array.from(toBgra(bgra).data)).toEqual([30, 20, 10, 255])
    const padded = toBgra({
      width: 1,
      height: 2,
      stride: 4,
      format: 3,
      pixels: Buffer.from([1, 2, 3, 0, 4, 5, 6, 0])
    })
    expect(Array.from(padded.data)).toEqual([3, 2, 1, 255, 6, 5, 4, 255])
  })

  it('un flux qui n’est pas au format frames est refusé', () => {
    expect(() => new RawFrameSplitter().push(Buffer.from('not a frame stream at all'))).toThrow(
      /unexpected frame header/
    )
    expect(() => new RawFrameSplitter().push(frame(1, 1, [0, 0, 0], 4))).toThrow(
      /unsupported pixel format 4/
    )
  })
})
