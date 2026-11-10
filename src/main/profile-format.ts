/**
 * Version du format du profil (fiche 196, ADR-0042) : `profile.json` à la racine du dossier de
 * données dit quel format de profil l'a écrit en dernier, et quelle version de Bobine.
 *
 * - Pas de marque : profil d'avant la 0.11 (0.1 à 0.10), format 1, lu tel quel.
 * - Format plus récent que celui de cette app : le profil s'ouvre en lecture seule (avis au
 *   lancement), rien n'y est écrit, déplacé ni supprimé.
 * - Même format, écrit par une Bobine plus récente (descente ordinaire) : une ligne au journal ;
 *   rien n'est perdu, les champs inconnus des réglages, autorisations et index sont gardés.
 *
 * On monte `PROFILE_FORMAT_VERSION` seulement quand une version plus ancienne ne saurait plus lire
 * le profil sans l'abîmer (renommage, changement de type d'un champ, autre structure de fichiers) ;
 * un ajout de champ ou de fichier ne la change pas.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compareVersionStrings } from './semver'
import { writeFileAtomic } from './storage'

export const PROFILE_FORMAT_VERSION = 1
export const PROFILE_FILE = 'profile.json'

export interface ProfileMark {
  formatVersion: number
  /** Version de Bobine qui l'a écrit en dernier. */
  app: string
}

export type ProfileCheck =
  /** `writtenBy` : version plus récente de Bobine qui l'a écrit en dernier (descente). */
  | { kind: 'ok'; writtenBy?: string }
  | { kind: 'newer'; formatVersion: number; app?: string }
  /** Marque présente mais illisible : par prudence, comme un format inconnu (lecture seule). */
  | { kind: 'unreadable' }

/**
 * Marque du profil : `undefined` si absente (profil d'avant la 0.11), `'unreadable'` si elle est là
 * mais ne se lit pas (JSON invalide, pas un objet, `formatVersion` qui n'est pas un entier).
 */
export function readProfileMark(userData: string): Partial<ProfileMark> | 'unreadable' | undefined {
  let text: string
  try {
    text = readFileSync(join(userData, PROFILE_FILE), 'utf8')
  } catch (error) {
    return (error as { code?: string }).code === 'ENOENT' ? undefined : 'unreadable'
  }
  try {
    const raw = JSON.parse(text) as unknown
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'unreadable'
    const r = raw as Record<string, unknown>
    const format = r['formatVersion']
    if (format !== undefined && !(Number.isInteger(format) && (format as number) >= 1)) {
      return 'unreadable'
    }
    return {
      ...(format !== undefined ? { formatVersion: format as number } : {}),
      ...(typeof r['app'] === 'string' ? { app: r['app'] } : {})
    }
  } catch {
    return 'unreadable'
  }
}

/** Le profil peut-il être écrit par cette app ? */
export function checkProfile(userData: string, appVersion: string): ProfileCheck {
  const mark = readProfileMark(userData)
  if (mark === 'unreadable') return { kind: 'unreadable' }
  const format = mark?.formatVersion ?? 1
  if (format > PROFILE_FORMAT_VERSION) {
    return { kind: 'newer', formatVersion: format, ...(mark?.app ? { app: mark.app } : {}) }
  }
  return mark?.app && compareVersions(mark.app, appVersion) > 0
    ? { kind: 'ok', writtenBy: mark.app }
    : { kind: 'ok' }
}

/** Pose la marque de cette app (sauf profil en lecture seule : `writeFileAtomic` n'écrit rien). */
export function markProfile(userData: string, appVersion: string): void {
  const mark: ProfileMark = { formatVersion: PROFILE_FORMAT_VERSION, app: appVersion }
  const current = readProfileMark(userData)
  // Illisible : jamais écrasée (le profil est alors en lecture seule, `openProfile`).
  if (current === 'unreadable') return
  if (current?.formatVersion === mark.formatVersion && current.app === mark.app) return
  writeFileAtomic(join(userData, PROFILE_FILE), `${JSON.stringify(mark, null, 2)}\n`)
}

/**
 * Compare deux versions de l'app dans l'ordre semver (fiche 218) : négatif, nul ou positif.
 * `1.0.0-beta.1 < 1.0.0-beta.2 < 1.0.0` ; un texte illisible est tenu pour égal.
 */
export function compareVersions(a: string, b: string): number {
  return compareVersionStrings(a, b)
}
