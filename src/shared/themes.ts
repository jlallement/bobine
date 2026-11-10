/**
 * Jetons de thème (fiche 134, ADR-0027) : la source unique des couleurs de l'interface. Rien
 * d'autre ne définit de couleur de thème : `scripts/themes-css.mts` en tire
 * `src/renderer/src/themes.generated.css` (variables CSS), et le terminal, Mermaid et le fond des
 * fenêtres au lancement lisent `themeTokens()`. `themes.test.ts` vérifie les contrastes de chaque
 * palette avec chaque accent : c'est la raison d'être de ce fichier, et pourquoi il n'y a ni thème
 * importable ni accent libre.
 *
 * Trois couches :
 * 1. **teintes de base** de chaque palette : neutres (fonds, bordures, textes), teintes vives
 *    (rouge, vert, bleu…), et une teinte par accent ;
 * 2. **rôles** de l'interface (`--bg`, `--muted`, `--accent`, `--ok`, `--diff-new`…), tirés des
 *    teintes de la même façon dans toutes les palettes ;
 * 3. **jetons de domaine** : blocs de code (`--code-*`), coloration syntaxique (`--syn-*`) et les
 *    16 couleurs ANSI (`--ansi-0…15`) de la sortie de commande et du terminal.
 *
 * Aucune dépendance d'exécution : le script de génération charge ce fichier tel quel.
 */
import type { AccentColor, DarkTheme, Density, LightTheme, ThemePreference } from './preferences'
// Extension explicite : `pnpm themes-css` lit ce fichier avec Node, sans résolution de Vite.
import { contrastRatio, mix } from './contrast.ts'

/**
 * Palettes : Clair, Sombre, leurs variantes Sépia (claire) et Nuit noire (sombre), et le thème
 * Fjord en deux variantes, Fjord (claire) et Fjord nuit (sombre, fiche 168).
 */
export const PALETTES = ['light', 'dark', 'sepia', 'black', 'fjord', 'fjordNight'] as const

/** Palettes posées sur la page (`data-palette`) : toutes sauf Clair et Sombre, celles de `:root`. */
export const VARIANT_PALETTES = [
  'sepia',
  'black',
  'fjord',
  'fjordNight'
] as const satisfies readonly Palette[]
export type Palette = (typeof PALETTES)[number]

/** Accents proposés dans les réglages ; l'orange est celui par défaut. */
export const ACCENTS = [
  'orange',
  'blue',
  'violet',
  'pink',
  'green',
  'graphite'
] as const satisfies readonly AccentColor[]

/** Couleurs neutres d'une palette, du fond au texte. */
interface Neutrals {
  bg: string
  sidebar: string
  surface: string
  surface2: string
  surface3: string
  border: string
  /** Bordure des champs et des éléments à repérer : 3:1 au moins sur le fond. */
  borderStrong: string
  text: string
  text2: string
  muted: string
  codeBg: string
  codeFg: string
  /**
   * ANSI 0, 7, 8 et 15 : noir, blanc, noir vif, blanc vif. Le « papier » (noir en sombre, blanc vif
   * en clair) reste celui des fonds : texte noir sur une couleur, invites « powerline ».
   */
  ansi: readonly [string, string, string, string]
}

/**
 * Teintes vives d'une palette, chacune lisible en texte sur les fonds de la palette. En sombre, le
 * bleu reste au plus foncé qui passe 4,5:1 : il sert aussi de fond aux invites (powerlevel10k pose
 * le dossier en blanc sur le bleu ANSI).
 */
interface Hues {
  red: string
  redBright: string
  redSoft: string
  orange: string
  amber: string
  amberSoft: string
  yellow: string
  yellowBright: string
  green: string
  greenBright: string
  greenSoft: string
  cyan: string
  cyanBright: string
  blue: string
  blueBright: string
  violet: string
  magenta: string
  magentaBright: string
}

/** Une teinte d'accent : la couleur, son survol, et le texte posé dessus. */
interface AccentTint {
  accent: string
  hover: string
  on: string
}

/** Couche 1 : les teintes de base d'une palette. */
interface PaletteTints {
  scheme: 'light' | 'dark'
  neutrals: Neutrals
  hues: Hues
  accents: Record<AccentColor, AccentTint>
}

const SHADOWS = {
  light: {
    shadow: '0 1px 3px rgb(0 0 0 / 0.05), 0 4px 16px rgb(0 0 0 / 0.04)',
    shadowMenu: '0 4px 24px rgb(0 0 0 / 0.1), 0 1px 3px rgb(0 0 0 / 0.06)'
  },
  dark: {
    shadow: '0 1px 3px rgb(0 0 0 / 0.3), 0 4px 16px rgb(0 0 0 / 0.2)',
    shadowMenu: '0 4px 24px rgb(0 0 0 / 0.45), 0 1px 3px rgb(0 0 0 / 0.3)'
  }
} as const

/**
 * Couleurs du graphique de consommation (fiche 137), dans un ordre fixe (`--chart-1…3`) : un agent
 * ou un modèle garde la sienne (`chartSlot` du profil), jamais selon son rang. Validées par le
 * validateur de palette (daltonisme et vision normale, toutes paires, sur `surface`) : les barres
 * empilées sont séparées d'un filet et chaque série est nommée (légende, infobulle). Sépia et Nuit
 * noire reprennent celles de leur mode. Au-delà : « Autres », en `borderStrong`.
 */
export const CHART = {
  light: ['#c96442', '#4a78c2', '#0f9d8a'],
  dark: ['#cf6b48', '#5a85cc', '#14a893']
} as const

/**
 * Grille d'activité de « Mon activité » (fiche 144) : quatre niveaux tirés de l'accent, de plus en
 * plus loin de la carte (`surface`) ; le jour vide prend `--surface-2`. Le premier niveau est le
 * mélange d'accent le plus léger qui atteint `HEAT_FIRST` contre la carte ; le deuxième est à
 * mi-chemin de l'accent ; le troisième est l'accent ; le quatrième va vers le texte (plus sombre en
 * clair, plus lumineux en sombre).
 */
export const HEAT_FIRST = 2.1
const HEAT_DEEP_PERCENT = 55

export function heatScale(accent: string, surface: string, text: string): string[] {
  let first = 100
  for (let percent = 20; percent <= 100; percent += 2) {
    if (contrastRatio(mix(accent, percent, surface), surface) >= HEAT_FIRST) {
      first = percent
      break
    }
  }
  return [
    mix(accent, first, surface),
    mix(accent, Math.round((first + 100) / 2), surface),
    accent,
    mix(accent, HEAT_DEEP_PERCENT, text)
  ]
}

/** Part de `--plan` dans `--plan-soft` (fond de la pastille du mode Plan, fiche 098). */
export const PLAN_SOFT_PERCENT = { light: 13, dark: 14 } as const

export const TINTS: Record<Palette, PaletteTints> = {
  // Clair : papier chaud, dans l'esprit de Claude Desktop.
  light: {
    scheme: 'light',
    neutrals: {
      bg: '#faf9f5',
      sidebar: '#f3f1ea',
      surface: '#ffffff',
      surface2: '#f0eee6',
      surface3: '#e8e5db',
      border: '#e3e0d6',
      borderStrong: '#8f8b81',
      text: '#2b2a26',
      text2: '#4d4b45',
      muted: '#6d6b64',
      codeBg: '#f4f2ec',
      codeFg: '#2b2a26',
      ansi: ['#2b2a26', '#6d6b64', '#57554f', '#ffffff']
    },
    hues: {
      red: '#b3261e',
      redBright: '#c0392b',
      redSoft: '#fbe7e4',
      orange: '#8a4b08',
      amber: '#905f18',
      amberSoft: '#fbf1df',
      yellow: '#7a5600',
      yellowBright: '#8a6200',
      green: '#22683a',
      greenBright: '#2c7a46',
      greenSoft: '#e6f4ea',
      cyan: '#116a6a',
      cyanBright: '#1a7a7a',
      blue: '#1d5bbf',
      blueBright: '#2769da',
      violet: '#7041c4',
      magenta: '#9b2c7a',
      magentaBright: '#a8378a'
    },
    accents: {
      orange: { accent: '#b75534', hover: '#a34c2e', on: '#ffffff' },
      blue: { accent: '#2e6edb', hover: '#2362cc', on: '#ffffff' },
      green: { accent: '#2c8151', hover: '#266e45', on: '#ffffff' },
      violet: { accent: '#7b55d6', hover: '#6b40d1', on: '#ffffff' },
      pink: { accent: '#b8336f', hover: '#a42c62', on: '#ffffff' },
      graphite: { accent: '#62615c', hover: '#53524e', on: '#ffffff' }
    }
  },
  // Sombre : gris chauds. Accents clairs, donc texte sombre posé dessus.
  dark: {
    scheme: 'dark',
    neutrals: {
      bg: '#262624',
      sidebar: '#1f1e1d',
      surface: '#30302e',
      surface2: '#383835',
      surface3: '#42413d',
      border: '#3e3d39',
      borderStrong: '#7d7b74',
      text: '#f0eee6',
      text2: '#d4d1c7',
      muted: '#a6a39a',
      codeBg: '#1f1e1d',
      codeFg: '#e8e6df',
      ansi: ['#1a1918', '#e8e6df', '#a6a39a', '#ffffff']
    },
    hues: {
      red: '#f08a7a',
      redBright: '#ffa597',
      redSoft: '#432a27',
      orange: '#f0a868',
      amber: '#e0a84f',
      amberSoft: '#3d3222',
      yellow: '#e8c46a',
      yellowBright: '#f5d98a',
      green: '#7fcb93',
      greenBright: '#a8e8b6',
      greenSoft: '#233a2a',
      cyan: '#7fd8d8',
      cyanBright: '#9ee9e9',
      blue: '#6b99de',
      blueBright: '#9ec8f8',
      violet: '#c3a6f6',
      magenta: '#e0a0e0',
      magentaBright: '#ecbdf3'
    },
    accents: {
      orange: { accent: '#db8062', hover: '#e3937a', on: '#1a1918' },
      blue: { accent: '#6b9bf2', hover: '#87aff5', on: '#1a1918' },
      green: { accent: '#5cb87f', hover: '#75c693', on: '#1a1918' },
      violet: { accent: '#a387f0', hover: '#b59df3', on: '#1a1918' },
      pink: { accent: '#e27aa9', hover: '#e993ba', on: '#1a1918' },
      graphite: { accent: '#a9a8a2', hover: '#bbbab4', on: '#1a1918' }
    }
  },
  // Sépia (sur le mode clair) : papier jauni, pour lire longtemps ; teintes plus brunes.
  sepia: {
    scheme: 'light',
    neutrals: {
      bg: '#f4ecd8',
      sidebar: '#ebe1c8',
      surface: '#fbf6e9',
      surface2: '#efe5cc',
      surface3: '#e5d9bb',
      border: '#ddcfae',
      borderStrong: '#8f7f5f',
      text: '#3b3022',
      text2: '#57472f',
      muted: '#6f5f45',
      codeBg: '#f0e7d1',
      codeFg: '#3b3022',
      ansi: ['#3b3022', '#6f5f45', '#57472f', '#fbf6e9']
    },
    hues: {
      red: '#9c2a17',
      redBright: '#ad3520',
      redSoft: '#f6d9cc',
      orange: '#7a4a05',
      amber: '#8a5400',
      amberSoft: '#f5e3bf',
      yellow: '#7a5200',
      yellowBright: '#875c00',
      green: '#3d6420',
      greenBright: '#47732a',
      greenSoft: '#e3ebcc',
      cyan: '#22605a',
      cyanBright: '#2a6e66',
      blue: '#2a5a8a',
      blueBright: '#33669c',
      violet: '#6b3f8f',
      magenta: '#8a3060',
      magentaBright: '#97386c'
    },
    accents: {
      orange: { accent: '#a14d2a', hover: '#8e4325', on: '#ffffff' },
      blue: { accent: '#2d5a94', hover: '#264d80', on: '#ffffff' },
      green: { accent: '#3a6a35', hover: '#305a2c', on: '#ffffff' },
      violet: { accent: '#6a4796', hover: '#5b3c82', on: '#ffffff' },
      pink: { accent: '#963160', hover: '#822a53', on: '#ffffff' },
      graphite: { accent: '#5c5547', hover: '#4d473b', on: '#ffffff' }
    }
  },
  // Nuit noire (sur le mode sombre) : noir profond, teintes plus vives.
  black: {
    scheme: 'dark',
    neutrals: {
      bg: '#000000',
      sidebar: '#0b0b0b',
      surface: '#141414',
      surface2: '#1c1c1c',
      surface3: '#262626',
      border: '#242424',
      borderStrong: '#6a6a6a',
      text: '#f0eee6',
      text2: '#d4d1c7',
      muted: '#a19e95',
      codeBg: '#0e0e0e',
      codeFg: '#ebe9e2',
      ansi: ['#000000', '#ebe9e2', '#a19e95', '#ffffff']
    },
    hues: {
      red: '#ff8f80',
      redBright: '#ffaa9e',
      redSoft: '#331512',
      orange: '#f5b070',
      amber: '#f2bd5c',
      amberSoft: '#2e2410',
      yellow: '#f0cc72',
      yellowBright: '#f8de94',
      green: '#8fdc9f',
      greenBright: '#aef0bd',
      greenSoft: '#0f2a18',
      cyan: '#86e0e0',
      cyanBright: '#a6f0f0',
      blue: '#447ed5',
      blueBright: '#a8ceff',
      violet: '#d2b2ff',
      magenta: '#dfa6f0',
      magentaBright: '#ebc0f8'
    },
    accents: {
      orange: { accent: '#ec8a63', hover: '#f29d7c', on: '#000000' },
      blue: { accent: '#7aa8ff', hover: '#94baff', on: '#000000' },
      green: { accent: '#5fd08e', hover: '#7cdba3', on: '#000000' },
      violet: { accent: '#b29bff', hover: '#c3b0ff', on: '#000000' },
      pink: { accent: '#ef8fbd', hover: '#f4a8cc', on: '#000000' },
      graphite: { accent: '#b3b2ac', hover: '#c4c3be', on: '#000000' }
    }
  },
  // Fjord (fiche 168, mode clair) : gris bleutés et fonds à peine teintés, pour un fil calme.
  fjord: {
    scheme: 'light',
    neutrals: {
      bg: '#f5f7fa',
      sidebar: '#ebeff4',
      surface: '#ffffff',
      surface2: '#e9eef3',
      surface3: '#dde4ec',
      border: '#d9e0e8',
      borderStrong: '#7f8b98',
      text: '#1c2733',
      text2: '#3a4756',
      muted: '#586676',
      codeBg: '#eff3f7',
      codeFg: '#1c2733',
      ansi: ['#1c2733', '#586676', '#465464', '#ffffff']
    },
    hues: {
      red: '#b0263a',
      redBright: '#bd3046',
      redSoft: '#fbe6ea',
      orange: '#8c490c',
      amber: '#8a5b12',
      amberSoft: '#f8efdc',
      yellow: '#735300',
      yellowBright: '#815e00',
      green: '#1d6944',
      greenBright: '#257850',
      greenSoft: '#e1f2ea',
      cyan: '#0c6672',
      cyanBright: '#137582',
      blue: '#1f5ab6',
      blueBright: '#2966cc',
      violet: '#6845bd',
      magenta: '#952d77',
      magentaBright: '#a23684'
    },
    accents: {
      orange: { accent: '#b2512e', hover: '#9d4727', on: '#ffffff' },
      blue: { accent: '#2a66cf', hover: '#2158bb', on: '#ffffff' },
      green: { accent: '#24784d', hover: '#1e6741', on: '#ffffff' },
      violet: { accent: '#714fce', hover: '#6240c2', on: '#ffffff' },
      pink: { accent: '#b0316b', hover: '#9c2a5e', on: '#ffffff' },
      graphite: { accent: '#596473', hover: '#4a5462', on: '#ffffff' }
    }
  },
  // Fjord nuit (fiche 168, mode sombre) : ardoise bleutée, teintes glacier.
  fjordNight: {
    scheme: 'dark',
    neutrals: {
      bg: '#1a2028',
      sidebar: '#151a21',
      surface: '#222932',
      surface2: '#2a323c',
      surface3: '#343d48',
      border: '#313a45',
      borderStrong: '#717e8c',
      text: '#e6ebf1',
      text2: '#c7d0da',
      muted: '#99a5b2',
      codeBg: '#151a21',
      codeFg: '#dde4ec',
      ansi: ['#11151b', '#dde4ec', '#99a5b2', '#ffffff']
    },
    hues: {
      red: '#f38b8f',
      redBright: '#ffa8ab',
      redSoft: '#3d2a30',
      orange: '#f0a86c',
      amber: '#e2ad55',
      amberSoft: '#363126',
      yellow: '#e9c76e',
      yellowBright: '#f5da8e',
      green: '#7ccf9e',
      greenBright: '#a4e8bf',
      greenSoft: '#1f3a30',
      cyan: '#7cd3dd',
      cyanBright: '#9fe6ee',
      blue: '#6c9be0',
      blueBright: '#a2c8f8',
      violet: '#bfa8f5',
      magenta: '#de9fdc',
      magentaBright: '#ebbdee'
    },
    accents: {
      orange: { accent: '#e08865', hover: '#e89b7d', on: '#11151b' },
      blue: { accent: '#72a2f2', hover: '#8db4f5', on: '#11151b' },
      green: { accent: '#5fbe87', hover: '#78ca9a', on: '#11151b' },
      violet: { accent: '#a88cf0', hover: '#b9a2f3', on: '#11151b' },
      pink: { accent: '#e47fad', hover: '#ea98bd', on: '#11151b' },
      graphite: { accent: '#a9b2bd', hover: '#bac2cb', on: '#11151b' }
    }
  }
}

/** Jetons de la coloration syntaxique (`--syn-*`). */
export const SYNTAX = [
  'keyword',
  'string',
  'comment',
  'number',
  'function',
  'type',
  'tag',
  'attr'
] as const
export type SyntaxToken = (typeof SYNTAX)[number]

/** Couches 2 et 3 : rôles de l'interface et jetons de domaine, pour une palette et un accent. */
export interface ThemeTokens {
  scheme: 'light' | 'dark'
  bg: string
  sidebar: string
  surface: string
  surface2: string
  surface3: string
  border: string
  borderStrong: string
  text: string
  text2: string
  muted: string
  accent: string
  accentHover: string
  onAccent: string
  /** Couleur du mode Plan (fiche 098) : violet, ou bleu quand l'accent est déjà violet. */
  plan: string
  ok: string
  okSoft: string
  warn: string
  warnSoft: string
  err: string
  errSoft: string
  diffOld: string
  diffNew: string
  shadow: string
  shadowMenu: string
  codeBg: string
  codeFg: string
  syn: Record<SyntaxToken, string>
  /** Les 16 couleurs ANSI, dans l'ordre (noir, rouge… blanc vif). */
  ansi: readonly string[]
  /** Séries du graphique de consommation (`--chart-1…3`), et « Autres » (`--chart-other`). */
  chart: readonly string[]
  chartOther: string
  /** Niveaux de la grille d'activité (`--heat-1…4`, fiche 144). */
  heat: readonly string[]
}

export function themeTokens(palette: Palette, accent: AccentColor): ThemeTokens {
  const { scheme, neutrals: n, hues: h, accents } = TINTS[palette]
  const tint = accents[accent]
  const [black, white, brightBlack, brightWhite] = n.ansi
  return {
    scheme,
    bg: n.bg,
    sidebar: n.sidebar,
    surface: n.surface,
    surface2: n.surface2,
    surface3: n.surface3,
    border: n.border,
    borderStrong: n.borderStrong,
    text: n.text,
    text2: n.text2,
    muted: n.muted,
    accent: tint.accent,
    accentHover: tint.hover,
    onAccent: tint.on,
    // Le bleu du Plan en sombre : le vif, l'autre sert aussi de fond aux invites (voir `Hues`).
    plan: accent !== 'violet' ? h.violet : scheme === 'dark' ? h.blueBright : h.blue,
    ok: h.green,
    okSoft: h.greenSoft,
    warn: h.amber,
    warnSoft: h.amberSoft,
    err: h.red,
    errSoft: h.redSoft,
    diffOld: h.redSoft,
    diffNew: h.greenSoft,
    ...SHADOWS[scheme],
    codeBg: n.codeBg,
    codeFg: n.codeFg,
    syn: {
      keyword: h.red,
      string: h.green,
      comment: n.muted,
      number: h.blue,
      function: h.violet,
      type: h.orange,
      tag: h.cyan,
      attr: h.magenta
    },
    ansi: [
      black,
      h.red,
      h.green,
      h.yellow,
      h.blue,
      h.magenta,
      h.cyan,
      white,
      brightBlack,
      h.redBright,
      h.greenBright,
      h.yellowBright,
      h.blueBright,
      h.magentaBright,
      h.cyanBright,
      brightWhite
    ],
    chart: CHART[scheme],
    chartOther: n.borderStrong,
    heat: heatScale(tint.accent, n.surface, n.text)
  }
}

/** Variables CSS d'un thème (`--surface-2`, `--syn-keyword`, `--ansi-3`…), sans `scheme`. */
export function cssVariables(tokens: ThemeTokens): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== 'string' || key === 'scheme') continue
    variables[`--${key.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`] = value
  }
  for (const name of SYNTAX) variables[`--syn-${name}`] = tokens.syn[name]
  tokens.ansi.forEach((color, i) => (variables[`--ansi-${i}`] = color))
  tokens.chart.forEach((color, i) => (variables[`--chart-${i + 1}`] = color))
  tokens.heat.forEach((color, i) => (variables[`--heat-${i + 1}`] = color))
  return variables
}

/** Thème choisi pour chaque mode (fiche 136) : Clair, Sépia ou Fjord ; Sombre, Nuit noire ou Fjord nuit. */
export interface ModeThemes {
  lightTheme: LightTheme
  darkTheme: DarkTheme
}

/**
 * Palette affichée : la variante posée sur la page (`data-palette`) si elle va avec le mode (Sépia
 * ou Fjord en clair, Nuit noire ou Fjord nuit en sombre, comme le CSS généré), sinon le clair ou le
 * sombre.
 */
export function paletteOf(variant: string | undefined, dark: boolean): Palette {
  const found = VARIANT_PALETTES.find((palette) => palette === variant)
  if (found && TINTS[found].scheme === (dark ? 'dark' : 'light')) return found
  return dark ? 'dark' : 'light'
}

/** Palette du thème choisi pour le mode affiché. */
export function paletteFor(themes: ModeThemes, dark: boolean): Palette {
  return dark ? themes.darkTheme : themes.lightTheme
}

/** Accent connu, l'orange sinon. */
export function accentOf(value: string | undefined): AccentColor {
  return ACCENTS.find((accent) => accent === value) ?? 'orange'
}

/**
 * Fond d'une fenêtre avant que sa page ne s'affiche : le `--bg` du thème du mode affiché
 * (`systemDark` : macOS est en sombre, pour le mode « Système »).
 */
export function windowBackground(
  prefs: ModeThemes & { theme: ThemePreference },
  systemDark: boolean
): string {
  const dark = prefs.theme === 'system' ? systemDark : prefs.theme === 'dark'
  return TINTS[paletteFor(prefs, dark)].neutrals.bg
}

/**
 * Jetons d'espacement de la densité (fiche 159), de la même source que les couleurs : le CSS lit
 * `var(--density-*)`, aucune règle « compacte » n'est écrite à la main. Seuls les espaces
 * verticaux changent : jamais de retrait (la barre latérale n'a pas de second niveau, fiche 131).
 */
export const DENSITY_TOKENS = {
  normal: {
    threadGap: '18px',
    msgPad: '10px',
    toolPad: '6px',
    toolDetailsGap: '8px',
    rowPad: '7px',
    sectionGap: '20px'
  },
  compact: {
    threadGap: '10px',
    msgPad: '6px',
    toolPad: '3px',
    toolDetailsGap: '4px',
    rowPad: '4px',
    sectionGap: '12px'
  }
} as const satisfies Record<Density, Record<string, string>>

/** Variables CSS d'une densité (`--density-thread-gap`…). */
export function densityVariables(density: Density): Record<string, string> {
  return Object.fromEntries(
    Object.entries(DENSITY_TOKENS[density]).map(([key, value]) => [
      `--density-${key.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`,
      value
    ])
  )
}

/**
 * Jetons de rayon (fiche 170), de la même source que la densité : le CSS ne lit que
 * `var(--radius-*)`, un test (`scripts/radius-guard.test.ts`) refuse un `border-radius` en dur. Cinq crans,
 * du plus petit élément à la plus grande surface ; un bloc posé dans une carte prend un cran de
 * moins que la carte, un enfant collé à son bord `calc(rayon − bordure)`.
 */
export const RADIUS_TOKENS = {
  /** Code en ligne, touches, surlignage, barres fines. */
  xs: '4px',
  /** Boutons, puces, champs, lignes. */
  sm: '8px',
  /** Blocs du fil (code, diff, avis), menus, cartes des réglages. */
  md: '12px',
  /** Grandes surfaces : zone de saisie, cartes de permission et de plan, dialogues, palette. */
  lg: '20px',
  /** Pastilles, interrupteurs, points et avatars ronds. */
  pill: '999px'
} as const

/** Variables CSS des rayons (`--radius-sm`…). */
export function radiusVariables(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(RADIUS_TOKENS).map(([key, value]) => [`--radius-${key}`, value])
  )
}
