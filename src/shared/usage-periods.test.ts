import { describe, expect, it } from 'vitest'
import {
  heatDays,
  isCurrent,
  isDayKey,
  mondayOf,
  previousRange,
  scopeRange,
  shiftDay
} from './usage-periods'

const NOW = new Date(2026, 9, 24, 15) // samedi 24 octobre 2026, 15 h

describe('périodes de « Mon activité » (fiche 144)', () => {
  it('jours valides seulement', () => {
    expect(isDayKey('2026-10-24')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
    expect(isDayKey('24/10/2026')).toBe(false)
    expect(isDayKey(20261024)).toBe(false)
  })

  it('la semaine commence le lundi ; dimanche compris', () => {
    expect(mondayOf('2026-10-24')).toBe('2026-10-19')
    expect(mondayOf('2026-10-25')).toBe('2026-10-19')
    expect(mondayOf('2026-10-19')).toBe('2026-10-19')
  })

  it('navigation : semaine, mois, douze mois, jour ; en cours ou non', () => {
    expect(shiftDay('week', '2026-10-24', -1)).toBe('2026-10-17')
    expect(shiftDay('month', '2026-03-31', -1)).toBe('2026-02-01')
    expect(shiftDay('year', '2026-10-24', -1)).toBe('2025-10-01')
    expect(shiftDay('day', '2026-10-24', 1)).toBe('2026-10-25')
    expect(isCurrent('week', '2026-10-19', NOW)).toBe(true)
    expect(isCurrent('month', '2026-09-30', NOW)).toBe(false)
    expect(scopeRange('year', '2026-10-24').from).toEqual(new Date(2025, 10, 1))
  })

  it('comparaison à date égale : coupée à la fin d’un mois plus court', () => {
    const march31 = new Date(2026, 2, 31, 12)
    expect(previousRange('month', '2026-03-31', march31)).toEqual({
      from: new Date(2026, 1, 1),
      to: new Date(2026, 2, 1),
      sameDate: true
    })
    expect(previousRange('year', '2026-10-24', NOW)).toBeUndefined()
  })

  it('grille : douze derniers mois jusqu’à aujourd’hui, ou une année civile entière', () => {
    const last12 = heatDays('last12', NOW)
    expect([last12[0], last12.at(-1), last12.length]).toEqual(['2025-10-25', '2026-10-24', 365])
    const y2024 = heatDays(2024, NOW)
    expect([y2024[0], y2024.at(-1), y2024.length]).toEqual(['2024-01-01', '2024-12-31', 366])
  })
})
