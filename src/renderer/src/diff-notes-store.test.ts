import { beforeEach, describe, expect, it } from 'vitest'
import type { DiffNote } from '@shared/diff-notes'
import { loadDiffNotes, resetDiffNotesCache, saveDiffNotes } from './diff-notes-store'

const note = (id: string): DiffNote => ({
  id,
  view: 'git',
  file: 'a.js',
  path: 'a.js',
  side: 'new',
  from: 1,
  to: 1,
  code: 'x',
  comment: 'y'
})

describe('remarques en cours sur les modifications (fiche 085)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDiffNotesCache()
  })

  it('gardées par conversation, retrouvées après rechargement, effacées si vides', () => {
    saveDiffNotes('c1', [note('n1')])
    resetDiffNotesCache()
    expect(loadDiffNotes('c1').map((n) => n.id)).toEqual(['n1'])
    expect(loadDiffNotes('c2')).toEqual([])
    saveDiffNotes('c1', [])
    resetDiffNotesCache()
    expect(localStorage.getItem('bobine:remarques-diff')).toBe('{}')
  })

  it('stockage illisible ou remarques invalides ignorés ; au plus 50 conversations', () => {
    localStorage.setItem('bobine:remarques-diff', '{"c1":[{"id":"x"}],"c2":3}')
    expect(loadDiffNotes('c1')).toEqual([])
    resetDiffNotesCache()
    localStorage.setItem('bobine:remarques-diff', 'pas du json')
    expect(loadDiffNotes('c1')).toEqual([])
    for (let i = 0; i < 55; i++) saveDiffNotes(`c${i}`, [note(`n${i}`)])
    resetDiffNotesCache()
    expect(loadDiffNotes('c0')).toEqual([])
    expect(loadDiffNotes('c54').map((n) => n.id)).toEqual(['n54'])
  })
})
