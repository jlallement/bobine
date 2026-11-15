/**
 * Chemins Windows (fiche 229, lot 3) : fonctions pures, sans `node:path` (le renderer s'en sert
 * aussi), qui reconnaissent une forme de chemin Windows et ce qu'un nom a de spécial sous NTFS.
 * Elles ne s'appliquent qu'à un chemin Windows (lettre de lecteur, `\\…`) : un chemin POSIX
 * (`/Users/…`) n'est jamais lu par elles, macOS et Linux ne changent pas.
 *
 * Ce qui est relevé (essais réels dans la VM Windows 11 ARM64 le 2026-11-15, fiche 229) :
 * - `doc.txt.` et `doc.txt ` : Node les crée tels quels, mais l'API Win32 ordinaire (celle d'un agent
 *   qui écrit sans préfixe `\\?\`) retire points et espaces finaux et écrit `doc.txt` ;
 * - `NUL`, `CON`, `COM1`… (avec ou sans extension) désignent des périphériques, pas des fichiers ;
 * - `doc.txt:flux` est un flux de données alternatif du fichier `doc.txt` ;
 * - `PROGRA~1`, `BOBINE~1` : noms courts 8.3 (actifs sur `C:`), autre orthographe d'un nom long ;
 *   l'alias d'un nom caché (`.env` → `ENV~1`) ne commence pas par un point.
 */

/** Chemin à lettre de lecteur complet : `C:\…` ou `C:/…` (pas `C:foo`, relatif au lecteur). */
export const isDriveAbsolute = (path: string): boolean => /^[A-Za-z]:[\\/]/.test(path)

/** Chemin de forme Windows : lettre de lecteur, ou `\\` (UNC, `\\?\`, `\\.\`). */
export const isWindowsPath = (path: string): boolean =>
  isDriveAbsolute(path) || path.startsWith('\\\\')

/** Les segments d'un chemin Windows (séparateurs `\` et `/`, vides retirés). */
export const windowsSegments = (path: string): string[] => path.split(/[\\/]+/).filter(Boolean)

/** Noms de périphériques réservés, avec ou sans extension (`NUL`, `nul.txt`, `COM¹`). */
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$|clock\$)$/i

/** Caractères qu'un nom de fichier Windows ne peut pas porter (`:` traité à part : flux). */
const INVALID = /[<>"|?*\u0000-\u001f]/

/** Ce qu'un nom (un seul segment) a de spécial sous Windows ; `undefined` s'il est ordinaire. */
export type WindowsNameProblem = 'reserved' | 'stream' | 'trailing' | 'short-name' | 'invalid'

export function windowsNameProblem(name: string): WindowsNameProblem | undefined {
  if (name.includes(':')) return 'stream'
  if (/[. ]$/.test(name)) return 'trailing'
  if (INVALID.test(name)) return 'invalid'
  const stem = name.split('.')[0]?.replace(/ +$/, '') ?? ''
  if (RESERVED.test(stem)) return 'reserved'
  if (/~\d/.test(name)) return 'short-name'
  return undefined
}

/**
 * Noms qui agissent quand l'Explorateur affiche ou ouvre le dossier (raccourcis, réglages du
 * dossier, exécution automatique) : jamais un simple document.
 */
export function actsWhenShown(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower === 'desktop.ini' ||
    lower === 'autorun.inf' ||
    /\.(lnk|url|scf|library-ms|searchconnector-ms)$/.test(lower)
  )
}

/** Comparaison sans casse (NTFS), séparateurs unifiés en `\`, sans `\` final (sauf racine). */
export function windowsKey(path: string): string {
  const unified = path.replace(/\//g, '\\')
  const trimmed = /^[A-Za-z]:\\$/.test(unified) ? unified : unified.replace(/\\+$/, '')
  return trimmed.toLowerCase()
}

/** `path` est `base` ou dedans (chemins Windows, sans casse) ; jamais `..` ni `.` : à normaliser avant. */
export function windowsWithin(path: string, base: string): boolean {
  const p = windowsKey(path)
  const b = windowsKey(base)
  return p === b || p.startsWith(b.endsWith('\\') ? b : `${b}\\`)
}

/**
 * Nom du dossier (dernier segment) pour un libellé : `/Users/ada/livres` → `livres`,
 * `C:\Users\ada\livres` → `livres`. Un chemin POSIX n'est coupé que sur `/` (un `\` y est un
 * caractère du nom) ; sans segment, le chemin tel quel.
 */
export function folderName(path: string): string {
  return lastSegment(path) ?? path
}

/** Dernier segment (comme `folderName`), `undefined` s'il n'y en a pas (`/`, vide). */
export function lastSegment(path: string): string | undefined {
  const parts = isWindowsPath(path) ? windowsSegments(path) : path.split('/').filter(Boolean)
  return parts.at(-1)
}
