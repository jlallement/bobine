/**
 * Ce que relit le Code reviewer (fiches 177, 265, 267) : lu dans git, sans rien modifier.
 *
 * - Un travail dans un worktree : tout depuis le départ de sa branche (`merge-base` avec sa
 *   branche de base, sinon son commit de départ), commits **et** modifications non commitées.
 * - Sinon, les modifications non commitées du dossier.
 * - `auto` (`@code-reviewer` tapé dans la saisie, `start_child` de l'agent, fiche 265) — revu par
 *   la fiche 267 (recette N1 : seul le dernier commit, une fusion, était relu) :
 *   - une branche qui n'est pas la principale : la branche contre sa base, non commité compris ;
 *   - sur la branche principale, les commits de la conversation (`conversationRange`) ; avec du
 *     non commité, le non commité plus ces commits s'ils ne sont pas déjà relus.
 *
 * Les sous-modules changés ne sont pas relus (un seul identifiant de commit) : comptés à part. Une
 * commande git qui échoue ou dépasse son délai fait échouer la portée (`ReviewListError`), jamais
 * « rien à relire ». Les révisions qui viennent d'ailleurs (base d'un worktree, branche de base,
 * dernier commit relu) passent après `--end-of-options`.
 */
import { EMPTY_TREE, type ReviewRangeOrigin, type ReviewTarget } from '@shared/review'
import type { Run } from '../simulator/run'

export interface TargetSource {
  workspace: string
  title: string
  /** Worktree du travail relu (fiche 036) ; absent : un dossier ordinaire. */
  worktree?: { base: string; baseBranch?: string } | undefined
  /** Création de la conversation relue (ms) : ses commits sont ceux d'après (fiche 267). */
  startedAt?: number | undefined
  /** HEAD relu par la dernière relecture finie de cette conversation (fiche 267). */
  lastReviewed?: string | undefined
}

/** Une commande git indispensable à la portée a échoué (délai dépassé, dépôt abîmé). */
export class ReviewListError extends Error {}

const text = (buffer: Buffer) => buffer.toString('utf8')
const lines = (output: string) => output.split('\n').filter(Boolean)
const unique = (files: string[]) => [...new Set(files)]
const COMMIT_ID = /^[0-9a-f]{4,64}$/

/** Branches principales reconnues, dans cet ordre, après celle du dépôt distant (`origin/HEAD`). */
export const MAIN_BRANCHES = ['main', 'master', 'develop', 'trunk'] as const

/** `undefined` : la commande a échoué ; `must` : elle doit réussir, sinon `ReviewListError`. */
type Read = (args: string[], must?: boolean) => Promise<string | undefined>

export async function reviewTarget(
  run: Run,
  author: TargetSource,
  auto = false
): Promise<ReviewTarget> {
  const read: Read = async (args, must = false) => {
    const result = await run('git', args, { cwd: author.workspace, timeoutMs: 30_000 })
    if (result.code === 0) return text(result.stdout)
    if (must || result.timedOut) throw new ReviewListError(`git ${args[0]}: ${result.stderr}`)
    return undefined
  }
  const authorTitle = author.title
  const untracked = lines((await read(['ls-files', '--others', '--exclude-standard'], true)) ?? '')
  const head = (await read(['rev-parse', '--verify', '--quiet', 'HEAD']))?.trim()
  // Dépôt sans commit : tout est nouveau, rien à comparer (la consigne le dit, sans `git diff`).
  if (!head) {
    const staged = lines(
      (await read(['diff', '--name-only', '--relative', '--cached'], true)) ?? ''
    )
    return {
      scope: 'uncommitted',
      files: unique([...staged, ...untracked]),
      noCommit: true,
      authorTitle
    }
  }
  const changedFiles = (revisions: string[]) => changedIn(read, revisions)
  const { worktree } = author
  if (worktree) {
    const merged = worktree.baseBranch
      ? await read(['merge-base', '--end-of-options', 'HEAD', worktree.baseBranch])
      : undefined
    const base = merged?.trim() || worktree.base
    const changed = await changedFiles([base])
    return {
      scope: 'branch',
      base,
      ...(worktree.baseBranch ? { baseBranch: worktree.baseBranch } : {}),
      files: unique([...changed.files, ...untracked]),
      ...submodules(changed.skipped),
      reviewedHead: head,
      authorTitle
    }
  }
  const tracked = await changedFiles(['HEAD'])
  const uncommitted = unique([...tracked.files, ...untracked])
  const plain = (): ReviewTarget => ({
    scope: 'uncommitted',
    files: uncommitted,
    ...submodules(tracked.skipped),
    reviewedHead: head,
    authorTitle
  })
  if (!auto) return plain()
  const branch = await currentBranch(read, untracked)
  // Une branche de travail sans rien de changé : rien à relire (pas le commit de quelqu'un d'autre).
  if (branch === 'fresh') return plain()
  if (branch) return { ...branch, reviewedHead: head, authorTitle }
  const range = await conversationRange(read, head, author, uncommitted.length > 0)
  if (!range) return plain()
  const changed = await changedFiles(range.withUncommitted ? [range.base] : [range.base, head])
  return {
    scope: 'commits',
    base: range.base,
    commit: head,
    commits: range.commits,
    origin: range.origin,
    ...(range.shallow ? { shallow: true as const } : {}),
    ...(range.withUncommitted ? { withUncommitted: true as const } : {}),
    files: unique([...changed.files, ...(range.withUncommitted ? untracked : [])]),
    ...submodules(changed.skipped),
    reviewedHead: head,
    authorTitle
  }
}

const submodules = (count: number): Pick<ReviewTarget, 'submodules'> =>
  count > 0 ? { submodules: count } : {}

/**
 * Fichiers changés depuis `revisions` (`git diff --raw`), sans les sous-modules : leur « diff »
 * n'est qu'un identifiant de commit, le relecteur ne peut pas le relire d'ici (revue QA de la
 * fiche 267) ; comptés à part.
 */
async function changedIn(
  read: Read,
  revisions: string[]
): Promise<{ files: string[]; skipped: number }> {
  const raw = lines(
    (await read(['diff', '--raw', '--relative', '--end-of-options', ...revisions, '--'], true)) ??
      ''
  )
  const files: string[] = []
  let skipped = 0
  for (const line of raw) {
    // « :100644 100644 a b M\tchemin » ; renommé : « …\tancien\tnouveau ».
    const [meta = '', ...paths] = line.split('\t')
    const path = paths.at(-1)
    if (!path) continue
    const [oldMode, newMode] = meta.slice(1).split(' ')
    if (oldMode === '160000' || newMode === '160000') skipped++
    else files.push(path)
  }
  return { files, skipped }
}

/** Commits de la conversation remontés au plus (premier parent) ; au-delà, coupé là. */
export const RANGE_MAX_COMMITS = 50
/** À défaut de commit de la conversation : les derniers commits relus. */
export const RANGE_FALLBACK_COMMITS = 5

interface LogEntry {
  sha: string
  time: number
  email: string
  parents: string[]
}

type Range = {
  base: string
  commits: number
  origin: ReviewRangeOrigin
  withUncommitted: boolean
  shallow?: true
}

/**
 * Les commits de la conversation sur la branche principale (fiche 267, N1), en suivant le premier
 * parent depuis HEAD, 50 au plus :
 * - depuis le dernier HEAD relu, s'il est un ancêtre de HEAD et en est un autre (`reviewed`) ;
 * - sinon, ceux faits depuis la création de la conversation (date du commit postérieure, à la
 *   seconde) **et**, quand l'adresse de l'utilisateur (`git config user.email`) est connue, par
 *   lui : un commit d'un autre (un `git pull`) arrête la plage (`conversation`) ;
 * - tout est déjà relu jusqu'à HEAD : la même plage, relue de nouveau (`again`) ; avec du non
 *   commité (`dirty`), le non commité seul (`undefined`) ;
 * - sans commit de la conversation : les 5 derniers (`fallback`), sauf avec du non commité.
 */
async function conversationRange(
  read: Read,
  head: string,
  author: TargetSource,
  dirty: boolean
): Promise<Range | undefined> {
  const log: LogEntry[] = lines(
    (await read(
      [
        'log',
        '--first-parent',
        `--max-count=${RANGE_MAX_COMMITS + 1}`,
        '--format=%H %ct %ae %P',
        '--end-of-options',
        head,
        '--'
      ],
      true
    )) ?? ''
  ).map((line) => {
    const [sha = '', time = '0', email = '', ...parents] = line.split(' ')
    return { sha, time: Number(time), email: email.toLowerCase(), parents }
  })
  if (log.length === 0) return undefined
  const reviewed = author.lastReviewed
  if (reviewed === head && dirty) return undefined
  const me = (await read(['config', '--get', 'user.email']))?.trim().toLowerCase()
  const start = author.startedAt !== undefined ? Math.floor(author.startedAt / 1000) : undefined
  // Dates de git à la seconde : un commit de la même seconde que la création compte d'avant.
  const ours = (c: LogEntry) =>
    start !== undefined && c.time > start && (!me || !c.email || c.email === me)
  const reviewedAt =
    reviewed && COMMIT_ID.test(reviewed) ? log.findIndex((c) => c.sha === reviewed) : -1
  let cut: number | undefined
  let origin: ReviewRangeOrigin = 'conversation'
  if (reviewedAt > 0) {
    cut = reviewedAt
    origin = 'reviewed'
  } else if (start !== undefined) {
    const first = log.findIndex((c) => !ours(c))
    if (first !== 0) {
      cut = first === -1 ? log.length : first
      origin = reviewed === head ? 'again' : 'conversation'
    }
  }
  if (cut === undefined) {
    if (dirty) return undefined
    cut = Math.min(RANGE_FALLBACK_COMMITS, log.length)
    origin = 'fallback'
  }
  cut = Math.min(cut, RANGE_MAX_COMMITS)
  return rangeFrom(read, head, log, cut, { origin, dirty, start })
}

/**
 * La base de la plage `log[0..cut)` : le commit d'après, sinon le parent du dernier ; remontée au
 * premier commit, l'arbre vide — sauf dans un clone superficiel, où elle part du commit frontière
 * (`shallow`). Une plage réduite à un commit de fusion : `mergeBase`.
 */
async function rangeFrom(
  read: Read,
  head: string,
  log: LogEntry[],
  cut: number,
  context: { origin: ReviewRangeOrigin; dirty: boolean; start: number | undefined }
): Promise<Range | undefined> {
  const inRange = log.slice(0, cut)
  const last = inRange[inRange.length - 1]
  let base = log[cut]?.sha ?? last?.parents[0]
  let shallow: true | undefined
  if (!base && last) {
    const isShallow = (await read(['rev-parse', '--is-shallow-repository']))?.trim() === 'true'
    if (isShallow) {
      inRange.pop()
      base = last.sha
      shallow = true
      if (inRange.length === 0) return undefined
    } else base = EMPTY_TREE
  }
  if (!base) return undefined
  const only = inRange.length === 1 ? inRange[0] : undefined
  if (only && only.parents.length > 1) base = await mergeBase(read, only, base, context.start)
  const counted = (
    await read([
      'rev-list',
      '--count',
      '--end-of-options',
      base === EMPTY_TREE ? head : `${base}..${head}`
    ])
  )?.trim()
  return {
    base,
    commits: Number(counted) || inRange.length,
    origin: context.origin,
    withUncommitted: context.dirty,
    ...(shallow ? { shallow } : {})
  }
}

/**
 * Plage réduite à un commit de fusion (fiche 267, revue QA) : jamais la fusion seule contre son
 * premier parent quand elle réunit des commits de la conversation — la base devient alors le point
 * commun de ses parents, dans la limite de 50 commits ; sinon son premier parent.
 */
async function mergeBase(
  read: Read,
  merge: LogEntry,
  first: string,
  start: number | undefined
): Promise<string> {
  const others = merge.parents.slice(1)
  const times = await Promise.all(
    others.map(async (parent) =>
      Number((await read(['log', '-1', '--format=%ct', '--end-of-options', parent, '--']))?.trim())
    )
  )
  // Création inconnue : on ne sait pas d'où viennent les autres côtés, on relit ce qu'elle réunit.
  if (start !== undefined && !times.some((time) => time > start)) return first
  const common = (
    await read(['merge-base', '--octopus', '--end-of-options', ...merge.parents])
  )?.trim()
  if (!common) return first
  const count = Number(
    (await read(['rev-list', '--count', '--end-of-options', `${common}..${merge.sha}`]))?.trim()
  )
  return count > 0 && count <= RANGE_MAX_COMMITS ? common : first
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
  const base = (await read(['merge-base', '--end-of-options', 'HEAD', baseBranch]))?.trim()
  if (!base) return undefined
  const changed = await changedIn(read, [base])
  const files = unique([...changed.files, ...untracked])
  if (files.length === 0) return 'fresh'
  return { scope: 'branch', base, baseBranch, branch: name, files, ...submodules(changed.skipped) }
}
