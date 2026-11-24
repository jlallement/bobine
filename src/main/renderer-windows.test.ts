import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_FEATURES, FEATURES_ARG } from '@shared/platform'
import { VIEW_ARG } from '@shared/window-view'

/**
 * Fenêtres du renderer (fiches 062, 116, 154, 186) avec un Electron simulé : préférences durcies
 * (AGENTS.md), liens externes vers le navigateur du système, aucune navigation de la fenêtre.
 * Remplace, côté main, la vérification « lien hors du guide ouvert dans le navigateur du système »
 * de l'e2e `aide` (n° 12) : seul le clic réel dans la page (`target=_blank`) y reste.
 */

type OpenHandler = (details: { url: string }) => { action: 'allow' | 'deny' }

/** Faux `webContents` : garde le gestionnaire d'ouverture et émet `will-navigate`. */
class FakeContents extends EventEmitter {
  openHandler: OpenHandler | undefined
  url = 'file:///app/renderer/index.html#help'
  setWindowOpenHandler(handler: OpenHandler): void {
    this.openHandler = handler
  }
  getURL(): string {
    return this.url
  }
}

class FakeWindow {
  static all: FakeWindow[] = []
  readonly options: Record<string, unknown>
  readonly webContents = new FakeContents()
  loaded: { file?: string; url?: string; options?: unknown } | undefined
  menuRemoved = false
  constructor(options: Record<string, unknown>) {
    this.options = options
    FakeWindow.all.push(this)
  }
  loadFile(file: string, options: unknown): Promise<void> {
    this.loaded = { file, options }
    return Promise.resolve()
  }
  loadURL(url: string): Promise<void> {
    this.loaded = { url }
    return Promise.resolve()
  }
  removeMenu(): void {
    this.menuRemoved = true
  }
  getBounds() {
    return { x: 0, y: 0, width: 1280, height: 820 }
  }
}

const openExternal = vi.fn(async (_url: string) => {})

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '1.0.0', getName: () => 'Bobine' },
  BrowserWindow: FakeWindow,
  nativeTheme: { shouldUseDarkColors: false },
  shell: { openExternal: (url: string) => openExternal(url) },
  Menu: {},
  clipboard: {}
}))
// Le menu contextuel a ses propres essais (`context-menu.test.ts`).
vi.mock('./context-menu', () => ({ attachContextMenu: vi.fn() }))

const windows = await import('./renderer-windows')

const theme = { theme: 'system', lightTheme: 'light', darkTheme: 'dark' } as const

beforeEach(() => {
  FakeWindow.all = []
  openExternal.mockClear()
})

describe('fenêtres du renderer', () => {
  it('préférences durcies sur chaque fenêtre (AGENTS.md)', () => {
    const made = [
      windows.createMainBrowserWindow(undefined, theme, ALL_FEATURES),
      windows.createQuickWindow(ALL_FEATURES),
      windows.createAboutWindow(undefined, theme, ALL_FEATURES),
      windows.createHelpWindow({ x: 0, y: 0, width: 900, height: 700 }, theme, ALL_FEATURES)
    ] as unknown as FakeWindow[]
    for (const win of made) {
      expect(win.options['webPreferences']).toMatchObject({
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      })
    }
  })

  it('fenêtre d’aide (fiche 186) : sa vue réduite sur la ligne de commande, page `#help`', () => {
    const win = windows.createHelpWindow(
      { x: 10, y: 20, width: 900, height: 700 },
      theme,
      ALL_FEATURES
    ) as unknown as FakeWindow
    const args = (win.options['webPreferences'] as { additionalArguments: string[] })
      .additionalArguments
    expect(args).toContain(`${VIEW_ARG}help`)
    expect(args.some((a) => a.startsWith(FEATURES_ARG))).toBe(true)
    expect(win.loaded).toEqual({ file: windows.RENDERER_FILE, options: { hash: 'help' } })
    // La fenêtre principale, elle, n'a pas la vue réduite.
    const main = windows.createMainBrowserWindow(undefined, theme, ALL_FEATURES) as unknown as {
      options: { webPreferences: { additionalArguments: string[] } }
    }
    expect(main.options.webPreferences.additionalArguments).not.toContain(`${VIEW_ARG}help`)
  })

  it('lien `target=_blank` (aide, fil) : http(s) dans le navigateur du système, jamais une fenêtre', () => {
    const win = windows.createHelpWindow(
      { x: 0, y: 0, width: 900, height: 700 },
      theme,
      ALL_FEATURES
    ) as unknown as FakeWindow
    const open = win.webContents.openHandler
    if (!open) throw new Error('pas de gestionnaire d’ouverture')
    const github = 'https://github.com/exemple/depot/blob/main/docs/guide.md'
    expect(open({ url: github })).toEqual({ action: 'deny' })
    expect(openExternal).toHaveBeenCalledWith(github)
    // Autre schéma (fichier, script, app) : refusé, rien d'ouvert.
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'mailto:a@b.c']) {
      expect(open({ url })).toEqual({ action: 'deny' })
    }
    expect(openExternal).toHaveBeenCalledTimes(1)
  })

  it('aucune navigation de la fenêtre : une autre adresse est bloquée, la sienne passe', () => {
    const win = windows.createQuickWindow(ALL_FEATURES) as unknown as FakeWindow
    const navigate = (url: string) => {
      const event = { preventDefault: vi.fn() }
      win.webContents.emit('will-navigate', event, url)
      return event.preventDefault.mock.calls.length > 0
    }
    expect(navigate('https://exemple.test/')).toBe(true)
    expect(navigate(win.webContents.url)).toBe(false)
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('À propos hors macOS (pas de menu d’app) : fenêtre sans menu ; sur macOS, le menu de l’app', () => {
    const linux = windows.createAboutWindow(undefined, theme, {
      ...ALL_FEATURES,
      appMenu: false
    }) as unknown as FakeWindow
    expect(linux.menuRemoved).toBe(true)
    const mac = windows.createAboutWindow(undefined, theme, ALL_FEATURES) as unknown as FakeWindow
    expect(mac.menuRemoved).toBe(false)
    expect(mac.loaded?.options).toEqual({ hash: 'about' })
  })
})
