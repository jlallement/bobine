import { describe, expect, it } from 'vitest'
import type { SessionUpdate } from './acp-sdk.mts'
import type { AgentEvent } from './agent'
import {
  emptyTranscript,
  reduceTranscript,
  settleTranscript,
  type TranscriptItem
} from './transcript'

/** Sous-agent lancé en arrière-plan (fiche 122) : « en cours » jusqu'à sa vraie fin. */

const update = (u: SessionUpdate): AgentEvent => ({ type: 'update', update: u })
const turnEnd: AgentEvent = { type: 'turn-end', stopReason: 'end_turn' }
const reduce = (...events: AgentEvent[]) => events.reduce(reduceTranscript, emptyTranscript)
const tools = (...events: AgentEvent[]) =>
  reduce(...events).items.filter(
    (i): i is Extract<TranscriptItem, { kind: 'tool' }> => i.kind === 'tool'
  )
const statusOf = (...events: AgentEvent[]) => tools(...events)[0]?.status

describe('sous-agent lancé en arrière-plan (fiche 122)', () => {
  const subagent = (status: 'in_progress' | 'completed'): AgentEvent =>
    update({
      sessionUpdate: status === 'in_progress' ? 'tool_call' : 'tool_call_update',
      toolCallId: 's1',
      title: 'subagent',
      kind: 'think',
      status,
      rawInput: { agent: 'general', description: 'Audit', prompt: 'Audite server.js' }
    })
  const background: AgentEvent = {
    type: 'subagent-run',
    toolCallId: 's1',
    run: { startedAt: 1000, sessionId: 'ses_fille', background: true }
  }
  const launched = [
    { type: 'user-message', text: 'Lance un audit' } as AgentEvent,
    subagent('in_progress'),
    subagent('completed'),
    background
  ]

  it('reste « en cours » après son outil et après la fin du tour', () => {
    expect(statusOf(...launched)).toBe('in_progress')
    expect(statusOf(...launched, turnEnd)).toBe('in_progress')
  })

  it('fini avec sa réponse quand sa session a fini', () => {
    const [tool] = tools(...launched, turnEnd, {
      type: 'subagent-run',
      toolCallId: 's1',
      run: { endedAt: 61_000, answer: '8 problèmes de sécurité.' }
    })
    expect(tool?.status).toBe('completed')
    expect(tool?.subagentRun).toMatchObject({ background: true, endedAt: 61_000 })
    expect(tool?.subagentRun?.answer).toBe('8 problèmes de sécurité.')
  })

  it('fini même si d’autres messages sont partis depuis (D25, fiche 127)', () => {
    const later = [
      ...launched,
      turnEnd,
      { type: 'user-message', text: 'Et lis src/books.js' } as AgentEvent,
      update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Je lis.' } })
    ]
    // Son travail, relayé en direct pendant le tour suivant, va sous sa carte.
    const relayed: AgentEvent = {
      type: 'subagent-update',
      toolCallId: 's1',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'read-1',
        title: 'read',
        kind: 'read',
        status: 'completed'
      }
    }
    const ended: AgentEvent = {
      type: 'subagent-run',
      toolCallId: 's1',
      run: { endedAt: 61_000, answer: '8 problèmes de sécurité.' }
    }
    const [tool] = tools(...later, relayed, ended)
    expect(tool?.status).toBe('completed')
    expect(tool?.subagentRun).toMatchObject({ endedAt: 61_000, answer: '8 problèmes de sécurité.' })
    expect(tool?.work?.map((i) => i.kind === 'tool' && i.toolCallId)).toEqual(['read-1'])
    // Fini aussi pendant le tour suivant, et rien n'est rangé dans le dernier tour.
    expect(statusOf(...later.slice(0, -1), ended)).toBe('completed')
    expect(tools(...later, relayed, ended)).toHaveLength(1)
  })

  it('un outil d’un tour précédent qui n’est pas un sous-agent ne reçoit rien', () => {
    const read = update({
      sessionUpdate: 'tool_call',
      toolCallId: 'r1',
      title: 'read',
      kind: 'read',
      status: 'completed'
    })
    const [tool] = tools(
      { type: 'user-message', text: 'Lis' } as AgentEvent,
      read,
      turnEnd,
      { type: 'user-message', text: 'Encore' } as AgentEvent,
      { type: 'subagent-run', toolCallId: 'r1', run: { endedAt: 5 } }
    )
    expect(tool?.subagentRun).toBeUndefined()
  })

  it('suivi perdu, agent arrêté ou fil relu du disque : interrompu', () => {
    const lost: AgentEvent = { type: 'subagent-run', toolCallId: 's1', run: { lost: true } }
    expect(statusOf(...launched, turnEnd, lost)).toBe('cancelled')
    const exited: AgentEvent = {
      type: 'status',
      snapshot: { status: 'exited', info: { profileId: 'mock', profileLabel: 'Factice' } }
    } as AgentEvent
    expect(statusOf(...launched, turnEnd, exited)).toBe('cancelled')
    const [tool] = settleTranscript(reduce(...launched, turnEnd)).items.filter(
      (i) => i.kind === 'tool'
    )
    expect(tool).toMatchObject({ status: 'cancelled' })
  })
})

describe('OpenCode 2.3.0 : sous-agents toujours en arrière-plan (fiche 232)', () => {
  const text = (t: string) =>
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: t } })
  const agentTexts = (...events: AgentEvent[]) =>
    reduce(...events).items.flatMap((i) => (i.kind === 'agent' ? [i.text] : []))

  it('le parent répond hors tour : un autre message, pas la suite du précédent', () => {
    const turn = [
      { type: 'user-message', text: 'Lance un sous-agent' } as AgentEvent,
      text('Je te transmettrai le mot de code.'),
      { ...turnEnd, at: 5_000 }
    ]
    expect(agentTexts(...turn, text('Le mot de code '), text('est KANGOUROU.'))).toEqual([
      'Je te transmettrai le mot de code.',
      'Le mot de code est KANGOUROU.'
    ])
    // Pendant le tour, les morceaux font toujours un seul message.
    expect(agentTexts(...turn.slice(0, 2), text(' Encore.'))).toEqual([
      'Je te transmettrai le mot de code. Encore.'
    ])
  })

  it('à sa fin, son travail relu dans sa session remplace celui reçu en direct (incomplet)', () => {
    const subagent: AgentEvent = update({
      sessionUpdate: 'tool_call',
      toolCallId: 's1',
      title: 'subagent',
      kind: 'think',
      status: 'completed',
      rawInput: { agent: 'explore', description: 'Lire secret.txt', prompt: 'Lis secret.txt' }
    })
    const relayed: AgentEvent = {
      type: 'subagent-update',
      toolCallId: 's1',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'ses_k:read',
        title: 'read',
        kind: 'read',
        status: 'pending'
      }
    }
    const reread: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'You are a subagent spawned by another session.' },
      {
        kind: 'tool',
        id: 2,
        toolCallId: 'read',
        title: 'read',
        status: 'completed',
        content: [],
        locations: []
      },
      { kind: 'thought', id: 3, text: '' },
      { kind: 'agent', id: 4, text: 'KANGOUROU' }
    ]
    const state = reduce(
      { type: 'user-message', text: 'Lance' } as AgentEvent,
      subagent,
      {
        type: 'subagent-run',
        toolCallId: 's1',
        run: { startedAt: 1, sessionId: 'ses_k', background: true }
      },
      relayed,
      turnEnd,
      {
        type: 'subagent-run',
        toolCallId: 's1',
        run: { endedAt: 9, answer: 'KANGOUROU' },
        work: reread
      }
    )
    const card = state.items.find((i) => i.kind === 'tool')
    expect(card?.status).toBe('completed')
    expect(card?.kind === 'tool' && card.work?.map((i) => i.kind)).toEqual(['tool', 'agent'])
    expect(card?.kind === 'tool' && card.work?.[0]).toMatchObject({ status: 'completed' })
    // Numérotés à la suite du fil : aucun identifiant en double.
    const ids = [
      ...state.items.map((i) => i.id),
      ...(card?.kind === 'tool' ? (card.work ?? []).map((i) => i.id) : [])
    ]
    expect(new Set(ids).size).toBe(ids.length)
    expect(Math.max(...ids)).toBeLessThan(state.nextId)
  })
})
