/**
 * Rôles au travail (fiche 223, phase 3B) : la fille d'un rôle dans le fil de sa mère, ses lignes
 * dans « Sous-tâches » (ce qu'elle fait en ce moment), son compte rendu, la proposition de
 * l'agent (badge, mode, lecture seule garantie ou seulement demandée, rôle du projet qui en
 * remplace un autre) et l'en-tête de la fille.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { act, fireEvent, render as testingRender, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import type { IpcEventContract } from '@shared/ipc'
import { childProposalSchema, type ChildProposalItem } from '@shared/children'
import type { RoleSnapshot } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import type { ProposalsInfo } from '../thread/ChildProposals'
import type { RespondElicitation } from '../thread/ElicitationCard'
import { WorkGroup } from '../thread/WorkGroup'
import { Transcript } from '../thread/Transcript'
import { RoleReadOnlyTag, RoleTitleBadge } from './RoleWork'
import { badgeCompact } from './useCompactBadge'

/** La carte de groupe d'un tour de propositions (fiche 264), telle que le fil la pose. */
function ProposedWorks({
  items,
  info,
  onRespond
}: {
  items: ChildProposalItem[]
  info: ProposalsInfo
  onRespond: RespondElicitation
}) {
  return (
    <WorkGroup
      group={{ at: items[0]?.id ?? 0, rows: items.map((p) => ({ key: p.requestId, proposal: p })) }}
      items={items}
      info={undefined}
      proposals={info}
      onRespond={onRespond}
    />
  )
}

const render = (ui: ReactNode) => testingRender(ui, { wrapper: Tooltip.Provider })

const secu = {
  name: 'security-expert',
  label: 'Expert sécu',
  icon: 'shield-check',
  color: 'orange' as const,
  readOnly: true as const
}
const ux = { name: 'ux-ui-expert', label: 'Expert UX/UI', icon: 'palette', color: 'pink' as const }

const child = (
  id: string,
  role: ConversationSummary['role'],
  profileId = 'mock'
): ConversationSummary => ({
  id,
  title: `Fille ${id}`,
  profileId,
  profileLabel: 'Agent factice',
  workspace: `/tmp/${id}`,
  updatedAt: '2026-11-14T10:00:00.000Z',
  status: 'ready',
  draft: false,
  startedFrom: { id: 'mere', title: 'Mère' },
  ...(role ? { role } : {})
})

const started = (id: number, childId: string, role: typeof secu | typeof ux): TranscriptItem => ({
  kind: 'child-started',
  id,
  childId,
  title: `Fille ${childId}`,
  prompt: 'Relis le paiement.',
  role,
  at: 1
})

const profiles = [
  { id: 'mock', label: 'Agent factice', available: true },
  { id: 'silent', label: 'Silencieux', available: true, writesWithoutAsking: true }
] as unknown as ProfileSummary[]

type Listener = (payload: IpcEventContract['agent:event']) => void
const listeners = new Set<Listener>()
const original = window.api.agent
afterEach(() => {
  window.api.agent = original
  listeners.clear()
})
function watchEvents() {
  window.api.agent = {
    onEvent: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  } as unknown as Window['api']['agent']
}

describe('filles des rôles dans le fil de la mère', () => {
  it('carte à l’identité du rôle, état, lecture seule ; « Sous-tâches » : ce que chacun fait', async () => {
    watchEvents()
    render(
      <Transcript
        items={[started(1, 'a', secu), started(2, 'b', ux)]}
        onRespondPermission={vi.fn()}
        onRespondElicitation={vi.fn()}
        subtasks={{
          children: [{ ...child('a', secu, 'silent'), status: 'busy' }, child('b', ux)],
          attention: { b: 'request' },
          onOpen: vi.fn(),
          profiles
        }}
      />
    )
    const launches = screen.getAllByTestId('role-launch')
    expect(launches.map((l) => l.dataset['role'])).toEqual(['security-expert', 'ux-ui-expert'])
    expect(launches[0]?.textContent).toContain('Expert sécu')
    // Agent qui écrit sans demander : lecture seule seulement demandée.
    expect(launches[0]?.querySelector('[data-testid=role-read-only]')?.textContent).toBe(
      'lecture seule demandée'
    )
    expect(launches[1]?.dataset['state']).toBe('waiting')
    expect(launches[1]?.textContent).toContain('attend votre accord')
    // Une seule carte « Sous-tâches », au dernier lancement, avec les avatars des rôles.
    expect(screen.getAllByTestId('subtasks')).toHaveLength(1)
    const rows = screen.getAllByTestId('subtask-row')
    expect(rows[0]?.textContent).toContain('Expert sécu')
    // Ce que fait la fille en ce moment : le dernier outil annoncé par son agent.
    await act(async () => {
      for (const listener of listeners) {
        listener({
          conversationId: 'a',
          event: {
            type: 'update',
            update: { sessionUpdate: 'tool_call', toolCallId: 't', title: 'Lit token_store.dart' }
          }
        } as IpcEventContract['agent:event'])
      }
    })
    expect(screen.getAllByTestId('role-subtask-doing')[0]?.textContent).toBe('Lit token_store.dart')
    expect(launches[0]?.dataset['state']).toBe('running')
    expect(launches[0]?.textContent).toContain('Lit token_store.dart')
    // Recette (fiche 272) : OpenCode annonce « read » sans cible, puis la cible dans une mise à
    // jour sans titre ; l'activité dit ce qu'il fait, jamais le titre brut.
    const send = (update: Record<string, unknown>) =>
      act(async () => {
        for (const listener of listeners) {
          listener({
            conversationId: 'a',
            event: { type: 'update', update }
          } as unknown as IpcEventContract['agent:event'])
        }
      })
    await send({
      sessionUpdate: 'tool_call',
      toolCallId: 'r',
      title: 'read',
      kind: 'read',
      status: 'pending',
      rawInput: {}
    })
    expect(screen.getAllByTestId('role-subtask-doing')[0]?.textContent).not.toBe('read')
    await send({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'r',
      status: 'in_progress',
      locations: [{ path: '/projet/src/liste.js' }],
      rawInput: { filePath: '/projet/src/liste.js' }
    })
    expect(screen.getAllByTestId('role-subtask-doing')[0]?.textContent).toContain('liste.js')
  })

  it('rôle arrêté par ■ : « arrêté », jamais « a répondu » (fiche 258, D4)', () => {
    watchEvents()
    render(
      <Transcript
        items={[started(1, 'a', secu)]}
        onRespondPermission={vi.fn()}
        onRespondElicitation={vi.fn()}
        subtasks={{
          children: [{ ...child('a', secu), turnStopped: true }],
          attention: {},
          onOpen: vi.fn(),
          profiles
        }}
      />
    )
    const launch = screen.getByTestId('role-launch')
    expect(launch.dataset['state']).toBe('stopped')
    expect(launch.textContent).toContain('arrêté')
    expect(launch.textContent).not.toContain('a répondu')
    // L'avatar : la pastille d'échec ou d'arrêt (maquette 03-5), comme son compte rendu.
    expect(launch.querySelector('[data-testid=role-avatar]')?.getAttribute('data-state')).toBe(
      'error'
    )
    const row = screen.getByTestId('subtask-row')
    expect(row.dataset['state']).toBe('stopped')
    expect(row.querySelector('[data-testid=role-state]')?.textContent).toBe('arrêté')
    expect(screen.getByTestId('subtasks').textContent).toContain('1 arrêté')
  })

  it('compte rendu : titré du rôle, avec son avatar', () => {
    render(
      <Transcript
        items={[
          started(1, 'a', secu),
          {
            kind: 'child-report',
            id: 2,
            childId: 'a',
            title: 'Fille a',
            outcome: 'done',
            files: [],
            fileCount: 0,
            added: 0,
            removed: 0,
            excerpt: 'Rien de bloquant.',
            at: 2
          }
        ]}
        onRespondPermission={vi.fn()}
        onRespondElicitation={vi.fn()}
        subtasks={{ children: [child('a', secu)], attention: {}, onOpen: vi.fn() }}
      />
    )
    const report = screen.getByTestId('child-report')
    expect(report.dataset['role']).toBe('security-expert')
    expect(report.textContent).toContain('Expert sécu a répondu — Fille a')
    expect(report.querySelector('[data-testid=role-avatar]')).toBeTruthy()
    // Fille d'un rôle : rien à enregistrer comme rôle.
    expect(report.querySelector('[data-testid=child-report-save-role]')).toBeNull()
  })
})

describe('proposition de l’agent avec un rôle (figé)', () => {
  const snapshot = (extra: Partial<RoleSnapshot> = {}): RoleSnapshot => ({
    ...secu,
    description: 'Audite',
    prompt: 'Consigne',
    mode: 'plan',
    scope: 'project',
    hides: ['builtin'],
    ...extra
  })
  const item = (role: RoleSnapshot): ChildProposalItem =>
    ({
      kind: 'elicitation',
      id: 1,
      requestId: 'r1',
      state: 'pending',
      prompt: {
        mode: 'form',
        message: 'Audit',
        schema: childProposalSchema(),
        child: { title: 'Audit', prompt: 'Audite.', role }
      }
    }) as ChildProposalItem
  const mother = { ...child('m', undefined), startedFrom: undefined }
  const show = async (role: RoleSnapshot, motherProfile = 'mock') => {
    window.api.conversations = {
      view: vi.fn().mockResolvedValue({ snapshot: { controls: [] } }),
      childFolder: vi.fn().mockResolvedValue({ place: 'worktree', root: '/d', head: 'h' })
    } as unknown as Window['api']['conversations']
    render(
      <ProposedWorks
        items={[item(role)]}
        info={{ mother: { ...mother, profileId: motherProfile }, profiles }}
        onRespond={vi.fn()}
      />
    )
    await act(async () => {})
  }

  it('badge, mode, lecture seule garantie, agent ; rôle du projet qui en remplace un autre', async () => {
    await show(snapshot())
    // Le titre seul en gras ; le rôle dans la méta (revue UX de la fiche 264).
    expect(screen.getByTestId('proposal-title').textContent).toBe('Audit')
    const meta = screen.getByTestId('proposal-role')
    expect(meta.textContent?.startsWith('Expert sécu · ')).toBe(true)
    expect(meta.textContent).not.toContain('worktree')
    expect(meta.querySelector('[data-testid=role-read-only]')?.textContent).toBe('lecture seule')
    expect(screen.getByTestId('proposal-role-mode').textContent).toBe('mode plan')
    expect(meta.textContent).toContain('Agent factice')
    expect(screen.getByTestId('proposal-role-hides').textContent).toContain('fourni')
    // Lecture seule : dans le dossier de la mère ; le pied de la carte le dit.
    expect(screen.getByTestId('work-group-where').textContent).toBe(
      'Chaque rôle de conseil lit ce dossier sans rien modifier.'
    )
  })

  it('agent qui écrit sans demander : lecture seule seulement demandée, sans nom d’agent', async () => {
    await show(snapshot({ hides: undefined, scope: 'builtin', mode: undefined }), 'silent')
    const tag = screen.getByTestId('role-read-only')
    expect(tag.dataset['level']).toBe('requested')
    expect(tag.textContent).toBe('lecture seule demandée')
    expect(screen.queryByTestId('proposal-role-hides')).toBeNull()
  })

  it('rôle qui écrit : « écrit dans sa branche »', async () => {
    await show(snapshot({ readOnly: false, hides: undefined }))
    expect(screen.getByTestId('proposal-place').textContent).toBe('écrit dans sa branche')
    expect(screen.getByTestId('work-group-where').textContent).toContain(
      'Chaque travail part du dernier commit'
    )
  })
})

it('en-tête de la fille : son rôle et sa lecture seule', () => {
  render(<RoleTitleBadge child={child('a', secu, 'silent')} profiles={profiles} />)
  const badge = screen.getByTestId('role-title-badge')
  expect(badge.textContent).toContain('Expert sécu')
  expect(badge.textContent).toContain('lecture seule demandée')
})

// Remplace `e2e/suites/roles-travail.mjs` n° 19 : agent qui demande avant d'écrire, lecture seule garantie.
it('en-tête de la fille : son rôle et sa lecture seule garantie (agent qui demande)', () => {
  render(<RoleTitleBadge child={child('a', secu)} profiles={profiles} />)
  const badge = screen.getByTestId('role-title-badge')
  expect(badge.textContent).toContain('Expert sécu')
  const tag = screen.getByTestId('role-read-only')
  expect(tag.dataset['level']).toBe('enforced')
  expect(tag.textContent).toBe('lecture seule')
})

describe('en-tête étroit d’une fille : la pastille se réduit à son icône', () => {
  it('réduite : l’icône seule, le texte pour le lecteur d’écran et en infobulle', async () => {
    render(<RoleReadOnlyTag level="enforced" compact />)
    const tag = screen.getByTestId('role-read-only')
    expect(tag.classList.contains('compact')).toBe(true)
    expect(tag.querySelector('svg')).toBeTruthy()
    expect(tag.querySelector('.sr-only')?.textContent).toBe('lecture seule')
    expect(tag.tabIndex).toBe(0)
    fireEvent.focus(tag)
    await waitFor(() =>
      expect(screen.getAllByRole('tooltip')[0]?.textContent).toBe('lecture seule')
    )
  })

  it('demandée et réduite : l’infobulle dit aussi pourquoi', async () => {
    render(<RoleReadOnlyTag level="requested" compact />)
    fireEvent.focus(screen.getByTestId('role-read-only'))
    await waitFor(() =>
      expect(screen.getAllByRole('tooltip')[0]?.textContent).toMatch(/^lecture seule demandée — /)
    )
  })

  it('entière tant qu’elle tient ; réduite au-delà ; rendue entière avec une marge', () => {
    expect(badgeCompact(false, { natural: 200, available: 200 })).toBe(false)
    expect(badgeCompact(false, { natural: 200, available: 199 })).toBe(true)
    // Réduite : pas d'aller-retour au pixel près.
    expect(badgeCompact(true, { natural: 200, available: 202 })).toBe(true)
    expect(badgeCompact(true, { natural: 200, available: 204 })).toBe(false)
  })
})

describe('fil de la fille d’un rôle (essais réels avant 1.0.0-beta.2)', () => {
  it('premier message : la demande seule, la consigne du rôle repliée sous « Consigne du rôle »', () => {
    render(
      <Transcript
        items={[
          {
            kind: 'user',
            id: 1,
            text: 'Relis auth.js\n\n<bobine_role name="security-expert">\nAudit only.\n</bobine_role>'
          }
        ]}
        onRespondPermission={vi.fn()}
        onRespondElicitation={vi.fn()}
      />
    )
    const message = document.querySelector('.msg-user') as HTMLElement
    expect(message.textContent).toBe('Relis auth.js')
    expect(document.body.textContent).not.toContain('<bobine_role')
    expect(screen.queryByTestId('role-brief-text')).toBeNull()
    act(() => screen.getByTestId('role-brief-toggle').click())
    expect(screen.getByTestId('role-brief-text').textContent).toBe('Audit only.')
  })
})

describe('coût d’un compte rendu (essais réels avant 1.0.0-beta.2)', () => {
  const report = (id: number, amount: number): TranscriptItem => ({
    kind: 'child-report',
    id,
    childId: 'a',
    title: 'Fille a',
    outcome: 'done',
    files: [],
    fileCount: 0,
    added: 0,
    removed: 0,
    excerpt: 'Rien.',
    at: id,
    usage: { cost: { amount, currency: 'bobcoin' } }
  })
  const costs = () =>
    screen.getAllByTestId('child-report-usage').map((u) => u.textContent?.replace(/\s/g, ' '))

  it('coût lu après le tour (Bob) : le dernier compte rendu prend celui de la fille, comme « Sous-tâches »', () => {
    const late = { ...child('a', secu), usage: { cost: { amount: 0.1137, currency: 'bobcoin' } } }
    render(
      <Transcript
        items={[started(1, 'a', secu), report(2, 0.01), report(3, 0.0371)]}
        onRespondPermission={vi.fn()}
        onRespondElicitation={vi.fn()}
        subtasks={{ children: [late], attention: {}, onOpen: vi.fn(), profiles }}
      />
    )
    const shown = costs()
    expect(shown[0]).toContain('0,01')
    expect(shown[1]).toContain('0,1137')
    expect(screen.getByTestId('subtask-cost').textContent?.replace(/\s/g, ' ')).toContain('0,1137')
  })
})
