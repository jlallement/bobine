import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitCommand } from '../git/git-queue'
import { copyIncluded, safeRelative, within } from './worktree-include'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const temp = (prefix: string) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  dirs.push(dir)
  return dir
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
    cwd,
    encoding: 'utf8'
  }).trim()

/** Dépôt d'essai : `.env` et `secret/` ignorés, un fichier suivi, un non suivi non ignoré. */
function repo(include: string): { root: string; target: string; outside: string } {
  const root = temp('bob-incl-')
  const outside = temp('bob-dehors-')
  const target = temp('bob-cible-')
  writeFileSync(join(outside, 'cle.txt'), 'dehors\n')
  writeFileSync(join(root, '.gitignore'), '.env\nsecret/\nlien*\ndossier-lien\n/.worktrees/\n')
  writeFileSync(join(root, '.env.example'), 'A=\n')
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'init')
  writeFileSync(join(root, '.worktreeinclude'), include)
  writeFileSync(join(root, '.env'), 'A=1\n')
  mkdirSync(join(root, 'secret'))
  writeFileSync(join(root, 'secret', 'cle.txt'), 'k\n')
  writeFileSync(join(root, 'notes.txt'), 'pas ignoré\n')
  symlinkSync(join(outside, 'cle.txt'), join(root, 'lien.txt'))
  symlinkSync(outside, join(root, 'dossier-lien'))
  mkdirSync(join(root, '.worktrees', 'autre'), { recursive: true })
  writeFileSync(join(root, '.worktrees', 'autre', '.env'), 'autre\n')
  return { root, target, outside }
}

describe('copie de .worktreeinclude (fiche 175)', () => {
  it('chemins relatifs acceptés', () => {
    expect(safeRelative('.env')).toBe(true)
    expect(safeRelative('a/b.txt')).toBe(true)
    expect(safeRelative('../x')).toBe(false)
    expect(safeRelative('a/../../x')).toBe(false)
    expect(safeRelative('/etc/passwd')).toBe(false)
    expect(safeRelative('.git/config')).toBe(false)
    expect(safeRelative('.worktrees/x/.env')).toBe(false)
    expect(within('/a', '/a/b')).toBe(true)
    expect(within('/a', '/ab')).toBe(false)
  })

  it('sans fichier de motifs : rien', async () => {
    const root = temp('bob-incl-')
    git(root, 'init', '-q')
    expect(await copyIncluded(gitCommand, root, temp('bob-cible-'))).toBeNull()
  })

  it('copie les fichiers ignorés retenus, jamais un lien, ni hors dépôt, ni un worktree', async () => {
    const { root, target } = repo(
      '.env\nsecret/\nnotes.txt\n.env.example\nlien.txt\ndossier-lien\n**/.env\n'
    )
    const copy = await copyIncluded(gitCommand, root, target)
    expect(copy?.files.sort()).toEqual(['.env', 'secret/cle.txt'])
    expect(readFileSync(join(target, '.env'), 'utf8')).toBe('A=1\n')
    expect(readFileSync(join(target, 'secret', 'cle.txt'), 'utf8')).toBe('k\n')
    // Non ignoré, suivi, liens, worktrees de l'app : pas copiés.
    for (const name of ['notes.txt', '.env.example', 'lien.txt', 'dossier-lien', '.worktrees']) {
      expect(existsSync(join(target, name))).toBe(false)
    }
    // lien.txt et dossier-lien : des liens (git ne descend pas dans un dossier lien).
    expect(copy?.skipped).toBe(2)
  })

  it('n’écrase pas un fichier déjà présent', async () => {
    const { root, target } = repo('.env\n')
    writeFileSync(join(target, '.env'), 'déjà\n')
    const copy = await copyIncluded(gitCommand, root, target)
    expect(copy).toEqual({ count: 0, files: [], skipped: 1, truncated: 0 })
    expect(readFileSync(join(target, '.env'), 'utf8')).toBe('déjà\n')
  })

  it('plafonds : le reste n’est pas copié', async () => {
    const { root, target } = repo('.env\nsecret/\n')
    const copy = await copyIncluded(gitCommand, root, target, 'git', { files: 1, bytes: 1e9 })
    expect(copy?.files).toHaveLength(1)
    expect(copy?.truncated).toBe(1)
    const tiny = await copyIncluded(gitCommand, root, temp('bob-cible-'), 'git', {
      files: 10,
      bytes: 1
    })
    expect(tiny).toMatchObject({ count: 0, files: [], truncated: 2 })
  })

  it('liste bornée : 50 chemins gardés, le nombre exact à part', async () => {
    const { root, target } = repo('secret/\n')
    for (let i = 0; i < 60; i++) writeFileSync(join(root, 'secret', `f${i}.txt`), 'x')
    const copy = await copyIncluded(gitCommand, root, target)
    expect(copy?.count).toBe(61)
    expect(copy?.files).toHaveLength(50)
    expect(existsSync(join(target, 'secret', 'f59.txt'))).toBe(true)
  })
})
