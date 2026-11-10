import { describe, expect, it } from 'vitest'
import { diffFeedback, sameDiff, type DiffNote } from './diff-notes'

const note = (overrides: Partial<DiffNote>): DiffNote => ({
  id: 'n',
  view: 'git',
  file: 'src/app.js',
  path: 'src/app.js',
  side: 'new',
  from: 11,
  to: 11,
  code: 'return items.reduce((s, i) => s + i, 0)',
  comment: 'Gérer une liste vide ?',
  ...overrides
})

describe('remarques sur les modifications (fiche 085)', () => {
  it('message : fichier, lignes, code cité et remarque, numérotés', () => {
    expect(
      diffFeedback([
        note({}),
        note({ from: 12, to: 14, code: '// TODO\nfoo()\nbar()', comment: ' Supprimer. ' })
      ])
    ).toBe(
      'Remarques sur les modifications :\n\n' +
        '1. src/app.js, ligne 11 :\n   ```\n   return items.reduce((s, i) => s + i, 0)\n   ```\n   Remarque : Gérer une liste vide ?\n\n' +
        '2. src/app.js, lignes 12 à 14 :\n   ```\n   // TODO\n   foo()\n   bar()\n   ```\n   Remarque : Supprimer.\n\n' +
        'Tiens compte de ces remarques dans le code.'
    )
  })

  it('lignes supprimées nommées ; bloc plus long que les accents graves du code', () => {
    const text = diffFeedback([note({ side: 'old', from: 3, to: 4, code: 'a ``` b' })])
    expect(text).toContain('lignes 3 à 4 supprimées :')
    expect(text).toContain('   ````\n   a ``` b\n   ````')
    expect(diffFeedback([note({ side: 'old', from: 3, to: 3 })])).toContain('ligne 3 supprimée :')
  })

  it('même diff : vue, fichier et modification', () => {
    expect(sameDiff(note({}), note({ id: 'm', from: 40 }))).toBe(true)
    expect(sameDiff(note({}), note({ view: 'conversation' }))).toBe(false)
    expect(sameDiff(note({ change: 0 }), note({ change: 1 }))).toBe(false)
  })
})
