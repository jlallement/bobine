import { describe, expect, it } from 'vitest'
import {
  PANEL_DEFAULT_WIDTH,
  PANEL_LEGACY_DEFAULT_WIDTH,
  panelWidthToSave,
  savedPanelWidth
} from './panel-width'

describe('largeur du panneau de droite (fiche 226)', () => {
  it('320 px par défaut, 380 pour l’ancien défaut', () => {
    expect(PANEL_DEFAULT_WIDTH).toBe(320)
    expect(PANEL_LEGACY_DEFAULT_WIDTH).toBe(380)
  })

  it('jamais réglée : rien d’enregistré, ou l’ancien défaut enregistré d’office', () => {
    expect(savedPanelWidth(null)).toBeNull()
    expect(savedPanelWidth({})).toBeNull()
    expect(savedPanelWidth({ width: 380 })).toBeNull()
    expect(savedPanelWidth({ width: 'large' })).toBeNull()
    expect(savedPanelWidth({ width: Number.NaN })).toBeNull()
    expect(savedPanelWidth({ customWidth: -5 })).toBeNull()
  })

  it('réglée à la main : `customWidth`, même à 380 ; une autre ancienne largeur est reprise', () => {
    expect(savedPanelWidth({ customWidth: 380 })).toBe(380)
    expect(savedPanelWidth({ customWidth: 412.4 })).toBe(412)
    expect(savedPanelWidth({ width: 420 })).toBe(420)
    expect(savedPanelWidth({ width: 300 })).toBe(300)
    // `customWidth` l'emporte sur l'ancienne largeur.
    expect(savedPanelWidth({ customWidth: 350, width: 500 })).toBe(350)
  })

  it('jamais sous le minimum (280 px)', () => {
    expect(savedPanelWidth({ customWidth: 100 })).toBe(280)
    expect(savedPanelWidth({ width: 200 })).toBe(280)
  })

  it('enregistrée seulement si elle a été tirée à la main', () => {
    expect(panelWidthToSave(320, false)).toEqual({})
    expect(panelWidthToSave(440, false)).toEqual({})
    expect(panelWidthToSave(412.6, true)).toEqual({ customWidth: 413 })
  })
})
