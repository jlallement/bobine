/**
 * Palettes dans les essais (fiche 134) : chaque suite tourne en clair et en sombre ; celles qui
 * montrent du code, une sortie de commande, le terminal ou Mermaid prennent aussi une capture dans
 * la variante du mode, Sépia sur le clair et Nuit noire sur le sombre. Couleurs attendues tirées
 * des jetons (`src/shared/themes.ts`, chargé tel quel par Node).
 */
import { themeTokens } from '../src/shared/themes.ts'

/** Variante essayée dans ce mode. */
export const variantOf = (scheme) => (scheme === 'dark' ? 'black' : 'sepia')

/** Jetons d'une palette, accent par défaut (celui des essais). */
export const tokensOf = (palette) => themeTokens(palette, 'orange')

/** `#rrggbb` comme `getComputedStyle` l'écrit. */
export const rgb = (hex) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/**
 * Pose la palette sur la page comme `applyAppearance` (sans toucher aux préférences), lance `run`,
 * puis remet la palette d'avant.
 */
export async function withPalette(ui, palette, run) {
  const before = await ui.ev(`document.documentElement.dataset.palette ?? ''`)
  await ui.ev(`document.documentElement.dataset.palette = '${palette}'`)
  try {
    await run()
  } finally {
    await ui.ev(`document.documentElement.dataset.palette = '${before}'`)
  }
}
