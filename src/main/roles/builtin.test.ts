import { describe, expect, it } from 'vitest'
import { builtinRoles } from './builtin'

describe('rôles fournis (fiche 223)', () => {
  it('les sept noms que l’interface traduit (`renderer/src/roles/role-text.ts`)', () => {
    // Un rôle fourni ajouté ou renommé : ajouter sa description traduite (rolesSettings.builtinDescription).
    expect(builtinRoles().map((role) => role.name)).toEqual([
      'ux-ui-expert',
      'flutter-expert',
      'front-architect',
      'back-architect',
      'security-expert',
      'tech-lead',
      'code-reviewer'
    ])
  })
})
