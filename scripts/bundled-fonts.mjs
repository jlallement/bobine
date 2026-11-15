/**
 * Polices livrées avec l'app sur les trois systèmes (fiche 145, D9 ; ADR-0051,
 * `src/renderer/src/bundled-fonts.css`) : Inter et JetBrains Mono, copiées par Vite dans
 * `out/renderer/assets/` (nom suivi d'une empreinte). Les contrôles des paquets (.app, .deb,
 * Windows) vérifient qu'elles y sont, avec leurs licences.
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

/** Licences de ces polices (OFL 1.1), livrées dans `licenses/fonts/` de chaque app. */
export const FONT_LICENSES = ['Inter-LICENSE.txt', 'JetBrainsMono-LICENSE.txt']

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

/** Ce qui manque à un paquet : chaque police livrée, dans l'archive. */
export function missingFonts(entries) {
  const present = bundledFontsIn(entries)
  return BUNDLED_FONT_FILES.filter((f) => !present.includes(f)).map(
    (f) => `police absente de app.asar : ${f}`
  )
}
