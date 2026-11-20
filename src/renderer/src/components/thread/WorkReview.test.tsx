/**
 * Relecture par le Code reviewer (fiche 265, écran G des maquettes de la fiche 260) : la bulle
 * « @Code reviewer Relis … » et sa carte-réponse, avec ses remarques visibles (gravité,
 * `fichier:ligne` vers le diff, une phrase), son avis, ses actions et ses états ; la relecture d'un
 * travail rangée dans sa carte (ou sous sa ligne d'une carte de groupe) ; les relectures d'avant
 * (`review` sans lancement) toujours en carte « Relecture ».
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { act, fireEvent, render as testingRender, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { Review, ReviewFinding } from '@shared/review'
import type { RoleBadge } from '@shared/roles'
import type { TranscriptItem } from '@shared/transcript'
import { onRoleInvoked, resetRolesUi } from '../../roles/roles-store'
import type { SubtasksInfo } from './Subtasks'
import { Transcript } from './Transcript'

const render = (ui: ReactNode) => testingRender(ui, { wrapper: Tooltip.Provider })
/** Espaces insécables de la typographie française ramenées à des espaces. */
const plain = (text: unknown) => String(text).replace(/[  ]/g, ' ')
const T0 = Date.now() - 600_000
const at = (seconds: number) => T0 + seconds * 1000

const reviewer: RoleBadge = {
  name: 'code-reviewer',
  label: 'Code reviewer',
  icon: 'scan-search',
  color: 'blue',
  readOnly: true
}
const front: RoleBadge = {
  name: 'front-architect',
  label: 'Architecte front',
  icon: 'layout',
  color: 'violet'
}
const ux: RoleBadge = {
  name: 'ux-ui-expert',
  label: 'Expert UX/UI',
  icon: 'palette',
  color: 'pink',
  readOnly: true
}

const conversation = (
  id: string,
  role: RoleBadge,
  extra: Partial<ConversationSummary> = {}
): ConversationSummary => ({
  id,
  title: `Travail ${id}`,
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: '/tmp/depot',
  updatedAt: '2026-11-20T21:00:00.000Z',
  status: 'ready',
  draft: false,
  startedFrom: { id: 'mere', title: 'Mère' },
  role,
  ...extra
})

const finding = (
  rank: number,
  severity: ReviewFinding['severity'],
  file: string,
  line: number,
  title: string,
  endLine?: number
): ReviewFinding => ({
  id: `r:${rank}`,
  file,
  line,
  ...(endLine ? { endLine } : {}),
  severity,
  category: 'correctness',
  title,
  why: `Pourquoi ${rank}`,
  code: ''
})

/** Remarques dans le désordre : la carte les range par gravité. */
const FINDINGS = [
  finding(1, 'low', 'src/style.css', 118, 'Le gris du compteur est à 2,9:1.'),
  finding(2, 'high', 'src/main.ts', 42, 'La case à cocher n’a pas de libellé.'),
  finding(3, 'medium', 'src/main.ts', 77, '« Vider la liste » perd la sauvegarde.', 80)
]

const ASK = 'Relis les modifications non commitées (2 fichiers).'

/** La demande au Code reviewer : la bulle qui nomme la conversation relue, et son lancement. */
const asked = (id: number, of: string, text = ASK): TranscriptItem[] => [
  {
    kind: 'role-request',
    id,
    requestId: `d${id}`,
    text,
    works: [{ childId: 'r', role: reviewer, review: { of } }],
    at: at(0)
  },
  {
    kind: 'child-started',
    id: id + 1,
    childId: 'r',
    title: 'Relecture : Mère',
    prompt: text,
    role: reviewer,
    request: `d${id}`,
    at: at(0)
  }
]

const review = (id: number, authorId: string, extra: Partial<Review> = {}): TranscriptItem => ({
  kind: 'review',
  id,
  reviewId: 'r',
  authorId,
  title: 'Relecture : Mère',
  profileLabel: 'Agent factice',
  scope: 'uncommitted',
  files: 2,
  status: 'reported',
  findings: FINDINGS,
  summary: 'Propre et lisible ; une remarque à corriger avant de committer.',
  at: at(40),
  ...extra
})

const replied = (
  id: number,
  extra: Partial<Extract<TranscriptItem, { kind: 'child-report' }>> = {}
): TranscriptItem => ({
  kind: 'child-report',
  id,
  childId: 'r',
  title: 'Relecture : Mère',
  outcome: 'done',
  files: [],
  fileCount: 0,
  added: 0,
  removed: 0,
  excerpt: 'Trois remarques rendues.',
  reply: 'Trois remarques rendues : REPONSE-ENTIERE.',
  at: at(52),
  ...extra
})

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
  onShowDiff: vi.fn(),
  ...extra
})

const view = (items: TranscriptItem[], subtasks?: SubtasksInfo) =>
  render(
    <Transcript
      items={items}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      onOpenGitView={vi.fn()}
      messageActions={{ busy: false, onEdit: vi.fn(), onOpenConversation: vi.fn() }}
      {...(subtasks ? { subtasks } : {})}
    />
  )

const originalAgent = window.api.agent
const originalRoles = (window.api as { roles?: Window['api']['roles'] }).roles
afterEach(() => {
  window.api.agent = originalAgent
  ;(window.api as { roles?: Window['api']['roles'] }).roles = originalRoles
  resetRolesUi()
  vi.restoreAllMocks()
})
function fakeAgent() {
  window.api.agent = {
    onEvent: () => () => {},
    cancel: vi.fn(async () => undefined)
  } as unknown as Window['api']['agent']
}

/** Le Code reviewer a répondu sur le non commité de la conversation affichée. */
const reviewedHere = (extra: Partial<Review> = {}) => [
  ...asked(1, 'mere'),
  review(3, 'mere', extra),
  replied(4)
]

describe('relecture par le Code reviewer (fiche 265)', () => {
  it('en cours : la bulle « @Code reviewer Relis … » et sa carte, sans remarque encore', () => {
    fakeAgent()
    view(
      [
        ...asked(1, 'mere'),
        review(3, 'mere', { status: 'running', findings: [], summary: undefined })
      ],
      info([
        conversation('r', reviewer, { status: 'busy', reviewOf: { id: 'mere', title: 'Mère' } })
      ])
    )
    const group = screen.getByTestId('role-request-group')
    const bubble = within(group).getByTestId('role-request')
    expect(within(bubble).getByTestId('role-mention').textContent).toBe('Code reviewer')
    expect(bubble.textContent).toContain(ASK)
    const card = within(group).getByTestId('work-card')
    expect(card.dataset['state']).toBe('running')
    expect(card.dataset['review']).toBe('running')
    expect(within(card).getByTestId('work-place').textContent).toBe(
      'lecture seule · dans ce dossier'
    )
    expect(within(card).getByTestId('work-live-current').textContent).toBe('Travaille…')
    expect(within(card).queryByTestId('work-findings')).toBeNull()
    expect(within(card).getByTestId('work-stop')).toBeTruthy()
    // La carte « Relecture » d'avant n'est pas affichée en plus.
    expect(screen.queryByTestId('review-card')).toBeNull()
  })

  it('remarques visibles, rangées par gravité ; avis d’ensemble ; réponse repliée', () => {
    fakeAgent()
    view(reviewedHere(), info([conversation('r', reviewer)]))
    const card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('replied')
    expect(card.dataset['findings']).toBe('3')
    expect(within(card).getByTestId('work-state').textContent).toMatch(/^a répondu · /)
    const rows = within(card).getAllByTestId('work-finding')
    expect(rows.map((r) => r.dataset['severity'])).toEqual(['high', 'medium', 'low'])
    expect(rows.map((r) => r.querySelector('.review-severity')?.textContent)).toEqual([
      'Haute',
      'Moyenne',
      'Basse'
    ])
    expect(rows.map((r) => within(r).getByTestId('work-finding-where').textContent)).toEqual([
      'src/main.ts:42',
      'src/main.ts:77-80',
      'src/style.css:118'
    ])
    expect(within(rows[0] as HTMLElement).getByTestId('work-finding-title').textContent).toBe(
      'La case à cocher n’a pas de libellé.'
    )
    expect(within(card).getByTestId('work-findings').getAttribute('aria-label')).toBe(
      'Remarques de Code reviewer'
    )
    // L'avis d'ensemble après les remarques ; la réponse du tour repliée dessous.
    const summary = within(card).getByTestId('work-review-summary')
    expect(summary.textContent).toContain('une remarque à corriger')
    // L'avis d'ensemble d'abord (revue UX), puis la liste.
    expect(
      summary.compareDocumentPosition(within(card).getByTestId('work-findings')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // Sa réponse du tour repliée comme à la 263 (« Lire la suite »), sous ses remarques.
    const body = within(card).getByTestId('work-body')
    expect(body.className).toContain('folded')
    expect(body.className).toContain('relayed')
    expect(body.textContent).toContain('REPONSE-ENTIERE')
    expect(screen.queryByTestId('review-card')).toBeNull()
    // Méta sur la ligne des boutons ; « Répondre » (fantôme) et « Ouvrir » sur la suivante.
    const first = within(card).getByTestId('work-actions')
    expect(within(first).getByTestId('work-facts')).toBeTruthy()
    expect(within(first).getByTestId('work-fix')).toBeTruthy()
    expect(within(first).queryByTestId('work-reply')).toBeNull()
    const second = within(card).getByTestId('work-actions-second')
    expect(within(second).getByTestId('work-reply').className).toContain('ghost')
    expect(within(second).getByTestId('work-open')).toBeTruthy()
    expect(within(card).getAllByTestId('work-facts')).toHaveLength(1)
  })

  it('un clic sur `fichier:ligne` et « Voir sur le diff » ouvrent la vue Git de la conversation relue', () => {
    fakeAgent()
    const subtasks = info([conversation('r', reviewer)])
    view(reviewedHere(), subtasks)
    const card = screen.getByTestId('work-card')
    fireEvent.click(within(card).getAllByTestId('work-finding-where')[1] as HTMLElement)
    expect(subtasks.onShowDiff).toHaveBeenLastCalledWith('mere', {
      path: 'src/main.ts',
      line: 77,
      endLine: 80
    })
    expect(within(card).getAllByTestId('work-finding-where')[0]?.getAttribute('title')).toBe(
      'Voir src/main.ts:42 sur le diff'
    )
    fireEvent.click(within(card).getByTestId('work-show-diff'))
    expect(subtasks.onShowDiff).toHaveBeenLastCalledWith('mere', { path: 'src/main.ts', line: 42 })
    expect(within(card).getByTestId('work-show-diff').textContent).toBe('Voir sur le diff')
  })

  it('fiche 267 (N2) : une portée commitée ouvre le diff de la portée relue (début et fin)', () => {
    fakeAgent()
    const subtasks = info([conversation('r', reviewer)])
    view(
      reviewedHere({ scope: 'commits', commits: 4, since: 'aaaa111', head: 'bbbb222' }),
      subtasks
    )
    fireEvent.click(screen.getAllByTestId('work-finding-where')[0] as HTMLElement)
    expect(subtasks.onShowDiff).toHaveBeenLastCalledWith('mere', {
      path: 'src/main.ts',
      line: 42,
      since: 'aaaa111',
      until: 'bbbb222'
    })
  })

  it('« Demander à OpenCode de corriger » : message qui nomme le relecteur, sa réponse visée à part', async () => {
    fakeAgent()
    const onAsk = vi.fn(async () => undefined)
    view(reviewedHere(), info([conversation('r', reviewer)], { onAsk }))
    const fix = screen.getByTestId('work-fix')
    expect(fix.textContent).toBe('Demander à OpenCode de corriger')
    // Pas « appliquer cette réponse » : on corrige ses remarques.
    expect(screen.queryByTestId('work-apply')).toBeNull()
    await act(async () => fireEvent.click(fix))
    expect(onAsk).toHaveBeenCalledWith('Corrige les remarques de Code reviewer.', 'r')
  })

  it('« Répondre à Code reviewer » et « Ouvrir sa conversation »', () => {
    fakeAgent()
    const received = vi.fn()
    const stop = onRoleInvoked(received)
    const subtasks = info([conversation('r', reviewer)])
    view(reviewedHere(), subtasks)
    expect(screen.getByTestId('work-reply').textContent).toBe('Répondre à Code reviewer')
    fireEvent.click(screen.getByTestId('work-reply'))
    expect(received).toHaveBeenCalledWith('code-reviewer', {
      replyTo: 'r',
      role: reviewer,
      motherId: 'mere'
    })
    stop()
    fireEvent.click(screen.getByTestId('work-open'))
    expect(subtasks.onOpen).toHaveBeenCalledWith('r')
  })

  it('rien à signaler : dit dans l’en-tête et la carte, sans « corriger » ni « Voir sur le diff »', () => {
    fakeAgent()
    view(
      reviewedHere({ findings: [], summary: 'Le changement est correct.' }),
      info([conversation('r', reviewer)])
    )
    const card = screen.getByTestId('work-card')
    expect(card.dataset['findings']).toBe('0')
    expect(within(card).getByTestId('work-state').textContent).toMatch(/^rien à signaler · /)
    // Rien à signaler, et sur quoi (fiche 267) : une seule ligne.
    expect(plain(within(card).getByTestId('work-findings-clean').textContent)).toBe(
      'Rien à signaler · relu : les modifications non commitées, 2 fichiers'
    )
    expect(within(card).getByTestId('work-review-summary').textContent).toBe(
      'Le changement est correct.'
    )
    expect(screen.queryByTestId('work-fix')).toBeNull()
    expect(screen.queryByTestId('work-show-diff')).toBeNull()
  })

  it('fiche 267 (recette N1) : la carte dit ce qui a été relu, surtout quand rien n’est à signaler', () => {
    fakeAgent()
    const since = 'ffa5062' + '0'.repeat(33)
    const head = 'db4a5e1' + '0'.repeat(33)
    const { unmount } = view(
      reviewedHere({
        findings: [],
        scope: 'commits',
        commits: 4,
        files: 12,
        since,
        head,
        base: since.slice(0, 7)
      }),
      info([conversation('r', reviewer)])
    )
    const card = screen.getByTestId('work-card')
    expect(plain(within(card).getByTestId('work-findings-clean').textContent)).toBe(
      'Rien à signaler · relu : les 4 commits de cette conversation, 12 fichiersffa5062..db4a5e1'
    )
    const range = within(card).getByTestId('work-review-range')
    expect(range.textContent).toBe('ffa5062..db4a5e1')
    expect(plain(range.getAttribute('title'))).toBe('Commits relus : ffa5062..db4a5e1')
    unmount()
    // Depuis le premier commit, avec le non commité ; et avec des remarques.
    view(
      reviewedHere({
        scope: 'commits',
        commits: 1,
        files: 3,
        since: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
        withUncommitted: true
      }),
      info([conversation('r', reviewer)])
    )
    expect(screen.getAllByTestId('work-finding')).toHaveLength(3)
    const line = screen.getByTestId('work-review-scope')
    expect(plain(line.textContent)).toBe(
      'Relu : les modifications non commitées et le commit de cette conversation, 3 fichiersdepuis le premier commit'
    )
    // Juste sous l'avis, avant la liste des remarques (revue UX).
    const summary = screen.getByTestId('work-review-summary')
    const list = screen.getByTestId('work-findings')
    expect(summary.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('fiche 267, revue UX : d’où part la plage, historique partiel et sous-modules', () => {
    fakeAgent()
    const { unmount } = view(
      reviewedHere({ findings: [], scope: 'commits', origin: 'reviewed', commits: 2, files: 3 }),
      info([conversation('r', reviewer)])
    )
    expect(plain(screen.getByTestId('work-review-scope').textContent)).toContain(
      'les 2 commits faits depuis la dernière relecture, 3 fichiers'
    )
    unmount()
    view(
      reviewedHere({
        findings: [],
        scope: 'commits',
        origin: 'fallback',
        commits: 5,
        files: 4,
        shallow: true,
        submodules: 2
      }),
      info([conversation('r', reviewer)])
    )
    expect(plain(screen.getByTestId('work-review-scope').textContent)).toBe(
      'Rien à signaler · relu : les 5 derniers commits (début de la conversation introuvable), 4 fichiers · historique partiel du dépôt · 2 sous-modules non relus'
    )
  })

  it('fiche 267 : le non commité seul et une branche, dits aussi', () => {
    fakeAgent()
    const { unmount } = view(reviewedHere({ findings: [] }), info([conversation('r', reviewer)]))
    expect(plain(screen.getByTestId('work-review-scope').textContent)).toBe(
      'Rien à signaler · relu : les modifications non commitées, 2 fichiers'
    )
    unmount()
    view(
      reviewedHere({
        findings: [],
        scope: 'branch',
        base: 'a3f2c1e',
        since: 'a3f2c1e' + '0'.repeat(33)
      }),
      info([conversation('r', reviewer)])
    )
    expect(plain(screen.getByTestId('work-review-scope').textContent)).toBe(
      'Rien à signaler · relu : la branche depuis a3f2c1e, 2 fichiers'
    )
  })

  it('transmise : plus de « corriger » ; « Voir sur le diff » reste', () => {
    fakeAgent()
    view(
      [...reviewedHere(), { kind: 'user', id: 5, text: 'Merci', at: at(60) }],
      info([conversation('r', reviewer)])
    )
    expect(screen.queryByTestId('work-fix')).toBeNull()
    expect(screen.getByTestId('work-show-diff')).toBeTruthy()
    expect(plain(screen.getByTestId('work-relay').textContent)).toMatch(/^Transmise à OpenCode/)
  })

  it('arrêté, en erreur : états de la carte-réponse, « Relancer » ; sans remarques structurées', () => {
    fakeAgent()
    const { unmount } = view(
      [
        ...asked(1, 'mere'),
        review(3, 'mere', { status: 'silent', findings: [], summary: undefined }),
        replied(4, { outcome: 'stopped', reply: 'Début de relecture' })
      ],
      info([conversation('r', reviewer, { turnStopped: true })])
    )
    let card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('stopped')
    expect(within(card).getByTestId('work-retry')).toBeTruthy()
    // Sans `report_findings` : sa réponse en clair, comme tout travail.
    expect(within(card).getByTestId('work-body').textContent).toContain('Début de relecture')
    expect(within(card).queryByTestId('work-findings')).toBeNull()
    unmount()
    view(
      [
        ...asked(1, 'mere'),
        review(3, 'mere', { status: 'failed', findings: [], error: 'Agent à connecter' }),
        replied(4, { outcome: 'error', excerpt: 'Agent à connecter', reply: undefined })
      ],
      info([conversation('r', reviewer, { status: 'error' })])
    )
    card = screen.getByTestId('work-card')
    expect(card.dataset['state']).toBe('error')
    expect(within(card).getByTestId('work-error').textContent).toBe('Agent à connecter')
    expect(within(card).getByTestId('work-retry')).toBeTruthy()
  })

  it('dossier changé pendant la relecture : l’avertissement dans la carte', () => {
    fakeAgent()
    view(reviewedHere({ changed: true }), info([conversation('r', reviewer)]))
    expect(screen.getByTestId('work-review-changed').textContent).toContain(
      'Le dossier a changé pendant la relecture'
    )
  })

  it('relecture d’un travail : dans sa carte, pas à sa place ; « corriger » le fait corriger', async () => {
    fakeAgent()
    const onAsk = vi.fn(async () => undefined)
    const items: TranscriptItem[] = [
      {
        kind: 'role-request',
        id: 1,
        requestId: 'd1',
        text: 'Ajoute les rayons',
        works: [{ childId: 'b', role: front }],
        at: at(0)
      },
      {
        kind: 'child-started',
        id: 2,
        childId: 'b',
        title: 'Rayons',
        prompt: 'Ajoute les rayons',
        role: front,
        request: 'd1',
        branch: 'bobine/rayons',
        at: at(0)
      },
      {
        ...(replied(3) as Extract<TranscriptItem, { kind: 'child-report' }>),
        childId: 'b',
        title: 'Rayons',
        reply: 'Rayons faits.'
      },
      { kind: 'agent', id: 4, text: 'Autre chose.', at: at(70) },
      ...asked(5, 'b', 'Relis la branche bobine/rayons.'),
      review(7, 'b', { scope: 'branch', base: 'a3f2c1e', baseBranch: 'main', since: 'a3f2c1e0' }),
      replied(8)
    ]
    const subtasks = info(
      [
        conversation('b', front, { title: 'Rayons', branch: 'bobine/rayons' }),
        conversation('r', reviewer, { reviewOf: { id: 'b', title: 'Rayons' } })
      ],
      { onAsk }
    )
    view(items, subtasks)
    const cards = screen.getAllByTestId('work-card')
    const author = cards.find((c) => c.dataset['childId'] === 'b') as HTMLElement
    // Rangée dans la carte du travail relu : la bulle et la carte du Code reviewer, après sa réponse.
    const reviews = within(author).getByTestId('work-reviews')
    expect(within(reviews).getByTestId('review-ask').textContent).toContain(
      'Relis la branche bobine/rayons.'
    )
    const nested = within(reviews).getByTestId('work-card')
    expect(nested.dataset['childId']).toBe('r')
    expect(within(nested).getByTestId('work-place').textContent).toBe(
      'lecture seule · dans la branche relue'
    )
    // Pas une deuxième fois à sa place dans le fil.
    expect(screen.queryAllByTestId('role-request').map((r) => r.textContent)).not.toContain(
      expect.stringContaining('Relis la branche')
    )
    expect(screen.getAllByTestId('work-card')).toHaveLength(2)
    // « Voir sur le diff » : la vue Git du travail relu.
    fireEvent.click(within(nested).getByTestId('work-show-diff'))
    // Une branche relue : son diff depuis sa base (revue QA).
    expect(subtasks.onShowDiff).toHaveBeenLastCalledWith('b', {
      path: 'src/main.ts',
      line: 42,
      since: 'a3f2c1e0'
    })
    // Une remarque haute à traiter : « Faire corriger « Rayons » » est l'action principale de la
    // carte du travail, la sous-carte du relecteur n'a ni ce bouton ni sa transmission (revue UX).
    expect(within(nested).queryByTestId('work-fix')).toBeNull()
    expect(within(nested).queryByTestId('work-relay')).toBeNull()
    expect(within(author).getAllByTestId('work-relay')).toHaveLength(1)
    const fix = within(author).getByTestId('work-fix-work')
    expect(plain(fix.textContent)).toBe('Faire corriger « Architecte front »')
    expect(fix.className).toContain('primary')
    // Sa réponse se replie dès qu'une relecture est rangée dessous.
    expect(within(author).getAllByTestId('work-body')[0]?.className).toContain('relayed')
    await act(async () => fireEvent.click(fix))
    const [message, about] = (onAsk.mock.calls[0] as unknown[] | undefined) ?? []
    expect(plain(message)).toBe(
      'Fais corriger par « Rayons » les remarques de Code reviewer sur sa branche.'
    )
    expect(about).toBe('r')
  })

  it('travail relu pendant que la relecture tourne : pas de deuxième « Faire relire »', () => {
    fakeAgent()
    const items: TranscriptItem[] = [
      {
        kind: 'role-request',
        id: 1,
        requestId: 'd1',
        text: 'Ajoute les rayons',
        works: [{ childId: 'b', role: front }],
        at: at(0)
      },
      {
        kind: 'child-started',
        id: 2,
        childId: 'b',
        title: 'Rayons',
        prompt: 'Ajoute les rayons',
        role: front,
        request: 'd1',
        branch: 'bobine/rayons',
        at: at(0)
      },
      {
        ...(replied(3) as Extract<TranscriptItem, { kind: 'child-report' }>),
        childId: 'b',
        title: 'Rayons',
        reply: 'Rayons faits.'
      }
    ]
    const onReview = vi.fn()
    const author = conversation('b', front, { title: 'Rayons', branch: 'bobine/rayons' })
    const { unmount } = view(items, info([author], { onReview }))
    fireEvent.click(screen.getByTestId('work-review'))
    expect(onReview).toHaveBeenCalledWith('b')
    unmount()
    view(
      [...items, ...asked(4, 'b', 'Relis la branche bobine/rayons.')],
      info([author, conversation('r', reviewer, { status: 'busy' })], { onReview })
    )
    expect(screen.queryByTestId('work-review')).toBeNull()
  })

  it('carte de groupe : la relecture d’une ligne juste sous elle, repliée ou non', () => {
    fakeAgent()
    const items: TranscriptItem[] = [
      {
        kind: 'role-request',
        id: 1,
        requestId: 'd1',
        text: 'Avis et rayons',
        works: [
          { childId: 'a', role: ux },
          { childId: 'b', role: front }
        ],
        at: at(0)
      },
      {
        kind: 'child-started',
        id: 2,
        childId: 'a',
        title: 'Avis',
        prompt: 'Avis',
        role: ux,
        request: 'd1',
        at: at(0)
      },
      {
        kind: 'child-started',
        id: 3,
        childId: 'b',
        title: 'Rayons',
        prompt: 'Rayons',
        role: front,
        request: 'd1',
        branch: 'bobine/rayons',
        at: at(0)
      },
      ...asked(4, 'b', 'Relis la branche bobine/rayons.'),
      review(6, 'b', { scope: 'branch', base: 'a3f2c1e' }),
      replied(7)
    ]
    view(
      items,
      info([
        conversation('a', ux),
        conversation('b', front, { title: 'Rayons', branch: 'bobine/rayons' }),
        conversation('r', reviewer)
      ])
    )
    const rows = screen.getAllByTestId('work-row')
    const row = rows.find((r) => r.dataset['childId'] === 'b') as HTMLElement
    const reviews = within(row).getByTestId('work-reviews')
    expect(within(reviews).getByTestId('work-card').dataset['childId']).toBe('r')
    expect(within(reviews).getAllByTestId('work-finding')).toHaveLength(3)
    // La ligne de l'autre travail n'en a pas ; pas de ligne « Relecture » en plus dans le groupe.
    const other = rows.find((r) => r.dataset['childId'] === 'a') as HTMLElement
    expect(within(other).queryByTestId('work-reviews')).toBeNull()
    expect(rows).toHaveLength(2)
    expect(screen.queryByTestId('subtasks')).toBeNull()
    // Dépliée : la carte du travail ne la répète pas.
    fireEvent.click(within(row).getByTestId('work-row-toggle'))
    expect(within(row).getAllByTestId('work-reviews')).toHaveLength(1)
  })

  it('relecture d’avant (sans lancement) : sa carte « Relecture » comme avant, sans ligne en double', () => {
    fakeAgent()
    const { authorId: _authorId, ...old } = review(1, 'mere') as Extract<
      TranscriptItem,
      { kind: 'review' }
    >
    view(
      [old],
      info([
        conversation('r', reviewer, { role: undefined, reviewOf: { id: 'mere', title: 'Mère' } })
      ])
    )
    const card = screen.getByTestId('review-card')
    expect(card.dataset['count']).toBe('3')
    expect(screen.queryByTestId('work-card')).toBeNull()
  })
})
