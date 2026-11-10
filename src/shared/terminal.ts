/**
 * Terminaux à côté de la conversation (fiche 034) : ce que l'UI affiche de leurs onglets.
 */

export interface TerminalTabInfo {
  id: string
  /** Programme au premier plan, sinon le dossier. */
  title: string
  cwd: string
  /** Un programme tourne (ce n'est pas l'invite du shell). */
  busy: boolean
  /** Le shell s'est terminé. */
  exitCode?: number
  /** Ouverture de l'onglet (ms). */
  startedAt?: number
  /**
   * Commande au premier plan (pas l'invite du shell) : son nom et son début vu par l'app (ms).
   * C'est elle qu'affiche « En cours » de l'onglet « Session » (fiche 166) ; absente à l'invite.
   */
  command?: TerminalCommand
}

export interface TerminalCommand {
  name: string
  startedAt: number
}

export interface TerminalsChange {
  conversationId: string
  tabs: TerminalTabInfo[]
}
