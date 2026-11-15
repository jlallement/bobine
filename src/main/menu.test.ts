import { describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { SHORTCUTS } from '@shared/shortcuts'
import { buildMenuTemplate, zoomInterface } from './menu'

const flatten = (items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] =>
  items.flatMap((i) => [i, ...(Array.isArray(i.submenu) ? flatten(i.submenu) : [])])

describe('menu de l’app', () => {
  it('zoom : entrées qui choisissent leur cible, ⌘= en plus de ⌘+ (fiche 129)', () => {
    const zoom = vi.fn()
    const items = flatten(buildMenuTemplate({ appName: 'Bobine', dev: false, send: vi.fn(), zoom }))
    const byId = (id: string) => items.find((i) => i.id === id)
    expect(items.map((i) => i.role)).not.toContain('zoomIn')
    expect(byId('zoom-in')?.accelerator).toBe('CommandOrControl+Plus')
    expect(byId('zoom-in-equal')).toMatchObject({
      accelerator: 'CommandOrControl+=',
      visible: false
    })
    expect(byId('zoom-out')?.accelerator).toBe('CommandOrControl+-')
    expect(byId('reset-zoom')?.accelerator).toBe('CommandOrControl+0')
    for (const [id, action] of [
      ['zoom-in', 'in'],
      ['zoom-in-equal', 'in'],
      ['zoom-out', 'out'],
      ['reset-zoom', 'reset']
    ] as const) {
      ;(byId(id)?.click as () => void)()
      expect(zoom).toHaveBeenLastCalledWith(action)
    }
    // Sans cible fournie : les rôles d'Electron, comme avant.
    const roles = flatten(buildMenuTemplate({ appName: 'Bobine', dev: false, send: vi.fn() }))
    expect(roles.map((i) => i.role)).toEqual(
      expect.arrayContaining(['zoomIn', 'zoomOut', 'resetZoom'])
    )
  })

  it('zoom de l’interface : un demi-niveau, comme les rôles d’Electron', () => {
    let level = 0
    const contents = {
      getZoomLevel: () => level,
      setZoomLevel: (next: number) => (level = next)
    } as unknown as Parameters<typeof zoomInterface>[0]
    zoomInterface(contents, 'in')
    zoomInterface(contents, 'in')
    expect(level).toBe(1)
    zoomInterface(contents, 'out')
    expect(level).toBe(0.5)
    zoomInterface(contents, 'reset')
    expect(level).toBe(0)
  })

  it('chaque raccourci est dans le menu, une seule fois, et envoie sa commande', () => {
    const send = vi.fn()
    const items = flatten(buildMenuTemplate({ appName: 'Bobine', dev: false, send }))
    for (const shortcut of SHORTCUTS) {
      const found = items.filter((i) => i.id === shortcut.command)
      expect(found, shortcut.command).toHaveLength(1)
      expect(found[0]?.accelerator).toBe(shortcut.accelerator)
      ;(found[0]?.click as () => void)()
      expect(send).toHaveBeenLastCalledWith(shortcut.command)
    }
  })

  it('raccourcis tous différents ; outils de développement seulement en dev', () => {
    const accelerators = SHORTCUTS.map((s) => s.accelerator)
    expect(new Set(accelerators).size).toBe(accelerators.length)
    const roles = (dev: boolean) =>
      flatten(buildMenuTemplate({ appName: 'Bobine', dev, send: () => {} })).map((i) => i.role)
    expect(roles(false)).not.toContain('toggleDevTools')
    expect(roles(true)).toContain('toggleDevTools')
    expect(roles(false)).toEqual(expect.arrayContaining(['copy', 'paste', 'quit', 'about']))
  })

  it('un seul « Plein écran », sans rôle, qui dit « Quitter » en plein écran (fiche 126)', () => {
    const toggleFullScreen = vi.fn()
    const items = (fullScreen: boolean) =>
      flatten(
        buildMenuTemplate({
          appName: 'Bobine',
          dev: false,
          send: () => {},
          fullScreen,
          toggleFullScreen
        })
      )
    expect(items(false).map((i) => i.role)).not.toContain('togglefullscreen')
    const item = (fullScreen: boolean) => items(fullScreen).filter((i) => i.id === 'fullscreen')
    expect(item(false).map((i) => i.label)).toEqual(['Plein écran'])
    expect(item(true).map((i) => i.label)).toEqual(['Quitter le plein écran'])
    ;(item(false)[0]?.click as () => void)()
    expect(toggleFullScreen).toHaveBeenCalled()
  })

  it('entrées des rôles d’Electron toutes traduites, menu Fenêtre compris (fiche 093)', () => {
    const template = buildMenuTemplate({ appName: 'Bobine', dev: true, send: () => {} })
    const unlabelled = flatten(template).filter((i) => i.role && !i.label)
    expect(unlabelled.map((i) => i.role)).toEqual([])
    const windowMenu = template.find((i) => i.role === 'windowMenu')
    const labels = (windowMenu?.submenu as MenuItemConstructorOptions[]).map((i) => i.label)
    expect(labels).toEqual([
      'Mon activité',
      undefined,
      'Minimiser',
      'Réduire/agrandir',
      undefined,
      'Tout ramener au premier plan'
    ])
  })

  it('Fenêtre › Mon activité, ⇧⌘U (fiche 144)', () => {
    const send = vi.fn()
    const template = buildMenuTemplate({ appName: 'Bobine', dev: false, send })
    const windowMenu = template.find((i) => i.role === 'windowMenu')
    const item = (windowMenu?.submenu as MenuItemConstructorOptions[])[0]
    expect(item).toMatchObject({ id: 'activity', accelerator: 'CmdOrCtrl+Shift+U' })
    ;(item?.click as () => void)()
    expect(send).toHaveBeenCalledWith('activity')
  })

  it('À propos : la fenêtre de l’app quand elle est fournie, plus le panneau de macOS (fiche 116)', () => {
    const about = vi.fn()
    const items = flatten(
      buildMenuTemplate({ appName: 'Bobine', dev: false, send: () => {}, about })
    )
    const item = items.find((i) => i.id === 'about')
    expect(item?.label).toBe('À propos de Bobine')
    expect(item?.role).toBeUndefined()
    ;(item?.click as () => void)()
    expect(about).toHaveBeenCalledOnce()
    expect(items.map((i) => i.role)).not.toContain('about')
  })

  it('Affichage › Mode présentation : case cochée selon l’état (fiche 159)', () => {
    const toggle = vi.fn()
    const find = (active: boolean) =>
      flatten(
        buildMenuTemplate({
          appName: 'Bobine',
          dev: false,
          send: vi.fn(),
          presentation: { active, toggle }
        })
      ).find((i) => i.id === 'presentation')
    expect(find(false)).toMatchObject({ type: 'checkbox', checked: false })
    expect(find(true)).toMatchObject({ type: 'checkbox', checked: true })
    ;(find(true)?.click as () => void)()
    expect(toggle).toHaveBeenCalledOnce()
    // Sans l’option : pas d’entrée.
    const without = flatten(buildMenuTemplate({ appName: 'Bobine', dev: false, send: vi.fn() }))
    expect(without.some((i) => i.id === 'presentation')).toBe(false)
  })
})

describe('menu Linux (fiche 145)', () => {
  const options = {
    appName: 'Bobine',
    dev: false,
    send: vi.fn(),
    about: vi.fn(),
    showLog: vi.fn(),
    zoom: vi.fn(),
    presentation: { active: false, toggle: vi.fn() },
    quickEntry: { open: vi.fn(), accelerator: 'Alt+CommandOrControl+B' }
  }
  const linux = buildMenuTemplate({ ...options, appMenu: false })
  const submenu = (label: string) =>
    (linux.find((m) => m.label === label)?.submenu ?? []) as MenuItemConstructorOptions[]

  it('menus des apps Linux : ni menu « Bobine » ni Fenêtre', () => {
    expect(linux.map((m) => m.label)).toEqual([
      'Fichier',
      'Édition',
      'Affichage',
      'Conversation',
      'Aide'
    ])
    const roles = flatten(linux).map((i) => i.role)
    for (const mac of [
      'services',
      'hide',
      'hideOthers',
      'unhide',
      'front',
      'zoom',
      'minimize',
      'windowMenu',
      'help',
      'pasteAndMatchStyle'
    ]) {
      expect(roles).not.toContain(mac)
    }
  })

  it('Fichier : nouvelle conversation, fenêtre rapide, Réglages (Ctrl+,), fermer, Quitter (Ctrl+Q)', () => {
    const file = submenu('Fichier').filter((i) => i.type !== 'separator')
    expect(file.map((i) => i.id ?? i.role)).toEqual([
      'new-conversation',
      'search',
      'resume-session',
      'quick-entry',
      'settings',
      'close',
      'quit'
    ])
    expect(file.find((i) => i.id === 'settings')?.accelerator).toBe('CmdOrCtrl+,')
    expect(file.at(-1)?.accelerator).toBe('Ctrl+Q')
  })

  it('Affichage : Mon activité et plein écran en F11 ; Aide : À propos en dernier', () => {
    const view = submenu('Affichage')
    expect(view.map((i) => i.id)).toContain('activity')
    expect(view.find((i) => i.id === 'fullscreen')?.accelerator).toBe('F11')
    const help = submenu('Aide')
    expect(help.map((i) => i.id).filter(Boolean)).toEqual([
      'help',
      'shortcuts',
      'diagnostics',
      'show-log',
      'about'
    ])
    ;(help.at(-1)?.click as () => void)()
    expect(options.about).toHaveBeenCalled()
  })

  it('chaque raccourci de l’app y est une fois, avec son accélérateur CmdOrCtrl', () => {
    const items = flatten(linux)
    for (const shortcut of SHORTCUTS) {
      const found = items.filter((i) => i.id === shortcut.command)
      expect([shortcut.command, found.length]).toEqual([shortcut.command, 1])
      expect(found[0]?.accelerator).toBe(shortcut.accelerator)
    }
  })

  it('macOS inchangé : `appMenu` vrai ou absent, même menu', () => {
    const strip = (items: MenuItemConstructorOptions[]) => JSON.stringify(items)
    expect(strip(buildMenuTemplate({ ...options, appMenu: true }))).toBe(
      strip(buildMenuTemplate(options))
    )
    expect(buildMenuTemplate(options).map((m) => m.label)).toEqual([
      'Bobine',
      'Fichier',
      'Édition',
      'Affichage',
      'Conversation',
      'Fenêtre',
      'Aide'
    ])
  })
})
