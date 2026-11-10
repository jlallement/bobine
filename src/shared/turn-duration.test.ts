import { describe, expect, it } from 'vitest'
import { durationParts, turnDurations } from './turn-duration'
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
