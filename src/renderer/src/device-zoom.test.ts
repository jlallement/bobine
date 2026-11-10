import { describe, expect, it } from 'vitest'
import { nextZoom, zoomScale } from './device-zoom'

describe('zoom des appareils (fiche 084)', () => {
  it('palier suivant et précédent d’après l’échelle affichée, même hors palier', () => {
    expect(nextZoom(0.62, 1)).toBe(0.67)
    expect(nextZoom(0.62, -1)).toBe(0.5)
    expect(nextZoom(1, 1)).toBe(1.25)
    expect(nextZoom(1, -1)).toBe(0.75)
    // Une échelle à peine différente d'un palier compte comme lui.
    expect(nextZoom(0.5012, 1)).toBe(0.67)
  })

  it('aux bornes : plus de palier', () => {
    expect(nextZoom(3, 1)).toBeUndefined()
    expect(nextZoom(0.25, -1)).toBeUndefined()
    expect(nextZoom(0.2, 1)).toBe(0.25)
  })

  it('« ajuster » suit la place disponible, une échelle fixe ne la suit pas', () => {
    expect(zoomScale('fit', 0.62)).toBe(0.62)
    expect(zoomScale(1, 0.62)).toBe(1)
  })
})
