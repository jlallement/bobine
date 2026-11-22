/**
 * Avis de nouvelle version (fiche 274, ADR-0066) : ce que le renderer voit, et les règles pures
 * (lecture stricte d'une étiquette semver, choix de la version à annoncer, page vérifiée).
 * Rien ici ne fait d'appel réseau.
 */

/** Dépôt dont les Releases sont lues, et seule page que l'app ouvre. */
export const RELEASES_REPO = 'jlallement/bobine'
export const RELEASES_API_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=30`
const RELEASE_PAGE_PREFIX = `https://github.com/${RELEASES_REPO}/releases/tag/`

/** Raison courte d'un échec, dite seulement après « Vérifier maintenant ». */
export type UpdateFailure = 'offline' | 'limit' | 'unreadable'

/** Version plus récente trouvée, avec la page vérifiée de sa Release. */
export interface UpdateRelease {
  version: string
  prerelease: boolean
  url: string
}

/** État de l'avis, tel que le renderer l'affiche. */
export interface UpdateView {
  /** Version installée. */
  current: string
  /** Vérification automatique active (réglage, et pas coupée pour les essais). */
  enabled: boolean
  /** Dernière vérification réussie (ISO 8601), ou `null`. */
  lastCheckedAt: string | null
  checking: boolean
  /** Version plus récente connue, ou `null`. */
  available: UpdateRelease | null
  /** L'avis de cette version a été fermé (« Voir », « Plus tard ») : la barre latérale le tait. */
  dismissed: boolean
  /** Résultat du dernier « Vérifier maintenant » de ce lancement, ou `null`. */
  manual: { result: 'up-to-date' } | { result: 'failed'; failure: UpdateFailure } | null
}

/** Version semver lue strictement : `X.Y.Z` ou `X.Y.Z-pré`, `v` facultatif devant. */
export interface StrictVersion {
  major: number
  minor: number
  patch: number
  pre: string[]
}

const NUMBER = '(0|[1-9]\\d{0,8})'
const PRE_ID = '(?:0|[1-9]\\d{0,8}|\\d*[A-Za-z-][0-9A-Za-z-]*)'
const STRICT = new RegExp(`^v?${NUMBER}\\.${NUMBER}\\.${NUMBER}(?:-(${PRE_ID}(?:\\.${PRE_ID})*))?$`)

/** Lit une étiquette (`v1.0.0-rc.3`) ; `undefined` si ce n'est pas du semver strict. */
export function parseStrictVersion(tag: unknown): StrictVersion | undefined {
  if (typeof tag !== 'string' || tag.length > 64) return undefined
  const match = STRICT.exec(tag)
  if (!match) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split('.') : []
  }
}

/** Écrit une version lue (sans `v`). */
export function formatVersion(v: StrictVersion): string {
  return `${v.major}.${v.minor}.${v.patch}${v.pre.length ? `-${v.pre.join('.')}` : ''}`
}

function comparePre(x: string, y: string): number {
  const nx = /^\d+$/.test(x)
  const ny = /^\d+$/.test(y)
  if (nx && ny) return Math.sign(Number(x) - Number(y))
  if (nx !== ny) return nx ? -1 : 1
  return x === y ? 0 : x < y ? -1 : 1
}

/** Ordre semver : -1, 0 ou 1. Une préversion passe avant sa version finale. */
export function compareStrict(a: StrictVersion, b: StrictVersion): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return Math.sign(a[key] - b[key])
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

/** Page attendue d'une Release : exactement celle de son étiquette, sur github.com. */
export function releasePageUrl(tag: string): string {
  return `${RELEASE_PAGE_PREFIX}${encodeURIComponent(tag)}`
}

/** L'adresse est-elle exactement la page d'une Release du dépôt, pour cette étiquette ? */
export function isReleasePageUrl(url: unknown, tag: string): url is string {
  if (typeof url !== 'string' || url !== releasePageUrl(tag)) return false
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      parsed.port === '' &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.search === '' &&
      parsed.hash === '' &&
      parsed.pathname === `/${RELEASES_REPO}/releases/tag/${encodeURIComponent(tag)}`
    )
  } catch {
    return false
  }
}

/** Ce qu'on garde d'une Release de l'API, une fois vérifiée. */
interface Candidate {
  version: StrictVersion
  prerelease: boolean
  url: string
}

/** Une Release de la réponse, ou `undefined` si elle est à ignorer (brouillon, étiquette, page). */
function candidateOf(item: unknown, rejected: (why: string) => void): Candidate | undefined {
  if (typeof item !== 'object' || item === null) return undefined
  const r = item as Record<string, unknown>
  if (r['draft'] !== false) return undefined
  const tag = r['tag_name']
  const version = parseStrictVersion(tag)
  if (!version || typeof tag !== 'string') return undefined
  if (!isReleasePageUrl(r['html_url'], tag)) {
    rejected(tag)
    return undefined
  }
  // Marquée préversion par GitHub sans `-` : traitée en préversion (prudence pour les finales).
  const prerelease = version.pre.length > 0 || r['prerelease'] !== false
  return { version, prerelease, url: r['html_url'] }
}

/**
 * Version à annoncer pour `installed`, parmi la réponse de `GET /releases` (déjà lue en JSON).
 * Finale installée : une finale plus récente. Préversion installée : une préversion plus récente
 * de la même majeure.mineure, ou une finale plus récente de n'importe quelle ligne. La plus haute
 * l'emporte ; `null` si rien de plus récent. `undefined` : réponse illisible (pas une liste).
 * `rejected` reçoit l'étiquette d'une Release écartée pour sa page (journal).
 */
export function pickUpdate(
  releases: unknown,
  installed: string,
  rejected: (tag: string) => void = () => {}
): UpdateRelease | null | undefined {
  if (!Array.isArray(releases)) return undefined
  const current = parseStrictVersion(installed)
  if (!current) return null
  const onPreview = current.pre.length > 0
  let best: Candidate | undefined
  for (const item of releases) {
    const candidate = candidateOf(item, rejected)
    if (!candidate || compareStrict(candidate.version, current) <= 0) continue
    if (candidate.prerelease) {
      if (!onPreview) continue
      const sameLine =
        candidate.version.major === current.major && candidate.version.minor === current.minor
      if (!sameLine) continue
    }
    if (!best || compareStrict(candidate.version, best.version) > 0) best = candidate
  }
  if (!best) return null
  return { version: formatVersion(best.version), prerelease: best.prerelease, url: best.url }
}

/** Délai minimal entre deux vérifications automatiques réussies. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
