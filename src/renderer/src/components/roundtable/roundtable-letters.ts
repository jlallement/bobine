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

/** « Participant C », « participant C », « Participants A et C » ne comptent que lettre par lettre. */
const LETTER = /\b([Pp]articipant)\s+([A-E])\b/g

/** Morceaux d'un texte : du texte, ou une lettre connue (`[mention, lettre]`). */
export function splitLetters(
  text: string,
  known: Readonly<Record<string, string>>
): (string | { text: string; letter: string })[] {
  const parts: (string | { text: string; letter: string })[] = []
  let last = 0
  for (const match of text.matchAll(LETTER)) {
    const letter = match[2] ?? ''
    if (!known[letter] || match.index === undefined) continue
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push({ text: match[0], letter })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
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
