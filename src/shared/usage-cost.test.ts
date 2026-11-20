/**
 * Coût d'une carte (fiche 266, D12) : gratuit, abonnement, non communiqué, payant. Un modèle payant
 * n'est jamais présenté comme gratuit ; un coût nul n'est jamais « ≈ 0,00 $US ».
 */
import { describe, expect, it } from 'vitest'
import {
  costNotReported,
  costText,
  digestsFree,
  formatEstimate,
  freeModels,
  isFreeModel,
  parseUsageDigest,
  usageDigest,
  type ConversationUsage
} from './usage'

const FREE = { id: 'opencode/tidepool-alpha-free', name: 'Tidepool Alpha Free' }
const PAID = { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol' }
const usd = (amount: number) => ({ amount, currency: 'USD' })
const withTurns = (cost: number, ...models: { id: string; name: string }[]): ConversationUsage => ({
  cost: usd(cost),
  turns: models.map((model) => ({ model, costStart: 0, costEnd: cost }))
})

describe('modèle gratuit (heuristique de la fiche 265, partagée)', () => {
  it('« free » dans le nom ou l’identifiant, jamais dans un mot', () => {
    expect(isFreeModel({ value: FREE.id, name: FREE.name })).toBe(true)
    expect(isFreeModel({ value: 'x:free', name: 'X' })).toBe(true)
    expect(isFreeModel({ value: PAID.id, name: PAID.name })).toBe(false)
    expect(isFreeModel({ value: 'freestyle', name: 'Freestyle' })).toBe(false)
    // Revue QA : « free » en fin de nom ou d'identifiant seulement.
    expect(isFreeModel({ value: 'x', name: 'Tidepool Alpha Free' })).toBe(true)
    expect(isFreeModel({ value: 'x', name: 'Modèle (free)' })).toBe(true)
    expect(isFreeModel({ value: 'free-tier-pro', name: 'Free tier pro' })).toBe(false)
    expect(isFreeModel({ value: 'not-free', name: 'X' })).toBe(false)
    expect(isFreeModel({ value: 'non-free', name: 'X' })).toBe(false)
    expect(isFreeModel({ value: 'p/m', name: 'Not free' })).toBe(false)
  })

  it('tous les modèles connus de la conversation, tour en cours compris ; aucun modèle : faux', () => {
    expect(freeModels(withTurns(0, FREE, FREE))).toBe(true)
    expect(freeModels(withTurns(0, FREE, PAID))).toBe(false)
    expect(freeModels({ cost: usd(0) })).toBe(false)
    expect(freeModels({ turns: [{ model: FREE }], pending: { model: PAID } })).toBe(false)
    expect(freeModels(undefined)).toBe(false)
    // Un tour sans modèle connu : pas gratuit (revue QA).
    expect(freeModels({ turns: [{ model: FREE }, { costEnd: 0 }] })).toBe(false)
  })
})

describe('coût affiché (fiche 266)', () => {
  it('gratuit : coût nul d’un modèle qui se dit gratuit', () => {
    expect(costText(usd(0), true)).toBe('gratuit')
    expect(costNotReported(usd(0), true)).toBe(false)
  })

  it('abonnement (OpenCode connecté par abonnement, D12) : coût nul d’un modèle payant → coût inconnu', () => {
    expect(costText(usd(0), false)).toBe('coût inconnu')
    expect(costNotReported(usd(0), false)).toBe(true)
  })

  it('payant : le montant, en estimation', () => {
    expect(costText(usd(0.0123), false)).toBe(formatEstimate(usd(0.0123)))
    expect(costText(usd(0.0123), true)).toBe(formatEstimate(usd(0.0123)))
    expect(formatEstimate(usd(0.0123))).toMatch(/^≈\s0,0123/)
    expect(costNotReported(usd(0.0123), false)).toBe(false)
  })

  it('non communiqué par l’agent (aucun coût) : rien à dire du coût', () => {
    expect(costNotReported(undefined, false)).toBe(false)
  })

  it('unité propre à l’agent (bobcoins de Bob) : son décompte, même à zéro', () => {
    const bob = { amount: 0, currency: 'bobcoins' }
    expect(costText(bob, false)).toBe(formatEstimate(bob))
    expect(costText(bob, false)).toMatch(/^0 Bobcoins?$/)
    expect(costNotReported({ amount: 0, currency: 'bobcoins' }, false)).toBe(false)
  })
})

describe('résumé des conversations : gratuité retenue (fiche 266)', () => {
  it('posée par usageDigest, relue du disque, absente sinon', () => {
    const free = usageDigest(withTurns(0, FREE))
    expect(free?.free).toBe(true)
    expect(usageDigest(withTurns(0, PAID))?.free).toBe(false)
    expect(parseUsageDigest(JSON.parse(JSON.stringify(free)))?.free).toBe(true)
    expect(parseUsageDigest({ cost: usd(0), free: 'yes' })?.free).toBeUndefined()
    expect(parseUsageDigest({ cost: usd(0), free: false })?.free).toBe(false)
  })

  it('total d’une carte : gratuit seulement si chaque travail l’est', () => {
    expect(
      digestsFree([
        { cost: usd(0), free: true },
        { cost: usd(0), free: true }
      ])
    ).toBe(true)
    expect(digestsFree([{ cost: usd(0), free: true }, { cost: usd(0) }])).toBe(false)
    expect(digestsFree([undefined])).toBe(false)
  })
})
