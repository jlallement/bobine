import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useThreadScroll } from './useThreadScroll'

/** Élément qui défile, avec des dimensions choisies (jsdom n'en calcule pas). */
function fakeScroller() {
  const el = document.createElement('div')
  el.appendChild(document.createElement('div'))
  const box = { scrollHeight: 1000, clientHeight: 200, scrollTop: 0 }
  Object.defineProperties(el, {
    scrollHeight: { get: () => box.scrollHeight, configurable: true },
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

  it('remonté sans que l’événement « scroll » soit encore arrivé : rien ne le ramène en bas (fiche 270)', () => {
    const { box, el, result } = setup()
    document.body.append(el)
    const card = document.createElement('div')
    card.setAttribute('data-scroll-hold', '')
    el.firstElementChild?.append(card)
    const other = document.createElement('p')
    el.firstElementChild?.append(other)
    expect(box.scrollTop).toBe(1000)
    // Pointeur sur la carte ; le fil remonte (molette, essai), le contenu glisse sous le pointeur
    // qui en sort, avant l'événement « scroll » de l'image suivante.
    act(() => card.dispatchEvent(new Event('pointerover', { bubbles: true })))
    box.scrollTop = 0
    act(() => other.dispatchEvent(new Event('pointerover', { bubbles: true })))
    expect(box.scrollTop).toBe(0)
    expect(result.current.atBottom).toBe(false)
    el.remove()

    // Même chose quand un élément arrive, ou que le fil change de taille, dans cet intervalle.
    const again = setup()
    again.box.scrollTop = 100
    again.box.scrollHeight = 1200
    again.rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(again.box.scrollTop).toBe(100)
    again.box.scrollTop = 50
    act(() => resize?.())
    expect(again.box.scrollTop).toBe(50)
    expect(again.result.current.atBottom).toBe(false)
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

  it('envoyé depuis une carte, pointeur immobile (fiche 272, recette) : la réponse est suivie', () => {
    const { box, el, result, rerender } = setup()
    document.body.append(el)
    const card = document.createElement('div')
    card.setAttribute('data-scroll-hold', '')
    el.firstElementChild?.append(card)
    const fire = (type: string, x: number) =>
      card.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: 40 }))
    // Entrée dans la carte à gauche, puis clic sur « Demander à … de corriger » plus à droite.
    act(() => fire('pointerover', 20))
    act(() => fire('pointermove', 120))
    act(() => fire('pointerdown', 120))
    act(() => result.current.followSent())
    // Le saut en bas fait passer une carte sous le pointeur immobile : Chromium le signale.
    act(() => fire('pointerover', 120))
    box.scrollHeight = 1800
    rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(box.scrollTop).toBe(1800)
    expect(result.current.atBottom).toBe(true)
    // Un vrai mouvement sur la carte la retient de nouveau (fiche 124).
    act(() => fire('pointermove', 130))
    act(() => fire('pointerover', 130))
    box.scrollHeight = 2000
    rerender({ conversation: 'c1', items: [1, 2, 3], empty: false })
    expect(box.scrollTop).toBe(1800)
    el.remove()
  })

  it('sans envoi, une carte qui arrive sous un pointeur immobile retient le fil (fiche 124)', () => {
    const { box, el, rerender } = setup()
    document.body.append(el)
    const card = document.createElement('div')
    card.setAttribute('data-scroll-hold', '')
    el.firstElementChild?.append(card)
    act(() => {
      document.body.dispatchEvent(
        new MouseEvent('pointermove', { bubbles: true, clientX: 60, clientY: 40 })
      )
    })
    // La carte arrive sous le pointeur, qui n'a pas bougé : Chromium signale l'entrée.
    act(() => {
      card.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, clientX: 60, clientY: 40 }))
    })
    box.scrollHeight = 1500
    rerender({ conversation: 'c1', items: [1, 2], empty: false })
    expect(box.scrollTop).toBe(1000)
    el.remove()
  })
})

describe('clic commencé dans le fil (fiche 250)', () => {
  /**
   * Fil près du bas, avec ce que fait le navigateur quand son contenu rétrécit : le défilement est
   * borné à la nouvelle hauteur, que la hauteur minimale de la colonne (l'élément contenu) relève.
   */
  function clampingThread() {
    const thread = setup()
    const column = thread.el.firstElementChild as HTMLElement
    const content = { height: 1000 }
    // La colonne commence 52 px sous le haut du contenu qui défile (un bandeau au-dessus d'elle).
    const above = 52
    vi.spyOn(thread.el, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
    vi.spyOn(column, 'getBoundingClientRect').mockImplementation(
      () => ({ top: 100 + above - thread.box.scrollTop }) as DOMRect
    )
    const reserved = () => parseFloat(column.style.minHeight) || 0
    const height = () => Math.max(content.height, above + reserved())
    Object.defineProperty(thread.el, 'scrollHeight', { get: height })
    /** La fin d'un tour : le bas du fil perd `px` pixels. */
    const shrink = (px: number) => {
      content.height -= px
      thread.box.scrollTop = Math.min(thread.box.scrollTop, height() - thread.box.clientHeight)
    }
    // Le fil s'est ouvert en bas ; le navigateur borne le `scrollTop = scrollHeight` du suivi.
    shrink(0)
    const button = document.createElement('button')
    column.append(button)
    document.body.append(thread.el)
    return { ...thread, column, button, shrink }
  }
  const press = (target: Element, type: string) =>
    act(() => {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 60, clientY: 150 }))
    })

  it('le bas qui rétrécit entre l’appui et le relâché ne déplace pas le fil sous le pointeur', () => {
    vi.useFakeTimers()
    try {
      const { box, el, column, button, shrink } = clampingThread()
      expect(box.scrollTop).toBe(800)
      press(button, 'pointerdown')
      // Rien ne bouge à l'appui : la hauteur réservée est celle du moment.
      expect(column.style.minHeight).toBe('948px')
      expect(el.scrollHeight).toBe(1000)
      shrink(20)
      expect(box.scrollTop).toBe(800)
      press(button, 'pointerup')
      // Le `click` part après `pointerup`, dans la même tâche : la hauteur tient encore.
      expect(column.style.minHeight).toBe('948px')
      act(() => vi.runAllTimers())
      // Relâché : le fil reprend sa vraie hauteur.
      expect(column.style.minHeight).toBe('')
      shrink(0)
      expect(box.scrollTop).toBe(780)
      el.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  it('appui hors du fil ou clic droit : rien n’est réservé ; appui annulé : la hauteur est rendue', () => {
    vi.useFakeTimers()
    try {
      const { el, column, button } = clampingThread()
      press(document.body, 'pointerdown')
      expect(column.style.minHeight).toBe('')
      act(() => {
        button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2 }))
      })
      expect(column.style.minHeight).toBe('')
      press(button, 'pointerdown')
      expect(column.style.minHeight).toBe('948px')
      press(button, 'pointercancel')
      act(() => vi.runAllTimers())
      expect(column.style.minHeight).toBe('')
      el.remove()
    } finally {
      vi.useRealTimers()
    }
  })
})
