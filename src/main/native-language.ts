/**
 * Langue des parties de macOS et de Chromium (fiche 074, question 2) : dialogues Ouvrir et
 * Enregistrer, entrées que macOS ajoute aux menus, fenêtre À propos, textes de Chromium. Elles
 * prennent leur langue au lancement, dans la langue « par app » de macOS : `AppleLanguages` du
 * domaine de l'app, celle de Réglages Système › Général › Langue et région › Applications.
 *
 * L'app la pose pour une langue choisie et la retire pour « Système » ; effet au prochain
 * lancement, d'où « Relancer » dans les Réglages. Seulement l'app packagée : en développement, le
 * domaine est celui d'Electron, partagé par toutes les apps en développement.
 */
import type { Language } from '@shared/i18n'
import type { LanguagePreference } from '@shared/preferences'
import { systemLanguage } from './i18n'

/** `AppleLanguages` du domaine de l'app (injecté : `systemPreferences`). */
export interface AppLanguageDefault {
  set: (languages: string[]) => void
  remove: () => void
}

/** `AppleLanguages` du domaine de l'app, par les préférences de macOS d'Electron. */
export const systemAppLanguage = (prefs: {
  setUserDefault: (key: 'AppleLanguages', type: 'array', value: string[]) => void
  removeUserDefault: (key: 'AppleLanguages') => void
}): AppLanguageDefault => ({
  set: (languages) => prefs.setUserDefault('AppleLanguages', 'array', languages),
  remove: () => prefs.removeUserDefault('AppleLanguages')
})

/**
 * Met la langue « par app » de macOS d'accord avec le réglage. Au lancement (`previous` absent),
 * « Système » ne retire rien : la langue choisie pour l'app dans Réglages Système reste.
 */
export function syncNativeLanguage(
  store: AppLanguageDefault,
  preference: LanguagePreference,
  previous?: LanguagePreference
): void {
  if (preference !== 'system') store.set([preference])
  else if (previous !== undefined && previous !== 'system') store.remove()
}

/** Langue de Chromium et de macOS pour ce lancement, d'après celle de Chromium (`app.getLocale()`). */
export const launchLanguage = (chromiumLocale: string): Language => systemLanguage([chromiumLocale])
