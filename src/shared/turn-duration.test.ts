import { describe, expect, it } from 'vitest'
import { durationParts, turnDurations, turnTimes } from './turn-duration'
import type { TranscriptItem } from './transcript'

const user = (id: number, at?: number): TranscriptItem => ({
  kind: 'user',
  id,
  text: 'demande',
  ...(at !== undefined ? { at } : {})
})
const agent = (id: number, at?: number): TranscriptItem => ({
  kind: 'agent',
  id,
  text: 'réponse',
  ...(at !== undefined ? { at } : {})
})

describe('turnDurations : durée de chaque tour (fiche 156)', () => {
  it('sur la dernière réponse du tour, de l’envoi à la fin de la réponse', () => {
    const items: TranscriptItem[] = [
      user(1, 1_000),
      agent(2, 135_000),
      { kind: 'thought', id: 3, text: '…' },
      agent(4, 135_000),
      user(5, 200_000),
      agent(6, 208_000)
    ]
    expect([...turnDurations(items)]).toEqual([
      [4, 134_000],
      [6, 8_000]
    ])
  })

  it('rien quand une heure manque (tour rejoué par l’agent) ou sans réponse', () => {
    expect(turnDurations([user(1), agent(2, 5_000)]).size).toBe(0)
    expect(turnDurations([user(1, 1_000), agent(2)]).size).toBe(0)
    expect(turnDurations([user(1, 1_000), user(2, 2_000), agent(3, 4_000)])).toEqual(
      new Map([[3, 2_000]])
    )
  })

  it('une réponse sans message avant elle n’a pas de durée', () => {
    expect(turnDurations([agent(1, 5_000)]).size).toBe(0)
  })
})

describe('durationParts', () => {
  it('heures, minutes, secondes arrondies', () => {
    expect(durationParts(134_400)).toEqual({ hours: 0, minutes: 2, seconds: 14 })
    expect(durationParts(3_905_000)).toEqual({ hours: 1, minutes: 5, seconds: 5 })
    expect(durationParts(-5)).toEqual({ hours: 0, minutes: 0, seconds: 0 })
  })
})

describe('réponse hors tour (OpenCode 2.3.0, fiche 232)', () => {
  it('le tour finit avec sa réponse datée, pas avec celle donnée ensuite, sans heure', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Lance un sous-agent', at: 1_000 },
      { kind: 'agent', id: 2, text: 'Lancé.', at: 4_000 },
      { kind: 'agent', id: 3, text: 'Le mot de code est KANGOUROU.' }
    ]
    expect([...turnDurations(items)]).toEqual([[2, 3_000]])
  })
})

describe('temps de travail de l’agent (fiche 255)', () => {
  const tool = (id: number, askedAt?: number, answeredAt?: number): TranscriptItem => ({
    kind: 'tool',
    id,
    toolCallId: `t${id}`,
    title: 'Écrire',
    status: 'completed',
    content: [],
    locations: [],
    permission: {
      requestId: `p${id}`,
      options: [],
      state: 'cancelled',
      ...(askedAt !== undefined ? { askedAt } : {}),
      ...(answeredAt !== undefined ? { answeredAt } : {})
    }
  })
  const question = (id: number, askedAt: number, answeredAt?: number): TranscriptItem => ({
    kind: 'elicitation',
    id,
    requestId: `e${id}`,
    prompt: { mode: 'form', message: 'Lancer ?', schema: { type: 'object', properties: {} } },
    state: answeredAt === undefined ? 'cancel' : 'accept',
    askedAt,
    ...(answeredAt !== undefined ? { answeredAt } : {})
  })

  it('l’attente d’une autorisation ou d’une question est retirée, et comptée à part (D13)', () => {
    // 91 s de tour, dont 16 s à attendre la réponse à une question (19:31:52 → 19:32:08).
    const items = [user(1, 0), question(2, 4_000, 20_000), agent(3, 91_000)]
    expect(turnTimes(items).get(3)).toEqual({ ms: 75_000, waitedMs: 16_000 })
    expect(turnDurations(items).get(3)).toBe(75_000)
  })

  it('attentes qui se chevauchent : comptées une fois ; demande sans réponse : jusqu’à la fin', () => {
    const items = [
      user(1, 0),
      tool(2, 10_000, 30_000),
      question(3, 20_000, 40_000),
      tool(4, 50_000),
      agent(5, 60_000)
    ]
    expect(turnTimes(items).get(5)).toEqual({ ms: 20_000, waitedMs: 40_000 })
  })

  it('demande non datée (fil d’avant) : rien de retiré', () => {
    expect(turnTimes([user(1, 0), tool(2), agent(3, 9_000)]).get(3)).toEqual({
      ms: 9_000,
      waitedMs: 0
    })
  })

  it('réponse hors tour datée à la fin du travail (fin du `background-work`) : elle finit le tour', () => {
    const items = [user(1, 0), agent(2, 10_000), agent(3, 80_000)]
    expect([...turnTimes(items)]).toEqual([[3, { ms: 80_000, waitedMs: 0 }]])
  })
})
