/**
 * Écrit src/renderer/src/themes.generated.css : les variables CSS des jetons de thème de
 * src/shared/themes.ts (fiche 134, ADR-0027). Un test (`themes-css.test.ts`, lancé par
 * `./scripts/verify`) échoue si le fichier n'est pas à jour.
 *
 *   pnpm themes-css
 *
 * Cascade : le clair sur `:root`, le sombre sous `prefers-color-scheme: dark` (le main règle
 * `nativeTheme`), puis Nuit noire, Fjord, Fjord nuit, Aurore et Aurore nuit sur `[data-palette]`,
 * chacun complet et seulement dans son mode (fiche 136 : en « Système », le thème choisi pour
 * chaque mode). Un accent autre que l'orange ne pose que ce qui change (`[data-accent]`, un cran
 * plus spécifique). Les touches d'Aurore (fiche 226, ADR-0049) ont un repli quand macOS demande
 * moins de transparence ou plus de contraste.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'
import {
  ACCENTS,
  cssVariables,
  densityVariables,
  PLAN_SOFT_PERCENT,
  radiusVariables,
  themeTokens,
  type Palette
} from '../src/shared/themes.ts'
import { touchFallbackVariables, type AuroraPalette } from '../src/shared/theme-aurora.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'src', 'renderer', 'src', 'themes.generated.css')

const block = (selector: string, variables: Record<string, string>) =>
  `${selector} {\n${Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')}\n}`

/** Règles d'une palette : tout sur `selector`, puis ce que change chaque accent. */
function paletteRules(palette: Palette, selector: string): string[] {
  const base = cssVariables(themeTokens(palette, 'orange'))
  const percent = PLAN_SOFT_PERCENT[themeTokens(palette, 'orange').scheme]
  const rules = [
    block(selector, {
      ...base,
      '--plan-soft': `color-mix(in srgb, var(--plan) ${percent}%, var(--surface))`
    })
  ]
  for (const accent of ACCENTS.filter((a) => a !== 'orange')) {
    const changed = Object.entries(cssVariables(themeTokens(palette, accent))).filter(
      ([name, value]) => base[name] !== value
    )
    rules.push(block(`${selector}[data-accent='${accent}']`, Object.fromEntries(changed)))
  }
  return rules
}

/** Repli des touches d'une palette d'Aurore, pour chaque accent (ce qui change seulement). */
function fallbackRules(palette: AuroraPalette, selector: string): string[] {
  const base = touchFallbackVariables(palette, 'orange')
  const rules = [block(selector, base)]
  for (const accent of ACCENTS.filter((a) => a !== 'orange')) {
    const changed = Object.entries(touchFallbackVariables(palette, accent)).filter(
      ([name, value]) => base[name] !== value
    )
    rules.push(block(`${selector}[data-accent='${accent}']`, Object.fromEntries(changed)))
  }
  return rules
}

/** « Réduire la transparence » ou « Augmenter le contraste » de macOS, dans un mode. */
const reduced = (scheme: 'light' | 'dark') =>
  `(prefers-color-scheme: ${scheme}) and (prefers-reduced-transparency: reduce), (prefers-color-scheme: ${scheme}) and (prefers-contrast: more)`

/** Contenu attendu du fichier, mis en forme comme le reste du dépôt. */
export async function generate(): Promise<string> {
  const css = [
    '/* Généré par scripts/themes-css.mts à partir de src/shared/themes.ts : ne pas modifier. */',
    block(':root', { ...radiusVariables(), ...densityVariables('normal') }),
    block(":root[data-density='compact']", densityVariables('compact')),
    ...paletteRules('light', ':root'),
    `@media (prefers-color-scheme: dark) {\n${paletteRules('dark', ':root').join('\n')}\n}`,
    `@media (prefers-color-scheme: dark) {\n${paletteRules('black', ":root[data-palette='black']").join('\n')}\n}`,
    `@media (prefers-color-scheme: light) {\n${paletteRules('fjord', ":root[data-palette='fjord']").join('\n')}\n}`,
    `@media (prefers-color-scheme: dark) {\n${paletteRules('fjordNight', ":root[data-palette='fjordNight']").join('\n')}\n}`,
    `@media (prefers-color-scheme: light) {\n${paletteRules('aurora', ":root[data-palette='aurora']").join('\n')}\n}`,
    `@media (prefers-color-scheme: dark) {\n${paletteRules('auroraNight', ":root[data-palette='auroraNight']").join('\n')}\n}`,
    `@media ${reduced('light')} {\n${fallbackRules('aurora', ":root[data-palette='aurora']").join('\n')}\n}`,
    `@media ${reduced('dark')} {\n${fallbackRules('auroraNight', ":root[data-palette='auroraNight']").join('\n')}\n}`
  ].join('\n\n')
  const options = await prettier.resolveConfig(target)
  return prettier.format(css, { ...options, filepath: target })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await generate()
  let current = ''
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    // Premier lancement : le fichier n'existe pas encore.
  }
  if (current !== code) writeFileSync(target, code)
}
