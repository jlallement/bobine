/**
 * Mots cherchés surlignés dans la page d'aide ouverte (fiche 186), par l'API « CSS Custom
 * Highlight » : des plages posées sur le texte, sans toucher au DOM que React gère.
 */
import { fold } from './search'

const NAME = 'help-search'

/** Surligne les mots dans `root` ; renvoie de quoi effacer. Sans l'API (jsdom) : rien. */
export function highlightTerms(root: HTMLElement | null, terms: readonly string[]): () => void {
  const registry = typeof CSS !== 'undefined' ? CSS.highlights : undefined
  if (!registry || typeof Highlight === 'undefined') return () => undefined
  registry.delete(NAME)
  if (!root || terms.length === 0) return () => undefined
  const ranges: Range[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = fold(node.textContent ?? '')
    for (const term of terms) {
      for (let at = text.indexOf(term); at >= 0; at = text.indexOf(term, at + term.length)) {
        if (at > 0 && /[\p{L}\p{N}]/u.test(text[at - 1] ?? '')) continue
        const range = document.createRange()
        range.setStart(node, at)
        range.setEnd(node, at + term.length)
        ranges.push(range)
      }
    }
  }
  registry.set(NAME, new Highlight(...ranges))
  return () => registry.delete(NAME)
}

/**
 * Première occurrence d'un mot cherché dans `root`, après `after` s'il est donné (la section du
 * résultat choisi) ; `undefined` s'il n'y en a pas.
 */
export function firstMatch(
  root: HTMLElement,
  terms: readonly string[],
  after: Element | null
): Range | undefined {
  if (terms.length === 0) return undefined
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (after && !(after.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
    const text = fold(node.textContent ?? '')
    let best = -1
    let length = 0
    for (const term of terms) {
      for (let at = text.indexOf(term); at >= 0; at = text.indexOf(term, at + 1)) {
        if (at > 0 && /[\p{L}\p{N}]/u.test(text[at - 1] ?? '')) continue
        if (best < 0 || at < best) {
          best = at
          length = term.length
        }
        break
      }
    }
    if (best >= 0) {
      const range = document.createRange()
      range.setStart(node, best)
      range.setEnd(node, best + length)
      return range
    }
  }
  return undefined
}
