// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LAYER_BINDING,
  LAYER_SCRIPT,
  LAYER_WORLD,
  PageLayer,
  parseLayerMessage,
  parsePins,
  parseTheme
} from './page-layer'

interface Layer {
  start: (theme: unknown) => boolean
  stop: () => boolean
  pins: (list: unknown[]) => boolean
  hide: () => boolean
  show: () => boolean
}

const scope = globalThis as unknown as Record<string, unknown>

describe('script de la page en mode Annoter (fiche 146)', () => {
  let sent: unknown[]
  let shadows: ShadowRoot[]
  let layer: Layer
  const attach = Element.prototype.attachShadow

  beforeEach(() => {
    sent = []
    shadows = []
    scope[LAYER_BINDING] = (payload: string) => sent.push(JSON.parse(payload))
    // jsdom n'a pas `CSS.escape`, que la description de l'élément utilise.
    scope['CSS'] ??= { escape: (s: string) => s }
    // Les racines fermées sont gardées pour les lire ici.
    Element.prototype.attachShadow = function (init: ShadowRootInit) {
      const root = attach.call(this, init)
      shadows.push(root)
      return root
    }
    document.body.innerHTML =
      '<button id="cible">Cible</button><input placeholder="Rechercher" value="secret">'
    delete scope['__bobineLayer']
    ;(0, eval)(LAYER_SCRIPT)
    layer = scope['__bobineLayer'] as Layer
    layer.start({ accent: 'red', surface: 'white', text: 'black', border: 'gray' })
  })

  afterEach(() => {
    layer.stop()
    Element.prototype.attachShadow = attach
  })

  const click = (target: Element, x = 30, y = 40) =>
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0
      })
    )

  it('le clic n’atteint pas la page : il devient une remarque, élément décrit', () => {
    const button = document.getElementById('cible') as HTMLButtonElement
    const onPage = vi.fn()
    button.addEventListener('click', onPage)
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 30,
      clientY: 40
    })
    button.dispatchEvent(event)
    expect(onPage).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    expect(sent).toHaveLength(1)
    const message = sent[0] as Record<string, unknown>
    expect(message['kind']).toBe('place')
    expect(message['id']).toMatch(/^n[a-z0-9]+$/)
    expect(message['point']).toEqual({ x: 30, y: 40 })
    expect(message['element']).toMatchObject({
      tag: 'button',
      selector: 'button#cible',
      text: 'Cible'
    })
    expect(message['pins']).toEqual({ [message['id'] as string]: { x: 30, y: 40 } })
  })

  it('champ de saisie : son libellé, jamais sa valeur ; mousedown arrêté aussi', () => {
    const field = document.querySelector('input') as HTMLInputElement
    const onDown = vi.fn()
    field.addEventListener('mousedown', onDown)
    field.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(onDown).not.toHaveBeenCalled()
    click(field)
    const element = (sent[0] as { element: Record<string, unknown> }).element
    expect(element).toMatchObject({ field: true, label: 'Rechercher', text: '' })
    expect(JSON.stringify(sent)).not.toContain('secret')
  })

  it('épingles dessinées dans une racine fermée ; un clic sur l’une rouvre sa remarque', () => {
    layer.pins([{ id: 'na1', n: 1, text: 'Trop petit', doc: { x: 30, y: 40 } }])
    const root = shadows[0] as ShadowRoot
    const pin = root.querySelector('.pin') as HTMLButtonElement
    expect(pin.textContent).toBe('1')
    expect(pin.style.left).toBe('30px')
    expect(root.querySelector('.bubble')?.textContent).toBe('Trop petit')
    const onPage = vi.fn()
    document.addEventListener('click', onPage)
    pin.click()
    expect(onPage).not.toHaveBeenCalled()
    expect(sent).toEqual([{ kind: 'open', id: 'na1', pins: { na1: { x: 30, y: 40 } } }])
    document.removeEventListener('click', onPage)
  })

  it('page zoomée : épingles et bulles gardent leur taille à l’écran', () => {
    layer.pins([{ id: 'na1', n: 1, text: 'Trop petit', doc: { x: 30, y: 40 } }])
    ;(scope['__bobineLayer'] as Layer & { zoom: (z: number) => boolean }).zoom(2)
    layer.pins([{ id: 'na1', n: 1, text: 'Trop petit', doc: { x: 30, y: 40 } }])
    const root = shadows[0] as ShadowRoot
    expect((root.querySelector('.box') as HTMLElement).style.zoom).toBe('0.5')
    // Unités de la boîte réduite de moitié : le point CSS (30, 40) s'écrit (60, 80).
    expect((root.querySelector('.pin') as HTMLElement).style.left).toBe('60px')
  })

  it('caché le temps d’une capture, puis rendu ; arrêté, la page reçoit de nouveau ses clics', () => {
    const host = document.querySelector('bobine-notes') as HTMLElement
    expect(host).not.toBeNull()
    layer.hide()
    expect(host.style.display).toBe('none')
    layer.show()
    expect(host.style.display).toBe('')
    layer.stop()
    expect(document.querySelector('bobine-notes')).toBeNull()
    const onPage = vi.fn()
    const button = document.getElementById('cible') as HTMLButtonElement
    button.addEventListener('click', onPage)
    click(button)
    expect(onPage).toHaveBeenCalled()
    expect(sent).toEqual([])
  })
})

describe('messages et paramètres vérifiés (fiche 146)', () => {
  it('messages de la page : clic, épingle ; le reste ignoré', () => {
    const place = {
      kind: 'place',
      id: 'nab12',
      point: { x: 1, y: 2 },
      doc: { x: 1, y: 502 },
      element: { tag: 'button', selector: 'b', text: 'x'.repeat(900), field: 'oui', label: 3 },
      pins: { nab12: { x: 1, y: 2 }, 'mauvais id!': { x: 1, y: 1 }, nok: { x: 'a', y: 1 } }
    }
    expect(parseLayerMessage(JSON.stringify(place))).toEqual({
      kind: 'place',
      id: 'nab12',
      point: { x: 1, y: 2 },
      doc: { x: 1, y: 502 },
      element: { tag: 'button', selector: 'b', text: 'x'.repeat(400), field: false, label: '' },
      pins: { nab12: { x: 1, y: 2 } }
    })
    expect(parseLayerMessage(JSON.stringify({ kind: 'open', id: 'n1', pins: null }))).toEqual({
      kind: 'open',
      id: 'n1',
      pins: {}
    })
    expect(parseLayerMessage('pas du json')).toBeNull()
    expect(parseLayerMessage(JSON.stringify({ kind: 'open', id: '<img>' }))).toBeNull()
    expect(
      parseLayerMessage(JSON.stringify({ kind: 'place', id: 'n1', point: { x: 1 } }))
    ).toBeNull()
    expect(parseLayerMessage(JSON.stringify({ kind: 'navigate', id: 'n1' }))).toBeNull()
  })

  it('épingles et couleurs du renderer', () => {
    expect(parsePins([{ id: 'n1', n: 1.2, text: 'a', doc: { x: 1, y: 2 } }])).toEqual([
      { id: 'n1', n: 1, text: 'a', doc: { x: 1, y: 2 } }
    ])
    expect(() => parsePins('x')).toThrow('pins')
    expect(() => parsePins([{ id: 'n1', n: 1, text: 3, doc: { x: 1, y: 2 } }])).toThrow('pins')
    const theme = { accent: '#c96442', surface: 'rgb(255 255 255)', text: '#111', border: '#ddd' }
    expect(parseTheme(theme)).toEqual(theme)
    expect(() => parseTheme({ ...theme, accent: 'red; } body { display: none' })).toThrow('theme')
  })
})

describe('couche d’un onglet (fiche 146)', () => {
  const fakeCdp = () => {
    let next = 7
    const calls: { method: string; params: Record<string, unknown> }[] = []
    const lost = new Set<number>()
    const send = vi.fn(async (method: string, params: Record<string, unknown> = {}) => {
      calls.push({ method, params })
      if (method === 'Page.getFrameTree') return { frameTree: { frame: { id: 'F' } } }
      if (method === 'Page.createIsolatedWorld') return { executionContextId: next++ }
      if (method === 'Runtime.evaluate' && lost.has(params['contextId'] as number)) {
        throw new Error('Cannot find context with specified id')
      }
      return {}
    })
    return { cdp: { send } as never, calls, lost }
  }
  const evaluated = (calls: { method: string; params: Record<string, unknown> }[]) =>
    calls
      .filter((c) => c.method === 'Runtime.evaluate')
      .map((c) => String(c.params['expression']).slice(0, 30))

  it('mode Annoter : monde isolé, binding limité à ce monde, script, puis départ', async () => {
    const { cdp, calls } = fakeCdp()
    const layer = new PageLayer(cdp, () => {})
    await layer.set(true, { accent: 'red', surface: 'white', text: 'black', border: 'gray' })
    expect(calls.map((c) => c.method).slice(0, 3)).toEqual([
      'Page.getFrameTree',
      'Page.createIsolatedWorld',
      'Runtime.addBinding'
    ])
    expect(calls[1]?.params).toMatchObject({ frameId: 'F', worldName: LAYER_WORLD })
    expect(calls[2]?.params).toEqual({ name: LAYER_BINDING, executionContextName: LAYER_WORLD })
    expect(evaluated(calls)).toEqual([LAYER_SCRIPT.slice(0, 30), '__bobineLayer.zoom(1) && __bob'])
    expect(layer.annotating).toBe(true)
  })

  it('messages : seulement du binding de la couche, depuis son monde, en mode Annoter', async () => {
    const { cdp } = fakeCdp()
    const received = vi.fn()
    const layer = new PageLayer(cdp, received)
    const message = JSON.stringify({ kind: 'open', id: 'n1', pins: {} })
    layer.binding(LAYER_BINDING, message, 7)
    await layer.set(true)
    layer.binding('autre', message, 7)
    layer.binding(LAYER_BINDING, message, 99)
    layer.binding(LAYER_BINDING, message, 7)
    expect(received).toHaveBeenCalledTimes(1)
    await layer.set(false)
    layer.binding(LAYER_BINDING, message, 7)
    expect(received).toHaveBeenCalledTimes(1)
  })

  it('nouveau document : le monde est recréé et le mode revient ; contexte perdu : recréé', async () => {
    const { cdp, calls, lost } = fakeCdp()
    const layer = new PageLayer(cdp, () => {})
    await layer.set(true)
    layer.navigated()
    await layer.documentReady()
    expect(calls.filter((c) => c.method === 'Page.createIsolatedWorld')).toHaveLength(2)
    lost.add(8)
    await layer.pins([{ id: 'n1', n: 1, text: '', doc: { x: 0, y: 0 } }])
    expect(calls.filter((c) => c.method === 'Page.createIsolatedWorld')).toHaveLength(3)
    expect(evaluated(calls).at(-1)).toBe('__bobineLayer.pins([{"id":"n1"')
  })

  it('capture propre : le script caché pendant la capture, rendu même si elle échoue', async () => {
    const { cdp, calls } = fakeCdp()
    const layer = new PageLayer(cdp, () => {})
    expect(await layer.hidden(async () => 'sans mode')).toBe('sans mode')
    await layer.set(true)
    await expect(
      layer.hidden(async () => {
        expect(evaluated(calls).at(-1)).toBe('__bobineLayer.hide()')
        throw new Error('capture')
      })
    ).rejects.toThrow('capture')
    expect(evaluated(calls).at(-1)).toBe('__bobineLayer.show()')
  })
})
