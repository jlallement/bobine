import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WINDOWS_ICON_SIZES, decodeIco, encodeIco } from './windows-icon.mjs'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
/** Largeur et hauteur lues dans l'en-tête IHDR d'un PNG. */
const pngSize = (png: Buffer): [number, number] => [png.readUInt32BE(16), png.readUInt32BE(20)]

describe('icône Windows (fiche 229)', () => {
  it('encode et relit un ICO (256 px s’écrit 0 dans l’entrée)', () => {
    const images = [
      { size: 16, png: Buffer.from('seize') },
      { size: 256, png: Buffer.from('deux-cent-cinquante-six') }
    ]
    const ico = encodeIco(images)
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico.readUInt8(6 + 16)).toBe(0)
    expect(decodeIco(ico).map((e) => [e.size, e.png.toString()])).toEqual([
      [16, 'seize'],
      [256, 'deux-cent-cinquante-six']
    ])
    expect(() => encodeIco([{ size: 512, png: Buffer.alloc(1) }])).toThrow(/hors ICO/)
  })

  it('build/icon.ico contient chaque taille, en PNG à la bonne dimension', () => {
    const ico = readFileSync(join(import.meta.dirname, '..', 'build', 'icon.ico'))
    const entries = decodeIco(ico)
    expect(entries.map((e) => e.size)).toEqual([...WINDOWS_ICON_SIZES])
    for (const { size, png } of entries) {
      expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
      expect(pngSize(png)).toEqual([size, size])
    }
  })
})
