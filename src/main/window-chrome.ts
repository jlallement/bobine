import type { BrowserWindowConstructorOptions } from 'electron'
import type { PlatformFeatures } from '@shared/platform'

/**
 * Cadre de fenêtre (fiche 145) : sur macOS, pas de barre de titre et les feux posés sur le contenu,
 * à `lights` ; ailleurs, les décorations du système (thème, ordre des boutons du bureau). La barre
 * de menu d'Electron n'y est jamais montrée, pas même par Alt (`app-menu.ts`, variante D) : Bobine
 * dessine son menu derrière le bouton ☰.
 */
export function windowChrome(
  features: Pick<PlatformFeatures, 'insetTitleBar'>,
  titleBarStyle: 'hiddenInset' | 'hidden',
  lights: { x: number; y: number }
): BrowserWindowConstructorOptions {
  return features.insetTitleBar ? { titleBarStyle, trafficLightPosition: lights } : {}
}
