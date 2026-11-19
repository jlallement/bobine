/**
 * Filles en worktree et non commité de la mère (fiche 240), contre l'agent factice et un vrai
 * dépôt git : rien ne part en worktree d'un dossier modifié sans choix ; « partir quand même »
 * le rappelle dans la mère ; l'avis en lecture seule part dans le dossier de la mère et voit le non
 * commité ; « Committer d'abord » donne le travail à la fille. Aucun vrai modèle.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseChildDecision } from '@shared/children'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { Worktrees } from '../changes/worktrees'
import { gitCommand, queuedGit } from '../git/git-queue'
import { childrenToolsModule } from '../mcp/children-tools'
import { AppToolServer } from '../mcp/tool-server'
import { builtinRoles } from '../roles/builtin'
import { startRoleChildren } from '../roles/invoke'
import { RoleLibrary } from '../roles/library'
import type { ChildConversations } from './children'
import { setupChildren } from './children-setup'
import { launchFolder } from './launch-folder'
import { ConversationManager } from './manager'
import { until } from './manager-until'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/** Dépôt de la mère : avec un commit (par défaut), sans aucun commit, ou pas de dépôt du tout. */
type Repo = 'commit' | 'noCommit' | 'notRepo'

async function environment(scenario = 'echo', kind: Repo = 'commit') {
  const root = mkdtempSync(join(tmpdir(), 'filles-non-commite-'))
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'filles-non-commite-depot-')))
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: repo,
      encoding: 'utf8'
    }).trim()
  writeFileSync(join(repo, 'README.md'), '# Tâches\n')
  if (kind !== 'notRepo') git('init', '-q', '-b', 'main')
  if (kind === 'commit') {
    git('add', '.')
    git('commit', '-q', '-m', 'chore: initial commit')
  }
  const profile: AgentProfile = {
    id: 'mock',
    label: 'Factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', '--store', join(root, 's')],
    env: {},
    childModelChoice: 'ask'
  }
  const toolServer = new AppToolServer()
  await toolServer.start()
  const late: { children?: ChildConversations } = {}
  const library = new RoleLibrary({
    userDir: join(root, 'roles'),
    builtin: builtinRoles,
    off: () => new Set(),
    setEnabled: () => {}
  })
  const manager = new ConversationManager({
    profiles: [profile],
    toolServer,
    toolModules: [childrenToolsModule(() => late.children)],
    roles: library,
    keepLive: (id) => late.children?.keepLive(id) ?? false,
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: repo,
    neutralFolder: repo,
    pathEnv: () => process.env['PATH'],
    worktrees: new Worktrees(queuedGit(gitCommand)),
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  const children = setupChildren(manager, {
    roles: library,
    folder: launchFolder(queuedGit(gitCommand))
  })
  late.children = children
  cleanups.push(() => {
    manager.stopAll()
    toolServer.stop()
  })
  const mother = manager.state().activeId
  await manager.startActive()
  await manager.prompt(mother, 'Écris le plan')
  // Le travail de la mère, pas encore commité.
  writeFileSync(join(repo, 'plan.md'), '# Plan\n')
  const waitFor = (predicate: () => boolean, what: string) => until(manager, predicate, what)
  const items = (id: string) => manager.view(id).transcript.items
  const childrenOf = () => manager.state().conversations.filter((c) => c.startedFrom?.id === mother)
  const started = () =>
    items(mother).filter(
      (i): i is Extract<TranscriptItem, { kind: 'child-started' }> => i.kind === 'child-started'
    )
  const reports = () =>
    items(mother).filter(
      (i): i is Extract<TranscriptItem, { kind: 'child-report' }> => i.kind === 'child-report'
    )
  const host = {
    start: children.start.bind(children),
    choices: children.choices.bind(children),
    findRole: children.findRole.bind(children)
  }
  return {
    repo,
    git,
    manager,
    children,
    mother,
    host,
    waitFor,
    childrenOf,
    started,
    reports,
    items
  }
}

describe('filles en worktree et non commité de la mère (fiche 240)', () => {
  it('le dossier de la mère : nombre, fichiers et commit de départ ; rien s’il est propre', async () => {
    const env = await environment()
    const dirty = await env.children.uncommitted(env.mother)
    expect(dirty).toMatchObject({
      count: 1,
      files: [{ path: 'plan.md', status: 'untracked' }],
      branch: 'main',
      subject: 'chore: initial commit'
    })
    expect(dirty?.commit).toMatch(/^[0-9a-f]{7,}$/)
    env.git('add', '.')
    env.git('commit', '-q', '-m', 'plan')
    expect(await env.children.uncommitted(env.mother)).toBeUndefined()
  })

  it('`@rôle` sans choix, dossier modifié : refusé, aucune fille, aucun worktree', async () => {
    const env = await environment()
    const result = await startRoleChildren(env.host, env.mother, {
      roles: ['ux-ui-expert', 'back-architect'],
      text: 'Construisez la page d’après plan.md'
    })
    expect(result.started).toEqual([])
    expect(result.failed.map((f) => f.role)).toEqual(['ux-ui-expert', 'back-architect'])
    expect(result.failed[0]?.error).toContain('1 modification non commitée')
    expect(env.childrenOf()).toEqual([])
    expect(env.git('worktree', 'list').split('\n')).toHaveLength(1)
  })

  it('« Partir quand même » : la fille part du commit sans le fichier, la mère le rappelle', async () => {
    const env = await environment()
    const result = await startRoleChildren(env.host, env.mother, {
      roles: ['ux-ui-expert'],
      text: 'Construisez la page',
      uncommitted: 'anyway'
    })
    expect(result.failed).toEqual([])
    const child = env.childrenOf()[0]
    expect(child?.branch).toMatch(/^bobine\//)
    expect(existsSync(join(child?.workspace ?? '', 'plan.md'))).toBe(false)
    const head = env.git('rev-parse', '--short=7', 'HEAD')
    expect(env.started()[0]?.leftBehind).toEqual({ count: 1, commit: head })
    await env.waitFor(() => env.reports().length > 0, 'compte rendu de la fille')
    expect(env.reports()[0]?.leftBehind).toEqual({ count: 1, commit: head })
  })

  it('avis en lecture seule : dans le dossier de la mère, sans worktree, il voit le non commité', async () => {
    const env = await environment()
    const result = await startRoleChildren(env.host, env.mother, {
      roles: ['ux-ui-expert'],
      text: 'Votre avis sur plan.md',
      uncommitted: 'readOnly'
    })
    expect(result.failed).toEqual([])
    const child = env.childrenOf()[0]
    expect(child?.workspace).toBe(env.repo)
    expect(child?.branch).toBeUndefined()
    expect(child?.role?.readOnly).toBe(true)
    expect(existsSync(join(child?.workspace ?? '', 'plan.md'))).toBe(true)
    expect(env.started()[0]?.leftBehind).toBeUndefined()
    expect(env.started()[0]?.role?.readOnly).toBe(true)
    expect(env.git('worktree', 'list').split('\n')).toHaveLength(1)
  })

  it('« Committer d’abord » : commit dans le dossier de la mère, puis la fille l’a', async () => {
    const env = await environment()
    const dirty = await env.children.uncommitted(env.mother)
    const commit = await env.children.commitFolder(env.mother, {
      message: 'docs: plan',
      files: dirty?.files.map((f) => f.path) ?? []
    })
    expect(env.git('log', '-1', '--format=%s')).toBe('docs: plan')
    expect(commit.short).toBe(env.git('rev-parse', '--short', 'HEAD'))
    const result = await startRoleChildren(env.host, env.mother, {
      roles: ['ux-ui-expert'],
      text: 'Construisez la page'
    })
    expect(result.failed).toEqual([])
    const child = env.childrenOf()[0]
    expect(existsSync(join(child?.workspace ?? '', 'plan.md'))).toBe(true)
    expect(env.started()[0]?.leftBehind).toBeUndefined()
  })

  it('fiche 244 : commit des cochés seulement ; la fille part sans le .env décoché, rappelé', async () => {
    const env = await environment()
    writeFileSync(join(env.repo, '.env'), 'SECRET=1\n')
    const commit = await env.children.commitFolder(env.mother, {
      message: 'docs: plan',
      files: ['plan.md']
    })
    expect(env.git('show', '--name-only', '--format=', 'HEAD')).toBe('plan.md')
    expect(env.git('status', '--porcelain')).toBe('?? .env')
    expect(await env.children.uncommitted(env.mother)).toMatchObject({
      count: 1,
      files: [{ path: '.env', status: 'untracked' }]
    })
    // Des décochés restent : la fille part « quand même », sans eux, et c'est rappelé.
    const result = await startRoleChildren(env.host, env.mother, {
      roles: ['ux-ui-expert'],
      text: 'Construisez la page',
      uncommitted: 'anyway'
    })
    expect(result.failed).toEqual([])
    const child = env.childrenOf()[0]
    expect(existsSync(join(child?.workspace ?? '', 'plan.md'))).toBe(true)
    expect(existsSync(join(child?.workspace ?? '', '.env'))).toBe(false)
    expect(env.started()[0]?.leftBehind).toEqual({ count: 1, commit: commit.short })
  })

  it('un rôle en lecture seule part sans choix : il travaille dans le dossier de la mère', async () => {
    const env = await environment()
    const result = await startRoleChildren(env.host, env.mother, {
      roles: ['security-expert'],
      text: 'Relis'
    })
    expect(result.failed).toEqual([])
    expect(env.childrenOf()[0]?.workspace).toBe(env.repo)
  })

  it('« Lancer en parallèle… » sans rôle : refusé sans choix, et pas d’avis sans rôle', async () => {
    const env = await environment()
    await expect(env.children.start(env.mother, { text: 'Écris l’API' })).rejects.toThrow(
      '1 modification non commitée'
    )
    await expect(
      env.children.start(env.mother, { text: 'Écris l’API', uncommitted: 'readOnly' })
    ).rejects.toThrow('uncommitted')
    expect(env.childrenOf()).toEqual([])
    const child = await env.children.start(env.mother, {
      text: 'Écris l’API',
      uncommitted: 'anyway'
    })
    expect(child.branch).toMatch(/^bobine\//)
  })

  it('carte « Tâches proposées » : « Lancer quand même » passe par l’élicitation', () => {
    expect(parseChildDecision({ decision: 'start', uncommitted: 'anyway' })).toEqual({
      action: 'start',
      uncommitted: 'anyway'
    })
    expect(parseChildDecision({ decision: 'start', uncommitted: 'autre' })).toEqual({
      action: 'start'
    })
  })
})

/**
 * Fiche 262 : sans commit (ou sans dépôt), aucun worktree n'est possible. La fille qui écrit
 * travaille dans le dossier de la mère, sans choix à faire ; aucun worktree, aucun commit (la
 * recette du 2026-11-19 a fini sur un commit vide).
 */
describe('dépôt sans commit, ou dossier hors dépôt (fiche 262)', () => {
  /** Le dépôt n'a toujours aucun commit : `rev-parse` échoue. */
  const noCommitYet = (git: (...args: string[]) => string) =>
    expect(() => git('rev-parse', '--verify', '--quiet', 'HEAD')).toThrow()

  it('dépôt sans commit : la ligne le sait, rien de « non commité » à laisser', async () => {
    const env = await environment('echo', 'noCommit')
    expect(await env.children.folderState(env.mother)).toEqual({
      place: 'here',
      reason: 'noCommit'
    })
    expect(await env.children.uncommitted(env.mother)).toBeUndefined()
  })

  it('rôle qui écrit, sans choix : il part dans le dossier, sans worktree ni commit', async () => {
    const env = await environment('echo', 'noCommit')
    const result = await startRoleChildren(env.host, env.mother, {
      roles: ['ux-ui-expert'],
      text: 'Construisez la page d’après plan.md'
    })
    expect(result.failed).toEqual([])
    const child = env.childrenOf()[0]
    expect(child?.workspace).toBe(env.repo)
    expect(child?.branch).toBeUndefined()
    // Il écrit : ce n'est pas un avis en lecture seule.
    expect(child?.role?.readOnly).toBeFalsy()
    expect(child?.role?.name).toBe('ux-ui-expert')
    expect(existsSync(join(child?.workspace ?? '', 'plan.md'))).toBe(true)
    expect(env.started()[0]?.leftBehind).toBeUndefined()
    expect(env.git('worktree', 'list').split('\n')).toHaveLength(1)
    noCommitYet(env.git)
    await env.waitFor(() => env.reports().length > 0, 'compte rendu de la fille')
    noCommitYet(env.git)
  })

  it('fille sans rôle (« Lancer en parallèle… », `start_child`) : dans le dossier aussi', async () => {
    const env = await environment('echo', 'noCommit')
    const child = await env.children.start(env.mother, { text: 'Écris l’API' }, 'agent')
    expect(child.workspace).toBe(env.repo)
    expect(child.branch).toBeUndefined()
    expect(env.git('worktree', 'list').split('\n')).toHaveLength(1)
    noCommitYet(env.git)
  })

  it('dossier hors dépôt git : le rôle qui écrit part dans le dossier, sans erreur', async () => {
    const env = await environment('echo', 'notRepo')
    expect(await env.children.folderState(env.mother)).toEqual({
      place: 'here',
      reason: 'notRepo'
    })
    const result = await startRoleChildren(env.host, env.mother, {
      roles: ['ux-ui-expert'],
      text: 'Construisez la page'
    })
    expect(result.failed).toEqual([])
    expect(env.childrenOf()[0]?.workspace).toBe(env.repo)
    expect(existsSync(join(env.repo, '.git'))).toBe(false)
  })

  it('dépôt avec commit : la ligne a la racine, HEAD et le non commité (clé du choix retenu)', async () => {
    const env = await environment()
    const state = await env.children.folderState(env.mother)
    expect(state).toMatchObject({
      place: 'worktree',
      root: env.repo,
      head: env.git('rev-parse', 'HEAD'),
      dirty: { count: 1, files: [{ path: 'plan.md', status: 'untracked' }] }
    })
  })

  it('« Juste un avis » sur un rôle qui écrit : explicite, accepté sans autre choix', async () => {
    const env = await environment()
    await expect(
      env.children.start(env.mother, {
        text: 'Votre avis',
        role: 'back-architect',
        uncommitted: 'readOnly'
      })
    ).resolves.toMatchObject({ workspace: env.repo })
  })
})
