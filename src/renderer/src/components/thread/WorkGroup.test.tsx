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
import { resetPlans } from './merge-plan-store'
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
  // Modèle gratuit (fiche 266) : un coût nul y vaut « gratuit ».
  usage: { cost: { amount: 0, currency: 'USD' }, free: true },
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
function mergeActions(candidates: MergeCandidate[], running = false, runId = 'run') {
  return {
    plan: vi.fn(async (_mother: string, ids?: string[]): Promise<ChildrenMergePlan> => ({
      base: 'main',
      children: candidates.filter((c) => !ids || ids.includes(c.id)),
      overlaps: [],
      running,
      ...(running ? { runId } : {})
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
  it('« Tout lancer » dans l’ordre des lignes, même après une ligne dépliée (seconde chasse rc.4)', async () => {
    const onRespond = vi.fn()
    view(pending(), info([]), onRespond)
    await act(async () => {})
    // La ligne r2 dépliée se rend seule, et se réinscrit après r3.
    const rows = screen.getAllByTestId('proposal-row')
    const r2 = rows.find((row) => row.dataset.request === 'r2')
    fireEvent.click(within(r2 as HTMLElement).getByTestId('proposal-title'))
    await act(async () => {})
    fireEvent.click(screen.getByTestId('work-group-start-all'))
    expect(onRespond.mock.calls.map(([id]) => id)).toEqual(['r2', 'r3'])
  })
})

describe('carte de groupe : en cours et finis (fiche 264, écran D, états 2 et 3)', () => {
  it('total partiel : « ≈ … + coût inconnu », et combien manquent en bulle (revue UX, fiche 266)', async () => {
    const items = working().map((item) =>
      item.kind === 'child-report' ? { ...item, usage: { total: 1200 } } : item
    )
    view(
      [
        ...items,
        report(9, 'a', { usage: { cost: { amount: 0.05, currency: 'USD' }, free: false } })
      ],
      info([child('a'), child('b', { role: front })])
    )
    await act(async () => {})
    const cost = screen.getByTestId('work-group-cost')
    expect(cost.textContent).toMatch(/^≈\s0,05\s\$US \+ coût inconnu$/)
    expect(cost.getAttribute('title')).toBe('Sans le coût de 1 travail')
  })

  it('coût nul d’un modèle payant (abonnement, D12) : « coût inconnu », jamais « gratuit » (fiche 266)', async () => {
    const items = working().map((item) =>
      item.kind === 'child-report'
        ? { ...item, usage: { cost: { amount: 0, currency: 'USD' } } }
        : item
    )
    view(items, info([child('a', { status: 'busy' }), child('b', { role: front })]))
    await act(async () => {})
    expect(screen.getByTestId('work-group-cost').textContent).toBe('coût inconnu')
  })

  it('« 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé', async () => {
    const subtasks = info([child('a', { status: 'busy' }), child('b', { role: front })])
    view(working(), subtasks)
    await act(async () => {})
    const group = screen.getByTestId('work-group')
    expect(group.dataset['stage']).toBe('working')
    expect(within(group).getByTestId('work-group-title').textContent).toBe('3 travaux')
    expect(within(group).getByTestId('work-group-counts').textContent).toBe(
      '· 1 en cours, 1 a répondu, 1 refusé'
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
    // Le titre seul en gras ; le rôle dans la méta, en texte gris séparé par « · » (revue UX).
    expect(within(rows[1] as HTMLElement).getByTestId('work-row-name').textContent).toBe(
      'Travail b'
    )
    expect(plain(within(rows[1] as HTMLElement).getByTestId('work-row-meta').textContent)).toBe(
      'Développeur front · bobine/b · 2 fichiers +64 −0'
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
      'quand ses travaux auront tous répondu'
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
      // Le message de l'agent ouvre un échange (revue QA) : sa réponse le ferme.
      report(10, 'b', { at: T0 + 120_000 }),
      {
        kind: 'child-recommendation',
        id: 11,
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
    // Un seul plan lu pour la conversation (revue QA) ; la carte garde ses travaux (pas « z »).
    expect(actions.plan.mock.calls).toEqual([['mere']])
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
    // Court ; la phrase du conflit seulement s'il y en a un (revue UX).
    expect(plain(progress.textContent)).toBe('Fusion dans main : 1 sur 2…')
    expect(screen.queryByTestId('subtasks-merge-resolving')).toBeNull()
    expect(
      screen.getAllByTestId('subtask-merge-state').map((s) => [s.dataset['state'], s.textContent])
    ).toEqual([
      ['merged', 'fusionné'],
      ['merging', 'fusion en cours']
    ])
    expect(screen.getByTestId('work-group').contains(progress)).toBe(true)
    fireEvent.click(screen.getByTestId('subtasks-merge-stop'))
    await waitFor(() => expect(actions.stop).toHaveBeenCalledWith('mere', 'run'))
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
    expect(result.textContent).toBe('2 travaux fusionnés dans main en 3 s.')
    expect(screen.getAllByTestId('subtask-merge-state').map((s) => s.textContent)).toEqual([
      'fusionné',
      'fusionné'
    ])
  })

  it('en-tête : un fusionné se dit fusionné, un supprimé n’a pas « répondu » (recette rc.4, T7)', async () => {
    const actions = mergeActions([candidate('a', 'merged'), candidate('b', 'ready')])
    const items = [
      ...working(),
      report(9, 'a'),
      mergeItem(10, 'done', [{ childId: 'a', state: 'merged' }], { endedAt: T0 + 1000 })
    ]
    // « b » a répondu, puis sa conversation est partie à la corbeille.
    view(items, info([child('a')], { merge: actions, exists: (id) => id === 'a' }))
    await screen.findByTestId('subtasks-merge-result')
    expect(screen.getByTestId('work-group-counts').textContent).toBe(
      '· 1 fusionné, 1 supprimé, 1 refusé'
    )
    expect(
      screen.getAllByTestId('work-row-state').map((s) => [s.dataset['state'], s.textContent])
    ).toEqual([
      ['replied', 'fusionné'],
      ['gone', 'conversation supprimée']
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
    expect(actions.plan).toHaveBeenCalledWith('mere')
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
    await waitFor(() => expect(actions.stop).toHaveBeenCalledWith('mere', 'run'))
  })

  it('conflit pendant la fusion : le travail (occupé) le résout ; l’« Arrêter » de la fusion, pas du tour', async () => {
    const actions = mergeActions([candidate('a', 'running')], true)
    view(
      writer([
        mergeItem(4, 'running', [{ childId: 'a', state: 'resolving', files: ['src/list.ts'] }])
      ]),
      // Il résout : sa conversation travaille (revue QA, la carte se taisait).
      info([child('a', { role: front, status: 'busy' })], { merge: actions })
    )
    const box = await screen.findByTestId('work-merge')
    expect(
      within(box)
        .getAllByTestId('work-merge-step')
        .map((s) => plain(s.textContent))
    ).toEqual(['Conflit dans src/list.ts', 'Développeur front résout le conflit…'])
    expect(within(box).getByTestId('work-merge-stop')).toBeTruthy()
    expect(screen.queryByTestId('work-stop')).toBeNull()
    expect(screen.queryByTestId('work-reply')).toBeNull()
    expect(screen.queryByTestId('work-retry')).toBeNull()
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

  it('conflit, branches lues pendant la fusion : pas encore de reprise (fiche 250)', async () => {
    // Une lecture faite pendant la fusion (le travail résolvait encore) ne dit pas le conflit qui
    // reste : « Réessayer » attend une lecture faite après son arrêt.
    const actions = mergeActions([candidate('a', 'conflict')], true)
    view(
      writer([
        mergeItem(4, 'conflict', [{ childId: 'a', state: 'conflict', files: ['src/list.ts'] }])
      ]),
      info([child('a', { role: front })], { merge: actions })
    )
    // Le pied montré : les branches sont lues.
    await screen.findByTestId('work-open')
    expect(actions.plan).toHaveBeenCalled()
    expect(screen.queryByTestId('work-merge-retry')).toBeNull()
    expect(screen.queryByTestId('work-merge-abort')).toBeNull()
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

describe('revues UX et QA (fiche 264)', () => {
  it('un seul plan lu pour la conversation, partagé par la carte de groupe et la carte seule', async () => {
    const actions = mergeActions([
      candidate('a', 'ready'),
      candidate('b', 'ready'),
      candidate('s', 'ready')
    ])
    view(
      [
        ...working(),
        report(9, 'a'),
        started(20, 's', 'k-seul', { by: undefined }),
        report(21, 's')
      ],
      info([child('a'), child('b', { role: front }), child('s')], { merge: actions })
    )
    await screen.findByTestId('subtasks-merge-start')
    await screen.findByTestId('work-merge-start')
    expect(actions.plan).toHaveBeenCalledTimes(1)
  })

  it('conversation réaffichée : ses branches se relisent (commits faits ailleurs entre-temps)', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'empty')])
    const subtasks = info([child('a'), child('b', { role: front })], { merge: actions })
    const items = [...working(), report(9, 'a')]
    const first = view(items, subtasks)
    expect((await screen.findByTestId('subtasks-merge-start')).textContent).toBe(
      'Fusionner le travail prêt dans main'
    )
    first.unmount()
    // Entre-temps, « b » a été commité dans son dossier de travail.
    actions.plan.mockResolvedValue({
      base: 'main',
      children: [candidate('a', 'ready'), candidate('b', 'ready')],
      overlaps: [],
      running: false
    })
    view(items, subtasks)
    await waitFor(() =>
      expect(screen.getByTestId('subtasks-merge-start').textContent).toBe(
        'Fusionner les 2 prêts dans main'
      )
    )
    expect(actions.plan).toHaveBeenCalledTimes(2)
  })

  it('une autre fusion de la mère change : le plan est relu (clé de toutes les fusions)', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')])
    const subtasks = info([child('a'), child('b', { role: front })], { merge: actions })
    const items = [...working(), report(9, 'a')]
    const { rerender } = view(items, subtasks)
    await screen.findByTestId('subtasks-merge-start')
    expect(actions.plan).toHaveBeenCalledTimes(1)
    rerender(
      <Tooltip.Provider>
        <Transcript
          items={[
            ...items,
            mergeItem(30, 'done', [{ childId: 'z', state: 'merged' }], { runId: 'autre' })
          ]}
          onRespondPermission={vi.fn()}
          onRespondElicitation={vi.fn()}
          subtasks={subtasks}
        />
      </Tooltip.Provider>
    )
    await waitFor(() => expect(actions.plan).toHaveBeenCalledTimes(2))
  })

  it('la fusion d’une autre carte tourne : celle-ci n’est pas « en cours » (le plan dit laquelle)', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')], true, 'autre')
    view(
      [
        ...working(),
        report(9, 'a'),
        mergeItem(10, 'running', [{ childId: 'a', state: 'merging' }])
      ],
      info([child('a'), child('b', { role: front })], { merge: actions })
    )
    const result = await screen.findByTestId('subtasks-merge-result')
    expect(result.dataset['status']).toBe('stopped')
    expect(screen.queryByTestId('subtasks-merge-progress')).toBeNull()
  })

  it('ligne dont la fusion avance : ni « Répondre » ni « Relancer » (revue QA)', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')], true)
    view(
      [
        ...working(),
        report(9, 'a'),
        mergeItem(10, 'running', [
          { childId: 'a', state: 'merged' },
          { childId: 'b', state: 'merging' }
        ])
      ],
      info([child('a'), child('b', { role: front })], { merge: actions })
    )
    await screen.findByTestId('subtasks-merge-progress')
    const row = screen.getAllByTestId('work-row')[1] as HTMLElement
    fireEvent.click(within(row).getByTestId('work-row-toggle'))
    expect(within(row).getByTestId('work-card')).toBeTruthy()
    expect(within(row).queryByTestId('work-reply')).toBeNull()
    expect(within(row).queryByTestId('work-retry')).toBeNull()
  })

  it('réveil posé avant la dernière réponse : il la porte, « Réponses transmises » (revue UX, fiche 266)', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')])
    const byAgent = working().map((item) =>
      item.kind === 'child-started' ? { ...item, by: 'agent' as const } : item
    )
    view(
      [
        ...byAgent.filter((item) => item.kind !== 'child-report'),
        {
          kind: 'user',
          id: 8,
          text: 'All tasks replied…',
          from: { kind: 'wake' },
          at: T0 + 70_000
        },
        report(9, 'a'),
        report(10, 'b')
      ],
      info([child('a'), child('b', { role: front })], { merge: actions })
    )
    await screen.findByTestId('subtasks-merge-start')
    const relay = within(screen.getByTestId('work-group-merge')).getByTestId('work-group-relay')
    expect(plain(relay.textContent)).toBe('Réponses transmises à OpenCode')
  })

  it('ligne et carte retiennent le fil sous le pointeur : la ligne dépliée ne remonte pas (fiche 266)', async () => {
    view(working(), info([child('a', { status: 'busy' }), child('b', { role: front })]))
    await act(async () => {})
    const rows = screen.getAllByTestId('work-row')
    expect(rows.every((r) => r.closest('[data-scroll-hold]') === r)).toBe(true)
    fireEvent.click(within(rows[1] as HTMLElement).getByTestId('work-row-toggle'))
    expect(within(rows[1] as HTMLElement).getByTestId('work-card').dataset['scrollHold']).toBe('')
  })

  it('après le réveil de l’agent : « Réponses transmises » (revue UX, fiche 266)', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')])
    view(
      [
        ...working(),
        report(9, 'a'),
        {
          kind: 'user',
          id: 10,
          text: 'All tasks replied…',
          from: { kind: 'wake' },
          at: T0 + 70_000
        },
        { kind: 'agent', id: 11, text: 'Je reprends.' }
      ],
      info([child('a'), child('b', { role: front })], { merge: actions })
    )
    await screen.findByTestId('subtasks-merge-start')
    const relay = within(screen.getByTestId('work-group-merge')).getByTestId('work-group-relay')
    expect(plain(relay.textContent)).toBe('Réponses transmises à OpenCode')
  })

  it('pied : « Puis nettoyer » sur sa ligne, puis [Voir les modifications] [Inclure…] [Fusionner…]', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')])
    const onShowChanges = vi.fn()
    view(
      [...working(), report(9, 'a')],
      info([child('a'), child('b', { role: front })], { merge: actions, onShowChanges })
    )
    await screen.findByTestId('subtasks-merge-start')
    const foot = screen.getByTestId('work-group-merge')
    expect(plain(within(foot).getByTestId('work-group-relay').textContent)).toContain(
      'Réponses pas encore transmises à OpenCode'
    )
    const cleanup = within(foot).getByTestId('subtasks-merge-cleanup') as HTMLInputElement
    expect(cleanup.type).toBe('checkbox')
    expect(cleanup.closest('label')?.textContent).toBe(
      'Puis nettoyer (archiver, supprimer les branches)'
    )
    // La case sur sa propre ligne, hors de la rangée de boutons (revue du lot 264).
    expect(cleanup.closest('.subtasks-merge-option')).toBeTruthy()
    expect(cleanup.closest('.subtasks-merge-actions')).toBeNull()
    const actionsRow = foot.querySelector('.subtasks-merge-actions') as HTMLElement
    expect([...actionsRow.children].map((b) => (b as HTMLElement).dataset['testid'])).toEqual([
      'work-group-changes',
      'subtasks-merge-start'
    ])
    fireEvent.click(cleanup)
    fireEvent.click(screen.getByTestId('subtasks-merge-start'))
    await waitFor(() => expect(actions.start).toHaveBeenCalledWith('mere', ['a', 'b'], true))
    fireEvent.click(within(foot).getByTestId('work-group-changes'))
    expect(onShowChanges).toHaveBeenCalled()
  })

  it('tous en lecture seule : pas de « Voir les modifications » (fiche 272, recette)', async () => {
    const reader = { ...front, name: 'reader', label: 'Relecteur', readOnly: true as const }
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Découpe' },
      proposal(2, 'API', 'k-api'),
      proposal(3, 'Page', 'k-page'),
      started(4, 'a', 'k-api', { role: reader }),
      started(5, 'b', 'k-page', { role: reader }),
      report(6, 'a'),
      report(7, 'b')
    ]
    const actions = mergeActions([])
    view(
      items,
      info([child('a', { role: reader }), child('b', { role: reader })], {
        merge: actions,
        onShowChanges: vi.fn()
      })
    )
    await act(async () => {})
    expect(screen.queryByTestId('work-group-changes')).toBeNull()
  })

  const verdict = (id: number, childId: string, ready: boolean): TranscriptItem => ({
    kind: 'child-recommendation',
    id,
    childId,
    title: `Travail ${childId}`,
    ready,
    note: '',
    at: T0
  })

  it('conseil : « pas encore prêt selon lui » quand l’agent l’a dit ; le principal en dernier', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')])
    view(
      [...working(), report(9, 'a'), verdict(10, 'a', true), verdict(11, 'b', false)],
      info([child('a'), child('b', { role: front })], { merge: actions, onShowChanges: vi.fn() })
    )
    const advice = await screen.findByTestId('subtasks-merge-advice')
    expect(plain(advice.textContent)).toBe(
      'L’agent recommande « Travail a » ; « Travail b » n’est pas encore recommandé.'
    )
    const row = screen.getByTestId('work-group-merge').querySelector('.subtasks-merge-actions')
    expect([...(row?.children ?? [])].map((b) => (b as HTMLElement).dataset['testid'])).toEqual([
      'work-group-changes',
      'subtasks-merge-others',
      'subtasks-merge-start'
    ])
    // Confirmation : la rangée garde « Voir les modifications », le bouton principal en dernier.
    fireEvent.click(screen.getByTestId('subtasks-merge-others'))
    const confirm = screen.getByTestId('subtasks-merge-confirm')
    const buttons = confirm.querySelector('.subtasks-merge-actions')?.children ?? []
    expect([...buttons].map((b) => (b as HTMLElement).dataset['testid'])).toEqual([
      'work-group-changes',
      'subtasks-merge-confirm-cancel',
      'subtasks-merge-confirm-go'
    ])
  })

  it('conseil : sans avis sur l’autre (ou un avis caduc), « n’a pas encore d’avis de l’agent »', async () => {
    const actions = mergeActions([candidate('a', 'ready'), candidate('b', 'ready')])
    view(
      // L'avis sur b précède son compte rendu : caduc, il ne compte pas.
      [
        ...working(),
        verdict(9, 'b', false),
        report(10, 'a'),
        report(11, 'b'),
        verdict(12, 'a', true)
      ],
      info([child('a'), child('b', { role: front })], { merge: actions })
    )
    const advice = await screen.findByTestId('subtasks-merge-advice')
    expect(plain(advice.textContent)).toBe(
      'L’agent recommande « Travail a » ; « Travail b » n’a pas encore d’avis de l’agent.'
    )
    expect(advice.textContent).not.toContain('attend')
  })

  it('une colonne d’état : « fusionné » seul remplace « a répondu » ; « Recommandé » neutre', async () => {
    const actions = mergeActions([candidate('a', 'merged'), candidate('b', 'ready')])
    view(
      [
        ...working(),
        report(9, 'a'),
        {
          kind: 'child-recommendation',
          id: 10,
          childId: 'b',
          title: 'Page',
          ready: true,
          note: 'Relue.',
          at: T0
        },
        mergeItem(11, 'done', [{ childId: 'a', state: 'merged', cleaned: true }], { endedAt: T0 })
      ],
      info([child('a'), child('b', { role: front })], { merge: actions })
    )
    await screen.findByTestId('subtask-merge-state')
    const [a, b] = screen.getAllByTestId('work-row-state')
    expect(a?.textContent).toBe('fusionné')
    const pill = within(b as HTMLElement).getByTestId('subtask-recommendation')
    expect(pill.classList.contains('neutral')).toBe(true)
    expect(pill.querySelector('svg')).toBeNull()
    // Sa note reste lisible sans survol (revue QA).
    expect(plain(pill.textContent)).toBe('Recommandé — Relue.')
    expect(b?.textContent).not.toContain('a répondu')
  })

  it('branche vide : « rien à fusionner », pas de bouton ; une branche lue dit d’où elle part', async () => {
    const empty = mergeActions([{ ...candidate('a', 'empty'), files: [], added: 0, removed: 0 }])
    const { unmount } = view(
      [
        {
          kind: 'role-request',
          id: 1,
          requestId: 'd1',
          text: 'Tri',
          works: [{ childId: 'a', role: front }],
          at: T0
        },
        started(2, 'a', '', { role: front, request: 'd1', by: undefined, card: undefined }),
        report(3, 'a', { branch: 'bobine/a' })
      ],
      info([child('a', { role: front })], { merge: empty })
    )
    await waitFor(() =>
      expect(plain(screen.getByTestId('work-changes').textContent)).toBe('bobine/arien à fusionner')
    )
    expect(screen.queryByTestId('work-merge-start')).toBeNull()
    unmount()
    resetPlans()
    const ready = mergeActions([
      { ...candidate('a', 'ready'), files: ['a.ts'], added: 3, removed: 1, from: 'a3f2c1e' }
    ])
    view(
      [
        {
          kind: 'role-request',
          id: 1,
          requestId: 'd1',
          text: 'Tri',
          works: [{ childId: 'a', role: front }],
          at: T0
        },
        started(2, 'a', '', { role: front, request: 'd1', by: undefined, card: undefined }),
        report(3, 'a', { branch: 'bobine/a' })
      ],
      info([child('a', { role: front })], { merge: ready })
    )
    await screen.findByTestId('work-merge-start')
    expect(plain(screen.getByTestId('work-changes').textContent)).toBe(
      'bobine/a1 fichier +3 −1part de main a3f2c1e'
    )
  })

  it('modifications non commitées dans sa branche : dites, la fusion ne les prendra pas', async () => {
    const actions = mergeActions([
      { ...candidate('a', 'dirty'), files: [], dirty: 2, added: 0, removed: 0 }
    ])
    view(
      [
        {
          kind: 'role-request',
          id: 1,
          requestId: 'd1',
          text: 'Tri',
          works: [{ childId: 'a', role: front }],
          at: T0
        },
        started(2, 'a', '', { role: front, request: 'd1', by: undefined, card: undefined }),
        report(3, 'a', { branch: 'bobine/a' })
      ],
      info([child('a', { role: front })], { merge: actions })
    )
    await waitFor(() =>
      expect(plain(screen.getByTestId('work-changes').textContent)).toContain(
        '2 modifications non commitées'
      )
    )
    expect(screen.queryByTestId('work-merge-start')).toBeNull()
    expect(screen.getByTestId('work-changes').textContent).not.toContain('rien modifié')
  })

  it('lancement refusé (appel caché derrière la carte) : « pas lancé », la raison en infobulle', async () => {
    const accepted = proposal(2, 'API', 'k-api') as Extract<TranscriptItem, { kind: 'elicitation' }>
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Découpe' },
      {
        kind: 'tool',
        id: 3,
        toolCallId: 'c1',
        title: 'start_child',
        status: 'failed',
        content: [{ type: 'content', content: { type: 'text', text: 'Could not start: git lock' } }]
      } as unknown as TranscriptItem,
      { ...accepted, prompt: { ...accepted.prompt, toolCallId: 'c1' } } as TranscriptItem
    ]
    view(items, info([]))
    await act(async () => {})
    const state = screen.getByTestId('proposal-state')
    expect(state.textContent).toBe('pas lancé')
    expect(state.getAttribute('title')).toBe('Could not start: git lock')
  })

  it('fusionné seul : « commit <sha> · N fichiers », « Voir les modifications » reste', async () => {
    const actions = mergeActions([])
    view(
      [
        {
          kind: 'role-request',
          id: 1,
          requestId: 'd1',
          text: 'Tri',
          works: [{ childId: 'a', role: front }],
          at: T0
        },
        started(2, 'a', '', { role: front, request: 'd1', by: undefined, card: undefined }),
        report(3, 'a', { branch: 'bobine/a' }),
        mergeItem(
          4,
          'done',
          [
            {
              childId: 'a',
              state: 'merged',
              cleaned: true,
              commit: '7c41e9b',
              fileCount: 4,
              added: 115,
              removed: 64
            }
          ],
          { cleanup: true, endedAt: T0 }
        )
      ],
      info([withoutBranch(child('a', { role: front, archived: true }))], { merge: actions })
    )
    expect(plain((await screen.findByTestId('work-merge-commit')).textContent)).toBe(
      'commit 7c41e9b · 4 fichiers +115 −64'
    )
    fireEvent.click(screen.getByTestId('work-changes-open'))
    expect(actions.openGit).toHaveBeenCalledWith('a')
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
    // Le pied arrive une fois la branche lue (fiche 250), « Fusionner » compris.
    await within(card).findByTestId('work-merge-start')
    // « Enregistrer comme rôle » (fiche 223) reste pour un travail sans rôle qui a répondu.
    expect(within(card).getByTestId('work-save-role')).toBeTruthy()
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
      '1 travail fusionné dans main'
    )
    expect(actions.plan).toHaveBeenCalledWith('mere')
  })
})

describe('travail fini dont la réponse attend, activité de la ligne (maquette rc4)', () => {
  /** « API » lancée (fille `a`), « Page » encore proposée. */
  const oneLeft = (): TranscriptItem[] => [
    { kind: 'user', id: 1, text: 'Découpe' },
    proposal(2, 'API', 'k-api'),
    proposal(3, 'Page', 'k-page', 'pending'),
    started(4, 'a', 'k-api')
  ]

  it('réponse remise à la fin de celle de l’agent : « a répondu », compté même avec une proposition', async () => {
    view(oneLeft(), info([child('a')], { motherBusy: true }))
    await act(async () => {})
    const group = screen.getByTestId('work-group')
    expect(within(group).getByTestId('work-group-title').textContent).toBe('2 travaux proposés')
    expect(within(group).getByTestId('work-group-counts').textContent).toBe('· 1 a répondu')
    const state = within(group).getByTestId('work-row-state')
    expect(state.dataset['state']).toBe('pending')
    expect(state.textContent).toBe('a répondu')
    expect(plain(state.getAttribute('title'))).toBe(
      'Sa réponse s’affichera à la fin de la réponse d’OpenCode.'
    )
    // Dépliée : la précision, dans la ligne.
    fireEvent.click(within(group).getByTestId('work-row-toggle'))
    expect(plain(within(group).getByTestId('work-no-answer').textContent)).toBe(
      'Sa réponse s’affichera à la fin de la réponse d’OpenCode.'
    )
  })

  it('en anglais : « replied », « 1 replied »', async () => {
    const i18next = (await import('i18next')).default
    await i18next.changeLanguage('en')
    try {
      view(oneLeft(), info([child('a')], { motherBusy: true }))
      await act(async () => {})
      expect(screen.getByTestId('work-group-counts').textContent).toBe('· 1 replied')
      expect(screen.getByTestId('work-row-state').textContent).toBe('replied')
    } finally {
      await i18next.changeLanguage('fr')
    }
  })

  it('activité : chemin relatif au dossier du travail, chemin complet en infobulle', async () => {
    let emit: ((e: unknown) => void) | undefined
    window.api.agent = {
      onEvent: (listener: (e: unknown) => void) => {
        emit = listener
        return () => {}
      },
      cancel: vi.fn()
    } as unknown as Window['api']['agent']
    view(oneLeft(), info([child('a', { status: 'busy', workspace: '/private/tmp/wt/a' })]))
    await act(async () => {})
    act(() =>
      emit?.({
        conversationId: 'a',
        event: {
          type: 'update',
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: 't1',
            title: 'edit',
            kind: 'edit',
            status: 'in_progress',
            locations: [{ path: '/private/tmp/wt/a/README.md' }]
          }
        }
      })
    )
    const activity = await screen.findByTestId('work-row-activity')
    expect(activity.textContent).toBe('Modification de README.md')
    expect(activity.getAttribute('title')).toBe('/private/tmp/wt/a/README.md')
  })
})

/**
 * Remplaçants des vérifications de composant de `e2e/suites/filles.mjs` (n° 40, 42, 43) et
 * `filles-tech-lead.mjs` (n° 10). Le redémarrage réel (consigne relue du disque) reste e2e.
 */
describe('cartes de travaux — remplaçants des e2e', () => {
  it('consigne initiale et message de l’agent : repliés par défaut, sur la ligne du bon travail (filles n° 40, 42, 43)', async () => {
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
      report(10, 'b', { at: T0 + 120_000 })
    ]
    view(items, info([child('a', { status: 'busy' }), child('b', { role: front })]))
    await act(async () => {})
    const [rowA, rowB] = screen.getAllByTestId('work-row') as HTMLElement[]
    if (!rowA || !rowB) throw new Error('lignes absentes')
    fireEvent.click(within(rowB).getByTestId('work-row-toggle'))
    const brief = within(rowB).getByTestId('work-brief') as HTMLDetailsElement
    const note = within(rowB).getByTestId('work-note') as HTMLDetailsElement
    expect(brief.open).toBe(false)
    expect(note.open).toBe(false)
    expect(within(rowB).getByTestId('work-note-text').textContent).toBe('Ajoute un test')
    // Pas sur l'autre travail.
    fireEvent.click(within(rowA).getByTestId('work-row-toggle'))
    expect(within(rowA).queryByTestId('work-note')).toBeNull()
  })

  it('travail bavard : ses 30 modifications non commitées dites sur sa ligne (filles-tech-lead n° 10)', async () => {
    const actions = mergeActions([
      { ...candidate('b', 'dirty'), files: ['b.ts'], dirty: 30, added: 4, removed: 0 }
    ])
    view(
      working(),
      info([child('a', { status: 'busy' }), child('b', { role: front })], { merge: actions })
    )
    const rowB = () => screen.getAllByTestId('work-row')[1] as HTMLElement
    await waitFor(() =>
      expect(plain(within(rowB()).getByTestId('work-row-meta').textContent)).toContain(
        '30 modifications non commitées'
      )
    )
  })
})
