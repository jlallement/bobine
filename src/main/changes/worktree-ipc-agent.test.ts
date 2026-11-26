import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import type { ChildrenMerge } from '@shared/children-merge'
import { emptyTranscript, reduceTranscript, type TranscriptState } from '@shared/transcript'
import { WorktreeCycle, type CycleTarget } from './worktree-cycle'
import { Worktrees } from './worktrees'
import { gitCommand, queuedGit } from '../git/git-queue'
import { worktreeHandlers, type WorktreeCycleDeps } from './worktree-ipc'

/**
 * Vue Git d'un worktree, en vrai dépôt (fiche 289, rapport du testeur I1–I5 et point 7) : seul le
 * tour de l'agent est simulé (`agent.turn`). « Laisser l'agent résoudre » enregistre la marque avant
 * la consigne ; tant qu'elle n'a pas été dite « à relire », aucun chemin ne fait entrer la
 * résolution dans la base.
 */
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** Un worktree en conflit avec `main` (README.md des deux côtés), avec ou sans mère. */
async function setup(withMother = true) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bob-289-')))
  dirs.push(root)
  writeFileSync(join(root, 'README.md'), '# Démo\n\nVersion 1\n')
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.name', 't')
  git(root, 'config', 'user.email', 't@example.invalid')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'init')
  const worktrees = new Worktrees(queuedGit(gitCommand))
  const { workspace, ...worktree } = await worktrees.create(root)
  writeFileSync(join(worktree.path, 'README.md'), '# Démo\n\nVersion fille\n')
  git(worktree.path, 'commit', '-qam', 'fille')
  writeFileSync(join(root, 'README.md'), '# Démo\n\nVersion main\n')
  git(root, 'commit', '-qam', 'main')
  const target: CycleTarget = { id: 'c1', title: 'Essai', workspace, worktree }
  let mother: TranscriptState = emptyTranscript
  const posted: ChildrenMerge[] = []
  /** Le tour de l'agent ; `status` : celui de la conversation (`busy` pendant un tour). */
  const agent = { turn: async (_text: string) => {}, status: 'ready' }
  const conversations = {
    worktreeOf: (id: string) => (id === 'c1' ? target : null),
    worktreePaths: () => [worktree],
    leaveWorktree: () => worktree,
    prompt: async (_id: string, text: string) => agent.turn(text),
    state: () => ({
      activeId: 'c1',
      conversations: [
        {
          id: 'c1',
          title: 'Essai',
          workspace,
          branch: worktree.branch,
          status: agent.status,
          ...(withMother ? { startedFrom: { id: 'm', title: 'Mère' } } : {})
        }
      ]
    }),
    view: () => ({ transcript: mother }),
    post: (id: string, event: AgentEvent) => {
      if (id !== 'm') return false
      mother = reduceTranscript(mother, event)
      if (event.type === 'children-merge') posted.push(event.merge)
      return true
    },
    workspaceOf: () => workspace
  }
  const cycle = new WorktreeCycle(gitCommand)
  const deps = {
    cycle,
    conversations,
    worktrees,
    recentWorkspaces: () => []
  } as unknown as WorktreeCycleDeps
  const h = worktreeHandlers(deps)
  return { root, worktree, h, agent, posted, cycle, target }
}

describe('vue Git : « Laisser l’agent résoudre » (fiche 289, testeur)', () => {
  it('I1 : résolution « à relire », rien dans main ; « Fusionner » ensuite, la base en premier parent', async () => {
    const e = await setup()
    expect((await e.h['worktree:merge']('c1', undefined)).status).toBe('conflicts')
    const before = git(e.root, 'rev-parse', 'main')
    e.agent.turn = async () => writeFileSync(join(e.worktree.path, 'README.md'), 'résolu\n')
    expect(await e.h['worktree:resolveWithAgent']('c1', undefined)).toEqual({
      status: 'resolved',
      files: ['README.md'],
      base: 'main'
    })
    expect(git(e.root, 'rev-parse', 'main')).toBe(before)
    expect(e.posted.map((p) => p.status)).toEqual(['review'])
    expect((await e.h['worktree:info']('c1', undefined))?.review).toEqual({ files: ['README.md'] })
    expect(await e.h['worktree:merge']('c1', undefined)).toMatchObject({ status: 'merged' })
    expect(git(e.root, 'log', '-1', '--format=%P', 'main').split(' ')[0]).toBe(before)
    expect(await e.cycle.agentResolution(e.target)).toBeUndefined()
  }, 30_000)

  it('I2 : « Fusionner » pendant le tour de l’agent ne fait rien entrer dans main', async () => {
    const e = await setup()
    await e.h['worktree:merge']('c1', undefined)
    const before = git(e.root, 'rev-parse', 'main')
    let mid: unknown
    e.agent.turn = async () => {
      writeFileSync(join(e.worktree.path, 'README.md'), 'résolu à moitié\n')
      // Un clic pendant le tour, la conversation vue « prête » (état pas encore relu) : la marque
      // l'arrête dans la branche.
      mid = await e.h['worktree:merge']('c1', undefined)
      writeFileSync(join(e.worktree.path, 'README.md'), 'résolu, fin du tour\n')
    }
    await e.h['worktree:resolveWithAgent']('c1', undefined)
    expect(mid).toMatchObject({ status: 'resolved' })
    expect(git(e.root, 'rev-parse', 'main')).toBe(before)
    expect(readFileSync(join(e.root, 'README.md'), 'utf8')).toBe('# Démo\n\nVersion main\n')
  }, 30_000)

  it('I3 : sans mère, rien dans main ; après relance de la vue, pas de note mais aucune fusion sans clic', async () => {
    const e = await setup(false)
    await e.h['worktree:merge']('c1', undefined)
    const before = git(e.root, 'rev-parse', 'main')
    e.agent.turn = async () => writeFileSync(join(e.worktree.path, 'README.md'), 'résolu\n')
    expect(await e.h['worktree:resolveWithAgent']('c1', undefined)).toMatchObject({
      status: 'resolved'
    })
    const info = await e.h['worktree:info']('c1', undefined)
    expect(info?.review).toBeUndefined()
    expect(info?.merging).toBeUndefined()
    expect(git(e.root, 'rev-parse', 'main')).toBe(before)
  }, 30_000)

  it('I5 : résolu à la main sans jamais solliciter l’agent, « Réessayer » : fusion immédiate', async () => {
    const e = await setup()
    await e.h['worktree:merge']('c1', undefined)
    writeFileSync(join(e.worktree.path, 'README.md'), 'à la main\n')
    expect(await e.h['worktree:mergeContinue']('c1', undefined)).toMatchObject({
      status: 'merged'
    })
    expect(readFileSync(join(e.root, 'README.md'), 'utf8')).toBe('à la main\n')
  }, 30_000)

  it('point 7 : la consigne mise en file (tour encore à venir), puis « Réessayer » après coup : « à relire »', async () => {
    const e = await setup()
    await e.h['worktree:merge']('c1', undefined)
    const before = git(e.root, 'rev-parse', 'main')
    // `prompt` rend la main sans que l'agent ait encore rien fait (consigne en file).
    e.agent.turn = async () => {}
    expect(await e.h['worktree:resolveWithAgent']('c1', undefined)).toMatchObject({
      status: 'conflicts'
    })
    // Le tour en file résout plus tard ; l'utilisateur clique « Réessayer ».
    writeFileSync(join(e.worktree.path, 'README.md'), 'résolu plus tard\n')
    expect(await e.h['worktree:mergeContinue']('c1', undefined)).toMatchObject({
      status: 'resolved'
    })
    expect(git(e.root, 'rev-parse', 'main')).toBe(before)
  }, 30_000)

  it('point 7 : refusé pendant un tour de la conversation (la consigne ne part pas en file)', async () => {
    const e = await setup()
    await e.h['worktree:merge']('c1', undefined)
    e.agent.status = 'busy'
    let prompted = false
    e.agent.turn = async () => {
      prompted = true
    }
    await expect(e.h['worktree:resolveWithAgent']('c1', undefined)).rejects.toThrow()
    expect(prompted).toBe(false)
    expect(await e.cycle.agentResolution(e.target)).toBeUndefined()
  }, 30_000)
})
