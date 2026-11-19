import { beforeEach, describe, expect, it } from 'vitest'
import type { FolderDirty, LaunchFolderState } from '@shared/launch-folder'
import {
  forgetLaunchChoices,
  rememberChoice,
  rememberedChoice,
  uncommittedOf
} from './launch-choice'

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

beforeEach(() => forgetLaunchChoices())

describe('choix devant le dossier (fiche 262)', () => {
  it('défaut : « Partir sans elles »', () => {
    expect(rememberedChoice(at('h1', DIRTY))).toBe('without')
    expect(rememberedChoice(undefined)).toBe('without')
  })

  it('retenu pour ce dossier jusqu’au prochain commit (racine + HEAD)', () => {
    rememberChoice(at('h1', DIRTY), 'readOnly')
    // Même dossier, même HEAD, modifications différentes : retenu.
    expect(rememberedChoice(at('h1'))).toBe('readOnly')
    // Un commit plus tard : le défaut revient.
    expect(rememberedChoice(at('h2', DIRTY))).toBe('without')
    // Un autre dépôt au même commit : rien de retenu.
    expect(rememberedChoice(at('h1', DIRTY, '/autre'))).toBe('without')
    rememberChoice(at('h1'), 'without')
    expect(rememberedChoice(at('h1'))).toBe('without')
  })

  it('rien de retenu pour un travail qui part dans le dossier (dépôt sans commit)', () => {
    const here: LaunchFolderState = { place: 'here', reason: 'noCommit' }
    rememberChoice(here, 'readOnly')
    expect(rememberedChoice(here)).toBe('without')
  })

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
