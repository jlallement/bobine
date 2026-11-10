import { describe, expect, it, vi } from 'vitest'
import { AboutWindow, centerOn, type AboutBrowserWindow } from './about-window'

/** Fenêtre factice : évènements, visibilité, fermeture. */
function fakeWindow() {
  const handlers = new Map<string, () => void>()
  let destroyed = false
  const win = {
    isDestroyed: () => destroyed,
    isVisible: () => true,
    isMinimized: () => false,
    restore: vi.fn(),
    show: vi.fn(),
    showInactive: vi.fn(),
    focus: vi.fn(),
    close: vi.fn(() => {
      destroyed = true
      handlers.get('closed')?.()
    }),
    once: (event: string, listener: () => void) => handlers.set(event, listener),
    on: (event: string, listener: () => void) => handlers.set(event, listener),
    emit: (event: string) => handlers.get(event)?.()
  }
  return win satisfies AboutBrowserWindow
}

describe('fenêtre À propos (fiche 116)', () => {
  it('centrée sur la fenêtre principale, un peu au-dessus du milieu', () => {
    expect(
      centerOn({ x: 100, y: 50, width: 1280, height: 820 }, { width: 400, height: 420 })
    ).toEqual({ x: 540, y: 183 })
    // Fenêtre principale plus petite : jamais au-dessus de son bord haut.
    expect(centerOn({ x: 0, y: 0, width: 300, height: 300 }, { width: 400, height: 420 })).toEqual({
      x: -50,
      y: 0
    })
  })

  it('une seule à la fois, enfant de la fenêtre principale, montrée une fois prête', () => {
    const main = fakeWindow()
    const created: ReturnType<typeof fakeWindow>[] = []
    const create = vi.fn(() => {
      const win = fakeWindow()
      created.push(win)
      return win
    })
    const about = new AboutWindow({ create, parent: () => main })
    about.show()
    expect(create).toHaveBeenCalledWith(main)
    const [win] = created
    expect(win?.show).not.toHaveBeenCalled()
    win?.emit('ready-to-show')
    expect(win?.show).toHaveBeenCalledOnce()

    // Seconde ouverture : la même, ramenée.
    about.show()
    expect(create).toHaveBeenCalledOnce()
    expect(win?.show).toHaveBeenCalledTimes(2)

    // Fermée (Échap, ⌘W, feu rouge) : la suivante est neuve.
    about.close()
    expect(win?.close).toHaveBeenCalledOnce()
    about.show()
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('sans fenêtre principale : seule ; essais : montrée sans prendre le focus', () => {
    const create = vi.fn(() => fakeWindow())
    const about = new AboutWindow({ create, parent: () => undefined, inactive: true })
    about.show()
    expect(create).toHaveBeenCalledWith(undefined)
    const win = create.mock.results[0]?.value as ReturnType<typeof fakeWindow>
    win.emit('ready-to-show')
    expect(win.showInactive).toHaveBeenCalledOnce()
    expect(win.show).not.toHaveBeenCalled()
    about.close()
    about.close()
    expect(win.close).toHaveBeenCalledOnce()
  })
})
