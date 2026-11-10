/**
 * État git du dossier d'une conversation (fiches 037 et 049) : montré par la puce de branche de la
 * zone de saisie. La vue « Git » (commit, poussée, pull requests) a été retirée (fiche 049).
 */
export interface GitStatus {
  /** Racine du dépôt. */
  root: string
  /** Branche courante (absente : HEAD détachée ou dépôt sans commit). */
  branch?: string
  /** Branche distante suivie (ex. `origin/main`). */
  upstream?: string
  /** Commits en avance / en retard sur la branche suivie. */
  ahead: number
  behind: number
  /** Fichiers modifiés, ajoutés, supprimés ou non suivis. */
  dirty: number
}
