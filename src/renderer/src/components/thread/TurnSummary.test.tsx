import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { turnDurations } from '@shared/turn-duration'
import { lastTurnFacts, TurnSummary } from './TurnSummary'

// Mode présentation (fiche 159), réglé par chaque essai.
const presentation = vi.hoisted(() => ({ on: false }))
vi.mock('../../presentation', () => ({ usePresentation: () => presentation.on }))

const edit = (id: number, oldText: string, newText: string): TranscriptItem => ({
  kind: 'tool',
  id,
  toolCallId: `t${id}`,
  title: 'Modifier',
  status: 'completed',
  content: [{ type: 'diff', path: `/p/f${id}.ts`, oldText, newText }],
  locations: []
})

describe('bilan du dernier tour (fiche 185, P4)', () => {
  const items: TranscriptItem[] = [
    { kind: 'user', id: 1, text: 'avant', at: 1_000 },
    edit(2, 'a\n', 'b\n'),
    { kind: 'agent', id: 3, text: 'fait', at: 3_000 },
    { kind: 'user', id: 4, text: 'encore', at: 10_000 },
    edit(5, 'x\n', 'x\ny\n'),
    edit(6, 'u\n', 'v\n'),
    { kind: 'agent', id: 7, text: 'fini', at: 52_000 }
  ]

  it('durée, fichiers et lignes du seul dernier tour, coût du dernier tour', () => {
    const facts = lastTurnFacts(items, turnDurations(items), {
      cost: { amount: 0.5, currency: 'USD' },
      turns: [{ at: 52_000, costStart: 0.38, costEnd: 0.5 }]
    })
    expect(facts).toMatchObject({ ms: 42_000, files: 2, added: 2, removed: 1 })
    expect(facts?.cost?.amount).toBeCloseTo(0.12)
  })

  it('tour sans réponse finie : pas de bilan', () => {
    const open = items.slice(0, 6)
    expect(lastTurnFacts(open, turnDurations(open), undefined)).toBeUndefined()
  })

  it('coût d’un tour plus ancien : pas repris', () => {
    const facts = lastTurnFacts(items, turnDurations(items), {
      cost: { amount: 0.5, currency: 'USD' },
      turns: [{ at: 3_000, costStart: 0, costEnd: 0.38 }]
    })
    expect(facts?.cost).toBeUndefined()
  })

  it('une ligne : « Terminé en … · 2 fichiers +2 −1 »', () => {
    render(<TurnSummary facts={{ ms: 42_000, files: 2, added: 2, removed: 1 }} />)
    expect(screen.getByTestId('turn-summary').textContent).toMatch(
      /Terminé en .+ · 2 fichiers \+2 −1/
    )
  })

  it('sous la seconde : « Terminé » seul, sans « en 0 s »', () => {
    render(<TurnSummary facts={{ ms: 300, files: 0, added: 0, removed: 0 }} />)
    expect(screen.getAllByTestId('turn-summary').at(-1)?.textContent).toBe('Terminé')
  })

  it('tour arrêté, refusé, coupé ou en erreur : pas de « Terminé » sous son avis', () => {
    for (const notice of [
      { level: 'info' as const, message: { key: 'transcript.notice.cancelled' as const } },
      { level: 'info' as const, message: { key: 'transcript.notice.maxTokens' as const } },
      { level: 'error' as const, text: 'boom' }
    ]) {
      const ended: TranscriptItem[] = [...items, { kind: 'notice', id: 8, ...notice }]
      expect(lastTurnFacts(ended, turnDurations(ended), undefined)).toBeUndefined()
    }
  })

  it('mode présentation : pas de montant', () => {
    presentation.on = true
    render(
      <TurnSummary
        facts={{
          ms: 5_000,
          files: 0,
          added: 0,
          removed: 0,
          cost: { amount: 0.12, currency: 'USD' }
        }}
      />
    )
    expect(screen.getAllByTestId('turn-summary').at(-1)?.textContent).not.toContain('≈')
    presentation.on = false
  })
})
