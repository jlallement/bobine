import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  THEME_CHOICES,
  themeChoiceOf,
  themeChoicePreferences
} from './preferences'

describe('parsePreferences', () => {
  it('garde les valeurs valides, arrondit au demi-pixel, ignore le reste', () => {
    expect(
      parsePreferences({
        theme: 'dark',
        conversationFont: 'sans',
        conversationFontSize: 14.3,
        terminalFontSize: 13,
        terminalFontFamily: '  Menlo '
      })
    ).toEqual({
      theme: 'dark',
      conversationFont: 'sans',
      conversationFontSize: 14.5,
      terminalFontSize: 13,
      terminalFontFamily: 'Menlo'
    })
    expect(
      parsePreferences({
        theme: 'bleu',
        conversationFont: 'Comic"; } body { color: red',
        conversationFontSize: 40,
        terminalFontSize: '12'
      })
    ).toEqual({})
    expect(parsePreferences(null)).toEqual({})
  })

  it('langue de l’interface : « system » ou une langue proposée (fiche 074)', () => {
    expect(parsePreferences({ language: 'system' })).toEqual({ language: 'system' })
    expect(parsePreferences({ language: 'en' })).toEqual({ language: 'en' })
    expect(parsePreferences({ language: 'de' })).toEqual({})
    expect(parsePreferences({ language: 'EN' })).toEqual({})
  })

  it('niveau du journal (fiche 080) : Normal ou Détaillé enregistrés, jamais Trace', () => {
    expect(parsePreferences({ logLevel: 'detailed' })).toEqual({ logLevel: 'detailed' })
    expect(parsePreferences({ logLevel: 'trace' })).toEqual({})
    expect(parsePreferences({ logLevel: 'bavard' })).toEqual({})
  })

  it('conversations gardées actives (fiche 102) : un entier de 2 à 12, 6 par défaut', () => {
    expect(DEFAULT_PREFERENCES.maxLive).toBe(6)
    expect(parsePreferences({ maxLive: 2 })).toEqual({ maxLive: 2 })
    expect(parsePreferences({ maxLive: 12 })).toEqual({ maxLive: 12 })
    for (const maxLive of [1, 13, 4.5, '6', null]) {
      expect(parsePreferences({ maxLive })).toEqual({})
    }
  })

  it('proposer des conversations filles (fiche 118) : trois valeurs, « Quand ça s’y prête » par défaut', () => {
    expect(DEFAULT_PREFERENCES.childProposals).toBe('whenFitting')
    for (const childProposals of ['never', 'whenFitting', 'always'] as const) {
      expect(parsePreferences({ childProposals })).toEqual({ childProposals })
    }
    for (const childProposals of ['parfois', true, null]) {
      expect(parsePreferences({ childProposals })).toEqual({})
    }
  })

  it('thème (fiche 136) : l’ancien Sépia ou Nuit noire devient un mode et le thème de ce mode', () => {
    expect(parsePreferences({ theme: 'sepia' })).toEqual({ theme: 'light', lightTheme: 'sepia' })
    expect(parsePreferences({ theme: 'black' })).toEqual({ theme: 'dark', darkTheme: 'black' })
    expect(parsePreferences({ theme: 'system', lightTheme: 'sepia', darkTheme: 'black' })).toEqual({
      theme: 'system',
      lightTheme: 'sepia',
      darkTheme: 'black'
    })
    // Un thème de l'autre mode n'est pas accepté.
    expect(parsePreferences({ lightTheme: 'black', darkTheme: 'sepia' })).toEqual({})
    // Fjord (fiche 168) : Fjord en clair, Fjord nuit en sombre, jamais l'inverse.
    expect(parsePreferences({ lightTheme: 'fjord', darkTheme: 'fjordNight' })).toEqual({
      lightTheme: 'fjord',
      darkTheme: 'fjordNight'
    })
    expect(parsePreferences({ lightTheme: 'fjordNight', darkTheme: 'fjord' })).toEqual({})
    // Le thème par défaut ne change pas.
    expect(DEFAULT_PREFERENCES).toMatchObject({
      theme: 'system',
      lightTheme: 'light',
      darkTheme: 'dark'
    })
  })

  it('polices (fiche 136) : un nom de police installée, les anciens choix repris par leur nom', () => {
    expect(parsePreferences({ codeFont: 'jetbrains' })).toEqual({ codeFont: 'JetBrains Mono' })
    expect(parsePreferences({ codeFont: 'menlo' })).toEqual({ codeFont: 'Menlo' })
    expect(parsePreferences({ codeFont: 'system' })).toEqual({ codeFont: 'system' })
    expect(parsePreferences({ codeFont: 'PT Mono', codeFontSize: 13.2 })).toEqual({
      codeFont: 'PT Mono',
      codeFontSize: 13
    })
    expect(parsePreferences({ conversationFont: 'Avenir Next' })).toEqual({
      conversationFont: 'Avenir Next'
    })
    for (const bad of ["Menlo'", 'a;b', '{x}', '', 'x'.repeat(101), 12]) {
      expect(parsePreferences({ codeFont: bad, conversationFont: bad })).toEqual({})
    }
    expect(parsePreferences({ codeFontSize: 30 })).toEqual({})
  })

  it('accent (fiche 136) : six teintes ; « Comme le Mac » (`system`, retiré) revient au défaut', () => {
    for (const accent of ['orange', 'blue', 'violet', 'pink', 'green', 'graphite']) {
      expect(parsePreferences({ accent })).toEqual({ accent })
    }
    expect(parsePreferences({ accent: 'jaune' })).toEqual({})
    expect(parsePreferences({ accent: 'system' })).toEqual({})
  })

  it('sept thèmes en une rangée : le thème coché et les préférences de chacun', () => {
    for (const choice of THEME_CHOICES) {
      const prefs = { ...DEFAULT_PREFERENCES, ...themeChoicePreferences(choice) }
      expect(themeChoiceOf(prefs)).toBe(choice)
    }
    expect(themeChoicePreferences('system')).toEqual({
      theme: 'system',
      lightTheme: 'light',
      darkTheme: 'dark'
    })
    expect(themeChoicePreferences('sepia')).toEqual({ theme: 'light', lightTheme: 'sepia' })
    expect(themeChoicePreferences('black')).toEqual({ theme: 'dark', darkTheme: 'black' })
    expect(themeChoicePreferences('fjord')).toEqual({ theme: 'light', lightTheme: 'fjord' })
    expect(themeChoicePreferences('fjordNight')).toEqual({
      theme: 'dark',
      darkTheme: 'fjordNight'
    })
  })
})

describe('densité et mode présentation (fiche 159)', () => {
  it('density : normale par défaut, compacte reprise, valeur inconnue ignorée', () => {
    expect(DEFAULT_PREFERENCES.density).toBe('normal')
    expect(parsePreferences({ density: 'compact' })).toEqual({ density: 'compact' })
    expect(parsePreferences({ density: 'normal' })).toEqual({ density: 'normal' })
    expect(parsePreferences({ density: 'serrée' })).toEqual({})
    expect(parsePreferences({ density: 3 })).toEqual({})
  })

  it('le mode présentation n’est pas une préférence : jamais repris d’un fichier', () => {
    expect(parsePreferences({ presentation: true, presenting: true })).toEqual({})
    expect('presentation' in DEFAULT_PREFERENCES).toBe(false)
  })
})
