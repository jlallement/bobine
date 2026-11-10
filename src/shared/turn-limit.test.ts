import { describe, expect, it } from 'vitest'
import { exportConversation } from './export'
import type { AgentEvent, ConversationSummary } from './agent'
import { handoverContext } from './handover'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from './transcript'
import { parseTurnLimitAnswer, turnLimitAnswers, turnLimitCard } from './turn-limit'

const run = (events: AgentEvent[]) => events.reduce(reduceTranscript, emptyTranscript)
const send = (text: string): AgentEvent => ({ type: 'user-message', text })
const said = (text: string): AgentEvent => ({
  type: 'update',
  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }
})
const limited = (refused: boolean, reopen: boolean): AgentEvent => ({
  type: 'turn-end',
  stopReason: 'max_turn_requests',
  limit: { refused, reopen }
})
type Card = Extract<TranscriptItem, { kind: 'turn-limit' }>
const cards = (items: TranscriptItem[]) =>
  items.filter((i): i is Extract<TranscriptItem, { kind: 'turn-limit' }> => i.kind === 'turn-limit')

describe('limite d’étapes de l’agent (fiche 209)', () => {
  it('fin en max_turn_requests : une carte à la place de l’avis gris', () => {
    const { items } = run([send('Travaille'), said('Je passe à'), limited(false, false)])
    expect(items.some((i) => i.kind === 'notice')).toBe(false)
    expect(cards(items)).toEqual([{ kind: 'turn-limit', id: 3, refused: false, reopen: false }])
  })

  it('refus sans activité : la carte le dit, avec la réouverture si le main la propose', () => {
    const { items } = run([send('Continue'), limited(true, true)])
    expect(cards(items)[0]).toMatchObject({ refused: true, reopen: true })
    expect(turnLimitAnswers(cards(items)[0] as Card)).toEqual(['reopen', 'renew'])
  })

  it('choix proposés : Continuer après du travail ; après un refus, la réouverture une seule fois', () => {
    expect(turnLimitAnswers(turnLimitCard(undefined))).toEqual(['continue'])
    expect(turnLimitAnswers(turnLimitCard({ refused: false, reopen: true }))).toEqual(['continue'])
    expect(turnLimitAnswers(turnLimitCard({ refused: true, reopen: false }))).toEqual(['renew'])
  })

  it('réponse gardée par la carte ; une seconde réponse, ou une réponse à un autre élément, ignorée', () => {
    const state = run([send('Travaille'), limited(false, false)])
    const id = cards(state.items)[0]?.id ?? -1
    const answered = reduceTranscript(state, {
      type: 'turn-limit-answer',
      itemId: id,
      answer: 'continue'
    })
    expect(cards(answered.items)[0]?.answer).toBe('continue')
    const again = reduceTranscript(answered, {
      type: 'turn-limit-answer',
      itemId: id,
      answer: 'renew'
    })
    expect(again).toBe(answered)
    expect(reduceTranscript(state, { type: 'turn-limit-answer', itemId: 1, answer: 'renew' })).toBe(
      state
    )
  })

  it('un message, une nouvelle carte ou une nouvelle session retirent ses boutons à la carte ouverte', () => {
    const first = run([send('Travaille'), limited(false, false)])
    expect(cards(reduceTranscript(first, send('Autre chose')).items)[0]?.superseded).toBe(true)
    const twice = run([send('Travaille'), limited(false, false), limited(true, true)])
    expect(cards(twice.items).map((c) => c.superseded)).toEqual([true, undefined])
    const agent = { profileId: 'mock', label: 'Agent factice' }
    const renewed = reduceTranscript(first, {
      type: 'handover',
      handover: { from: agent, to: agent, reason: 'turn-limit' }
    })
    expect(cards(renewed.items)[0]?.superseded).toBe(true)
  })

  it('une carte déjà répondue n’est pas « remplacée »', () => {
    const state = run([send('Travaille'), limited(false, false)])
    const id = cards(state.items)[0]?.id ?? -1
    const answered = reduceTranscript(state, {
      type: 'turn-limit-answer',
      itemId: id,
      answer: 'continue'
    })
    const next = reduceTranscript(answered, send('Continue'))
    expect(cards(next.items)[0]).toMatchObject({ answer: 'continue' })
    expect(cards(next.items)[0]?.superseded).toBeUndefined()
  })

  it('session neuve pour cause de limite : le contexte joint dit pourquoi (en anglais)', () => {
    const agent = { profileId: 'mock', label: 'Agent factice' }
    const { items } = run([
      send('Travaille'),
      said('Je passe à'),
      limited(false, false),
      { type: 'handover', handover: { from: agent, to: agent, reason: 'turn-limit' } }
    ])
    const context = handoverContext(items)
    expect(context).toContain('that had reached its step limit')
    expect(context).toContain('Travaille')
  })

  it('export : une ligne selon le cas', () => {
    const transcript = run([
      send('Travaille'),
      limited(false, false),
      send('Go'),
      limited(true, false)
    ])
    const summary = { title: 'T', profileLabel: 'A', workspace: '/w', updatedAt: '' }
    const text = exportConversation(summary as ConversationSummary, transcript, 'markdown')
    expect(text).toContain('nombre maximal d’étapes')
    expect(text).toContain('a refusé de continuer')
  })

  it('réponse lue d’un appel IPC : seulement les trois connues', () => {
    expect(parseTurnLimitAnswer('reopen')).toBe('reopen')
    expect(() => parseTurnLimitAnswer('stop')).toThrow()
  })
})
