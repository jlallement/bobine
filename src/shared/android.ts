/**
 * Émulateur Android (fiche 032) : ce que l'UI affiche de l'appareil d'une conversation.
 */

export interface AndroidDevice {
  /** Numéro de série d'`adb` (`emulator-5554`…). */
  serial: string
  /** Nom de l'appareil virtuel, sinon le modèle. */
  name: string
  /** `device` (prêt), `offline`, `unauthorized`… (valeurs d'`adb`). */
  state: string
}

export interface AndroidState {
  conversationId: string
  device: AndroidDevice | null
  /** Taille de l'écran en dp, orientation comprise (coordonnées des touchers), si connue. */
  screen: { width: number; height: number } | null
  /**
   * Quarts de tour du dessin par rapport à la position naturelle de l'appareil (fiche 081), au sens
   * de `Surface.ROTATION_*` : 1 = appareil tourné d'un quart de tour vers la gauche.
   */
  rotation?: number
  /** Rayon des coins de l'écran déclaré par l'appareil, en dp (0 : rien de déclaré). */
  cornerRadius?: number
  /** SDK Android trouvé (`adb`, `emulator`). */
  sdk: boolean
}
