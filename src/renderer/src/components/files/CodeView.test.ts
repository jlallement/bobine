import { describe, expect, it } from 'vitest'
import type { DiffNote } from '@shared/diff-notes'
import { placeNotes } from '../../file-notes'
import { indentOf, notedLines } from './CodeView'

describe('retrait suspendu (point 5)', () => {
  it('compte l’indentation, une tabulation pour quatre colonnes', () => {
    expect(indentOf('    return x')).toBe(4)
    expect(indentOf('\t\tx')).toBe(8)
    expect(indentOf(' \tx')).toBe(5)
    expect(indentOf('x')).toBe(0)
  })
})

describe('lignes commentées (point 6)', () => {
  it('toutes les lignes d’une remarque placée, aucune pour une remarque perdue', () => {
    const note = (from: number, to: number, code: string): DiffNote => ({
      id: `n${from}`,
      view: 'file',
      file: '0:a.ts',
      path: 'a.ts',
      side: 'new',
      from,
      to,
      code,
      comment: 'x'
    })
    const placed = placeNotes([note(2, 3, 'b\nc'), note(1, 1, 'disparu')], ['a', 'b', 'c'])
    expect([...notedLines(placed)]).toEqual([2, 3])
  })
})
