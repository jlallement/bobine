/**
 * Langage des blocs de code sans langage (fiche 192). `rehype-highlight` le devine en essayant
 * chaque grammaire (≈ 140 ms pour 200 lignes) : refait à chaque morceau d'une réponse en streaming,
 * c'était le coût dominant du fil. Deux greffons l'encadrent :
 *
 * - avant : un bloc encore ouvert d'une réponse en cours (sa clôture n'est pas arrivée) n'est pas
 *   deviné, il est coloré une fois fermé ; un bloc dont le langage a déjà été deviné le reçoit
 *   du cache, `rehype-highlight` le colore alors directement ;
 * - après : ce que `rehype-highlight` a deviné entre dans le cache.
 *
 * Le rendu final est celui d'avant : même langage deviné, mêmes classes.
 */

/** Nœud de l'arbre HTML produit par le Markdown (hast), juste ce qu'il faut ici. */
interface HastNode {
  type?: string
  tagName?: string
  value?: string
  properties?: { className?: unknown }
  children?: HastNode[]
  position?: { end?: { offset?: number } }
}

/** Classe qui fait passer `rehype-highlight` sans rien faire. */
const SKIP = 'no-highlight'
/** Marque posée par le greffon d'avant sur un bloc qu'il fait passer (retirée après). */
const SKIPPED = 'bobine-no-highlight'
/** Langage deviné par texte de bloc ; `null` : aucun langage reconnu (texte brut). */
const guessed = new Map<string, string | null>()
const CACHE_SIZE = 200
/** Blocs sans langage laissés à `rehype-highlight` pour qu'il le devine (le même arbre passe). */
const toGuess = new WeakSet<HastNode>()

export const textOf = (node: HastNode): string =>
  node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join('')

function remember(text: string, language: string | null): void {
  guessed.delete(text)
  guessed.set(text, language)
  while (guessed.size > CACHE_SIZE) {
    const oldest = guessed.keys().next().value
    if (oldest === undefined) break
    guessed.delete(oldest)
  }
}

/** Blocs `pre > code` de l'arbre, avec leur `pre`. */
function codeBlocks(tree: HastNode): { pre: HastNode; code: HastNode }[] {
  const found: { pre: HastNode; code: HastNode }[] = []
  const visit = (node: HastNode) => {
    for (const child of node.children ?? []) {
      if (child.tagName === 'pre') {
        const code = child.children?.find((c) => c.tagName === 'code')
        if (code) found.push({ pre: child, code })
      }
      visit(child)
    }
  }
  visit(tree)
  return found
}

const classesOf = (node: HastNode): string[] => {
  const list = node.properties?.className
  return Array.isArray(list) ? list.map(String) : []
}

const hasLanguage = (classes: string[]) =>
  classes.some(
    (c) => c.startsWith('language-') || c.startsWith('lang-') || c === SKIP || c === 'nohighlight'
  )

/** Le bloc qui finit à `end` dans `source` est-il fermé (ligne ``` ou ~~~ juste avant) ? */
export function fenceClosed(source: string, end: number | undefined): boolean {
  if (end === undefined) return true
  return /(^|\n)[ \t]*(`{3,}|~{3,})[ \t]*\n?$/.test(source.slice(0, end))
}

/** Greffon d'avant : langage du cache, ou bloc ouvert d'une réponse en cours laissé tel quel. */
export function rehypeKnownLanguage(options: { source: string; streaming: boolean }) {
  return (tree: HastNode) => {
    for (const { pre, code } of codeBlocks(tree)) {
      const classes = classesOf(code)
      if (hasLanguage(classes)) continue
      const known = guessed.get(textOf(code))
      const open = options.streaming && !fenceClosed(options.source, pre.position?.end?.offset)
      if (known === undefined && !open) {
        toGuess.add(code)
        continue
      }
      code.properties ??= {}
      // Langage déjà deviné : coloré directement. Aucun : `hljs` seul, comme `rehype-highlight`
      // le laisse sur un texte brut. Bloc ouvert : rien, il sera deviné une fois fermé.
      code.properties.className = known
        ? [...classes, `language-${known}`]
        : [...(known === null ? ['hljs'] : []), ...classes, SKIP, SKIPPED]
    }
  }
}

/** Greffon d'après : langage deviné par `rehype-highlight` gardé ; marques retirées. */
export function rehypeRememberLanguage() {
  return (tree: HastNode) => {
    for (const { code } of codeBlocks(tree)) {
      const classes = classesOf(code)
      if (classes.includes(SKIPPED)) {
        code.properties = {
          ...code.properties,
          className: classes.filter((c) => c !== SKIP && c !== SKIPPED)
        }
        continue
      }
      if (!toGuess.has(code)) continue
      const language = classes.find((c) => c.startsWith('language-'))?.slice('language-'.length)
      const text = textOf(code)
      if (!guessed.has(text)) remember(text, language ?? null)
    }
  }
}
