/**
 * Issue de la dernière action de la barre du worktree (fiche 189, verdict UX et relecture) : **une
 * seule** valeur, erreur ou note, remplacée par chaque action et effacée par « Actualiser ».
 *
 * - Elle appartient au worktree où l'action est partie (`identity` : conversation, dossier,
 *   branche) : une réponse arrivée après un changement de worktree n'est jamais affichée.
 * - Une issue de la forge (« Ouvrir une PR / MR ») vaut pour l'état de la forge où elle a été
 *   posée (`forge`) : elle s'efface quand cet état change. Une erreur de commit ou de fusion reste.
 */
import type { WorktreeCycleView } from '@shared/worktree-cycle'

export type Outcome<N> = { kind: 'error'; text: string } | { kind: 'note'; note: N }

/** D'où vient l'issue : la forge (PR / MR) ou git (commit, fusion, nettoyage). */
export type OutcomeSource = 'forge' | 'git'

export interface StoredOutcome<N> {
  identity: string
  forge: string
  /** Compteur de « Actualiser » quand l'issue a été posée : un clic ensuite l'efface. */
  reset: number
  source: OutcomeSource
  value: Outcome<N>
}

/** Le worktree d'une conversation : ce à quoi une issue appartient. */
export function identityKey(
  conversationId: string,
  info: Pick<WorktreeCycleView, 'path' | 'branch'>
): string {
  return JSON.stringify([conversationId, info.path, info.branch])
}

/** État de la forge : prête et son mot, ou la raison et l'hôte. */
export function forgeKey(info: Pick<WorktreeCycleView, 'pr'>): string {
  const pr = info.pr
  return pr.ok ? `ok:${pr.noun ?? 'pr'}` : `${pr.reason}:${pr.host ?? ''}`
}

/** L'issue à afficher pour ce worktree et cet état de la forge, ou rien. */
export function shownOutcome<N>(
  stored: StoredOutcome<N> | null,
  identity: string,
  forge: string,
  reset: number
): Outcome<N> | null {
  if (!stored || stored.identity !== identity || stored.reset !== reset) return null
  // « Vérification en cours » n'est pas un état de la forge : il n'efface rien, et une issue posée
  // pendant une vérification vaut pour l'état qui suit.
  const checking = (key: string) => key.startsWith('checking:')
  if (stored.source === 'forge' && stored.forge !== forge) {
    if (!checking(stored.forge) && !checking(forge)) return null
  }
  return stored.value
}

/**
 * « Ouvrir une PR / MR » et sa raison (verdict UX) : grisé avec la raison quand l'utilisateur peut
 * y remédier (outil absent, non connecté, hôte injoignable) ; forge en cours de vérification :
 * grisé, sans ligne ; forge inconnue → pas de bouton, la raison seulement si la branche a des
 * commits à proposer ; pas de dépôt distant → ni l'un ni l'autre. `why` : clé de `prBlocker`.
 */
export function prVisibility(
  info: Pick<WorktreeCycleView, 'noRemote' | 'unpushed' | 'ahead'>,
  why: string | undefined,
  pr: { open: boolean; merged: boolean }
): { button: boolean; line: boolean } {
  const noRemote = info.noRemote === true || why === 'noRemote'
  const possible = !(pr.open && info.unpushed === 0) && !pr.merged && !noRemote
  return {
    button: possible && why !== 'unknownForge',
    line:
      !!why &&
      why !== 'nothing' &&
      why !== 'checking' &&
      !noRemote &&
      (why !== 'unknownForge' || (possible && info.ahead > 0))
  }
}
