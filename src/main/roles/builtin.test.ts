import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
import { LANGUAGES } from '@shared/i18n'
import { checkRole, roleSnapshot, type Role } from '@shared/roles'
import { PARTICIPANT_BRIEF } from '@shared/roundtable-prompts'
import { builtinRoles } from './builtin'

const NAMES = [
  'ux-ui-expert',
  'flutter-expert',
  'front-architect',
  'back-architect',
  'security-expert',
  'tech-lead',
  'code-reviewer',
  'participant'
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
  it('les huit noms, dans l’ordre de l’interface', () => {
    expect(builtinRoles().map((role) => role.name)).toEqual(NAMES)
  })

  it('chaque langue donne huit rôles valides, mêmes noms, icônes, couleurs et lecture seule', () => {
    const fr = builtinRoles('fr')
    const en = builtinRoles('en')
    expect(looks(fr)).toEqual(looks(en))
    for (const language of LANGUAGES) {
      for (const role of builtinRoles(language)) {
        expect([role.name, checkRole(role).ok]).toEqual([role.name, true])
        // Participant (fiche 285) : son propre format en cinq rubriques, pas le résumé des rôles.
        if (role.name === 'participant') continue
        // Le résumé pour la conversation qui l'a lancé est toujours demandé, sans titre ; plus de
        // « compte rendu » (recette N6, fiche 267 : il revenait en titre de la réponse).
        expect(role.prompt).toMatch(
          language === 'fr'
            ? /résumé de deux lignes, sans titre/
            : /two-line summary, without a heading/
        )
        expect(role.prompt).not.toMatch(
          language === 'fr' ? /compte rendu/i : /\bshort summary for\b/
        )
      }
    }
    // Textes vraiment traduits : aucune description ni consigne identique d'une langue à l'autre.
    fr.forEach((role, i) => {
      if (role.name === 'participant') return
      expect(role.description).not.toBe(en[i]?.description)
      expect(role.prompt).not.toBe(en[i]?.prompt)
    })
  })

  it('fiche 262 : Expert UX/UI est un rôle de conseil, sa consigne le dit dans chaque langue', () => {
    expect(named('ux-ui-expert', builtinRoles('fr'))).toMatchObject({ readOnly: true })
    expect(named('ux-ui-expert', builtinRoles('fr')).prompt).toContain('tu ne modifies rien')
    expect(named('ux-ui-expert', builtinRoles('en')).prompt).toContain('you change nothing')
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

  it('fiche 285 : Participant, de conseil, sans outils de Bobine ; sa consigne anglaise est celle du tour de table', () => {
    const en = named('participant', builtinRoles('en'))
    expect(en).toMatchObject({ readOnly: true, mcp: [], icon: 'users' })
    expect(en.prompt).toBe(PARTICIPANT_BRIEF)
    // La même consigne en français : ce qu'« Installer dans… » écrit, et ce que le tour envoie.
    expect(named('participant', builtinRoles('fr')).prompt).toBe(PARTICIPANT_BRIEF)
    expect(named('participant', builtinRoles('fr')).label).toBe('Participant')
  })
})
