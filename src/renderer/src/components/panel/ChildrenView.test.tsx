import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { childRows, childrenOf } from '@shared/children-rows'
import type { TranscriptItem } from '@shared/transcript'
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
    expect(screen.getByTestId('changes-view-children').textContent).toBe('Filles 2')
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

  it('cycle de vie : une fille en plus, son état suivi, puis plus aucune : la vue se ferme', async () => {
    const { rerender } = render(tab([summary('b', 'busy')]))
    fireEvent.click(screen.getByTestId('changes-view-children'))
    expect(screen.getAllByTestId('child-worktree')).toHaveLength(1)
    rerender(tab([summary('a', 'busy'), summary('b', 'ready')]))
    expect(screen.getByTestId('changes-view-children').textContent).toBe('Filles 2')
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
