import { describe, expect, it } from 'vitest'
import type { AgentEvent, ConversationSummary, ConversationView } from '@shared/agent'
import { emptyTranscript, reduceTranscript } from '@shared/transcript'
import { reducer, type State } from './useConversations'

const note = (message: string): AgentEvent => ({ type: 'notice', level: 'info', message })
const texts = (state: State) =>
  state.loaded['c1']?.transcript.items.map((i) => ('text' in i ? i.text : i.kind))

/** Vue de la conversation `c1` contenant ces avis, jusqu'à l'évènement `seq`. */
function view(seq: number, ...messages: string[]): ConversationView {
  return {
    summary: { id: 'c1' } as ConversationSummary,
    snapshot: null,
    transcript: messages.map(note).reduce(reduceTranscript, emptyTranscript),
    seq
  }
}

const initial = { activeId: 'c1', loaded: {} } as unknown as State

it('un état initial de préparation tardif ne remplace pas le dernier évènement (fiche 149)', () => {
  const current = { ...initial, childLaunches: { revision: 3, entries: [] } }
  expect(
    reducer(current, {
      type: 'childLaunches',
      launches: { revision: 2, entries: [{ id: 'old', motherId: 'm', title: 'Ancienne' }] }
    })
  ).toBe(current)
  expect(
    reducer(current, {
      type: 'childLaunches',
      launches: { revision: 4, entries: [{ id: 'new', motherId: 'm', title: 'Nouvelle' }] }
    }).childLaunches.entries
  ).toHaveLength(1)
})

it('le lien préparation/conversation survit au dernier évènement, même si React les regroupe', () => {
  const initialLaunches = {
    ...initial,
    childLaunches: { revision: 0, entries: [] },
    childLaunchRows: {}
  }
  const linked = reducer(initialLaunches, {
    type: 'childLaunches',
    launches: {
      revision: 1,
      entries: [{ id: 'a', motherId: 'm', title: 'Import', conversationId: 'real' }]
    }
  })
  const complete = reducer(linked, {
    type: 'childLaunches',
    launches: { revision: 2, entries: [] }
  })
  expect(complete.childLaunchRows).toEqual({ 'child-launch:a': 'real' })
})

describe('vue et évènements d’une conversation (fiche 062)', () => {
  it('un évènement déjà compris dans la vue n’est pas appliqué deux fois', () => {
    let state = reducer(initial, { type: 'view', view: view(2, 'a', 'b') })
    // Arrivé après la vue qui le contenait déjà (voies distinctes).
    state = reducer(state, {
      type: 'event',
      payload: { conversationId: 'c1', event: note('b'), seq: 2 }
    })
    state = reducer(state, {
      type: 'event',
      payload: { conversationId: 'c1', event: note('c'), seq: 3 }
    })
    expect(texts(state)).toEqual(['a', 'b', 'c'])
  })

  it('une vue plus ancienne que ce qui est affiché ne le remplace pas', () => {
    let state = reducer(initial, { type: 'view', view: view(1, 'a') })
    state = reducer(state, {
      type: 'event',
      payload: { conversationId: 'c1', event: note('b'), seq: 2 }
    })
    state = reducer(state, { type: 'view', view: view(1, 'a') })
    expect(texts(state)).toEqual(['a', 'b'])
    // Une vue plus récente, si.
    state = reducer(state, { type: 'view', view: view(3, 'a', 'b', 'c') })
    expect(texts(state)).toEqual(['a', 'b', 'c'])
  })

  it('avis de l’interface (sans numéro) : toujours affiché', () => {
    let state = reducer(initial, { type: 'view', view: view(1, 'a') })
    state = reducer(state, { type: 'notice', message: 'oups' })
    expect(texts(state)).toEqual(['a', 'oups'])
  })
})
