import { describe, expect, it } from 'vitest'
import type { AgentEvent } from './agent'
import type { SessionUpdate } from './acp-sdk.mts'
import { contextBreakdown } from './context-breakdown'
import { emptyTranscript, reduceTranscript, type TranscriptState } from './transcript'

/**
 * Jauge de contexte après un compactage (fiche 257). Séquence réelle d'OpenCode 2.3.0
 * (exploration du 2026-11-19, `agents.log`, deuxième `/compact`) : `usage_update 38271/628000`,
 * puis `/compact` → `compaction_update` `in_progress`, résumé, `completed`, fin de tour **sans
 * `usage` ni `usage_update`** ; au tour suivant, `usage_update 11965/628000`.
 */

const SIZE = 628_000
const x = (n: number) => 'x'.repeat(n)
const update = (u: SessionUpdate): AgentEvent => ({ type: 'update', update: u })
const usage = (used: number): AgentEvent =>
  update({ sessionUpdate: 'usage_update', used, size: SIZE })
const say = (text: string): AgentEvent =>
  update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } })
const end = (stopReason: 'end_turn' | 'cancelled' = 'end_turn'): AgentEvent => ({
  type: 'turn-end',
  stopReason
})
const compact = (status: string, summary?: string): AgentEvent =>
  update({
    sessionUpdate: 'compaction_update',
    compactionId: 'msg_compact',
    status,
    ...(summary !== undefined ? { summary: [{ type: 'text', text: summary }] } : {})
  })
const play = (events: AgentEvent[], from: TranscriptState = emptyTranscript) =>
  events.reduce(reduceTranscript, from)
const lines = (state: TranscriptState, appTools?: number) =>
  Object.fromEntries(
    contextBreakdown({ items: state.items, usage: state.usage, appTools }).lines.map((l) => [
      l.id,
      l.tokens
    ])
  )

/** 10 000 + 20 000 jetons de messages estimés, puis le chiffre de l'agent : 38 271. */
const BEFORE: AgentEvent[] = [
  { type: 'user-message', text: x(40_000) },
  say(x(80_000)),
  usage(38_271),
  end()
]
const SUMMARY = x(6_400) // ≈ 1 600 jetons (résumé de 6,3 Ko de la trace)
const COMPACTION: AgentEvent[] = [
  { type: 'user-message', text: '/compact', compaction: true },
  compact('in_progress'),
  update({
    sessionUpdate: 'compaction_summary_chunk',
    compactionId: 'msg_compact',
    content: { type: 'text', text: SUMMARY }
  }),
  compact('completed', SUMMARY),
  end()
]

describe('compactage sans usage_update (OpenCode 2.3.0, fiche 257)', () => {
  it('total estimé et marqué comme tel, « Agent » inchangé, jamais l’ancien chiffre', () => {
    const before = play(BEFORE)
    expect(lines(before, 5_000)['agent']).toBe(38_271 - 30_000 - 5_000)

    const after = play(COMPACTION, before)
    // Reste (hors messages) = 38 271 − 30 000 ; messages depuis la carte : le résumé (1 600).
    expect(after.usage?.context).toMatchObject({
      used: 8_271 + 1_600,
      size: SIZE,
      estimated: true
    })
    const breakdown = contextBreakdown({ items: after.items, usage: after.usage, appTools: 5_000 })
    expect(breakdown.total).toMatchObject({ used: 9_871, estimated: true })
    // « Agent » garde sa part d'avant : il n'absorbe pas la place libérée.
    expect(lines(after, 5_000)).toMatchObject({
      messages: 1_600,
      bobine: 5_000,
      agent: 38_271 - 30_000 - 5_000,
      free: SIZE - 9_871
    })
    expect(breakdown.lines.every((l) => l.estimated)).toBe(true)
  })

  it('tour suivant : le chiffre de l’agent remplace l’estimation, les messages échangés comptent', () => {
    const next = play(
      [{ type: 'user-message', text: x(4_000) }, say(x(2_000)), usage(11_965), end()],
      play(COMPACTION, play(BEFORE))
    )
    expect(next.usage?.context).toEqual({ used: 11_965, size: SIZE, nextItem: next.nextId })
    // La baisse (9 871 estimés → 11 965, ou 38 271 → 11 965) est expliquée par la compaction :
    // pas de nouveau début de contexte après ce tour (« Messages ≈ 0 »).
    expect(next.usage?.contextSince).toBeUndefined()
    expect(lines(next)['messages']).toBe(1_600 + 1_000 + 500)
    expect(contextBreakdown({ items: next.items, usage: next.usage }).total?.estimated).toBe(
      undefined
    )
  })

  it('baisse expliquée même sans estimation : compaction terminée depuis le chiffre', () => {
    // Chiffre reçu après la commande, avant la carte : gardé (pas d'estimation) ; la baisse
    // suivante vient de cette compaction, les messages échangés depuis restent comptés.
    const state = play(
      [
        { type: 'user-message', text: '/compact', compaction: true },
        usage(30_000),
        compact('completed', SUMMARY),
        end(),
        { type: 'user-message', text: x(400) },
        usage(2_000),
        end()
      ],
      play(BEFORE)
    )
    expect(state.usage?.context?.estimated).toBeUndefined()
    expect(state.usage?.contextSince).toBeUndefined()
    expect(lines(state)['messages']).toBe(1_600 + 100)
  })

  it('compaction échouée puis forte baisse : la règle de la fiche 166 s’applique', () => {
    const state = play(
      [
        { type: 'user-message', text: '/compact', compaction: true },
        compact('failed'),
        end(),
        { type: 'user-message', text: x(400) },
        usage(2_000),
        end()
      ],
      play(BEFORE)
    )
    expect(state.usage?.contextSince).toBe(state.nextId)
  })

  it('un usage_update reçu depuis le début de la compaction est gardé tel quel', () => {
    const state = play(
      [
        { type: 'user-message', text: '/compact', compaction: true },
        compact('in_progress'),
        usage(3_200),
        compact('completed', SUMMARY),
        end()
      ],
      play(BEFORE)
    )
    expect(state.usage?.context).toEqual({
      used: 3_200,
      size: SIZE,
      nextItem: expect.any(Number),
      compactedSince: true
    })
    // Tour suivant : la baisse vient de cette compaction, les messages échangés restent comptés.
    const next = play(
      [{ type: 'user-message', text: x(400) }, say(x(400)), usage(2_000), end()],
      state
    )
    expect(next.usage?.contextSince).toBeUndefined()
    expect(next.usage?.context?.compactedSince).toBeUndefined()
    expect(lines(next)['messages']).toBe(1_600 + 100 + 100)
  })

  it('compaction échouée ou annulée : rien d’estimé, l’ancien chiffre reste', () => {
    for (const status of ['failed', 'cancelled']) {
      const state = play(
        [{ type: 'user-message', text: '/compact', compaction: true }, compact(status), end()],
        play(BEFORE)
      )
      expect(state.usage?.context).toMatchObject({ used: 38_271 })
      expect(state.usage?.context?.estimated).toBeUndefined()
    }
  })

  it('compaction terminée deux fois (mise à jour répétée) : une seule estimation', () => {
    const once = play(COMPACTION, play(BEFORE))
    const twice = play([compact('completed', SUMMARY)], once)
    expect(twice.usage).toEqual(once.usage)
  })

  it('deux compactions de suite sans chiffre entre elles : le reste ne change pas', () => {
    const first = play(COMPACTION, play(BEFORE))
    const second = play(
      [
        { type: 'user-message', text: '/compact', compaction: true },
        update({
          sessionUpdate: 'compaction_update',
          compactionId: 'msg_compact_2',
          status: 'completed',
          summary: [{ type: 'text', text: x(800) }]
        }),
        end()
      ],
      first
    )
    expect(second.usage?.context).toMatchObject({ used: 8_271 + 200, estimated: true })
  })

  it('jamais plus que l’ancien chiffre : estimations des messages plus grandes que lui', () => {
    const state = play(
      [
        { type: 'user-message', text: x(40_000) },
        usage(3_000),
        end(),
        { type: 'user-message', text: '/compact', compaction: true },
        compact('completed', x(40_000)),
        end()
      ],
      emptyTranscript
    )
    expect(state.usage?.context).toMatchObject({ used: 3_000, estimated: true })
  })

  it('chiffre lu avant la fiche 257 (sans repère) : estimé aussi', () => {
    const before = play(BEFORE)
    const old: TranscriptState = {
      ...before,
      usage: { ...before.usage, context: { used: 38_271, size: SIZE } }
    }
    const after = play(COMPACTION, old)
    expect(after.usage?.context).toMatchObject({ used: 9_871, estimated: true })
  })
})

describe('compaction répondue en texte (commande de compaction, fiche 126)', () => {
  const textCompaction = (stopReason: 'end_turn' | 'cancelled'): AgentEvent[] => [
    { type: 'user-message', text: '/compress', compaction: true },
    say(SUMMARY),
    end(stopReason)
  ]

  it('agent qui chiffre son contexte mais pas après le résumé : estimé', () => {
    const state = play(textCompaction('end_turn'), play(BEFORE))
    expect(state.items.at(-1)?.kind).toBe('compaction')
    expect(state.usage?.context).toMatchObject({ used: 8_271 + 1_600, estimated: true })
  })

  it('tour annulé : rien d’estimé', () => {
    const state = play(textCompaction('cancelled'), play(BEFORE))
    expect(state.usage?.context?.estimated).toBeUndefined()
  })

  it('Bob (aucun usage_update) : pas de total, rien d’estimé', () => {
    const state = play(
      textCompaction('end_turn'),
      play([{ type: 'user-message', text: 'a' }, say('b'), end()])
    )
    expect(state.usage?.context).toBeUndefined()
    expect(contextBreakdown({ items: state.items, usage: state.usage }).total).toBeUndefined()
  })
})
