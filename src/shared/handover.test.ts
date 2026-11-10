import { describe, expect, it } from 'vitest'
import { conversationText, inheritedTranscript } from './branch'
import {
  handoverContext,
  handoverMessageCount,
  handoverName,
  lastHandoverIndex,
  sinceLastHandover
} from './handover'
import { reduceTranscript, type TranscriptItem, type TranscriptState } from './transcript'

const user = (id: number, text: string): TranscriptItem => ({ kind: 'user', id, text })
const agent = (id: number, text: string): TranscriptItem => ({ kind: 'agent', id, text })
const handover = (id: number, model?: string): TranscriptItem => ({
  kind: 'handover',
  id,
  from: { profileId: 'bob', label: 'IBM Bob' },
  to: { profileId: 'opencode', label: 'OpenCode' },
  ...(model ? { model } : {})
})

describe('continuer avec un autre agent (fiche 108)', () => {
  it('contexte : l’échange d’avant la bascule, tant qu’aucun message ne la suit', () => {
    const items = [
      user(1, 'Lis le README'),
      {
        kind: 'tool',
        id: 2,
        toolCallId: 't1',
        title: 'Lecture',
        status: 'completed',
        content: [{ type: 'diff', path: '/p/README.md', oldText: 'a', newText: 'b' }],
        locations: []
      },
      agent(3, 'C’est fait.'),
      handover(4, 'llmaas/Qwen3 32B')
    ] satisfies TranscriptItem[]
    const context = handoverContext(items)
    expect(context).toContain('started with another assistant (IBM Bob)')
    expect(context).toContain('User: Lis le README')
    expect(context).toContain('(assistant used a tool: Lecture — completed — files: /p/README.md)')
    expect(context).toContain('Assistant: C’est fait.')
    // Joint après le message (fiche 125) : il le désigne au-dessus.
    expect(context).toContain('my new\nmessage is above')
    expect(context?.trimEnd().endsWith('</earlier_conversation>')).toBe(true)
    // Une fois le premier message parti, plus rien.
    expect(handoverContext([...items, user(5, 'Suite')])).toBeUndefined()
    expect(handoverContext([user(1, 'Un'), agent(2, 'A')])).toBeUndefined()
  })

  it('deux bascules : tout l’échange part, la première bascule y est dite', () => {
    const items = [user(1, 'Un'), handover(2), user(3, 'Deux'), agent(4, 'B'), handover(5)]
    const context = handoverContext(items) ?? ''
    expect(context).toContain('User: Un')
    expect(context).toContain('(conversation continued with another assistant: OpenCode)')
    expect(context).toContain('User: Deux')
    expect(lastHandoverIndex(items)).toBe(4)
    expect(sinceLastHandover(items)).toEqual([])
    expect(sinceLastHandover([...items, user(6, 'Trois')])).toEqual([user(6, 'Trois')])
  })

  it('messages comptés et nom affiché', () => {
    expect(handoverMessageCount([user(1, 'a'), agent(2, 'b'), handover(3), user(4, 'c')])).toBe(3)
    expect(handoverName({ to: { profileId: 'o', label: 'OpenCode' } })).toBe('OpenCode')
    expect(
      handoverName({ to: { profileId: 'o', label: 'OpenCode' }, model: 'LLMaaS/Qwen3 32B' })
    ).toBe('OpenCode · Qwen3 32B')
  })

  it('le fil garde la bascule ; la session d’avant repart de zéro, son coût est gardé (fiche 164)', () => {
    const state: TranscriptState = {
      items: [user(1, 'Un')],
      nextId: 2,
      usage: { cost: { amount: 1.5, currency: 'bobcoins' }, context: { used: 10, size: 100 } }
    }
    const next = reduceTranscript(state, {
      type: 'handover',
      handover: {
        from: { profileId: 'bob', label: 'IBM Bob' },
        to: { profileId: 'opencode', label: 'OpenCode' }
      }
    })
    expect(next.items.map((i) => i.kind)).toEqual(['user', 'handover'])
    expect(next.usage).toEqual({ earlier: { bobcoins: 1.5 } })
    const empty = reduceTranscript(
      { items: [user(1, 'Un')], nextId: 2, usage: { context: { used: 10, size: 100 } } },
      {
        type: 'handover',
        handover: {
          from: { profileId: 'bob', label: 'IBM Bob' },
          to: { profileId: 'bob', label: 'IBM Bob' }
        }
      }
    )
    expect(empty.usage).toBeUndefined()
  })

  it('branche juste après une bascule : la bascule n’est pas reprise (le contexte part une fois)', () => {
    const state: TranscriptState = {
      items: [user(1, 'Un'), agent(2, 'A'), handover(3), user(4, 'Deux')],
      nextId: 5
    }
    // Repartir du premier message après la bascule (position 3).
    expect(inheritedTranscript(state, 3).items.map((i) => i.kind)).toEqual(['user', 'agent'])
    // Plus loin, la bascule reste où elle est.
    const later = { items: [...state.items, agent(5, 'B'), user(6, 'Trois')], nextId: 7 }
    expect(inheritedTranscript(later, 5).items.map((i) => i.kind)).toEqual([
      'user',
      'agent',
      'handover',
      'user',
      'agent'
    ])
  })
})

describe('session neuve du même agent (ADR-0030)', () => {
  const same = { profileId: 'custom-acme', label: 'Acme' }
  const renewal = (reason: 'no-resume' | 'session-lost') => ({ from: same, to: same, reason })
  const start = (items: TranscriptItem[]): TranscriptState => ({ items, nextId: items.length + 1 })

  it('contexte joint au prochain message, dit comme une session d’avant', () => {
    const items: TranscriptItem[] = [
      user(1, 'Lis le README'),
      agent(2, 'C’est fait.'),
      { kind: 'handover', id: 3, ...renewal('no-resume') }
    ]
    const context = handoverContext(items)
    expect(context).toContain('started in an earlier session of yours that could not be resumed')
    expect(context).not.toContain('another assistant')
    expect(context).toContain('User: Lis le README')
    expect(handoverContext([...items, user(4, 'Suite')])).toBeUndefined()
  })

  it('pas de second repère tant qu’aucun message ne suit le premier', () => {
    const event = { type: 'handover', handover: renewal('no-resume') } as const
    const once = reduceTranscript(start([user(1, 'Q'), agent(2, 'R')]), event)
    const twice = reduceTranscript(once, { ...event, handover: renewal('session-lost') })
    expect(twice.items.map((i) => i.kind)).toEqual(['user', 'agent', 'handover'])
    const after = reduceTranscript(start([...twice.items, user(4, 'Suite'), agent(5, 'Ok')]), event)
    expect(after.items.filter((i) => i.kind === 'handover')).toHaveLength(2)
    // Une bascule choisie par l'utilisateur n'est jamais écartée.
    const switched = reduceTranscript(twice, {
      type: 'handover',
      handover: { from: same, to: { profileId: 'bob', label: 'IBM Bob' } }
    })
    expect(switched.items.filter((i) => i.kind === 'handover')).toHaveLength(2)
  })

  it('branche : la session neuve est dite comme telle', () => {
    const items: TranscriptItem[] = [
      user(1, 'Q'),
      agent(2, 'R'),
      { kind: 'handover', id: 3, ...renewal('session-lost') },
      user(4, 'Q2'),
      agent(5, 'R2')
    ]
    const text = conversationText(items)
    expect(text).toContain('(conversation continued in a new session of the same assistant)')
    expect(text).not.toContain('another assistant')
  })
})
