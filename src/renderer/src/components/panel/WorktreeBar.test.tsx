/**
 * Barre du worktree avec une PR suivie (fiche 176) : remplaçant des vérifications de composant de
 * la suite e2e `pr-ci` (inventaire B, #3 et #16). Le suivi du main est simulé par `window.api.pr`
 * (`status`, puis `onChanged` comme le pousserait la relève) ; la poussée, la fusion et le
 * nettoyage réels (faux `gh`, dépôt nu) restent en e2e.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrOutcome, WorktreeCycleView } from '@shared/worktree-cycle'
import type { PrTrack, PrView } from '@shared/pr-tracking'
import { WorktreeBar } from './WorktreeBar'

const PR_URL = 'https://github.com/o/r/pull/7'

const view = (over: Partial<WorktreeCycleView> = {}): WorktreeCycleView => ({
  title: 'Fais les modifications',
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
  unpushed: 0,
  merged: false,
  pr: { ok: true, remote: 'origin' },
  ...over
})
const pr = (over: Partial<PrView> = {}): PrView => ({
  number: 7,
  url: PR_URL,
  title: 'Fais les modifications',
  state: 'open',
  draft: false,
  head: 'h1',
  checks: [{ name: 'CI / test', state: 'pending' }],
  summary: 'pending',
  comments: 0,
  mergeable: 'mergeable',
  base: 'main',
  mergeState: 'clean',
  ...over
})
const found = (view: PrView): PrTrack => ({
  status: 'found',
  pr: view,
  checkedAt: 0,
  options: { autoFix: false, autoMerge: false }
})

const original = window.api
/** Suivi de la PR par le main : état de départ, puis changements poussés. */
function trackPr(initial: PrTrack) {
  let push: (change: { id: string; track: PrTrack }) => void = () => {}
  window.api = {
    ...original,
    pr: {
      ...original.pr,
      status: async () => initial,
      onChanged: (listener: typeof push) => {
        push = listener
        return () => {}
      }
    },
    worktree: {
      ...original.worktree,
      pullRequest: vi.fn(async (): Promise<PrOutcome> => ({ url: PR_URL, existed: false })),
      cleanup: vi.fn(async () => ({}))
    }
  } as unknown as Window['api']
  return { push: (track: PrTrack) => act(() => push({ id: 'c1', track })) }
}
afterEach(() => {
  window.api = original
})

const bar = (info: WorktreeCycleView) =>
  render(<WorktreeBar conversationId="c1" info={info} selected={[]} onChanged={() => {}} />)

describe('barre du worktree et PR suivie (fiche 176)', () => {
  it('PR ouverte : la note du lien n’est pas répétée sous la carte, pas de bouton sans rien à pousser', async () => {
    const main = trackPr({ status: 'none', checkedAt: 0 })
    bar(view({ unpushed: undefined }))
    // Avant la PR : « Ouvrir une PR », puis la note avec le lien.
    fireEvent.click(screen.getByTestId('worktree-pr'))
    fireEvent.click(screen.getByTestId('worktree-pr-confirm'))
    expect(await screen.findByTestId('worktree-pr-link')).toBeTruthy()
    // La relève trouve la PR : la carte porte le lien, la note s'efface.
    main.push(found(pr()))
    expect(await screen.findByTestId('pr-card')).toBeTruthy()
    expect(screen.queryByTestId('worktree-pr-link')).toBeNull()
  })

  it('PR ouverte, rien à pousser : pas de bouton ; un commit à pousser : « Pousser vers la PR »', async () => {
    trackPr(found(pr()))
    const { rerender } = bar(view({ unpushed: 0 }))
    await screen.findByTestId('pr-card')
    expect(screen.queryByTestId('worktree-pr')).toBeNull()
    rerender(
      <WorktreeBar
        conversationId="c1"
        info={view({ unpushed: 1, ahead: 2 })}
        selected={[]}
        onChanged={() => {}}
      />
    )
    await waitFor(() =>
      expect(screen.getByTestId('worktree-pr').textContent).toBe('Pousser vers la PR')
    )
  })

  it('PR fusionnée : « Nettoyer » ; la question dit que la branche part aussi sur GitHub', async () => {
    trackPr(found(pr({ state: 'merged', summary: 'passed', checks: [] })))
    bar(view())
    fireEvent.click(await screen.findByTestId('worktree-cleanup'))
    const ask = screen.getByTestId('worktree-cleanup-ask')
    expect(ask.textContent).toContain('GitHub')
    expect(ask.querySelector('code')?.textContent).toBe('bobine/x')
    // Rien n'est supprimé avant la confirmation.
    expect(window.api.worktree.cleanup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('worktree-cleanup-confirm'))
    await waitFor(() => expect(window.api.worktree.cleanup).toHaveBeenCalledWith('c1'))
  })

  it('fusionnée en local, sans PR : la question ne parle pas de GitHub', async () => {
    trackPr({ status: 'none', checkedAt: 0 })
    bar(view({ merged: true, ahead: 0, commits: [] }))
    fireEvent.click(screen.getByTestId('worktree-cleanup'))
    expect(screen.getByTestId('worktree-cleanup-ask').textContent).not.toContain('GitHub')
  })
})
