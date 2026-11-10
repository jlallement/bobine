import { describe, expect, it } from 'vitest'
import { GAP } from './grid'
import type { Bitmap } from './select'
import { contactSheet, sheetText, type ImageCodec } from './sheet'

/** Faux JPEG : un octet, le gris de l'image ; le faux codec en fait une image unie. */
const fakeJpeg = (gray: number) => Buffer.from([gray])
const codec: ImageCodec & { last?: Bitmap } = {
  bitmap: (jpeg, width, height) => {
    const gray = jpeg[0] ?? 0
    const data = new Uint8Array(width * height * 4).fill(gray)
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    return { width, height, data }
  },
  jpeg(bitmap) {
    codec.last = bitmap
    return Buffer.from('jpeg')
  }
}

describe('planche contact : du film à la planche (fiche 075)', () => {
  it('garde les écrans différents, au plus N, dans l’ordre, avec leur moment', () => {
    const grays = [10, 10, 10, 60, 60, 120, 120, 180, 240, 240]
    const frames = grays.map((gray, i) => ({ at: i * 100, jpeg: fakeJpeg(gray) }))
    const sheet = contactSheet(frames, { maxFrames: 4, size: { width: 390, height: 844 } }, codec)
    expect(sheet).not.toBeNull()
    if (!sheet) return
    expect(sheet.received).toBe(10)
    expect(sheet.distinct).toBe(5)
    expect(sheet.times).toEqual([0, 300, 500, 800])
    expect(sheet.image.mimeType).toBe('image/jpeg')
    // Première case : le premier écran (gris 10), numéroté.
    const first = codec.last
    const x = GAP + 60
    const y = GAP + 200
    expect(first?.data[(y * (first?.width ?? 0) + x) * 4]).toBe(10)
  })

  it('texte pour l’agent : moments, ordre de lecture, échelle des coordonnées', () => {
    const frames = [0, 50, 400].map((at, i) => ({ at, jpeg: fakeJpeg(i * 80) }))
    const sheet = contactSheet(frames, { maxFrames: 8, size: { width: 1280, height: 800 } }, codec)
    if (!sheet) throw new Error('planche attendue')
    const text = sheetText(sheet, 1500, 'browser_click')
    expect(text).toContain('3 frames, numbered in reading order')
    expect(text).toContain('1 → 0 ms, 2 → 50 ms, 3 → 400 ms')
    expect(text).toContain(`divide by ${sheet.scale} for the coordinates of browser_click`)
  })

  it('écran immobile : une seule image, et l’agent le sait', () => {
    const frames = [0, 100, 200].map((at) => ({ at, jpeg: fakeJpeg(30) }))
    const sheet = contactSheet(frames, { maxFrames: 8, size: { width: 400, height: 300 } }, codec)
    if (!sheet) throw new Error('planche attendue')
    expect(sheet.times).toEqual([0])
    expect(sheetText(sheet, 1000, 'ios_tap')).toContain('did not change during the 1000 ms')
  })

  it('rien à montrer sans image', () => {
    expect(contactSheet([], { maxFrames: 8, size: { width: 400, height: 300 } }, codec)).toBeNull()
  })
})
