/**
 * Lettres d'un tour de table dans la synthèse (fiche 285, décision D1) : l'agent qui synthétise
 * ne connaît que « Participant A, B, C » ; l'interface montre le vrai nom au survol et au focus. La
 * table des lettres vit dans l'élément du tour, côté app seulement.
 *
 * Un greffon rehype pur : chaque « Participant X » d'un nœud de texte (hors code) devient un
 * élément `abbr` (`data-letter`), que le rendu Markdown affiche avec son infobulle. Rien d'autre du
 * texte ne change, et une lettre absente de la table reste du texte.
 */

/** Nœud de l'arbre HTML (hast), juste ce qu'il faut ici. */
interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/**
 * « Participant C », « participant C », et les formes groupées « Participants A et B »,
 * « Participants A, B et C », « participants A and B » (recette du 2026-11-25, S3 : les vrais
 * modèles groupent). Une lettre seule, hors de ces formes, reste du texte : « A » est aussi un mot.
 */
const GROUP = /\b[Pp]articipants?\s+[A-E](?:(?:\s*,\s*|\s+(?:et|and|&)\s+|\s*\/\s*)[A-E])*\b/g
/** Les lettres d'une forme (majuscules A à E, isolées). */
const LETTERS = /\b[A-E]\b/g

type Part = string | { text: string; letter: string }

/** Morceaux d'un texte : du texte, ou une lettre connue (`[mention, lettre]`). */
export function splitLetters(text: string, known: Readonly<Record<string, string>>): Part[] {
  const parts: Part[] = []
  let last = 0
  const push = (from: number, to: number, letter?: string) => {
    if (to <= from) return
    const piece = text.slice(from, to)
    if (letter) parts.push({ text: piece, letter })
    else if (typeof parts.at(-1) === 'string') parts[parts.length - 1] += piece
    else parts.push(piece)
  }
  for (const match of text.matchAll(GROUP)) {
    if (match.index === undefined) continue
    const start = match.index
    // Le mot « Participant(s) » va avec la première lettre ; les suivantes, seules.
    const word = match[0].search(/\s/)
    let first = true
    for (const inner of match[0].slice(word).matchAll(LETTERS)) {
      const letter = inner[0]
      const at = start + word + (inner.index ?? 0)
      if (!known[letter]) {
        first = false
        continue
      }
      push(last, first ? start : at)
      push(first ? start : at, at + 1, letter)
      last = at + 1
      first = false
    }
  }
  push(last, text.length)
  return parts
}

/** Éléments où le texte reste tel quel : du code, un lien déjà cliquable. */
const KEEP = new Set(['code', 'pre', 'a', 'abbr'])

function visit(
  node: HastNode,
  known: Readonly<Record<string, string>>,
  seen: Set<string> = new Set()
): void {
  if (!node.children || (node.tagName && KEEP.has(node.tagName))) return
  const next: HastNode[] = []
  for (const child of node.children) {
    if (child.type !== 'text' || typeof child.value !== 'string') {
      visit(child, known, seen)
      next.push(child)
      continue
    }
    for (const part of splitLetters(child.value, known)) {
      next.push(
        typeof part === 'string'
          ? { type: 'text', value: part }
          : {
              type: 'element',
              tagName: 'abbr',
              // Première mention de la lettre : la seule étape de tabulation.
              properties: {
                dataLetter: part.letter,
                ...(seen.has(part.letter) ? {} : { dataFirst: 'true' })
              },
              children: [{ type: 'text', value: part.text }]
            }
      )
      if (typeof part !== 'string') seen.add(part.letter)
    }
  }
  node.children = next
}

/** Greffon rehype : `[rehypeRoundtableLetters, { names }]`. */
export function rehypeRoundtableLetters(options: { names: Readonly<Record<string, string>> }) {
  return (tree: HastNode) => {
    visit(tree, options.names)
  }
}
