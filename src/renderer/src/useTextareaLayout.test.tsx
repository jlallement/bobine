import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTextareaLayout } from './useTextareaLayout'

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

function Zone({ text }: { text: string }) {
  const { textarea } = useTextareaLayout(text)
  return <textarea ref={textarea} value={text} readOnly data-testid="zone" />
}

/** Zone dont la hauteur de contenu dépend de la largeur : 24 px par tranche de 100 px manquants. */
function layout(el: HTMLElement, box: { width: number }) {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => box.width })
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => 24 * Math.max(1, Math.ceil(400 / box.width))
  })
}

describe('hauteur de la zone de saisie (fiches 089, 167)', () => {
  it('suit la largeur : une ligne de plus quand la zone rétrécit, sans attendre le texte', () => {
    const box = { width: 400 }
    const { getByTestId, rerender } = render(<Zone text="" />)
    const el = getByTestId('zone')
    layout(el, box)
    rerender(<Zone text="Bonjour" />)
    expect(el.style.height).toBe('24px')
    box.width = 250
    act(() => notify())
    expect(el.style.height).toBe('48px')
  })

  it('ignore les rappels sans changement de largeur (ceux de sa propre hauteur)', () => {
    const box = { width: 400 }
    const { getByTestId } = render(<Zone text="" />)
    const el = getByTestId('zone')
    layout(el, box)
    act(() => notify())
    el.style.height = '99px'
    act(() => notify())
    expect(el.style.height).toBe('99px')
  })

  it('cesse d’observer une fois la zone retirée', () => {
    const { unmount } = render(<Zone text="" />)
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
