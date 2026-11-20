/**
 * Ce que relit le Code reviewer (fiches 177, 265) : lu dans git, sans rien modifier.
 *
 * - Un travail dans un worktree : tout depuis le départ de sa branche (`merge-base` avec sa
 *   branche de base, sinon son commit de départ), commits **et** modifications non commitées.
 * - Sinon, les modifications non commitées du dossier.
 * - `auto` (`@code-reviewer` tapé dans la saisie, `start_child` de l'agent, fiche 265) : rien de
 *   non commité, la branche courante contre sa base si ce n'est pas la branche principale (rien de
 *   changé dessus : rien à relire) ; sur la branche principale, le dernier commit.
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
export const MAIN_BRANCHES = ['main', 'master', 'develop', 'trunk'] as const

type Read = (args: string[]) => Promise<string | undefined>

export async function reviewTarget(
  run: Run,
  author: TargetSource,
  auto = false
): Promise<ReviewTarget> {
  const read: Read = async (args) => {
    const result = await run('git', args, { cwd: author.workspace, timeoutMs: 30_000 })
    return result.code === 0 ? text(result.stdout) : undefined
  }
  const authorTitle = author.title
  const untracked = lines((await read(['ls-files', '--others', '--exclude-standard'])) ?? '')
  const head = (await read(['rev-parse', '--verify', '--quiet', 'HEAD']))?.trim()
  // Dépôt sans commit : tout est nouveau, rien à comparer (la consigne le dit, sans `git diff`).
  if (!head) {
    const staged = lines((await read(['diff', '--name-only', '--relative', '--cached'])) ?? '')
    return {
      scope: 'uncommitted',
      files: unique([...staged, ...untracked]),
      noCommit: true,
      authorTitle
    }
  }
  const { worktree } = author
  if (worktree) {
    const merged = worktree.baseBranch
      ? await read(['merge-base', 'HEAD', worktree.baseBranch, '--'])
      : undefined
    const base = merged?.trim() || worktree.base
    const changed = await read(['diff', '--name-only', '--relative', base, '--'])
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
    ...lines((await read(['diff', '--name-only', '--relative', 'HEAD', '--'])) ?? ''),
    ...untracked
  ])
  if (!auto || uncommitted.length > 0) {
    return { scope: 'uncommitted', files: uncommitted, authorTitle }
  }
  const branch = await currentBranch(read)
  // Une branche de travail sans rien de changé : rien à relire (pas le commit de quelqu'un d'autre).
  if (branch === 'fresh') return { scope: 'uncommitted', files: [], authorTitle }
  if (branch) return { ...branch, authorTitle }
  // Le dernier commit : contre son premier parent (un commit de fusion compris), sinon le premier
  // commit du dépôt en entier.
  const parent = (await read(['rev-parse', '--verify', '--quiet', `${head}^1`]))?.trim()
  const files = parent
    ? lines((await read(['diff', '--name-only', '--relative', parent, head, '--'])) ?? '')
    : lines((await read(['show', '--name-only', '--relative', '--format=', head, '--'])) ?? '')
  return {
    scope: 'commit',
    commit: head,
    ...(parent ? { base: parent } : {}),
    files: unique(files),
    authorTitle
  }
}

/**
 * La branche courante, si ce n'est pas la branche principale, contre sa base (`merge-base`), avec
 * ce qu'elle change ; `fresh` : rien de changé ; `undefined` : branche principale, tête détachée,
 * base introuvable.
 */
async function currentBranch(
  read: Read
): Promise<Omit<ReviewTarget, 'authorTitle'> | 'fresh' | undefined> {
  const name = (await read(['rev-parse', '--abbrev-ref', 'HEAD']))?.trim()
  if (!name || name === 'HEAD') return undefined
  const remote = (
    await read(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
  )?.trim()
  const candidates = [...(remote ? [remote] : []), ...MAIN_BRANCHES]
  if (candidates.some((c) => c.replace(/^origin\//, '') === name)) return undefined
  let baseBranch: string | undefined
  for (const candidate of candidates) {
    if ((await read(['rev-parse', '--verify', '--quiet', candidate])) !== undefined) {
      baseBranch = candidate
      break
    }
  }
  if (!baseBranch) return undefined
  const base = (await read(['merge-base', 'HEAD', baseBranch, '--']))?.trim()
  if (!base) return undefined
  const files = lines((await read(['diff', '--name-only', '--relative', base, '--'])) ?? '')
  if (files.length === 0) return 'fresh'
  return { scope: 'branch', base, baseBranch, branch: name, files: unique(files) }
}
