import { describe, expect, it } from 'vitest'
import type { AgentEvent, AgentSnapshot } from '@shared/agent'
import type { AgentHost } from '../agent/agent-host'
import { commitSubject } from '@shared/worktree-cycle'
import { agentTitle, noteTurnStopped, proposedTitle, summaryOf, titleFrom } from './helpers'
import type { ConversationRecord } from './store'

describe('titre tiré du premier message', () => {
  it('raccourci à un mot entier, jamais au milieu (fiche 126)', () => {
    const text =
      'Ajoute dans README.md une section « Contribuer » de trois lignes avec un lien vers le guide'
    const title = titleFrom(text)
    expect(title).toBe('Ajoute dans README.md une section « Contribuer » de trois…')
    // Le sujet de commit proposé (fiche 110) en hérite : pas de mot coupé.
    expect(commitSubject(title)).toBe('ajoute dans README.md une section « Contribuer » de trois')
  })

  it('court : tel quel ; un seul mot trop long : coupé quand même', () => {
    expect(titleFrom('Corrige le bug\nDétails…')).toBe('Corrige le bug')
    expect(titleFrom('x'.repeat(80))).toBe(`${'x'.repeat(59)}…`)
  })
})

describe('agentTitle : titre proposé par l’agent (fiche 125)', () => {
  it('sans ce que l’app joint au message ; rien s’il ne reste rien', () => {
    expect(
      agentTitle({ titleSource: 'message' }, 'Salut <bobine_capabilities> For context, about')
    ).toBe('Salut')
    expect(
      agentTitle({ titleSource: 'agent' }, 'This conversation started with another a…')
    ).toBeUndefined()
    expect(agentTitle({ titleSource: 'message' }, '<child_conversations_request>')).toBeUndefined()
    expect(agentTitle({ titleSource: 'agent' }, 'Explique le projet')).toBe('Explique le projet')
  })

  it('un renommage ou un titre posé par l’app (branche, bascule) ne sont pas remplacés', () => {
    expect(agentTitle({ titleSource: 'user' }, 'Autre chose')).toBeUndefined()
    expect(agentTitle({ titleSource: 'app' }, 'Autre chose')).toBeUndefined()
  })
})

describe('proposedTitle : titre lu dans un évènement de l’agent', () => {
  it('seulement `session_info_update` avec un titre, filtré par agentTitle', () => {
    const info = (title: string): AgentEvent => ({
      type: 'update',
      update: { sessionUpdate: 'session_info_update', title }
    })
    expect(proposedTitle({ titleSource: 'message' }, info('Explique le projet'))).toBe(
      'Explique le projet'
    )
    expect(proposedTitle({ titleSource: 'user' }, info('Autre'))).toBeUndefined()
    expect(proposedTitle({ titleSource: 'message' }, { type: 'turn-error', message: 'x' })).toBe(
      undefined
    )
  })
})

describe('summaryOf : le projet de la conversation (fiche 131)', () => {
  const record = (change: Partial<ConversationRecord> = {}): ConversationRecord => ({
    id: 'c',
    title: 'Carnet',
    titleSource: 'message',
    profileId: 'mock',
    workspace: '/depots/carnet',
    createdAt: '2026-10-23T10:00:00.000Z',
    updatedAt: '2026-10-23T10:00:00.000Z',
    ...change
  })
  const summary = (r: ConversationRecord) =>
    summaryOf(
      { record: r, draft: false },
      [{ id: 'mock', label: 'Agent factice' }],
      () => undefined
    )

  it('fiche 267 : un modèle refusé au message (quota épuisé) est dit dans la liste', () => {
    const blocked = (blocker: unknown, status = 'needs-action') =>
      summaryOf(
        {
          record: record(),
          draft: false,
          host: {} as never,
          snapshot: { status, controls: [], blocker } as never
        },
        [{ id: 'mock', label: 'Agent factice' }],
        () => undefined
      ).modelRefused
    const auth = {
      kind: 'auth',
      methods: [],
      authenticating: false,
      atTurn: true,
      model: { id: 'f', name: 'Factice rapide', unavailable: true, quota: true }
    }
    expect(blocked(auth)).toEqual({ name: 'Factice rapide', quota: true })
    // Une connexion à refaire sans modèle, une carte d'ouverture, ou plus de blocage : rien.
    expect(blocked({ ...auth, model: undefined })).toBeUndefined()
    expect(blocked({ ...auth, atTurn: undefined })).toBeUndefined()
    expect(blocked(auth, 'busy')).toBeUndefined()
  })

  it('hors worktree : son dossier de travail', () => {
    expect(summary(record()).project).toBe('/depots/carnet')
  })

  it('en worktree : la racine du dépôt, pas le dossier du worktree', () => {
    const inWorktree = record({
      workspace: '/depots/.bobine-worktrees/carnet/20261023-1747-ef93',
      worktree: {
        root: '/depots/carnet',
        path: '/depots/.bobine-worktrees/carnet/20261023-1747-ef93',
        branch: 'bobine/20261023-1747-ef93',
        base: 'abc123'
      }
    })
    expect(summary(inWorktree)).toMatchObject({
      project: '/depots/carnet',
      workspace: '/depots/.bobine-worktrees/carnet/20261023-1747-ef93',
      branch: 'bobine/20261023-1747-ef93'
    })
  })
})

describe('noteTurnStopped : tour arrêté avant la fin (fiche 258, D4)', () => {
  const record = (): ConversationRecord => ({
    id: 'f',
    title: 'Relecture',
    titleSource: 'message',
    profileId: 'mock',
    workspace: '/depots/carnet',
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z'
  })
  const summary = (r: ConversationRecord) =>
    summaryOf(
      { record: r, draft: false },
      [{ id: 'mock', label: 'Agent factice' }],
      () => undefined
    )

  it('posé par une fin de tour annulée, retiré au tour suivant, à une fin ordinaire ou à une erreur', () => {
    const r = record()
    const cancelled: AgentEvent = { type: 'turn-end', stopReason: 'cancelled' }
    expect(noteTurnStopped(r, cancelled)).toBe(true)
    expect(r.turnStopped).toBe(true)
    expect(summary(r).turnStopped).toBe(true)
    // Rien d'autre ne le change ; le redire ne change rien.
    expect(noteTurnStopped(r, { type: 'status', snapshot: {} } as AgentEvent)).toBe(false)
    expect(noteTurnStopped(r, cancelled)).toBe(false)
    expect(noteTurnStopped(r, { type: 'user-message', text: 'reprends' })).toBe(true)
    expect(r).not.toHaveProperty('turnStopped')
    expect(summary(r)).not.toHaveProperty('turnStopped')
    noteTurnStopped(r, cancelled)
    expect(noteTurnStopped(r, { type: 'turn-end', stopReason: 'end_turn' })).toBe(true)
    expect(r).not.toHaveProperty('turnStopped')
    noteTurnStopped(r, cancelled)
    expect(noteTurnStopped(r, { type: 'turn-error', message: 'boom' })).toBe(true)
    expect(r).not.toHaveProperty('turnStopped')
    // Limite d'étapes, refus du modèle : le tour a fini, il n'a pas été arrêté.
    expect(noteTurnStopped(r, { type: 'turn-end', stopReason: 'max_turn_requests' })).toBe(false)
  })
})

describe('summaryOf : travail après le tour (fiche 255)', () => {
  const record: ConversationRecord = {
    id: 'c',
    title: 'Carnet',
    titleSource: 'message',
    profileId: 'mock',
    workspace: '/depots/carnet',
    createdAt: '2026-11-19T19:00:00.000Z',
    updatedAt: '2026-11-19T19:00:00.000Z'
  }
  const listed = (status: string, backgroundWork: boolean, startingHeld = false) =>
    summaryOf(
      {
        record,
        draft: false,
        host: {} as AgentHost,
        snapshot: { status } as AgentSnapshot,
        transcript: { items: [], nextId: 1, ...(backgroundWork ? { backgroundWork: true } : {}) },
        ...(startingHeld ? { startingHeld } : {})
      },
      [{ id: 'mock', label: 'Agent factice' }],
      () => undefined
    )

  it('prête mais encore au travail : « en cours » dans la liste', () => {
    expect(listed('ready', true)).toMatchObject({ status: 'ready', backgroundWork: true })
    expect(listed('ready', false).backgroundWork).toBeUndefined()
    // Occupée (un autre tour), ou fille dont la consigne n'est pas partie : rien de plus.
    expect(listed('busy', true).backgroundWork).toBeUndefined()
    expect(listed('ready', true, true).backgroundWork).toBeUndefined()
  })
})
