import { describe, expect, it } from 'vitest'
import { problemPath, shownDescription } from './role-text'

const BUILTIN_NAMES = [
  'ux-ui-expert',
  'flutter-expert',
  'front-architect',
  'back-architect',
  'security-expert',
  'tech-lead',
  'code-reviewer'
]

describe('textes affichés d’un rôle (fiche 223, phase 3A)', () => {
  it('chaque rôle fourni a sa description traduite ; les autres gardent la leur', () => {
    // Les sept rôles fournis (`main/roles/builtin.ts`, liste vérifiée par `builtin.test.ts`).
    for (const name of BUILTIN_NAMES) {
      const role = { name, scope: 'builtin' as const, description: 'English.' }
      const shown = shownDescription(role)
      expect([role.name, shown]).not.toEqual([role.name, role.description])
      expect(shown.length).toBeGreaterThan(20)
    }
    expect(shownDescription({ name: 'tech-lead', scope: 'user', description: 'À moi.' })).toBe(
      'À moi.'
    )
    expect(shownDescription({ name: 'inconnu', scope: 'builtin', description: 'Brut.' })).toBe(
      'Brut.'
    )
  })

  it('chemin d’un fichier écarté relatif à sa portée', () => {
    const error = { code: 'unknownField' as const }
    expect(
      problemPath({ scope: 'project', file: '/var/t/projet/.bobine/roles/faute.md', error })
    ).toBe('.bobine/roles/faute.md')
    expect(
      problemPath({ scope: 'user', file: '/Users/x/Library/Bobine/roles/faute.md', error })
    ).toBe('roles/faute.md')
    expect(problemPath({ scope: 'user', file: '/Users/x/Bobine/roles', error })).toBe('roles')
    expect(problemPath({ scope: 'project', file: '/ailleurs/faute.md', error })).toBe('faute.md')
  })
})
