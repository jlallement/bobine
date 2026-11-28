/**
 * Canaux IPC du navigateur intégré (fiches 007, 129, 132, 146) : le renderer désigne une conversation,
 * le contrôleur du main agit sur son onglet. Sortis d'`ipc.ts` pour tenir son plafond de lignes.
 */
import { t } from 'i18next'
import type { BrowserBounds, BrowserColorScheme, BrowserDeviceRequest } from '@shared/browser'
import { findDevice, isScreenSize } from '@shared/browser-devices'
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

const invalidDevice = () => new Error('Paramètre invalide : device')

/**
 * Objet simple venu du renderer (prototype `Object`, ni tableau ni objet sans prototype), dont
 * chaque clé propre est une chaîne de `keys` ; refusé sinon. Seules les valeurs sont lues, jamais
 * un accesseur exécuté : un accesseur donne `undefined`, comme une clé absente, et le champ attendu
 * est alors refusé par sa propre vérification.
 */
function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw invalidDevice()
  if (Object.getPrototypeOf(value) !== Object.prototype) throw invalidDevice()
  const record: Record<string, unknown> = {}
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) throw invalidDevice()
    record[key] = Object.getOwnPropertyDescriptor(value, key)?.value
  }
  return record
}

function colorSchemeOf(value: unknown): BrowserColorScheme | null {
  if (value === null || value === 'light' || value === 'dark') return value
  throw invalidDevice()
}

function kindOf(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) throw invalidDevice()
  return Object.getOwnPropertyDescriptor(value, 'kind')?.value
}

/**
 * Réglage de taille et de thème envoyé par l'interface (fiche 295), revérifié : « Adaptatif », un
 * appareil connu de la liste, ou une taille libre entière dans les bornes de `browser_resize` ;
 * thème dans l'énumération. Rien d'autre (ni échelle, ni densité, ni identité du navigateur) ;
 * l'objet rendu est neuf, jamais celui reçu.
 */
export function parseDeviceRequest(value: unknown): BrowserDeviceRequest | null {
  if (value === null) return null
  const kind = kindOf(value)
  if (kind === 'responsive') {
    const r = exactRecord(value, ['kind', 'colorScheme'])
    return { kind, colorScheme: colorSchemeOf(r['colorScheme']) }
  }
  if (kind === 'preset') {
    const r = exactRecord(value, ['kind', 'id', 'landscape', 'colorScheme'])
    const id = r['id']
    const landscape = r['landscape']
    if (typeof id !== 'string' || !findDevice(id) || typeof landscape !== 'boolean') {
      throw invalidDevice()
    }
    return { kind, id, landscape, colorScheme: colorSchemeOf(r['colorScheme']) }
  }
  if (kind === 'custom') {
    const r = exactRecord(value, ['kind', 'width', 'height', 'mobile', 'colorScheme'])
    const { width, height, mobile } = r
    if (!isScreenSize(width) || !isScreenSize(height) || typeof mobile !== 'boolean') {
      throw invalidDevice()
    }
    return { kind, width, height, mobile, colorScheme: colorSchemeOf(r['colorScheme']) }
  }
  throw invalidDevice()
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
  | 'browser:setDevice'
  | 'browser:freeze'
  | 'browser:noteShot'
  | 'browser:annotate'
  | 'browser:pagePins'
  | 'browser:allowCertificate'
  | 'browser:leaveCertificate'
  | 'browser:openCertificateSite'
> {
  return {
    'browser:show': async (id, bounds, focus) => {
      browser.show(str(id, 'id'), parseBounds(bounds), focus === true)
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
    // Seul un geste dans l'interface arrive ici (émetteur vérifié, fiche 114) ; tout est revérifié,
    // et le main refuse un onglet qui n'est pas celui de cette conversation.
    'browser:setDevice': async (id, tabId, device) => {
      if (!browser.setDevice) throw new Error(t('ipc.unavailable.browser'))
      const conversationId = str(id, 'id')
      const tab = str(tabId, 'tabId')
      await browser.setDevice(conversationId, tab, parseDeviceRequest(device))
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
    },
    // Seul un clic dans l'interface arrive ici (émetteur vérifié par `registerIpcHandlers`) ; le
    // jeton désigne l'avertissement noté par le main, qui en tire hôte, port et empreinte.
    'browser:allowCertificate': async (id, token, remember) => {
      if (!browser.allowCertificate) throw new Error(t('ipc.unavailable.browser'))
      if (typeof remember !== 'boolean') throw new Error('Paramètre invalide : remember')
      await browser.allowCertificate(str(id, 'id'), str(token, 'token'), remember)
      return undefined
    },
    'browser:leaveCertificate': async (id) => {
      if (!browser.leaveCertificate) throw new Error(t('ipc.unavailable.browser'))
      await browser.leaveCertificate(str(id, 'id'))
      return undefined
    },
    'browser:openCertificateSite': async (id, token) => {
      if (!browser.openCertificateSite) throw new Error(t('ipc.unavailable.browser'))
      await browser.openCertificateSite(str(id, 'id'), str(token, 'token'))
      return undefined
    }
  }
}
