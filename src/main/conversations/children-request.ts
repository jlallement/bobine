/**
 * Demande de lancement d'une fille (sortie de `children.ts`, taille bornée, fiche 089) : ce que
 * demandent « Lancer en parallèle… », `start_child`, les bulles « @Rôle » et le tour de table.
 */
import type { ChangeFacts } from '../roles/read-only-watch'
import type { PromptAttachment } from '@shared/attachments'
import type { Message } from '@shared/i18n/message'
import type { UncommittedChoice } from '@shared/launch-folder'
import type { RoleRequest } from '@shared/role-request'
import type { RoleSnapshot } from '@shared/roles'

/** Ce que demande « Lancer en parallèle… », ou `start_child`. */
export interface ChildRequest {
  /** Consigne : le premier message de la fille. */
  text: string
  /** Titre de la fille ; absent : le début de la consigne. */
  title?: string
  /** Agent de la fille ; absent : celui de la mère. */
  profileId?: string
  /** Modèle choisi (réglage de catégorie `model`) ; absent : celui que prend l'agent. */
  model?: { controlId: string; value: string }
  /**
   * Rôle de la fille, par son nom (fiche 223) : sa consigne, son mode, sa lecture seule et ses
   * outils. Son agent et son modèle sont choisis par l'appelant (carte, dialogue).
   */
  role?: string
  /** Rôle figé à la carte de `start_child` (relecture de la fiche 223) : l'emporte sur `role`. */
  roleSnapshot?: RoleSnapshot
  /** Lignes dites dans le fil de la fille dès son lancement (agent du rôle indisponible…). */
  notices?: Message[]
  /**
   * Choix de l'utilisateur devant un dossier modifié (fiche 240, fiche 262) : partir sans elles
   * (`anyway`, le choix affiché par défaut sous la saisie), ou un avis en lecture seule dans le
   * dossier de la mère (rôle seulement). Sans choix explicite, une fille qui partirait en worktree
   * d'un dossier modifié est refusée (outil de l'agent, carte sans réponse) : le main n'en
   * suppose aucun.
   */
  uncommitted?: UncommittedChoice
  /**
   * Bulle « @Rôle … » de la saisie (fiche 263) : posée, ou complétée de ce travail, juste avant son
   * lancement dans le fil de la mère ; `works` : les travaux déjà partis pour la même demande,
   * complété en place par `start` (l'appelant passe le même objet au rôle suivant).
   */
  ask?: RoleRequest
  /**
   * Clé de la carte du travail (fiche 264, `ChildStart.card`) : sa ligne de proposition, ou sa
   * carte seule (« Lancer en parallèle… »). Absente : pas de carte (bulle, relecture).
   */
  card?: string
  /** Pièces jointes du premier message (participant d'un tour de table, fiche 285). */
  attachments?: PromptAttachment[]
  /** Modèle strict (fiche 285, décision C4) : sans repli, le lancement échoue avant l'envoi. */
  strictModel?: true
  /** Attente des mises à jour après le réglage du modèle strict (`STRICT_SETTLE_MS` sinon ; essais). */
  strictSettleMs?: number
  /** Place réservée d'avance avec ses sœurs (`reserve`) : le plafond n'est pas revérifié. */
  reserved?: true
  /** Juste avant l'envoi du premier message : `false` l'abandonne, sans erreur (tour arrêté). */
  proceed?: () => boolean
  /** Tour de table (fiche 285) : le premier message est la question de ce tour (son identifiant). */
  roundtableQuestion?: string
  /** Participant d'un tour de table (fiche 285) : l'identifiant du tour, retenu dans sa fiche. */
  roundtable?: string
  /** Le premier message n'a pas pu partir (modèle strict, agent qui ne démarre pas…). */
  launchFailed?: (error: unknown) => void
}

/** Ce qu'un lancement reprend de la demande (`launch`). */
export type LaunchExtras = Pick<
  ChildRequest,
  | 'attachments'
  | 'strictModel'
  | 'strictSettleMs'
  | 'proceed'
  | 'launchFailed'
  | 'roundtableQuestion'
>

/** Ce qu'un lancement reprend de la demande, champ par champ. */
export const launchExtras = (request: ChildRequest): LaunchExtras => ({
  attachments: request.attachments,
  strictModel: request.strictModel,
  strictSettleMs: request.strictSettleMs,
  proceed: request.proceed,
  launchFailed: request.launchFailed,
  roundtableQuestion: request.roundtableQuestion
})

/**
 * Avis demandé devant un dossier modifié (`readOnly`, fiche 240) : le rôle part en lecture seule
 * dans le dossier de la mère, qui voit tout ; seulement pour un rôle.
 */
export function launchRole<R extends RoleSnapshot>(request: ChildRequest, role: R | undefined) {
  if (request.uncommitted !== 'readOnly') return role
  if (!role) throw new Error('Paramètre invalide : uncommitted')
  return { ...role, readOnly: true }
}

/** Ce que le garde-fou de lecture seule dit des participants d'un tour de table (fiche 285). */
export interface ParticipantWatch {
  /** Groupe d'une conversation : les participants d'un même tour (pas « partagés » entre eux). */
  group?: (id: string) => string | undefined
  /** Le dossier a changé pendant son tour : attribuable ou non, tour arrêté ou non. */
  changed?: (id: string, facts: ChangeFacts) => void
  /** Son tour n'a pas pu être jugé. */
  unjudged?: (id: string) => void
}
