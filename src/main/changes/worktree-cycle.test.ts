import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import type { Run } from '../simulator/run'
import { gitCommand } from '../git/git-queue'
import { WorktreeCycle, type CycleTarget } from './worktree-cycle'
import { Worktrees } from './worktrees'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** Dépôt jetable sur `main`, avec son identité git (les tests committent), et un worktree. */
async function setup(): Promise<{
  root: string
  target: CycleTarget
  cycle: WorktreeCycle
  logged: string[]
}> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bob-cycle-')))
  dirs.push(root)
  writeFileSync(join(root, 'README.md'), '# Démo\n\nVersion 1\n')
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.name', 't')
  git(root, 'config', 'user.email', 't@example.invalid')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'init')
  const { workspace, ...worktree } = await new Worktrees(gitCommand).create(root)
  const logged: string[] = []
  const cycle = new WorktreeCycle(gitCommand, { log: (_id, line) => logged.push(line) })
  return { root, target: { id: 'c1', title: 'Essai', workspace, worktree }, cycle, logged }
}

const write = (target: CycleTarget, file: string, content: string) =>
  writeFileSync(join(target.worktree.path, file), content)

describe('cycle d’un worktree (fiche 110)', () => {
  it('départ relevé à la création : branche, date, sujet, modifications non commitées', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bob-cycle-'))
    dirs.push(root)
    writeFileSync(join(root, 'a.txt'), 'a\n')
    git(root, 'init', '-q', '-b', 'trunk')
    git(root, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'add', '.')
    git(
      root,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@example.invalid',
      'commit',
      '-q',
      '-m',
      'premier'
    )
    writeFileSync(join(root, 'a.txt'), 'b\n')
    writeFileSync(join(root, 'nouveau.txt'), 'x\n')
    const info = await new Worktrees(gitCommand).create(root)
    expect(info).toMatchObject({ baseBranch: 'trunk', baseSubject: 'premier', dirtyAtStart: 2 })
    expect(info.baseDate).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    // Les modifications du dossier d'origine ne sont pas dans le worktree.
    expect(readFileSync(join(info.path, 'a.txt'), 'utf8')).toBe('a\n')
  })

  it('état, commit des fichiers cochés seulement, annulation, journal', async () => {
    const { target, cycle, logged } = await setup()
    write(target, 'README.md', '# Démo\n\nVersion 2\n')
    write(target, 'nouveau.txt', 'x\n')
    let info = await cycle.info(target)
    expect(info).toMatchObject({
      baseBranch: 'main',
      baseSubject: 'init',
      dirtyAtStart: 0,
      dirty: 2,
      ahead: 0,
      behind: 0,
      merged: false,
      commits: [],
      pr: { ok: false, reason: 'no-gh' }
    })
    expect(info.baseShort).toHaveLength(7)
    expect(logged.some((l) => l.startsWith('git status --porcelain'))).toBe(true)

    await expect(cycle.commit(target, { message: ' ', files: ['README.md'] })).rejects.toThrow()
    await expect(cycle.commit(target, { message: 'feat: x', files: [] })).rejects.toThrow()
    await expect(
      cycle.commit(target, { message: 'feat: x', files: ['../README.md'] })
    ).rejects.toThrow('hors du dossier')

    const done = await cycle.commit(target, { message: 'feat: version 2', files: ['README.md'] })
    expect(done.short).toBe(done.hash.slice(0, 7))
    expect(git(target.worktree.path, 'show', '--stat', '--format=%s', 'HEAD')).toContain(
      'feat: version 2'
    )
    expect(git(target.worktree.path, 'show', '--name-only', '--format=', 'HEAD')).toBe('README.md')
    info = await cycle.info(target)
    expect(info).toMatchObject({ dirty: 1, ahead: 1, commits: ['feat: version 2'] })

    // Annuler le commit : les modifications reviennent à committer ; une seconde fois, refus.
    await cycle.undoCommit(target, done.hash)
    expect(await cycle.info(target)).toMatchObject({ dirty: 2 })
    await expect(cycle.undoCommit(target, done.hash)).rejects.toThrow()
  })

  it('fusion fast-forward : la base avance dans le dépôt principal', async () => {
    const { root, target, cycle } = await setup()
    expect(await cycle.merge(target)).toEqual({ status: 'nothing', base: 'main' })
    write(target, 'README.md', '# Démo\n\nVersion 2\n')
    expect(await cycle.merge(target)).toEqual({ status: 'dirty', count: 1 })
    await cycle.commit(target, { message: 'feat: v2', files: ['README.md'] })
    expect(await cycle.merge(target)).toEqual({
      status: 'merged',
      kind: 'fast-forward',
      base: 'main'
    })
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('# Démo\n\nVersion 2\n')
    expect(await cycle.info(target)).toMatchObject({ merged: true, ahead: 0 })
    expect(await cycle.merge(target)).toEqual({ status: 'nothing', base: 'main' })
  })

  it('fusion avec un commit sur la base, sans conflit : commit de fusion', async () => {
    const { root, target, cycle } = await setup()
    write(target, 'a.txt', 'a\n')
    await cycle.commit(target, { message: 'feat: a', files: ['a.txt'] })
    writeFileSync(join(root, 'b.txt'), 'b\n')
    git(root, 'add', '.')
    git(root, 'commit', '-q', '-m', 'b')
    expect(await cycle.info(target)).toMatchObject({ ahead: 1, behind: 1 })
    expect(await cycle.merge(target)).toEqual({ status: 'merged', kind: 'merge', base: 'main' })
    expect(existsSync(join(root, 'a.txt')) && existsSync(join(root, 'b.txt'))).toBe(true)
    expect(git(root, 'log', '--format=%s', '-1')).toMatch(/^Merge branch 'main'/)
  })

  it('conflit : listé, abandon, puis résolution et reprise', async () => {
    const { root, target, cycle } = await setup()
    write(target, 'README.md', '# Démo\n\nVersion 2\n')
    await cycle.commit(target, { message: 'feat: v2', files: ['README.md'] })
    writeFileSync(join(root, 'README.md'), '# Démo\n\nVersion 3\n')
    git(root, 'commit', '-q', '-am', 'v3')

    expect(await cycle.merge(target)).toEqual({ status: 'conflicts', files: ['README.md'] })
    expect((await cycle.info(target)).merging).toEqual({ files: ['README.md'] })
    // Marqueurs encore là : la reprise redit le conflit.
    expect(await cycle.mergeContinue(target)).toEqual({ status: 'conflicts', files: ['README.md'] })
    await cycle.mergeAbort(target)
    expect((await cycle.info(target)).merging).toBeUndefined()
    expect(readFileSync(join(target.worktree.path, 'README.md'), 'utf8')).toBe(
      '# Démo\n\nVersion 2\n'
    )

    // Pendant une fusion arrêtée, « Fusionner » reprend plutôt que de recommencer.
    expect(await cycle.merge(target)).toEqual({ status: 'conflicts', files: ['README.md'] })
    write(target, 'README.md', '# Démo\n\nVersion 2 et 3\n')
    expect(await cycle.merge(target)).toEqual({ status: 'merged', kind: 'merge', base: 'main' })
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('# Démo\n\nVersion 2 et 3\n')
    expect(git(root, 'status', '--porcelain')).toBe('')
  })

  it('base non extraite : la référence avance ; extraite dans un autre worktree : refus', async () => {
    const { root, target, cycle } = await setup()
    git(root, 'switch', '-q', '-c', 'autre')
    writeFileSync(join(root, 'autre.txt'), 'x\n')
    write(target, 'a.txt', 'a\n')
    await cycle.commit(target, { message: 'feat: a', files: ['a.txt'] })
    expect(await cycle.merge(target)).toEqual({
      status: 'merged',
      kind: 'fast-forward',
      base: 'main'
    })
    expect(git(root, 'rev-parse', 'main')).toBe(git(root, 'rev-parse', target.worktree.branch))
    // Le dossier principal, sur `autre`, n'a pas bougé.
    expect(existsSync(join(root, 'a.txt'))).toBe(false)
    expect(existsSync(join(root, 'autre.txt'))).toBe(true)

    const other = join(root, '.worktrees', 'ailleurs')
    git(root, 'worktree', 'add', '-q', other, 'main')
    write(target, 'b.txt', 'b\n')
    await cycle.commit(target, { message: 'feat: b', files: ['b.txt'] })
    await expect(cycle.merge(target)).rejects.toThrow('autre worktree')
  })

  it('base extraite avec des modifications : refusée d’avance, fichiers listés (fiche 123)', async () => {
    const { root, target, cycle } = await setup()
    write(target, 'README.md', '# Démo\n\nVersion 2\n')
    await cycle.commit(target, { message: 'feat: v2', files: ['README.md'] })
    // La base avance entre-temps : sans le refus d'avance, elle entrerait dans le worktree.
    writeFileSync(join(root, 'base.txt'), 'b\n')
    git(root, 'add', 'base.txt')
    git(root, 'commit', '-q', '-m', 'base')
    writeFileSync(join(root, 'README.md'), '# Démo\n\nbrouillon\n')
    writeFileSync(join(root, 'brouillon.txt'), 'x\n')
    const main = git(root, 'rev-parse', 'main')
    const branch = git(root, 'rev-parse', target.worktree.branch)
    expect(await cycle.merge(target)).toEqual({
      status: 'main-dirty',
      root,
      base: 'main',
      files: [
        { path: 'README.md', status: 'modified' },
        { path: 'brouillon.txt', status: 'untracked' }
      ]
    })
    expect(git(root, 'rev-parse', 'main')).toBe(main)
    expect(git(root, 'rev-parse', target.worktree.branch)).toBe(branch)
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('# Démo\n\nbrouillon\n')
    expect(await cycle.mainDirty(target)).toMatchObject({ root, base: 'main' })
  })

  it('base pas extraite dans le dépôt principal : son arbre ne compte pas (fiche 123)', async () => {
    const { root, target, cycle } = await setup()
    git(root, 'switch', '-q', '-c', 'autre')
    writeFileSync(join(root, 'README.md'), '# Démo\n\nbrouillon\n')
    write(target, 'a.txt', 'a\n')
    await cycle.commit(target, { message: 'feat: a', files: ['a.txt'] })
    expect(await cycle.mainDirty(target)).toBeUndefined()
    expect(await cycle.merge(target)).toMatchObject({ status: 'merged' })
  })

  it('« Mettre de côté » : stash, fusion, remise, entrée retirée (fiche 123)', async () => {
    const { root, target, cycle } = await setup()
    write(target, 'a.txt', 'a\n')
    await cycle.commit(target, { message: 'feat: a', files: ['a.txt'] })
    writeFileSync(join(root, 'README.md'), '# Démo\n\nbrouillon\n')
    writeFileSync(join(root, 'brouillon.txt'), 'x\n')
    expect(await cycle.merge(target, { stash: true })).toEqual({
      status: 'merged',
      kind: 'fast-forward',
      base: 'main',
      stash: { restored: true, count: 2 }
    })
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('a\n')
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('# Démo\n\nbrouillon\n')
    expect(readFileSync(join(root, 'brouillon.txt'), 'utf8')).toBe('x\n')
    expect(git(root, 'stash', 'list')).toBe('')
  })

  it('remise en conflit : l’entrée reste, et c’est dit (fiche 123)', async () => {
    const { root, target, cycle } = await setup()
    write(target, 'README.md', '# Démo\n\nVersion 2\n')
    await cycle.commit(target, { message: 'feat: v2', files: ['README.md'] })
    writeFileSync(join(root, 'README.md'), '# Démo\n\nbrouillon\n')
    const outcome = await cycle.merge(target, { stash: true })
    expect(outcome).toMatchObject({
      status: 'merged',
      stash: { restored: false, count: 1, conflicts: ['README.md'] }
    })
    const stash = outcome.status === 'merged' ? outcome.stash : undefined
    expect(stash && !stash.restored && stash.ref).toMatch(/^[0-9a-f]{7}$/)
    expect(git(root, 'stash', 'list').split('\n')).toHaveLength(1)
    expect(git(root, 'rev-parse', 'main')).toBe(git(root, 'rev-parse', target.worktree.branch))
  })

  it('erreur de git : les lignes error: en entier, jamais le seul « Aborting » (fiche 123)', async () => {
    const { root, target } = await setup()
    // Le dossier principal devient sale juste après la vérification : git refuse lui-même.
    const run: Run = async (command, args, options) => {
      if (args.includes('--ff-only')) writeFileSync(join(root, 'README.md'), 'brouillon\n')
      return gitCommand(command, args, options)
    }
    const cycle = new WorktreeCycle(run)
    write(target, 'README.md', '# Démo\n\nVersion 2\n')
    await cycle.commit(target, { message: 'feat: v2', files: ['README.md'] })
    const error = await cycle.merge(target).then(
      () => new Error('fusion acceptée'),
      (e: Error) => e
    )
    expect(error.message).toContain('dépôt principal')
    expect(error.message).toContain('error: Your local changes to the following files')
    expect(error.message).toContain('README.md')
    expect(error.message).not.toMatch(/Aborting\s*$/)
  })

  it('« Committer d’abord » : commit dans le dossier principal (fiche 123)', async () => {
    const { root, target, cycle } = await setup()
    writeFileSync(join(root, 'README.md'), '# Démo\n\nmère\n')
    writeFileSync(join(root, 'autre.txt'), 'x\n')
    const done = await cycle.commitMain(target, { message: 'feat: mère', files: ['README.md'] })
    expect(git(root, 'log', '--format=%s', '-1')).toBe('feat: mère')
    expect(git(root, 'rev-parse', 'HEAD')).toBe(done.hash)
    expect(git(root, 'status', '--porcelain')).toBe('?? autre.txt')
    await expect(cycle.commitMain(target, { message: 'x', files: ['../x'] })).rejects.toThrow()
  })

  it('PR par gh simulé : poussée, création, PR déjà là, et ce qui manque', async () => {
    const { root, target } = await setup()
    const bare = mkdtempSync(join(tmpdir(), 'bob-cycle-remote-'))
    dirs.push(bare)
    git(bare, 'init', '-q', '--bare', '-b', 'main')
    git(root, 'remote', 'add', 'origin', bare)
    const calls: string[][] = []
    let created = 0
    const run: Run = (file, args, options) => {
      if (file !== '/fake/gh') return gitCommand(file, args, options)
      calls.push(args)
      if (args[0] === 'auth')
        return Promise.resolve({ code: 0, stdout: Buffer.from(''), stderr: '' })
      if (args[1] === 'create') {
        created++
        return Promise.resolve(
          created === 1
            ? {
                code: 0,
                stdout: Buffer.from('Creating…\nhttps://github.com/o/r/pull/7\n'),
                stderr: ''
              }
            : { code: 1, stdout: Buffer.alloc(0), stderr: 'a pull request already exists' }
        )
      }
      return Promise.resolve({
        code: 0,
        stdout: Buffer.from('https://github.com/o/r/pull/7\n'),
        stderr: ''
      })
    }
    const withGh = new WorktreeCycle(run, { gh: () => '/fake/gh', ghCacheMs: 0 })
    expect((await withGh.info(target)).pr).toEqual({ ok: true, remote: 'origin' })
    // Branche suivie nulle part : rien à dire de ce qui n'est pas poussé.
    expect((await withGh.info(target)).unpushed).toBeUndefined()
    // Fiche 176 : le suivi de la PR a son `gh`.
    expect(await withGh.ghFor(target)).toBe('/fake/gh')
    write(target, 'a.txt', 'a\n')
    await withGh.commit(target, { message: 'feat: a', files: ['a.txt'] })
    expect(await withGh.pullRequest(target, { title: 'Page', body: 'corps' })).toEqual({
      url: 'https://github.com/o/r/pull/7',
      existed: false
    })
    expect(calls.at(-1)).toEqual([
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      target.worktree.branch,
      '--title',
      'Page',
      '--body',
      'corps'
    ])
    expect(git(bare, 'branch', '--list', target.worktree.branch)).toContain(target.worktree.branch)
    // Fiche 176 : poussée, rien en attente ; un nouveau commit l'est.
    expect((await withGh.info(target)).unpushed).toBe(0)
    write(target, 'b.txt', 'b\n')
    await withGh.commit(target, { message: 'feat: b', files: ['b.txt'] })
    expect((await withGh.info(target)).unpushed).toBe(1)
    expect(await withGh.pullRequest(target, { title: 'Page', body: '' })).toEqual({
      url: 'https://github.com/o/r/pull/7',
      existed: true
    })
    await expect(withGh.pullRequest(target, { title: ' ', body: '' })).rejects.toThrow()
    // 0.9.1, D15 : un commit fait hors de la barre (agent, terminal) est vu à la relecture.
    write(target, 'c.txt', 'c\n')
    git(target.worktree.path, 'add', 'c.txt')
    git(target.worktree.path, 'commit', '-q', '-m', 'feat: c (terminal)')
    const outside = await withGh.info(target)
    expect(outside.unpushed).toBe(1)
    expect(outside.commits[0]).toBe('feat: c (terminal)')
    // 0.9.1, D19 : la branche distante n'est supprimée que si elle porte encore le dernier
    // commit de la PR fusionnée ; des commits arrivés après la fusion la gardent.
    const pushedHead = git(bare, 'rev-parse', target.worktree.branch)
    const mergedEarlier = git(bare, 'rev-parse', `${target.worktree.branch}~1`)
    expect(await withGh.deleteRemoteBranch(target, mergedEarlier)).toBe('moved')
    expect(git(bare, 'rev-parse', target.worktree.branch)).toBe(pushedHead)
    expect(await withGh.deleteRemoteBranch(target, pushedHead)).toBe('deleted')
    expect(git(bare, 'branch', '--list', target.worktree.branch)).toBe('')
    // Déjà partie (GitHub supprime la branche à la fusion si le dépôt le demande).
    expect(await withGh.deleteRemoteBranch(target, pushedHead)).toBe('gone')

    // gh pas connecté ; gh absent ; pas de dépôt distant.
    const notLogged = new WorktreeCycle(
      (file, args, options) =>
        file === '/fake/gh'
          ? Promise.resolve({ code: 1, stdout: Buffer.alloc(0), stderr: 'not logged in' })
          : gitCommand(file, args, options),
      { gh: () => '/fake/gh' }
    )
    expect((await notLogged.info(target)).pr).toEqual({ ok: false, reason: 'not-logged' })
    await expect(notLogged.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow('gh')
    expect(await notLogged.ghFor(target)).toBeUndefined()
    git(root, 'remote', 'remove', 'origin')
    await expect(withGh.deleteRemoteBranch(target, pushedHead)).rejects.toThrow('distant')
    expect((await withGh.info(target)).pr).toEqual({ ok: false, reason: 'no-remote' })
    expect(await withGh.ghFor(target)).toBeUndefined()
    await expect(withGh.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow('distant')
  })

  it('gh non connecté : gardé quelques secondes seulement, oublié par « Actualiser » (0.9.1, D7)', async () => {
    const { target } = await setup()
    let logged = false
    let auths = 0
    const cycle = new WorktreeCycle(
      (file, args, options) => {
        if (file !== '/fake/gh') return gitCommand(file, args, options)
        auths++
        return Promise.resolve(
          logged
            ? { code: 0, stdout: Buffer.alloc(0), stderr: '' }
            : { code: 1, stdout: Buffer.alloc(0), stderr: 'not logged in' }
        )
      },
      { gh: () => '/fake/gh', ghMissCacheMs: 60_000 }
    )
    expect((await cycle.info(target)).pr).toEqual({ ok: false, reason: 'not-logged' })
    logged = true
    // Encore gardé…
    expect((await cycle.info(target)).pr).toEqual({ ok: false, reason: 'not-logged' })
    expect(auths).toBe(1)
    // … jusqu'à « Actualiser ».
    cycle.forgetGh()
    expect((await cycle.info(target)).pr).toMatchObject({ reason: 'no-remote' })
    expect(auths).toBe(2)
    // Connecté : gardé longtemps (5 min par défaut).
    await cycle.info(target)
    expect(auths).toBe(2)
    // Le délai par défaut d'un échec est court (15 s).
    let calls = 0
    const short = new WorktreeCycle(
      (file, args, options) => {
        if (file !== '/fake/gh') return gitCommand(file, args, options)
        calls++
        return Promise.resolve({ code: 1, stdout: Buffer.alloc(0), stderr: 'not logged in' })
      },
      { gh: () => '/fake/gh' }
    )
    const realNow = Date.now
    try {
      await short.info(target)
      const at = realNow()
      Date.now = () => at + 14_000
      await short.info(target)
      expect(calls).toBe(1)
      Date.now = () => at + 16_000
      await short.info(target)
      expect(calls).toBe(2)
    } finally {
      Date.now = realNow
    }
  })

  it('branche distante après la fusion : bail, refus du dépôt, entrées vérifiées (remarques 4, 5)', async () => {
    const { root, target } = await setup()
    const bare = mkdtempSync(join(tmpdir(), 'bob-cycle-remote-'))
    dirs.push(bare)
    git(bare, 'init', '-q', '--bare', '-b', 'main')
    git(root, 'remote', 'add', 'origin', bare)
    git(root, 'push', '-q', 'origin', 'main')
    write(target, 'a.txt', 'a\n')
    git(target.worktree.path, 'add', 'a.txt')
    git(target.worktree.path, 'commit', '-q', '-m', 'feat: a')
    git(target.worktree.path, 'push', '-q', 'origin', target.worktree.branch)
    const branch = target.worktree.branch
    const head = git(bare, 'rev-parse', branch)
    const mainHead = git(bare, 'rev-parse', 'main')
    // Quelqu'un pousse entre la lecture (`ls-remote`) et la suppression : le bail refuse.
    let race = true
    const racing = new WorktreeCycle((file, args, options) => {
      if (race && args.some((a) => a.startsWith('--force-with-lease'))) {
        race = false
        git(bare, 'update-ref', `refs/heads/${branch}`, mainHead)
      }
      return gitCommand(file, args, options)
    })
    expect(await racing.deleteRemoteBranch(target, head)).toBe('moved')
    expect(git(bare, 'rev-parse', branch)).toBe(mainHead)
    // Le dépôt refuse (branche protégée, ruleset) : une erreur avec son message, pas « gardée ».
    git(bare, 'update-ref', `refs/heads/${branch}`, head)
    writeFileSync(
      join(bare, 'hooks', 'pre-receive'),
      '#!/bin/sh\necho "GH006: Protected branch update failed" >&2\nexit 1\n'
    )
    chmodSync(join(bare, 'hooks', 'pre-receive'), 0o755)
    const cycle = new WorktreeCycle(gitCommand)
    await expect(cycle.deleteRemoteBranch(target, head)).rejects.toThrow('Protected branch')
    expect(git(bare, 'rev-parse', branch)).toBe(head)
    // Entrées vérifiées avant toute commande.
    await expect(cycle.deleteRemoteBranch(target, 'h1')).rejects.toThrow('invalid commit')
    await expect(cycle.deleteRemoteBranch(target, `${head} --force`)).rejects.toThrow(
      'invalid commit'
    )
    git(root, 'config', 'branch.main.remote', '.')
    await expect(cycle.deleteRemoteBranch(target, head)).rejects.toThrow('invalid remote')
  })

  it('date d’un commit : par le git configuré du cycle (suivi de la PR)', async () => {
    const { target } = await setup()
    const files: string[] = []
    const cycle = new WorktreeCycle(
      (file, args, options) => {
        files.push(file)
        return gitCommand('git', args, options)
      },
      { git: '/opt/custom/git' }
    )
    const head = git(target.worktree.path, 'rev-parse', 'HEAD')
    const seconds = Number(git(target.worktree.path, 'show', '-s', '--format=%ct', 'HEAD'))
    expect(await cycle.commitDate(target, head)).toBe(seconds * 1000)
    expect(await cycle.commitDate(target, 'a'.repeat(40))).toBeUndefined()
    expect(await cycle.commitDate(target, '--help')).toBeUndefined()
    expect(files).toEqual(['/opt/custom/git', '/opt/custom/git'])
  })

  it('« Committer » avec une suppression déjà indexée par git rm (0.9.1, D22)', async () => {
    const { target, cycle } = await setup()
    const wt = target.worktree.path
    mkdirSync(join(wt, '.github'))
    write(target, '.github/ci.yml', 'on: push\n')
    write(target, 'gone.txt', 'x\n')
    git(wt, 'add', '.')
    git(wt, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'ci')
    // Supprimé par `git rm` (indexé), supprimé à la main (pas indexé), et un fichier modifié.
    git(wt, 'rm', '-q', '.github/ci.yml')
    rmSync(join(wt, 'gone.txt'))
    write(target, 'README.md', '# Démo\n\nVersion 2\n')
    await cycle.commit(target, {
      message: 'chore: drop CI',
      files: ['.github/ci.yml', 'gone.txt', 'README.md']
    })
    expect(git(wt, 'show', '--name-status', '--format=', 'HEAD').split('\n').sort()).toEqual([
      'D\t.github/ci.yml',
      'D\tgone.txt',
      'M\tREADME.md'
    ])
    expect(git(wt, 'status', '--porcelain')).toBe('')
  })

  it('« Committer » prend les chemins tels quels, jamais comme motifs (relecture 0.9.1)', async () => {
    const { target, cycle } = await setup()
    const wt = target.worktree.path
    for (const name of ['a[1].txt', 'a1.txt', '*.txt', 'b.txt']) write(target, name, `${name}\n`)
    await cycle.commit(target, { message: 'feat: crochets', files: ['a[1].txt'] })
    expect(git(wt, 'show', '--name-only', '--format=', 'HEAD')).toBe('a[1].txt')
    await cycle.commit(target, { message: 'feat: étoile', files: ['*.txt'] })
    expect(git(wt, 'show', '--name-only', '--format=', 'HEAD')).toBe('*.txt')
    expect(git(wt, 'status', '--porcelain', '-uall').split('\n').sort()).toEqual([
      '?? a1.txt',
      '?? b.txt'
    ])
  })

  it('« Committer » un renommage (git mv) : l’ancien chemin part avec le nouveau', async () => {
    const { target, cycle } = await setup()
    const wt = target.worktree.path
    mkdirSync(join(wt, 'docs'))
    write(target, 'docs/old.md', 'texte\n')
    git(wt, 'add', '.')
    git(wt, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'old')
    git(wt, 'mv', 'docs/old.md', 'docs/new.md')
    // Le renderer n'envoie que le nouveau chemin.
    await cycle.commit(target, { message: 'docs: rename', files: ['docs/new.md'] })
    expect(git(wt, 'show', '-M', '--name-status', '--format=', 'HEAD')).toBe(
      'R100\tdocs/old.md\tdocs/new.md'
    )
    expect(git(wt, 'status', '--porcelain')).toBe('')
  })

  it('orphelins : worktrees de Bobine sans conversation, nettoyés avec leur branche', async () => {
    const { root, target, cycle } = await setup()
    const orphan = join(root, '.worktrees', '20261001-1200-dead')
    git(root, 'worktree', 'add', '-q', '-b', 'bobine/20261001-1200-dead', orphan, 'HEAD')
    writeFileSync(join(orphan, 'x.txt'), 'x\n')
    git(orphan, 'add', '.')
    git(orphan, 'commit', '-q', '-m', 'orphelin')
    writeFileSync(join(orphan, 'y.txt'), 'y\n')
    // Un worktree hors de `.worktrees/` n'est pas à Bobine.
    git(root, 'worktree', 'add', '-q', join(root, '..', 'ailleurs-' + Date.now()), '-b', 'perso')
    const found = await cycle.orphans(
      [root, join(root, 'sous'), '/nulle/part'],
      new Set([target.worktree.path])
    )
    expect(found).toEqual([
      { root, path: orphan, branch: 'bobine/20261001-1200-dead', dirty: 1, ahead: 1 }
    ])
    await cycle.removeOrphan({ root, path: orphan, branch: 'bobine/20261001-1200-dead' })
    expect(existsSync(orphan)).toBe(false)
    expect(git(root, 'branch', '--list', 'bobine/20261001-1200-dead')).toBe('')
    expect(await cycle.orphans([root], new Set([target.worktree.path]))).toEqual([])
    await expect(cycle.removeOrphan({ root, path: root, branch: '' })).rejects.toThrow()
    for (const line of git(root, 'worktree', 'list', '--porcelain').split('\n')) {
      if (line.startsWith('worktree ') && line.includes('ailleurs-')) {
        rmSync(line.slice('worktree '.length), { recursive: true, force: true })
      }
    }
  })
})

describe('« Committer » hors worktree (fiche 123)', () => {
  /** Dépôt ordinaire, sans worktree : le dossier de la conversation en est un sous-dossier. */
  function plain(): { root: string; place: { id: string; workspace: string; cwd: string } } {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'bob-commit-')))
    dirs.push(root)
    writeFileSync(join(root, 'README.md'), '# Démo\n')
    git(root, 'init', '-q', '-b', 'main')
    git(root, 'config', 'user.name', 't')
    git(root, 'config', 'user.email', 't@example.invalid')
    git(root, 'add', '.')
    git(root, 'commit', '-q', '-m', 'init')
    return { root, place: { id: 'c1', workspace: root, cwd: root } }
  }

  it('fichiers cochés seulement, puis « Défaire » tant que c’est le dernier', async () => {
    const { root, place } = plain()
    const cycle = new WorktreeCycle(gitCommand)
    writeFileSync(join(root, 'README.md'), '# Démo\n\nVersion 2\n')
    writeFileSync(join(root, 'nouveau.txt'), 'x\n')
    const done = await cycle.commitIn(place, { message: 'feat: v2', files: ['README.md'] })
    expect(git(root, 'show', '--name-only', '--format=%s', 'HEAD')).toBe('feat: v2\n\nREADME.md')
    expect(git(root, 'status', '--porcelain')).toBe('?? nouveau.txt')
    await cycle.undoCommitIn(place, done.hash)
    expect(git(root, 'log', '--format=%s')).toBe('init')
    expect(git(root, 'status', '--porcelain')).toBe('M  README.md\n?? nouveau.txt')
    await expect(cycle.undoCommitIn(place, done.hash)).rejects.toThrow()
  })

  it('dossier dans un sous-dossier du dépôt : chemins relatifs au dossier', async () => {
    const { root } = plain()
    const sub = join(root, 'app')
    execFileSync('mkdir', [sub])
    writeFileSync(join(sub, 'a.txt'), 'a\n')
    const cycle = new WorktreeCycle(gitCommand)
    await cycle.commitIn(
      { id: 'c1', workspace: sub, cwd: sub },
      { message: 'feat: a', files: ['a.txt'] }
    )
    expect(git(root, 'show', '--name-only', '--format=', 'HEAD')).toBe('app/a.txt')
  })

  it('« Défaire » refusé une fois le commit poussé', async () => {
    const { root, place } = plain()
    const bare = realpathSync(mkdtempSync(join(tmpdir(), 'bob-commit-bare-')))
    dirs.push(bare)
    git(bare, 'init', '-q', '--bare', '-b', 'main')
    git(root, 'remote', 'add', 'origin', bare)
    git(root, 'push', '-q', '-u', 'origin', 'main')
    const cycle = new WorktreeCycle(gitCommand)
    writeFileSync(join(root, 'a.txt'), 'a\n')
    const done = await cycle.commitIn(place, { message: 'feat: a', files: ['a.txt'] })
    git(root, 'push', '-q')
    await expect(cycle.undoCommitIn(place, done.hash)).rejects.toThrow(
      t('worktreeCycle.error.pushed')
    )
    expect(git(root, 'rev-parse', 'HEAD')).toBe(done.hash)
  })
})
