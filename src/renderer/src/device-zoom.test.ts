import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { nextZoom, useDeviceZoom, zoomScale } from './device-zoom'

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

/**
 * Ancrage du défilement au changement de zoom : remplaçant des vérifications « zoom depuis
 * « ajuster » : le milieu reste au centre » des suites e2e `simulator` (#18) et `android` (#14),
 * inventaire B. La scène est simulée : sa taille de contenu suit l'échelle dessinée (appareil de
 * 400 × 800 points dans une vue de 200 × 400 pixels), comme le ferait la mise en page.
 */
describe('zoom des appareils : ce qu’on regardait reste au centre (fiche 084)', () => {
  const DEVICE = { width: 400, height: 800 }
  const VIEW = { width: 200, height: 400 }

  function stageFor(scale: () => number) {
    const el = document.createElement('div')
    const size = (side: 'width' | 'height') => Math.max(VIEW[side], DEVICE[side] * scale())
    Object.defineProperties(el, {
      clientWidth: { get: () => VIEW.width },
      clientHeight: { get: () => VIEW.height },
      scrollWidth: { get: () => size('width') },
      scrollHeight: { get: () => size('height') }
    })
    return el
  }

  function zoomed(fit: number) {
    let scale = fit
    const el = stageFor(() => scale)
    const hook = renderHook(() => {
      const zoom = useDeviceZoom(fit)
      // Échelle dessinée au rendu, avant que l'ancrage (effet de mise en page) ne lise la scène.
      scale = zoom.scale
      zoom.stage.current = el
      return zoom
    })
    return { el, hook }
  }

  it('depuis « ajuster » : le milieu de l’écran au centre, pas son coin en haut à gauche', () => {
    const { el, hook } = zoomed(0.5)
    expect(hook.result.current.zoom).toBe('fit')
    act(() => hook.result.current.setZoom(1.25))
    expect(hook.result.current.scale).toBe(1.25)
    // Contenu de 500 × 1000 pixels : le centre (250, 500) au milieu de la vue de 200 × 400.
    expect(el.scrollLeft).toBe(150)
    expect(el.scrollTop).toBe(300)
  })

  it('zoomé puis défilé : le point regardé reste au centre en zoomant encore', () => {
    const { el, hook } = zoomed(0.5)
    act(() => hook.result.current.setZoom(1))
    // On regarde le quart haut gauche : centre de la vue en (100, 200) sur 400 × 800.
    el.scrollLeft = 0
    el.scrollTop = 0
    act(() => hook.result.current.setZoom(2))
    // Même point (un quart, un quart) sur 800 × 1600 : (200, 400), au centre de la vue.
    expect(el.scrollLeft).toBe(100)
    expect(el.scrollTop).toBe(200)
  })
})
