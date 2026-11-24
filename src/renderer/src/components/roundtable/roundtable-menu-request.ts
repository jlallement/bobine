/**
 * « Choisir un autre modèle » sur la ligne d'un participant refusé (fiche 285, maquette
 * `degrade-modele-refuse`) : ouvre le menu des participants de la saisie, loin de la carte. Un
 * évènement de fenêtre, comme `open-settings.ts`, plutôt qu'un rappel descendu à travers l'arbre.
 */
const EVENT = 'bobine:roundtable-menu'

export function requestRoundtableMenu(): void {
  window.dispatchEvent(new Event(EVENT))
}

/** Abonnement ; rend la fonction de désabonnement. */
export function onRoundtableMenuRequest(open: () => void): () => void {
  window.addEventListener(EVENT, open)
  return () => window.removeEventListener(EVENT, open)
}
