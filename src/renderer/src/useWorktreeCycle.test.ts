import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ConversationEvent } from '@shared/agent'
import type { WorktreeCycleView } from '@shared/worktree-cycle'
import { useWorktreeCycle } from './useWorktreeCycle'

const originalApi = window.api
let calls: { id: string; options?: { fresh?: boolean } }[] = []
let ahead = 1
let onEvent: ((payload: ConversationEvent) => void) | undefined

const view = (): WorktreeCycleView =>
  ({ branch: 'bobine/x', ahead, unpushed: ahead - 1 }) as unknown as WorktreeCycleView

beforeEach(() => {
  calls = []
  ahead = 1
  window.api = {
    ...originalApi,
    worktree: {
      info: async (id: string, options?: { fresh?: boolean }) => {
        calls.push({ id, ...(options ? { options } : {}) })
        return view()
      },
      onForge: () => () => {}
    },
    agent: {
      onEvent: (listener: (payload: ConversationEvent) => void) => {
        onEvent = listener
        return () => (onEvent = undefined)
      }
    }
  } as unknown as Window['api']
})
afterEach(() => {
  window.api = originalApi
})

describe('useWorktreeCycle (fiche 176, D15 : commit fait hors de la barre)', () => {
  it('relit l’état à la fin d’un tour de l’agent de cette conversation, pas des autres', async () => {
    const { result } = renderHook(() => useWorktreeCycle('c1', 0))
    await waitFor(() => expect(result.current.info?.ahead).toBe(1))
    // L'agent committe dans le worktree, sans passer par « Committer ».
    ahead = 2
    act(() =>
      onEvent?.({ conversationId: 'c2', event: { type: 'turn-end', stopReason: 'end_turn' } })
    )
    expect(calls).toHaveLength(1)
    act(() =>
      onEvent?.({ conversationId: 'c1', event: { type: 'turn-end', stopReason: 'end_turn' } })
    )
    await waitFor(() => expect(result.current.info?.ahead).toBe(2))
    expect(result.current.info?.unpushed).toBe(1)
  })

  it('relit l’état quand la fenêtre reprend la main (commit fait dans un terminal)', async () => {
    const { result } = renderHook(() => useWorktreeCycle('c1', 0))
    await waitFor(() => expect(result.current.info?.ahead).toBe(1))
    ahead = 3
    act(() => void window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(result.current.info?.ahead).toBe(3))
  })

  it('« Actualiser » demande au main de relire aussi `gh` (D7)', async () => {
    const { result, unmount } = renderHook(() => useWorktreeCycle('c1', 0))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]?.options).toBeUndefined()
    act(() => result.current.refresh(true))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]?.options).toEqual({ fresh: true })
    // Plus d'écoute une fois la vue fermée.
    unmount()
    expect(onEvent).toBeUndefined()
    window.dispatchEvent(new Event('focus'))
    expect(calls).toHaveLength(2)
  })

  it('une réponse plus ancienne n’écrase jamais une plus récente (remarque 8)', async () => {
    const answers: ((view: WorktreeCycleView) => void)[] = []
    window.api = {
      ...window.api,
      worktree: {
        info: () => new Promise<WorktreeCycleView>((resolve) => answers.push(resolve)),
        onForge: () => () => {}
      }
    } as unknown as Window['api']
    const { result } = renderHook(() => useWorktreeCycle('c1', 0))
    act(() => result.current.refresh())
    expect(answers).toHaveLength(2)
    // La deuxième relecture (récente) répond d'abord, la première (ancienne) ensuite.
    await act(async () => answers[1]?.({ ahead: 2 } as WorktreeCycleView))
    await act(async () => answers[0]?.({ ahead: 1 } as WorktreeCycleView))
    expect(result.current.info?.ahead).toBe(2)
  })
})

describe('useWorktreeCycle : la forge répond après coup (fiche 189)', () => {
  it('« worktree:forge » de cette conversation : l’état est relu ; d’une autre : rien', async () => {
    let forge: ((change: { id: string }) => void) | undefined
    let reads = 0
    window.api = {
      ...originalApi,
      worktree: {
        info: async () => {
          reads++
          return null
        },
        onForge: (listener: (change: { id: string }) => void) => {
          forge = listener
          return () => (forge = undefined)
        }
      },
      agent: { onEvent: () => () => {} }
    } as unknown as Window['api']
    renderHook(() => useWorktreeCycle('c1', 0))
    await waitFor(() => expect(reads).toBe(1))
    act(() => forge?.({ id: 'autre' }))
    expect(reads).toBe(1)
    act(() => forge?.({ id: 'c1' }))
    await waitFor(() => expect(reads).toBe(2))
  })
})
