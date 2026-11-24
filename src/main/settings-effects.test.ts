import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/preferences'
import { changeLanguage, currentLanguage } from './i18n'

/**
 * Ce que l'app fait quand un réglage change (fiches 027, 062, 072, 074), avec un Electron simulé :
 * remplace, côté main, « English : menu macOS reconstruit en anglais » (e2e `language` n° 3) et
 * « cookies plus gardés → ceux du disque effacés aussitôt » (e2e `settings` n° 17). Le menu natif
 * réellement redessiné reste vu par l'e2e.
 */

const nativeTheme = { themeSource: 'system' as string }
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
    changeLanguage('fr')
    if (imposed !== undefined) process.env['BOBINE_LANG'] = imposed
  })

  it('langue English : le main change de langue, le menu est reconstruit, les fenêtres suivent', () => {
    const { deps, change } = setup()
    change({ language: 'en' })
    expect(currentLanguage()).toBe('en')
    expect(deps.refreshMenu).toHaveBeenCalledTimes(1)
    expect(deps.languageChanged).toHaveBeenCalledWith('en')
    // Les fenêtres de macOS suivront au prochain lancement : l'ancien choix est donné aussi.
    expect(deps.syncNativeLanguage).toHaveBeenCalledWith('en', 'fr')
    expect(deps.settingsChanged).toHaveBeenCalledTimes(1)
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

  it('cookies plus gardés : ceux du disque effacés aussitôt, une fois ; regardés de nouveau : rien', async () => {
    const { deps, change } = setup()
    change({ browserKeepCookies: false })
    expect(deps.clearBrowserData).toHaveBeenCalledTimes(1)
    change({ density: 'compact' })
    change({ browserKeepCookies: true })
    expect(deps.clearBrowserData).toHaveBeenCalledTimes(1)
  })

  it('effacement des cookies en échec : l’erreur va au journal, le reste suit', async () => {
    const { deps, change } = setup()
    const failure = new Error('partition occupée')
    deps.clearBrowserData.mockRejectedValueOnce(failure)
    change({ browserKeepCookies: false })
    await vi.waitFor(() => expect(deps.onError).toHaveBeenCalledWith(failure))
    expect(deps.settingsChanged).toHaveBeenCalledTimes(1)
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
