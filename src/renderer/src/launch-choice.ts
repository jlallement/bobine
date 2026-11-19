/**
 * Choix devant un dossier où partirait un travail qui écrit (fiche 262) : « Partir sans elles »
 * (le défaut) ou « Juste un avis, en lecture seule ». Retenu pour ce dossier jusqu'au prochain
 * commit : la clé est la racine du dépôt et son HEAD ; un commit change HEAD, le défaut revient.
 * Mémoire de la fenêtre seulement, rien sur le disque. La ligne sous la saisie dit toujours le
 * choix en cours : il n'est jamais appliqué en silence (R6 de la recette du 2026-11-19).
 */
import type { LaunchFolderState, UncommittedChoice } from '@shared/launch-folder'

export type LaunchChoice = 'without' | 'readOnly'

const remembered = new Map<string, LaunchChoice>()

/** Clé du choix : dépôt et commit ; aucune pour un travail qui part dans le dossier. */
function keyOf(state: LaunchFolderState | null | undefined): string | undefined {
  return state?.place === 'worktree' ? `${state.root}\0${state.head}` : undefined
}

/** Choix retenu pour ce dossier à ce commit ; « Partir sans elles » sinon. */
export function rememberedChoice(state: LaunchFolderState | null | undefined): LaunchChoice {
  const key = keyOf(state)
  return (key && remembered.get(key)) || 'without'
}

/** Retient le choix pour ce dossier jusqu'au prochain commit. */
export function rememberChoice(
  state: LaunchFolderState | null | undefined,
  choice: LaunchChoice
): void {
  const key = keyOf(state)
  if (!key) return
  if (choice === 'without') remembered.delete(key)
  else remembered.set(key, choice)
}

/** Essais : la mémoire de la fenêtre repart de zéro. */
export function forgetLaunchChoices(): void {
  remembered.clear()
}

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
