import { describe, expect, it } from 'vitest'
import { problemPath } from './role-text'

describe('textes affichés d’un rôle (fiche 223, phase 3A)', () => {
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
