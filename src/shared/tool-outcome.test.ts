import { describe, expect, it } from 'vitest'
import type { SessionUpdate } from './acp-sdk.mts'
import type { AgentEvent } from './agent'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from './transcript'
import { subagentsState, toolGroupState } from './tool-groups'

/** États des cartes qui disent vrai (fiche 122) : refusé, échec. */

const update = (u: SessionUpdate): AgentEvent => ({ type: 'update', update: u })
const call = (toolCallId: string, title = 'Running Terminal Run (bobine)'): AgentEvent =>
  update({ sessionUpdate: 'tool_call', toolCallId, title, kind: 'other', status: 'in_progress' })
const end = (toolCallId: string, status: 'completed' | 'failed'): AgentEvent =>
  update({ sessionUpdate: 'tool_call_update', toolCallId, status })
const turnEnd: AgentEvent = { type: 'turn-end', stopReason: 'end_turn' }
const reduce = (...events: AgentEvent[]) => events.reduce(reduceTranscript, emptyTranscript)
const tools = (...events: AgentEvent[]) =>
  reduce(...events).items.filter(
    (i): i is Extract<TranscriptItem, { kind: 'tool' }> => i.kind === 'tool'
  )
const statusOf = (...events: AgentEvent[]) => tools(...events)[0]?.status

describe('issue d’un outil connue de l’app (fiche 122)', () => {
  it('outil de l’app refusé : « refusé » même si l’agent le dit fini', () => {
    expect(
      statusOf(
        { type: 'user-message', text: 'Lance les tests' },
        call('t1'),
        { type: 'tool-outcome', toolCallId: 't1', outcome: 'refused' },
        end('t1', 'completed')
      )
    ).toBe('refused')
  })

  it('outil de l’app en erreur : « échec » même si l’agent le dit fini, avant ou après', () => {
    const failed: AgentEvent = { type: 'tool-outcome', toolCallId: 't1', outcome: 'failed' }
    expect(statusOf(call('t1'), failed, end('t1', 'completed'))).toBe('failed')
    expect(statusOf(call('t1'), end('t1', 'completed'), failed)).toBe('failed')
  })

  it('un refus reste un refus : ni l’échec dit par l’agent, ni une erreur suivante ne le changent', () => {
    expect(
      statusOf(
        call('t1'),
        { type: 'tool-outcome', toolCallId: 't1', outcome: 'refused' },
        end('t1', 'failed'),
        { type: 'tool-outcome', toolCallId: 't1', outcome: 'failed' }
      )
    ).toBe('refused')
  })

  it('carte inconnue : sans effet', () => {
    const state = reduce(call('t1'))
    expect(
      reduceTranscript(state, { type: 'tool-outcome', toolCallId: 'zzz', outcome: 'failed' })
    ).toBe(state)
  })

  it('autorisation refusée : « refusé », que l’agent dise échec (Bob), fini, ou rien', () => {
    const asked: AgentEvent = {
      type: 'permission-request',
      requestId: 'p1',
      toolCall: { toolCallId: 't1', title: 'Shell', kind: 'execute', status: 'pending' },
      options: [
        { optionId: 'oui', name: 'Allow', kind: 'allow_once' },
        { optionId: 'non', name: 'Reject', kind: 'reject_once' }
      ]
    }
    const refused: AgentEvent = { type: 'permission-resolved', requestId: 'p1', optionId: 'non' }
    const start: AgentEvent = { type: 'user-message', text: 'go' }
    expect(statusOf(start, asked, refused, end('t1', 'failed'))).toBe('refused')
    expect(statusOf(start, asked, refused, end('t1', 'completed'))).toBe('refused')
    expect(statusOf(start, asked, refused, turnEnd)).toBe('refused')
    // Accordée : l'agent dit la suite.
    const allowed: AgentEvent = { type: 'permission-resolved', requestId: 'p1', optionId: 'oui' }
    expect(statusOf(start, asked, allowed, end('t1', 'completed'))).toBe('completed')
  })

  it('comptés à part dans un groupe d’outils et dans la carte « Sous-agents »', () => {
    const items = tools(
      call('t1'),
      { type: 'tool-outcome', toolCallId: 't1', outcome: 'refused' },
      end('t1', 'completed'),
      call('t2'),
      end('t2', 'failed')
    )
    expect(toolGroupState(items)).toMatchObject({ failed: 1, refused: 1, cancelled: 0 })
    expect(subagentsState(items)).toMatchObject({ failed: 1, refused: 1, done: 0 })
  })
})
