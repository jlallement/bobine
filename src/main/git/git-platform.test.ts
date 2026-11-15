import { describe, expect, it } from 'vitest'
import type { Run, RunResult } from '../simulator/run'
import { GitChangesReader, gitConvertsEol } from '../changes/git'
import { Worktrees, type WorktreeInfo } from '../changes/worktrees'
import { explainMissingGit, gitEnv, missingGitMessage } from './git-queue'
import { isGitProgram, nativeGitPath, samePath, windowsGitConfig } from './git-platform'

const ok = (stdout = ''): RunResult => ({ code: 0, stdout: Buffer.from(stdout), stderr: '' })
const fail = (stderr: string): RunResult => ({ code: 1, stdout: Buffer.alloc(0), stderr })

describe('git sous Windows (fiche 229, lot 4)', () => {
  it('Unix : rien ne change (programme, chemins, environnement)', () => {
    expect(isGitProgram('/usr/bin/git', 'posix')).toBe(true)
    expect(isGitProgram('git.exe', 'posix')).toBe(false)
    expect(isGitProgram('Git', 'posix')).toBe(false)
    expect(nativeGitPath('/Users/x/dépôt', 'posix')).toBe('/Users/x/dépôt')
    expect(nativeGitPath('C:/x', 'posix')).toBe('C:/x')
    expect(samePath('/a/B', '/a/b', 'posix')).toBe(false)
    const env = { LANG: 'fr_FR.UTF-8', PATH: '/bin' }
    expect(gitEnv(env, 'posix')).toEqual({ ...env, LANGUAGE: 'C', GIT_TERMINAL_PROMPT: '0' })
  })

  it('Windows : git.exe, sans casse, chemin en \\ ou /', () => {
    expect(isGitProgram('git', 'windows')).toBe(true)
    expect(isGitProgram('C:\\Program Files\\Git\\cmd\\GIT.EXE', 'windows')).toBe(true)
    expect(isGitProgram('C:/Program Files/Git/cmd/git.exe', 'windows')).toBe(true)
    expect(isGitProgram('gh.exe', 'windows')).toBe(false)
    expect(isGitProgram('git.cmd', 'windows')).toBe(false)
  })

  it('Windows : chemins de git en chemins du système, lecteur en majuscule', () => {
    expect(nativeGitPath('C:/Users/x/dépôt', 'windows')).toBe('C:\\Users\\x\\dépôt')
    expect(nativeGitPath('c:/Users/x/', 'windows')).toBe('C:\\Users\\x\\')
    expect(nativeGitPath('//serveur/partage/dépôt', 'windows')).toBe('\\\\serveur\\partage\\dépôt')
    expect(nativeGitPath('.git', 'windows')).toBe('.git')
    expect(nativeGitPath('../main/.git', 'windows')).toBe('..\\main\\.git')
    expect(nativeGitPath('', 'windows')).toBe('')
    expect(samePath('C:/Users/X/Dépôt/', 'c:\\users\\x\\dépôt', 'windows')).toBe(true)
    expect(samePath('C:\\a\\b', 'C:\\a\\c', 'windows')).toBe(false)
  })

  it('Windows : chemins longs par GIT_CONFIG_*, sans écraser ceux de l’utilisateur', () => {
    expect(windowsGitConfig({})).toEqual({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.longpaths',
      GIT_CONFIG_VALUE_0: 'true'
    })
    const user = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'a.b', GIT_CONFIG_VALUE_0: 'c' }
    expect(windowsGitConfig(user)).toEqual({
      ...user,
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_1: 'core.longpaths',
      GIT_CONFIG_VALUE_1: 'true'
    })
    const env = gitEnv({ Path: 'C:\\Windows' }, 'windows')
    expect(env).toMatchObject({ LANGUAGE: 'C', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '1' })
  })

  it('git introuvable : Git for Windows sous Windows, outils d’Apple ailleurs', () => {
    expect(missingGitMessage('windows')).toMatch(/Git for Windows/)
    expect(missingGitMessage('posix')).toMatch(/xcode-select/)
    const missing = fail('spawn git.exe ENOENT')
    expect(explainMissingGit(missing, 'windows').stderr).toMatch(/Git for Windows/)
    expect(explainMissingGit(fail('spawn git ENOENT'), 'posix').stderr).toMatch(/xcode-select/)
  })
})

describe('fins de ligne (fiche 229, lot 4)', () => {
  it('conversion selon l’attribut, puis core.autocrlf', () => {
    expect(gitConvertsEol('i/lf    w/crlf  attr/                 \tf.txt', 'true')).toBe(true)
    expect(gitConvertsEol('i/lf    w/crlf  attr/                 \tf.txt', 'input')).toBe(true)
    expect(gitConvertsEol('i/lf    w/crlf  attr/                 \tf.txt', 'false')).toBe(false)
    expect(gitConvertsEol('i/lf    w/crlf  attr/                 \tf.txt', '')).toBe(false)
    expect(gitConvertsEol('i/lf    w/crlf  attr/text=auto        \tf.txt', '')).toBe(true)
    expect(gitConvertsEol('i/lf    w/crlf  attr/text eol=crlf    \tf.txt', 'false')).toBe(true)
    expect(gitConvertsEol('i/lf    w/crlf  attr/-text            \tf.txt', 'true')).toBe(false)
  })

  /** Dépôt simulé : `f.txt` en LF au dernier commit, en CRLF sur le disque. */
  function reader(autocrlf: string, calls: string[][]): Run {
    return async (_file, args) => {
      calls.push(args)
      if (args[0] === 'show') return ok('un\ndeux\n')
      if (args[0] === 'ls-files') return ok('i/lf    w/crlf  attr/                 \tf.txt\n')
      if (args[0] === 'config') return autocrlf ? ok(`${autocrlf}\n`) : fail('')
      return ok()
    }
  }

  async function diffOf(system: 'posix' | 'windows', autocrlf: string) {
    const { mkdtempSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'bobine-eol-'))
    writeFileSync(join(dir, 'f.txt'), 'un\r\ndeux\r\ntrois\r\n')
    const calls: string[][] = []
    const diff = await new GitChangesReader(reader(autocrlf, calls), 'git', system).fileDiff(
      dir,
      'f.txt'
    )
    return { diff, calls }
  }

  it('Windows + autocrlf : le diff compare sans les \\r, comme git', async () => {
    const { diff } = await diffOf('windows', 'true')
    expect(diff.newText).toBe('un\ndeux\ntrois\n')
  })

  it('Windows sans conversion : le fichier tel quel (git voit aussi les \\r)', async () => {
    const { diff } = await diffOf('windows', '')
    expect(diff.newText).toBe('un\r\ndeux\r\ntrois\r\n')
  })

  it('Unix : tel quel, sans aucune commande git de plus', async () => {
    const { diff, calls } = await diffOf('posix', 'true')
    expect(diff.newText).toBe('un\r\ndeux\r\ntrois\r\n')
    expect(calls.map((args) => args[0])).toEqual(['show'])
  })
})

describe('worktree verrouillé sous Windows (fiche 229, lot 4)', () => {
  const info: WorktreeInfo = {
    root: '/depot',
    path: '/depot/.worktrees/w',
    branch: 'bobine/w',
    base: 'abc'
  }
  const LOCKED = "error: failed to delete '/depot/.worktrees/w': Permission denied"

  function worktrees(
    system: 'posix' | 'windows',
    removals: RunResult[],
    removeDir: (path: string) => Promise<void> = async () => {}
  ) {
    const calls: string[] = []
    const run: Run = async (_file, args) => {
      calls.push(args.join(' '))
      if (args[0] === 'worktree' && args[1] === 'remove') return removals.shift() ?? ok()
      if (args[0] === 'status') return ok('')
      return ok('0')
    }
    const w = new Worktrees(run, 'git', { system, lockedRetryMs: 1, removeDir })
    return { calls, worktrees: w }
  }

  it('Windows : git a désinscrit le worktree ; le reste du dossier est effacé, puis prune', async () => {
    const removed: string[] = []
    const { calls, worktrees: w } = worktrees('windows', [fail(LOCKED)], async (path) => {
      removed.push(path)
    })
    await w.remove(info)
    expect(removed).toEqual([info.path])
    expect(calls.filter((c) => c.startsWith('worktree remove'))).toHaveLength(1)
    expect(calls).toContain('worktree prune')
    expect(calls).toContain('branch -D bobine/w')
  })

  it('Windows : encore verrouillé, le message le dit', async () => {
    const { worktrees: w } = worktrees('windows', [fail(LOCKED)], async () => {
      throw new Error("EBUSY: resource busy or locked, rmdir '/depot/.worktrees/w'")
    })
    await expect(w.remove(info)).rejects.toThrow(/EBUSY[\s\S]*|programme|program/)
  })

  it('Windows : une autre erreur de git passe telle quelle, sans rien effacer', async () => {
    const removed: string[] = []
    const { worktrees: w } = worktrees('windows', [fail('fatal: bad')], async (path) => {
      removed.push(path)
    })
    await expect(w.remove(info)).rejects.toThrow(/fatal: bad/)
    expect(removed).toEqual([])
  })

  it('Unix : une seule tentative, comme avant, sans rien effacer soi-même', async () => {
    const removed: string[] = []
    const { calls, worktrees: w } = worktrees('posix', [fail(LOCKED), ok()], async (path) => {
      removed.push(path)
    })
    await expect(w.remove(info)).rejects.toThrow(/Permission denied/)
    expect(calls.filter((c) => c.startsWith('worktree remove'))).toHaveLength(1)
    expect(removed).toEqual([])
  })
})
