/**
 * Vue Git à jour après une action de Bobine sur un dépôt (fiche 246, D4). La vue Git d'une
 * conversation ne se relisait qu'à l'ouverture, à la fin d'un outil de l'agent, après une action
 * faite dans son propre panneau, ou sur « Actualiser » : un commit ou une fusion faits ailleurs
 * (carte « Fusion refusée » du fil, carte Sous-tâches, avertissement avant une fille, barre d'une
 * autre conversation) la laissaient périmée. Après chaque commande qui change un dépôt, l'évènement
 * `changes:gitChanged` part pour **toutes les conversations de ce dépôt** (worktrees compris).
 */
import { realpathSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { IpcChannel, IpcEventContract, IpcHandlers } from '@shared/ipc'
import { nativeGitPath } from '../git/git-platform'
import type { Run } from '../simulator/run'

/** Canaux qui changent un dépôt ; leur premier argument est la conversation qui agit. */
export const REPO_CHANGING_CHANNELS = [
  'worktree:commit',
  'worktree:undoCommit',
  'worktree:commitMain',
  'worktree:merge',
  'worktree:mergeContinue',
  'worktree:mergeAbort',
  'worktree:cleanup',
  'changes:commit',
  'changes:undoCommit',
  'changes:revert',
  'children:commitMain',
  'conversation:commitForChildren'
] as const satisfies readonly IpcChannel[]

/** Une conversation et son dépôt : dossier, et racine du dépôt principal si elle est en worktree. */
export interface RepoPlace {
  id: string
  workspace: string
  root?: string
}

const real = (path: string): string => {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

const inside = (path: string, root: string) => path === root || path.startsWith(root + sep)

type Send = (channel: 'changes:gitChanged', payload: IpcEventContract['changes:gitChanged']) => void

export class GitChangedNotifier {
  private readonly places: () => RepoPlace[]
  private readonly run: Run
  private readonly send: Send

  constructor(places: () => RepoPlace[], run: Run, send: Send) {
    this.places = places
    this.run = run
    this.send = send
  }

  /** Conversations du même dépôt que `id` (elle comprise). */
  async sameRepo(id: string): Promise<string[]> {
    const all = this.places()
    const acting = all.find((p) => p.id === id)
    if (!acting) return []
    let root = acting.root
    if (!root) {
      const top = await this.run('git', ['rev-parse', '--show-toplevel'], {
        cwd: acting.workspace,
        timeoutMs: 10_000
      })
      if (top.code !== 0) return [id]
      root = nativeGitPath(top.stdout.toString('utf8').trim())
    }
    const repo = real(root)
    const ids = all
      .filter((p) => (p.root && real(p.root) === repo) || inside(real(p.workspace), repo))
      .map((p) => p.id)
    return [...new Set([id, ...ids])]
  }

  /** Prévient les vues Git du dépôt de `id` ; ne lève jamais. */
  async notify(id: string): Promise<void> {
    try {
      const conversationIds = await this.sameRepo(id)
      if (conversationIds.length > 0) this.send('changes:gitChanged', { conversationIds })
    } catch {
      // Conversation partie entre-temps : rien à relire.
    }
  }
}

/**
 * Les canaux qui changent un dépôt, enveloppés : l'évènement part après leur fin, réussie ou non
 * (une fusion en conflit a déjà changé le dépôt).
 */
export function withGitChanged(
  handlers: IpcHandlers,
  notify: ((id: string) => void) | undefined
): IpcHandlers {
  if (!notify) return handlers
  const wrapped = { ...handlers }
  for (const channel of REPO_CHANGING_CHANNELS) {
    const handler = handlers[channel] as (...args: unknown[]) => unknown
    ;(wrapped as Record<string, unknown>)[channel] = (...args: unknown[]) => {
      const id = args[0]
      const after = () => {
        if (typeof id === 'string' && id) notify(id)
      }
      try {
        const result = handler(...args)
        if (result instanceof Promise) return result.finally(after)
        after()
        return result
      } catch (error) {
        after()
        throw error
      }
    }
  }
  return wrapped
}
