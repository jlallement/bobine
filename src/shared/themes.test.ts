import { describe, expect, it } from 'vitest'
import { contrastRatio, luminance, mix } from './contrast'
import { ACCENT_COLORS } from './preferences'
import {
  ACCENTS,
  accentOf,
  cssVariables,
  DENSITY_TOKENS,
  densityVariables,
  PALETTES,
  paletteOf,
  PLAN_SOFT_PERCENT,
  RADIUS_TOKENS,
  radiusVariables,
  SYNTAX,
  themeTokens,
  windowBackground,
  type ThemeTokens
} from './themes'

/** Seuils de WCAG 2.x (niveau AA) : texte, et éléments d'interface (bordures, pastilles). */
const TEXT = 4.5
const UI = 3

type Role = Exclude<keyof ThemeTokens, 'scheme' | 'syn' | 'ansi' | 'chart' | 'heat'>

/** Couples à vérifier : [nom du texte, sa couleur, nom du fond, sa couleur, seuil]. */
function pairs(t: ThemeTokens): [string, string, string, string, number][] {
  const list: [string, string, string, string, number][] = []
  const on = (fg: string, color: string, backgrounds: Role[], min: number) => {
    for (const bg of backgrounds) list.push([fg, color, bg, t[bg], min])
  }
  for (const role of ['text', 'text2', 'muted'] as const) {
    on(role, t[role], ['bg', 'sidebar', 'surface', 'surface2'], TEXT)
  }
  on('ok', t.ok, ['bg', 'surface', 'surface2', 'okSoft', 'diffNew'], TEXT)
  on('warn', t.warn, ['bg', 'surface', 'surface2', 'warnSoft'], TEXT)
  on('err', t.err, ['bg', 'surface', 'surface2', 'errSoft', 'diffOld'], TEXT)
  on('text', t.text, ['diffOld', 'diffNew'], TEXT)
  // Avis sur fond orange doux : commande sans sortie, plafond atteint (fiche 157).
  on('text', t.text, ['warnSoft'], TEXT)
  // L'accent sert de lien (texte) et de pastille ou d'interrupteur (élément d'interface).
  on('accent', t.accent, ['bg', 'surface'], TEXT)
  // Arrêter pendant un tour (fiche 170) : icône `--text` sur le carré neutre `--surface-3`.
  on('text', t.text, ['surface3', 'border'], TEXT)
  // Envoyer sans rien à envoyer : flèche `--muted` sur `--surface-3` (élément d'interface).
  on('muted', t.muted, ['surface3'], UI)
  on('onAccent', t.onAccent, ['accent', 'accentHover'], TEXT)
  on('borderStrong', t.borderStrong, ['bg', 'surface'], UI)
  // Mode Plan (fiche 098) : ligne de rappel sur le fond, texte de la pastille sur son fond doux.
  on('plan', t.plan, ['bg'], TEXT)
  const planSoft = mix(t.plan, PLAN_SOFT_PERCENT[t.scheme], t.surface)
  list.push(['plan', t.plan, 'planSoft', planSoft, TEXT])
  on('codeFg', t.codeFg, ['codeBg'], TEXT)
  for (const name of SYNTAX) list.push([`syn-${name}`, t.syn[name], 'codeBg', t.codeBg, TEXT])
  // ANSI : sur le fond de la sortie de commande (fil) et du terminal (panneau). Le « papier »
  // (noir en sombre, blanc vif en clair) sert de fond (vidéo inverse, texte noir sur jaune) : il
  // n'est pas compté comme texte.
  const paper = t.scheme === 'dark' ? 0 : 15
  t.ansi.forEach((color, i) => {
    if (i !== paper) on(`ansi-${i}`, color, ['codeBg', 'surface'], TEXT)
  })
  // Graphique de consommation (fiche 137) : barres sur la carte du graphique (élément d'interface).
  t.chart.forEach((color, i) => on(`chart-${i + 1}`, color, ['surface'], UI))
  on('chartOther', t.chartOther, ['surface'], UI)
  return list
}

describe('jetons de thème (fiche 134)', () => {
  it('les accents sont ceux des préférences', () => {
    expect([...ACCENTS]).toEqual([...ACCENT_COLORS])
  })

  for (const palette of PALETTES) {
    for (const accent of ACCENTS) {
      it(`${palette}, accent ${accent} : contrastes AA`, () => {
        const failures = pairs(themeTokens(palette, accent))
          .map(([fg, color, bg, background, min]) => ({
            pair: `${fg} ${color} sur ${bg} ${background}`,
            ratio: Math.round(contrastRatio(color, background) * 100) / 100,
            min
          }))
          .filter(({ ratio, min }) => ratio < min)
        expect(failures).toEqual([])
      })
    }
  }

  // Grille d'activité (fiche 144) : chaque niveau s'éloigne de la carte, à un écart visible du
  // précédent ; le premier se voit sur la carte (2:1), le jour vide (`surface2`) reste discret.
  for (const palette of PALETTES) {
    it(`${palette} : niveaux de la grille d’activité, pour chaque accent`, () => {
      for (const accent of ACCENTS) {
        const t = themeTokens(palette, accent)
        const ratios = t.heat.map((color) => contrastRatio(color, t.surface))
        expect(t.heat, accent).toHaveLength(4)
        expect(ratios[0] ?? 0, `${accent} : premier niveau`).toBeGreaterThanOrEqual(2)
        ratios.slice(1).forEach((ratio, i) => {
          expect(ratio / (ratios[i] ?? 1), `${accent} : niveau ${i + 2}`).toBeGreaterThanOrEqual(
            1.2
          )
        })
        // Luminosité qui monte en sombre, qui descend en clair.
        const lum = t.heat.map((c) => luminance(c))
        const sorted = [...lum].sort((a, b) => (t.scheme === 'dark' ? a - b : b - a))
        expect(lum, accent).toEqual(sorted)
        expect(contrastRatio(t.surface2, t.surface)).toBeLessThan(ratios[0] ?? 0)
      }
    })
  }

  it('le mode Plan reste distinct de l’accent', () => {
    for (const palette of PALETTES) {
      for (const accent of ACCENTS) {
        const t = themeTokens(palette, accent)
        expect(t.plan).not.toBe(t.accent)
      }
    }
  })

  it('variables CSS : noms en kebab, coloration et ANSI', () => {
    const variables = cssVariables(themeTokens('light', 'orange'))
    expect(variables['--surface-2']).toBe('#f0eee6')
    expect(variables['--on-accent']).toBe('#ffffff')
    expect(variables['--syn-keyword']).toMatch(/^#/)
    expect(variables['--ansi-15']).toBe('#ffffff')
    expect(Object.keys(variables)).not.toContain('--scheme')
    expect(Object.keys(variables).filter((name) => name.startsWith('--ansi-'))).toHaveLength(16)
    expect(Object.keys(variables).filter((name) => name.startsWith('--heat-'))).toHaveLength(4)
  })

  it('palette affichée et fond des fenêtres au lancement', () => {
    expect(paletteOf('sepia', false)).toBe('sepia')
    // Une variante qui ne va pas avec le mode est ignorée, comme dans le CSS généré (fiche 136).
    expect(paletteOf('sepia', true)).toBe('dark')
    expect(paletteOf('black', false)).toBe('light')
    expect(paletteOf('', true)).toBe('dark')
    expect(paletteOf(undefined, false)).toBe('light')
    // Fjord (fiche 168) : chaque variante dans son mode seulement.
    expect(paletteOf('fjord', false)).toBe('fjord')
    expect(paletteOf('fjordNight', true)).toBe('fjordNight')
    expect(paletteOf('fjord', true)).toBe('dark')
    expect(paletteOf('fjordNight', false)).toBe('light')
    expect(
      windowBackground({ lightTheme: 'fjord', darkTheme: 'fjordNight', theme: 'system' }, true)
    ).toBe('#1a2028')
    expect(
      windowBackground({ lightTheme: 'fjord', darkTheme: 'fjordNight', theme: 'system' }, false)
    ).toBe('#f5f7fa')
    expect(accentOf('violet')).toBe('violet')
    expect(accentOf('rose')).toBe('orange')
    const themes = { lightTheme: 'sepia', darkTheme: 'black' } as const
    expect(windowBackground({ ...themes, theme: 'system' }, true)).toBe('#000000')
    expect(windowBackground({ ...themes, theme: 'system' }, false)).toBe('#f4ecd8')
    expect(windowBackground({ ...themes, theme: 'light' }, true)).toBe('#f4ecd8')
    expect(
      windowBackground({ lightTheme: 'light', darkTheme: 'dark', theme: 'system' }, true)
    ).toBe('#262624')
    expect(windowBackground({ lightTheme: 'light', darkTheme: 'dark', theme: 'light' }, true)).toBe(
      '#faf9f5'
    )
  })
})

describe('jetons de densité (fiche 159)', () => {
  it('la densité compacte resserre chaque espace, sans jamais en agrandir un', () => {
    for (const key of Object.keys(
      DENSITY_TOKENS.normal
    ) as (keyof typeof DENSITY_TOKENS.normal)[]) {
      expect(parseFloat(DENSITY_TOKENS.compact[key]), key).toBeLessThan(
        parseFloat(DENSITY_TOKENS.normal[key])
      )
    }
  })

  it('variables CSS : --density-* en kebab, les mêmes pour les deux densités', () => {
    const normal = densityVariables('normal')
    expect(normal['--density-thread-gap']).toBe('18px')
    expect(Object.keys(densityVariables('compact'))).toEqual(Object.keys(normal))
    expect(Object.keys(normal).every((name) => name.startsWith('--density-'))).toBe(true)
  })
})

describe('jetons de rayon (fiche 170)', () => {
  it('cinq crans croissants, la pastille en dernier', () => {
    const values = Object.values(RADIUS_TOKENS).map((v) => parseFloat(v))
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(RADIUS_TOKENS.pill).toBe('999px')
  })

  it('variables CSS : --radius-xs … --radius-pill', () => {
    expect(radiusVariables()).toEqual({
      '--radius-xs': '4px',
      '--radius-sm': '8px',
      '--radius-md': '12px',
      '--radius-lg': '20px',
      '--radius-pill': '999px'
    })
  })
})
