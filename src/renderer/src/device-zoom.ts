/**
 * Zoom d'un appareil dans son onglet (fiche 084) : « ajuster » (l'appareil en entier dans la place
 * disponible, par défaut), ou une échelle fixe — taille réelle (1 : un point de l'appareil, un dp
 * sur Android, pour un point de l'écran du Mac) ou un palier. Rien n'est retenu : l'onglet repart
 * sur « ajuster » à chaque ouverture.
 */
import { useLayoutEffect, useRef, useState } from 'react'

/** Paliers proposés par « zoomer » et « dézoomer ». */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3] as const

export type DeviceZoom = 'fit' | number

/** Écart sous lequel l'échelle affichée est considérée comme égale à un palier. */
const SAME = 0.005

/**
 * Palier suivant, plus grand (`1`) ou plus petit (`-1`) que l'échelle affichée ; `undefined` aux
 * bornes.
 */
export function nextZoom(scale: number, direction: 1 | -1): number | undefined {
  return direction > 0
    ? ZOOM_STEPS.find((step) => step > scale + SAME)
    : [...ZOOM_STEPS].reverse().find((step) => step < scale - SAME)
}

/** Échelle (points de l'écran du Mac par point de l'appareil) d'après le zoom. */
export const zoomScale = (zoom: DeviceZoom, fit: number): number => (zoom === 'fit' ? fit : zoom)

/**
 * Zoom d'un onglet : « ajuster » au départ ; `scale` est celle à dessiner, `stage` la scène qui
 * défile (à poser sur elle). Changer de zoom garde au centre ce qu'on regardait : en zoomant depuis
 * « ajuster », le milieu de l'écran, pas son coin en haut à gauche.
 */
export function useDeviceZoom(fit: number) {
  const stage = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<DeviceZoom>('fit')
  const scale = zoomScale(zoom, fit)
  /** Centre de la vue avant le changement, en fraction de la scène. */
  const center = useRef<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const el = stage.current
    const at = center.current
    if (!el || !at) return
    center.current = null
    el.scrollLeft = at.x * el.scrollWidth - el.clientWidth / 2
    el.scrollTop = at.y * el.scrollHeight - el.clientHeight / 2
  }, [scale])
  const choose = (next: DeviceZoom) => {
    const el = stage.current
    if (el) {
      center.current = {
        x: (el.scrollLeft + el.clientWidth / 2) / Math.max(el.scrollWidth, 1),
        y: (el.scrollTop + el.clientHeight / 2) / Math.max(el.scrollHeight, 1)
      }
    }
    setZoom(next)
  }
  return { zoom, scale, setZoom: choose, stage }
}
