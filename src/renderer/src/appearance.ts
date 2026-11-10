/**
 * Apparence de l'interface (fiches 027, 136) : polices et tailles, largeur du fil, accent et thème
 * du mode, posés sur la page. Partagée par la fenêtre principale, la fenêtre rapide (fiche 062) et
 * la fenêtre À propos. Le clair ou sombre suit `nativeTheme`, réglé par le main ; le thème de
 * chaque mode (Sépia, Nuit noire) est repris à chaque changement de mode.
 */
import type { Preferences } from '@shared/preferences'
import { PRESENTATION_FONT_BOOST } from '@shared/presentation'
import { accentOf, paletteFor } from '@shared/themes'
import './terminal-symbols.css'

/** Ce qu'il faut pour l'apparence : les préférences (la vue des réglages convient). */
export interface AppearanceSource {
  preferences: Preferences
}

/** Police des réponses en CSS : celle du système, le serif, ou une police installée. */
export function conversationFontCss(font: string): string {
  if (font === 'sans') return 'var(--font-ui)'
  if (font === 'serif') return 'var(--font-serif)'
  return `'${font}', var(--font-ui)`
}

/** Police du code en CSS ; `system` : celle de l'app (SF Mono). */
export function codeFontCss(font: string): string {
  return font === 'system' ? 'var(--font-mono)' : `'${font}', var(--font-mono)`
}

/** Nerd Font livrée avec l'app pour les icônes (`terminal-symbols.css`, fiche 201). */
export const TERMINAL_SYMBOLS_FAMILY = 'Bobine Nerd Font'

/**
 * Polices du terminal par défaut (« Automatique ») : d'abord les « Nerd Fonts » courantes (icônes
 * des invites powerlevel10k, starship… si l'utilisateur en a installé une), puis la police mono.
 * Avant le générique `monospace`, la Nerd Font livrée (fiche 201) : elle ne sert qu'aux
 * caractères absents des polices précédentes (icônes de la zone privée d'Unicode), les lettres
 * restent dans la police choisie, SF Mono ou Menlo.
 */
const TERMINAL_FONTS = [
  '"MesloLGS NF"',
  '"MesloLGLDZ Nerd Font Mono"',
  '"MesloLGS Nerd Font Mono"',
  '"MesloLGM Nerd Font Mono"',
  '"JetBrainsMono Nerd Font Mono"',
  '"FiraCode Nerd Font Mono"',
  '"Hack Nerd Font Mono"',
  'ui-monospace',
  '"SF Mono"',
  'Menlo',
  JSON.stringify(TERMINAL_SYMBOLS_FAMILY),
  'monospace'
].join(', ')

/** Police du terminal : celle choisie, puis la liste par défaut ; rien : la liste seule. */
export function terminalFontCss(family: string | undefined): string {
  return family ? `${JSON.stringify(family)}, ${TERMINAL_FONTS}` : TERMINAL_FONTS
}

let symbolsLoad: Promise<void> | undefined
let symbolsSettled = false
/**
 * Charge la police des icônes, une fois (fiche 201). xterm.js mesure la largeur des caractères à
 * leur premier affichage et la garde : mesurée avant le chargement, une icône serait un carré
 * vide mal calé. Le terminal attend donc cette promesse avant de s'ouvrir ; elle ne rejette
 * jamais et rend la main au plus tard après `timeoutMs` (police illisible : carrés, pas de blocage).
 */
export function loadTerminalSymbols(timeoutMs = 1500): Promise<void> {
  symbolsLoad ??= new Promise<void>((resolve) => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    const done = () => {
      symbolsSettled = true
      resolve()
    }
    if (!fonts?.load) return done()
    const timer = setTimeout(done, timeoutMs)
    fonts
      .load(`12px ${JSON.stringify(TERMINAL_SYMBOLS_FAMILY)}`, '\ue0a0')
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer)
        done()
      })
  })
  return symbolsLoad
}

/** Déjà chargée (ou abandonnée) : le terminal peut s'ouvrir sans attendre. */
export function terminalSymbolsSettled(): boolean {
  return symbolsSettled
}

let current: Preferences | null = null
/** Mode présentation (fiche 159) : le texte du fil est plus grand. */
let presenting = false
let watching = false
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)')

/** Variante du mode affiché (`data-palette`) : Sépia, Fjord, Nuit noire, Fjord nuit, ou rien. */
function applyPalette(): void {
  if (!current) return
  const palette = paletteFor(current, darkQuery()?.matches ?? false)
  document.documentElement.dataset['palette'] =
    palette === 'light' || palette === 'dark' ? '' : palette
}

export function applyAppearance(source: AppearanceSource): void {
  const prefs = source.preferences
  const root = document.documentElement.style
  root.setProperty('--conv-font', conversationFontCss(prefs.conversationFont))
  root.setProperty(
    '--conv-size',
    `${prefs.conversationFontSize + (presenting ? PRESENTATION_FONT_BOOST : 0)}px`
  )
  root.setProperty(
    '--column-width',
    { narrow: '640px', normal: '740px', wide: '960px' }[prefs.threadWidth]
  )
  document.documentElement.dataset['accent'] = accentOf(prefs.accent)
  document.documentElement.dataset['density'] = prefs.density
  if (prefs.codeFont === 'system') root.removeProperty('--font-code')
  else root.setProperty('--font-code', codeFontCss(prefs.codeFont))
  root.setProperty('--code-size', `${prefs.codeFontSize}px`)
  current = prefs
  applyPalette()
  // Le mode change (« Système » suit macOS) : le thème choisi pour l'autre mode.
  if (!watching) {
    watching = true
    darkQuery()?.addEventListener('change', applyPalette)
  }
}

/** Mode présentation activé ou coupé : reprend la taille du texte du fil. */
export function setPresenting(on: boolean): void {
  presenting = on
  if (current) applyAppearance({ preferences: current })
}
