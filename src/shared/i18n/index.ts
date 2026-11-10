/**
 * Traductions de l'interface (fiche 074, ADR-0014) : i18next dans le main comme dans le renderer,
 * avec les mêmes ressources JSON. `fr.json` est la référence ; `locales.test.ts` vérifie que
 * chaque langue a les mêmes clés, les mêmes variables et les formes de pluriel de sa langue.
 */
import type { InitOptions } from 'i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './language'

export * from './language'
export { typography } from './typography'

export const resources = {
  fr: { translation: fr },
  en: { translation: en }
} as const satisfies Record<Language, { translation: object }>

/**
 * Réglages communs aux deux processus ; le renderer y ajoute le greffon de React. Chaque instance
 * enregistre aussi `typography` (`.use(typography)`), que `postProcess` applique.
 */
export function i18nOptions(language: Language): InitOptions {
  return {
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...LANGUAGES],
    // Ressources livrées avec l'app : prêtes dès l'appel, `t` répond tout de suite.
    initAsync: false,
    // React échappe le texte ; le main ne produit pas de HTML (menus, dialogues, notifications).
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    postProcess: ['typography']
  }
}
