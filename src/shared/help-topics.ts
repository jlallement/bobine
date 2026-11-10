/**
 * Sujets d'aide de l'interface (fiche 186) : chaque lien « ? » et chaque « En savoir plus » d'une
 * astuce (fiche 191) vise une page du guide (`docs/guide/<langue>/<page>.md`) et une ancre
 * stable, la même dans chaque langue. Un essai (`help-topics.test.ts`) vérifie qu'elles existent.
 */

export interface HelpTarget {
  /** Nom du fichier sans `.md`. */
  page: string
  anchor?: string
}

export const HELP_TOPICS = {
  worktreeSetup: { page: 'worktrees', anchor: 'preparation' },
  worktreeMerge: { page: 'worktrees', anchor: 'fusionner' },
  review: { page: 'faire-relire', anchor: 'lancer' },
  scheduledTasks: { page: 'taches-planifiees' },
  aside: { page: 'aparte', anchor: 'poser' },
  compact: { page: 'conversations', anchor: 'commandes' },
  shortcuts: { page: 'raccourcis' },
  settingsPrivacy: { page: 'reglages', anchor: 'autorisations' },
  settingsBrowser: { page: 'reglages', anchor: 'navigateur' },
  settingsData: { page: 'reglages', anchor: 'sauvegarde' },
  settingsTrash: { page: 'reglages', anchor: 'corbeille' },
  memory: { page: 'memoire', anchor: 'reglages' },
  settingsAgents: { page: 'agents', anchor: 'page-agent' },
  diagnostics: { page: 'depannage', anchor: 'diagnostic' },
  // Première conversation, juste après l'accueil du premier lancement (fiche 188).
  gettingStarted: { page: 'premiers-pas' },
  permissions: { page: 'conversations', anchor: 'autorisations' }
} as const satisfies Record<string, HelpTarget>

export type HelpTopic = keyof typeof HELP_TOPICS

export const isHelpTopic = (value: unknown): value is HelpTopic =>
  typeof value === 'string' && Object.hasOwn(HELP_TOPICS, value)
