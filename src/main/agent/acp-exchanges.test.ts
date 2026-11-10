import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcpExchangesBatch } from '@shared/acp-exchanges'
import { addSecret, MASK } from '../log-redact'
import { AcpExchanges, MESSAGE_MAX_CHARS } from './acp-exchanges'
import { acpExchangeHandlers } from './acp-exchanges-ipc'

const line = (n: number) => JSON.stringify({ jsonrpc: '2.0', method: 'session/update', n })

describe('échanges ACP en mémoire (fiche 135)', () => {
  afterEach(() => vi.useRealTimers())

  it('tampon borné : seuls les derniers messages restent, numérotés', () => {
    const exchanges = new AcpExchanges({ max: 5 })
    for (let n = 1; n <= 12; n++) exchanges.line('c1', n % 2 ? 'in' : 'out', line(n))
    const { messages } = exchanges.snapshot('c1')
    expect(exchanges.size('c1')).toBe(5)
    expect(messages.map((m) => m.seq)).toEqual([8, 9, 10, 11, 12])
    expect(messages.at(-1)).toMatchObject({ direction: 'out', text: line(12) })
    expect(messages[0]?.bytes).toBe(Buffer.byteLength(line(8)))
  })

  it('borné en texte aussi ; une ligne trop longue est coupée, sa taille réelle gardée', () => {
    const exchanges = new AcpExchanges({ conversationMaxChars: 100 })
    for (let n = 1; n <= 10; n++) exchanges.line('c1', 'in', line(n))
    const kept = exchanges.snapshot('c1').messages
    expect(kept.reduce((sum, m) => sum + m.text.length, 0)).toBeLessThanOrEqual(100)
    expect(kept.at(-1)?.seq).toBe(10)

    const long = `{"text":"${'é'.repeat(MESSAGE_MAX_CHARS)}"}`
    const big = new AcpExchanges()
    big.line('c2', 'in', long)
    const [message] = big.snapshot('c2').messages
    expect(message?.truncated).toBe(true)
    expect(message?.text.length).toBe(MESSAGE_MAX_CHARS)
    expect(message?.bytes).toBe(Buffer.byteLength(long))
  })

  it('secrets masqués quand le texte quitte le main : clé déclarée, forme connue, champ nommé', () => {
    const key = 'fausse-cle-de-test-0123456789' // gitleaks:allow — fake value for tests
    addSecret(key)
    const exchanges = new AcpExchanges()
    exchanges.line(
      'c1',
      'out',
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'authenticate',
        params: { env: { MY_KEY: key }, apiKey: 'abcd1234efgh', note: 'sk-ant-0123456789abcdefXYZ' } // gitleaks:allow — fake value for tests
      })
    )
    const [message] = exchanges.watch('c1').messages
    expect(message?.text).not.toContain(key)
    expect(message?.text).not.toContain('abcd1234efgh')
    expect(message?.text).not.toContain('sk-ant-0123456789abcdefXYZ')
    expect(message?.text).toContain(MASK)
    // Le JSON reste lisible pour l'onglet.
    expect(() => JSON.parse(message?.text ?? '') as unknown).not.toThrow()
  })

  it('lots envoyés seulement aux conversations regardées, regroupés, arrêtés à la fermeture', () => {
    vi.useFakeTimers()
    const exchanges = new AcpExchanges({ batchMs: 100 })
    const batches: AcpExchangesBatch[] = []
    exchanges.onBatch((batch) => batches.push(batch))
    exchanges.line('c1', 'in', line(1))
    vi.advanceTimersByTime(200)
    expect(batches).toEqual([])

    expect(exchanges.watch('c1').messages.map((m) => m.seq)).toEqual([1])
    exchanges.line('c1', 'in', line(2))
    exchanges.line('c1', 'out', line(3))
    exchanges.line('c2', 'in', line(4))
    expect(batches).toEqual([])
    vi.advanceTimersByTime(100)
    expect(batches).toHaveLength(1)
    expect(batches[0]?.conversationId).toBe('c1')
    expect(batches[0]?.messages.map((m) => m.seq)).toEqual([2, 3])

    exchanges.unwatch('c1')
    exchanges.line('c1', 'in', line(5))
    vi.advanceTimersByTime(200)
    expect(batches).toHaveLength(1)
    // Gardé quand même, pour la prochaine ouverture de l'onglet.
    expect(exchanges.size('c1')).toBe(4)
  })

  it('conversations bornées : la moins récemment active part, jamais une regardée', () => {
    const exchanges = new AcpExchanges({ maxConversations: 2 })
    exchanges.watch('a')
    exchanges.line('a', 'in', line(1))
    exchanges.line('b', 'in', line(2))
    exchanges.line('c', 'in', line(3))
    expect(exchanges.size('a')).toBe(1)
    expect(exchanges.size('b')).toBe(0)
    expect(exchanges.size('c')).toBe(1)
  })

  it('canaux IPC : identifiant vérifié', () => {
    const exchanges = new AcpExchanges()
    exchanges.line('c1', 'in', line(1))
    const handlers = acpExchangeHandlers(exchanges)
    expect(handlers['acp:watch']('c1')).toMatchObject({ messages: [{ seq: 1 }] })
    expect(handlers['acp:unwatch']('c1')).toBeUndefined()
    expect(() => handlers['acp:watch']('' as string)).toThrow()
    expect(() => handlers['acp:watch'](42 as unknown as string)).toThrow()
  })
})
