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
  // Windows : un processus git qui finit tient encore le dossier un instant (`EPERM`, CI du
  // 2026-11-25) ; quelques nouvelles tentatives espacées, comme le fait `rm -rf` sous Windows.
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
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
  const prompts: { id: string; text: string; from?: unknown }[] = []
  const left: string[] = []
  const options = {
    /** Ce que fait l'agent de la fille d'une consigne de conflit : réécrit les fichiers. */
    resolve: (child: Child, files: string[]) => {
      for (const file of files) writeFileSync(join(child.worktree.path, file), 'résolu\n')
    },
    onPost: (_merge: ChildrenMerge) => {}
  }
  /** Autres conversations de la mère (Code reviewer d'un travail, fiche 265). */
  const others: ConversationSummary[] = []
  const host = {
    state: () => ({
      activeId: 'mere',
      conversations: [
        ...others,
        ...children.map((c) => ({
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
      ]
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
      // Conversation inconnue : écarté, comme le gestionnaire (fiche 228).
      if (id !== 'mere') return false
      apply(event)
      if (event.type === 'children-merge') {
        merges.push(event.merge)
        options.onPost(event.merge)
      }
      return true
    },
    prompt: async (id: string, text: string, _attachments?: unknown, opts?: { from?: unknown }) => {
      prompts.push({ id, text, ...(opts?.from ? { from: opts.from } : {}) })
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
  /** Fiche 246, D4 : dépôts changés signalés (vues Git à relire). */
  const changed: string[] = []
  const cycle = new WorktreeCycle(gitCommand, { log: (_id, line) => logged.push(line) })
  const merger = new ChildrenMerger({
    conversations: host,
    cycle,
    worktrees,
    log: (_id, line) => logged.push(line),
    changed: (id) => changed.push(id)
  })
  /** Committe ce fichier dans le worktree de la fille. */
  const commit = (child: Child, file: string, content: string) => {
    writeFileSync(join(child.worktree.path, file), content)
    git(child.worktree.path, 'add', '.')
    git(child.worktree.path, 'commit', '-q', '-m', `feat: ${file}`)
  }
  const transcript = () => mother
  return {
    root,
    children,
    merger,
    merges,
    prompts,
    logged,
    changed,
    options,
    commit,
    transcript,
    left,
    others,
    apply
  }
}

const ids = (children: Child[]) => children.map((c) => c.id)
const last = (merges: ChildrenMerge[]) => merges.at(-1) as ChildrenMerge
const states = (merge: ChildrenMerge) => merge.rows.map((r) => r.state)

describe('fusion de toutes les filles (fiche 120)', () => {
  // 30 s, processus lents à lancer sous Windows (fiche 229) : 68 git ;
  // 4,5 s sur x64, 7,6 s au pire (arm64).
  it('deux filles sans recouvrement : fusionnées dans l’ordre de lancement, base avancée', async () => {
    // Lancées dans l'ordre f2 puis f1 : f2 passe en premier.
    const env = await setup(['Import CSV', 'Page d’aide'], [1, 0])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')

    const plan = await env.merger.plan('mere')
    expect(plan).toMatchObject({ base: 'main', overlaps: [], running: false })
    // Fichiers et lignes de chaque branche contre sa base (fiche 264) : ce que la fusion apportera.
    expect(plan.children.map((c) => [c.id, c.state, c.files, c.added, c.removed])).toEqual([
      ['f2', 'ready', ['b.txt'], 1, 0],
      ['f1', 'ready', ['a.txt'], 1, 0]
    ])
    expect(plan.blocked).toBeUndefined()

    // L'ordre reçu (celui du plan, donc des lignes de la carte) est celui de la fusion.
    const first = await env.merger.start('mere', ['f2', 'f1'], false)
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
    // Fiche 246, D4 : la fusion finie, les vues Git du dépôt de la mère se relisent.
    expect(env.changed).toEqual(['mere'])
    // Après coup : les deux filles sont fusionnées, plus rien à proposer.
    expect((await env.merger.plan('mere')).children.map((c) => c.state)).toEqual([
      'merged',
      'merged'
    ])
  }, 30_000)

  it('fiche 285 : un participant de tour de table ne se fusionne pas, et n’est pas dans le plan', async () => {
    const env = await setup(['Travail', 'Participant'])
    env.apply({
      type: 'roundtable',
      roundtable: {
        roundtableId: 'rt',
        question: 'Q',
        synthesizer: { profileId: 'mock', label: 'Factice' },
        seats: [
          {
            profileId: 'mock',
            label: 'F',
            agentLabel: 'F',
            letter: 'A',
            childId: 'f2',
            state: 'answered'
          }
        ],
        phase: 'synthesized',
        at: 1
      }
    })
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    expect((await env.merger.plan('mere')).children.map((c) => c.id)).toEqual(['f1'])
  }, 30_000)

  it('recouvrement détecté : deux filles modifient le même fichier', async () => {
    const env = await setup(['A', 'B', 'C'])
    const [a, b, c] = env.children as [Child, Child, Child]
    env.commit(a, 'README.md', '# Démo\n\nVersion A\n')
    env.commit(a, 'src.txt', 'a\n')
    env.commit(b, 'README.md', '# Démo\n\nVersion B\n')
    env.commit(c, 'c.txt', 'c\n')
    const plan = await env.merger.plan('mere')
    expect(plan.overlaps).toEqual([{ first: 'A', second: 'B', files: ['README.md'] }])
    // Une carte (fiche 264) : seulement ses travaux, dans l'ordre de ses lignes, et leurs
    // recouvrements entre eux.
    const card = await env.merger.plan('mere', ['f3', 'f1'])
    expect(card.children.map((c) => [c.id, c.state])).toEqual([
      ['f3', 'ready'],
      ['f1', 'ready']
    ])
    expect(card.overlaps).toEqual([])
    expect((await env.merger.plan('mere', [])).children).toEqual([])
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
    // Sa provenance dite dans le fil du travail (fiche 264) : la fusion lancée depuis la mère.
    expect(env.prompts[0]?.from).toEqual({ kind: 'merge', id: 'mere', title: 'Mère' })
    const resolving = env.merges.find((m) => m.rows[1]?.state === 'resolving')
    expect(resolving?.rows[1]?.files).toEqual(['README.md'])
    const done = last(env.merges)
    expect(done.status).toBe('done')
    expect(states(done)).toEqual(['merged', 'merged', 'merged'])
    expect(readFileSync(join(env.root, 'README.md'), 'utf8')).toBe('résolu\n')
    expect(existsSync(join(env.root, 'c.txt'))).toBe(true)
  })

  // 30 s, processus lents à lancer sous Windows (fiche 229) : 98 git ;
  // 6,7 s sur x64, 8,8 s au pire (arm64).
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
  }, 30_000)

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

  it('nettoyage : jamais de travail détruit — branche qui a bougé ou dossier modifié depuis la fusion (fiche 264)', async () => {
    const env = await setup(['A', 'B'])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    // Pendant la chaîne, juste après leur fusion : A reçoit un commit, B une modification.
    const touched = new Set<string>()
    env.options.onPost = (merge) => {
      for (const row of merge.rows) {
        if (row.state !== 'merged' || touched.has(row.childId)) continue
        touched.add(row.childId)
        if (row.childId === 'f1') env.commit(a, 'apres.txt', 'après la fusion\n')
        else writeFileSync(join(b.worktree.path, 'brouillon.txt'), 'en cours\n')
      }
    }
    await env.merger.start('mere', ['f1', 'f2'], true)
    await env.merger.settled('mere')
    const done = last(env.merges)
    expect(states(done)).toEqual(['merged', 'merged'])
    expect(done.rows.map((r) => r.cleaned ?? false)).toEqual([false, false])
    expect(done.rows.every((r) => r.error?.includes('pas nettoyé'))).toBe(true)
    // Rien de supprimé : dossiers, branches, le commit d'après et la modification sont là.
    expect(env.left).toEqual([])
    expect(existsSync(join(a.worktree.path, 'apres.txt'))).toBe(true)
    expect(existsSync(join(b.worktree.path, 'brouillon.txt'))).toBe(true)
    expect(git(env.root, 'branch', '--list', a.worktree.branch)).not.toBe('')
    // Ce que la fusion a apporté et le commit de la base, retenus sur la ligne.
    expect(done.rows[0]).toMatchObject({ fileCount: 1, added: 1, removed: 0 })
    // A est entrée en avance rapide : la base était alors au bout de sa branche.
    const atMerge = git(env.root, 'log', '--format=%H', '-1', '--grep', 'feat: a.txt', 'main')
    expect(atMerge.startsWith(done.rows[0]?.commit ?? '-')).toBe(true)
  })

  it('travail au travail ou qui attend un accord : la fusion le refuse (fiche 264)', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    a.status = 'busy'
    await expect(env.merger.start('mere', ['f1'], true)).rejects.toThrow('travaille encore')
    expect(env.merges).toEqual([])
  })

  it('travail en cours de relecture : fusion refusée, et jamais nettoyé sous son relecteur (fiche 265)', async () => {
    const env = await setup(['A', 'B'])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    const reviewer: ConversationSummary = {
      id: 'relecteur',
      title: 'Relecture : A',
      profileId: 'mock',
      profileLabel: 'Factice',
      workspace: a.workspace,
      updatedAt: '2026-10-22T10:00:00.000Z',
      status: 'busy',
      draft: false,
      startedFrom: { id: 'mere', title: 'Mère' },
      reviewOf: { id: 'f1', title: 'A' }
    }
    env.others.push(reviewer)
    await expect(env.merger.start('mere', ['f1'], true)).rejects.toThrow('en cours de relecture')
    expect(env.merges).toEqual([])
    // Relecture lancée pendant la chaîne (après la fusion de A) : A n'est pas nettoyé.
    env.others.splice(0)
    env.options.onPost = (merge) => {
      if (merge.rows[0]?.state === 'merged' && env.others.length === 0) {
        env.others.push({ ...reviewer, status: 'busy' })
      }
    }
    await env.merger.start('mere', ['f1', 'f2'], true)
    await env.merger.settled('mere')
    const done = last(env.merges)
    expect(states(done)).toEqual(['merged', 'merged'])
    expect(done.rows.map((r) => r.cleaned ?? false)).toEqual([false, true])
    expect(existsSync(a.worktree.path)).toBe(true)
  })

  it('« Arrêter » d’une autre carte : sans effet ; le plan dit quelle fusion tourne (fiche 264)', async () => {
    const env = await setup(['A', 'B'])
    const [a, b] = env.children as [Child, Child]
    env.commit(a, 'a.txt', 'a\n')
    env.commit(b, 'b.txt', 'b\n')
    let runId = ''
    let stoppedOther = false
    env.options.onPost = (merge) => {
      if (stoppedOther || merge.rows[0]?.state !== 'merging') return
      stoppedOther = true
      runId = merge.runId
      env.merger.stop('mere', 'une-autre-fusion')
    }
    const first = await env.merger.start('mere', ['f1', 'f2'], false)
    expect((await env.merger.plan('mere')).runId).toBe(first.runId)
    await env.merger.settled('mere')
    expect(runId).toBe(first.runId)
    expect(env.merges.some((m) => m.status === 'stopping')).toBe(false)
    expect(states(last(env.merges))).toEqual(['merged', 'merged'])
    expect((await env.merger.plan('mere')).runId).toBeUndefined()
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
    const first = await env.merger.start('mere', ids(env.children), false, { stash: true })
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
    await env.merger.start('mere', ['f1'], false, { stash: true })
    await env.merger.settled('mere')
    const done = last(env.merges)
    expect(done.status).toBe('done')
    expect(done.stash).toMatchObject({ state: 'failed', count: 1, conflicts: ['README.md'] })
    expect(done.stash?.state === 'failed' && done.stash.ref).toMatch(/^[0-9a-f]{7}$/)
    expect(git(env.root, 'stash', 'list').split('\n')).toHaveLength(1)
  })

  it('fiche 244 : cochés commités, .env décoché mis de côté ; fille non fusionnée, il revient quand même', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    // La fille a du non commité : elle n'est pas fusionnée (la chaîne s'arrête sur elle).
    writeFileSync(join(a.worktree.path, 'en-cours.txt'), 'x\n')
    writeFileSync(join(env.root, 'plan.md'), 'plan\n')
    writeFileSync(join(env.root, '.env'), 'SECRET=1\n')
    await env.merger.start('mere', ['f1'], false, {
      stash: true,
      commit: { message: 'feat: plan', files: ['plan.md'] }
    })
    await env.merger.settled('mere')
    expect(git(env.root, 'log', '--format=%s', '-1', 'main')).toBe('feat: plan')
    const done = last(env.merges)
    expect(states(done)).toEqual(['dirty'])
    expect(done.stash).toEqual({ state: 'restored', count: 1 })
    expect(readFileSync(join(env.root, '.env'), 'utf8')).toBe('SECRET=1\n')
    expect(git(env.root, 'stash', 'list')).toBe('')
    expect(git(env.root, 'log', '--all', '--name-only', '--format=')).not.toContain('.env')
  })

  it('« Committer puis fusionner » : commit dans le dossier principal, puis la fusion part', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nmère\n')
    await env.merger.start('mere', ['f1'], false, {
      commit: { message: 'feat: mère', files: ['README.md'] }
    })
    await env.merger.settled('mere')
    expect(git(env.root, 'log', '--format=%s', 'main').split('\n')).toContain('feat: mère')
    expect(last(env.merges).status).toBe('done')
    expect(readFileSync(join(env.root, 'README.md'), 'utf8')).toBe('# Démo\n\nmère\n')
    expect(existsSync(join(env.root, 'a.txt'))).toBe(true)
  })
})

/** La mère, dans le dossier principal du dépôt (hors worktree), à tel statut. */
const motherIn = (root: string, status: ConversationSummary['status']): ConversationSummary => ({
  id: 'mere',
  title: 'Mère',
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: root,
  updatedAt: '2026-11-26T10:00:00.000Z',
  status,
  draft: false
})

describe('« Committer puis fusionner » refusé avant tout commit (fiche 287)', () => {
  // Recette Bricole, 21:55 : la mère écrivait encore dans le dossier principal ; le commit partait,
  // puis la fusion était refusée (« le dossier principal a 6 modifications non commitées »).
  it('un tour de la mère dans le dossier principal : refusé, rien de commité ni de fusionné', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    env.others.push(motherIn(env.root, 'busy'))
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nmère\n')
    const before = git(env.root, 'rev-parse', 'main')
    await expect(
      env.merger.start('mere', ['f1'], false, {
        commit: { message: 'feat: mère', files: ['README.md'] }
      })
    ).rejects.toThrow(t('worktreeCycle.error.turnRunning', { title: 'Mère' }))
    expect(git(env.root, 'rev-parse', 'main')).toBe(before)
    expect(git(env.root, 'status', '--porcelain')).toBe('M README.md')
    expect(env.merges).toHaveLength(0)
    expect(env.merger.running('mere')).toBe(false)
  })

  it('la mère attend un accord : refusé de même ; finie, le même geste passe', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    const mother = motherIn(env.root, 'needs-action')
    env.others.push(mother)
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nmère\n')
    const request = { commit: { message: 'feat: mère', files: ['README.md'] } }
    await expect(env.merger.start('mere', ['f1'], false, request)).rejects.toThrow('Mère')
    mother.status = 'ready'
    await env.merger.start('mere', ['f1'], false, request)
    await env.merger.settled('mere')
    expect(last(env.merges).status).toBe('done')
    expect(git(env.root, 'log', '--format=%s', 'main').split('\n')).toContain('feat: mère')
  })

  it('un travail qui répond encore : refusé avant le commit (plus après)', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    a.status = 'busy'
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nmère\n')
    const before = git(env.root, 'rev-parse', 'main')
    await expect(
      env.merger.start('mere', ['f1'], false, {
        commit: { message: 'feat: mère', files: ['README.md'] }
      })
    ).rejects.toThrow('travaille encore')
    expect(git(env.root, 'rev-parse', 'main')).toBe(before)
    expect(git(env.root, 'status', '--porcelain')).toBe('M README.md')
  })

  it('d’autres fichiers écrits depuis le choix : refusé avant le commit, ils sont nommés', async () => {
    const env = await setup(['A'])
    const [a] = env.children as [Child]
    env.commit(a, 'a.txt', 'a\n')
    writeFileSync(join(env.root, 'README.md'), '# Démo\n\nmère\n')
    // Écrit après que l'utilisateur a coché README.md (un agent, un outil).
    writeFileSync(join(env.root, 'niveaux.ts'), 'export {}\n')
    const before = git(env.root, 'rev-parse', 'main')
    await expect(
      env.merger.start('mere', ['f1'], false, {
        commit: { message: 'feat: mère', files: ['README.md'] }
      })
    ).rejects.toThrow('niveaux.ts')
    expect(git(env.root, 'rev-parse', 'main')).toBe(before)
    expect(env.merges).toHaveLength(0)
  })
})

describe('canaux IPC de la fusion des filles (fiche 120)', () => {
  it('arguments vérifiés, indisponible sans le module', async () => {
    const calls: unknown[][] = []
    const planned: (readonly string[] | undefined)[] = []
    const handlers = childrenMergeHandlers({
      plan: async (id, list) => {
        planned.push(list)
        return { base: id, children: [], overlaps: [], running: false }
      },
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
      stop: (id) => void calls.push(['stop', id])
    })
    expect(await handlers['children:mergePlan']('mere')).toMatchObject({ base: 'mere' })
    expect(() => handlers['children:mergePlan']('')).toThrow('motherId')
    // Une carte ne lit que ses travaux (fiche 264) : la liste est vérifiée, puis passée.
    expect(await handlers['children:mergePlan']('mere', ['f1'])).toMatchObject({ base: 'mere' })
    expect(planned).toEqual([undefined, ['f1']])
    expect(() => handlers['children:mergePlan']('mere', [3] as unknown as string[])).toThrow('ids')
    expect(() =>
      handlers['children:merge']('mere', [1] as unknown as string[], { cleanup: false })
    ).toThrow('ids')
    await handlers['children:merge']('mere', ['f1'], { cleanup: true })
    await handlers['children:merge']('mere', ['f1'], { cleanup: 'oui' } as unknown as {
      cleanup: boolean
    })
    expect(handlers['children:mergeStop']('mere')).toBeUndefined()
    await handlers['children:merge']('mere', ['f1'], { cleanup: false, stash: true })
    // « Committer puis fusionner » (fiche 287) : le commit va avec la fusion, vérifié.
    expect(() =>
      handlers['children:merge']('mere', ['f1'], {
        cleanup: false,
        commit: { message: 'm', files: [''] }
      })
    ).toThrow('files')
    await handlers['children:merge']('mere', ['f1'], {
      cleanup: false,
      commit: { message: 'm', files: ['a'] }
    })
    expect(calls).toEqual([
      ['mere', ['f1'], true, { stash: false }],
      ['mere', ['f1'], false, { stash: false }],
      ['stop', 'mere'],
      ['mere', ['f1'], false, { stash: true }],
      ['mere', ['f1'], false, { stash: false, commit: { message: 'm', files: ['a'] } }]
    ])
    expect(() => childrenMergeHandlers(undefined)['children:mergePlan']('mere')).toThrow(
      t('ipc.unavailable.childrenMerge')
    )
  })
})
