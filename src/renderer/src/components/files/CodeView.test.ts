import { describe, expect, it } from 'vitest'
import type { DiffNote } from '@shared/diff-notes'
import { placeNotes } from '../../file-notes'
import { indentOf, notedLines } from './CodeView'
import { smallImageScale } from './FileView'

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

describe('petite image (revue des captures)', () => {
  it('agrandie d’un facteur entier vers 64 px ; une image ordinaire, telle quelle', () => {
    expect(smallImageScale(2, 2)).toBe(32)
    expect(smallImageScale(16, 8)).toBe(4)
    expect(smallImageScale(40, 10)).toBe(1)
    expect(smallImageScale(64, 64)).toBe(1)
    expect(smallImageScale(800, 600)).toBe(1)
    expect(smallImageScale(0, 0)).toBe(1)
  })
})
