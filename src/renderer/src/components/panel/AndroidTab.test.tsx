/**
 * Onglet « Android » rendu sans l'app ni SDK (fiches 032, 081, 084) : remplaçant des vérifications
 * de composant de la suite e2e `android` (inventaire B, #8, #9, #12, #15, #16, #22, #25). Le main
 * est simulé par `window.api.android`. jsdom n'a ni mise en page ni WebCodecs : la place de
 * l'onglet et la boîte de l'écran sont données ; sans `VideoDecoder`, l'onglet reste aux captures.
 * La vidéo H.264, la rotation relevée en continu et les processus d'`adb` restent à l'e2e.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AndroidState } from '@shared/android'
import { AndroidTab } from './AndroidTab'

const original = window.api
const ROOM = { width: 300, height: 560 }
const descriptors = {
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
}
beforeAll(() => {
  for (const [name, size] of [
    ['clientWidth', ROOM.width],
    ['clientHeight', ROOM.height]
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('simulator-screen') ? size : 0
      }
    })
  }
})
afterAll(() => {
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor)
  }
})
afterEach(() => {
  window.api = original
})

const PORTRAIT_SCREEN = { width: 412, height: 915 }
const LANDSCAPE_SCREEN = { width: 915, height: 412 }
const PORTRAIT: AndroidState = {
  conversationId: 'c1',
  device: { serial: 'emulator-5554', name: 'Pixel_9', state: 'device' },
  screen: PORTRAIT_SCREEN,
  rotation: 0,
  sdk: true
}
const LANDSCAPE: AndroidState = { ...PORTRAIT, screen: LANDSCAPE_SCREEN, rotation: 1 }

function main(state: AndroidState = PORTRAIT) {
  const android = {
    getState: vi.fn(async () => state),
    onState: () => () => {},
    onFrame: () => () => {},
    onStreamEnded: () => () => {},
    startStream: vi.fn(async () => false),
    stopStream: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => ({ data: 'U0hPVA==', width: 412, height: 915 })),
    tap: vi.fn(async () => undefined),
    swipe: vi.fn(async () => undefined),
    key: vi.fn(async () => undefined)
  }
  window.api = { ...original, android } as unknown as Window['api']
  render(
    <Tooltip.Provider>
      <AndroidTab conversationId="c1" />
    </Tooltip.Provider>
  )
  return android
}

/** Boîte de l'écran affiché : `scale` pixels par dp, décalée de `offset` (défilement). */
function placeDisplay(
  size: { width: number; height: number },
  scale: number,
  offset = { x: 0, y: 0 }
) {
  const display = screen.getByTestId('android-display')
  display.getBoundingClientRect = () =>
    ({
      left: offset.x,
      top: offset.y,
      width: size.width * scale,
      height: size.height * scale,
      right: offset.x + size.width * scale,
      bottom: offset.y + size.height * scale,
      x: offset.x,
      y: offset.y,
      toJSON: () => ({})
    }) as DOMRect
  display.setPointerCapture = () => {}
  return display
}
const click = (element: HTMLElement, x: number, y: number) => {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: x, clientY: y })
  fireEvent.pointerUp(element, { button: 0, pointerId: 1, clientX: x, clientY: y })
}

describe('onglet « Android » (fiches 032, 081, 084)', () => {
  it('bouton Retour du panneau : KEYCODE_BACK ; volume de la tranche : volume_up', async () => {
    const android = main()
    await screen.findByTestId('android-device')
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }))
    expect(android.key).toHaveBeenCalledWith('c1', 'back')
    fireEvent.click(screen.getByTestId('android-volume_up'))
    expect(android.key).toHaveBeenCalledWith('c1', 'volume_up')
  })

  it('zoom : « ajuster » au départ, niveau affiché ; cadre de téléphone en portrait', async () => {
    main()
    const device = await screen.findByTestId('android-device')
    expect(device.dataset['kind']).toBe('phone')
    expect(device.dataset['rotation']).toBe('0')
    expect(screen.getByTestId('android-zoom-fit').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('android-zoom-level').textContent).toMatch(/^\d+\s%$/)
    expect(screen.getByTestId('android-stage').classList.contains('zoomed')).toBe(false)
  })

  it('clic au centre de l’écran : toucher au centre, en dp', async () => {
    const android = main()
    await screen.findByTestId('android-device')
    const display = placeDisplay(PORTRAIT_SCREEN, 0.5)
    click(display, 103, 228.75)
    await waitFor(() => expect(android.tap).toHaveBeenCalledWith('c1', 206, 457.5, undefined))
  })

  it('zoomé et défilé : un clic touche le point vu ; la molette déplace la vue, sans balayage', async () => {
    const android = main()
    await screen.findByTestId('android-device')
    fireEvent.click(screen.getByTestId('android-zoom-in'))
    expect(screen.getByTestId('android-stage').classList.contains('zoomed')).toBe(true)
    const display = placeDisplay(PORTRAIT_SCREEN, 2, { x: -200, y: -400 })
    click(display, 212, 515)
    await waitFor(() => expect(android.tap).toHaveBeenCalledWith('c1', 206, 457.5, undefined))
    // Délai de regroupement des crans de la molette écoulé (horloges simulées) : aucun balayage.
    vi.useFakeTimers()
    try {
      fireEvent.wheel(display, { deltaY: 200, clientX: 212, clientY: 515 })
      act(() => void vi.advanceTimersByTime(1000))
      expect(android.swipe).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
    // Contre-épreuve : revenu à « ajuster », la même molette fait défiler l'app.
    fireEvent.click(screen.getByTestId('android-zoom-fit'))
    const fitted = placeDisplay(PORTRAIT_SCREEN, 0.5)
    vi.useFakeTimers()
    try {
      fireEvent.wheel(fitted, { deltaY: 200, clientX: 103, clientY: 228 })
      act(() => void vi.advanceTimersByTime(1000))
      expect(android.swipe).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('paysage : cadre tourné ; clic au quart, toucher au quart dans l’orientation courante', async () => {
    const android = main(LANDSCAPE)
    const device = await screen.findByTestId('android-device')
    expect(device.dataset['rotation']).toBe('1')
    const display = placeDisplay(LANDSCAPE_SCREEN, 0.25)
    click(display, (915 * 0.25) / 4, (412 * 0.25) / 4)
    await waitFor(() => expect(android.tap).toHaveBeenCalledWith('c1', 228.75, 103, undefined))
  })
})
