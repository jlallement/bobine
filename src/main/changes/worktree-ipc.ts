/**
 * Canaux IPC du cycle complet d'un worktree (fiche 110), branchés par `ipc.ts` (à son plafond de
 * lignes), comme `childHandlers`. Les arguments viennent du renderer : vérifiés ici. Fiche 123 :
 * « Committer d'abord » dans le dossier principal, et « Committer » hors worktree
 * (`changes:commit`), par le même code, dans le dossier de la conversation.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { t } from 'i18next'
import type { IpcEventContract, IpcHandlers } from '@shared/ipc'
import { messageOf } from '@shared/errors'
import {
  conflictPrompt,
  type MergeOutcome,
  type OrphanWorktree,
  type RemoteBranchOutcome
} from '@shared/worktree-cycle'
import { findExecutable } from '../agent/profiles'
import type { ConversationManager } from '../conversations/manager'
import { agentLog } from '../log'
import type { Run } from '../simulator/run'
import type { PrOptions } from '@shared/pr-tracking'
import { PrWatcher } from './pr-watch'
import type { Worktrees } from './worktrees'
import { WorktreeCycle, type CycleTarget } from './worktree-cycle'

/** Ce que le cycle demande au gestionnaire de conversations. */
export type WorktreeHost = Pick<
  ConversationManager,
  'worktreeOf' | 'worktreePaths' | 'leaveWorktree' | 'prompt' | 'state' | 'workspaceOf'
>

export interface WorktreeCycleDeps {
  cycle: Pick<
    WorktreeCycle,
    | 'info'
    | 'commit'
    | 'undoCommit'
    | 'commitMain'
    | 'commitIn'
    | 'undoCommitIn'
    | 'merge'
    | 'mergeContinue'
    | 'mergeAbort'
    | 'pullRequest'
    | 'forgetGh'
    | 'deleteRemoteBranch'
    | 'orphans'
    | 'removeOrphan'
  >
  /** Suivi de la PR et de la CI (fiche 176) ; absent : canaux `pr:*` sans suivi. */
  prs?: Pick<
    PrWatcher,
    | 'status'
    | 'refresh'
    | 'refreshNow'
    | 'pushed'
    | 'setOptions'
    | 'fixChecks'
    | 'mergeNow'
    | 'mergedHead'
    | 'forget'
  >
  conversations: WorktreeHost
  /** Suppression d'un worktree et de sa branche (fiche 036). */
  worktrees: Pick<Worktrees, 'remove'>
  /** Dossiers récents (Réglages) : des dépôts où chercher des orphelins. */
  recentWorkspaces: () => string[]
}

/** Branchement réel (`index.ts`) : `gh` cherché dans le PATH, commandes dans `agents.log`. */
export function worktreeCycleDeps(
  run: Run,
  conversations: WorktreeHost,
  worktrees: Pick<Worktrees, 'remove'>,
  settings: { current: { recentWorkspaces: string[] } },
  /**
   * Évènements vers les fenêtres (`pr:changed`, fiche 176). Donné, le suivi des PR suit aussi le
   * premier plan des fenêtres (`pr-watch-focus.ts`, chargé à part : les essais de ce module
   * n'importent pas Electron).
   */
  send?: <C extends 'pr:changed' | 'worktree:forge'>(
    channel: C,
    change: IpcEventContract[C]
  ) => void,
  pathEnv: () => string | undefined = () => process.env['PATH']
): WorktreeCycleDeps {
  const log = (id: string | undefined, line: string) =>
    agentLog.line({ ...(id ? { conversation: id } : {}), agent: 'git' }, line)
  // BOBINE_GH, BOBINE_GLAB : outil imposé (essais de bout en bout : un faux `gh` ou `glab`, jamais
  // GitHub ni GitLab) ; vide = pas d'outil.
  const forced = process.env['BOBINE_GH']
  const forcedGlab = process.env['BOBINE_GLAB']
  const cycle = new WorktreeCycle(run, {
    gh: () => (forced !== undefined ? forced || undefined : findExecutable('gh', pathEnv())),
    glab: () =>
      forcedGlab !== undefined ? forcedGlab || undefined : findExecutable('glab', pathEnv()),
    log,
    onForgeSettled: (id) => send?.('worktree:forge', { id })
  })
  const prs = new PrWatcher({
    run,
    log,
    targetOf: (id) => {
      const found = conversations.worktreeOf(id)
      return found ? { id, cwd: found.worktree.path, branch: found.worktree.branch } : undefined
    },
    ghFor: async (id) => {
      const found = conversations.worktreeOf(id)
      return found ? cycle.ghFor(found) : undefined
    },
    emit: (id, track) => send?.('pr:changed', { id, track }),
    prompt: (id, text) => conversations.prompt(id, text),
    commitDate: async (id, commit) => {
      const found = conversations.worktreeOf(id)
      return found ? cycle.commitDate(found, commit) : undefined
    },
    workflows: async (id) => {
      const found = conversations.worktreeOf(id)
      return found ? hasWorkflows(found.worktree.path) : true
    }
  })
  if (send) void import('./pr-watch-focus').then(({ watchFocus }) => watchFocus(prs))
  return {
    cycle,
    prs,
    conversations,
    worktrees,
    recentWorkspaces: () => settings.current.recentWorkspaces
  }
}

type WorktreeChannel =
  | Extract<keyof IpcHandlers, `worktree:${string}` | `pr:${string}`>
  | 'changes:commit'
  | 'changes:undoCommit'

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function worktreeHandlers(
  deps: WorktreeCycleDeps | undefined
): Pick<IpcHandlers, WorktreeChannel> {
  const available = () => {
    if (!deps) throw new Error(t('ipc.unavailable.worktree'))
    return deps
  }
  const prs = () => {
    const found = available().prs
    if (!found) throw new Error(t('ipc.unavailable.worktree'))
    return found
  }
  const target = (id: unknown): CycleTarget => {
    const found = available().conversations.worktreeOf(str(id, 'id'))
    if (!found) throw new Error(t('worktreeCycle.error.noWorktree'))
    return found
  }
  const orphans = async (): Promise<OrphanWorktree[]> => {
    const { cycle, conversations, recentWorkspaces } = available()
    const held = conversations.worktreePaths()
    const roots = [
      ...held.map((w) => w.root),
      ...recentWorkspaces(),
      ...conversations.state().conversations.map((c) => c.workspace)
    ]
    return cycle.orphans([...new Set(roots)], new Set(held.map((w) => w.path)))
  }
  /** Dossier d'une conversation ordinaire : où « Committer » hors worktree committe. */
  const folder = (id: unknown) => {
    const conversation = str(id, 'id')
    const workspace = available().conversations.workspaceOf(conversation)
    return { id: conversation, workspace, cwd: workspace }
  }
  /** Fusion refusée d'avance : le titre de la mère, d'où proposer le message de commit. */
  const withTitle = (id: string, outcome: MergeOutcome): MergeOutcome => {
    if (outcome.status !== 'main-dirty') return outcome
    const summary = available()
      .conversations.state()
      .conversations.find((c) => c.id === id)
    return summary?.startedFrom ? { ...outcome, title: summary.startedFrom.title } : outcome
  }
  return {
    'worktree:info': (id, options) => {
      const found = available().conversations.worktreeOf(str(id, 'id'))
      if (!found) return Promise.resolve(null)
      const fresh = isFresh(options)
      if (fresh) available().cycle.forgetGh()
      return available().cycle.info(found, fresh ? { fresh } : {})
    },
    'worktree:commit': (id, request) => available().cycle.commit(target(id), parseCommit(request)),
    'worktree:undoCommit': async (id, hash) => {
      await available().cycle.undoCommit(target(id), str(hash, 'hash'))
      return undefined
    },
    'worktree:commitMain': (id, request) =>
      available().cycle.commitMain(target(id), parseCommit(request)),
    'worktree:merge': (id, options) => {
      const found = target(id)
      return available()
        .cycle.merge(found, { stash: wantsStash(options) })
        .then((outcome) => withTitle(found.id, outcome))
    },
    'worktree:mergeContinue': (id, options) => {
      const found = target(id)
      return available()
        .cycle.mergeContinue(found, { stash: wantsStash(options) })
        .then((outcome) => withTitle(found.id, outcome))
    },
    'worktree:mergeAbort': async (id) => {
      await available().cycle.mergeAbort(target(id))
      return undefined
    },
    'worktree:resolveWithAgent': async (id, options): Promise<MergeOutcome> => {
      const { cycle, conversations } = available()
      const found = target(id)
      const stash = { stash: wantsStash(options) }
      const info = await cycle.info(found)
      const files = info.merging?.files ?? []
      if (files.length === 0) return withTitle(found.id, await cycle.mergeContinue(found, stash))
      // Le tour de l'agent est attendu (`prompt` rend la main à sa fin), puis la fusion reprend.
      await conversations.prompt(found.id, conflictPrompt(info.baseBranch, info.branch, files))
      return withTitle(found.id, await cycle.mergeContinue(found, stash))
    },
    'worktree:pullRequest': (id, request) => {
      const found = target(id)
      return available()
        .cycle.pullRequest(found, parsePr(request))
        .then((outcome) => {
          // Fiche 176 : la PR ouverte est suivie tout de suite, de près le temps que GitHub
          // inscrive les contrôles (0.9.1, D16).
          void available()
            .prs?.pushed(found.id)
            .catch(() => {})
          return outcome
        })
    },
    'pr:status': (id) => prs().status(str(id, 'id')),
    'pr:refresh': (id) => {
      const conversation = str(id, 'id')
      available().cycle.forgetGh()
      return prs().refreshNow(conversation)
    },
    'pr:options': (id, options) => prs().setOptions(str(id, 'id'), parsePrOptions(options)),
    'pr:fixChecks': (id) => prs().fixChecks(str(id, 'id')),
    'pr:mergeNow': (id) => prs().mergeNow(str(id, 'id')),
    'worktree:cleanup': async (id) => {
      const { conversations, worktrees, cycle } = available()
      const conversation = str(id, 'id')
      // PR fusionnée : la branche distante part aussi, si elle porte encore le dernier commit
      // de la PR (0.9.1, D19) ; son échec est rendu, et le nettoyage local se fait quand même.
      let remote: RemoteBranchOutcome | undefined
      const found = conversations.worktreeOf(conversation)
      const head = available().prs?.mergedHead(conversation)
      if (found && head) {
        remote = await cycle.deleteRemoteBranch(found, head).then(
          (outcome) =>
            outcome === 'moved' ? { kept: 'moved' as const } : { deleted: true as const },
          (error: unknown) => ({ error: messageOf(error) })
        )
      }
      available().prs?.forget(conversation)
      const worktree = conversations.leaveWorktree(conversation)
      await worktrees.remove(worktree, { force: true })
      return { state: conversations.state(), ...(remote ? { remote } : {}) }
    },
    'changes:commit': (id, request) => available().cycle.commitIn(folder(id), parseCommit(request)),
    'changes:undoCommit': async (id, hash) => {
      await available().cycle.undoCommitIn(folder(id), str(hash, 'hash'))
      return undefined
    },
    'worktree:orphans': orphans,
    'worktree:removeOrphan': async (orphan) => {
      await available().cycle.removeOrphan(parseOrphan(orphan))
      return orphans()
    }
  }
}

/** « Actualiser » : l'état de `gh` est relu aussi. */
const isFresh = (options: unknown): boolean =>
  typeof options === 'object' && options !== null && (options as { fresh?: unknown }).fresh === true

/**
 * Une CI GitHub dans la branche : un fichier `.yml` ou `.yaml` dans `.github/workflows`. Lu sur le
 * disque, sans appel à GitHub ; une CI externe (statuts) n'est vue qu'à son premier contrôle.
 */
export async function hasWorkflows(worktree: string): Promise<boolean> {
  try {
    const files = await readdir(join(worktree, '.github', 'workflows'))
    return files.some((f) => /\.ya?ml$/i.test(f))
  } catch {
    return false
  }
}

/** « Mettre de côté » demandé (fiche 123) ; tout le reste vaut non. */
const wantsStash = (options: unknown): boolean =>
  typeof options === 'object' && options !== null && (options as { stash?: unknown }).stash === true

function parseCommit(value: unknown): { message: string; files: string[] } {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { message, files } = value as Record<string, unknown>
  if (typeof message !== 'string') throw new Error('Paramètre invalide : message')
  if (!Array.isArray(files) || !files.every((f) => typeof f === 'string' && f)) {
    throw new Error('Paramètre invalide : files')
  }
  return { message, files: files as string[] }
}

function parsePr(value: unknown): { title: string; body: string } {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { title, body } = value as Record<string, unknown>
  if (typeof title !== 'string') throw new Error('Paramètre invalide : title')
  if (typeof body !== 'string') throw new Error('Paramètre invalide : body')
  return { title, body }
}

/** Seuls les booléens connus passent ; le reste est ignoré. */
function parsePrOptions(value: unknown): Partial<PrOptions> {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const raw = value as Record<string, unknown>
  const options: Partial<PrOptions> = {}
  if (typeof raw['autoFix'] === 'boolean') options.autoFix = raw['autoFix']
  if (typeof raw['autoMerge'] === 'boolean') options.autoMerge = raw['autoMerge']
  return options
}

function parseOrphan(value: unknown): { root: string; path: string; branch: string } {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { root, path, branch } = value as Record<string, unknown>
  return {
    root: str(root, 'root'),
    path: str(path, 'path'),
    branch: typeof branch === 'string' ? branch : ''
  }
}
