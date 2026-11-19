/**
 * Fille arrêtée par ■ (fiche 258, D4), contre l'agent factice (`attend-stop` : seule l'annulation
 * finit le tour) : « arrêtée » dans la liste, compte rendu « arrêtée » chez la mère, état gardé au
 * redémarrage de l'app, effacé au tour suivant.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { childState } from '@shared/children'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { Worktrees } from '../changes/worktrees'
import { gitCommand, queuedGit } from '../git/git-queue'
import { ChildConversations } from './children'
import { ConversationManager } from './manager'
import { until } from './manager-until'
import type { ConversationRecord } from './store'

function environment(dirs?: { root: string; repo: string }) {
  const root = dirs?.root ?? mkdtempSync(join(tmpdir(), 'fille-arretee-'))
  const repo = dirs?.repo ?? realpathSync(mkdtempSync(join(tmpdir(), 'fille-arretee-depot-')))
  if (!dirs) {
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
        cwd: repo
      })
    writeFileSync(join(repo, 'README.md'), '# Carnet\n')
    git('init', '-q', '-b', 'main')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
  }
  const mock = (id: string, scenario: string, delay = '0'): AgentProfile => ({
    id,
    label: `Factice ${id}`,
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', delay, '--store', join(root, 's')],
    env: {}
  })
  const holder: { children?: ChildConversations } = {}
  const manager = new ConversationManager({
    profiles: [mock('echo', 'echo'), mock('stop', 'attend-stop', '5')],
    keepLive: (id) => holder.children?.keepLive(id) ?? false,
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: repo,
    neutralFolder: repo,
    pathEnv: () => process.env['PATH'],
    worktrees: new Worktrees(queuedGit(gitCommand)),
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  const module = new ChildConversations(manager)
  holder.children = module
  manager.subscribe({
    event: (payload) => module.onEvent(payload),
    list: () => module.listChanged(),
    deleted: (id) => module.forget(id)
  })
  const waitFor = (predicate: () => boolean) =>
    until(manager, predicate, predicate.toString(), 10_000)
  const listed = (id: string) => manager.state().conversations.find((c) => c.id === id)
  const state = (id: string) => {
    const child = listed(id)
    return child && childState(child)
  }
  const reports = (motherId: string) =>
    manager.view(motherId).transcript.items.flatMap((i) => (i.kind === 'child-report' ? [i] : []))
  const index = () =>
    JSON.parse(
      readFileSync(join(root, 'conversations', 'index.json'), 'utf8')
    ) as ConversationRecord[]
  return { root, repo, manager, children: module, waitFor, listed, state, reports, index }
}

describe('fille arrêtée par ■ (fiche 258, D4)', () => {
  it('« arrêtée », pas « finie » ; gardée au redémarrage ; effacée au tour suivant', async () => {
    const env = environment()
    const mother = env.manager.state().activeId
    await env.manager.startActive()
    await env.manager.prompt(mother, 'Organise le carnet')
    const { id: child } = await env.children.start(mother, {
      text: 'Relis le carnet',
      profileId: 'stop'
    })
    await env.waitFor(() => env.listed(child)?.status === 'busy')
    expect(env.state(child)).toBe('running')

    // ■ dans Session › En cours : le tour finit `cancelled`.
    await env.manager.cancel(child)
    await env.waitFor(() => env.listed(child)?.status === 'ready' && env.reports(mother).length > 0)
    expect(env.listed(child)?.turnStopped).toBe(true)
    expect(env.state(child)).toBe('stopped')
    expect(env.reports(mother).map((r) => r.outcome)).toEqual(['stopped'])

    // Tour suivant : l'arrêt ne vaut plus, la fille travaille.
    void env.manager.prompt(child, 'Reprends')
    await env.waitFor(() => env.listed(child)?.status === 'busy')
    expect(env.listed(child)).not.toHaveProperty('turnStopped')
    expect(env.state(child)).toBe('running')
    await env.manager.cancel(child)
    await env.waitFor(() => env.listed(child)?.turnStopped === true)
    await env.manager.settled()
    expect(env.index().find((r) => r.id === child)?.turnStopped).toBe(true)
    env.manager.stopAll()

    // App relancée : plus d'agent pour elle, toujours « arrêtée ».
    const next = environment({ root: env.root, repo: env.repo })
    await next.manager.settled()
    expect(next.listed(child)).toMatchObject({ status: 'stopped', turnStopped: true })
    expect(next.state(child)).toBe('stopped')
    next.manager.stopAll()
  })
})
