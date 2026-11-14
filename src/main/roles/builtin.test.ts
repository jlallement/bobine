import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
import { LANGUAGES } from '@shared/i18n'
import { checkRole, roleSnapshot, type Role } from '@shared/roles'
import { builtinRoles } from './builtin'

const NAMES = [
  'ux-ui-expert',
  'flutter-expert',
  'front-architect',
  'back-architect',
  'security-expert',
  'tech-lead',
  'code-reviewer'
]

/** Ce qui ne dépend pas de la langue. */
const looks = (roles: Role[]) =>
  roles.map(({ name, icon, color, readOnly, scope }) => ({ name, icon, color, readOnly, scope }))

function named(name: string, roles: Role[] = builtinRoles()): Role {
  const role = roles.find((r) => r.name === name)
  if (!role) throw new Error(`rôle fourni absent : ${name}`)
  return role
}

async function inLanguage<T>(language: 'fr' | 'en', run: () => T): Promise<T> {
  await i18next.changeLanguage(language)
  try {
    return run()
  } finally {
    await i18next.changeLanguage('fr')
  }
}

describe('rôles fournis (fiche 223, ADR-0046)', () => {
  it('les sept noms, dans l’ordre de l’interface', () => {
    expect(builtinRoles().map((role) => role.name)).toEqual(NAMES)
  })

  it('chaque langue donne sept rôles valides, mêmes noms, icônes, couleurs et lecture seule', () => {
    const fr = builtinRoles('fr')
    const en = builtinRoles('en')
    expect(looks(fr)).toEqual(looks(en))
    for (const language of LANGUAGES) {
      for (const role of builtinRoles(language)) {
        expect([role.name, checkRole(role).ok]).toEqual([role.name, true])
        // Le compte rendu pour la mère est toujours demandé.
        expect(role.prompt).toMatch(language === 'fr' ? /court compte rendu/ : /short summary/)
      }
    }
    // Textes vraiment traduits : aucune description ni consigne identique d'une langue à l'autre.
    fr.forEach((role, i) => {
      expect(role.description).not.toBe(en[i]?.description)
      expect(role.prompt).not.toBe(en[i]?.prompt)
    })
  })

  it('français : insécables avant les deux-points, le reste tel qu’écrit', () => {
    const tech = named('tech-lead', builtinRoles('fr'))
    expect(tech.description).toContain('exigeant : découpe')
    expect(tech.prompt.startsWith('Tu es un tech lead exigeant.')).toBe(true)
    expect(tech.prompt).toContain('chemin:ligne')
    expect(named('tech-lead', builtinRoles('en')).description).toContain('tech lead: splits')
  })

  it('suivent la langue de l’interface au moment de la lecture', async () => {
    const pick = () => {
      const role = named('security-expert')
      return [role.label, role.description, role.prompt.split('\n')[0]]
    }
    expect(pick()).toEqual([
      'Expert sécurité',
      expect.stringContaining('Ne modifie rien.'),
      'Tu es un expert en sécurité applicative et tu fais un audit. Tu ne modifies rien.'
    ])
    expect(await inLanguage('en', pick)).toEqual([
      'Security expert',
      expect.stringContaining('Changes nothing.'),
      'You are an application security expert doing an audit. You change nothing.'
    ])
    expect(pick()[0]).toBe('Expert sécurité')
  })

  it('un rôle figé garde sa langue quand l’interface en change', async () => {
    const frozen = roleSnapshot(named('code-reviewer'))
    const before = structuredClone(frozen)
    const english = await inLanguage('en', () => named('code-reviewer'))
    expect(english.prompt.startsWith('You are a careful code reviewer.')).toBe(true)
    expect(frozen).toEqual(before)
    expect(frozen.prompt.startsWith('Tu es un relecteur de code attentif.')).toBe(true)
  })
})
