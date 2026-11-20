/**
 * Garde du ✕ des onglets du panneau (fiche 272, recette : un double clic fermait l'onglet). En
 * panneau serré, l'onglet activé s'élargit pour montrer son ✕ : le second clic d'un double clic, ou
 * un clic rapide de plus, tombait dessus. Le ✕ ne ferme donc jamais :
 * - au second clic d'un double clic (`detail` > 1) ;
 * - dans le délai d'un double clic après l'activation de son onglet à la souris.
 */
export const CLOSE_GRACE_MS = 500

export interface TabActivation {
  tab: string
  at: number
}

export function mayCloseTab(
  tab: string,
  click: { detail: number },
  now: number,
  activation: TabActivation | null
): boolean {
  if (click.detail > 1) return false
  return !(activation && activation.tab === tab && now - activation.at < CLOSE_GRACE_MS)
}
