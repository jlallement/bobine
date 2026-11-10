/**
 * Langues de l'interface (fiche 074, ADR-0014). Module léger, sans i18next : le preload s'en sert
 * pour lire la langue que le main lui passe.
 */

export const LANGUAGES = ['fr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/**
 * Nom de chaque langue dans cette langue, comme dans le choix de langue de macOS : on retrouve la
 * sienne même dans une interface qu'on ne lit pas.
 */
export const LANGUAGE_NAMES: Record<Language, string> = { fr: 'Français', en: 'English' }

/** Langue de départ, et celle des essais : l'interface d'avant la fiche 074. */
export const DEFAULT_LANGUAGE: Language = 'fr'

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)

/** Argument ajouté à la ligne de commande du renderer (`additionalArguments`), lu par le preload. */
export const LANGUAGE_ARG = '--bobine-lang='

/** Langue passée au renderer par le main ; celle de départ si l'argument manque ou est inconnu. */
export function languageFromArgv(argv: readonly string[]): Language {
  const value = argv.find((arg) => arg.startsWith(LANGUAGE_ARG))?.slice(LANGUAGE_ARG.length)
  return isLanguage(value) ? value : DEFAULT_LANGUAGE
}
