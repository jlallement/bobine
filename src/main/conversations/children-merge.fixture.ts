/**
 * Banc d'essai de la fusion enchaînée (fiches 120, 289) : un vrai dépôt git jetable, une mère et ses
 * filles dans de vrais worktrees ; seul l'agent de la fille est simulé (`options.resolve`).
 * Partagé par `children-merge.test.ts` et `children-merge-agent.test.ts`.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentEvent, ConversationSummary } from '@shared/agent'
import type { ChildrenMerge } from '@shared/children-merge'
import { emptyTranscript, reduceTranscript, type TranscriptState } from '@shared/transcript'
import { WorktreeCycle, type CycleTarget } from '../changes/worktree-cycle'
import { Worktrees, type WorktreeInfo } from '../changes/worktrees'
import { gitCommand, queuedGit } from '../git/git-queue'
import { ChildrenMerger, type ChildrenMergeHost } from './children-merge'

const dirs: string[] = []
/** À appeler après chaque essai (`afterEach`) : supprime les dépôts jetables. */
export function cleanupDirs(): void {
  // Windows : un processus git qui finit tient encore le dossier un instant (`EPERM`, CI du
  // 2026-11-25) ; quelques nouvelles tentatives espacées, comme le fait `rm -rf` sous Windows.
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

export const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

export interface Child {
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
export async function setup(titles: string[], launchOrder?: number[]) {
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
    resolve: (child: Child, files: string[]): void | Promise<void> => {
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
      await options.resolve(child, files)
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
    apply,
    host,
    worktrees
  }
}

export const ids = (children: Child[]) => children.map((c) => c.id)
export const last = (merges: ChildrenMerge[]) => merges.at(-1) as ChildrenMerge
export const states = (merge: ChildrenMerge) => merge.rows.map((r) => r.state)
