import { describe, expect, it } from 'vitest'
import type { Role } from '@shared/roles'
import {
  draftDefinition,
  draftErrors,
  draftFromRole,
  draftTouched,
  emptyDraft,
  errorField,
  roleFileHint,
  slugifyRoleName,
  stepOfField,
  suggestAppearance,
  withLabel
} from './role-draft'

const ready = () =>
  withLabel(
    {
      ...emptyDraft(),
      description: 'Relit le code sensible avant la fusion.',
      prompt: 'Tu es un expert en sécurité.'
    },
    'Expert sécu'
  )

describe('brouillon de rôle (fiche 223, phase 3A)', () => {
  it('tire l’identifiant du libellé : accents, espaces, ponctuation, longueur', () => {
    expect(slugifyRoleName('Expert sécu')).toBe('expert-secu')
    expect(slugifyRoleName('  UX/UI — Écrans !  ')).toBe('ux-ui-ecrans')
    expect(slugifyRoleName('Ça')).toBe('ca')
    expect(slugifyRoleName('a'.repeat(60))).toHaveLength(40)
    expect(slugifyRoleName('---')).toBe('')
  })

  it('suggère icône et couleur d’après le libellé, jusqu’à un choix à la main', () => {
    expect(suggestAppearance('Expert sécu')).toEqual({ icon: 'shield-check', color: 'orange' })
    expect(suggestAppearance('Code reviewer')).toEqual({ icon: 'scan-search', color: 'blue' })
    expect(suggestAppearance('Quelqu’un')).toEqual({ icon: 'bot', color: 'graphite' })
    const draft = withLabel(emptyDraft(), 'Expert sécu')
    expect(draft).toMatchObject({ name: 'expert-secu', icon: 'shield-check', color: 'orange' })
    const chosen = withLabel({ ...draft, icon: 'rocket', appearanceChosen: true }, 'Testeur')
    expect(chosen).toMatchObject({ name: 'testeur', icon: 'rocket', color: 'orange' })
    const named = withLabel({ ...draft, name: 'secu', nameEdited: true }, 'Autre chose')
    expect(named.name).toBe('secu')
  })

  it('prérempli (« Enregistrer comme rôle », menu @) : le nom vient du libellé, l’apparence donnée est gardée', () => {
    expect(emptyDraft({ label: 'Expert Flutter' })).toMatchObject({
      name: 'expert-flutter',
      nameEdited: false,
      icon: 'smartphone'
    })
    expect(emptyDraft({ label: 'Expert Flutter', icon: 'bug' })).toMatchObject({
      icon: 'bug',
      appearanceChosen: true
    })
    expect(emptyDraft({ name: 'mon-role' })).toMatchObject({ name: 'mon-role', nameEdited: true })
  })

  it('vérifie chaque étape à part, toutes les erreurs de l’étape à la fois', () => {
    const blank = emptyDraft()
    expect(Object.keys(draftErrors(blank, 'who')).sort()).toEqual(['description', 'label', 'name'])
    expect(Object.keys(draftErrors(blank, 'how'))).toEqual(['prompt'])
    expect(draftErrors(blank, 'with')).toEqual({})
    expect(draftErrors({ ...ready(), name: 'Pas Bon' }, 'who')).toEqual({
      name: { code: 'name', field: 'name' }
    })
    expect(draftErrors({ ...ready(), mode: 'x'.repeat(121) }, 'with')).toEqual({
      mode: { code: 'value', field: 'mode' }
    })
    expect(draftErrors(ready(), 'all')).toEqual({})
  })

  it('donne au main ce que `checkRole` accepte, champs vides omis', () => {
    const checked = draftDefinition({
      ...ready(),
      mode: ' plan ',
      readOnly: true,
      mcp: ['terminal']
    })
    expect(checked).toEqual({
      ok: true,
      role: {
        name: 'expert-secu',
        label: 'Expert sécu',
        icon: 'shield-check',
        color: 'orange',
        description: 'Relit le code sensible avant la fusion.',
        mode: 'plan',
        readOnly: true,
        mcp: ['terminal'],
        prompt: 'Tu es un expert en sécurité.'
      }
    })
  })

  it('place une erreur du main sous son champ et à son étape', () => {
    expect(errorField({ code: 'duplicateName', field: 'name' })).toBe('name')
    expect(errorField({ code: 'link' })).toBe('name')
    expect(errorField({ code: 'prompt' })).toBe('prompt')
    expect(errorField({ code: 'value', field: 'model' })).toBe('model')
    expect(stepOfField('prompt')).toBe('how')
    expect(stepOfField('model')).toBe('with')
    expect(stepOfField('description')).toBe('who')
  })

  it('relit un rôle existant pour l’éditer ; un rôle fourni s’enregistre en personnel', () => {
    const role: Role = {
      name: 'tech-lead',
      label: 'Tech lead',
      icon: 'compass',
      color: 'graphite',
      description: 'Plans.',
      readOnly: true,
      prompt: 'You are a tech lead.',
      scope: 'builtin'
    }
    const draft = draftFromRole(role)
    expect(draft).toMatchObject({ scope: 'user', agent: '', mcp: null, appearanceChosen: true })
    expect(draftFromRole({ ...role, scope: 'project', mcp: [] }).mcp).toEqual([])
    expect(draftDefinition(draft).ok).toBe(true)
  })

  it('dit si quelque chose a été saisi, et où le fichier sera écrit', () => {
    const initial = emptyDraft()
    expect(draftTouched(initial, initial)).toBe(false)
    expect(draftTouched({ ...initial, prompt: 'x' }, initial)).toBe(true)
    expect(roleFileHint({ name: 'expert-secu', scope: 'project' })).toBe(
      '.bobine/roles/expert-secu.md'
    )
    expect(roleFileHint({ name: '', scope: 'user' })).toBe('role.md')
  })
})
