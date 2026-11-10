/**
 * Commande `bobine` du terminal (fiche 158) : `bobine <dossier> ["premier message"]` ouvre une
 * nouvelle conversation dans ce dossier, comme `code .`.
 */

/** État de la commande installée, pour Réglages › Général. */
export interface CommandLineStatus {
  /** Le script `bobine` existe (reconnu à son marqueur) à cet emplacement. */
  path?: string
  /** Il appelle cette Bobine-ci ; sinon (app déplacée, mise à jour) il faut le réinstaller. */
  current: boolean
  /** Le dossier du script est dans le PATH : `bobine` se tape tel quel. */
  inPath: boolean
  /** Où l'installation écrirait (`/usr/local/bin` si on peut y écrire, sinon `~/.local/bin`). */
  target: string
}

/** Texte posé dans la zone de saisie d'une conversation ouverte par `bobine` (jamais envoyé). */
export interface LaunchPrefill {
  id: string
  text: string
}
