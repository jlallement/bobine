/**
 * Canaux IPC du navigateur intégré (fiches 007, 129, 132, 146) : le renderer désigne une conversation,
 * le contrôleur du main agit sur son onglet. Sortis d'`ipc.ts` pour tenir son plafond de lignes.
 */
import { t } from 'i18next'
import type { BrowserBounds } from '@shared/browser'
import type { IpcHandlers } from '@shared/ipc'
import type { BrowserController } from './browser-controller'
import { parsePins, parseTheme } from './page-layer'

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

function parseBounds(value: unknown): BrowserBounds {
  const b = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const n = (key: string) => {
    const v = b[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('Paramètre invalide : bounds')
    return v
  }
  return { x: n('x'), y: n('y'), width: Math.max(0, n('width')), height: Math.max(0, n('height')) }
}

export function browserHandlers(
  browser: BrowserController
): Pick<
  IpcHandlers,
  | 'browser:show'
  | 'browser:clearData'
  | 'browser:hide'
  | 'browser:capture'
  | 'browser:navigate'
  | 'browser:go'
  | 'browser:getState'
  | 'browser:selectTab'
  | 'browser:showDownload'
  | 'browser:closeTab'
  | 'browser:zoom'
  | 'browser:clearEmulation'
  | 'browser:freeze'
  | 'browser:noteShot'
  | 'browser:annotate'
  | 'browser:pagePins'
> {
  return {
    'browser:show': async (id, bounds) => {
      browser.show(str(id, 'id'), parseBounds(bounds))
      return undefined
    },
    'browser:clearData': async () => {
      if (!browser.clearData) throw new Error(t('ipc.unavailable.browser'))
      await browser.clearData()
      return undefined
    },
    'browser:hide': () => {
      browser.hide()
      return undefined
    },
    'browser:capture': (id) => {
      if (!browser.capture) throw new Error(t('ipc.unavailable.pageCapture'))
      return browser.capture(str(id, 'id'))
    },
    'browser:navigate': async (id, input) => {
      await browser.navigate(str(id, 'id'), str(input, 'input'))
      return undefined
    },
    'browser:go': async (id, action) => {
      if (!['back', 'forward', 'reload', 'stop'].includes(action)) {
        throw new Error('Paramètre invalide : action')
      }
      await browser.go(str(id, 'id'), action)
      return undefined
    },
    'browser:getState': async (id) => browser.state(str(id, 'id')),
    'browser:selectTab': async (id, tabId) => {
      browser.selectTab(str(id, 'id'), str(tabId, 'tabId'))
      return undefined
    },
    'browser:showDownload': async (id, path) => {
      if (!browser.showDownload) throw new Error(t('ipc.unavailable.browser'))
      browser.showDownload(str(id, 'id'), str(path, 'path'))
      return undefined
    },
    'browser:closeTab': async (id, tabId) => {
      browser.closeTab(str(id, 'id'), str(tabId, 'tabId'))
      return undefined
    },
    'browser:zoom': async (id, action) => {
      if (!['in', 'out', 'reset'].includes(action)) throw new Error('Paramètre invalide : action')
      if (!browser.zoom) throw new Error(t('ipc.unavailable.browser'))
      browser.zoom(str(id, 'id'), action)
      return undefined
    },
    'browser:clearEmulation': async (id) => {
      if (!browser.clearEmulation) throw new Error(t('ipc.unavailable.browser'))
      await browser.clearEmulation(str(id, 'id'))
      return undefined
    },
    'browser:freeze': async (id) => {
      if (!browser.freeze) throw new Error(t('ipc.unavailable.pageCapture'))
      return browser.freeze(str(id, 'id'))
    },
    'browser:noteShot': async (id) => {
      if (!browser.noteShot) throw new Error(t('ipc.unavailable.pageCapture'))
      return browser.noteShot(str(id, 'id'))
    },
    'browser:annotate': async (id, on, theme) => {
      if (!browser.annotate) throw new Error(t('ipc.unavailable.browser'))
      if (typeof on !== 'boolean') throw new Error('Paramètre invalide : on')
      await browser.annotate(str(id, 'id'), on, theme === null ? undefined : parseTheme(theme))
      return undefined
    },
    'browser:pagePins': async (id, pins) => {
      if (!browser.pagePins) throw new Error(t('ipc.unavailable.browser'))
      await browser.pagePins(str(id, 'id'), parsePins(pins))
      return undefined
    }
  }
}
