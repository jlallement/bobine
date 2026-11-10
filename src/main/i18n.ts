/**
 * Langue de l'interface côté main (fiche 074, ADR-0014) : i18next pour les textes du main, et la
 * langue passée à chaque fenêtre du renderer (lue par le preload).
 */
import { readFileSync } from 'node:fs'
import i18next from 'i18next'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_ARG,
  i18nOptions,
  typography,
  isLanguage,
  type Language
} from '@shared/i18n'
import { parsePreferences, type LanguagePreference } from '@shared/preferences'

/** Langue d'un Mac dont aucune langue préférée n'est proposée par l'app (ADR-0014). */
export const SYSTEM_FALLBACK: Language = 'en'

/**
 * Langue de macOS : la première des langues préférées de l'utilisateur que l'app sait afficher,
 * comme macOS le fait pour une app traduite ; l'anglais sinon.
 */
export function systemLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0]
    if (isLanguage(base)) return base
  }
  return SYSTEM_FALLBACK
}

/**
 * Langue de l'app : `BOBINE_LANG` l'impose (essais), puis le réglage « Langue », puis celle de
 * macOS (`app.getPreferredSystemLanguages()`).
 */
export function resolveLanguage(
  preference: LanguagePreference,
  systemLanguages: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): Language {
  const imposed = env['BOBINE_LANG']
  if (isLanguage(imposed)) return imposed
  if (preference !== 'system') return preference
  return systemLanguage(systemLanguages)
}

/**
 * Réglage « Langue » lu dans `settings.json` avant toute fenêtre (le gestionnaire des conversations
 * le relit ensuite). Fichier absent ou illisible : « system », sans le mettre de côté.
 */
export function savedLanguage(settingsFile: string): LanguagePreference {
  try {
    return parsePreferences(JSON.parse(readFileSync(settingsFile, 'utf8'))).language ?? 'system'
  } catch {
    return 'system'
  }
}

export function initI18n(language: Language): void {
  void i18next.use(typography).init(i18nOptions(language))
}

/** Change la langue du main ; rend vrai si elle a changé. */
export function changeLanguage(language: Language): boolean {
  if (language === currentLanguage()) return false
  void i18next.changeLanguage(language)
  return true
}

/** Langue courante du main (celle de départ tant qu'i18next n'est pas prêt). */
export function currentLanguage(): Language {
  const language = i18next.resolvedLanguage
  return isLanguage(language) ? language : DEFAULT_LANGUAGE
}

/** Arguments ajoutés au renderer d'une fenêtre de l'app : sa langue. */
export function rendererArguments(): string[] {
  return [`${LANGUAGE_ARG}${currentLanguage()}`]
}
