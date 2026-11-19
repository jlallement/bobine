import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceFile } from '@shared/attachments'
import { useBesideActions } from './beside-actions'
import { useMentions } from './useMentions'

const readme: WorkspaceFile = { path: '/projet/README.md', relative: 'README.md' }
const originalApi = window.api
const searchFiles = vi.fn(async (_id: string, _query: string) => [readme])
const fail = () => {}

beforeEach(() => {
  vi.useFakeTimers()
  searchFiles.mockClear()
  window.api = { ...originalApi, workspace: { searchFiles } } as unknown as Window['api']
})
afterEach(() => {
  vi.useRealTimers()
  window.api = originalApi
})

/** Un morceau de réponse arrive toutes les 50 ms : le volet d'à côté se rend à nouveau. */
async function streamFor(ms: number, rerender: (props: { tick: number }) => void): Promise<void> {
  for (let tick = 1; tick * 50 <= ms; tick++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    rerender({ tick })
  }
}

describe('actions du volet côte à côte (fiche 253)', () => {
  it('cause : une recherche `@` neuve à chaque rendu ne part jamais tant que les rendus durent', async () => {
    const onSearch = vi.fn(async (_query: string, _tick: number) => [readme])
    const { rerender } = renderHook(
      ({ tick }: { tick: number }) =>
        useMentions({
          text: '@RE',
          caret: 3,
          commandMenuOpen: false,
          blocked: false,
          // Fonction neuve à chaque rendu, comme l'ancien `actionsFor(id).searchFiles`.
          onSearchFiles: (query) => onSearch(query, tick)
        }),
      { initialProps: { tick: 0 } }
    )
    await streamFor(500, rerender)
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('même objet pour un même id ; un autre id, d’autres actions', () => {
    const { result, rerender } = renderHook(() => useBesideActions(fail))
    const first = result.current('c2')
    rerender()
    expect(result.current('c2')).toBe(first)
    expect(result.current('c3')).not.toBe(first)
    expect(result.current('c3').searchFiles).toBe(result.current('c3').searchFiles)
  })

  it('la recherche `@` du volet part pendant que la conversation d’à côté écrit', async () => {
    const { result, rerender } = renderHook(
      // `tick` : un rendu par morceau reçu, rien d'autre ne change.
      (_props: { tick: number }) => {
        const actions = useBesideActions(fail)('c2')
        return useMentions({
          text: '@RE',
          caret: 3,
          commandMenuOpen: false,
          blocked: false,
          onSearchFiles: actions.searchFiles
        })
      },
      { initialProps: { tick: 0 } }
    )
    await streamFor(300, rerender)
    expect(searchFiles).toHaveBeenCalledWith('c2', 'RE')
    expect(result.current.entries.at(-1)).toEqual({ kind: 'file', file: readme })
  })
})
