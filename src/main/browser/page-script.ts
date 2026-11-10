/**
 * Script exécuté dans la page du navigateur intégré (fiche 007), dans un **monde isolé** : il
 * partage le DOM de la page mais pas son JavaScript. La lecture structurée de la page passe par
 * l'arbre d'accessibilité de Chromium (`ax-tree.ts`) ; ici, seulement le texte brut.
 */

/** Monde isolé réservé à l'app (un nombre arbitraire). */
export const ISOLATED_WORLD = 1013

/** Texte visible de la page, contenu principal d'abord, tronqué à `maxChars`. */
export function pageTextScript(maxChars: number): string {
  return `(() => {
  const root = document.querySelector('main, article') || document.body
  const text = ((root && root.innerText) || '').replace(/\\n{3,}/g, '\\n\\n').trim()
  return text.length > ${maxChars} ? text.slice(0, ${maxChars}) + '\\n[… texte tronqué]' : text
})()`
}

/**
 * Élément sous un clic du mode Annoter (fiches 132 et 146), appelé par le script de la page
 * (`page-layer.ts`) sur la cible du clic (`this`) : balise, sélecteur court (trois niveaux au plus,
 * arrêté à un `id`), texte visible. D'un champ de saisie, seulement son libellé : sa valeur n'est
 * jamais lue. Le résultat est du contenu de la page, cité comme tel dans le message.
 */
export const ELEMENT_AT = `function () {
  const el = this.nodeType === 1 ? this : this.parentElement
  if (!el) return null
  const part = (e) => {
    const tag = e.tagName.toLowerCase()
    if (e.id) return tag + '#' + CSS.escape(e.id)
    const classes = [...e.classList].slice(0, 2).map((c) => '.' + CSS.escape(c)).join('')
    const parent = e.parentElement
    const same = parent ? [...parent.children].filter((c) => c.tagName === e.tagName) : []
    return tag + classes + (same.length > 1 ? ':nth-of-type(' + (same.indexOf(e) + 1) + ')' : '')
  }
  const parts = []
  for (let e = el; e && e.nodeType === 1 && parts.length < 3; e = e.parentElement) {
    parts.unshift(part(e))
    if (e.id || e === document.body || e === document.documentElement) break
  }
  const field = el.matches('input, textarea, select') || el.isContentEditable
  const label = field ? el.getAttribute('aria-label') || el.getAttribute('placeholder') || '' : ''
  return {
    tag: el.tagName.toLowerCase(),
    selector: parts.join(' > '),
    text: field ? '' : String(el.innerText || el.textContent || '').slice(0, 400),
    field,
    label: String(label).slice(0, 200)
  }
}`
