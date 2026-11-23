/**
 * Focus jamais perdu sur la page (seconde chasse rc.4) : quand l'élément qui avait le focus
 * disparaît (carte d'autorisation tranchée, bandeau fermé, formulaire refermé, Réglages fermés par
 * Échap ou ✕ dont le bouton d'ouverture est parti), se désactive (« Vérifier maintenant » pendant
 * « Vérification… ») ou se masque, Chromium le pose sur `<body>` sans rien dire : le clavier ne
 * mène plus nulle part. Un seul mécanisme, pour toute la fenêtre, plutôt qu'une rustine par bouton :
 *
 * - une fenêtre modale reste ouverte : l'élément suivant dans cette fenêtre (l'élément désactivé
 *   y est encore), sinon son premier élément ;
 * - sinon, la zone de saisie (`[data-testid=composer-input]`), l'endroit où l'on reprend.
 *
 * Seulement quand le focus est tombé sur la page **à cause** de cet élément : un clic dans le vide
 * (le fil, une marge) laisse le focus où l'utilisateur l'a mis, et le premier qui pose le focus
 * ailleurs (une fenêtre qui s'ouvre, Radix qui le rend au bouton d'ouverture) a toujours raison :
 * la vérification passe après eux (`DELAY_MS`).
 */

/** Après Radix (qui rend le focus dans un `setTimeout(0)`) et les effets de React. */
const DELAY_MS = 60

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type=hidden])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

const COMPOSER = '[data-testid=composer-input]'
const OPEN_DIALOG = '[role=dialog][data-state=open], [role=alertdialog][data-state=open]'

/** Visible et utilisable (`checkVisibility` absent, comme sous jsdom : supposé visible). */
function usable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.isConnected) return false
  if (el.matches(':disabled') || el.closest('[inert]')) return false
  const check = (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility
  return check ? check.call(el) : true
}

/** Où va le focus quand `lost` ne peut plus le tenir ; `null` : nulle part de sensé. */
export function focusFallback(lost: Element, doc: Document = document): HTMLElement | null {
  const dialogs = [...doc.querySelectorAll(OPEN_DIALOG)]
  const dialog = dialogs.at(-1)
  if (dialog) {
    const inside = [...dialog.querySelectorAll(FOCUSABLE)].filter(usable)
    // L'élément désactivé est encore là : le suivant dans la fenêtre, comme Tab l'aurait fait.
    const next =
      lost.isConnected && dialog.contains(lost)
        ? inside.find((el) => lost.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
        : undefined
    return next ?? inside[0] ?? null
  }
  const composer = doc.querySelector(COMPOSER)
  return composer && usable(composer) ? composer : null
}

export function installFocusKeeper(doc: Document = document): () => void {
  const view = doc.defaultView ?? window
  /** Dernier élément qui a eu le focus. */
  let last: Element | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const check = () => {
    timer = undefined
    const active = doc.activeElement
    const onPage = !active || active === doc.body || active === doc.documentElement
    // Encore sur un élément qui le tient : rien à faire.
    if (!onPage && usable(active)) return
    // Focus resté sur un élément désactivé ou masqué (selon la version de Chromium), ou tombé
    // sur la page après le dernier élément qui l'a eu.
    const lost = onPage ? last : active
    if (!lost) return
    last = null
    // Toujours là et utilisable : l'utilisateur a mis le focus ailleurs (clic dans le vide).
    // On l'oublie, pour ne pas le « rendre » quand il partira plus tard.
    if (usable(lost)) return
    focusFallback(lost, doc)?.focus({ preventScroll: true })
  }
  const schedule = () => {
    if (timer === undefined) timer = setTimeout(check, DELAY_MS)
  }
  const onFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Element && event.target !== doc.body) last = event.target
  }
  // Perdu sans destination : départ de l'élément, ou clic dans le vide (tranché par `check`).
  const onFocusOut = (event: FocusEvent) => {
    if (!event.relatedTarget) schedule()
  }
  // Chromium ne dit rien quand l'élément qui a le focus disparaît ou se désactive : la page qui
  // change le révèle.
  const observer = new view.MutationObserver(() => {
    const active = doc.activeElement
    const onPage = !active || active === doc.body || active === doc.documentElement
    // Sans `checkVisibility` ici (calcul des styles à chaque mutation, fil qui s'écrit) : le
    // départ et la désactivation suffisent à demander la vérification, qui le fait une fois.
    if (onPage ? !!last : !active.isConnected || active.matches(':disabled')) schedule()
  })
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'hidden', 'inert']
  })
  doc.addEventListener('focusin', onFocusIn)
  doc.addEventListener('focusout', onFocusOut)
  return () => {
    observer.disconnect()
    doc.removeEventListener('focusin', onFocusIn)
    doc.removeEventListener('focusout', onFocusOut)
    if (timer !== undefined) clearTimeout(timer)
  }
}
