import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubagentRun } from '@shared/subagent'
import type { TranscriptItem } from '@shared/transcript'
import type { SubagentCost } from './adapters'
import { SubagentTracker } from './subagent-tracker'
import { SubagentMarker } from './subagent-marks'
import { BOB_SUBAGENT_FORMAT } from './bob-subagents'
import { OPENCODE_SUBAGENT_FORMAT } from './opencode-subagents'

/**
 * Le suivi ne lit que la marque posée par l'hôte (fiche 140) : les mises à jour passent d'abord par
 * le marqueur, avec les formats de Bob et d'OpenCode (comme l'agent factice).
 */
function marked(tracker: SubagentTracker): SubagentTracker {
  const marker = new SubagentMarker({
    summary: () => '',
    subagentOf: (title, rawInput) =>
      OPENCODE_SUBAGENT_FORMAT.subagentOf(title, rawInput) ??
      BOB_SUBAGENT_FORMAT.subagentOf(title, rawInput),
    sessionId: OPENCODE_SUBAGENT_FORMAT.sessionId
  })
  const note = tracker.note.bind(tracker)
  tracker.note = (update) => note(marker.mark(update))
  // L'hôte oublie aussi ses marques à l'arrêt.
  const reset = tracker.reset.bind(tracker)
  tracker.reset = () => {
    marker.clear()
    reset()
  }
  return tracker
}

/** Formats relevés sur Bob 2.0.6 et OpenCode 1.19 (fiches 010, 053). */
const bobCall = (id: string, task: string): SessionUpdate => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: `Running subagent: ${task}`,
  kind: 'other',
  status: 'pending',
  rawInput: { description: task, name: 'explore' }
})
const status = (id: string, s: 'in_progress' | 'completed' | 'failed'): SessionUpdate => ({
  sessionUpdate: 'tool_call_update',
  toolCallId: id,
  status: s
})

function setup(options: { rows?: () => SubagentCost[] | undefined; replay?: boolean } = {}) {
  let now = 1_000
  const events: [string, SubagentRun][] = []
  const onPoll = vi.fn()
  const tracker = marked(
    new SubagentTracker({
      emit: (id, run) => events.push([id, run]),
      ...(options.rows ? { costs: { read: options.rows, currency: 'bobcoins' }, onPoll } : {}),
      replay: options.replay ?? false,
      now: () => now,
      pollMs: 2000,
      settleMs: 1500
    })
  )
  return { tracker, events, onPoll, advance: (ms: number) => (now += ms) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('sous-agents suivis en direct (fiche 053)', () => {
  it('début au premier in_progress, fin à completed ; les autres outils sont ignorés', () => {
    const { tracker, events, advance } = setup()
    tracker.note({ sessionUpdate: 'tool_call', toolCallId: 'read', title: 'Read a.txt' })
    tracker.note(bobCall('s1', 'Lis a.txt'))
    advance(500)
    tracker.note(status('s1', 'in_progress'))
    tracker.note(status('read', 'completed'))
    advance(12_000)
    tracker.note(status('s1', 'completed'))
    expect(events).toEqual([
      ['s1', { startedAt: 1_500 }],
      ['s1', { endedAt: 13_500 }]
    ])
  })

  it('OpenCode : reconnu sur la mise à jour qui porte la consigne ; session à rejouer', () => {
    const { tracker, events } = setup({ replay: true })
    tracker.note({ sessionUpdate: 'tool_call', toolCallId: 't', title: 'task', status: 'pending' })
    tracker.note({
      sessionUpdate: 'tool_call_update',
      toolCallId: 't',
      title: 'Read notes',
      status: 'in_progress',
      rawInput: { description: 'Read notes', prompt: 'Read notes.txt', subagent_type: 'general' }
    })
    tracker.note({
      sessionUpdate: 'tool_call_update',
      toolCallId: 't',
      status: 'completed',
      content: [
        {
          type: 'content',
          content: {
            type: 'text',
            text: '<task id="ses_enfant1" state="completed">\n<task_result>ok</task_result>\n</task>'
          }
        }
      ]
    })
    expect(events.map(([, run]) => Object.keys(run)[0])).toEqual([
      'startedAt',
      'endedAt',
      'sessionId'
    ])
    expect(events.at(-1)).toEqual(['t', { sessionId: 'ses_enfant1' }])
  })

  it('sans rejeu déclaré : pas de session, même si la réponse en nomme une', () => {
    const { tracker, events } = setup()
    tracker.note({
      sessionUpdate: 'tool_call',
      toolCallId: 't',
      title: 'Lire',
      status: 'completed',
      rawInput: { description: 'Lire', subagent_type: 'general' },
      content: [{ type: 'content', content: { type: 'text', text: '<task id="ses_x">' } }]
    })
    expect(events).toEqual([])
  })

  it('fin du tour : un sous-agent resté en cours se termine avec lui', () => {
    const { tracker, events, advance } = setup()
    tracker.note(bobCall('s1', 'Lis a.txt'))
    tracker.note(status('s1', 'in_progress'))
    advance(3_000)
    tracker.settle()
    expect(events.at(-1)).toEqual(['s1', { endedAt: 4_000 }])
    tracker.settle()
    expect(events).toHaveLength(2)
  })

  it('Bob : coût relu toutes les 2 s pendant le travail, puis à la fin et 1,5 s après', () => {
    let rows: SubagentCost[] = []
    const { tracker, events, onPoll, advance } = setup({ rows: () => rows })
    tracker.note(bobCall('s1', 'Lis a.txt'))
    tracker.note(status('s1', 'in_progress'))
    rows = [{ id: 'row1', title: 'Lis a.txt', createdAt: 1_100, cost: 0.002 }]
    vi.advanceTimersByTime(2000)
    rows = [{ id: 'row1', title: 'Lis a.txt', createdAt: 1_100, cost: 0.004 }]
    vi.advanceTimersByTime(2000)
    vi.advanceTimersByTime(2000) // inchangé : rien de plus
    advance(6_000)
    rows = [{ id: 'row1', title: 'Lis a.txt', createdAt: 1_100, cost: 0.0055 }]
    tracker.note(status('s1', 'completed'))
    rows = [{ id: 'row1', title: 'Lis a.txt', createdAt: 1_100, cost: 0.0058 }]
    vi.advanceTimersByTime(1500)
    const costs = events.flatMap(([, run]) => (run.cost ? [run.cost.amount] : []))
    expect(costs).toEqual([0.002, 0.004, 0.0055, 0.0058])
    expect(events.find(([, run]) => run.cost)?.[1].cost?.currency).toBe('bobcoins')
    expect(onPoll).toHaveBeenCalled()
    // Plus rien ne travaille : la relecture s'arrête.
    const calls = onPoll.mock.calls.length
    vi.advanceTimersByTime(10_000)
    expect(onPoll.mock.calls.length).toBe(calls)
  })

  it('Bob : ligne ↔ carte par la consigne, sinon par l’ordre de création ; sinon pas de coût', () => {
    const rows: SubagentCost[] = [
      // Sous-agent d'un tour précédent, même consigne : jamais rattaché.
      { id: 'ancienne', title: 'Lis b.txt', createdAt: 10, cost: 9 },
      // Titre différent de la consigne (`mask` de Bob) : rattaché par l'ordre de création.
      { id: 'masquée', title: 'résumé masqué', createdAt: 100_200, cost: 0.03 },
      { id: 'b', title: 'Lis b.txt', createdAt: 100_300, cost: 0.02 }
    ]
    const { tracker, events, advance } = setup({ rows: () => rows })
    advance(99_000)
    tracker.note(bobCall('s1', 'Lis a.txt'))
    tracker.note(bobCall('s2', 'Lis b.txt'))
    tracker.poll()
    expect(events).toEqual([
      ['s1', { cost: { amount: 0.03, currency: 'bobcoins' } }],
      ['s2', { cost: { amount: 0.02, currency: 'bobcoins' } }]
    ])
  })

  it('base illisible : aucun coût, aucune erreur', () => {
    const { tracker, events } = setup({ rows: () => undefined })
    tracker.note(bobCall('s1', 'Lis a.txt'))
    tracker.poll()
    expect(events).toEqual([])
  })

  it('reset : plus rien n’est suivi ni relu', () => {
    const { tracker, events, onPoll } = setup({ rows: () => [] })
    tracker.note(bobCall('s1', 'Lis a.txt'))
    tracker.reset()
    vi.advanceTimersByTime(10_000)
    tracker.note(status('s1', 'in_progress'))
    expect(events).toEqual([])
    expect(onPoll).not.toHaveBeenCalled()
  })

  it('OpenCode 2 : travail rattaché à la carte de même consigne, sinon à la plus ancienne', () => {
    const { tracker, events } = setup({ replay: true })
    const open = (id: string, description: string) => {
      tracker.note({ sessionUpdate: 'tool_call', toolCallId: id, title: 'subagent', rawInput: {} })
      tracker.note({
        sessionUpdate: 'tool_call_update',
        toolCallId: id,
        title: 'subagent',
        status: 'in_progress',
        rawInput: { agent: 'explore', description, prompt: `${description}, en détail` }
      })
    }
    open('a', 'Lire a.txt')
    open('b', 'Lire b.txt')
    // Même consigne que la carte b, bien qu'elle soit plus récente.
    expect(tracker.cardFor({ id: 'ses_b', parentId: 'p', depth: 1, title: 'Lire b.txt' })).toBe('b')
    // Déjà connu ; et un sous-agent qu'il lance va sous la même carte.
    expect(tracker.cardFor({ id: 'ses_b', parentId: 'p', depth: 1 })).toBe('b')
    expect(tracker.cardFor({ id: 'ses_b2', parentId: 'ses_b', depth: 2 })).toBe('b')
    // Titre inconnu : la plus ancienne carte libre.
    expect(tracker.cardFor({ id: 'ses_x', parentId: 'p', depth: 1, title: 'Autre' })).toBe('a')
    // Plus de carte libre.
    expect(tracker.cardFor({ id: 'ses_y', parentId: 'p', depth: 1 })).toBeUndefined()
    expect(events.filter(([, run]) => run.sessionId)).toEqual([
      ['b', { sessionId: 'ses_b' }],
      ['a', { sessionId: 'ses_x' }]
    ])
    // Fin : session lue aussi dans rawOutput.metadata.
    tracker.note({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'a',
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: 'ok' } }],
      rawOutput: { metadata: { sessionID: 'ses_x', status: 'completed' } }
    })
    expect(events.at(-1)).toEqual(['a', { sessionId: 'ses_x' }])
  })

  it('OpenCode 2 : carte terminée, plus de rattachement', () => {
    const { tracker } = setup()
    tracker.cardFor({ id: 'ses_z', parentId: 'p', depth: 1 })
    expect(tracker.cardFor({ id: 'ses_z', parentId: 'p', depth: 1 })).toBeUndefined()
  })
})

describe('sous-agent lancé en arrière-plan (OpenCode 2, fiche 122)', () => {
  /** Relevé sur OpenCode 2.0.32 (recette du 2026-10-22) : l'outil rend la main tout de suite. */
  const launched = (id: string): SessionUpdate => ({
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    status: 'completed',
    content: [
      {
        type: 'content',
        content: {
          type: 'text',
          text: 'The subagent is working in the background (sessionID: ses_fond).'
        }
      }
    ],
    rawOutput: { metadata: { sessionID: 'ses_fond', status: 'running', truncated: false } }
  })
  const call = (id: string): SessionUpdate => ({
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    title: 'subagent',
    status: 'in_progress',
    rawInput: { agent: 'general', description: 'Audit', prompt: 'Audite server.js' }
  })
  const tool = (status: 'in_progress' | 'completed'): TranscriptItem => ({
    kind: 'tool',
    id: 2,
    toolCallId: 'r',
    title: 'read',
    status,
    content: [],
    locations: []
  })
  const answer = (text: string): TranscriptItem => ({ kind: 'agent', id: 3, text })

  function setupBackground(replays: TranscriptItem[][]) {
    let now = 1_000
    const events: [string, SubagentRun][] = []
    const follow = vi.fn(async () => replays.shift() ?? replays.at(-1) ?? [])
    const tracker = marked(
      new SubagentTracker({
        emit: (id, run) => events.push([id, run]),
        replay: true,
        now: () => now,
        background: (update) =>
          update.sessionUpdate === 'tool_call_update' &&
          (update.rawOutput as { metadata?: { status?: string } } | undefined)?.metadata?.status ===
            'running',
        follow
      })
    )
    return { tracker, events, follow, advance: (ms: number) => (now += ms) }
  }

  it('reste en cours après son outil et la fin du tour ; fini avec sa réponse quand sa session a fini', async () => {
    const final = '8 problèmes de sécurité.'
    const t = setupBackground([
      [tool('in_progress')],
      [tool('completed'), answer('Je vérifie encore les chemins.'), tool('in_progress')],
      [tool('completed'), answer(final)],
      [tool('completed'), answer(final)]
    ])
    t.tracker.note(call('s1'))
    t.advance(300)
    t.tracker.note(launched('s1'))
    t.tracker.settle()
    expect(t.events).toEqual([
      ['s1', { startedAt: 1_000 }],
      ['s1', { sessionId: 'ses_fond', background: true }]
    ])
    // Relu à intervalle croissant ; une réponse sans outil en cours, deux fois de suite : fini.
    for (let i = 0; i < 6 && t.events.length < 3; i++) {
      t.advance(10_000)
      await vi.advanceTimersByTimeAsync(10_000)
    }
    expect(t.follow).toHaveBeenCalledWith('ses_fond')
    expect(t.events.at(-1)).toEqual(['s1', { endedAt: expect.any(Number), answer: final }])
    const calls = t.follow.mock.calls.length
    await vi.advanceTimersByTimeAsync(120_000)
    expect(t.follow.mock.calls.length).toBe(calls)
  })

  it('travail encore relayé en direct : pas encore fini', async () => {
    const t = setupBackground([[answer('Fini.')]])
    t.tracker.note(call('s1'))
    t.tracker.note(launched('s1'))
    const card = t.tracker.cardFor({
      id: 'ses_fond',
      parentId: 'ses_parent',
      depth: 1,
      title: 'Audit'
    })
    expect(card).toBe('s1')
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(2_000)
      t.tracker.cardFor({ id: 'ses_fond', parentId: 'ses_parent', depth: 1 })
    }
    expect(t.events.some(([, run]) => run.endedAt !== undefined)).toBe(false)
  })

  it('un autre message part avant sa fin : sa session reste à sa carte, il finit quand même (D25)', async () => {
    const final = 'Rapport : 4 problèmes.'
    const t = setupBackground([[tool('in_progress')], [answer(final)], [answer(final)]])
    t.tracker.note(call('s1'))
    t.tracker.note(launched('s1'))
    t.tracker.settle()
    // Tour suivant : un autre sous-agent, attendu celui-là, dont la session relaie sans titre.
    t.tracker.note({
      sessionUpdate: 'tool_call_update',
      toolCallId: 's2',
      title: 'subagent',
      status: 'in_progress',
      rawInput: { agent: 'general', description: 'Routes', prompt: 'Liste les routes' }
    })
    expect(t.tracker.cardFor({ id: 'ses_routes', parentId: 'ses_parent', depth: 1 })).toBe('s2')
    // Le travail de sa session, relayé pendant ce tour, va à sa carte à lui.
    expect(
      t.tracker.cardFor({
        id: 'ses_fond',
        parentId: 'ses_parent',
        depth: 1,
        title: 'Audit (@general)'
      })
    ).toBe('s1')
    t.tracker.note(status('s2', 'completed'))
    t.tracker.settle()
    for (let i = 0; i < 6 && !t.events.some(([id, run]) => id === 's1' && run.endedAt); i++) {
      await vi.advanceTimersByTimeAsync(10_000)
    }
    expect(t.events.filter(([id]) => id === 's1').at(-1)).toEqual([
      's1',
      { endedAt: expect.any(Number), answer: final }
    ])
  })

  it('agent arrêté ou nouvelle session : suivi perdu, plus de relecture', async () => {
    const t = setupBackground([[tool('in_progress')]])
    t.tracker.note(call('s1'))
    t.tracker.note(launched('s1'))
    t.tracker.reset()
    expect(t.events.at(-1)).toEqual(['s1', { lost: true }])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(t.follow).not.toHaveBeenCalled()
  })

  it('sans relecture possible (pas de `follow`) : fini comme avant, avec sa session', () => {
    const { tracker, events } = setup({ replay: true })
    tracker.note(call('s1'))
    tracker.note(launched('s1'))
    expect(events.at(-1)).toEqual(['s1', { sessionId: 'ses_fond' }])
  })
})
