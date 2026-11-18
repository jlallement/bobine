/**
 * Branchement réel (`index.ts`) du message de commit rédigé par l'agent et des vues Git relues
 * (fiche 246) : ce que ces deux modules demandent au gestionnaire de conversations, aux réglages
 * et à la mémoire.
 */
import type { CommitDraftPlace } from '@shared/commit-draft'
import type { IpcEventContract } from '@shared/ipc'
import { GitChangedNotifier } from '../changes/git-changed'
import { nativeGitPath } from '../git/git-platform'
import type { MemoryService } from '../memory/service'
import type { SettingsStore } from '../settings-store'
import type { Run } from '../simulator/run'
import { CommitDrafts } from './commit-draft'
import type { ConversationManager } from './manager'

/**
 * Délai de la rédaction : 45 s, sauf `BOBINE_COMMIT_DRAFT_TIMEOUT_MS` (essais de bout en bout
 * seulement, pour voir le repli sans attendre ; jamais enregistré).
 */
export function draftTimeout(env: NodeJS.ProcessEnv): { timeoutMs?: number } {
  const value = Number(env['BOBINE_COMMIT_DRAFT_TIMEOUT_MS'])
  return Number.isInteger(value) && value >= 500 && value <= 600_000 ? { timeoutMs: value } : {}
}

export function appCommitDrafts(deps: {
  conversations: ConversationManager
  settings: Pick<SettingsStore, 'preferences'>
  memory: Pick<MemoryService, 'memoriesFor'>
  run: Run
  send: (channel: 'changes:gitChanged', payload: IpcEventContract['changes:gitChanged']) => void
}): { commitDrafts: CommitDrafts; gitChanged: GitChangedNotifier } {
  const { conversations, settings, memory, run } = deps
  const summary = (id: string) => conversations.state().conversations.find((c) => c.id === id)
  const toplevel = async (cwd: string) => {
    const top = await run('git', ['rev-parse', '--show-toplevel'], { cwd, timeoutMs: 10_000 })
    if (top.code !== 0) throw new Error(top.stderr.trim() || 'not a git repository')
    return nativeGitPath(top.stdout.toString('utf8').trim())
  }
  // Où valent les chemins des fichiers cochés : ceux de la vue Git (dossier de la conversation),
  // ou ceux de « Committer d'abord » (racine du dépôt principal).
  const cwdFor = async (id: string, place: CommitDraftPlace) => {
    const workspace = conversations.workspaceOf(id)
    if (place === 'conversation') return workspace
    return conversations.worktreeOf(id)?.worktree.root ?? (await toplevel(workspace))
  }
  const commitDrafts = new CommitDrafts({
    conversations: {
      asideHost: (id, emit) => conversations.asideHost(id, emit),
      view: (id) => conversations.view(id),
      post: (id, event) => void conversations.post(id, event),
      noteAsideSession: (id, profileId, sessionId) =>
        conversations.noteAsideSession(id, profileId, sessionId),
      subscribe: (listeners) => conversations.subscribe(listeners),
      title: (id) => summary(id)?.title ?? ''
    },
    cwdFor,
    memories: async (cwd) => {
      if (!settings.preferences().memoryEnabled) return []
      const { user, project } = await memory.memoriesFor(cwd)
      return [...project, ...user]
    },
    enabled: () => settings.preferences().commitDraftEnabled,
    run,
    ...draftTimeout(process.env)
  })
  const gitChanged = new GitChangedNotifier(
    () =>
      conversations.state().conversations.map((c) => {
        let root: string | undefined
        try {
          root = conversations.worktreeOf(c.id)?.worktree.root
        } catch {
          root = undefined
        }
        return { id: c.id, workspace: c.workspace, ...(root ? { root } : {}) }
      }),
    run,
    deps.send
  )
  return { commitDrafts, gitChanged }
}
