/**
 * Résolution d'un conflit confiée à l'agent (fiche 289) : **la marque** et la conclusion.
 *
 * Dès que la consigne de conflit part à l'agent (fusion enchaînée d'une carte, ou « Laisser l'agent
 * résoudre » de la vue Git), une marque est écrite dans le dossier git du worktree : la tête de la
 * branche avant le tour, le commit de base fusionné, les fichiers en conflit. Elle survit au
 * redémarrage de l'app. Tant qu'elle est au stade `resolving`, toute conclusion de cette fusion —
 * quel que soit le chemin : fin de la chaîne, « Réessayer », « Fusionner » de la vue Git, après
 * redémarrage — s'arrête dans la branche : la résolution y est commitée, rien n'entre dans la base,
 * et l'issue est « à relire ». Le stade passe à `review` quand cet arrêt a été dit à l'utilisateur ;
 * la fusion suivante est alors la sienne. La marque tombe à la fusion dans la base, ou à l'abandon.
 *
 * Jamais « résolu » : s'il reste des marqueurs dans ce que la résolution touche (index, ou commit
 * fait par l'agent), si l'agent a défait la branche, si la branche est entrée dans la base pendant
 * le tour, ou si la fusion a été abandonnée.
 */
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { t } from 'i18next'
import { hasConflictMarkers, type ConcludeOutcome, type MergeOutcome } from '@shared/worktree-cycle'
import type { RunResult } from '../simulator/run'
import { markersLeft } from './commit-then-merge'
import { mergeIntoBase } from './git'

/** Git dans le worktree : la commande, et la même qui lève sur un échec. */
export interface WorktreeGit {
  cwd: string
  run: (args: string[]) => Promise<RunResult>
  exec: (args: string[], timeoutMs?: number) => Promise<string>
}

/** La marque, telle qu'elle est écrite dans le dossier git du worktree. */
export interface AgentResolution {
  /** Tête de la branche quand la consigne est partie. */
  head: string
  /** Commit de la base fusionné (`MERGE_HEAD`) à ce moment. */
  baseTip: string
  /** Fichiers en conflit envoyés à l'agent. */
  files: string[]
  /** `resolving` : rien n'a été relu ; `review` : l'arrêt « à relire » a été dit. */
  stage: 'resolving' | 'review'
}

const MARK = 'bobine-agent-resolution.json'

const lines = (result: RunResult): string[] =>
  result.code === 0 ? result.stdout.toString().split('\n').filter(Boolean) : []

async function markPath(git: WorktreeGit): Promise<string> {
  return join((await git.exec(['rev-parse', '--absolute-git-dir'])).trim(), MARK)
}

export async function readMark(git: WorktreeGit): Promise<AgentResolution | undefined> {
  const text = await readFile(await markPath(git), 'utf8').catch(() => undefined)
  if (text === undefined) return undefined
  try {
    const mark = JSON.parse(text) as Partial<AgentResolution>
    return {
      head: typeof mark.head === 'string' ? mark.head : '',
      baseTip: typeof mark.baseTip === 'string' ? mark.baseTip : '',
      files: Array.isArray(mark.files) ? mark.files.filter((f) => typeof f === 'string') : [],
      stage: mark.stage === 'review' ? 'review' : 'resolving'
    }
  } catch {
    // Illisible : la prudence l'emporte, elle compte pour une résolution pas relue.
    return { head: '', baseTip: '', files: [], stage: 'resolving' }
  }
}

/**
 * La consigne part à l'agent : la fusion en cours est marquée (tête et base du moment). `false` :
 * aucune fusion en cours (marqueurs déjà commités) — rien à confier à l'agent, la marque d'avant
 * reste telle quelle.
 */
export async function writeMark(git: WorktreeGit, files: readonly string[]): Promise<boolean> {
  const merging = await git.run(['rev-parse', '-q', '--verify', 'MERGE_HEAD'])
  if (merging.code !== 0) return false
  const head = (await git.exec(['rev-parse', 'HEAD'])).trim()
  const baseTip = merging.stdout.toString().trim()
  const mark: AgentResolution = { head, baseTip, files: [...files], stage: 'resolving' }
  await writeFile(await markPath(git), JSON.stringify(mark), 'utf8')
  return true
}

/**
 * `review` : l'arrêt « à relire » a été dit à l'utilisateur, la prochaine fusion est la sienne ;
 * `resolving` : de nouveau à conclure (fin d'un tour, après un arrêt dit pendant ce tour).
 */
export async function markStage(git: WorktreeGit, stage: AgentResolution['stage']): Promise<void> {
  const mark = await readMark(git)
  if (!mark || mark.stage === stage) return
  await writeFile(await markPath(git), JSON.stringify({ ...mark, stage }), 'utf8')
}

export async function clearMark(git: WorktreeGit): Promise<void> {
  await rm(await markPath(git), { force: true })
}

/** La fusion arrêtée est commitée (message de git) : les fichiers sans marqueur sont ajoutés. */
export async function commitMerge(git: WorktreeGit, files: readonly string[]): Promise<void> {
  if (files.length > 0) await git.exec(['--literal-pathspecs', 'add', '--', ...files])
  await git.exec(['commit', '-q', '--no-edit'], 60_000)
}

const isAncestor = async (git: WorktreeGit, a: string, b: string): Promise<boolean> =>
  !!a && (await git.run(['merge-base', '--is-ancestor', a, b])).code === 0

/** Fichiers dont le contenu à `rev` (`''` : l'index) garde un marqueur de conflit. */
async function markersAt(git: WorktreeGit, rev: string, files: readonly string[]) {
  const left: string[] = []
  for (const file of files) {
    const shown = await git.run(['show', `${rev}:${file}`])
    if (shown.code === 0 && hasConflictMarkers(shown.stdout.toString())) left.push(file)
  }
  return left
}

/**
 * Fichiers que la résolution touche : ceux envoyés à l'agent, et ceux où le commit de fusion
 * diffère de ses deux parents (un fichier ajouté par l'agent en fait partie).
 */
async function resolutionFiles(git: WorktreeGit, mark: AgentResolution): Promise<string[]> {
  const combined = lines(
    await git.run(['diff-tree', '-r', '--cc', '--name-only', '--no-commit-id', 'HEAD'])
  )
  return [...new Set([...mark.files, ...combined])].sort()
}

/**
 * Conclut, dans la branche seulement, une fusion dont le conflit a été confié à l'agent. `branch` :
 * celle du travail, `base` : le nom de la base. Ne touche jamais la base.
 */
export async function concludeAgentResolution(
  git: WorktreeGit,
  mark: AgentResolution,
  branch: string,
  base: string
): Promise<ConcludeOutcome> {
  if (!(await isAncestor(git, mark.head, 'HEAD'))) return { status: 'undone', head: mark.head }
  if (await isAncestor(git, mark.head, base)) return { status: 'entered-base' }
  const merging = (await git.run(['rev-parse', '-q', '--verify', 'MERGE_HEAD'])).code === 0
  if (merging) {
    const unmerged = lines(await git.run(['diff', '--name-only', '--diff-filter=U']))
    const staged = lines(
      await git.run(['diff', '--cached', '--name-only', '--diff-filter=d', 'HEAD'])
    ).filter((f) => !unmerged.includes(f))
    const left = [
      ...(await markersLeft(git.cwd, unmerged)),
      ...(await markersAt(git, '', staged))
    ].sort()
    if (left.length > 0) return { status: 'conflicts', files: left }
    await commitMerge(git, unmerged)
    await mergeIntoBase((args) => git.exec(args), branch, base)
  } else {
    if (!(await isAncestor(git, mark.baseTip, 'HEAD'))) return { status: 'not-merging' }
    // L'agent a commité lui-même : ce que son commit touche ne doit garder aucun marqueur.
    const touched = lines(
      await git.run(['diff', '--name-only', '--diff-filter=d', mark.head, 'HEAD'])
    )
    const left = await markersAt(git, 'HEAD', touched)
    if (left.length > 0) return { status: 'conflicts', files: left }
    // Son commit de fusion a la branche en premier parent : réécrit avec la base d'abord, comme la
    // fusion l'aurait fait (même arbre).
    const parents = (await git.exec(['log', '-1', '--format=%P'])).trim().split(' ')
    if (parents.length === 2 && parents[0] === mark.head && parents[1] === mark.baseTip) {
      await mergeIntoBase((args) => git.exec(args), branch, base)
    }
  }
  return { status: 'resolved', files: await resolutionFiles(git, mark) }
}

/** Ce qui est dit quand la conclusion n'est ni « résolu » ni un conflit qui reste. */
export function concludeError(
  outcome: Exclude<ConcludeOutcome, { status: 'resolved' | 'conflicts' }>,
  title: string,
  base: string
): string {
  switch (outcome.status) {
    case 'undone':
      return t('childrenMerge.error.undone', { title, head: outcome.head.slice(0, 7) })
    case 'entered-base':
      return t('childrenMerge.error.enteredBase', { title, base })
    case 'not-merging':
      return t('childrenMerge.error.notResolved', { title, base })
  }
}

/** Un worktree, vu de la résolution confiée à l'agent. */
export interface AgentTarget {
  git: WorktreeGit
  branch: string
  title: string
  base: () => Promise<string>
}

/**
 * Fin du tour de l'agent sur un conflit : la conclusion se fait dans la branche, quel que soit le
 * stade de la marque (un clic pendant le tour a pu dire « à relire » d'une demi-résolution) ;
 * jamais dans la base. Échec dit, marque effacée : fusion abandonnée, branche défaite ou entrée
 * dans la base pendant le tour.
 */
export async function concludeAgent(
  target: AgentTarget,
  known?: AgentResolution
): Promise<MergeOutcome> {
  const { git } = target
  const mark = known ?? (await readMark(git))
  const base = await target.base()
  if (!mark) throw new Error(concludeError({ status: 'not-merging' }, target.title, base))
  // Ce que le tour a fait depuis un arrêt dit en cours de route n'a pas été relu.
  if (mark.stage === 'review') await markStage(git, 'resolving')
  const done = await concludeAgentResolution(git, mark, target.branch, base)
  if (done.status === 'resolved') return { ...done, base }
  if (done.status === 'conflicts') return done
  await clearMark(git)
  throw new Error(concludeError(done, target.title, base))
}

/**
 * Avant toute fusion de ce worktree : une résolution confiée à l'agent et pas encore relue se
 * conclut dans la branche (`concludeAgent`) ; `undefined` sans cette marque, ou une fois relue.
 */
export async function agentGate(target: AgentTarget): Promise<MergeOutcome | undefined> {
  const mark = await readMark(target.git)
  return mark?.stage === 'resolving' ? concludeAgent(target, mark) : undefined
}
