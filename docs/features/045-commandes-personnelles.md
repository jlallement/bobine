# 045 — Commandes personnelles

- **Statut** : fait
- **Dépend de** : 017, 039

## Pourquoi

Les commandes « / » viennent de l'agent (fiche 017) ou de l'app (fiche 039). L'utilisateur veut
les siennes : des consignes qu'il tape souvent (« fais une revue de… », « écris les tests de… »),
disponibles partout ou propres à un projet, comme les commandes et skills de Claude Code.

## Critères d'acceptation

- [x] Réglages › Commandes : créer, modifier, supprimer une commande (nom, description, argument
      attendu, consigne) ; enregistrée dans `settings.json`, valable dans tous les dossiers.
- [x] Commandes du projet : un fichier Markdown par commande dans `.bob-desktop/commands/` du
      dossier de la conversation (`revue.md` → `/revue`), en-tête `description:` / `hint:`
      facultatif, le reste est la consigne ; listées dans les réglages (lecture seule, avec le
      chemin) et relues à chaque tour.
- [x] Dans le menu « / » : mêlées à celles de l'agent et de l'app, origine affichée (« Vous »,
      « Projet ») ; `$ARGUMENTS` remplacé par ce qui suit le nom, sinon l'argument est ajouté à la
      fin ; la consigne développée part à l'agent comme un message ordinaire.
- [x] Priorité : une commande de l'agent garde son nom ; une commande du projet l'emporte sur une
      commande personnelle ; les deux l'emportent sur une commande de l'app du même nom.
- [x] Testé contre l'agent factice (scénario `echo` : la consigne développée est bien reçue) ;
      unités pour l'analyse des fichiers, le développement et la priorité.

## Plan

- `shared/user-commands.ts` : `UserCommand`, `parseUserCommands`, `parseCommandFile`,
  `expandCommand`, `userCommandOf`, `toAgentCommands` ; `AgentCommand.source` étendu à `user` et
  `project` ; `mergeCommands` et `appCommandOf` tiennent compte des commandes personnelles.
- Main : `Settings.commands`, `ConversationManager.setCommands` / `settingsView().commands`,
  `main/user-commands.ts` (`projectCommands(workspace)`), IPC `settings:setCommands` et
  `commands:project`.
- Renderer : `useProjectCommands` (relues au changement de conversation et à chaque fin de tour),
  `Composer` (menu, envoi développé), `CommandMenu` (origine), Réglages › Commandes
  (`CommandsSettings`).
- e2e `user-commands` : commande créée dans les réglages, commande du projet, menu, envoi (écho).

## Journal

- 2026-10-13 — Fiche créée (choix de l'utilisateur parmi les fonctionnalités restantes), chantier
  lancé après la fiche 037.
- 2026-10-13 — **Implémenté comme prévu.** `shared/user-commands.ts` (testé : analyse de la liste
  et des fichiers, `$ARGUMENTS`, priorité), `AgentCommand.source` `user` / `project`,
  `mergeCommands` / `appCommandOf` étendus, `Settings.commands` + `setCommands` (main),
  `main/user-commands.ts` (`.bob-desktop/commands/*.md`, testé), IPC `settings:setCommands` et
  `commands:project`, `useProjectCommands` (relues à chaque début et fin de tour), `Composer`
  (consigne développée envoyée comme message ordinaire — le fil montre donc la consigne, pas
  `/nom`), `CommandMenu` (« Vous » / « Projet »), Réglages › Commandes (`CommandsSettings`,
  formulaire sur le modèle des serveurs MCP). Test de composant du `Composer` ; e2e
  `user-commands` (scénario `echo`) : commande créée dans les réglages, commande du projet,
  menu, deux envois développés ; captures `34-commandes-personnelles-reglages` et
  `35-commandes-personnelles-menu` regardées.
  **Écart** : le dossier des commandes du projet est `.bob-desktop/commands/` (et non `.bob/`),
  pour ne pas entrer en collision avec un éventuel dossier de Bob lui-même. Pas d'édition des
  fichiers du projet depuis l'app (lecture seule, c'est du git).
