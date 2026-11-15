/**
 * Capacités de la plateforme (fiche 145, ADR-0032), passées par le main à la création de la
 * fenêtre. Le renderer masque ce qui manque ; il ne lit jamais le nom du système.
 */
import { ALL_FEATURES, type PlatformFeatures } from '@shared/platform'

/** Capacités de cette fenêtre ; toutes quand le preload n'en donne pas (tests de composants). */
export function platformFeatures(): PlatformFeatures {
  return (window.api as Partial<Window['api']>).app?.features ?? ALL_FEATURES
}

/**
 * Touche des raccourcis tenue (fiche 145) : ⌘ sur macOS, Ctrl ailleurs, comme les accélérateurs
 * `CmdOrCtrl` du menu. Pour les raccourcis que l'interface gère elle-même.
 */
export function commandPressed(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return platformFeatures().commandKey ? event.metaKey : event.ctrlKey
}
