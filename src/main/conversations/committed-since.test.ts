/**
 * Fichiers commités depuis un message (fiche 286), contre de vrais dépôts git temporaires : hors
 * dépôt, dépôt sans commit, fichier commité ou non, supprimé, renommé, worktree d'une tâche fille ;
 * heure inconnue et git en échec tiennent tout pour commité (défaut prudent), sans jamais lever.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitCommand } from '../git/git-queue'
import type { Run } from '../simulator/run'
import { committedSince } from './committed-since'

const cleanups: string[] = []
afterEach(() => {
  for (const dir of cleanups.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Dossier temporaire tel que `tmpdir()` le donne (lien symbolique `/var` sur macOS : voulu). */
function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'commite-depuis-'))
  cleanups.push(dir)
  return dir
}

const IDENTITY = [
  '-c',
  'user.name=t',
  '-c',
  'user.email=t@example.invalid',
  '-c',
  'commit.gpgsign=false'
]

function gitIn(cwd: string, env?: NodeJS.ProcessEnv) {
  return (...args: string[]) =>
    execFileSync('git', [...IDENTITY, ...args], {
      cwd,
      encoding: 'utf8',
      ...(env ? { env: { ...process.env, ...env } } : {})
    }).trim()
}

/** Dépôt avec un premier commit de `a.txt` et `sub/b.txt`, daté d'une heure plus tôt. */
function repo() {
  const dir = folder()
  const git = gitIn(dir)
  git('init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'a.txt'), 'a1\n')
  mkdirSync(join(dir, 'sub'))
  writeFileSync(join(dir, 'sub', 'b.txt'), 'b1\n')
  git('add', '.')
  const past = new Date(Date.now() - 3_600_000).toISOString()
  gitIn(dir, { GIT_AUTHOR_DATE: past, GIT_COMMITTER_DATE: past })('commit', '-q', '-m', 'init')
  return { dir, git }
}

const run: Run = gitCommand

describe('committedSince (fiche 286)', () => {
  it('hors dépôt git : rien de commité', async () => {
    const dir = folder()
    writeFileSync(join(dir, 'a.txt'), 'a\n')
    expect(await committedSince(run, dir, [join(dir, 'a.txt')], Date.now())).toEqual(new Set())
  })

  it('dépôt sans commit : rien de commité', async () => {
    const dir = folder()
    gitIn(dir)('init', '-q', '-b', 'main')
    writeFileSync(join(dir, 'a.txt'), 'a\n')
    expect(await committedSince(run, dir, [join(dir, 'a.txt')], Date.now())).toEqual(new Set())
  })

  it('modifié sans commit depuis le message : pas commité ; le commit d’avant ne compte pas', async () => {
    const { dir } = repo()
    const since = Date.now()
    writeFileSync(join(dir, 'a.txt'), 'a2\n')
    expect(await committedSince(run, dir, [join(dir, 'a.txt')], since)).toEqual(new Set())
  })

  it('commité depuis le message (même seconde comprise) : commité, et lui seul', async () => {
    const { dir, git } = repo()
    const since = Date.now()
    writeFileSync(join(dir, 'a.txt'), 'a2\n')
    writeFileSync(join(dir, 'sub', 'b.txt'), 'b2\n')
    git('commit', '-q', '-m', 'a', '--', 'a.txt')
    const a = join(dir, 'a.txt')
    const b = join(dir, 'sub', 'b.txt')
    expect(await committedSince(run, dir, [a, b], since)).toEqual(new Set([a]))
  })

  it('dossier de la conversation dans un sous-dossier du dépôt', async () => {
    const { dir, git } = repo()
    const since = Date.now()
    writeFileSync(join(dir, 'sub', 'b.txt'), 'b2\n')
    git('commit', '-q', '-am', 'b')
    const sub = join(dir, 'sub')
    const b = join(sub, 'b.txt')
    expect(await committedSince(run, sub, [b], since)).toEqual(new Set([b]))
  })

  it('suppression commitée : commité', async () => {
    const { dir, git } = repo()
    const since = Date.now()
    git('rm', '-q', 'a.txt')
    git('commit', '-q', '-m', 'rm')
    const a = join(dir, 'a.txt')
    expect(await committedSince(run, dir, [a], since)).toEqual(new Set([a]))
  })

  it('renommage commité : l’ancien et le nouveau nom comptent', async () => {
    const { dir, git } = repo()
    const since = Date.now()
    git('mv', 'a.txt', 'c.txt')
    git('commit', '-q', '-m', 'mv')
    const a = join(dir, 'a.txt')
    const c = join(dir, 'c.txt')
    expect(await committedSince(run, dir, [a, c], since)).toEqual(new Set([a, c]))
  })

  it('worktree d’une tâche fille : son historique, pas celui du dossier principal', async () => {
    const { dir, git } = repo()
    const worktree = join(folder(), 'fille')
    git('worktree', 'add', '-q', '-b', 'fille', worktree)
    const since = Date.now()
    writeFileSync(join(worktree, 'a.txt'), 'a2\n')
    gitIn(worktree)('commit', '-q', '-am', 'fille')
    expect(await committedSince(run, worktree, [join(worktree, 'a.txt')], since)).toEqual(
      new Set([join(worktree, 'a.txt')])
    )
    // Le dossier principal (branche main) n'a rien commité depuis.
    expect(await committedSince(run, dir, [join(dir, 'a.txt')], since)).toEqual(new Set())
  })

  it('heure du message inconnue (fil rejoué par l’agent) : tenu pour commité', async () => {
    const { dir } = repo()
    const a = join(dir, 'a.txt')
    expect(await committedSince(run, dir, [a], undefined)).toEqual(new Set([a]))
  })

  it('git en échec, absent ou qui lève : tenu pour commité, sans erreur', async () => {
    const { dir } = repo()
    const a = join(dir, 'a.txt')
    const failingLog: Run = async (file, args, options) =>
      args.includes('log')
        ? { code: 128, stdout: Buffer.from(''), stderr: 'fatal: bad object' }
        : gitCommand(file, args, options)
    expect(await committedSince(failingLog, dir, [a], Date.now())).toEqual(new Set([a]))
    const missing: Run = async () => ({
      code: 1,
      stdout: Buffer.from(''),
      stderr: 'spawn git ENOENT'
    })
    expect(await committedSince(missing, dir, [a], Date.now())).toEqual(new Set([a]))
    const throwing: Run = () => Promise.reject(new Error('boom'))
    expect(await committedSince(throwing, dir, [a], Date.now())).toEqual(new Set([a]))
  })

  it('aucun fichier : aucun appel à git', async () => {
    const never: Run = () => Promise.reject(new Error('appelé'))
    expect(await committedSince(never, folder(), [], Date.now())).toEqual(new Set())
  })
})
