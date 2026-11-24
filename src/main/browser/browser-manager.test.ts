/**
 * « Effacer les données du navigateur » (fiche 072) côté main, sans Chromium : les sessions
 * d'Electron sont simulées. Les cookies réellement partis d'une page restent vus par l'e2e.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const userData = mkdtempSync(join(tmpdir(), 'bobine-browser-manager-'))

/** Une session simulée : ce qui est vidé, dans l'ordre. */
function fakeSession(name: string, cleared: string[]) {
  return {
    name,
    clearStorageData: vi.fn(async () => void cleared.push(`${name}:storage`)),
    clearCache: vi.fn(async () => void cleared.push(`${name}:cache`)),
    clearAuthCache: vi.fn(async () => void cleared.push(`${name}:auth`)),
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    on: vi.fn(),
    getUserAgent: () => 'Mozilla/5.0 Chrome/140 Electron/45.4.1 bobine/1.0.0',
    setUserAgent: vi.fn()
  }
}

let cleared: string[] = []
const showSaveDialog = vi.fn()
const sessions = new Map<string, ReturnType<typeof fakeSession>>()
vi.mock('electron', () => ({
  app: { getPath: () => userData, on: vi.fn() },
  dialog: { showSaveDialog: (...args: unknown[]) => showSaveDialog(...args) },
  shell: {},
  WebContentsView: vi.fn(),
  webContents: { getAllWebContents: () => [] },
  session: {
    fromPartition: (partition: string) => {
      let s = sessions.get(partition)
      if (!s) {
        s = fakeSession(partition, cleared)
        sessions.set(partition, s)
      }
      return s
    }
  }
}))

const { BrowserManager } = await import('./browser-manager')

beforeEach(() => {
  cleared = []
  sessions.clear()
})
afterAll(() => rmSync(userData, { recursive: true, force: true }))

describe('« Effacer les données du navigateur » (fiche 072)', () => {
  it('cookies gardés : la partition du disque vidée (stockage, cache, connexions), une fois', async () => {
    const manager = new BrowserManager({ emitState: () => {}, keepCookies: () => true })
    await manager.clearData()
    expect(cleared).toEqual([
      'persist:bob-browser:storage',
      'persist:bob-browser:cache',
      'persist:bob-browser:auth'
    ])
  })

  it('cookies pas gardés : la session en mémoire et ce qui restait sur le disque', async () => {
    const manager = new BrowserManager({ emitState: () => {}, keepCookies: () => false })
    await manager.clearData()
    expect(new Set(cleared)).toEqual(
      new Set([
        'persist:bob-browser:storage',
        'persist:bob-browser:cache',
        'persist:bob-browser:auth',
        'bob-browser-memoire:storage',
        'bob-browser-memoire:cache',
        'bob-browser-memoire:auth'
      ])
    )
  })

  it('un vidage en échec : l’erreur remonte (la note de Réglages la dit)', async () => {
    const manager = new BrowserManager({ emitState: () => {}, keepCookies: () => true })
    sessions.set('persist:bob-browser', {
      ...fakeSession('persist:bob-browser', cleared),
      clearStorageData: vi.fn(async () => {
        throw new Error('partition occupée')
      })
    })
    await expect(manager.clearData()).rejects.toThrow('partition occupée')
  })
})

/** Un onglet simulé : ce que l'état et la mise en place en lisent. */
function fakeTab(id: string, url: string) {
  let destroyed = false
  return {
    id,
    usedCertificates: [],
    cdp: { emulation: undefined },
    view: {
      setVisible: vi.fn(),
      setBounds: vi.fn(),
      webContents: {
        isDestroyed: () => destroyed,
        close: vi.fn(() => (destroyed = true)),
        getTitle: () => id,
        getURL: () => url,
        isLoading: () => false,
        getZoomFactor: () => 1,
        navigationHistory: { canGoBack: () => false, canGoForward: () => false }
      }
    }
  }
}

describe('onglets d’une conversation (fiche 007)', () => {
  function withTabs(active: string) {
    const states: { activeTab: string; tabs: { id: string }[] }[] = []
    const manager = new BrowserManager({ emitState: (s) => states.push(s) })
    const tabs = [
      fakeTab('t1', 'http://localhost:5173/'),
      fakeTab('t2', 'https://exemple.com/'),
      fakeTab('t3', 'https://exemple.org/')
    ]
    const browsers = (manager as unknown as { browsers: Map<string, unknown> }).browsers
    browsers.set('c1', { tabs: [...tabs], active, bounds: undefined, area: undefined })
    return { manager, tabs, states }
  }

  it('l’onglet actif fermé : le suivant prend sa place, le dernier rend la main au précédent', () => {
    const { manager, tabs, states } = withTabs('t2')
    manager.closeTab('c1', 't2')
    expect(tabs[1]?.view.webContents.close).toHaveBeenCalled()
    expect(states.at(-1)?.activeTab).toBe('t3')
    manager.closeTab('c1', 't3')
    expect(states.at(-1)?.activeTab).toBe('t1')
    expect(states.at(-1)?.tabs.map((t) => t.id)).toEqual(['t1'])
    // Panneau fermé (pas de zone) : la page restante n'est pas posée.
    expect(tabs[0]?.view.setVisible).toHaveBeenLastCalledWith(false)
  })

  it('un autre onglet fermé : l’actif ne change pas ; inconnu : refusé', () => {
    const { manager, states } = withTabs('t1')
    manager.closeTab('c1', 't3')
    expect(states.at(-1)?.activeTab).toBe('t1')
    expect(() => manager.closeTab('c1', 'tx')).toThrow('Onglet inconnu')
  })
})

describe('« Enregistrer sous » d’un téléchargement (fiche 094)', () => {
  /** Téléchargement simulé : « Annuler » le termine. */
  function fakeItem(name: string) {
    let done: (event: unknown, state: string) => void = () => {}
    return {
      getFilename: () => name,
      setSavePath: vi.fn(),
      getState: () => 'progressing',
      cancel: vi.fn(() => done({}, 'cancelled')),
      once: (_event: string, listener: typeof done) => (done = listener)
    }
  }

  function setup(options: { titleOf?: (id: string) => string | undefined } = {}) {
    const waits: [string, boolean, string][] = []
    const manager = new BrowserManager({
      emitState: () => {},
      ...options,
      onWaiting: (id, _key, waiting, reason) => waits.push([id, waiting, reason])
    })
    const tab = { ...fakeTab('t1', 'https://exemple.com/rapport'), agentBusy: 0, agentUntil: 0 }
    const browsers = (manager as unknown as { browsers: Map<string, unknown> }).browsers
    browsers.set('c1', { tabs: [tab], active: 't1', bounds: undefined, area: undefined })
    // La session du panneau, et son `will-download`.
    ;(manager as unknown as { session: () => unknown }).session()
    const on = sessions
      .get('persist:bob-browser')
      ?.on.mock.calls.find(([event]) => event === 'will-download')?.[1] as (
      event: unknown,
      item: unknown,
      contents: unknown
    ) => void
    const download = async (name: string) => {
      on({}, fakeItem(name), tab.view.webContents)
      await vi.waitFor(() => expect(waits.some(([, waiting]) => !waiting)).toBe(true))
    }
    return { manager, tab, download, waits }
  }

  beforeEach(() => showSaveDialog.mockReset().mockResolvedValue({ canceled: true }))

  it('lancé par l’agent : dans Téléchargements, la fenêtre dit l’agent et sa conversation', async () => {
    const { manager, download, waits } = setup({ titleOf: () => 'Rapport mensuel' })
    const end = manager.beginAgentAction('c1')
    await download('export.csv')
    end()
    const options = showSaveDialog.mock.calls[0]?.at(-1) as Record<string, string>
    expect(options['title']).toBe(t('browser.download.title'))
    expect(options['defaultPath']).toBe(join(userData, 'export.csv'))
    expect(options['message']).toBe(
      t('browser.download.byAgentIn', { title: 'Rapport mensuel', site: 'exemple.com' })
    )
    // La conversation attend l'utilisateur le temps de la fenêtre.
    expect(waits).toEqual([
      ['c1', true, 'save'],
      ['c1', false, 'save']
    ])
  })

  it('lancé par l’agent sans titre connu : « lancé par l’agent » ; par la page : le site seul', async () => {
    const agent = setup()
    const end = agent.manager.beginAgentAction('c1')
    await agent.download('a.csv')
    end()
    expect((showSaveDialog.mock.calls[0]?.at(-1) as Record<string, string>)['message']).toBe(
      t('browser.download.byAgent', { site: 'exemple.com' })
    )
    sessions.clear()
    showSaveDialog.mockClear()
    const page = setup({ titleOf: () => 'Rapport mensuel' })
    await page.download('b.csv')
    expect((showSaveDialog.mock.calls[0]?.at(-1) as Record<string, string>)['message']).toBe(
      t('browser.download.byPage', { site: 'exemple.com' })
    )
  })
})
