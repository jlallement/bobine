/**
 * Chemin `fichier:ligne` écrit en code dans une réponse (`src/liste.js:5`) : lien de fichier, comme
 * les mêmes références dans les remarques du relecteur (fiche 272, recette). Seulement ce qui a
 * l'air d'un chemin (un dossier, ou une ligne) avec une extension : jamais une commande, ni un mot.
 */

interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const PATH = /^(?:\.{0,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\.[A-Za-z0-9]{1,8}(?::(\d+)(?:-\d+)?)?$/

/** Une adresse IP (`127.0.0.1`). */
const IP = /^\d{1,3}(?:\.\d{1,3}){3}$/
/**
 * Un nom de domaine (`github.com`, `api.example.com`) : son dernier label est un domaine de premier
 * niveau courant. Une extension de fichier (`.js`, `.md`, `.json`) n'en est jamais un ici.
 */
const DOMAIN =
  /^(?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|app|ai|co|fr|de|uk|eu|edu|gov|info|me|sh|cloud|tech|xyz|localhost)$/i

/** Lien visé par un code en ligne, ou `undefined` s'il ne désigne pas un fichier. */
export function inlineFileHref(text: string): string | undefined {
  const match = PATH.exec(text)
  if (!match) return undefined
  // `127.0.0.1:8080`, `example.org:443`, `github.com/org/repo.git` : une adresse, pas un chemin.
  const first = text.replace(/^\.{0,2}\//, '').split(/[/:]/)[0] ?? ''
  if (IP.test(first) || DOMAIN.test(first)) return undefined
  const line = match[1]
  if (!line && !text.includes('/')) return undefined
  // Plage `:32-68` : le lien ouvre sa première ligne.
  return line ? text.replace(/:(\d+)(?:-\d+)?$/, `:${line}`) : text
}

const textOf = (node: HastNode): string =>
  node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join('')

function wrap(node: HastNode): void {
  if (!node.children || node.tagName === 'pre' || node.tagName === 'a') return
  node.children = node.children.map((child) => {
    if (child.type === 'element' && child.tagName === 'code') {
      const href = inlineFileHref(textOf(child))
      if (href) return { type: 'element', tagName: 'a', properties: { href }, children: [child] }
    }
    wrap(child)
    return child
  })
}

/** Plugin rehype : enveloppe chaque code en ligne qui désigne un fichier dans un lien. */
export function rehypeInlineFileCode() {
  return (tree: HastNode) => wrap(tree)
}
