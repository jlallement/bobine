import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Suivi du bas du fil : il défile tout seul tant que l'utilisateur est en bas, et la flèche « Aller
 * en bas » (fiche 050) se montre quand on l'a remonté. `scroller` va sur l'élément qui défile.
 * Pointeur sur une carte marquée `data-scroll-hold` (propositions de filles) : le fil attend
 * qu'il en sorte pour suivre, sans quoi la ligne visée remonte sous le pointeur (fiche 124), et sa
 * hauteur est gardée, sans quoi un bas qui rétrécit la fait descendre sous lui (fiche 250) ; ce qui
 * arrive en bas pendant ce temps montre la flèche, sans défiler.
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
  /**
   * Appui en cours dans le fil (fiche 250) : le suivi du bas attend le relâché. Sinon le fil, à
   * moins de 60 px du bas, était ramené tout en bas entre l'appui et le relâché (la hauteur gardée
   * à l'appui, ou un élément qui arrive, le redimensionne) : le relâché tombait sous la cible, et
   * le clic était perdu (relevé sous Linux : appui sur « Autoriser une fois », relâché sur la note
   * en dessous).
   */
  const pressing = useRef(false)
  /**
   * Position du pointeur au dernier envoi (fiche 272, recette) : le saut en bas fait passer une
   * autre carte sous un pointeur immobile, et Chromium le signale (`pointerover`) ; ce n'est pas un
   * geste de l'utilisateur, le fil ne s'arrête pas pour autant. Un vrai mouvement l'efface.
   */
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const sentAt = useRef<{ x: number; y: number } | null>(null)
  /**
   * Colonne dont la hauteur est gardée (fiche 250) : tant que le pointeur retient le fil
   * (`held`) ou qu'un appui y est en cours (`pressing`), la colonne garde en `min-height` la hauteur
   * de défilement du moment où cela a commencé. Sinon un bas du fil qui rétrécit (fin d'un tour) borne
   * le défilement à la nouvelle hauteur, et le contenu descend sous le pointeur : `data-scroll-hold`
   * arrête le suivi du bas, pas ce bornage du navigateur.
   */
  const kept = useRef<HTMLElement | null>(null)
  const keepHeight = useCallback(() => {
    const el = scroller.current
    const column = el?.firstElementChild
    if (kept.current || !el || !(column instanceof HTMLElement)) return
    // Haut de la colonne dans le contenu qui défile (`offsetTop` se compte depuis un autre parent).
    const top = column.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
    kept.current = column
    column.style.minHeight = `${el.scrollHeight - top}px`
  }, [])
  /** Rend sa vraie hauteur au fil quand plus rien ne la garde. */
  const freeHeight = useCallback(() => {
    if (held.current || pressing.current || !kept.current) return
    kept.current.style.minHeight = ''
    kept.current = null
  }, [])
  // Message à rendre et à montrer, pour cette conversation seulement.
  const [reveal, setReveal] = useState<{ id: number; in: string | null }>()
  const measureBottom = useCallback(() => {
    const el = scroller.current
    // Pendant un appui, le fil ne bouge pas, le suivi est relevé au relâché.
    if (pressing.current) return
    // Pointeur sur une carte qui retient le fil : le suivi reste tel quel (il rattrape le bas à la
    // sortie), mais la flèche dit ce qui est arrivé en bas hors de vue (recette rc.4, fiche 250) ;
    // sinon une demande d'autorisation de la mère reste cachée sans aucun signe. Rien ne défile : la
    // flèche est posée sur le fil, la carte visée ne bouge pas.
    if (held.current) {
      if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60)
      return
    }
    stickToBottom.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 60
    lastScrollTop.current = el?.scrollTop ?? 0
    setAtBottom(stickToBottom.current)
  }, [])
  // Défilement vers le haut que l'événement `scroll` n'a pas encore dit (il n'arrive qu'à l'image
  // suivante) : il décroche du bas avant tout rattrapage. Sans cela, un pointeur qui quitte une carte
  // `data-scroll-hold` pendant qu'on remonte (le contenu glisse sous lui), un élément qui arrive ou
  // un redimensionnement dans cet intervalle ramenaient le fil en bas (fiche 270).
  const noteScrolledUp = useCallback(() => {
    const el = scroller.current
    if (!el || el.scrollTop >= lastScrollTop.current - 1) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight >= 60) stickToBottom.current = false
  }, [])
  // Autre conversation : elle s'ouvre en bas de son fil.
  useLayoutEffect(() => {
    stickToBottom.current = true
  }, [conversation])
  useLayoutEffect(() => {
    const el = scroller.current
    noteScrolledUp()
    if (el && stickToBottom.current && !held.current && !pressing.current) {
      el.scrollTop = el.scrollHeight
    }
    measureBottom()
  }, [items, measureBottom, noteScrolledUp])
  // Écouteurs natifs sur le document (comme la liste figée de la fiche 095) : `pointerover` arrive
  // à chaque élément survolé ; `pointerout` sans destination : sortie de la fenêtre.
  useEffect(() => {
    const release = () => {
      if (!held.current) return
      held.current = false
      freeHeight()
      const el = scroller.current
      noteScrolledUp()
      if (el && stickToBottom.current && !pressing.current) el.scrollTop = el.scrollHeight
      measureBottom()
    }
    /** Position d'un évènement du pointeur ; `null` sans coordonnées. */
    const atOf = (event: PointerEvent) =>
      typeof event.clientX === 'number' ? { x: event.clientX, y: event.clientY } : null
    const same = (a: { x: number; y: number } | null, b: { x: number; y: number } | null) =>
      !!a && !!b && a.x === b.x && a.y === b.y
    // Position réelle du pointeur, au clic comme au mouvement (pas seulement à l'entrée d'une carte :
    // le clic d'envoi a lieu ailleurs dans la carte) ; un vrai mouvement efface celle de l'envoi.
    const track = (event: PointerEvent) => {
      const at = atOf(event)
      if (!at) return
      pointer.current = at
      if (sentAt.current && !same(at, sentAt.current)) sentAt.current = null
    }
    const over = (event: PointerEvent) => {
      const at = atOf(event)
      if (at) pointer.current = at
      // Pointeur immobile depuis l'envoi : la carte passée dessous par le saut en bas ne retient pas.
      if (same(at, sentAt.current)) return
      sentAt.current = null
      const target = event.target instanceof Element ? event.target : null
      const card = target?.closest('[data-scroll-hold]')
      if (card && scroller.current?.contains(card)) {
        held.current = true
        keepHeight()
      } else release()
    }
    const out = (event: PointerEvent) => {
      if (!event.relatedTarget) release()
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('pointerdown', track, true)
    document.addEventListener('pointermove', track, true)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('pointerdown', track, true)
      document.removeEventListener('pointermove', track, true)
    }
  }, [measureBottom, noteScrolledUp, keepHeight, freeHeight])
  // Appui dans le fil (fiche 250) : sa hauteur est gardée jusqu'au relâché. Sinon, un bas du fil
  // qui rétrécit entre les deux (fin d'un tour) ramène le fil, s'il était près du bas, sous le
  // pointeur (le navigateur borne le défilement à la nouvelle hauteur) : le relâché tombe ailleurs
  // que l'appui, et le clic est perdu. La hauteur réservée est celle du défilement au moment de
  // l'appui (marges du bas comprises) : rien ne bouge. Libérée après le `click`, qui suit
  // `pointerup` dans la même tâche ; le fil reprend alors sa vraie hauteur, et rattrape le bas s'il
  // le suivait (`pressing`). Pointeur déjà sur une carte qui retient le fil : la hauteur gardée
  // depuis qu'il y est arrivé reste la même (`keepHeight`).
  useEffect(() => {
    let unpress: ReturnType<typeof setTimeout> | undefined
    const free = () => {
      clearTimeout(unpress)
      if (!pressing.current) return
      pressing.current = false
      freeHeight()
      const el = scroller.current
      noteScrolledUp()
      if (el && stickToBottom.current && !held.current) el.scrollTop = el.scrollHeight
      measureBottom()
    }
    const keep = (event: PointerEvent) => {
      free()
      // Bouton principal seulement : un clic droit ouvre un menu, sans `click` à protéger.
      if (event.button !== 0) return
      const el = scroller.current
      const column = el?.firstElementChild
      if (!el || !(column instanceof HTMLElement)) return
      if (!(event.target instanceof Node) || !el.contains(event.target)) return
      pressing.current = true
      keepHeight()
    }
    const letGo = () => {
      clearTimeout(unpress)
      unpress = setTimeout(free)
    }
    document.addEventListener('pointerdown', keep, true)
    document.addEventListener('pointerup', letGo, true)
    document.addEventListener('pointercancel', letGo, true)
    window.addEventListener('blur', letGo)
    return () => {
      document.removeEventListener('pointerdown', keep, true)
      document.removeEventListener('pointerup', letGo, true)
      document.removeEventListener('pointercancel', letGo, true)
      window.removeEventListener('blur', letGo)
      free()
    }
  }, [measureBottom, noteScrolledUp, keepHeight, freeHeight])
  // Fil ou fenêtre qui changent de taille (image chargée, détail déplié, fenêtre redimensionnée) :
  // on reste en bas si on y était, et la flèche suit.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      noteScrolledUp()
      if (stickToBottom.current && !held.current && !pressing.current) {
        el.scrollTop = el.scrollHeight
      }
      measureBottom()
    })
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [empty, measureBottom, noteScrolledUp])
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
    // Envoyé d'un clic : le `click` est parti, l'appui ne retient plus le fil.
    pressing.current = false
    freeHeight()
    sentAt.current = pointer.current
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
