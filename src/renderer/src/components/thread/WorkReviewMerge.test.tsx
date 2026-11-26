/**
 * Carte d'un travail qui écrit avec sa relecture (fiche 265, revues UX et QA) : « Fusionner »
 * attend la fin du Code reviewer ; une remarque haute ou moyenne à traiter fait de « Faire corriger
 * « … » » l'action principale ; la correction demandée (carte, ou panneau Modifications) est dite
 * « Correction demandée · heure », les pastilles s'effacent, et rien ne repart deux fois.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { act, fireEvent, render as testingRender, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { ChildrenMergePlan, MergeCandidate } from '@shared/children-merge'
import type { DiffNote } from '@shared/diff-notes'
import type { RoleBadge } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import {
  loadDiffNotes,
  resetDiffNotesCache,
  saveDiffNotes,
  takeNewReviewNotes
} from '../../diff-notes-store'
import type { SubtasksInfo } from './Subtasks'
import type { ChildrenMergeActions } from './SubtasksMerge'
import { resetPlans } from './merge-plan-store'
import { Transcript } from './Transcript'

const render = (ui: ReactNode) => testingRender(ui, { wrapper: Tooltip.Provider })
const T0 = Date.now() - 600_000
const front: RoleBadge = { name: 'front', label: 'Architecte front', icon: 'layout', color: 'blue' }
const reviewer: RoleBadge = {
  name: 'code-reviewer',
  label: 'Code reviewer',
  icon: 'scan-search',
  color: 'blue',
  readOnly: true
}

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

function mergeActions() {
  return {
    plan: vi.fn(async (): Promise<ChildrenMergePlan> => ({
      base: 'main',
      children: [candidate],
      overlaps: [],
      running: false
    })),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
    openGit: vi.fn()
  } satisfies ChildrenMergeActions
}

const reply = (id: number, childId: string, at: number): TranscriptItem => ({
  kind: 'child-report',
  id,
  childId,
  title: childId,
  outcome: 'done',
  files: [],
  fileCount: 1,
  added: 1,
  removed: 0,
  excerpt: 'Fait.',
  reply: 'Fait.',
  branch: childId === 'a' ? 'bobine/a' : undefined,
  at
})

/** Le travail « a » qui écrit, puis sa relecture par « r », avec une remarque `severity`. */
const reviewed = (severity: 'high' | 'low', extra: TranscriptItem[] = []): TranscriptItem[] => [
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
  reply(3, 'a', T0 + 10_000),
  {
    kind: 'role-request',
    id: 4,
    requestId: 'd4',
    text: 'Relis la branche bobine/a.',
    works: [{ childId: 'r', role: reviewer, review: { of: 'a' } }],
    at: T0 + 20_000
  },
  {
    kind: 'child-started',
    id: 5,
    childId: 'r',
    title: 'Relecture : Rayons',
    prompt: 'Relis',
    role: reviewer,
    request: 'd4',
    at: T0 + 20_000
  },
  {
    kind: 'review',
    id: 6,
    reviewId: 'r',
    authorId: 'a',
    title: 'Relecture : Rayons',
    profileLabel: 'Factice',
    scope: 'branch',
    base: 'a3f2c1e',
    since: 'a3f2c1e0',
    files: 1,
    status: 'reported',
    findings: [
      {
        id: 'r:1',
        file: 'a.ts',
        line: 1,
        severity,
        category: 'correctness',
        title: 'Défaut',
        why: 'Parce que.',
        code: ''
      }
    ],
    at: T0 + 30_000
  },
  reply(7, 'r', T0 + 40_000),
  ...extra
]

const info = (reviewerStatus: ConversationSummary['status'], extra: Partial<SubtasksInfo> = {}) =>
  ({
    children: [
      conversation('a', { title: 'Rayons', branch: 'bobine/a', role: front }),
      conversation('r', {
        status: reviewerStatus,
        role: reviewer,
        reviewOf: { id: 'a', title: 'Rayons' }
      })
    ],
    attention: {},
    onOpen: vi.fn(),
    motherId: 'mere',
    agentLabel: 'OpenCode',
    onAsk: vi.fn(async () => undefined),
    onWarn: vi.fn(),
    merge: mergeActions(),
    ...extra
  }) satisfies SubtasksInfo

const view = (items: TranscriptItem[], subtasks: SubtasksInfo) =>
  render(
    <Transcript
      items={items}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      subtasks={subtasks}
    />
  )

const originalAgent = window.api.agent
beforeEach(() => {
  resetPlans()
  localStorage.clear()
  resetDiffNotesCache()
  window.api.agent = {
    onEvent: () => () => {},
    cancel: vi.fn()
  } as unknown as Window['api']['agent']
})
afterEach(() => {
  window.api.agent = originalAgent
  vi.restoreAllMocks()
})

const authorCard = () =>
  screen.getAllByTestId('work-card').find((c) => c.dataset['childId'] === 'a') as HTMLElement

describe('carte d’un travail avec sa relecture (fiche 265)', () => {
  it('relecture en cours : « Fusionner » attend sa fin (pas de nettoyage sous le relecteur)', async () => {
    view(reviewed('low').slice(0, 5), info('busy'))
    const start = (await within(authorCard()).findByTestId('work-merge-start')) as HTMLButtonElement
    expect(start.disabled).toBe(true)
    expect(start.title).toContain('relecture')
  })

  it('remarque haute à traiter : « Faire corriger » principal, « Fusionner » secondaire', async () => {
    view(reviewed('high'), info('ready'))
    const start = await within(authorCard()).findByTestId('work-merge-start')
    expect(start.className).not.toContain('primary')
    expect((start as HTMLButtonElement).disabled).toBe(false)
    const fix = within(authorCard()).getByTestId('work-fix-work')
    expect(fix.className).toContain('primary')
  })

  it('remarque basse seulement : « Fusionner » reste l’action principale', async () => {
    view(reviewed('low'), info('ready'))
    const start = await within(authorCard()).findByTestId('work-merge-start')
    expect(start.className).toContain('primary')
    expect(within(authorCard()).queryByTestId('work-fix-work')).toBeNull()
  })

  it('« Faire corriger » : la demande part, ses remarques ne repartent pas du panneau', async () => {
    // La remarque déjà reprise sur le diff du travail, en attente d'envoi.
    const note: DiffNote = {
      id: 'r:1',
      view: 'git',
      file: 'a.ts',
      path: 'a.ts',
      side: 'new',
      from: 1,
      to: 1,
      code: '',
      comment: 'Défaut',
      review: { severity: 'high', category: 'correctness' }
    }
    saveDiffNotes('a', [note])
    const subtasks = info('ready')
    view(reviewed('high'), subtasks)
    // Le pied arrive une fois la branche lue (fiche 250).
    const fix = await within(authorCard()).findByTestId('work-fix-work')
    await act(async () => fireEvent.click(fix))
    expect(subtasks.onAsk).toHaveBeenCalledWith(expect.stringContaining('Code reviewer'), 'r')
    expect(loadDiffNotes('a')).toEqual([])
    // Et jamais reprise de nouveau à l'ouverture de l'onglet.
    expect(takeNewReviewNotes([note])).toEqual([])
  })

  it('correction demandée (carte ou panneau) : « Correction demandée · heure », pastilles effacées', async () => {
    const asked: TranscriptItem = {
      kind: 'user',
      id: 8,
      text: 'Remarques sur les modifications…',
      about: 'r',
      at: T0 + 50_000
    }
    view(reviewed('high', [asked]), info('ready'))
    const nested = screen
      .getAllByTestId('work-card')
      .find((c) => c.dataset['childId'] === 'r') as HTMLElement
    expect(within(nested).getByTestId('work-review').dataset['requested']).toBe('true')
    // Plus rien à faire corriger : « Fusionner » redevient principal.
    const start = await within(authorCard()).findByTestId('work-merge-start')
    expect(start.className).toContain('primary')
    expect(within(authorCard()).queryByTestId('work-fix-work')).toBeNull()
    // Carte seule du relecteur (sans carte de travail autour) : la ligne le dit.
    const alone: TranscriptItem[] = [
      {
        kind: 'role-request',
        id: 1,
        requestId: 'd1',
        text: 'Relis',
        works: [{ childId: 'r', role: reviewer, review: { of: 'mere' } }],
        at: T0
      },
      {
        kind: 'child-started',
        id: 2,
        childId: 'r',
        title: 'R',
        prompt: 'Relis',
        role: reviewer,
        request: 'd1',
        at: T0
      },
      {
        ...(reviewed('high')[5] as Extract<TranscriptItem, { kind: 'review' }>),
        id: 3,
        authorId: 'mere'
      },
      reply(4, 'r', T0 + 40_000),
      { ...asked, id: 5 }
    ]
    screen.getAllByTestId('work-card').forEach(() => undefined)
    document.body.innerHTML = ''
    view(alone, info('ready'))
    const relay = screen.getByTestId('work-relay')
    expect(relay.textContent).toMatch(/^Correction demandée · /)
    expect(screen.queryByTestId('work-fix')).toBeNull()
  })
})
