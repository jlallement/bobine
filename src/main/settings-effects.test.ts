import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/preferences'
import { currentLanguage } from './i18n'
import { applySettingsChanges, type SettingsEffects } from './settings-effects'

/**
 * Ce que le main fait quand un réglage change (fiches 027, 062, 072, 074) : remplace les
 * vérifications unitaires des e2e `settings` (n° 17 : cookies effacés) et `language` (n° 3 : menu
 * reconstruit, fenêtres prévenues). Le menu natif lui-même et les vraies fenêtres restent à l'e2e.
 */

const theme = vi.hoisted(() => ({ themeSource: 'system' as string }))
vi.mock('electron', () => ({ nativeTheme: theme }))

function harness(start: Partial<Preferences> = {}) {
  let preferences: Preferences = { ...DEFAULT_PREFERENCES, ...start }
  let changed: () => void = () => {}
  const quick = {
    state: { shortcut: preferences.quickEntryShortcut as string | null },
    apply: vi.fn()
  }
  quick.apply.mockImplementation((shortcut: string | null) => {
    quick.state.shortcut = shortcut
  })
  const deps = {
    settings: {
      preferences: () => preferences,
      onChange: (listener: () => void) => {
        changed = listener
        return () => {}
      }
    },
    attentionChanged: vi.fn(),
    clearBrowserData: vi.fn(async () => {}),
    updateKeepAwake: vi.fn(),
    quickShortcut: quick,
    refreshMenu: vi.fn(),
    startLanguage: preferences.language,
    syncNativeLanguage: vi.fn(),
    systemLanguages: () => ['fr-FR'],
    languageChanged: vi.fn(),
    settingsChanged: vi.fn(),
    onError: vi.fn()
  }
  applySettingsChanges(deps as unknown as SettingsEffects)
  const change = (next: Partial<Preferences>) => {
    preferences = { ...preferences, ...next }
    changed()
  }
  return { deps, change }
}

afterEach(async () => {
  // La langue du main est globale (i18next) : remise en français pour les autres essais.
  const i18next = (await import('i18next')).default
  await i18next.changeLanguage('fr')
})

describe('effets d’un réglage changé (main)', () => {
  it('cookies plus gardés : ceux du disque effacés aussitôt, une seule fois', () => {
    const { deps, change } = harness({ browserKeepCookies: true })
    change({ browserKeepCookies: false })
    expect(deps.clearBrowserData).toHaveBeenCalledTimes(1)
    change({ theme: 'dark' })
    expect(deps.clearBrowserData).toHaveBeenCalledTimes(1)
    change({ browserKeepCookies: true })
    expect(deps.clearBrowserData).toHaveBeenCalledTimes(1)
  })

  it('effacement en échec : signalé, les autres effets suivent', async () => {
    const { deps, change } = harness({ browserKeepCookies: true })
    deps.clearBrowserData.mockRejectedValueOnce(new Error('partition occupée'))
    change({ browserKeepCookies: false })
    await vi.waitFor(() => expect(deps.onError).toHaveBeenCalledTimes(1))
    expect(deps.settingsChanged).toHaveBeenCalledTimes(1)
  })

  it('langue changée : main en anglais, menu reconstruit, fenêtres prévenues, macOS suivi', () => {
    const { deps, change } = harness({ language: 'fr' })
    expect(currentLanguage()).toBe('fr')
    change({ language: 'en' })
    expect(currentLanguage()).toBe('en')
    expect(deps.refreshMenu).toHaveBeenCalledTimes(1)
    expect(deps.languageChanged).toHaveBeenCalledWith('en')
    expect(deps.syncNativeLanguage).toHaveBeenCalledWith('en', 'fr')
    // Autre réglage : ni menu ni langue de nouveau.
    change({ theme: 'light' })
    expect(deps.refreshMenu).toHaveBeenCalledTimes(1)
    expect(deps.languageChanged).toHaveBeenCalledTimes(1)
    expect(deps.syncNativeLanguage).toHaveBeenCalledTimes(1)
  })

  it('thème : suivi par nativeTheme ; chaque changement renvoie la vue des réglages', () => {
    const { deps, change } = harness()
    change({ theme: 'dark' })
    expect(theme.themeSource).toBe('dark')
    expect(deps.settingsChanged).toHaveBeenCalledTimes(1)
    expect(deps.attentionChanged).toHaveBeenCalledTimes(1)
    expect(deps.updateKeepAwake).toHaveBeenCalledTimes(1)
  })

  it('raccourci de la fenêtre rapide changé : réenregistré, et le menu l’affiche', () => {
    const { deps, change } = harness()
    change({ quickEntryShortcut: 'alt-space' })
    expect(deps.quickShortcut.apply).toHaveBeenLastCalledWith('alt-space')
    expect(deps.refreshMenu).toHaveBeenCalledTimes(1)
  })
})
