/**
 * Bulle « @Rôle … » et carte-réponse unique (fiche 263, écran A de la fiche 260) : rendu dans le
 * fil de la mère, états (en cours, a répondu, transmise, arrêté, en erreur), actions (arrêter,
 * appliquer, répondre, relancer, voir les modifications), et ce qui ne change pas (« Sous-tâches »
 * pour les travaux de l'agent, anciennes conversations).
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { act, fireEvent, render as testingRender, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { IpcEventContract } from '@shared/ipc'
import type { RoleBadge } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import type { UsageDigest } from '@shared/usage'
import { onRoleInvoked, resetRolesUi } from '../../roles/roles-store'
import type { SubtasksInfo } from './Subtasks'
import { Transcript } from './Transcript'
import { elapsedText } from './WorkCard'

const render = (ui: ReactNode) => testingRender(ui, { wrapper: Tooltip.Provider })

const ux: RoleBadge = {
  name: 'ux-ui-expert',
  label: 'Expert UX/UI',
  icon: 'palette',
  color: 'pink',
  readOnly: true
}
const front: RoleBadge = {
  name: 'front-architect',
  label: 'Architecte front',
  icon: 'layout',
  color: 'blue'
}

const ANSWER = [
  '### Direction : « Le carnet de courses calme »',
  '',
  'Une seule colonne, beaucoup d’air.',
  '',
  '- Papier `#f6f1e7` en fond.',
  '- Sauge pour la coche.',
  '',
  'FIN-DE-L-AVIS'
].join('\n')

const child = (
  id: string,
  role: RoleBadge,
  extra: Partial<ConversationSummary> = {}
): ConversationSummary => ({
  id,
  title: `Travail ${id}`,
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: `/tmp/${id}`,
  updatedAt: '2026-11-19T21:00:00.000Z',
  status: 'ready',
  draft: false,
  startedFrom: { id: 'mere', title: 'Mère' },
  role,
  ...extra
})

const bubble = (id: number, works: { childId: string; role: RoleBadge }[]): TranscriptItem => ({
  kind: 'role-request',
  id,
  requestId: `d${id}`,
  text: 'À quoi ça pourrait ressembler ? Propose une direction.',
  works,
  at: Date.parse('2026-11-19T21:13:00Z')
})

const started = (
  id: number,
  childId: string,
  role: RoleBadge,
  request: string,
  extra: Partial<Extract<TranscriptItem, { kind: 'child-started' }>> = {}
): TranscriptItem => ({
  kind: 'child-started',
  id,
  childId,
  title: `Travail ${childId}`,
  prompt: 'Propose une direction.',
  role,
  request,
  at: Date.parse('2026-11-19T21:13:00Z'),
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
  fileCount: 0,
  added: 0,
  removed: 0,
  excerpt: 'Direction : « Le carnet de courses calme »',
  reply: ANSWER,
  // 1 min 38 s après la demande.
  at: Date.parse('2026-11-19T21:14:38Z'),
  ...extra
})

const free: UsageDigest = { cost: { amount: 0, currency: 'USD' } }

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

const view = (items: TranscriptItem[], subtasks: SubtasksInfo) =>
  render(
    <Transcript
      items={items}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      subtasks={subtasks}
    />
  )

type Listener = (payload: IpcEventContract['agent:event']) => void
const listeners = new Set<Listener>()
const originalAgent = window.api.agent
const originalRoles = (window.api as { roles?: Window['api']['roles'] }).roles
afterEach(() => {
  window.api.agent = originalAgent
  ;(window.api as { roles?: Window['api']['roles'] }).roles = originalRoles
  listeners.clear()
  resetRolesUi()
  vi.useRealTimers()
})
function fakeAgent() {
  const cancel = vi.fn(async () => undefined)
  window.api.agent = {
    onEvent: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    cancel
  } as unknown as Window['api']['agent']
  return { cancel }
}
function emit(conversationId: string, event: IpcEventContract['agent:event']['event']) {
  for (const listener of listeners)
    listener({ conversationId, event } as IpcEventContract['agent:event'])
}

/** Le repli ne se mesure pas dans jsdom : on dit à la carte que la réponse dépasse. */
function overflowing() {
  const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900)
  const client = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(250)
  return () => {
    height.mockRestore()
    client.mockRestore()
  }
}

describe('bulle et carte-réponse (fiche 263)', () => {
  it('en cours : la bulle avec la puce du rôle, une carte juste dessous, rien d’autre', async () => {
    const { cancel } = fakeAgent()
    const subtasks = info([child('a', ux, { status: 'busy' })])
    view(
      [
        { kind: 'user', id: 1, text: 'Bonjour', at: 1 },
        { kind: 'agent', id: 2, text: 'Salut.', at: 2 },
        bubble(3, [{ childId: 'a', role: ux }]),
        started(4, 'a', ux, 'd3')
      ],
      subtasks
    )
    const request = screen.getByTestId('role-request')
    expect(within(request).getByTestId('role-mention').textContent).toBe('Expert UX/UI')
    expect(request.textContent).toContain('Propose une direction.')
    const card = screen.getByTestId('work-card')
    // Juste sous la bulle, dans l'ordre du fil.
    expect(request.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(card.dataset['state']).toBe('running')
    expect(card.dataset['workAnchor']).toBe('4')
    expect(within(card).getByTestId('work-place').textContent).toBe(
      'lecture seule · dans ce dossier'
    )
    expect(within(card).getByTestId('work-state').textContent).toMatch(/^(\d+:)?\d+:\d\d$/)
    // Plus de lancement, de ligne « Sous-tâches » ni de compte rendu séparés.
    expect(screen.queryByTestId('role-launch')).toBeNull()
    expect(screen.queryByTestId('subtasks')).toBeNull()
    expect(screen.queryByTestId('child-report')).toBeNull()
    // Activité en direct : l'outil en cours, puis les derniers faits.
    await act(async () => {
      emit('a', {
        type: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 't1',
          title: 'Lecture de src/style.css',
          status: 'in_progress'
        }
      })
    })
    expect(within(card).getByTestId('work-live-current').textContent).toBe(
      'Lecture de src/style.css…'
    )
    await act(async () => {
      emit('a', {
        type: 'update',
        update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' }
      })
      emit('a', {
        type: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 't2',
          title: 'Lecture de src/main.ts',
          status: 'in_progress'
        }
      })
    })
    expect(within(card).getByTestId('work-live-done').textContent).toBe('Lecture de src/style.css')
    expect(within(card).getByTestId('work-live-current').textContent).toBe(
      'Lecture de src/main.ts…'
    )
    // « Arrêter » n'arrête que ce travail ; « Ouvrir sa conversation ».
    fireEvent.click(within(card).getByTestId('work-stop'))
    expect(cancel).toHaveBeenCalledWith('a')
    fireEvent.click(within(card).getByTestId('work-open'))
    expect(subtasks.onOpen).toHaveBeenCalledWith('a')
    expect(screen.queryByTestId('work-apply')).toBeNull()
    expect(screen.queryByTestId('work-relay')).toBeNull()
  })

  it('a répondu : la réponse entière en Markdown, repliée, « Lire la suite » ; durée · gratuit', () => {
    fakeAgent()
    const restore = overflowing()
    try {
      view(
        [
          bubble(1, [{ childId: 'a', role: ux }]),
          started(2, 'a', ux, 'd1'),
          report(3, 'a', { usage: free })
        ],
        info([child('a', ux)])
      )
      const card = screen.getByTestId('work-card')
      expect(card.dataset['state']).toBe('replied')
      expect(within(card).getByTestId('work-state').textContent).toMatch(/^a répondu · /)
      const body = within(card).getByTestId('work-body')
      // Entière, en Markdown (titre, liste, code), jusqu'à sa dernière ligne.
      expect(body.querySelector('h3')?.textContent).toContain('Le carnet de courses calme')
      expect(body.querySelectorAll('li')).toHaveLength(2)
      expect(body.textContent).toContain('FIN-DE-L-AVIS')
      expect(body.dataset['folded']).toBe('true')
      const more = within(card).getByTestId('work-more')
      expect(more.textContent).toBe('Lire la suite')
      fireEvent.click(more)
      expect(within(card).getByTestId('work-body').dataset['folded']).toBeUndefined()
      expect(within(card).getByTestId('work-more').textContent).toBe('Replier')
      expect(within(card).getByTestId('work-more').getAttribute('aria-expanded')).toBe('true')
      expect(within(card).getByTestId('work-facts').textContent).toBe('1 min 38 s · gratuit')
      expect(within(card).getByTestId('work-relay').textContent).toBe(
        'Pas encore transmise à OpenCode — elle le sera avec votre prochain message'
      )
    } finally {
      restore()
    }
  })

  it('« Demander à <agent> de l’appliquer » envoie le message préparé à l’agent de la conversation', () => {
    fakeAgent()
    const subtasks = info([child('a', ux)])
    view(
      [bubble(1, [{ childId: 'a', role: ux }]), started(2, 'a', ux, 'd1'), report(3, 'a')],
      subtasks
    )
    const apply = screen.getByTestId('work-apply')
    expect(apply.textContent).toBe('Demander à OpenCode de l’appliquer')
    fireEvent.click(apply)
    expect(subtasks.onAsk).toHaveBeenCalledWith('Applique la proposition d’Expert UX/UI ci-dessus.')
  })

  it('transmise : la carte reste à sa place, l’action principale disparaît, réponse plus discrète', () => {
    fakeAgent()
    view(
      [
        bubble(1, [{ childId: 'a', role: ux }]),
        started(2, 'a', ux, 'd1'),
        report(3, 'a'),
        { kind: 'user', id: 4, text: 'Applique.', at: Date.parse('2026-11-19T21:16:00Z') }
      ],
      info([child('a', ux)])
    )
    const card = screen.getByTestId('work-card')
    expect(within(card).getByTestId('work-relay').dataset['sent']).toBe('true')
    expect(within(card).getByTestId('work-relay').textContent).toMatch(/^Transmise à OpenCode · /)
    expect(within(card).getByTestId('work-body').className).toContain('relayed')
    expect(screen.queryByTestId('work-apply')).toBeNull()
    // La carte précède le message qui l'a transmise.
    const message = screen.getByTestId('user-message')
    expect(card.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('arrêté : état clair, « Relancer » renvoie la même demande au même travail', async () => {
    fakeAgent()
    const reply = vi.fn(async () => 'sent' as const)
    ;(window.api as unknown as { roles: unknown }).roles = { reply }
    view(
      [
        bubble(1, [{ childId: 'a', role: ux }]),
        started(2, 'a', ux, 'd1'),
        report(3, 'a', { outcome: 'stopped', reply: 'Début de réponse' })
      ],
      info([child('a', ux, { turnStopped: true })])
    )
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('stopped')
    expect(within(card).getByTestId('work-state').textContent).toBe('arrêté')
    expect(card.textContent).toContain('Arrêté avant la fin de sa réponse.')
    expect(screen.queryByTestId('work-apply')).toBeNull()
    await act(async () => fireEvent.click(within(card).getByTestId('work-retry')))
    expect(reply).toHaveBeenCalledWith('mere', {
      childId: 'a',
      text: 'À quoi ça pourrait ressembler ? Propose une direction.'
    })
  })

  it('en erreur : l’erreur dite, « Relancer » ; un échec de l’envoi est dit', async () => {
    fakeAgent()
    const reply = vi.fn(async () => {
      throw new Error('agent absent')
    })
    ;(window.api as unknown as { roles: unknown }).roles = { reply }
    const subtasks = info([child('a', ux, { status: 'error' })])
    view(
      [
        bubble(1, [{ childId: 'a', role: ux }]),
        started(2, 'a', ux, 'd1'),
        report(3, 'a', { outcome: 'error', excerpt: 'Agent à connecter', reply: undefined })
      ],
      subtasks
    )
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('error')
    expect(within(card).getByTestId('work-error').textContent).toBe('Agent à connecter')
    await act(async () => fireEvent.click(within(card).getByTestId('work-retry')))
    expect(subtasks.onWarn).toHaveBeenCalledWith(expect.stringContaining('agent absent'))
  })

  it('« Répondre à <rôle> » pose la puce dans la saisie ; la suite et sa réponse vont dans la même carte', () => {
    fakeAgent()
    const received = vi.fn()
    const stop = onRoleInvoked(received)
    const items = [
      bubble(1, [{ childId: 'a', role: ux }]),
      started(2, 'a', ux, 'd1'),
      report(3, 'a')
    ]
    const { rerender } = view(items, info([child('a', ux)]))
    fireEvent.click(screen.getByTestId('work-reply'))
    expect(received).toHaveBeenCalledWith('ux-ui-expert', { replyTo: 'a' })
    stop()
    const followUp: TranscriptItem = {
      kind: 'role-request',
      id: 4,
      requestId: 'd4',
      text: 'Et les contrastes ?',
      works: [{ childId: 'a', role: ux }],
      followUp: true,
      at: Date.parse('2026-11-19T21:20:00Z')
    }
    rerender(
      <Tooltip.Provider>
        <Transcript
          items={[
            ...items,
            followUp,
            report(5, 'a', {
              reply: 'Contrastes AA partout.',
              at: Date.parse('2026-11-19T21:21:00Z')
            })
          ]}
          onRespondPermission={vi.fn()}
          onRespondElicitation={vi.fn()}
          subtasks={info([child('a', ux)])}
        />
      </Tooltip.Provider>
    )
    expect(screen.getAllByTestId('work-card')).toHaveLength(1)
    expect(screen.getAllByTestId('role-request')).toHaveLength(1)
    const card = screen.getByTestId('work-card')
    expect(within(card).getByTestId('work-ask').textContent).toBe('Et les contrastes ?')
    const answers = within(card).getAllByTestId('work-answer')
    expect(answers).toHaveLength(2)
    expect(answers[1]?.textContent).toContain('Contrastes AA partout.')
    // Durée de l'échange en cours : depuis la suite (1 min).
    expect(within(card).getByTestId('work-facts').textContent).toBe('1 min 0 s')
  })

  it('rôle qui écrit : « écrit dans sa branche », branche et fichiers, « Voir les modifications »', () => {
    fakeAgent()
    const openGit = vi.fn()
    const merge = { openGit } as unknown as NonNullable<SubtasksInfo['merge']>
    view(
      [
        bubble(1, [{ childId: 'b', role: front }]),
        started(2, 'b', front, 'd1', {
          branch: 'bobine/rayons',
          leftBehind: { count: 2, commit: 'a3f2c1e' }
        }),
        report(3, 'b', {
          branch: 'bobine/rayons',
          files: [{ path: 'src/list.ts', added: 115, removed: 64 }],
          fileCount: 4,
          added: 115,
          removed: 64,
          reply: 'Rayons ajoutés.'
        })
      ],
      info([child('b', front, { branch: 'bobine/rayons' })], { merge })
    )
    const card = screen.getByTestId('work-card')
    expect(within(card).getByTestId('work-place').textContent).toBe('écrit dans sa branche')
    const changes = within(card).getByTestId('work-changes')
    expect(changes.textContent).toContain('bobine/rayons')
    expect(changes.textContent).toContain('4 fichiers')
    expect(screen.queryByTestId('work-apply')).toBeNull()
    // Parti sans le non commité de la mère (fiche 240) : rappelé sur la carte.
    expect(within(card).getByTestId('work-left-behind').textContent).toContain('a3f2c1e')
    fireEvent.click(within(card).getByTestId('work-changes-open'))
    expect(openGit).toHaveBeenCalledWith('b')
  })

  it('plusieurs rôles : une bulle, deux puces, une carte par rôle dessous', () => {
    fakeAgent()
    view(
      [
        bubble(1, [
          { childId: 'a', role: ux },
          { childId: 'b', role: front }
        ]),
        started(2, 'a', ux, 'd1'),
        started(3, 'b', front, 'd1', { branch: 'bobine/x' })
      ],
      info([
        child('a', ux, { status: 'busy' }),
        child('b', front, { status: 'busy', branch: 'bobine/x' })
      ])
    )
    expect(screen.getAllByTestId('role-mention').map((m) => m.dataset['role'])).toEqual([
      'ux-ui-expert',
      'front-architect'
    ])
    expect(screen.getAllByTestId('work-card').map((c) => c.dataset['role'])).toEqual([
      'ux-ui-expert',
      'front-architect'
    ])
  })

  it('un travail lancé par l’agent garde sa carte « Sous-tâches » et son compte rendu, sans ceux des bulles', () => {
    fakeAgent()
    view(
      [
        bubble(1, [{ childId: 'a', role: ux }]),
        started(2, 'a', ux, 'd1'),
        {
          kind: 'child-started',
          id: 3,
          childId: 'g',
          title: 'Import',
          prompt: 'Importe',
          by: 'agent',
          at: 3
        },
        report(4, 'a'),
        report(5, 'g', { reply: undefined })
      ],
      info([child('a', ux), { ...child('g', ux), role: undefined }])
    )
    const rows = screen.getAllByTestId('subtask-row')
    expect(rows.map((r) => r.dataset['id'])).toEqual(['g'])
    expect(screen.getAllByTestId('child-report').map((r) => r.dataset['outcome'])).toEqual(['done'])
    expect(screen.getAllByTestId('work-card')).toHaveLength(1)
  })

  it('ancienne conversation (sans bulle) : lancement, « Sous-tâches » et compte rendu comme avant', () => {
    fakeAgent()
    const { request: _request, ...old } = started(1, 'a', ux, 'd1') as Extract<
      TranscriptItem,
      { kind: 'child-started' }
    >
    view([old, report(2, 'a', { reply: undefined })], info([child('a', ux)]))
    expect(screen.getByTestId('role-launch')).toBeTruthy()
    expect(screen.getByTestId('subtasks')).toBeTruthy()
    expect(screen.getByTestId('child-report')).toBeTruthy()
    expect(screen.queryByTestId('work-card')).toBeNull()
  })

  it('conversation du travail supprimée, sans réponse : la carte le dit, sans action', () => {
    fakeAgent()
    view([bubble(1, [{ childId: 'a', role: ux }]), started(2, 'a', ux, 'd1')], info([]))
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('gone')
    expect(within(card).getByTestId('work-state').textContent).toBe('conversation supprimée')
    expect(within(card).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('temps écoulé', () => {
  it('minutes et secondes, puis heures', () => {
    expect(elapsedText(42_000)).toBe('0:42')
    expect(elapsedText(725_000)).toBe('12:05')
    expect(elapsedText(3_729_000)).toBe('1:02:09')
    expect(elapsedText(-5)).toBe('0:00')
  })
})
