import { describe, expect, it } from 'vitest'
import { borrowsAppWords, stripAppContext } from './app-context'
import { branchContext } from './branch'
import {
  capabilitiesContext,
  capabilitiesReminder,
  CHILDREN_REQUEST,
  originContext
} from './children'
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
      capabilitiesReminder('whenFitting'),
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

describe('borrowsAppWords : titre tiré de ce que l’app joint (fiche 254)', () => {
  it('un mot de l’app absent des messages de l’utilisateur : titre emprunté', () => {
    // Recettes Bob du 2026-11-19 (rc1) et du 2026-11-24 (1.0).
    const asked = 'Lis ce petit projet et résume-le en trois lignes.'
    expect(borrowsAppWords('Résumer le projet bobine_capabilities', [asked])).toBe(true)
    expect(borrowsAppWords('Résumé du projet Bobine en trois lignes', [asked])).toBe(true)
    expect(borrowsAppWords('Mémoire : bobine_memory', ['Que retiens-tu ?'])).toBe(true)
    expect(borrowsAppWords('Child_conversations à lancer', ['Fais les deux chantiers'])).toBe(true)
    expect(borrowsAppWords('Résumé de bobine_capabilities', [])).toBe(true)
  })

  it('aucun mot de l’app, ou l’utilisateur l’emploie lui-même : titre gardé', () => {
    expect(borrowsAppWords('Résumer le projet petit-stock', ['Résume'])).toBe(false)
    expect(borrowsAppWords('Corriger le build de Bobine', ['Corrige le build de bobine'])).toBe(
      false
    )
    expect(borrowsAppWords('Expliquer bobine_capabilities', ['Explique bobine_capabilities'])).toBe(
      false
    )
    // Parler de Bobine ne suffit pas pour une balise que l'utilisateur n'a pas citée.
    expect(borrowsAppWords('Bobine : bobine_capabilities', ['Explique Bobine'])).toBe(true)
  })

  it('ce que l’app a joint au message de l’utilisateur ne compte pas comme ses mots', () => {
    const sent = `Lis ce projet\n\n${capabilitiesContext('whenFitting')}`
    expect(borrowsAppWords('Résumer le projet Bobine', [sent])).toBe(true)
  })
})
