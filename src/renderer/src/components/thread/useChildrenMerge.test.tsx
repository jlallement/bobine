import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChildrenMergePlan, MergeRowState } from '@shared/children-merge'
import type { TranscriptItem } from '@shared/transcript'
import { rowMergeState, useChildrenMerge, type ChildrenMergeActions } from './SubtasksMerge'

const idle: ChildrenMergePlan = { base: 'main', children: [], overlaps: [], running: false }

function deferred() {
  let resolve!: (value: ChildrenMergePlan) => void
  const promise = new Promise<ChildrenMergePlan>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function actions() {
  return {
    plan: vi.fn(async () => idle),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
    commitMain: vi.fn(async () => undefined),
    openGit: vi.fn()
  } satisfies ChildrenMergeActions
}

function merge(state: MergeRowState): TranscriptItem[] {
  return [
    {
      kind: 'children-merge',
      id: 1,
      runId: 'run',
      base: 'main',
      cleanup: false,
      status: 'running',
      startedAt: 1,
      rows: [{ childId: 'child', title: 'Fille', state }]
    }
  ]
}

describe('lectures asynchrones du plan de fusion (151)', () => {
  it('un ancien plan au repos ne masque pas la fusion qui démarre puis le conflit en résolution', async () => {
    const api = actions()
    const starting = deferred()
    const resolving = deferred()
    api.plan
      .mockResolvedValueOnce(idle)
      .mockReturnValueOnce(starting.promise)
      .mockReturnValueOnce(resolving.promise)
    const { result, rerender } = renderHook(
      ({ items }) => useChildrenMerge('mother', api, [], items),
      { initialProps: { items: [] as TranscriptItem[] } }
    )
    await waitFor(() => expect(result.current.plan).toBe(idle))

    rerender({ items: merge('merging') })
    expect(result.current.merge?.status).toBe('running')
    expect(result.current.merge?.interrupted).toBeUndefined()
    expect(rowMergeState(result.current, 'child')).toBe('merging')

    rerender({ items: merge('resolving') })
    expect(rowMergeState(result.current, 'child')).toBe('resolving')
    await act(async () => {
      starting.resolve(idle)
      await starting.promise
    })
    expect(rowMergeState(result.current, 'child')).toBe('resolving')
    expect(result.current.merge?.interrupted).toBeUndefined()

    await act(async () => {
      resolving.resolve({ ...idle, running: true })
      await resolving.promise
    })
    expect(result.current.plan?.running).toBe(true)
    expect(result.current.merge?.status).toBe('running')
    expect(rowMergeState(result.current, 'child')).toBe('resolving')
  })

  it('une fusion relue au redémarrage reste dite interrompue si une lecture actuelle le confirme', async () => {
    const api = actions()
    const { result } = renderHook(() => useChildrenMerge('mother', api, [], merge('resolving')))
    await waitFor(() => expect(result.current.plan).toBe(idle))
    expect(result.current.merge?.status).toBe('stopped')
    expect(result.current.merge?.interrupted).toBe(true)
    expect(result.current.merge?.rows[0]?.state).toBe('pending')
  })

  it('le plan de la mère précédente ne décide pas de l’état de la nouvelle conversation', async () => {
    const api = actions()
    const next = deferred()
    api.plan.mockResolvedValueOnce(idle).mockReturnValueOnce(next.promise)
    const { result, rerender } = renderHook(
      ({ mother }) => useChildrenMerge(mother, api, [], merge('resolving')),
      { initialProps: { mother: 'first' } }
    )
    await waitFor(() => expect(result.current.merge?.interrupted).toBe(true))

    rerender({ mother: 'second' })
    expect(result.current.plan).toBeUndefined()
    expect(result.current.merge?.status).toBe('running')
    expect(result.current.merge?.interrupted).toBeUndefined()
    await act(async () => {
      next.resolve({ ...idle, running: true })
      await next.promise
    })
    expect(result.current.plan?.running).toBe(true)
    expect(result.current.merge?.status).toBe('running')
  })
})
