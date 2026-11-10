import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cachedRepoRoot, repoRootOf } from './repo-root'

describe('racine du dépôt d’un dossier (fiche 130)', () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'repo-root-')))
  const repo = join(base, 'app')
  mkdirSync(join(repo, '.git', 'worktrees', 'fille'), { recursive: true })
  mkdirSync(join(repo, 'src', 'ui'), { recursive: true })
  const worktree = join(repo, '.worktrees', 'fille')
  mkdirSync(join(worktree, 'src'), { recursive: true })
  writeFileSync(join(worktree, '.git'), `gitdir: ${join(repo, '.git', 'worktrees', 'fille')}\n`)
  const outside = join(base, 'hors-depot')
  mkdirSync(outside)

  it('dossier du dépôt ou sous-dossier : la racine du dépôt', () => {
    expect(repoRootOf(repo)).toBe(repo)
    expect(repoRootOf(join(repo, 'src', 'ui'))).toBe(repo)
  })

  it('worktree (`.git` fichier) : le dépôt principal', () => {
    expect(repoRootOf(worktree)).toBe(repo)
    expect(repoRootOf(join(worktree, 'src'))).toBe(repo)
  })

  it('`.git` fichier qui ne pointe pas vers un worktree (sous-module) : son dossier', () => {
    const sub = join(base, 'sous-module')
    mkdirSync(sub)
    writeFileSync(join(sub, '.git'), 'gitdir: ../app/.git/modules/sous-module\n')
    expect(repoRootOf(sub)).toBe(sub)
  })

  it('hors d’un dépôt, dossier vide ou relatif : rien', () => {
    expect(repoRootOf(outside)).toBeUndefined()
    expect(repoRootOf('')).toBeUndefined()
    expect(repoRootOf('relatif')).toBeUndefined()
  })

  it('mis en cache par dossier', () => {
    const root = cachedRepoRoot()
    expect(root(worktree)).toBe(repo)
    expect(root(worktree)).toBe(repo)
  })
})
