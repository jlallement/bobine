import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorktreeCleaned, rememberCleaned, useCleanedNote } from './WorktreeCleaned'

afterEach(() => {
  vi.useRealTimers()
})

const deleted = { branch: 'bobine/x', remote: { deleted: true as const } }

describe('note du nettoyage (fiche 176, 0.9.1, remarque 7)', () => {
  it('reprise une fois par l’onglet qui suit, puis plus par personne', () => {
    rememberCleaned(deleted)
    const next = renderHook(() => useCleanedNote('c2'))
    expect(next.result.current.cleaned).toEqual(deleted)
    const later = renderHook(() => useCleanedNote('c3'))
    expect(later.result.current.cleaned).toBeNull()
  })

  it('pas reprise après quelques secondes : elle ne fuit pas vers une autre conversation', () => {
    vi.useFakeTimers()
    rememberCleaned(deleted)
    vi.advanceTimersByTime(60_000)
    expect(renderHook(() => useCleanedNote('c4')).result.current.cleaned).toBeNull()
  })

  it('attachée à sa conversation, oubliée quand elle change, masquable', () => {
    const { result, rerender } = renderHook(({ id }) => useCleanedNote(id), {
      initialProps: { id: 'c5' }
    })
    act(() => rememberCleaned(deleted))
    expect(result.current.cleaned).toEqual(deleted)
    rerender({ id: 'c6' })
    expect(result.current.cleaned).toBeNull()
    rerender({ id: 'c5' })
    expect(result.current.cleaned).toEqual(deleted)
    act(() => result.current.dismiss())
    expect(result.current.cleaned).toBeNull()
  })

  it('dit la branche supprimée, gardée, ou l’erreur ; « Masquer »', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<WorktreeCleaned {...deleted} onDismiss={onDismiss} />)
    expect(screen.getByTestId('worktree-cleaned').textContent).toContain(
      'supprimée aussi sur GitHub'
    )
    fireEvent.click(screen.getByTestId('worktree-cleaned-dismiss'))
    expect(onDismiss).toHaveBeenCalled()
    rerender(<WorktreeCleaned branch="bobine/x" remote={{ kept: 'moved' }} onDismiss={onDismiss} />)
    expect(screen.getByTestId('worktree-cleaned').dataset['remote']).toBe('kept')
    rerender(
      <WorktreeCleaned
        branch="bobine/x"
        remote={{ error: 'Protected branch' }}
        onDismiss={onDismiss}
      />
    )
    expect(screen.getByTestId('worktree-cleaned-error').textContent).toContain('Protected branch')
  })
})
