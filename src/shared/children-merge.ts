/**
 * Fusion de toutes les filles finies depuis la carte « Sous-tâches » (fiche 120) : ce qui se calcule
 * sans processus. Ce que le main a lu des branches (`ChildrenMergePlan`), la phrase d'état du pied
 * de carte, et l'état d'une fusion enchaînée, posé dans le fil de la mère (élément
 * `children-merge`) pour survivre au redémarrage et au rejeu (fiche 103).
 */
import type { Message } from './i18n/message'
import type { TranscriptItem, TranscriptState } from './transcript'
import type { MainDirty } from './worktree-cycle'

/** Où en est une fille dans une fusion enchaînée. */
export type MergeRowState =
  | 'pending'
  | 'merging'
  /** Conflit : la consigne de la fiche 110 est partie à la fille, qui le résout. */
  | 'resolving'
  | 'merged'
  /** Rien à fusionner : la base avait déjà tout. */
  | 'up-to-date'
  /** Il reste des marqueurs de conflit après le tour de la fille : la chaîne s'est arrêtée là. */
  | 'conflict'
  /** Modifications non commitées apparues entre-temps : sautée. */
  | 'dirty'
  | 'failed'

export interface ChildrenMergeRow {
  childId: string
  title: string
  branch?: string
  state: MergeRowState
  /** Fichiers en conflit (`resolving`, `conflict`). */
  files?: string[]
  /** Raison d'un échec (`failed`), ou du nettoyage qui n'a pas pu se faire. */
  error?: string
  /** Archivée, worktree et branche supprimés (« Puis nettoyer »). */
  cleaned?: boolean
}

/**
 * - `running` : la chaîne avance ; `stopping` : « Arrêter » demandé, la fusion en cours finit.
 * - `done` : toutes les lignes traitées ; `stopped` : arrêtée, des lignes restent en attente ;
 *   `conflict` : arrêtée sur une fille encore en conflit ; `failed` : arrêtée sur une erreur.
 */
export type ChildrenMergeStatus =
  'running' | 'stopping' | 'done' | 'stopped' | 'conflict' | 'failed'

/** Une fusion enchaînée : posée, puis remplacée à chaque étape, dans le fil de la mère. */
export interface ChildrenMerge {
  /** Identifiant de la fusion : l'élément du fil qui la porte est remplacé, pas ajouté. */
  runId: string
  /** Branche de base (celle de la première fille). */
  base: string
  /** « Puis nettoyer » coché. */
  cleanup: boolean
  status: ChildrenMergeStatus
  /** Dans l'ordre de lancement des filles. */
  rows: ChildrenMergeRow[]
  startedAt: number
  endedAt?: number
  /**
   * « Mettre de côté » (fiche 123) : modifications du dossier principal mises de côté pendant la
   * chaîne (`kept`), puis revenues (`restored`) ou restées dans `git stash` (`failed`, `ref`).
   */
  stash?: ChildrenMergeStash
}

export type ChildrenMergeStash =
  | { state: 'kept' | 'restored'; count: number }
  | { state: 'failed'; count: number; ref: string; conflicts: string[] }

/** Ce que le pied de carte doit savoir d'une fille (lu par le main, `ChildrenMerger.plan`). */
export type MergeCandidateState =
  /** Finie, propre, avec des commits que la base n'a pas : à fusionner. */
  | 'ready'
  /** Fusion déjà tentée, arrêtée sur un conflit : reprise avec les autres. */
  | 'conflict'
  | 'running'
  | 'waiting'
  | 'error'
  /** Finie, mais des modifications non commitées : exclue. */
  | 'dirty'
  /** Tout son travail est déjà dans la base. */
  | 'merged'
  /** Finie, sans commit ni modification : rien à fusionner. */
  | 'empty'

export interface MergeCandidate {
  id: string
  title: string
  branch: string
  base: string
  state: MergeCandidateState
  /** Fichiers modifiés depuis la base (`git diff --name-only <base>...<branche>`). */
  files: string[]
  /** Modifications non commitées. */
  dirty: number
}

export interface MergeOverlap {
  first: string
  second: string
  files: string[]
}

export interface ChildrenMergePlan {
  /** Branche de base (celle de la première fille) ; vide sans fille en worktree. */
  base: string
  /** Filles en worktree, dans l'ordre de lancement. */
  children: MergeCandidate[]
  /** Fichiers que deux filles à fusionner modifient toutes les deux. */
  overlaps: MergeOverlap[]
  /**
   * Fusion refusée d'avance : la base est extraite dans un autre worktree (ADR-0022), ou le dossier
   * principal, où elle est extraite, a des modifications non commitées (fiche 123).
   */
  blocked?:
    | { reason: 'base-elsewhere'; path: string }
    | ({ reason: 'main-dirty'; path: string } & Omit<MainDirty, 'root'>)
  /** Une fusion enchaînée de cette mère tourne en ce moment dans le main. */
  running: boolean
}

/** Filles que « Fusionner les N » prend : prêtes, ou arrêtées sur un conflit. */
export const mergeable = (plan: Pick<ChildrenMergePlan, 'children'>): MergeCandidate[] =>
  plan.children.filter((c) => c.state === 'ready' || c.state === 'conflict')

/**
 * Fichiers modifiés par deux filles à fusionner, dans l'ordre de lancement : la seconde pourra
 * entrer en conflit avec la première une fois celle-ci dans la base.
 */
export function mergeOverlaps(candidates: readonly MergeCandidate[]): MergeOverlap[] {
  const overlaps: MergeOverlap[] = []
  candidates.forEach((first, i) => {
    const touched = new Set(first.files)
    for (const second of candidates.slice(i + 1)) {
      const files = second.files.filter((f) => touched.has(f))
      if (files.length > 0) overlaps.push({ first: first.title, second: second.title, files })
    }
  })
  return overlaps
}

/** Recouvrements dits au plus dans la phrase, et fichiers cités par recouvrement. */
const MAX_OVERLAPS = 2
const MAX_FILES = 3

/** Mise en forme d'une liste de titres (« « A » et « B » »), fournie par l'interface. */
export type TitleList = (titles: readonly string[]) => string

/**
 * Phrase d'état du pied de carte (fiche 120) : filles prêtes et celles qui travaillent encore,
 * recouvrements, filles exclues pour modifications non commitées, refus. Vide : pas de pied.
 */
export function mergeSummary(plan: ChildrenMergePlan, titles: TitleList): Message[] {
  const ready = mergeable(plan)
  const dirty = plan.children.filter((c) => c.state === 'dirty')
  if (ready.length === 0 && dirty.length === 0) return []
  const running = plan.children.filter((c) => c.state === 'running').map((c) => c.title)
  const waiting = plan.children.filter((c) => c.state === 'waiting').map((c) => c.title)
  const sentences: Message[] = []
  const busy: Message[] = [
    ...(running.length
      ? [
          {
            key: 'childrenMerge.summary.working',
            params: { count: running.length, titles: titles(running) }
          } as const
        ]
      : []),
    ...(waiting.length
      ? [
          {
            key: 'childrenMerge.summary.waiting',
            params: { count: waiting.length, titles: titles(waiting) }
          } as const
        ]
      : [])
  ]
  if (ready.length > 0) {
    const count = ready.length
    if (busy.length > 0) {
      sentences.push({
        key: busy.length === 1 ? 'childrenMerge.summary.some' : 'childrenMerge.summary.someTwo',
        params: { count, first: busy[0] as Message, ...(busy[1] ? { second: busy[1] } : {}) }
      })
    } else if (plan.overlaps.length === 0 && count > 1) {
      sentences.push({ key: 'childrenMerge.summary.disjoint', params: { count } })
    } else sentences.push({ key: 'childrenMerge.summary.all', params: { count } })
  }
  for (const overlap of plan.overlaps.slice(0, MAX_OVERLAPS)) {
    const shown = overlap.files.slice(0, MAX_FILES).join(', ')
    sentences.push({
      key: 'childrenMerge.summary.overlap',
      params: {
        titles: titles([overlap.first, overlap.second]),
        files: overlap.files.length > MAX_FILES ? `${shown}…` : shown
      }
    })
  }
  if (dirty.length > 0) {
    sentences.push({
      key: 'childrenMerge.summary.dirty',
      params: { count: dirty.length, titles: titles(dirty.map((c) => c.title)) }
    })
  }
  if (plan.blocked?.reason === 'base-elsewhere') {
    sentences.push({
      key: 'childrenMerge.summary.baseElsewhere',
      params: { base: plan.base, path: plan.blocked.path }
    })
  }
  return sentences
}

/** La fusion avance encore (dans le main). */
export const mergeActive = (merge: Pick<ChildrenMerge, 'status'>): boolean =>
  merge.status === 'running' || merge.status === 'stopping'

/**
 * Fusion lue dans le fil : si elle avançait encore et que le main ne la fait plus tourner (l'app a
 * été fermée pendant), elle est dite arrêtée, ses lignes en cours remises en attente.
 */
export function settledMerge(
  merge: ChildrenMerge,
  running: boolean
): ChildrenMerge & {
  interrupted?: true
} {
  if (!mergeActive(merge) || running) return merge
  return {
    ...merge,
    status: 'stopped',
    interrupted: true,
    rows: merge.rows.map((row) =>
      row.state === 'merging' || row.state === 'resolving' ? { ...row, state: 'pending' } : row
    )
  }
}

/** Dernière fusion enchaînée posée dans un fil. */
export function lastChildrenMerge(items: readonly TranscriptItem[]): ChildrenMerge | undefined {
  const item = items.findLast((i) => i.kind === 'children-merge')
  if (item?.kind !== 'children-merge') return undefined
  const { kind: _kind, id: _id, ...merge } = item
  return merge
}

/** Lignes fusionnées (ou déjà à jour) d'une fusion. */
export const mergedRows = (merge: Pick<ChildrenMerge, 'rows'>): ChildrenMergeRow[] =>
  merge.rows.filter((r) => r.state === 'merged' || r.state === 'up-to-date')

/** Élément `children-merge` du fil : un seul par fusion (même `runId`), remplacé à chaque étape. */
export function reduceChildrenMerge(state: TranscriptState, merge: ChildrenMerge): TranscriptState {
  const index = state.items.findLastIndex(
    (i) => i.kind === 'children-merge' && i.runId === merge.runId
  )
  const current = state.items[index]
  if (!current) {
    const item: TranscriptItem = { kind: 'children-merge', id: state.nextId, ...merge }
    return { ...state, items: [...state.items, item], nextId: state.nextId + 1 }
  }
  const items = state.items.slice()
  items[index] = { ...merge, kind: 'children-merge', id: current.id }
  return { ...state, items }
}
