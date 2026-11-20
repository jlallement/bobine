import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FILTER_DELAY_MS, useFileFilter, type SearchRoot } from './useFileFilter'

const roots = [{ index: 0, name: 'app', path: '/p/app' }]

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** Réponses rendues à la main, dans l'ordre choisi par l'essai. */
function deferred() {
  const pending: { query: string; resolve: (paths: string[]) => void }[] = []
  const search: SearchRoot = (_root, query) =>
    new Promise((resolve) => pending.push({ query, resolve }))
  return { pending, search }
}

describe('filtre de l’onglet Fichiers', () => {
  it('attend la fin de la frappe, garde les derniers résultats, ne dit « aucun » qu’après la réponse', async () => {
    const { pending, search } = deferred()
    const { result } = renderHook(() => useFileFilter(roots, search))
    act(() => result.current.setQuery('ap'))
    expect(result.current).toMatchObject({ hits: null, searching: true })
    act(() => vi.advanceTimersByTime(FILTER_DELAY_MS - 1))
    expect(pending).toHaveLength(0)
    act(() => vi.advanceTimersByTime(1))
    expect(pending).toHaveLength(1)
    await act(async () => pending[0]?.resolve(['src/app.ts']))
    expect(result.current).toMatchObject({
      hits: [{ root: 0, path: 'src/app.ts' }],
      searching: false
    })
    act(() => result.current.setQuery('zz'))
    // Pendant la recherche suivante : les résultats d'avant, pas « aucun ».
    expect(result.current).toMatchObject({
      hits: [{ root: 0, path: 'src/app.ts' }],
      searching: true
    })
    act(() => vi.advanceTimersByTime(FILTER_DELAY_MS))
    await act(async () => pending[1]?.resolve([]))
    expect(result.current).toMatchObject({ hits: [], searching: false })
  })

  it('une réponse périmée n’écrase jamais une plus récente', async () => {
    const { pending, search } = deferred()
    const { result } = renderHook(() => useFileFilter(roots, search))
    act(() => result.current.setQuery('a'))
    act(() => vi.advanceTimersByTime(FILTER_DELAY_MS))
    act(() => result.current.setQuery('ab'))
    act(() => vi.advanceTimersByTime(FILTER_DELAY_MS))
    await act(async () => pending[1]?.resolve(['ab.ts']))
    await act(async () => pending[0]?.resolve(['a.ts', 'ab.ts']))
    expect(result.current.hits).toEqual([{ root: 0, path: 'ab.ts' }])
  })

  it('`chemin:42` : la ligne à part', () => {
    const { search } = deferred()
    const { result } = renderHook(() => useFileFilter(roots, search))
    act(() => result.current.setQuery('app.ts:42'))
    expect(result.current.line).toBe(42)
  })
})
