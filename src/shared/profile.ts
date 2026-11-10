/**
 * Intégrité du profil, vue de l'interface (fiches 196 et 197) : lecture seule, avis du lancement,
 * corbeille des conversations, restauration d'une sauvegarde.
 */
import type { Message } from './i18n/message'

/**
 * Marque du refus d'une écriture en lecture seule (fiche 196), en tête du message d'erreur du main :
 * le renderer la reconnaît et affiche `profile.readOnly.refusedShort`, jamais le texte d'Electron.
 */
export const READ_ONLY_ERROR = 'BOBINE_PROFILE_READ_ONLY'

/** Page des versions : « Mettre à jour Bobine » l'ouvre (pas de mise à jour automatique). */
export const RELEASES_URL = 'https://github.com/jlallement/bobine/releases'

export type ProfileNoticeLevel = 'info' | 'success' | 'warning' | 'error'

/**
 * Avis du lancement sur le profil : un évènement passé (fichier mis de côté, liste refaite,
 * restauration), montré une fois et fermé par ×. Ni chemin ni code d'erreur dans le texte : le
 * fichier s'ouvre par « Afficher dans le Finder » (`reveal`), le détail technique est replié.
 */
export interface ProfileNotice {
  id: string
  level: ProfileNoticeLevel
  message: Message
  /** Un fichier ou dossier à montrer (« Afficher dans le Finder »). */
  reveal?: boolean
  /** Détail technique (message d'erreur), replié. */
  detail?: string
}

export interface ProfileStatus {
  /** Profil d'une version plus récente : rien ne s'enregistre, l'envoi est bloqué. */
  readOnly: boolean
  /** Pourquoi : un format plus récent, ou une marque de version illisible. */
  readOnlyReason?: 'newer' | 'unreadable'
  notices: ProfileNotice[]
}

/** Une conversation de la corbeille. */
export interface TrashEntry {
  id: string
  title: string
  workspace: string
  /** Date de suppression (ISO). */
  deletedAt: string
  /** Date à laquelle elle sera effacée pour de bon (ISO). */
  erasedAt: string
}

/** Sauvegarde choisie pour une restauration, avant confirmation. */
export type BackupCheck =
  | {
      ok: true
      folder: string
      /** Date de la sauvegarde (ISO), si elle la dit ; sinon celle du dossier. */
      createdAt: string
      conversations: number
      /** Conversations du profil actuel (remplacées). */
      currentConversations: number
    }
  | { ok: false; reason: 'notBackup' | 'newer' }
