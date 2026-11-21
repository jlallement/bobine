/**
 * Chemin `fichier:ligne` écrit en code dans une réponse (`src/liste.js:5`) : lien de fichier, comme
 * les mêmes références dans les remarques du relecteur (fiche 272, recette). Seulement ce qui a
 * l'air d'un chemin avec une extension : jamais une commande, ni un mot, ni une adresse.
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
 * Premier segment d'un chemin à dossiers qui a l'air d'un nom de domaine (`github.com`,
 * `docs.rs`, `example.ch`) : des labels, le dernier en lettres. Un dossier à point en tête
 * (`.github`) n'en est pas un.
 */
const DOMAIN_LIKE = /^(?!\.)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}$/i
/**
 * `hôte:port` sans dossier : seulement les domaines de premier niveau qui ne sont jamais des
 * extensions de fichier courantes (`example.org:443`) ; `deploy.sh:12`, `logo.ai:1`, `x.dev:1`
 * restent des fichiers. Un domaine hors de cette liste est pris pour un fichier : risque accepté.
 */
const HOST_TLD = /\.(?:com|org|net|edu|gov|info|io|fr|de|uk|eu|ch|nl|be|it|es|us|ca|jp|localhost)$/i

/**
 * Lien visé par un code en ligne, ou `undefined` s'il ne désigne pas un fichier. Règle (revue de
 * la fiche 272) : une extension avec au moins une lettre ; `./` ou `../` en tête : toujours un
 * chemin ; sinon refus d'un `@` dans le premier segment (`user@host:22`, mais pas `@scope/…`), d'un
 * premier segment domaine ou IP suivi d'un `/`, et d'un `hôte:port`.
 */
export function inlineFileHref(text: string): string | undefined {
  const match = PATH.exec(text)
  if (!match) return undefined
  const ext = /\.([A-Za-z0-9]{1,8})(?::\d+(?:-\d+)?)?$/.exec(text)?.[1] ?? ''
  if (!/[A-Za-z]/.test(ext)) return undefined
  if (!/^\.{1,2}\//.test(text) && !pathLike(text)) return undefined
  const line = match[1]
  // Plage `:32-68` : le lien ouvre sa première ligne.
  return line ? text.replace(/:(\d+)(?:-\d+)?$/, `:${line}`) : text
}

/** Sans `./` en tête : ni compte (`user@…`), ni adresse (domaine ou IP, `hôte:port`). */
function pathLike(text: string): boolean {
  const [first = '', ...rest] = text.split('/')
  if (first.indexOf('@') > 0) return false
  if (rest.length > 0) return !IP.test(first) && !DOMAIN_LIKE.test(first)
  const [host = '', port] = first.split(':')
  return port === undefined || (!IP.test(host) && !HOST_TLD.test(host))
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
