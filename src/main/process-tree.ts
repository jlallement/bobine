/**
 * Lancer et arrêter un arbre de processus, quel que soit le système (fiches 138, 229 ; ADR-0050).
 * Sous macOS et Linux : groupes de processus (`process-group.ts`), exactement comme avant. Sous
 * Windows : objets de tâche (`process-tree-windows.ts`). `index.ts` choisit une fois
 * (`configureProcessTrees`) ; sans configuration (essais, sondes), le comportement Unix. Chaque
 * processus lancé passe par `startProcess` : propre groupe ou propre job, noté au registre
 * `agents.pids`. N'importe pas `electron`.
 */
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { launchProgram, type LaunchPlan } from './process-launch'
import { settleStoppedGroups, stopGroup, stoppingGroups } from './process-group'
import { stopTrackedChildren, trackChild } from './process-registry'
import type { WindowsTrees } from './process-tree-windows'

let windows: WindowsTrees | undefined

/** Windows : arbres par objets de tâche ; `undefined` : groupes Unix. */
export function configureProcessTrees(trees: WindowsTrees | undefined): void {
  windows = trees
}

/** Arbres de Windows en service (Diagnostic, journal). */
export function windowsTrees(): WindowsTrees | undefined {
  return windows
}

/**
 * Lance `command args` (`launchProgram` : `.cmd`, `PATHEXT`, pas de console) dans son propre
 * groupe ou son propre job, et le note au registre. `shellCommand` : ligne de shell de
 * l'utilisateur.
 */
export function startProcess(
  command: string,
  args: readonly string[],
  options: SpawnOptions,
  shellCommand = false
): { child: ChildProcess; plan: LaunchPlan } {
  const launched = launchProgram(command, args, options, shellCommand)
  // Tout de suite après `spawn` : un petit-enfant lancé avant serait hors du job.
  windows?.adopt(launched.child)
  // Noté pour être arrêté au prochain démarrage si le main plante (fiche 138).
  trackChild(
    launched.child,
    shellCommand ? [launched.plan.file, ...launched.plan.args] : [command, ...args]
  )
  return launched
}

/** Arrête un processus lancé par l'app et tout son arbre (fiche 138). */
export function stopTree(child: ChildProcess, graceMs?: number): void {
  if (windows) windows.stop(child, graceMs)
  else stopGroup(child, graceMs)
}

/** Des arbres sont en cours d'arrêt (en quittant, `will-quit` les attend). */
export function treesStopping(): boolean {
  return windows ? windows.stopping() > 0 : stoppingGroups().length > 0
}

/** En quittant : attend les arbres en cours d'arrêt, puis arrête de force ceux qui restent. */
export function settleStoppedTrees(): Promise<number> {
  return windows ? windows.settle() : settleStoppedGroups()
}

/** En quittant (fiche 208) : ce qu'aucun arrêt n'a visé. */
export function stopRemainingTrees(): number {
  return windows ? windows.stopAll() : stopTrackedChildren()
}
