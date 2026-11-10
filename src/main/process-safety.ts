/**
 * Sûreté au démarrage (fiche 138), un seul appel depuis `index.ts` : registre des processus
 * enfants ouvert avant tout lancement, groupes laissés par un lancement précédent arrêtés (en tâche
 * de fond), permissions de la session par défaut restreintes.
 */
import { join } from 'node:path'
import { restrictDefaultPermissions } from './default-permissions'
import { openProcessRegistry, PIDS_FILE, reapOrphans } from './process-registry'

export function setupProcessSafety(userData: string): void {
  void reapOrphans(openProcessRegistry(join(userData, PIDS_FILE)))
  restrictDefaultPermissions()
}
