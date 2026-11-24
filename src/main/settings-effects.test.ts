import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/preferences'
import { changeLanguage, currentLanguage } from './i18n'

/**
 * Ce que le main fait quand un réglage change (fiches 027, 062, 072, 074), avec un Electron
 * simulé : remplace les vérifications unitaires des e2e `settings` (n° 17 : cookies plus gardés →
 * ceux du disque effacés aussitôt) et `language` (n° 3 : menu reconstruit, fenêtres prévenues).
 * Le vidage réel de la partition est essayé dans `browser/browser-manager.test.ts` et
 * `browser/browser-clear-data.test.ts` ; le menu natif réellement redessiné reste vu par l'e2e.
 */

const nativeTheme = vi.hoisted(() => ({ themeSource: 'system' as string }))
vi.mock('electron', () => ({ nativeTheme }))

const { applySettingsChanges } = await import('./settings-effects')

function setup(start: Partial<Preferences> = {}) {
  let prefs: Preferences = { ...DEFAULT_PREFERENCES, language: 'fr', ...start }
  let listener: (() => void) | undefined
  const quick = { shortcut: prefs.quickEntryShortcut as string }
  const deps = {
    settings: {
      onChange: (l: () => void) => {
        listener = l
        return () => {}
      },
      preferences: () => prefs
    },
    attentionChanged: vi.fn(),
    clearBrowserData: vi.fn(async () => {}),
    updateKeepAwake: vi.fn(),
    quickShortcut: {
      state: quick,
      apply: vi.fn((shortcut: string) => {
        quick.shortcut = shortcut
      })
    },
    refreshMenu: vi.fn(),
    startLanguage: prefs.language,
    syncNativeLanguage: vi.fn(),
    systemLanguages: () => ['fr-FR'],
    languageChanged: vi.fn(),
    settingsChanged: vi.fn(),
    onError: vi.fn()
  }
  applySettingsChanges(deps as never)
  /** Un réglage change, comme `SettingsStore.setPreferences` le signale. */
  const change = (next: Partial<Preferences>) => {
    prefs = { ...prefs, ...next }
    listener?.()
  }
  return { deps, change }
}

describe('effets des réglages', () => {
  const imposed = process.env['BOBINE_LANG']
  beforeEach(() => {
    delete process.env['BOBINE_LANG']
    nativeTheme.themeSource = 'system'
  })
  afterEach(() => {
    // La langue du main est globale (i18next) : remise en français pour les autres essais.
    changeLanguage('fr')
    if (imposed !== undefined) process.env['BOBINE_LANG'] = imposed
  })

  it('décoché : ceux du disque effacés aussitôt, une seule fois', () => {
    const { deps, change } = setup()
    expect(DEFAULT_PREFERENCES.browserKeepCookies).toBe(true)
    change({ theme: 'dark' })
    expect(deps.clearBrowserData).not.toHaveBeenCalled()
    change({ browserKeepCookies: false })
    expect(deps.clearBrowserData).toHaveBeenCalledTimes(1)
    // Un autre réglage ensuite : rien de plus.
    change({ density: 'compact' })
    expect(deps.clearBrowserData).toHaveBeenCalledTimes(1)
  })

  it('recoché : rien n’est effacé ; décoché de nouveau : effacé de nouveau', () => {
    const { deps, change } = setup({ browserKeepCookies: false })
    change({ browserKeepCookies: true })
    expect(deps.clearBrowserData).not.toHaveBeenCalled()
    change({ browserKeepCookies: false })
    expect(deps.clearBrowserData).toHaveBeenCalledTimes(1)
  })

  it('effacement en échec : l’erreur est remontée, pas avalée ; les autres effets suivent', async () => {
    const { deps, change } = setup()
    const failure = new Error('partition occupée')
    deps.clearBrowserData.mockRejectedValueOnce(failure)
    change({ browserKeepCookies: false })
    await vi.waitFor(() => expect(deps.onError).toHaveBeenCalledWith(failure))
    expect(deps.settingsChanged).toHaveBeenCalledTimes(1)
  })

  it('langue English : le main change de langue, le menu est reconstruit, les fenêtres suivent', () => {
    const { deps, change } = setup()
    expect(currentLanguage()).toBe('fr')
    change({ language: 'en' })
    expect(currentLanguage()).toBe('en')
    expect(deps.refreshMenu).toHaveBeenCalledTimes(1)
    expect(deps.languageChanged).toHaveBeenCalledWith('en')
    // Les fenêtres de macOS suivront au prochain lancement : l'ancien choix est donné aussi.
    expect(deps.syncNativeLanguage).toHaveBeenCalledWith('en', 'fr')
    expect(deps.settingsChanged).toHaveBeenCalledTimes(1)
    // Autre réglage ensuite : ni menu ni langue de nouveau.
    change({ theme: 'light' })
    expect(deps.refreshMenu).toHaveBeenCalledTimes(1)
    expect(deps.languageChanged).toHaveBeenCalledTimes(1)
    expect(deps.syncNativeLanguage).toHaveBeenCalledTimes(1)
  })

  it('autre réglage : ni menu reconstruit ni langue renvoyée ; la vue des réglages, si', () => {
    const { deps, change } = setup()
    change({ density: 'compact' })
    expect(deps.refreshMenu).not.toHaveBeenCalled()
    expect(deps.languageChanged).not.toHaveBeenCalled()
    expect(deps.syncNativeLanguage).not.toHaveBeenCalled()
    expect(deps.settingsChanged).toHaveBeenCalledTimes(1)
    expect(deps.attentionChanged).toHaveBeenCalledTimes(1)
    expect(deps.updateKeepAwake).toHaveBeenCalledTimes(1)
  })

  it('« Système » : la langue du système décide (français ici), rien ne change', () => {
    const { deps, change } = setup()
    change({ language: 'system' })
    expect(currentLanguage()).toBe('fr')
    expect(deps.refreshMenu).not.toHaveBeenCalled()
    expect(deps.syncNativeLanguage).toHaveBeenCalledWith('system', 'fr')
  })

  it('raccourci de la fenêtre rapide changé : réenregistré, et le menu l’affiche', () => {
    const { deps, change } = setup({ quickEntryShortcut: 'alt-cmd-b' })
    change({ quickEntryShortcut: 'off' })
    expect(deps.quickShortcut.apply).toHaveBeenLastCalledWith('off')
    expect(deps.refreshMenu).toHaveBeenCalledTimes(1)
  })

  it('thème : suivi par `nativeTheme` (CSS, xterm.js, pages du navigateur)', () => {
    const { change } = setup()
    change({ theme: 'dark' })
    expect(nativeTheme.themeSource).toBe('dark')
  })
})
