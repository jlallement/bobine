/**
 * Largeur de la barre latérale (fiche 113) : 300 px par défaut, réglable à la poignée entre 220 et
 * 440 px, retenue sur ce poste (stockage local, comme le regroupement de l'historique).
 */
export const SIDEBAR_WIDTH_KEY = 'bob:barre-largeur'
export const SIDEBAR_DEFAULT_WIDTH = 300
export const SIDEBAR_MIN_WIDTH = 220
export const SIDEBAR_MAX_WIDTH = 440
/**
 * Place que la conversation garde quoi qu'il arrive : en dessous, sa barre de saisie repliée
 * (fiche 092) tronque les noms du modèle et de l'agent. Sur une fenêtre étroite (demi-écran), la
 * barre latérale cède la différence et reprend sa largeur quand la fenêtre s'élargit.
 */
export const CONVERSATION_MIN_WIDTH = 500

export const clampSidebarWidth = (width: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))

/** Largeur montrée : celle réglée, moins ce que la conversation réclame dans cette fenêtre. */
export const fittedSidebarWidth = (width: number, windowWidth: number): number =>
  Math.max(SIDEBAR_MIN_WIDTH, Math.min(width, windowWidth - CONVERSATION_MIN_WIDTH))

/** Largeur retenue, ramenée dans les bornes ; la largeur par défaut si rien (ou n'importe quoi). */
export function readSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    const width = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(width) ? clampSidebarWidth(width) : SIDEBAR_DEFAULT_WIDTH
  } catch {
    return SIDEBAR_DEFAULT_WIDTH
  }
}

export function writeSidebarWidth(width: number): void {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(width)))
  } catch {
    // Stockage indisponible : la largeur vaut pour cette session.
  }
}
