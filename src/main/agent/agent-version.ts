/**
 * Versions des agents (fiche 198) : lecture tolérante de la version annoncée à `initialize`,
 * comparaison façon semver, et verdict par rapport au profil (versions vérifiées, plancher).
 *
 * Tout ce qui ne se lit pas comme une version (`unknown`, vide, `0.0.0-dev-…` d'une construction
 * locale) donne `unknown` : jamais d'avis ni de blocage sur une version qu'on ne sait pas lire.
 */
import { compareVersions, parseVersion, type ParsedVersion } from '../semver'
import type { AgentProfile } from './profiles'

// Lecture et ordre semver partagés avec la marque du profil (fiche 218).
export { compareVersions, parseVersion, type ParsedVersion }

/**
 * La version relève d'une entrée vérifiée : `1.19` vaut pour toute la branche (`1.19.3`, ses
 * préversions) ; `2.0.9` pour `2.0.9` seulement (pas `2.0.9-beta.1`).
 */
export function matchesTested(version: ParsedVersion, tested: ParsedVersion): boolean {
  if (!tested.numbers.every((n, i) => version.numbers[i] === n)) return false
  if (tested.numbers.length < version.numbers.length) return true
  return tested.pre.join('.') === version.pre.join('.')
}

/** Construction de développement (`0.0.0-…`) : pas une vraie version. */
const isDevBuild = (v: ParsedVersion) => v.numbers.every((n) => n === 0)

export type VersionVerdict =
  /** Illisible, absente, construction locale, ou profil sans versions connues. */
  | { kind: 'unknown' }
  | { kind: 'tested'; version: string }
  /** Entre deux versions vérifiées sans en être une : le Diagnostic seulement. */
  | { kind: 'untested'; version: string }
  /** Au-dessus de toutes les versions vérifiées : avis une fois dans la conversation. */
  | { kind: 'newer'; version: string; newest: string }
  /** Sous la plus ancienne version vérifiée : avertissement une fois, jamais bloquant. */
  | { kind: 'older'; version: string; oldest: string }
  /** Sous le plancher documenté du profil (`minVersion`) : l'agent n'est pas utilisé. */
  | { kind: 'below-floor'; version: string; floor: string; reason: string }

type Entry = { text: string; parsed: ParsedVersion }

/** Verdict sur la version annoncée, d'après `testedVersions` et `minVersion` du profil. */
export function versionVerdict(
  profile: Pick<AgentProfile, 'testedVersions' | 'minVersion'>,
  raw: string | undefined
): VersionVerdict {
  const version = parseVersion(raw)
  if (!version || !raw || isDevBuild(version)) return { kind: 'unknown' }
  // Version normalisée, jamais le texte brut (une sortie bizarre ferait des kilo-octets).
  const shown = formatVersion(version)
  const min = profile.minVersion
  const floor = parseVersion(min?.version)
  if (min && floor && compareVersions(version, floor) < 0) {
    return { kind: 'below-floor', version: shown, floor: min.version, reason: min.reason }
  }
  const tested = (profile.testedVersions ?? [])
    .map((text) => ({ text, parsed: parseVersion(text) }))
    .filter((t): t is Entry => !!t.parsed)
  if (!tested.length) return { kind: 'unknown' }
  if (tested.some((t) => matchesTested(version, t.parsed)))
    return { kind: 'tested', version: shown }
  const newest = tested.reduce((a, b) => (compareVersions(a.parsed, b.parsed) >= 0 ? a : b))
  const oldest = tested.reduce((a, b) => (compareVersions(a.parsed, b.parsed) <= 0 ? a : b))
  if (compareVersions(version, newest.parsed) > 0) {
    return { kind: 'newer', version: shown, newest: newest.text }
  }
  if (compareVersions(version, oldest.parsed) < 0) {
    return { kind: 'older', version: shown, oldest: oldest.text }
  }
  return { kind: 'untested', version: shown }
}

/** Longueur maximale d'une version affichée ou retenue. */
export const MAX_VERSION_LENGTH = 40

/** Version lue, réécrite proprement (`2.3.0-beta.1`) et bornée à 40 caractères. */
export function formatVersion(version: ParsedVersion): string {
  const text = version.numbers.join('.') + (version.pre.length ? `-${version.pre.join('.')}` : '')
  return text.slice(0, MAX_VERSION_LENGTH)
}

/**
 * Versions d'ACP que l'app sait parler. Le SDK ne propose que la sienne (`PROTOCOL_VERSION`) ; le
 * jour où il en proposera une autre, l'ajouter ici seulement après l'avoir essayée.
 */
export const SUPPORTED_PROTOCOLS: readonly number[] = [1]

/**
 * Version d'ACP choisie par l'agent à `initialize` : la spécification veut que le client coupe
 * s'il ne la connaît pas. `undefined` : prise en charge, ou non dite (tolérée). La version rendue
 * est nettoyée et bornée : elle est affichée et journalisée.
 */
export function incompatibleProtocol(
  announced: unknown,
  supported: readonly number[] = SUPPORTED_PROTOCOLS
): { announced: string; tooOld: boolean } | undefined {
  if (announced === undefined || announced === null) return undefined
  if (typeof announced === 'number' && supported.includes(announced)) return undefined
  const text = String(announced)
    .replace(/[^\w.-]/g, '')
    .slice(0, 20)
  const tooOld = typeof announced === 'number' && announced < Math.min(...supported)
  return { announced: text || '?', tooOld }
}
