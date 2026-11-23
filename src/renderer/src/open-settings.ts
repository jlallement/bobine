/**
 * Ouvrir une section des Réglages depuis un composant éloigné (lien d'un avis du fil, fiche 198),
 * sans faire descendre un rappel à travers tout l'arbre : un évènement de fenêtre, écouté par `App`.
 */
import type { NoticeLink } from '@shared/agent'

const EVENT = 'bobine:open-settings'
const NETWORK_EVENT = 'bobine:reveal-network'

/** Section demandée : lien d'un avis du fil, ou Réglages › Agents (réseau, fiche 275). */
export type SettingsRequest = NoticeLink | 'agents'

export function requestSettings(section: SettingsRequest): void {
  window.dispatchEvent(new CustomEvent<SettingsRequest>(EVENT, { detail: section }))
}

/** Abonnement ; rend la fonction de désabonnement. */
export function onSettingsRequest(open: (section: SettingsRequest) => void): () => void {
  const listener = (event: Event) => open((event as CustomEvent<SettingsRequest>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

/** Réseau demandé, pas encore montré (Réglages pas encore affichés). */
let networkPending = false

/**
 * « Réglages réseau » d'un bandeau (fiche 275) : Réglages › Agents, « Avancé » déplié, champ du
 * proxy à l'écran. Les réglages s'affichent après coup : le réseau se montre à leur arrivée.
 */
export function requestNetworkSettings(): void {
  networkPending = true
  requestSettings('agents')
  window.dispatchEvent(new Event(NETWORK_EVENT))
}

/** Réseau d'entreprise des Réglages : à montrer maintenant ou à la demande ; désabonnement. */
export function onNetworkReveal(reveal: () => void): () => void {
  const show = () => {
    if (!networkPending) return
    networkPending = false
    reveal()
  }
  show()
  window.addEventListener(NETWORK_EVENT, show)
  return () => window.removeEventListener(NETWORK_EVENT, show)
}
