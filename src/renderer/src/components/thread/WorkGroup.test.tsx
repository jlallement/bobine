/**
 * Carte de groupe et fusion dans la carte (fiche 264, écrans C et D de la fiche 260) : rendue dans
 * le fil de la mère par `Transcript`, comme l'utilisateur la voit. Proposés → en cours → finis →
 * fusion (progression, résultat, conflit) ; travail qui écrit seul et sa fusion ; doublons retirés ;
 * anciennes conversations comme avant.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import {
  act,
  fireEvent,
  render as testingRender,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { childProposalSchema } from '@shared/children'
import type {
  ChildrenMerge,
  ChildrenMergePlan,
  ChildrenMergeRow,
  MergeCandidate,
  MergeCandidateState
} from '@shared/children-merge'
import type { RoleBadge } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import type { SubtasksInfo } from './Subtasks'
import type { ChildrenMergeActions } from './SubtasksMerge'
import { Transcript } from './Transcript'

const render = (ui: ReactNode) => testingRender(ui, { wrapper: Tooltip.Provider })
/** Espaces insécables de la typographie française ramenées à des espaces. */
const plain = (text: unknown) => String(text).replace(/[  ]/g, ' ')

const front: RoleBadge = {
  name: 'front',
  label: 'Développeur front',
  icon: 'layout',
  color: 'blue'
}
const T0 = Date.now() - 600_000

const proposal = (id: number, title: string, key: string, state = 'accept'): TranscriptItem =>
  ({
    kind: 'elicitation',
    id,
    requestId: `r${id}`,
    state,
    ...(state === 'accept' ? { content: { decision: 'start' } } : {}),
    prompt: {
      mode: 'form',
      message: title,
      schema: childProposalSchema(),
      child: { title, prompt: `Fais ${title}`, key }
    }
  }) as TranscriptItem

const started = (
  id: number,
  childId: string,
  card: string,
  extra: Partial<Extract<TranscriptItem, { kind: 'child-started' }>> = {}
): TranscriptItem => ({
  kind: 'child-started',
  id,
  childId,
  title: `Travail ${childId}`,
  prompt: `Consigne ${childId}`,
  by: 'agent',
  card,
  at: T0,
  ...extra
})

const report = (
  id: number,
  childId: string,
  extra: Partial<Extract<TranscriptItem, { kind: 'child-report' }>> = {}
): TranscriptItem => ({
  kind: 'child-report',
  id,
  childId,
  title: `Travail ${childId}`,
  outcome: 'done',
  files: [],
  fileCount: 2,
  added: 64,
  removed: 0,
  excerpt: 'Tests ajoutés.',
  reply: `Réponse entière de ${childId}.`,
  usage: { cost: { amount: 0, currency: 'USD' } },
  at: T0 + 60_000,
  ...extra
})

const child = (id: string, extra: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id,
  title: `Travail ${id}`,
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: `/tmp/${id}`,
  updatedAt: '2026-11-20T10:00:00.000Z',
  status: 'ready',
  draft: false,
  startedFrom: { id: 'mere', title: 'Mère' },
  branch: `bobine/${id}`,
  ...extra
})

const withoutBranch = ({ branch: _branch, ...rest }: ConversationSummary): ConversationSummary =>
  rest

const candidate = (id: string, state: MergeCandidateState): MergeCandidate => ({
  id,
  title: `Travail ${id}`,
  branch: `bobine/${id}`,
  base: 'main',
  state,
  files: [`${id}.ts`],
  dirty: 0
})

const mergeItem = (
  id: number,
  status: ChildrenMerge['status'],
  rows: Partial<ChildrenMergeRow>[],
  extra: Partial<ChildrenMerge> = {}
): TranscriptItem => ({
  kind: 'children-merge',
  id,
  runId: 'run',
  base: 'main',
  cleanup: false,
  status,
  rows: rows.map((r) => ({
    childId: r.childId ?? 'a',
    title: `Travail ${r.childId ?? 'a'}`,
    branch: `bobine/${r.childId ?? 'a'}`,
    state: 'pending',
    ...r
  })),
  startedAt: T0,
  ...extra
})

/** Ce que le main lit des branches : seulement celles demandées (`plan(motherId, ids)`). */
function mergeActions(candidates: MergeCandidate[], running = false) {
  return {
    plan: vi.fn(async (_mother: string, ids?: string[]): Promise<ChildrenMergePlan> => ({
      base: 'main',
      children: candidates.filter((c) => !ids || ids.includes(c.id)),
      overlaps: [],
      running
    })),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
    commitMain: vi.fn(async () => undefined),
    openGit: vi.fn()
  } satisfies ChildrenMergeActions
}

const info = (
  children: ConversationSummary[],
  extra: Partial<SubtasksInfo> = {}
): SubtasksInfo => ({
  children,
  attention: {},
  onOpen: vi.fn(),
  motherId: 'mere',
  agentLabel: 'OpenCode',
  onAsk: vi.fn(),
  onWarn: vi.fn(),
  ...extra
})

const view = (items: TranscriptItem[], subtasks?: SubtasksInfo, onRespond = vi.fn()) =>
  render(
    <Transcript
      items={items}
      onRespondPermission={vi.fn()}
      onRespondElicitation={onRespond}
      {...(subtasks ? { subtasks } : {})}
    />
  )

const originalAgent = window.api.agent
const originalConversations = window.api.conversations
beforeEach(() => {
  window.api.agent = {
    onEvent: () => () => {},
    cancel: vi.fn()
  } as unknown as Window['api']['agent']
  window.api.conversations = {
    view: vi.fn().mockResolvedValue({ snapshot: { controls: [] } }),
    childFolder: vi.fn().mockResolvedValue({ place: 'worktree', root: '/d', head: 'h' }),
    startChild: vi.fn()
  } as unknown as Window['api']['conversations']
})
afterEach(() => {
  window.api.agent = originalAgent
  window.api.conversations = originalConversations
  vi.restoreAllMocks()
})

/** Trois propositions d'un tour ; la deuxième et la troisième lancées, en cours et finie. */
const working = (): TranscriptItem[] => [
  { kind: 'user', id: 1, text: 'Découpe' },
  { kind: 'agent', id: 2, text: 'Je peux découper la suite en trois travaux :' },
  proposal(3, 'Doc', 'k-doc', 'decline'),
  proposal(4, 'API', 'k-api'),
  proposal(5, 'Page', 'k-page'),
  started(6, 'a', 'k-api'),
  started(7, 'b', 'k-page', { role: front }),
  report(8, 'b')
]

describe('carte de groupe : proposés (fiche 264, écran D, état 1)', () => {
  const pending = (): TranscriptItem[] => [
    { kind: 'user', id: 1, text: 'Découpe' },
    proposal(2, 'API', 'k-api', 'pending'),
    proposal(3, 'Page', 'k-page', 'pending'),
    proposal(4, 'Doc', 'k-doc', 'decline')
  ]

  it('une carte, ses lignes, « par OpenCode », où partent les travaux, « Tout lancer »', async () => {
    view(pending(), info([]))
    await act(async () => {})
    const group = screen.getByTestId('work-group')
    expect(group.dataset['stage']).toBe('proposed')
    expect(group.dataset['pending']).toBe('2')
    expect(within(group).getByTestId('work-group-title').textContent).toBe('3 travaux proposés')
    expect(plain(group.querySelector('.work-group-head')?.textContent)).toContain('· par OpenCode')
    expect(within(group).getByTestId('work-group-counts').textContent).toBe('· 1 refusé')
    expect(
      within(group)
        .getAllByTestId('proposal-row')
        .map((r) => r.dataset['outcome'])
    ).toEqual(['pending', 'pending', 'refuse'])
    expect(within(group).getByTestId('work-group-where').textContent).toContain(
      'Chaque travail part du dernier commit'
    )
    expect(screen.queryByTestId('subtasks')).toBeNull()
  })

  it('« Tout lancer » lance chaque ligne encore proposée, pas la refusée', async () => {
    const onRespond = vi.fn()
    view(pending(), info([]), onRespond)
    await act(async () => {})
    fireEvent.click(screen.getByTestId('work-group-start-all'))
    expect(onRespond.mock.calls.map(([id, answer]) => [id, answer.content.decision])).toEqual([
      ['r2', 'start'],
      ['r3', 'start']
    ])
  })
})

describe('carte de groupe : en cours et finis (fiche 264, écran D, états 2 et 3)', () => {
  it('« 3 travaux · 1 en cours, 1 fini », à la place des propositions ; rien de séparé', async () => {
    const subtasks = info([child('a', { status: 'busy' }), child('b', { role: front })])
    view(working(), subtasks)
    await act(async () => {})
    const group = screen.getByTestId('work-group')
    expect(group.dataset['stage']).toBe('working')
    expect(within(group).getByTestId('work-group-title').textContent).toBe('3 travaux')
    expect(within(group).getByTestId('work-group-counts').textContent).toBe(
      '· 1 en cours, 1 fini, 1 refusé'
    )
    expect(within(group).getByTestId('work-group-cost').textContent).toBe('gratuit')
    // Plus de « Sous-tâches », de lancement « L'agent a lancé… » ni de compte rendu séparé.
    expect(screen.queryByTestId('subtasks')).toBeNull()
    expect(screen.queryByTestId('child-started')).toBeNull()
    expect(screen.queryByTestId('child-report')).toBeNull()
    // La carte est juste après la réponse de l'agent qui l'a proposée.
    expect(screen.getByTestId('thread').lastElementChild?.contains(group)).toBe(true)
    const rows = within(group).getAllByTestId('work-row')
    expect(
      rows.map((r) => [r.dataset['childId'], r.dataset['state'], r.dataset['workAnchor']])
    ).toEqual([
      ['a', 'running', '6'],
      ['b', 'replied', '7']
    ])
    expect(within(rows[1] as HTMLElement).getByTestId('work-row-name').textContent).toBe(
      'Développeur front — Travail b'
    )
    expect(plain(within(rows[1] as HTMLElement).getByTestId('work-row-meta').textContent)).toBe(
      'bobine/b2 fichiers +64 −0'
    )
    // Sans rôle : l'agent qui le fait.
    expect(plain(within(rows[0] as HTMLElement).getByTestId('work-row-meta').textContent)).toMatch(
      /^Travaille… · \d+:\d\d$/
    )
  })

  it('une ligne se déplie sur la carte-réponse du travail : réponse entière, transmission, Ouvrir', async () => {
    const subtasks = info([child('a', { status: 'busy' }), child('b', { role: front })])
    view(working(), subtasks)
    await act(async () => {})
    const row = screen.getAllByTestId('work-row')[1] as HTMLElement
    expect(within(row).queryByTestId('work-card')).toBeNull()
    fireEvent.click(within(row).getByTestId('work-row-toggle'))
    const card = within(row).getByTestId('work-card')
    expect(within(card).getByTestId('work-body').textContent).toBe('Réponse entière de b.')
    // Sa consigne, repliée (fiche 150) : sans bulle, c'est ici qu'elle se relit.
    expect(within(card).getByTestId('work-brief-text').textContent).toBe('Consigne b')
    // Lancé par l'agent : sa réponse lui part à son réveil.
    expect(plain(within(card).getByTestId('work-relay').textContent)).toContain(
      'quand ses travaux auront tous fini'
    )
    expect(within(card).queryByTestId('work-apply')).toBeNull()
    fireEvent.click(within(card).getByTestId('work-open'))
    expect(subtasks.onOpen).toHaveBeenCalledWith('b')
  })

  it('message de l’agent au travail : dans sa carte ; recommandation : la pastille seule', async () => {
    const items: TranscriptItem[] = [
      ...working(),
      {
        kind: 'child-instruction',
        id: 9,
        childId: 'b',
        title: 'Page',
        prompt: 'Ajoute un test',
        at: T0
      },
      {
        kind: 'child-recommendation',
        id: 10,
        childId: 'b',
        title: 'Page',
        ready: true,
        note: 'Relue.',
        at: T0
      }
    ]
    view(items, info([child('a', { status: 'busy' }), child('b', { role: front })]))
    await act(async () => {})
    expect(screen.queryByTestId('child-instruction')).toBeNull()
    expect(screen.queryByTestId('child-recommendation')).toBeNull()
    const row = screen.getAllByTestId('work-row')[1] as HTMLElement
    expect(within(row).getByTestId('subtask-recommendation').dataset['state']).toBe('ready')
    fireEvent.click(within(row).getByTestId('work-row-toggle'))
    expect(within(row).getByTestId('work-note-text').textContent).toBe('Ajoute un test')
  })

  it('pied : « Fusionner les 2 prêts dans main », lu et lancé pour les travaux de la carte seulement', async () => {
    const actions = mergeActions([
      candidate('a', 'ready'),
      candidate('b', 'ready'),
      candidate('z', 'ready')
    ])
    const items = [...working(), report(9, 'a')]
    view(items, info([child('a'), child('b', { role: front }), child('z')], { merge: actions }))
    const start = await screen.findByTestId('subtasks-merge-start')
    expect(actions.plan).toHaveBeenCalledWith('mere', ['a', 'b'])
    expect(start.textContent).toBe('Fusionner les 2 prêts dans main')
    fireEvent.click(start)
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a', 'b'], false))
  })

  it('fusion en cours dans la carte : progression, chaque ligne, « Arrêter »', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')], true)
    const items = [
      ...working(),
      report(9, 'a'),
      mergeItem(10, 'running', [
        { childId: 'a', state: 'merged' },
        { childId: 'b', state: 'merging' }
      ])
    ]
    view(items, info([child('a'), child('b', { role: front })], { merge: actions }))
    const progress = await screen.findByTestId('subtasks-merge-progress')
    expect(plain(progress.textContent)).toBe(
      'Fusion dans main, l’un après l’autre : 1 sur 2 fait. Au premier conflit, le travail concerné le résout, puis la fusion reprend.'
    )
    expect(
      screen.getAllByTestId('subtask-merge-state').map((s) => [s.dataset['state'], s.textContent])
    ).toEqual([
      ['merged', 'fusionné'],
      ['merging', 'fusion en cours']
    ])
    expect(screen.getByTestId('work-group').contains(progress)).toBe(true)
    fireEvent.click(screen.getByTestId('subtasks-merge-stop'))
    await waitFor(() => expect(actions.stop).toHaveBeenCalledWith('mere'))
  })

  it('fusion finie dans la carte : le résultat, « fusionné » sur les lignes', async () => {
    const actions = mergeActions([candidate('a', 'merged'), candidate('b', 'merged')])
    const items = [
      ...working(),
      report(9, 'a'),
      mergeItem(
        10,
        'done',
        [
          { childId: 'a', state: 'merged' },
          { childId: 'b', state: 'merged' }
        ],
        { endedAt: T0 + 3000 }
      )
    ]
    view(items, info([child('a'), child('b', { role: front })], { merge: actions }))
    const result = await screen.findByTestId('subtasks-merge-result')
    expect(result.textContent).toBe('2 fusionnés dans main en 3 s.')
    expect(screen.getAllByTestId('subtask-merge-state').map((s) => s.textContent)).toEqual([
      'fusionné',
      'fusionné'
    ])
  })

  it('conflit qui reste : Réessayer, Abandonner, Voir le conflit, dans la carte', async () => {
    const actions = mergeActions([candidate('a', 'conflict'), candidate('b', 'ready')])
    const items = [
      ...working(),
      report(9, 'a'),
      mergeItem(10, 'conflict', [
        { childId: 'a', state: 'conflict', files: ['src/a.ts'] },
        { childId: 'b', state: 'pending' }
      ])
    ]
    view(items, info([child('a'), child('b', { role: front })], { merge: actions }))
    const result = await screen.findByTestId('subtasks-merge-result')
    expect(plain(result.textContent)).toBe(
      'Fusion arrêtée sur « Travail a » : il reste des conflits dans src/a.ts.'
    )
    fireEvent.click(screen.getByTestId('subtasks-merge-abort'))
    await waitFor(() => expect(actions.abort).toHaveBeenCalledWith('a'))
    fireEvent.click(screen.getByTestId('subtasks-merge-show'))
    expect(actions.openGit).toHaveBeenCalledWith('a')
  })

  it('une autre carte ne montre pas cette fusion', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')])
    const items = [
      ...working(),
      report(9, 'a'),
      mergeItem(10, 'done', [{ childId: 'z', state: 'merged' }], { endedAt: T0 + 1000 })
    ]
    view(items, info([child('a'), child('b', { role: front })], { merge: actions }))
    await screen.findByTestId('subtasks-merge-start')
    expect(screen.queryByTestId('subtasks-merge-result')).toBeNull()
  })
})

describe('travail qui écrit : fusion dans sa carte (fiche 264, écran C)', () => {
  const writer = (extra: TranscriptItem[] = []): TranscriptItem[] => [
    {
      kind: 'role-request',
      id: 1,
      requestId: 'd1',
      text: 'Ajoute un tri par rayon.',
      works: [{ childId: 'a', role: front }],
      at: T0
    },
    started(2, 'a', '', { role: front, request: 'd1', by: undefined, card: undefined }),
    report(3, 'a', { branch: 'bobine/a', fileCount: 4, added: 115, removed: 64 }),
    ...extra
  ]

  it('« Fusionner dans main » (cleanup), « Faire relire », « Voir les modifications »', async () => {
    const actions = mergeActions([candidate('a', 'ready')])
    const onReview = vi.fn()
    view(writer(), info([child('a', { role: front })], { merge: actions, onReview }))
    const start = await screen.findByTestId('work-merge-start')
    expect(actions.plan).toHaveBeenCalledWith('mere', ['a'])
    expect(start.textContent).toBe('Fusionner dans main')
    fireEvent.click(screen.getByTestId('work-review'))
    expect(onReview).toHaveBeenCalledWith('a')
    fireEvent.click(screen.getByTestId('work-changes-open'))
    expect(actions.openGit).toHaveBeenCalledWith('a')
    fireEvent.click(start)
    // Une seule branche, puis nettoyée : « Fusionné dans main · branche supprimée ».
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a'], true, undefined))
  })

  it('fichiers et lignes : ceux de sa branche contre sa base, pas ceux de sa dernière réponse', async () => {
    // La réponse disait 4 fichiers +115 −64 ; des commits faits ensuite : la branche apporte autre chose.
    const actions = mergeActions([
      { ...candidate('a', 'ready'), files: ['a.ts', 'b.ts'], added: 7, removed: 2 }
    ])
    view(writer(), info([child('a', { role: front })], { merge: actions }))
    await screen.findByTestId('work-merge-start')
    expect(plain(screen.getByTestId('work-changes').textContent)).toBe('bobine/a2 fichiers +7 −2')
  })

  it('fusionnée : plus de « N fichiers » d’une branche qui n’apporte plus rien', async () => {
    view(
      writer([
        mergeItem(4, 'done', [{ childId: 'a', state: 'merged', cleaned: true }], { endedAt: T0 })
      ]),
      info([withoutBranch(child('a', { role: front, archived: true }))], {
        merge: mergeActions([])
      })
    )
    await screen.findByTestId('work-merge-result')
    expect(screen.queryByTestId('work-changes')).toBeNull()
  })

  it('en cours : les étapes réelles seulement, « Arrêter » ; jamais d’étape inventée', async () => {
    const actions = mergeActions([candidate('a', 'ready')], true)
    view(
      writer([mergeItem(4, 'running', [{ childId: 'a', state: 'merging' }], { cleanup: true })]),
      info([child('a', { role: front })], { merge: actions })
    )
    const box = await screen.findByTestId('work-merge')
    expect(screen.getByTestId('work-state').textContent).toBe('fusion…')
    expect(
      within(box)
        .getAllByTestId('work-merge-step')
        .map((s) => s.textContent)
    ).toEqual(['Fusion de bobine/a dans main…'])
    // Décision 8 de la fiche 260 : ni « main n'a pas bougé », ni « tests de la branche ».
    expect(box.textContent).not.toMatch(/bougé|tests? de la branche|réussis/i)
    expect(screen.queryByTestId('work-merge-start')).toBeNull()
    fireEvent.click(within(box).getByTestId('work-merge-stop'))
    await waitFor(() => expect(actions.stop).toHaveBeenCalledWith('mere'))
  })

  it('conflit pendant la fusion : le travail le résout, dit tel quel', async () => {
    const actions = mergeActions([candidate('a', 'ready')], true)
    view(
      writer([
        mergeItem(4, 'running', [{ childId: 'a', state: 'resolving', files: ['src/list.ts'] }])
      ]),
      info([child('a', { role: front })], { merge: actions })
    )
    const box = await screen.findByTestId('work-merge')
    expect(
      within(box)
        .getAllByTestId('work-merge-step')
        .map((s) => plain(s.textContent))
    ).toEqual(['Conflit dans src/list.ts', 'Développeur front résout le conflit…'])
  })

  it('fusionné : « Fusionné dans main · branche supprimée », conversation archivée dite', async () => {
    const actions = mergeActions([])
    view(
      writer([
        mergeItem(4, 'done', [{ childId: 'a', state: 'merged', cleaned: true }], {
          cleanup: true,
          endedAt: T0 + 5000
        })
      ]),
      // Nettoyée : archivée, plus de worktree ni de branche ; la carte le dit quand même.
      info([withoutBranch(child('a', { role: front, archived: true }))], { merge: actions })
    )
    const result = await screen.findByTestId('work-merge-result')
    expect(result.dataset['state']).toBe('merged')
    expect(result.textContent).toContain('Fusionné dans main · branche supprimée')
    expect(result.textContent).toContain('Sa conversation est archivée')
    expect(screen.getByTestId('work-state').textContent).toMatch(/^fusionné · /)
    expect(screen.queryByTestId('work-merge-start')).toBeNull()
  })

  it('conflit qui reste : Réessayer, Abandonner, Voir le conflit', async () => {
    const actions = mergeActions([candidate('a', 'conflict')])
    view(
      writer([
        mergeItem(4, 'conflict', [{ childId: 'a', state: 'conflict', files: ['src/list.ts'] }])
      ]),
      info([child('a', { role: front })], { merge: actions })
    )
    const box = await screen.findByTestId('work-merge')
    expect(box.dataset['status']).toBe('conflict')
    expect(plain(box.textContent)).toContain('Il reste des conflits dans src/list.ts')
    fireEvent.click(within(box).getByTestId('work-merge-abort'))
    await waitFor(() => expect(actions.abort).toHaveBeenCalledWith('a'))
    fireEvent.click(within(box).getByTestId('work-merge-show'))
    expect(actions.openGit).toHaveBeenCalledWith('a')
    fireEvent.click(within(box).getByTestId('work-merge-retry'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a'], true, undefined))
  })

  it('échec dit, avec sa raison ; un rôle de conseil n’a rien à fusionner', async () => {
    const actions = mergeActions([candidate('a', 'ready')])
    view(
      writer([
        mergeItem(4, 'failed', [{ childId: 'a', state: 'failed', error: 'base extraite ailleurs' }])
      ]),
      info([child('a', { role: front })], { merge: actions })
    )
    const result = await screen.findByTestId('work-merge-result')
    expect(plain(result.textContent)).toBe('La fusion n’a pas abouti : base extraite ailleurs')
  })
})

describe('« Lancer en parallèle… » : une carte seule, à sa place (fiche 264)', () => {
  it('sans rôle : son titre, « un autre <agent> », sa fusion dans la carte', async () => {
    const actions = mergeActions([candidate('a', 'ready')])
    view(
      [started(1, 'a', 'k-seul', { by: undefined }), report(2, 'a', { branch: 'bobine/a' })],
      info([child('a', { profileId: 'opencode' })], {
        merge: actions,
        profiles: [{ id: 'opencode', label: 'OpenCode' }] as unknown as SubtasksInfo['profiles']
      })
    )
    const card = screen.getByTestId('work-card')
    expect(card.dataset['workAnchor']).toBe('1')
    expect(card.querySelector('.work-name')?.textContent).toBe('Travail a')
    expect(within(card).getByTestId('work-agent').textContent).toBe('un autre OpenCode')
    expect(screen.queryByTestId('child-started')).toBeNull()
    expect(screen.queryByTestId('child-report')).toBeNull()
    expect(screen.queryByTestId('subtasks')).toBeNull()
    // Sans rôle : pas de jeton pour lui répondre ; sa conversation s'ouvre.
    expect(within(card).queryByTestId('work-reply')).toBeNull()
    // « Enregistrer comme rôle » (fiche 223) reste pour un travail sans rôle qui a répondu.
    expect(within(card).getByTestId('work-save-role')).toBeTruthy()
    await within(card).findByTestId('work-merge-start')
  })
})

describe('anciennes conversations : comme avant (fiche 264)', () => {
  it('lancements sans clé : « Sous-tâches », lancement, compte rendu, à leur place', async () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Découpe' },
      started(2, 'a', '', { card: undefined }),
      report(3, 'a'),
      mergeItem(4, 'done', [{ childId: 'a', state: 'merged' }], { endedAt: T0 + 2000 })
    ]
    const actions = mergeActions([candidate('a', 'merged')])
    view(items, info([child('a')], { merge: actions }))
    expect(screen.getByTestId('child-started')).toBeTruthy()
    expect(screen.getByTestId('child-report')).toBeTruthy()
    expect(screen.getByTestId('subtasks')).toBeTruthy()
    expect(screen.queryByTestId('work-group')).toBeNull()
    expect(screen.queryByTestId('work-card')).toBeNull()
    // « Sous-tâches » lit toutes les branches, comme avant, et montre la fusion enregistrée.
    expect((await screen.findByTestId('subtasks-merge-result')).textContent).toContain(
      '1 fusionnée dans main'
    )
    expect(actions.plan).toHaveBeenCalledWith('mere')
  })
})
