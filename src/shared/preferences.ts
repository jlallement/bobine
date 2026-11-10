/** Préférences d'apparence de l'app (fiche 027), enregistrées dans `settings.json`. */

import { DEFAULT_QUICK_SHORTCUT, isQuickShortcut, type QuickShortcut } from './quick-entry'
import { isLanguage, type Language } from './i18n/language'
import { CHILD_PROPOSALS, type ChildProposals } from './children'
import { parseEditorId, type EditorId } from './editors'

/** Mode : celui de macOS, clair ou sombre ; c'est le `nativeTheme.themeSource` du main. */
export type ThemePreference = 'system' | 'light' | 'dark'
export const THEME_MODES: readonly ThemePreference[] = ['system', 'light', 'dark']

/** Thème du mode clair et du mode sombre (fiche 136) : « Système » garde celui de chaque mode. */
export type LightTheme = 'light' | 'sepia' | 'fjord'
export type DarkTheme = 'dark' | 'black' | 'fjordNight'
export const LIGHT_THEMES: readonly LightTheme[] = ['light', 'sepia', 'fjord']
export const DARK_THEMES: readonly DarkTheme[] = ['dark', 'black', 'fjordNight']

/**
 * Les thèmes de Réglages › Apparence, en une rangée (essai à la souris du 24/10 ; Fjord et Fjord
 * nuit, fiche 168) : « Système » suit macOS avec Clair et Sombre ; les autres fixent le mode et son
 * thème.
 */
export type ThemeChoice = 'system' | LightTheme | DarkTheme
export const THEME_CHOICES: readonly ThemeChoice[] = [
  'system',
  'light',
  'sepia',
  'fjord',
  'dark',
  'black',
  'fjordNight'
]

/** Le thème coché, d'après les préférences enregistrées. */
export function themeChoiceOf(prefs: Pick<Preferences, 'theme' | 'lightTheme' | 'darkTheme'>) {
  if (prefs.theme === 'system') return 'system'
  return prefs.theme === 'light' ? prefs.lightTheme : prefs.darkTheme
}

/** Les préférences d'un thème choisi ; « Système » revient à Clair et Sombre. */
export function themeChoicePreferences(
  choice: ThemeChoice
): Pick<Preferences, 'theme'> & Partial<Pick<Preferences, 'lightTheme' | 'darkTheme'>> {
  switch (choice) {
    case 'system':
      return { theme: 'system', lightTheme: 'light', darkTheme: 'dark' }
    case 'light':
    case 'sepia':
    case 'fjord':
      return { theme: 'light', lightTheme: choice }
    default:
      return { theme: 'dark', darkTheme: choice }
  }
}

/**
 * Nom d'une police installée (fiche 136), posé tel quel dans le CSS : sans guillemet, barre
 * oblique inverse, point-virgule, accolade ni chevron, 100 caractères au plus.
 */
export function isFontName(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim() === value && /^[^"'\\;{}<>\n\r]{1,100}$/.test(value)
  )
}

/** Police des blocs de code, des diffs et des sorties de commandes : `system` ou une police. */
export type CodeFont = string

/** Anciens choix de la police du code (avant la fiche 136), repris en noms de police. */
const LEGACY_CODE_FONTS: Record<string, string> = {
  menlo: 'Menlo',
  jetbrains: 'JetBrains Mono',
  fira: 'Fira Code',
  cascadia: 'Cascadia Code'
}

/**
 * Police des réponses de l'agent : `sans` (celle du système, comme le reste de l'app), `serif`
 * (New York, comme Claude) ou une police installée.
 */
export type ConversationFont = string

/** Couleur d'accent de l'interface (boutons, liens, indicateurs). */
export type AccentColor = 'orange' | 'blue' | 'violet' | 'pink' | 'green' | 'graphite'
export const ACCENT_COLORS: readonly AccentColor[] = [
  'orange',
  'blue',
  'violet',
  'pink',
  'green',
  'graphite'
]
/** Densité de l'interface (fiche 159) : espaces entre messages, outils et lignes de la liste. */
export type Density = 'normal' | 'compact'
export const DENSITIES: readonly Density[] = ['normal', 'compact']
/** Largeur du fil de conversation. */
export type ThreadWidth = 'narrow' | 'normal' | 'wide'
export const THREAD_WIDTHS: readonly ThreadWidth[] = ['narrow', 'normal', 'wide']

/** Sons du système (`/System/Library/Sounds`) proposés quand un agent attend (fiche 068). */
export const ATTENTION_SOUNDS = [
  'Glass',
  'Ping',
  'Pop',
  'Tink',
  'Purr',
  'Bottle',
  'Hero',
  'Submarine',
  'Funk',
  'Frog',
  'Blow',
  'Morse',
  'Sosumi',
  'Basso'
] as const
export type AttentionSound = 'off' | (typeof ATTENTION_SOUNDS)[number]

/** Langue de l'interface (fiche 074) : celle de macOS, ou une langue imposée. */
export type LanguagePreference = 'system' | Language

export interface Preferences {
  /** Langue de l'interface ; « system » : celle de macOS, sinon l'anglais (ADR-0014). */
  language: LanguagePreference
  /** Niveau du journal enregistré (fiche 080) ; Trace ne l'est jamais. */
  logLevel: 'normal' | 'detailed'
  /** Mode : Système, Clair ou Sombre. Avant la fiche 136, aussi `sepia` et `black` (repris). */
  theme: ThemePreference
  lightTheme: LightTheme
  darkTheme: DarkTheme
  conversationFont: ConversationFont
  /** Taille du texte des réponses, en pixels ; les messages de l'utilisateur sont 1 px plus petits. */
  conversationFontSize: number
  /** Police du terminal ; absente : les « Nerd Fonts » courantes, puis la police mono de l'app. */
  terminalFontFamily?: string
  terminalFontSize: number
  accent: AccentColor
  threadWidth: ThreadWidth
  density: Density
  /** Le Mac ne se met pas en veille tant qu'un agent travaille. */
  keepAwake: boolean
  codeFont: CodeFont
  /** Taille du code (blocs, diffs, sorties de commandes), en pixels (fiche 136). */
  codeFontSize: number
  /** Prénom pour l'accueil (« Bonsoir Jérôme ») ; vide : pas de prénom. */
  userName: string
  /** Raccourci global de la fenêtre rapide (fiche 062). */
  quickEntryShortcut: QuickShortcut
  /** Son quand un agent attend une action, fenêtre en arrière-plan (fiche 068). */
  attentionSound: AttentionSound
  /** L'icône du Dock rebondit, aux mêmes moments qu'une notification (fiche 101). */
  dockBounce: boolean
  /** Nombre de conversations « À traiter » sur l'icône du Dock (fiche 119). */
  dockBadge: boolean
  /**
   * Cookies et connexions du navigateur intégré gardés d'un lancement à l'autre (fiche 072) ; non :
   * session en mémoire, effacée à la fermeture de l'app.
   */
  browserKeepCookies: boolean
  /** Astuces de Bobine, au plus une par jour, au bon moment (fiche 191). */
  tipsEnabled: boolean
  /**
   * Conversations filles en cours au plus par conversation (fiche 097, ADR-0020) : au-delà,
   * « Lancer en parallèle… » est grisé et `start_child` refusé.
   */
  maxChildren: number
  /**
   * L'agent d'une mère possible apprend, au début de chaque session, qu'il peut proposer des
   * conversations filles (fiche 118) : jamais, quand ça s'y prête, ou toujours.
   */
  childProposals: ChildProposals
  /**
   * Conversations gardées actives (agent vivant) au plus (fiche 102) : au-delà, les plus anciennes
   * au repos sont mises en veille. `BOBINE_MAX_LIVE` l'emporte (essais).
   */
  maxLive: number
  /**
   * Éditeur de « Ouvrir dans… » (fiche 156) ; absent, ou plus installé : le premier éditeur
   * installé.
   */
  editor?: EditorId
  /**
   * Une commande dont l'agent envoie la sortie est signalée après ce nombre de minutes sans
   * nouvelle sortie (fiche 157). `BOBINE_STALLED_COMMAND_MS` l'emporte (essais).
   */
  stalledCommandMinutes: number
  /** Plafond de coût (fiche 157, ADR-0035) : posé au premier message des nouvelles conversations. */
  costCapEnabled: boolean
  /** Plafond (et pas de « Continuer ») dans l'unité du coût de l'agent (bobcoins, dollars…). */
  costCapAmount: number
  /** Plafond en jetons, pour un agent qui ne donne pas son coût. */
  costCapTokens: number
  /**
   * Mémoire commune aux agents (fiche 182, ADR-0040) : outils `remember`, `forget`, `recall` et
   * index au début de chaque session. Coupée : ni outils ni index, les souvenirs restent.
   */
  memoryEnabled: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  language: 'system',
  logLevel: 'normal',
  theme: 'system',
  lightTheme: 'light',
  darkTheme: 'dark',
  // Police de l'app (fiche 070) ; « Serif », comme Claude, reste au choix.
  conversationFont: 'sans',
  conversationFontSize: 15,
  terminalFontSize: 12.5,
  accent: 'orange',
  threadWidth: 'normal',
  density: 'normal',
  keepAwake: true,
  codeFont: 'system',
  codeFontSize: 12.5,
  userName: '',
  quickEntryShortcut: DEFAULT_QUICK_SHORTCUT,
  attentionSound: 'Glass',
  dockBounce: true,
  dockBadge: true,
  browserKeepCookies: true,
  tipsEnabled: true,
  maxChildren: 5,
  childProposals: 'whenFitting',
  // Environ 300 Mo par agent vivant, mesurés (fiche 102).
  maxLive: 6,
  stalledCommandMinutes: 3,
  costCapEnabled: false,
  costCapAmount: 5,
  costCapTokens: 2_000_000,
  // Activée dès l'installation (décision de l'utilisateur, fiche 182).
  memoryEnabled: true
}

export const TERMINAL_FONT_SIZES = { min: 9, max: 24 }
export const CONVERSATION_FONT_SIZES = { min: 12, max: 22 }
export const CODE_FONT_SIZES = { min: 10, max: 20 }
/** Plafond réglable des conversations filles en cours (ADR-0020). */
export const MAX_CHILDREN_LIMITS = { min: 1, max: 10 }
/** Conversations gardées actives, réglables (fiche 102). */
export const MAX_LIVE_LIMITS = { min: 2, max: 12 }
/** Minutes sans sortie avant de signaler une commande (fiche 157). */
export const STALLED_COMMAND_LIMITS = { min: 1, max: 30 }
/** Plafonds de coût acceptés (fiche 157) : montant, et jetons. */
export const COST_CAP_AMOUNT_LIMITS = { min: 0.01, max: 1_000_000 }
export const COST_CAP_TOKEN_LIMITS = { min: 1_000, max: 10_000_000_000 }

/** Taille réglable par demi-pixel, dans ses bornes ; sinon `undefined`. */
function sizeIn(value: unknown, limits: { min: number; max: number }): number | undefined {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= limits.min &&
    value <= limits.max
    ? Math.round(value * 2) / 2
    : undefined
}

/**
 * Mode et thèmes (fiche 136) : l'ancien `sepia` devient le mode Clair avec le thème clair Sépia,
 * l'ancien `black` le mode Sombre avec le thème sombre Nuit noire.
 */
function parseTheme(obj: Record<string, unknown>, result: Partial<Preferences>): void {
  const theme = obj['theme']
  if (THEME_MODES.includes(theme as ThemePreference)) result.theme = theme as ThemePreference
  if (theme === 'sepia') Object.assign(result, { theme: 'light', lightTheme: 'sepia' })
  if (theme === 'black') Object.assign(result, { theme: 'dark', darkTheme: 'black' })
  if (LIGHT_THEMES.includes(obj['lightTheme'] as LightTheme)) {
    result.lightTheme = obj['lightTheme'] as LightTheme
  }
  if (DARK_THEMES.includes(obj['darkTheme'] as DarkTheme)) {
    result.darkTheme = obj['darkTheme'] as DarkTheme
  }
}

/** Polices et tailles des réponses, du code et du terminal. */
function parseFonts(obj: Record<string, unknown>, result: Partial<Preferences>): void {
  if (isFontName(obj['conversationFont'])) result.conversationFont = obj['conversationFont']
  const conversationSize = sizeIn(obj['conversationFontSize'], CONVERSATION_FONT_SIZES)
  if (conversationSize !== undefined) result.conversationFontSize = conversationSize
  const code = obj['codeFont']
  if (typeof code === 'string' && code in LEGACY_CODE_FONTS)
    result.codeFont = LEGACY_CODE_FONTS[code]
  else if (isFontName(code)) result.codeFont = code
  const codeSize = sizeIn(obj['codeFontSize'], CODE_FONT_SIZES)
  if (codeSize !== undefined) result.codeFontSize = codeSize
  const family =
    typeof obj['terminalFontFamily'] === 'string' ? obj['terminalFontFamily'].trim() : null
  // Chaîne vide : retour à la police par défaut (« Automatique »).
  if (family === '' || isFontName(family)) result.terminalFontFamily = family
  const terminalSize = sizeIn(obj['terminalFontSize'], TERMINAL_FONT_SIZES)
  if (terminalSize !== undefined) result.terminalFontSize = terminalSize
}

/** Préférences oui / non, reprises telles quelles quand elles sont booléennes. */
const BOOLEAN_PREFERENCES = [
  'keepAwake',
  'browserKeepCookies',
  'dockBounce',
  'dockBadge',
  'costCapEnabled',
  'memoryEnabled',
  'tipsEnabled'
] as const

/** Nombre fini dans ses bornes (entier si demandé) ; sinon `undefined`. */
function numberIn(
  value: unknown,
  limits: { min: number; max: number },
  integer = false
): number | undefined {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    (!integer || Number.isInteger(value)) &&
    value >= limits.min &&
    value <= limits.max
    ? value
    : undefined
}

/** Seuil de commande bloquée et plafond de coût (fiche 157). */
function parseTurnGuards(obj: Record<string, unknown>, result: Partial<Preferences>): void {
  const stalled = numberIn(obj['stalledCommandMinutes'], STALLED_COMMAND_LIMITS, true)
  if (stalled !== undefined) result.stalledCommandMinutes = stalled
  const amount = numberIn(obj['costCapAmount'], COST_CAP_AMOUNT_LIMITS)
  if (amount !== undefined) result.costCapAmount = Math.round(amount * 100) / 100
  const tokens = numberIn(obj['costCapTokens'], COST_CAP_TOKEN_LIMITS, true)
  if (tokens !== undefined) result.costCapTokens = tokens
}

/** Champs valides d'un objet venu du disque ou du renderer ; le reste est ignoré. */
export function parsePreferences(raw: unknown): Partial<Preferences> {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const result: Partial<Preferences> = {}
  if (obj['language'] === 'system' || isLanguage(obj['language'])) {
    result.language = obj['language']
  }
  if (obj['logLevel'] === 'normal' || obj['logLevel'] === 'detailed') {
    result.logLevel = obj['logLevel']
  }
  parseTheme(obj, result)
  parseFonts(obj, result)
  const accent = obj['accent']
  // « Comme le Mac » (`system`) n'existe plus : l'accent par défaut le remplace.
  if (ACCENT_COLORS.includes(accent as AccentColor)) result.accent = accent as AccentColor
  if (THREAD_WIDTHS.includes(obj['threadWidth'] as ThreadWidth)) {
    result.threadWidth = obj['threadWidth'] as ThreadWidth
  }
  if (DENSITIES.includes(obj['density'] as Density)) result.density = obj['density'] as Density
  for (const key of BOOLEAN_PREFERENCES) {
    const value = obj[key]
    if (typeof value === 'boolean') result[key] = value
  }
  if (typeof obj['userName'] === 'string') result.userName = obj['userName'].trim().slice(0, 40)
  const sound = obj['attentionSound']
  if (sound === 'off' || ATTENTION_SOUNDS.includes(sound as (typeof ATTENTION_SOUNDS)[number])) {
    result.attentionSound = sound as AttentionSound
  }
  if (isQuickShortcut(obj['quickEntryShortcut'])) {
    result.quickEntryShortcut = obj['quickEntryShortcut']
  }
  const maxChildren = obj['maxChildren']
  if (
    typeof maxChildren === 'number' &&
    Number.isInteger(maxChildren) &&
    maxChildren >= MAX_CHILDREN_LIMITS.min &&
    maxChildren <= MAX_CHILDREN_LIMITS.max
  ) {
    result.maxChildren = maxChildren
  }
  if (CHILD_PROPOSALS.includes(obj['childProposals'] as ChildProposals)) {
    result.childProposals = obj['childProposals'] as ChildProposals
  }
  const maxLive = obj['maxLive']
  if (
    typeof maxLive === 'number' &&
    Number.isInteger(maxLive) &&
    maxLive >= MAX_LIVE_LIMITS.min &&
    maxLive <= MAX_LIVE_LIMITS.max
  ) {
    result.maxLive = maxLive
  }
  const editor = parseEditorId(obj['editor'])
  if (editor) result.editor = editor
  parseTurnGuards(obj, result)
  return result
}
