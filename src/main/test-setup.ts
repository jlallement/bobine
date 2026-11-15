/**
 * Préparation des essais du projet « node » propre au main (fiche 229, lot 7a).
 */
// Sous Windows, les dépôts d'essai ne suivent pas la configuration système de git : l'installeur
// de Git for Windows (et MinGit) y met `core.autocrlf=true`, qui sortirait leurs fichiers en CRLF
// alors que les essais vérifient le cycle des worktrees, pas les fins de ligne (essayées à part,
// `git-platform.test.ts`). macOS et Linux : rien de changé (fiche 229, lot 7a).
if (process.platform === 'win32') process.env['GIT_CONFIG_NOSYSTEM'] = '1'

// Sous Windows, les processus lancés par les essais sont arrêtés comme dans l'app : par objets de
// tâche, avec tout leur arbre (`index.ts` configure les mêmes au démarrage). Sans cela, `stopTree`
// n'arrêtait que le processus lancé : le `node server.js` d'une commande passée par `cmd.exe`
// (`dev-servers.test.ts`) survivait à vitest et tenait son dossier temporaire (`EPERM` au ménage
// final, relevé sur `windows-latest`). Arrêt immédiat (grâce 0), comme avant dans les essais :
// l'arrêt poli de l'app (3 s) bloquait les effacements synchrones qui suivent. macOS et Linux :
// groupes de processus, inchangés.
// Import dynamique : ni ce code ni `koffi` ne sont chargés sous macOS et Linux.
if (process.platform === 'win32') {
  const { configureProcessTrees } = await import('./process-tree')
  const { createWindowsTrees } = await import('./process-safety-windows')
  configureProcessTrees(createWindowsTrees(process.env, undefined, 0))
}

export {}
