/**
 * Préparation des essais du projet « node » propre au main (fiche 229, lot 7a).
 */
// Sous Windows, les dépôts d'essai ne suivent pas la configuration système de git : l'installeur
// de Git for Windows (et MinGit) y met `core.autocrlf=true`, qui sortirait leurs fichiers en CRLF
// alors que les essais vérifient le cycle des worktrees, pas les fins de ligne (essayées à part,
// `git-platform.test.ts`). macOS et Linux : rien de changé (fiche 229, lot 7a).
if (process.platform === 'win32') process.env['GIT_CONFIG_NOSYSTEM'] = '1'
