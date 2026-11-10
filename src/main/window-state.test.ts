import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseWindowState,
  revealWindow,
  showRestored,
  trackWindowState,
  visibleBounds,
  type Rect,
  type TrackedWindow
} from './window-state'

/** Écran principal de 1512 × 982 points (barre des menus : 33), un second à sa droite. */
const primary: Rect = { x: 0, y: 33, width: 1512, height: 949 }
const right: Rect = { x: 1512, y: 0, width: 2560, height: 1440 }

describe('fenêtre rouverte à sa place (fiche 093)', () => {
  it('sur un écran présent : à l’identique, même à cheval sur deux écrans', () => {
    const saved = { x: 1300, y: 200, width: 1280, height: 820 }
    expect(visibleBounds(saved, { workAreas: [primary, right], primary })).toEqual(saved)
  })

  it('écran débranché : centrée sur l’écran principal, à une taille qui y tient', () => {
    const saved = { x: 1800, y: 100, width: 2000, height: 1200 }
    expect(visibleBounds(saved, { workAreas: [primary], primary })).toEqual({
      x: 0,
      y: 33,
      width: 1512,
      height: 949
    })
    const small = { x: -3000, y: 100, width: 1000, height: 700 }
    expect(visibleBounds(small, { workAreas: [primary], primary })).toEqual({
      x: 256,
      y: 158,
      width: 1000,
      height: 700
    })
  })

  it('barre du haut hors de l’écran (au-dessus, ou presque toute à gauche) : ramenée', () => {
    const above = { x: 100, y: -900, width: 1000, height: 700 }
    expect(visibleBounds(above, { workAreas: [primary], primary }).y).toBe(158)
    const left = { x: -950, y: 100, width: 1000, height: 700 }
    expect(visibleBounds(left, { workAreas: [primary], primary }).x).toBe(256)
  })

  it('écran devenu plus petit : taille ramenée, fenêtre rentrée dedans', () => {
    // Grande fenêtre d'un écran externe, laissée en partie sur l'écran du portable.
    const saved = { x: 600, y: 200, width: 1800, height: 1100 }
    expect(visibleBounds(saved, { workAreas: [primary], primary })).toEqual({
      x: 0,
      y: 33,
      width: 1512,
      height: 949
    })
  })

  it('lecture du réglage : nombres arrondis, valeurs mal formées écartées', () => {
    expect(parseWindowState({ x: 10.4, y: 20, width: 800, height: 600, fullScreen: true })).toEqual(
      { x: 10, y: 20, width: 800, height: 600, fullScreen: true }
    )
    expect(parseWindowState({ x: 0, y: 0, width: 0, height: 600 })).toBeUndefined()
    expect(parseWindowState({ x: 0, y: 0, width: 800 })).toBeUndefined()
    expect(parseWindowState('fenêtre')).toBeUndefined()
  })
})

describe('suivi de la fenêtre (fiche 093)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function fakeWindow() {
    const listeners = new Map<string, () => void>()
    const state = { bounds: { x: 10, y: 20, width: 900, height: 600 }, max: false, full: false }
    const win: TrackedWindow = {
      on: (event, listener) => listeners.set(event, listener),
      getNormalBounds: () => state.bounds,
      isMaximized: () => state.max,
      isFullScreen: () => state.full
    }
    return { win, state, emit: (event: string) => listeners.get(event)?.() }
  }

  it('déplacement : enregistré une fois le geste fini ; fermeture : tout de suite', () => {
    vi.useFakeTimers()
    const { win, state, emit } = fakeWindow()
    const save = vi.fn()
    trackWindowState(win, save, 500)
    emit('move')
    state.bounds = { ...state.bounds, x: 300 }
    emit('move')
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(save).toHaveBeenCalledExactlyOnceWith({ x: 300, y: 20, width: 900, height: 600 })
    state.bounds = { ...state.bounds, width: 1000 }
    emit('resize')
    emit('close')
    expect(save).toHaveBeenLastCalledWith({ x: 300, y: 20, width: 1000, height: 600 })
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('agrandie, plein écran : retenus avec la taille normale', () => {
    const { win, state, emit } = fakeWindow()
    const save = vi.fn()
    trackWindowState(win, save)
    state.max = true
    emit('maximize')
    state.full = true
    emit('enter-full-screen')
    expect(save).toHaveBeenLastCalledWith({
      x: 10,
      y: 20,
      width: 900,
      height: 600,
      maximized: true,
      fullScreen: true
    })
  })

  it('affichage : agrandie avant de se montrer, plein écran ensuite', () => {
    const calls: string[] = []
    const win = {
      maximize: () => calls.push('maximize'),
      show: () => calls.push('show'),
      showInactive: () => calls.push('showInactive'),
      setFullScreen: (flag: boolean) => calls.push(`fullscreen ${flag}`)
    }
    showRestored(win, undefined)
    expect(calls).toEqual(['show'])
    calls.length = 0
    showRestored(win, { x: 0, y: 0, width: 1, height: 1, maximized: true, fullScreen: true })
    expect(calls).toEqual(['maximize', 'show', 'fullscreen true'])
    // Essais de bout en bout (fiche 106) : montrée sans prendre le focus de la machine.
    calls.length = 0
    showRestored(win, { x: 0, y: 0, width: 1, height: 1, maximized: true }, true)
    expect(calls).toEqual(['maximize', 'showInactive'])
  })

  it('ramenée devant l’utilisateur ; sans prendre le focus pendant les essais (fiche 106)', () => {
    const calls: string[] = []
    let minimized = true
    const win = {
      isMinimized: () => minimized,
      restore: () => {
        calls.push('restore')
        minimized = false
      },
      show: () => calls.push('show'),
      showInactive: () => calls.push('showInactive'),
      focus: () => calls.push('focus')
    }
    revealWindow(win)
    expect(calls).toEqual(['restore', 'show', 'focus'])
    calls.length = 0
    revealWindow(win, true)
    expect(calls).toEqual(['showInactive'])
  })
})
