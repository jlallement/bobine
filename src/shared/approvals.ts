/** Autorisations retenues de l'app, telles que les Réglages les montrent (fiche 072). */
export interface ApprovalsView {
  /** Sites extérieurs « toujours autorisés » dans le navigateur intégré (ex. `github.com`). */
  sites: string[]
  /** Commandes lancées sans demander, par dossier. */
  commands: { workspace: string; commands: string[] }[]
  /** Préparation des worktrees autorisée, par dépôt (fiche 175) : les commandes montrées. */
  worktreeSetups: { root: string; setup?: string; archive?: string }[]
}

/** Autorisation retenue à oublier (Réglages › Agents). */
export type ForgottenApproval =
  { site: string } | { workspace: string; command: string } | { worktreeSetup: string }
