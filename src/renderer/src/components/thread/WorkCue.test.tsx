import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTLE_MS, type CueState, type CueTarget } from './work-cue'
import { FLASH_MS, WorkCue } from './WorkCue'

/** Position des cartes dans la fenêtre (haut, bas) ; la zone qui défile va de 0 à 600. */
const positions = new Map<number, [number, number]>()
const OFF_SCREEN: [number, number] = [-1000, -800]

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, height: bottom - top, left: 0, right: 0, width: 0, x: 0, y: top } as DOMRect
}

const ux = { icon: 'palette', color: 'violet' }
const target = (key: string, itemId: number, state: CueState, label = key): CueTarget => ({
  key,
  itemId,
  label,
  state,
  ...(key === 'ux' ? { role: ux } : {})
})

function Harness({
  targets,
  cards,
  onReveal
}: {
  targets: CueTarget[]
  cards: number[]
  onReveal: (id: number) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  return (
    <>
      <div ref={scroller} data-testid="scroller">
        {cards.map((id) => (
          <div key={id} data-work-anchor={id} data-testid={`card-${id}`} />
        ))}
      </div>
      <WorkCue targets={targets} scroller={scroller} onReveal={onReveal} />
    </>
  )
}

describe('repère en bas du fil (fiche 261, écran E)', () => {
  const scrolled: number[] = []
  beforeEach(() => {
    vi.useFakeTimers()
    positions.clear()
    scrolled.length = 0
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      if (this.dataset['testid'] === 'scroller') return rect(0, 600)
      const id = Number(this.dataset['workAnchor'])
      const [top, bottom] = positions.get(id) ?? OFF_SCREEN
      return rect(top, bottom)
    })
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      const id = Number(this.dataset['workAnchor'])
      scrolled.push(id)
      positions.set(id, [200, 400])
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const show = (targets: CueTarget[], cards = [2, 3], onReveal = vi.fn()) => {
    const view = render(<Harness targets={targets} cards={cards} onReveal={onReveal} />)
    const rerender = (next: CueTarget[], nextCards: number[]) =>
      view.rerender(<Harness targets={next} cards={nextCards} onReveal={onReveal} />)
    return {
      onReveal,
      view,
      /** Nouvel état, puis le délai de revue passé. */
      update: (next: CueTarget[], nextCards = cards) => {
        rerender(next, nextCards)
        act(() => vi.advanceTimersByTime(SETTLE_MS))
      },
      /** Nouvel état, sans attendre. */
      change: rerender
    }
  }

  it('travail qui répond hors de l’écran : « ↑ Expert UX/UI a répondu · Voir », pas avant', () => {
    const { update } = show([target('ux', 2, 'working', 'Expert UX/UI')])
    expect(screen.queryByTestId('work-cue')).toBeNull()
    update([target('ux', 2, 'replied', 'Expert UX/UI')])
    expect(screen.getByTestId('work-cue-text').textContent).toBe('Expert UX/UI a répondu')
    expect(screen.getByTestId('work-cue-show').textContent).toBe('Voir')
    expect(screen.getByTestId('role-avatar')).toBeTruthy()
  })

  it('carte à l’écran quand il répond : pas de repère', () => {
    positions.set(2, [100, 300])
    const { update } = show([target('ux', 2, 'working')])
    update([target('ux', 2, 'replied')])
    expect(screen.queryByTestId('work-cue')).toBeNull()
  })

  it('« Voir » : défile jusqu’à la carte, l’entoure un instant, lui donne le focus, et le repère s’en va', () => {
    const { update } = show([target('ux', 2, 'working')])
    update([target('ux', 2, 'replied')])
    fireEvent.click(screen.getByTestId('work-cue-show'))
    expect(scrolled).toEqual([2])
    const card = screen.getByTestId('card-2')
    expect(card.hasAttribute('data-cue-flash')).toBe(true)
    expect(document.activeElement).toBe(card)
    expect(card.getAttribute('tabindex')).toBe('-1')
    expect(screen.queryByTestId('work-cue')).toBeNull()
    expect(screen.getByTestId('work-cue-live').getAttribute('aria-live')).toBe('polite')
    act(() => vi.advanceTimersByTime(FLASH_MS))
    expect(card.hasAttribute('data-cue-flash')).toBe(false)
  })

  it('la carte vue en défilant : le repère disparaît', () => {
    const { update } = show([target('ux', 2, 'working')])
    update([target('ux', 2, 'replied')])
    expect(screen.getByTestId('work-cue')).toBeTruthy()
    positions.set(2, [300, 500])
    fireEvent.scroll(screen.getByTestId('scroller'))
    expect(screen.queryByTestId('work-cue')).toBeNull()
  })

  it('deux travaux : « ↑ 2 travaux ont répondu », « Voir » mène au plus ancien, puis l’autre reste', () => {
    const { update } = show([target('ux', 2, 'working'), target('front', 3, 'working', 'Front')])
    update([target('ux', 2, 'working'), target('front', 3, 'finished', 'Front')])
    expect(screen.getByTestId('work-cue-text').textContent).toBe('Front a fini')
    update([target('ux', 2, 'replied'), target('front', 3, 'finished', 'Front')])
    expect(screen.getByTestId('work-cue-text').textContent).toBe('2 travaux ont répondu')
    expect(screen.queryByTestId('role-avatar')).toBeNull()
    fireEvent.click(screen.getByTestId('work-cue-show'))
    expect(scrolled).toEqual([3])
    expect(screen.getByTestId('work-cue-text').textContent).toBe('ux a répondu')
  })

  it('carte pas encore rendue (long fil) : rendue d’abord, puis montrée', () => {
    const { update, onReveal } = show([target('ux', 2, 'working')], [])
    update([target('ux', 2, 'replied')], [])
    fireEvent.click(screen.getByTestId('work-cue-show'))
    expect(onReveal).toHaveBeenCalledWith(2)
    expect(scrolled).toEqual([])
    update([target('ux', 2, 'replied')], [2])
    act(() => vi.advanceTimersToNextFrame())
    expect(scrolled).toEqual([2])
    expect(screen.getByTestId('card-2').hasAttribute('data-cue-flash')).toBe(true)
  })

  it('le travail repart : le repère s’en va (rien de périmé)', () => {
    const { update } = show([target('ux', 2, 'working')])
    update([target('ux', 2, 'replied')])
    update([target('ux', 2, 'working')])
    expect(screen.queryByTestId('work-cue')).toBeNull()
  })

  it('une fille finit sous les yeux (état avant compte rendu) : aucun clignotement du repère', () => {
    const { change, update } = show([target('ux', 2, 'working')], [2])
    // L'état « a répondu » arrive d'abord : la cible vise encore la carte de lancement, plus haut.
    change([target('ux', 2, 'replied')], [2])
    expect(screen.queryByTestId('work-cue')).toBeNull()
    // Le compte rendu arrive en bas, à l'écran, avant la fin du délai.
    positions.set(9, [400, 560])
    update([target('ux', 9, 'replied')], [2, 9])
    expect(screen.queryByTestId('work-cue')).toBeNull()
  })

  it('le nom long seul se coupe, jamais le verbe : deux éléments', () => {
    const name = 'Expert en accessibilité des applications mobiles et web'
    const { update } = show([target('ux', 2, 'working', name)])
    update([target('ux', 2, 'replied', name)])
    const text = screen.getByTestId('work-cue-text')
    expect(text.querySelector('.work-cue-name')?.textContent).toBe(name)
    expect(text.querySelector('.work-cue-name')?.getAttribute('title')).toBe(name)
    expect(text.querySelector('.work-cue-verb')?.textContent).toBe('a répondu')
  })

  it('un seul « attendre la carte » à la fois ; au démontage, l’anneau et l’attente sont annulés', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    const clear = vi.spyOn(window, 'clearTimeout')
    const { update, view } = show([target('ux', 2, 'working'), target('fr', 3, 'working')], [3])
    update([target('ux', 2, 'replied'), target('fr', 3, 'replied')], [3])
    // Le plus ancien (ux) n'est pas rendu : on attend qu'il le soit…
    fireEvent.click(screen.getByTestId('work-cue-show'))
    const before = cancel.mock.calls.length
    // … puis « Voir » sur l'autre : la première attente est annulée, pas doublée.
    fireEvent.click(screen.getByTestId('work-cue-show'))
    expect(cancel.mock.calls.length).toBe(before + 1)
    expect(scrolled).toEqual([3])
    const card = screen.getByTestId('card-3')
    expect(card.hasAttribute('data-cue-flash')).toBe(true)
    const cleared = clear.mock.calls.length
    view.unmount()
    expect(card.hasAttribute('data-cue-flash')).toBe(false)
    expect(clear.mock.calls.length).toBeGreaterThan(cleared)
    // La carte d'ux, rendue après le démontage, n'est jamais montrée.
    act(() => vi.advanceTimersByTime(FLASH_MS * 2))
    expect(scrolled).toEqual([3])
  })
})
