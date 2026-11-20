/**
 * Ce que relit le Code reviewer (fiches 177, 265) : lu dans git, sans rien modifier.
 *
 * - Un travail dans un worktree : tout depuis le départ de sa branche (`merge-base` avec sa
 *   branche de base, sinon son commit de départ), commits **et** modifications non commitées.
 * - Sinon, les modifications non commitées du dossier.
 * - `auto` (`@code-reviewer` tapé dans la saisie, fiche 265) : rien de non commité, la branche
 *   courante contre sa base si ce n'est pas la branche principale ; sinon le dernier commit.
 */
import type { ReviewTarget } from '@shared/review'
import type { Run } from '../simulator/run'

export interface TargetSource {
  workspace: string
  title: string
  /** Worktree du travail relu (fiche 036) ; absent : un dossier ordinaire. */
  worktree?: { base: string; baseBranch?: string } | undefined
}

const text = (buffer: Buffer) => buffer.toString('utf8')
const lines = (output: string) => output.split('\n').filter(Boolean)
const unique = (files: string[]) => [...new Set(files)]

/** Branches principales reconnues, dans cet ordre, après celle du dépôt distant (`origin/HEAD`). */
const MAIN_BRANCHES = ['main', 'master'] as const

export async function reviewTarget(
  run: Run,
  author: TargetSource,
  auto = false
): Promise<ReviewTarget> {
  const git = (args: string[]) => run('git', args, { cwd: author.workspace, timeoutMs: 30_000 })
  const read = async (args: string[]) => {
    const result = await git(args)
    return result.code === 0 ? text(result.stdout) : undefined
  }
  const authorTitle = author.title
  const untracked = lines((await read(['ls-files', '--others', '--exclude-standard'])) ?? '')
  const { worktree } = author
  if (worktree) {
    const merged = worktree.baseBranch
      ? await read(['merge-base', 'HEAD', worktree.baseBranch])
      : undefined
    const base = merged?.trim() || worktree.base
    const changed = await read(['diff', '--name-only', '--relative', base])
    if (changed !== undefined) {
      return {
        scope: 'branch',
        base,
        ...(worktree.baseBranch ? { baseBranch: worktree.baseBranch } : {}),
        files: unique([...lines(changed), ...untracked]),
        authorTitle
      }
    }
  }
  const uncommitted = unique([
    ...lines((await read(['diff', '--name-only', '--relative', 'HEAD'])) ?? ''),
    ...untracked
  ])
  if (!auto || uncommitted.length > 0)
    return { scope: 'uncommitted', files: uncommitted, authorTitle }
  const branch = await currentBranch(read)
  if (branch) return branch.target(authorTitle)
  // Dernier commit (le premier du dépôt compris) ; sans commit, rien à relire.
  const head = (await read(['rev-parse', 'HEAD']))?.trim()
  if (!head) return { scope: 'uncommitted', files: [], authorTitle }
  const files = lines((await read(['show', '--name-only', '--relative', '--format=', head])) ?? '')
  return { scope: 'commit', base: head, files: unique(files), authorTitle }
}

/**
 * La branche courante, si ce n'est pas la branche principale, contre sa base (`merge-base`), avec
 * ce qu'elle change ; `undefined` sinon (branche principale, tête détachée, rien de changé).
 */
async function currentBranch(read: (args: string[]) => Promise<string | undefined>) {
  const name = (await read(['rev-parse', '--abbrev-ref', 'HEAD']))?.trim()
  if (!name || name === 'HEAD') return undefined
  const remote = (
    await read(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
  )?.trim()
  const candidates = [...(remote ? [remote] : []), ...MAIN_BRANCHES]
  let baseBranch: string | undefined
  for (const candidate of candidates) {
    if ((await read(['rev-parse', '--verify', '--quiet', candidate])) !== undefined) {
      baseBranch = candidate
      break
    }
  }
  if (!baseBranch || baseBranch.replace(/^origin\//, '') === name) return undefined
  const base = (await read(['merge-base', 'HEAD', baseBranch]))?.trim()
  if (!base) return undefined
  const files = lines((await read(['diff', '--name-only', '--relative', base])) ?? '')
  if (files.length === 0) return undefined
  return {
    target: (authorTitle: string): ReviewTarget => ({
      scope: 'branch',
      base,
      baseBranch,
      branch: name,
      files: unique(files),
      authorTitle
    })
  }
}
