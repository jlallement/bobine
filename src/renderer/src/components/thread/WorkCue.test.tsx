import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CueState, CueTarget } from './work-cue'
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
    return {
      onReveal,
      update: (next: CueTarget[], nextCards = cards) =>
        view.rerender(<Harness targets={next} cards={nextCards} onReveal={onReveal} />)
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

  it('« Voir » : défile jusqu’à la carte, l’entoure une seconde, et le repère s’en va', () => {
    vi.useFakeTimers()
    const { update } = show([target('ux', 2, 'working')])
    update([target('ux', 2, 'replied')])
    fireEvent.click(screen.getByTestId('work-cue-show'))
    expect(scrolled).toEqual([2])
    const card = screen.getByTestId('card-2')
    expect(card.hasAttribute('data-cue-flash')).toBe(true)
    expect(screen.queryByTestId('work-cue')).toBeNull()
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
    vi.useFakeTimers()
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
})
