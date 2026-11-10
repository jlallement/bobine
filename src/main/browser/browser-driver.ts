/**
 * Pilote de la page d'une conversation pour les outils de l'agent (`browser-tools.ts`), sorti de
 * `browser-manager.ts` (fiche 129). Les points sont en pixels CSS de la page ; `cdp-tab.ts` les
 * convertit pour le CDP.
 */
import type { WebContents, WebContentsView } from 'electron'
import type { BrowserDriver, Point } from './browser-tools'
import type { BrowserManager } from './browser-manager'
import type { CdpTab } from './cdp-tab'
import { cssViewport } from './page-view'
import { pageTextScript } from './page-script'
import { delay } from '../delay'

const LOAD_TIMEOUT_MS = 30_000
const HISTORY_TIMEOUT_MS = 10_000

/** Ce qu'il faut d'un onglet pour le charger. */
interface LoadableTab {
  view: WebContentsView
  cdp: CdpTab
}

/** Charge une adresse ; au-delà du délai, on rend la main (la page continue de charger). */
export async function loadWithin(tab: LoadableTab, url: string): Promise<void> {
  await tab.cdp.whenReady()
  const load = tab.view.webContents.loadURL(url).catch((error: unknown) => {
    // Navigation remplacée (redirection côté page) : la page a bien changé.
    if (error instanceof Error && /ERR_ABORTED/.test(error.message)) return
    throw error
  })
  await Promise.race([load, delay(LOAD_TIMEOUT_MS, { unref: true })])
}

export async function historyStep(contents: WebContents, action: 'back' | 'forward' | 'reload') {
  const stopped = new Promise<void>((resolve) => contents.once('did-stop-loading', () => resolve()))
  const history = contents.navigationHistory
  if (action === 'back') {
    if (!history.canGoBack()) return
    history.goBack()
  } else if (action === 'forward') {
    if (!history.canGoForward()) return
    history.goForward()
  } else contents.reload()
  await Promise.race([stopped, delay(HISTORY_TIMEOUT_MS, { unref: true })])
}

export function createDriver(manager: BrowserManager, conversationId: string): BrowserDriver {
  const tab = () => manager.activeTab(conversationId)
  const cdp = () => tab().cdp
  /** Action de l'agent dans la page : ce qu'elle ouvre (popup) vient de lui (fiche 072). */
  const asAgent = async <T>(action: () => Promise<T>): Promise<T> => {
    tab()
    manager.markAgentInput(conversationId)
    try {
      return await action()
    } finally {
      manager.markAgentInput(conversationId)
    }
  }
  // Laisse la page traiter l'événement (rendu, gestionnaires) avant l'action suivante.
  const settle = () => delay(50, { unref: true })
  // Fenêtre de la page en pixels CSS : celle des captures et des clics de l'agent (fiche 129).
  const viewport = () => {
    const { view, cdp: page } = tab()
    return cssViewport(view.getBounds(), view.webContents.getZoomFactor(), page.emulation)
  }
  const press = async (point: Point, button: 'left' | 'right' | 'middle', count: number) => {
    await cdp().mouse('mousePressed', point, button, count)
    await cdp().mouse('mouseReleased', point, button, count)
  }
  // Action qui ouvre une boîte de la page : elle a eu lieu, l'outil rend la main (`page-dialogs.ts`).
  const through = (action: () => Promise<void>) => cdp().dialogs.through(action, undefined)

  return {
    navigate: (url) => asAgent(() => loadWithin(tab(), url)),
    go: (action) => historyStep(tab().view.webContents, action),
    current: () => {
      const contents = tab().view.webContents
      return { url: contents.getURL(), title: contents.getTitle() }
    },
    viewport,
    screenshot: (scale) => cdp().screenshot(viewport(), scale),
    film: (run, durationMs) => cdp().film(viewport(), run, durationMs),
    readTree: (filter, maxChars) => cdp().readTree(filter, maxChars),
    find: (query) => cdp().find(query),
    pointOf: (ref) => cdp().pointOf(ref),
    setValue: (ref, value) =>
      asAgent(() => cdp().dialogs.through(() => cdp().setValue(ref, value), null)),
    pageText: (maxChars) => cdp().evaluateIsolated<string>(pageTextScript(maxChars)),
    click: (point, button, clickCount) =>
      asAgent(() =>
        through(async () => {
          await cdp().mouse('mouseMoved', point)
          for (let i = 1; i <= clickCount; i++) await press(point, button, i)
          await settle()
        })
      ),
    move: (point) =>
      asAgent(() =>
        through(async () => {
          await cdp().mouse('mouseMoved', point)
          await settle()
        })
      ),
    drag: (from, to) =>
      asAgent(async () => {
        await cdp().mouse('mouseMoved', from)
        await cdp().mouse('mousePressed', from, 'left', 1)
        for (let i = 1; i <= 10; i++) {
          await cdp().mouse(
            'mouseMoved',
            {
              x: Math.round(from.x + ((to.x - from.x) * i) / 10),
              y: Math.round(from.y + ((to.y - from.y) * i) / 10)
            },
            'left'
          )
        }
        await cdp().mouse('mouseReleased', to, 'left', 1)
        await settle()
      }),
    wheel: (point, deltaX, deltaY) =>
      asAgent(async () => {
        // CDP : delta positif = vers le bas / la droite.
        await cdp().wheel(point, deltaX, deltaY)
        await delay(250, { unref: true })
      }),
    insertText: (text) =>
      asAgent(() =>
        through(async () => {
          await cdp().insertText(text)
          await settle()
        })
      ),
    key: (key, modifiers) =>
      asAgent(() =>
        through(async () => {
          await cdp().key(key, modifiers)
          await settle()
        })
      ),
    console: () => cdp().console(),
    clearConsole: () => cdp().clearConsole(),
    network: () => cdp().network(),
    responseBody: (id) => cdp().responseBody(id),
    evaluatePage: (code) => asAgent(() => cdp().evaluatePage(code)),
    blockedPopups: () => manager.takeBlockedPopups(conversationId),
    downloads: () => manager.takeDownloads(conversationId),
    dialog: () => manager.currentTab(conversationId)?.cdp.dialogs.current,
    dialogAnswers: () => manager.currentTab(conversationId)?.cdp.dialogs.takeAnswers() ?? [],
    emulate: (size) => manager.emulate(conversationId, size),
    emulation: () => manager.currentTab(conversationId)?.cdp.emulation,
    colorScheme: (scheme) => cdp().setColorScheme(scheme),
    tabs: () => manager.tabs(conversationId),
    newTab: async () => {
      const created = manager.newTab(conversationId)
      await created.cdp.whenReady()
      return created.id
    },
    selectTab: (id) => manager.selectTab(conversationId, id),
    closeTab: (id) => manager.closeTab(conversationId, id)
  }
}
