import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runCommand, type Run, type RunResult } from '../simulator/run'
import { abs, ON_WINDOWS } from '../test-platform'
import { windowsGitConfig } from './git-platform'
import {
  explainMissingGit,
  gitCall,
  gitEnv,
  GitQueue,
  missingFolderMessage,
  missingGitMessage,
  queuedGit,
  repoKeyOf,
  withGitLanguage
} from './git-queue'

/**
 * Environnement de git de la machine : tel quel sous Unix ; sous Windows, avec les chemins longs
 * (`core.longpaths`, lot 4 de la fiche 229).
 */
const machineGit = (env: NodeJS.ProcessEnv) => (ON_WINDOWS ? windowsGitConfig(env) : env)
/** Conseil d'installation de git : outils d'Apple sous Unix, Git for Windows sous Windows. */
const INSTALL_HINT = ON_WINDOWS ? 'Git for Windows' : 'xcode-select --install'

const ok = (stdout = ''): RunResult => ({ code: 0, stdout: Buffer.from(stdout), stderr: '' })
const LOCK_ERROR = [
  "fatal: Unable to create '/depot/.git/index.lock': File exists.",
  '',
  'Another git process seems to be running in this repository, e.g.',
  "an editor opened by 'git commit'. Please make sure all processes",
  'are terminated then try again. If it still fails, a git process',
  'may have crashed in this repository earlier:',
  'remove the file manually to continue.'
].join('\n')

describe('langue des messages de git (fiche 145)', () => {
  it('LANGUAGE=C : messages en anglais, même sous LC_ALL français, jeu de caractères gardé', () => {
    const env = gitEnv(
      { LANG: 'fr_FR.UTF-8', LC_ALL: 'fr_FR.UTF-8', LANGUAGE: 'fr', PATH: '/bin' },
      'posix'
    )
    expect(env).toEqual({
      LANG: 'fr_FR.UTF-8',
      LC_ALL: 'fr_FR.UTF-8',
      LANGUAGE: 'C',
      GIT_TERMINAL_PROMPT: '0',
      PATH: '/bin'
    })
  })

  it('seulement pour git, à partir de l’environnement du moment ou de celui de l’appel', async () => {
    const seen: { file: string; env?: NodeJS.ProcessEnv }[] = []
    const run: Run = async (file, _args, options = {}) => {
      seen.push({ file, ...(options.env ? { env: options.env } : {}) })
      return ok()
    }
    const english = withGitLanguage(run, () => ({ LANG: 'fr_FR.UTF-8' }))
    await english('/usr/bin/git', ['status'])
    await english('gh', ['pr', 'list'])
    await english('git', ['log'], { env: { LANG: 'de_DE.UTF-8' } })
    expect(seen).toEqual([
      {
        file: '/usr/bin/git',
        env: machineGit({ LANG: 'fr_FR.UTF-8', LANGUAGE: 'C', GIT_TERMINAL_PROMPT: '0' })
      },
      { file: 'gh' },
      {
        file: 'git',
        env: machineGit({ LANG: 'de_DE.UTF-8', LANGUAGE: 'C', GIT_TERMINAL_PROMPT: '0' })
      }
    ])
  })

  it('git absent (fiche 195) : message clair au lieu de « spawn git ENOENT »', async () => {
    const english = withGitLanguage(async (file) => ({
      code: 1,
      stdout: Buffer.from(''),
      stderr: `spawn ${file} ENOENT`
    }))
    const missing = await english('/nulle/part/git', ['status'])
    expect(missing.stderr).toContain(INSTALL_HINT)
    expect(missing.stderr).not.toContain('ENOENT')
    const xcrun = await withGitLanguage(async () => ({
      code: 1,
      stdout: Buffer.from(''),
      stderr: 'xcrun: error: invalid active developer path (/Library/Developer/CommandLineTools)'
    }))('git', ['status'])
    expect(xcrun.stderr).toContain(INSTALL_HINT)
  })

  it('vrai git introuvable dans le PATH : le même message', async () => {
    const result = await withGitLanguage(runCommand)('git', ['--version'], {
      env: { PATH: '/nulle/part' }
    })
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain(INSTALL_HINT)
  })

  it('dossier de travail disparu (recette, fiche 272) : le dossier manque, pas git', async () => {
    const gone = join(realpathSync(tmpdir()), `bobine-dossier-disparu-${process.pid}`)
    rmSync(gone, { recursive: true, force: true })
    const result = await withGitLanguage(runCommand)('git', ['status'], { cwd: gone })
    expect(result.code).not.toBe(0)
    expect(result.stderr).not.toContain(INSTALL_HINT)
    expect(result.stderr).toContain(gone)
  })

  describe('reconnaissance de « spawn … ENOENT », toutes plateformes (fiche 272)', () => {
    const failed = (stderr: string): RunResult => ({ code: -2, stdout: Buffer.from(''), stderr })
    const recognised = [
      'spawn git ENOENT',
      'spawn git.exe ENOENT',
      'spawn /usr/bin/git ENOENT',
      'spawn /opt/homebrew/bin/git ENOENT',
      'spawn /Users/moi/mes outils/bin/git ENOENT',
      'spawn C:\\Git\\cmd\\git.exe ENOENT',
      'spawn C:\\Program Files\\Git\\ucrt64\\bin\\git.exe ENOENT',
      'spawn C:\\Program Files (x86)\\Git\\cmd\\GIT.EXE ENOENT',
      'Error: spawn C:\\Program Files\\Git\\cmd\\git ENOENT'
    ]
    const ignored = [
      'spawn gitk ENOENT',
      'spawn /usr/bin/digit ENOENT',
      'spawn C:\\Tools\\legit.exe ENOENT',
      'spawn C:\\Program Files\\Git\\bin\\git-lfs.exe ENOENT',
      'spawn /usr/bin/git EACCES',
      'respawn git ENOENT',
      'fatal: not a git repository'
    ]

    it.each(recognised)('git introuvable : %s', (stderr) => {
      for (const system of ['posix', 'windows'] as const) {
        expect(explainMissingGit(failed(stderr), system).stderr).toBe(missingGitMessage(system))
      }
    })

    it.each(ignored)('autre chose, laissé tel quel : %s', (stderr) => {
      expect(explainMissingGit(failed(stderr), 'windows').stderr).toBe(stderr)
    })

    it('le chemin de git sur une ligne, ENOENT sur une autre : pas reconnu', () => {
      const stderr = 'spawn C:\\Program Files\\Git\\cmd\\\ngit ENOENT'
      expect(explainMissingGit(failed(stderr), 'windows').stderr).toBe(stderr)
    })

    it('dossier disparu, git dans « Program Files » : le dossier manque, pas git', () => {
      const gone = join(realpathSync(tmpdir()), `bobine-disparu-program-files-${process.pid}`)
      rmSync(gone, { recursive: true, force: true })
      const stderr = 'spawn C:\\Program Files\\Git\\ucrt64\\bin\\git.exe ENOENT'
      const result = explainMissingGit(failed(stderr), 'windows', gone)
      expect(result.stderr).toBe(missingFolderMessage(gone))
      expect(result.stderr).toContain(gone)
    })

    it('réussite : jamais réécrite, même avec un stderr qui ressemble', () => {
      const result = { ...failed('spawn git ENOENT'), code: 0 }
      expect(explainMissingGit(result, 'windows')).toBe(result)
    })
  })
})

/** Faux `git` : chaque appel attend qu'on le libère ; relève ce qui tourne en même temps. */
function controlledRun() {
  const running = new Set<string>()
  const overlaps: string[][] = []
  const started: string[] = []
  const release = new Map<string, (result?: RunResult) => void>()
  const run: Run = (_file, args) => {
    const name = args.join(' ')
    started.push(name)
    running.add(name)
    if (running.size > 1) overlaps.push([...running].sort())
    return new Promise<RunResult>((resolve) => {
      release.set(name, (result = ok()) => {
        running.delete(name)
        resolve(result)
      })
    })
  }
  const finish = async (name: string, result?: RunResult) => {
    const done = release.get(name)
    if (!done) throw new Error(`${name} n’a pas commencé (commencés : ${started.join(', ')})`)
    release.delete(name)
    done(result)
    await flush()
  }
  return { run, started, overlaps, finish }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('lecture ou écriture', () => {
  it.each([
    [['status', '--porcelain'], 'read'],
    [['--no-optional-locks', 'status'], 'read'],
    [['rev-parse', '--show-toplevel'], 'read'],
    [['diff', 'HEAD', '--numstat'], 'read'],
    [['worktree', 'list', '--porcelain'], 'read'],
    [['stash', 'list', '--format=%H'], 'read'],
    [['symbolic-ref', '--quiet', '--short', 'HEAD'], 'read'],
    [['config', '--get', 'remote.origin.url'], 'read'],
    [['remote'], 'read'],
    [['branch', '--show-current'], 'read'],
    [['-C', '/x', 'ls-files', '-z'], 'read'],
    [['commit', '-q', '-m', 'x'], 'write'],
    [['-c', 'core.editor=true', 'merge', '--continue'], 'write'],
    [['merge', '--ff-only', 'b'], 'write'],
    [['stash', 'push', '-u'], 'write'],
    [['stash', 'apply', 'abc'], 'write'],
    [['worktree', 'add', '-b', 'b', '/p', 'HEAD'], 'write'],
    [['worktree', 'remove', '/p'], 'write'],
    [['checkout', 'main'], 'write'],
    [['branch', '-D', 'b'], 'write'],
    [['branch', '-f', 'main', 'b'], 'write'],
    [['symbolic-ref', 'HEAD', 'refs/heads/b'], 'write'],
    [['add', '--', 'a'], 'write'],
    [['push', '-u', 'origin', 'b'], 'write'],
    [['inconnue'], 'write']
  ])('git %j : %s', (args, kind) => {
    expect(gitCall(args as string[], '/depot').kind).toBe(kind)
  })

  it('`-C` déplace le dossier, relatif au dossier courant', () => {
    expect(gitCall(['-C', 'sous', 'status'], abs('/depot')).dir).toBe(abs('/depot/sous'))
    expect(gitCall(['-C', abs('/ailleurs'), 'status'], abs('/depot')).dir).toBe(abs('/ailleurs'))
    expect(gitCall(['status'], abs('/depot')).dir).toBe(abs('/depot'))
  })
})

describe('GitQueue', () => {
  it('deux écritures concurrentes ne se chevauchent pas, dans l’ordre d’arrivée', async () => {
    const git = controlledRun()
    const queue = new GitQueue()
    const a = queue.run('write', () => git.run('git', ['commit', 'a']))
    const b = queue.run('write', () => git.run('git', ['merge', 'b']))
    await flush()
    expect(git.started).toEqual(['commit a'])
    await git.finish('commit a')
    expect(git.started).toEqual(['commit a', 'merge b'])
    await git.finish('merge b')
    await Promise.all([a, b])
    expect(git.overlaps).toEqual([])
  })

  it('une lecture attend l’écriture en cours ; les lectures passent ensemble', async () => {
    const git = controlledRun()
    const queue = new GitQueue()
    const write = queue.run('write', () => git.run('git', ['commit']))
    const reads = [
      queue.run('read', () => git.run('git', ['status'])),
      queue.run('read', () => git.run('git', ['diff']))
    ]
    await flush()
    expect(git.started).toEqual(['commit'])
    await git.finish('commit')
    expect(git.started).toEqual(['commit', 'status', 'diff'])
    expect(git.overlaps).toEqual([['diff', 'status']])
    await git.finish('status')
    await git.finish('diff')
    await Promise.all([write, ...reads])
  })

  it('une écriture attend les lectures en cours ; une lecture arrivée après elle attend aussi', async () => {
    const git = controlledRun()
    const queue = new GitQueue()
    const first = queue.run('read', () => git.run('git', ['status', '1']))
    const write = queue.run('write', () => git.run('git', ['commit']))
    const late = queue.run('read', () => git.run('git', ['status', '2']))
    await flush()
    expect(git.started).toEqual(['status 1'])
    await git.finish('status 1')
    expect(git.started).toEqual(['status 1', 'commit'])
    await git.finish('commit')
    expect(git.started).toEqual(['status 1', 'commit', 'status 2'])
    await git.finish('status 2')
    await Promise.all([first, write, late])
    expect(git.overlaps).toEqual([])
  })

  it('une tâche qui échoue (même à l’appel) libère la file', async () => {
    const queue = new GitQueue()
    await expect(
      queue.run('write', () => {
        throw new Error('boum')
      })
    ).rejects.toThrow('boum')
    await expect(queue.run('write', () => Promise.reject(new Error('non')))).rejects.toThrow('non')
    await expect(queue.run('read', () => Promise.resolve(3))).resolves.toBe(3)
  })
})

describe('queuedGit', () => {
  it('une file par dépôt : deux dépôts écrivent en même temps, `gh` passe tout droit', async () => {
    const git = controlledRun()
    const run = queuedGit(git.run, { keyOf: (dir) => dir })
    const a = run('git', ['commit', 'a'], { cwd: '/a' })
    const b = run('/usr/bin/git', ['commit', 'b'], { cwd: '/b' })
    const a2 = run('git', ['commit', 'a2'], { cwd: '/a' })
    const gh = run('gh', ['pr', 'view'], { cwd: '/a' })
    await flush()
    expect([...git.started].sort()).toEqual(['commit a', 'commit b', 'pr view'])
    await git.finish('commit a')
    expect(git.started).toContain('commit a2')
    await Promise.all([git.finish('commit b'), git.finish('commit a2'), git.finish('pr view')])
    await Promise.all([a, b, a2, gh])
  })

  it('une lecture passe `--no-optional-locks` (pas d’`index.lock` pris au passage)', async () => {
    const run = vi.fn<Run>().mockResolvedValue(ok())
    const queued = queuedGit(run, { keyOf: () => 'k' })
    await queued('git', ['status', '--porcelain'], { cwd: '/d' })
    await queued('git', ['--no-optional-locks', 'status'], { cwd: '/d' })
    await queued('git', ['commit', '-m', 'x'], { cwd: '/d' })
    expect(run.mock.calls.map((call) => call[1])).toEqual([
      ['--no-optional-locks', 'status', '--porcelain'],
      ['--no-optional-locks', 'status'],
      ['commit', '-m', 'x']
    ])
  })

  it('verrou `index.lock` : relancé une fois après le délai, puis réussi', async () => {
    vi.useFakeTimers()
    const run = vi
      .fn<Run>()
      .mockResolvedValueOnce({ code: 128, stdout: Buffer.alloc(0), stderr: LOCK_ERROR })
      .mockResolvedValueOnce(ok('fait'))
    const queued = queuedGit(run, { keyOf: () => 'k', retryDelayMs: 400 })
    const result = queued('git', ['commit', '-m', 'x'], { cwd: '/depot' })
    await vi.advanceTimersByTimeAsync(399)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect((await result).stdout.toString()).toBe('fait')
    expect(run).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('verrou encore là à la relance : l’erreur de git rendue en entier ; autre erreur : pas de relance', async () => {
    const locked = vi
      .fn<Run>()
      .mockResolvedValue({ code: 128, stdout: Buffer.alloc(0), stderr: LOCK_ERROR })
    const queued = queuedGit(locked, { keyOf: () => 'k', retryDelayMs: 1 })
    const result = await queued('git', ['stash', 'push'], { cwd: '/depot' })
    expect(locked).toHaveBeenCalledTimes(2)
    expect(result.stderr).toBe(LOCK_ERROR)

    const conflict = vi
      .fn<Run>()
      .mockResolvedValue({ code: 1, stdout: Buffer.alloc(0), stderr: 'CONFLICT (content)' })
    await queuedGit(conflict, { keyOf: () => 'k', retryDelayMs: 1 })('git', ['merge', 'b'])
    expect(conflict).toHaveBeenCalledTimes(1)
  })
})

describe('repoKeyOf', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd,
      stdio: 'pipe'
    })

  it('un dépôt, ses sous-dossiers et ses worktrees partagent la même clé ; hors dépôt : le dossier', () => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-queue-')))
    const repo = join(dir, 'depot')
    mkdirSync(join(repo, 'src'), { recursive: true })
    git(repo, 'init', '-q')
    writeFileSync(join(repo, 'a.txt'), 'a\n')
    git(repo, 'add', 'a.txt')
    git(repo, 'commit', '-q', '-m', 'a')
    const worktree = join(repo, '.worktrees', 'w')
    git(repo, 'worktree', 'add', '-q', '-b', 'w', worktree)
    mkdirSync(join(worktree, 'src'), { recursive: true })

    const key = join(repo, '.git')
    expect(repoKeyOf(repo)).toBe(key)
    expect(repoKeyOf(join(repo, 'src'))).toBe(key)
    expect(repoKeyOf(worktree)).toBe(key)
    expect(repoKeyOf(join(worktree, 'src'))).toBe(key)
    const outside = join(dir, 'ailleurs')
    mkdirSync(outside)
    expect(repoKeyOf(outside)).toBe(outside)
    expect(repoKeyOf(join(dir, 'disparu'))).toBe(join(dir, 'disparu'))
  })
})
