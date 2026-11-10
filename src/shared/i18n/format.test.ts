import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { currentLocale, numberFormat } from './format'
import { i18nOptions } from './index'

describe('formats de la langue courante', () => {
  it('français par défaut', () => {
    expect(currentLocale()).toBe('fr-FR')
    expect(numberFormat().format(16748)).toBe('16 748')
  })

  it('suit la langue d’i18next', async () => {
    await i18next.init(i18nOptions('en'))
    expect(currentLocale()).toBe('en-US')
    expect(numberFormat().format(16748)).toBe('16,748')
    await i18next.changeLanguage('fr')
    expect(numberFormat({ maximumFractionDigits: 1 }).format(1.25)).toBe('1,3')
  })
})
