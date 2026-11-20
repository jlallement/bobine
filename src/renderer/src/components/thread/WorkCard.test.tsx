/**
 * Bulle « @Rôle … » et carte-réponse unique (fiche 263, écran A de la fiche 260, revues UX et QA) :
 * rendu dans le fil de la mère, états (en cours, a répondu, en attente, sans réponse, transmise,
 * arrêté, en erreur, inconnu), actions (arrêter, appliquer, répondre, relancer, voir les
 * modifications), échanges à plusieurs tours, et ce qui ne change pas (« Sous-tâches » pour les
 * travaux de l'agent, anciennes conversations).
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

/** Il y a dix minutes : passé (délai d'un envoi écoulé), et l'heure s'affiche sans le jour. */
const T0 = Date.now() - 600_000
/** Espaces insécables de la typographie française (« : », « ; ») ramenées à des espaces. */
const plain = (text: unknown) => String(text).replace(/[\u00a0\u202f]/g, ' ')
const at = (seconds: number) => T0 + seconds * 1000
/** Heure d'une réponse (avec le jour, si l'essai passe minuit). */
const HH_MM = /^[^·]*\d\d:\d\d · /

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
  at: at(0)
})

const followUp = (id: number, childId: string, text: string, seconds: number): TranscriptItem => ({
  kind: 'role-request',
  id,
  requestId: `d${id}`,
  text,
  works: [{ childId, role: ux }],
  followUp: true,
  at: at(seconds)
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
  at: at(0),
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
  at: at(98),
  ...extra
})

const usd = (amount: number): UsageDigest => ({ cost: { amount, currency: 'USD' } })
/** Coût d'un modèle qui se dit gratuit (fiche 266). */
const free = (): UsageDigest => ({ ...usd(0), free: true })

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

const view = (items: TranscriptItem[], subtasks?: SubtasksInfo) =>
  render(
    <Transcript
      items={items}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      {...(subtasks ? { subtasks } : {})}
    />
  )

/** La carte qui a répondu à une demande, avec sa réponse. */
const answered = (extra: Partial<Extract<TranscriptItem, { kind: 'child-report' }>> = {}) => [
  bubble(1, [{ childId: 'a', role: ux }]),
  started(2, 'a', ux, 'd1'),
  report(3, 'a', extra)
]

type Listener = (payload: IpcEventContract['agent:event']) => void
const listeners = new Set<Listener>()
const originalAgent = window.api.agent
const originalRoles = (window.api as { roles?: Window['api']['roles'] }).roles
afterEach(() => {
  window.api.agent = originalAgent
  ;(window.api as { roles?: Window['api']['roles'] }).roles = originalRoles
  listeners.clear()
  resetRolesUi()
  vi.restoreAllMocks()
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
  for (const listener of listeners) {
    listener({ conversationId, event } as IpcEventContract['agent:event'])
  }
}
function fakeReply(reply: (...args: unknown[]) => Promise<unknown>) {
  const fn = vi.fn(reply)
  ;(window.api as unknown as { roles: unknown }).roles = { reply: fn }
  return fn
}
/** Une promesse que l'essai tient en main. */
function deferred() {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

/** Le repli ne se mesure pas dans jsdom : on dit à la carte que la réponse dépasse. */
function overflowing() {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(900)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(250)
}

describe('bulle et carte-réponse (fiche 263)', () => {
  it('en cours : la bulle et sa carte dans un même groupe ; « Travaille… », puis les faits au passé', async () => {
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
    const group = screen.getByTestId('role-request-group')
    const request = within(group).getByTestId('role-request')
    expect(within(request).getByTestId('role-mention').textContent).toBe('Expert UX/UI')
    const card = within(group).getByTestId('work-card')
    expect(request.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(card.dataset['state']).toBe('running')
    expect(card.dataset['workAnchor']).toBe('4')
    expect(card.querySelector('[data-testid=role-avatar]')?.getAttribute('data-state')).toBe(
      'running'
    )
    expect(within(card).getByTestId('work-place').textContent).toBe(
      'lecture seule · dans ce dossier'
    )
    expect(within(card).getByTestId('work-state').textContent).toMatch(/^(\d+:)?\d+:\d\d$/)
    expect(within(card).getByTestId('work-live-current').textContent).toBe('Travaille…')
    expect(screen.queryByTestId('role-launch')).toBeNull()
    expect(screen.queryByTestId('subtasks')).toBeNull()
    expect(screen.queryByTestId('child-report')).toBeNull()
    await act(async () => {
      emit('a', {
        type: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 't1',
          title: 'Lecture de src/style.css',
          kind: 'read',
          status: 'in_progress',
          locations: [{ path: 'src/style.css' }]
        }
      })
    })
    expect(within(card).getByTestId('work-live-current').textContent).toBe('Lit src/style.css…')
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
          title: 'npm test',
          kind: 'execute',
          status: 'in_progress'
        }
      })
    })
    expect(within(card).getByTestId('work-live-done').textContent).toBe('A lu src/style.css')
    expect(within(card).getByTestId('work-live-current').textContent).toBe('Lance npm test…')
    // Une seule rangée : « Arrêter », puis « Ouvrir sa conversation » au bout.
    const actions = within(card).getByTestId('work-actions')
    fireEvent.click(within(actions).getByTestId('work-stop'))
    expect(cancel).toHaveBeenCalledWith('a')
    fireEvent.click(within(actions).getByTestId('work-open'))
    expect(subtasks.onOpen).toHaveBeenCalledWith('a')
    expect(screen.queryByTestId('work-apply')).toBeNull()
    expect(screen.queryByTestId('work-relay')).toBeNull()
  })

  it('coût nul d’un modèle payant (abonnement, D12) : « coût non communiqué » dans le pied (fiche 266)', () => {
    fakeAgent()
    view(answered({ usage: usd(0) }), info([child('a', ux)]))
    const facts =
      within(screen.getByTestId('work-card')).getByTestId('work-facts').textContent ?? ''
    expect(facts).toContain('coût non communiqué')
    expect(facts).not.toContain('gratuit')
    expect(facts).not.toContain('$')
  })

  it('a répondu : la réponse entière, repliée, « Lire la suite » ; pied « heure · durée · gratuit »', () => {
    fakeAgent()
    overflowing()
    view(answered({ usage: free() }), info([child('a', ux)]))
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('replied')
    expect(within(card).getByTestId('work-state').textContent).toMatch(
      /^a répondu · [^·]*\d\d:\d\d$/
    )
    const body = within(card).getByTestId('work-body')
    expect(body.querySelector('h3')?.textContent).toContain('Le carnet de courses calme')
    expect(body.querySelectorAll('li')).toHaveLength(2)
    expect(body.textContent).toContain('FIN-DE-L-AVIS')
    expect(body.dataset['folded']).toBe('true')
    const more = within(card).getByTestId('work-more')
    expect(more.textContent).toBe('Lire la suite')
    expect(more.querySelector('svg')).toBeTruthy()
    fireEvent.click(more)
    expect(within(card).getByTestId('work-body').dataset['folded']).toBeUndefined()
    expect(within(card).getByTestId('work-more').textContent).toBe('Replier')
    expect(within(card).getByTestId('work-more').getAttribute('aria-expanded')).toBe('true')
    const facts = within(card).getByTestId('work-facts').textContent ?? ''
    expect(facts).toMatch(HH_MM)
    expect(facts.replace(HH_MM, '')).toBe('1 min 38 s · gratuit')
    expect(within(card).getByTestId('work-relay').textContent).toBe(
      'Pas encore transmise à OpenCode — elle le sera avec votre prochain message'
    )
  })

  it('« Appliquer » : message lisible (rôle, titre), le travail visé à part ; un clic à la fois', async () => {
    fakeAgent()
    const sending = deferred()
    const onAsk = vi.fn(() => sending.promise)
    view(answered(), info([child('a', ux)], { onAsk }))
    const apply = screen.getByTestId('work-apply')
    expect(apply.textContent).toBe('Demander à OpenCode d’appliquer cette réponse')
    fireEvent.click(apply)
    await act(async () => {})
    fireEvent.click(screen.getByTestId('work-apply'))
    await act(async () => {})
    expect(onAsk).toHaveBeenCalledTimes(1)
    const [message, about] = (onAsk.mock.calls[0] as unknown[] | undefined) ?? []
    // Lisible : le rôle et le titre, sans son préfixe ; le travail part à part, jamais dans le texte.
    expect(plain(message)).toBe(
      'Applique la proposition d’Expert UX/UI : « Le carnet de courses calme ».'
    )
    expect(about).toBe('a')
    expect((screen.getByTestId('work-apply') as HTMLButtonElement).disabled).toBe(true)
    await act(async () => sending.resolve())
    expect((screen.getByTestId('work-apply') as HTMLButtonElement).disabled).toBe(false)
  })

  it('« Appliquer » sans titre : le rôle seul ; masqué quand un message attend dans la file', async () => {
    fakeAgent()
    const onAsk = vi.fn()
    const { unmount } = view(
      answered({ reply: 'Fond papier, coche sauge.' }),
      info([child('a', ux)], { onAsk })
    )
    fireEvent.click(screen.getByTestId('work-apply'))
    await act(async () => {})
    expect(plain((onAsk.mock.calls[0] as unknown[] | undefined)?.[0])).toBe(
      'Applique la proposition d’Expert UX/UI.'
    )
    unmount()
    view(answered(), info([child('a', ux)], { onAsk, motherQueued: true }))
    expect(screen.queryByTestId('work-apply')).toBeNull()
  })

  it('transmise : action principale retirée, réponse discrète ; pas « transmise » si le tour a échoué', () => {
    fakeAgent()
    const sent: TranscriptItem = { kind: 'user', id: 4, text: 'Applique.', at: at(120) }
    const { unmount } = view([...answered(), sent], info([child('a', ux)]))
    const card = screen.getByTestId('work-card')
    expect(within(card).getByTestId('work-relay').dataset['sent']).toBe('true')
    expect(within(card).getByTestId('work-relay').textContent).toMatch(/^Transmise à OpenCode · /)
    expect(within(card).getByTestId('work-body').className).toContain('relayed')
    expect(screen.queryByTestId('work-apply')).toBeNull()
    unmount()
    // Le message est parti, mais son tour a fini en erreur sans réponse : rien ne dit que l'agent
    // l'a reçu.
    view(
      [
        ...answered(),
        sent,
        {
          kind: 'notice',
          id: 5,
          level: 'error',
          message: { key: 'transcript.notice.error', params: { message: 'Server Error' } }
        }
      ],
      info([child('a', ux)])
    )
    expect(screen.getByTestId('work-relay').dataset['sent']).toBe('false')
    expect(screen.getByTestId('work-apply')).toBeTruthy()
  })

  it('deux échanges : chacun son pied et son coût ; la première transmise, la dernière pas encore', () => {
    fakeAgent()
    view(
      [
        ...answered({ usage: usd(0.1) }),
        { kind: 'user', id: 4, text: 'Applique.', at: at(120) },
        followUp(5, 'a', 'Et les contrastes ?', 200),
        report(6, 'a', { reply: 'Contrastes AA.', at: at(260), askedAt: at(201), usage: usd(0.25) })
      ],
      // Conversation au repos, son coût à jour : celui de la dernière réponse.
      info([child('a', ux, { usage: usd(0.25) })])
    )
    const card = screen.getByTestId('work-card')
    const answers = within(card).getAllByTestId('work-answer')
    expect(answers).toHaveLength(2)
    const facts = within(card)
      .getAllByTestId('work-facts')
      .map((f) => (f.textContent ?? '').replace(HH_MM, ''))
    expect(facts[0]).toMatch(/^1 min 38 s · ≈ 0,10\s\$US$/)
    // Le second échange : sa durée (depuis la suite) et son coût seul (0,25 − 0,10).
    expect(facts[1]).toMatch(/^1 min 0 s · ≈ 0,15\s\$US$/)
    expect(within(answers[0] as HTMLElement).getByTestId('work-relayed').textContent).toMatch(
      /^Transmise · [^·]*\d\d:\d\d$/
    )
    expect(within(answers[1] as HTMLElement).queryByTestId('work-relayed')).toBeNull()
    expect(within(card).getByTestId('work-relay').textContent).toBe(
      'Dernière réponse pas encore transmise à OpenCode — elle le sera avec votre prochain message'
    )
    const ask = within(card).getByTestId('work-ask')
    expect(within(ask).getByTestId('role-mention').textContent).toBe('Expert UX/UI')
    expect(ask.textContent).toContain('Et les contrastes ?')
  })

  it('suite envoyée pendant que le travail répondait : la réponse du tour en cours reste avant elle', () => {
    fakeAgent()
    view(
      [
        bubble(1, [{ childId: 'a', role: ux }]),
        started(2, 'a', ux, 'd1'),
        followUp(3, 'a', 'Et les contrastes ?', 30),
        // Le tour ouvert par la demande (à 0 s) finit après la suite : sa réponse est la première.
        report(4, 'a', { askedAt: at(0), at: at(60) }),
        report(5, 'a', { reply: 'Contrastes AA.', askedAt: at(61), at: at(90) })
      ],
      info([child('a', ux)])
    )
    const card = screen.getByTestId('work-card')
    const order = [...card.querySelectorAll('[data-testid=work-answer], [data-testid=work-ask]')]
    expect(order.map((el) => el.getAttribute('data-testid'))).toEqual([
      'work-answer',
      'work-ask',
      'work-answer'
    ])
  })

  it('arrêté : état clair, « Relancer » renvoie la même demande, un clic à la fois', async () => {
    fakeAgent()
    const sending = deferred()
    const reply = fakeReply(() => sending.promise)
    view(
      answered({ outcome: 'stopped', reply: 'Début de réponse' }),
      info([child('a', ux, { turnStopped: true })])
    )
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('stopped')
    expect(within(card).getByTestId('work-state').textContent).toBe('arrêté')
    expect(card.textContent).toContain('Arrêté avant la fin de sa réponse.')
    expect(screen.queryByTestId('work-apply')).toBeNull()
    fireEvent.click(within(card).getByTestId('work-retry'))
    await act(async () => {})
    fireEvent.click(within(card).getByTestId('work-retry'))
    await act(async () => {})
    expect(reply).toHaveBeenCalledTimes(1)
    expect(reply).toHaveBeenCalledWith('mere', {
      childId: 'a',
      text: 'À quoi ça pourrait ressembler ? Propose une direction.'
    })
    await act(async () => sending.resolve())
    expect((within(card).getByTestId('work-retry') as HTMLButtonElement).disabled).toBe(false)
  })

  it('en erreur : l’erreur dite, « Relancer » ; un échec de l’envoi est dit', async () => {
    fakeAgent()
    fakeReply(async () => {
      throw new Error('agent absent')
    })
    const subtasks = info([child('a', ux, { status: 'error' })])
    view(answered({ outcome: 'error', excerpt: 'Agent à connecter', reply: undefined }), subtasks)
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('error')
    expect(within(card).getByTestId('work-error').textContent).toBe('Agent à connecter')
    await act(async () => fireEvent.click(within(card).getByTestId('work-retry')))
    expect(subtasks.onWarn).toHaveBeenCalledWith(expect.stringContaining('agent absent'))
  })

  it('fini sans réponse posée : « en attente » pendant la réponse de la mère, sinon « sans réponse » et Relancer', () => {
    fakeAgent()
    const items = [bubble(1, [{ childId: 'a', role: ux }]), started(2, 'a', ux, 'd1')]
    const { unmount } = view(items, info([child('a', ux)], { motherBusy: true }))
    expect(screen.getByTestId('work-card').dataset['state']).toBe('pending')
    expect(screen.getByTestId('work-no-answer').textContent).toBe(
      'Sa réponse s’affichera à la fin de la réponse d’OpenCode.'
    )
    unmount()
    // Mère au repos, réponse jamais posée (plafond de coût, compte rendu perdu) : dit, relançable.
    view(items, info([child('a', ux)]))
    expect(screen.getByTestId('work-card').dataset['state']).toBe('silent')
    expect(screen.getByTestId('work-state').textContent).toBe('sans réponse')
    expect(screen.getByTestId('work-retry')).toBeTruthy()
  })

  it('« Répondre » : la puce et le rôle du travail vont à la saisie ; une seule carte', () => {
    fakeAgent()
    const received = vi.fn()
    const stop = onRoleInvoked(received)
    view(answered(), info([child('a', ux)]))
    fireEvent.click(screen.getByTestId('work-reply'))
    expect(received).toHaveBeenCalledWith('ux-ui-expert', { replyTo: 'a', role: ux })
    stop()
    expect(screen.getAllByTestId('work-card')).toHaveLength(1)
    expect(screen.getAllByTestId('role-request')).toHaveLength(1)
  })

  it('rôle qui écrit : branche, fichiers, non commité laissé, « Voir les modifications »', () => {
    fakeAgent()
    const openGit = vi.fn()
    // Branche lue sans rien de prêt (fiche 264) : pas de « Fusionner dans main ».
    const plan = vi
      .fn()
      .mockResolvedValue({ base: 'main', children: [], overlaps: [], running: false })
    const merge = { openGit, plan } as unknown as NonNullable<SubtasksInfo['merge']>
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
    expect(within(card).getByTestId('work-left-behind').textContent).toContain('a3f2c1e')
    fireEvent.click(within(card).getByTestId('work-changes-open'))
    expect(openGit).toHaveBeenCalledWith('b')
  })

  it('plusieurs rôles : une bulle, deux puces, puis une carte de groupe sans « proposés » (fiche 264)', () => {
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
    // Décision 5 de la fiche 260 : la même carte de groupe, une ligne par rôle, chacune son ancre.
    const group = screen.getByTestId('work-group')
    expect(group.dataset['stage']).toBe('working')
    expect(within(group).getByTestId('work-group-title').textContent).toBe('2 travaux')
    expect(within(group).getByTestId('work-group-counts').textContent).toBe('· 2 en cours')
    expect(within(group).queryByTestId('work-group-start-all')).toBeNull()
    const rows = within(group).getAllByTestId('work-row')
    expect(rows.map((r) => r.dataset['role'])).toEqual(['ux-ui-expert', 'front-architect'])
    expect(rows.map((r) => r.dataset['workAnchor'])).toEqual(['2', '3'])
    // Repliée, pas de carte-réponse ; dépliée, celle du travail, sans en-tête ni ancre à elle.
    expect(screen.queryByTestId('work-card')).toBeNull()
    fireEvent.click(within(rows[1] as HTMLElement).getByTestId('work-row-toggle'))
    const card = screen.getByTestId('work-card')
    expect(card.dataset['role']).toBe('front-architect')
    expect(card.dataset['workAnchor']).toBeUndefined()
    expect(within(card).queryByTestId('work-state')).toBeNull()
  })

  it('un travail lancé par l’agent garde « Sous-tâches » et son compte rendu, sans ceux des bulles', () => {
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
    expect(screen.getAllByTestId('subtask-row').map((r) => r.dataset['id'])).toEqual(['g'])
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

  it('conversation supprimée sans réponse : dit, sans action ; archivée : on peut encore l’ouvrir', () => {
    fakeAgent()
    const items = [bubble(1, [{ childId: 'a', role: ux }]), started(2, 'a', ux, 'd1')]
    const { unmount } = view(items, info([]))
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('gone')
    expect(within(card).getByTestId('work-state').textContent).toBe('conversation supprimée')
    expect(within(card).queryAllByRole('button')).toHaveLength(0)
    unmount()
    const subtasks = info([child('a', ux, { archived: true })])
    view([...items, report(3, 'a')], subtasks)
    fireEvent.click(screen.getByTestId('work-open'))
    expect(subtasks.onOpen).toHaveBeenCalledWith('a')
    expect(screen.queryByTestId('work-reply')).toBeNull()
    expect(screen.queryByTestId('work-apply')).toBeNull()
  })

  it('fil lu côte à côte (sans la liste des conversations) : ni « supprimée », ni lecture seule supposée', () => {
    fakeAgent()
    view([bubble(1, [{ childId: 'a', role: ux }]), started(2, 'a', ux, 'd1')])
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('unknown')
    expect(within(card).getByTestId('work-state').textContent).toBe('')
    expect(within(card).queryByTestId('work-place')).toBeNull()
    expect(within(card).queryAllByRole('button')).toHaveLength(0)
  })

  it('Markdown hostile dans une réponse : ni script, ni image, ni lien `javascript:`', () => {
    fakeAgent()
    view(
      answered({
        reply: [
          '<script>window.pwned = true</script>',
          '<img src="x" onerror="window.pwned = true">',
          '[clic](javascript:window.pwned=true)',
          'FIN'
        ].join('\n\n')
      }),
      info([child('a', ux)])
    )
    const body = screen.getByTestId('work-body')
    expect(body.querySelector('script, img, iframe')).toBeNull()
    expect(
      [...body.querySelectorAll('a')].some((a) => a.getAttribute('href')?.startsWith('javascript'))
    ).toBe(false)
    expect((window as { pwned?: boolean }).pwned).toBeUndefined()
    expect(body.textContent).toContain('FIN')
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
