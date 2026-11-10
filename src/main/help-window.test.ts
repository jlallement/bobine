import { describe, expect, it, vi } from 'vitest'
import {
  HelpWindow,
  helpBounds,
  helpTarget,
  HELP_SIZE,
  type HelpBrowserWindow
} from './help-window'

function fakeWindow() {
  const handlers = new Map<string, () => void>()
  let destroyed = false
  return {
    isDestroyed: () => destroyed,
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
  } satisfies HelpBrowserWindow & { emit: (event: string) => void }
}

const SCREEN = { x: 0, y: 25, width: 2560, height: 1415 }

describe('fenêtre d’aide (fiche 186)', () => {
  it('collée à droite de la fenêtre principale s’il y a la place, même haut', () => {
    expect(helpBounds({ x: 100, y: 80, width: 1280, height: 820 }, SCREEN)).toEqual({
      x: 1388,
      y: 80,
      width: HELP_SIZE.width,
      height: 820
    })
  })

  it('sinon contre le bord droit de l’écran, par-dessus la fenêtre principale', () => {
    const small = { x: 0, y: 25, width: 1440, height: 875 }
    expect(helpBounds({ x: 0, y: 25, width: 1440, height: 875 }, small)).toEqual({
      x: 1440 - HELP_SIZE.width,
      y: 25,
      width: HELP_SIZE.width,
      height: 875
    })
    // Fenêtre principale très basse ou très petite : l'aide reste dans l'écran, hauteur minimale.
    expect(helpBounds({ x: 0, y: 800, width: 500, height: 200 }, small)).toMatchObject({
      y: 900 - 420,
      height: 420
    })
  })

  it('sans fenêtre principale : centrée sur l’écran', () => {
    expect(helpBounds(undefined, SCREEN)).toMatchObject({ x: 850, width: HELP_SIZE.width })
  })

  it('une seule : la première cible est lue par la page, les suivantes lui sont envoyées', () => {
    const created: ReturnType<typeof fakeWindow>[] = []
    const navigate = vi.fn()
    const focusSearch = vi.fn()
    const help = new HelpWindow({
      create: () => {
        const win = fakeWindow()
        created.push(win)
        return win
      },
      navigate,
      focusSearch
    })
    help.show('worktreeSetup')
    // Seconde demande avant que la page n'ait lu sa cible : elle la remplace, rien n'est perdu.
    help.show('review', { search: true })
    expect(navigate).not.toHaveBeenCalled()
    expect(help.initialTarget()).toEqual({
      target: { page: 'faire-relire', anchor: 'lancer' },
      search: true
    })
    created[0]?.emit('ready-to-show')
    expect(created[0]?.show).toHaveBeenCalled()
    // Page chargée : les demandes suivantes vont à cette fenêtre-là.
    help.show('aside')
    help.show(null, { search: true })
    expect(created).toHaveLength(1)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(created[0], { page: 'aparte', anchor: 'poser' })
    expect(focusSearch).toHaveBeenCalledWith(created[0])

    // Fermée, puis rouverte par ⌘? : une nouvelle, sur l'accueil, curseur dans la recherche.
    help.close()
    help.show(null, { search: true })
    expect(created).toHaveLength(2)
    expect(help.initialTarget()).toEqual({ target: helpTarget(null), search: true })
  })
})

describe('fenêtre d’aide : jamais hors de l’écran (fiche 186)', () => {
  it('petit écran 1280 × 800 et autres cas : toujours dans la zone utile', () => {
    const screens = [
      { x: 0, y: 25, width: 1280, height: 775 },
      { x: 0, y: 25, width: 1440, height: 875 },
      { x: -1280, y: 0, width: 1280, height: 800 },
      { x: 2560, y: 0, width: 1920, height: 1055 }
    ]
    for (const work of screens) {
      const mains = [
        { x: work.x, y: work.y, width: work.width, height: work.height },
        { x: work.x + 100, y: work.y + 50, width: 800, height: 500 },
        { x: work.x + work.width - 300, y: work.y + work.height - 200, width: 800, height: 600 }
      ]
      for (const main of [...mains, undefined]) {
        const b = helpBounds(main, work)
        const where = JSON.stringify({ work, main, b })
        expect(b.x, where).toBeGreaterThanOrEqual(work.x)
        expect(b.y, where).toBeGreaterThanOrEqual(work.y)
        expect(b.x + b.width, where).toBeLessThanOrEqual(work.x + work.width)
        expect(b.y + b.height, where).toBeLessThanOrEqual(work.y + work.height)
        expect(b.width, where).toBeGreaterThanOrEqual(640)
      }
    }
  })
})
