/**
 * Ancres du guide (fiche 186) : la seule balise HTML admise dans les pages est
 * `<a id="…"></a>`, juste avant un titre. Ce greffon de `remark` la retire et pose son `id` sur
 * le titre suivant ; tout autre HTML brut est retiré ici, et `skipHtml` l'ignore de toute façon.
 */
import { frenchSpaces } from '@shared/i18n/typography'
import { ANCHOR_LINE } from './guide'

/** Nœud de l'arbre Markdown (mdast), juste ce qu'il faut ici. */
export interface MdNode {
  type: string
  value?: string
  data?: { hProperties?: Record<string, unknown> }
  children?: MdNode[]
}

function visit(parent: MdNode): void {
  const children = parent.children
  if (!children) return
  const kept: MdNode[] = []
  let pending: string | undefined
  for (const node of children) {
    // `<a id="…"></a>` seul sur sa ligne : un paragraphe fait de deux nœuds HTML en ligne.
    const raw =
      node.type === 'html'
        ? node.value
        : node.type === 'paragraph' && node.children?.every((c) => c.type === 'html')
          ? node.children.map((c) => c.value ?? '').join('')
          : undefined
    if (raw !== undefined) {
      const anchor = ANCHOR_LINE.exec(raw.trim())
      if (anchor) pending = anchor[1]
      continue
    }
    if (node.type === 'heading' && pending) {
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: pending } }
    }
    pending = undefined
    visit(node)
    kept.push(node)
  }
  parent.children = kept
}

export function remarkGuideAnchors() {
  return (tree: MdNode) => visit(tree)
}

/** Espaces insécables du français dans le texte des pages (pas dans le code), fiche 186. */
export function remarkFrenchSpaces() {
  const walk = (node: MdNode): void => {
    if (node.type === 'text' && node.value) node.value = frenchSpaces(node.value)
    node.children?.forEach(walk)
  }
  return (tree: MdNode) => walk(tree)
}
