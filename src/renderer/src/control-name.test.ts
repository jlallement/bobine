import { describe, expect, it } from 'vitest'
import { controlName } from './control-name'

describe('nom d’un réglage de session (fiche 272)', () => {
  it('catégorie ACP connue : traduite ; sinon le nom de l’agent', () => {
    expect(controlName({ name: 'Model', category: 'model' })).toBe('Modèle')
    expect(controlName({ name: 'Session Mode', category: 'mode' })).toBe('Mode')
    expect(controlName({ name: 'Variante', category: 'autre' })).toBe('Variante')
    expect(controlName({ name: 'Variante' })).toBe('Variante')
  })
})
