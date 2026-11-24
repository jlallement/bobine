/**
 * Effets d'un réglage changé (`settings-effects.ts`) : ici, « Garder les cookies du navigateur »
 * (fiche 072). Décoché, ce qui est déjà sur le disque part tout de suite ; rien d'autre ne
 * l'efface. Le vidage réel de la partition est essayé dans `browser-manager.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/preferences'

vi.mock('electron', () => ({ nativeTheme: { themeSource: 'system' } }))

const { applySettingsChanges } = await import('./settings-effects')

function setup(initial: Partial<Preferences> = {}) {
  let preferences: Preferences = { ...DEFAULT_PREFERENCES, language: 'fr', ...initial }
  let listener: () => void = () => {}
  const clearBrowserData = vi.fn().mockResolvedValue(undefined)
  const onError = vi.fn()
  applySettingsChanges({
    settings: {
      preferences: () => preferences,
      onChange: (l: () => void) => {
        listener = l
        return () => {}
      }
    } as never,
    attentionChanged: () => {},
    clearBrowserData,
    updateKeepAwake: () => {},
    quickShortcut: { state: { shortcut: null }, apply: () => {} } as never,
    refreshMenu: () => {},
    startLanguage: 'fr',
    systemLanguages: () => ['fr-FR'],
    languageChanged: () => {},
    settingsChanged: () => {},
    onError
  })
  const change = (next: Partial<Preferences>) => {
    preferences = { ...preferences, ...next }
    listener()
  }
  return { change, clearBrowserData, onError }
}

describe('cookies du navigateur plus gardés (fiche 072)', () => {
  it('décoché : ceux du disque effacés aussitôt, une seule fois', () => {
    const { change, clearBrowserData } = setup()
    expect(DEFAULT_PREFERENCES.browserKeepCookies).toBe(true)
    change({ theme: 'dark' })
    expect(clearBrowserData).not.toHaveBeenCalled()
    change({ browserKeepCookies: false })
    expect(clearBrowserData).toHaveBeenCalledTimes(1)
    // Un autre réglage ensuite : rien de plus.
    change({ theme: 'light' })
    expect(clearBrowserData).toHaveBeenCalledTimes(1)
  })

  it('recoché : rien n’est effacé ; décoché de nouveau : effacé de nouveau', () => {
    const { change, clearBrowserData } = setup({ browserKeepCookies: false })
    change({ browserKeepCookies: true })
    expect(clearBrowserData).not.toHaveBeenCalled()
    change({ browserKeepCookies: false })
    expect(clearBrowserData).toHaveBeenCalledTimes(1)
  })

  it('effacement en échec : l’erreur est remontée, pas avalée', async () => {
    const { change, clearBrowserData, onError } = setup()
    const failure = new Error('partition occupée')
    clearBrowserData.mockRejectedValueOnce(failure)
    change({ browserKeepCookies: false })
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure))
  })
})
