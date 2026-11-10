import { describe, expect, it } from 'vitest'
import { subagentMarkOf } from '@shared/subagent'
import { SubagentMarker } from './subagent-marks'
import { BOB_SUBAGENT_FORMAT } from './bob-subagents'
import { OPENCODE_SUBAGENT_FORMAT } from './opencode-subagents'

describe('marque des sous-agents (fiche 140)', () => {
  it('Bob : titre retenu du tool_call, reconnu aussi sur une mise à jour sans titre', () => {
    const marker = new SubagentMarker(BOB_SUBAGENT_FORMAT)
    const call = marker.mark({
      sessionUpdate: 'tool_call',
      toolCallId: 's',
      title: 'Running subagent: Lire a.txt',
      rawInput: { description: 'Lire a.txt', name: 'explore' }
    })
    expect(subagentMarkOf(call)).toEqual({ subagent: { type: 'explore', task: 'Lire a.txt' } })
    const done = marker.mark({
      sessionUpdate: 'tool_call_update',
      toolCallId: 's',
      status: 'completed'
    })
    // Bob ne nomme pas de session : pas de `sessionId`.
    expect(subagentMarkOf(done)).toEqual({ subagent: { task: 'Lire a.txt' } })
  })

  it('OpenCode : reconnu quand la consigne arrive ; session lue à la fin, même sans rawInput', () => {
    const marker = new SubagentMarker(OPENCODE_SUBAGENT_FORMAT)
    const pending = marker.mark({
      sessionUpdate: 'tool_call',
      toolCallId: 't',
      title: 'subagent',
      rawInput: {}
    })
    expect(subagentMarkOf(pending)).toBeUndefined()
    const running = marker.mark({
      sessionUpdate: 'tool_call_update',
      toolCallId: 't',
      status: 'in_progress',
      rawInput: { agent: 'explore', description: 'Lire', prompt: 'Lis a.txt' }
    })
    expect(subagentMarkOf(running)?.subagent?.type).toBe('explore')
    const done = marker.mark({
      sessionUpdate: 'tool_call_update',
      toolCallId: 't',
      status: 'completed',
      content: [
        {
          type: 'content',
          content: {
            type: 'text',
            text: '<subagent sessionID="ses_1" state="completed">ok</subagent>'
          }
        }
      ]
    })
    expect(subagentMarkOf(done)).toEqual({ sessionId: 'ses_1' })
  })

  it('un autre outil, ou un profil sans format : la mise à jour reste telle quelle', () => {
    const update = {
      sessionUpdate: 'tool_call' as const,
      toolCallId: 'r',
      title: 'Running subagent: Lire',
      rawInput: { description: 'Lire' }
    }
    expect(new SubagentMarker(undefined).mark(update)).toBe(update)
    const read = { sessionUpdate: 'tool_call' as const, toolCallId: 'x', title: 'Read a.txt' }
    expect(new SubagentMarker(BOB_SUBAGENT_FORMAT).mark(read)).toBe(read)
  })

  it('demande d’autorisation : marquée, titre de la carte prioritaire', () => {
    const marker = new SubagentMarker(BOB_SUBAGENT_FORMAT)
    marker.mark({
      sessionUpdate: 'tool_call',
      toolCallId: 's',
      title: 'Running subagent: Lire a.txt'
    })
    const asked = marker.markPermission({ toolCallId: 's', title: 'spawn_subagent' })
    expect(subagentMarkOf(asked)).toEqual({ subagent: { task: 'Lire a.txt' } })
    const other = { toolCallId: 'w', title: 'Write b.txt' }
    expect(marker.markPermission(other)).toBe(other)
  })
})
