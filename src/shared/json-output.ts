/**
 * Sortie d'un outil `execute` qui est du JSON (fiche 128, D6 : le résultat d'un `Promise.allSettled`,
 * d'une API…) : lue sur une seule ligne avec des « \n » dans les chaînes, elle est illisible. On la
 * remet en forme, indentée, avec de vrais retours à la ligne dans les chaînes.
 */

/** Chaîne JSON dont les retours à la ligne et tabulations sont de vrais caractères. */
function renderString(value: string): string {
  let out = '"'
  for (const char of value) {
    if (char === '"') out += '\\"'
    else if (char === '\\') out += '\\\\'
    else if (char === '\n' || char === '\t') out += char
    else if (char === '\r') continue
    else out += JSON.stringify(char).slice(1, -1)
  }
  return `${out}"`
}

function render(value: unknown, depth: number): string {
  if (typeof value === 'string') return renderString(value)
  if (typeof value !== 'object' || value === null) return JSON.stringify(value)
  const pad = '  '.repeat(depth + 1)
  const end = '  '.repeat(depth)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[\n${value.map((v) => pad + render(v, depth + 1)).join(',\n')}\n${end}]`
  }
  const entries = Object.entries(value)
  if (entries.length === 0) return '{}'
  const lines = entries.map(([key, v]) => `${pad}${JSON.stringify(key)}: ${render(v, depth + 1)}`)
  return `{\n${lines.join(',\n')}\n${end}}`
}

/**
 * Le texte remis en forme s'il est un objet ou un tableau JSON valide ; `undefined` sinon (texte
 * ordinaire, JSON d'une seule valeur simple : rien à améliorer).
 */
export function prettyJsonOutput(text: string): string | undefined {
  const trimmed = text.trim()
  if (!/^[[{]/.test(trimmed)) return undefined
  try {
    const value: unknown = JSON.parse(trimmed)
    return typeof value === 'object' && value !== null ? render(value, 0) : undefined
  } catch {
    return undefined
  }
}
