/**
 * Options de Chromium posées par l'app, avant `ready` (fiche 250, 2026-11-24).
 *
 * `allow-pre-commit-input` : Chromium jette sans le dire (acquitté « non consommé », le CDP répond
 * comme si de rien n'était) tout clic, touche ou molette qu'une page reçoit tant que son rendu est
 * suspendu, juste après une navigation et jusqu'à sa première peinture (`paint holding`,
 * `WidgetInputHandlerManager::DispatchEvent` : « We don't want users interacting with stuff they
 * can't see ») ; une vue cachée jamais peinte le reste. L'agent, lui, agit d'après l'arbre de la page, pas d'après ce qui
 * est peint : son clic juste après `browser_navigate`, ou dans un onglet que le panneau ne montre
 * pas, était perdu (saisie « Bonjour, ! », téléchargement jamais lancé, runner macOS de GitHub).
 * Relevé en local sur Electron 45.4.1 : clic par le CDP aussitôt la page chargée, perdu 3 fois sur
 * 3, onglet caché toujours perdu ; avec l'option, reçu chaque fois. Aucun changement visible ; la
 * seule différence pour l'utilisateur : un clic dans les quelques centaines de millisecondes avant
 * la première peinture d'une page n'est plus jeté.
 */
export const CHROMIUM_SWITCHES: readonly string[] = ['allow-pre-commit-input']

export function applyChromiumSwitches(commandLine: { appendSwitch(name: string): void }): void {
  for (const name of CHROMIUM_SWITCHES) commandLine.appendSwitch(name)
}
