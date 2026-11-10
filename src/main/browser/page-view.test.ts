import { describe, expect, it } from 'vitest'
import {
  cssViewport,
  emulationFrame,
  nextZoom,
  pageShortcut,
  windowBounds,
  ZOOM_STEPS,
  type PageKey
} from './page-view'

const key = (over: Partial<PageKey>): PageKey => ({
  type: 'keyDown',
  key: '',
  meta: false,
  control: false,
  alt: false,
  shift: false,
  ...over
})

describe('vue de la page (fiche 129)', () => {
  it('paliers de zoom de Chrome : suivant, précédent, bornes, valeur hors palier', () => {
    expect(nextZoom(1, 'in')).toBe(1.1)
    expect(nextZoom(1.1, 'in')).toBe(1.25)
    expect(nextZoom(1.25, 'in')).toBe(1.5)
    expect(nextZoom(1, 'out')).toBe(0.9)
    expect(nextZoom(0.9, 'out')).toBe(0.8)
    expect(nextZoom(1.75, 'reset')).toBe(1)
    expect(nextZoom(5, 'in')).toBe(5)
    expect(nextZoom(0.25, 'out')).toBe(0.25)
    // Zoom posé ailleurs (rôle d'Electron : ×1,095) : on rejoint le palier voisin.
    expect(nextZoom(1.0954, 'in')).toBe(1.1)
    expect(nextZoom(1.0954, 'out')).toBe(1)
    // Aller-retour : on retombe sur 100 %.
    let zoom = 1
    for (let i = 0; i < 4; i++) zoom = nextZoom(zoom, 'in')
    for (let i = 0; i < 4; i++) zoom = nextZoom(zoom, 'out')
    expect(zoom).toBe(1)
    expect([...ZOOM_STEPS].sort((a, b) => a - b)).toEqual([...ZOOM_STEPS])
  })

  it('zone en CSS de l’interface → bornes de la vue en pixels de la fenêtre, de 80 à 150 %', () => {
    const css = { x: 600.4, y: 88.6, width: 420.3, height: 700 }
    expect(windowBounds(css, 1)).toEqual({ x: 600, y: 89, width: 421, height: 700 })
    expect(windowBounds(css, 1.5)).toEqual({ x: 901, y: 133, width: 630, height: 1050 })
    expect(windowBounds(css, 0.8)).toEqual({ x: 480, y: 71, width: 337, height: 560 })
    // Les bords tombent sur ceux de la zone, sans trou d'un pixel entre deux zones voisines.
    const left = windowBounds({ x: 0, y: 0, width: 300.5, height: 10 }, 1.25)
    const right = windowBounds({ x: 300.5, y: 0, width: 100, height: 10 }, 1.25)
    expect(left.x + left.width).toBe(right.x)
    expect(windowBounds({ x: 0, y: 0, width: 0, height: 0 }, 1)).toMatchObject({
      width: 1,
      height: 1
    })
  })

  it('taille imposée par l’agent : réduite pour tenir entière, centrée en haut de la zone', () => {
    const area = { x: 600, y: 90, width: 500, height: 600 }
    const mobile = emulationFrame(area, { width: 375, height: 812, mobile: true })
    expect(mobile.emulation.scale).toBeCloseTo(600 / 812)
    expect(mobile.bounds).toEqual({
      x: 600 + Math.floor((500 - 277) / 2),
      y: 90,
      width: 277,
      height: 600
    })
    // Plus étroite et moins haute que la zone : pas agrandie, centrée.
    const small = emulationFrame(area, { width: 320, height: 480, mobile: false })
    expect(small.emulation.scale).toBe(1)
    expect(small.bounds).toEqual({ x: 690, y: 90, width: 320, height: 480 })
    // Bureau plus large que le panneau : réduite en largeur, jamais coupée.
    const desktop = emulationFrame(area, { width: 1440, height: 900, mobile: false })
    expect(desktop.emulation.scale).toBeCloseTo(500 / 1440)
    expect(desktop.bounds.width).toBe(500)
    expect(desktop.bounds.height).toBeLessThanOrEqual(600)
  })

  it('fenêtre de la page en pixels CSS : vue ÷ zoom de la page, ou la taille imposée', () => {
    expect(cssViewport({ width: 500, height: 600 }, 1)).toEqual({ width: 500, height: 600 })
    expect(cssViewport({ width: 500, height: 600 }, 1.5)).toEqual({ width: 333, height: 400 })
    expect(cssViewport({ width: 277, height: 600 }, 1.5, { width: 375, height: 812 })).toEqual({
      width: 375,
      height: 812
    })
  })

  it('raccourcis de la page : ⌘ sur macOS, Ctrl ailleurs ; le reste va à la page', () => {
    const mac = (over: Partial<PageKey>) => pageShortcut(key({ meta: true, ...over }), 'darwin')
    expect(mac({ key: '=' })).toEqual({ kind: 'zoom', action: 'in' })
    expect(mac({ key: '+', shift: true })).toEqual({ kind: 'zoom', action: 'in' })
    expect(mac({ key: '-' })).toEqual({ kind: 'zoom', action: 'out' })
    expect(mac({ key: '0' })).toEqual({ kind: 'zoom', action: 'reset' })
    // Clavier français : ⌘⇧à donne la touche physique du 0.
    expect(mac({ key: 'à', code: 'Digit0', shift: true })).toEqual({
      kind: 'zoom',
      action: 'reset'
    })
    expect(mac({ key: 'l' })).toEqual({ kind: 'focus-address' })
    expect(mac({ key: 'L' })).toEqual({ kind: 'focus-address' })
    expect(mac({ key: 'r' })).toEqual({ kind: 'reload' })
    expect(mac({ key: '[' })).toEqual({ kind: 'back' })
    expect(mac({ key: ']' })).toEqual({ kind: 'forward' })
    // ⌘⇧R, ⌘⌥L, ⌘C, touche relâchée, sans ⌘ : pour la page.
    expect(mac({ key: 'r', shift: true })).toBeUndefined()
    expect(mac({ key: 'l', alt: true })).toBeUndefined()
    expect(mac({ key: 'c' })).toBeUndefined()
    expect(mac({ key: 'l', type: 'keyUp' })).toBeUndefined()
    expect(pageShortcut(key({ key: 'l' }), 'darwin')).toBeUndefined()
    expect(pageShortcut(key({ key: 'l', control: true }), 'darwin')).toBeUndefined()
    expect(pageShortcut(key({ key: 'l', control: true }), 'linux')).toEqual({
      kind: 'focus-address'
    })
  })
})
