import { describe, expect, it } from 'vitest'
import { codeProject, initialTaskFolder, taskFolders } from './task-folder'

describe('dossier d’une nouvelle tâche planifiée (fiche 276, T12)', () => {
  it('la conversation ouverte d’abord, puis les récents, chacun une fois', () => {
    expect(taskFolders('/p/carnet', ['/p/bobine', '/p/carnet', ''])).toEqual([
      '/p/carnet',
      '/p/bobine'
    ])
    expect(taskFolders(undefined, ['/p/bobine'])).toEqual(['/p/bobine'])
    expect(taskFolders(undefined, [])).toEqual([])
  })

  it('proposé d’office : la conversation ouverte, sinon le plus récent, sinon rien', () => {
    expect(initialTaskFolder('/p/carnet', ['/p/bobine'])).toBe('/p/carnet')
    expect(initialTaskFolder(undefined, ['/p/bobine'])).toBe('/p/bobine')
    expect(initialTaskFolder(undefined, [])).toBe('')
  })

  it('projet d’une conversation : la racine du dépôt d’un worktree, rien pour une discussion', () => {
    expect(codeProject({ workspace: '/p/carnet' })).toBe('/p/carnet')
    expect(codeProject({ workspace: '/wt/x', project: '/p/carnet' })).toBe('/p/carnet')
    expect(codeProject({ workspace: '/d/1', space: 'discussion' })).toBeUndefined()
    expect(codeProject(null)).toBeUndefined()
  })
})
