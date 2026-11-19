import { describe, expect, it } from 'vitest'
import type { FolderDirty, LaunchFolderState } from '@shared/launch-folder'
import { uncommittedOf } from './launch-choice'

const DIRTY: FolderDirty = {
  count: 2,
  files: [
    { path: 'plan.md', status: 'untracked' },
    { path: 'a.ts', status: 'modified' }
  ],
  commit: 'abc1234'
}
const at = (head: string, dirty?: FolderDirty, root = '/depot'): LaunchFolderState => ({
  place: 'worktree',
  root,
  head,
  ...(dirty ? { dirty } : {})
})

describe('choix devant le dossier (fiche 262)', () => {
  it('la requête porte toujours le choix affiché, jamais un défaut caché', () => {
    expect(uncommittedOf(at('h1', DIRTY), 'without')).toBe('anyway')
    expect(uncommittedOf(at('h1', DIRTY), 'readOnly')).toBe('readOnly')
    expect(uncommittedOf(at('h1'), 'readOnly')).toBe('readOnly')
    // Propre : rien à laisser derrière, rien à porter.
    expect(uncommittedOf(at('h1'), 'without')).toBeUndefined()
    // Dans le dossier (sans commit, hors dépôt) : le main décide seul, rien à porter.
    expect(uncommittedOf({ place: 'here', reason: 'noCommit' }, 'without')).toBeUndefined()
    expect(uncommittedOf(null, 'without')).toBeUndefined()
  })
})
