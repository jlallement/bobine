import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PrOutcome, WorktreeCycleView } from '@shared/worktree-cycle'
import { WorktreeBar } from './WorktreeBar'

/** Barre d'un worktree GitLab avec un commit à proposer (fiche 189, relecture du tech lead). */
const view = (over: Partial<WorktreeCycleView> = {}): WorktreeCycleView => ({
  title: 'Import CSV',
  branch: 'bobine/x',
  path: '/repo/.worktrees/x',
  root: '/repo',
  base: 'abc1234',
  baseShort: 'abc1234',
  baseBranch: 'main',
  dirty: 0,
  ahead: 1,
  behind: 0,
  commits: ['feat: x'],
  merged: false,
  pr: { ok: true, remote: 'origin', noun: 'mr' },
  ...over
})

/** `pullRequest` qui répond quand l'essai le décide. */
function pendingPullRequest() {
  let answer: ((outcome: PrOutcome) => void) | undefined
  const pullRequest = vi.fn(
    () => new Promise<PrOutcome>((resolve) => (answer = (outcome) => resolve(outcome)))
  )
  window.api.worktree = { ...window.api.worktree, pullRequest }
  return { resolve: (outcome: PrOutcome) => answer?.(outcome) }
}

const MR: PrOutcome = {
  url: 'https://gl.test/demo/app/-/merge_requests/1',
  existed: false,
  noun: 'mr'
}

async function openMr() {
  fireEvent.click(screen.getByTestId('worktree-pr'))
  fireEvent.click(screen.getByTestId('worktree-pr-confirm'))
  await waitFor(() => expect(window.api.worktree.pullRequest).toHaveBeenCalled())
}

describe('issue unique de la barre du worktree (fiche 189)', () => {
  it('lien court et cliquable, adresse complète en bulle', async () => {
    const pending = pendingPullRequest()
    render(<WorktreeBar conversationId="c1" info={view()} selected={[]} onChanged={() => {}} />)
    await openMr()
    await act(async () => pending.resolve(MR))
    const link = await screen.findByTestId('worktree-pr-link')
    expect(link.textContent).toBe('demo/app!1')
    expect(link.getAttribute('href')).toBe(MR.url)
    expect(link.getAttribute('title')).toBe(MR.url)
  })

  it('« Actualiser » pendant la création : le lien de la MR arrive quand même', async () => {
    const pending = pendingPullRequest()
    const { rerender } = render(
      <WorktreeBar
        conversationId="c1"
        info={view()}
        selected={[]}
        onChanged={() => {}}
        resetKey={0}
      />
    )
    await openMr()
    rerender(
      <WorktreeBar
        conversationId="c1"
        info={view()}
        selected={[]}
        onChanged={() => {}}
        resetKey={1}
      />
    )
    await act(async () => pending.resolve(MR))
    expect((await screen.findByTestId('worktree-pr-link')).textContent).toBe('demo/app!1')
  })

  it('réponse arrivée après un changement de worktree : jamais affichée dans l’autre', async () => {
    const pending = pendingPullRequest()
    const { rerender } = render(
      <WorktreeBar conversationId="c1" info={view()} selected={[]} onChanged={() => {}} />
    )
    await openMr()
    rerender(
      <WorktreeBar
        conversationId="c2"
        info={view({ path: '/repo/.worktrees/y', branch: 'bobine/y' })}
        selected={[]}
        onChanged={() => {}}
      />
    )
    await act(async () => pending.resolve(MR))
    expect(screen.queryByTestId('worktree-note')).toBeNull()
    expect(screen.queryByTestId('worktree-error')).toBeNull()
  })

  it('erreur de commit : reste quand la forge change d’état ; « Actualiser » l’efface', async () => {
    const commit = vi.fn(async () => {
      throw new Error('commit refusé')
    })
    window.api.worktree = { ...window.api.worktree, commit }
    const files = [{ path: 'a.txt', status: 'modified' as const }]
    const { rerender } = render(
      <WorktreeBar conversationId="c1" info={view()} selected={files} onChanged={() => {}} />
    )
    fireEvent.click(screen.getByTestId('worktree-commit'))
    fireEvent.click(screen.getByTestId('worktree-commit-confirm'))
    await screen.findByTestId('worktree-error')
    const down = view({ pr: { ok: false, reason: 'unreachable', noun: 'mr', host: 'gl.test' } })
    rerender(<WorktreeBar conversationId="c1" info={down} selected={files} onChanged={() => {}} />)
    expect(screen.getByTestId('worktree-error').textContent).toContain('commit refusé')
    // Une seule issue, et la raison d'attente du bouton en plus.
    expect(screen.queryByTestId('worktree-note')).toBeNull()
    expect(screen.getByTestId('worktree-pr-blocker')).toBeTruthy()
    rerender(
      <WorktreeBar
        conversationId="c1"
        info={down}
        selected={files}
        onChanged={() => {}}
        resetKey={1}
      />
    )
    expect(screen.queryByTestId('worktree-error')).toBeNull()
  })

  it('erreur de la forge : part quand l’état de la forge change', async () => {
    const pullRequest = vi.fn(async () => {
      throw new Error('gl.test ne répond pas')
    })
    window.api.worktree = { ...window.api.worktree, pullRequest }
    const { rerender } = render(
      <WorktreeBar conversationId="c1" info={view()} selected={[]} onChanged={() => {}} />
    )
    await openMr()
    await screen.findByTestId('worktree-error')
    const unknown = view({ pr: { ok: false, reason: 'unknown-forge', host: 'git.test' } })
    rerender(<WorktreeBar conversationId="c1" info={unknown} selected={[]} onChanged={() => {}} />)
    expect(screen.queryByTestId('worktree-error')).toBeNull()
    expect(screen.queryByTestId('worktree-pr')).toBeNull()
  })

  it('rien à proposer : bouton grisé, l’explication en bulle', () => {
    render(
      <WorktreeBar
        conversationId="c1"
        info={view({ ahead: 0, commits: [] })}
        selected={[]}
        onChanged={() => {}}
      />
    )
    const button = screen.getByTestId('worktree-pr') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.title).toBe('Rien à pousser : aucun commit sur la branche.')
  })
})
