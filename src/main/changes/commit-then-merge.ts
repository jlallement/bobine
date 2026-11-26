/**
 * « Committer puis fusionner » (fiches 123, 287) : le commit du dossier principal et la fusion
 * d'une branche, d'un seul geste côté main. Tout ce qui refuserait la fusion est lu **avant** le
 * commit — fusion arrêtée avec des marqueurs, worktree non commité, rien à fusionner, base extraite
 * ailleurs, autres fichiers modifiés que les cochés (sans « mettre de côté ») — et rendu ou levé
 * sans rien committer ; puis le commit, puis la fusion habituelle (`WorktreeCycle.merge`).
 *
 * Recette Bricole (21:55) : le commit partait, l'agent écrivait encore, la fusion était refusée
 * juste après. Le tour en cours se vérifie avant d'arriver ici, là où les conversations sont
 * connues (`worktree-ipc.ts`, `ChildrenMerger.start`).
 */
import { readFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { t } from 'i18next'
import { hasConflictMarkers, type CommitRequest, type MergeOutcome } from '@shared/worktree-cycle'
import type { CycleTarget, WorktreeCycle } from './worktree-cycle'

/** Fichiers où il reste des marqueurs de conflit (ou devenus illisibles). */
export async function markersLeft(cwd: string, files: readonly string[]): Promise<string[]> {
  const left: string[] = []
  for (const file of files) {
    const content = await readFile(join(cwd, file), 'utf8').catch(() => null)
    if (content === null || hasConflictMarkers(content)) left.push(file)
  }
  return left
}

/** Fichiers cités dans une phrase, au plus. */
const MAX_FILES = 3

/**
 * Refuse, sans rien committer, si le dossier principal a d'autres modifications que les fichiers
 * cochés et que « mettre de côté » n'est pas demandé : la fusion les refuserait juste après le
 * commit (un agent ou un outil a écrit depuis le choix).
 */
export async function assertOnlyChecked(
  cycle: Pick<WorktreeCycle, 'mainDirty'>,
  target: CycleTarget,
  files: readonly string[],
  stash: boolean
): Promise<void> {
  if (stash) return
  const { root } = target.worktree
  const dirty = await cycle.mainDirty(target)
  // Chemins tels que git les écrit (`status`), relatifs au dossier principal.
  const chosen = new Set(
    files.map((file) => relative(root, resolve(root, file)).split(sep).join('/'))
  )
  const others = (dirty?.files ?? []).filter((file) => !chosen.has(file.path))
  if (others.length === 0) return
  const shown = others
    .slice(0, MAX_FILES)
    .map((f) => f.path)
    .join(', ')
  throw new Error(
    t('worktreeCycle.error.mainChanged', {
      count: others.length,
      files: others.length > MAX_FILES ? `${shown}…` : shown
    })
  )
}

/** Le commit du dossier principal, puis la fusion de la branche ; rien de committé sur un refus. */
export async function commitThenMerge(
  cycle: Pick<
    WorktreeCycle,
    'branchState' | 'baseElsewhere' | 'mainDirty' | 'commitMain' | 'merge'
  >,
  target: CycleTarget,
  commit: CommitRequest,
  options: { stash?: boolean } = {}
): Promise<MergeOutcome> {
  const state = await cycle.branchState(target)
  if (state.conflicts) {
    // Fusion arrêtée sur des conflits : elle reprend seulement sans marqueur.
    const left = await markersLeft(target.worktree.path, state.conflicts)
    if (left.length > 0) return { status: 'conflicts', files: left }
  } else {
    if (state.dirty > 0) return { status: 'dirty', count: state.dirty }
    if (state.ahead === 0) return { status: 'nothing', base: state.base }
  }
  const elsewhere = await cycle.baseElsewhere(target)
  if (elsewhere) throw new Error(t('worktreeCycle.error.baseElsewhere', { path: elsewhere }))
  await assertOnlyChecked(cycle, target, commit.files, !!options.stash)
  await cycle.commitMain(target, commit)
  return cycle.merge(target, options)
}
