/**
 * Dates et nombres dans la langue de l'interface (fiche 074). Chaque processus a sa langue
 * courante (i18next) ; avant toute initialisation, c'est celle de départ (les tests unitaires).
 */
import i18next from 'i18next'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './language'

/** Région de formatage de chaque langue (`Intl`). */
const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-US' }

/** Langue courante pour `Intl` et `toLocale…String` : « fr-FR », « en-US ». */
export function currentLocale(): string {
  const language = i18next.resolvedLanguage
  return LOCALES[isLanguage(language) ? language : DEFAULT_LANGUAGE]
}

/** Formats de nombres déjà créés, par langue et options (leur création coûte plus que l'usage). */
const numberFormats = new Map<string, Intl.NumberFormat>()

export function numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const locale = currentLocale()
  const key = `${locale} ${JSON.stringify(options)}`
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(locale, options)
    numberFormats.set(key, format)
  }
  return format
}

/** Nombre entier au format de la langue : « 20 000 », « 20,000 » (fiche 192). */
export const countText = (n: number): string => numberFormat().format(n)
