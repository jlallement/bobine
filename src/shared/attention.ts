/**
 * Conversations qui attendent l'utilisateur (fiche 024) : une demande en cours (autorisation,
 * question, connexion), une réponse finie pas encore vue, ou une erreur.
 */
export type AttentionKind = 'request' | 'done' | 'error'

/** Par identifiant de conversation ; une conversation absente n'attend rien. */
export type AttentionState = Record<string, AttentionKind>

/**
 * Ce qu'attend une conversation (fiches 119, 149) : raison et détail pour les infobulles. Une demande
 * (autorisation, question, connexion, dossier à approuver, « Enregistrer sous », boîte d'une page),
 * une réponse finie pas encore vue, ou une erreur.
 */
export type AttentionReason =
  'permission' | 'question' | 'auth' | 'trust' | 'save' | 'page-dialog' | 'done' | 'error'

export interface AttentionDetail {
  reason: AttentionReason
  /** Titre de l'outil à autoriser, texte de la question. */
  detail?: string
  /** Début de l'attente (ms depuis l'époque Unix). */
  since: number
}

/** Par identifiant de conversation, comme `AttentionState`. */
export type AttentionDetails = Record<string, AttentionDetail>

/** Type d'attente d'une raison. */
export function reasonKind(reason: AttentionReason): AttentionKind {
  return reason === 'done' || reason === 'error' ? reason : 'request'
}

/**
 * Notifications refusées par macOS (`blocked` : son message). C'est le cas de toute app signée
 * « ad hoc » (Electron en développement, app packagée sans certificat) : macOS 27 les refuse sans
 * demander l'autorisation à l'utilisateur.
 */
export interface NotificationStatus {
  blocked?: string
}
