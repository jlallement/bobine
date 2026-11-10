/**
 * Canaux de l'intégrité du profil (fiches 196, 197), à part du contrat principal (`ipc.ts`) :
 * état et avis du profil, corbeille, restauration d'une sauvegarde.
 */
import type { BackupCheck, ProfileStatus, TrashEntry } from './profile'

export interface ProfileIpcContract {
  /** État du profil : lecture seule, avis du lancement (fiche 196). */
  'profile:status': { args: []; result: ProfileStatus }
  /** Ferme un avis du lancement ; rend l'état à jour. */
  'profile:dismiss': { args: [id: string]; result: ProfileStatus }
  /** Montre dans le Finder le fichier d'un avis (désigné par l'avis, jamais par un chemin). */
  'profile:reveal': { args: [id: string]; result: undefined }
  /** « Mettre à jour Bobine » : la page des versions, dans le navigateur. */
  'profile:openReleases': { args: []; result: undefined }
  /** Corbeille des conversations (fiche 196). */
  'trash:list': { args: []; result: TrashEntry[] }
  'trash:restore': { args: [id: string]; result: TrashEntry[] }
  /** Efface définitivement une conversation de la corbeille. */
  'trash:erase': { args: [id: string]; result: TrashEntry[] }
  /** Choix d'une sauvegarde à restaurer (fiche 197) : ce qu'elle contient, `null` si annulé. */
  'backup:choose': { args: []; result: BackupCheck | null }
  /** Restaure cette sauvegarde (confirmée) : l'app redémarre et la restaure au lancement. */
  'backup:restore': { args: [folder: string]; result: undefined }
}

export const PROFILE_CHANNELS = [
  'profile:status',
  'profile:dismiss',
  'profile:reveal',
  'profile:openReleases',
  'trash:list',
  'trash:restore',
  'trash:erase',
  'backup:choose',
  'backup:restore'
] as const
