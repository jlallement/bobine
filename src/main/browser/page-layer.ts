/**
 * Annoter une page vivante (fiche 146, ADR-0033) : pendant le mode Annoter, la vue native reste
 * affichée et un script, lancé dans un **monde isolé créé par le CDP**, intercepte les clics avant
 * la page, dessine épingles, bulles et contour dans un élément à racine fermée, et parle au main par
 * un **binding** que seul ce monde voit. La page défile et zoome comme d'habitude.
 *
 * Relevé sur Electron 45 (sondes de la fiche 146) : le clic intercepté en phase de capture sur
 * `window` n'atteint pas les gestionnaires de la page ; `capturePage({ stayHidden })` redessine une
 * page masquée (le CDP, lui, y reste bloqué : ni `Page.captureScreenshot` ni `Input.*`).
 */
import type { NativeImage, WebContents } from 'electron'
import type {
  PageElement,
  PageFreeze,
  PageLayerMessage,
  PageLayerTheme,
  PagePin,
  PagePoint
} from '@shared/page-notes'
import type { CdpTab } from './cdp-tab'
import { ELEMENT_AT } from './page-script'
import { cssViewport } from './page-view'
import { delay } from '../delay'

/** Monde isolé du script (nom CDP) et binding qu'il appelle. */
export const LAYER_WORLD = 'bobine-annoter'
export const LAYER_BINDING = '__bobineNote'
/** Une commande du script ne bloque jamais le main plus longtemps (page occupée, boîte ouverte). */
const LAYER_TIMEOUT_MS = 2000
const MAX_PINS = 200
const MAX_PIN_TEXT = 2000

/**
 * Script de la page, évalué dans le monde isolé ; il garde son état (ancres des épingles) tant que
 * le document vit. Aucun `innerHTML` : les pages à Trusted Types le refuseraient. Les clics sont
 * arrêtés en phase de capture sur `window` ; ceux sur les épingles de l'app (dans la racine fermée)
 * passent.
 */
export const LAYER_SCRIPT = `(() => {
  if (globalThis.__bobineLayer) return true
  const describe = ${ELEMENT_AT}
  const anchors = new Map()
  let pins = []
  let theme = { accent: '#c96442', surface: '#ffffff', text: '#1f1e1d', border: '#e3e0d6' }
  let host = null, box = null, outline = null, frame = 0, hover = null, started = false
  // Zoom de la page compensé : épingles et bulles gardent leur taille à l'écran (comme dans Figma).
  // Le zoom suit \`devicePixelRatio\`, calé sur le zoom connu du main (\`zoom(z)\`).
  let scale = 1, base = devicePixelRatio
  const follow = () => {
    const next = base / devicePixelRatio
    if (Math.abs(next - scale) > 0.001) {
      scale = next
      if (box) box.style.setProperty('zoom', String(scale))
    }
  }
  const nodes = new Map()
  const send = (message) => { try { ${LAYER_BINDING}(JSON.stringify(message)) } catch {} }
  const round = (n) => Math.round(n * 10) / 10
  const ours = (event) => !!host && event.composedPath().includes(host)
  const elementOf = (target) => target instanceof Element ? target : target && target.parentElement
  const newId = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const pointOf = (pin) => {
    const anchor = anchors.get(pin.id)
    if (anchor && anchor.el.isConnected) {
      const r = anchor.el.getBoundingClientRect()
      if (r.width || r.height) {
        const x = r.left + anchor.fx * r.width, y = r.top + anchor.fy * r.height
        anchor.doc = { x: x + scrollX, y: y + scrollY }
        return { x, y }
      }
    }
    const doc = anchor ? anchor.doc : pin.doc
    return { x: doc.x - scrollX, y: doc.y - scrollY }
  }
  const inside = (p) => p.x >= 0 && p.y >= 0 && p.x <= innerWidth && p.y <= innerHeight
  const visible = () => {
    const out = {}
    for (const pin of pins) {
      const p = pointOf(pin)
      if (inside(p)) out[pin.id] = { x: round(p.x), y: round(p.y) }
    }
    return out
  }
  const block = (event) => {
    if (ours(event)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const place = (event) => {
    if (ours(event)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.button !== 0) return
    const target = elementOf(event.target)
    if (!target) return
    const r = target.getBoundingClientRect()
    const id = newId()
    const x = event.clientX, y = event.clientY
    const doc = { x: round(x + scrollX), y: round(y + scrollY) }
    anchors.set(id, {
      el: target,
      fx: r.width ? (x - r.left) / r.width : 0,
      fy: r.height ? (y - r.top) / r.height : 0,
      doc
    })
    let element = null
    try { element = describe.call(target) } catch {}
    const seen = visible()
    seen[id] = { x: round(x), y: round(y) }
    send({ kind: 'place', id, point: { x: round(x), y: round(y) }, doc, element, pins: seen })
  }
  const stopTouch = (event) => { if (!ours(event)) event.stopImmediatePropagation() }
  const track = (event) => { hover = ours(event) ? null : elementOf(event.target) }
  const leave = () => { hover = null }
  const BLOCKED = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'auxclick', 'contextmenu']
  const css = (el, rules) => { for (const [k, v] of Object.entries(rules)) el.style.setProperty(k, v) }
  const build = () => {
    host = document.createElement('bobine-notes')
    css(host, { all: 'initial', position: 'fixed', left: '0', top: '0', width: '0', height: '0', 'z-index': '2147483647', 'pointer-events': 'none' })
    // Curseur en croix sur toute la page, et cadres traités comme un élément (le clic les désigne).
    const cursor = document.createElement('style')
    cursor.textContent = '*, *::before, *::after { cursor: crosshair !important } iframe, frame, embed, object { pointer-events: none !important }'
    host.append(cursor)
    const root = host.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = [
      '.box { position: fixed; left: 0; top: 0; width: 0; height: 0; font: 13px/1.4 -apple-system, BlinkMacSystemFont, system-ui, sans-serif }',
      '.outline { position: fixed; border: 1.5px solid var(--accent); border-radius: 4px; background: color-mix(in srgb, var(--accent) 8%, transparent); pointer-events: none; display: none; box-sizing: border-box }',
      '.pin { position: fixed; width: 26px; height: 26px; margin: 0; padding: 0; border: 0; transform: translateY(-100%); border-radius: 13px 13px 13px 2px; background: var(--accent); color: #fff; font: 600 12px/26px -apple-system, BlinkMacSystemFont, system-ui, sans-serif; text-align: center; box-shadow: 0 0 0 2px #fff, 0 2px 8px rgb(0 0 0 / 0.25); cursor: pointer; pointer-events: auto }',
      '.bubble { position: fixed; width: 250px; box-sizing: border-box; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 4px 16px rgb(0 0 0 / 0.16); padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; pointer-events: auto }'
    ].join('\\n')
    box = document.createElement('div')
    box.className = 'box'
    outline = document.createElement('div')
    outline.className = 'outline'
    box.append(outline)
    // Les gestes sur les épingles ne remontent pas jusqu'à la page.
    for (const type of BLOCKED) box.addEventListener(type, (event) => event.stopPropagation())
    root.append(style, box)
  }
  const paintTheme = () => {
    if (!box) return
    css(box, { '--accent': theme.accent, '--surface': theme.surface, '--text': theme.text, '--border': theme.border })
  }
  const rebuild = () => {
    if (!box) return
    for (const { pin, bubble } of nodes.values()) { pin.remove(); bubble && bubble.remove() }
    nodes.clear()
    for (const item of pins) {
      const open = (event) => {
        event.preventDefault()
        event.stopPropagation()
        send({ kind: 'open', id: item.id, pins: visible() })
      }
      const pin = document.createElement('button')
      pin.className = 'pin'
      pin.textContent = String(item.n)
      pin.addEventListener('click', open)
      let bubble = null
      if (item.text) {
        bubble = document.createElement('div')
        bubble.className = 'bubble'
        bubble.textContent = item.text
        bubble.addEventListener('click', open)
      }
      box.append(pin)
      if (bubble) box.append(bubble)
      nodes.set(item.id, { pin, bubble, item })
    }
  }
  const draw = () => {
    frame = requestAnimationFrame(draw)
    if (!host.isConnected) document.documentElement.append(host)
    follow()
    // Pixels CSS de la page → unités de la boîte, réduite (zoom CSS) pour compenser celui de la page.
    const u = (v) => v / scale
    const target = hover && hover.isConnected ? hover.getBoundingClientRect() : null
    if (target && (target.width || target.height)) {
      css(outline, { display: 'block', left: u(target.left) - 3 + 'px', top: u(target.top) - 3 + 'px', width: u(target.width) + 6 + 'px', height: u(target.height) + 6 + 'px' })
    } else outline.style.setProperty('display', 'none')
    const W = u(innerWidth), H = u(innerHeight)
    for (const { pin, bubble, item } of nodes.values()) {
      const p = pointOf(item)
      const shown = p.x > -30 && p.y > -30 && p.x < innerWidth + 30 && p.y < innerHeight + 30
      pin.style.setProperty('display', shown ? 'block' : 'none')
      if (bubble) bubble.style.setProperty('display', shown ? 'block' : 'none')
      if (!shown) continue
      const x = u(p.x), y = u(p.y)
      css(pin, { left: x + 'px', top: y + 'px' })
      if (bubble) {
        // Page étroite : la bulle se réduit pour tenir.
        const width = Math.max(120, Math.min(250, W - 16))
        const left = x - width - 10 >= 8 ? x - width - 10 : x + 36
        const height = u(bubble.getBoundingClientRect().height) || 40
        const top = Math.max(8, Math.min(y + 11, H - height - 8))
        css(bubble, {
          width: width + 'px',
          left: Math.max(8, Math.min(left, W - width - 8)) + 'px',
          top: top + 'px'
        })
      }
    }
  }
  globalThis.__bobineLayer = {
    start(next) {
      if (next) theme = next
      if (!host) { build(); rebuild() }
      paintTheme()
      box.style.setProperty('zoom', String(scale))
      if (started) return true
      started = true
      for (const type of BLOCKED) addEventListener(type, block, true)
      addEventListener('click', place, true)
      addEventListener('touchstart', stopTouch, true)
      addEventListener('touchend', stopTouch, true)
      addEventListener('mousemove', track, true)
      document.addEventListener('mouseleave', leave)
      document.documentElement.append(host)
      host.style.removeProperty('display')
      frame = requestAnimationFrame(draw)
      return true
    },
    stop() {
      if (!started) return true
      started = false
      for (const type of BLOCKED) removeEventListener(type, block, true)
      removeEventListener('click', place, true)
      removeEventListener('touchstart', stopTouch, true)
      removeEventListener('touchend', stopTouch, true)
      removeEventListener('mousemove', track, true)
      document.removeEventListener('mouseleave', leave)
      cancelAnimationFrame(frame)
      hover = null
      host.remove()
      return true
    },
    pins(list) {
      pins = list
      rebuild()
      if (started) { cancelAnimationFrame(frame); draw() }
      return true
    },
    zoom(z) {
      base = devicePixelRatio / (z > 0 ? z : 1)
      follow()
      return true
    },
    hide() { if (host) host.style.setProperty('display', 'none'); return true },
    show() { if (host) host.style.removeProperty('display'); return true }
  }
  return true
})()`

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function point(value: unknown): PagePoint | null {
  if (typeof value !== 'object' || value === null) return null
  const p = value as Record<string, unknown>
  return finite(p['x']) && finite(p['y']) ? { x: p['x'], y: p['y'] } : null
}

function identifier(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9]{1,64}$/i.test(value) ? value : null
}

function points(value: unknown): Record<string, PagePoint> {
  const out: Record<string, PagePoint> = {}
  if (typeof value !== 'object' || value === null) return out
  for (const [key, at] of Object.entries(value).slice(0, MAX_PINS)) {
    const id = identifier(key)
    const p = point(at)
    if (id && p) out[id] = p
  }
  return out
}

function element(value: unknown): PageElement | null {
  if (typeof value !== 'object' || value === null) return null
  const e = value as Record<string, unknown>
  const text = (key: string, max: number) =>
    typeof e[key] === 'string' ? (e[key] as string).slice(0, max) : ''
  return {
    tag: text('tag', 40),
    selector: text('selector', 400),
    text: text('text', 400),
    field: e['field'] === true,
    label: text('label', 200)
  }
}

/**
 * Message du script, vérifié champ par champ : il vient d'un monde isolé, mais d'une page web ; tout
 * ce qui ne ressemble pas à un clic ou à une épingle ouverte est ignoré (`null`).
 */
export function parseLayerMessage(payload: string): PageLayerMessage | null {
  if (payload.length > 200_000) return null
  let raw: unknown
  try {
    raw = JSON.parse(payload)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const m = raw as Record<string, unknown>
  const id = identifier(m['id'])
  if (!id) return null
  if (m['kind'] === 'open') return { kind: 'open', id, pins: points(m['pins']) }
  if (m['kind'] !== 'place') return null
  const at = point(m['point'])
  const doc = point(m['doc'])
  if (!at || !doc) return null
  return {
    kind: 'place',
    id,
    point: at,
    doc,
    element: element(m['element']),
    pins: points(m['pins'])
  }
}

/** Épingles reçues du renderer, vérifiées et bornées. */
export function parsePins(value: unknown): PagePin[] {
  if (!Array.isArray(value)) throw new Error('Paramètre invalide : pins')
  return value.slice(0, MAX_PINS).map((raw: unknown) => {
    const p = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
    const id = identifier(p['id'])
    const doc = point(p['doc'])
    if (!id || !doc || !finite(p['n']) || typeof p['text'] !== 'string') {
      throw new Error('Paramètre invalide : pins')
    }
    return { id, n: Math.round(p['n']), text: p['text'].slice(0, MAX_PIN_TEXT), doc }
  })
}

/** Couleurs du thème : des valeurs CSS courtes, sans rien qui sorte de la déclaration. */
export function parseTheme(value: unknown): PageLayerTheme {
  const t = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const color = (key: string) => {
    const v = t[key]
    if (typeof v !== 'string' || v.length > 64 || !/^[#a-z0-9(),.%\s/-]+$/i.test(v)) {
      throw new Error('Paramètre invalide : theme')
    }
    return v.trim()
  }
  return {
    accent: color('accent'),
    surface: color('surface'),
    text: color('text'),
    border: color('border')
  }
}

/** Ce que la couche demande au CDP de l'onglet. */
type LayerCdp = Pick<CdpTab, 'send'>

const within = <T>(promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    delay(LAYER_TIMEOUT_MS).then(() => {
      throw new Error('Page occupée : annotation indisponible')
    })
  ])

/**
 * Le script d'un onglet : monde isolé recréé à chaque document (le précédent part avec lui), mode
 * Annoter, épingles, et masquage le temps d'une capture propre.
 */
export class PageLayer {
  private context: number | undefined
  private bound = false
  private active = false
  private theme: PageLayerTheme | undefined
  private pinList: PagePin[] = []
  private readonly cdp: LayerCdp
  private readonly onMessage: (message: PageLayerMessage) => void
  /** Zoom de la page (fiche 129), d'où le script cale le sien. */
  private readonly zoomOf: () => number

  constructor(
    cdp: LayerCdp,
    onMessage: (message: PageLayerMessage) => void,
    zoomOf: () => number = () => 1
  ) {
    this.cdp = cdp
    this.onMessage = onMessage
    this.zoomOf = zoomOf
  }

  get annotating(): boolean {
    return this.active
  }

  /** `Runtime.bindingCalled` : seulement le binding de la couche, depuis son monde. */
  binding(name: string, payload: string, contextId: number): void {
    if (name !== LAYER_BINDING || contextId !== this.context || !this.active) return
    const message = parseLayerMessage(payload)
    if (message) this.onMessage(message)
  }

  /** Nouveau document : le monde est à recréer ; en mode Annoter, le script revient. */
  navigated(): void {
    this.context = undefined
  }

  async documentReady(): Promise<void> {
    if (this.active) await this.apply().catch(() => {})
  }

  async set(on: boolean, theme?: PageLayerTheme): Promise<void> {
    this.active = on
    if (theme) this.theme = theme
    if (!on && this.context === undefined) return
    await this.apply()
  }

  async pins(list: PagePin[]): Promise<void> {
    this.pinList = list
    if (this.active) await this.call(`__bobineLayer.pins(${JSON.stringify(list)})`)
  }

  /** `run` pendant que le script est caché (capture propre), puis il revient. */
  async hidden<T>(run: () => Promise<T>): Promise<T> {
    if (!this.active) return run()
    await this.call('__bobineLayer.hide()')
    try {
      return await run()
    } finally {
      await this.call('__bobineLayer.show()').catch(() => {})
    }
  }

  private async apply(): Promise<void> {
    if (!this.active) {
      await this.call('__bobineLayer.stop()')
      return
    }
    await this.call(
      `__bobineLayer.zoom(${this.zoomOf()}) && __bobineLayer.start(${JSON.stringify(this.theme ?? null)}) && __bobineLayer.pins(${JSON.stringify(this.pinList)})`
    )
  }

  private async world(): Promise<number> {
    if (this.context !== undefined) return this.context
    const { frameTree } = await within(
      this.cdp.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree')
    )
    const { executionContextId } = await within(
      this.cdp.send<{ executionContextId: number }>('Page.createIsolatedWorld', {
        frameId: frameTree.frame.id,
        worldName: LAYER_WORLD,
        grantUniveralAccess: false
      })
    )
    if (!this.bound) {
      await within(
        this.cdp.send('Runtime.addBinding', {
          name: LAYER_BINDING,
          executionContextName: LAYER_WORLD
        })
      )
      this.bound = true
    }
    await this.evaluate(executionContextId, LAYER_SCRIPT)
    this.context = executionContextId
    return executionContextId
  }

  /** Commande du script ; un contexte perdu (navigation) est recréé une fois. */
  private async call(expression: string): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      const contextId = await this.world()
      try {
        await this.evaluate(contextId, expression)
        return
      } catch (error) {
        if (attempt > 0 || !/context/i.test(String(error))) throw error
        this.context = undefined
      }
    }
  }

  private async evaluate(contextId: number, expression: string): Promise<void> {
    const response = await within(
      this.cdp.send<{ exceptionDetails?: { text: string; exception?: { description?: string } } }>(
        'Runtime.evaluate',
        { expression, contextId, returnByValue: true }
      )
    )
    if (response.exceptionDetails) {
      const details = response.exceptionDetails
      throw new Error(details.exception?.description ?? details.text)
    }
  }
}

/**
 * Capture de la page affichée (fiches 132 et 146), sa fenêtre en pixels CSS, son défilement et son
 * zoom ; `stayHidden` : la page masquée est redessinée pour l'occasion.
 */
export async function pageSnapshot(
  contents: WebContents,
  cdp: Pick<CdpTab, 'evaluateIsolated' | 'emulation'>,
  bounds: { width: number; height: number },
  stayHidden: boolean
): Promise<(Omit<PageFreeze, 'data' | 'mimeType'> & { image: NativeImage }) | null> {
  if (!contents.getURL() || contents.getURL() === 'about:blank') return null
  const image = await contents.capturePage(undefined, { stayHidden })
  const zoom = contents.getZoomFactor()
  const viewport = cssViewport(bounds, zoom, cdp.emulation)
  const [scrollX, scrollY] = await cdp
    .evaluateIsolated<[number, number]>('[scrollX, scrollY]')
    .catch(() => [0, 0])
  return {
    image,
    url: contents.getURL(),
    title: contents.getTitle(),
    ...viewport,
    scrollX,
    scrollY,
    zoom,
    emulated: !!cdp.emulation
  }
}
