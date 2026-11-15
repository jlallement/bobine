import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUNDLED_FONT_FILES, bundledFontsIn, missingFonts } from './bundled-fonts.mjs'

/** Feuilles de style du renderer (lues ici : les essais du renderer n'ont pas le disque). */
const RENDERER = join(import.meta.dirname, '..', 'src', 'renderer', 'src')
const css = (file: string) => readFileSync(join(RENDERER, file), 'utf8')

describe('polices livrées hors macOS (fiche 145)', () => {
  it('piles du Mac inchangées ; Inter et JetBrains Mono seulement sous `html.bundled-fonts`', () => {
    const styles = css('styles.css')
    expect(styles).toContain(
      "--font-ui: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;"
    )
    expect(styles).toContain("--font-mono: ui-monospace, 'SF Mono', Menlo, monospace;")
    const bundled = css('bundled-fonts.css')
    const rules = bundled.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*{[^}]*}/g, '')
    expect(rules.match(/^[^\s{][^{]*(?={)/gm)?.map((s: string) => s.trim())).toEqual([
      'html.bundled-fonts'
    ])
    expect(bundled).toContain("--font-ui: 'Bobine Inter'")
    expect(bundled).toContain("--font-mono: 'Bobine JetBrains Mono'")
    // Chaque fichier déclaré est livré (et seulement des woff2 locaux : aucun réseau).
    const urls = [...bundled.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1] ?? '')
    expect(urls.map((u) => u.split('/').at(-1)).sort()).toEqual([...BUNDLED_FONT_FILES].sort())
    for (const url of urls) expect(url.startsWith('./assets/fonts/')).toBe(true)
  })

  it('ligatures du code : chaque police du code les suit, coupées par défaut', () => {
    for (const file of ['styles.css', 'roles.css', 'approval-rules.css']) {
      const sheet = css(file)
      const blocks = sheet
        .split('}')
        .filter((b: string) => /font(-family)?:[^;]*var\(--font-(mono|code)/.test(b))
      expect(blocks.length).toBeGreaterThan(0)
      for (const block of blocks) {
        expect(block).toContain('font-variant-ligatures: var(--code-ligatures, none);')
      }
    }
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
