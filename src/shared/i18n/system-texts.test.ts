import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { ALL_FEATURES } from '../platform'
import { LANGUAGES, i18nOptions, resources } from './index'
import { SYSTEM_TEXT_GROUPS, systemTextGroups, withSystemTexts } from './system-texts'

type Tree = { readonly [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.set(path, value)
    else for (const [k, v] of flatten(value, path)) out.set(k, v)
  }
  return out
}

const LINUX = { finder: false, explorer: false }
const WINDOWS = { finder: false, explorer: true }
const vars = (text: string) => [...text.matchAll(/\{\{\s*([\w.]+)/g)].map((m) => m[1]).sort()

/**
 * Textes qui parlent encore du Mac hors du Mac : chacun n'est montré qu'avec une capacité du Mac
 * (entre parenthèses), ou relève d'une autre fiche. Un nouveau texte « Mac », « Finder », « Dock »
 * ou « trousseau macOS » doit avoir sa variante dans `systemTexts`, ou venir ici avec sa raison.
 */
const MAC_ONLY = new Set([
  'composer.capture.unavailable.denied', // screenCapture
  'composer.capture.unavailable.restricted', // screenCapture
  'composer.capture.unavailable.failed', // screenCapture
  'workspaceMenu.revealFinder', // finder (variantes revealFiles, revealExplorer)
  'settings.general.language.native', // nativeLanguage
  'settings.notifications.dockBadge.label', // dockBadge
  'diagnostics.check.screenNotDetermined', // screenCapture
  'diagnostics.check.axeQuarantineFix', // simulator
  'install.scope.everyone.title', // selfInstall
  'install.scope.everyone.denied' // selfInstall
])
// Polices du Mac comprises (fiche 145, D9) : « sinon SF Mono » était faux sous Linux et Windows.
const MAC_WORDS =
  /\bMac\b|macOS|Finder|\bDock\b|Keychain|trousseau macOS|\bApple\b|\bSF (Pro|Mono)\b|New York/

describe('textes propres au système (fiches 145, 229)', () => {
  it('groupes : aucun sur le Mac, générique ailleurs, Windows par-dessus', () => {
    expect(systemTextGroups(ALL_FEATURES)).toEqual([])
    expect(systemTextGroups(LINUX)).toEqual(['withoutFinder'])
    expect(systemTextGroups(WINDOWS)).toEqual(['withoutFinder', 'explorer'])
  })

  it('sur le Mac, les textes sont ceux des fichiers, à l’identique', () => {
    for (const lang of LANGUAGES) {
      const messages = resources[lang].translation
      expect(withSystemTexts(messages, ALL_FEATURES)).toBe(messages)
    }
  })

  it('chaque variante remplace un texte existant, avec les mêmes variables', () => {
    for (const lang of LANGUAGES) {
      const messages = resources[lang].translation as unknown as Tree
      const base = flatten(messages)
      const groups = messages['systemTexts'] as Tree
      expect(Object.keys(groups).sort()).toEqual([...SYSTEM_TEXT_GROUPS].sort())
      for (const group of SYSTEM_TEXT_GROUPS) {
        for (const [key, text] of flatten(groups[group] as Tree)) {
          expect(base.has(key), `${lang} ${group} ${key}`).toBe(true)
          expect(vars(text), `${lang} ${group} ${key}`).toEqual(vars(base.get(key) ?? ''))
        }
      }
    }
  })

  it('hors du Mac, plus de Mac, de Finder ni de Dock (sauf textes de capacités du Mac)', () => {
    for (const lang of LANGUAGES) {
      for (const features of [LINUX, WINDOWS]) {
        const texts = flatten(withSystemTexts(resources[lang].translation, features) as Tree)
        const left = [...texts]
          .filter(([key, text]) => !key.startsWith('systemTexts.') && MAC_WORDS.test(text))
          .map(([key]) => key)
          .filter((key) => !MAC_ONLY.has(key))
        expect(left, `${lang} ${JSON.stringify(features)}`).toEqual([])
      }
    }
  })

  it('police du terminal : SF Mono sur le Mac, la chasse fixe du système ailleurs (fiche 145)', () => {
    const hint = (features: { finder: boolean; explorer: boolean }) =>
      flatten(withSystemTexts(resources.fr.translation, features) as Tree).get(
        'settings.appearance.terminalFont.hint'
      )
    expect(hint(ALL_FEATURES)).toBe('Automatique : une « Nerd Font » installée, sinon SF Mono.')
    for (const features of [LINUX, WINDOWS]) {
      expect(hint(features)).toBe(
        'Automatique : une « Nerd Font » installée, sinon la police à chasse fixe du système.'
      )
    }
  })

  it('Windows nomme l’Explorateur et DPAPI ; Linux, le gestionnaire de fichiers', async () => {
    const t = async (features: typeof LINUX, key: string) => {
      const i18n = i18next.createInstance()
      await i18n.init({ ...i18nOptions('fr', features), interpolation: { skipOnVariables: true } })
      // Clé lue dans les ressources (pas de variables : « {{agent}} » reste tel quel).
      return i18n.getResource('fr', 'translation', key) as string
    }
    expect(await t(LINUX, 'changes.reveal')).toBe('Afficher dans le gestionnaire de fichiers')
    expect(await t(WINDOWS, 'changes.reveal')).toBe('Afficher dans l’Explorateur de fichiers')
    expect(await t(LINUX, 'usage.board.account.title')).toBe('{{agent}} sur cet ordinateur')
    expect(await t(WINDOWS, 'blocker.auth.keyHint')).toContain('DPAPI')
    expect(await t(ALL_FEATURES, 'changes.reveal')).toBe('Afficher dans le Finder')
  })
})
