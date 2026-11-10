import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Suivi du bas du fil : il défile tout seul tant que l'utilisateur est en bas, et la flèche « Aller
 * en bas » (fiche 050) se montre quand on l'a remonté. `scroller` va sur l'élément qui défile.
 * Pointeur sur une carte marquée `data-scroll-hold` (propositions de filles) : le fil attend
 * qu'il en sorte pour suivre, sans quoi la ligne visée remonte sous le pointeur (fiche 124).
 * Un message envoyé ramène toujours en bas (`followSent`, fiche 127) : sinon on croit qu'il n'est
 * pas parti. `reveal.go` : aller à un message pas encore rendu d'un long fil (sommaire, fiche 193) ; le
 * fil le rend (`reveal`) et l'amène à l'écran, le suivi du bas est lâché.
 */
export function useThreadScroll(options: {
  /** Change avec la conversation : elle s'ouvre en bas de son fil. */
  conversation: string | null
  /** Éléments du fil : quand ils changent, on reste en bas si on y était. */
  items: unknown
  /** Fil vide (accueil) : l'élément qui défile n'est pas affiché. */
  empty: boolean
}) {
  const { conversation, items, empty } = options
  const scroller = useRef<HTMLDivElement>(null)
  // Défile automatiquement tant que l'utilisateur est en bas du fil.
  const stickToBottom = useRef(true)
  // Flèche « Aller en bas » : relevée d'après la place réelle du fil, pas seulement au défilement :
  // un fil plus court que la page (autre conversation, fenêtre agrandie) n'en a pas.
  const [atBottom, setAtBottom] = useState(true)
  /** Dernière position connue du fil : dit dans quel sens on vient de défiler. */
  const lastScrollTop = useRef(0)
  // Pointeur sur une carte qui demande que le fil ne bouge pas sous lui.
  const held = useRef(false)
  // Message à rendre et à montrer, pour cette conversation seulement.
  const [reveal, setReveal] = useState<{ id: number; in: string | null }>()
  const measureBottom = useCallback(() => {
    const el = scroller.current
    // Pendant la pause, le fil est volontairement loin du bas : le suivi reste tel quel.
    if (held.current) return
    stickToBottom.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 60
    lastScrollTop.current = el?.scrollTop ?? 0
    setAtBottom(stickToBottom.current)
  }, [])
  // Autre conversation : elle s'ouvre en bas de son fil.
  useLayoutEffect(() => {
    stickToBottom.current = true
  }, [conversation])
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current && !held.current) el.scrollTop = el.scrollHeight
    measureBottom()
  }, [items, measureBottom])
  // Écouteurs natifs sur le document (comme la liste figée de la fiche 095) : `pointerover` arrive
  // à chaque élément survolé ; `pointerout` sans destination : sortie de la fenêtre.
  useEffect(() => {
    const release = () => {
      if (!held.current) return
      held.current = false
      const el = scroller.current
      if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
      measureBottom()
    }
    const over = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const card = target?.closest('[data-scroll-hold]')
      if (card && scroller.current?.contains(card)) held.current = true
      else release()
    }
    const out = (event: PointerEvent) => {
      if (!event.relatedTarget) release()
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
    }
  }, [measureBottom])
  // Fil ou fenêtre qui changent de taille (image chargée, détail déplié, fenêtre redimensionnée) :
  // on reste en bas si on y était, et la flèche suit.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current && !held.current) el.scrollTop = el.scrollHeight
      measureBottom()
    })
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [empty, measureBottom])
  // Seul un défilement vers le haut décroche du bas du fil. Chromium décale aussi le défilement
  // quand un contenu grandit au-dessus (image chargée : il garde la place de ce qu'on lit) ; ce
  // décalage, vers le bas, ne doit pas arrêter le suivi, sinon la fin de la réponse reste cachée.
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight
    if (gap < 60) stickToBottom.current = true
    else if (el.scrollTop < lastScrollTop.current - 1) stickToBottom.current = false
    lastScrollTop.current = el.scrollTop
    setAtBottom(stickToBottom.current)
  }
  const scrollToBottom = () => {
    const el = scroller.current
    if (!el) return
    stickToBottom.current = true
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
  // Message envoyé : en bas tout de suite (sans défilement doux), le suivi repris, même pointeur
  // sur une carte qui retient le fil ; la bulle et la réponse qui arrivent sont suivies.
  const followSent = () => {
    held.current = false
    stickToBottom.current = true
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
    measureBottom()
  }
  const revealItem = (id: number) => {
    stickToBottom.current = false
    setAtBottom(false)
    setReveal({ id, in: conversation })
  }
  return {
    scroller,
    atBottom,
    onScroll,
    scrollToBottom,
    followSent,
    reveal: { id: reveal?.in === conversation ? reveal.id : undefined, go: revealItem }
  }
}
