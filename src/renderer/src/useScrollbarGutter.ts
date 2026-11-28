import { useLayoutEffect } from 'react'

/**
 * Largeur de la barre de défilement du fil, posée sur son volet (`--thread-scrollbar`, fiche 294).
 *
 * Le fil défile dans `.scroll` ; la zone de saisie, les avis du profil et le reste centré sur la
 * colonne sont hors de cette zone. Avec des barres classiques (souris sous macOS, Windows, Linux),
 * la barre prend de la place : le fil se centre sur une largeur plus petite que la saisie, qui se
 * retrouve décalée de la moitié de la barre. Le CSS ne connaît pas la largeur de la barre d'un
 * autre élément : elle est mesurée ici (largeur de la zone moins sa largeur utile, bords nuls), et
 * les colonnes hors de la zone retranchent la même gouttière (`styles.css`). Avec des barres
 * superposées, elle vaut 0. `scrollbar-gutter: stable` la garde constante, que le fil défile ou non.
 */
export function useScrollbarGutter(scroller: { readonly current: HTMLElement | null }) {
  useLayoutEffect(() => {
    const el = scroller.current
    const pane = el?.parentElement
    if (!el || !pane) return
    const apply = () =>
      pane.style.setProperty('--thread-scrollbar', `${el.offsetWidth - el.clientWidth}px`)
    apply()
    // La largeur utile change avec la fenêtre, et avec le style des barres (réglage du système).
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply)
    resize?.observe(el)
    return () => {
      resize?.disconnect()
      pane.style.removeProperty('--thread-scrollbar')
    }
  }, [scroller])
}
