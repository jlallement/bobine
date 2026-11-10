import { describe, expect, it } from 'vitest'
import type { AgentEvent } from './agent'
import {
  branchContext,
  branchPoint,
  commandsSince,
  fileChangesSince,
  inheritedTranscript,
  MAX_CONTEXT_CHARS,
  undoEdits
} from './branch'
import { emptyTranscript, reduceTranscript, type TranscriptState } from './transcript'

const text = (t: string): AgentEvent => ({
  type: 'update',
  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: t } }
})
const edit = (id: string, path: string, oldText: string | null, newText: string): AgentEvent => ({
  type: 'update',
  update: {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: `Écrire ${path}`,
    kind: 'edit',
    status: 'completed',
    content: [{ type: 'diff', path, oldText, newText }]
  }
})
const end: AgentEvent = { type: 'turn-end', stopReason: 'end_turn' }
const build = (...events: AgentEvent[]): TranscriptState =>
  events.reduce(reduceTranscript, emptyTranscript)

describe('branche (fiche 023)', () => {
  const state = build(
    { type: 'user-message', text: 'Je m’appelle Léa.' },
    text('Enchanté, Léa.'),
    end,
    { type: 'user-message', text: 'Crée a.txt' },
    edit('e1', '/p/a.txt', null, 'un'),
    edit('e2', '/p/b.txt', 'B0', 'B1'),
    {
      type: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'x1',
        title: 'npm test',
        kind: 'execute',
        status: 'completed'
      }
    },
    end,
    { type: 'user-message', text: 'Change a.txt' },
    edit('e3', '/p/a.txt', 'un', 'deux'),
    {
      type: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'e4',
        title: 'Écrire c.txt',
        kind: 'edit',
        status: 'failed',
        content: [{ type: 'diff', path: '/p/c.txt', oldText: null, newText: 'jamais écrit' }]
      }
    },
    end
  )
  const second = state.items.filter((i) => i.kind === 'user')[1]

  it('point de départ : un message de l’utilisateur seulement', () => {
    expect(branchPoint(state.items, second?.id ?? -1)?.index).toBe(2)
    expect(branchPoint(state.items, state.items[1]?.id ?? -1)).toBeUndefined()
  })

  it('échange repris : ce qui précède, numérotation continue', () => {
    const point = branchPoint(state.items, second?.id ?? -1)
    const inherited = inheritedTranscript(state, point?.index ?? 0)
    expect(inherited.items.map((i) => i.kind)).toEqual(['user', 'agent'])
    expect(inherited.nextId).toBe(state.nextId)
  })

  it('contexte : messages et outils résumés, consignes, bornes de taille', () => {
    const context = branchContext(state.items.slice(0, 7), { filesRestored: true })
    expect(context).toContain('User: Je m’appelle Léa.')
    expect(context).toContain('Assistant: Enchanté, Léa.')
    expect(context).toContain(
      'assistant used a tool: Écrire /p/a.txt — completed — files: /p/a.txt'
    )
    expect(context).toContain('restored to their state at that time')
    // Joint après le message (fiche 125) : il le désigne au-dessus.
    expect(context).toContain('my new message is\nabove')
    expect(context.trimEnd().endsWith('</earlier_conversation>')).toBe(true)
    const long = build(
      ...Array.from({ length: 40 }, (_, i): AgentEvent[] => [
        { type: 'user-message', text: `Question ${i}` },
        text('x'.repeat(5000)),
        end
      ]).flat()
    )
    const clipped = branchContext(long.items)
    expect(clipped.length).toBeLessThan(MAX_CONTEXT_CHARS + 1000)
    expect(clipped).toContain('earlier part of the conversation omitted')
    expect(clipped).toContain('Question 39')
  })

  it('fichiers modifiés depuis : modifications dans l’ordre, outils terminés seuls', () => {
    const point = branchPoint(state.items, second?.id ?? -1)
    expect(fileChangesSince(state.items, point?.index ?? 0)).toEqual([
      {
        path: '/p/a.txt',
        edits: [
          { oldText: null, newText: 'un' },
          { oldText: 'un', newText: 'deux' }
        ]
      },
      { path: '/p/b.txt', edits: [{ oldText: 'B0', newText: 'B1' }] }
    ])
    expect(commandsSince(state.items, point?.index ?? 0)).toBe(1)
    const third = state.items.filter((i) => i.kind === 'user')[2]
    const from = branchPoint(state.items, third?.id ?? -1)?.index ?? 0
    expect(fileChangesSince(state.items, from)).toEqual([
      { path: '/p/a.txt', edits: [{ oldText: 'un', newText: 'deux' }] }
    ])
    expect(commandsSince(state.items, from)).toBe(0)
  })

  it('défaire les modifications : diff complet, extrait, création, conflit', () => {
    expect(undoEdits('deux', [{ oldText: 'un', newText: 'deux' }])).toEqual({ content: 'un' })
    expect(undoEdits('a deux b', [{ oldText: 'un', newText: 'deux' }])).toEqual({
      content: 'a un b'
    })
    expect(
      undoEdits('deux', [
        { oldText: '', newText: 'un' },
        { oldText: 'un', newText: 'deux' }
      ])
    ).toEqual({ deleted: true })
    expect(undoEdits('autre chose', [{ oldText: 'un', newText: 'deux' }])).toBeUndefined()
    expect(undoEdits(null, [{ oldText: 'un', newText: 'deux' }])).toBeUndefined()
    // `$&` dans le texte d'origine : remis tel quel (pas de motif de remplacement).
    expect(undoEdits('x B y', [{ oldText: '$& A', newText: 'B' }])).toEqual({ content: 'x $& A y' })
  })
})
