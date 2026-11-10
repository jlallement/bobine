/**
 * Ouvrir une section des Réglages depuis un composant éloigné (lien d'un avis du fil, fiche 198),
 * sans faire descendre un rappel à travers tout l'arbre : un évènement de fenêtre, écouté par `App`.
 */
import type { NoticeLink } from '@shared/agent'

const EVENT = 'bobine:open-settings'

export function requestSettings(section: NoticeLink): void {
  window.dispatchEvent(new CustomEvent<NoticeLink>(EVENT, { detail: section }))
}

/** Abonnement ; rend la fonction de désabonnement. */
export function onSettingsRequest(open: (section: NoticeLink) => void): () => void {
  const listener = (event: Event) => open((event as CustomEvent<NoticeLink>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
