import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DiffNote } from '@shared/diff-notes'
import { fileNoteKey } from '../../file-notes'
import { NotesBar } from './FilesParts'

const note = (id: string, file: string, path: string): DiffNote => ({
  id,
  view: 'file',
  file,
  path,
  side: 'new',
  from: 1,
  to: 1,
  code: 'a',
  comment: `remarque ${id}`
})

describe('barre des remarques : remarques ailleurs', () => {
  it('toute remarque comptée est montrée : ailleurs, ouvrable ; dossier retiré, supprimable', () => {
    const onDelete = vi.fn()
    const onOpenNote = vi.fn()
    const notes = [
      note('n1', fileNoteKey('/p/app', 'a.ts'), 'a.ts'),
      note('n2', '2:vieux.ts', 'vieux.ts'),
      note('n3', fileNoteKey('/p/retire', 'c.ts'), 'c.ts'),
      note('n4', fileNoteKey('/p/app', 'b.ts'), 'b.ts')
    ]
    render(
      <Tooltip.Provider>
        <NotesBar
          notes={notes}
          fileKey={fileNoteKey('/p/app', 'a.ts')}
          rootPaths={['/p/app']}
          onSend={() => {}}
          onClear={() => {}}
          onRestore={() => {}}
          onDelete={onDelete}
          onOpenNote={onOpenNote}
        />
      </Tooltip.Provider>
    )
    // Comptées, et montrées : chacune hors du fichier affiché a sa ligne.
    expect(screen.getByTestId('files-notes-count').textContent).toMatch(/4/)
    const rows = screen.getAllByTestId('files-note-elsewhere')
    expect(rows.map((o) => !!o.dataset['orphan'])).toEqual([true, true, false])
    expect(rows[0]?.textContent).toContain('vieux.ts')
    fireEvent.click(screen.getAllByTestId('files-note-elsewhere-delete')[1] as HTMLElement)
    expect(onDelete).toHaveBeenCalledWith('n3')
    // Une remarque sur un autre fichier joignable s'ouvre ; une orpheline, non.
    const open = screen.getAllByTestId('files-note-elsewhere-open')
    expect(open).toHaveLength(1)
    fireEvent.click(open[0] as HTMLElement)
    expect(onOpenNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'n4' }))
  })
})
