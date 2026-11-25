/**
 * La corbeille a changé dans cette fenêtre (restauration, effacement, Réglages › Données) : le
 * main ne publie pas d'évènement de la corbeille, ce qui la montre ailleurs (carte du tour de
 * table, fiche 285) la relit. Un évènement de fenêtre.
 */
const EVENT = 'bobine:trash-changed'

export function notifyTrashChanged(): void {
  window.dispatchEvent(new Event(EVENT))
}

/** Abonnement ; rend la fonction de désabonnement. */
export function onTrashChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
