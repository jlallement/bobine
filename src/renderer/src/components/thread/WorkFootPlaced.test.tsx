/**
 * Pied d'une carte de travail qui écrit (fiche 250) : ses boutons arrivent en une fois, à leur
 * place. Relevé en CI Linux (`travaux-groupe`) : la rangée se montrait dès la fin du travail, puis
 * la lecture des branches ajoutait « Fusionner dans main » en tête ; « Ouvrir sa conversation »
 * descendait d'une ligne entre l'appui et le relâché, et le clic était perdu (« Voir les
 * modifications » pouvait de même devenir « Fusionner »).
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { act, render as testingRender, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { ChildrenMergePlan, MergeCandidate } from '@shared/children-merge'
import type { RoleBadge } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import type { SubtasksInfo } from './Subtasks'
import type { ChildrenMergeActions } from './SubtasksMerge'
import { resetPlans } from './merge-plan-store'
import { Transcript } from './Transcript'

const render = (ui: ReactNode) => testingRender(ui, { wrapper: Tooltip.Provider })
const T0 = Date.now() - 600_000
const front: RoleBadge = { name: 'front', label: 'Architecte front', icon: 'layout', color: 'blue' }

const conversation = (
  id: string,
  extra: Partial<ConversationSummary> = {}
): ConversationSummary => ({
  id,
  title: `Travail ${id}`,
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: `/tmp/${id}`,
  updatedAt: '2026-11-20T10:00:00.000Z',
  status: 'ready',
  draft: false,
  startedFrom: { id: 'mere', title: 'Mère' },
  ...extra
})

const candidate: MergeCandidate = {
  id: 'a',
  title: 'Rayons',
  branch: 'bobine/a',
  base: 'main',
  state: 'ready',
  files: ['a.ts'],
  dirty: 0
}
const plan: ChildrenMergePlan = {
  base: 'main',
  children: [candidate],
  overlaps: [],
  running: false
}

/** Lectures des branches tenues en suspens : l'essai dit quand chacune aboutit. */
function slowActions() {
  const pending: ((plan: ChildrenMergePlan) => void)[] = []
  const actions = {
    plan: vi.fn(() => new Promise<ChildrenMergePlan>((resolve) => pending.push(resolve))),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
    commitMain: vi.fn(async () => undefined),
    openGit: vi.fn()
  } satisfies ChildrenMergeActions
  const answer = async () => {
    await act(async () => {
      for (const resolve of pending.splice(0)) resolve(plan)
    })
  }
  return { actions, answer }
}

const items: TranscriptItem[] = [
  {
    kind: 'role-request',
    id: 1,
    requestId: 'd1',
    text: 'Rayons',
    works: [{ childId: 'a', role: front }],
    at: T0
  },
  {
    kind: 'child-started',
    id: 2,
    childId: 'a',
    title: 'Rayons',
    prompt: 'Rayons',
    role: front,
    request: 'd1',
    branch: 'bobine/a',
    at: T0
  },
  {
    kind: 'child-report',
    id: 3,
    childId: 'a',
    title: 'Rayons',
    outcome: 'done',
    files: [],
    fileCount: 1,
    added: 1,
    removed: 0,
    excerpt: 'Fait.',
    reply: 'Fait.',
    branch: 'bobine/a',
    at: T0 + 10_000
  }
]

const info = (actions: ChildrenMergeActions, other: ConversationSummary['status']) =>
  ({
    children: [
      conversation('a', { title: 'Rayons', branch: 'bobine/a', role: front }),
      conversation('b', { title: 'Autre', branch: 'bobine/b', status: other })
    ],
    attention: {},
    onOpen: vi.fn(),
    motherId: 'mere',
    agentLabel: 'OpenCode',
    onAsk: vi.fn(async () => undefined),
    onWarn: vi.fn(),
    merge: actions
  }) satisfies SubtasksInfo

const view = (subtasks: SubtasksInfo) => (
  <Transcript
    items={items}
    onRespondPermission={vi.fn()}
    onRespondElicitation={vi.fn()}
    subtasks={subtasks}
  />
)

/** Boutons du pied de la carte « a », dans l'ordre. */
const foot = () => {
  const card = screen
    .getAllByTestId('work-card')
    .find((c) => c.dataset['childId'] === 'a') as HTMLElement
  const row = within(card).queryByTestId('work-actions')
  return row ? [...row.querySelectorAll('button')].map((b) => b.dataset['testid']) : []
}

const originalAgent = window.api.agent
beforeEach(() => {
  resetPlans()
  localStorage.clear()
  window.api.agent = {
    onEvent: () => () => {},
    cancel: vi.fn()
  } as unknown as Window['api']['agent']
})
afterEach(() => {
  window.api.agent = originalAgent
  vi.restoreAllMocks()
})

describe('pied d’un travail qui écrit : ses boutons arrivent à leur place (fiche 250)', () => {
  it('branches pas encore lues : rien de montré, puis la rangée entière, « Fusionner » en tête', async () => {
    const { actions, answer } = slowActions()
    render(view(info(actions, 'ready')))
    // Avant la lecture : aucun bouton qui changerait de place quand elle arrive.
    expect(foot()).toEqual([])
    await answer()
    expect(foot()).toEqual(['work-merge-start', 'work-changes-open', 'work-reply', 'work-open'])
  })

  it('un autre travail change d’état : les boutons déjà montrés restent pendant la relecture', async () => {
    const { actions, answer } = slowActions()
    const shown = render(view(info(actions, 'ready')))
    await answer()
    const before = foot()
    expect(before[0]).toBe('work-merge-start')
    // L'autre travail se remet au travail : nouvel état, nouvelle lecture des branches, en suspens.
    shown.rerender(view(info(actions, 'busy')))
    expect(actions.plan).toHaveBeenCalledTimes(2)
    expect(foot()).toEqual(before)
    await answer()
    expect(foot()).toEqual(before)
  })
})
