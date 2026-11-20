import { describe, expect, it } from 'vitest'
import { treeRows } from './FileTree'

const root = (index: number, name: string) => ({ index, name, path: `/p/${name}` })
const listing = (entries: { name: string; path: string; kind: 'dir' | 'file' }[], more = 0) => ({
  listing: { entries, more }
})

describe('treeRows', () => {
  it('une racine : son contenu, dossiers dépliés, entrées en plus', () => {
    const rows = treeRows(
      [root(0, 'app')],
      {
        '0:': listing(
          [
            { name: 'src', path: 'src', kind: 'dir' },
            { name: 'a.md', path: 'a.md', kind: 'file' }
          ],
          3
        ),
        '0:src': listing([{ name: 'b.ts', path: 'src/b.ts', kind: 'file' }])
      },
      new Set(['0:', '0:src'])
    )
    expect(rows.map((r) => [r.kind, r.key, r.depth])).toEqual([
      ['entry', '0:src', 0],
      ['entry', '0:src/b.ts', 1],
      ['entry', '0:a.md', 0],
      ['note', '0:#more', 0]
    ])
  })

  it('plusieurs racines : une ligne par racine, la principale dépliée', () => {
    const rows = treeRows([root(0, 'app'), root(1, 'lib')], { '0:': listing([]) }, new Set())
    expect(rows.map((r) => [r.kind, r.key])).toEqual([
      ['root', '0:'],
      ['note', '0:#empty'],
      ['root', '1:']
    ])
  })

  it('dossier pas encore lu : « Lecture… » ; erreur : dite', () => {
    expect(treeRows([root(0, 'app')], {}, new Set())[0]).toMatchObject({ text: 'loading' })
    expect(treeRows([root(0, 'app')], { '0:': { error: 'refusé' } }, new Set())[0]).toMatchObject({
      text: 'error',
      error: 'refusé'
    })
  })
})
