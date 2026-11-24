import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { ScrollDownButton } from './ScrollDownButton'

/**
 * « Aller en bas » et ce qui est arrivé depuis (fiche 185, P8) : remplace la vérification de
 * composant de `e2e/suites/finitions.mjs` (n° 4). Le compte lui-même est à
 * `useNewSinceScroll.test.ts` ; le vrai défilement, à `parcours-longue`.
 */

const replies = (n: number): TranscriptItem[] => [
  { kind: 'user', id: 0, text: 'Relis' },
  ...Array.from({ length: n }, (_, i): TranscriptItem => ({
    kind: 'agent',
    id: i + 1,
    text: `r${i}`
  }))
]

function show(atBottom: boolean, items: TranscriptItem[], conversation = 'c-bas') {
  const onClick = vi.fn()
  const ui = (a: boolean, list: TranscriptItem[]) => (
    <Tooltip.Provider>
      <ScrollDownButton atBottom={a} items={list} conversation={conversation} onClick={onClick} />
    </Tooltip.Provider>
  )
  const view = render(ui(atBottom, items))
  return { onClick, rerender: (a: boolean, list: TranscriptItem[]) => view.rerender(ui(a, list)) }
}

describe('« Aller en bas » (fiche 185, P8)', () => {
  it('en bas : pas de bouton', () => {
    show(true, replies(1))
    expect(screen.queryByTestId('scroll-to-bottom')).toBeNull()
  })

  it('fil remonté, rien de neuf : « Aller en bas » sans compte ; un clic y va', () => {
    const { onClick } = show(false, replies(1), 'c-rien')
    const button = screen.getByTestId('scroll-to-bottom')
    expect(button.getAttribute('aria-label')).toBe('Aller en bas')
    expect(button.classList.contains('with-count')).toBe(false)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalled()
  })

  it('réponses arrivées pendant qu’on relit : « ↓ N nouveaux », puis « 99+ » (finitions n° 4)', () => {
    const { rerender } = show(false, replies(1), 'c-neufs')
    rerender(false, replies(4))
    const button = screen.getByTestId('scroll-to-bottom')
    expect(button.textContent).toBe('3 nouveaux')
    expect(button.getAttribute('aria-label')).toBe('3 nouveaux')
    expect(button.classList.contains('with-count')).toBe(true)
    rerender(false, replies(1 + 120))
    expect(screen.getByTestId('scroll-to-bottom').textContent).toBe('99+ nouveaux')
  })
})
