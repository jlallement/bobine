/**
 * Caractères invisibles ou trompeurs d'une commande à autoriser (0.11, M1, trois relectures) :
 * rendus visibles (␍, ⟨U+202E⟩…) pour qu'on lise ce qui sera lancé, sans faux positifs qui
 * apprendraient à ignorer l'alerte.
 *
 * Candidats, par classes Unicode : tout contrôle (Cc), format (Cf : bidi, zéro-largeur,
 * étiquettes…), séparateur (Zl, Zp), espace (Zs) sauf l'espace ordinaire, marque combinante (Mn,
 * Me), sélecteur de variante, toute la plage des étiquettes (U+E0000 n'est pas attribué), plus des
 * caractères qui se dessinent comme du blanc (remplissages hangul, braille vide, U+1D159).
 * Exceptions : tabulation, fin de ligne, `\r` d'un `\r\n`.
 *
 * Pas marqués (texte ordinaire) :
 * - une marque combinante qui suit une lettre, deux au plus à la suite (français tapé sur macOS,
 *   en NFD : « Re + ◌\u0301 » ; devanagari), sauf les marques de recouvrement (U+0334–0338, U+20D2) ;
 * - U+FE0F après un pictogramme, U+200D entre deux pictogrammes (cœur rouge, famille en emoji) ;
 * Marqués discrètement, sans l'alerte : une espace insécable (U+00A0, U+202F) entre guillemets
 * (« Correction : ok » dans un message de commit) ; hors guillemets, ou guillemets non fermés,
 * elle fait partie du mot pour le shell : alerte.
 */

/** Un morceau de texte affiché : tel quel, ou un caractère rendu visible (`loud`) ou signalé
 * discrètement (`quiet`, le caractère gardé). */
export interface VisiblePart {
  text: string
  invisible?: 'loud' | 'quiet'
}

/** Un caractère repéré : sa place dans le texte et comment le montrer. */
interface Mark {
  start: number
  end: number
  kind: 'loud' | 'quiet'
}

const CANDIDATE =
  /(?!\r\n)(?![\t\n ])[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Zs}\p{Mn}\p{Me}\p{Variation_Selector}\u{e0000}-\u{e007f}\u115f\u1160\u3164\uffa0\u2800\u{1d159}]/gu
const COMBINING = /^[\p{Mn}\p{Me}]$/u
/** Marques de recouvrement (barrent ou couvrent la lettre) : toujours montrées. */
const OVERLAY = /^[\u0334-\u0338\u20d2]$/u
/** Marques invisibles par nature, même après une lettre. */
const ALWAYS = /^[\u034f\p{Variation_Selector}]$/u
const LETTER = /^\p{L}$/u
const PICTOGRAPH = /^\p{Extended_Pictographic}$/u
/** Modificateurs de teinte des emoji : entre un pictogramme et un U+200D. */
const SKIN_TONE = /^[\u{1f3fb}-\u{1f3ff}]$/u
const NO_BREAK = /^[\u00a0\u202f]$/u
/** Pile de marques au-delà de laquelle (zalgo) chacune est montrée. */
const MAX_MARKS = 2

/** Caractère (point de code entier) qui finit juste avant `index`. */
function before(text: string, index: number): string {
  if (index <= 0) return ''
  const low = text.charCodeAt(index - 1)
  const pair = low >= 0xdc00 && low <= 0xdfff && index >= 2
  return text.slice(pair ? index - 2 : index - 1, index)
}

/** Caractère (point de code entier) qui commence en `index`. */
function at(text: string, index: number): string {
  const code = text.codePointAt(index)
  return code === undefined ? '' : String.fromCodePoint(code)
}

/**
 * Écritures dont les marques combinantes font partie de l'écriture ordinaire (liste fermée) : une
 * marque de la même écriture que sa lettre y est du texte. Hors de cette liste, ou marque
 * « héritée » (commune à toutes les écritures), seule une composition NFC réelle l'excuse.
 */
const MARK_SCRIPTS = [
  'Devanagari',
  'Bengali',
  'Gurmukhi',
  'Gujarati',
  'Oriya',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Sinhala',
  'Thai',
  'Lao',
  'Tibetan',
  'Myanmar',
  'Khmer',
  'Arabic',
  'Hebrew'
].map((script) => new RegExp(`^\\p{Script=${script}}$`, 'u'))

/**
 * Marques invisibles ou trompeuses même dans leur écriture : voyelles inhérentes khmères
 * (U+17B4, U+17B5), sélecteurs mongols (U+180B–180F).
 */
const DECEPTIVE_MARK = /^[\u17b4\u17b5\u180b-\u180f]$/u

/**
 * Marque combinante ordinaire, dans une pile de deux au plus après une lettre (troisième et
 * dernière relecture de M1 : dans le doute, on alerte) : la suite se compose réellement en NFC
 * (« e » + ◌\u0301 → « é », français tapé sur macOS), ou la marque est de la même écriture que sa
 * lettre, dans une écriture à marques (devanagari…), et n'est pas trompeuse. Une marque « héritée »
 * qui ne se compose pas (U+0332 souligné, U+20DD cercle…) ou d'une autre écriture (U+17B4 après
 * un « a ») est montrée.
 */
function ordinaryMark(text: string, index: number, char: string): boolean {
  if (!COMBINING.test(char) || OVERLAY.test(char) || ALWAYS.test(char)) return false
  let start = index
  for (let prev = before(text, start); COMBINING.test(prev); prev = before(text, start)) {
    start -= prev.length
  }
  let end = index + char.length
  for (let next = at(text, end); COMBINING.test(next); next = at(text, end)) end += next.length
  const base = before(text, start)
  const marks = text.slice(start, end)
  if (!LETTER.test(base) || [...marks].length > MAX_MARKS) return false
  // Composition réelle : plus aucune marque une fois en NFC.
  if (!/[\p{Mn}\p{Me}]/u.test((base + marks).normalize('NFC'))) return true
  if (DECEPTIVE_MARK.test(char)) return false
  return MARK_SCRIPTS.some((script) => script.test(base) && script.test(char))
}

/** Sélecteur d'emoji ou liant d'une séquence d'emoji. */
function emojiJoiner(text: string, index: number, char: string): boolean {
  if (char === '\ufe0f') return PICTOGRAPH.test(before(text, index))
  if (char !== '\u200d') return false
  let back = index
  let prev = before(text, back)
  while (prev === '\ufe0f' || SKIN_TONE.test(prev)) {
    back -= prev.length
    prev = before(text, back)
  }
  return PICTOGRAPH.test(prev) && PICTOGRAPH.test(at(text, index + 1))
}

/**
 * Ce qu'un découpage simple lit mal (comme `commandParts`) : heredoc, chaîne ici, substitution de
 * commande ou de processus, guillemets ANSI-C. Là, rien n'est sûrement entre guillemets.
 */
export const QUOTE_DOUBT = /<<|`|\$\(|[<>]\(|\$'/

/**
 * Places entre guillemets (simples ou doubles, règles du shell : rien ne s'échappe entre
 * simples ; un `#` en début de mot ouvre un commentaire jusqu'à la fin de la ligne) ; aucune au
 * moindre doute (`QUOTE_DOUBT`, guillemets restés ouverts) : tout est alors hors guillemets.
 */
function quotedPlaces(text: string): Uint8Array | undefined {
  if (QUOTE_DOUBT.test(text)) return undefined
  const inside = new Uint8Array(text.length)
  let quote: "'" | '"' | null = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote) quote = null
      else {
        inside[i] = 1
        if (quote === '"' && c === '\\') inside[++i] = 1
      }
    } else if (c === '\\') i++
    else if (c === "'" || c === '"') quote = c
    else if (c === '#' && /^$|[\s;&|()]/.test(text[i - 1] ?? '')) {
      // Commentaire : ses guillemets n'en ouvrent pas, la ligne suivante repart hors guillemets.
      const newline = text.indexOf('\n', i)
      i = newline === -1 ? text.length : newline
    }
  }
  return quote ? undefined : inside
}

/** Les caractères à montrer d'un texte. */
function marksOf(text: string): Mark[] {
  const marks: Mark[] = []
  let quoted: Uint8Array | undefined | null = null
  for (const match of text.matchAll(CANDIDATE)) {
    const index = match.index
    const char = match[0]
    if (ordinaryMark(text, index, char) || emojiJoiner(text, index, char)) continue
    let kind: Mark['kind'] = 'loud'
    if (NO_BREAK.test(char)) {
      if (quoted === null) quoted = quotedPlaces(text)
      if (quoted?.[index]) kind = 'quiet'
    }
    marks.push({ start: index, end: index + char.length, kind })
  }
  return marks
}

/** Symbole visible d'un caractère : image de contrôle (␍, ␛…), sinon ⟨U+202E⟩. */
function symbolOf(char: string): string {
  const code = char.codePointAt(0) ?? 0
  if (code < 0x20) return String.fromCharCode(0x2400 + code)
  if (code === 0x7f) return '␡'
  return `⟨U+${code.toString(16).toUpperCase().padStart(4, '0')}⟩`
}

/**
 * Le texte en morceaux, de `from` à `to` (une ligne de la commande), d'après les marques de la
 * commande entière (le contexte compte : lettre d'avant, guillemets…).
 */
export function partsBetween(
  text: string,
  marks: readonly Mark[],
  from: number,
  to: number
): VisiblePart[] {
  const parts: VisiblePart[] = []
  let last = from
  for (const mark of marks) {
    if (mark.end <= from || mark.start >= to) continue
    if (mark.start > last) parts.push({ text: text.slice(last, mark.start) })
    const char = text.slice(mark.start, mark.end)
    parts.push({ text: mark.kind === 'loud' ? symbolOf(char) : char, invisible: mark.kind })
    last = mark.end
  }
  if (last < to) parts.push({ text: text.slice(last, to) })
  return parts
}

/** Les caractères à montrer d'une commande (calculés une fois pour toute la commande). */
export const invisibleMarks = (text: string): readonly Mark[] => marksOf(text)

/** Le texte en morceaux, caractères invisibles rendus visibles. */
export const visibleParts = (text: string): VisiblePart[] =>
  partsBetween(text, marksOf(text), 0, text.length)

/** Le texte, caractères invisibles rendus visibles (infobulle, ligne repliée). */
export const visibleText = (text: string): string =>
  visibleParts(text)
    .map((part) => part.text)
    .join('')

/** La commande contient-elle un caractère qui mérite l'alerte (pas les signalés discrètement) ? */
export const hasInvisible = (text: string): boolean =>
  marksOf(text).some((mark) => mark.kind === 'loud')
