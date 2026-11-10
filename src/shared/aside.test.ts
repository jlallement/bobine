import { describe, expect, it } from 'vitest'
import { stripAppContext } from './app-context'
import {
  asideContext,
  asideExcerpt,
  asideQuote,
  ASIDE_CONTEXT_CHARS,
  estimatedTokens
} from './aside'
import { reduceTranscript, type TranscriptItem } from './transcript'
import { conversationCost } from './usage'

describe('aparté (fiche 180)', () => {
  it('consigne de lecture seule, après la question ; fin du fil seulement si demandée', () => {
    const bare = asideContext()
    expect(bare.startsWith('<bobine_aside>')).toBe(true)
    expect(bare).toContain('Read only')
    expect(bare).not.toContain('<main_conversation>')
    const withThread = asideContext('User: Bonjour')
    expect(withThread).toContain('<main_conversation>\nUser: Bonjour\n</main_conversation>')
    // Un titre d'agent qui reprendrait la consigne est coupé avant elle (fiche 125).
    expect(stripAppContext(`Quel flag ? ${bare}`)).toBe('Quel flag ?')
  })

  it('fin du fil bornée, estimation en jetons', () => {
    const long = 'x'.repeat(ASIDE_CONTEXT_CHARS * 2)
    const items: TranscriptItem[] = [{ kind: 'user', id: 1, text: long }]
    const excerpt = asideExcerpt(items)
    expect(excerpt.length).toBeLessThan(ASIDE_CONTEXT_CHARS + 100)
    expect(excerpt.startsWith('[… earlier part omitted …]')).toBe(true)
    expect(asideExcerpt([])).toBe('')
    expect(estimatedTokens('abcdefgh')).toBe(2)
  })

  it('« Ajouter au fil » : question et réponse en citation', () => {
    expect(asideQuote('Aparté', { question: 'Quel flag ?', answer: '`--trust`\n\nVoilà.' })).toBe(
      '> **Aparté** — Quel flag ?\n>\n> `--trust`\n>\n> Voilà.\n'
    )
  })

  it('coût de l’aparté compté dans la conversation, comme une session précédente (fiche 164)', () => {
    let state = reduceTranscript(
      { items: [], nextId: 1 },
      { type: 'usage-report', cost: { amount: 0.5, currency: 'USD' } }
    )
    state = reduceTranscript(state, { type: 'aside-cost', cost: { amount: 0.25, currency: 'USD' } })
    expect(state.items).toEqual([])
    expect(conversationCost(state.usage).total).toEqual({ amount: 0.75, currency: 'USD' })
    state = reduceTranscript(state, { type: 'aside-cost', cost: { amount: 0.25, currency: 'USD' } })
    expect(conversationCost(state.usage).total?.amount).toBe(1)
  })
})
