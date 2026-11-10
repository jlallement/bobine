/**
 * Recommencer à neuf (fiche 148) : ce que l'interface sait du lancement (profil temporaire,
 * `--reinitialiser`) et ce que la réinitialisation mettra à la corbeille.
 */

export interface FreshStartInfo {
  /** Profil temporaire : dossier de données neuf, supprimé à la fermeture. */
  temporary: boolean
  /** `--reinitialiser` : ouvrir Réglages › Données sur la confirmation. */
  askReset: boolean
}

/** Groupes de la confirmation, dans son ordre. */
export const RESET_KINDS = ['conversations', 'settings', 'usage', 'browser', 'other'] as const
export type ResetKind = (typeof RESET_KINDS)[number]

export interface ResetItem {
  kind: ResetKind
  bytes: number
  /** Conversations : leur nombre. */
  count?: number
}

export interface ResetPlan {
  items: ResetItem[]
  /** La clé « Bobine Safe Storage » du trousseau sera supprimée. */
  keychain: boolean
  /** L'app installée peut partir à la corbeille avec ses données. */
  canUninstall: boolean
}
