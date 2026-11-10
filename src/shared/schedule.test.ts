import { describe, expect, it } from 'vitest'
import {
  dueDecision,
  estimateCost,
  knownUnit,
  runsPerDay,
  nextRunAfter,
  parseLocalDateTime,
  parseTaskInput,
  toLocalDateTime,
  type ScheduledTask
} from './schedule'

const at = (s: string) => parseLocalDateTime(s) as Date
const local = (d: Date | undefined) => (d ? toLocalDateTime(d) : undefined)

describe('nextRunAfter : échéances à l’heure locale (fiche 178)', () => {
  it('chaque jour : aujourd’hui si l’heure n’est pas passée, sinon demain', () => {
    const daily = { kind: 'daily', time: '09:30' } as const
    expect(local(nextRunAfter(daily, at('2026-11-06T08:00')))).toBe('2026-11-06T09:30')
    expect(local(nextRunAfter(daily, at('2026-11-06T09:30')))).toBe('2026-11-07T09:30')
  })

  it('jours de semaine : le vendredi soir mène au lundi', () => {
    const weekdays = { kind: 'weekdays', time: '08:00' } as const
    // 2026-11-06 est un vendredi.
    expect(local(nextRunAfter(weekdays, at('2026-11-06T09:00')))).toBe('2026-11-09T08:00')
    expect(local(nextRunAfter(weekdays, at('2026-11-05T09:00')))).toBe('2026-11-06T08:00')
  })

  it('une fois : seulement dans le futur', () => {
    const once = { kind: 'once', at: '2026-11-06T12:00' } as const
    expect(local(nextRunAfter(once, at('2026-11-06T11:00')))).toBe('2026-11-06T12:00')
    expect(nextRunAfter(once, at('2026-11-06T12:00'))).toBeUndefined()
  })

  it('toutes les N heures : calé sur la grille de l’ancre', () => {
    const every4 = { kind: 'interval', hours: 4 } as const
    const anchor = at('2026-11-06T08:00')
    expect(local(nextRunAfter(every4, at('2026-11-06T08:00'), anchor))).toBe('2026-11-06T12:00')
    expect(local(nextRunAfter(every4, at('2026-11-06T13:10'), anchor))).toBe('2026-11-06T16:00')
  })
})

describe('dueDecision : jamais de rafale', () => {
  const task = (over: Partial<ScheduledTask> = {}) => ({
    paused: false,
    catchUp: true,
    schedule: { kind: 'interval', hours: 1 } as const,
    nextRunAt: at('2026-11-06T08:00').toISOString(),
    ...over
  })

  it('rien avant l’échéance, ni en pause', () => {
    expect(dueDecision(task(), at('2026-11-06T07:59')).kind).toBe('none')
    expect(dueDecision(task({ paused: true }), at('2026-11-06T09:00')).kind).toBe('none')
  })

  it('à l’heure (ou un peu en retard) : une exécution, la suivante dans une heure', () => {
    const d = dueDecision(task(), at('2026-11-06T08:05'))
    expect(d.kind).toBe('run')
    if (d.kind === 'none') return
    expect(local(d.next)).toBe('2026-11-06T09:00')
  })

  it('après une nuit de veille : un seul rattrapage pour toutes les échéances', () => {
    const d = dueDecision(task(), at('2026-11-06T17:30'))
    expect(d.kind).toBe('catch-up')
    if (d.kind === 'none') return
    expect(d.missed).toBe(10)
    expect(local(d.dueAt)).toBe('2026-11-06T17:00')
    expect(local(d.next)).toBe('2026-11-06T18:00')
  })

  it('sans rattrapage : notée manquée, rien ne part', () => {
    const d = dueDecision(task({ catchUp: false }), at('2026-11-06T10:30'))
    expect(d.kind).toBe('missed')
  })

  it('une seule échéance, très en retard : rattrapage', () => {
    const d = dueDecision(
      task({ schedule: { kind: 'daily', time: '08:00' } }),
      at('2026-11-06T09:00')
    )
    expect(d.kind).toBe('catch-up')
    if (d.kind === 'none') return
    expect(d.missed).toBe(1)
    expect(local(d.next)).toBe('2026-11-07T08:00')
  })
})

describe('estimateCost', () => {
  it('moyenne des dernières exécutions dans la devise la plus récente', () => {
    const run = (amount: number, currency = 'bobcoins') => ({
      id: String(amount),
      at: '',
      outcome: 'done' as const,
      cost: { amount, currency }
    })
    expect(estimateCost([run(2), run(4), run(100, 'USD')])).toEqual({
      amount: 3,
      currency: 'bobcoins',
      runs: 2
    })
    expect(estimateCost([])).toBeUndefined()
    expect(estimateCost([{ id: 'a', at: '', outcome: 'done', tokens: 1000 }])).toEqual({
      tokens: 1000,
      runs: 1
    })
  })
})

describe('parseTaskInput', () => {
  const input = {
    instruction: '  Résume les PR ouvertes\net leurs CI ',
    folder: '/tmp/projet',
    profileId: 'mock',
    schedule: { kind: 'daily', time: '09:00' }
  }

  it('nettoie, nomme d’après la consigne, rattrapage par défaut', () => {
    expect(parseTaskInput(input)).toEqual({
      name: 'Résume les PR ouvertes',
      instruction: 'Résume les PR ouvertes\net leurs CI',
      folder: '/tmp/projet',
      profileId: 'mock',
      schedule: { kind: 'daily', time: '09:00' },
      worktree: false,
      catchUp: true
    })
  })

  it('refuse ce qui est mal formé', () => {
    expect(() => parseTaskInput({ ...input, instruction: ' ' })).toThrow()
    expect(() => parseTaskInput({ ...input, folder: 'relatif' })).toThrow()
    expect(() => parseTaskInput({ ...input, schedule: { kind: 'daily', time: '25:00' } })).toThrow()
    expect(() => parseTaskInput({ ...input, schedule: { kind: 'interval', hours: 0 } })).toThrow()
    expect(() =>
      parseTaskInput({ ...input, schedule: { kind: 'once', at: '2026-02-30T10:00' } })
    ).toThrow()
    expect(() => parseTaskInput({ ...input, cap: { amount: -1 } })).toThrow()
  })

  it('garde un plafond positif', () => {
    expect(parseTaskInput({ ...input, cap: { amount: 2.5 } }).cap).toEqual({ amount: 2.5 })
  })
})

describe('runsPerDay, knownUnit', () => {
  it('seules les tâches « toutes les N heures » ont plusieurs exécutions par jour', () => {
    expect(runsPerDay({ kind: 'interval', hours: 4 })).toBe(6)
    expect(runsPerDay({ kind: 'interval', hours: 24 })).toBeUndefined()
    expect(runsPerDay({ kind: 'daily', time: '09:00' })).toBeUndefined()
  })

  it('unité connue d’une exécution passée : devise, sinon jetons, sinon rien', () => {
    expect(knownUnit([])).toBeUndefined()
    expect(knownUnit([{ id: 'a', at: '', outcome: 'done', tokens: 10 }])).toBe('tokens')
    expect(
      knownUnit([{ id: 'a', at: '', outcome: 'done', cost: { amount: 1, currency: 'bobcoins' } }])
    ).toBe('bobcoins')
  })
})
