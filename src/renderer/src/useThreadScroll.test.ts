import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useThreadScroll } from './useThreadScroll'

/** Élément qui défile, avec des dimensions choisies (jsdom n'en calcule pas). */
function fakeScroller() {
  const el = document.createElement('div')
  el.appendChild(document.createElement('div'))
  const box = { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 }
  Object.defineProperties(el, {
    scrollHeight: { get: () => box.scrollHeight },
    clientHeight: { get: () => box.clientHeight },
    scrollTop: {
      get: () => box.scrollTop,
      set: (value: number) => {
        box.scrollTop = value
      }
    }
  })
  const scrollTo = vi.fn()
  el.scrollTo = scrollTo as typeof el.scrollTo
  return { el, box, scrollTo }
}

let resize: (() => void) | undefined
const observed: Element[] = []

beforeEach(() => {
  observed.length = 0
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe(el: Element) {
        observed.push(el)
      }
      disconnect() {}
    }
  )
})
afterEach(() => vi.unstubAllGlobals())

function setup() {
  const scroller = fakeScroller()
  const hook = renderHook(
    (props: { conversation: string | null; items: unknown[]; empty: boolean }) => {
      const thread = useThreadScroll(props)
      thread.scroller.current = scroller.el
      return thread
    },
    { initialProps: { conversation: 'c1', items: [1], empty: false } }
  )
  /** L'utilisateur fait défiler le fil jusqu'à `top`. */
  const userScroll = (top: number) => {
    scroller.box.scrollTop = top
    act(() => hook.result.current.onScroll())
  }
  return { ...scroller, ...hook, userScroll }
}

describe('suivi du bas du fil (fiche 050)', () => {
  it('le fil s’ouvre en bas, sans flèche ; le fil et son contenu sont observés', () => {
    const { box, el, result } = setup()
    expect(box.scrollTop).toBe(1000)
    expect(result.current.atBottom).toBe(true)
    expect(observed).toEqual([el, el.firstElementChild])
  })

  it('remonté : la flèche se montre, le fil ne suit plus ce qui arrive', () => {
    const { box, result, rerender, userScroll } = setup()
    userScroll(400)
    expect(result.current.atBottom).toBe(false)
    box.scrollHeight = 1500
    rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(box.scrollTop).toBe(400)
    expect(result.current.atBottom).toBe(false)
  })

  it('redescendu près du bas : il suit à nouveau', () => {
    const { box, result, rerender, userScroll } = setup()
    userScroll(400)
    userScroll(760)
    expect(result.current.atBottom).toBe(true)
    box.scrollHeight = 1500
    rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(box.scrollTop).toBe(1500)
  })

  it('un décalage vers le bas (contenu grandi au-dessus) ne décroche pas', () => {
    const { box, result, rerender, userScroll } = setup()
    box.scrollHeight = 1500
    userScroll(1100)
    expect(result.current.atBottom).toBe(true)
    rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(box.scrollTop).toBe(1500)
  })

  it('autre conversation : elle s’ouvre en bas, même si on avait remonté', () => {
    const { box, rerender, userScroll } = setup()
    userScroll(100)
    rerender({ conversation: 'c2', items: [3], empty: false })
    expect(box.scrollTop).toBe(1000)
  })

  it('fil qui change de taille : on reste en bas si on y était', () => {
    const { box, result } = setup()
    box.scrollHeight = 1300
    act(() => resize?.())
    expect(box.scrollTop).toBe(1300)
    expect(result.current.atBottom).toBe(true)
  })

  it('« Aller en bas » : défilement doux, et le suivi reprend', () => {
    const { box, result, rerender, scrollTo, userScroll } = setup()
    userScroll(100)
    act(() => result.current.scrollToBottom())
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
    box.scrollHeight = 1200
    rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(box.scrollTop).toBe(1200)
  })

  it('pointeur sur une carte qui le demande : le fil ne suit plus, puis rattrape le bas (fiche 124)', () => {
    const { box, el, result, rerender } = setup()
    document.body.append(el)
    const card = document.createElement('div')
    card.setAttribute('data-scroll-hold', '')
    const row = document.createElement('button')
    card.append(row)
    el.firstElementChild?.append(card)
    const other = document.createElement('p')
    el.firstElementChild?.append(other)
    expect(box.scrollTop).toBe(1000)

    // Pointeur sur une ligne de la carte : une proposition arrive, le fil grandit, rien ne bouge.
    act(() => row.dispatchEvent(new Event('pointerover', { bubbles: true })))
    box.scrollHeight = 1100
    rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(box.scrollTop).toBe(1000)
    box.scrollHeight = 1200
    act(() => resize?.())
    expect(box.scrollTop).toBe(1000)
    // Le suivi n'est pas perdu : pas de flèche « Aller en bas » pour autant.
    expect(result.current.atBottom).toBe(true)

    // Pointeur sorti de la carte (ailleurs dans le fil) : le fil rattrape le bas.
    act(() => other.dispatchEvent(new Event('pointerover', { bubbles: true })))
    expect(box.scrollTop).toBe(1200)

    // Pointeur sorti de la fenêtre depuis la carte : pareil.
    act(() => row.dispatchEvent(new Event('pointerover', { bubbles: true })))
    box.scrollHeight = 1300
    rerender({ conversation: 'c1', items: [1, 2, 3], empty: false })
    expect(box.scrollTop).toBe(1200)
    act(() => row.dispatchEvent(new Event('pointerout', { bubbles: true })))
    expect(box.scrollTop).toBe(1300)
    el.remove()
  })

  it('message envoyé fil remonté : retour en bas tout de suite, la bulle et la réponse suivies (D26)', () => {
    const { box, el, result, rerender, scrollTo, userScroll } = setup()
    userScroll(300)
    expect(result.current.atBottom).toBe(false)
    act(() => result.current.followSent())
    // Saut immédiat (pas un défilement doux qui laisserait la bulle hors de vue un instant).
    expect(box.scrollTop).toBe(1000)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(result.current.atBottom).toBe(true)
    // La bulle envoyée arrive, puis la réponse : le fil les suit.
    box.scrollHeight = 1100
    rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(box.scrollTop).toBe(1100)
    box.scrollHeight = 1400
    rerender({ conversation: 'c1', items: [1, 2, 3], empty: false })
    expect(box.scrollTop).toBe(1400)
    // Remonter pour lire reste possible : la flèche revient.
    userScroll(500)
    expect(result.current.atBottom).toBe(false)

    // Envoyé au clavier, pointeur posé sur une carte qui retient le fil : l'envoi l'emporte.
    document.body.append(el)
    const card = document.createElement('div')
    card.setAttribute('data-scroll-hold', '')
    el.firstElementChild?.append(card)
    act(() => card.dispatchEvent(new Event('pointerover', { bubbles: true })))
    act(() => result.current.followSent())
    box.scrollHeight = 1500
    rerender({ conversation: 'c1', items: [1, 2, 3, 4], empty: false })
    expect(box.scrollTop).toBe(1500)
    el.remove()
  })
})
