/**
 * Lecture de l'écran Android par `uiautomator dump` (fiche 032) : hiérarchie XML des vues avec leur
 * texte, leur description d'accessibilité, leur identifiant et leur cadre (en pixels).
 */

export interface UiNode {
  className: string
  text: string
  description: string
  resourceId: string
  clickable: boolean
  enabled: boolean
  checked: boolean | undefined
  bounds: { x1: number; y1: number; x2: number; y2: number }
  depth: number
}

const ATTR = /([\w-]+)="([^"]*)"/g

const decode = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')

/** Nœuds du XML de `uiautomator dump`, dans l'ordre, avec leur profondeur. */
export function parseUiDump(xml: string): UiNode[] {
  const nodes: UiNode[] = []
  let depth = 0
  for (const tag of xml.matchAll(/<(\/?)node\b([^>]*?)(\/?)>/g)) {
    const [, closing, body = '', selfClosing] = tag
    if (closing) {
      depth--
      continue
    }
    const attrs: Record<string, string> = {}
    for (const [, name = '', value = ''] of body.matchAll(ATTR)) attrs[name] = decode(value)
    const b = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(attrs['bounds'] ?? '')
    nodes.push({
      className: (attrs['class'] ?? '').split('.').pop() ?? '',
      text: attrs['text'] ?? '',
      description: attrs['content-desc'] ?? '',
      resourceId: (attrs['resource-id'] ?? '').replace(/^.*:id\//, ''),
      clickable: attrs['clickable'] === 'true',
      enabled: attrs['enabled'] !== 'false',
      checked: attrs['checkable'] === 'true' ? attrs['checked'] === 'true' : undefined,
      bounds: b
        ? { x1: Number(b[1]), y1: Number(b[2]), x2: Number(b[3]), y2: Number(b[4]) }
        : { x1: 0, y1: 0, x2: 0, y2: 0 },
      depth
    })
    if (!selfClosing) depth++
  }
  return nodes
}

const clean = (value: string, max = 100) => {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Écran pour l'agent : une ligne par vue utile — avec un texte ou une description, ou cliquable (elle
 * prend alors le texte de ses enfants, qui ne sont pas répétés) — et une référence `ref_N` = centre
 * de son cadre. `scale` convertit les pixels en dp. Les conteneurs de mise en page sont effacés.
 */
export function formatUiDump(
  nodes: readonly UiNode[],
  scale: number,
  maxChars: number,
  refFor: (center: { x: number; y: number }) => string
): { lines: string[]; truncated: boolean } {
  const lines: string[] = []
  let size = 0
  /** Vues affichées encore ouvertes : profondeur XML et textes déjà couverts. */
  const open: { depth: number; covered: string }[] = []
  for (const [index, node] of nodes.entries()) {
    while (open.length && (open.at(-1)?.depth ?? -1) >= node.depth) open.pop()
    const own = clean(node.text || node.description)
    const covered = open.at(-1)?.covered ?? ''
    if (!node.clickable && (!own || covered.includes(own))) continue
    const { x1, y1, x2, y2 } = node.bounds
    if (x2 <= x1 || y2 <= y1) continue
    // Texte d'une vue cliquable sans libellé : celui de ses descendants.
    let label = own
    if (!label && node.clickable) {
      const texts: string[] = []
      for (const child of nodes.slice(index + 1)) {
        if (child.depth <= node.depth) break
        const text = clean(child.text || child.description, 60)
        if (text && !texts.includes(text)) texts.push(text)
        if (texts.length === 2) break
      }
      label = texts.join(' — ')
    }
    if (!label && !node.resourceId) continue
    const center = {
      x: Math.round(((x1 + x2) / 2) * scale),
      y: Math.round(((y1 + y2) / 2) * scale)
    }
    let line = `${'  '.repeat(open.length)}- ${node.className || 'View'}`
    if (label) line += ` "${label.replace(/"/g, "'")}"`
    if (node.description && node.text && node.description !== node.text) {
      line += ` desc="${clean(node.description, 60)}"`
    }
    if (node.resourceId) line += ` id=${node.resourceId}`
    if (node.checked !== undefined) line += node.checked ? ' (coché)' : ' (non coché)'
    if (node.clickable) line += ' (cliquable)'
    if (!node.enabled) line += ' (désactivé)'
    line += ` [${refFor(center)}]`
    size += line.length + 1
    if (size > maxChars) return { lines, truncated: true }
    lines.push(line)
    open.push({ depth: node.depth, covered: `${covered} ${label}` })
  }
  return { lines, truncated: false }
}
