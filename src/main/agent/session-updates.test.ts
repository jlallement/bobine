import type { SessionNotification, SessionUpdate } from '../../shared/acp-sdk.mts'
import { describe, expect, it } from 'vitest'
import type { ChildSession, SubagentStream } from './adapters'
import { routeUpdate, type UpdateContext } from './session-updates'

const SESSION = 'session-1'

/** Session ouverte, agent prêt (hors tour, hors rejeu). */
const ready: UpdateContext = {
  sessionId: SESSION,
  busy: false,
  replaying: false,
  ignoreReplay: false
}

const from = (update: SessionUpdate, sessionId = SESSION): SessionNotification => ({
  sessionId,
  update
})

const text = (sessionUpdate: 'user_message_chunk' | 'agent_message_chunk'): SessionUpdate => ({
  sessionUpdate,
  content: { type: 'text', text: 'Bonjour' }
})

const toolCall: SessionUpdate = { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Lire' }

const commands: SessionUpdate = {
  sessionUpdate: 'available_commands_update',
  availableCommands: [
    { name: 'compact', description: 'Résume la conversation' },
    { name: 'review', description: 'Relit', input: { hint: 'fichier' } },
    { name: '  ', description: 'sans nom' }
  ]
}

describe('tri des session/update', () => {
  it('écho de nos messages pendant un tour : écarté ; la réponse, gardée', () => {
    const turn = { ...ready, busy: true }
    expect(routeUpdate(from(text('user_message_chunk')), turn)).toEqual({ kind: 'drop' })
    expect(routeUpdate(from(text('agent_message_chunk')), turn)).toEqual({
      kind: 'thread',
      trackSubagents: true
    })
  })

  it('rejeu après la réponse à session/load (Bob 2.0.6) : les messages de l’utilisateur restent', () => {
    // Hors de nos tours, un message de l'utilisateur vient du rejeu, même après la réponse.
    expect(routeUpdate(from(text('user_message_chunk')), ready)).toEqual({
      kind: 'thread',
      trackSubagents: true
    })
    // Pendant le rejeu : gardé, mais rien n'est montré au suivi des sous-agents.
    const replaying = { ...ready, replaying: true, busy: true }
    expect(routeUpdate(from(text('user_message_chunk')), replaying)).toEqual({
      kind: 'thread',
      trackSubagents: false
    })
    expect(routeUpdate(from(toolCall), replaying)).toEqual({
      kind: 'thread',
      trackSubagents: false
    })
  })

  it('rejeu avec le fil de l’app gardé (fiche 103) : le fil à réconcilier, l’état de la session suivi', () => {
    const keep = { ...ready, ignoreReplay: true }
    const replayed: SessionUpdate[] = [
      text('user_message_chunk'),
      text('agent_message_chunk'),
      { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: '…' } },
      toolCall,
      { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' },
      { sessionUpdate: 'plan', entries: [] }
    ]
    for (const update of replayed) {
      expect(routeUpdate(from(update), keep)).toEqual({ kind: 'replayed' })
    }
    expect(
      routeUpdate(from({ sessionUpdate: 'current_mode_update', currentModeId: 'plan' }), keep)
    ).toEqual({ kind: 'thread', mode: 'plan', trackSubagents: true })
    expect(routeUpdate(from(commands), keep).kind).toBe('commands')
  })

  it('commandes « / » : acceptées avant l’identifiant de session ; sans nom, écartées', () => {
    const opening = { ...ready, sessionId: undefined }
    const expected = {
      kind: 'commands',
      commands: [
        { name: 'compact', description: 'Résume la conversation' },
        { name: 'review', description: 'Relit', hint: 'fichier' }
      ]
    }
    expect(routeUpdate(from(commands, 'pas-encore-connue'), opening)).toEqual(expected)
    expect(routeUpdate(from(commands), ready)).toEqual(expected)
    // Commandes d'une autre session, une fois la nôtre connue : écartées.
    expect(routeUpdate(from(commands, 'autre'), ready)).toEqual({ kind: 'drop' })
  })

  it('sessions enfants : écartées, et rien avant l’identifiant de session', () => {
    expect(routeUpdate(from(text('agent_message_chunk'), 'enfant'), ready)).toEqual({
      kind: 'drop'
    })
    expect(
      routeUpdate(from(text('agent_message_chunk')), { ...ready, sessionId: undefined })
    ).toEqual({ kind: 'drop' })
  })

  it('mode et options de la session : changés en plus du fil', () => {
    expect(
      routeUpdate(from({ sessionUpdate: 'current_mode_update', currentModeId: 'code' }), ready)
    ).toEqual({ kind: 'thread', mode: 'code', trackSubagents: true })
    expect(
      routeUpdate(from({ sessionUpdate: 'config_option_update', configOptions: [] }), ready)
    ).toEqual({ kind: 'thread', configOptions: [], trackSubagents: true })
  })

  describe('travail d’un sous-agent relayé dans le flux (fiche 078)', () => {
    const child: ChildSession = { id: 'enfant', parentId: SESSION, depth: 1 }
    const stream: SubagentStream = {
      childOf: (update) => (update._meta?.['child'] ? child : undefined),
      forCard: (update) => update
    }
    const marked = (update: SessionUpdate): SessionUpdate => ({ ...update, _meta: { child: true } })

    it('rangé sous la carte ; le reste va au fil', () => {
      const withStream = { ...ready, subagentStream: stream }
      expect(routeUpdate(from(marked(toolCall)), withStream)).toEqual({
        kind: 'subagent',
        stream,
        child
      })
      expect(routeUpdate(from(toolCall), withStream)).toEqual({
        kind: 'thread',
        trackSubagents: true
      })
    })

    it('profil sans subagentStream : la marque n’est pas lue', () => {
      expect(routeUpdate(from(marked(toolCall)), ready)).toEqual({
        kind: 'thread',
        trackSubagents: true
      })
    })

    it('rejeu (fil gardé) et écho : écartés avant d’être rangés', () => {
      const keep = { ...ready, subagentStream: stream, ignoreReplay: true }
      expect(routeUpdate(from(marked(toolCall)), keep)).toEqual({ kind: 'replayed' })
      const turn = { ...ready, subagentStream: stream, busy: true }
      expect(routeUpdate(from(marked(text('user_message_chunk'))), turn)).toEqual({
        kind: 'drop'
      })
    })
  })
})
