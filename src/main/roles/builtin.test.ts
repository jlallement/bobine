import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
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

  it('libellés affichés (demandés par l’utilisateur), identifiants inchangés', async () => {
    const label = (name: string) => builtinRoles().find((role) => role.name === name)?.label
    expect([label('security-expert'), label('back-architect'), label('front-architect')]).toEqual([
      'Expert sécurité',
      'Architecte back-end',
      'Architecte front-end'
    ])
    await i18next.changeLanguage('en')
    try {
      expect([label('security-expert'), label('back-architect'), label('front-architect')]).toEqual(
        ['Security expert', 'Back-end architect', 'Front-end architect']
      )
    } finally {
      await i18next.changeLanguage('fr')
    }
  })
})
