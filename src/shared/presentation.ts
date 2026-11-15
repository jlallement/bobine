/**
 * Mode présentation (fiche 159) : démo ou partage d'écran. Ce qui se règle ici est pur ; l'état
 * (actif ou non) vit dans le main (`main/presentation.ts`), jamais dans `settings.json`.
 */

import { isDriveAbsolute, isWindowsPath, windowsKey } from './windows-paths.ts'

/** Pixels ajoutés à la taille du texte du fil quand le mode est actif. */
export const PRESENTATION_FONT_BOOST = 3

/**
 * Dossier personnel d'un chemin d'affichage remplacé par `~` : `/Users/ada/livres` →
 * `~/livres`. Avec `home`, celui-là ; sans, tout `/Users/<nom>` (macOS) ou `/home/<nom>` (Linux),
 * ou `C:\Users\<nom>` (Windows, sans casse, fiche 229). Un chemin voisin au nom qui commence
 * pareil (`/Users/adam` pour `/Users/ada`) n'est pas touché.
 */
export function abbreviateHome(path: string, home?: string): string {
  if (home && isDriveAbsolute(home)) {
    const base = home.replace(/[\\/]+$/, '')
    const head = path.slice(0, base.length)
    const next = path.charAt(base.length)
    const within = windowsKey(head) === windowsKey(base) && (next === '' || /[\\/]/.test(next))
    return within ? `~${path.slice(base.length)}` : path
  }
  if (!home && isDriveAbsolute(path)) return path.replace(WINDOWS_HOME, '~')
  if (home) {
    const base = home.replace(/\/+$/, '')
    return path === base || path.startsWith(`${base}/`) ? `~${path.slice(base.length)}` : path
  }
  return path.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, '~')
}

/** Dossier personnel d'un chemin Windows : `C:\Users\<nom>`. */
const WINDOWS_HOME = /^[a-z]:[\\/]Users[\\/][^\\/]+(?=[\\/]|$)/i

/**
 * Chemins du dossier personnel rendus en `~` dans un texte libre (infobulle, commande) : chaque
 * mot qui commence par `/Users/<nom>` ou `/home/<nom>`, ou `C:\Users\<nom>` (Windows).
 */
export function abbreviateHomeIn(text: string): string {
  return text
    .replace(/(^|[\s"'`(=:])\/(?:Users|home)\/[^/\s"'`)]+(?=\/|[\s"'`)]|$)/g, '$1~')
    .replace(/(^|[\s"'`(=])[a-z]:[\\/]Users[\\/][^\\/\s"'`)]+(?=[\\/]|[\s"'`)]|$)/gi, '$1~')
}

/**
 * Chemin à couper au milieu (recette 0.11, C2) : le dossier personnel en `~`, puis le début
 * (`dir`, qui peut être coupé avec « … ») et le nom du dossier (`name`, toujours entier). Un chemin
 * sans parent (`~`, `/`, `projet`) n'a que `name`.
 */
export function pathParts(path: string, home?: string): { dir: string; name: string } {
  const shown = abbreviateHome(path, home)
  const windows = isWindowsPath(path)
  const trimmed = shown.length > 1 ? shown.replace(windows ? /[\\/]+$/ : /\/+$/, '') : shown
  const cut = windows
    ? Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
    : trimmed.lastIndexOf('/')
  if (cut < 0 || trimmed === '/') return { dir: '', name: trimmed }
  return { dir: trimmed.slice(0, cut + 1), name: trimmed.slice(cut + 1) }
}
