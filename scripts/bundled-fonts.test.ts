import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUNDLED_FONT_FILES, bundledFontsIn, missingFonts } from './bundled-fonts.mjs'

/** Feuilles de style du renderer (lues ici : les essais du renderer n'ont pas le disque). */
const RENDERER = join(import.meta.dirname, '..', 'src', 'renderer', 'src')
const css = (file: string) => readFileSync(join(RENDERER, file), 'utf8')

/** Feuilles `.css` d'un dossier et de ses sous-dossiers. */
function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? cssFiles(join(dir, e.name))
      : e.name.endsWith('.css')
        ? [join(dir, e.name)]
        : []
  )
}

/**
 * Règles d'une feuille : sélecteur et déclarations des blocs les plus intérieurs (une règle dans
 * `@media` comprise), commentaires retirés. Assez pour les feuilles de l'app, sans dépendance.
 */
function cssRules(sheet: string): { selector: string; declarations: string[] }[] {
  const text = sheet.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector:
      (m[1] ?? '')
        .trim()
        .split(/\s*;\s*/)
        .at(-1)
        ?.trim() ?? '',
    declarations: (m[2] ?? '')
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
  }))
}

describe('polices livrées (fiche 145, D9)', () => {
  it('Inter et JetBrains Mono en tête des piles, celles du système en repli', () => {
    const styles = css('styles.css')
    expect(styles).toContain("--font-ui: 'Bobine Inter', var(--font-system-ui);")
    expect(styles).toContain("--font-mono: 'Bobine JetBrains Mono', var(--font-system-mono);")
    // Piles du système d'avant, gardées pour le repli et le choix « système » des Réglages.
    expect(styles).toContain(
      "--font-system-ui: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;"
    )
    expect(styles).toContain("--font-system-mono: ui-monospace, 'SF Mono', Menlo, monospace;")
    const bundled = css('bundled-fonts.css')
    // Flèches d'Inter (`=>`, `!=`) coupées dans le texte de l'interface.
    expect(bundled).toMatch(/:root {[^}]*font-variant-ligatures: none;/)
    // Chaque fichier déclaré est livré (et seulement des woff2 locaux : aucun réseau).
    const urls = [...bundled.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1] ?? '')
    expect(urls.map((u) => u.split('/').at(-1)).sort()).toEqual([...BUNDLED_FONT_FILES].sort())
    for (const url of urls) expect(url.startsWith('./assets/fonts/')).toBe(true)
  })

  it('ligatures du code : toute règle CSS qui pose la police du code pose aussi le réglage', () => {
    // Garde-fou : une règle qui pose `var(--font-mono…)` ou `var(--font-code…)` sans
    // `font-variant-ligatures: var(--code-ligatures…)` hériterait de `none` (`:root`) : le réglage
    // y serait oublié en silence. Toutes les feuilles du renderer, composants compris.
    const sheets = cssFiles(RENDERER)
    expect(sheets.length).toBeGreaterThan(10)
    const offenders: string[] = []
    let checked = 0
    for (const file of sheets) {
      for (const rule of cssRules(readFileSync(file, 'utf8'))) {
        // Les définitions de variables (`--font-mono: …`) ne posent pas de police.
        const usesCode = rule.declarations.some(
          (d) => /^(font|font-family)\s*:/.test(d) && /var\(--font-(mono|code)\b/.test(d)
        )
        if (!usesCode) continue
        checked++
        const follows = rule.declarations.some((d) =>
          /^font-variant-ligatures\s*:\s*var\(--code-ligatures\b/.test(d)
        )
        if (!follows) offenders.push(`${relative(RENDERER, file)} : ${rule.selector}`)
      }
    }
    expect(checked).toBeGreaterThan(30)
    expect(offenders).toEqual([])
  })

  it('garde-fou : une règle oubliée est bien trouvée', () => {
    const rules = cssRules(`
      /* commentaire { font-family: var(--font-mono) } */
      .ok { font-family: var(--font-mono); font-variant-ligatures: var(--code-ligatures, none); }
      @media (min-width: 1px) { .oubli { font: 12px/1.4 var(--font-code, var(--font-mono)); } }
      :root { --font-mono: x; }
    `)
    expect(rules.map((r) => r.selector)).toEqual(['.ok', '.oubli', ':root'])
    expect(rules[1]?.declarations).toEqual(['font: 12px/1.4 var(--font-code, var(--font-mono))'])
  })

  it('fichiers publiés présents dans le dépôt, avec leur licence', () => {
    const fonts = join(RENDERER, 'assets', 'fonts')
    for (const file of BUNDLED_FONT_FILES) {
      expect(readFileSync(join(fonts, file)).subarray(0, 4).toString('latin1')).toBe('wOF2')
    }
    expect(readFileSync(join(fonts, 'Inter-LICENSE.txt'), 'utf8')).toContain('Open Font License')
    expect(readFileSync(join(fonts, 'JetBrainsMono-LICENSE.txt'), 'utf8')).toContain(
      'Open Font License'
    )
  })

  it('reconnues dans une archive par leur nom de Vite (nom publié, empreinte)', () => {
    const entries = [
      'out/renderer/assets/InterVariable-DiVDrmQJ.woff2',
      'out/renderer/assets/InterVariable-Italic-FCBEiFp6.woff2',
      'out/renderer/assets/JetBrainsMono-SemiBold-BM8Dc2t-.woff2',
      'out/renderer/assets/MesloLGSNerdFont-Regular-Di5MGlMh.ttf'
    ]
    expect(bundledFontsIn(entries)).toEqual([
      'InterVariable.woff2',
      'InterVariable-Italic.woff2',
      'JetBrainsMono-SemiBold.woff2'
    ])
    expect(missingFonts(entries)).toHaveLength(BUNDLED_FONT_FILES.length - 3)
    expect(bundledFontsIn(['node_modules/x/InterVariable-DiVDrmQJ.woff2'])).toEqual([])
  })
})
