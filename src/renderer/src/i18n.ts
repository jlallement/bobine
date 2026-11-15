/**
 * Langue de l'interface côté renderer (fiche 074, ADR-0014) : celle que le main a passée à la
 * fenêtre (preload), puis celle choisie dans les Réglages. Les composants traduisent avec
 * `useTranslation()` de react-i18next, qui les refait au changement de langue.
 */
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { i18nOptions, typography, type Language } from '@shared/i18n'
import { keyNotation, setKeyNotation } from '@shared/shortcuts'
import { platformFeatures } from './platform-features'

export function initI18n(language: Language): void {
  // Raccourcis des textes en ⌘ sur macOS, en Ctrl ailleurs (fiche 145).
  setKeyNotation(platformFeatures().commandKey)
  // Textes du système (« cet ordinateur », Explorateur…) d'après les capacités (fiches 145, 229).
  const options = i18nOptions(language, platformFeatures())
  void i18next
    .use(initReactI18next)
    .use(typography)
    .use(keyNotation)
    .init({ ...options, postProcess: ['typography', 'keyNotation'] })
  document.documentElement.lang = language
}

/** Langue changée dans les Réglages : sans recharger la fenêtre ni perdre ce qui est en cours. */
export function setLanguage(language: Language): void {
  void i18next.changeLanguage(language)
  document.documentElement.lang = language
}
