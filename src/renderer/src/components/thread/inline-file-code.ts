/**
 * Chemin `fichier:ligne` écrit en code dans une réponse (`src/liste.js:5`) : lien de fichier, comme
 * les mêmes références dans les remarques du relecteur (fiche 272, recette). Seulement ce qui a
 * l'air d'un chemin avec une extension : jamais une commande, ni un mot, ni une adresse ; et
 * seulement vers un fichier qui existe dans le dossier de la conversation (recette de la rc.3).
 */

import { pathLike } from '@shared/file-links'

interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const PATH = /^(?:\.{0,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\.[A-Za-z0-9]{1,8}(?::(\d+)(?:-\d+)?)?$/

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

const textOf = (node: HastNode): string =>
  node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(textOf).join('')

/** Ce que le plugin demande au fil : l'existence des fichiers cités (fiche 272, rc.3). */
export interface InlineFileOptions {
  /** Vrai seulement pour un fichier qui existe ; `undefined` tant qu'on ne sait pas. */
  isFile?: (href: string) => boolean | undefined
  /** Chemin candidat, à vérifier. */
  want?: (href: string) => void
  /**
   * Lien cliqué vers un fichier introuvable (fiche 272, D2) : gardé dans son lien, que le lien
   * montre barré, pour que la bulle et l'état du lien survivent au nouveau rendu.
   */
  isGone?: (href: string) => boolean
}

function wrap(node: HastNode, options: InlineFileOptions): void {
  if (!node.children || node.tagName === 'pre' || node.tagName === 'a') return
  node.children = node.children.map((child) => {
    if (child.type === 'element' && child.tagName === 'code') {
      const href = inlineFileHref(textOf(child))
      if (href) {
        options.want?.(href)
        // Un fichier à créer, ou un chemin relatif à un autre fichier : pas un lien qui ne mène
        // nulle part ; tant qu'on ne sait pas, du code.
        if (options.isFile?.(href) === true || options.isGone?.(href) === true) {
          return { type: 'element', tagName: 'a', properties: { href }, children: [child] }
        }
      }
    }
    wrap(child, options)
    return child
  })
}

/**
 * Plugin rehype : enveloppe dans un lien chaque code en ligne qui désigne un fichier existant.
 * Sans `isFile` (personne pour vérifier), aucun.
 */
export function rehypeInlineFileCode(options: InlineFileOptions = {}) {
  return (tree: HastNode) => wrap(tree, options)
}
