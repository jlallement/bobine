import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { i18nOptions, typography } from './index'
import { frenchTypography } from './typography'

const nbsp = (text: string) => text.replace(/~/g, '\u00a0')

describe('typographie du français (fiche 126)', () => {
  it('« de » et « que » s’élident devant une voyelle, pas ailleurs', () => {
    expect(frenchTypography('Fichier de OpenCode')).toBe('Fichier d’OpenCode')
    expect(frenchTypography('celui que IBM Bob choisit')).toBe('celui qu’IBM Bob choisit')
    expect(frenchTypography('Fichier de Bob, de 3 fichiers')).toBe('Fichier de Bob, de 3 fichiers')
    expect(frenchTypography('Suède Orient')).toBe('Suède Orient')
    expect(frenchTypography('Modification de index.html')).toBe('Modification de index.html')
  })

  it('espace insécable avant « : ; ? ! % » » et après « « » (recette C1)', () => {
    expect(frenchTypography('Le menu « … » : ils valent ; vraiment ? oui ! 45 %')).toBe(
      nbsp('Le menu «~…~»~: ils valent~; vraiment~? oui~! 45~%')
    )
    expect(frenchTypography('https://exemple.test:8080/a?b')).toBe('https://exemple.test:8080/a?b')
  })

  it('appliquée par i18next en français, pas en anglais', () => {
    for (const [lng, expected] of [
      ['fr', 'Quota d’IBM Bob'],
      ['en', 'IBM Bob quota']
    ] as const) {
      const i18n = i18next.createInstance()
      void i18n.use(typography).init(i18nOptions(lng))
      expect(i18n.t('quota.label', { agent: 'IBM Bob' })).toBe(expected)
    }
  })
})
