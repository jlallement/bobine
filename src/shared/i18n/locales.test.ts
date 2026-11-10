import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, LANGUAGES, i18nOptions, resources, typography } from './index'

type Tree = { readonly [key: string]: string | Tree }

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

/** Textes à plat : « sidebar.status.ready » → « Prêt ». */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.set(path, value)
    else for (const [k, v] of flatten(value, path)) out.set(k, v)
  }
  return out
}

/** Clés sans leur forme de pluriel (« toolGroup.failed_one » → « toolGroup.failed »). */
const baseKey = (key: string) => key.replace(PLURAL_SUFFIX, '')

/** Formes de pluriel présentes, par clé de base. */
function pluralForms(texts: Map<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const key of texts.keys()) {
    const form = PLURAL_SUFFIX.exec(key)?.[1]
    if (form) out.set(baseKey(key), [...(out.get(baseKey(key)) ?? []), form].sort())
  }
  return out
}

/** Variables d'une clé de base, toutes formes confondues (« {{count}} » → « count »). */
function variables(texts: Map<string, string>): Map<string, string[]> {
  const out = new Map<string, Set<string>>()
  for (const [key, text] of texts) {
    const names = out.get(baseKey(key)) ?? new Set<string>()
    for (const match of text.matchAll(/\{\{\s*([\w.]+)/g)) names.add(match[1] ?? '')
    out.set(baseKey(key), names)
  }
  return new Map([...out].map(([key, names]) => [key, [...names].sort()]))
}

const reference = flatten(resources[DEFAULT_LANGUAGE].translation)

describe('ressources de traduction', () => {
  for (const language of LANGUAGES) {
    const texts = flatten(resources[language].translation)

    it(`${language} : les mêmes clés que le français`, () => {
      const keys = (t: Map<string, string>) => [...new Set([...t.keys()].map(baseKey))].sort()
      expect(keys(texts)).toEqual(keys(reference))
    })

    it(`${language} : chaque pluriel a toutes les formes de la langue, rien de plus`, () => {
      // Sans l'une d'elles, i18next affiche la clé (en français : « many » pour 1 000 000).
      const expected = [...new Intl.PluralRules(language).resolvedOptions().pluralCategories].sort()
      const keys = new Set([...pluralForms(texts).keys(), ...pluralForms(reference).keys()])
      for (const key of keys) expect([key, pluralForms(texts).get(key)]).toEqual([key, expected])
    })

    it(`${language} : aucun texte vide, les mêmes variables que le français`, () => {
      for (const [key, text] of texts) expect([key, text.trim()]).not.toEqual([key, ''])
      expect(variables(texts)).toEqual(variables(reference))
    })
  }

  it('les aides des réglages tiennent en une phrase de 90 caractères au plus (fiche 133)', () => {
    for (const language of LANGUAGES) {
      const texts = flatten(resources[language].translation)
      for (const [key, text] of texts) {
        if (/^settings\..*(\.|)[hH]int$/.test(key))
          expect([language, key, text.length <= 90]).toEqual([language, key, true])
      }
    }
  })

  it('i18next choisit la forme du pluriel selon la langue', () => {
    const fr = i18next.createInstance()
    void fr.use(typography).init(i18nOptions('fr'))
    expect(fr.t('toolGroup.failed', { count: 1 })).toBe('1 échec')
    expect(fr.t('toolGroup.failed', { count: 2 })).toBe('2 échecs')
    expect(fr.t('toolGroup.failed', { count: 1_000_000 })).toBe('1000000 échecs')
    const en = i18next.createInstance()
    void en.use(typography).init(i18nOptions('en'))
    expect(en.t('sidebar.status.ready')).toBe('Ready')
    expect(en.t('toolGroup.cancelled', { count: 3 })).toBe('3 interrupted')
  })
})
