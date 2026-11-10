/**
 * Simulateur iOS (fiche 008) : ce que l'UI affiche de l'appareil d'une conversation.
 */

export interface SimDevice {
  udid: string
  name: string
  /** `Booted`, `Shutdown`, `Booting`… (valeurs de `simctl`). */
  state: string
  /** Ex. « iOS 26.5 ». */
  runtime: string
  /** Type d'appareil de `simctl` (ex. `com.apple.CoreSimulator.SimDeviceType.iPhone-Air`). */
  deviceType?: string
}

/** Appareil de la conversation et ce qu'on sait faire dessus. */
export interface SimulatorState {
  conversationId: string
  device: SimDevice | null
  /** Taille de l'écran en points (coordonnées des touchers), si connue. */
  screen: { width: number; height: number } | null
  /** AXe utilisable (présent, version suffisante) : touchers, glisser, saisie, lecture, vidéo. */
  touch: boolean
  /** AXe : version trouvée, ou pourquoi il ne sert pas (absent, trop ancien, muet). */
  /** AXe utilisé : version, problème, et chemin du binaire (livré avec l'app ou installé). */
  axe?: { version?: string; error?: string; path?: string }
}
