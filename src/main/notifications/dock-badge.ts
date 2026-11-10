/**
 * Compteur sur l'icône du Dock (fiche 119) : le nombre de conversations « À traiter », compté par
 * la même règle que la barre latérale (`inboxCount`). Posé seulement quand il change, effacé à
 * zéro ; sans Dock (hors macOS, certains essais), rien.
 */

/** Ce qui sert du Dock de macOS (`app.dock`). */
export interface BadgeDock {
  setBadge: (text: string) => void
}

export interface DockBadge {
  /** Nombre de conversations « À traiter » ; le réglage décide s'il s'affiche. */
  update: (count: number) => void
}

export function createDockBadge(options: {
  dock: BadgeDock | undefined
  /** Réglage « Compteur sur l'icône du Dock », coupé avec les notifications. */
  enabled: () => boolean
}): DockBadge {
  let shown: string | undefined
  return {
    update(count) {
      const text = options.enabled() && count > 0 ? String(count) : ''
      if (!options.dock || text === shown) return
      shown = text
      options.dock.setBadge(text)
    }
  }
}
