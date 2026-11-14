/**
 * Largeur du panneau de droite (fiche 226, planches P1–P3) : 320 px par défaut, retenue seulement
 * quand l'utilisateur a tiré le bord (`customWidth` dans `bobine.panel`), double-clic sur le bord :
 * retour au défaut.
 *
 * Reprise : avant la fiche 226, la largeur était enregistrée (`width`) à chaque changement du
 * panneau, même sans redimensionnement ; tous les postes ont donc « 380 », l'ancien défaut. Une
 * ancienne largeur égale à 380 vaut « jamais réglée » (donc 320) ; une autre est reprise. Écart
 * assumé : quelqu'un qui avait choisi exactement 380 à la main repart à 320.
 */
import { PANEL_MIN_WIDTH } from './panel-tabs'

export const PANEL_DEFAULT_WIDTH = 320
/** Ancien défaut, enregistré d'office avant la fiche 226. */
export const PANEL_LEGACY_DEFAULT_WIDTH = 380

/** Ce que `bobine.panel` peut contenir de la largeur. */
export interface SavedPanelWidth {
  /** Largeur tirée à la main (depuis la fiche 226). */
  customWidth?: unknown
  /** Ancienne largeur, enregistrée à chaque changement du panneau (avant la fiche 226). */
  width?: unknown
}

const usable = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/** Largeur réglée par l'utilisateur, au moins le minimum ; `null` : jamais réglée. */
export function savedPanelWidth(saved: SavedPanelWidth | null | undefined): number | null {
  if (!saved) return null
  if (usable(saved.customWidth)) return Math.max(PANEL_MIN_WIDTH, Math.round(saved.customWidth))
  if (usable(saved.width) && saved.width !== PANEL_LEGACY_DEFAULT_WIDTH) {
    return Math.max(PANEL_MIN_WIDTH, Math.round(saved.width))
  }
  return null
}

/** Ce qu'il faut enregistrer de la largeur : rien tant qu'elle n'a pas été tirée à la main. */
export function panelWidthToSave(width: number, custom: boolean): { customWidth?: number } {
  return custom ? { customWidth: Math.round(width) } : {}
}
