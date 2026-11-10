import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from './transcript'
import {
  changesSummary,
  clearStatsCache,
  conversationChanges,
  relativeTo,
  splitPath
} from './changes'
import { diffStats } from './diff'

vi.mock('./diff', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./diff')>()
  return { ...actual, diffStats: vi.fn(actual.diffStats) }
})

const tool = (
  id: number,
  status: 'completed' | 'failed' | 'pending',
  diffs: { path: string; oldText?: string | null; newText: string }[]
): TranscriptItem => ({
  kind: 'tool',
  id,
  toolCallId: `t${id}`,
  title: 'Edit',
  status,
  content: diffs.map((d) => ({ type: 'diff', ...d })),
  locations: []
})

describe('conversationChanges', () => {
  it('fil de 400 modifications : chaque diff calculé une fois, pas à chaque morceau (fiche 192)', () => {
    const items = Array.from({ length: 400 }, (_, i) =>
      tool(i + 1, 'completed', [{ path: `/p/f${i}.ts`, oldText: `a${i}\n`, newText: `b${i}\n` }])
    )
    clearStatsCache()
    vi.mocked(diffStats).mockClear()
    conversationChanges(items)
    conversationChanges(items)
    conversationChanges(items)
    expect(vi.mocked(diffStats)).toHaveBeenCalledTimes(400)
  })

  it('total tranché par le délai : jamais gardé, recalculé (relecture fiche 192)', () => {
    clearStatsCache()
    const items = [tool(1, 'completed', [{ path: '/p/a', oldText: 'a\n', newText: 'b\n' }])]
    vi.mocked(diffStats).mockClear()
    vi.mocked(diffStats).mockReturnValueOnce({ added: 9, removed: 9, exact: false })
    expect(conversationChanges(items)[0]).toMatchObject({ added: 9, removed: 9 })
    expect(conversationChanges(items)[0]).toMatchObject({ added: 1, removed: 1 })
    conversationChanges(items)
    expect(vi.mocked(diffStats)).toHaveBeenCalledTimes(2)
  })

  it('cache borné en caractères : deux textes de 20 M de caractères ne restent pas tous deux', () => {
    clearStatsCache()
    const big = (c: string) => c.repeat(20 * 1024 * 1024)
    const one = [tool(1, 'completed', [{ path: '/p/a', oldText: big('a'), newText: 'x' }])]
    const two = [tool(2, 'completed', [{ path: '/p/b', oldText: big('b'), newText: 'y' }])]
    vi.mocked(diffStats).mockClear()
    conversationChanges(one)
    conversationChanges(two)
    conversationChanges(one)
    expect(vi.mocked(diffStats)).toHaveBeenCalledTimes(3)
  })

  it('regroupe par fichier, fusionne les modifications enchaînées, ignore les outils non aboutis', () => {
    const files = conversationChanges([
      tool(1, 'completed', [{ path: '/p/a.md', oldText: 'un\n', newText: 'un\ndeux\n' }]),
      tool(2, 'completed', [{ path: '/p/b.ts', newText: 'x\ny\n' }]),
      tool(3, 'failed', [{ path: '/p/c.ts', oldText: 'a', newText: 'b' }]),
      tool(4, 'pending', [{ path: '/p/a.md', oldText: 'un\ndeux\n', newText: 'refusé\n' }]),
      tool(5, 'completed', [
        { path: '/p/a.md', oldText: 'un\ndeux\n', newText: 'un\ndeux\ntrois\n' }
      ])
    ])
    expect(files).toEqual([
      {
        path: '/p/a.md',
        diffs: [{ oldText: 'un\n', newText: 'un\ndeux\ntrois\n' }],
        created: false,
        added: 2,
        removed: 0
      },
      {
        path: '/p/b.ts',
        diffs: [{ oldText: null, newText: 'x\ny\n' }],
        created: true,
        added: 2,
        removed: 0
      }
    ])
  })

  it('fichier créé par Bob : ancien texte vide plutôt qu’absent', () => {
    const [file] = conversationChanges([
      tool(1, 'completed', [{ path: '/p/hello.js', oldText: '', newText: 'a\nb\n' }])
    ])
    expect(file).toMatchObject({ created: true, added: 2, removed: 0 })
  })

  it('extraits qui ne s’enchaînent pas : une entrée par modification', () => {
    const [file] = conversationChanges([
      tool(1, 'completed', [{ path: '/p/a.ts', oldText: 'foo()', newText: 'bar()' }]),
      tool(2, 'completed', [{ path: '/p/a.ts', oldText: 'let x', newText: 'const x' }])
    ])
    expect(file?.diffs).toHaveLength(2)
    expect(file).toMatchObject({ added: 2, removed: 2, created: false })
  })

  it('totaux, chemins', () => {
    expect(
      changesSummary([
        { added: 3, removed: 1 },
        { added: null, removed: null }
      ])
    ).toEqual({
      files: 2,
      added: 3,
      removed: 1
    })
    expect(splitPath('src/ui/App.tsx')).toEqual({ dir: 'src/ui/', name: 'App.tsx' })
    expect(splitPath('README.md')).toEqual({ dir: '', name: 'README.md' })
    expect(relativeTo('/p', '/p/src/a.ts')).toBe('src/a.ts')
    expect(relativeTo('/p/', '/ailleurs/a.ts')).toBe('/ailleurs/a.ts')
  })
})
