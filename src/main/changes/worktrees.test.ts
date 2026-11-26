import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitCommand, queuedGit } from '../git/git-queue'
import type { Run } from '../simulator/run'
import { worktreeName, Worktrees } from './worktrees'

let dir = ''
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
    cwd,
    encoding: 'utf8'
  }).trim()

function repo(): string {
  dir = mkdtempSync(join(tmpdir(), 'bob-wt-'))
  mkdirSync(join(dir, 'app'))
  writeFileSync(join(dir, 'app', 'README.md'), 'un\n')
  git(dir, 'init', '-q', '-b', 'main')
  // Pas de maintenance en arrière-plan après le commit (`git maintenance run --auto --detach`) :
  // son `worktree prune` effacerait, selon la vitesse de la machine, le worktree à demi écrit
  // planté plus bas (vu sur le runner macOS de GitHub, fiche 138).
  git(dir, 'config', 'maintenance.auto', 'false')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'init')
  return dir
}

describe('worktrees', () => {
  it('nom : date, heure, suffixe', () => {
    expect(worktreeName(new Date(2026, 9, 12, 21, 5), 'a3f9')).toBe('20261012-2105-a3f9')
  })

  it('création depuis un sous-dossier, exclusion locale, état, suppression', async () => {
    const root = repo()
    const worktrees = new Worktrees(gitCommand)
    expect(await worktrees.canCreate(join(root, 'app'))).toBe(true)
    const info = await worktrees.create(join(root, 'app'))
    expect(info.branch).toMatch(/^bobine\/\d{8}-\d{4}-[0-9a-f]{4}$/)
    expect(info.workspace).toBe(join(info.path, 'app'))
    expect(readFileSync(join(info.workspace, 'README.md'), 'utf8')).toBe('un\n')
    // Le dépôt principal ne voit ni le worktree ni de fichier modifié.
    expect(git(root, 'status', '--porcelain')).toBe('')
    expect(readFileSync(join(root, '.git', 'info', 'exclude'), 'utf8')).toContain('/.worktrees/')

    expect(await worktrees.status(info)).toMatchObject({ dirty: 0, ahead: 0 })
    writeFileSync(join(info.workspace, 'README.md'), 'deux\n')
    git(info.path, 'commit', '-q', '-am', 'modif')
    writeFileSync(join(info.workspace, 'nouveau.txt'), 'x\n')
    expect(await worktrees.status(info)).toMatchObject({ dirty: 1, ahead: 1 })

    // Modifications non commitées : refus sans `force`, puis suppression forcée.
    await expect(worktrees.remove(info)).rejects.toThrow()
    await worktrees.remove(info, { force: true })
    expect(existsSync(info.path)).toBe(false)
    expect(git(root, 'branch', '--list', info.branch)).toBe('')
    // Une seconde fois : exclusion déjà là, pas de doublon.
    await worktrees.remove(await worktrees.create(root))
    expect(
      readFileSync(join(root, '.git', 'info', 'exclude'), 'utf8').match(/\/\.worktrees\//g)
    ).toHaveLength(1)
  })

  /** Tirages imposés, dans l'ordre : le nom du worktree est fait de la minute puis du tirage. */
  const draws = (...values: string[]) => {
    const queue = [...values]
    return () => queue.shift() ?? 'ffff'
  }

  it('même tirage dans la même minute : un autre nom est tiré, la création réussit (fix20)', async () => {
    const root = repo()
    const worktrees = new Worktrees(gitCommand, 'git', { draw: draws('abcd', 'abcd', 'beef') })
    const first = await worktrees.create(root)
    const second = await worktrees.create(root)
    expect(first.branch).toMatch(/-abcd$/)
    expect(second.branch).toMatch(/-beef$/)
    expect(second.path).not.toBe(first.path)
  })

  it('deux créations en même temps, même premier tirage : les deux réussissent, noms distincts (fix20)', async () => {
    const root = repo()
    const worktrees = new Worktrees(gitCommand, 'git', {
      draw: draws('abcd', 'abcd', 'c0de', 'f00d')
    })
    const [a, b] = await Promise.all([worktrees.create(root), worktrees.create(root)])
    expect(a.branch).not.toBe(b.branch)
    expect(new Set([a.path, b.path]).size).toBe(2)
  })

  it('collisions à chaque tirage : refus clair au bout de quelques essais, rien de créé en plus', async () => {
    const root = repo()
    const worktrees = new Worktrees(gitCommand, 'git', { draw: () => 'abcd' })
    await worktrees.create(root)
    await expect(worktrees.create(root)).rejects.toThrow()
    expect(git(root, 'worktree', 'list').split('\n')).toHaveLength(2)
  })

  /** Dépôt jetable et ses outils pour les essais des commits perdus (fiche 280). */
  function lostSetup() {
    const root = repo()
    const worktrees = new Worktrees(gitCommand)
    const commit = (cwd: string, file: string) => {
      writeFileSync(join(cwd, file), `${file}\n`)
      git(cwd, 'add', '.')
      git(cwd, 'commit', '-q', '-m', file)
    }
    return { root, worktrees, commit }
  }

  // « Commits perdus : seulement ceux qu'aucune autre branche ne garde » (D1 recette 1.0.0, fiche
  // 280), en trois essais (fix19 : un seul dépassait 15 s sous Windows), mêmes vérifications.
  it('commits perdus (1/3) : fille fusionnée dans `main` par une vraie fusion : rien de perdu', async () => {
    const { root, worktrees, commit } = lostSetup()
    const merged = await worktrees.create(root)
    for (const file of ['a.txt', 'b.txt', 'c.txt']) commit(merged.path, file)
    commit(root, 'main.txt')
    expect(await worktrees.status(merged)).toMatchObject({ ahead: 3 })
    git(root, 'merge', '-q', '--no-edit', merged.branch)
    expect(await worktrees.status(merged)).toMatchObject({ dirty: 0, ahead: 0 })
  })

  it('commits perdus (2/3) : non fusionnée, puis fusionnée en partie dans une autre branche', async () => {
    const { root, worktrees, commit } = lostSetup()
    // Fille non fusionnée : ses 3 commits restent annoncés, le départ et `main` ne comptent pas.
    const pending = await worktrees.create(root)
    commit(root, 'main2.txt')
    for (const file of ['d.txt', 'e.txt', 'f.txt']) commit(pending.path, file)
    expect(await worktrees.status(pending)).toMatchObject({ dirty: 0, ahead: 3 })
    // Fusionnée en partie (2 sur 3 en avance rapide dans une autre branche) : il en reste 1.
    git(root, 'branch', 'partiel', `${pending.branch}~1`)
    expect(await worktrees.status(pending)).toMatchObject({ ahead: 1 })
  })

  it('commits perdus (3/3) : gardés par la branche de la mère, une étiquette ou une branche distante', async () => {
    const { root, worktrees, commit } = lostSetup()
    // Fusionnée dans la branche de la mère, pas dans `main`, et `main` toujours en tête du dépôt.
    git(root, 'branch', 'mere')
    const child = await worktrees.create(root)
    commit(child.path, 'g.txt')
    commit(child.path, 'h.txt')
    git(root, 'branch', '-f', 'mere', child.branch)
    expect(git(root, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')
    expect(await worktrees.status(child)).toMatchObject({ ahead: 0 })

    // Commits gardés par une branche distante ou une étiquette : pas perdus non plus.
    const tagged = await worktrees.create(root)
    commit(tagged.path, 'i.txt')
    git(root, 'tag', 'v-essai', tagged.branch)
    expect(await worktrees.status(tagged)).toMatchObject({ ahead: 0 })
    const pushed = await worktrees.create(root)
    commit(pushed.path, 'j.txt')
    git(root, 'update-ref', 'refs/remotes/origin/essai', pushed.branch)
    expect(await worktrees.status(pushed)).toMatchObject({ ahead: 0 })
  })

  it('worktree créé avant la fiche 096 (branche bob/…) : toujours supprimé avec sa branche', async () => {
    const root = repo()
    const branch = 'bob/20261001-1200-abcd'
    const path = join(root, '.worktrees', '20261001-1200-abcd')
    const base = git(root, 'rev-parse', 'HEAD')
    git(root, 'worktree', 'add', '-q', '-b', branch, path, base)
    await new Worktrees(gitCommand).remove({ root, path, branch, base })
    expect(existsSync(path)).toBe(false)
    expect(git(root, 'branch', '--list', 'bob/*')).toBe('')
  })

  it('dossier hors dépôt ou dépôt sans commit : refusé clairement', async () => {
    dir = mkdtempSync(join(tmpdir(), 'bob-wt-'))
    const worktrees = new Worktrees(gitCommand)
    expect(await worktrees.canCreate(dir)).toBe(false)
    await expect(worktrees.create(dir)).rejects.toThrow('pas dans un dépôt git')
    git(dir, 'init', '-q')
    await expect(worktrees.create(dir)).rejects.toThrow('pas encore de commit')
  })

  it('worktree à demi écrit par un autre `worktree add` : refus clair ou worktree utilisable (fiche 138)', async () => {
    const root = repo()
    // Ce que voit un `worktree add` qui parcourt les worktrees pendant qu'un autre écrit encore
    // les siens : `commondir` créé, pas encore rempli.
    const half = join(root, '.git', 'worktrees', 'en-cours')
    mkdirSync(half, { recursive: true })
    writeFileSync(join(half, 'gitdir'), join(root, '.worktrees', 'en-cours', '.git') + '\n')
    writeFileSync(join(half, 'HEAD'), 'ref: refs/heads/main\n')
    writeFileSync(join(half, 'commondir'), '')
    // Ce que fait git ici n'est pas à Bobine : git 2.56 refuse, un autre git pourrait passer outre,
    // et une maintenance en arrière-plan peut avoir effacé l'entrée entre-temps. Ce que Bobine
    // garantit dans les deux cas est vérifié ; la file git évite la course entre ses propres
    // créations (test suivant).
    const outcome = await new Worktrees(gitCommand).create(root).then(
      (info) => ({ info }),
      (error: unknown) => ({ error })
    )
    if ('error' in outcome) {
      // Refus : la cause de git en entier (fiche 123), et pas de dossier de worktree. (git a déjà
      // créé la branche quand il s'arrête : elle reste, vide, sans dossier ; voir la fiche 138.)
      expect(String(outcome.error)).toMatch(/commondir/)
      expect(
        existsSync(join(root, '.worktrees')) ? readdirSync(join(root, '.worktrees')) : []
      ).toEqual([])
    } else {
      // Création : un worktree utilisable, sur sa branche, le dépôt principal intact.
      const { info } = outcome
      expect(readFileSync(join(info.path, 'app', 'README.md'), 'utf8')).toBe('un\n')
      expect(git(info.path, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(info.branch)
      expect(git(root, 'status', '--porcelain')).toBe('')
    }
  })

  it('créations en parallèle par la file git : jamais deux `worktree add` à la fois (fiche 138)', async () => {
    const root = repo()
    let running = 0
    let most = 0
    const counted: Run = async (file, args, options) => {
      const adding = args.includes('worktree')
      if (adding) most = Math.max(most, ++running)
      try {
        return await gitCommand(file, args, options)
      } finally {
        if (adding) running--
      }
    }
    const worktrees = new Worktrees(queuedGit(counted))
    const created = await Promise.all([1, 2, 3, 4].map(() => worktrees.create(root)))
    expect(new Set(created.map((info) => info.path)).size).toBe(4)
    expect(most).toBe(1)
  })
})
