import { describe, expect, it } from 'vitest'
import { launchLanguage, syncNativeLanguage, type AppLanguageDefault } from './native-language'

function store() {
  const calls: string[] = []
  const s: AppLanguageDefault = {
    set: (languages) => calls.push(`set ${languages.join(',')}`),
    remove: () => calls.push('remove')
  }
  return { s, calls }
}

describe('langue de macOS et de Chromium (fiche 074)', () => {
  it('une langue choisie devient celle de l’app pour macOS, au lancement comme au changement', () => {
    const { s, calls } = store()
    syncNativeLanguage(s, 'en')
    syncNativeLanguage(s, 'fr', 'en')
    expect(calls).toEqual(['set en', 'set fr'])
  })

  it('« Système » la retire seulement si l’app l’avait posée', () => {
    const { s, calls } = store()
    // Au lancement : la langue choisie pour l'app dans Réglages Système reste.
    syncNativeLanguage(s, 'system')
    syncNativeLanguage(s, 'system', 'system')
    expect(calls).toEqual([])
    syncNativeLanguage(s, 'system', 'en')
    expect(calls).toEqual(['remove'])
  })

  it('langue de ce lancement d’après celle de Chromium', () => {
    expect(launchLanguage('fr')).toBe('fr')
    expect(launchLanguage('en-US')).toBe('en')
    expect(launchLanguage('de')).toBe('en')
  })
})
