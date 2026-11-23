import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  QuickShortcutRegistrar,
  revealWhenLoaded,
  type GlobalShortcuts,
  type PaintSignals
} from './quick-entry'

function shortcuts(taken: string[] = []) {
  const registered = new Set<string>()
  const api: GlobalShortcuts = {
    register: (accelerator) => {
      if (taken.includes(accelerator)) return false
      registered.add(accelerator)
      return true
    },
    unregister: (accelerator) => {
      registered.delete(accelerator)
    }
  }
  return { api, registered }
}

describe('raccourci global de la fenêtre rapide (fiche 062)', () => {
  it('un seul raccourci à la fois, réenregistré quand le réglage change', () => {
    const { api, registered } = shortcuts()
    const registrar = new QuickShortcutRegistrar(api, () => {})
    expect(registrar.apply('alt-cmd-b')).toEqual({ shortcut: 'alt-cmd-b', refused: false })
    expect([...registered]).toEqual(['Alt+CommandOrControl+B'])
    registrar.apply('alt-space')
    expect([...registered]).toEqual(['Alt+Space'])
    expect(registrar.apply('off')).toEqual({ shortcut: 'off', refused: false })
    expect([...registered]).toEqual([])
  })

  it('pris par une autre app : refusé, dit dans l’état', () => {
    const { api, registered } = shortcuts(['Alt+Space'])
    const registrar = new QuickShortcutRegistrar(api, () => {})
    expect(registrar.apply('alt-space')).toEqual({ shortcut: 'alt-space', refused: true })
    expect(registered.size).toBe(0)
    // Réessayé au prochain choix, même identique (l'autre app a pu le libérer).
    expect(registrar.apply('alt-cmd-b').refused).toBe(false)
    registrar.dispose()
    expect(registered.size).toBe(0)
  })
})

/** Fenêtre en chargement : ses évènements et ceux de sa page, émis à la main. */
function loadingWindow() {
  const win = new EventEmitter()
  const page = new EventEmitter()
  const signals = Object.assign(win, { webContents: page }) as unknown as PaintSignals
  const listeners = () => win.listenerCount('ready-to-show') + page.listenerCount('did-finish-load')
  return { win, page, signals, listeners }
}

describe('première ouverture de la fenêtre rapide : la page d’abord (fiches 062, 250)', () => {
  it('macOS (`hiddenPaint`) : montrée à `ready-to-show`, pas avant', () => {
    const { win, page, signals, listeners } = loadingWindow()
    const reveal = vi.fn()
    revealWhenLoaded(signals, reveal, true)
    page.emit('did-finish-load')
    expect(reveal).not.toHaveBeenCalled()
    win.emit('ready-to-show')
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(listeners()).toBe(0)
  })

  it('Linux : `ready-to-show` arrive le premier, montrée une fois', () => {
    const { win, page, signals, listeners } = loadingWindow()
    const reveal = vi.fn()
    revealWhenLoaded(signals, reveal, false)
    win.emit('ready-to-show')
    page.emit('did-finish-load')
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(listeners()).toBe(0)
  })

  it('Linux : `ready-to-show` ne vient pas, montrée à la fin du chargement', () => {
    const { win, page, signals, listeners } = loadingWindow()
    const reveal = vi.fn()
    revealWhenLoaded(signals, reveal, false)
    page.emit('did-finish-load')
    expect(reveal).toHaveBeenCalledTimes(1)
    // L'autre signal est oublié : pas de seconde révélation s'il vient plus tard.
    expect(listeners()).toBe(0)
    win.emit('ready-to-show')
    expect(reveal).toHaveBeenCalledTimes(1)
  })
})
