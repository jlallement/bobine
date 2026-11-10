import { describe, expect, it } from 'vitest'
import { markResent, replayTail } from './replay-tail'
import type { TranscriptItem } from './transcript'

const user = (id: number, text: string): TranscriptItem => ({ kind: 'user', id, text })
const agent = (id: number, text: string): TranscriptItem => ({ kind: 'agent', id, text })
const notice = (id: number): TranscriptItem => ({ kind: 'notice', id, level: 'info', text: 'avis' })

describe('replayTail (fil gardé face au rejeu, fiche 103)', () => {
  it('rien à ajouter quand le rejeu ne dépasse pas le fil', () => {
    const stored = [user(1, 'Un'), agent(2, 'A'), notice(3)]
    expect(replayTail(stored, [user(1, 'Un'), agent(2, 'A')])).toEqual([])
    expect(replayTail(stored, [])).toEqual([])
  })

  it('session continuée ailleurs : la fin du rejeu, à partir du premier message inconnu', () => {
    const stored = [user(1, 'Un'), agent(2, 'A'), notice(3)]
    const replayed = [user(1, 'Un'), agent(2, 'A'), user(3, 'Deux'), agent(4, 'B')]
    expect(replayTail(stored, replayed)).toEqual([user(3, 'Deux'), agent(4, 'B')])
  })

  it('fil sans message utilisateur (un avis seul) : tout le rejeu', () => {
    const replayed = [user(1, 'Un'), agent(2, 'A')]
    expect(replayTail([notice(1)], replayed)).toEqual(replayed)
    expect(replayTail([], replayed)).toEqual(replayed)
  })

  it('les éléments du rejeu avant le premier message inconnu ne comptent pas, même différents', () => {
    const stored = [user(1, 'Un'), agent(2, 'A')]
    const replayed = [user(1, 'Un'), agent(2, 'A, refaite autrement'), user(3, 'Deux')]
    expect(replayTail(stored, replayed)).toEqual([user(3, 'Deux')])
  })
})

describe('replayTail après une bascule vers un autre agent (fiche 108)', () => {
  const handover = (id: number): TranscriptItem => ({
    kind: 'handover',
    id,
    from: { profileId: 'bob', label: 'IBM Bob' },
    to: { profileId: 'opencode', label: 'OpenCode' }
  })

  it('seuls comptent les messages de la session en cours, après la dernière bascule', () => {
    const stored = [user(1, 'Un'), agent(2, 'A'), user(3, 'Deux'), handover(4), user(5, 'Trois')]
    // La nouvelle session ne connaît que « Trois » ; elle a continué ailleurs avec « Quatre ».
    const replayed = [user(1, 'Trois'), agent(2, 'C'), user(3, 'Quatre'), agent(4, 'D')]
    expect(replayTail(stored, replayed)).toEqual([user(3, 'Quatre'), agent(4, 'D')])
    expect(replayTail(stored, replayed.slice(0, 2))).toEqual([])
  })

  it('bascule sans message depuis : tout le rejeu de la nouvelle session est nouveau', () => {
    const stored = [user(1, 'Un'), agent(2, 'A'), handover(3)]
    expect(replayTail(stored, [user(1, 'Ailleurs')])).toEqual([user(1, 'Ailleurs')])
  })

  it('message renvoyé après un refus de connexion (D10) : que l’agent l’ait gardé une fois ou deux', () => {
    const state = { items: [user(1, 'Un'), notice(2), agent(3, 'A')], nextId: 4 }
    const stored = markResent(state, false).items
    expect(stored[0]).toMatchObject({ kind: 'user', resent: 1 })
    // Gardé deux fois (refusé puis renvoyé), ou une seule : rien de venu d'ailleurs.
    expect(replayTail(stored, [user(1, 'Un'), user(2, 'Un'), agent(3, 'A')])).toEqual([])
    expect(replayTail(stored, [user(1, 'Un'), agent(2, 'A')])).toEqual([])
    // Un vrai message d'ailleurs, après : ajouté dans les deux cas.
    expect(replayTail(stored, [user(1, 'Un'), user(2, 'Un'), user(3, 'Deux')])).toEqual([
      user(3, 'Deux')
    ])
    expect(replayTail(stored, [user(1, 'Un'), user(2, 'Deux')])).toEqual([user(2, 'Deux')])
    // Sans marque, une répétition reste un tour d'ailleurs.
    expect(replayTail(state.items, [user(1, 'Un'), user(2, 'Un')])).toEqual([user(2, 'Un')])
  })

  it('renvoi dans une session neuve (ADR-0030) : compté sur la bascule, visible une seule fois', () => {
    const handover: TranscriptItem = {
      kind: 'handover',
      id: 3,
      from: { profileId: 'mock', label: 'M' },
      to: { profileId: 'mock', label: 'M' },
      reason: 'no-resume'
    } as TranscriptItem
    const state = { items: [user(1, 'Un'), notice(2), handover], nextId: 4 }
    const stored = markResent(state, true).items
    expect(stored.filter((item) => item.kind === 'user')).toHaveLength(1)
    expect(stored.at(-1)).toMatchObject({ kind: 'handover', resent: 1 })
    // La session neuve ne l'a reçu qu'une fois : rien d'ajouté ; un message d'ailleurs, oui.
    expect(replayTail(stored, [user(1, 'Un'), agent(2, 'A')])).toEqual([])
    expect(replayTail(stored, [user(1, 'Un'), user(2, 'Deux')])).toEqual([user(2, 'Deux')])
  })
})
