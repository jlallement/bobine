import { describe, expect, it } from 'vitest'
import { H264Splitter } from './h264'

const nal = (type: number, ...body: number[]) => Buffer.from([0, 0, 0, 1, type, ...body])

describe('découpage H.264 de screenrecord', () => {
  it('SPS + PPS + IDR forment une image clé avec son codec ; puis images ordinaires', () => {
    const sps = nal(0x67, 0x42, 0xc0, 0x29, 0xaa)
    const pps = nal(0x68, 0xce)
    const idr = nal(0x65, 0x88, 0x00, 0x00, 0x02)
    const p1 = nal(0x41, 0x9a, 0x01)
    const p2 = nal(0x41, 0x9a, 0x02)
    const stream = Buffer.concat([sps, pps, idr, p1, p2])
    for (const size of [1, 5, stream.length]) {
      const splitter = new H264Splitter()
      const frames = []
      for (let i = 0; i < stream.length; i += size)
        frames.push(...splitter.push(stream.subarray(i, i + size)))
      // La dernière image attend l'unité suivante pour être sûre d'être complète.
      expect(frames).toEqual([
        { data: Buffer.concat([sps, pps, idr]), key: true, codec: 'avc1.42c029' },
        { data: p1, key: false }
      ])
    }
  })

  it('écran immobile : flush rend la dernière image sans attendre la suivante', () => {
    const splitter = new H264Splitter()
    const p1 = nal(0x41, 0x9a, 0x01)
    expect(splitter.push(p1)).toEqual([])
    expect(splitter.flush()).toEqual([{ data: p1, key: false }])
    expect(splitter.flush()).toEqual([])
  })
})
