/**
 * Onglet « Simulateur » rendu sans l'app ni AXe (fiches 008, 009, 044, 066, 084) : remplaçant des
 * vérifications de composant de la suite e2e `simulator` (inventaire B, #5, #7 à #9, #11, #14 côté
 * onglet, #15, #16, #19, #20). Le main est simulé par `window.api.simulator`. jsdom n'a ni mise en
 * page ni décodage d'image : la place de l'onglet et la boîte de l'écran sont données
 * (`clientWidth`, `getBoundingClientRect`), `createImageBitmap` et le canevas sont simulés. Le vrai
 * flux (AXe → main → canevas), le châssis dessiné et la barre sous l'appareil restent à l'e2e et
 * aux captures.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SimulatorState } from '@shared/simulator'
import { SimulatorTab } from './SimulatorTab'

const original = window.api
/** Place de la zone de l'écran : de quoi faire tenir l'appareil à 50 % environ. */
const ROOM = { width: 260, height: 520 }
const descriptors = {
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
}
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('simulator-screen') ? ROOM.width : 0
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('simulator-screen') ? ROOM.height : 0
    }
  })
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 402, height: 874, close: () => {} }))
  )
  HTMLCanvasElement.prototype.getContext = (() => ({
    drawImage: () => {}
  })) as unknown as HTMLCanvasElement['getContext']
})
afterAll(() => {
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor)
  }
  vi.unstubAllGlobals()
})
afterEach(() => {
  window.api = original
})

const DEVICE = {
  udid: 'U1',
  name: 'iPhone 17',
  state: 'Booted',
  runtime: 'iOS 26.5',
  deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17'
}
const STATE: SimulatorState = {
  conversationId: 'c1',
  device: DEVICE,
  screen: { width: 402, height: 874 },
  touch: true,
  axe: { version: '1.8.0', path: '/app/axe' }
}

/** Le main simulé : état, flux (démarré ou non), captures, gestes. */
function main(options: { stream?: boolean; state?: SimulatorState } = {}) {
  const listeners: {
    frame?: (f: { conversationId: string; data: Uint8Array }) => void
    ended?: (e: { conversationId: string; reason: string }) => void
  } = {}
  const simulator = {
    getState: vi.fn(async () => options.state ?? STATE),
    onState: () => () => {},
    onFrame: (listener: NonNullable<typeof listeners.frame>) => {
      listeners.frame = listener
      return () => {}
    },
    onStreamEnded: (listener: NonNullable<typeof listeners.ended>) => {
      listeners.ended = listener
      return () => {}
    },
    startStream: vi.fn(async () => options.stream ?? false),
    stopStream: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => ({ data: 'U0hPVA==', width: 402, height: 874 })),
    tap: vi.fn(async () => undefined),
    swipe: vi.fn(async () => undefined),
    button: vi.fn(async () => undefined)
  }
  window.api = { ...original, simulator } as unknown as Window['api']
  return {
    simulator,
    frame: () => listeners.frame?.({ conversationId: 'c1', data: new Uint8Array([1, 2, 3]) }),
    end: (reason: string) => act(() => listeners.ended?.({ conversationId: 'c1', reason }))
  }
}

function show(onAttach?: (image: unknown) => void) {
  return render(
    <Tooltip.Provider>
      <SimulatorTab conversationId="c1" {...(onAttach ? { onAttach } : {})} />
    </Tooltip.Provider>
  )
}

/** Boîte de l'écran affiché : `scale` pixels par point, décalée de `offset` (défilement). */
function placeDisplay(scale: number, offset = { x: 0, y: 0 }) {
  const display = screen.getByTestId('simulator-display')
  display.getBoundingClientRect = () =>
    ({
      left: offset.x,
      top: offset.y,
      width: 402 * scale,
      height: 874 * scale,
      right: offset.x + 402 * scale,
      bottom: offset.y + 874 * scale,
      x: offset.x,
      y: offset.y,
      toJSON: () => ({})
    }) as DOMRect
  display.setPointerCapture = () => {}
  return display
}
/**
 * Un tour de molette, puis le délai de regroupement des crans écoulé (horloges simulées) : le
 * nombre de balayages demandés.
 */
function wheelSwipes(
  display: HTMLElement,
  swipe: { mock: { calls: unknown[] } },
  at = { x: 100, y: 200 }
): number {
  vi.useFakeTimers()
  try {
    fireEvent.wheel(display, { deltaY: 200, clientX: at.x, clientY: at.y })
    act(() => void vi.advanceTimersByTime(1000))
    return swipe.mock.calls.length
  } finally {
    vi.useRealTimers()
  }
}
const click = (element: HTMLElement, x: number, y: number) => {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: x, clientY: y })
  fireEvent.pointerUp(element, { button: 0, pointerId: 1, clientX: x, clientY: y })
}

describe('onglet « Simulateur » (fiches 008, 009)', () => {
  it('appareil démarré : son nom, sa capture ; version d’AXe avant le direct', async () => {
    main()
    show()
    expect(await screen.findByTestId('simulator-screen')).toBeTruthy()
    expect(screen.getByTestId('simulator-tab').textContent).toContain('iPhone 17')
    expect(screen.getByTestId('simulator-tab').textContent).toContain('iOS 26.5')
    expect(screen.getByAltText('Écran de iPhone 17').getAttribute('src')).toBe(
      'data:image/jpeg;base64,U0hPVA=='
    )
    const axe = screen.getByText('AXe 1.8.0')
    expect(axe.parentElement?.getAttribute('title')).toContain('/app/axe')
    expect(screen.queryByTestId('simulator-fps')).toBeNull()
  })

  it('aucun appareil, ou arrêté : c’est dit, sans écran', async () => {
    main({ state: { ...STATE, device: { ...DEVICE, state: 'Shutdown' } } })
    show()
    expect((await screen.findByTestId('simulator-empty')).textContent).toContain('iPhone 17')
  })

  it('en direct : débit affiché à la place de la version d’AXe, qui passe en infobulle', async () => {
    const app = main({ stream: true })
    show()
    await waitFor(() => expect(screen.getByTestId('simulator-live')).toBeTruthy())
    // Des images arrivent : la vidéo remplace la capture, le débit se mesure chaque seconde.
    const pump = setInterval(() => app.frame(), 50)
    try {
      const fps = await screen.findByTestId('simulator-fps', {}, { timeout: 2500 })
      expect(fps.textContent).toMatch(/^\d+ fps$/)
      expect(fps.getAttribute('title')).toBe('Images dessinées par seconde (AXe 1.8.0)')
      expect(screen.queryByText('AXe 1.8.0')).toBeNull()
      expect(screen.getByTestId('simulator-video').classList.contains('hidden')).toBe(false)
    } finally {
      clearInterval(pump)
    }
  })

  it('flux interrompu : la raison est dite, et les captures successives reprennent', async () => {
    const app = main({ stream: true })
    show()
    await waitFor(() => expect(screen.getByTestId('simulator-live')).toBeTruthy())
    // Une capture a pu partir avant que le flux ne réponde ; en direct, plus aucune.
    const before = app.simulator.screenshot.mock.calls.length
    vi.useFakeTimers()
    try {
      act(() => void vi.advanceTimersByTime(5000))
      expect(app.simulator.screenshot).toHaveBeenCalledTimes(before)
    } finally {
      vi.useRealTimers()
    }
    app.end('Simulator device disconnected')
    expect(screen.queryByTestId('simulator-live')).toBeNull()
    expect(
      screen.getByText(
        'Flux vidéo interrompu (Simulator device disconnected) : captures successives.'
      )
    ).toBeTruthy()
    await waitFor(() => expect(app.simulator.screenshot.mock.calls.length).toBeGreaterThan(before))
    expect(await screen.findByTestId('simulator-screen')).toBeTruthy()
  })

  it('« Joindre au message » : l’écran part dans la zone de saisie', async () => {
    const app = main()
    const onAttach = vi.fn()
    show(onAttach)
    fireEvent.click(await screen.findByTestId('simulator-attach'))
    await waitFor(() =>
      expect(onAttach).toHaveBeenCalledWith({
        kind: 'image',
        name: 'Simulateur iPhone 17.jpg',
        mimeType: 'image/jpeg',
        data: 'U0hPVA=='
      })
    )
    expect(app.simulator.screenshot).toHaveBeenCalledWith('c1')
  })
})

describe('onglet « Simulateur » : châssis, zoom et gestes (fiches 044, 084)', () => {
  it('iPhone récent : châssis sans bouton d’accueil ; zoom « ajuster » au départ, niveau affiché', async () => {
    main()
    show()
    const device = await screen.findByTestId('simulator-device')
    expect(device.hasAttribute('data-home-button')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Accueil', hidden: false })).toBeTruthy()
    expect(screen.getByTestId('simulator-zoom-fit').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('simulator-zoom-level').textContent).toMatch(/^\d+\s%$/)
    expect(screen.getByTestId('simulator-stage').classList.contains('zoomed')).toBe(false)
  })

  it('clic sur l’écran : toucher au point correspondant, à l’échelle affichée', async () => {
    const app = main()
    show()
    await screen.findByTestId('simulator-device')
    const display = placeDisplay(0.5)
    click(display, 100.5, 218.5)
    await waitFor(() => expect(app.simulator.tap).toHaveBeenCalledWith('c1', 201, 437))
  })

  it('zoomé et défilé : un clic touche le point vu ; la molette ne fait pas défiler l’app', async () => {
    const app = main()
    show()
    await screen.findByTestId('simulator-device')
    fireEvent.click(screen.getByTestId('simulator-zoom-in'))
    expect(screen.getByTestId('simulator-stage').classList.contains('zoomed')).toBe(true)
    expect(screen.getByTestId('simulator-zoom-fit').getAttribute('aria-pressed')).toBe('false')
    // Agrandi à 2 pixels par point, la vue défilée de 300 × 600 pixels.
    const display = placeDisplay(2, { x: -300, y: -600 })
    click(display, 100, 200)
    await waitFor(() => expect(app.simulator.tap).toHaveBeenCalledWith('c1', 200, 400))
    expect(wheelSwipes(display, app.simulator.swipe)).toBe(0)
  })

  it('« ajuster » : la molette fait défiler l’app (balayage court au pointeur)', async () => {
    const app = main()
    show()
    await screen.findByTestId('simulator-device')
    const display = placeDisplay(0.5)
    // Contre-épreuve du test d'avant : la même mesure voit bien le balayage ici.
    expect(wheelSwipes(display, app.simulator.swipe, { x: 100, y: 218 })).toBe(1)
    const [, from, to] = app.simulator.swipe.mock.calls[0] as unknown as [
      string,
      { x: number; y: number },
      { x: number; y: number }
    ]
    expect(from.x).toBeCloseTo(200)
    expect(to.y).toBeLessThan(from.y)
  })
})
