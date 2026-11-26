import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { t } from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { mergeable } from '@shared/children-merge'
import { WorktreeCycle } from '../changes/worktree-cycle'
import { gitCommand } from '../git/git-queue'
import { ChildrenMerger } from './children-merge'
import { cleanupDirs, git, ids, last, setup, states, type Child } from './children-merge.fixture'

/**
 * Fiche 289, rapport du testeur (2026-11-27) : « résolu par l'agent » est une marque enregistrée
 * dans le worktree dès que la consigne de conflit part, pas un déroulé en mémoire. Tant qu'elle
 * existe, toute conclusion de cette fusion s'arrête « à relire », quel que soit le chemin ; une
 * résolution qui garde des marqueurs, ou qui a défait la branche, n'est jamais dite « résolue ».
 * Repris de `scratchpad/testeur-289/` (T1, T2, T3, T5b, T6b, T9, T10, T11).
 */
afterEach(cleanupDirs)

const README_A = '# Démo\n\nVersion A\n'
const README_B = '# Démo\n\nVersion B\n'
const markers = /^(<{7}|={7}|>{7})/m

/** A et B modifient README.md (B entre en conflit), C à part. */
async function conflicting(extra: { x?: boolean } = {}) {
  const env = await setup(['A', 'B', 'C'])
  const [a, b, c] = env.children as [Child, Child, Child]
  env.commit(a, 'README.md', README_A)
  env.commit(b, 'README.md', README_B)
  if (extra.x) {
    env.commit(a, 'x.txt', 'xa\n')
    env.commit(b, 'x.txt', 'xb\n')
  }
  env.commit(c, 'c.txt', 'c\n')
  return { env, a, b, c }
}

/** Ce que l'agent fait de la consigne, et `main` au moment où il la reçoit. */
function agent(
  env: Awaited<ReturnType<typeof setup>>,
  does: (child: Child, files: string[]) => unknown
) {
  const seen = { main: '' }
  env.options.resolve = async (child, files) => {
    seen.main = git(env.root, 'rev-parse', 'main')
    await does(child, files)
  }
  return seen
}

describe('marque « résolu par l’agent » (fiche 289, testeur)', () => {
  it('T11 : l’app se ferme pendant le tour de l’agent ; au redémarrage, le clic s’arrête « à relire »', async () => {
    const { env } = await conflicting()
    let asked!: () => void
    const turn = new Promise<void>((resolve) => (asked = resolve))
    const seen = agent(env, (child, files) => {
      for (const f of files) writeFileSync(join(child.worktree.path, f), 'résolution non relue\n')
      asked()
      return new Promise(() => {}) // l'app se ferme : le tour ne rend jamais la main
    })
    await env.merger.start('mere', ids(env.children), false)
    await turn
    // Redémarrage : un nouveau moteur sur le même fil et le même dépôt.
    const fresh = new ChildrenMerger({
      conversations: env.host,
      cycle: new WorktreeCycle(gitCommand),
      worktrees: env.worktrees
    })
    const plan = await fresh.plan('mere')
    expect(mergeable(plan).map((c) => c.id)).toEqual(['f2', 'f3'])
    await fresh.start('mere', ['f2', 'f3'], false)
    await fresh.settled('mere')
    expect(last(env.merges).status).toBe('review')
    expect(states(last(env.merges))).toEqual(['resolved', 'pending'])
    expect(git(env.root, 'rev-parse', 'main')).toBe(seen.main)
    // Le clic suivant, après relecture, fusionne.
    await fresh.start('mere', ['f2', 'f3'], false)
    await fresh.settled('mere')
    expect(states(last(env.merges))).toEqual(['merged', 'merged'])
    expect(readFileSync(join(env.root, 'README.md'), 'utf8')).toBe('résolution non relue\n')
  }, 30_000)

  it('T10 : « Fusionner » pendant le tour de l’agent ne fait rien entrer dans main', async () => {
    const { env } = await conflicting()
    const cycle = new WorktreeCycle(gitCommand)
    let mid: unknown
    const seen = agent(env, async (child, files) => {
      for (const f of files) writeFileSync(join(child.worktree.path, f), 'moitié\n')
      mid = await cycle.merge({
        id: child.id,
        title: child.title,
        workspace: child.workspace,
        worktree: child.worktree
      })
      for (const f of files) writeFileSync(join(child.worktree.path, f), 'fin du tour\n')
    })
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    expect(mid).toMatchObject({ status: 'resolved' })
    expect(git(env.root, 'rev-parse', 'main')).toBe(seen.main)
    expect(last(env.merges).status).toBe('review')
  }, 30_000)

  it('T1 : marqueurs ajoutés à l’index par l’agent : conflit, jamais « résolu »', async () => {
    const { env, b } = await conflicting()
    const seen = agent(env, (child) => git(child.worktree.path, 'add', 'README.md'))
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('conflict')
    expect(last(env.merges).rows[1]).toMatchObject({ state: 'conflict', files: ['README.md'] })
    expect(git(env.root, 'rev-parse', 'main')).toBe(seen.main)
    expect(git(b.worktree.path, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')).not.toBe('')
  }, 30_000)

  it('T2 : l’agent commite avec les marqueurs : conflit ; un clic ne les fait pas entrer dans main', async () => {
    const { env } = await conflicting()
    const seen = agent(env, (child) => {
      git(child.worktree.path, 'add', '.')
      git(child.worktree.path, '-c', 'core.editor=true', 'commit', '-q', '--no-edit')
    })
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('conflict')
    await env.merger.start('mere', ['f2'], false)
    await env.merger.settled('mere')
    expect(states(last(env.merges))).toEqual(['conflict'])
    expect(git(env.root, 'rev-parse', 'main')).toBe(seen.main)
    expect(markers.test(readFileSync(join(env.root, 'README.md'), 'utf8'))).toBe(false)
  }, 30_000)

  it('T2b : l’agent commite une résolution propre lui-même : à relire, puis la base en premier parent', async () => {
    const { env, b } = await conflicting()
    const seen = agent(env, (child, files) => {
      for (const f of files) writeFileSync(join(child.worktree.path, f), 'résolu\n')
      git(child.worktree.path, 'add', '.')
      git(child.worktree.path, '-c', 'core.editor=true', 'commit', '-q', '--no-edit')
    })
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('review')
    expect(git(env.root, 'rev-parse', 'main')).toBe(seen.main)
    expect(git(b.worktree.path, 'log', '-1', '--format=%P').split(' ')[0]).toBe(seen.main)
    await env.merger.start('mere', ['f2'], false)
    await env.merger.settled('mere')
    expect(states(last(env.merges))).toEqual(['merged'])
    expect(git(env.root, 'log', '-1', '--format=%P', 'main').split(' ')[0]).toBe(seen.main)
  }, 30_000)

  it('T3 : résolution partielle de l’agent finie à la main, puis « Réessayer » : à relire, pas fusionnée', async () => {
    const { env, b } = await conflicting({ x: true })
    const seen = agent(env, (child) =>
      writeFileSync(join(child.worktree.path, 'README.md'), 'agent\n')
    )
    await env.merger.start('mere', ['f1', 'f2'], false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('conflict')
    expect(last(env.merges).rows[1]?.files).toEqual(['x.txt'])
    writeFileSync(join(b.worktree.path, 'x.txt'), 'à la main\n')
    await env.merger.start('mere', ['f2'], false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('review')
    expect(git(env.root, 'rev-parse', 'main')).toBe(seen.main)
  }, 30_000)

  it('T5b : « à relire » nomme tous les fichiers que la résolution touche', async () => {
    const { env } = await conflicting()
    agent(env, (child, files) => {
      for (const f of files) writeFileSync(join(child.worktree.path, f), 'résolu\n')
      writeFileSync(join(child.worktree.path, 'secret.txt'), 'indexé\n')
      git(child.worktree.path, 'add', 'secret.txt')
    })
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('review')
    expect(last(env.merges).rows[1]?.files).toEqual(['README.md', 'secret.txt'])
  }, 30_000)

  it('T6b : l’agent défait la branche (reset --hard main) : échec dit, jamais « à relire »', async () => {
    const { env, b } = await conflicting()
    const head = git(b.worktree.path, 'rev-parse', 'HEAD')
    const seen = agent(env, (child) => git(child.worktree.path, 'reset', '-q', '--hard', 'main'))
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    const stopped = last(env.merges)
    expect(stopped.status).toBe('failed')
    expect(stopped.rows[1]).toMatchObject({
      state: 'failed',
      error: t('childrenMerge.error.undone', { title: 'B', head: head.slice(0, 7) })
    })
    expect(git(env.root, 'rev-parse', 'main')).toBe(seen.main)
  }, 30_000)

  it('T9 : le tour échoue après avoir retiré les marqueurs ; « Réessayer » s’arrête « à relire »', async () => {
    const { env } = await conflicting()
    const seen = agent(env, (child, files) => {
      for (const f of files) writeFileSync(join(child.worktree.path, f), 'moitié\n')
      throw new Error('Server Error -32603')
    })
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('conflict')
    env.options.resolve = () => {}
    await env.merger.start('mere', ['f2'], false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('review')
    expect(git(env.root, 'rev-parse', 'main')).toBe(seen.main)
  }, 30_000)

  it('« Abandonner » efface la marque : la fusion suivante repart de zéro', async () => {
    const { env, b } = await conflicting()
    agent(env, () => {})
    await env.merger.start('mere', ['f1', 'f2'], false)
    await env.merger.settled('mere')
    const target = { id: b.id, title: b.title, workspace: b.workspace, worktree: b.worktree }
    const cycle = new WorktreeCycle(gitCommand)
    await cycle.mergeAbort(target)
    expect(await cycle.agentResolution(target)).toBeUndefined()
  }, 30_000)
})
