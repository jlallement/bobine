/**
 * Lignes affichées d'une zone de saisie (fiche 227) : une ligne repliée compte pour plusieurs.
 * Le `textarea` ne dit pas où est son curseur : un miroir invisible, aux mêmes styles et à la même
 * largeur, place le texte jusqu'à une position, puis un repère suivi du reste du texte (pour que
 * le repli des mots soit le même). La hauteur du repère dit la ligne.
 *
 * La mesure (`CaretTop`) est injectable : les essais simulent les replis sans mise en page.
 */

/** Hauteur (en px) de la ligne affichée où tombe une position du texte. */
export type CaretTop = (position: number) => number

/** Le curseur est sur la première ligne affichée. */
export const onFirstLine = (caret: number, topOf: CaretTop): boolean => topOf(caret) <= topOf(0)

/** Le curseur est sur la dernière ligne affichée. */
export const onLastLine = (caret: number, length: number, topOf: CaretTop): boolean =>
  topOf(caret) >= topOf(length)

/**
 * Fin de la première ligne affichée : la plus grande position encore sur la ligne de la position
 * 0 (avant le retour à la ligne, ou avant l'espace où le texte se replie). Message d'une ligne :
 * la fin du texte.
 */
export function endOfFirstLine(length: number, topOf: CaretTop): number {
  const first = topOf(0)
  if (topOf(length) <= first) return length
  // La hauteur croît avec la position : recherche dichotomique de la dernière sur la ligne 1.
  let low = 0
  let high = length
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (topOf(middle) <= first) low = middle
    else high = middle
  }
  return low
}

/** Styles qui font le repli du texte, recopiés du `textarea` sur son miroir. */
const COPIED = [
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'textIndent',
  'tabSize',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'wordBreak',
  'overflowWrap'
] as const

/**
 * Mesure des lignes de `text` tel que l'afficherait `el` (sa largeur, ses styles). `dispose`
 * retire le miroir ; à appeler une fois les mesures faites.
 */
export function textareaCaretTops(
  el: HTMLTextAreaElement,
  text: string
): { topOf: CaretTop; dispose: () => void } {
  const style = getComputedStyle(el)
  const mirror = document.createElement('div')
  for (const name of COPIED) mirror.style[name] = style[name]
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    top: '0',
    left: '-10000px',
    boxSizing: 'border-box',
    // Largeur utile du champ (sans bordure ni barre de défilement), marges internes comprises.
    width: `${el.clientWidth}px`,
    border: '0',
    whiteSpace: 'pre-wrap',
    overflowWrap: style.overflowWrap || 'break-word'
  })
  const before = document.createTextNode('')
  const marker = document.createElement('span')
  mirror.append(before, marker)
  document.body.append(mirror)
  return {
    topOf: (position) => {
      before.data = text.slice(0, position)
      // Le reste du texte suit le repère : un mot coupé par la position se replie comme en vrai.
      marker.textContent = text.slice(position) || '.'
      return marker.offsetTop
    },
    dispose: () => mirror.remove()
  }
}
