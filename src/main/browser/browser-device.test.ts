/**
 * Taille d'écran et thème réglés par l'utilisateur, essai de l'agent (fiche 295, ADR-0078), côté
 * main, sans Chromium : le vrai `BrowserManager` et le vrai `CdpTab`, sur des vues et un débogueur
 * simulés. Le débogueur tient la « vérité de la page » (ce que Chromium aurait pris : taille,
 * tactile, thème), répond après un nombre tiré de tours de boucle, et peut refuser une commande.
 *
 * Invariant « aucun état caché », essayé sur des suites d'actions tirées au sort (graine fixe),
 * lancées parfois sans attendre la précédente (courses) :
 *  - à tout instant, ce que dit l'état (`emulation`, `colorScheme`) est ce que la page a pris ;
 *    `device`, `agent` et `control` sont ceux du modèle de référence écrit d'après la fiche ;
 *  - au repos (files vidées, sans refus en cours), la page a pris ce que la fiche dit
 *    (essai de l'agent, sinon réglage de l'utilisateur, sinon largeur du panneau), réduit pour
 *    tenir dans la zone, et la vue native est posée sur l'écran réduit.
 * Le vrai Chromium (sonde du lot 0, e2e `browser-device`) reste l'autorité sur ce que fait le CDP.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type {
  BrowserBounds,
  BrowserDeviceRequest,
  BrowserState,
  EmulatedScreen
} from '@shared/browser'
import { BROWSER_DEVICES, deviceScreen } from '@shared/browser-devices'
import { emulationFrame, windowBounds } from './page-view'

const userData = mkdtempSync(join(tmpdir(), 'bobine-browser-device-'))
afterAll(() => rmSync(userData, { recursive: true, force: true }))

/* ---------- Électron simulé ---------- */

interface Truth {
  metrics?: { width: number; height: number; mobile: boolean; scale: number }
  touch: boolean
  scheme: string
}

/** Tirage reproductible (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

/** Ce que chaque essai règle : aléa des délais et des refus du débogueur. */
const world = {
  random: rng(1),
  failRate: 0,
  maxDelay: 3,
  views: [] as FakeView[]
}

class FakeContents {
  destroyed = false
  readonly truth: Truth = { touch: false, scheme: '' }
  private readonly pending = new Set<(error: Error) => void>()
  private url = 'about:blank'
  readonly debugger = {
    isAttached: () => true,
    attach: () => {},
    on: () => {},
    sendCommand: (method: string, params: Record<string, unknown> = {}) =>
      this.command(method, params)
  }
  readonly navigationHistory = { canGoBack: () => false, canGoForward: () => false }
  on() {
    return this
  }
  once() {
    return this
  }
  setWindowOpenHandler() {}
  isDestroyed() {
    return this.destroyed
  }
  getURL() {
    return this.url
  }
  getTitle() {
    return 'page'
  }
  isLoading() {
    return false
  }
  getZoomFactor() {
    return 1
  }
  focus() {}
  async loadURL(url: string) {
    if (this.destroyed) throw new Error('Object has been destroyed')
    this.url = url
  }
  close() {
    this.destroyed = true
    // Sonde S13 : une commande en vol est rejetée à la fermeture.
    for (const reject of this.pending) reject(new Error('target closed while handling command'))
    this.pending.clear()
  }

  private async command(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.destroyed) throw new Error('Object has been destroyed')
    const fails = method.startsWith('Emulation.') && world.random() < world.failRate
    const delay = Math.floor(world.random() * (world.maxDelay + 1))
    await new Promise<void>((resolve, reject) => {
      this.pending.add(reject)
      const settle = async () => {
        for (let i = 0; i < delay; i++) await tick()
        if (!this.pending.delete(reject)) return
        resolve()
      }
      void settle()
    })
    if (fails) throw new Error(`refused: ${method}`)
    // La page prend la commande au moment où le débogueur répond (ordre d'envoi, sonde S9).
    if (method === 'Emulation.setDeviceMetricsOverride') {
      this.truth.metrics = {
        width: params['width'] as number,
        height: params['height'] as number,
        mobile: params['mobile'] as boolean,
        scale: params['scale'] as number
      }
    } else if (method === 'Emulation.clearDeviceMetricsOverride') {
      delete this.truth.metrics
    } else if (method === 'Emulation.setTouchEmulationEnabled') {
      this.truth.touch = params['enabled'] as boolean
    } else if (method === 'Emulation.setEmulatedMedia') {
      const features = params['features'] as { value: string }[]
      this.truth.scheme = features[0]?.value ?? ''
    }
    return {}
  }
}

class FakeView {
  contents: FakeContents | undefined = new FakeContents()
  bounds: BrowserBounds = { x: 0, y: 0, width: 0, height: 0 }
  visible = false
  constructor() {
    world.views.push(this)
  }
  get webContents() {
    // Sonde S13 : après `close()`, `view.webContents` vaut `undefined`.
    return this.contents && !this.contents.destroyed ? this.contents : (undefined as never)
  }
  setBounds(bounds: BrowserBounds) {
    this.bounds = { ...bounds }
  }
  getBounds() {
    return { ...this.bounds }
  }
  setVisible(visible: boolean) {
    this.visible = visible
  }
  getVisible() {
    return this.visible
  }
  setBackgroundColor() {}
}

function fakeSession() {
  return {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    on: vi.fn(),
    getUserAgent: () => 'Mozilla/5.0 Chrome/156 Electron/45.4.1',
    setUserAgent: vi.fn()
  }
}

vi.mock('electron', () => ({
  app: { getPath: () => userData, on: vi.fn() },
  dialog: {},
  shell: {},
  nativeImage: {},
  WebContentsView: vi.fn(function WebContentsView() {
    return new FakeView()
  }),
  webContents: { getFocusedWebContents: () => undefined },
  session: { fromPartition: () => fakeSession() }
}))

const { BrowserManager } = await import('./browser-manager')
type Manager = InstanceType<typeof BrowserManager>

function fakeWindow() {
  const window = {
    zoom: 1,
    on: vi.fn(),
    isDestroyed: () => false,
    getContentBounds: () => ({ x: 0, y: 0, width: 1400, height: 900 }),
    contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
    webContents: { getZoomFactor: () => window.zoom, focus: vi.fn() }
  }
  return window
}

function setup() {
  world.views = []
  const states: BrowserState[] = []
  const manager = new BrowserManager({ emitState: (state) => states.push(state) })
  const window = fakeWindow()
  manager.setWindow(window as never)
  return { manager, window, states }
}

/** Ce que le main garde, lu pour l'essai (onglets, zone). */
interface InnerTab {
  id: string
  view: FakeView
  cdp: { emulation?: Truth['metrics']; colorScheme?: string }
}
interface InnerBrowser {
  tabs: InnerTab[]
  active?: string
  bounds?: BrowserBounds
  area: BrowserBounds
}
const inner = (manager: Manager) =>
  (manager as unknown as { browsers: Map<string, InnerBrowser> }).browsers
const engine = (manager: Manager) =>
  (
    manager as unknown as {
      devices: {
        sync(id: string, tab: InnerTab): Promise<void>
        settled(tab: InnerTab): Promise<void>
      }
    }
  ).devices
/** Ce qui doit exister pour continuer l'essai. */
function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`${what} : absent`)
  return value
}
const truthOf = (tab: InnerTab) => must(tab.view.contents, 'page').truth

async function idle(manager: Manager) {
  for (let round = 0; round < 3; round++) {
    for (const browser of inner(manager).values()) {
      for (const tab of browser.tabs) await engine(manager).settled(tab)
    }
    for (let i = 0; i < 10; i++) await tick()
  }
}

/* ---------- Modèle de référence, écrit d'après la fiche ---------- */

type AgentTrial = { screen?: EmulatedScreen | 'panel'; colorScheme?: 'light' | 'dark' | 'auto' }

interface Model {
  devices: Map<string, BrowserDeviceRequest>
  trials: Map<string, AgentTrial>
}

function expected(model: Model, conversationId: string, tabId: string) {
  const device = model.devices.get(conversationId)
  const trial = model.trials.get(tabId) ?? {}
  const screen =
    trial.screen === undefined
      ? deviceScreen(device)
      : trial.screen === 'panel'
        ? undefined
        : trial.screen
  const scheme =
    trial.colorScheme === undefined
      ? (device?.colorScheme ?? undefined)
      : trial.colorScheme === 'auto'
        ? undefined
        : trial.colorScheme
  const agent = trial.screen !== undefined || trial.colorScheme !== undefined
  const control = agent ? 'agent' : device ? 'user' : undefined
  return { screen, scheme, control, device, trial: agent ? trial : undefined }
}

/* ---------- Tirages ---------- */

const CONVERSATIONS = ['c1', 'c2', 'c3']

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T
}

function randomScheme(random: () => number) {
  return pick(random, ['light', 'dark', null] as const)
}

function randomDevice(random: () => number): BrowserDeviceRequest | null {
  const roll = random()
  if (roll < 0.15) return null
  if (roll < 0.3) return { kind: 'responsive', colorScheme: randomScheme(random) }
  if (roll < 0.7) {
    return {
      kind: 'preset',
      id: pick(random, BROWSER_DEVICES).id,
      landscape: random() < 0.3,
      colorScheme: randomScheme(random)
    }
  }
  return {
    kind: 'custom',
    width: 200 + Math.floor(random() * 3801),
    height: 200 + Math.floor(random() * 3801),
    mobile: random() < 0.5,
    colorScheme: randomScheme(random)
  }
}

function randomArea(random: () => number) {
  return {
    x: Math.floor(random() * 600),
    y: Math.floor(random() * 120),
    width: 280 + Math.floor(random() * 1100),
    height: 200 + Math.floor(random() * 700)
  }
}

/* ---------- Vérifications ---------- */

function checkAlways(manager: Manager, model: Model, where: string) {
  for (const [conversationId, browser] of inner(manager)) {
    for (const tab of browser.tabs) {
      const truth = truthOf(tab)
      // Ce que l'état annoncerait pour l'onglet est ce que la page a pris.
      expect(tab.cdp.emulation, `${where} ${tab.id} taille`).toEqual(truth.metrics)
      expect(tab.cdp.colorScheme ?? '', `${where} ${tab.id} thème`).toBe(truth.scheme)
    }
    const state = manager.state(conversationId)
    const active = browser.tabs.find((tab) => tab.id === browser.active)
    if (!state || !active) continue
    const want = expected(model, conversationId, active.id)
    expect(state.emulation, `${where} état.taille`).toEqual(truthOf(active).metrics)
    expect(state.colorScheme ?? '', `${where} état.thème`).toBe(truthOf(active).scheme)
    expect(state.device, `${where} état.réglage`).toEqual(want.device)
    expect(state.agent, `${where} état.agent`).toEqual(want.trial)
    expect(state.control, `${where} état.main`).toBe(want.control)
  }
}

function checkAtRest(manager: Manager, model: Model, where: string) {
  for (const [conversationId, browser] of inner(manager)) {
    for (const tab of browser.tabs) {
      const want = expected(model, conversationId, tab.id)
      const truth = truthOf(tab)
      const frame = want.screen ? emulationFrame(browser.area, want.screen) : undefined
      if (frame) {
        expect(truth.metrics, `${where} ${tab.id} posé`).toBeDefined()
        const { scale, ...size } = must(truth.metrics, 'taille posée')
        expect(size, `${where} ${tab.id} taille posée`).toEqual(want.screen)
        // Même tolérance que le main (`sameEmulation`) : au millième près.
        expect(
          Math.abs(scale - frame.emulation.scale),
          `${where} ${tab.id} réduction`
        ).toBeLessThanOrEqual(0.001)
      } else {
        expect(truth.metrics, `${where} ${tab.id} largeur du panneau`).toBeUndefined()
      }
      expect(truth.touch, `${where} ${tab.id} tactile`).toBe(!!want.screen?.mobile)
      expect(truth.scheme, `${where} ${tab.id} thème posé`).toBe(want.scheme ?? '')
      const shown = !!browser.bounds && tab.id === browser.active
      expect(tab.view.visible, `${where} ${tab.id} visible`).toBe(shown)
      if (shown && browser.bounds) {
        expect(tab.view.bounds, `${where} ${tab.id} vue`).toEqual(
          frame ? frame.bounds : browser.bounds
        )
      }
    }
  }
}

/* ---------- Une suite d'actions ---------- */

async function runSequence(seed: number, steps: number, options: { user: boolean }) {
  world.random = rng(seed * 7919 + 13)
  world.failRate = 0
  const random = rng(seed)
  const { manager, window } = setup()
  const model: Model = { devices: new Map(), trials: new Map() }
  const pending: Promise<unknown>[] = []
  const log: string[] = []

  const activeOf = (conversationId: string) => inner(manager).get(conversationId)?.active

  for (let step = 0; step < steps; step++) {
    // Tirages ici ; le modèle et le main changent ensemble, quand l'action part (elle peut partir
    // après la suivante si on ne l'attend pas).
    const conversationId = pick(random, CONVERSATIONS)
    const roll = random()
    const pickTab = random()
    const browserNow = () => inner(manager).get(conversationId)
    let action: () => Promise<unknown> | unknown
    let label: string
    if (roll < 0.14 && options.user) {
      // Réglage de l'utilisateur, sur l'onglet regardé, ou sur un onglet qui n'est pas à lui.
      const device = randomDevice(random)
      const foreign = random() < 0.1
      label = `setDevice ${conversationId} ${foreign ? 'étranger' : 'actif'} ${JSON.stringify(device)}`
      action = async () => {
        const tabId = foreign ? 'onglet-999' : activeOf(conversationId)
        if (!tabId || foreign) {
          await expect(
            manager.setDevice(conversationId, tabId ?? 'onglet-0', device)
          ).rejects.toThrow('Onglet inconnu')
          return
        }
        if (device) model.devices.set(conversationId, device)
        else model.devices.delete(conversationId)
        model.trials.delete(tabId)
        await manager.setDevice(conversationId, tabId, device)
      }
    } else if (roll < 0.3) {
      const size =
        random() < 0.25
          ? undefined
          : {
              width: 200 + Math.floor(random() * 2000),
              height: 200 + Math.floor(random() * 2000),
              mobile: random() < 0.5
            }
      label = `agent.resize ${conversationId} ${JSON.stringify(size)}`
      action = () => {
        const promise = manager.emulate(conversationId, size)
        const tab = must(activeOf(conversationId), 'onglet actif')
        model.trials.set(tab, { ...model.trials.get(tab), screen: size ?? 'panel' })
        return promise
      }
    } else if (roll < 0.4) {
      const scheme = pick(random, ['light', 'dark', undefined] as const)
      label = `agent.scheme ${conversationId} ${scheme}`
      action = () => {
        const promise = manager.agentColorScheme(conversationId, scheme)
        const tab = must(activeOf(conversationId), 'onglet actif')
        model.trials.set(tab, { ...model.trials.get(tab), colorScheme: scheme ?? 'auto' })
        return promise
      }
    } else if (roll < 0.5) {
      label = `endAgentTurn ${conversationId}`
      action = () => {
        for (const tab of browserNow()?.tabs ?? []) model.trials.delete(tab.id)
        return manager.endAgentTurn(conversationId)
      }
    } else if (roll < 0.56) {
      label = `chip ${conversationId}`
      action = () => {
        const tab = activeOf(conversationId)
        const trial = tab ? model.trials.get(tab) : undefined
        if (tab && trial) {
          const { screen: _screen, ...rest } = trial
          model.trials.set(tab, rest)
        }
        return manager.clearEmulation(conversationId)
      }
    } else if (roll < 0.66) {
      label = `newTab ${conversationId}`
      action = () => {
        try {
          manager.newTab(conversationId)
        } catch {
          // Dix onglets au plus.
        }
      }
    } else if (roll < 0.78) {
      const close = roll >= 0.72
      label = `${close ? 'closeTab' : 'selectTab'} ${conversationId}`
      action = () => {
        const tabs = browserNow()?.tabs ?? []
        if (tabs.length === 0) return
        const tab = must(tabs[Math.floor(pickTab * tabs.length)], 'onglet').id
        if (close) {
          model.trials.delete(tab)
          manager.closeTab(conversationId, tab)
        } else manager.selectTab(conversationId, tab)
      }
    } else if (roll < 0.88) {
      const area = randomArea(random)
      const zoom = random() < 0.3 ? pick(random, [0.8, 1, 1.5]) : undefined
      label = `show ${conversationId} ${JSON.stringify(area)} ×${zoom ?? '='}`
      action = () => {
        if (zoom) window.zoom = zoom
        manager.show(conversationId, area)
      }
    } else if (roll < 0.91) {
      label = 'hide'
      action = () => manager.hide()
    } else if (roll < 0.94) {
      label = `close ${conversationId}`
      action = () => {
        model.devices.delete(conversationId)
        for (const tab of browserNow()?.tabs ?? []) model.trials.delete(tab.id)
        manager.close(conversationId)
      }
    } else {
      label = 'flaky'
      action = () => {
        world.failRate = world.failRate > 0 ? 0 : 0.3
      }
    }
    log.push(label)
    const where = `graine ${seed}, pas ${step} (${label})\n  ${log.slice(process.env.FULL_LOG ? 0 : -6).join('\n  ')}\n`
    const promise = Promise.resolve()
      .then(action)
      .catch((error: unknown) => {
        // Refus du débogueur (simulé), onglet fermé pendant l'essai de l'agent : son outil le dirait.
        if (!/refused|target closed|has been destroyed/.test(String(error))) throw error
      })
    if (random() < 0.5) await promise
    else pending.push(promise)
    // Relevé entre deux tours de boucle (jamais au milieu d'une suite de micro-tâches) : chaque
    // réponse du débogueur simulé et ses suites ont alors fini de tourner.
    for (let i = 1 + Math.floor(random() * 3); i > 0; i--) await tick()
    checkAlways(manager, model, where)
  }
  await Promise.all(pending)
  // Au repos, sans refus : un passage de plus sur chaque onglet (ceux qu'un refus a laissés à reposer).
  world.failRate = 0
  for (const [conversationId, browser] of inner(manager)) {
    for (const tab of browser.tabs) await engine(manager).sync(conversationId, tab)
  }
  await idle(manager)
  const where = `graine ${seed}, au repos\n  ${log.slice(-8).join('\n  ')}\n`
  checkAlways(manager, model, where)
  checkAtRest(manager, model, where)
  return manager
}

describe('aucun état caché : suites d’actions tirées au sort (fiche 295)', () => {
  it('utilisateur, agent, fin de tour, onglets, conversations, panneau, refus du CDP : 250 graines', async () => {
    for (let seed = 1; seed <= 250; seed++) await runSequence(seed, 45, { user: true })
  }, 60_000)

  it('sans réglage de l’utilisateur : le comportement d’avant (essai de l’agent, puis rien)', async () => {
    for (let seed = 1001; seed <= 1100; seed++) {
      const manager = await runSequence(seed, 30, { user: false })
      for (const browser of inner(manager).values()) {
        for (const tab of browser.tabs) {
          const id = must(
            [...inner(manager)].find(([, b]) => b === browser),
            'conversation'
          )[0]
          await manager.endAgentTurn(id)
          await idle(manager)
          expect(truthOf(tab)).toEqual({ touch: false, scheme: '' })
          expect(manager.state(id)?.device).toBeUndefined()
          expect(manager.state(id)?.control).toBeUndefined()
        }
      }
    }
  }, 60_000)
})

/* ---------- Cas nommés ---------- */

async function withTabs(count: number, conversationId = 'c1') {
  const env = setup()
  env.manager.show(conversationId, { x: 0, y: 0, width: 600, height: 700 })
  const tabs = Array.from({ length: count }, () => env.manager.newTab(conversationId))
  await idle(env.manager)
  return { ...env, tabs: tabs as unknown as [InnerTab, InnerTab] }
}

const IPHONE_14: BrowserDeviceRequest = {
  kind: 'preset',
  id: 'iphone-14',
  landscape: false,
  colorScheme: 'dark'
}

describe('deux couches (fiche 295)', () => {
  it('le réglage vaut pour tous les onglets, et pour un onglet ouvert ensuite', async () => {
    const { manager, tabs } = await withTabs(2)
    await manager.setDevice('c1', tabs[1].id, IPHONE_14)
    for (const tab of tabs) {
      expect(truthOf(tab)).toEqual({
        metrics: { width: 390, height: 844, mobile: true, scale: 700 / 844 },
        touch: true,
        scheme: 'dark'
      })
    }
    const later = manager.newTab('c1') as unknown as InnerTab
    await idle(manager)
    expect(truthOf(later).metrics?.width).toBe(390)
    expect(manager.state('c1')).toMatchObject({
      device: IPHONE_14,
      control: 'user',
      colorScheme: 'dark'
    })
  })

  it('l’agent essaie pendant son tour, sur plusieurs onglets ; la fin du tour rend le réglage exact', async () => {
    const { manager, tabs } = await withTabs(2)
    await manager.setDevice('c1', tabs[1].id, IPHONE_14)
    manager.selectTab('c1', tabs[0].id)
    await manager.emulate('c1', { width: 768, height: 1024, mobile: true })
    manager.selectTab('c1', tabs[1].id)
    await manager.emulate('c1', undefined)
    await manager.agentColorScheme('c1', undefined)
    expect(truthOf(tabs[0]).metrics).toMatchObject({ width: 768, height: 1024 })
    // `desktop` et `auto` de l'agent passent devant le réglage : largeur du panneau, thème du système.
    expect(truthOf(tabs[1])).toEqual({ touch: false, scheme: '' })
    expect(manager.state('c1')).toMatchObject({
      control: 'agent',
      agent: { screen: 'panel', colorScheme: 'auto' },
      device: IPHONE_14
    })
    await manager.endAgentTurn('c1')
    for (const tab of tabs) {
      expect(truthOf(tab)).toEqual({
        metrics: { width: 390, height: 844, mobile: true, scale: 700 / 844 },
        touch: true,
        scheme: 'dark'
      })
    }
    expect(manager.state('c1')?.agent).toBeUndefined()
    expect(manager.state('c1')?.control).toBe('user')
  })

  it('le thème seul de l’agent laisse la taille de l’utilisateur', async () => {
    const { manager, tabs } = await withTabs(1)
    await manager.setDevice('c1', tabs[0].id, IPHONE_14)
    await manager.agentColorScheme('c1', 'light')
    expect(truthOf(tabs[0])).toMatchObject({ metrics: { width: 390 }, scheme: 'light' })
    expect(manager.state('c1')?.control).toBe('agent')
  })

  it('« Reprendre la main » : le réglage de l’utilisateur efface l’essai de l’onglet regardé, tout de suite', async () => {
    const { manager, tabs } = await withTabs(2)
    await manager.setDevice('c1', tabs[1].id, IPHONE_14)
    manager.selectTab('c1', tabs[0].id)
    await manager.emulate('c1', { width: 1024, height: 768, mobile: false })
    manager.selectTab('c1', tabs[1].id)
    await manager.emulate('c1', { width: 1024, height: 768, mobile: false })
    await manager.setDevice('c1', tabs[1].id, IPHONE_14)
    expect(truthOf(tabs[1]).metrics?.width).toBe(390)
    expect(manager.state('c1')?.control).toBe('user')
    // L'autre onglet garde l'essai de l'agent jusqu'à la fin de son tour.
    expect(truthOf(tabs[0]).metrics?.width).toBe(1024)
  })

  it('la puce efface la taille de l’agent : le réglage revient, le thème de l’agent reste', async () => {
    const { manager, tabs } = await withTabs(1)
    await manager.setDevice('c1', tabs[0].id, IPHONE_14)
    await manager.emulate('c1', { width: 1024, height: 768, mobile: false })
    await manager.agentColorScheme('c1', 'light')
    await manager.clearEmulation('c1')
    expect(truthOf(tabs[0])).toMatchObject({ metrics: { width: 390 }, scheme: 'light' })
  })

  it('barre fermée : largeur du panneau et thème Auto ; refermée pendant le tour, l’essai s’efface', async () => {
    const { manager, tabs } = await withTabs(1)
    await manager.setDevice('c1', tabs[0].id, IPHONE_14)
    await manager.emulate('c1', { width: 1024, height: 768, mobile: false })
    await manager.setDevice('c1', tabs[0].id, null)
    expect(truthOf(tabs[0])).toEqual({ touch: false, scheme: '' })
    expect(manager.state('c1')?.device).toBeUndefined()
    expect(manager.state('c1')?.control).toBeUndefined()
  })

  it('par conversation : l’autre conversation, une branche, une conversation fermée n’ont rien', async () => {
    const { manager, tabs } = await withTabs(1)
    await manager.setDevice('c1', tabs[0].id, IPHONE_14)
    const other = manager.newTab('c2') as unknown as InnerTab
    await idle(manager)
    expect(truthOf(other)).toEqual({ touch: false, scheme: '' })
    // Branche (fiche 094) : elle reprend la page, pas le réglage.
    await must(tabs[0].view.contents, 'page').loadURL('http://localhost:5173/')
    manager.inherit('c3', 'c1')
    await vi.waitFor(() => expect(inner(manager).get('c3')?.tabs.length).toBe(1))
    await idle(manager)
    expect(truthOf(must(inner(manager).get('c3')?.tabs[0], 'onglet de la branche'))).toEqual({
      touch: false,
      scheme: ''
    })
    expect(manager.state('c3')?.device).toBeUndefined()
    // Conversation fermée puis rouverte : rien n'en reste.
    manager.close('c1')
    const again = manager.newTab('c1') as unknown as InnerTab
    await idle(manager)
    expect(truthOf(again)).toEqual({ touch: false, scheme: '' })
    expect(manager.state('c1')?.device).toBeUndefined()
  })

  it('refus : onglet d’une autre conversation, onglet fermé, conversation sans onglet', async () => {
    const { manager, tabs } = await withTabs(1)
    const foreign = manager.newTab('c2') as unknown as InnerTab
    await expect(manager.setDevice('c1', foreign.id, IPHONE_14)).rejects.toThrow('Onglet inconnu')
    manager.closeTab('c1', tabs[0].id)
    await expect(manager.setDevice('c1', tabs[0].id, IPHONE_14)).rejects.toThrow('Onglet inconnu')
    manager.show('c9', { x: 0, y: 0, width: 600, height: 700 })
    await expect(manager.setDevice('c9', 'onglet-1', IPHONE_14)).rejects.toThrow('Onglet inconnu')
    expect(manager.state('c2')?.device).toBeUndefined()
  })

  it('panneau redimensionné, interface zoomée : la réduction suit, jamais au-delà de 100 %', async () => {
    const { manager, window, tabs } = await withTabs(1)
    await manager.setDevice('c1', tabs[0].id, {
      kind: 'preset',
      id: 'ipad-pro',
      landscape: false,
      colorScheme: null
    })
    expect(truthOf(tabs[0]).metrics?.scale).toBeCloseTo(Math.min(600 / 1032, 700 / 1376), 5)
    window.zoom = 1.5
    manager.show('c1', { x: 10, y: 20, width: 1200, height: 1000 })
    await idle(manager)
    const area = windowBounds({ x: 10, y: 20, width: 1200, height: 1000 }, 1.5)
    const frame = emulationFrame(area, { width: 1032, height: 1376, mobile: true })
    expect(truthOf(tabs[0]).metrics?.scale).toBeCloseTo(frame.emulation.scale, 5)
    expect(tabs[0].view.bounds).toEqual(frame.bounds)
    manager.show('c1', { x: 0, y: 0, width: 3000, height: 3000 })
    await idle(manager)
    expect(truthOf(tabs[0]).metrics?.scale).toBe(1)
  })

  it('onglet fermé pendant une pose : aucune promesse pendante, l’état ne ment pas', async () => {
    const { manager, tabs } = await withTabs(2)
    world.maxDelay = 6
    try {
      const setting = manager.setDevice('c1', tabs[1].id, IPHONE_14)
      manager.closeTab('c1', tabs[0].id)
      await setting
      await idle(manager)
      expect(truthOf(tabs[1]).metrics?.width).toBe(390)
      expect(manager.state('c1')?.emulation?.width).toBe(390)
    } finally {
      world.maxDelay = 3
    }
  })

  it('refus du CDP : l’état dit ce qui a été pris ; le passage suivant repose tout', async () => {
    const { manager, tabs } = await withTabs(1)
    world.failRate = 1
    await manager.setDevice('c1', tabs[0].id, IPHONE_14)
    expect(truthOf(tabs[0]).metrics).toBeUndefined()
    expect(manager.state('c1')?.emulation).toBeUndefined()
    expect(manager.state('c1')?.device).toEqual(IPHONE_14)
    await expect(manager.emulate('c1', { width: 500, height: 500, mobile: false })).rejects.toThrow(
      'refused'
    )
    expect(manager.state('c1')?.emulation).toBeUndefined()
    world.failRate = 0
    await manager.endAgentTurn('c1')
    expect(truthOf(tabs[0])).toMatchObject({
      metrics: { width: 390 },
      touch: true,
      scheme: 'dark'
    })
  })

  it('boîte de la page ouverte : la pose est refusée, l’état ne ment pas, reprise à la fermeture', async () => {
    const { manager, tabs } = await withTabs(1)
    const dialogs = (
      tabs[0] as unknown as {
        cdp: { dialogs: { opened(p: object): void; closed(p: object): void } }
      }
    ).cdp.dialogs
    dialogs.opened({ type: 'alert', message: 'Bonjour' })
    await manager.setDevice('c1', tabs[0].id, IPHONE_14)
    expect(truthOf(tabs[0]).metrics).toBeUndefined()
    expect(manager.state('c1')).toMatchObject({ device: IPHONE_14, control: 'user' })
    expect(manager.state('c1')?.emulation).toBeUndefined()
    dialogs.closed({ result: true })
    await idle(manager)
    expect(truthOf(tabs[0])).toMatchObject({ metrics: { width: 390 }, touch: true, scheme: 'dark' })
    expect(manager.state('c1')?.emulation?.width).toBe(390)
  })

  it('l’agent apprend que le réglage de l’utilisateur reviendra, rien d’autre', async () => {
    const { manager, tabs } = await withTabs(1)
    const driver = manager.driverFor('c1')
    expect(driver.userDevice?.()).toBe(false)
    await manager.setDevice('c1', tabs[0].id, IPHONE_14)
    expect(driver.userDevice?.()).toBe(true)
  })
})
