/**
 * Ce que relit le Code reviewer (fiches 177, 265, 267) : lu dans git, sans rien modifier.
 *
 * - Un travail dans un worktree : tout depuis le départ de sa branche (`merge-base` avec sa
 *   branche de base, sinon son commit de départ), commits **et** modifications non commitées.
 * - Sinon, les modifications non commitées du dossier.
 * - `auto` (`@code-reviewer` tapé dans la saisie, `start_child` de l'agent, fiche 265) — revu par
 *   la fiche 267 (recette N1 : seul le dernier commit, une fusion, était relu) :
 *   - une branche qui n'est pas la principale : la branche contre sa base, non commité compris ;
 *   - sur la branche principale, les commits de la conversation (`conversationRange`) : depuis le
 *     dernier commit relu, sinon depuis sa création, à défaut les 5 derniers ; jamais un commit de
 *     fusion seul. Avec du non commité : le non commité, plus ces commits s'il y en a de non relus.
 */
import { EMPTY_TREE, type ReviewTarget } from '@shared/review'
import type { Run } from '../simulator/run'

export interface TargetSource {
  workspace: string
  title: string
  /** Worktree du travail relu (fiche 036) ; absent : un dossier ordinaire. */
  worktree?: { base: string; baseBranch?: string } | undefined
  /** Création de la conversation relue (ms) : ses commits sont ceux d'après (fiche 267). */
  startedAt?: number | undefined
  /** Commit de fin de la dernière relecture finie de cette conversation (fiche 267). */
  lastReviewed?: string | undefined
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
  if (!auto) return { scope: 'uncommitted', files: uncommitted, authorTitle }
  const branch = await currentBranch(read, untracked)
  // Une branche de travail sans rien de changé : rien à relire (pas le commit de quelqu'un d'autre).
  if (branch === 'fresh') return { scope: 'uncommitted', files: uncommitted, authorTitle }
  if (branch) return { ...branch, authorTitle }
  const range = await conversationRange(read, head, author, uncommitted.length > 0)
  if (!range) return { scope: 'uncommitted', files: uncommitted, authorTitle }
  const changed = range.withUncommitted
    ? await read(['diff', '--name-only', '--relative', range.base, '--'])
    : await read(['diff', '--name-only', '--relative', range.base, head, '--'])
  return {
    scope: 'commits',
    base: range.base,
    commit: head,
    commits: range.commits,
    ...(range.withUncommitted ? { withUncommitted: true as const } : {}),
    files: unique([...lines(changed ?? ''), ...(range.withUncommitted ? untracked : [])]),
    authorTitle
  }
}

/** Commits de la conversation remontés au plus (premier parent) ; au-delà, coupé là. */
export const RANGE_MAX_COMMITS = 50
/** À défaut de commit de la conversation : les derniers commits relus. */
export const RANGE_FALLBACK_COMMITS = 5

/**
 * Les commits de la conversation sur la branche principale (fiche 267, N1), en suivant le premier
 * parent depuis HEAD : depuis le dernier commit relu (ancêtre de HEAD, autre que lui), sinon depuis
 * le premier commit d'avant la création de la conversation ; sans commit de la conversation, les
 * 5 derniers — sauf avec du non commité (`dirty`) : alors rien (le non commité seul, comme avant).
 * Une plage réduite à un commit de fusion part du point commun de ses parents : ce qu'il réunit,
 * jamais le seul côté qu'il apporte (recette : seul le thème sombre relu).
 */
async function conversationRange(
  read: Read,
  head: string,
  author: TargetSource,
  dirty: boolean
): Promise<{ base: string; commits: number; withUncommitted: boolean } | undefined> {
  const log = lines(
    (await read([
      'log',
      '--first-parent',
      `--max-count=${RANGE_MAX_COMMITS + 1}`,
      '--format=%H %ct %P',
      head,
      '--'
    ])) ?? ''
  ).map((line) => {
    const [sha = '', time = '0', ...parents] = line.split(' ')
    return { sha, time: Number(time), parents }
  })
  if (log.length === 0) return undefined
  // L'indice du premier commit hors de la plage dans `log` (ou `log.length` : jusqu'au début).
  let cut: number | undefined
  const reviewed = author.lastReviewed
  // Tout est relu jusqu'à HEAD : avec du non commité, le non commité seul.
  if (reviewed === head && dirty) return undefined
  if (reviewed && reviewed !== head) {
    const index = log.findIndex((c) => c.sha === reviewed)
    if (index > 0) cut = index
  }
  if (cut === undefined && author.startedAt !== undefined) {
    // Dates de git à la seconde : un commit de la même seconde que la création compte d'avant.
    const start = Math.floor(author.startedAt / 1000)
    const index = log.findIndex((c) => c.time <= start)
    if (index !== 0) cut = index === -1 ? log.length : index
  }
  if (cut === undefined) {
    if (dirty) return undefined
    cut = Math.min(RANGE_FALLBACK_COMMITS, log.length)
  }
  // Une plage trop longue (conversation très ancienne) : les 50 derniers.
  cut = Math.min(cut, RANGE_MAX_COMMITS)
  const inRange = log.slice(0, cut)
  const after = log[cut]
  const last = inRange[inRange.length - 1]
  let base = after?.sha ?? (last && last.parents[0] ? last.parents[0] : EMPTY_TREE)
  const only = inRange.length === 1 ? inRange[0] : undefined
  if (only && only.parents.length > 1) {
    const common = (await read(['merge-base', '--octopus', ...only.parents]))?.trim()
    if (common) base = common
  }
  const counted = (
    await read(['rev-list', '--count', base === EMPTY_TREE ? head : `${base}..${head}`])
  )?.trim()
  const commits = Number(counted) || inRange.length
  return { base, commits, withUncommitted: dirty }
}

/**
 * La branche courante, si ce n'est pas la branche principale, contre sa base (`merge-base`), avec
 * ce qu'elle change ; `fresh` : rien de changé ; `undefined` : branche principale, tête détachée,
 * base introuvable.
 */
async function currentBranch(
  read: Read,
  untracked: readonly string[] = []
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
  const files = unique([
    ...lines((await read(['diff', '--name-only', '--relative', base, '--'])) ?? ''),
    ...untracked
  ])
  if (files.length === 0) return 'fresh'
  return { scope: 'branch', base, baseBranch, branch: name, files }
}
