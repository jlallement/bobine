/**
 * Règles actives d'une conversation (fiche 056) : les fichiers de consignes que l'agent charge pour
 * ce dossier et ce mode. Calculées par l'app d'après ce que fait chaque agent (profil `rules`).
 */
export interface RuleFileView {
  /** Chemin absolu, ou URL pour une consigne en ligne (`instructions` d'OpenCode). */
  path: string
  /** Tel qu'on l'affiche : relatif au dossier de la conversation, ou `~/…`. */
  label: string
  /** Du projet (dossier, dépôt) ou personnelle (dossier de l'utilisateur). */
  scope: 'project' | 'personal'
  /** Mode auquel elle s'applique (Bob : `rules-<mode>`) ; absent : tous les modes. */
  mode?: string
  /** Consigne en ligne : pas d'aperçu, l'agent la télécharge. */
  url?: boolean
}
