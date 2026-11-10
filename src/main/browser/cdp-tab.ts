/**
 * Un onglet du navigateur intégré piloté par le protocole DevTools de Chromium (CDP), exposé par
 * Electron pour chaque page (`webContents.debugger`) — celui qu'utilise Playwright (fiches 007, 031).
 *
 * Relevé sur Electron 44 : par le CDP, clics, saisie, touches et molette arrivent à la page **sans
 * lui donner le focus** (l'utilisateur garde sa zone de saisie) ; la capture marche page masquée ;
 * le débogueur ne répond qu'une fois une première page chargée (d'où `about:blank` au départ).
 */
import { nativeImage, type WebContents } from 'electron'
import type { BrowserEmulation } from '@shared/browser'
import type { MouseButton, Point } from './browser-tools'
import { findInAxTree, formatAxTree, type AXNode } from './ax-tree'
import { ISOLATED_WORLD } from './page-script'
import { DialogWatch } from './page-dialogs'
import type { FilmFrame } from '../filmstrip/sheet'
import { delay } from '../delay'

const MAX_CONSOLE = 300
const MAX_REQUESTS = 300
const MAX_TEXT = 2000
/** Images gardées au plus pendant un film (5 s à 60 images/s). */
const MAX_FILM_FRAMES = 300

export interface ConsoleEntry {
  level: string
  text: string
  source?: string
}

export interface NetworkEntry {
  id: string
  method: string
  url: string
  type: string
  status?: number
  mimeType?: string
  failed?: string
}

/** Taille d'écran émulée et réduction pour tenir dans la zone (fiche 129). */
export type Emulation = BrowserEmulation

/** Touches nommées → champs CDP (`key`, `code`, code Windows, caractère produit). */
const NAMED_KEYS: Record<string, { key: string; code: string; vk: number; text?: string }> = {
  enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  return: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  tab: { key: 'Tab', code: 'Tab', vk: 9 },
  escape: { key: 'Escape', code: 'Escape', vk: 27 },
  esc: { key: 'Escape', code: 'Escape', vk: 27 },
  backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
  delete: { key: 'Delete', code: 'Delete', vk: 46 },
  space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
  arrowup: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  arrowdown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  arrowright: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  up: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  pageup: { key: 'PageUp', code: 'PageUp', vk: 33 },
  pagedown: { key: 'PageDown', code: 'PageDown', vk: 34 },
  home: { key: 'Home', code: 'Home', vk: 36 },
  end: { key: 'End', code: 'End', vk: 35 }
}
const MODIFIER_BITS: Record<string, number> = { alt: 1, ctrl: 2, cmd: 4, shift: 8 }
/** Raccourcis d'édition de macOS : par le CDP, ils passent par des commandes de l'éditeur. */
const MAC_COMMANDS: Record<string, string> = {
  a: 'selectAll',
  c: 'copy',
  v: 'paste',
  x: 'cut',
  z: 'undo'
}

export class CdpTab {
  readonly contents: WebContents
  private readonly ready: Promise<void>
  private readonly consoleEntries: ConsoleEntry[] = []
  private readonly requests = new Map<string, NetworkEntry>()
  emulation: Emulation | undefined
  colorScheme: 'light' | 'dark' | undefined
  private listening = false
  /** Références données à l'agent (`ref_N` ↔ nœud DOM de Chromium), valables jusqu'à la navigation. */
  private refs = new Map<string, number>()
  private refOfNode = new Map<number, string>()
  private nextRef = 1
  /** Film en cours (planche contact, fiche 075) : reçoit les images de `Page.startScreencast`. */
  private filming: ((jpeg: Buffer) => void) | undefined
  /** Boîtes JavaScript de la page, qui la bloquent jusqu'à la réponse de l'utilisateur. */
  readonly dialogs = new DialogWatch()
  /** Appel d'un binding (`Runtime.addBinding`) : le script du mode Annoter (fiche 146). */
  onBinding: ((name: string, payload: string, contextId: number) => void) | undefined

  constructor(contents: WebContents) {
    this.contents = contents
    this.ready = this.attach()
    contents.on('did-navigate', (_event, url) => {
      this.pushConsole({ level: 'info', text: `— Navigation : ${url}` })
      this.refs = new Map()
      this.refOfNode = new Map()
    })
  }

  /** Débogueur prêt (première page chargée). */
  whenReady(): Promise<void> {
    return this.ready
  }

  /** Commande CDP, une fois le débogueur prêt. */
  async send<T = Record<string, unknown>>(method: string, params: object = {}): Promise<T> {
    await this.ready
    if (!this.contents.debugger.isAttached()) await this.attachDebugger()
    // Jamais d'attente sans fin derrière une boîte de la page (`page-dialogs.ts`).
    return (await this.dialogs.guard(() => this.contents.debugger.sendCommand(method, params))) as T
  }

  /** Arbre d'accessibilité de la page, mis en forme pour l'agent (voir `ax-tree.ts`). */
  async readTree(
    filter: 'interactive' | 'all',
    maxChars: number
  ): Promise<{ lines: string[]; truncated: boolean }> {
    return formatAxTree(await this.axNodes(), filter, maxChars, (id) => this.refFor(id))
  }

  async find(query: string): Promise<string[]> {
    return findInAxTree(await this.axNodes(), query, (id) => this.refFor(id))
  }

  /** Centre d'un élément (pixels CSS de la fenêtre), après défilement jusqu'à lui. */
  async pointOf(ref: string): Promise<Point | null> {
    const backendNodeId = this.refs.get(ref)
    if (backendNodeId === undefined) return null
    try {
      await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId })
      const { quads } = await this.send<{ quads: number[][] }>('DOM.getContentQuads', {
        backendNodeId
      })
      const quad = quads[0]
      if (!quad || quad.length < 8) return null
      const xs = [quad[0], quad[2], quad[4], quad[6]] as number[]
      const ys = [quad[1], quad[3], quad[5], quad[7]] as number[]
      return {
        x: Math.round(xs.reduce((a, b) => a + b, 0) / 4),
        y: Math.round(ys.reduce((a, b) => a + b, 0) / 4)
      }
    } catch {
      return null
    }
  }

  /**
   * Remplit un champ, une case ou une liste. Le setter natif contourne celui que les frameworks
   * (React…) posent sur l'élément : ils voient bien un changement et reçoivent `input` / `change`.
   */
  async setValue(ref: string, value: string | number | boolean): Promise<string | null> {
    const backendNodeId = this.refs.get(ref)
    if (backendNodeId === undefined) return 'Référence inconnue ou disparue : relisez la page.'
    let objectId: string | undefined
    try {
      objectId = (
        await this.send<{ object: { objectId?: string } }>('DOM.resolveNode', { backendNodeId })
      ).object.objectId
    } catch {
      return 'Référence disparue : relisez la page.'
    }
    if (!objectId) return 'Référence disparue : relisez la page.'
    const { result } = await this.send<{ result: { value?: string | null } }>(
      'Runtime.callFunctionOn',
      {
        objectId,
        arguments: [{ value }],
        returnByValue: true,
        functionDeclaration: SET_VALUE
      }
    )
    return result.value ?? null
  }

  async evaluateIsolated<T>(code: string): Promise<T> {
    await this.ready
    return (await this.dialogs.guard(() =>
      this.contents.executeJavaScriptInIsolatedWorld(ISOLATED_WORLD, [{ code }], true)
    )) as T
  }

  /** Code évalué dans la page (débogage) : `await` permis, dernière expression renvoyée. */
  async evaluatePage(code: string): Promise<unknown> {
    const response = await this.send<{
      result: { value?: unknown; description?: string; type: string; unserializableValue?: string }
      exceptionDetails?: { text: string; exception?: { description?: string } }
    }>('Runtime.evaluate', {
      expression: code,
      replMode: true,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    })
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ?? response.exceptionDetails.text
      )
    }
    const { result } = response
    if (result.type === 'undefined') return undefined
    return result.value ?? result.unserializableValue ?? result.description
  }

  async mouse(
    type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
    { x, y }: Point,
    button: MouseButton | 'none' = 'none',
    clickCount = 0
  ): Promise<void> {
    const at = this.inputPoint({ x, y })
    await this.send('Input.dispatchMouseEvent', {
      type,
      ...at,
      button,
      clickCount,
      buttons: type === 'mousePressed' ? 1 : 0
    })
  }

  async wheel(point: Point, deltaX: number, deltaY: number): Promise<void> {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      ...this.inputPoint(point),
      deltaX,
      deltaY
    })
  }

  /**
   * Point de la page (pixels CSS) → coordonnées du CDP. Relevé sur Electron 44 (fiche 129) : sous
   * une émulation réduite (`scale`), le CDP attend les coordonnées de l'écran réduit ; le zoom de la
   * page, lui, est déjà compté.
   */
  private inputPoint({ x, y }: Point): Point {
    const scale = this.emulation?.scale ?? 1
    return { x: x * scale, y: y * scale }
  }

  /**
   * Texte saisi dans l'élément qui a le focus. Sans champ de saisie au focus (clic à côté, page
   * qui bougeait encore), le texte partirait dans le vide : l'agent en est averti.
   */
  async insertText(text: string): Promise<void> {
    const editable = await this.evaluateIsolated<boolean>(
      `(() => { const el = document.activeElement; return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'IFRAME'].includes(el.tagName)) })()`
    ).catch(() => true)
    if (!editable) {
      throw new Error(
        'No text field has focus: click the field first (browser_click), or set its value with browser_form_input.'
      )
    }
    await this.send('Input.insertText', { text })
  }

  async key(name: string, modifiers: string[]): Promise<void> {
    const bits = modifiers.reduce((sum, m) => sum | (MODIFIER_BITS[m] ?? 0), 0)
    const named = NAMED_KEYS[name.toLowerCase()]
    const single = !named && name.length === 1
    const upper = name.toUpperCase()
    const key = named?.key ?? name
    const code =
      named?.code ??
      (/^[a-z]$/i.test(name) ? `Key${upper}` : /^\d$/.test(name) ? `Digit${name}` : '')
    const vk = named?.vk ?? (/^[a-z0-9]$/i.test(name) ? upper.charCodeAt(0) : 0)
    // Un raccourci (cmd / ctrl / alt) ne produit pas de caractère.
    const shortcut = modifiers.some((m) => m !== 'shift')
    const text = shortcut ? undefined : (named?.text ?? (single ? name : undefined))
    const commands =
      process.platform === 'darwin' && modifiers.includes('cmd') && single
        ? [
            modifiers.includes('shift') && name.toLowerCase() === 'z'
              ? 'redo'
              : MAC_COMMANDS[name.toLowerCase()]
          ].filter((c): c is string => !!c)
        : []
    const base = { key, code, windowsVirtualKeyCode: vk, modifiers: bits }
    await this.send('Input.dispatchKeyEvent', {
      ...base,
      type: text ? 'keyDown' : 'rawKeyDown',
      ...(text ? { text, unmodifiedText: text } : {}),
      ...(commands.length ? { commands } : {})
    })
    await this.send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' })
  }

  /** Capture de la zone visible, en pixels CSS (× `scale`) : mêmes coordonnées que les clics. */
  async screenshot(
    viewport: { width: number; height: number },
    scale: number
  ): Promise<{ data: string; mimeType: string; width: number; height: number }> {
    const shot = await this.send<{ data: string }>('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 85
    })
    const image = nativeImage.createFromBuffer(Buffer.from(shot.data, 'base64'))
    if (image.isEmpty()) throw new Error('Capture vide : la page n’est pas encore affichée')
    const sized = image.resize({
      width: Math.max(1, Math.round(viewport.width * scale)),
      height: Math.max(1, Math.round(viewport.height * scale)),
      quality: 'good'
    })
    const size = sized.getSize()
    return {
      data: sized.toJPEG(80).toString('base64'),
      mimeType: 'image/jpeg',
      width: size.width,
      height: size.height
    }
  }

  /**
   * Film de la page pendant `run` (planche contact, fiche 075) : une image avant, celles que
   * Chromium envoie à chaque changement de l'écran (`Page.startScreencast`), une image à la fin,
   * chacune avec son moment. Dure au moins `durationMs`, et jusqu'à la fin de `run`.
   */
  async film(
    viewport: { width: number; height: number },
    run: () => Promise<void>,
    durationMs: number
  ): Promise<FilmFrame[]> {
    const frames: FilmFrame[] = []
    const start = Date.now()
    const capture = async () => {
      const shot = await this.send<{ data: string }>('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 70
      })
      frames.push({ at: Date.now() - start, jpeg: Buffer.from(shot.data, 'base64') })
    }
    await capture()
    this.filming = (jpeg) => {
      if (frames.length < MAX_FILM_FRAMES) frames.push({ at: Date.now() - start, jpeg })
    }
    await this.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 70,
      maxWidth: Math.max(1, Math.round(viewport.width)),
      maxHeight: Math.max(1, Math.round(viewport.height)),
      everyNthFrame: 1
    })
    try {
      await run()
      const left = durationMs - (Date.now() - start)
      if (left > 0) await delay(left)
    } finally {
      this.filming = undefined
      await this.send('Page.stopScreencast').catch(() => {})
    }
    await capture()
    return frames
  }

  /**
   * Taille d'écran émulée (mobile, tablette…), réduite de `scale` pour tenir dans la zone (fiche
   * 129) ; `undefined` : taille réelle du panneau.
   */
  async emulate(emulation: Emulation | undefined): Promise<void> {
    if (emulation) {
      await this.send('Emulation.setDeviceMetricsOverride', {
        width: emulation.width,
        height: emulation.height,
        deviceScaleFactor: 0,
        mobile: emulation.mobile,
        scale: emulation.scale
      })
      await this.send('Emulation.setTouchEmulationEnabled', { enabled: emulation.mobile })
    } else {
      await this.send('Emulation.clearDeviceMetricsOverride')
      await this.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    }
    this.emulation = emulation
  }

  async setColorScheme(scheme: 'light' | 'dark' | undefined): Promise<void> {
    await this.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: scheme ?? '' }]
    })
    this.colorScheme = scheme
  }

  console(): ConsoleEntry[] {
    return [...this.consoleEntries]
  }

  clearConsole(): void {
    this.consoleEntries.length = 0
  }

  network(): NetworkEntry[] {
    return [...this.requests.values()]
  }

  async responseBody(id: string): Promise<string> {
    const body = await this.send<{ body: string; base64Encoded: boolean }>(
      'Network.getResponseBody',
      { requestId: id }
    )
    return body.base64Encoded ? `[contenu binaire, ${body.body.length} car. en base64]` : body.body
  }

  private async attach(): Promise<void> {
    // Le débogueur n'obtient aucune réponse tant qu'aucune page n'a été chargée.
    await this.contents.loadURL('about:blank').catch(() => {})
    await this.attachDebugger()
  }

  private async attachDebugger(): Promise<void> {
    const dbg = this.contents.debugger
    if (!dbg.isAttached()) dbg.attach('1.3')
    if (!this.listening) {
      this.listening = true
      dbg.on('message', (_event, method, params) => this.onMessage(method, params))
    }
    await dbg.sendCommand('Runtime.enable')
    await dbg.sendCommand('Network.enable')
    await dbg.sendCommand('Page.enable')
    await dbg.sendCommand('DOM.enable')
    await dbg.sendCommand('Accessibility.enable')
    // La page se croit au premier plan même quand la fenêtre ne l'est pas (l'utilisateur travaille
    // dans une autre app) : sinon un clic de l'agent ne donne pas le focus au champ, et la saisie
    // qui suit part dans le vide.
    await dbg.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true })
  }

  private onMessage(method: string, params: Record<string, unknown>): void {
    switch (method) {
      case 'Runtime.consoleAPICalled': {
        const args = (params['args'] as RemoteValue[] | undefined) ?? []
        // Avertissement d'Electron (app non empaquetée), pas un message de la page : du bruit.
        if (String(args[0]?.value ?? '').includes('Electron Security Warning')) break
        const frame = (
          params['stackTrace'] as { callFrames?: { url: string; lineNumber: number }[] } | undefined
        )?.callFrames?.[0]
        this.pushConsole({
          level: String(params['type'] ?? 'log'),
          text: args.map(remoteText).join(' '),
          ...(frame?.url ? { source: `${frame.url}:${frame.lineNumber + 1}` } : {})
        })
        break
      }
      case 'Runtime.exceptionThrown': {
        const details = params['exceptionDetails'] as
          { text: string; url?: string; lineNumber?: number; exception?: RemoteValue } | undefined
        this.pushConsole({
          level: 'error',
          text: details?.exception?.description ?? details?.text ?? 'Exception',
          ...(details?.url ? { source: `${details.url}:${(details.lineNumber ?? 0) + 1}` } : {})
        })
        break
      }
      case 'Network.requestWillBeSent': {
        const id = String(params['requestId'])
        const request = params['request'] as { method: string; url: string }
        this.requests.delete(id)
        this.requests.set(id, {
          id,
          method: request.method,
          url: request.url,
          type: String(params['type'] ?? 'Other')
        })
        while (this.requests.size > MAX_REQUESTS) {
          const oldest = this.requests.keys().next().value
          if (oldest === undefined) break
          this.requests.delete(oldest)
        }
        break
      }
      case 'Network.responseReceived': {
        const entry = this.requests.get(String(params['requestId']))
        const response = params['response'] as { status: number; mimeType: string }
        if (entry) Object.assign(entry, { status: response.status, mimeType: response.mimeType })
        break
      }
      case 'Page.screencastFrame': {
        // Chaque image doit être acquittée, sinon Chromium n'envoie plus la suivante.
        void this.send('Page.screencastFrameAck', { sessionId: params['sessionId'] }).catch(
          () => {}
        )
        if (this.filming && typeof params['data'] === 'string') {
          this.filming(Buffer.from(params['data'], 'base64'))
        }
        break
      }
      case 'Runtime.bindingCalled':
        this.onBinding?.(
          String(params['name']),
          String(params['payload']),
          Number(params['executionContextId'])
        )
        break
      case 'Page.javascriptDialogOpening':
        this.dialogs.opened(params)
        break
      case 'Page.javascriptDialogClosed':
        this.dialogs.closed(params)
        break
      case 'Network.loadingFailed': {
        const entry = this.requests.get(String(params['requestId']))
        if (entry) entry.failed = String(params['errorText'] ?? 'échec')
        break
      }
    }
  }

  private async axNodes(): Promise<AXNode[]> {
    return (await this.send<{ nodes: AXNode[] }>('Accessibility.getFullAXTree')).nodes
  }

  private refFor(backendNodeId: number): string {
    let ref = this.refOfNode.get(backendNodeId)
    if (!ref) {
      ref = `ref_${this.nextRef++}`
      this.refOfNode.set(backendNodeId, ref)
      this.refs.set(ref, backendNodeId)
    }
    return ref
  }

  private pushConsole(entry: ConsoleEntry): void {
    this.consoleEntries.push({ ...entry, text: entry.text.slice(0, MAX_TEXT) })
    if (this.consoleEntries.length > MAX_CONSOLE) this.consoleEntries.shift()
  }
}

/** Exécutée sur l'élément (`this`) : renvoie un message d'erreur, ou `null`. */
const SET_VALUE = `function (value) {
  const el = this
  const fire = (type) => el.dispatchEvent(new Event(type, { bubbles: true }))
  el.scrollIntoView({ block: 'center' })
  const tag = el.tagName ? el.tagName.toLowerCase() : ''
  if (tag === 'input' && (el.type === 'checkbox' || el.type === 'radio')) {
    const want = value === true || value === 'true' || value === 'on'
    if (el.checked !== want) el.click()
    return null
  }
  if (tag === 'select') {
    const option = [...el.options].find((o) => o.value === String(value) || o.text.trim() === String(value))
    if (!option) return 'Option absente : ' + String(value)
    el.value = option.value
    fire('input')
    fire('change')
    return null
  }
  if (tag === 'input' || tag === 'textarea') {
    el.focus()
    const proto = tag === 'input' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value))
    fire('input')
    fire('change')
    return null
  }
  if (el.isContentEditable) {
    el.focus()
    el.textContent = String(value)
    fire('input')
    return null
  }
  return 'Cet élément ne se remplit pas (' + tag + ').'
}`

interface RemoteValue {
  type: string
  value?: unknown
  description?: string
  unserializableValue?: string
}

function remoteText(value: RemoteValue): string {
  if (value.type === 'string') return String(value.value)
  if (value.value !== undefined) return JSON.stringify(value.value)
  return value.unserializableValue ?? value.description ?? value.type
}
