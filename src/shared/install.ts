/** Pour qui installer l'app (fiche 073) : tous les utilisateurs du Mac, ou soi seulement. */
export type InstallScope = 'everyone' | 'me'

export const INSTALL_SCOPES: readonly InstallScope[] = ['everyone', 'me']

export interface InstallChoice {
  scope: InstallScope
  /** Où l'app serait copiée (ex. `/Users/ada/Applications/Bobine.app`). */
  target: string
  /** On peut y écrire : sinon, il faut les droits d'administrateur. */
  allowed: boolean
  /** Une Bobine déjà installée là sera mise à la corbeille. */
  replacing: boolean
}

/** Proposition d'installation de l'app par elle-même (fiche 073). */
export interface InstallOffer {
  /** Pour tous les utilisateurs (`/Applications`), puis pour soi (`~/Applications`). */
  choices: InstallChoice[]
  /** Choix coché d'office : là où Bobine est déjà installée, sinon le premier possible. */
  suggested: InstallScope
  /** L'app tourne depuis le disque image (.dmg) : il sera éjecté après l'installation. */
  fromDiskImage: boolean
}
