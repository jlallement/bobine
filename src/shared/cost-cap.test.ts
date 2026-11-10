import { describe, expect, it } from 'vitest'
import {
  capDecision,
  capReached,
  capUnitOf,
  effectiveCap,
  nextCap,
  parseConversationCap,
  spentIn,
  toolRunning,
  TOKEN_UNIT,
  type CapPreferences
} from './cost-cap'
import { emptyTranscript, reduceTranscript, type TranscriptState } from './transcript'
import type { AgentEvent } from './agent'
import type { ConversationUsage } from './usage'

const on: CapPreferences = { costCapEnabled: true, costCapAmount: 1, costCapTokens: 1000 }
const off: CapPreferences = { ...on, costCapEnabled: false }
const usd = (amount: number): ConversationUsage => ({ cost: { amount, currency: 'USD' } })
const tokens = (total: number): ConversationUsage => ({
  tokens: { input: 0, output: 0, cachedRead: 0, cachedWrite: 0, thought: 0, total, turns: 1 }
})

const user = { kind: 'user', id: 1 }
const tool = (status: string, extra: object = {}) => ({ kind: 'tool', id: 2, status, ...extra })

describe('plafond de coût (fiche 157)', () => {
  it('unité : la devise du coût, sinon les jetons, sinon rien', () => {
    expect(capUnitOf(usd(1))).toBe('USD')
    expect(capUnitOf({ cost: { amount: 1, currency: 'bobcoins' }, ...tokens(5) })).toBe('bobcoins')
    expect(capUnitOf(tokens(5))).toBe(TOKEN_UNIT)
    expect(capUnitOf({})).toBeUndefined()
    expect(spentIn(usd(0.4), 'USD')).toBe(0.4)
    expect(spentIn(usd(0.4), 'bobcoins')).toBeUndefined()
    expect(spentIn(tokens(800), TOKEN_UNIT)).toBe(800)
  })

  it('toute la conversation : sessions précédentes comprises, même devise seulement (fiche 164)', () => {
    const earlier = { earlier: { bobcoins: 1.5, USD: 3 } }
    expect(capUnitOf(earlier)).toBe('bobcoins')
    expect(spentIn(earlier, 'bobcoins')).toBe(1.5)
    expect(spentIn({ ...earlier, cost: { amount: 0.5, currency: 'bobcoins' } }, 'bobcoins')).toBe(2)
    expect(
      spentIn({ ...earlier, cost: { amount: 0.5, currency: 'bobcoins' } }, 'USD')
    ).toBeUndefined()
  })

  it('plafond en vigueur : le sien dans son unité, sinon les montants des réglages ; aucun sans rien de posé', () => {
    // Conversation d'avant, ou créée réglage désactivé : aucun plafond, même activé depuis.
    expect(effectiveCap(undefined, on, usd(0))).toBeUndefined()
    expect(effectiveCap('settings', on, usd(0))).toEqual({ limit: 1, unit: 'USD' })
    expect(effectiveCap('settings', off, tokens(0))).toEqual({ limit: 1000, unit: TOKEN_UNIT })
    expect(effectiveCap({ limit: 3, unit: 'USD' }, off, usd(0))).toEqual({ limit: 3, unit: 'USD' })
    // Plafond posé en jetons, puis le coût est connu : les montants des réglages, dans la nouvelle unité.
    expect(effectiveCap({ limit: 3, unit: TOKEN_UNIT }, on, usd(0))).toEqual({
      limit: 1,
      unit: 'USD'
    })
    expect(effectiveCap('none', on, usd(5))).toBeUndefined()
    expect(effectiveCap('settings', on, {})).toBeUndefined()
  })

  it('décision : attendre la fin de l’outil, interrompre, demander, une carte par tour', () => {
    const base = { usage: usd(1.2), costCap: 'settings' as const }
    expect(capDecision({ ...base, items: [user, tool('in_progress')] }, on, true)).toEqual({
      kind: 'wait'
    })
    expect(capDecision({ ...base, items: [user, tool('completed')] }, on, true)).toEqual({
      kind: 'interrupt',
      cap: { limit: 1, unit: 'USD' },
      spent: 1.2
    })
    expect(capDecision({ ...base, items: [user] }, on, false).kind).toBe('ask')
    // Sous le plafond, ou carte déjà posée dans ce tour : rien.
    expect(capDecision({ ...base, usage: usd(0.9), items: [user] }, on, true).kind).toBe('none')
    const asked = { kind: 'cost-cap', limit: 1, unit: 'USD' }
    expect(capDecision({ ...base, items: [user, asked] }, on, false).kind).toBe('none')
    // Carte d'un tour d'avant : on redemande.
    expect(capDecision({ ...base, items: [asked, user] }, on, false).kind).toBe('ask')
    expect(capDecision({ ...base, items: [user], costCap: 'none' }, on, true).kind).toBe('none')
    expect(capReached({ usage: usd(1.2), costCap: 'settings' }, on)).toEqual({
      cap: { limit: 1, unit: 'USD' },
      spent: 1.2
    })
    expect(capReached({ usage: usd(0.5), costCap: 'settings' }, on)).toBeUndefined()
  })

  it('outil en cours : pas celui qui attend une autorisation, ni un sous-agent en arrière-plan', () => {
    expect(toolRunning([user, tool('pending')])).toBe(true)
    expect(toolRunning([tool('in_progress'), user])).toBe(false)
    expect(toolRunning([user, tool('in_progress', { permission: { state: 'pending' } })])).toBe(
      false
    )
    expect(toolRunning([user, tool('in_progress', { subagentRun: { background: true } })])).toBe(
      false
    )
  })

  it('« Continuer » : un pas de plus, au-delà de la dépense', () => {
    expect(nextCap({ limit: 1, unit: 'USD' }, 1.2, 1)).toEqual({ limit: 2, unit: 'USD' })
    expect(nextCap({ limit: 1, unit: 'USD' }, 3.5, 1)).toEqual({ limit: 4, unit: 'USD' })
    expect(nextCap({ limit: 1000, unit: TOKEN_UNIT }, 1200, 1000).limit).toBe(2000)
  })

  it('plafond reçu par IPC : vérifié', () => {
    expect(parseConversationCap({ limit: 2.5, unit: 'bobcoins' })).toEqual({
      limit: 2.5,
      unit: 'bobcoins'
    })
    expect(parseConversationCap('none')).toBe('none')
    expect(parseConversationCap('settings')).toBe('settings')
    expect(parseConversationCap(null)).toBeNull()
    expect(() => parseConversationCap({ limit: -1, unit: 'USD' })).toThrow('cap')
    expect(() => parseConversationCap({ limit: 1, unit: '../x' })).toThrow('cap')
  })

  it('dans le fil : plafond posé, carte, réponse ; le plafond survit au rejeu', () => {
    const events: AgentEvent[] = [
      { type: 'cost-cap-set', cap: { limit: 2, unit: 'USD' } },
      {
        type: 'cost-cap-reached',
        reached: { limit: 2, unit: 'USD', spent: 2.1, step: 1, interrupted: true }
      }
    ]
    let state: TranscriptState = events.reduce(reduceTranscript, emptyTranscript)
    expect(state.costCap).toEqual({ limit: 2, unit: 'USD' })
    const card = state.items.at(-1)
    expect(card).toMatchObject({ kind: 'cost-cap', spent: 2.1, interrupted: true })
    state = reduceTranscript(state, {
      type: 'cost-cap-answer',
      itemId: card?.id ?? 0,
      answer: 'continue',
      raisedTo: 3
    })
    expect(state.items.at(-1)).toMatchObject({ answer: 'continue', raisedTo: 3 })
    // Une seconde réponse ne remplace pas la première.
    state = reduceTranscript(state, {
      type: 'cost-cap-answer',
      itemId: card?.id ?? 0,
      answer: 'stop'
    })
    expect(state.items.at(-1)).toMatchObject({ answer: 'continue' })
    // Nouvelle carte : la précédente restée sans réponse n'a plus de boutons.
    const twice = [1, 2].reduce(
      (acc: TranscriptState) =>
        reduceTranscript(acc, {
          type: 'cost-cap-reached',
          reached: {
            limit: 2,
            unit: 'USD',
            spent: 2.1,
            step: 1,
            interrupted: false,
            held: 'Encore'
          }
        }),
      state
    )
    const cards = twice.items.filter((i) => i.kind === 'cost-cap')
    expect(cards.map((c) => (c.kind === 'cost-cap' ? !!c.superseded : null))).toEqual([
      false,
      true,
      false
    ])
    expect(reduceTranscript(state, { type: 'reset' }).costCap).toEqual({ limit: 2, unit: 'USD' })
    expect(reduceTranscript(state, { type: 'cost-cap-set', cap: null }).costCap).toBeUndefined()
  })
})
