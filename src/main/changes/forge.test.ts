import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCommand, type Run } from '../simulator/run'
import {
  forgeFailure,
  guessedForge,
  knownForge,
  projectRef,
  redact,
  remoteHost,
  tokenlessEnv,
  toolHost,
  validHostname
} from './forge'
import { parseGhHosts } from './forge-github'
import {
  gitlabForge,
  glabConfigFile,
  glabHostFor,
  openMergeRequest,
  parseGlabHosts,
  readGlabHosts
} from './forge-gitlab'
import { toolError } from './worktree-cycle'

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', 'glab', name), 'utf8')

describe('hôte du dépôt distant (fiche 189)', () => {
  it('SSH (scp et ssh:// avec port), HTTPS avec port et sous-chemin, dépôt local', () => {
    expect(remoteHost('git@gitlab.example.com:group/sub/project.git')).toEqual({
      hostname: 'gitlab.example.com',
      ssh: true
    })
    expect(remoteHost('ssh://git@Git.Corp.Example:2222/group/project.git')).toEqual({
      hostname: 'git.corp.example',
      port: 2222,
      ssh: true
    })
    expect(remoteHost('https://forge.example.org:8443/gitlab/group/project.git')).toEqual({
      hostname: 'forge.example.org',
      port: 8443,
      ssh: false
    })
    expect(remoteHost('https://oauth2:secret@gitlab.com/group/project.git')).toEqual({
      hostname: 'gitlab.com',
      ssh: false
    })
    expect(remoteHost('/Users/u/remote.git')).toBeUndefined()
    expect(remoteHost('../remote.git')).toBeUndefined()
    expect(remoteHost('file:///tmp/remote.git')).toBeUndefined()
    expect(remoteHost('C:\\depots\\remote.git')).toBeUndefined()
    expect(remoteHost('')).toBeUndefined()
    expect(remoteHost('https://')).toBeUndefined()
  })

  it('nom pour les outils : port web gardé, port SSH retiré', () => {
    expect(toolHost({ hostname: 'localhost', port: 8929, ssh: false })).toBe('localhost:8929')
    expect(toolHost({ hostname: 'localhost', port: 2224, ssh: true })).toBe('localhost')
    expect(toolHost({ hostname: 'gitlab.com', ssh: true })).toBe('gitlab.com')
  })

  it('forge connue par le nom, ou devinée', () => {
    expect(knownForge('github.com')).toBe('github')
    expect(knownForge('acme.ghe.com')).toBe('github')
    expect(knownForge('gitlab.com')).toBe('gitlab')
    expect(knownForge('gitlab.acme.fr')).toBeUndefined()
    expect(guessedForge('gitlab.acme.fr')).toBe('gitlab')
    expect(guessedForge('code-gitlab.acme.fr')).toBe('gitlab')
    expect(guessedForge('github.acme.fr')).toBe('github')
    expect(guessedForge('git.acme.fr')).toBeUndefined()
    expect(guessedForge('mygitlabby.fr')).toBeUndefined()
  })
})

describe('erreurs de glab et de git push vers GitLab (sorties réelles)', () => {
  it('chaque cas reconnu', () => {
    expect(forgeFailure(fixture('auth-status-not-logged.txt'))).toBe('not-logged')
    expect(forgeFailure(fixture('auth-status-revoked.txt'))).toBe('not-logged')
    expect(forgeFailure(fixture('auth-status-timeout.txt'))).toBe('unreachable')
    expect(forgeFailure(fixture('auth-status-refused.txt'))).toBe('unreachable')
    expect(forgeFailure(fixture('auth-status-certificate.txt'))).toBe('certificate')
    expect(forgeFailure(fixture('mr-create-refused.stderr.txt'))).toBe('unreachable')
    expect(forgeFailure(fixture('push-refused.stderr.txt'))).toBe('unreachable')
    expect(forgeFailure(fixture('push-certificate.stderr.txt'))).toBe('certificate')
    expect(forgeFailure(fixture('push-denied.stderr.txt'))).toBe('denied')
    expect(forgeFailure(fixture('push-protected.stderr.txt'))).toBe('protected')
    expect(forgeFailure(fixture('push-access-denied.stderr.txt'))).toBe('not-logged')
    // Autres formes connues de git et de glab.
    expect(
      forgeFailure(
        'fatal: unable to access: SSL certificate problem: unable to get local issuer certificate'
      )
    ).toBe('certificate')
    expect(forgeFailure('ssh: Could not resolve hostname gitlab.acme: nodename nor servname')).toBe(
      'unreachable'
    )
    expect(forgeFailure('git@gitlab.acme: Permission denied (publickey).')).toBe('ssh-key')
    // Une MR déjà ouverte n'est pas une panne (elle est retrouvée).
    expect(forgeFailure(fixture('mr-create-exists.stderr.txt'))).toBeUndefined()
    expect(forgeFailure('something else')).toBeUndefined()
  })

  it('ligne utile de glab, sans cadre ni fichier de reprise', () => {
    expect(toolError(fixture('mr-create-exists.stderr.txt'))).toBe(
      'POST http://localhost:8929/api/v4/projects/qa-dev%2Fdemo/merge_requests: 409 {message: [Another open merge request already exists for this source branch: !2]}.'
    )
    expect(toolError('  plain failure \n')).toBe('plain failure')
  })

  it('identifiants et jetons masqués', () => {
    expect(
      redact("fatal: unable to access 'https://oauth2:glpat-AbC123_x@git.acme/g/p.git/'")
    ).toBe("fatal: unable to access 'https://***@git.acme/g/p.git/'")
    expect(redact('token glpat-AbCdEf123 and ghp_abc123DEF and github_pat_11AB_cd')).toBe(
      'token glpat-*** and ghp_*** and github_pat_***'
    )
    expect(redact('git@gitlab.com:g/p.git')).toBe('git@gitlab.com:g/p.git')
  })
})

describe('adaptateur GitLab (glab simulé avec les sorties réelles)', () => {
  const ok = (stdout: string, stderr = '') =>
    Promise.resolve({ code: 0, stdout: Buffer.from(stdout), stderr })
  const ko = (stderr: string, code = 1) =>
    Promise.resolve({ code, stdout: Buffer.alloc(0), stderr })

  it('connexion : connecté, hôte inconnu, jeton révoqué, injoignable, certificat', async () => {
    const calls: string[][] = []
    const answer =
      (out: Promise<Awaited<ReturnType<Run>>>): Run =>
      (_file, args) => {
        calls.push(args)
        return out
      }
    expect(
      await gitlabForge.auth(answer(ok('', fixture('auth-status-ok.txt'))), '/g', 'h:1')
    ).toEqual({ ok: true, path: '/g' })
    expect(calls.at(-1)).toEqual(['auth', 'status', '--hostname', 'h:1'])
    expect(
      await gitlabForge.auth(answer(ko(fixture('auth-status-not-logged.txt'))), '/g', 'h')
    ).toEqual({
      ok: false,
      reason: 'not-logged',
      path: '/g'
    })
    expect(
      await gitlabForge.auth(answer(ko(fixture('auth-status-revoked.txt'))), '/g', 'h')
    ).toEqual({
      ok: false,
      reason: 'not-logged',
      path: '/g'
    })
    expect(
      await gitlabForge.auth(answer(ko(fixture('auth-status-timeout.txt'))), '/g', 'h')
    ).toMatchObject({ reason: 'unreachable' })
    expect(
      await gitlabForge.auth(answer(ko(fixture('auth-status-certificate.txt'))), '/g', 'h')
    ).toMatchObject({ reason: 'certificate' })
  })

  it('création : arguments en tableau, description par l’entrée standard, lien rendu', async () => {
    let seen: { args: string[]; input?: string | Buffer; cwd?: string } | undefined
    const run: Run = (_file, args, options) => {
      seen = {
        args,
        ...(options?.input !== undefined ? { input: options.input } : {}),
        ...(options?.cwd ? { cwd: options.cwd } : {})
      }
      return ok(
        fixture('mr-create-ok.stdout.txt'),
        '\nCreating merge request for feat-2 into main in qa-dev/demo\n'
      )
    }
    const request = { cwd: '/w', base: 'main', branch: 'b', title: '-t; rm -rf / $(x)', body: '-' }
    expect(await gitlabForge.create(run, '/g', request)).toEqual({
      url: 'http://localhost:8929/qa-dev/demo/-/merge_requests/2'
    })
    expect(seen).toEqual({
      args: [
        'mr',
        'create',
        '--source-branch=b',
        '--target-branch=main',
        '--title=-t; rm -rf / $(x)',
        '--description-file',
        '-',
        '--yes'
      ],
      input: '-',
      cwd: '/w'
    })
    const exists: Run = () => ko(fixture('mr-create-exists.stderr.txt'))
    expect(await gitlabForge.create(exists, '/g', request)).toMatchObject({ code: 1 })
  })

  it('MR ouverte de la branche retrouvée, et rien sinon', async () => {
    expect(openMergeRequest(fixture('mr-list-open.json'), 'feat-2')).toEqual({
      url: 'http://localhost:8929/qa-dev/demo/-/merge_requests/2',
      title: 'Deuxième'
    })
    expect(openMergeRequest(fixture('mr-list-open.json'), 'autre')).toBeUndefined()
    expect(openMergeRequest(fixture('mr-list-empty.json'), 'feat-2')).toBeUndefined()
    expect(openMergeRequest('pas du json', 'b')).toBeUndefined()
    expect(
      openMergeRequest('[{"state":"opened","source_branch":"b","web_url":"javascript:x"}]', 'b')
    ).toBeUndefined()
    expect(
      openMergeRequest('[{"state":"merged","source_branch":"b","web_url":"https://x"}]', 'b')
    ).toBeUndefined()
    const run: Run = (_f, args) => {
      expect(args).toEqual(['mr', 'list', '--source-branch=feat-2', '--output', 'json'])
      return ok(fixture('mr-list-open.json'))
    }
    expect(await gitlabForge.findOpen(run, '/g', { cwd: '/w', branch: 'feat-2' })).toMatchObject({
      title: 'Deuxième'
    })
  })
})

describe('relecture du tech lead (fiche 189)', () => {
  it('remoteHost : transports, options déguisées, IPv6, identifiants masqués au journal', () => {
    expect(remoteHost('ext::sh -c touch% /tmp/x')).toBeUndefined()
    expect(remoteHost('fd::17')).toBeUndefined()
    expect(remoteHost('-oProxyCommand=x:y')).toBeUndefined()
    expect(remoteHost('ssh://-oProxyCommand=x/g/p.git')).toBeUndefined()
    expect(remoteHost('https://[::1]:8443/g/p.git')).toEqual({
      hostname: '[::1]',
      port: 8443,
      ssh: false
    })
    expect(remoteHost('git@[::1]:g/p.git')).toEqual({ hostname: '[::1]', ssh: true })
    expect(remoteHost('[::1]:8443')).toEqual({ hostname: '[::1]', ssh: true })
    const url = 'https://oauth2:glpat-Secret123@gitlab.acme.fr/g/p.git'
    expect(remoteHost(url)).toEqual({ hostname: 'gitlab.acme.fr', ssh: false })
    expect(redact(`fatal: unable to access '${url}/'`)).not.toContain('Secret123')
    expect(redact(`fatal: unable to access '${url}/'`)).toContain('https://***@gitlab.acme.fr')
    expect(validHostname('github.com-work')).toBe(true)
    expect(validHostname('-oProxyCommand=x')).toBe(false)
  })

  it('hôtes connus : ssh.github.com et altssh.gitlab.com', () => {
    expect(knownForge('ssh.github.com')).toBe('github')
    expect(knownForge('altssh.gitlab.com')).toBe('gitlab')
  })

  it('environnement sans jetons', () => {
    const env = tokenlessEnv({
      PATH: '/bin',
      HOME: '/h',
      GITLAB_TOKEN: 'a',
      GITLAB_ACCESS_TOKEN: 'b',
      OAUTH_TOKEN: 'c',
      GITLAB_HOST: 'd',
      GH_TOKEN: 'e',
      GITHUB_TOKEN: 'f',
      GH_ENTERPRISE_TOKEN: 'g',
      GITHUB_ENTERPRISE_TOKEN: 'h',
      GH_HOST: 'i'
    })
    expect(env).toEqual({ PATH: '/bin', HOME: '/h' })
  })

  it('projet pour glab -R : sans identifiants, port SSH ni .git', () => {
    expect(projectRef('https://oauth2:tok@localhost:8929/qa-dev/demo.git', 'localhost:8929')).toBe(
      'https://localhost:8929/qa-dev/demo'
    )
    expect(projectRef('ssh://git@localhost:2224/g/sub/p.git', 'localhost:8929')).toBe(
      'https://localhost:8929/g/sub/p'
    )
    expect(projectRef('git@gitlab.acme.fr:fork-owner/app.git', 'gitlab.acme.fr')).toBe(
      'https://gitlab.acme.fr/fork-owner/app'
    )
    expect(projectRef('git@h:../x', 'h')).toBeUndefined()
    expect(projectRef('https://h/', 'h')).toBeUndefined()
  })

  it('configuration de glab et de gh lue sans rien lancer', () => {
    const yaml = [
      'git_protocol: ssh',
      'hosts:',
      '    gitlab.com:',
      '        api_protocol: https',
      '    localhost:8929:',
      '        api_protocol: http',
      '        ssh_host: ssh.localhost # alias',
      '        token: !!null',
      'aliases: {}'
    ].join('\n')
    const hosts = parseGlabHosts(yaml)
    expect(hosts).toEqual([
      { host: 'gitlab.com' },
      { host: 'localhost:8929', sshHost: 'ssh.localhost' }
    ])
    expect(glabHostFor(hosts, 'localhost')).toBe('localhost:8929')
    expect(glabHostFor(hosts, 'ssh.localhost')).toBe('localhost:8929')
    expect(glabHostFor(hosts, 'git.acme.fr')).toBeUndefined()
    expect(parseGhHosts('github.com:\n    user: x\nghe.acme.fr:\n    oauth_token: y\n')).toEqual([
      'github.com',
      'ghe.acme.fr'
    ])
    // Ordre relevé avec `glab config path` (glab 1.128, HOME temporaire) : fixtures/glab/README.md.
    const none = () => false
    const legacy = (path: string) => path === '/h/.config/glab-cli/config.yml'
    expect(
      glabConfigFile({ GLAB_CONFIG_DIR: '/c', XDG_CONFIG_HOME: '/x' }, '/h', 'darwin', legacy)
    ).toBe('/c/config.yml')
    expect(glabConfigFile({ XDG_CONFIG_HOME: '/x' }, '/h', 'darwin', legacy)).toBe(
      '/h/.config/glab-cli/config.yml'
    )
    expect(glabConfigFile({ XDG_CONFIG_HOME: '/x' }, '/h', 'darwin', none)).toBe(
      '/x/glab-cli/config.yml'
    )
    expect(glabConfigFile({}, '/h', 'darwin', none)).toBe(
      '/h/Library/Application Support/glab-cli/config.yml'
    )
    expect(glabConfigFile({}, '/h', 'linux', none)).toBe('/h/.config/glab-cli/config.yml')
  })

  it('sortie inattendue de glab : hôte inconnu, jamais « non connecté »', async () => {
    const odd: Run = () =>
      Promise.resolve({ code: 1, stdout: Buffer.alloc(0), stderr: 'panic: something odd' })
    expect(await gitlabForge.auth(odd, '/g', 'h')).toMatchObject({ reason: 'unexpected' })
  })

  it('faux glab qui dort : tué au bout du délai, timedOut, hôte injoignable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-sleepy-'))
    const glab = join(dir, 'glab')
    writeFileSync(glab, '#!/bin/sh\nsleep 30\n')
    chmodSync(glab, 0o755)
    try {
      const started = Date.now()
      const result = await runCommand(glab, ['auth', 'status'], { timeoutMs: 300 })
      expect(result.timedOut).toBe(true)
      expect(Date.now() - started).toBeLessThan(5_000)
      const quick = await runCommand('/bin/sh', ['-c', 'exit 3'], { timeoutMs: 5_000 })
      expect(quick).toMatchObject({ code: 3 })
      expect(quick.timedOut).toBeUndefined()
      const slow: Run = (file, args) => runCommand(file, args, { timeoutMs: 300 })
      expect(await gitlabForge.auth(slow, glab, 'h')).toMatchObject({ reason: 'unreachable' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('glab mr avec -R : lancé hors du dépôt (relevé sur un GitLab réel)', () => {
  it('create et list : --repo en tête, dossier neutre ; sans -R, le worktree', async () => {
    const seen: { args: string[]; cwd?: string }[] = []
    const run: Run = (_file, args, options) => {
      seen.push({ args, ...(options?.cwd ? { cwd: options.cwd } : {}) })
      return Promise.resolve({ code: 0, stdout: Buffer.from('[]'), stderr: '' })
    }
    const repo = 'https://localhost:8929/qa-dev/demo'
    await gitlabForge.create(run, '/g', {
      cwd: '/w',
      repo,
      base: 'main',
      branch: 'b',
      title: 't',
      body: ''
    })
    await gitlabForge.findOpen(run, '/g', { cwd: '/w', repo, branch: 'b' })
    await gitlabForge.findOpen(run, '/g', { cwd: '/w', branch: 'b' })
    expect(seen.map((s) => [s.args[2], s.cwd])).toEqual([
      [`--repo=${repo}`, tmpdir()],
      [`--repo=${repo}`, tmpdir()],
      ['--source-branch=b', '/w']
    ])
  })
})

describe('configuration réelle de glab lue là où glab l’écrit (seconde relecture)', () => {
  it('HOME temporaire, sans GLAB_CONFIG_DIR ni XDG : l’hôte déclaré est trouvé', async () => {
    const home = mkdtempSync(join(tmpdir(), 'bob-glab-home-'))
    try {
      const file = glabConfigFile({}, home)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, 'hosts:\n    gitlab.corp:\n        api_protocol: https\n', {
        mode: 0o600
      })
      if (process.platform === 'darwin') {
        expect(file).toBe(join(home, 'Library', 'Application Support', 'glab-cli', 'config.yml'))
      }
      expect(await readGlabHosts({}, home)).toEqual([{ host: 'gitlab.corp' }])
      expect(await readGlabHosts({}, join(home, 'absent'))).toEqual([])
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})

describe('config.yml réel de glab après `glab auth login` (macOS, HOME temporaire)', () => {
  it('hôtes lus tels que glab les écrit (entrée gitlab.com par défaut, ssh_host vide)', () => {
    const hosts = parseGlabHosts(fixture('config-macos-after-login.yml'))
    expect(hosts).toEqual([{ host: 'gitlab.com' }, { host: 'localhost:8929' }])
    expect(glabHostFor(hosts, 'localhost')).toBe('localhost:8929')
  })
})
