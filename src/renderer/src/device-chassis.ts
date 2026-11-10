/**
 * Châssis dessiné autour de l'écran d'un simulateur iOS (fiche 044), d'après le type d'appareil
 * de `simctl` (`com.apple.CoreSimulator.SimDeviceType.iPhone-Air`…) et la taille de l'écran en
 * points. Tout est en points : l'onglet met à l'échelle avec l'écran.
 */
export interface Chassis {
  /** Rayon des coins de l'écran (0 : écran rectangulaire, appareils à bouton d'accueil). */
  radius: number
  /** Tour autour de l'écran : côtés, puis haut et bas (plus hauts quand il y a un bouton). */
  side: number
  top: number
  /** Bouton d'accueil rond sous l'écran (iPhone SE, 8…, iPad classiques). */
  homeButton: boolean
}

/** Appareils avec bouton d'accueil (écran aux coins droits). */
const HOME_BUTTON =
  /iPhone-(SE|8|7|6|5|4)\b|iPod|iPad-(2|Retina|Air(-2)?$|mini-(2|3|4|5)|-?[5-9]th|Pro$)/

export function deviceChassis(deviceType: string | undefined, screen: { width: number }): Chassis {
  const type = deviceType?.replace(/^com\.apple\.CoreSimulator\.SimDeviceType\./, '') ?? ''
  const homeButton = HOME_BUTTON.test(type)
  if (/^iPad/.test(type)) {
    return homeButton
      ? { radius: 0, side: 28, top: 76, homeButton }
      : { radius: Math.round(screen.width * 0.022), side: 26, top: 26, homeButton }
  }
  if (homeButton) return { radius: 0, side: 16, top: 72, homeButton }
  // iPhone récent (Face ID / Dynamic Island) : coins très arrondis, tour mince et régulier.
  return { radius: Math.round(screen.width * 0.148), side: 11, top: 11, homeButton: false }
}
