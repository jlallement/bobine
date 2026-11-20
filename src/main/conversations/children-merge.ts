/**
 * Fusionner toutes les filles finies depuis la carte « Sous-tâches » de la mère (fiche 120).
 *
 * - `plan` : ce que le pied de carte montre. Chaque fille en worktree, dans l'ordre de lancement
 *   (éléments `child-started` du fil de la mère), avec son état git (`WorktreeCycle.branchState`),
 *   les fichiers que deux filles modifient toutes les deux, et le refus d'avance si la base est
 *   extraite dans un autre worktree.
 * - `start` : la fusion enchaînée. Chaque fille passe par `WorktreeCycle.merge` (ADR-0022 : la
 *   base entre dans son worktree, puis avance en fast-forward), l'une après l'autre. Au premier
 *   conflit, la consigne générique de la fiche 110 part à la fille ; à la fin de son tour, la
 *   fusion reprend si les marqueurs ont disparu, sinon la chaîne s'arrête là.
 * - `stop` : la fusion en cours finit (jamais de base à moitié avancée), les autres attendent.
 * - Fiche 123 : le dossier principal non commité (la base y est extraite) refuse la fusion d'avance ;
 *   `commitMain` y committe (« Committer d'abord ») ; `start(…, stash)` le met de côté le temps de
 *   la chaîne (`git stash -u`), puis le remet, et le fil le dit.
 *
 * L'état est posé dans le fil de la mère (évènement `children-merge`, remplacé à chaque étape) :
 * il part au renderer par l'évènement de conversation habituel et survit au redémarrage.
 */
import { randomUUID } from 'node:crypto'
import { t } from 'i18next'
import type { AttentionState } from '@shared/attention'
import {
  mergeOverlaps,
  mergeable,
  mergedRows,
  type ChildrenMerge,
  type ChildrenMergePlan,
  type ChildrenMergeRow,
  type MergeCandidate,
  type MergeCandidateState
} from '@shared/children-merge'
import { childState } from '@shared/children'
import { messageOf } from '@shared/errors'
import { conflictPrompt, type CommitOutcome, type MergeOutcome } from '@shared/worktree-cycle'
import type { ConversationSummary } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import type { CycleTarget, StashHandle, WorktreeCycle } from '../changes/worktree-cycle'
import type { Worktrees } from '../changes/worktrees'
import type { ConversationManager } from './manager'

/** Ce que la fusion demande au gestionnaire de conversations. */
export type ChildrenMergeHost = Pick<
  ConversationManager,
  'state' | 'view' | 'worktreeOf' | 'post' | 'prompt' | 'leaveWorktree'
>

export interface ChildrenMergeDeps {
  conversations: ChildrenMergeHost
  cycle: Pick<
    WorktreeCycle,
    | 'merge'
    | 'branchState'
    | 'baseElsewhere'
    | 'baseBranch'
    | 'mainDirty'
    | 'stashMain'
    | 'restoreMain'
    | 'commitMain'
    | 'shortHead'
    | 'worktreeHead'
  >
  /** Suppression d'un worktree et de sa branche (« Puis nettoyer »). */
  worktrees: Pick<Worktrees, 'remove'>
  /** Conversations qui attendent l'utilisateur (fiche 024) : une fille finie « à lire » compte. */
  attention?: () => AttentionState
  /** Une ligne du journal des commandes (`agents.log`, fiche 080). */
  log?: (motherId: string, line: string) => void
  /** Le dépôt a changé (fusions faites) : vues Git à relire (fiche 246, D4). */
  changed?: (motherId: string) => void
  now?: () => number
}

interface Run {
  merge: ChildrenMerge
  /** Tête de chaque branche fusionnée (fiche 264) : le nettoyage ne supprime que celle-là. */
  heads: Map<string, string>
  stop: boolean
  done: Promise<void>
  /** Modifications du dossier principal mises de côté pour la chaîne (fiche 123). */
  stash?: StashHandle
}

/** Fichiers cités dans une phrase, au plus. */
const MAX_FILES = 3
const fileList = (files: readonly { path: string }[]): string => {
  const shown = files
    .slice(0, MAX_FILES)
    .map((f) => f.path)
    .join(', ')
  return files.length > MAX_FILES ? `${shown}…` : shown
}

/** Rang de lancement de chaque fille, d'après le fil de la mère. */
function launchRank(items: readonly TranscriptItem[]): (id: string) => number {
  const launched = items.flatMap((i) => (i.kind === 'child-started' ? [i.childId] : []))
  return (id) => {
    const index = launched.indexOf(id)
    return index === -1 ? launched.length : index
  }
}

export class ChildrenMerger {
  private readonly deps: ChildrenMergeDeps
  private readonly runs = new Map<string, Run>()
  /** Mères dont une fusion se prépare (base lue) : un second départ est refusé. */
  private readonly starting = new Set<string>()

  constructor(deps: ChildrenMergeDeps) {
    this.deps = deps
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }

  /** Le travail travaille encore ou attend un accord (fiche 264). */
  private busy(child: ConversationSummary): boolean {
    const state = childState(child, (this.deps.attention?.() ?? {})[child.id])
    return state === 'running' || state === 'waiting'
  }

  /** Un Code reviewer de ce travail (`reviewOf`) travaille encore ou attend un accord. */
  private reviewing(childId: string): boolean {
    return this.deps.conversations
      .state()
      .conversations.some((c) => c.reviewOf?.id === childId && !c.archived && this.busy(c))
  }

  /** Une fusion de cette mère tourne. */
  running(motherId: string): boolean {
    return this.runs.has(motherId)
  }

  /** Fin de la fusion en cours de cette mère (essais) ; résolue tout de suite sans fusion. */
  settled(motherId: string): Promise<void> {
    return this.runs.get(motherId)?.done ?? Promise.resolve()
  }

  /** Conversation en worktree, ou `null` (supprimée, partagée, plus de worktree). */
  private target(id: string): CycleTarget | null {
    try {
      return this.deps.conversations.worktreeOf(id)
    } catch {
      return null
    }
  }

  /** Filles encore liées à la mère (hors archivées), dans l'ordre de lancement. */
  private children(motherId: string): ConversationSummary[] {
    const { conversations } = this.deps.conversations.state()
    const rank = launchRank(this.deps.conversations.view(motherId).transcript.items)
    return conversations
      .filter((c) => c.startedFrom?.id === motherId && !c.archived)
      .sort((a, b) => rank(a.id) - rank(b.id))
  }

  /**
   * Filles dans l'ordre d'une carte (fiche 264) : celui de `ids` (ses lignes), puis les autres
   * dans l'ordre de lancement ; sans `ids`, l'ordre de lancement (« Sous-tâches », fiche 120).
   */
  private ordered(motherId: string, ids?: readonly string[]): ConversationSummary[] {
    const children = this.children(motherId)
    if (!ids) return children
    const rank = (id: string) => (ids.includes(id) ? ids.indexOf(id) : ids.length)
    return [...children].sort((a, b) => rank(a.id) - rank(b.id))
  }

  /**
   * Ce que montre le pied d'une carte : « Sous-tâches » (toutes les filles), ou une carte de
   * groupe ou de travail (fiche 264, `ids`) : seulement ses travaux, leurs recouvrements entre eux,
   * et le refus d'avance lu depuis le premier d'entre eux. Seules ces branches sont lues.
   */
  async plan(motherId: string, ids?: readonly string[]): Promise<ChildrenMergePlan> {
    const attention = this.deps.attention?.() ?? {}
    const candidates: MergeCandidate[] = []
    const targets = new Map<string, CycleTarget>()
    const wanted = ids && new Set(ids)
    for (const child of this.ordered(motherId, ids)) {
      if (wanted && !wanted.has(child.id)) continue
      const target = this.target(child.id)
      if (!target) continue
      targets.set(child.id, target)
      candidates.push(await this.candidate(child, target, childState(child, attention[child.id])))
    }
    const ready = mergeable({ children: candidates })
    const first = ready[0] ?? candidates[0]
    const firstTarget = ready[0] && targets.get(ready[0].id)
    return {
      base: first?.base ?? '',
      children: candidates,
      overlaps: mergeOverlaps(ready),
      ...(firstTarget ? await this.blocked(motherId, firstTarget) : {}),
      running: this.running(motherId),
      ...(this.runs.get(motherId) ? { runId: this.runs.get(motherId)?.merge.runId } : {})
    }
  }

  /** Refus d'avance : base extraite ailleurs, ou dossier principal non commité (fiche 123). */
  private async blocked(
    motherId: string,
    target: CycleTarget
  ): Promise<Pick<ChildrenMergePlan, 'blocked'>> {
    const elsewhere = await this.deps.cycle.baseElsewhere(target)
    if (elsewhere) return { blocked: { reason: 'base-elsewhere', path: elsewhere } }
    // Lu au mieux : un dossier principal illisible ne cache pas le pied de carte.
    const dirty = await this.deps.cycle.mainDirty(target).catch(() => undefined)
    if (!dirty) return {}
    const { root, ...rest } = dirty
    const title = this.motherTitle(motherId)
    return { blocked: { reason: 'main-dirty', path: root, ...rest, ...(title ? { title } : {}) } }
  }

  /** Titre de la mère : d'où proposer le message de « Committer d'abord ». */
  private motherTitle(motherId: string): string | undefined {
    const { conversations } = this.deps.conversations.state()
    return (
      conversations.find((c) => c.id === motherId)?.title ??
      conversations.find((c) => c.startedFrom?.id === motherId)?.startedFrom?.title
    )
  }

  /** « Committer d'abord » : ces fichiers, dans le dossier principal du dépôt des filles. */
  async commitMain(
    motherId: string,
    request: { message: string; files: string[] }
  ): Promise<CommitOutcome> {
    const target = this.children(motherId)
      .map((child) => this.target(child.id))
      .find((found): found is CycleTarget => !!found)
    if (!target) throw new Error(t('childrenMerge.error.none'))
    return this.deps.cycle.commitMain(target, request)
  }

  private async candidate(
    child: ConversationSummary,
    target: CycleTarget,
    state: ReturnType<typeof childState>
  ): Promise<MergeCandidate> {
    const base = {
      id: child.id,
      title: child.title,
      branch: target.worktree.branch,
      ...(target.worktree.base ? { from: target.worktree.base.slice(0, 7) } : {})
    }
    if (state === 'running' || state === 'waiting' || state === 'error') {
      // Une fille au travail : son dossier bouge, rien à lire avant qu'elle ait fini.
      const baseBranch = target.worktree.baseBranch ?? ''
      return { ...base, base: baseBranch, state, files: [], dirty: 0 }
    }
    try {
      const branch = await this.deps.cycle.branchState(target)
      const status: MergeCandidateState = branch.conflicts
        ? 'conflict'
        : branch.dirty > 0
          ? 'dirty'
          : branch.ahead > 0
            ? 'ready'
            : branch.sinceBase > 0
              ? 'merged'
              : 'empty'
      return {
        ...base,
        base: branch.base,
        state: status,
        files: branch.files,
        dirty: branch.dirty,
        added: branch.added,
        removed: branch.removed
      }
    } catch {
      // Dossier du worktree illisible (supprimé à la main) : la fille n'est pas proposée.
      return {
        ...base,
        base: target.worktree.baseBranch ?? '',
        state: 'error',
        files: [],
        dirty: 0
      }
    }
  }

  /**
   * Lance la fusion enchaînée de ces filles de `motherId`, dans l'ordre de lancement ; rend son
   * premier état. Refusée si une fusion de cette mère tourne déjà, sans fille, ou si une fille a
   * été supprimée, archivée ou n'est plus dans un worktree.
   */
  async start(
    motherId: string,
    ids: readonly string[],
    cleanup: boolean,
    stash = false
  ): Promise<ChildrenMerge> {
    if (this.runs.has(motherId) || this.starting.has(motherId)) {
      throw new Error(t('childrenMerge.error.running'))
    }
    if (ids.length === 0) throw new Error(t('childrenMerge.error.none'))
    const chosen = this.ordered(motherId, ids).filter((c) => ids.includes(c.id))
    const targets = chosen.map((c) => this.target(c.id))
    if (chosen.length !== new Set(ids).size || targets.some((target) => !target)) {
      throw new Error(t('childrenMerge.error.gone'))
    }
    // Un travail qui travaille encore (ou attend un accord) ne se fusionne pas : sa branche bouge.
    const busy = chosen.find((c) => this.busy(c))
    if (busy) throw new Error(t('childrenMerge.error.busy', { title: busy.title }))
    // Sa relecture tourne encore (fiche 265) : elle lit son dossier, que le nettoyage supprimerait.
    const reviewed = chosen.find((c) => this.reviewing(c.id))
    if (reviewed) throw new Error(t('childrenMerge.error.reviewing', { title: reviewed.title }))
    const first = targets[0] as CycleTarget
    this.starting.add(motherId)
    let base: string
    let kept: StashHandle | undefined
    try {
      base = await this.deps.cycle.baseBranch(first)
      // Fiche 123 : rien ne part sur un dossier principal non commité, sauf à le mettre de côté.
      const dirty = await this.deps.cycle.mainDirty(first)
      if (dirty && !stash) {
        throw new Error(
          t('childrenMerge.error.mainDirty', {
            count: dirty.files.length,
            files: fileList(dirty.files)
          })
        )
      }
      if (dirty) kept = await this.deps.cycle.stashMain(first)
    } finally {
      this.starting.delete(motherId)
    }
    const merge: ChildrenMerge = {
      runId: randomUUID(),
      base,
      cleanup,
      status: 'running',
      rows: chosen.map((child, i) => ({
        childId: child.id,
        title: child.title,
        branch: (targets[i] as CycleTarget).worktree.branch,
        state: 'pending'
      })),
      startedAt: this.now(),
      ...(kept ? { stash: { state: 'kept' as const, count: kept.count } } : {})
    }
    const run: Run = {
      merge,
      heads: new Map(),
      stop: false,
      done: Promise.resolve(),
      ...(kept ? { stash: kept } : {})
    }
    this.runs.set(motherId, run)
    this.deps.log?.(motherId, `children merge: ${merge.rows.length} into ${base}`)
    this.emit(motherId, run)
    const initial = structuredClone(merge)
    run.done = this.chain(motherId, run).finally(() => this.runs.delete(motherId))
    return initial
  }

  /**
   * « Arrêter » : la fusion en cours finit, les filles suivantes restent en attente. `runId` : celle
   * d'une carte (fiche 264) ; une autre fusion de la mère n'est jamais arrêtée.
   */
  stop(motherId: string, runId?: string): void {
    const run = this.runs.get(motherId)
    if (!run || run.stop) return
    if (runId && run.merge.runId !== runId) return
    run.stop = true
    if (run.merge.status === 'running') run.merge.status = 'stopping'
    this.deps.log?.(motherId, 'children merge: stop requested')
    this.emit(motherId, run)
  }

  /** La chaîne : chaque fille à son tour, jusqu'au bout, à l'arrêt, ou au premier blocage. */
  private async chain(motherId: string, run: Run): Promise<void> {
    const { merge } = run
    for (const row of merge.rows) {
      if (run.stop) break
      if (!(await this.mergeRow(motherId, run, row))) break
    }
    if (merge.status === 'running' || merge.status === 'stopping') {
      merge.status = merge.rows.some((r) => r.state === 'pending') ? 'stopped' : 'done'
    }
    if (run.stash) await this.restore(motherId, run, run.stash)
    if (merge.cleanup) await this.cleanup(motherId, run)
    merge.endedAt = this.now()
    this.deps.log?.(motherId, `children merge: ${merge.status}`)
    this.emit(motherId, run)
    this.deps.changed?.(motherId)
  }

  /** Fusionne une fille ; `false` : la chaîne s'arrête là (conflit qui reste, erreur). */
  private async mergeRow(motherId: string, run: Run, row: ChildrenMergeRow): Promise<boolean> {
    const set = (patch: Partial<ChildrenMergeRow>) => {
      Object.assign(row, patch)
      this.emit(motherId, run)
    }
    const target = this.target(row.childId)
    if (!target) {
      set({ state: 'failed', error: t('childrenMerge.error.gone') })
      return true
    }
    set({ state: 'merging' })
    try {
      // Ce que la branche apporte (fiche 264), lu avant qu'elle n'entre dans la base.
      const brought = await this.deps.cycle.branchState(target).catch(() => undefined)
      if (brought) {
        Object.assign(row, {
          fileCount: brought.files.length,
          added: brought.added,
          removed: brought.removed
        })
      }
      let outcome = await this.deps.cycle.merge(target)
      if (outcome.status === 'conflicts') {
        set({ state: 'resolving', files: outcome.files })
        const base = await this.deps.cycle.baseBranch(target)
        try {
          // La fille résout ; `prompt` rend la main à la fin de son tour (fiche 110).
          // Sa provenance dite dans le fil du travail (fiche 264) : pas un message de l'utilisateur.
          await this.deps.conversations.prompt(
            row.childId,
            conflictPrompt(base, target.worktree.branch, outcome.files),
            [],
            { from: { kind: 'merge', id: motherId, title: this.motherTitle(motherId) ?? '' } }
          )
        } catch (error) {
          set({
            state: 'conflict',
            error: t('childrenMerge.error.prompt', { error: messageOf(error) })
          })
          run.merge.status = 'conflict'
          return false
        }
        // Une fusion arrêtée reprend : marqueurs partis, elle est commitée et la base avance.
        outcome = await this.deps.cycle.merge(target)
      }
      if (outcome.status === 'merged') {
        const commit = await this.deps.cycle.shortHead(target, outcome.base).catch(() => undefined)
        if (commit) row.commit = commit
      }
      if (outcome.status === 'merged' || outcome.status === 'nothing') {
        const { head } = await this.deps.cycle
          .worktreeHead(target)
          .catch(() => ({ head: undefined }))
        if (head) run.heads.set(row.childId, head)
      }
      return this.settle(run, row, outcome, set)
    } catch (error) {
      // Base extraite ailleurs, dépôt principal qui refuse le fast-forward… : rien n'a avancé.
      set({ state: 'failed', error: messageOf(error) })
      run.merge.status = 'failed'
      return false
    }
  }

  private settle(
    run: Run,
    row: ChildrenMergeRow,
    outcome: MergeOutcome,
    set: (patch: Partial<ChildrenMergeRow>) => void
  ): boolean {
    switch (outcome.status) {
      case 'merged':
        delete row.files
        set({ state: 'merged' })
        return true
      case 'nothing':
        set({ state: 'up-to-date' })
        return true
      case 'dirty':
        // Des modifications sont apparues depuis la carte : la fille est sautée, pas commitée.
        set({ state: 'dirty' })
        return true
      case 'conflicts':
        set({ state: 'conflict', files: outcome.files })
        run.merge.status = 'conflict'
        return false
      case 'main-dirty':
        // Le dossier principal a changé pendant la chaîne (la mère y travaille) : rien n'a avancé.
        set({
          state: 'failed',
          error: t('childrenMerge.error.mainDirty', {
            count: outcome.files.length,
            files: fileList(outcome.files)
          })
        })
        run.merge.status = 'failed'
        return false
    }
  }

  /** Remet ce qui a été mis de côté au départ ; si ça ne revient pas, l'entrée reste et c'est dit. */
  private async restore(motherId: string, run: Run, handle: StashHandle): Promise<void> {
    try {
      const outcome = await this.deps.cycle.restoreMain(handle)
      run.merge.stash = outcome.restored
        ? { state: 'restored', count: outcome.count }
        : { state: 'failed', ...outcome }
    } catch (error) {
      run.merge.stash = {
        state: 'failed',
        count: handle.count,
        ref: handle.hash.slice(0, 7),
        conflicts: []
      }
      this.deps.log?.(motherId, `children merge: stash not restored (${messageOf(error)})`)
    }
  }

  /** « Puis nettoyer » : chaque fille fusionnée est archivée, son worktree et sa branche supprimés. */
  private async cleanup(motherId: string, run: Run): Promise<void> {
    for (const row of mergedRows(run.merge)) {
      try {
        // Jamais de travail détruit (fiche 264) : un travail qui travaille, dont la branche a bougé
        // depuis sa fusion ou dont le dossier a des modifications reste tel quel, et c'est dit.
        const target = this.target(row.childId)
        const child = this.children(motherId).find((c) => c.id === row.childId)
        const now = target ? await this.deps.cycle.worktreeHead(target) : undefined
        const merged = run.heads.get(row.childId)
        if (
          !target ||
          !child ||
          this.busy(child) ||
          this.reviewing(child.id) ||
          !merged ||
          now?.head !== merged ||
          now.dirty
        ) {
          row.error = t('childrenMerge.error.cleanupSkipped', { title: row.title })
          this.deps.log?.(motherId, `children merge: cleanup skipped (${row.childId})`)
          continue
        }
        const worktree = this.deps.conversations.leaveWorktree(row.childId)
        await this.deps.worktrees.remove(worktree)
        row.cleaned = true
      } catch (error) {
        row.error = messageOf(error)
        this.deps.log?.(motherId, `children merge: cleanup failed (${messageOf(error)})`)
      }
    }
  }

  /** État posé dans le fil de la mère ; mère supprimée entre-temps : la chaîne s'arrête. */
  private emit(motherId: string, run: Run): void {
    const posted = this.deps.conversations.post(motherId, {
      type: 'children-merge',
      merge: structuredClone(run.merge)
    })
    if (!posted) run.stop = true
  }
}
