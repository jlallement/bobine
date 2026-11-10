import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectIdOf, projectKeyOf } from './project-key'

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'init.defaultBranch=main', ...args], { cwd, stdio: 'ignore' })

function repo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'cle-')))
  const main = join(dir, 'app')
  mkdirSync(main)
  git(main, 'init', '-q')
  git(main, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x')
  return main
}

describe('clé de projet de la mémoire (fiche 182)', () => {
  it('dépôt, sous-dossier et worktree partagent la clé du dépôt principal', () => {
    const main = repo()
    mkdirSync(join(main, 'src'))
    const tree = join(main, '..', 'fille')
    git(main, 'worktree', 'add', '-q', tree)
    const key = projectKeyOf(main)
    expect(key).toEqual({ root: main, id: projectIdOf(main) })
    expect(key?.id).toMatch(/^app-[0-9a-f]{8}$/)
    expect(projectKeyOf(join(main, 'src'))).toEqual(key)
    expect(projectKeyOf(tree)).toEqual(key)
  })

  it('dépôt nu : ses worktrees partagent la clé du dossier nu', () => {
    const main = repo()
    const bare = join(main, '..', 'nu.git')
    git(join(main, '..'), 'clone', '-q', '--bare', main, bare)
    const one = join(main, '..', 'un')
    const two = join(main, '..', 'deux')
    git(bare, 'worktree', 'add', '-q', one)
    git(bare, 'worktree', 'add', '-q', '-b', 'b2', two)
    expect(projectKeyOf(one)?.root).toBe(bare)
    expect(projectKeyOf(two)?.id).toBe(projectKeyOf(one)?.id)
  })

  it('dépôt principal déplacé : le worktree seul, signalé', () => {
    const main = repo()
    const tree = join(main, '..', 'fille')
    git(main, 'worktree', 'add', '-q', tree)
    renameSync(main, join(main, '..', 'ailleurs'))
    expect(projectKeyOf(tree)).toEqual({ root: tree, id: projectIdOf(tree), orphanWorktree: true })
  })

  it('hors dépôt : le dossier lui-même ; chemin relatif refusé', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'libre-')))
    expect(projectKeyOf(dir)?.root).toBe(dir)
    expect(projectKeyOf('relatif')).toBeUndefined()
  })

  it('deux dossiers de même nom : deux clés', () => {
    expect(projectIdOf('/a/app')).not.toBe(projectIdOf('/b/app'))
    expect(projectIdOf('/x/Mon Projet!')).toMatch(/^mon-projet-[0-9a-f]{8}$/)
  })
})
