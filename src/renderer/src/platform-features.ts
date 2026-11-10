/**
 * Capacités de la plateforme (fiche 145, ADR-0032), passées par le main à la création de la
 * fenêtre. Le renderer masque ce qui manque ; il ne lit jamais le nom du système.
 */
import { ALL_FEATURES, type PlatformFeatures } from '@shared/platform'

/** Capacités de cette fenêtre ; toutes quand le preload n'en donne pas (tests de composants). */
export function platformFeatures(): PlatformFeatures {
  return (window.api as Partial<Window['api']>).app?.features ?? ALL_FEATURES
}
