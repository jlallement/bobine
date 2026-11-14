import { useCallback, useLayoutEffect, useRef } from 'react'

/** Hauteur de la zone : celle de son contenu (texte ou invite), dans la limite du CSS. */
function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/**
 * Zone de saisie qui grandit avec le texte (jusqu'au maximum du CSS), et curseur posé à l'endroit
 * voulu une fois le nouveau texte affiché (sorti de `Composer`, fiche 089). Rend la référence de la
 * zone et de quoi demander une position de curseur pour le prochain texte.
 *
 * La hauteur suit aussi la largeur (fiche 167) : une conversation qui rétrécit replie le texte, ou
 * l'invite, sur une ligne de plus, qui serait sinon coupée à mi-hauteur.
 */
export function useTextareaLayout(text: string) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const pendingCaret = useRef<number | null>(null)
  // Message repris de l'historique (fiche 225) : le champ remonte en haut (↑) ou descend (↓).
  const pendingScroll = useRef<'top' | 'bottom' | null>(null)
  useLayoutEffect(() => {
    const el = textarea.current
    if (!el) return
    fitHeight(el)
    if (pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current)
      pendingCaret.current = null
    }
    if (pendingScroll.current) {
      el.scrollTop = pendingScroll.current === 'top' ? 0 : el.scrollHeight
      pendingScroll.current = null
    }
  }, [text])
  useLayoutEffect(() => {
    const el = textarea.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // Seule la largeur compte : la hauteur, c'est ce calcul qui la change.
    let width = el.clientWidth
    const resize = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      fitHeight(el)
    })
    resize.observe(el)
    return () => resize.disconnect()
  }, [])
  const placeCaret = useCallback((caret: number, scroll?: 'top' | 'bottom') => {
    pendingCaret.current = caret
    pendingScroll.current = scroll ?? null
  }, [])
  return { textarea, placeCaret }
}
