import { describe, expect, it } from 'vitest'
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import { readOpenCodeRetry } from './opencode-retry'

const info = (meta: unknown) =>
  ({ sessionUpdate: 'session_info_update', _meta: meta }) as SessionUpdate

/** Relevé réel (OpenCode 2.3.0, proxy injoignable, 2026-11-23). */
const RECORDED = {
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

describe('reprises d’OpenCode 2.3.0 (fiche 275)', () => {
  it('tentative échouée : numéro, heure de la suivante, message tel quel', () => {
    expect(readOpenCodeRetry(info(RECORDED))).toEqual({
      attempt: 9,
      at: Date.parse('2026-11-23T14:13:39.979Z'),
      message:
        "Can't reach opencode.ai. Check the network connection. (getaddrinfo ENOTFOUND proxy.exem21ple.test)"
    })
  })

  it('nouvelle tentative en cours : null ; autre mise à jour : rien', () => {
    expect(readOpenCodeRetry(info({ 'opencode/retry': null }))).toBeNull()
    expect(readOpenCodeRetry(info({}))).toBeUndefined()
    expect(
      readOpenCodeRetry({ sessionUpdate: 'session_info_update', title: 'T' } as SessionUpdate)
    ).toBeUndefined()
    expect(
      readOpenCodeRetry({
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'x' },
        _meta: RECORDED
      } as SessionUpdate)
    ).toBeUndefined()
  })

  it('surprises : forme inconnue ignorée, heure ou message absents omis', () => {
    expect(readOpenCodeRetry(info({ 'opencode/retry': { attempt: 'deux' } }))).toBeUndefined()
    expect(readOpenCodeRetry(info({ 'opencode/retry': 'oui' }))).toBeUndefined()
    expect(
      readOpenCodeRetry(info({ 'opencode/retry': { attempt: 3, nextRetryAt: 'demain' } }))
    ).toEqual({
      attempt: 3
    })
  })

  it('identifiants d’un proxy cités dans le message : masqués', () => {
    const update = info({
      'opencode/retry': {
        attempt: 2,
        error: { message: 'proxy http://jean:s3cr3t@p:3128 refused' }
      }
    })
    expect(readOpenCodeRetry(update)?.message).toBe('proxy http://•••@p:3128 refused')
  })
})
