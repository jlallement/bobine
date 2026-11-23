import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { fireEvent, render as testingRender, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type {
  ChildrenMerge,
  ChildrenMergePlan,
  MergeCandidate,
  MergeRowState
} from '@shared/children-merge'
import type { TranscriptItem } from '@shared/transcript'
import { Transcript } from './Transcript'
import type { ChildrenMergeActions } from './SubtasksMerge'

function render(ui: ReactNode) {
  return testingRender(ui, { wrapper: Tooltip.Provider })
}

const child = (id: string): ConversationSummary => ({
  id,
  title: `Fille ${id}`,
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: `/tmp/${id}`,
  updatedAt: '2026-10-22T10:00:00.000Z',
  status: 'ready',
  draft: false,
  branch: `bobine/${id}`,
  startedFrom: { id: 'mere', title: 'Mère' }
})

const started = (id: number, childId: string): TranscriptItem => ({
  kind: 'child-started',
  id,
  childId,
  title: `Fille ${childId}`,
  prompt: 'Fais-le',
  at: 1
})

const candidate = (id: string, state: MergeCandidate['state'], files: string[] = []) => ({
  id,
  title: `Fille ${id}`,
  branch: `bobine/${id}`,
  base: 'main',
  state,
  files,
  dirty: 0
})

const plan = (children: MergeCandidate[], running = false): ChildrenMergePlan => ({
  base: 'main',
  children,
  overlaps: [],
  running
})

const merge = (
  status: ChildrenMerge['status'],
  states: MergeRowState[],
  extra: Partial<ChildrenMerge> = {}
): TranscriptItem => ({
  kind: 'children-merge',
  id: 10,
  runId: 'r1',
  base: 'main',
  cleanup: false,
  status,
  rows: states.map((state, i) => ({
    childId: ['a', 'b', 'c'][i] as string,
    title: `Fille ${['a', 'b', 'c'][i]}`,
    state
  })),
  startedAt: 1_000,
  ...extra
})

function view(items: TranscriptItem[], merging: ChildrenMergePlan) {
  const actions = {
    plan: vi.fn(async () => merging),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
    commitMain: vi.fn(async () => undefined),
    openGit: vi.fn()
  } satisfies ChildrenMergeActions
  render(
    <Transcript
      items={[started(1, 'a'), started(2, 'b'), started(3, 'c'), ...items]}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      subtasks={{
        children: [child('a'), child('b'), child('c')],
        attention: {},
        onOpen: vi.fn(),
        motherId: 'mere',
        merge: actions
      }}
    />
  )
  return actions
}

const text = (id: string) => screen.getByTestId(id).textContent
const badges = () =>
  screen.queryAllByTestId('subtask-merge-state').map((b) => b.dataset['state'] ?? '')

describe('Fusion de toutes les filles depuis la carte (fiche 120)', () => {
  it('pied de carte : phrase d’état, « Fusionner les N », « Puis nettoyer » en bascule', async () => {
    const actions = view(
      [],
      plan([
        candidate('a', 'ready', ['a']),
        candidate('b', 'ready', ['b']),
        candidate('c', 'running')
      ])
    )
    await waitFor(() => screen.getByTestId('subtasks-merge'))
    expect(actions.plan).toHaveBeenCalledWith('mere')
    expect(text('subtasks-merge-summary')).toBe(
      '2 travaux à fusionner ont répondu\u00a0; «\u00a0Fille c\u00a0» travaille encore.'
    )
    expect(text('subtasks-merge-start')).toBe('Fusionner les 2 dans main')
    const cleanup = screen.getByTestId('subtasks-merge-cleanup')
    expect(cleanup.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(cleanup)
    expect(cleanup.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('subtasks-merge-start'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a', 'b'], true))
    // L'élément `children-merge` du fil n'est pas affiché à sa place.
    expect(document.querySelectorAll('.subtasks')).toHaveLength(1)
  })

  it('rien de fini à fusionner : pas de pied', async () => {
    const actions = view([], plan([candidate('a', 'running'), candidate('b', 'empty')]))
    await waitFor(() => expect(actions.plan).toHaveBeenCalled())
    expect(screen.queryByTestId('subtasks-merge')).toBeNull()
  })

  it('en cours : état de chaque ligne, progression, « Arrêter »', async () => {
    const actions = view(
      [merge('running', ['merged', 'merging', 'pending'])],
      plan([candidate('a', 'merged'), candidate('b', 'ready'), candidate('c', 'ready')], true)
    )
    await waitFor(() => screen.getByTestId('subtasks-merge-progress'))
    expect(badges()).toEqual(['merged', 'merging', 'pending'])
    expect(text('subtasks-merge-progress')).toBe(
      'Fusion dans main, l’un après l’autre\u00a0: 1 sur 3 fait. Au premier conflit, le travail concerné le résout, puis la fusion reprend.'
    )
    fireEvent.click(screen.getByTestId('subtasks-merge-stop'))
    // L'« Arrêter » de cette fusion seulement (fiche 264).
    await waitFor(() => expect(actions.stop).toHaveBeenCalledWith('mere', 'r1'))
  })

  it('arrêt demandé : la fusion en cours finit, « Arrêter » grisé', async () => {
    view(
      [merge('stopping', ['resolving', 'pending', 'pending'])],
      plan([candidate('a', 'running'), candidate('b', 'ready'), candidate('c', 'ready')], true)
    )
    await waitFor(() => screen.getByTestId('subtasks-merge-progress'))
    expect(text('subtasks-merge-progress')).toBe('Arrêt après la fusion en cours…')
    expect(screen.getByTestId('subtasks-merge-stop').hasAttribute('disabled')).toBe(true)
    expect(badges()).toEqual(['resolving', 'pending', 'pending'])
  })

  it('finie : « 2 travaux fusionnés dans main en 12 s », déjà à jour, nettoyées', async () => {
    const done = merge('done', ['merged', 'merged', 'up-to-date'], {
      cleanup: true,
      endedAt: 13_000
    })
    if (done.kind === 'children-merge') for (const row of done.rows) row.cleaned = true
    view([done], plan([]))
    await waitFor(() => screen.getByTestId('subtasks-merge-result'))
    expect(text('subtasks-merge-result')).toBe(
      '2 travaux fusionnés dans main en 12 s. 1 déjà à jour. Conversations archivées, dossiers de travail et branches supprimés.'
    )
    expect(badges()).toEqual(['merged', 'merged', 'up-to-date'])
    expect(screen.queryByTestId('subtasks-merge-start')).toBeNull()
  })

  it('arrêtée sur un conflit : le dit, « Réessayer », « Abandonner », « Voir le conflit »', async () => {
    const stopped = merge('conflict', ['merged', 'conflict', 'pending'])
    if (stopped.kind === 'children-merge') {
      stopped.rows = stopped.rows.map((r) =>
        r.state === 'conflict' ? { ...r, files: ['README.md'] } : r
      )
    }
    const actions = view(
      [stopped],
      plan([candidate('a', 'merged'), candidate('b', 'conflict'), candidate('c', 'ready')])
    )
    await waitFor(() => screen.getByTestId('subtasks-merge-retry'))
    expect(text('subtasks-merge-result')).toBe(
      'Fusion arrêtée sur «\u00a0Fille b\u00a0»\u00a0: il reste des conflits dans README.md.'
    )
    expect(badges()).toEqual(['merged', 'conflict', 'pending'])
    expect(screen.queryByTestId('subtasks-merge-start')).toBeNull()
    fireEvent.click(screen.getByTestId('subtasks-merge-retry'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['b', 'c'], false))
    // Les boutons restent désactivés tant que « Réessayer » n'a pas fini : un clic trop tôt sur
    // « Abandonner » tombait sur un bouton désactivé (perdu sous charge). On attend qu'il revienne.
    await waitFor(() =>
      expect((screen.getByTestId('subtasks-merge-abort') as HTMLButtonElement).disabled).toBe(false)
    )
    fireEvent.click(screen.getByTestId('subtasks-merge-abort'))
    await waitFor(() => expect(actions.abort).toHaveBeenCalledWith('b'))
    fireEvent.click(screen.getByTestId('subtasks-merge-show'))
    expect(actions.openGit).toHaveBeenCalledWith('b')
  })

  it('arrêtée sur un conflit, branches lues pendant la fusion : ni « Réessayer » ni « Abandonner »', async () => {
    // Relevé en CI macOS (fiche 250) : le plan montré avait été lu pendant que le travail résolvait
    // son conflit ; « Réessayer » se fiait à un « conflit » de cette lecture-là, puis disparaissait.
    // Seule une lecture faite après l'arrêt de cette fusion dit le conflit qui reste.
    const stopped = merge('conflict', ['merged', 'conflict', 'pending'])
    const during = {
      ...plan(
        [candidate('a', 'merged'), candidate('b', 'conflict'), candidate('c', 'ready')],
        true
      ),
      runId: 'r1'
    }
    const actions = view([stopped], during)
    // Le plan lu est appliqué : soit la reprise (à tort), soit la phrase d'état.
    await waitFor(() =>
      expect(
        screen.queryByTestId('subtasks-merge-retry') ??
          screen.queryByTestId('subtasks-merge-summary')
      ).not.toBeNull()
    )
    expect(actions.plan).toHaveBeenCalled()
    expect(screen.queryByTestId('subtasks-merge-retry')).toBeNull()
    expect(screen.queryByTestId('subtasks-merge-abort')).toBeNull()
    expect(screen.queryByTestId('subtasks-merge-show')).toBeNull()
  })

  it('fusion interrompue par la fermeture de l’app : dite, lignes en cours remises en attente', async () => {
    view(
      [merge('running', ['merged', 'merging', 'pending'])],
      plan([candidate('a', 'merged'), candidate('b', 'ready'), candidate('c', 'ready')])
    )
    await waitFor(() => screen.getByTestId('subtasks-merge-result'))
    expect(text('subtasks-merge-result')).toBe(
      'Fusion interrompue par la fermeture de l’app\u00a0: 1 travail fusionné dans main.'
    )
    expect(badges()).toEqual(['merged', 'pending', 'pending'])
    expect(text('subtasks-merge-start')).toBe('Fusionner les 2 dans main')
  })
})

describe('Fusion refusée : dossier principal non commité (fiche 123)', () => {
  const dirty = (files: { path: string; status: 'modified' | 'untracked' }[]) => ({
    ...plan([candidate('a', 'ready', ['a']), candidate('b', 'ready', ['b'])]),
    blocked: { reason: 'main-dirty' as const, path: '/repo', base: 'main', title: 'Mère', files }
  })

  it('dit pourquoi avec les fichiers ; pas de « Fusionner » ; « Mettre de côté » part avec stash', async () => {
    const actions = view(
      [],
      dirty([
        { path: 'public/index.html', status: 'modified' },
        { path: 'public/style.css', status: 'modified' }
      ])
    )
    await waitFor(() => screen.getByTestId('main-dirty'))
    expect(text('subtasks-merge-summary')).toBe(
      'Les 2 travaux à fusionner ont répondu et ne touchent pas les mêmes fichiers.'
    )
    expect(text('main-dirty-title')).toBe(
      'Fusion refusée\u00a0: le dossier principal a 2 modifications non commitées.'
    )
    expect(screen.getAllByTestId('main-dirty-file').map((f) => f.textContent)).toEqual([
      'public/index.html',
      'public/style.css'
    ])
    expect(text('main-dirty-why')).toBe(
      'La fusion dans main pourrait les écraser. Committez-les d’abord, ou mettez-les de côté\u00a0: elles reviendront après la fusion.'
    )
    expect(screen.queryByTestId('subtasks-merge-start')).toBeNull()
    fireEvent.click(screen.getByTestId('subtasks-merge-cleanup'))
    fireEvent.click(screen.getByTestId('main-dirty-stash'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a', 'b'], true, true))
  })

  it('« Committer d’abord » : message proposé modifiable, commit, puis la fusion part', async () => {
    const actions = view(
      [],
      dirty([
        { path: 'README.md', status: 'modified' },
        { path: 'note.txt', status: 'untracked' }
      ])
    )
    await waitFor(() => screen.getByTestId('main-dirty'))
    fireEvent.click(screen.getByTestId('main-dirty-commit'))
    await waitFor(() =>
      expect(
        (screen.getByTestId('main-dirty-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    const message = screen.getByTestId('main-dirty-commit-message') as HTMLTextAreaElement
    expect(message.value).toBe(
      'docs: update README.md and note.txt\n\n- README.md\n- note.txt (new)'
    )
    fireEvent.change(message, { target: { value: 'docs: notes de la mère' } })
    fireEvent.click(screen.getByTestId('main-dirty-commit-confirm'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a', 'b'], false))
    expect(actions.commitMain).toHaveBeenCalledWith('mere', {
      message: 'docs: notes de la mère',
      files: ['README.md', 'note.txt']
    })
  })

  it('au-delà de 6 fichiers : « … et N autres »', async () => {
    view(
      [],
      dirty(
        Array.from({ length: 9 }, (_, i) => ({ path: `f${i}.txt`, status: 'modified' as const }))
      )
    )
    await waitFor(() => screen.getByTestId('main-dirty'))
    expect(screen.getAllByTestId('main-dirty-file')).toHaveLength(6)
    expect(text('main-dirty-more')).toBe('… et 3 autres')
  })

  it('mise de côté dite pendant la fusion, puis à la fin : revenue, ou restée dans git stash', async () => {
    const kept = merge('running', ['merging', 'pending'], { stash: { state: 'kept', count: 2 } })
    view([kept], plan([candidate('a', 'ready'), candidate('b', 'ready')], true))
    await waitFor(() => screen.getByTestId('subtasks-merge-progress'))
    expect(text('subtasks-merge-stash')).toBe(
      'Vos 2 modifications sont mises de côté le temps de la fusion.'
    )
  })

  it('fin : modifications revenues', async () => {
    view(
      [
        merge('done', ['merged', 'merged'], {
          endedAt: 13_000,
          stash: { state: 'restored', count: 2 }
        })
      ],
      plan([])
    )
    await waitFor(() => screen.getByTestId('subtasks-merge-result'))
    expect(text('subtasks-merge-result')).toBe(
      '2 travaux fusionnés dans main en 12 s. Vos 2 modifications mises de côté sont revenues.'
    )
  })

  it('fin : remise en conflit, l’entrée reste dans git stash', async () => {
    view(
      [
        merge('done', ['merged'], {
          endedAt: 13_000,
          stash: { state: 'failed', count: 1, ref: 'a1b2c3d', conflicts: ['README.md'] }
        })
      ],
      plan([])
    )
    await waitFor(() => screen.getByTestId('subtasks-merge-result'))
    expect(text('subtasks-merge-result')).toBe(
      '1 travail fusionné dans main en 12 s. Vos modifications mises de côté n’ont pas pu revenir sans conflit (README.md)\u00a0: elles restent dans git stash (a1b2c3d).'
    )
  })

  it('fiche 244 : un fichier décoché ne part pas ; la fusion le met de côté', async () => {
    const actions = view(
      [],
      dirty([
        { path: 'README.md', status: 'modified' },
        { path: '.env', status: 'untracked' }
      ])
    )
    await waitFor(() => screen.getByTestId('main-dirty'))
    fireEvent.click(screen.getByTestId('main-dirty-commit'))
    fireEvent.click(
      screen
        .getAllByTestId('main-dirty-commit-file')
        .find((li) => li.dataset.path === '.env')
        ?.querySelector('input') as HTMLInputElement
    )
    await waitFor(() =>
      expect(
        (screen.getByTestId('main-dirty-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    const message = screen.getByTestId('main-dirty-commit-message') as HTMLTextAreaElement
    expect(message.value).toBe('docs: update README.md\n\n- README.md')
    fireEvent.click(screen.getByTestId('main-dirty-commit-confirm'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a', 'b'], false, true))
    expect(actions.commitMain).toHaveBeenCalledWith('mere', {
      message: 'docs: update README.md\n\n- README.md',
      files: ['README.md']
    })
  })
})

describe('Recommandations de la mère (fiche 160)', () => {
  const recommend = (id: number, childId: string, ready: boolean): TranscriptItem => ({
    kind: 'child-recommendation',
    id,
    childId,
    title: `Fille ${childId}`,
    ready,
    note: ready ? 'Relue, tests verts.' : 'Tests manquants.',
    at: id
  })
  const ready = plan([
    candidate('a', 'ready', ['a']),
    candidate('b', 'ready', ['b']),
    candidate('c', 'ready', ['c'])
  ])

  it('sur la ligne seulement ; seule la recommandée part, les autres après confirmation', async () => {
    const actions = view([recommend(20, 'a', true), recommend(21, 'b', false)], ready)
    await waitFor(() => screen.getByTestId('subtasks-merge-start'))
    // Une seule mention (fiche 264) : la pastille de la ligne, sa note en infobulle ; plus de
    // ligne dans le fil pour une fille qui a sa ligne dans la carte.
    expect(screen.queryByTestId('child-recommendation')).toBeNull()
    // Sa note reste lisible sur la pastille, sans survol (revue QA).
    expect(screen.getAllByTestId('subtask-recommendation')[0]?.textContent).toContain(
      'Relue, tests verts.'
    )
    expect(screen.getAllByTestId('subtask-recommendation').map((b) => b.dataset['state'])).toEqual([
      'ready',
      'not-ready'
    ])
    expect(text('subtasks-merge-start')).toBe('Fusionner le travail recommandé dans main')
    expect(text('subtasks-merge-advice')).toBe(
      'L’agent recommande « Fille a » ; les 2 autres attendent son avis.'
    )
    fireEvent.click(screen.getByTestId('subtasks-merge-start'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a'], false))
    // Les autres : une confirmation, puis toutes, dans l'ordre de lancement.
    fireEvent.click(screen.getByTestId('subtasks-merge-others'))
    expect(text('subtasks-merge-confirm')).toContain(
      'L’agent ne recommande pas « Fille b » et « Fille c ».'
    )
    fireEvent.click(screen.getByTestId('subtasks-merge-confirm-cancel'))
    expect(screen.queryByTestId('subtasks-merge-confirm')).toBeNull()
    fireEvent.click(screen.getByTestId('subtasks-merge-others'))
    fireEvent.click(screen.getByTestId('subtasks-merge-confirm-go'))
    await waitFor(() =>
      expect(actions.start).toHaveBeenLastCalledWith('mere', ['a', 'b', 'c'], false)
    )
  })

  it('recommandation caduque après un nouveau tour : « À revoir », plus fusionnée d’office', async () => {
    const report: TranscriptItem = {
      kind: 'child-report',
      id: 22,
      childId: 'a',
      title: 'Fille a',
      outcome: 'done',
      files: [],
      fileCount: 0,
      added: 0,
      removed: 0,
      excerpt: 'Encore un changement.',
      at: 22
    }
    view([recommend(20, 'a', true), report], ready)
    await waitFor(() => screen.getByTestId('subtasks-merge-others'))
    expect(screen.getByTestId('subtask-recommendation').dataset['state']).toBe('stale')
    expect(screen.queryByTestId('subtasks-merge-start')).toBeNull()
    expect(text('subtasks-merge-advice')).toBe('L’agent ne recommande encore aucun travail.')
  })

  it('sans recommandation : toutes les filles finies, comme avant', async () => {
    const actions = view([], ready)
    await waitFor(() => screen.getByTestId('subtasks-merge-start'))
    expect(screen.queryByTestId('subtasks-merge-advice')).toBeNull()
    fireEvent.click(screen.getByTestId('subtasks-merge-start'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a', 'b', 'c'], false))
  })
})

describe('travaux d’une bulle « @Rôle … » (fiche 263)', () => {
  it('le pied ne compte ni ne fusionne que les lignes de la carte, pas les travaux d’une bulle', async () => {
    const role = {
      name: 'front',
      label: 'Architecte front',
      icon: 'layout',
      color: 'blue' as const
    }
    // Le main ne lit que les branches demandées (fiche 264, `plan(motherId, ids)`).
    const all = [
      candidate('a', 'ready', ['x.ts']),
      candidate('b', 'ready', ['y.ts']),
      candidate('c', 'ready', ['x.ts'])
    ]
    const actions = {
      plan: vi.fn(async (_mother: string, ids?: string[]) =>
        plan(all.filter((c) => !ids || ids.includes(c.id)))
      ),
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
      commitMain: vi.fn(async () => undefined),
      openGit: vi.fn()
    } satisfies ChildrenMergeActions
    render(
      <Transcript
        items={[
          started(1, 'a'),
          started(2, 'b'),
          {
            kind: 'role-request',
            id: 3,
            requestId: 'd3',
            text: 'Ajoute les rayons',
            works: [{ childId: 'c', role }],
            at: 3
          },
          { ...started(4, 'c'), role, request: 'd3' } as TranscriptItem
        ]}
        onRespondPermission={vi.fn()}
        onRespondElicitation={vi.fn()}
        subtasks={{
          children: [child('a'), child('b'), { ...child('c'), role }],
          attention: {},
          onOpen: vi.fn(),
          motherId: 'mere',
          merge: actions
        }}
      />
    )
    await waitFor(() => screen.getByTestId('subtasks-merge'))
    expect(screen.getAllByTestId('subtask-row').map((r) => r.dataset['id'])).toEqual(['a', 'b'])
    // Un seul plan lu pour la conversation, gardé pour les lignes de la carte (fiche 264).
    expect(actions.plan).toHaveBeenCalledWith('mere')
    expect(text('subtasks-merge-start')).toBe('Fusionner les 2 dans main')
    // Le recouvrement avec le travail de la bulle (x.ts) n'est pas dit non plus.
    expect(text('subtasks-merge-summary')).not.toContain('Fille c')
    fireEvent.click(screen.getByTestId('subtasks-merge-start'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a', 'b'], false))
  })
})
