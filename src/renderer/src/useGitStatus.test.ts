import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitStatus } from '@shared/git'
import { useGitStatus } from './useGitStatus'

describe('puce de branche relue après un commit de Bobine (fiche 246, D4)', () => {
  const api = window.api
  afterEach(() => {
    window.api = api
  })

  it('« Committer puis fusionner » ailleurs : le point « non commité » disparaît sans tour de l’agent', async () => {
    let status = { branch: 'main', dirty: true } as unknown as GitStatus
    const read = vi.fn(async () => status)
    let changed: ((change: { conversationIds: string[] }) => void) | undefined
    window.api = {
      ...api,
      git: { status: read },
      changes: {
        onGitChanged: (listener: typeof changed) => {
          changed = listener
          return () => (changed = undefined)
        }
      }
    } as unknown as Window['api']
    const { result } = renderHook(() => useGitStatus('c', false))
    await waitFor(() => expect(result.current).toEqual(status))
    status = { branch: 'main', dirty: false } as unknown as GitStatus
    act(() => changed?.({ conversationIds: ['autre'] }))
    expect(read).toHaveBeenCalledTimes(1)
    act(() => changed?.({ conversationIds: ['c'] }))
    await waitFor(() => expect(result.current).toEqual({ branch: 'main', dirty: false }))
  })
})
