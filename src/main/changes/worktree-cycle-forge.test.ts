/**
 * « Ouvrir une MR » sur GitLab (fiche 189, ADR-0041) : vrai git, dépôt distant nu local derrière
 * une URL GitLab (`pushurl`), `glab` simulé avec les sorties réelles de `fixtures/glab/`. Les refus
 * du serveur (droits, branche protégée) sont joués par un hook `pre-receive` du dépôt nu, avec
 * les messages relevés sur un GitLab CE.
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import type { Run, RunResult } from '../simulator/run'
import { gitCommand } from '../git/git-queue'
import { WorktreeCycle, type CycleTarget, type WorktreeCycleOptions } from './worktree-cycle'
import { Worktrees } from './worktrees'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', 'glab', name), 'utf8')
const result = (code: number, stdout = '', stderr = ''): Promise<RunResult> =>
  Promise.resolve({ code, stdout: Buffer.from(stdout), stderr })

const SECRET = 'glpat-NeverInLogs123' // gitleaks:allow — fake value for tests

/** Dépôt avec un worktree, et un dépôt distant nu poussé à travers une URL GitLab. */
async function setup(url: string) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bob-forge-')))
  const bare = realpathSync(mkdtempSync(join(tmpdir(), 'bob-forge-remote-')))
  dirs.push(root, bare)
  writeFileSync(join(root, 'README.md'), '# Démo\n')
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.name', 't')
  git(root, 'config', 'user.email', 't@example.invalid')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'init')
  git(bare, 'init', '-q', '--bare', '-b', 'main')
  git(root, 'remote', 'add', 'origin', url)
  git(root, 'config', 'remote.origin.pushurl', bare)
  const { workspace, ...worktree } = await new Worktrees(gitCommand).create(root)
  const target: CycleTarget = { id: 'c1', title: 'Essai', workspace, worktree }
  const commit = (file: string) => {
    writeFileSync(join(worktree.path, file), `${file}\n`)
    git(worktree.path, 'add', file)
    git(worktree.path, 'commit', '-q', '-m', `feat: ${file}`)
  }
  /** Le serveur refuse toute poussée avec ce message (comme GitLab). */
  const refuse = (message: string) => {
    const hook = join(bare, 'hooks', 'pre-receive')
    writeFileSync(hook, `#!/bin/sh\necho ${JSON.stringify(message)} >&2\nexit 1\n`)
    chmodSync(hook, 0o755)
  }
  const allow = () => rmSync(join(bare, 'hooks', 'pre-receive'), { force: true })
  return { root, bare, target, commit, refuse, allow }
}

/** `glab` simulé : connexion, création (une fois, puis « existe déjà »), liste des MR. */
function fakeGlab(options: { auth?: string; create?: () => Promise<RunResult> } = {}) {
  const calls: { args: string[]; input?: string | Buffer }[] = []
  let created = 0
  let open = false
  const run: Run = (file, args, opts) => {
    if (file !== '/fake/glab') return gitCommand(file, args, opts)
    calls.push({ args, ...(opts?.input !== undefined ? { input: opts.input } : {}) })
    if (args[0] === 'auth') {
      return options.auth
        ? result(1, '', options.auth)
        : result(0, '', fixture('auth-status-ok.txt'))
    }
    if (args[1] === 'create') {
      if (options.create) return options.create()
      created++
      if (created > 1) return result(1, '', fixture('mr-create-exists.stderr.txt'))
      open = true
      return result(0, fixture('mr-create-ok.stdout.txt'), '\nCreating merge request\n')
    }
    if (args[1] === 'list') {
      const branch = args.find((a) => a.startsWith('--source-branch='))?.split('=')[1] ?? ''
      return result(
        0,
        open ? fixture('mr-list-open.json').replaceAll('"feat-2"', JSON.stringify(branch)) : '[]'
      )
    }
    return result(1, '', 'unexpected')
  }
  return { run, calls }
}

const MR_URL = 'http://localhost:8929/qa-dev/demo/-/merge_requests/2'
const HOST = 'gitlab.acme.test'

/**
 * Cycle avec `glab` simulé et des configurations lues sans disque : `glab` déclare `gitlab.acme.test`
 * (comme sa configuration), `gh` ne déclare rien, aucun alias SSH.
 */
const cycleWith = (run: Run, over: WorktreeCycleOptions = {}) =>
  new WorktreeCycle(run, {
    glab: () => '/fake/glab',
    gh: () => undefined,
    glabHosts: async () => [{ host: HOST }],
    ghHosts: async () => [],
    sshHostName: async () => undefined,
    ...over
  })

describe('ouvrir une MR sur GitLab (fiche 189)', () => {
  it('branche poussée, MR vers la base (-R du dépôt poussé), lien, MR retrouvée, « Pousser vers la MR »', async () => {
    const { bare, target, commit } = await setup(`https://oauth2:${SECRET}@${HOST}/g/p.git`)
    const glab = fakeGlab()
    const logged: string[] = []
    const cycle = cycleWith(glab.run, { log: (_id, line) => logged.push(line) })
    expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin', noun: 'mr' })
    // Pas de suivi des contrôles sur GitLab pour l'instant : le suivi de la fiche 176 ne part pas.
    expect(await cycle.ghFor(target)).toBeUndefined()
    commit('a.txt')
    expect(await cycle.pullRequest(target, { title: 'Page', body: 'corps' })).toEqual({
      url: MR_URL,
      existed: false,
      noun: 'mr'
    })
    expect(glab.calls.find((c) => c.args[1] === 'create')).toEqual({
      args: [
        'mr',
        'create',
        `--repo=https://${HOST}/g/p`,
        `--source-branch=${target.worktree.branch}`,
        '--target-branch=main',
        '--title=Page',
        '--description-file',
        '-',
        '--yes'
      ],
      input: 'corps'
    })
    expect(git(bare, 'branch', '--list', target.worktree.branch)).toContain(target.worktree.branch)
    const pushed = await cycle.info(target)
    expect(pushed.pr).toMatchObject({ ok: true, open: { url: MR_URL, title: 'Page' } })
    expect(pushed.unpushed).toBe(0)
    commit('b.txt')
    expect((await cycle.info(target)).unpushed).toBe(1)
    expect(await cycle.pullRequest(target, { title: 'Page', body: '' })).toEqual({
      url: MR_URL,
      existed: true,
      noun: 'mr'
    })
    expect(git(bare, 'rev-parse', target.worktree.branch)).toBe(
      git(target.worktree.path, 'rev-parse', 'HEAD')
    )
    cycle.forgetGh()
    expect((await cycle.info(target)).pr).toMatchObject({ open: { url: MR_URL } })
    expect(
      glab.calls
        .filter((c) => c.args[1] === 'list')
        .every((c) => c.args[2] === `--repo=https://${HOST}/g/p`)
    ).toBe(true)
    // Jamais de jeton au journal, ni dans les arguments de glab.
    expect(logged.join('\n')).not.toContain(SECRET)
    expect(JSON.stringify(glab.calls)).not.toContain(SECRET)
    expect(logged.some((l) => l.startsWith(`glab auth status --hostname ${HOST} → 0`))).toBe(true)
  })

  it('fork : -R vise le dépôt distant de la base réellement poussé, pas upstream', async () => {
    const { root, target, commit } = await setup(`git@${HOST}:fork-owner/app.git`)
    git(root, 'remote', 'add', 'upstream', `git@${HOST}:team/app.git`)
    const glab = fakeGlab()
    const cycle = cycleWith(glab.run)
    commit('a.txt')
    await cycle.pullRequest(target, { title: 'Page', body: '' })
    expect(glab.calls.find((c) => c.args[1] === 'create')?.args[2]).toBe(
      `--repo=https://${HOST}/fork-owner/app`
    )
  })

  it('hôte SSH avec port, et ssh_host de glab : l’hôte web de glab', async () => {
    const { target } = await setup('ssh://git@ssh.acme.test:2222/g/p.git')
    const hosts: string[] = []
    const glab = fakeGlab()
    const run: Run = (file, args, opts) => {
      if (file === '/fake/glab' && args[0] === 'auth') hosts.push(args[3] ?? '')
      return glab.run(file, args, opts)
    }
    const cycle = cycleWith(run, {
      glabHosts: async () => [{ host: 'gitlab.acme.test:8443', sshHost: 'ssh.acme.test' }]
    })
    expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin', noun: 'mr' })
    expect(hosts).toEqual(['gitlab.acme.test:8443'])
  })

  it('alias SSH GitLab résolu par ssh -G ; ssh lancé sans jetons, alias après --', async () => {
    const { target } = await setup('git@gitlab-work:g/p.git')
    const ssh: { args: string[]; env?: NodeJS.ProcessEnv }[] = []
    const glab = fakeGlab()
    const run: Run = (file, args, opts) => {
      if (file === 'ssh') {
        ssh.push({ args, ...(opts?.env ? { env: opts.env } : {}) })
        return result(0, `user git\nhostname ${HOST}\nport 22\n`)
      }
      return glab.run(file, args, opts)
    }
    const saved = process.env['GITLAB_TOKEN']
    process.env['GITLAB_TOKEN'] = 'glpat-FromEnv'
    try {
      const cycle = new WorktreeCycle(run, {
        glab: () => '/fake/glab',
        gh: () => undefined,
        glabHosts: async () => [{ host: HOST }],
        ghHosts: async () => []
      })
      expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin', noun: 'mr' })
    } finally {
      if (saved === undefined) delete process.env['GITLAB_TOKEN']
      else process.env['GITLAB_TOKEN'] = saved
    }
    expect(ssh).toHaveLength(1)
    expect(ssh[0]?.args).toEqual(['-G', '--', 'gitlab-work'])
    expect(ssh[0]?.env?.['GITLAB_TOKEN']).toBeUndefined()
    expect(ssh[0]?.env?.['PATH']).toBe(process.env['PATH'])
  })

  it('glab absent, non connecté, révoqué, injoignable, certificat, sortie inattendue', async () => {
    const { target } = await setup(`git@${HOST}:g/p.git`)
    const absent = cycleWith(gitCommand, { glab: () => undefined })
    expect((await absent.info(target)).pr).toEqual({
      ok: false,
      reason: 'no-tool',
      noun: 'mr',
      host: HOST
    })
    await expect(absent.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      t('worktreeCycle.pr.noTool', { context: 'mr' })
    )
    for (const [file, reason] of [
      ['auth-status-not-logged.txt', 'not-logged'],
      ['auth-status-revoked.txt', 'not-logged'],
      ['auth-status-timeout.txt', 'unreachable'],
      ['auth-status-refused.txt', 'unreachable'],
      ['auth-status-certificate.txt', 'certificate']
    ] as const) {
      const cycle = cycleWith(fakeGlab({ auth: fixture(file) }).run)
      expect((await cycle.info(target)).pr, file).toEqual({
        ok: false,
        reason,
        noun: 'mr',
        host: HOST
      })
    }
    const odd = cycleWith(fakeGlab({ auth: 'panic: something odd' }).run)
    expect((await odd.info(target)).pr).toMatchObject({ ok: false, reason: 'unknown-forge' })
    const notLogged = cycleWith(fakeGlab({ auth: fixture('auth-status-not-logged.txt') }).run)
    await expect(notLogged.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      `glab auth login --hostname ${HOST}`
    )
    // Nom qui dit « gitlab », non déclaré, glab absent : installer glab, sans conseiller d'hôte.
    const guessed = await setup('https://gitlab.other.test/g/p.git')
    const none = cycleWith(gitCommand, { glab: () => undefined, glabHosts: async () => [] })
    expect((await none.info(guessed.target)).pr).toEqual({
      ok: false,
      reason: 'no-tool',
      noun: 'mr'
    })
  })

  it('poussée refusée (branche protégée, droits, clé SSH, identifiants, hôte), création impossible', async () => {
    const { target, commit, refuse, allow } = await setup(`https://${HOST}/g/p.git`)
    commit('a.txt')
    const cycle = cycleWith(fakeGlab().run)
    const host = { host: HOST, branch: target.worktree.branch }
    refuse('GitLab: You are not allowed to push code to protected branches on this project.')
    await expect(cycle.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      t('worktreeCycle.mr.error.protected', host)
    )
    refuse('You are not allowed to push code to this project.')
    await expect(cycle.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      t('worktreeCycle.mr.error.denied', host)
    )
    refuse('git@gitlab.acme.test: Permission denied (publickey).')
    await expect(cycle.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      t('worktreeCycle.mr.error.ssh-key', host)
    )
    refuse('HTTP Basic: Access denied. If a token was provided, it was either incorrect, expired.')
    await expect(cycle.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      t('worktreeCycle.mr.error.not-logged', host)
    )
    allow()
    const down = cycleWith(
      fakeGlab({ create: () => result(1, '', fixture('mr-create-refused.stderr.txt')) }).run
    )
    await expect(down.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      t('worktreeCycle.mr.error.unreachable', host)
    )
    const killed = cycleWith(
      fakeGlab({
        create: () =>
          Promise.resolve({
            code: 1,
            stdout: Buffer.alloc(0),
            stderr: 'Command failed',
            timedOut: true
          })
      }).run
    )
    await expect(killed.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      t('worktreeCycle.mr.error.unreachable', host)
    )
    const odd = cycleWith(
      fakeGlab({
        create: () =>
          result(
            1,
            '',
            '\n   ERROR  \n\n  POST …/merge_requests: 422 {message: [Title is too long]}.\n'
          )
      }).run
    )
    await expect(odd.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      'POST …/merge_requests: 422 {message: [Title is too long]}.'
    )
  })
})

describe('GitHub exactement comme avant tant que glab ne revendique pas l’hôte (relecture)', () => {
  /** gh et glab simulés, chaque appel noté ; gh connecté. */
  const tools = () => {
    const calls: { file: string; args: string[]; env?: NodeJS.ProcessEnv }[] = []
    const run: Run = (file, args, opts) => {
      if (file === '/fake/gh' || file === '/fake/glab') {
        calls.push({ file, args, ...(opts?.env ? { env: opts.env } : {}) })
        return result(0)
      }
      return gitCommand(file, args, opts)
    }
    return { run, calls }
  }
  const githubCycle = (run: Run, over: WorktreeCycleOptions = {}) =>
    new WorktreeCycle(run, {
      gh: () => '/fake/gh',
      glab: () => '/fake/glab',
      glabHosts: async () => [{ host: 'gitlab.com' }, { host: HOST }],
      ghHosts: async () => ['github.com'],
      sshHostName: async () => undefined,
      ...over
    })

  for (const url of [
    'git@github.com:o/r.git',
    'https://github.com/o/r.git',
    'ssh://git@ssh.github.com:443/o/r.git',
    'git@github.com-work:o/r.git',
    'https://ghe.acme.fr/o/r.git'
  ]) {
    it(`${url} : PR et suivi, gh auth status sans --hostname, glab jamais lancé`, async () => {
      const { target } = await setup(url)
      const { run, calls } = tools()
      const cycle = githubCycle(run)
      expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin' })
      expect(await cycle.ghFor(target)).toBe('/fake/gh')
      expect(calls.filter((c) => c.file === '/fake/glab')).toEqual([])
      expect(calls.filter((c) => c.file === '/fake/gh').map((c) => c.args)).toEqual([
        ['auth', 'status']
      ])
    })
  }

  it('alias SSH résolu vers github.com : GitHub', async () => {
    const { target } = await setup('git@github-perso:o/r.git')
    const { run, calls } = tools()
    const cycle = githubCycle(run, { sshHostName: async () => 'github.com' })
    expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin' })
    expect(await cycle.ghFor(target)).toBe('/fake/gh')
    expect(calls.some((c) => c.file === '/fake/glab')).toBe(false)
  })

  it('hôte inconnu : GitHub comme avant, aucune sonde ; « Actualiser » le dit inconnu, sans rien lancer vers lui', async () => {
    const { target } = await setup('https://git.acme.test/g/p.git')
    const { run, calls } = tools()
    const cycle = githubCycle(run)
    expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin' })
    expect(calls.some((c) => c.args.includes('git.acme.test'))).toBe(false)
    cycle.forgetGh()
    expect((await cycle.info(target, { fresh: true })).pr).toEqual({
      ok: false,
      reason: 'unknown-forge',
      host: 'git.acme.test'
    })
    expect(await cycle.ghFor(target)).toBeUndefined()
    // Ni glab ni gh lancés vers cet hôte, à aucun moment.
    expect(calls.some((c) => c.args.includes('git.acme.test'))).toBe(false)
    expect(calls.some((c) => c.file === '/fake/glab')).toBe(false)
    // Déclaré à gh (GitHub Enterprise) : GitHub.
    const ghes = githubCycle(run, { ghHosts: async () => ['git.acme.test'] })
    expect((await ghes.info(target, { fresh: true })).pr).toEqual({ ok: true, remote: 'origin' })
  })

  it('alias non résolu, « Actualiser » : forge inconnue sans hôte à conseiller', async () => {
    const { target } = await setup('git@gitlab-work:g/p.git')
    const cycle = githubCycle(tools().run)
    expect((await cycle.info(target, { fresh: true })).pr).toEqual({
      ok: false,
      reason: 'unknown-forge'
    })
  })
})

describe('vérifications de la forge (relecture)', () => {
  it('deux info() en même temps : une seule vérification de glab', async () => {
    const { target } = await setup(`git@${HOST}:g/p.git`)
    let auths = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const run: Run = async (file, args, opts) => {
      if (file === '/fake/glab' && args[0] === 'auth') {
        auths++
        await gate
        return { code: 0, stdout: Buffer.alloc(0), stderr: '' }
      }
      return fakeGlab().run(file, args, opts)
    }
    const cycle = cycleWith(run)
    const both = Promise.all([cycle.info(target), cycle.info(target)])
    await new Promise((resolve) => setTimeout(resolve, 200))
    release?.()
    const [a, b] = await both
    expect(auths).toBe(1)
    expect(a.pr).toEqual(b.pr)
  })

  it('hôte qui ne répond pas : info() rend la vue git tout de suite, puis dit de relire', async () => {
    const { target } = await setup(`git@${HOST}:g/p.git`)
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const run: Run = async (file, args, opts) => {
      if (file === '/fake/glab' && args[0] === 'auth') {
        await gate
        return { code: 1, stdout: Buffer.alloc(0), stderr: '', timedOut: true }
      }
      return fakeGlab().run(file, args, opts)
    }
    const settled: string[] = []
    const cycle = cycleWith(run, { forgeBudgetMs: 100, onForgeSettled: (id) => settled.push(id) })
    const started = Date.now()
    const view = await cycle.info(target)
    expect(Date.now() - started).toBeLessThan(3_000)
    expect(view.pr).toEqual({ ok: false, reason: 'checking' })
    expect(view.branch).toBe(target.worktree.branch)
    release?.()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(settled).toEqual(['c1'])
    // Injoignable : gardé (pas de nouvelle sonde à chaque relecture).
    expect((await cycle.info(target)).pr).toEqual({
      ok: false,
      reason: 'unreachable',
      noun: 'mr',
      host: HOST
    })
  })
})

describe('seconde relecture du tech lead (fiche 189)', () => {
  it('alias SSH déclaré tel quel à glab (Host gitlab.corp → HostName 10.1.2.3) : GitLab', async () => {
    const { target } = await setup('git@gitlab.corp:g/p.git')
    const hosts: string[] = []
    const glab = fakeGlab()
    const run: Run = (file, args, opts) => {
      if (file === '/fake/glab' && args[0] === 'auth') hosts.push(args[3] ?? '')
      return glab.run(file, args, opts)
    }
    const cycle = cycleWith(run, {
      glabHosts: async () => [{ host: 'gitlab.corp' }],
      sshHostName: async () => '10.1.2.3'
    })
    expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin', noun: 'mr' })
    expect(hosts).toEqual(['gitlab.corp'])
  })

  it('GitHub Enterprise connu seulement par GH_ENTERPRISE_TOKEN ou GH_HOST : GitHub après « Actualiser »', async () => {
    const { target } = await setup('https://ghe.corp.test/o/r.git')
    for (const [name, value] of [
      ['GH_ENTERPRISE_TOKEN', 'x'],
      ['GITHUB_ENTERPRISE_TOKEN', 'x'],
      ['GH_HOST', 'ghe.corp.test']
    ] as const) {
      const saved = process.env[name]
      process.env[name] = value
      try {
        const calls: string[][] = []
        const cycle = new WorktreeCycle(
          (file, args, opts) => {
            if (file === '/fake/gh') {
              calls.push(args)
              return result(0)
            }
            return gitCommand(file, args, opts)
          },
          {
            gh: () => '/fake/gh',
            glab: () => undefined,
            glabHosts: async () => [],
            ghHosts: async () => []
          }
        )
        expect((await cycle.info(target, { fresh: true })).pr, name).toEqual({
          ok: true,
          remote: 'origin'
        })
        expect(calls).toEqual([['auth', 'status']])
      } finally {
        if (saved === undefined) Reflect.deleteProperty(process.env, name)
        else process.env[name] = saved
      }
    }
  })

  it('gh lent à la nouvelle vérification : le dernier état reste, ni « vérification » ni bouton qui saute', async () => {
    const { target } = await setup('https://github.com/o/r.git')
    let slow = false
    let release: (() => void) | undefined
    const run: Run = async (file, args, opts) => {
      if (file === '/fake/gh') {
        if (slow) await new Promise<void>((resolve) => (release = resolve))
        return { code: 0, stdout: Buffer.alloc(0), stderr: '' }
      }
      return gitCommand(file, args, opts)
    }
    const cycle = new WorktreeCycle(run, {
      gh: () => '/fake/gh',
      glab: () => undefined,
      ghCacheMs: 0,
      forgeBudgetMs: 50
    })
    expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin' })
    slow = true
    expect((await cycle.info(target)).pr).toEqual({ ok: true, remote: 'origin' })
    release?.()
  })

  it('MR ouverte gardée pendant une vérification lente de glab (« Pousser vers la MR » ne saute pas)', async () => {
    const { target, commit } = await setup(`https://${HOST}/g/p.git`)
    const glab = fakeGlab()
    let slow = false
    let release: (() => void) | undefined
    const run: Run = async (file, args, opts) => {
      if (file === '/fake/glab' && args[0] === 'auth' && slow) {
        await new Promise<void>((resolve) => (release = resolve))
      }
      return glab.run(file, args, opts)
    }
    const cycle = cycleWith(run, { ghCacheMs: 0, forgeBudgetMs: 50 })
    commit('a.txt')
    await cycle.pullRequest(target, { title: 'Page', body: '' })
    expect((await cycle.info(target)).pr).toMatchObject({ ok: true, open: { url: MR_URL } })
    // Nouvelle vérification (cache à 0), lente : la MR reste (« Actualiser » oublierait l'état).
    slow = true
    expect((await cycle.info(target)).pr).toMatchObject({ ok: true, open: { url: MR_URL } })
    release?.()
  })

  it('GitLab sous un sous-chemin non déclaré à glab (404) : message clair', async () => {
    const { target, commit } = await setup(`https://${HOST}/gitlab/g/p.git`)
    const notFound = cycleWith(
      fakeGlab({
        auth: '  x gitlab.acme.test: API call failed: GET https://gitlab.acme.test/api/v4/user: 404 Not Found'
      }).run
    )
    expect((await notFound.info(target)).pr).toEqual({
      ok: false,
      reason: 'not-found',
      noun: 'mr',
      host: HOST
    })
    commit('a.txt')
    const create = cycleWith(
      fakeGlab({
        create: () =>
          result(1, '', '\n   ERROR  \n\n  GET …/projects/gitlab%2Fg%2Fp: 404 Project Not Found.\n')
      }).run
    )
    await expect(create.pullRequest(target, { title: 'x', body: '' })).rejects.toThrow(
      t('worktreeCycle.mr.error.not-found', { host: HOST, branch: target.worktree.branch })
    )
    // Sous-chemin déclaré (subfolder) : glab enlève lui-même le sous-chemin de -R (relevé).
    const glab = fakeGlab()
    await cycleWith(glab.run).pullRequest(target, { title: 'x', body: '' })
    expect(glab.calls.find((c) => c.args[1] === 'create')?.args[2]).toBe(
      `--repo=https://${HOST}/gitlab/g/p`
    )
  })

  it('info() : une seule lecture du dépôt distant', async () => {
    const { target } = await setup(`https://${HOST}/g/p.git`)
    const logged: string[] = []
    const cycle = cycleWith(fakeGlab().run, { log: (_id, line) => logged.push(line) })
    await cycle.info(target)
    expect(logged.filter((l) => l.startsWith('git config --get branch.main.remote'))).toHaveLength(
      1
    )
    expect(logged.filter((l) => l.startsWith('git remote get-url'))).toHaveLength(1)
  })
})

describe('troisième passe du tech lead (fiche 189)', () => {
  it('branche changée pendant une vérification lente : pas la MR de l’ancienne branche ; « Actualiser » oublie l’état gardé', async () => {
    const { target, commit } = await setup(`https://${HOST}/g/p.git`)
    const glab = fakeGlab()
    let slow = false
    let release: (() => void) | undefined
    const run: Run = async (file, args, opts) => {
      if (file === '/fake/glab' && args[0] === 'auth' && slow) {
        await new Promise<void>((resolve) => (release = resolve))
      }
      return glab.run(file, args, opts)
    }
    const cycle = cycleWith(run, { ghCacheMs: 0, forgeBudgetMs: 50 })
    commit('a.txt')
    await cycle.pullRequest(target, { title: 'Page', body: '' })
    expect((await cycle.info(target)).pr).toMatchObject({ open: { url: MR_URL } })
    slow = true
    const other: CycleTarget = { ...target, worktree: { ...target.worktree, branch: 'autre' } }
    expect((await cycle.info(other)).pr).toEqual({ ok: false, reason: 'checking' })
    release?.()
    // Même branche, vérification lente : l'état gardé ; après « Actualiser » : « vérification ».
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect((await cycle.info(target)).pr).toMatchObject({ ok: true })
    cycle.forgetGh()
    expect((await cycle.info(target)).pr).toEqual({ ok: false, reason: 'checking' })
    release?.()
  })
})
