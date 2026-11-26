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
import { ChildMergeRecorder, type MergedFacts } from '../conversations/child-merge-record'
import type { ConversationManager } from '../conversations/manager'
import { agentLog } from '../log'
import type { ConversationTrash } from '../conversations/trash'
import type { Run } from '../simulator/run'
import type { PrOptions } from '@shared/pr-tracking'
import { PrWatcher } from './pr-watch'
import type { WorktreeInfo, Worktrees } from './worktrees'
import { commitThenMerge } from './commit-then-merge'
import { inTurn, turnInFolder } from './folder-turn'
import { WorktreeCycle, type CycleTarget } from './worktree-cycle'

/** Ce que le cycle demande au gestionnaire de conversations. */
export type WorktreeHost = Pick<
  ConversationManager,
  | 'worktreeOf'
  | 'worktreePaths'
  | 'leaveWorktree'
  | 'prompt'
  | 'state'
  | 'workspaceOf'
  | 'view'
  | 'post'
>

export interface WorktreeCycleDeps {
  cycle: Pick<
    WorktreeCycle,
    | 'info'
    | 'commit'
    | 'undoCommit'
    | 'commitMain'
    | 'mainDirty'
    | 'baseElsewhere'
    | 'branchState'
    | 'shortHead'
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
  /** Worktrees des conversations de la corbeille : gardés avec elles, jamais orphelins (fiche 228). */
  trashed?: () => WorktreeInfo[]
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
  send?: <C extends 'pr:changed' | 'worktree:forge' | 'worktree:orphansChanged'>(
    channel: C,
    change: IpcEventContract[C]
  ) => void,
  /** Le profil : sa corbeille tient des worktrees, et dit quand elle change (fiche 228). */
  profile?: { trash: Pick<ConversationTrash, 'worktrees' | 'onChange'> },
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
  // Conversation mise à la corbeille, restaurée ou effacée : la liste des orphelins est à relire.
  const trash = profile?.trash
  trash?.onChange(() => send?.('worktree:orphansChanged', null))
  return {
    cycle,
    prs,
    conversations,
    worktrees,
    recentWorkspaces: () => settings.current.recentWorkspaces,
    ...(trash ? { trashed: () => trash.worktrees() } : {})
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
  /** Worktrees tenus en ce moment : conversations de l'historique et de la corbeille. */
  const held = (): WorktreeInfo[] => {
    const { conversations, trashed } = available()
    return [...conversations.worktreePaths(), ...(trashed?.() ?? [])]
  }
  const orphans = async (): Promise<OrphanWorktree[]> => {
    const { cycle, conversations, recentWorkspaces } = available()
    const holding = held()
    const roots = [
      ...holding.map((w) => w.root),
      ...recentWorkspaces(),
      ...conversations.state().conversations.map((c) => c.workspace)
    ]
    return cycle.orphans([...new Set(roots)], new Set(holding.map((w) => w.path)))
  }
  /** Dossier d'une conversation ordinaire : où « Committer » hors worktree committe. */
  const folder = (id: unknown) => {
    const conversation = str(id, 'id')
    const workspace = available().conversations.workspaceOf(conversation)
    return { id: conversation, workspace, cwd: workspace }
  }
  /**
   * « Committer puis fusionner » (fiche 287) : refusé avant tout commit tant qu'un tour tourne
   * dans la conversation elle-même (son worktree bouge) ou dans le dossier principal du dépôt.
   */
  const assertNoTurn = (found: CycleTarget) => {
    const { conversations } = available().conversations.state()
    const own = conversations.find((c) => c.id === found.id)
    const busy = own && inTurn(own) ? own : turnInFolder(conversations, found.worktree.root)
    if (busy) throw new Error(t('worktreeCycle.error.turnRunning', { title: busy.title }))
  }
  /**
   * Fusion d'une fille depuis son onglet Git (fiche 287) : réussie, elle est dite dans le fil de sa
   * mère, comme une fusion faite depuis la carte.
   */
  const recorded = async (
    found: CycleTarget,
    merge: () => Promise<MergeOutcome>
  ): Promise<MergeOutcome> => {
    const { cycle, conversations } = available()
    const recorder = new ChildMergeRecorder(conversations)
    const child = !!recorder.motherOf(found.id)
    const before = child ? await cycle.branchState(found).catch(() => undefined) : undefined
    const outcome = await merge()
    if (child && outcome.status === 'merged') {
      const commit = await cycle.shortHead(found, outcome.base).catch(() => undefined)
      recorder.merged(found.id, {
        base: outcome.base,
        branch: found.worktree.branch,
        ...(commit ? { commit } : {}),
        ...(before
          ? { fileCount: before.files.length, added: before.added, removed: before.removed }
          : {})
      })
    }
    return withTitle(found.id, outcome)
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
    'worktree:merge': (id, options) => {
      const found = target(id)
      const stash = { stash: wantsStash(options) }
      const commit = commitOf(options)
      if (!commit) return recorded(found, () => available().cycle.merge(found, stash))
      assertNoTurn(found)
      return recorded(found, () => commitThenMerge(available().cycle, found, commit, stash))
    },
    'worktree:mergeContinue': (id, options) => {
      const found = target(id)
      return recorded(found, () =>
        available().cycle.mergeContinue(found, { stash: wantsStash(options) })
      )
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
      if (files.length > 0) {
        // Le tour de l'agent est attendu (`prompt` rend la main à sa fin), puis la fusion reprend.
        await conversations.prompt(found.id, conflictPrompt(info.baseBranch, info.branch, files))
      }
      return recorded(found, () => cycle.mergeContinue(found, stash))
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
      // Fiche 287 : lu avant que la fille soit archivée et sa branche supprimée.
      const recorder = new ChildMergeRecorder(conversations)
      const motherId = recorder.motherOf(conversation)
      const merged = motherId && found ? await mergedFacts(cycle, found, !!head) : undefined
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
      recorder.cleaned(conversation, motherId, merged)
      return { state: conversations.state(), ...(remote ? { remote } : {}) }
    },
    'changes:commit': (id, request) => available().cycle.commitIn(folder(id), parseCommit(request)),
    'changes:undoCommit': async (id, hash) => {
      await available().cycle.undoCommitIn(folder(id), str(hash, 'hash'))
      return undefined
    },
    'worktree:orphans': orphans,
    'worktree:removeOrphan': async (orphan) => {
      // Revérifié au moment de supprimer : la liste de l'interface a pu vieillir (restauration).
      const holding = new Set(held().map((w) => w.path))
      await available().cycle.removeOrphan(parseOrphan(orphan), holding)
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

/**
 * Branche d'une fille au moment de la nettoyer (fiche 287) : déjà dans la base, ou sa PR
 * fusionnée (`prMerged`) ; `undefined` sinon, ou illisible.
 */
async function mergedFacts(
  cycle: Pick<WorktreeCycle, 'branchState' | 'shortHead'>,
  found: CycleTarget,
  prMerged: boolean
): Promise<(MergedFacts & { title: string }) | undefined> {
  const state = await cycle.branchState(found).catch(() => undefined)
  const inBase = !!state && state.sinceBase > 0 && state.ahead === 0
  if (!state || !(inBase || prMerged)) return undefined
  const commit = inBase
    ? await cycle.shortHead(found, state.base).catch(() => undefined)
    : undefined
  return {
    title: found.title,
    base: state.base,
    branch: found.worktree.branch,
    ...(commit ? { commit } : {})
  }
}

/** « Committer puis fusionner » (fiche 287) : le commit demandé avec la fusion, vérifié. */
const commitOf = (options: unknown): { message: string; files: string[] } | undefined => {
  if (typeof options !== 'object' || options === null) return undefined
  const { commit } = options as { commit?: unknown }
  return commit === undefined ? undefined : parseCommit(commit)
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
