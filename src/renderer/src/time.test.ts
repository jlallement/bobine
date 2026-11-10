import { describe, expect, it } from 'vitest'
import { rowDay } from './time'

describe('rowDay : jour d’une conversation dans la barre latérale (fiche 131)', () => {
  const now = new Date(2026, 9, 23, 9, 0)
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString()

  it('rien aujourd’hui, « hier » la veille même tard le soir', () => {
    expect(rowDay(at(2026, 9, 23, 0), 'hier', now)).toBe('')
    expect(rowDay(at(2026, 9, 22, 23), 'hier', now)).toBe('hier')
  })

  it('le jour de la semaine dans les six jours, puis la date ; l’année si elle diffère', () => {
    // Lundi 19 : son nom, pas sa date.
    const monday = rowDay(at(2026, 9, 19), 'hier', now)
    expect(monday).not.toBe('')
    expect(monday).not.toMatch(/19|hier/)
    expect(rowDay(at(2026, 9, 12), 'hier', now)).toMatch(/12/)
    expect(rowDay(at(2025, 9, 12), 'hier', now)).toMatch(/2025/)
    expect(rowDay('pas une date', 'hier', now)).toBe('')
  })
})
