/**
 * Où et comment la page du navigateur intégré s'affiche (fiche 129) : bornes de la vue native,
 * zoom de la page, taille d'écran imposée par l'agent, raccourcis de la page. Fonctions pures,
 * testées sans Electron ; `browser-manager.ts` les applique.
 *
 * Trois unités : le renderer mesure la zone en pixels CSS de l'interface ; la vue native se pose
 * en pixels de la fenêtre (DIP), soit CSS × zoom de l'interface ; l'agent parle en pixels CSS de
 * la page (captures, clics), soit DIP ÷ zoom de la page, ou la taille émulée.
 */
import type { BrowserBounds, BrowserEmulation, BrowserZoom } from '@shared/browser'

/** Paliers de zoom de Chrome, de 25 % à 500 %. */
export const ZOOM_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5
] as const
const MIN_ZOOM = 0.25
const MAX_ZOOM = 5

export type ZoomAction = BrowserZoom

/** Palier suivant (ou précédent) ; un zoom hors palier rejoint le plus proche dans ce sens. */
export function nextZoom(current: number, action: ZoomAction): number {
  if (action === 'reset') return 1
  const epsilon = 0.001
  if (action === 'in') return ZOOM_STEPS.find((step) => step > current + epsilon) ?? MAX_ZOOM
  return [...ZOOM_STEPS].reverse().find((step) => step < current - epsilon) ?? MIN_ZOOM
}

/** Zone mesurée par le renderer (CSS de l'interface) → bornes de la vue native (DIP), arrondies. */
export function windowBounds(css: BrowserBounds, uiZoom: number): BrowserBounds {
  const zoom = uiZoom > 0 ? uiZoom : 1
  const x = Math.round(css.x * zoom)
  const y = Math.round(css.y * zoom)
  // Bords arrondis, pas la taille : la vue colle à la zone sans trou d'un pixel.
  return {
    x,
    y,
    width: Math.max(1, Math.round((css.x + css.width) * zoom) - x),
    height: Math.max(1, Math.round((css.y + css.height) * zoom) - y)
  }
}

/** Taille d'écran demandée par l'agent (`browser_resize`). */
export interface EmulatedSize {
  width: number
  height: number
  mobile: boolean
}

/**
 * Taille imposée dans la zone : réduite pour tenir entière (`scale` ≤ 1), la vue native ramenée à
 * l'écran réduit, centrée en haut de la zone.
 */
export function emulationFrame(
  area: BrowserBounds,
  size: EmulatedSize
): { emulation: BrowserEmulation; bounds: BrowserBounds } {
  const scale = Math.min(1, area.width / size.width, area.height / size.height)
  const width = Math.max(1, Math.round(size.width * scale))
  const height = Math.max(1, Math.round(size.height * scale))
  return {
    emulation: { ...size, scale },
    bounds: {
      x: area.x + Math.floor((area.width - width) / 2),
      y: area.y,
      width,
      height
    }
  }
}

/** Fenêtre de la page en pixels CSS : la taille émulée, sinon la vue divisée par le zoom. */
export function cssViewport(
  view: { width: number; height: number },
  zoom: number,
  emulation?: { width: number; height: number }
): { width: number; height: number } {
  if (emulation) return { width: emulation.width, height: emulation.height }
  const factor = zoom > 0 ? zoom : 1
  return {
    width: Math.max(1, Math.floor(view.width / factor)),
    height: Math.max(1, Math.floor(view.height / factor))
  }
}

/** Ce qu'un raccourci tapé dans la page demande. */
export type PageShortcut =
  | { kind: 'zoom'; action: ZoomAction }
  | { kind: 'focus-address' }
  | { kind: 'reload' }
  | { kind: 'back' }
  | { kind: 'forward' }

/** Touche telle qu'Electron la passe à `before-input-event`. */
export interface PageKey {
  type: string
  key: string
  code?: string
  meta: boolean
  control: boolean
  alt: boolean
  shift: boolean
}

/**
 * Raccourcis de navigateur quand la page a le focus (⌘ sur macOS, Ctrl ailleurs) : zoom, adresse,
 * recharger, précédent, suivant. Le reste va à la page.
 */
export function pageShortcut(input: PageKey, platform: string): PageShortcut | undefined {
  if (input.type !== 'keyDown' || input.alt) return undefined
  const command =
    platform === 'darwin' ? input.meta && !input.control : input.control && !input.meta
  if (!command) return undefined
  const key = input.key.toLowerCase()
  // ⌘+ s'écrit ⌘= ou ⌘⇧= sur un clavier américain, ⌘+ sur le pavé numérique.
  if (key === '=' || key === '+' || input.code === 'NumpadAdd')
    return { kind: 'zoom', action: 'in' }
  if (key === '-' || key === '_' || input.code === 'NumpadSubtract') {
    return { kind: 'zoom', action: 'out' }
  }
  // Clavier français : le 0 se tape avec Maj, la touche physique reste `Digit0`.
  if (key === '0' || input.code === 'Digit0' || input.code === 'Numpad0') {
    return { kind: 'zoom', action: 'reset' }
  }
  if (input.shift) return undefined
  if (key === 'l') return { kind: 'focus-address' }
  if (key === 'r') return { kind: 'reload' }
  if (key === '[') return { kind: 'back' }
  if (key === ']') return { kind: 'forward' }
  return undefined
}
