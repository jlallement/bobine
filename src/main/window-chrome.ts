import type { BrowserWindowConstructorOptions } from 'electron'
import type { PlatformFeatures } from '@shared/platform'

/**
 * Cadre de fenêtre (fiche 145) : sur macOS, pas de barre de titre et les feux posés sur le contenu,
 * à `lights` ; ailleurs, les décorations du système (thème, ordre des boutons du bureau) et la barre
 * de menu masquée, que la touche Alt affiche.
 */
export function windowChrome(
  features: PlatformFeatures,
  titleBarStyle: 'hiddenInset' | 'hidden',
  lights: { x: number; y: number }
): BrowserWindowConstructorOptions {
  const chrome: BrowserWindowConstructorOptions = features.insetTitleBar
    ? { titleBarStyle, trafficLightPosition: lights }
    : {}
  return features.appMenu ? chrome : { ...chrome, autoHideMenuBar: true }
}
