import { describe, expect, it } from 'vitest'
import { ProgressLines, statusOnlyLine } from './agent-progress'

const update = (u: object) =>
  JSON.stringify({
    jsonrpc: '2.0',
    method: 'session/update',
    params: { sessionId: 's', update: u }
  })

/** Relevé réel d'OpenCode 2.3.0 derrière un proxy injoignable (recette du 2026-11-23). */
const OPENCODE_RETRY = update({
  sessionUpdate: 'session_info_update',
  _meta: {
    'opencode/retry': {
      attempt: 9,
      nextRetryAt: '2026-11-23T14:13:39.979Z',
      error: {
        type: 'provider.transport',
        message:
          "Can't reach opencode.ai. Check the network connection. (getaddrinfo ENOTFOUND proxy.exem21ple.test)"
      }
    }
  }
})

describe('ce qui dit que l’agent avance (bandeau de silence)', () => {
  it('mises à jour d’état seules : pas une avancée', () => {
    expect(statusOnlyLine(OPENCODE_RETRY)).toBe(true)
    expect(statusOnlyLine(update({ sessionUpdate: 'session_info_update', title: 'T' }))).toBe(true)
    expect(statusOnlyLine(update({ sessionUpdate: 'usage_update', used: 1, size: 2 }))).toBe(true)
    expect(statusOnlyLine(update({ sessionUpdate: 'available_commands_update' }))).toBe(true)
    expect(statusOnlyLine(update({ sessionUpdate: 'current_mode_update' }))).toBe(true)
    expect(statusOnlyLine(update({ sessionUpdate: 'config_option_update' }))).toBe(true)
    // Espaces autour des deux-points (un autre agent que ceux relevés).
    expect(
      statusOnlyLine(
        '{"method": "session/update", "params": {"update": {"sessionUpdate": "usage_update"}}}'
      )
    ).toBe(true)
  })

  it('texte, réflexion, outil, plan, demandes et réponses : une avancée', () => {
    const text = { type: 'text', text: 'x' }
    expect(statusOnlyLine(update({ sessionUpdate: 'agent_message_chunk', content: text }))).toBe(
      false
    )
    expect(statusOnlyLine(update({ sessionUpdate: 'agent_thought_chunk', content: text }))).toBe(
      false
    )
    expect(statusOnlyLine(update({ sessionUpdate: 'tool_call', toolCallId: 'c' }))).toBe(false)
    expect(statusOnlyLine(update({ sessionUpdate: 'tool_call_update', toolCallId: 'c' }))).toBe(
      false
    )
    expect(statusOnlyLine(update({ sessionUpdate: 'plan', entries: [] }))).toBe(false)
    expect(
      statusOnlyLine('{"jsonrpc":"2.0","id":3,"method":"session/request_permission","params":{}}')
    ).toBe(false)
    expect(statusOnlyLine('{"jsonrpc":"2.0","id":4,"result":{"stopReason":"end_turn"}}')).toBe(
      false
    )
  })

  it('un texte qui cite une mise à jour d’état reste une avancée (guillemets échappés)', () => {
    const quoted = update({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: '{"sessionUpdate":"usage_update"}' }
    })
    expect(statusOnlyLine(quoted)).toBe(false)
  })

  it('lignes en morceaux : une avancée par ligne complète, à son dernier morceau', () => {
    const seen: boolean[] = []
    const lines = new ProgressLines((progress) => seen.push(progress))
    const bytes = new TextEncoder().encode(
      `${OPENCODE_RETRY}\n\n${update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'é' } })}\n`
    )
    // Coupé au milieu d'un caractère accentué et des lignes.
    for (let i = 0; i < bytes.length; i += 7) lines.bytes(bytes.subarray(i, i + 7))
    expect(seen).toEqual([false, true])
  })
})
