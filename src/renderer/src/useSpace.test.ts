import { describe, expect, it } from 'vitest'
import { projectName } from './useSpace'

describe('nom du projet d’une conversation (rôles du projet)', () => {
  it('le dépôt d’un worktree, sinon le dossier ; aucun pour une discussion (fiche 224)', () => {
    expect(projectName({ workspace: '/Users/ada/carnet' })).toBe('carnet')
    expect(projectName({ workspace: '/w/.wt/x', project: '/Users/ada/carnet' })).toBe('carnet')
    expect(projectName({ workspace: '/data/discussions/3973c57d', space: 'discussion' })).toBe(
      undefined
    )
    expect(projectName(null)).toBeUndefined()
  })
})
