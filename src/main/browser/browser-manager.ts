/**
 * Navigateur intégré (fiches 007, 031) : des onglets (`WebContentsView`) par conversation, l'actif
 * affiché par-dessus l'onglet « Navigateur » du panneau. L'agent les pilote par les outils de
 * `browser-tools.ts`, via le protocole DevTools (`cdp-tab.ts`) ; l'utilisateur peut cliquer et taper
 * dans la même page.
 *
 * Isolement : session `persist:bob-browser` séparée de l'UI (cookies propres au navigateur),
 * permissions (caméra, notifications…) refusées, pas de preload, bac à sable. Téléchargements :
 * « Enregistrer sous » à chaque fois (fiche 094, ADR-0018, `downloads.ts`).
 *
 * Popups (fiche 072), comme Claude Code : une fenêtre ouverte par un clic de l'utilisateur
 * (connexion Google…) s'ouvre vraiment, liée à sa page ; ouverte par une action de l'agent, elle est
 * bloquée et l'agent est prié de demander à l'utilisateur ; sans geste, bloquée comme dans Chrome.
 */
import { rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  app,
  dialog,
  session as electronSession,
  shell,
  WebContentsView,
  type BrowserWindow,
  type DownloadItem,
  type Session,
  webContents as allWebContents,
  type WebContents,
  type NativeImage
} from 'electron'
import { t } from 'i18next'
import type {
  BrowserBounds,
  BrowserCommand,
  BrowserDownload,
  BrowserGo,
  BrowserState,
  BrowserZoom
} from '@shared/browser'
import { normalizeUrl } from '@shared/browser'
import type { PageFreeze, PageLayerEvent, PageLayerTheme, PagePin } from '@shared/page-notes'
import type { BrowserDriver, DownloadNote } from './browser-tools'
import { createDriver, historyStep, loadWithin } from './browser-driver'
import { CdpTab } from './cdp-tab'
import { saveDownload } from './downloads'
import { PageLayer, pageSnapshot } from './page-layer'
import {
  emulationFrame,
  nextZoom,
  pageShortcut,
  windowBounds,
  type EmulatedSize,
  type PageShortcut
} from './page-view'

const PARTITION = 'persist:bob-browser'
/** Cookies non gardés (fiche 072) : session en mémoire, rien sur le disque. */
const MEMORY_PARTITION = 'bob-browser-memoire'
/** Taille d'une page jamais affichée (l'agent peut s'en servir panneau fermé). */
const DEFAULT_SIZE = { width: 1024, height: 768 }
const MAX_TABS = 10
/** Après une action de l'agent, ce qui s'ouvre encore vient de lui (gestionnaires asynchrones). */
const AGENT_INPUT_GRACE_MS = 1500
/** Une popup suit un geste de l'utilisateur de près, comme le veut Chrome. */
const USER_GESTURE_MS = 1000
const USER_GESTURES = new Set(['mouseDown', 'mouseUp', 'rawKeyDown', 'keyDown', 'gestureTap'])
const POPUP_SIZE = { width: 520, height: 700 }

interface Tab {
  id: string
  view: WebContentsView
  cdp: CdpTab
  /** Jusqu'à quand ce qui arrive dans la page vient de l'agent. */
  agentUntil: number
  /** Dernier geste de l'utilisateur dans la page. */
  userInputAt: number
  /** Popups demandées par une action de l'agent et bloquées, à lui dire. */
  blockedPopups: string[]
  /** Script du mode Annoter dans la page (fiche 146). */
  layer: PageLayer
}

/** Navigateur d'une conversation : ses onglets, l'actif, et où l'afficher. */
interface Browser {
  tabs: Tab[]
  active: string | undefined
  /** Emplacement de l'onglet du panneau quand il est visible (pixels de la fenêtre). */
  bounds: BrowserBounds | undefined
  /** Dernier emplacement connu : la taille imposée par l'agent s'y ajuste, panneau fermé. */
  area: BrowserBounds
}

export interface BrowserManagerOptions {
  /** État du navigateur d'une conversation (onglets, adresse, titre…) pour le panneau. */
  emitState: (state: BrowserState) => void
  /** Cookies gardés d'un lancement à l'autre (fiche 072) ; lu à la création de la session. */
  keepCookies?: () => boolean
  /** Téléchargement enregistré ou en échec (fiche 094), pour le bandeau de l'onglet. */
  emitDownload?: (download: BrowserDownload) => void
  /**
   * L'app attend l'utilisateur pour une conversation (fiche 097) : « Enregistrer sous », boîte d'une
   * page. `key` distingue les attentes ; `waiting` faux : c'est fini.
   */
  onWaiting?: (
    conversationId: string,
    key: string,
    waiting: boolean,
    reason: 'save' | 'page-dialog'
  ) => void
  /** Titre d'une conversation, cité dans « Enregistrer sous » (quelle conversation demande). */
  titleOf?: (conversationId: string) => string | undefined
  /** Raccourci de la page pour l'onglet du panneau (fiche 129 : ⌘L va au champ d'adresse). */
  emitCommand?: (command: BrowserCommand) => void
  /** Clic ou épingle dans la page en mode Annoter (fiche 146). */
  emitAnnotate?: (event: PageLayerEvent) => void
}

export class BrowserManager {
  private window: BrowserWindow | undefined
  private readonly browsers = new Map<string, Browser>()
  /** Popups ouvertes par l'utilisateur, par conversation (fermées avec elle). */
  private readonly popups = new Map<string, Set<BrowserWindow>>()
  private browserSession: Session | undefined
  /** Téléchargements lancés par l'agent, par conversation : à lui dire (fiche 094). */
  private readonly agentDownloads = new Map<string, DownloadNote[]>()
  /** Fichiers enregistrés, par conversation : « Afficher dans le Finder » n'ouvre qu'eux. */
  private readonly savedDownloads = new Map<string, Set<string>>()
  private nextTab = 1
  /** Attentes de l'utilisateur (« Enregistrer sous ») : chacune a sa clé. */
  private nextWait = 1
  private readonly options: BrowserManagerOptions

  constructor(options: BrowserManagerOptions) {
    this.options = options
  }

  /** Fenêtre qui accueille les pages (recréée sur macOS après fermeture). */
  setWindow(window: BrowserWindow): void {
    this.window = window
    window.on('closed', () => {
      if (this.window === window) this.window = undefined
      this.closeAll()
    })
  }

  /** Pilote de l'onglet actif d'une conversation (créé à la première utilisation). */
  driverFor(conversationId: string): BrowserDriver {
    return createDriver(this, conversationId)
  }

  /**
   * Affiche le navigateur de la conversation sur la zone de l'onglet (pixels CSS de l'interface,
   * convertis selon son zoom, fiche 129) ; masque les autres.
   */
  show(conversationId: string, bounds: BrowserBounds): void {
    for (const [id, browser] of this.browsers) {
      if (id !== conversationId && browser.bounds) {
        browser.bounds = undefined
        for (const tab of browser.tabs) tab.view.setVisible(false)
      }
    }
    const browser = this.browser(conversationId)
    browser.bounds = windowBounds(bounds, this.uiZoom())
    browser.area = browser.bounds
    this.layout(browser)
  }

  /** Onglet masqué ou panneau fermé : plus aucune page visible (elles continuent de tourner). */
  hide(): void {
    for (const browser of this.browsers.values()) {
      browser.bounds = undefined
      for (const tab of browser.tabs) tab.view.setVisible(false)
    }
  }

  /**
   * Page ouverte par l'app (aperçu HTML, fiche 064) : nouvel onglet, sans écraser la page de
   * l'agent ; l'onglet actif s'il y en a déjà trop.
   */
  async openTab(conversationId: string, input: string): Promise<string> {
    const url = normalizeUrl(input)
    let tab: Tab
    try {
      tab = this.newTab(conversationId)
    } catch {
      tab = this.activeTab(conversationId)
    }
    await loadWithin(tab, url)
    return url
  }

  /** Image de la page affichée (fiche 066), avec son titre ; `null` sans page. */
  async capture(conversationId: string): Promise<{ image: NativeImage; title: string } | null> {
    const tab = this.currentTab(conversationId)
    const contents = tab?.view.webContents
    if (!contents || !contents.getURL() || contents.getURL() === 'about:blank') return null
    return { image: await contents.capturePage(), title: contents.getTitle() }
  }

  /**
   * Page figée le temps d'écrire une remarque (fiches 132 et 146) : sa capture telle qu'affichée
   * (épingles comprises), sa fenêtre en pixels CSS, son défilement, son zoom ; `null` sans page.
   * L'onglet la masque ensuite, et le clavier revient à l'interface pour la bulle.
   */
  async freeze(
    conversationId: string
  ): Promise<(Omit<PageFreeze, 'data' | 'mimeType'> & { image: NativeImage }) | null> {
    const tab = this.currentTab(conversationId)
    if (!tab) return null
    const page = await pageSnapshot(tab.view.webContents, tab.cdp, tab.view.getBounds(), false)
    if (page && tab.layer.annotating) this.window?.webContents.focus()
    return page
  }

  /**
   * Capture propre d'une remarque (fiche 146) : la page masquée, sans rien de ce que l'app y
   * dessine, redessinée pour l'occasion.
   */
  async noteShot(
    conversationId: string
  ): Promise<(Omit<PageFreeze, 'data' | 'mimeType'> & { image: NativeImage }) | null> {
    const tab = this.currentTab(conversationId)
    if (!tab) return null
    const contents = tab.view.webContents
    return tab.layer.hidden(() => pageSnapshot(contents, tab.cdp, tab.view.getBounds(), true))
  }

  /** Mode Annoter (fiche 146) : sur l'onglet actif seulement ; arrêté partout sinon. */
  async annotate(conversationId: string, on: boolean, theme?: PageLayerTheme): Promise<void> {
    const browser = this.browsers.get(conversationId)
    for (const tab of browser?.tabs ?? []) {
      const active = on && tab.id === browser?.active
      if (active || tab.layer.annotating) await tab.layer.set(active, theme)
    }
  }

  /** Épingles des remarques posées sur la page affichée (fiche 146). */
  async pagePins(conversationId: string, pins: PagePin[]): Promise<void> {
    await this.currentTab(conversationId)?.layer.pins(pins)
  }

  /** Adresse saisie par l'utilisateur dans la barre de l'onglet. */
  async navigate(conversationId: string, input: string): Promise<string> {
    const url = normalizeUrl(input)
    await loadWithin(this.activeTab(conversationId), url)
    return url
  }

  async go(conversationId: string, action: BrowserGo): Promise<void> {
    const tab = this.currentTab(conversationId)
    if (!tab) return
    if (action === 'stop') tab.view.webContents.stop()
    else await historyStep(tab.view.webContents, action)
  }

  state(conversationId: string): BrowserState | null {
    const browser = this.browsers.get(conversationId)
    const tab = this.currentTab(conversationId)
    if (!browser || !tab) return null
    const contents = tab.view.webContents
    return {
      conversationId,
      tabs: browser.tabs.map((t) => ({
        id: t.id,
        title: t.view.webContents.getTitle(),
        url: t.view.webContents.getURL()
      })),
      activeTab: tab.id,
      url: contents.getURL(),
      title: contents.getTitle(),
      loading: contents.isLoading(),
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
      zoom: contents.getZoomFactor(),
      ...(tab.cdp.emulation ? { emulation: tab.cdp.emulation } : {})
    }
  }

  /* ---------- Zoom et taille de la page (fiche 129) ---------- */

  /** Zoom de la page de l'onglet actif : puce du champ d'adresse. */
  zoom(conversationId: string, action: BrowserZoom): void {
    const tab = this.currentTab(conversationId)
    if (tab) this.zoomTab(conversationId, tab, action)
  }

  /** Zoom du menu Présentation : la page qui a le focus, s'il y en a une (sinon `false`). */
  zoomFocused(action: BrowserZoom): boolean {
    const focused = allWebContents.getFocusedWebContents()
    for (const [conversationId, browser] of this.browsers) {
      const tab = browser.tabs.find((t) => t.view.webContents === focused)
      if (tab) {
        this.zoomTab(conversationId, tab, action)
        return true
      }
    }
    return false
  }

  /**
   * Taille d'écran imposée par l'agent (`browser_resize`), réduite pour tenir dans la zone ;
   * `undefined` : la page reprend la taille du panneau.
   */
  async emulate(conversationId: string, size: EmulatedSize | undefined): Promise<void> {
    const browser = this.browser(conversationId)
    const tab = this.activeTab(conversationId)
    await tab.cdp.emulate(size ? emulationFrame(browser.area, size).emulation : undefined)
    this.layout(browser)
    this.emit(conversationId)
  }

  /** Fin d'un tour de l'agent : la taille et le thème qu'il a imposés s'annulent. */
  async endAgentTurn(conversationId: string): Promise<void> {
    const browser = this.browsers.get(conversationId)
    if (!browser) return
    let changed = false
    for (const tab of browser.tabs) {
      if (!tab.cdp.emulation && !tab.cdp.colorScheme) continue
      changed = true
      try {
        if (tab.cdp.emulation) await tab.cdp.emulate(undefined)
        if (tab.cdp.colorScheme) await tab.cdp.setColorScheme(undefined)
      } catch {
        // Onglet fermé entre-temps : rien à rendre.
      }
    }
    if (!changed || this.browsers.get(conversationId) !== browser) return
    this.layout(browser)
    this.emit(conversationId)
  }

  /** L'utilisateur rend sa largeur à la page (puce de la taille imposée). */
  async clearEmulation(conversationId: string): Promise<void> {
    if (this.currentTab(conversationId)?.cdp.emulation)
      await this.emulate(conversationId, undefined)
  }

  private zoomTab(conversationId: string, tab: Tab, action: BrowserZoom): void {
    const contents = tab.view.webContents
    contents.setZoomFactor(nextZoom(contents.getZoomFactor(), action))
    this.emit(conversationId)
  }

  /** Raccourci tapé dans la page (fiche 129). */
  private runShortcut(conversationId: string, tab: Tab, shortcut: PageShortcut): void {
    const contents = tab.view.webContents
    switch (shortcut.kind) {
      case 'zoom':
        this.zoomTab(conversationId, tab, shortcut.action)
        break
      case 'focus-address':
        // Le clavier revient à l'interface, qui le donne au champ d'adresse.
        this.window?.webContents.focus()
        this.options.emitCommand?.({ conversationId, command: 'focus-address' })
        break
      case 'reload':
      case 'back':
      case 'forward':
        void historyStep(contents, shortcut.kind)
        break
    }
  }

  /** Zoom de l'interface : la zone mesurée en CSS s'y multiplie. */
  private uiZoom(): number {
    const window = this.window
    return window && !window.isDestroyed() ? window.webContents.getZoomFactor() : 1
  }

  /* ---------- Onglets ---------- */

  tabs(conversationId: string): { id: string; title: string; url: string; active: boolean }[] {
    const browser = this.browsers.get(conversationId)
    return (browser?.tabs ?? []).map((t) => ({
      id: t.id,
      title: t.view.webContents.getTitle(),
      url: t.view.webContents.getURL(),
      active: t.id === browser?.active
    }))
  }

  /** Nouvel onglet, qui devient l'actif. */
  newTab(conversationId: string): Tab {
    const browser = this.browser(conversationId)
    if (browser.tabs.length >= MAX_TABS) {
      throw new Error(`Au plus ${MAX_TABS} onglets : fermez-en un (browser_tabs close)`)
    }
    if (!this.window) throw new Error('Navigateur indisponible : aucune fenêtre ouverte')
    const view = new WebContentsView({
      webPreferences: {
        session: this.session(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        // Zoom propre à l'onglet, gardé d'une page à l'autre (fiche 129) ; sinon il vaut pour
        // toutes les pages du même site.
        zoomMode: 'isolated'
      }
    })
    view.setBounds(browser.bounds ?? { x: 0, y: 0, ...DEFAULT_SIZE })
    view.setVisible(false)
    view.setBackgroundColor('#ffffff')
    this.window.contentView.addChildView(view)
    const cdp = new CdpTab(view.webContents)
    const tab: Tab = {
      id: `onglet-${this.nextTab++}`,
      view,
      cdp,
      agentUntil: 0,
      userInputAt: 0,
      blockedPopups: [],
      layer: new PageLayer(
        cdp,
        (message) => {
          const owner = this.ownerOf(view.webContents)?.conversationId
          if (owner) {
            this.options.emitAnnotate?.({
              ...message,
              conversationId: owner,
              url: view.webContents.getURL()
            })
          }
        },
        () => view.webContents.getZoomFactor()
      )
    }
    cdp.onBinding = (name, payload, contextId) => tab.layer.binding(name, payload, contextId)
    browser.tabs.push(tab)
    browser.active = tab.id
    // Boîte de la page (alert, confirm…) : la conversation attend l'utilisateur.
    tab.cdp.dialogs.onChange = (dialog) =>
      this.options.onWaiting?.(conversationId, `dialog-${tab.id}`, !!dialog, 'page-dialog')
    this.watch(conversationId, tab)
    this.layout(browser)
    this.emit(conversationId)
    return tab
  }

  selectTab(conversationId: string, tabId: string): void {
    const browser = this.browsers.get(conversationId)
    if (!browser?.tabs.some((t) => t.id === tabId)) throw new Error(`Onglet inconnu : ${tabId}`)
    browser.active = tabId
    this.layout(browser)
    this.emit(conversationId)
  }

  closeTab(conversationId: string, tabId: string): void {
    const browser = this.browsers.get(conversationId)
    const index = browser?.tabs.findIndex((t) => t.id === tabId) ?? -1
    const tab = browser?.tabs[index]
    if (!browser || !tab) throw new Error(`Onglet inconnu : ${tabId}`)
    browser.tabs.splice(index, 1)
    this.destroy(tab)
    if (browser.active === tabId) {
      browser.active = (browser.tabs[index] ?? browser.tabs[index - 1])?.id
    }
    this.layout(browser)
    this.emit(conversationId)
  }

  /** Onglet actif (créé s'il n'y en a pas). */
  activeTab(conversationId: string): Tab {
    return this.currentTab(conversationId) ?? this.newTab(conversationId)
  }

  /**
   * Branche d'une conversation (fiches 023, 094) : elle reprend la page de l'onglet actif de
   * l'originale, si elle n'a pas encore la sienne.
   */
  inherit(conversationId: string, fromId: string): void {
    const url = this.currentTab(fromId)?.view.webContents.getURL() ?? ''
    if (!/^https?:/i.test(url) || this.currentTab(conversationId)) return
    void this.openTab(conversationId, url).catch(() => {})
  }

  /** Conversation supprimée : ses onglets et ses popups sont fermés. */
  close(conversationId: string): void {
    for (const popup of this.popups.get(conversationId) ?? []) {
      if (!popup.isDestroyed()) popup.close()
    }
    this.popups.delete(conversationId)
    this.agentDownloads.delete(conversationId)
    this.savedDownloads.delete(conversationId)
    const browser = this.browsers.get(conversationId)
    if (!browser) return
    this.browsers.delete(conversationId)
    for (const tab of browser.tabs) this.destroy(tab)
  }

  /** Une action de l'agent arrive dans l'onglet actif : ce qu'elle ouvre vient de lui. */
  markAgentInput(conversationId: string): void {
    const tab = this.currentTab(conversationId)
    if (tab) tab.agentUntil = Date.now() + AGENT_INPUT_GRACE_MS
  }

  /** Popups bloquées depuis la dernière fois (actions de l'agent), à lui dire. */
  takeBlockedPopups(conversationId: string): string[] {
    const tabs = this.browsers.get(conversationId)?.tabs ?? []
    return tabs.flatMap((tab) => tab.blockedPopups.splice(0))
  }

  /** Téléchargements lancés par l'agent, où ils en sont depuis la dernière fois (fiche 094). */
  takeDownloads(conversationId: string): DownloadNote[] {
    const notes = this.agentDownloads.get(conversationId) ?? []
    this.agentDownloads.delete(conversationId)
    return notes
  }

  /** « Afficher dans le Finder » d'un fichier enregistré depuis cette conversation. */
  showDownload(conversationId: string, path: string): void {
    if (!this.savedDownloads.get(conversationId)?.has(path)) {
      throw new Error(`Téléchargement inconnu : ${path}`)
    }
    shell.showItemInFolder(path)
  }

  closeAll(): void {
    for (const id of new Set([...this.browsers.keys(), ...this.popups.keys()])) this.close(id)
  }

  /** Onglet actif d'une conversation, sans en créer (outils : boîte de la page ouverte). */
  currentTab(conversationId: string): Tab | undefined {
    const browser = this.browsers.get(conversationId)
    return browser?.tabs.find((t) => t.id === browser.active)
  }

  private browser(conversationId: string): Browser {
    let browser = this.browsers.get(conversationId)
    if (!browser) {
      browser = {
        tabs: [],
        active: undefined,
        bounds: undefined,
        area: { x: 0, y: 0, ...DEFAULT_SIZE }
      }
      this.browsers.set(conversationId, browser)
    }
    return browser
  }

  /**
   * Seul l'onglet actif est visible, et seulement si l'onglet du panneau l'est. Il couvre la zone,
   * ou, sous une taille imposée par l'agent, l'écran réduit pour tenir (fiche 129).
   */
  private layout(browser: Browser): void {
    for (const tab of browser.tabs) {
      const shown = !!browser.bounds && tab.id === browser.active
      if (browser.bounds) tab.view.setBounds(this.frameOf(tab, browser.bounds))
      tab.view.setVisible(shown)
    }
  }

  /** Bornes de la vue dans la zone ; une taille imposée suit la zone (réduction recalculée). */
  private frameOf(tab: Tab, area: BrowserBounds): BrowserBounds {
    const current = tab.cdp.emulation
    if (!current) return area
    const frame = emulationFrame(area, current)
    if (Math.abs(frame.emulation.scale - current.scale) > 0.001) {
      void tab.cdp
        .emulate(frame.emulation)
        .then(() => this.emitTab(tab))
        .catch(() => {})
    }
    return frame.bounds
  }

  private destroy(tab: Tab): void {
    this.window?.contentView.removeChildView(tab.view)
    if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close()
  }

  private emit(conversationId: string): void {
    const state = this.state(conversationId)
    if (state) this.options.emitState(state)
  }

  private emitTab(tab: Tab): void {
    const conversationId = this.ownerOf(tab.view.webContents)?.conversationId
    if (conversationId) this.emit(conversationId)
  }

  private watch(conversationId: string, tab: Tab): void {
    const contents = tab.view.webContents
    const emit = () => {
      if (!contents.isDestroyed()) this.emit(conversationId)
    }
    for (const event of [
      'did-start-loading',
      'did-stop-loading',
      'did-navigate',
      'did-navigate-in-page',
      'page-title-updated'
    ] as const) {
      contents.on(event as 'did-start-loading', emit)
    }
    // Zoom au trackpad ou Ctrl + molette : la puce suit.
    contents.on('zoom-changed', () => setTimeout(emit))
    // Nouveau document : le script du mode Annoter est à remettre (fiche 146).
    contents.on('did-navigate', () => tab.layer.navigated())
    contents.on('dom-ready', () => void tab.layer.documentReady())
    // Raccourcis de navigateur quand la page a le focus ; ils l'emportent sur ceux du menu.
    contents.on('before-input-event', (event, input) => {
      // Échap dans la page en mode Annoter : il finit le mode (fiche 146), pas la page.
      if (tab.layer.annotating && input.type === 'keyDown' && input.key === 'Escape') {
        event.preventDefault()
        this.window?.webContents.focus()
        this.options.emitCommand?.({ conversationId, command: 'annotate-escape' })
        return
      }
      const shortcut = pageShortcut(input, process.platform)
      if (!shortcut) return
      event.preventDefault()
      this.runShortcut(conversationId, tab, shortcut)
    })
    // Gestes de l'utilisateur (pas ceux que l'agent envoie par le CDP) : une popup peut suivre.
    contents.on('input-event', (_event, input) => {
      if (USER_GESTURES.has(input.type) && Date.now() >= tab.agentUntil) {
        tab.userInputAt = Date.now()
      }
    })
    contents.setWindowOpenHandler(({ url, disposition }) => {
      if (!/^https?:/i.test(url)) return { action: 'deny' }
      if (disposition === 'new-window') {
        const now = Date.now()
        if (now < tab.agentUntil) {
          tab.blockedPopups.push(url)
          return { action: 'deny' }
        }
        if (now - tab.userInputAt > USER_GESTURE_MS) return { action: 'deny' }
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            ...POPUP_SIZE,
            ...(this.window ? { parent: this.window } : {}),
            webPreferences: {
              sandbox: true,
              contextIsolation: true,
              nodeIntegration: false,
              webSecurity: true
            }
          }
        }
      }
      // Les liens « nouvel onglet » s'ouvrent dans un nouvel onglet, qui que ce soit.
      try {
        void loadWithin(this.newTab(conversationId), url).catch(() => {})
      } catch {
        // Trop d'onglets : on reste sur la page.
      }
      return { action: 'deny' }
    })
    contents.on('did-create-window', (popup) => this.guardPopup(conversationId, popup))
    contents.on('will-navigate', (event, url) => {
      if (!/^https?:/i.test(url)) event.preventDefault()
    })
  }

  /**
   * Popup de l'utilisateur : même session que sa page (cookies, permissions refusées), liens
   * http(s) seulement, pas de popup dans la popup ; fermée avec la conversation.
   */
  private guardPopup(conversationId: string, popup: BrowserWindow): void {
    const popups = this.popups.get(conversationId) ?? new Set<BrowserWindow>()
    popups.add(popup)
    this.popups.set(conversationId, popups)
    popup.on('closed', () => popups.delete(popup))
    popup.setMenuBarVisibility(false)
    popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    popup.webContents.on('will-navigate', (event, url) => {
      if (!/^https?:/i.test(url)) event.preventDefault()
    })
  }

  /**
   * « Effacer les données du navigateur » (fiche 072) : cookies, connexions, stockage et cache, de
   * la session en cours comme de celle gardée sur le disque. Les pages ouvertes restent.
   */
  async clearData(): Promise<void> {
    const sessions = new Set([electronSession.fromPartition(PARTITION), this.session()])
    for (const s of sessions) {
      await s.clearStorageData()
      await s.clearCache()
      await s.clearAuthCache()
    }
  }

  private session(): Session {
    if (this.browserSession) return this.browserSession
    const keep = this.options.keepCookies?.() ?? true
    const s = electronSession.fromPartition(keep ? PARTITION : MEMORY_PARTITION)
    s.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    s.setPermissionCheckHandler(() => false)
    // Fichiers restés en attente d'une décision (app arrêtée pendant « Enregistrer sous »).
    rmSync(pendingDownloadsDir(), { recursive: true, force: true })
    s.on('will-download', (_event, item, contents) => this.download(item, contents))
    // Certains sites refusent un navigateur qui se présente comme Electron.
    s.setUserAgent(
      s
        .getUserAgent()
        .replace(/ Electron\/\S+/, '')
        .replace(/ bobine\/\S+/i, '')
    )
    this.browserSession = s
    return s
  }

  /**
   * Téléchargement lancé par une page (fiche 094, ADR-0018) : « Enregistrer sous », jamais
   * d'office, même quand une action de l'agent le déclenche ; l'agent apprend où en est la décision.
   */
  private download(item: DownloadItem, contents: WebContents): void {
    const owner = this.ownerOf(contents)
    const byAgent = !!owner?.tab && Date.now() < owner.tab.agentUntil
    const name = item.getFilename()
    const note = (entry: DownloadNote) => {
      if (!byAgent || !owner) return
      const notes = this.agentDownloads.get(owner.conversationId) ?? []
      this.agentDownloads.set(owner.conversationId, [...notes, entry])
    }
    note({ name, state: 'asking' })
    const site = siteOf(contents.getURL())
    // Quelle conversation demande : l'utilisateur en regarde peut-être une autre (fille…).
    const title = byAgent && owner ? this.options.titleOf?.(owner.conversationId) : undefined
    const message = title
      ? t('browser.download.byAgentIn', { title, site })
      : t(byAgent ? 'browser.download.byAgent' : 'browser.download.byPage', { site })
    const key = `save-${this.nextWait++}`
    const waiting = (on: boolean) =>
      owner && this.options.onWaiting?.(owner.conversationId, key, on, 'save')
    waiting(true)
    void saveDownload(item, {
      pendingDir: pendingDownloadsDir(),
      chooseTarget: (file) => this.chooseTarget(file, message).finally(() => waiting(false))
    }).then((outcome) => {
      note({ name, ...outcome })
      if (!owner || outcome.state === 'cancelled') return
      const path = outcome.state === 'completed' ? outcome.path : undefined
      if (path) {
        const saved = this.savedDownloads.get(owner.conversationId) ?? new Set<string>()
        this.savedDownloads.set(owner.conversationId, saved.add(path))
      }
      this.options.emitDownload?.({
        conversationId: owner.conversationId,
        // Le nom choisi dans « Enregistrer sous », pas celui que proposait la page.
        name: path ? basename(path) : name,
        state: outcome.state,
        ...(path ? { path } : {})
      })
    })
  }

  /** Fenêtre « Enregistrer sous » sur celle de l'app, dans Téléchargements. */
  private async chooseTarget(name: string, message: string): Promise<string | undefined> {
    const options = {
      title: t('browser.download.title'),
      message,
      defaultPath: join(app.getPath('downloads'), name)
    }
    const window = this.window && !this.window.isDestroyed() ? this.window : undefined
    const choice = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options))
    return choice.canceled ? undefined : choice.filePath || undefined
  }

  /** Conversation (et onglet) d'une page : un onglet, ou une popup de l'utilisateur. */
  private ownerOf(contents: WebContents): { conversationId: string; tab?: Tab } | undefined {
    for (const [conversationId, browser] of this.browsers) {
      const tab = browser.tabs.find((candidate) => candidate.view.webContents === contents)
      if (tab) return { conversationId, tab }
    }
    for (const [conversationId, popups] of this.popups) {
      if ([...popups].some((p) => !p.isDestroyed() && p.webContents === contents)) {
        return { conversationId }
      }
    }
    return undefined
  }
}

/** Dossier propre à l'app où un téléchargement attend « Enregistrer sous » (fiche 094). */
function pendingDownloadsDir(): string {
  return join(app.getPath('userData'), 'downloads-pending')
}

/** Hôte d'une page, pour dire d'où vient un fichier. */
function siteOf(url: string): string {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}
