/**
 * Choix devant un dossier où partirait un travail qui écrit (fiche 262) : « Partir sans elles »
 * (le défaut, à chaque envoi tant que le dossier a du non commité) ou « Juste un avis, en lecture
 * seule », qui ne vaut que pour l'envoi en cours. « Committer d'abord » n'est pas un choix gardé :
 * le commit change HEAD, et le dossier relu dit ce qui reste. La ligne sous la saisie dit toujours
 * le choix en cours : rien n'est appliqué en silence (R6 de la recette du 2026-11-19).
 */
import type { LaunchFolderState, UncommittedChoice } from '@shared/launch-folder'

export type LaunchChoice = 'without' | 'readOnly'

/**
 * Ce que porte la requête de lancement (fiche 262) : explicite, toujours ce que la ligne a
 * affiché. « Juste un avis » : `readOnly`. Non commité laissé derrière : `anyway`. Dossier propre
 * ou travail dans le dossier : rien à choisir, rien de porté — le main reste la garde finale.
 */
export function uncommittedOf(
  state: LaunchFolderState | null | undefined,
  choice: LaunchChoice
): UncommittedChoice | undefined {
  if (state?.place !== 'worktree') return undefined
  if (choice === 'readOnly') return 'readOnly'
  return state.dirty ? 'anyway' : undefined
}
