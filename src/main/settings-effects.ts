/**
 * Ce que l'app fait quand un réglage change (sorti de `index.ts`, qui reste sous son plafond de
 * lignes, fiche 089) : cookies du navigateur effacés s'ils ne sont plus gardés (fiche 072), veille
 * empêchée ou non, raccourci de la fenêtre rapide (fiche 062), thème (fiche 027), langue du main,
 * du menu, des fenêtres et de macOS (fiche 074), puis la vue des réglages renvoyée aux fenêtres.
 */
import { nativeTheme } from 'electron'
import type { Language } from '@shared/i18n'
import type { LanguagePreference } from '@shared/preferences'
import { changeLanguage, resolveLanguage } from './i18n'
import type { QuickShortcutRegistrar } from './quick-entry'
import type { SettingsStore } from './settings-store'

export interface SettingsEffects {
  settings: Pick<SettingsStore, 'onChange' | 'preferences'>
  /** Conversations qui attendent l'utilisateur : leurs réglages ont pu changer (fiche 024). */
  attentionChanged: () => void
  clearBrowserData: () => Promise<void>
  updateKeepAwake: () => void
  quickShortcut: Pick<QuickShortcutRegistrar, 'state' | 'apply'>
  refreshMenu: () => void
  /** Langue de l'app au lancement (réglage lu avant la fenêtre). */
  startLanguage: LanguagePreference
  /** Langue des fenêtres de macOS suivie (app packagée) ; absente : rien à faire. */
  syncNativeLanguage?: (preference: LanguagePreference, previous: LanguagePreference) => void
  systemLanguages: () => readonly string[]
  languageChanged: (language: Language) => void
  settingsChanged: () => void
  onError: (error: unknown) => void
}

export function applySettingsChanges(deps: SettingsEffects): void {
  const { settings } = deps
  /** Dernière valeur de « Garder les cookies du navigateur » (fiche 072). */
  let keptCookies = settings.preferences().browserKeepCookies
  /** Dernière valeur du réglage « Langue » (fiche 074). */
  let languagePreference = deps.startLanguage
  settings.onChange(() => {
    deps.attentionChanged()
    // Cookies du navigateur plus gardés (fiche 072) : ce qui est sur le disque part tout de suite.
    const keepCookies = settings.preferences().browserKeepCookies
    if (keptCookies && !keepCookies) void deps.clearBrowserData().catch(deps.onError)
    keptCookies = keepCookies
    deps.updateKeepAwake()
    // Raccourci de la fenêtre rapide changé : réenregistré, et le menu l'affiche.
    const before = deps.quickShortcut.state.shortcut
    deps.quickShortcut.apply(settings.preferences().quickEntryShortcut)
    if (deps.quickShortcut.state.shortcut !== before) deps.refreshMenu()
    // Thème (fiche 027) : le CSS, xterm.js et les pages du navigateur suivent `nativeTheme`.
    nativeTheme.themeSource = settings.preferences().theme
    // Langue (fiche 074) : le main, le menu et chaque fenêtre suivent, sans relancer ; les
    // fenêtres de macOS, au prochain lancement (retirée d'abord : « Système » relit macOS).
    const preference = settings.preferences().language
    if (preference !== languagePreference) deps.syncNativeLanguage?.(preference, languagePreference)
    languagePreference = preference
    const language = resolveLanguage(preference, deps.systemLanguages())
    if (changeLanguage(language)) {
      deps.refreshMenu()
      deps.languageChanged(language)
    }
    deps.settingsChanged()
  })
}
