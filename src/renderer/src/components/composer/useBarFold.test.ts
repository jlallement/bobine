import { describe, expect, it } from 'vitest'
import { MAX_FOLD, WRAPPED, fitFold, squeeze } from './useBarFold'

describe('repli de la barre de saisie (fiche 092)', () => {
  it('premier niveau auquel la barre tient', () => {
    expect(fitFold(() => true)).toBe(0)
    expect(fitFold((level) => level >= 2)).toBe(2)
  })

  it('le dernier niveau si rien ne tient (le modèle se tronque, l’agent passe à son icône)', () => {
    expect(fitFold(() => false)).toBe(MAX_FOLD)
  })

  it('essaie les niveaux dans l’ordre, sans dépasser le dernier', () => {
    const tried: number[] = []
    fitFold((level) => {
      tried.push(level)
      return false
    })
    expect(tried).toEqual([0, 1, 2])
  })

  const agent = { width: 120, label: 82 }

  it('le modèle cède d’abord (110 px au plus serré, jamais plus que son nom) ; l’agent reste entier', () => {
    expect(squeeze(180, agent, 0)).toEqual({ model: 110, agent: 120, agentIcon: false, fits: true })
    expect(squeeze(90, { width: 50, label: 12 }, 0)).toMatchObject({ model: 90, agent: 50 })
    expect(squeeze(180, agent, 70)).toMatchObject({ model: 110, agent: 120, agentIcon: false })
  })

  it('plus étroit : l’agent passe à son icône et son chevron, jamais un bout de nom (fiche 185, D26)', () => {
    // Icône : 120 - 82 + 14 = 52 px ; puis le modèle descend jusqu'à 56 px.
    expect(squeeze(180, agent, 71)).toEqual({ model: 110, agent: 52, agentIcon: true, fits: true })
    expect(squeeze(180, agent, 158)).toMatchObject({ model: 90, agent: 52, fits: true })
    expect(squeeze(180, agent, 192)).toMatchObject({ model: 56, fits: true })
  })

  it('même au plus serré, rien ne tient : la barre passe sur deux lignes', () => {
    expect(squeeze(180, agent, 193).fits).toBe(false)
    expect(WRAPPED).toBeGreaterThan(MAX_FOLD)
  })
})
