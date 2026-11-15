/**
 * Polices livrées hors macOS (fiche 145, `src/renderer/src/bundled-fonts.css`) : Inter et
 * JetBrains Mono, copiées par Vite dans `out/renderer/assets/` (nom suivi d'une empreinte). Le Mac
 * garde SF Pro et SF Mono : ces fichiers sont exclus de son app par `files` (electron-builder.yml)
 * et remis dans les paquets Linux et Windows. Les contrôles des paquets vérifient l'un et l'autre.
 */

/** Fichiers livrés, tels que publiés (rsms/inter v4.1, JetBrains/JetBrainsMono v2.304). */
export const BUNDLED_FONT_FILES = [
  'InterVariable.woff2',
  'InterVariable-Italic.woff2',
  'JetBrainsMono-Regular.woff2',
  'JetBrainsMono-Italic.woff2',
  'JetBrainsMono-Medium.woff2',
  'JetBrainsMono-SemiBold.woff2',
  'JetBrainsMono-Bold.woff2'
]

/** Licences de ces polices (OFL 1.1), livrées dans `licenses/fonts/` des apps Linux et Windows. */
export const FONT_LICENSES = ['Inter-LICENSE.txt', 'JetBrainsMono-LICENSE.txt']

/** Exclusion de `files` à la racine (l'app Mac), retirée pour Linux et Windows. */
export const MAC_FONTS_EXCLUSION = '!out/renderer/assets/{InterVariable,JetBrainsMono}*.woff2'

/** Le fichier livré qu'est une entrée de l'archive (`out/renderer/assets/Inter…-<empreinte>.woff2`). */
function fontOf(entry) {
  const match = /^\/?out\/renderer\/assets\/([^/]+)-[\w-]{8}\.woff2$/.exec(
    entry.replace(/\\/g, '/')
  )
  return match && BUNDLED_FONT_FILES.includes(`${match[1]}.woff2`) ? `${match[1]}.woff2` : undefined
}

/** Polices livrées présentes dans une archive `app.asar`, d'après ses entrées. */
export function bundledFontsIn(entries) {
  return BUNDLED_FONT_FILES.filter((file) => entries.some((e) => fontOf(e) === file))
}

/** Ce qui manque à un paquet Linux ou Windows : chaque police livrée, dans l'archive. */
export function missingFonts(entries) {
  const present = bundledFontsIn(entries)
  return BUNDLED_FONT_FILES.filter((f) => !present.includes(f)).map(
    (f) => `police absente de app.asar : ${f}`
  )
}
