import { describe, expect, it } from 'vitest'
import type { UsageModelRow } from '@shared/usage-stats'
import {
  agentsWithUnit,
  axisBuckets,
  axisDays,
  bucketLabel,
  deltaOf,
  heatLevels,
  periodLabel,
  previousMonthName,
  weekdayName,
  cellValue,
  costPerTurn,
  costUnits,
  dayLabel,
  durationScale,
  durationTick,
  metricCoverage,
  niceScale,
  orderedCosts,
  seriesColor
} from './usage-board'

const model = (over: Partial<UsageModelRow>): UsageModelRow => ({
  key: 'k',
  profileId: 'opencode',
  agentLabel: 'OpenCode',
  turns: 1,
  input: 0,
  output: 0,
  turnsWithoutTokens: 0,
  costs: {},
  costTurns: {},
  ...over
})

describe('mesures comparables (fiche 147)', () => {
  it('graduations de durée : valeurs d’horloge, « 1 h 30 »', () => {
    expect(durationScale(72)).toEqual({ top: 90, step: 30 })
    expect(durationScale(5)).toEqual({ top: 6, step: 2 })
    expect(durationScale(400)).toEqual({ top: 540, step: 180 })
    expect(durationScale(0)).toEqual({ top: 1, step: 1 })
    expect(durationTick(20)).toBe('20 min')
    expect(durationTick(60)).toBe('1 h')
    expect(durationTick(90)).toBe('1 h 30')
    expect(durationTick(125)).toBe('2 h 05')
  })

  it('couverture d’une mesure : d’après le journal de la période, pas le nom de l’agent', () => {
    const rows = [
      model({
        profileId: 'bob',
        agentLabel: 'IBM Bob',
        turnsWithoutTokens: 1,
        costTurns: { bobcoins: 1 }
      }),
      model({ profileId: 'oc', agentLabel: 'OpenCode', costTurns: { USD: 1 } }),
      model({ key: 'oc:b', profileId: 'oc', agentLabel: 'OpenCode', turnsWithoutTokens: 1 })
    ]
    expect(metricCoverage(rows, { kind: 'tokens' })).toEqual({
      covered: ['OpenCode'],
      missing: ['IBM Bob']
    })
    expect(metricCoverage(rows, { kind: 'cost', unit: 'bobcoins' })).toEqual({
      covered: ['IBM Bob'],
      missing: ['OpenCode']
    })
    // Tout le monde couvert, ou mesure de tous : rien à dire.
    expect(metricCoverage(rows.slice(1, 2), { kind: 'tokens' })).toEqual({
      covered: [],
      missing: []
    })
    expect(metricCoverage(rows, { kind: 'turns' })).toEqual({ covered: [], missing: [] })
    expect(metricCoverage(rows, { kind: 'time' })).toEqual({ covered: [], missing: [] })
    // Un agent qui se met à communiquer ses jetons est couvert, sans rien changer d'autre.
    const talking = [...rows, model({ key: 'bob:x', profileId: 'bob', agentLabel: 'IBM Bob' })]
    expect(metricCoverage(talking, { kind: 'tokens' })).toEqual({ covered: [], missing: [] })
  })
})

describe('affichage du tableau de consommation (fiche 137)', () => {
  it('valeur d’une cellule selon la mesure ; coût dans une seule unité', () => {
    const cell = { turns: 3, tokens: 1200, costs: { USD: 0.5, bobcoins: 2 }, durationMs: 90_000 }
    expect(cellValue(cell, { kind: 'turns' })).toBe(3)
    expect(cellValue(cell, { kind: 'time' })).toBe(1.5)
    expect(cellValue(cell, { kind: 'tokens' })).toBe(1200)
    expect(cellValue(cell, { kind: 'cost', unit: 'bobcoins' })).toBe(2)
    expect(cellValue(undefined, { kind: 'turns' })).toBe(0)
  })

  it('couleurs par emplacement fixe, « Autres » à part', () => {
    expect(seriesColor(0)).toBe('var(--chart-1)')
    expect(seriesColor(2)).toBe('var(--chart-3)')
    expect(seriesColor(null)).toBe('var(--chart-other)')
  })

  it('unités dans l’ordre de leur usage ; agents de chaque unité ; coût par échange', () => {
    const rows = [
      model({ agentLabel: 'IBM Bob', costs: { bobcoins: 4.12 }, costTurns: { bobcoins: 96 } }),
      model({ costs: { USD: 0 }, costTurns: { USD: 74 } }),
      model({ agentLabel: 'Autre', costs: { USD: 1 }, costTurns: { USD: 4 } })
    ]
    expect(costUnits(rows)).toEqual(['bobcoins', 'USD'])
    expect(agentsWithUnit(rows, 'USD')).toEqual(['OpenCode', 'Autre'])
    expect(costPerTurn(rows[0] as UsageModelRow, 'bobcoins')).toBeCloseTo(0.042917, 5)
    expect(costPerTurn(rows[1] as UsageModelRow, 'USD')).toBeUndefined()
    expect(orderedCosts({ USD: 1, bobcoins: 2 }, ['bobcoins'])).toEqual([
      ['bobcoins', 2],
      ['USD', 1]
    ])
  })

  it('graduation ronde', () => {
    expect(niceScale(17)).toEqual({ top: 20, step: 10 })
    expect(niceScale(15)).toEqual({ top: 15, step: 5 })
    expect(niceScale(2)).toEqual({ top: 2, step: 1 })
    expect(niceScale(0.43)).toEqual({ top: 0.6, step: 0.2 })
    expect(niceScale(0)).toEqual({ top: 1, step: 1 })
  })

  it('dates de l’axe : premier, dernier et trois entre les deux', () => {
    expect(axisDays(30)).toEqual([0, 7, 15, 22, 29])
    expect(axisDays(3)).toEqual([0, 1, 2])
    expect(axisDays(0)).toEqual([])
    expect(dayLabel('2026-10-21')).toBe('21 oct.')
    expect(dayLabel('2026-10-21', true)).toBe('mer. 21 oct.')
  })

  it('périodes de « Mon activité » (fiche 144) : semaine, à cheval sur deux mois ou deux ans', () => {
    const nb = (text: string) => text.replace(/\s/g, ' ')
    expect(nb(periodLabel('week', '2026-10-24'))).toBe('19–25 oct. 2026')
    expect(nb(periodLabel('week', '2026-10-01'))).toBe('28 sept. – 4 oct. 2026')
    expect(nb(periodLabel('week', '2026-01-01'))).toBe('29 déc. 2025 – 4 janv. 2026')
    expect(periodLabel('month', '2026-10-24')).toBe('octobre 2026')
    expect(nb(periodLabel('year', '2026-10-24'))).toBe('nov. 2025 – oct. 2026')
    expect(periodLabel('day', '2026-10-20')).toBe('mardi 20 octobre 2026')
    expect([weekdayName('2026-10-20'), previousMonthName('2026-10-20')]).toEqual([
      'mardi',
      'septembre'
    ])
  })

  it('seaux du graphique : heures, jours de la semaine ou du mois, mois', () => {
    const nb = (text: string) => text.replace(/\s/g, ' ')
    expect(nb(bucketLabel('hour', '2026-10-20T14', 'day'))).toBe('14 h')
    expect(nb(bucketLabel('hour', '2026-10-20T00', 'day'))).toBe('0 h')
    expect(nb(bucketLabel('hour', '2026-10-20T14', 'day', true))).toBe('mar. 20 oct., 14 h')
    expect(bucketLabel('day', '2026-10-19', 'week')).toBe('lun. 19')
    expect(bucketLabel('day', '2026-10-19', 'month')).toBe('19 oct.')
    expect(bucketLabel('month', '2025-11', 'year')).toBe('nov.')
    expect(bucketLabel('month', '2025-11', 'year', true)).toBe('novembre 2025')
    expect(axisBuckets('hour', 24)).toEqual([0, 6, 12, 18])
    expect(axisBuckets('day', 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(axisBuckets('month', 12)).toHaveLength(12)
    expect(axisBuckets('day', 31)).toEqual([0, 8, 15, 23, 30])
  })

  it('grille d’activité : le plus actif au niveau 4, un jour exceptionnel n’écrase pas les autres', () => {
    const level = heatLevels([0, 1, 2, 3, 4, 100])
    expect([0, 1, 2, 3, 4, 100].map(level)).toEqual([0, 1, 2, 3, 3, 4])
    expect(heatLevels([0, 5])(5)).toBe(4)
    expect(heatLevels([])(3)).toBe(0)
  })

  it('écart : sens et part, rien sans période d’avant', () => {
    expect(deltaOf(118, 100)).toEqual({ direction: 'up', percent: 18, ratio: 1.2 })
    expect(deltaOf(96, 100)).toEqual({ direction: 'down', percent: 4, ratio: 1 })
    expect(deltaOf(100, 100)?.direction).toBe('flat')
    expect(deltaOf(5, 0)).toBeUndefined()
    expect(deltaOf(5, undefined)).toBeUndefined()
  })
})
