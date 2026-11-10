import { describe, expect, it } from 'vitest'
import { stripAppContext } from './app-context'
import { branchContext } from './branch'
import { capabilitiesContext, CHILDREN_REQUEST, originContext } from './children'
import { handoverContext } from './handover'

describe('stripAppContext (fiche 125)', () => {
  it('coupe au premier bloc de Bobine joint au message', () => {
    expect(stripAppContext(`Salut ça va ?\n\n${capabilitiesContext('whenFitting')}`)).toBe(
      'Salut ça va ?'
    )
    expect(stripAppContext(`Fais les trois chantiers\n\n${CHILDREN_REQUEST}`)).toBe(
      'Fais les trois chantiers'
    )
    // Comme Bob : le titre est le début du message envoyé, sur une ligne.
    expect(
      stripAppContext('Compile l’app mobile… <bobine_capabilities> For context, about the app')
    ).toBe('Compile l’app mobile…')
  })

  it('chaque contexte que l’app joint est reconnu', () => {
    const contexts = [
      capabilitiesContext('always'),
      CHILDREN_REQUEST,
      branchContext([]),
      handoverContext([
        { kind: 'user', id: 0, text: 'Bonjour' },
        {
          kind: 'handover',
          id: 1,
          from: { profileId: 'a', label: 'A' },
          to: { profileId: 'b', label: 'B' }
        }
      ]),
      originContext({ kind: 'parent', id: 'm', title: 'Mère' }),
      originContext({ kind: 'child', id: 'f', title: 'Fille' })
    ]
    for (const context of contexts) {
      expect(context).toBeTruthy()
      expect(stripAppContext(`Titre de l’utilisateur ${context ?? ''}`)).toBe(
        'Titre de l’utilisateur'
      )
      expect(stripAppContext(context ?? '')).toBeUndefined()
    }
  })

  it('un début de bloc coupé par l’agent en fin de titre est retiré', () => {
    expect(stripAppContext('Ajoute un test <bobine_capab…')).toBe('Ajoute un test')
    expect(stripAppContext('Ajoute un test <child_conv')).toBe('Ajoute un test')
    expect(stripAppContext('This conversation started with another a…')).toBeUndefined()
    expect(stripAppContext('This conversation continues an earlier one, fro…')).toBeUndefined()
    expect(stripAppContext('<child_conversations_request>')).toBeUndefined()
  })

  it('un titre ordinaire ne change pas', () => {
    expect(stripAppContext('Explique-moi ce projet')).toBe('Explique-moi ce projet')
    expect(stripAppContext('Compare a < b et c > d')).toBe('Compare a < b et c > d')
    expect(stripAppContext('This conversation is about tests')).toBe(
      'This conversation is about tests'
    )
    expect(stripAppContext('   ')).toBeUndefined()
  })
})
