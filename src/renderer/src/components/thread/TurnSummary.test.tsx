import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import type { ConversationUsage } from '@shared/usage'
import { turnTimes } from '@shared/turn-duration'
import { replyFeet, ReplyFoot, sameFoot, turnFacts, type TurnFacts } from './TurnSummary'

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

/** Pied d'une réponse qui finit un tour bien fini (fiche 261). */
const renderFoot = (facts: TurnFacts, at?: number) =>
  render(<ReplyFoot foot={{ kind: 'done', facts }} text={() => 'r'} at={at} />)
const footText = () => screen.getAllByTestId('turn-summary').at(-1)?.textContent ?? ''

/** Bilan du dernier tour, fini (fiche 185, P4). */
const lastTurnFacts = (items: TranscriptItem[], usage: ConversationUsage | undefined) => {
  const reply = items.findLast((i) => i.kind === 'agent' && turnTimes(items).has(i.id))
  const start = items.findLastIndex((i) => i.kind === 'user')
  if (!reply || items.indexOf(reply) < start) return undefined
  return turnFacts(items, turnTimes(items), usage, false).get(reply.id)
}

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
    const facts = lastTurnFacts(items, {
      cost: { amount: 0.5, currency: 'USD' },
      turns: [{ at: 52_000, costStart: 0.38, costEnd: 0.5 }]
    })
    expect(facts).toMatchObject({ ms: 42_000, files: 2, added: 2, removed: 1 })
    expect(facts?.cost?.amount).toBeCloseTo(0.12)
  })

  it('réponse hors tour ensuite (fiche 232) : le bilan du tour reste', () => {
    const later: TranscriptItem[] = [...items, { kind: 'agent', id: 8, text: 'hors tour' }]
    expect(lastTurnFacts(later, undefined)).toMatchObject({ ms: 42_000 })
  })

  it('tour sans réponse finie : pas de bilan', () => {
    const open = items.slice(0, 6)
    expect(lastTurnFacts(open, undefined)).toBeUndefined()
  })

  it('coût d’un tour plus ancien : pas repris', () => {
    const facts = lastTurnFacts(items, {
      cost: { amount: 0.5, currency: 'USD' },
      turns: [{ at: 3_000, costStart: 0, costEnd: 0.38 }]
    })
    expect(facts?.cost).toBeUndefined()
  })

  it('un seul pied : « heure · durée · 2 fichiers +2 −1 », sans « Terminé » (fiche 261)', () => {
    const at = new Date(2026, 10, 19, 21, 17).getTime()
    renderFoot({ ms: 149_000, files: 2, added: 2, removed: 1 }, at)
    expect(footText()).toBe('21:17 · 2 min 29 s · 2 fichiers +2 −1')
    expect(screen.getAllByTestId('turn-duration')).toHaveLength(1)
    expect(screen.getByTestId('copy-reply')).toBeTruthy()
    expect(footText()).not.toContain('Terminé')
  })

  it('aucun fichier : ni « 0 fichier » ni montant inventé', () => {
    renderFoot({ ms: 300, files: 0, added: 0, removed: 0 })
    expect(footText()).toBe('0 s')
  })

  it('« Travaille encore… » avec un petit indicateur, sans bilan', () => {
    render(<ReplyFoot foot={{ kind: 'working' }} text={() => 'r'} at={undefined} />)
    const foot = screen.getByTestId('turn-working')
    expect(foot.textContent).toBe('Travaille encore…')
    expect(foot.querySelector('.spin')).toBeTruthy()
    expect(screen.queryByTestId('turn-summary')).toBeNull()
    expect(screen.queryByTestId('turn-duration')).toBeNull()
  })

  it('tour arrêté, refusé, coupé ou en erreur : pas de « Terminé » sous son avis', () => {
    for (const notice of [
      { level: 'info' as const, message: { key: 'transcript.notice.cancelled' as const } },
      { level: 'info' as const, message: { key: 'transcript.notice.maxTokens' as const } },
      { level: 'error' as const, text: 'boom' }
    ]) {
      const ended: TranscriptItem[] = [...items, { kind: 'notice', id: 8, ...notice }]
      expect(lastTurnFacts(ended, undefined)).toBeUndefined()
    }
  })

  it('mode présentation : pas de montant', () => {
    presentation.on = true
    renderFoot({
      ms: 5_000,
      files: 0,
      added: 0,
      removed: 0,
      cost: { amount: 0.12, currency: 'USD' }
    })
    expect(footText()).not.toContain('≈')
    presentation.on = false
  })

  it('coût en dollars annoncé par l’agent : « ≈ » ; bobcoins de Bob : sans (fiche 245)', () => {
    const facts = { ms: 5_000, files: 0, added: 0, removed: 0 }
    renderFoot({ ...facts, cost: { amount: 0.12, currency: 'USD' } })
    expect(footText()).toContain('≈ 0,12')
    renderFoot({ ...facts, cost: { amount: 0.02, currency: 'bobcoins' } })
    const bob = footText()
    expect(bob).toContain('0,02')
    expect(bob).not.toContain('≈')
  })
})

describe('un bilan par tour, à la vraie fin (fiche 255)', () => {
  const user = (id: number, at: number): TranscriptItem => ({ kind: 'user', id, text: 'm', at })
  const agent = (id: number, at?: number): TranscriptItem => ({
    kind: 'agent',
    id,
    text: 'r',
    ...(at !== undefined ? { at } : {})
  })
  const subagent = (id: number, run: Record<string, unknown>): TranscriptItem => ({
    kind: 'tool',
    id,
    toolCallId: `s${id}`,
    title: 'subagent',
    status: 'in_progress',
    content: [],
    locations: [],
    subagent: { task: 'Inventaire des endpoints REST' },
    subagentRun: { startedAt: 1, sessionId: 'ses_x', background: true, ...run }
  })

  it('message en file (D5) : chaque tour garde son bilan, sous sa propre réponse', () => {
    // Tour de 1 min 30, puis le message en file, parti à sa fin, répondu en 4 s.
    const items = [user(1, 0), agent(2, 90_000), user(3, 90_100), agent(4, 94_100)]
    const facts = turnFacts(items, turnTimes(items), undefined, false)
    expect(facts.get(2)).toMatchObject({ ms: 90_000 })
    expect(facts.get(4)).toMatchObject({ ms: 4_000 })
  })

  it('le dernier tour en cours ou qui travaille encore après le tour : seuls les précédents', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000), agent(4, 25_000)]
    expect([...turnFacts(items, turnTimes(items), undefined, true).keys()]).toEqual([2])
  })

  it('sous-agent en arrière-plan encore au travail (D1) : pas de « Terminé » pour ce tour', () => {
    const items = [user(1, 0), subagent(2, {}), agent(3, 10_000)]
    expect(turnFacts(items, turnTimes(items), undefined, false).size).toBe(0)
    // Fini, et la réponse hors tour datée à la fin du travail : le bilan va jusqu'à elle.
    const done = [user(1, 0), subagent(2, { endedAt: 77_000 }), agent(3, 10_000), agent(4, 80_000)]
    const facts = turnFacts(done, turnTimes(done), undefined, false)
    expect([...facts.keys()]).toEqual([4])
    expect(facts.get(4)).toMatchObject({ ms: 80_000 })
  })

  it('attente de l’utilisateur (D13) : hors de la durée, dite à part', () => {
    const items: TranscriptItem[] = [
      user(1, 0),
      {
        kind: 'elicitation',
        id: 2,
        requestId: 'e1',
        prompt: { mode: 'form', message: 'Lancer ?', schema: { type: 'object', properties: {} } },
        state: 'accept',
        askedAt: 20_000,
        answeredAt: 60_000
      },
      agent(3, 71_000)
    ]
    expect(turnFacts(items, turnTimes(items), undefined, false).get(3)).toMatchObject({
      ms: 31_000,
      waitedMs: 40_000
    })
    renderFoot({ ms: 31_000, waitedMs: 40_000, files: 0, added: 0, removed: 0 })
    expect(footText()).toBe('31 s · 40 s à vous attendre')
  })

  it('coût de chaque tour : celui de la consommation fini entre son message et le suivant', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000), agent(4, 25_000)]
    const usage: ConversationUsage = {
      cost: { amount: 0.5, currency: 'USD' },
      turns: [
        { at: 10_000, costStart: 0, costEnd: 0.3 },
        { at: 25_000, costStart: 0.3, costEnd: 0.5 }
      ]
    }
    const facts = turnFacts(items, turnTimes(items), usage, false)
    expect(facts.get(2)?.cost?.amount).toBeCloseTo(0.3)
    expect(facts.get(4)?.cost?.amount).toBeCloseTo(0.2)
  })
})

describe('pied de la réponse qui finit le tour (fiche 261)', () => {
  const user = (id: number, at: number): TranscriptItem => ({ kind: 'user', id, text: 'm', at })
  const agent = (id: number, at?: number): TranscriptItem => ({
    kind: 'agent',
    id,
    text: 'r',
    ...(at !== undefined ? { at } : {})
  })
  const feet = (items: TranscriptItem[], open: boolean) =>
    replyFeet(items, turnTimes(items), undefined, open)

  it('tour fini : le bilan sous sa réponse ; tour en cours : « Travaille encore… » sous la dernière', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000), agent(4), agent(5)]
    const result = feet(items, true)
    expect(result.get(2)).toMatchObject({ kind: 'done', facts: { ms: 10_000 } })
    expect(result.get(4)).toBeUndefined()
    expect(result.get(5)).toEqual({ kind: 'working' })
  })

  it('tour en cours sans réponse encore : aucun pied (l’indicateur du bas suffit)', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000)]
    expect([...feet(items, true).keys()]).toEqual([2])
  })

  it('sous-agent en arrière-plan d’un tour plus ancien : ce tour « travaille encore »', () => {
    const items: TranscriptItem[] = [
      user(1, 0),
      {
        kind: 'tool',
        id: 2,
        toolCallId: 's2',
        title: 'subagent',
        status: 'in_progress',
        content: [],
        locations: [],
        subagent: { task: 'explore' },
        subagentRun: { startedAt: 1, sessionId: 'ses_x', background: true }
      },
      agent(3, 10_000),
      user(4, 20_000),
      agent(5, 24_000)
    ]
    const result = feet(items, false)
    expect(result.get(3)).toEqual({ kind: 'working' })
    expect(result.get(5)).toMatchObject({ kind: 'done' })
  })

  it('tour arrêté ou en erreur : aucun pied, même en cours (rien ne change pour ces cas)', () => {
    const stopped: TranscriptItem[] = [
      user(1, 0),
      agent(2, 5_000),
      { kind: 'notice', id: 3, level: 'info', message: { key: 'transcript.notice.cancelled' } }
    ]
    expect(feet(stopped, false).size).toBe(0)
    expect(feet(stopped, true).size).toBe(0)
  })

  it('même pied recalculé à l’identique : comparé par sa valeur', () => {
    const facts = { ms: 1_000, files: 1, added: 2, removed: 0 }
    expect(sameFoot({ kind: 'done', facts }, { kind: 'done', facts: { ...facts } })).toBe(true)
    expect(
      sameFoot({ kind: 'done', facts }, { kind: 'done', facts: { ...facts, ms: 2_000 } })
    ).toBe(false)
    expect(sameFoot({ kind: 'working' }, { kind: 'working' })).toBe(true)
    expect(sameFoot({ kind: 'working' }, undefined)).toBe(false)
    expect(sameFoot(undefined, undefined)).toBe(true)
  })
})
