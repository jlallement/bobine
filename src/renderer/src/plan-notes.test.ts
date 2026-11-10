import { beforeEach, describe, expect, it } from 'vitest'
import { loadPlanNotes, planNotesKey, resetPlanNotesCache, savePlanNotes } from './plan-notes'

describe('remarques de plan (fiche 043)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPlanNotesCache()
  })

  it('gardées par conversation et version, retrouvées après rechargement, effacées si vides', () => {
    const key = planNotesKey('c1', 'plan.md', 2)
    savePlanNotes(key, [{ quote: 'un passage', comment: 'à revoir' }])
    resetPlanNotesCache()
    expect(loadPlanNotes(key)).toEqual([{ quote: 'un passage', comment: 'à revoir' }])
    expect(loadPlanNotes(planNotesKey('c1', 'plan.md', 1))).toEqual([])
    savePlanNotes(key, [])
    resetPlanNotesCache()
    expect(loadPlanNotes(key)).toEqual([])
    expect(localStorage.getItem('bob:remarques-plan')).toBe('{}')
  })

  it('stockage illisible : repart de rien ; au plus 50 plans gardés', () => {
    localStorage.setItem('bob:remarques-plan', '{ pas du json')
    expect(loadPlanNotes('x')).toEqual([])
    for (let i = 0; i < 55; i++) savePlanNotes(`c:${i}:1`, [{ quote: 'q', comment: String(i) }])
    resetPlanNotesCache()
    expect(loadPlanNotes('c:0:1')).toEqual([])
    expect(loadPlanNotes('c:54:1')).toEqual([{ quote: 'q', comment: '54' }])
  })
})
