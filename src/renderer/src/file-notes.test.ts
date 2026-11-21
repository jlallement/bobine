import { describe, expect, it } from 'vitest'
import { diffFeedback, type DiffNote } from '@shared/diff-notes'
import { fileNoteKey, fileNotesOf, isOrphanNote, noteTarget, placeNotes } from './file-notes'

const note = (from: number, to: number, code: string): DiffNote => ({
  id: `n${from}`,
  view: 'file',
  file: '0:src/app.ts',
  path: 'src/app.ts',
  side: 'new',
  from,
  to,
  code,
  comment: 'À revoir'
})

describe('placeNotes', () => {
  const lines = ['a', 'b', 'c', 'd']

  it('reste sous ses lignes si le code y est encore', () => {
    expect(placeNotes([note(2, 3, 'b\nc')], lines)[0]).toMatchObject({ from: 2, to: 3 })
  })

  it('suit son code déplacé, au plus près', () => {
    const moved = ['x', 'x', 'a', 'b', 'c', 'd']
    expect(placeNotes([note(2, 3, 'b\nc')], moved)[0]).toMatchObject({
      from: 4,
      to: 5,
      moved: true
    })
  })

  it('code disparu : en fin de fichier', () => {
    const placed = placeNotes([note(2, 2, 'zz')], lines)[0]
    expect(placed?.from).toBeUndefined()
  })
})

describe('diffFeedback', () => {
  it('dit « Remarques sur le code » pour une remarque de fichier', () => {
    const text = diffFeedback([note(2, 2, 'b')])
    expect(text).toContain('Remarques sur le code :')
    expect(text).toContain('src/app.ts, ligne 2')
  })
})

describe('fileNoteKey (M2)', () => {
  it('désigne la racine par son chemin : même rang, autre dossier, autre clé', () => {
    expect(fileNoteKey('/p/lib', 'a.ts')).not.toBe(fileNoteKey('/p/docs', 'a.ts'))
    expect(fileNoteKey('/p/lib', 'a.ts')).toBe(fileNoteKey('/p/lib', 'a.ts'))
  })
})

describe('remarque dont la cible est introuvable', () => {
  const note = (file: string): DiffNote => ({
    id: file,
    view: 'file',
    file,
    path: 'c.ts',
    side: 'new',
    from: 1,
    to: 1,
    code: 'a',
    comment: 'x'
  })
  const roots = ['/p/app', '/p/lib']

  it('orpheline si son dossier n’est plus parmi ceux de la conversation', () => {
    expect(isOrphanNote(note(fileNoteKey('/p/retire', 'c.ts')), roots)).toBe(true)
    expect(isOrphanNote(note('2:c.ts'), roots)).toBe(true)
    expect(isOrphanNote(note(fileNoteKey('/p/lib', 'c.ts')), roots)).toBe(false)
    expect(isOrphanNote({ ...note('x'), view: 'conversation' }, roots)).toBe(false)
  })
})

describe('noteTarget (fichier d’une remarque, 3e revue)', () => {
  const note = (file: string): DiffNote => ({
    id: 'n',
    view: 'file',
    file,
    path: 'x',
    side: 'new',
    from: 12,
    to: 14,
    code: 'a',
    comment: 'x'
  })
  it('rang de la racine, chemin relatif et ligne ; rien si le dossier n’y est plus', () => {
    const roots = ['/p/app', '/p/app-lib']
    expect(noteTarget(note(fileNoteKey('/p/app-lib', 'src/b.ts')), roots)).toEqual({
      root: 1,
      path: 'src/b.ts',
      line: 12
    })
    expect(noteTarget(note(fileNoteKey('/p/app', 'a::b.ts')), roots)).toEqual({
      root: 0,
      path: 'a::b.ts',
      line: 12
    })
    expect(noteTarget(note(fileNoteKey('/p/parti', 'c.ts')), roots)).toBeUndefined()
  })
})

describe('fileNotesOf (3e revue, mineur)', () => {
  it('la même liste tant que les remarques ne changent pas : le code ne se replace pas', () => {
    const notes: DiffNote[] = [
      {
        id: 'a',
        view: 'file',
        file: fileNoteKey('/p', 'a.ts'),
        path: 'a.ts',
        side: 'new',
        from: 1,
        to: 1,
        code: 'x',
        comment: 'c'
      }
    ]
    const first = fileNotesOf(notes, fileNoteKey('/p', 'a.ts'))
    expect(first).toHaveLength(1)
    expect(fileNotesOf(notes, fileNoteKey('/p', 'a.ts'))).toBe(first)
    expect(fileNotesOf([...notes], fileNoteKey('/p', 'a.ts'))).not.toBe(first)
  })
})
