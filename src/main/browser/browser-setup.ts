/**
 * Le navigateur intégré dans l'app (fiche 089, sorti de `index.ts`) : son gestionnaire, ses outils
 * pour l'agent, et ce que l'interface lui demande par IPC.
 */
import { t } from 'i18next'
import type { SiteMemory } from '../approvals'
import type { ImageCodec } from '../filmstrip/sheet'
import type { SendEvent } from '../ipc'
import type { PageFreeze } from '@shared/page-notes'
import type { BrowserController } from './browser-controller'
import { encodeImage } from '../screen-capture'
import { BrowserManager, type BrowserManagerOptions } from './browser-manager'
import { browserToolsModule } from './browser-tools'

export interface BrowserSetupOptions {
  /** Cookies gardés d'un lancement à l'autre (fiche 072). */
  keepCookies: () => boolean
  /** Sites « toujours autorisés » (fiche 072). */
  alwaysSites: SiteMemory
  imageCodec: ImageCodec
  send: SendEvent
  /** L'app attend l'utilisateur pour une conversation (« Enregistrer sous », boîte d'une page). */
  onWaiting?: BrowserManagerOptions['onWaiting']
  /** Titre d'une conversation, cité dans « Enregistrer sous ». */
  titleOf?: BrowserManagerOptions['titleOf']
}

export interface BrowserSetup {
  manager: BrowserManager
  tools: ReturnType<typeof browserToolsModule>
  controller: BrowserController
}

export function setupBrowser(options: BrowserSetupOptions): BrowserSetup {
  const manager = new BrowserManager({
    emitState: (state) => options.send('browser:state', state),
    emitDownload: (download) => options.send('browser:download', download),
    emitCommand: (command) => options.send('browser:command', command),
    emitAnnotate: (event) => options.send('browser:annotate', event),
    keepCookies: options.keepCookies,
    ...(options.onWaiting ? { onWaiting: options.onWaiting } : {}),
    ...(options.titleOf ? { titleOf: options.titleOf } : {})
  })
  const tools = browserToolsModule({
    driverFor: (id) => manager.driverFor(id),
    alwaysSites: options.alwaysSites,
    imageCodec: options.imageCodec
  })
  return { manager, tools, controller: browserController(manager, tools) }
}

/** Demandes de l'onglet Navigateur. */
export function browserController(
  manager: Pick<
    BrowserManager,
    | 'show'
    | 'hide'
    | 'navigate'
    | 'openTab'
    | 'capture'
    | 'go'
    | 'state'
    | 'selectTab'
    | 'closeTab'
    | 'clearData'
    | 'inherit'
    | 'showDownload'
    | 'zoom'
    | 'clearEmulation'
    | 'freeze'
    | 'noteShot'
    | 'annotate'
    | 'pagePins'
  >,
  tools: Pick<BrowserSetup['tools'], 'approveSite'>
): BrowserController {
  return {
    show: (id, bounds) => manager.show(id, bounds),
    hide: () => manager.hide(),
    // Site ouvert par l'utilisateur lui-même : l'agent pourra y revenir sans demander.
    navigate: async (id, input) => tools.approveSite(id, await manager.navigate(id, input)),
    openTab: async (id, url) => {
      await manager.openTab(id, url)
    },
    // Page à joindre au message (fiche 066) : nommée d'après son titre, réduite si besoin.
    capture: async (id) => {
      const page = await manager.capture(id)
      if (!page) return null
      const title = page.title
        .replace(/[/:\\]/g, '-')
        .trim()
        .slice(0, 80)
      return encodeImage(
        page.image,
        title ? t('browser.capture.titled', { title }) : t('browser.capture.untitled')
      )
    },
    go: (id, action) => manager.go(id, action),
    state: (id) => manager.state(id),
    selectTab: (id, tabId) => manager.selectTab(id, tabId),
    closeTab: (id, tabId) => manager.closeTab(id, tabId),
    clearData: () => manager.clearData(),
    inherit: (id, fromId) => manager.inherit(id, fromId),
    showDownload: (id, path) => manager.showDownload(id, path),
    zoom: (id, action) => manager.zoom(id, action),
    clearEmulation: (id) => manager.clearEmulation(id),
    // Page figée (fiche 132) et capture propre (fiche 146) : à pleine définition, pour un
    // affichage net.
    freeze: async (id) => asFreeze(await manager.freeze(id)),
    noteShot: async (id) => asFreeze(await manager.noteShot(id)),
    annotate: (id, on, theme) => manager.annotate(id, on, theme),
    pagePins: (id, pins) => manager.pagePins(id, pins)
  }
}

/** Capture du main → PNG en base64 pour le renderer ; `null` sans page ou capture vide. */
function asFreeze(page: Awaited<ReturnType<BrowserManager['freeze']>>): PageFreeze | null {
  if (!page || page.image.isEmpty()) return null
  const { image, ...rest } = page
  return { ...rest, data: image.toPNG().toString('base64'), mimeType: 'image/png' }
}
