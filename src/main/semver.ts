/**
 * Lecture tolérante et ordre semver des numéros de version (fiches 198, 218) : versions des agents
 * (`agent/agent-version.ts`) et de l'app (marque du profil, `profile-format.ts`). Sans dépendance :
 * l'ordre semver tient en quelques lignes, préversions comprises.
 */

export interface ParsedVersion {
  /** Numéros dans l'ordre (`2.0.9` → [2, 0, 9]) ; un `1.19` reste à deux numéros. */
  numbers: number[]
  /** Identifiants de préversion (`2.1.0-beta.3` → ['beta', '3']) ; vide pour une version finale. */
  pre: string[]
}

// Premier « nombre.nombre[.nombre…] » du texte, préversion comprise ; la métadonnée de
// construction (`+abc`) est ignorée. `opencode v2.2.5`, `2.0.9\ncommit: 9690f20b0`, `v1.19`.
const VERSION = /(?:^|[^\w.])v?(\d+(?:\.\d+)+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?/

/** Lit une version dans un texte ; `undefined` si rien ne ressemble à une version. */
export function parseVersion(raw: string | undefined): ParsedVersion | undefined {
  if (!raw) return undefined
  const match = VERSION.exec(raw.trim())
  if (!match?.[1]) return undefined
  const numbers = match[1].split('.').map(Number)
  if (numbers.some((n) => !Number.isSafeInteger(n))) return undefined
  const pre = match[2] ? match[2].split('.').filter(Boolean) : []
  return { numbers, pre }
}

/** Compare deux identifiants de préversion (semver : les numériques avant les autres). */
function comparePre(x: string, y: string): number {
  const nx = /^\d+$/.test(x)
  const ny = /^\d+$/.test(y)
  if (nx && ny) return Math.sign(Number(x) - Number(y))
  if (nx !== ny) return nx ? -1 : 1
  return x === y ? 0 : x < y ? -1 : 1
}

/** Ordre semver : numéros (manquants = 0), puis une préversion avant la version finale. */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  const length = Math.max(a.numbers.length, b.numbers.length)
  for (let i = 0; i < length; i++) {
    const diff = (a.numbers[i] ?? 0) - (b.numbers[i] ?? 0)
    if (diff !== 0) return Math.sign(diff)
  }
  if (!a.pre.length || !b.pre.length) return Math.sign(b.pre.length - a.pre.length)
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const order = comparePre(x, y)
    if (order !== 0) return order
  }
  return 0
}

/**
 * Compare deux numéros écrits (`1.0.0-beta.1`, `0.11.2`) dans l'ordre semver : -1, 0 ou 1. Un
 * texte qui ne se lit pas comme une version est tenu pour égal (on ne conclut rien).
 */
export function compareVersionStrings(a: string, b: string): number {
  const [pa, pb] = [parseVersion(a), parseVersion(b)]
  return pa && pb ? compareVersions(pa, pb) : 0
}
