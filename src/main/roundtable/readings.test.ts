import { describe, expect, it } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { lastTurnDigest, opinionInputs, reportReply, stepReply } from './readings'

describe('ce que le tour de table relit (fiche 285)', () => {
  it('réponse à une demande du tour : jusqu’au message suivant', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Bonjour' },
      { kind: 'agent', id: 2, text: 'Salut' },
      {
        kind: 'user',
        id: 3,
        text: 'x',
        from: { kind: 'roundtable', id: 'rt', title: 'Q', step: 'synthesis' }
      },
      { kind: 'agent', id: 4, text: 'Partie 1' },
      { kind: 'agent', id: 5, text: 'Partie 2' },
      { kind: 'user', id: 6, text: 'Autre' },
      { kind: 'agent', id: 7, text: 'Pas la synthèse' }
    ]
    expect(stepReply(items, 'rt', 'synthesis')).toBe('Partie 1\n\nPartie 2')
    expect(stepReply(items, 'rt', 'verdict')).toBe('')
    expect(stepReply(items, 'autre', 'synthesis')).toBe('')
  })

  it('avis relu du dernier compte rendu réussi ; absent : la raison', () => {
    const report = (id: number, outcome: 'done' | 'error', reply?: string): TranscriptItem =>
      ({
        kind: 'child-report',
        id,
        childId: 'c',
        title: 'c',
        outcome,
        files: [],
        fileCount: 0,
        added: 0,
        removed: 0,
        excerpt: '',
        at: id,
        ...(reply ? { reply } : {})
      }) as TranscriptItem
    expect(reportReply([report(1, 'done', 'Avis'), report(2, 'error')], 'c')).toBe('Avis')
    expect(reportReply([report(1, 'done', 'Avis')], undefined)).toBeUndefined()
    const inputs = opinionInputs(
      {
        seats: [
          {
            profileId: 'p',
            label: 'P',
            agentLabel: 'P',
            letter: 'B',
            state: 'answered',
            changedFolder: true
          },
          {
            profileId: 'p',
            label: 'P',
            agentLabel: 'P',
            letter: 'A',
            state: 'error',
            error: 'model-not-found'
          },
          {
            profileId: 'p',
            label: 'P',
            agentLabel: 'P',
            letter: 'C',
            state: 'answered',
            removed: true,
            stopped: 'removed'
          }
        ]
      },
      () => 'Texte'
    )
    expect(inputs).toEqual([
      { letter: 'B', changedFolder: true, text: 'Texte' },
      { letter: 'A', error: 'model-not-found' },
      { letter: 'C', stopped: 'removed' }
    ])
  })

  it('consommation du dernier tour : seulement ce que l’agent a communiqué', () => {
    expect(lastTurnDigest(undefined)).toBeUndefined()
    expect(lastTurnDigest({ turns: [{ at: 1 }] })).toBeUndefined()
    expect(
      lastTurnDigest({
        cost: { amount: 0.3, currency: 'USD' },
        turns: [{ input: 10, output: 5, total: 20, costStart: 0.1, costEnd: 0.3 }]
      })
    ).toEqual({ input: 10, output: 5, total: 20, turns: 1, cost: { amount: 0.2, currency: 'USD' } })
    // Bob : coût seul, dans son unité.
    expect(
      lastTurnDigest({
        cost: { amount: 0.6, currency: 'bobcoin' },
        turns: [{ costStart: 0.5, costEnd: 0.6 }]
      })
    ).toEqual({ turns: 1, cost: { amount: 0.1, currency: 'bobcoin' } })
  })
})
