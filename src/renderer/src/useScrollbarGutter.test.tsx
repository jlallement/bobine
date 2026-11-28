import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollbarGutter } from './useScrollbarGutter'

/** ResizeObserver factice : on déclenche son rappel à la main. */
let notify: () => void = () => {}
const disconnect = vi.fn()
const originalObserver = globalThis.ResizeObserver

beforeEach(() => {
  disconnect.mockReset()
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      notify = callback
    }
    observe() {}
    unobserve() {}
    disconnect = disconnect
  } as unknown as typeof ResizeObserver
})
afterEach(() => {
  globalThis.ResizeObserver = originalObserver
})

/** Volet : la zone qui défile (largeur et largeur utile réglables), puis la colonne de la saisie. */
const box = { width: 900, client: 900 }
function Pane() {
  const scroller = useRef<HTMLDivElement>(null)
  useScrollbarGutter(scroller)
  return (
    <section data-testid="pane">
      <div
        className="scroll"
        ref={(el) => {
          if (!el) return
          Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => box.width })
          Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => box.client })
          scroller.current = el
        }}
      />
    </section>
  )
}

describe('gouttière de la barre du fil (fiche 294)', () => {
  it('barres superposées : 0 px ; barre classique : sa largeur, posée sur le volet', () => {
    box.width = 900
    box.client = 900
    const { getByTestId } = render(<Pane />)
    const pane = getByTestId('pane')
    expect(pane.style.getPropertyValue('--thread-scrollbar')).toBe('0px')
    box.client = 885
    act(() => notify())
    expect(pane.style.getPropertyValue('--thread-scrollbar')).toBe('15px')
  })

  it('retirée avec la zone, et plus d’observation', () => {
    const { getByTestId, unmount } = render(<Pane />)
    const pane = getByTestId('pane')
    unmount()
    expect(disconnect).toHaveBeenCalled()
    expect(pane.style.getPropertyValue('--thread-scrollbar')).toBe('')
  })
})
