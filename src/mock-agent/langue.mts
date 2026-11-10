/**
 * Langue de l'agent factice (fiche 167) : le français par défaut, l'anglais avec `--langue en` (ou
 * `MOCK_AGENT_LANG=en`), pour que les essais `--lang en` montrent un agent qui parle anglais.
 *
 * L'app ne traduit rien de ce qui vient d'un agent (ADR-0014) : c'est l'agent factice qui parle la
 * langue demandée, comme un vrai agent réglé dans la langue de son utilisateur. Les scénarios restent
 * écrits en français ; ce dictionnaire donne l'anglais de leurs phrases. Une phrase absente reste en
 * français (scénarios rares, textes calqués sur Bob ou OpenCode, déjà en anglais).
 */
export type MockLanguage = 'fr' | 'en'

/** `en`, `en-US`… : anglais ; tout le reste : français. */
export function mockLanguage(value: string | undefined): MockLanguage {
  return value?.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

/**
 * Français → anglais. Les entrées d'au moins `MIN_PHRASE` caractères se remplacent aussi au milieu
 * d'un texte (réponses composées ou répétées) ; les plus courtes seulement quand elles sont le texte
 * entier (noms de boutons, de modes) : « Refuser » ne doit pas changer une phrase qui le contient.
 */
const EN: Record<string, string> = {
  // Agent, modes, réglages, commandes.
  'Agent factice': 'Mock agent',
  // Autres dossiers (fiche 179).
  'Dossier de travail': 'Working folder',
  'Autres dossiers': 'Other folders',
  'Ligne reçue': 'Line received',
  'Pas de ligne sur les dossiers dans ce message.': 'No line about folders in this message.',
  'Aucun autre dossier reçu.': 'No other folder received.',
  // Connexion expirée (recette 0.9, D10).
  'Reconnecté, je peux répondre.': 'Signed in again, I can answer.',
  'Ce modèle est connecté, je peux répondre.': 'This model is signed in, I can answer.',
  Question: 'Ask',
  'Modifie le code': 'Changes the code',
  'Répond sans rien modifier': 'Answers without changing anything',
  'Prépare un plan sans rien modifier': 'Prepares a plan without changing anything',
  Modèle: 'Model',
  'Réponses détaillées': 'Detailed answers',
  Rapides: 'Fast',
  Précis: 'Precise',
  Fournisseurs: 'Providers',
  'Factice rapide': 'Mock fast',
  'Factice précis': 'Mock precise',
  'factice/Factice rapide': 'mock/Mock fast',
  'factice/Factice précis': 'mock/Mock precise',
  'Joue un scénario de l’agent factice pour ce tour': 'Plays a mock agent scenario for this turn',
  'nom du scénario (vide = liste)': 'scenario name (empty = list)',
  'Liste les scénarios disponibles': 'Lists the available scenarios',
  'Démonstration complète : réflexion, plan, outil, permission, diff':
    'Full demo: thinking, plan, tool, permission, diff',
  'Simule la connexion SSO de Bob': 'Simulates Bob’s SSO sign-in',
  // Permissions.
  Autoriser: 'Allow',
  'Toujours autoriser': 'Always allow',
  Refuser: 'Reject',
  'Refusé.': 'Rejected.',
  // Scénarios courants : demo, permission, diff, plan, appel-outil, pensee, lent, attend-stop.
  'Je commence par regarder le projet, puis je proposerai une modification.':
    'I’ll look at the project first, then suggest a change.',
  'Je regarde d’abord le projet. ': 'Looking at the project first. ',
  'Terminé. Tapez `/scenario` pour voir les autres scénarios.':
    'Done. Type `/scenario` to see the other scenarios.',
  'Terminé.': 'Done.',
  'Lecture de README.md': 'Reading README.md',
  '# Mon projet\n\nUn projet d’exemple.': '# My project\n\nAn example project.',
  'Modification de config.json': 'Editing config.json',
  'Je dois modifier la configuration. ': 'I need to change the configuration. ',
  'Configuration mise à jour.': 'Configuration updated.',
  'Entendu, je ne modifie pas la configuration.': 'Understood, I won’t change the configuration.',
  'Analyser le projet': 'Analyze the project',
  'Modifier la configuration': 'Change the configuration',
  'Vérifier le résultat': 'Check the result',
  'Plan terminé.': 'Plan complete.',
  'Fichier modifié.': 'File changed.',
  'Je lis le README. ': 'Reading the README. ',
  'C’est un projet d’exemple.': 'It’s an example project.',
  'L’utilisateur veut un exemple. Je vais répondre simplement.':
    'The user wants an example. I’ll keep the answer simple.',
  'Voici ma réponse après réflexion.': 'Here is my answer after thinking it over.',
  'Je réfléchis longuement… ': 'Thinking it over at length… ',
  'Les trois outils sont passés.': 'All three tools went through.',
  // Limite d'étapes (fiche 209).
  'Je regarde les entités du projet. ': 'Looking at the project’s entities. ',
  'Lecture de Commande.java': 'Reading Commande.java',
  'Il faut passer de PanacheEntity à PanacheEntityBase : je commence par l’entité Commande, puis je mettrai à jour les dépôts.':
    'We need to move from PanacheEntity to PanacheEntityBase: I’ll start with the Commande entity, then update the repositories.',
  'Je reprends là où je m’étais arrêté. ': 'Picking up where I stopped. ',
  'Les entités utilisent maintenant PanacheEntityBase.': 'The entities now use PanacheEntityBase.'
}

const MIN_PHRASE = 12
const PHRASES = Object.keys(EN)
  .filter((key) => key.length >= MIN_PHRASE)
  .sort((a, b) => b.length - a.length)

/** Le texte dans la langue de l'agent. */
export function say(text: string, language: MockLanguage): string {
  if (language === 'fr') return text
  const whole = EN[text]
  if (whole !== undefined) return whole
  let result = text
  for (const phrase of PHRASES) {
    if (result.includes(phrase)) result = result.replaceAll(phrase, EN[phrase] as string)
  }
  return result
}

/** Chaque texte d'une valeur (mise à jour, options…) dans la langue de l'agent ; le reste intact. */
export function sayAll<T>(value: T, language: MockLanguage): T {
  if (language === 'fr') return value
  if (typeof value === 'string') return say(value, language) as T
  if (Array.isArray(value)) return value.map((item: unknown) => sayAll(item, language)) as T
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sayAll(item, language)])
    ) as T
  }
  return value
}

/** Réglages de session décrits par l'étape `echo`. */
export function describeSettings(
  language: MockLanguage,
  settings: { mode: string; model: string; verbose: boolean }
): string {
  return language === 'en'
    ? `Mode: ${settings.mode} · Model: ${settings.model} · Detailed: ${settings.verbose ? 'yes' : 'no'}`
    : `Mode : ${settings.mode} · Modèle : ${settings.model} · Détaillé : ${settings.verbose ? 'oui' : 'non'}`
}
