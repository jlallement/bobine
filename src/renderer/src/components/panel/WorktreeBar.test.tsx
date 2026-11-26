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

  it('modification non commitée : la question le dit, « Garder » est le bouton par défaut (N1)', async () => {
    trackPr({ status: 'none', checkedAt: 0 })
    bar(view({ merged: true, ahead: 0, commits: [], dirty: 1 }))
    fireEvent.click(screen.getByTestId('worktree-cleanup'))
    const ask = screen.getByTestId('worktree-cleanup-ask')
    expect(ask.textContent?.replace(/[\u00a0\u202f]/g, ' ')).toContain(
      '1 fichier non commité serait perdu'
    )
    const keep = screen.getByTestId('worktree-cleanup-keep')
    expect(keep.className).toContain('primary')
    expect(document.activeElement).toBe(keep)
    fireEvent.click(keep)
    expect(window.api.worktree.cleanup).not.toHaveBeenCalled()
  })

  it('rien à perdre : pas d’avertissement', async () => {
    trackPr({ status: 'none', checkedAt: 0 })
    bar(view({ merged: true, ahead: 0, commits: [], dirty: 0 }))
    fireEvent.click(screen.getByTestId('worktree-cleanup'))
    expect(screen.queryByTestId('worktree-cleanup-loss')).toBeNull()
  })

  it('fusionnée en local, sans PR : la question ne parle pas de GitHub', async () => {
    trackPr({ status: 'none', checkedAt: 0 })
    bar(view({ merged: true, ahead: 0, commits: [] }))
    fireEvent.click(screen.getByTestId('worktree-cleanup'))
    expect(screen.getByTestId('worktree-cleanup-ask').textContent).not.toContain('GitHub')
  })
})

/**
 * Barre d'un worktree ouvert depuis le menu du dossier : remplaçant des vérifications de composant
 * n° 5 et 7 de la suite e2e `worktree-cycle` (inventaire A). La case par fichier est celle de la
 * liste de la vue Git (`ChangesTab.test.tsx`).
 */
describe('barre du worktree : départ et fusion (fiches 110, 123)', () => {
  it('départ rappelé (branche, commit), avertissement sur le dossier d’origine', async () => {
    trackPr({ status: 'unavailable' })
    bar(view({ dirtyAtStart: 2, baseSubject: 'Merge fiche 114' }))
    const start = screen.getByTestId('worktree-start')
    expect(start.textContent).toContain('bobine/x')
    expect(start.textContent).toContain('main')
    expect(start.textContent).toContain('abc1234')
    expect(start.textContent).toContain('Merge fiche 114')
    expect(screen.getByTestId('worktree-dirty-at-start').textContent).toContain('2')
  })

  it('« Fusionner » bloqué tant qu’il reste du non commité, la raison au survol et au clavier', async () => {
    trackPr({ status: 'unavailable' })
    const merging = vi.fn()
    window.api.worktree = { ...window.api.worktree, merge: merging }
    const { rerender } = bar(view({ dirty: 2 }))
    const merge = screen.getByTestId('worktree-merge') as HTMLButtonElement
    const why = 'Committez d’abord\u00a0: 2 modifications non commitées.'
    // Fiche 287 : atteignable au clavier (pas `disabled`), sans effet, et il dit pourquoi.
    expect(merge.disabled).toBe(false)
    expect(merge.getAttribute('aria-disabled')).toBe('true')
    expect(merge.getAttribute('aria-description')).toBe(why)
    fireEvent.click(merge)
    expect(merging).not.toHaveBeenCalled()
    act(() => merge.focus())
    await waitFor(() => expect(screen.getAllByRole('tooltip')[0]?.textContent).toBe(why))
    rerender(
      <WorktreeBar
        conversationId="c1"
        info={view({ dirty: 0 })}
        selected={[]}
        onChanged={() => {}}
      />
    )
    expect((screen.getByTestId('worktree-merge') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('worktree-merge').hasAttribute('aria-disabled')).toBe(false)
  })

  it('fiche 289 : « Laisser l’agent résoudre » s’arrête à relire ; la fusion part sur « Fusionner dans main »', async () => {
    trackPr({ status: 'unavailable' })
    const resolve = vi.fn(async () => ({
      status: 'resolved' as const,
      files: ['README.md'],
      base: 'main'
    }))
    const merging = vi.fn(async () => ({ status: 'nothing' as const, base: 'main' }))
    window.api.worktree = { ...window.api.worktree, resolveWithAgent: resolve, merge: merging }
    bar(view({ merging: { files: ['README.md'] } }))
    fireEvent.click(screen.getByTestId('worktree-merge-resolve'))
    const note = await screen.findByTestId('worktree-note')
    expect(note.dataset['kind']).toBe('resolved')
    expect(note.textContent).toBe(
      'Conflit résolu par l’agent dans README.md, dans la branche : rien n’est entré dans main. Relisez la résolution (onglet Conversation, « Faire relire… »), puis fusionnez.'
    )
    expect(screen.queryByTestId('worktree-conflicts')).toBeNull()
    expect(merging).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('worktree-merge'))
    await waitFor(() => expect(merging).toHaveBeenCalledWith('c1'))
  })

  it('fiche 289 : résolution à relire dite par le main (fille, après un redémarrage)', () => {
    trackPr({ status: 'unavailable' })
    bar(view({ review: { files: ['README.md', 'src/a.ts'] } }))
    const note = screen.getByTestId('worktree-note')
    expect(note.dataset['kind']).toBe('resolved')
    expect(note.textContent).toContain('README.md et src/a.ts')
  })
})
