/**
 * Portée d'office du Code reviewer (fiche 265, revue QA) contre de vrais dépôts git jetables : non
 * commité, branche courante, commits de la conversation (fiche 267 : jamais une fusion seule), dépôt
 * sans commit, branche de travail sans changement, branches principales reconnues.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EMPTY_TREE, reviewBrief } from '@shared/review'
import { gitCommand } from '../git/git-queue'
import { ReviewListError, reviewTarget, type TargetSource } from './review-target'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function repo(branch = 'main') {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'portee-')))
  dirs.push(dir)
  // Date des commits (secondes) : posée par l'essai, pour placer la création de la conversation.
  let clock = 1_800_000_000
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: `@${clock} +0000`,
        GIT_COMMITTER_DATE: `@${clock} +0000`
      }
    }).trim()
  git('init', '-q', '-b', branch)
  // L'utilisateur local du dépôt (revue QA : ses commits seuls sont ceux de la conversation).
  git('config', 'user.email', 't@example.invalid')
  const commit = (file: string, content: string, message = file, by?: string) => {
    clock += 60
    writeFileSync(join(dir, file), content)
    git('add', '.')
    git(...(by ? ['-c', `user.email=${by}`] : []), 'commit', '-q', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  const merge = (...args: string[]) => {
    clock += 60
    git('merge', '-q', '--no-ff', '-m', 'fusion', ...args)
    return git('rev-parse', 'HEAD')
  }
  /** L'instant présent des commits, en ms : la création d'une conversation « maintenant ». */
  const now = () => (clock + 30) * 1000
  const target = (auto = true, extra: Partial<TargetSource> = {}) =>
    reviewTarget(gitCommand, { workspace: dir, title: 'T', ...extra }, auto)
  return { dir, git, commit, merge, now, target }
}

/** Un `run` dont la commande `sub` de git dépasse son délai ; les autres passent. */
const slowOn =
  (sub: string): typeof gitCommand =>
  async (file, args, options) =>
    args[0] === sub
      ? { code: 1, stdout: Buffer.from(''), stderr: 'timeout', timedOut: true }
      : gitCommand(file, args, options)

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

  it('recette N1 : après une fusion de main dans la branche du travail, tous les commits de la conversation, pas la fusion seule', async () => {
    const r = repo('master')
    const started = r.now()
    // Rejoue le dépôt de la recette : l'appli commitée, deux travaux, `master` fusionné dans la
    // branche du premier (premier parent : la branche), puis `master` avancé sur la fusion.
    const root = r.commit('app.ts', 'app\n', 'feat: app')
    r.git('checkout', '-q', '-b', 'bobine/edition')
    r.commit('storage.ts', 'edition\n', 'feat: edition')
    r.git('checkout', '-q', 'master')
    r.commit('style.css', 'sombre\n', 'feat: theme')
    r.git('checkout', '-q', 'bobine/edition')
    const head = r.merge('master')
    r.git('checkout', '-q', 'master')
    r.git('merge', '-q', '--ff-only', 'bobine/edition')
    expect(r.git('rev-parse', 'HEAD')).toBe(head)
    const target = await r.target(true, { startedAt: started })
    expect(target).toMatchObject({ scope: 'commits', base: EMPTY_TREE, commit: head, commits: 4 })
    expect(target.files.sort()).toEqual(['app.ts', 'storage.ts', 'style.css'])
    expect(target.withUncommitted).toBeUndefined()
    // Ce qu'on relisait avant : la fusion contre son premier parent, le thème seul.
    expect(r.git('diff', '--name-only', `${head}^1`, head)).toBe('style.css')
    expect(root).not.toBe(head)
    const brief = reviewBrief(target)
    expect(brief).toContain('the 4 commits made during this conversation')
    expect(brief).toContain(`git diff ${EMPTY_TREE} ${head}`)
  })

  it('les commits d’après la création de la conversation seulement', async () => {
    const r = repo()
    r.commit('vieux.txt', 'v\n')
    const before = r.commit('avant.txt', 'a\n')
    const started = r.now()
    r.commit('b.txt', 'b\n')
    const head = r.commit('c.txt', 'c\n')
    const target = await r.target(true, { startedAt: started })
    expect(target).toMatchObject({ scope: 'commits', base: before, commit: head, commits: 2 })
    expect(target.files).toEqual(['b.txt', 'c.txt'])
    expect(reviewBrief(target)).toContain(`git diff ${before} ${head}`)
  })

  it('depuis le dernier commit relu, s’il est un ancêtre de HEAD', async () => {
    const r = repo()
    const started = r.now()
    r.commit('a.txt', 'a\n')
    const reviewed = r.commit('b.txt', 'b\n')
    const head = r.commit('c.txt', 'c\n')
    const target = await r.target(true, { startedAt: started, lastReviewed: reviewed })
    expect(target).toMatchObject({ scope: 'commits', base: reviewed, commit: head, commits: 1 })
    expect(target.files).toEqual(['c.txt'])
    // Rien de neuf depuis : la plage de la conversation, relue de nouveau (pas « rien »).
    const again = await r.target(true, { startedAt: started, lastReviewed: head })
    expect(again).toMatchObject({ scope: 'commits', base: EMPTY_TREE, commits: 3 })
    // Un commit relu qui n'est plus dans l'histoire (rebase) : ignoré.
    const gone = await r.target(true, { startedAt: started, lastReviewed: 'f'.repeat(40) })
    expect(gone).toMatchObject({ scope: 'commits', base: EMPTY_TREE, commits: 3 })
  })

  it('fusion seule qui réunit un travail de la conversation : sa base devient le point commun de ses parents', async () => {
    const r = repo()
    const common = r.commit('a.txt', 'a\n')
    r.commit('c.txt', 'c\n')
    // La conversation commence ; son travail part d'avant et commite sur sa branche.
    const started = r.now()
    r.git('checkout', '-q', '-b', 'cote', common)
    r.commit('b.txt', 'b\n')
    r.git('checkout', '-q', 'main')
    const head = r.merge('cote')
    const target = await r.target(true, { startedAt: started })
    expect(target).toMatchObject({ scope: 'commits', base: common, commit: head, commits: 3 })
    expect(target.files.sort()).toEqual(['b.txt', 'c.txt'])
  })

  it('revue QA : seule la fusion est de la conversation (ses côtés d’avant) : contre son premier parent', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    r.git('checkout', '-q', '-b', 'cote')
    r.commit('b.txt', 'b\n')
    r.git('checkout', '-q', 'main')
    const parent = r.commit('c.txt', 'c\n')
    // La conversation commence juste avant la fusion : elle n'a fait que fusionner.
    const started = r.now()
    const head = r.merge('cote')
    const target = await r.target(true, { startedAt: started })
    expect(target).toMatchObject({
      scope: 'commits',
      base: parent,
      commit: head,
      origin: 'conversation'
    })
    expect(target.files).toEqual(['b.txt'])
  })

  it('aucun commit de la conversation (ou création inconnue) : les 5 derniers', async () => {
    const r = repo()
    for (const n of [1, 2, 3, 4, 5, 6, 7]) r.commit(`${n}.txt`, `${n}\n`)
    const base = r.git('rev-parse', 'HEAD~5')
    const later = r.now() + 3_600_000
    for (const extra of [{}, { startedAt: later }]) {
      const target = await r.target(true, extra)
      expect(target).toMatchObject({ scope: 'commits', base, commits: 5 })
      expect(target.files).toEqual(['3.txt', '4.txt', '5.txt', '6.txt', '7.txt'])
    }
    // Moins de 5 commits en tout : depuis le début.
    const s = repo()
    const head = s.commit('a.txt', 'a\n')
    const target = await s.target()
    expect(target).toMatchObject({ scope: 'commits', base: EMPTY_TREE, commit: head, commits: 1 })
    expect(reviewBrief(target)).toContain('from the start of the repository')
  })

  it('non commité sur la branche principale : plus les commits non relus de la conversation', async () => {
    const r = repo()
    const before = r.commit('a.txt', 'a\n')
    const started = r.now()
    const head = r.commit('b.txt', 'b\n')
    writeFileSync(join(r.dir, 'a.txt'), 'a2\n')
    writeFileSync(join(r.dir, 'neuf.txt'), 'n\n')
    const target = await r.target(true, { startedAt: started })
    expect(target).toMatchObject({
      scope: 'commits',
      base: before,
      commit: head,
      commits: 1,
      withUncommitted: true
    })
    expect(target.files.sort()).toEqual(['a.txt', 'b.txt', 'neuf.txt'])
    expect(reviewBrief(target)).toContain(`\`git diff ${before}\``)
    // Tout est relu jusqu'à HEAD : le non commité seul.
    expect(await r.target(true, { startedAt: started, lastReviewed: head })).toMatchObject({
      scope: 'uncommitted',
      files: ['a.txt', 'neuf.txt']
    })
    // Pas de commit de la conversation : le non commité seul, comme avant.
    expect(await r.target(true)).toMatchObject({
      scope: 'uncommitted',
      files: ['a.txt', 'neuf.txt']
    })
  })

  it('revue QA : un commit d’un autre (un `git pull`) arrête la plage de la conversation', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    const started = r.now()
    const theirs = r.commit('pull.txt', 'p\n', 'theirs', 'collegue@example.invalid')
    const head = r.commit('b.txt', 'b\n')
    const target = await r.target(true, { startedAt: started })
    expect(target).toMatchObject({ scope: 'commits', base: theirs, commit: head, commits: 1 })
    expect(target.files).toEqual(['b.txt'])
  })

  it('revue QA : tout est déjà relu, dossier propre : la plage relue de nouveau, et dit', async () => {
    const r = repo()
    const started = r.now()
    r.commit('a.txt', 'a\n')
    const head = r.commit('b.txt', 'b\n')
    expect(await r.target(true, { startedAt: started, lastReviewed: head })).toMatchObject({
      scope: 'commits',
      origin: 'again',
      commits: 2,
      reviewedHead: head
    })
  })

  it('revue QA : clone superficiel, la plage part du commit frontière, jamais de l’arbre vide', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    r.commit('b.txt', 'b\n')
    r.commit('c.txt', 'c\n')
    const clone = realpathSync(mkdtempSync(join(tmpdir(), 'portee-clone-')))
    dirs.push(clone)
    execFileSync('git', ['clone', '-q', '--depth', '2', `file://${r.dir}`, clone])
    execFileSync('git', ['config', 'user.email', 't@example.invalid'], { cwd: clone })
    const boundary = execFileSync('git', ['rev-parse', 'HEAD~1'], {
      cwd: clone,
      encoding: 'utf8'
    }).trim()
    const target = await reviewTarget(gitCommand, { workspace: clone, title: 'T' }, true)
    expect(target).toMatchObject({ scope: 'commits', base: boundary, shallow: true, commits: 1 })
    expect(target.base).not.toBe(EMPTY_TREE)
    expect(target.files).toEqual(['c.txt'])
  })

  it('revue QA : git trop lent, une erreur claire, jamais « rien à relire »', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    await expect(
      reviewTarget(slowOn('diff'), { workspace: r.dir, title: 'T' }, true)
    ).rejects.toBeInstanceOf(ReviewListError)
    await expect(
      reviewTarget(slowOn('log'), { workspace: r.dir, title: 'T', startedAt: 0 }, true)
    ).rejects.toBeInstanceOf(ReviewListError)
  })

  it('revue QA : un sous-module changé n’est pas dans les fichiers, il est compté', async () => {
    const sub = repo()
    sub.commit('s.txt', 's\n')
    const r = repo()
    r.commit('a.txt', 'a\n')
    r.git('-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub.dir, 'vendor/sub')
    writeFileSync(join(r.dir, 'b.txt'), 'b\n')
    const target = await r.target(false)
    expect(target.files.sort()).toEqual(['.gitmodules', 'b.txt'])
    expect(target.submodules).toBe(1)
  })

  it('revue QA : une base de worktree qui ressemble à une option n’en est pas une', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    const out = join(r.dir, 'sortie.txt')
    await reviewTarget(
      gitCommand,
      { workspace: r.dir, title: 'T', worktree: { base: `--output=${out}` } },
      true
    ).catch(() => undefined)
    expect(existsSync(out)).toBe(false)
  })

  it('non commité sur une branche : la branche contre sa base, fichiers nouveaux compris', async () => {
    const r = repo()
    const base = r.commit('a.txt', 'a\n')
    r.git('checkout', '-q', '-b', 'travail')
    r.commit('b.txt', 'b\n')
    writeFileSync(join(r.dir, 'neuf.txt'), 'n\n')
    const target = await r.target()
    expect(target).toMatchObject({ scope: 'branch', base, baseBranch: 'main' })
    expect(target.files.sort()).toEqual(['b.txt', 'neuf.txt'])
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
    // Sur `develop` : ses commits, pas « la branche contre elle-même ».
    expect((await r.target()).scope).toBe('commits')
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
    expect((await t.target()).scope).toBe('commits')
  })

  it('sans `auto` (« Faire relire »), la portée reste le non commité', async () => {
    const r = repo()
    r.commit('a.txt', 'a\n')
    expect(await r.target(false)).toMatchObject({ scope: 'uncommitted', files: [] })
  })
})
