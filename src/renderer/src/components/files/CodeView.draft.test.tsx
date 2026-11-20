import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { plainLines } from '../../code-lines'
import { CodeView, type CodeNotes } from './CodeView'

describe('remarque en brouillon pendant une relecture (C5)', () => {
  it('cite le code affiché à l’ouverture du brouillon, pas celui relu ensuite', () => {
    const onSave = vi.fn()
    const notes: CodeNotes = {
      notes: [],
      anchor: { view: 'file', file: '/p/app::a.ts', path: 'a.ts' },
      onSave,
      onDelete: () => {}
    }
    const view = (text: string) => (
      <Tooltip.Provider>
        <CodeView lines={plainLines(text)} text={text} wrap name="a.ts" notes={notes} />
      </Tooltip.Provider>
    )
    const before = 'const a = 1\nconst b = 2\n'
    const { rerender } = render(view(before))
    fireEvent.click(screen.getAllByTestId('file-note-add')[1] as HTMLElement)
    // L'agent réécrit le fichier pendant que la remarque s'écrit.
    rerender(view('// en-tête ajouté\nconst a = 1\nconst b = 2\n'))
    fireEvent.change(screen.getByTestId('file-note-input'), { target: { value: 'Pourquoi 2 ?' } })
    fireEvent.click(screen.getByTestId('file-note-save'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ from: 2, to: 2, code: 'const b = 2', comment: 'Pourquoi 2 ?' })
    )
  })
})
