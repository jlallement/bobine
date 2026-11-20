/**
 * Portée d'office du Code reviewer (fiche 265, revue QA) contre de vrais dépôts git jetables : non
 * commité, branche courante, dernier commit (fusion comprise), dépôt sans commit, branche de travail
 * sans changement, branches principales reconnues.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { reviewBrief } from '@shared/review'
import { gitCommand } from '../git/git-queue'
import { reviewTarget } from './review-target'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function repo(branch = 'main') {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'portee-')))
  dirs.push(dir)
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: dir,
      encoding: 'utf8'
    }).trim()
  git('init', '-q', '-b', branch)
  const commit = (file: string, content: string, message = file) => {
    writeFileSync(join(dir, file), content)
    git('add', '.')
    git('commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  const target = (auto = true) => reviewTarget(gitCommand, { workspace: dir, title: 'T' }, auto)
  return { dir, git, commit, target }
}

describe('portée d’office du Code reviewer (fiche 265)', () => {
  it('dépôt sans commit : tout est nouveau, la consigne ne parle pas de `git diff HEAD`', async () => {
    const r = repo()
    writeFileSync(join(r.dir, 'a.txt'), 'a\n')
    const target = await r.target()
    expect(target).toMatchObject({ scope: 'uncommitted', files: ['a.txt'], noCommit: true })
    const brief = reviewBrief(target)
    expect(brief).toContain('has no commit yet')
    expect(brief).not.toContain('git diff HEAD')
  })

  it('dernier commit contre son premier parent, un commit de fusion compris', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    r.git('checkout', '-q', '-b', 'cote')
    r.commit('b.txt', 'b\n')
    r.git('checkout', '-q', 'main')
    r.commit('c.txt', 'c\n')
    r.git(
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@x',
      'merge',
      '-q',
      '--no-ff',
      '-m',
      'fusion',
      'cote'
    )
    const head = r.git('rev-parse', 'HEAD')
    const parent = r.git('rev-parse', 'HEAD^1')
    const target = await r.target()
    // Ce que la fusion apporte à main : b.txt, rien de plus.
    expect(target).toMatchObject({ scope: 'commit', commit: head, base: parent, files: ['b.txt'] })
    expect(reviewBrief(target)).toContain(`git diff ${parent} ${head}`)
  })

  it('premier commit du dépôt : relu en entier (`git show`)', async () => {
    const r = repo()
    const head = r.commit('a.txt', 'a\n')
    const target = await r.target()
    expect(target).toMatchObject({ scope: 'commit', commit: head, files: ['a.txt'] })
    expect(target.base).toBeUndefined()
    expect(reviewBrief(target)).toContain(`git show ${head}`)
  })

  it('branche de travail sans changement : rien à relire, pas le commit de quelqu’un d’autre', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    r.git('checkout', '-q', '-b', 'neuve')
    expect(await r.target()).toMatchObject({ scope: 'uncommitted', files: [] })
    r.commit('b.txt', 'b\n')
    expect(await r.target()).toMatchObject({
      scope: 'branch',
      baseBranch: 'main',
      files: ['b.txt']
    })
  })

  it('`develop` et `trunk` sont des branches principales ; un nom de fichier qui ressemble à une révision', async () => {
    const r = repo('develop')
    r.commit('a.txt', 'a\n')
    // Sur `develop` : le dernier commit, pas « la branche contre elle-même ».
    expect((await r.target()).scope).toBe('commit')
    r.git('checkout', '-q', '-b', 'tri')
    // Un fichier nommé comme une branche : `--` sépare les révisions des chemins.
    r.commit('develop', 'x\n')
    expect(await r.target()).toMatchObject({
      scope: 'branch',
      baseBranch: 'develop',
      files: ['develop']
    })
    const t = repo('trunk')
    t.commit('a.txt', 'a\n')
    expect((await t.target()).scope).toBe('commit')
  })

  it('sans `auto` (« Faire relire »), la portée reste le non commité', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    expect(await r.target(false)).toMatchObject({ scope: 'uncommitted', files: [] })
  })
})
