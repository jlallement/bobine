import { describe, expect, it } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { agentReplies } from './agent-count'

const agent = (id: number): TranscriptItem => ({ kind: 'agent', id, text: 'r' })
const user = (id: number): TranscriptItem => ({ kind: 'user', id, text: 'q' })

describe('réponses de l’agent comptées par morceaux (fiche 185, P8)', () => {
  it('le fil s’allonge : seul l’ajout est compté ; réécrit ou autre conversation : tout recompté', () => {
    const base = [user(1), agent(2)]
    expect(agentReplies('a', base)).toBe(1)
    expect(agentReplies('a', [...base, user(3), agent(4), agent(5)])).toBe(3)
    // Même longueur, même dernier élément (morceau de réponse) : rien de neuf.
    expect(agentReplies('a', [...base, user(3), agent(4), agent(5)])).toBe(3)
    // Fil réécrit (branche) : recompté.
    expect(agentReplies('a', [user(1), agent(9)])).toBe(1)
    expect(agentReplies('b', [agent(1), agent(2), agent(3)])).toBe(3)
  })
})
