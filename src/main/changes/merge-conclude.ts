/**
 * Fin, dans la branche seulement, d'une fusion arrêtée sur des conflits (fiche 289) : quand l'agent
 * d'un travail a résolu le conflit que la fusion enchaînée lui a renvoyé, sa résolution est commitée
 * dans sa branche, et rien n'entre dans la base ni dans le dossier principal. La base n'avance qu'à
 * une prochaine fusion demandée par l'utilisateur (`WorktreeCycle.merge`, en fast-forward).
 */
import type { ConcludeOutcome } from '@shared/worktree-cycle'
import type { RunResult } from '../simulator/run'
import { markersLeft } from './commit-then-merge'
import { mergeIntoBase } from './git'

/** Git dans le worktree : la commande, et la même qui lève sur un échec. */
export interface WorktreeGit {
  cwd: string
  run: (args: string[]) => Promise<RunResult>
  exec: (args: string[], timeoutMs?: number) => Promise<string>
}

/** La fusion arrêtée est commitée (message de git) : les fichiers sans marqueur sont ajoutés. */
export async function commitMerge(git: WorktreeGit, files: readonly string[]): Promise<void> {
  if (files.length > 0) await git.exec(['--literal-pathspecs', 'add', '--', ...files])
  await git.exec(['commit', '-q', '--no-edit'], 60_000)
}

/**
 * Marqueurs partis : fichiers ajoutés, fusion commitée, puis le commit réécrit avec la base en
 * premier parent, comme la fusion l'aurait fait (`mergeIntoBase`) : le même historique qu'avant,
 * seulement décalé au clic. Rend les fichiers où il reste des marqueurs ; `not-merging` si la fusion
 * a été abandonnée pendant le tour (la base n'est pas dans la branche).
 */
export async function concludeMerge(
  git: WorktreeGit,
  branch: string,
  base: string
): Promise<ConcludeOutcome> {
  if ((await git.run(['rev-parse', '-q', '--verify', 'MERGE_HEAD'])).code !== 0) {
    // L'agent a commité lui-même (malgré la consigne) : la base est dans la branche. Sinon, rien
    // n'est résolu.
    const contained = await git.run(['merge-base', '--is-ancestor', base, 'HEAD'])
    return contained.code === 0 ? { status: 'resolved' } : { status: 'not-merging' }
  }
  const unmerged = await git.run(['diff', '--name-only', '--diff-filter=U'])
  if (unmerged.code !== 0) throw new Error(unmerged.stderr.trim() || 'git diff failed')
  const files = unmerged.stdout.toString().split('\n').filter(Boolean)
  const left = await markersLeft(git.cwd, files)
  if (left.length > 0) return { status: 'conflicts', files: left }
  await commitMerge(git, files)
  await mergeIntoBase((args) => git.exec(args), branch, base)
  return { status: 'resolved' }
}
