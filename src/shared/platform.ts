/**
 * Capacités de la plateforme (fiche 145, ADR-0032) : ce que la machine permet, décidé par le main
 * (`main/platform.ts`) et passé au renderer à la création de la fenêtre, comme la langue
 * (fiche 074) : connues dès le premier rendu. Le renderer lit ces capacités, jamais le nom du
 * système, et masque ce qui manque.
 */
export const PLATFORM_FEATURES = [
  /** Simulateur iOS (Xcode) : onglet, outils `ios_*`, groupe du Diagnostic. */
  'simulator',
  /** L'app se copie elle-même dans le dossier des applications (fiche 073). */
  'selfInstall',
  /** Langue des fenêtres du système réglée par l'app (fiche 074). */
  'nativeLanguage',
  /** Capture d'une zone de l'écran jointe au message (fiche 062). */
  'screenCapture',
  /** Le gestionnaire de fichiers s'appelle « Finder » (fiche 158) ; ailleurs, son nom générique. */
  'finder'
] as const

export type PlatformFeature = (typeof PLATFORM_FEATURES)[number]
export type PlatformFeatures = Record<PlatformFeature, boolean>

/** Toutes les capacités : celles du Mac, et la valeur sans argument (essais du renderer). */
export const ALL_FEATURES: PlatformFeatures = {
  simulator: true,
  selfInstall: true,
  nativeLanguage: true,
  screenCapture: true,
  finder: true
}

export const FEATURES_ARG = '--bobine-features='

/**
 * Argument du renderer : les capacités présentes, séparées par des virgules ; `none` s'il n'y en a
 * aucune (Chromium réduit `--nom=` vide à `--nom`).
 */
export function featuresArgument(features: PlatformFeatures): string {
  return FEATURES_ARG + (PLATFORM_FEATURES.filter((name) => features[name]).join(',') || 'none')
}

/** Capacités passées par le main ; toutes si l'argument manque. */
export function featuresFromArgv(argv: readonly string[]): PlatformFeatures {
  const value = argv.find((arg) => arg.startsWith(FEATURES_ARG))?.slice(FEATURES_ARG.length)
  if (value === undefined) {
    // `--bobine-features` sans valeur : liste vide raccourcie par Chromium, aucune capacité.
    const empty = argv.includes(FEATURES_ARG.slice(0, -1))
    return empty ? featuresFromArgv([`${FEATURES_ARG}none`]) : { ...ALL_FEATURES }
  }
  const present = new Set(value.split(','))
  return Object.fromEntries(
    PLATFORM_FEATURES.map((name) => [name, present.has(name)])
  ) as PlatformFeatures
}
