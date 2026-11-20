import * as Tooltip from '@radix-ui/react-tooltip'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { ChildrenMergePlan } from '@shared/children-merge'
import { childRows, childrenOf } from '@shared/children-rows'
import type { TranscriptItem } from '@shared/transcript'
import type { ChildrenMergeActions } from '../thread/SubtasksMerge'
import { ChangesTab } from './ChangesTab'

const summary = (
  id: string,
  status: ConversationSummary['status'],
  mother = 'm'
): ConversationSummary => ({
  id,
  title: `Fille ${id}`,
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: `/depot/.worktrees/${id}`,
  updatedAt: '2026-10-29T18:00:00.000Z',
  status,
  draft: false,
  branch: `bobine/${id}`,
  startedFrom: { id: mother, title: 'Carnet' }
})
const started = (id: number, childId: string): TranscriptItem => ({
  kind: 'child-started',
  id,
  childId,
  title: `Fille ${childId}`,
  branch: `bobine/${childId}`,
  prompt: 'Fais',
  at: 1
})
const report = (id: number, childId: string): TranscriptItem => ({
  kind: 'child-report',
  id,
  childId,
  title: `Fille ${childId}`,
  outcome: 'done',
  branch: `bobine/${childId}`,
  files: [{ path: 'a.ts', added: 62, removed: 4 }],
  fileCount: 3,
  added: 62,
  removed: 4,
  excerpt: '12 tests passent.',
  at: 2
})
const MOTHER: TranscriptItem[] = [
  { kind: 'user', id: 1, text: 'Organise' },
  started(2, 'b'),
  started(3, 'a'),
  report(4, 'b'),
  {
    kind: 'child-recommendation',
    id: 5,
    childId: 'b',
    title: 'Fille b',
    ready: true,
    note: 'OK',
    at: 3
  }
]

describe('vue « Filles » de l’onglet Modifications (fiche 161)', () => {
  const api = window.api
  const reveal = vi.fn(async () => ({ kind: 'reveal' }))
  beforeEach(() => {
    window.api = {
      ...api,
      changes: { git: async () => ({ root: '/depot', branch: 'main', files: [] }) },
      fileLinks: { open: reveal },
      settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
    } as unknown as Window['api']
  })
  afterEach(() => {
    // Démonter avant de rendre `window.api` d'origine : un rendu tardif relancerait sinon les
    // effets contre une API sans `changes` (le `cleanup` global passe après ce hook).
    cleanup()
    window.api = api
    reveal.mockClear()
  })

  const tab = (children: ConversationSummary[], onOpen = vi.fn()) => (
    <Tooltip.Provider>
      <ChangesTab
        conversationId="m"
        workspace="/depot"
        items={MOTHER}
        childWorktrees={{ rows: childRows(children, { b: 'done' }, MOTHER), onOpen }}
      />
    </Tooltip.Provider>
  )

  it('filles directes seulement, dans l’ordre des lancements', () => {
    const all = [summary('a', 'busy'), summary('b', 'ready'), summary('pf', 'ready', 'a')]
    expect(childrenOf('m', all).map((c) => c.id)).toEqual(['a', 'b'])
    expect(childrenOf(null, all)).toEqual([])
    const rows = childRows(childrenOf('m', all), {}, MOTHER)
    expect(rows.map((r) => r.child.id)).toEqual(['b', 'a'])
    expect(rows[0]?.verdict).toMatchObject({ ready: true, stale: false })
    expect(rows[1]?.report).toBeUndefined()
  })

  it('sans fille : ni bouton ni vue', async () => {
    render(tab([]))
    await waitFor(() => screen.getByTestId('changes-view-git'))
    expect(screen.queryByTestId('changes-view-children')).toBeNull()
  })

  it('une ligne par fille : branche, compte rendu, recommandation, actions', async () => {
    const onOpen = vi.fn()
    render(tab([summary('a', 'busy'), summary('b', 'ready')], onOpen))
    // « Filles » avant « Git », qui n'apparaît qu'une fois le dépôt lu : rien ne se décale.
    const views = await waitFor(() => {
      const ids = screen.getAllByRole('tab').map((b) => b.dataset.testid)
      expect(ids).toContain('changes-view-git')
      return ids
    })
    expect(views).toEqual([
      'changes-view-conversation',
      'changes-view-children',
      'changes-view-git'
    ])
    fireEvent.click(screen.getByTestId('changes-view-children'))
    expect(screen.getByTestId('changes-view-children').textContent).toBe('Travaux 2')
    const rows = screen.getAllByTestId('child-worktree')
    expect(rows.map((r) => [r.dataset.id, r.dataset.state])).toEqual([
      ['b', 'unread'],
      ['a', 'running']
    ])
    expect(rows[0]?.textContent).toContain('bobine/b')
    expect(rows[0]?.textContent).toContain('3 fichiers +62 −4')
    expect(
      rows[0]?.querySelector('[data-testid=subtask-recommendation]')?.getAttribute('data-state')
    ).toBe('ready')
    fireEvent.click(screen.getAllByTestId('child-worktree-reveal')[1] ?? document.body)
    expect(reveal).toHaveBeenCalledWith('a', '.', { reveal: true })
    fireEvent.click(screen.getAllByTestId('child-worktree-open')[0] ?? document.body)
    expect(onOpen).toHaveBeenCalledWith('b')
    // Aucun éditeur installé (préparation des tests) : pas de bouton.
    expect(screen.queryByTestId('child-worktree-editor')).toBeNull()
  })

  it('fusionnée : « Fusionnée » comme la carte « Sous-tâches », la recommandation s’efface (fiche 258, D11)', async () => {
    // Ce que le main lit des branches : tout le travail de `b` est dans `main`.
    const plan: ChildrenMergePlan = {
      base: 'main',
      children: [
        {
          id: 'b',
          title: 'Fille b',
          branch: 'bobine/b',
          base: 'main',
          state: 'merged',
          files: [],
          dirty: 0
        },
        {
          id: 'a',
          title: 'Fille a',
          branch: 'bobine/a',
          base: 'main',
          state: 'ready',
          files: ['x.ts'],
          dirty: 0
        }
      ],
      overlaps: [],
      running: false
    }
    const actions = {
      plan: vi.fn(async () => plan),
      start: vi.fn(),
      stop: vi.fn(),
      commitMain: vi.fn(),
      abort: vi.fn(),
      openGit: vi.fn()
    } satisfies ChildrenMergeActions
    const items: TranscriptItem[] = [
      ...MOTHER,
      // La mère avait recommandé `a` aussi ; elle est encore à fusionner.
      {
        kind: 'child-recommendation',
        id: 6,
        childId: 'a',
        title: 'Fille a',
        ready: true,
        note: 'OK',
        at: 4
      },
      {
        kind: 'children-merge',
        id: 7,
        runId: 'run',
        base: 'main',
        cleanup: false,
        status: 'done',
        startedAt: 5,
        endedAt: 6,
        rows: [{ childId: 'b', title: 'Fille b', branch: 'bobine/b', state: 'merged' }]
      }
    ]
    const children = [summary('a', 'ready'), summary('b', 'ready')]
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="m"
          workspace="/depot"
          items={items}
          childWorktrees={{
            rows: childRows(children, {}, items),
            merge: { motherId: 'm', items, actions },
            onOpen: vi.fn()
          }}
        />
      </Tooltip.Provider>
    )
    fireEvent.click(screen.getByTestId('changes-view-children'))
    const row = (id: string) =>
      screen.getAllByTestId('child-worktree').find((r) => r.dataset.id === id)
    await waitFor(() =>
      expect(
        row('b')?.querySelector('[data-testid=subtask-merge-state]')?.getAttribute('data-state')
      ).toBe('merged')
    )
    expect(actions.plan).toHaveBeenCalledWith('m')
    expect(row('b')?.textContent).toContain('fusionné')
    expect(row('b')?.querySelector('[data-testid=subtask-recommendation]')).toBeNull()
    // `a` n'est pas fusionnée : sa recommandation reste.
    expect(row('a')?.querySelector('[data-testid=subtask-merge-state]')).toBeNull()
    expect(
      row('a')?.querySelector('[data-testid=subtask-recommendation]')?.getAttribute('data-state')
    ).toBe('ready')
  })

  it('deux cartes, deux fusions : chaque ligne lit la dernière qui la touche (fiche 264)', async () => {
    // `b` fusionnée et nettoyée depuis sa carte (plus lue par le main) ; `a` ensuite, depuis une autre.
    const plan: ChildrenMergePlan = {
      base: 'main',
      children: [
        {
          id: 'a',
          title: 'Fille a',
          branch: 'bobine/a',
          base: 'main',
          state: 'merged',
          files: [],
          dirty: 0
        }
      ],
      overlaps: [],
      running: false
    }
    const actions = {
      plan: vi.fn(async () => plan),
      start: vi.fn(),
      stop: vi.fn(),
      commitMain: vi.fn(),
      abort: vi.fn(),
      openGit: vi.fn()
    } satisfies ChildrenMergeActions
    const merge = (id: number, childId: string, cleaned: boolean): TranscriptItem => ({
      kind: 'children-merge',
      id,
      runId: `run-${childId}`,
      base: 'main',
      cleanup: cleaned,
      status: 'done',
      startedAt: id,
      endedAt: id,
      rows: [
        {
          childId,
          title: `Fille ${childId}`,
          branch: `bobine/${childId}`,
          state: 'merged',
          ...(cleaned ? { cleaned } : {})
        }
      ]
    })
    const items: TranscriptItem[] = [...MOTHER, merge(7, 'b', true), merge(8, 'a', false)]
    const children = [summary('a', 'ready'), { ...summary('b', 'ready'), archived: true }]
    render(
      <Tooltip.Provider>
        <ChangesTab
          conversationId="m"
          workspace="/depot"
          items={items}
          childWorktrees={{
            rows: childRows(children, {}, items),
            merge: { motherId: 'm', items, actions },
            onOpen: vi.fn()
          }}
        />
      </Tooltip.Provider>
    )
    fireEvent.click(screen.getByTestId('changes-view-children'))
    const badge = (id: string) =>
      screen
        .getAllByTestId('child-worktree')
        .find((r) => r.dataset.id === id)
        ?.querySelector('[data-testid=subtask-merge-state]')
    await waitFor(() => expect(badge('a')?.getAttribute('data-state')).toBe('merged'))
    // Avant : seule la dernière fusion du fil comptait, `b` restait sans rien.
    expect(badge('b')?.getAttribute('data-state')).toBe('merged')
    expect(badge('b')?.textContent).toBe('fusionné · nettoyé')
  })

  it('fille arrêtée par ■ : « Arrêtée » dans la vue aussi (fiche 258, D4)', () => {
    render(tab([{ ...summary('a', 'ready'), turnStopped: true }]))
    fireEvent.click(screen.getByTestId('changes-view-children'))
    expect(screen.getByTestId('child-worktree').dataset.state).toBe('stopped')
    expect(
      screen
        .getByTestId('child-worktree-state')
        .querySelector('.child-state')
        ?.getAttribute('data-state')
    ).toBe('stopped')
  })

  it('cycle de vie : une fille en plus, son état suivi, puis plus aucune : la vue se ferme', async () => {
    const { rerender } = render(tab([summary('b', 'busy')]))
    fireEvent.click(screen.getByTestId('changes-view-children'))
    expect(screen.getAllByTestId('child-worktree')).toHaveLength(1)
    rerender(tab([summary('a', 'busy'), summary('b', 'ready')]))
    expect(screen.getByTestId('changes-view-children').textContent).toBe('Travaux 2')
    expect(screen.getAllByTestId('child-worktree').map((r) => r.dataset.state)).toEqual([
      'unread',
      'running'
    ])
    rerender(tab([]))
    expect(screen.queryByTestId('children-view')).toBeNull()
    expect(screen.queryByTestId('changes-view-children')).toBeNull()
    expect(screen.getByTestId('changes-view-conversation').getAttribute('aria-selected')).toBe(
      'true'
    )
  })
})
