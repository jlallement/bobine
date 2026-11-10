/**
 * Lecture de la page par l'arbre d'accessibilité de Chromium (`Accessibility.getFullAXTree`), comme
 * les lecteurs d'écran : rôles et noms calculés par le navigateur (ARIA, libellés, composants web).
 * Mise en forme pour l'agent : une ligne par élément, avec une référence `ref_N` (ADR-0006).
 */

/** Nœud de l'arbre d'accessibilité, tel que le CDP le renvoie (champs utiles). */
export interface AXNode {
  nodeId: string
  ignored: boolean
  role?: { value?: unknown }
  name?: { value?: unknown }
  value?: { value?: unknown }
  properties?: { name: string; value: { value?: unknown } }[]
  childIds?: string[]
  backendDOMNodeId?: number
  parentId?: string
}

/** Rôles sur lesquels l'agent peut agir (cliquer, saisir, choisir). */
const INTERACTIVE = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'option',
  'checkbox',
  'radio',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'treeitem',
  'PopUpButton',
  'ToggleButton'
])

/** Conteneurs sans intérêt pour l'agent : leurs enfants remontent d'un niveau. */
const TRANSPARENT = new Set([
  'generic',
  'none',
  'presentation',
  'GenericContainer',
  'LayoutTable',
  'LayoutTableRow',
  'LayoutTableCell',
  'InlineTextBox',
  'LineBreak',
  'RootWebArea',
  'WebArea',
  'Section',
  'Iframe'
])

const clean = (value: unknown, max = 100): string => {
  const text = (typeof value === 'string' ? value : value === undefined ? '' : String(value))
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const prop = (node: AXNode, name: string): unknown =>
  node.properties?.find((p) => p.name === name)?.value.value

/** Ligne d'un élément : rôle, nom, états utiles. */
export function describeNode(node: AXNode): string {
  const role = clean(node.role?.value) || 'element'
  const name = clean(node.name?.value)
  let line = name ? `${role} "${name.replace(/"/g, "'")}"` : role
  const level = prop(node, 'level')
  if (role === 'heading' && level !== undefined) line += ` (niveau ${String(level)})`
  const checked = prop(node, 'checked')
  if (checked === 'true' || checked === true) line += ' (coché)'
  if (checked === 'mixed') line += ' (partiel)'
  if (prop(node, 'expanded') === true) line += ' (ouvert)'
  if (prop(node, 'selected') === true) line += ' (sélectionné)'
  const value = clean(node.value?.value, 60)
  if (value && value !== name) line += ` valeur="${value}"`
  const url = prop(node, 'url')
  if (role === 'link' && typeof url === 'string' && url) line += ` → ${clean(url, 80)}`
  if (prop(node, 'disabled') === true) line += ' (désactivé)'
  return line
}

/**
 * Arbre mis en forme. `interactive` : seulement ce sur quoi on agit ; `all` : aussi les titres, textes
 * et repères. `refFor` attribue la référence d'un nœud DOM.
 */
export function formatAxTree(
  nodes: readonly AXNode[],
  filter: 'interactive' | 'all',
  maxChars: number,
  refFor: (backendNodeId: number) => string
): { lines: string[]; truncated: boolean } {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  const root = nodes.find((n) => !n.parentId || !byId.has(n.parentId))
  const lines: string[] = []
  let size = 0
  let truncated = false

  const keep = (node: AXNode, role: string, name: string): boolean => {
    if (node.ignored || TRANSPARENT.has(role)) return false
    if (INTERACTIVE.has(role)) return true
    // Élément focalisable sans rôle (div cliquable avec tabindex…).
    if (prop(node, 'focusable') === true && name && role !== 'StaticText') return filter === 'all'
    if (filter === 'interactive') return false
    if (role === 'StaticText') return !!name
    return (
      !!name ||
      [
        'heading',
        'img',
        'navigation',
        'main',
        'form',
        'dialog',
        'list',
        'table',
        'banner',
        'contentinfo',
        'region',
        'article',
        'paragraph'
      ].includes(role)
    )
  }

  const walk = (node: AXNode, depth: number, covered: string): void => {
    if (truncated) return
    const role = clean(node.role?.value)
    const name = clean(node.name?.value, 200)
    let childDepth = depth
    let childCovered = covered
    // Le texte d'un bouton ou d'un lien est déjà dans son nom.
    const redundant = role === 'StaticText' && covered.includes(name)
    if (!redundant && keep(node, role, name)) {
      const ref = node.backendDOMNodeId !== undefined ? ` [${refFor(node.backendDOMNodeId)}]` : ''
      const text =
        role === 'StaticText' ? `text "${clean(name).replace(/"/g, "'")}"` : describeNode(node)
      const line = `${'  '.repeat(depth)}- ${text}${role === 'StaticText' ? '' : ref}`
      size += line.length + 1
      if (size > maxChars) {
        truncated = true
        return
      }
      lines.push(line)
      childDepth = depth + 1
      if (name) childCovered = name
    }
    for (const id of node.childIds ?? []) {
      const child = byId.get(id)
      if (child) walk(child, childDepth, childCovered)
    }
  }
  if (root) walk(root, 0, '')
  return { lines, truncated }
}

/** Éléments dont le rôle, le nom ou la valeur contiennent le texte cherché (20 au plus). */
export function findInAxTree(
  nodes: readonly AXNode[],
  query: string,
  refFor: (backendNodeId: number) => string
): string[] {
  const q = query.toLowerCase()
  const found: string[] = []
  for (const node of nodes) {
    const role = clean(node.role?.value)
    if (node.ignored || TRANSPARENT.has(role) || role === 'StaticText') continue
    if (node.backendDOMNodeId === undefined) continue
    const line = describeNode(node)
    if (!line.toLowerCase().includes(q)) continue
    found.push(`- ${line} [${refFor(node.backendDOMNodeId)}]`)
    if (found.length >= 20) break
  }
  return found
}
