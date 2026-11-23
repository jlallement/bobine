import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useBarFold } from './useBarFold'

/** ResizeObserver factice : on déclenche son rappel à la main, hors de React (comme le navigateur). */
let notify: () => void = () => {}
const originalObserver = globalThis.ResizeObserver

beforeEach(() => {
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      notify = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})
afterEach(() => {
  globalThis.ResizeObserver = originalObserver
})

function Bar() {
  const [bar, fold] = useBarFold()
  return <div ref={bar} data-fold={fold} data-testid="bar" />
}

/** Barre de `box.width` px dont le contenu fait 300 px dépliée, 200 px dès le premier repli. */
function layout(el: HTMLElement, box: { width: number }) {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => box.width })
  Object.defineProperty(el, 'scrollWidth', {
    configurable: true,
    get: () => (el.dataset.fold === '0' ? 300 : 200)
  })
}

describe('repli de la barre de saisie, à l’écran (fiche 250)', () => {
  it('le niveau mesuré est posé sur la barre dès la mesure, sans attendre le rendu de React', () => {
    render(<Bar />)
    const bar = screen.getByTestId('bar')
    const box = { width: 400 }
    layout(bar, box)
    notify()
    expect(bar.dataset.fold).toBe('0')
    // Fenêtre rétrécie : l'observateur passe avant la peinture, React rend plus tard.
    box.width = 250
    notify()
    expect(bar.dataset.fold).toBe('1')
    box.width = 400
    notify()
    expect(bar.dataset.fold).toBe('0')
  })
})
