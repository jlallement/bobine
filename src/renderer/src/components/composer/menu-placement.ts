import { useLayoutEffect, useState, type RefObject } from 'react'

/** Hauteur maximale d'un menu de saisie (commandes « / », fichiers « @ »). */
export const MENU_MAX_HEIGHT = 380
/** Écart entre le menu et la zone de saisie, et avec le bord de la zone disponible. */
export const MENU_GAP = 8
/** En dessous de cette hauteur, un menu n'est plus utilisable : on garde ce minimum même s'il déborde. */
const MENU_MIN_HEIGHT = 120

export interface MenuPlacement {
  side: 'above' | 'below'
  maxHeight: number
}

export const DEFAULT_PLACEMENT: MenuPlacement = { side: 'above', maxHeight: MENU_MAX_HEIGHT }

/**
 * Choisit de quel côté de la zone de saisie ouvrir le menu, et sa hauteur maximale, d'après la place
 * disponible entre `limits.top` (bas de l'en-tête) et `limits.bottom` (bas de la fenêtre).
 * Au-dessus tant que le menu y tient en entier ou que c'est le côté le plus grand ; sinon en dessous
 * (écran d'accueil, où la zone de saisie est centrée, ou petite fenêtre).
 */
export function placeMenu(
  dock: Pick<DOMRect, 'top' | 'bottom'>,
  limits: { top: number; bottom: number }
): MenuPlacement {
  const above = Math.floor(dock.top - limits.top - MENU_GAP * 2)
  const below = Math.floor(limits.bottom - dock.bottom - MENU_GAP * 2)
  const side = above >= MENU_MAX_HEIGHT || above >= below ? 'above' : 'below'
  const room = side === 'above' ? above : below
  return { side, maxHeight: Math.max(MENU_MIN_HEIGHT, Math.min(MENU_MAX_HEIGHT, room)) }
}

/** Bas de l'en-tête du volet qui contient la zone de saisie (le menu ne doit pas le recouvrir). */
function limitsAround(dock: HTMLElement): { top: number; bottom: number } {
  const header = dock.closest('main, aside, section')?.querySelector(':scope > header')
  return { top: header?.getBoundingClientRect().bottom ?? 0, bottom: window.innerHeight }
}

/**
 * Placement d'un menu rendu dans `.composer-dock` : recalculé à l'ouverture, quand la zone de
 * saisie change de taille (texte sur plusieurs lignes, pièces jointes) et quand la fenêtre est
 * redimensionnée.
 */
export function useMenuPlacement(menu: RefObject<HTMLElement | null>): MenuPlacement {
  const [placement, setPlacement] = useState(DEFAULT_PLACEMENT)
  useLayoutEffect(() => {
    const dock = menu.current?.parentElement
    if (!dock) return
    const update = () => setPlacement(placeMenu(dock.getBoundingClientRect(), limitsAround(dock)))
    update()
    window.addEventListener('resize', update)
    // jsdom n'a pas de ResizeObserver : le menu garde alors le placement calculé à l'ouverture.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    observer?.observe(dock)
    return () => {
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [menu])
  return placement
}
