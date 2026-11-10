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
