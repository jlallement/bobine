import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, LANGUAGE_ARG, isLanguage, languageFromArgv } from './language'

describe('langue passée au renderer', () => {
  it('lit la langue de la ligne de commande', () => {
    expect(languageFromArgv(['/app', '--type=renderer', `${LANGUAGE_ARG}en`])).toBe('en')
    expect(languageFromArgv([`${LANGUAGE_ARG}fr`])).toBe('fr')
  })

  it('langue de départ si elle manque ou est inconnue', () => {
    expect(languageFromArgv(['/app'])).toBe(DEFAULT_LANGUAGE)
    expect(languageFromArgv([`${LANGUAGE_ARG}de`])).toBe(DEFAULT_LANGUAGE)
    expect(languageFromArgv([`${LANGUAGE_ARG}`])).toBe(DEFAULT_LANGUAGE)
  })

  it('reconnaît les langues de l’app seulement', () => {
    expect(isLanguage('fr')).toBe(true)
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('EN')).toBe(false)
    expect(isLanguage(undefined)).toBe(false)
  })
})
