import { describe, expect, it } from 'vitest'
import { MjpegParser } from './mjpeg'

const part = (bytes: Buffer) =>
  Buffer.concat([
    Buffer.from(
      `--mjpegstream\r\nContent-Type: image/jpeg\r\nContent-Length: ${bytes.length}\r\n\r\n`
    ),
    bytes,
    Buffer.from('\r\n')
  ])

const HEAD = Buffer.from(
  'HTTP/1.1 200 OK\r\nContent-Type: multipart/x-mixed-replace; boundary=--mjpegstream\r\n\r\n'
)

describe('flux MJPEG', () => {
  it('images découpées par leur longueur, même reçues en morceaux quelconques', () => {
    const a = Buffer.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9])
    const b = Buffer.from([0xff, 0xd8, 0x0d, 0x0a, 0x0d, 0x0a, 9, 0xff, 0xd9])
    const stream = Buffer.concat([HEAD, part(a), part(b)])
    for (const size of [1, 3, 17, stream.length]) {
      const parser = new MjpegParser()
      const frames: Buffer[] = []
      for (let i = 0; i < stream.length; i += size) {
        frames.push(...parser.push(stream.subarray(i, i + size)))
      }
      expect(frames).toEqual([a, b])
    }
  })

  it('longueur absurde : erreur plutôt que d’attendre indéfiniment', () => {
    const parser = new MjpegParser()
    expect(() => parser.push(Buffer.from('--x\r\nContent-Length: 999999999\r\n\r\n'))).toThrow(
      'trop grande'
    )
  })
})
