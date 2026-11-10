import { describe, expect, it } from 'vitest'
import { findMatches, foldText } from './thread-find'

describe('recherche dans le fil (fiche 086)', () => {
  it('sans casse ni accents, positions dans le texte d’origine', () => {
    const text = 'Erreur dans l’ÉCRAN : une erreur, deux ERREURS.'
    expect(findMatches(text, 'erreur')).toEqual([
      [0, 6],
      [26, 32],
      [39, 45]
    ])
    expect(findMatches(text, 'écran').map(([s, e]) => text.slice(s, e))).toEqual(['ÉCRAN'])
    expect(findMatches(text, 'ecran').map(([s, e]) => text.slice(s, e))).toEqual(['ÉCRAN'])
  })

  it('accents décomposés et ligatures gardés ; recherche vide ou blanche : rien', () => {
    const decomposed = 'Café ou cœur'
    expect(findMatches(decomposed, 'café').map(([s, e]) => decomposed.slice(s, e))).toEqual([
      'Café'
    ])
    expect(findMatches(decomposed, 'cœur')).toEqual([[9, 13]])
    expect(findMatches(decomposed, '   ')).toEqual([])
    expect(foldText('Àé').text).toBe('ae')
  })

  it('les résultats ne se chevauchent pas', () => {
    expect(findMatches('aaaa', 'aa')).toEqual([
      [0, 2],
      [2, 4]
    ])
  })
})
