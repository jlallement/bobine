/**
 * Dossiers jetables des essais du premier lancement (fiche 188) : supprimés sans jamais lever
 * (un reste ne doit pas remplacer le résultat d'un essai) ; un échec est noté au journal, et les
 * restes sont vidés au lancement suivant.
 */
import { rmSync } from 'node:fs'
import { log } from '../log'

export function removeQuietly(path: string, remove: typeof rmSync = rmSync): void {
  try {
    remove(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  } catch (error) {
    log.warn(`Accueil : dossier d’essai pas supprimé (${path})`, error)
  }
}
