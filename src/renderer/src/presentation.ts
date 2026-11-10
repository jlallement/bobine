/**
 * Mode présentation côté interface (fiche 159) : l'état vient du main (menu et Réglages le
 * changent par le même canal), lu une fois puis suivi. `startPresentation()` est appelé au
 * démarrage de chaque fenêtre ; sans lui (essais de composants), le mode reste inactif.
 */
import { useSyncExternalStore } from 'react'
import { abbreviateHome, abbreviateHomeIn } from '@shared/presentation'
import { setPresenting } from './appearance'

let active = false
const listeners = new Set<() => void>()

function set(next: boolean): void {
  if (next === active) return
  active = next
  document.documentElement.dataset['presentation'] = next ? 'on' : ''
  setPresenting(next)
  for (const listener of listeners) listener()
}

export function startPresentation(): void {
  void window.api.app.presentation().then(set)
  window.api.app.onPresentation(set)
}

/** Changement demandé (Réglages, pastille) : le main l'enregistre et le dit à toutes les fenêtres. */
export function requestPresentation(on: boolean): void {
  void window.api.app.setPresentation(on)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Le mode présentation est actif. */
export function usePresentation(): boolean {
  return useSyncExternalStore(subscribe, () => active)
}

/** Chemin tel qu'on l'affiche : `~` pour le dossier personnel en mode présentation. */
export function useDisplayPath(): (path: string) => string {
  return usePresentation() ? abbreviateHome : (path) => path
}

/** Texte libre (infobulle, commande) dont les chemins personnels sont abrégés en présentation. */
export function useDisplayText(): (text: string) => string {
  return usePresentation() ? abbreviateHomeIn : (text) => text
}
