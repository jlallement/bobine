/**
 * Rôles au travail (fiche 223, phase 3B) : la fille d'un rôle dans le fil de sa mère, ses lignes
 * dans « Sous-tâches » (ce qu'elle fait en ce moment), son compte rendu, la proposition de
 * l'agent (badge, mode, lecture seule garantie ou seulement demandée, rôle du projet qui en
 * remplace un autre) et l'en-tête de la fille.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { act, render as testingRender, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import type { IpcEventContract } from '@shared/ipc'
import { childProposalSchema, type ChildProposalItem } from '@shared/children'
import type { RoleSnapshot } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import { ChildProposals } from '../thread/ChildProposals'
import { Transcript } from '../thread/Transcript'
import { RoleTitleBadge } from './RoleWork'

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
    expect(report.textContent).toContain('Expert sécu a rendu son compte rendu — Fille a')
    expect(report.querySelector('[data-testid=role-avatar]')).toBeTruthy()
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
      view: vi.fn().mockResolvedValue({ snapshot: { controls: [] } })
    } as unknown as Window['api']['conversations']
    render(
      <ChildProposals
        items={[item(role)]}
        info={{ mother: { ...mother, profileId: motherProfile }, profiles }}
        onRespond={vi.fn()}
      />
    )
    await act(async () => {})
  }

  it('badge, mode, lecture seule garantie, agent ; rôle du projet qui en remplace un autre', async () => {
    await show(snapshot())
    expect(screen.getByTestId('proposal-title').textContent).toContain('Expert sécu — Audit')
    const meta = screen.getByTestId('proposal-role')
    expect(meta.querySelector('[data-testid=role-read-only]')?.textContent).toBe('lecture seule')
    expect(screen.getByTestId('proposal-role-mode').textContent).toBe('mode plan')
    expect(meta.textContent).toContain('Agent factice')
    expect(screen.getByTestId('proposal-role-hides').textContent).toContain('fourni')
  })

  it('agent qui écrit sans demander : lecture seule seulement demandée, sans nom d’agent', async () => {
    await show(snapshot({ hides: undefined, scope: 'builtin', mode: undefined }), 'silent')
    const tag = screen.getByTestId('role-read-only')
    expect(tag.dataset['level']).toBe('requested')
    expect(tag.textContent).toBe('lecture seule demandée')
    expect(screen.queryByTestId('proposal-role-hides')).toBeNull()
  })

  it('rôle qui écrit : « écrit du code »', async () => {
    await show(snapshot({ readOnly: false, hides: undefined }))
    expect(screen.getByTestId('role-writes').textContent).toBe('écrit du code')
  })
})

it('en-tête de la fille : son rôle et sa lecture seule', () => {
  render(<RoleTitleBadge child={child('a', secu, 'silent')} profiles={profiles} />)
  const badge = screen.getByTestId('role-title-badge')
  expect(badge.textContent).toContain('Expert sécu')
  expect(badge.textContent).toContain('lecture seule demandée')
})
