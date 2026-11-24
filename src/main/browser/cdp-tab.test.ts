/**
 * Mise en route d'un onglet (`CdpTab.whenReady`, fiche 250) : bornée. Sur le runner macOS de
 * GitHub, le premier chargement d'un onglet neuf restait en plan et figeait sans fin le
 * tour de l'agent qui l'avait ouvert. Le vrai Chromium reste dans l'e2e `browser`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebContents, WebContentsView } from 'electron'

vi.mock('electron', () => ({ nativeImage: {} }))

const { CdpTab, READY_TIMEOUT_MS, notReadyMessage } = await import('./cdp-tab')
const { loadWithin } = await import('./browser-driver')

/** Page dont le premier chargement (`about:blank`) ne finit jamais, les suivants si. */
function contentsStuckOnce() {
  let attached = false
  const loads: string[] = []
  const commands: string[] = []
  const contents = {
    on: vi.fn(),
    loadURL: vi.fn((url: string) => {
      loads.push(url)
      return loads.length === 1 ? new Promise<void>(() => {}) : Promise.resolve()
    }),
    debugger: {
      isAttached: () => attached,
      attach: () => {
        attached = true
      },
      on: vi.fn(),
      sendCommand: vi.fn(async (method: string) => {
        commands.push(method)
        return {}
      })
    }
  }
  return { contents: contents as unknown as WebContents, loads, commands }
}

describe('mise en route d’un onglet (fiche 250)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('premier chargement resté en plan : erreur claire après la borne, pas d’attente sans fin', async () => {
    const { contents } = contentsStuckOnce()
    const tab = new CdpTab(contents)
    const ready = expect(tab.whenReady()).rejects.toThrow(notReadyMessage(READY_TIMEOUT_MS))
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS)
    await ready
  })

  it('une commande de l’agent échoue aussi au lieu de figer son tour', async () => {
    const { contents, commands } = contentsStuckOnce()
    const tab = new CdpTab(contents)
    const sent = expect(tab.send('Accessibility.getFullAXTree')).rejects.toThrow(
      'did not finish loading'
    )
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS)
    await sent
    expect(commands).not.toContain('Accessibility.getFullAXTree')
  })

  it('l’onglet reste utilisable : l’appel suivant relance la mise en route, puis la commande passe', async () => {
    const { contents, loads, commands } = contentsStuckOnce()
    const tab = new CdpTab(contents)
    const first = expect(tab.whenReady()).rejects.toThrow('did not finish loading')
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS)
    await first
    await expect(tab.send('Page.reload')).resolves.toEqual({})
    expect(loads).toEqual(['about:blank', 'about:blank'])
    expect(commands).toContain('Runtime.enable')
    expect(commands.at(-1)).toBe('Page.reload')
  })

  it('mise en route réussie : gardée, jamais relancée', async () => {
    const { contents, loads } = contentsStuckOnce()
    loads.push('déjà chargé') // le premier `about:blank` aboutit
    const tab = new CdpTab(contents)
    await tab.whenReady()
    await tab.whenReady()
    expect(loads).toEqual(['déjà chargé', 'about:blank'])
  })

  it('adresse demandée par l’agent sur un onglet en plan : erreur rendue, adresse non chargée', async () => {
    const { contents, loads } = contentsStuckOnce()
    const tab = { view: { webContents: contents } as WebContentsView, cdp: new CdpTab(contents) }
    const load = expect(loadWithin(tab, 'http://localhost:3000/')).rejects.toThrow(
      'did not finish loading'
    )
    await vi.advanceTimersByTimeAsync(READY_TIMEOUT_MS)
    await load
    expect(loads).toEqual(['about:blank'])
  })
})

describe('entrées de l’agent retenues jusqu’à la première peinture (fiche 250)', () => {
  function paintedContents(painted: boolean[]) {
    const handlers = new Map<string, (...args: unknown[]) => void>()
    const sent: string[] = []
    const contents = {
      on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
      loadURL: async () => {},
      executeJavaScriptInIsolatedWorld: vi.fn(async () => painted.shift() ?? true),
      debugger: {
        isAttached: () => true,
        attach: () => {},
        on: () => {},
        sendCommand: async (method: string, params: { type?: string } = {}) => {
          if (method.startsWith('Input.')) sent.push(params.type ?? method)
          return {}
        }
      }
    }
    return { contents: contents as unknown as WebContents, sent, handlers }
  }

  it('clic aussitôt la page chargée : envoyé après sa peinture, une fois par document', async () => {
    const { contents, sent, handlers } = paintedContents([true, true])
    const tab = new CdpTab(contents)
    await tab.mouse('mousePressed', { x: 1, y: 1 }, 'left', 1)
    await tab.mouse('mouseReleased', { x: 1, y: 1 }, 'left', 1)
    expect(sent).toEqual(['mousePressed', 'mouseReleased'])
    expect(contents.executeJavaScriptInIsolatedWorld).toHaveBeenCalledTimes(1)
    handlers.get('did-navigate')?.({}, 'http://localhost/deux')
    await tab.key('enter', [])
    expect(contents.executeJavaScriptInIsolatedWorld).toHaveBeenCalledTimes(2)
  })

  it('page jamais peinte : erreur claire, aucun appui envoyé (au lieu d’un clic perdu)', async () => {
    const { contents, sent } = paintedContents([false])
    const tab = new CdpTab(contents)
    await expect(tab.mouse('mousePressed', { x: 1, y: 1 }, 'left', 1)).rejects.toThrow(
      'has not been rendered'
    )
    expect(sent).toEqual([])
  })

  it('déplacement du pointeur : jamais retenu (Chromium le laisse passer)', async () => {
    const { contents, sent } = paintedContents([false])
    const tab = new CdpTab(contents)
    await tab.mouse('mouseMoved', { x: 1, y: 1 })
    expect(sent).toEqual(['mouseMoved'])
    expect(contents.executeJavaScriptInIsolatedWorld).not.toHaveBeenCalled()
  })

  it('onglet caché : peint le temps de l’attente, puis remis', async () => {
    const { contents } = paintedContents([true])
    const restore = vi.fn()
    const reveal = vi.fn(() => restore)
    const tab = new CdpTab(contents, { reveal })
    await tab.wheel({ x: 1, y: 1 }, 0, 100)
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
  })
})
