import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'

/** Electron simulé : le menu construit garde son modèle ; une page qui a le clavier. */
const state = vi.hoisted(() => ({
  clicked: [] as string[],
  focused: { copy: vi.fn(), paste: vi.fn(), undo: vi.fn() },
  hidden: 0
}))
vi.mock('electron', () => {
  const find = (
    items: MenuItemConstructorOptions[],
    id: string
  ): MenuItemConstructorOptions | undefined => {
    for (const item of items) {
      if (item.id === id) return item
      if (Array.isArray(item.submenu)) {
        const found = find(item.submenu, id)
        if (found) return found
      }
    }
    return undefined
  }
  return {
    app: { on: vi.fn(), quit: vi.fn(), showAboutPanel: vi.fn() },
    BrowserWindow: {
      getAllWindows: () => [{ setMenuBarVisibility: () => (state.hidden += 1) }],
      getFocusedWindow: () => null,
      fromWebContents: () => null
    },
    Menu: {
      buildFromTemplate: (template: MenuItemConstructorOptions[]) => ({
        getMenuItemById: (id: string) => {
          const item = find(template, id)
          return item ? { click: () => state.clicked.push(id) } : null
        }
      }),
      setApplicationMenu: vi.fn()
    },
    webContents: { getFocusedWebContents: () => state.focused }
  }
})

const { appMenu } = await import('./app-menu')
const { buildMenuTemplate } = await import('./menu')

const build = (appMenuForm: boolean) => () =>
  buildMenuTemplate({
    appName: 'Bobine',
    appMenu: appMenuForm,
    dev: false,
    send: vi.fn(),
    about: vi.fn()
  })

describe('menu ☰ de Bobine hors macOS (fiche 145)', () => {
  beforeEach(() => {
    state.clicked = []
    state.hidden = 0
  })

  it('macOS : pas de modèle, la barre du système reste', () => {
    const menu = appMenu({ appMenu: true }, build(true))
    menu.refresh()
    expect(menu.model()).toBeNull()
    expect(state.hidden).toBe(0)
  })

  it('Linux : barre d’Electron masquée, modèle servi, entrées connues déclenchées', () => {
    const menu = appMenu({ appMenu: false }, build(false))
    menu.refresh()
    expect(state.hidden).toBe(1)
    expect(menu.model()?.length).toBeGreaterThan(5)
    menu.invoke('new-conversation')
    expect(state.clicked).toEqual(['new-conversation'])
    menu.invoke('role:copy')
    expect(state.focused.copy).toHaveBeenCalled()
  })

  it('refuse un identifiant hors du modèle, ou qui n’est pas une chaîne', () => {
    const menu = appMenu({ appMenu: false }, build(false))
    expect(() => menu.invoke('new-conversation')).toThrow('Entrée de menu inconnue')
    menu.refresh()
    for (const bad of ['open-anything', 'role:toggleDevTools', 'menu-edit', 42, null]) {
      expect(() => menu.invoke(bad)).toThrow('Entrée de menu inconnue')
    }
    expect(state.clicked).toEqual([])
  })
})
