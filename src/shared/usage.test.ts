import { describe, expect, it } from 'vitest'
import {
  addTurn,
  contextRatio,
  conversationCost,
  digestsTotal,
  endTurn,
  estimateTokens,
  formatCost,
  formatTokens,
  hasUsage,
  MAX_TURNS,
  nextSession,
  parseUsageDigest,
  startTurn,
  turnAverages,
  turnCost,
  unitLabel,
  usageDigest,
  withContext,
  withCost,
  withoutCost,
  type ConversationUsage
} from './usage'

describe('consommation', () => {
  it('usage_update : contexte, et coût seulement s’il est fourni', () => {
    let usage = withContext({}, { used: 16748, size: 258400 })
    expect(usage).toEqual({ context: { used: 16748, size: 258400 } })
    usage = withContext(usage, { used: 7053, size: 200000, cost: { amount: 0.5, currency: 'USD' } })
    usage = withContext(usage, { used: 8000, size: 200000 })
    expect(usage).toEqual({
      context: { used: 8000, size: 200000 },
      cost: { amount: 0.5, currency: 'USD' }
    })
    expect(contextRatio(usage)).toBe(0.04)
  })

  it('usage du tour : cumulé, dernier tour conservé (forme réelle de Codex)', () => {
    let usage = addTurn(
      {},
      { totalTokens: 16748, inputTokens: 3559, cachedReadTokens: 13184, outputTokens: 5 }
    )
    usage = addTurn(usage, {
      totalTokens: 16766,
      inputTokens: 248,
      cachedReadTokens: 16512,
      outputTokens: 6,
      thoughtTokens: 0
    })
    expect(usage.tokens).toEqual({
      input: 3807,
      output: 11,
      cachedRead: 29696,
      cachedWrite: 0,
      thought: 0,
      total: 33514,
      turns: 2
    })
    expect(usage.lastTurn?.total).toBe(16766)
  })

  it('rien d’affiché sans données', () => {
    expect(hasUsage(undefined)).toBe(false)
    expect(hasUsage({})).toBe(false)
    expect(hasUsage({ context: { used: 1, size: 2 } })).toBe(true)
  })

  it('formatage : jetons, devise ISO, devise libre (bobcoins)', () => {
    const nbsp = (s: string) => s.replace(/[  ]/g, ' ')
    expect(nbsp(formatTokens(16748))).toBe('16 748')
    // Compact dès 1 000 (fiche 166) : une décimale au plus, sans espace avant l'unité.
    expect(formatTokens(733, true)).toBe('733')
    expect(formatTokens(1000, true)).toBe('1k')
    expect(formatTokens(4049, true)).toBe('4k')
    expect(formatTokens(1234, true)).toBe('1,2k')
    expect(formatTokens(122_900, true)).toBe('122,9k')
    expect(formatTokens(258_400, true)).toBe('258,4k')
    expect(formatTokens(999_960, true)).toBe('1M')
    expect(formatTokens(1_250_000, true)).toBe('1,3M')
    expect(nbsp(formatCost({ amount: 0.0125, currency: 'USD' }))).toBe('0,0125 $US')
    expect(nbsp(formatCost({ amount: 12.5, currency: 'EUR' }))).toBe('12,50 €')
    // Unité libre affichée avec une majuscule (fiche 144) ; la valeur reste `bobcoins`.
    expect(nbsp(formatCost({ amount: 12.5, currency: 'bobcoins' }))).toBe('12,5 Bobcoins')
    expect(unitLabel('bobcoins')).toBe('Bobcoins')
    expect(unitLabel('USD')).toBe('USD')
  })
})

describe('consommation par tour (fiche 109)', () => {
  const usd = (amount: number) => ({ amount, currency: 'USD' })
  const tokens = (input: number, output: number) => ({
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output
  })

  it('comme OpenCode : coût cumulé annoncé pendant le tour, jetons à la fin', () => {
    let usage: ConversationUsage = startTurn({})
    usage = withContext(usage, { used: 900, size: 200000, cost: usd(0.01) })
    usage = endTurn(usage, tokens(800, 100), 1000)
    usage = startTurn(usage)
    usage = withContext(usage, { used: 1900, size: 200000, cost: usd(0.025) })
    usage = endTurn(usage, tokens(1700, 200), 2000)
    expect(usage.turns).toEqual([
      { at: 1000, input: 800, output: 100, total: 900, costEnd: 0.01 },
      { at: 2000, input: 1700, output: 200, total: 1900, costStart: 0.01, costEnd: 0.025 }
    ])
    expect(usage.turns?.map(turnCost)).toEqual([0.01, 0.015])
    expect(usage.pending).toBeUndefined()
    expect(turnAverages(usage.turns ?? [])).toEqual({ tokens: 1400, cost: 0.0125 })
  })

  it('modèle, cache et réflexion gardés par tour (fiche 130)', () => {
    const rapide = { id: 'factice-rapide', name: 'Factice rapide' }
    const precis = { id: 'factice-precis', name: 'Factice précis' }
    let usage: ConversationUsage = startTurn({}, rapide)
    usage = endTurn(
      usage,
      { ...tokens(800, 100), cachedReadTokens: 500, cachedWriteTokens: 20, thoughtTokens: 40 },
      1000
    )
    usage = startTurn(usage, precis)
    usage = endTurn(usage, tokens(10, 5), 2000)
    // Tour en échec : son modèle reste, sans jetons.
    usage = endTurn(startTurn(usage, rapide))
    expect(usage.turns).toEqual([
      {
        at: 1000,
        model: rapide,
        input: 800,
        output: 100,
        cachedRead: 500,
        cachedWrite: 20,
        thought: 40,
        total: 900
      },
      { at: 2000, model: precis, input: 10, output: 5, total: 15 },
      { model: rapide }
    ])
  })

  it('comme Bob : rien par ACP, coût lu après la fin du tour, rendu au tour qui vient de finir', () => {
    const bob = (amount: number) => ({ amount, currency: 'bobcoins' })
    let usage = withCost({}, bob(0.05)) // Relu à l'ouverture d'une conversation ancienne.
    usage = startTurn(usage)
    usage = endTurn(usage, undefined, 1000)
    usage = withCost(usage, bob(0.071)) // Juste après la réponse.
    usage = withCost(usage, bob(0.0712)) // 1,5 s plus tard.
    usage = startTurn(usage)
    // Pendant le tour suivant : le coût ne revient plus au tour fini.
    usage = withCost(usage, bob(0.08))
    expect(usage.turns).toEqual([{ at: 1000, costStart: 0.05, costEnd: 0.0712 }])
    usage = endTurn(usage, undefined, 2000)
    expect(usage.turns?.map(turnCost)).toEqual([0.0212, 0.0088])
    expect(usage.tokens).toBeUndefined()
    expect(usageDigest(usage)).toEqual({ turns: 2, cost: bob(0.08) })
  })

  it('agent sans coût : jetons par tour, pas de coût ; tour en échec compté sans jetons', () => {
    let usage = endTurn(startTurn({}), tokens(10, 5), 1)
    usage = endTurn(startTurn(usage))
    expect(usage.turns).toEqual([{ at: 1, input: 10, output: 5, total: 15 }, {}])
    expect(usage.turns?.map(turnCost)).toEqual([undefined, undefined])
    expect(turnAverages(usage.turns ?? [])).toEqual({ tokens: 15 })
  })

  it('coût cumulé qui redescend (nouvelle session de l’agent) : pas de coût négatif', () => {
    expect(turnCost({ costStart: 0.5, costEnd: 0.1 })).toBeUndefined()
  })

  it(`${MAX_TURNS} tours gardés au plus, le cumul continue`, () => {
    let usage: ConversationUsage = {}
    for (let i = 0; i < MAX_TURNS + 5; i++) usage = endTurn(startTurn(usage), tokens(1, 1), i)
    expect(usage.turns).toHaveLength(MAX_TURNS)
    expect(usage.turns?.[0]?.at).toBe(5)
    expect(usage.tokens?.turns).toBe(MAX_TURNS + 5)
  })

  it('résumé pour l’index : jetons, échanges, coût ; vérifié à la relecture', () => {
    const usage = withCost(addTurn({}, tokens(100, 20)), usd(0.2))
    const digest = usageDigest(usage)
    expect(digest).toEqual({ input: 100, output: 20, total: 120, turns: 1, cost: usd(0.2) })
    expect(usageDigest({ context: { used: 1, size: 2 } })).toBeUndefined()
    expect(parseUsageDigest(JSON.parse(JSON.stringify(digest)))).toEqual(digest)
    expect(parseUsageDigest({ input: -1, total: 'x', cost: { amount: 1 } })).toBeUndefined()
    expect(parseUsageDigest({ total: 5, cost: { amount: 'x', currency: 'USD' } })).toEqual({
      total: 5
    })
    expect(parseUsageDigest(null)).toBeUndefined()
  })

  it('total des résumés des filles : même unité seulement (fiche 117)', () => {
    expect(
      digestsTotal([{ cost: usd(0.0125) }, undefined, { turns: 2, cost: usd(0.025) }])
    ).toEqual(usd(0.0375))
    expect(digestsTotal([{ cost: usd(1) }, { cost: { amount: 1, currency: 'bobcoins' } }])).toBe(
      undefined
    )
    // Une fille qui n'a que ses jetons : pas de total partiel.
    expect(digestsTotal([{ cost: usd(1) }, { total: 31_000 }])).toBeUndefined()
    expect(digestsTotal([undefined, { total: 5 }])).toBeUndefined()
    expect(digestsTotal([])).toBeUndefined()
  })

  it('jetons estimés d’un texte : environ 4 caractères par jeton', () => {
    expect(estimateTokens('x'.repeat(400))).toBe(100)
    expect(estimateTokens('')).toBe(0)
  })
})

describe('consommation sans montant (fiche 159)', () => {
  it('retire le coût de la session et des tours, garde jetons et contexte', () => {
    const usage: ConversationUsage = {
      context: { used: 10, size: 100 },
      cost: { amount: 1.5, currency: 'USD' },
      tokens: {
        input: 1,
        output: 2,
        cachedRead: 0,
        cachedWrite: 0,
        thought: 0,
        total: 3,
        turns: 2
      },
      pending: { costStart: 1 },
      turns: [
        { total: 3, costStart: 0, costEnd: 1.5 },
        { costStart: 1.5, costEnd: 2 }
      ]
    }
    const shown = withoutCost(usage)
    expect(shown).toEqual({
      context: { used: 10, size: 100 },
      tokens: usage.tokens,
      turns: [{ total: 3 }]
    })
    expect(hasUsage(shown)).toBe(true)
    expect(hasUsage(withoutCost({ cost: { amount: 1, currency: 'USD' } }))).toBe(false)
  })
})

describe('coût de toute la conversation (fiche 164)', () => {
  const bob = (amount: number) => ({ amount, currency: 'bobcoins' })

  it('sessions successives : total dans la devise actuelle, « cette session » à part', () => {
    const first = nextSession({ cost: bob(1.5), context: { used: 10, size: 100 } })
    expect(first).toEqual({ earlier: { bobcoins: 1.5 } })
    const second = nextSession({ ...first, cost: bob(0.5) })
    expect(second).toEqual({ earlier: { bobcoins: 2 } })
    const now: ConversationUsage = { ...second, cost: bob(0.25) }
    expect(conversationCost(now)).toEqual({ total: bob(2.25), session: bob(0.25), others: [] })
    expect(usageDigest(now)?.cost).toEqual(bob(2.25))
  })

  it('juste après le changement : le total des précédentes, sans « cette session »', () => {
    const usage = nextSession({ cost: bob(1.5) })
    expect(conversationCost(usage)).toEqual({ total: bob(1.5), others: [] })
    expect(hasUsage(usage)).toBe(true)
    expect(usageDigest(usage)).toEqual({ cost: bob(1.5) })
  })

  it('autre agent, autre devise : montrée à part, jamais additionnée', () => {
    const usage: ConversationUsage = {
      ...nextSession({ cost: bob(1.5) }),
      cost: { amount: 0.02, currency: 'USD' }
    }
    expect(conversationCost(usage)).toEqual({
      total: { amount: 0.02, currency: 'USD' },
      others: [bob(1.5)]
    })
  })

  it('sans coût nulle part : rien ; mode présentation : aucun montant', () => {
    expect(conversationCost(undefined)).toEqual({ others: [] })
    expect(nextSession({ context: { used: 1, size: 2 } })).toBeUndefined()
    expect(hasUsage(withoutCost({ earlier: { bobcoins: 1 } }))).toBe(false)
  })
})
