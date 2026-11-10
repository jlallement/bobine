import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Onglets du panneau (fiche 185, F1, D25, maquette 7) : un onglet montre son libellé entier ou son
 * icône seule, jamais un bout de mot ; l'onglet actif et son ✕ sont toujours entiers ; la rangée ne
 * déborde jamais (donc ne défile pas, aucune icône coupée au bord). Trois crans, dans l'ordre :
 *
 * 1. `compact` : les inactifs en icône (le nom dans l'infobulle) ;
 * 2. `tight` : l'actif aussi en icône (compte et ✕ gardés) ;
 * 3. rangement : les inactifs qui ne tiennent toujours pas, les plus à droite d'abord, passent dans
 *    le menu « + » (`data-overflow`) ; puis l'actif reprend son nom s'il tient.
 *
 * La mesure se fait dans le DOM, sans rendu : tout est remis à plat, puis les crans sont essayés
 * dans la même image (rien ne clignote). Rend les onglets rangés, pour le menu « + ».
 */
export function useCompactTabs(
  list: RefObject<HTMLElement | null>,
  key: string,
  active: string
): string[] {
  const [overflow, setOverflow] = useState<string[]>([])
  const overflowKey = overflow.join(',')
  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    const over = () => element.scrollWidth > element.clientWidth + 1
    const fit = () => {
      const tabs = [...element.querySelectorAll<HTMLElement>('.side-panel-tab')]
      element.classList.remove('compact', 'tight')
      for (const tab of tabs) tab.removeAttribute('data-overflow')
      const stored: string[] = []
      if (over()) element.classList.add('compact')
      if (over()) element.classList.add('tight')
      if (over()) {
        // Les inactifs les plus à droite partent d'abord ; l'actif ne part jamais.
        for (const tab of tabs.filter((t) => t.dataset.tab !== active).reverse()) {
          if (!over()) break
          tab.setAttribute('data-overflow', '')
          stored.push(tab.dataset.tab ?? '')
        }
        // Des onglets rangés : l'actif reprend son nom s'il tient.
        element.classList.remove('tight')
        if (over()) element.classList.add('tight')
      }
      element.scrollTo({ left: 0 })
      const next = stored.reverse()
      setOverflow((current) => (current.join(',') === next.join(',') ? current : next))
    }
    fit()
    // Seulement l'en-tête, et au rendu suivant : la classe change la taille de la rangée, pas celle
    // de l'en-tête, et rien n'est changé pendant la notification (pas de « ResizeObserver loop »).
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    })
    if (element.parentElement) observer.observe(element.parentElement)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // `overflowKey` : le « + » prend son compte, l'en-tête change, on remesure une fois.
  }, [list, key, active, overflowKey])
  return overflow
}
