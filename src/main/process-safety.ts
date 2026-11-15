/**
 * Sûreté au démarrage (fiche 138), un seul appel depuis `index.ts` : système des processus posé
 * (ADR-0050), registre des processus enfants ouvert avant tout lancement, groupes laissés par un
 * lancement précédent arrêtés (en tâche de fond), permissions de la session par défaut
 * restreintes. Sous Windows, la suite (objets de tâche, `Win32_Process`) est chargée à part
 * (`process-safety-windows.ts`, `import()`) : rien de ce code ni de `koffi` n'est chargé ailleurs.
 */
import { join } from 'node:path'
import { restrictDefaultPermissions } from './default-permissions'
import { configureProcessLaunch, type ProcessSystem } from './process-launch'
import { openProcessRegistry, PIDS_FILE, reapOrphans } from './process-registry'

/**
 * Unix : synchrone, comme avant (rend `undefined`). Windows : une promesse, à attendre avant tout
 * lancement (les arbres doivent être en place).
 */
export function setupProcessSafety(
  userData: string,
  system: ProcessSystem
): Promise<void> | undefined {
  configureProcessLaunch(system)
  const previous = openProcessRegistry(join(userData, PIDS_FILE))
  if (system === 'posix') {
    void reapOrphans(previous)
    restrictDefaultPermissions()
    return undefined
  }
  return import('./process-safety-windows')
    .then(({ setupWindowsProcesses }) => setupWindowsProcesses(previous))
    .then(() => restrictDefaultPermissions())
}
