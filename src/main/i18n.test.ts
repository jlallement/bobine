import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { t } from 'i18next'
import { afterAll, describe, expect, it } from 'vitest'
import { LANGUAGE_ARG, languageFromArgv } from '@shared/i18n'
import {
  changeLanguage,
  currentLanguage,
  rendererArguments,
  resolveLanguage,
  savedLanguage,
  systemLanguage
} from './i18n'

describe('langue de l’app côté main (fiche 074)', () => {
  afterAll(() => changeLanguage('fr'))

  it('celle de macOS : la première langue préférée que l’app sait afficher, l’anglais sinon', () => {
    expect(systemLanguage(['fr-FR', 'en-US'])).toBe('fr')
    expect(systemLanguage(['de-DE', 'en-GB', 'fr-FR'])).toBe('en')
    expect(systemLanguage(['de-CH', 'fr_CH'])).toBe('fr')
    expect(systemLanguage(['zh-Hans-CN'])).toBe('en')
    expect(systemLanguage([])).toBe('en')
  })

  it('`BOBINE_LANG` l’impose, puis le réglage, puis macOS', () => {
    expect(resolveLanguage('system', ['fr-FR'], {})).toBe('fr')
    expect(resolveLanguage('en', ['fr-FR'], {})).toBe('en')
    expect(resolveLanguage('fr', ['de-DE'], {})).toBe('fr')
    expect(resolveLanguage('fr', ['fr-FR'], { BOBINE_LANG: 'en' })).toBe('en')
    expect(resolveLanguage('system', ['de-DE'], { BOBINE_LANG: 'de' })).toBe('en')
  })

  it('lit le réglage dans settings.json avant toute fenêtre, « system » sinon', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bobine-lang-'))
    const file = join(dir, 'settings.json')
    expect(savedLanguage(file)).toBe('system')
    writeFileSync(file, JSON.stringify({ language: 'en', theme: 'dark' }))
    expect(savedLanguage(file)).toBe('en')
    writeFileSync(file, JSON.stringify({ language: 'de' }))
    expect(savedLanguage(file)).toBe('system')
    writeFileSync(file, '{ abîmé')
    expect(savedLanguage(file)).toBe('system')
  })

  it('change de langue à chaud et passe la sienne au renderer, que le preload relit', () => {
    expect(currentLanguage()).toBe('fr')
    expect(changeLanguage('fr')).toBe(false)
    expect(changeLanguage('en')).toBe(true)
    expect(currentLanguage()).toBe('en')
    expect(t('settings.general.language.label')).toBe('Language')
    expect(rendererArguments()).toEqual([`${LANGUAGE_ARG}en`])
    expect(languageFromArgv(['/app', ...rendererArguments()])).toBe('en')
  })
})
