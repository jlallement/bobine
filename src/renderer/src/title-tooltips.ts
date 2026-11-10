/**
 * Infobulles des attributs `title` (fiche 126). L'infobulle native de macOS reste affichée tant que
 * la souris ne bouge pas, même quand l'élément survolé a défilé ou disparu (changement d'onglet,
 * fil qui défile à la molette). Ici, l'attribut est mis de côté pendant le survol et une infobulle
 * de l'app (même style que celles de Radix) le remplace : elle se ferme au défilement, au clic, à
 * une touche, et quand l'élément quitte la page. Le `title` revient quand le pointeur s'en va, ou
 * au clic (macOS ne remontre pas d'infobulle native sous un pointeur qui vient de cliquer).
 */

/** Délai avant l'affichage, comme les infobulles Radix (`Tip`). */
const DELAY_MS = 400
/** Écart entre l'élément et l'infobulle, et marge avec les bords de la fenêtre. */
const GAP = 6
const MARGIN = 8
const HIDE_ON = ['scroll', 'wheel', 'keydown'] as const

interface Anchor {
  element: Element
  text: string
  /** Nom accessible prêté le temps du survol (bouton à icône sans `aria-label`). */
  label: boolean
}

export function installTitleTooltips(doc: Document = document): () => void {
  const view = doc.defaultView ?? window
  let anchor: Anchor | undefined
  let bubble: HTMLDivElement | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  /** Élément cliqué : plus d'infobulle tant que le pointeur ne l'a pas quitté. */
  let pressed: Element | undefined

  const hide = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    bubble?.remove()
    bubble = undefined
  }

  /** Rend son `title` à l'élément quitté. */
  const release = () => {
    hide()
    if (!anchor) return
    const { element, text, label } = anchor
    anchor = undefined
    if (!element.hasAttribute('title')) element.setAttribute('title', text)
    if (label) element.removeAttribute('aria-label')
  }

  const show = () => {
    timer = undefined
    if (!anchor || !anchor.element.isConnected) return release()
    bubble = doc.createElement('div')
    bubble.className = 'tooltip title-tooltip'
    bubble.setAttribute('role', 'tooltip')
    bubble.dataset['testid'] = 'title-tooltip'
    bubble.textContent = anchor.text
    bubble.style.position = 'fixed'
    bubble.style.top = '0'
    bubble.style.left = '0'
    doc.body.append(bubble)
    place(anchor.element, bubble, view)
  }

  /** Met le `title` de côté (plus d'infobulle native) et programme la nôtre. */
  const take = (element: Element) => {
    const text = element.getAttribute('title') ?? ''
    element.removeAttribute('title')
    const label =
      !element.hasAttribute('aria-label') &&
      !element.hasAttribute('aria-labelledby') &&
      !element.textContent?.trim()
    if (label) element.setAttribute('aria-label', text)
    anchor = { element, text, label }
    if (text.trim()) timer = setTimeout(show, DELAY_MS)
  }

  const over = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null
    const element = target?.closest('[title]')
    if (!element || element === anchor?.element || element === pressed) return
    // Autre élément, ou enfant qui a son propre `title` : c'est le sien qui compte.
    release()
    take(element)
  }

  const out = (event: Event) => {
    const next = (event as PointerEvent).relatedTarget
    const inside = (element: Element) => next instanceof Node && element.contains(next)
    if (pressed && !inside(pressed)) pressed = undefined
    if (anchor && !inside(anchor.element)) release()
  }

  const press = () => {
    pressed = anchor?.element
    release()
  }

  // L'élément change ou disparaît pendant le survol : infobulle fermée, nouveau `title` repris.
  const observer = new view.MutationObserver(() => {
    if (!anchor) return
    if (!anchor.element.isConnected) return release()
    const renewed = anchor.element.getAttribute('title')
    if (renewed !== null) {
      anchor.element.removeAttribute('title')
      anchor.text = renewed
      if (anchor.label) anchor.element.setAttribute('aria-label', renewed)
      if (bubble) bubble.textContent = renewed
    }
  })
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['title']
  })

  const options = { capture: true, passive: true } as const
  doc.addEventListener('pointerover', over, options)
  doc.addEventListener('pointerout', out, options)
  doc.addEventListener('pointerdown', press, options)
  // Fermée sans rendre le `title` : le pointeur est toujours là, l'infobulle native reviendrait.
  for (const type of HIDE_ON) doc.addEventListener(type, hide, options)
  view.addEventListener('blur', release)
  return () => {
    release()
    observer.disconnect()
    doc.removeEventListener('pointerover', over, options)
    doc.removeEventListener('pointerout', out, options)
    doc.removeEventListener('pointerdown', press, options)
    for (const type of HIDE_ON) doc.removeEventListener(type, hide, options)
    view.removeEventListener('blur', release)
  }
}

/** Sous l'élément, centrée ; au-dessus s'il n'y a pas la place ; jamais hors de la fenêtre. */
function place(element: Element, bubble: HTMLElement, view: Window): void {
  const target = element.getBoundingClientRect()
  const size = bubble.getBoundingClientRect()
  const below = target.bottom + GAP
  const top =
    below + size.height + MARGIN <= view.innerHeight
      ? below
      : Math.max(MARGIN, target.top - GAP - size.height)
  const centered = target.left + target.width / 2 - size.width / 2
  const left = Math.min(Math.max(MARGIN, centered), view.innerWidth - size.width - MARGIN)
  bubble.style.top = `${Math.round(top)}px`
  bubble.style.left = `${Math.round(Math.max(MARGIN, left))}px`
}
