import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { plainLines } from '../../code-lines'
import { FILE_FIND_EVENT, FILE_GOTO_EVENT } from '../../files-state'
import { CodeView, flashLine, type CodeNotes } from './CodeView'

/** Rendus de l'icône de la gouttière : un par ligne de code redessinée. */
const gutter = vi.hoisted(() => ({ renders: 0 }))
vi.mock('lucide-react', async (importOriginal) => {
  const icons = await importOriginal<typeof import('lucide-react')>()
  return {
    ...icons,
    MessageSquarePlus: (props: object) => {
      gutter.renders++
      return <icons.MessageSquarePlus {...props} />
    }
  }
})

afterEach(() => vi.useRealTimers())

const TEXT = Array.from({ length: 20 }, (_, i) => `const v${i} = ${i}`).join('\n')
const notes: CodeNotes = {
  notes: [],
  anchor: { view: 'file', file: '/p/app::a.ts', path: 'a.ts' },
  onSave: () => {},
  onDelete: () => {}
}

function view(extra: Partial<Parameters<typeof CodeView>[0]> = {}) {
  return (
    <Tooltip.Provider>
      <CodeView lines={plainLines(TEXT)} text={TEXT} wrap name="a.ts" notes={notes} {...extra} />
    </Tooltip.Provider>
  )
}

describe('ligne demandée (C4)', () => {
  it('montrée puis oubliée : l’onglet en est prévenu ; redemandée, elle revient', () => {
    const onLineShown = vi.fn()
    const { rerender } = render(view({ line: 12, onLineShown }))
    expect(onLineShown).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('file-code').dataset['asked']).toBe('12')
    rerender(view({ onLineShown }))
    rerender(view({ line: 12, onLineShown }))
    expect(onLineShown).toHaveBeenCalledTimes(2)
  })
})

describe('éclair d’une ligne (C9)', () => {
  it('s’éteint même sans fin d’animation (mouvement réduit) et ne s’accumule pas', () => {
    vi.useFakeTimers()
    const row = document.createElement('div')
    flashLine(row)
    flashLine(row)
    expect(row.classList.contains('flash')).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(row.classList.contains('flash')).toBe(false)
  })
})

describe('focus après la recherche et « Aller à la ligne » (mineur)', () => {
  it('Échap dans ⌘F, ↵ dans ⌃G : le clavier revient au code', () => {
    render(view())
    act(() => {
      window.dispatchEvent(new Event(FILE_FIND_EVENT))
    })
    fireEvent.keyDown(screen.getByTestId('file-find'), { key: 'Escape' })
    expect(document.activeElement).toBe(screen.getByTestId('file-code'))
    act(() => {
      window.dispatchEvent(new Event(FILE_GOTO_EVENT))
    })
    const goto = screen.getByTestId('file-goto')
    fireEvent.change(goto, { target: { value: '5' } })
    fireEvent.keyDown(goto, { key: 'Enter' })
    expect(document.activeElement).toBe(screen.getByTestId('file-code'))
  })
})

describe('remarque en cours de saisie (C7)', () => {
  it('une touche dans la remarque ne redessine pas les lignes de code', () => {
    render(view())
    fireEvent.click(screen.getAllByTestId('file-note-add')[3] as HTMLElement)
    const input = screen.getByTestId('file-note-input')
    gutter.renders = 0
    fireEvent.change(input, { target: { value: 'P' } })
    fireEvent.change(input, { target: { value: 'Po' } })
    fireEvent.change(input, { target: { value: 'Pou' } })
    expect(gutter.renders).toBe(0)
  })
})

describe('remarque en cours étendue par Maj-clic (3e revue, 2)', () => {
  it('le texte tapé reste quand la plage s’étend', () => {
    render(view())
    const add = () => screen.getAllByTestId('file-note-add')
    fireEvent.click(add()[3] as HTMLElement)
    fireEvent.change(screen.getByTestId('file-note-input'), { target: { value: 'À revoir' } })
    fireEvent.click(add()[6] as HTMLElement, { shiftKey: true })
    expect((screen.getByTestId('file-note-input') as HTMLTextAreaElement).value).toBe('À revoir')
    expect(screen.getByTestId('file-note-editor').textContent).toContain('4')
    expect(screen.getByTestId('file-note-editor').textContent).toContain('7')
  })
})

describe('recherche au clavier (3e revue, mineur)', () => {
  it('↓ et ↑ passent au résultat suivant et au précédent', () => {
    render(view())
    act(() => {
      window.dispatchEvent(new Event(FILE_FIND_EVENT))
    })
    const find = screen.getByTestId('file-find')
    fireEvent.change(find, { target: { value: 'const v1' } })
    // `const v1`, `const v10` à `const v19` : 11 résultats.
    expect(screen.getByTestId('file-find-count').textContent).toMatch(/^1\D+11$/)
    fireEvent.keyDown(find, { key: 'ArrowDown' })
    expect(screen.getByTestId('file-find-count').textContent).toMatch(/^2\D+11$/)
    fireEvent.keyDown(find, { key: 'ArrowUp' })
    fireEvent.keyDown(find, { key: 'ArrowUp' })
    expect(screen.getByTestId('file-find-count').textContent).toMatch(/^11\D+11$/)
  })
})
