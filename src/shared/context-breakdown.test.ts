import { describe, expect, it } from 'vitest'
import { contextBreakdown, contextStart, messagesTokens } from './context-breakdown'
import { reduceTranscript, emptyTranscript, type TranscriptItem } from './transcript'
import { contextDropped, withContext } from './usage'

const user = (id: number, text: string, extra: object = {}): TranscriptItem =>
  ({ kind: 'user', id, text, ...extra }) as TranscriptItem
const agent = (id: number, text: string): TranscriptItem => ({ kind: 'agent', id, text })
const x = (n: number) => 'x'.repeat(n)

describe('messages du fil (fiche 166)', () => {
  it('≈ caractères / 4 : utilisateur, agent, contenu et diffs des outils, sortie des terminaux', () => {
    const items: TranscriptItem[] = [
      user(1, x(400)),
      { kind: 'thought', id: 2, text: x(4000) },
      agent(3, x(400)),
      {
        kind: 'tool',
        id: 4,
        toolCallId: 't',
        title: '',
        status: 'completed',
        locations: [],
        content: [
          { type: 'content', content: { type: 'text', text: x(399) } },
          { type: 'diff', path: 'a', oldText: null, newText: x(396) },
          { type: 'terminal', terminalId: 'term' }
        ]
      }
    ]
    // La réflexion ne compte pas ; chaque morceau de l'outil est séparé d'un saut de ligne.
    const tokens = messagesTokens({ items, terminals: { term: { output: x(800) } } })
    expect(tokens).toBe(100 + 100 + Math.round((1 + 399 + 1 + 2 + 396 + 1 + 800) / 4))
  })

  it('compaction : seuls les éléments depuis la dernière comptent', () => {
    const items = [
      user(1, x(4000)),
      agent(2, x(4000)),
      user(3, '/compact', { compaction: true }),
      agent(4, x(400))
    ]
    expect(contextStart(items)).toBe(3)
    expect(messagesTokens({ items })).toBe(2 + 100)
    const update: TranscriptItem = {
      kind: 'compaction',
      id: 5,
      compactionId: 'c',
      status: 'completed',
      summary: x(40)
    }
    expect(contextStart([...items, update])).toBe(5)
    // Baisse nette de `used` vue par l'app : le repère vient de la consommation.
    expect(contextStart(items, { contextSince: 4 })).toBe(4)
  })
})

describe('baisse nette de « used » (fiche 166)', () => {
  it('un quart du contexte et 1 000 jetons au moins', () => {
    expect(contextDropped(100_000, 20_000)).toBe(true)
    expect(contextDropped(100_000, 90_000)).toBe(false)
    expect(contextDropped(2_000, 1_200)).toBe(false)
  })

  it('posée par le fil sur l’élément suivant', () => {
    let usage = withContext({}, { used: 90_000, size: 200_000 }, 3)
    expect(usage.contextSince).toBeUndefined()
    usage = withContext(usage, { used: 10_000, size: 200_000 }, 7)
    expect(usage.contextSince).toBe(7)
    let state = reduceTranscript(emptyTranscript, { type: 'user-message', text: 'a' })
    state = reduceTranscript(state, {
      type: 'update',
      update: { sessionUpdate: 'usage_update', used: 50_000, size: 100_000 }
    })
    state = reduceTranscript(state, {
      type: 'update',
      update: { sessionUpdate: 'usage_update', used: 5_000, size: 100_000 }
    })
    expect(state.usage?.contextSince).toBe(state.nextId)
  })
})

describe('répartition du contexte (fiche 166)', () => {
  const items = [user(1, x(4000))] // 1 000 jetons

  it('avec un total : la somme des lignes vaut la taille, « Agent » est le reste', () => {
    const result = contextBreakdown({
      items,
      usage: { context: { used: 30_000, size: 100_000 } },
      appTools: 5_000,
      mcp: { tokens: 4_000, servers: 1, measured: 1, testing: false }
    })
    expect(result.total).toEqual({ used: 30_000, size: 100_000, ratio: 0.3 })
    expect(result.lines.map((l) => [l.id, l.tokens, l.estimated])).toEqual([
      ['messages', 1_000, true],
      ['bobine', 5_000, true],
      ['mcp', 4_000, true],
      ['agent', 20_000, true],
      ['free', 70_000, false]
    ])
    expect(result.lines.reduce((n, l) => n + l.tokens, 0)).toBe(100_000)
  })

  it('estimations plus grandes que le total : ramenées à « used », Agent à 0, toujours « ≈ »', () => {
    // Cas de la capture relue : 506 + 4 073 estimés pour 3 157 annoncés.
    const result = contextBreakdown({
      items: [user(1, x(2024))],
      usage: { context: { used: 3_157, size: 200_000 } },
      appTools: 4_073
    })
    const all = Object.fromEntries(result.lines.map((l) => [l.id, l.tokens]))
    const tokens = (id: string) => all[id] ?? Number.NaN
    expect(tokens('messages') + tokens('bobine')).toBe(3_157)
    expect(tokens('agent')).toBe(0)
    expect(tokens('free')).toBe(200_000 - 3_157)
    expect(result.lines.filter((l) => l.id !== 'free').every((l) => l.estimated)).toBe(true)
    // La somme brute reste celle des estimations (affichée sans total).
    expect(result.estimated).toBe(506 + 4_073)
    // Proportions gardées : les outils pèsent toujours environ huit fois les messages.
    expect(Math.round(tokens('bobine') / tokens('messages'))).toBe(8)
  })

  it('« Agent » jamais négatif ; la somme des lignes vaut toujours la taille', () => {
    for (const [used, appTools] of [
      [2_000, 5_000],
      [900, 3_000],
      [1_000, 1]
    ] as const) {
      const result = contextBreakdown({
        items,
        usage: { context: { used, size: 1_000_000 } },
        appTools
      })
      const occupied = result.lines.filter((l) => l.id !== 'free')
      expect(occupied.reduce((n, l) => n + l.tokens, 0)).toBe(used)
      expect(result.lines.reduce((n, l) => n + l.tokens, 0)).toBe(1_000_000)
      expect(result.lines.every((l) => l.tokens >= 0)).toBe(true)
    }
  })

  it('sans total (Bob) : ce que Bobine connaît, ni « Agent » ni « Libre »', () => {
    const result = contextBreakdown({
      items,
      appTools: 5_000,
      mcp: { tokens: 0, servers: 2, measured: 0, testing: false }
    })
    expect(result.total).toBeUndefined()
    expect(result.estimated).toBe(6_000)
    expect(result.lines.map((l) => l.id)).toEqual(['messages', 'bobine', 'mcp'])
    // Serveurs configurés mais jamais mesurés : la ligne est là, sans valeur (« Mesurer »).
    expect(result.lines.at(-1)?.mcp).toEqual({ servers: 2, measured: 0, testing: false })
  })

  it('aucun serveur MCP configuré et outils de Bobine inconnus : pas de ligne', () => {
    const result = contextBreakdown({
      items,
      mcp: { tokens: 0, servers: 0, measured: 0, testing: false }
    })
    expect(result.lines.map((l) => l.id)).toEqual(['messages'])
  })
})
