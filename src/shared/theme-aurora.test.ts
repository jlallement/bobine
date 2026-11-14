import { describe, expect, it } from 'vitest'
import { contrastRatio, mix } from './contrast'
import {
  actionEndHover,
  AURORA_PALETTES,
  AURORA_TINTS,
  AURORA_TOUCHES,
  GLOW_FADE,
  NEUTRAL_TOUCHES,
  touchFallbackVariables,
  touchVariables,
  type AuroraPalette,
  type Layer
} from './theme-aurora'
import { ACCENTS, PALETTES, themeTokens, type ThemeTokens } from './themes'

/**
 * Contrastes des touches d'Aurore (fiche 226, ADR-0049), mesurés là où le texte se pose vraiment :
 * aux deux bouts de chaque dégradé, sous la lueur de la barre latérale en tout point, à travers le
 * verre. Méthode des maquettes v3 (`contrast3.py`, `contrast3-lueur.py`), étendue à toute la
 * surface au lieu de quelques éléments.
 */
const TEXT = 4.5
const UI = 3

/** Une couche posée sur un fond opaque. */
const over = (layer: Layer, background: string) => mix(layer.color, layer.alpha * 100, background)

/** Largeurs de la barre latérale : minimum, défaut et maximum (fiche 113). */
const SIDEBAR_WIDTHS = [220, 300, 440]
/** Rien n'est écrit sous 8 px dans la barre latérale (les feux de la fenêtre). */
const FIRST_TEXT_Y = 8

/**
 * Couleur de la barre latérale au point (x, y) : le fond, puis les lueurs, la première dessus
 * (ordre des couches de `background-image`), chacune s'éteignant à `GLOW_FADE` de son rayon.
 */
function sidebarAt(palette: AuroraPalette, base: string, x: number, y: number, width: number) {
  let color = base
  for (const glow of [...AURORA_TOUCHES[palette].sidebar.glows].reverse()) {
    const distance = Math.hypot((x - glow.x * width) / glow.rx, (y - glow.y) / glow.ry)
    const fade = Math.max(0, 1 - distance / GLOW_FADE)
    color = mix(glow.color, glow.alpha * fade * 100, color)
  }
  return color
}

/** Tous les points de la barre latérale où la lueur se pose, pour chaque largeur et chaque fond. */
function sidebarPoints(palette: AuroraPalette): string[] {
  const points = new Set<string>()
  const glows = AURORA_TOUCHES[palette].sidebar.glows
  const reach = Math.max(...glows.map((g) => g.y + g.ry * GLOW_FADE)) + 4
  for (const base of AURORA_TOUCHES[palette].sidebar.stops) {
    for (const width of SIDEBAR_WIDTHS) {
      for (let y = FIRST_TEXT_Y; y <= reach; y += 2) {
        for (let x = 0; x <= width; x += 2) points.add(sidebarAt(palette, base, x, y, width))
      }
    }
  }
  return [...points]
}

/** Contraste le plus faible d'une couleur sur une liste de fonds. */
const worst = (color: string, backgrounds: readonly string[]) =>
  Math.min(...backgrounds.map((background) => contrastRatio(color, background)))

type TextRole = 'text' | 'text2' | 'muted' | 'accent' | 'ok' | 'warn' | 'err' | 'plan'

/** Échecs : [rôle sur zone, contraste arrondi] pour chaque rôle sous le seuil. */
function failures(
  t: ThemeTokens,
  zone: string,
  backgrounds: readonly string[],
  roles: readonly TextRole[],
  min: number
) {
  return roles
    .map((role) => ({ pair: `${role} sur ${zone}`, ratio: worst(t[role], backgrounds), min }))
    .filter(({ ratio }) => ratio < min)
    .map(({ pair, ratio }) => `${pair} : ${Math.round(ratio * 100) / 100} < ${min}`)
}

describe('touches d’Aurore (fiche 226) : contrastes', () => {
  for (const palette of AURORA_PALETTES) {
    const touches = AURORA_TOUCHES[palette]
    const { neutrals } = AURORA_TINTS[palette]
    const t = themeTokens(palette, 'orange')
    const sidebar = sidebarPoints(palette)

    it(`${palette} : sous la lueur de la barre latérale, en tout point et pour chaque largeur`, () => {
      expect([
        ...failures(t, 'la lueur', sidebar, ['text', 'text2', 'muted'], TEXT),
        // États des conversations et icônes : éléments d'interface.
        ...failures(t, 'la lueur (icônes)', sidebar, ['accent', 'ok', 'warn', 'err'], UI)
      ]).toEqual([])
    })

    it(`${palette} : conversation active, pastille posée sur la barre latérale`, () => {
      const pill = touches.pill.flatMap((layer) => sidebar.map((point) => over(layer, point)))
      expect(failures(t, 'la pastille', pill, ['text', 'text2', 'muted'], TEXT)).toEqual([])
    })

    it(`${palette} : haut du fil et panneau, aux deux bouts`, () => {
      const main = [touches.main.top, neutrals.bg]
      const panel = [touches.panel.top, neutrals.bg, over(touches.panelHead, touches.panel.top)]
      const roles = ['text', 'text2', 'muted', 'accent', 'ok', 'warn', 'err', 'plan'] as const
      expect([
        ...failures(t, 'le haut du fil', main, roles, TEXT),
        ...failures(t, 'le panneau', panel, roles, TEXT)
      ]).toEqual([])
    })

    it(`${palette} : carte d’autorisation et son pied, bulle de l’utilisateur`, () => {
      expect([
        ...failures(
          t,
          'la carte',
          touches.card,
          ['text', 'text2', 'muted', 'accent', 'warn'],
          TEXT
        ),
        ...failures(t, 'le pied de carte', touches.cardFoot, ['text', 'text2', 'muted'], TEXT),
        ...failures(t, 'la bulle', touches.bubble, ['text', 'text2', 'muted'], TEXT)
      ]).toEqual([])
    })

    it(`${palette} : verre des menus et des Réglages, sur le contenu flouté derrière`, () => {
      // Derrière le verre : le fond de la fenêtre, une carte, ou du texte flouté (le fond plus 20 %
      // de texte, méthode des maquettes).
      const behind = [neutrals.bg, neutrals.surface, neutrals.sidebar, mix(t.text, 20, t.bg)]
      const menu = behind.map((color) => over(touches.glass.menu, color))
      const sheet = behind.map((color) => over(touches.glass.sheet, color))
      const nav = sheet.map((color) => over(touches.glass.nav, color))
      const roles = ['text', 'text2', 'muted', 'accent'] as const
      expect([
        ...failures(t, 'le menu', menu, roles, TEXT),
        ...failures(t, 'les Réglages', sheet, roles, TEXT),
        ...failures(t, 'la colonne des Réglages', nav, roles, TEXT)
      ]).toEqual([])
    })

    it(`${palette} : texte de l’action principale aux deux bouts du dégradé, pour chaque accent`, () => {
      const failed = ACCENTS.flatMap((accent) => {
        const tint = AURORA_TINTS[palette].accents[accent]
        const ends = [
          tint.accent,
          touches.actionEnd[accent],
          tint.hover,
          actionEndHover(palette, accent)
        ]
        return ends
          .map((end) => ({ end, ratio: contrastRatio(tint.on, end) }))
          .filter(({ ratio }) => ratio < TEXT)
          .map(({ end, ratio }) => `${accent} : ${tint.on} sur ${end} ${ratio.toFixed(2)}`)
      })
      expect(failed).toEqual([])
    })
  }
})

describe('touches d’Aurore (fiche 226) : variables CSS', () => {
  it('les autres thèmes ont les valeurs neutres, et rien d’autre', () => {
    for (const palette of PALETTES.filter(
      (p) => !(AURORA_PALETTES as readonly string[]).includes(p)
    )) {
      for (const accent of ACCENTS) {
        expect(themeTokens(palette, accent).touch, `${palette} ${accent}`).toEqual(NEUTRAL_TOUCHES)
      }
    }
  })

  it('Aurore pose chaque variable neutre, et le repli n’en invente pas', () => {
    const neutral = Object.keys(NEUTRAL_TOUCHES).sort()
    for (const palette of AURORA_PALETTES) {
      for (const accent of ACCENTS) {
        expect(Object.keys(touchVariables(palette, accent)).sort()).toEqual(neutral)
        for (const name of Object.keys(touchFallbackVariables(palette, accent))) {
          expect(neutral, name).toContain(name)
        }
      }
    }
  })

  it('le dégradé d’action part de l’accent (maquettes v3, « Touches légères »)', () => {
    const night = touchVariables('auroraNight', 'orange')
    expect(night['--touch-action']).toBe('linear-gradient(135deg, #e8906f, #e88a9a)')
    expect(touchVariables('aurora', 'orange')['--touch-action']).toBe(
      'linear-gradient(135deg, #b5502f, #a8426a)'
    )
  })

  it('repli : verre opaque, lueur et fonds de base retirés, dégradés unis', () => {
    for (const palette of AURORA_PALETTES) {
      const fallback = touchFallbackVariables(palette, 'blue')
      expect(fallback['--glass-blur']).toBe('none')
      expect(fallback['--glass-blur-sheet']).toBe('none')
      expect(fallback['--glass-menu']).toBe('var(--surface)')
      expect(fallback['--touch-sidebar']).toBe('none')
      expect(fallback['--touch-main']).toBe('none')
      const accent = AURORA_TINTS[palette].accents.blue.accent
      expect(fallback['--touch-action']).toBe(`linear-gradient(180deg, ${accent}, ${accent})`)
      // Chaque dégradé restant est uni : ses deux bouts sont la même couleur.
      for (const [name, value] of Object.entries(fallback)) {
        const stops = /^linear-gradient\(180deg, (.+), (.+)\)$/.exec(value)
        if (stops) expect(stops[1], name).toBe(stops[2])
      }
    }
  })
})
