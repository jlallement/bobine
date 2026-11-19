/**
 * Dossier de la mère avant le lancement d'une fille en worktree (fiche 240, ADR-0055) : ses
 * modifications non commitées (suivies ou non, pas les ignorées), lues comme celles que compte le
 * départ du worktree (fiche 110), et « Committer d'abord » à la racine du dépôt, comme la carte de
 * fusion (fiche 123).
 */
import { t } from 'i18next'
import type { CommitOutcome } from '@shared/worktree-cycle'
import type { FolderDirty, LaunchFolderState } from '@shared/launch-folder'
import { parseStatus, statusOf } from '../changes/git'
import { gitError } from '../changes/git-errors'
import { WorktreeCycle } from '../changes/worktree-cycle'
import { nativeGitPath } from '../git/git-platform'
import { agentLog } from '../log'
import type { Run } from '../simulator/run'

/** Ce que les conversations filles demandent du dossier de la mère. */
export interface LaunchFolder {
  /**
   * Où partirait une fille qui écrit (fiche 262) : en worktree depuis HEAD (racine, HEAD, non
   * commité), ou dans le dossier quand le dépôt n'a pas de commit ou qu'il n'y a pas de dépôt.
   */
  state(workspace: string, id?: string): Promise<LaunchFolderState>
  /** Modifications non commitées du dépôt du dossier ; `undefined` s'il est propre. */
  uncommitted(workspace: string, id?: string): Promise<FolderDirty | undefined>
  /** Committe ces fichiers (relatifs à la racine du dépôt), et rien d'autre. */
  commit(
    workspace: string,
    request: { message: string; files: string[] },
    id?: string
  ): Promise<CommitOutcome>
}

const text = (buffer: Buffer) => buffer.toString('utf8').trim()

/** Branchement réel (`index.ts`) : git de l'app, chaque commande dans `agents.log`. */
export function appLaunchFolder(run: Run): LaunchFolder {
  return launchFolder(run, (id, line) =>
    agentLog.line({ ...(id ? { conversation: id } : {}), agent: 'git' }, line)
  )
}

export function launchFolder(
  run: Run,
  log?: (id: string | undefined, line: string) => void
): LaunchFolder {
  const git = (cwd: string, args: string[]) => run('git', args, { cwd, timeoutMs: 30_000 })
  const cycle = new WorktreeCycle(run, log ? { log } : {})
  const root = async (workspace: string) => {
    const shown = await git(workspace, ['rev-parse', '--show-toplevel'])
    if (shown.code !== 0) throw new Error(t('worktrees.notRepo'))
    return nativeGitPath(text(shown.stdout))
  }
  const uncommitted = async (workspace: string): Promise<FolderDirty | undefined> => {
    // Chemins de `--porcelain` relatifs à la racine du dépôt, quel que soit le sous-dossier.
    const status = await git(workspace, [
      '--no-optional-locks',
      'status',
      '--porcelain=v1',
      '-z',
      '-uall'
    ])
    if (status.code !== 0) throw new Error(gitError(status.stderr) || t('git.statusFailed'))
    const files = parseStatus(status.stdout.toString('utf8')).map((entry) => ({
      path: entry.path,
      status: statusOf(entry)
    }))
    if (files.length === 0) return undefined
    const head = await git(workspace, ['show', '-s', '--format=%h%n%s', 'HEAD'])
    const [commit = '', ...subject] = text(head.stdout).split('\n')
    const branch = await git(workspace, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
    return {
      count: files.length,
      files,
      commit,
      ...(branch.code === 0 && text(branch.stdout) ? { branch: text(branch.stdout) } : {}),
      ...(subject.join('\n').trim() ? { subject: subject.join('\n').trim() } : {})
    }
  }
  return {
    async state(workspace) {
      const top = await root(workspace)
      // Dépôt sans commit (branche « à naître ») : `--verify --quiet` sort en 1 sans rien dire ;
      // aucun worktree possible, et jamais de commit vide pour en faire un (fiche 262). Une autre
      // erreur de git est dite, jamais prise pour un dépôt vide.
      const head = await git(workspace, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'])
      if (head.code === 1 && !text(head.stdout)) return { place: 'here', reason: 'noCommit' }
      if (head.code !== 0) throw new Error(gitError(head.stderr) || t('git.statusFailed'))
      const dirty = await uncommitted(workspace)
      return {
        place: 'worktree',
        root: top,
        head: text(head.stdout),
        ...(dirty ? { dirty } : {})
      }
    },
    uncommitted,
    async commit(workspace, request, id) {
      const top = await root(workspace)
      return cycle.commitIn({ ...(id ? { id } : {}), workspace: top, cwd: top }, request)
    }
  }
}
