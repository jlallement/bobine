import { describe, expect, it } from 'vitest'
import type { AcpExchange } from '@shared/acp-exchanges'
import {
  buildRows,
  durationText,
  filterRows,
  jsonTokens,
  parseExchange,
  sizeText,
  timeText,
  toNdjson
} from './acp-view'
import { mergeExchanges } from './useAcpExchanges'

/** Espaces insécables d'`Intl` en espaces ordinaires. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ')

let seq = 0
const at = new Date(2026, 9, 24, 14, 2, 11, 204).getTime()
function exchange(direction: 'in' | 'out', message: object, ms = 0): AcpExchange {
  const text = JSON.stringify({ jsonrpc: '2.0', ...message })
  seq++
  return { seq, at: at + ms, direction, text, bytes: text.length }
}
const update = (u: object, sessionId = 'ses_1') => ({
  method: 'session/update',
  params: { sessionId, update: u }
})
const chunk = (text: string, kind = 'agent_message_chunk', messageId?: string) =>
  update({
    sessionUpdate: kind,
    content: { type: 'text', text },
    ...(messageId ? { messageId } : {})
  })

/** Tour type : requête, réflexion et texte en morceaux, outil, permission et sa réponse. */
function turn() {
  seq = 0
  return [
    exchange('out', {
      id: 12,
      method: 'session/prompt',
      params: { sessionId: 'ses_1', prompt: [{ type: 'text' }, { type: 'resource_link' }] }
    }),
    exchange('in', chunk('Je ', 'agent_thought_chunk'), 100),
    exchange('in', chunk('réfléchis', 'agent_thought_chunk'), 120),
    exchange(
      'in',
      update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'patch', status: 'pending' }),
      200
    ),
    exchange(
      'in',
      update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' }),
      39_000
    ),
    exchange(
      'in',
      {
        id: 7,
        method: 'session/request_permission',
        params: {
          sessionId: 'ses_1',
          toolCall: { toolCallId: 't1', title: 'Modifier config.json' }
        }
      },
      39_100
    ),
    exchange(
      'out',
      { id: 7, result: { outcome: { outcome: 'selected', optionId: 'allow_once' } } },
      40_300
    ),
    exchange('in', chunk('Bon'), 40_400),
    exchange('in', chunk('jour'), 40_410),
    exchange('in', chunk(' !'), 40_420),
    exchange('in', { id: 12, result: { stopReason: 'end_turn' } }, 41_000)
  ].map(parseExchange)
}

describe('lignes de l’onglet « Échanges ACP » (fiche 135)', () => {
  it('méthode ou type de mise à jour, détail, durée de la réponse depuis sa requête', () => {
    const rows = buildRows(turn(), { group: true })
    expect(rows.map((r) => [r.direction, r.what, plain(r.detail)])).toEqual([
      ['out', 'session/prompt', '#12 · text, resource_link'],
      ['in', 'agent_thought_chunk ×2', ''],
      ['in', 'tool_call', 'patch · pending'],
      ['in', 'tool_call_update', 'completed · 38,8 s après'],
      ['in', 'session/request_permission', '#7 · Modifier config.json'],
      ['out', 'réponse #7', 'allow_once · 1,2 s'],
      ['in', 'agent_message_chunk ×3', ''],
      ['in', 'réponse #12', 'end_turn · 41 s']
    ])
    expect(rows[1]?.grouped).toBe(true)
    expect(rows[6]?.messages).toHaveLength(3)
    expect(rows[6]?.bytes).toBe(rows[6]?.messages.reduce((sum, m) => sum + m.bytes, 0))
  })

  it('sans regroupement, un morceau par ligne ; messages différents jamais regroupés', () => {
    expect(buildRows(turn(), { group: false })).toHaveLength(11)
    seq = 0
    const two = [
      exchange('in', chunk('a', 'agent_message_chunk', 'm1')),
      exchange('in', chunk('b', 'agent_message_chunk', 'm2')),
      exchange('in', chunk('c', 'agent_message_chunk', 'm2'))
    ].map(parseExchange)
    expect(buildRows(two, { group: true }).map((r) => r.what)).toEqual([
      'agent_message_chunk',
      'agent_message_chunk ×2'
    ])
  })

  it('erreur et ligne non JSON lisibles', () => {
    seq = 0
    const rows = buildRows(
      [
        exchange('out', { id: 3, method: 'session/load', params: {} }),
        exchange('in', { id: 3, error: { code: -32601, message: 'Method not found' } }, 5),
        { seq: 9, at, direction: 'in' as const, text: 'oops', bytes: 4 }
      ].map(parseExchange),
      { group: true }
    )
    expect(rows[1]).toMatchObject({ what: 'erreur #3', error: true })
    expect(plain(rows[1]?.detail ?? '')).toBe('-32601 · Method not found · 5 ms')
    expect(rows[2]?.what).toBe('ligne non JSON')
  })

  it('filtre (méthode, outil, texte) et copie en NDJSON', () => {
    const rows = buildRows(turn(), { group: true })
    expect(filterRows(rows, 'PATCH').map((r) => r.what)).toEqual(['tool_call'])
    expect(filterRows(rows, 'réfléchis').map((r) => r.what)).toEqual(['agent_thought_chunk ×2'])
    expect(filterRows(rows, ' ')).toHaveLength(rows.length)
    const ndjson = toNdjson(filterRows(rows, 'agent_message_chunk'))
    const lines = ndjson.trimEnd().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines.map((l) => (JSON.parse(l) as { method: string }).method)).toEqual([
      'session/update',
      'session/update',
      'session/update'
    ])
  })

  it('JSON indenté en jetons : clés, chaînes, littéraux', () => {
    const message = turn()[0]
    if (!message) throw new Error('pas de message')
    const tokens = jsonTokens(message)
    expect(tokens.map((t) => t.text).join('')).toBe(JSON.stringify(message.json, null, 2))
    expect(tokens).toContainEqual({ text: '"method"', type: 'key' })
    expect(tokens).toContainEqual({ text: '"session/prompt"', type: 'string' })
    expect(tokens).toContainEqual({ text: '12', type: 'literal' })
    expect(
      jsonTokens(parseExchange({ seq: 1, at, direction: 'in', text: 'oops', bytes: 4 }))
    ).toEqual([{ text: 'oops' }])
  })

  it('heure à la milliseconde, taille et durée dans la langue de l’interface', () => {
    expect(timeText(at)).toBe('14:02:11.204')
    expect(plain(sizeText(512))).toBe('512 o')
    expect(plain(sizeText(2150))).toMatch(/^2,1 ko$/i)
    expect(plain(durationText(120))).toBe('120 ms')
    expect(plain(durationText(125_000))).toBe('2 min 5 s')
  })

  it('fusion par numéro : sans doublon, bornée aux plus récents', () => {
    seq = 0
    const all = Array.from({ length: 6 }, (_, n) => exchange('in', { method: 'x', n }))
    const pick = (...indexes: number[]) => all.filter((_, i) => indexes.includes(i))
    const first = mergeExchanges([], [...pick(2), ...pick(0, 1)], 4)
    expect(first.map((m) => m.seq)).toEqual([1, 2, 3])
    const next = mergeExchanges(first, pick(1, 2, 3, 4, 5), 4)
    expect(next.map((m) => m.seq)).toEqual([3, 4, 5, 6])
    expect(mergeExchanges(next, pick(5))).toBe(next)
  })
})
