import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Place disponible pour le cadre d'un appareil (fiches 044, 081) : la boîte de contenu de la zone
 * de l'écran (sans ses marges intérieures), moins la barre de commandes posée dessous (`below`) et
 * l'écart qui l'en sépare ; suivie quand le panneau change de taille. `active` : la zone est
 * affichée (appareil démarré).
 */
export function useDeviceRoom(
  area: RefObject<HTMLElement | null>,
  active: boolean,
  below?: RefObject<HTMLElement | null>
) {
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const update = () => {
      const style = getComputedStyle(el)
      const px = (value: string) => parseFloat(value) || 0
      const bar = below?.current
      const reserved = bar && bar.offsetHeight > 0 ? bar.offsetHeight + px(style.rowGap) : 0
      setRoom({
        width: el.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
        height: el.clientHeight - px(style.paddingTop) - px(style.paddingBottom) - reserved
      })
    }
    update()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    observer?.observe(el)
    if (below?.current) observer?.observe(below.current)
    return () => observer?.disconnect()
  }, [area, active, below])
  return room
}
