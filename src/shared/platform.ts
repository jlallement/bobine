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
  'finder',
  /** Il s'appelle « Explorateur de fichiers » (Windows, fiche 229). */
  'explorer',
  /**
   * Chemins et lignes de commande de Windows (fiche 229) : `\` sépare les dossiers et n'échappe
   * rien (commande d'un agent personnalisé).
   */
  'windowsPaths',
  /** Compteur « À traiter » sur l'icône du Dock (fiche 024) ; pas d'API commune ailleurs. */
  'dockBadge',
  /**
   * Menu de l'app dans la barre du système (menu « Bobine », Services, Masquer… ; fiche 027).
   * Ailleurs : menu dans la fenêtre, masqué, affiché par Alt (fiche 145).
   */
  'appMenu',
  /**
   * Fenêtres sans barre de titre, boutons de la fenêtre posés sur le contenu (feux de macOS).
   * Ailleurs : décorations du système (fiche 145).
   */
  'insetTitleBar',
  /** Raccourcis affichés avec ⌘ (⇧⌘U) ; ailleurs, avec Ctrl (Ctrl+Maj+U, fiche 145). */
  'commandKey',
  /** Barres de défilement superposées du système ; ailleurs, barres fines dessinées par l'app. */
  'overlayScrollbars',
  /**
   * Surfaces flottantes en verre dépoli (Aurore) et menus qui apparaissent en fondu : fiables sur
   * le compositeur de macOS. Ailleurs, menus opaques, sans fondu (fiche 145).
   */
  'glass',
  /**
   * Une fenêtre transparente créée cachée peint sa page, et Electron émet `ready-to-show` : la
   * fenêtre rapide attend ce signal pour se montrer (fiche 062). Ailleurs, montrée à la fin du
   * chargement de sa page, `ready-to-show` pouvant ne jamais venir (fiche 250).
   */
  'hiddenPaint'
] as const

export type PlatformFeature = (typeof PLATFORM_FEATURES)[number]
export type PlatformFeatures = Record<PlatformFeature, boolean>

/** Toutes les capacités : celles du Mac, et la valeur sans argument (essais du renderer). */
export const ALL_FEATURES: PlatformFeatures = {
  simulator: true,
  selfInstall: true,
  nativeLanguage: true,
  screenCapture: true,
  finder: true,
  // Nom propre à Windows : faux sur le Mac, comme les autres valeurs de cette table.
  explorer: false,
  windowsPaths: false,
  dockBadge: true,
  appMenu: true,
  insetTitleBar: true,
  commandKey: true,
  overlayScrollbars: true,
  glass: true,
  hiddenPaint: true
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
