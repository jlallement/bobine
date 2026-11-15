/**
 * Chemin d'un fichier de configuration montré à l'utilisateur avec `~` pour le dossier personnel
 * (`~/.bob/settings/settings.json`, `~/.config/opencode/opencode.json`). Une seule règle pour les
 * Réglages, l'export des rôles et le premier lancement (fiche 229, lot 7a : chacun la réécrivait
 * avec `/`, et sous Windows le chemin entier s'affichait).
 *
 * macOS et Linux : `~` seulement si le fichier est **sous** le dossier (`<home>/…`), comme avant.
 * Windows : sans casse, `\` ou `/` après le dossier (`C:\Users\ada\.bob\x` → `~\.bob\x`).
 */

/** Le reste du chemin après le dossier personnel (avec son séparateur), ou `undefined`. */
export function underHome(
  file: string,
  home: string,
  platform: NodeJS.Platform = process.platform
): string | undefined {
  if (platform !== 'win32') {
    const root = home.replace(/\/+$/, '')
    return file.startsWith(`${root}/`) ? file.slice(root.length) : undefined
  }
  const root = home.replace(/[\\/]+$/, '')
  const head = file.slice(0, root.length)
  const next = file.charAt(root.length)
  const inside = root !== '' && head.toLowerCase() === root.toLowerCase() && /[\\/]/.test(next)
  return inside ? file.slice(root.length) : undefined
}

/** `~/…` pour un fichier sous le dossier personnel ; le chemin tel quel sinon. */
export function homeShown(
  file: string,
  home: string,
  platform: NodeJS.Platform = process.platform
): string {
  const rest = underHome(file, home, platform)
  return rest === undefined ? file : `~${rest}`
}
