import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentEvent, ConversationSummary } from '@shared/agent'
import type { ChildrenMerge } from '@shared/children-merge'
import { emptyTranscript, reduceTranscript, type TranscriptState } from '@shared/transcript'
import { WorktreeCycle, type CycleTarget } from '../changes/worktree-cycle'
import { Worktrees, type WorktreeInfo } from '../changes/worktrees'
import { gitCommand, queuedGit } from '../git/git-queue'
import { ChildrenMerger, type ChildrenMergeHost } from './children-merge'
import { childrenMergeHandlers } from './children-merge-ipc'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

interface Child {
  id: string
  title: string
  worktree: WorktreeInfo
  workspace: string
  status: ConversationSummary['status']
  archived?: boolean
}

/**
 * Un dépôt jetable sur `main`, une mère et ses filles, chacune dans un vrai worktree (fiche 036).
 * Le gestionnaire est simulé : le fil de la mère est réduit comme dans l'app, et `prompt` joue
 * l'agent de la fille (`resolve` : ce qu'il fait d'une consigne de conflit).
 */
async function setup(titles: string[], launchOrder?: number[]) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bob-fusion-')))
  dirs.push(root)
  writeFileSync(join(root, 'README.md'), '# Démo\n\nVersion 1\n')
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.name', 't')
  git(root, 'config', 'user.email', 't@example.invalid')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'init')
  const worktrees = new Worktrees(queuedGit(gitCommand))
  const children: Child[] = []
  for (const [i, title] of titles.entries()) {
    const { workspace, ...worktree } = await worktrees.create(root)
    children.push({ id: `f${i + 1}`, title, worktree, workspace, status: 'ready' })
  }
  let mother: TranscriptState = emptyTranscript
  const apply = (event: AgentEvent) => (mother = reduceTranscript(mother, event))
  for (const i of launchOrder ?? children.map((_, i) => i)) {
    const child = children[i] as Child
    apply({
      type: 'child-started',
      child: { childId: child.id, title: child.title, prompt: 'Fais-le', at: i }
    })
  }
  const merges: ChildrenMerge[] = []
  const prompts: { id: string; text: string }[] = []
  const left: string[] = []
  const options = {
    /** Ce que fait l'agent de la fille d'une consigne de conflit : réécrit les fichiers. */
    resolve: (child: Child, files: string[]) => {
      for (const file of files) writeFileSync(join(child.worktree.path, file), 'résolu\n')
    },
    onPost: (_merge: ChildrenMerge) => {}
  }
  const host = {
    state: () => ({
      activeId: 'mere',
      conversations: children.map((c) => ({
        id: c.id,
        title: c.title,
        profileId: 'mock',
        profileLabel: 'Factice',
        workspace: c.workspace,
        updatedAt: '2026-10-22T10:00:00.000Z',
        status: c.status,
        draft: false,
        branch: c.worktree.branch,
        startedFrom: { id: 'mere', title: 'Mère' },
        ...(c.archived ? { archived: true } : {})
      }))
    }),
    view: (id: string) => {
      if (id !== 'mere') throw new Error('inconnue')
      return { transcript: mother }
    },
    worktreeOf: (id: string): CycleTarget | null => {
      const child = children.find((c) => c.id === id)
      if (!child) throw new Error('inconnue')
      if (left.includes(id)) return null
      return { id, title: child.title, workspace: child.workspace, worktree: child.worktree }
    },
    post: (id: string, event: AgentEvent) => {
      if (id !== 'mere') throw new Error('inconnue')
      apply(event)
      if (event.type === 'children-merge') {
        merges.push(event.merge)
        options.onPost(event.merge)
      }
    },
    prompt: async (id: string, text: string) => {
      prompts.push({ id, text })
      const child = children.find((c) => c.id === id) as Child
      const files = [...text.matchAll(/^- (.+)$/gm)].map((m) => m[1] as string)
      options.resolve(child, files)
    },
    leaveWorktree: (id: string) => {
      const child = children.find((c) => c.id === id) as Child
      left.push(id)
      child.archived = true
      return child.worktree
    }
  } as unknown as ChildrenMergeHost
  const logged: string[] = []
  const cycle = new WorktreeCycle(gitCommand, { log: (_id, line) => logged.push(line) })
  const merger = new ChildrenMerger({
    conversations: host,
    cycle,
    worktrees,
    log: (_id, line) => logged.push(line)
  })
  /** Committe ce fichier dans le worktree de la fille. */
  const commit = (child: Child, file: string, content: string) => {
    writeFileSync(join(child.worktree.path, file), content)
    git(child.worktree.path, 'add', '.')
    git(child.worktree.path, 'commit', '-q', '-m', `feat: ${file}`)
  }
  const transcript = () => mother
  return { root, children, merger, merges, prompts, logged, options, commit, transcript, left }
}

const ids = (children: Child[]) => children.map((c) => c.id)
const last = (merges: ChildrenMerge[]) => merges.at(-1) as ChildrenMerge
const states = (merge: ChildrenMerge) => merge.rows.map((r) => r.state)

describe('fusion de toutes les filles (fiche 120)', () => {
  it('deux filles sans recouvrement : fusionnées dans l’ordre de lancement, base avancée', async () => {
    // Lancées dans l'ordre f2 puis f1 : f2 passe en premier.
    const env = await setup(['Import CSV', 'Page d’aide'], [1, 0])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')

    const plan = await env.merger.plan('mere')
    expect(plan).toMatchObject({ base: 'main', overlaps: [], running: false })
    expect(plan.children.map((c) => [c.id, c.state, c.files])).toEqual([
      ['f2', 'ready', ['b.txt']],
      ['f1', 'ready', ['a.txt']]
    ])
    expect(plan.blocked).toBeUndefined()

    const first = await env.merger.start('mere', ids(env.children), false)
    expect(first).toMatchObject({ base: 'main', status: 'running', cleanup: false })
    expect(first.rows.map((r) => [r.childId, r.state])).toEqual([
      ['f2', 'pending'],
      ['f1', 'pending']
    ])
    await env.merger.settled('mere')

    const done = last(env.merges)
    expect(done.status).toBe('done')
    expect(states(done)).toEqual(['merged', 'merged'])
    expect(done.endedAt).toBeGreaterThanOrEqual(done.startedAt)
    // f2 a été fusionnée avant que f1 commence.
    const order = env.merges.map((m) => states(m).join(','))
    expect(order.indexOf('merged,merging')).toBeGreaterThan(order.indexOf('merging,pending'))
    expect(existsSync(join(env.root, 'a.txt')) && existsSync(join(env.root, 'b.txt'))).toBe(true)
    expect(git(env.root, 'status', '--porcelain')).toBe('')
    // Un seul élément `children-merge` dans le fil de la mère, remplacé à chaque étape.
    const items = env.transcript().items.filter((i) => i.kind === 'children-merge')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ status: 'done', runId: done.runId })
    // Chaque commande git et chaque étape dans le journal (`agents.log`, fiche 080).
    expect(env.logged.some((l) => l.startsWith('git merge --ff-only'))).toBe(true)
    expect(env.logged).toContain('children merge: 2 into main')
    expect(env.logged).toContain('children merge: done')
    // Après coup : les deux filles sont fusionnées, plus rien à proposer.
    expect((await env.merger.plan('mere')).children.map((c) => c.state)).toEqual([
      'merged',
      'merged'
    ])
  })

  it('recouvrement détecté : deux filles modifient le même fichier', async () => {
    const env = await setup(['A', 'B', 'C'])
    const [a, b, c] = env.children as [Child, Child, Child]
    env.commit(a, 'README.md', '# Démo\n\nVersion A\n')
    env.commit(a, 'src.txt', 'a\n')
    env.commit(b, 'README.md', '# Démo\n\nVersion B\n')
    env.commit(c, 'c.txt', 'c\n')
    const plan = await env.merger.plan('mere')
    expect(plan.overlaps).toEqual([{ first: 'A', second: 'B', files: ['README.md'] }])
  })

  it('conflit sur la deuxième : la fille le résout, la fusion reprend, la troisième suit', async () => {
    const env = await setup(['A', 'B', 'C'])
    const [a, b, c] = env.children as [Child, Child, Child]
    env.commit(a, 'README.md', '# Démo\n\nVersion A\n')
    env.commit(b, 'README.md', '# Démo\n\nVersion B\n')
    env.commit(c, 'c.txt', 'c\n')
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')

    expect(env.prompts).toHaveLength(1)
    expect(env.prompts[0]?.id).toBe('f2')
    expect(env.prompts[0]?.text).toContain(`\`main\` into \`${b.worktree.branch}\``)
    expect(env.prompts[0]?.text).toContain('- README.md')
    const resolving = env.merges.find((m) => m.rows[1]?.state === 'resolving')
    expect(resolving?.rows[1]?.files).toEqual(['README.md'])
    const done = last(env.merges)
    expect(done.status).toBe('done')
    expect(states(done)).toEqual(['merged', 'merged', 'merged'])
    expect(readFileSync(join(env.root, 'README.md'), 'utf8')).toBe('résolu\n')
    expect(existsSync(join(env.root, 'c.txt'))).toBe(true)
  })

  it('conflit qui reste après le tour de la fille : la chaîne s’arrête et le dit', async () => {
    const env = await setup(['A', 'B', 'C'])
    const [a, b, c] = env.children as [Child, Child, Child]
    env.commit(a, 'README.md', '# Démo\n\nVersion A\n')
    env.commit(b, 'README.md', '# Démo\n\nVersion B\n')
    env.commit(c, 'c.txt', 'c\n')
    // L'agent de la fille ne retire pas les marqueurs.
    env.options.resolve = () => {}
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    const stopped = last(env.merges)
    expect(stopped.status).toBe('conflict')
    expect(states(stopped)).toEqual(['merged', 'conflict', 'pending'])
    expect(stopped.rows[1]?.files).toEqual(['README.md'])
    // La base n'a reçu que A ; B garde sa fusion arrêtée, reprise par « Réessayer ».
    expect(readFileSync(join(env.root, 'README.md'), 'utf8')).toBe('# Démo\n\nVersion A\n')
    const plan = await env.merger.plan('mere')
    expect(plan.children.map((x) => x.state)).toEqual(['merged', 'conflict', 'ready'])

    // « Réessayer » : la chaîne reprend à B ; cette fois la fille résout.
    env.options.resolve = (child, files) => {
      for (const file of files) writeFileSync(join(child.worktree.path, file), 'A et B\n')
    }
    await env.merger.start('mere', ['f2', 'f3'], false)
    await env.merger.settled('mere')
    expect(states(last(env.merges))).toEqual(['merged', 'merged'])
    expect(readFileSync(join(env.root, 'README.md'), 'utf8')).toBe('A et B\n')
  })

  it('« Arrêter » : la fusion en cours finit, les autres restent en attente', async () => {
    const env = await setup(['A', 'B', 'C'])
    const [a, b, c] = env.children as [Child, Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    env.commit(c, 'c.txt', 'c\n')
    env.options.onPost = (merge) => {
      if (merge.rows[0]?.state === 'merging') env.merger.stop('mere')
    }
    await env.merger.start('mere', ids(env.children), false)
    await env.merger.settled('mere')
    expect(env.merges.some((m) => m.status === 'stopping')).toBe(true)
    const stopped = last(env.merges)
    expect(stopped.status).toBe('stopped')
    expect(states(stopped)).toEqual(['merged', 'pending', 'pending'])
    // La base est entière : elle a A, ni B ni C, et le dépôt principal est propre.
    expect(git(env.root, 'rev-parse', 'main')).toBe(git(env.root, 'rev-parse', a.worktree.branch))
    expect(existsSync(join(env.root, 'b.txt'))).toBe(false)
    expect(git(env.root, 'status', '--porcelain')).toBe('')
  })

  it('« Puis nettoyer » : filles fusionnées archivées, worktrees et branches supprimés', async () => {
    const env = await setup(['A', 'B'])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    // B n'a rien fait de plus que la base : déjà à jour, nettoyée aussi.
    await env.merger.start('mere', ['f1', 'f2'], true)
    await env.merger.settled('mere')
    const done = last(env.merges)
    expect(states(done)).toEqual(['merged', 'up-to-date'])
    expect(done.rows.map((r) => r.cleaned)).toEqual([true, true])
    expect(env.left).toEqual(['f1', 'f2'])
    expect(existsSync(a.worktree.path) || existsSync(b.worktree.path)).toBe(false)
    expect(git(env.root, 'branch', '--list', 'bobine/*')).toBe('')
    expect(existsSync(join(env.root, 'a.txt'))).toBe(true)
  })

  it('fille avec des modifications non commitées : exclue du plan, sautée si demandée', async () => {
    const env = await setup(['A', 'B'])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    writeFileSync(join(b.worktree.path, 'brouillon.txt'), 'x\n')
    const plan = await env.merger.plan('mere')
    expect(plan.children.map((c) => [c.state, c.dirty])).toEqual([
      ['ready', 0],
      ['dirty', 1]
    ])
    await env.merger.start('mere', ['f1', 'f2'], false)
    await env.merger.settled('mere')
    expect(states(last(env.merges))).toEqual(['merged', 'dirty'])
    expect(existsSync(join(env.root, 'b.txt'))).toBe(false)
    // Rien n'est commité à la place de l'utilisateur.
    expect(git(b.worktree.path, 'status', '--porcelain')).toBe('?? brouillon.txt')
  })

  it('filles au travail ou en erreur : dites, pas lues', async () => {
    const env = await setup(['A', 'B', 'C'])
    const [a, b, c] = env.children as [Child, Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    b.status = 'busy'
    c.status = 'error'
    const plan = await env.merger.plan('mere')
    expect(plan.children.map((x) => x.state)).toEqual(['ready', 'running', 'error'])
    expect(env.logged.filter((l) => l.includes(b.worktree.path))).toEqual([])
  })

  it('refus : fusion déjà en cours, fille supprimée ou archivée, aucune fille', async () => {
    const env = await setup(['A', 'B'])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    await expect(env.merger.start('mere', [], false)).rejects.toThrow(t('childrenMerge.error.none'))
    await expect(env.merger.start('mere', ['f1', 'inconnue'], false)).rejects.toThrow(
      t('childrenMerge.error.gone')
    )
    b.archived = true
    await expect(env.merger.start('mere', ['f2'], false)).rejects.toThrow(
      t('childrenMerge.error.gone')
    )
    b.archived = false
    const started = env.merger.start('mere', ['f1'], false)
    await expect(env.merger.start('mere', ['f2'], false)).rejects.toThrow(
      t('childrenMerge.error.running')
    )
    await started
    expect(env.merger.running('mere')).toBe(true)
    await env.merger.settled('mere')
    expect((await env.merger.plan('mere')).running).toBe(false)
  })

  it('fille supprimée pendant la chaîne : sa ligne échoue, les autres continuent', async () => {
    const env = await setup(['A', 'B'])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    env.options.onPost = (merge) => {
      if (merge.rows[0]?.state === 'merging') env.left.push('f2')
    }
    await env.merger.start('mere', ['f1', 'f2'], false)
    await env.merger.settled('mere')
    const done = last(env.merges)
    expect(states(done)).toEqual(['merged', 'failed'])
    expect(done.rows[1]?.error).toBe(t('childrenMerge.error.gone'))
    expect(done.status).toBe('done')
  })

  it('base extraite dans un autre worktree : refus d’avance, et la chaîne s’arrête sans rien avancer', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    git(env.root, 'switch', '-q', '-c', 'autre')
    const other = join(env.root, '.worktrees', 'ailleurs')
    git(env.root, 'worktree', 'add', '-q', other, 'main')
    const before = git(env.root, 'rev-parse', 'main')
    const plan = await env.merger.plan('mere')
    expect(plan.blocked).toEqual({ reason: 'base-elsewhere', path: other })
    await env.merger.start('mere', ['f1'], false)
    await env.merger.settled('mere')
    const failed = last(env.merges)
    expect(failed.status).toBe('failed')
    expect(failed.rows[0]?.error).toContain('autre worktree')
    expect(git(env.root, 'rev-parse', 'main')).toBe(before)
  })
})

describe('dossier principal non commité (fiche 123)', () => {
  it('plan refusé avec les fichiers ; départ refusé ; rien n’avance', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nbrouillon\n')
    const before = git(env.root, 'rev-parse', 'main')
    const plan = await env.merger.plan('mere')
    expect(plan.blocked).toEqual({
      reason: 'main-dirty',
      path: env.root,
      base: 'main',
      title: 'Mère',
      files: [{ path: 'README.md', status: 'modified' }]
    })
    await expect(env.merger.start('mere', ['f1'], false)).rejects.toThrow('README.md')
    expect(env.merges).toHaveLength(0)
    expect(env.merger.running('mere')).toBe(false)
    expect(git(env.root, 'rev-parse', 'main')).toBe(before)
  })

  it('« Mettre de côté » : une mise de côté pour la chaîne, remise à la fin, dite dans le fil', async () => {
    const env = await setup(['A', 'B'])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nbrouillon\n')
    writeFileSync(join(env.root, 'note.txt'), 'n\n')
    const first = await env.merger.start('mere', ids(env.children), false, true)
    expect(first.stash).toEqual({ state: 'kept', count: 2 })
    await env.merger.settled('mere')
    const done = last(env.merges)
    expect(done.status).toBe('done')
    expect(states(done)).toEqual(['merged', 'merged'])
    expect(done.stash).toEqual({ state: 'restored', count: 2 })
    expect(readFileSync(join(env.root, 'README.md'), 'utf8')).toBe('# Démo\n\nbrouillon\n')
    expect(readFileSync(join(env.root, 'note.txt'), 'utf8')).toBe('n\n')
    expect(existsSync(join(env.root, 'a.txt')) && existsSync(join(env.root, 'b.txt'))).toBe(true)
    expect(git(env.root, 'stash', 'list')).toBe('')
    // Pendant la chaîne, le fil disait la mise de côté.
    expect(env.merges.filter((m) => m.stash?.state === 'kept').length).toBeGreaterThan(1)
  })

  it('remise qui échoue : l’entrée reste dans git stash, le fil le dit', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'README.md', '# Démo\n\nVersion A\n')
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nbrouillon\n')
    await env.merger.start('mere', ['f1'], false, true)
    await env.merger.settled('mere')
    const done = last(env.merges)
    expect(done.status).toBe('done')
    expect(done.stash).toMatchObject({ state: 'failed', count: 1, conflicts: ['README.md'] })
    expect(done.stash?.state === 'failed' && done.stash.ref).toMatch(/^[0-9a-f]{7}$/)
    expect(git(env.root, 'stash', 'list').split('\n')).toHaveLength(1)
  })

  it('« Committer d’abord » : commit dans le dossier principal, puis la fusion part', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nmère\n')
    const commit = await env.merger.commitMain('mere', {
      message: 'feat: mère',
      files: ['README.md']
    })
    expect(git(env.root, 'log', '--format=%s', '-1')).toBe('feat: mère')
    expect(commit.short).toHaveLength(7)
    expect((await env.merger.plan('mere')).blocked).toBeUndefined()
    await env.merger.start('mere', ['f1'], false)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('done')
    expect(readFileSync(join(env.root, 'README.md'), 'utf8')).toBe('# Démo\n\nmère\n')
    expect(existsSync(join(env.root, 'a.txt'))).toBe(true)
  })
})

describe('canaux IPC de la fusion des filles (fiche 120)', () => {
  it('arguments vérifiés, indisponible sans le module', async () => {
    const calls: unknown[][] = []
    const handlers = childrenMergeHandlers({
      plan: async (id) => ({ base: id, children: [], overlaps: [], running: false }),
      start: async (...args) => {
        calls.push(args)
        return {
          runId: 'r',
          base: 'main',
          cleanup: false,
          status: 'running',
          rows: [],
          startedAt: 0
        }
      },
      stop: (id) => void calls.push(['stop', id]),
      commitMain: async (...args) => {
        calls.push(['commitMain', ...args])
        return { hash: 'deadbeef', short: 'deadbee' }
      }
    })
    expect(await handlers['children:mergePlan']('mere')).toMatchObject({ base: 'mere' })
    expect(() => handlers['children:mergePlan']('')).toThrow('motherId')
    expect(() =>
      handlers['children:merge']('mere', [1] as unknown as string[], { cleanup: false })
    ).toThrow('ids')
    await handlers['children:merge']('mere', ['f1'], { cleanup: true })
    await handlers['children:merge']('mere', ['f1'], { cleanup: 'oui' } as unknown as {
      cleanup: boolean
    })
    expect(handlers['children:mergeStop']('mere')).toBeUndefined()
    await handlers['children:merge']('mere', ['f1'], { cleanup: false, stash: true })
    expect(() => handlers['children:commitMain']('mere', { message: 'm', files: [''] })).toThrow(
      'files'
    )
    expect(await handlers['children:commitMain']('mere', { message: 'm', files: ['a'] })).toEqual({
      hash: 'deadbeef',
      short: 'deadbee'
    })
    expect(calls).toEqual([
      ['mere', ['f1'], true, false],
      ['mere', ['f1'], false, false],
      ['stop', 'mere'],
      ['mere', ['f1'], false, true],
      ['commitMain', 'mere', { message: 'm', files: ['a'] }]
    ])
    expect(() => childrenMergeHandlers(undefined)['children:mergePlan']('mere')).toThrow(
      t('ipc.unavailable.childrenMerge')
    )
  })
})
