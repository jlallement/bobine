/**
 * Thème Aurore (fiche 226, ADR-0049) : les palettes Aurore (clair) et Aurore nuit (sombre), et
 * leurs « touches » : lueur en haut de la barre latérale, dégradés doux, ombre teintée des cartes,
 * verre sur ce qui flotte. Les touches sont des **données** (couleurs, opacités, positions), pas des
 * chaînes CSS : `theme-aurora.test.ts` les compose pour mesurer le contraste de ce qui est vraiment
 * sous le texte. `touchVariables` en tire les variables CSS `--touch-*` et `--glass-*`, neutres
 * dans les autres thèmes (`aurora.css` les lit partout sans rien changer pour eux).
 *
 * Dosage « Touches légères » des maquettes v3 (validé le 14/11/2026) : pas de filet en haut du fil.
 * Lu par `themes.ts` ; aucune dépendance d'exécution (le script `pnpm themes-css` le charge tel quel).
 */
import type { AccentColor } from './preferences'
// Extension explicite : `pnpm themes-css` lit ce fichier avec Node, sans résolution de Vite.
import { mix } from './contrast.ts'
import type { PaletteTints } from './themes.ts'

/** Les deux palettes d'Aurore. */
export const AURORA_PALETTES = ['aurora', 'auroraNight'] as const
export type AuroraPalette = (typeof AURORA_PALETTES)[number]

/** Une couleur `#rrggbb` et son opacité. */
export interface Layer {
  color: string
  alpha: number
}

/**
 * Lueur : ellipse de rayons `rx` × `ry` (px) centrée à `x` (part de la largeur, 0 à 1) et `y` (px),
 * dont l'opacité décroît linéairement jusqu'à s'éteindre à `GLOW_FADE` du rayon, comme
 * `radial-gradient(rx ry at x y, couleur, transparent 70%)`.
 */
export interface Glow extends Layer {
  x: number
  y: number
  rx: number
  ry: number
}
export const GLOW_FADE = 0.7

/** Un dégradé vertical depuis `top` jusqu'au fond de la palette, atteint à `length` px. */
interface Wash {
  top: string
  length: number
}

/** Les touches d'une palette d'Aurore. */
export interface AuroraTouches {
  /** Barre latérale : fond vertical (haut, 45 %, bas) et lueurs en haut (touche 1). */
  sidebar: { stops: readonly [string, string, string]; glows: readonly Glow[] }
  /** Haut du fil, éteint à `length` px (dégradé de base). */
  main: Wash
  /** Panneau de droite et son en-tête (dégradés de base). */
  panel: Wash
  panelHead: Layer
  /** Carte d'autorisation et de plan : fond (haut, 60 %), pied, et ombre teintée (touche 5). */
  card: readonly [string, string]
  cardFoot: readonly [string, string]
  cardShadow: readonly [tint: Layer, contact: Layer]
  /** Bulle de l'utilisateur, deux tons (touche 2). */
  bubble: readonly [string, string]
  /** Liseré de la saisie au focus et son halo (touche 3). */
  ring: readonly [Layer, Layer]
  ringGlow: Layer
  /** Fin du dégradé de l'action principale pour chaque accent ; le départ est l'accent (touche 4). */
  actionEnd: Record<AccentColor, string>
  /** Conversation active : pastille posée sur la barre latérale (touche 4). */
  pill: readonly [Layer, Layer]
  /** Verre de ce qui flotte : menus et popovers, fenêtre des Réglages et sa colonne (touche 6). */
  glass: { menu: Layer; sheet: Layer; nav: Layer; line: Layer; highlight: Layer }
}

export const AURORA_TINTS: Record<AuroraPalette, PaletteTints> = {
  // Aurore (mode clair) : blanc à peine froid, encre bleutée.
  aurora: {
    scheme: 'light',
    neutrals: {
      bg: '#fbfcfe',
      sidebar: '#f3f5fa',
      surface: '#ffffff',
      surface2: '#eef1f7',
      surface3: '#e4e8f1',
      border: '#e1e5ee',
      borderStrong: '#858c9b',
      text: '#1b1f2a',
      text2: '#3c4352',
      muted: '#5c6372',
      codeBg: '#f6f7fb',
      codeFg: '#1b1f2a',
      ansi: ['#1b1f2a', '#5c6372', '#4a5160', '#ffffff']
    },
    hues: {
      red: '#b4232f',
      redBright: '#c0303c',
      redSoft: '#fce7ea',
      orange: '#8c490c',
      amber: '#8a5a0f',
      amberSoft: '#fbf1df',
      yellow: '#735300',
      yellowBright: '#815e00',
      green: '#17703c',
      greenBright: '#22804a',
      greenSoft: '#e4f4ea',
      cyan: '#0c6672',
      cyanBright: '#137582',
      blue: '#1f5ab6',
      blueBright: '#2966cc',
      violet: '#6d3fd0',
      magenta: '#952d77',
      magentaBright: '#a23684'
    },
    accents: {
      orange: { accent: '#b5502f', hover: '#a04628', on: '#ffffff' },
      blue: { accent: '#2a66cf', hover: '#2158bb', on: '#ffffff' },
      green: { accent: '#24784d', hover: '#1e6741', on: '#ffffff' },
      violet: { accent: '#714fce', hover: '#6240c2', on: '#ffffff' },
      pink: { accent: '#b0316b', hover: '#9c2a5e', on: '#ffffff' },
      graphite: { accent: '#596473', hover: '#4a5462', on: '#ffffff' }
    }
  },
  // Aurore nuit (mode sombre) : anthracite légèrement bleuté.
  auroraNight: {
    scheme: 'dark',
    neutrals: {
      bg: '#15171d',
      sidebar: '#111318',
      surface: '#1c1f27',
      surface2: '#232732',
      surface3: '#2c3140',
      border: '#2a2e39',
      borderStrong: '#6f7686',
      text: '#eef0f6',
      text2: '#cfd3de',
      muted: '#9ea4b3',
      codeBg: '#111318',
      codeFg: '#e3e6ee',
      ansi: ['#0b0c10', '#e3e6ee', '#9ea4b3', '#ffffff']
    },
    hues: {
      red: '#f38c95',
      redBright: '#ffa8ae',
      redSoft: '#3d2328',
      orange: '#f0a86c',
      amber: '#e9b65c',
      amberSoft: '#362d1d',
      yellow: '#e9c76e',
      yellowBright: '#f5da8e',
      green: '#7fd6a0',
      greenBright: '#a8eabf',
      greenSoft: '#1d3329',
      cyan: '#6fd0c0',
      cyanBright: '#9be6da',
      blue: '#6c9be0',
      blueBright: '#a2c8f8',
      violet: '#c3a6f6',
      magenta: '#de9fdc',
      magentaBright: '#ebbdee'
    },
    accents: {
      orange: { accent: '#e8906f', hover: '#eda287', on: '#15171d' },
      blue: { accent: '#72a2f2', hover: '#8db4f5', on: '#15171d' },
      green: { accent: '#5fbe87', hover: '#78ca9a', on: '#15171d' },
      violet: { accent: '#a88cf0', hover: '#b9a2f3', on: '#15171d' },
      pink: { accent: '#e47fad', hover: '#ea98bd', on: '#15171d' },
      graphite: { accent: '#a9b0bd', hover: '#bac0cb', on: '#15171d' }
    }
  }
}

export const AURORA_TOUCHES: Record<AuroraPalette, AuroraTouches> = {
  aurora: {
    sidebar: {
      stops: ['#f3f2fc', '#f3f5fa', '#f1f6f7'],
      glows: [
        { x: 0.25, y: -10, rx: 280, ry: 150, color: '#a78bfa', alpha: 0.26 },
        { x: 0.9, y: 0, rx: 200, ry: 120, color: '#2dd4bf', alpha: 0.18 }
      ]
    },
    main: { top: '#f7f6fe', length: 260 },
    panel: { top: '#f6f7fd', length: 300 },
    panelHead: { color: '#a78bfa', alpha: 0.06 },
    card: ['#ffffff', '#fbfaff'],
    cardFoot: ['#f3f2fb', '#eff1f8'],
    cardShadow: [
      { color: '#7c3aed', alpha: 0.26 },
      { color: '#141e3c', alpha: 0.05 }
    ],
    bubble: ['#efeafe', '#e6f5f4'],
    ring: [
      { color: '#c4b5fd', alpha: 1 },
      { color: '#99f6e4', alpha: 1 }
    ],
    ringGlow: { color: '#8b5cf6', alpha: 0.08 },
    // Vers le prune, quel que soit l'accent (maquettes v3).
    actionEnd: {
      orange: '#a8426a',
      blue: '#5048c8',
      violet: '#9040b0',
      pink: '#a33a8c',
      green: '#16716f',
      graphite: '#5a5874'
    },
    pill: [
      { color: '#ece6fd', alpha: 1 },
      { color: '#e7f4f4', alpha: 1 }
    ],
    glass: {
      menu: { color: '#ffffff', alpha: 0.82 },
      sheet: { color: '#ffffff', alpha: 0.85 },
      nav: { color: '#f3f5fa', alpha: 0.55 },
      line: { color: '#ffffff', alpha: 0.85 },
      highlight: { color: '#ffffff', alpha: 0.9 }
    }
  },
  auroraNight: {
    sidebar: {
      stops: ['#15151f', '#111318', '#101217'],
      glows: [
        { x: 0.25, y: -10, rx: 280, ry: 150, color: '#8b5cf6', alpha: 0.22 },
        { x: 0.9, y: 0, rx: 200, ry: 120, color: '#2dd4bf', alpha: 0.13 }
      ]
    },
    main: { top: '#181826', length: 260 },
    panel: { top: '#171a22', length: 300 },
    panelHead: { color: '#8b5cf6', alpha: 0.05 },
    card: ['#1f2130', '#1c1f27'],
    cardFoot: ['#232634', '#222531'],
    cardShadow: [
      { color: '#8b5cf6', alpha: 0.4 },
      { color: '#000000', alpha: 0.3 }
    ],
    bubble: ['#2a2741', '#222d38'],
    ring: [
      { color: '#a78bfa', alpha: 0.7 },
      { color: '#2dd4bf', alpha: 0.55 }
    ],
    ringGlow: { color: '#8b5cf6', alpha: 0.1 },
    // Vers le rose, quel que soit l'accent (maquettes v3).
    actionEnd: {
      orange: '#e88a9a',
      blue: '#8f95ef',
      violet: '#c48be6',
      pink: '#d38ce0',
      green: '#4fbcae',
      graphite: '#a9a8c0'
    },
    pill: [
      { color: '#8b5cf6', alpha: 0.16 },
      { color: '#2dd4bf', alpha: 0.07 }
    ],
    glass: {
      menu: { color: '#1e212b', alpha: 0.82 },
      sheet: { color: '#181b23', alpha: 0.85 },
      nav: { color: '#ffffff', alpha: 0.025 },
      line: { color: '#ffffff', alpha: 0.09 },
      highlight: { color: '#ffffff', alpha: 0.07 }
    }
  }
}

export function isAuroraPalette(palette: string): palette is AuroraPalette {
  return (AURORA_PALETTES as readonly string[]).includes(palette)
}

/** `rgb(r g b / a)` d'une couche. */
export function rgba({ color, alpha }: Layer): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

/** Fin du dégradé d'action au survol : comme le survol de l'accent, plus clair en sombre. */
export function actionEndHover(palette: AuroraPalette, accent: AccentColor): string {
  const end = AURORA_TOUCHES[palette].actionEnd[accent]
  return AURORA_TINTS[palette].scheme === 'dark' ? mix(end, 85, '#ffffff') : mix(end, 88, '#000000')
}

/**
 * Variables neutres, celles de tous les thèmes sans touches : `aurora.css` les lit sans rien
 * changer à l'aspect (aucune image de fond, les fonds et ombres d'avant).
 */
export const NEUTRAL_TOUCHES: Readonly<Record<string, string>> = {
  '--touch-sidebar': 'none',
  '--touch-main': 'none',
  '--touch-panel': 'none',
  '--touch-panel-head': 'none',
  '--touch-card': 'none',
  '--touch-card-foot': 'none',
  '--touch-card-border': 'var(--border-strong)',
  '--touch-card-shadow': 'var(--shadow)',
  '--touch-bubble': 'none',
  '--touch-ring': 'none',
  '--touch-ring-border': 'var(--border-strong)',
  '--touch-ring-glow': 'var(--shadow)',
  '--touch-action': 'none',
  '--touch-action-hover': 'none',
  '--touch-pill': 'none',
  '--touch-pill-base': 'var(--surface-3)',
  '--glass-menu': 'var(--surface)',
  '--glass-menu-line': 'var(--border)',
  '--glass-menu-shadow': 'var(--shadow-menu)',
  '--glass-sheet': 'var(--surface)',
  '--glass-sheet-shadow': 'var(--shadow-menu)',
  '--glass-nav': 'var(--sidebar)',
  '--glass-blur': 'none',
  '--glass-blur-sheet': 'none'
}

const linear = (angle: string, stops: string[]) => `linear-gradient(${angle}, ${stops.join(', ')})`
/** Un dégradé uni (repli) : la même couleur aux deux bouts. */
const solid = (color: string) => linear('180deg', [color, color])

/** Variables CSS des touches d'une palette d'Aurore, pour un accent. */
function auroraVariables(palette: AuroraPalette, accent: AccentColor): Record<string, string> {
  const t = AURORA_TOUCHES[palette]
  const { neutrals, accents } = AURORA_TINTS[palette]
  const tint = accents[accent]
  const glows = t.sidebar.glows.map(
    (g) =>
      `radial-gradient(${g.rx}px ${g.ry}px at ${g.x * 100}% ${g.y}px, ${rgba(g)}, transparent ${GLOW_FADE * 100}%)`
  )
  const [top, middle, bottom] = t.sidebar.stops
  const [tintShadow, contact] = t.cardShadow
  return {
    '--touch-sidebar': [
      ...glows,
      linear('180deg', [`${top} 0%`, `${middle} 45%`, `${bottom} 100%`])
    ].join(', '),
    '--touch-main': linear('180deg', [`${t.main.top} 0`, `${neutrals.bg} ${t.main.length}px`]),
    '--touch-panel': linear('180deg', [`${t.panel.top} 0`, `${neutrals.bg} ${t.panel.length}px`]),
    '--touch-panel-head': linear('180deg', [rgba(t.panelHead), 'transparent']),
    '--touch-card': linear('180deg', [t.card[0], `${t.card[1]} 60%`]),
    '--touch-card-foot': linear('180deg', [...t.cardFoot]),
    '--touch-card-border': 'var(--border)',
    '--touch-card-shadow': `0 12px 30px -18px ${rgba(tintShadow)}, 0 1px 3px ${rgba(contact)}`,
    '--touch-bubble': linear('135deg', [...t.bubble]),
    '--touch-ring': linear('120deg', t.ring.map(rgba)),
    '--touch-ring-border': 'transparent',
    '--touch-ring-glow': `0 0 0 3px ${rgba(t.ringGlow)}, var(--shadow)`,
    '--touch-action': linear('135deg', [tint.accent, t.actionEnd[accent]]),
    '--touch-action-hover': linear('135deg', [tint.hover, actionEndHover(palette, accent)]),
    '--touch-pill': linear('90deg', t.pill.map(rgba)),
    '--touch-pill-base': 'transparent',
    '--glass-menu': rgba(t.glass.menu),
    '--glass-menu-line': rgba(t.glass.line),
    '--glass-menu-shadow': `inset 0 1px 0 ${rgba(t.glass.highlight)}, var(--shadow-menu)`,
    '--glass-sheet': rgba(t.glass.sheet),
    '--glass-sheet-shadow': `inset 0 1px 0 ${rgba(t.glass.highlight)}, 0 0 0 1px ${rgba(t.glass.line)}, var(--shadow-menu)`,
    '--glass-nav': rgba(t.glass.nav),
    '--glass-blur': 'blur(24px) saturate(150%)',
    '--glass-blur-sheet': 'blur(30px) saturate(150%)'
  }
}

/** Variables des touches d'une palette : celles d'Aurore, ou les neutres pour les autres. */
export function touchVariables(palette: string, accent: AccentColor): Record<string, string> {
  return isAuroraPalette(palette) ? auroraVariables(palette, accent) : { ...NEUTRAL_TOUCHES }
}

/**
 * Repli d'Aurore quand macOS demande moins de transparence ou plus de contraste : verre opaque,
 * lueur et fonds de base retirés (la couleur de la palette), touches en dégradé unies (leur
 * couleur de départ). Les ombres restent.
 */
export function touchFallbackVariables(
  palette: AuroraPalette,
  accent: AccentColor
): Record<string, string> {
  const t = AURORA_TOUCHES[palette]
  const tint = AURORA_TINTS[palette].accents[accent]
  const [first] = t.ring
  const [pill] = t.pill
  return {
    '--touch-sidebar': 'none',
    '--touch-main': 'none',
    '--touch-panel': 'none',
    '--touch-panel-head': 'none',
    '--touch-card': 'none',
    '--touch-card-foot': 'none',
    '--touch-card-border': 'var(--border-strong)',
    '--touch-bubble': solid(t.bubble[0]),
    '--touch-ring': solid(rgba(first)),
    '--touch-action': solid(tint.accent),
    '--touch-action-hover': solid(tint.hover),
    '--touch-pill': solid(rgba(pill)),
    '--glass-menu': 'var(--surface)',
    '--glass-menu-line': 'var(--border)',
    '--glass-menu-shadow': 'var(--shadow-menu)',
    '--glass-sheet': 'var(--surface)',
    '--glass-sheet-shadow': 'var(--shadow-menu)',
    '--glass-nav': 'var(--sidebar)',
    '--glass-blur': 'none',
    '--glass-blur-sheet': 'none'
  }
}

/** Fond de la vignette d'Aurore (Réglages › Apparence) : lueur en haut à gauche sur le fond. */
export function auroraThumbnail(palette: AuroraPalette): { background: string; line: string } {
  const [glow] = AURORA_TOUCHES[palette].sidebar.glows
  const { bg } = AURORA_TINTS[palette].neutrals
  const accent = AURORA_TINTS[palette].accents.orange.accent
  return {
    background: `radial-gradient(34px 16px at 20% 0, ${rgba({ color: glow?.color ?? bg, alpha: 0.6 })}, transparent), ${bg}`,
    line: linear('90deg', [accent, AURORA_TOUCHES[palette].actionEnd.orange])
  }
}
