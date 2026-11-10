import { describe, expect, it } from 'vitest'
import { MAX_ARGS, toolArgsOf } from './tool-args'
import { withTodos } from './todos'

describe('toolArgsOf (fiche 214)', () => {
  it('outil other : valeurs simples, telles que reçues', () => {
    expect(toolArgsOf({ ville: 'Paris', jours: 3, detail: true, vide: ' ' }, 'other')).toEqual([
      { name: 'ville', value: '"Paris"' },
      { name: 'jours', value: '3' },
      { name: 'detail', value: 'true' }
    ])
  })

  it('ni objets ni tableaux ; rien de lisible : rien', () => {
    expect(toolArgsOf({ a: { b: 1 }, c: [1], d: null }, 'other')).toBeUndefined()
    expect(toolArgsOf({}, 'other')).toBeUndefined()
    expect(toolArgsOf('texte', 'other')).toBeUndefined()
    expect(toolArgsOf(null, 'other')).toBeUndefined()
  })

  it('seulement le genre other ; la liste de tâches et le plan sont lus ailleurs', () => {
    expect(toolArgsOf({ a: 'b' }, 'execute')).toBeUndefined()
    expect(toolArgsOf({ a: 'b' }, undefined)).toBeUndefined()
    expect(toolArgsOf({ todos: '[ ] a', b: 'c' }, 'other')).toBeUndefined()
    expect(toolArgsOf({ plan: 'x' }, 'other')).toBeUndefined()
  })

  it('bornes : huit arguments, valeurs coupées', () => {
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, 'v']))
    expect(toolArgsOf(many, 'other')).toHaveLength(MAX_ARGS)
    const [long] = toolArgsOf({ texte: 'x'.repeat(1000) }, 'other') ?? []
    expect(long?.value).toHaveLength(203)
  })

  it('withTodos garde les arguments déjà lus quand la mise à jour n’en porte pas', () => {
    const first = withTodos({ ville: 'Paris' }, undefined, 'other')
    expect(withTodos({}, first, 'other')).toEqual(first)
  })
})
