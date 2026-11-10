# 072 — Navigateur et autorisations comme Claude Code (audit du 15 octobre, lot 2)

- **Statut** : fait
- **Dépend de** : 007, 030, 031, 034, 042, 071
- **Agents** : les deux — rien ne dépend de l'agent (outils de l'app, navigateur intégré).

## Pourquoi

L'audit du 15 octobre (fiche 071) a relevé des verrous qui coûtent plus qu'ils ne protègent :
connexions par popup cassées dans le navigateur intégré, autorisations oubliées à chaque
conversation et à chaque redémarrage, aucun moyen d'effacer les données du navigateur.
L'utilisateur a demandé de ne faire que ce que fait Claude Code ; la comparaison (journal de la
fiche 071) donne :

- **Popups** : ouvertes quand l'utilisateur clique (connexion Google OAuth), bloquées quand c'est
  l'agent, qui est prié de demander à l'utilisateur.
- **Sites** : « Toujours autoriser » retenu par site sur l'appareil, révocable dans les Réglages.
- **Commandes** : « ne plus demander pour cette commande dans ce projet ».
- **Données du navigateur** : « Effacer les données », et un choix pour garder ou non les cookies
  (gardés par défaut, comme aujourd'hui : décision de l'utilisateur).

Inchangé, comme Claude Code : caméra, micro, position, notifications et presse-papiers refusés
aux sites ; téléchargements bloqués.

## Critères d'acceptation

- [x] Popup ouverte par un clic de l'utilisateur : vraie fenêtre, liée à la page qui l'ouvre
      (`window.opener`), même session ; fermée avec le navigateur de la conversation.
- [x] Popup déclenchée par une action de l'agent : bloquée ; le résultat de l'outil dit à l'agent
      de demander à l'utilisateur de cliquer lui-même. Les liens « nouvel onglet » restent des
      onglets, qui que ce soit.
- [x] Site extérieur : « Autoriser » (cette conversation), « Toujours autoriser » (retenu sur ce
      Mac), « Refuser ». Les sites retenus sont listés dans Réglages › Agents et révocables.
- [x] Commande du terminal, serveur de dev, compilation iOS ou Android : « Lancer » / « Compiler »
      (cette conversation), « Toujours dans ce projet » (retenu pour ce dossier), « Refuser ».
      Les commandes retenues sont listées par dossier dans Réglages › Agents et révocables.
- [x] Réglages › Général : « Effacer les données du navigateur » (cookies, stockage, cache) et
      « Garder les cookies du navigateur » (oui par défaut ; non : session en mémoire, effacée à la
      fermeture de l'app).
- [x] Testé contre l'agent factice : unitaires (approbations, outils, popups) ; e2e `browser`,
      `settings`, `launch`, `terminal`.

## Plan

1. **Autorisations retenues** — `src/main/approvals.ts` (+ test) : `ApprovalStore`, fichier
   `approvals.json` du dossier de données (sites ; commandes par dossier), écriture atomique,
   fichier abîmé ignoré. `ConversationManager` : `approvals` dans `settingsView` (une option, rien
   d'autre). IPC `settings:forgetSite`, `settings:forgetCommand` ; `SettingsDialog` : deux listes
   sous « Outils toujours autorisés » ; `settings-search.ts`.
2. **Questions d'autorisation** — `src/main/mcp/command-approval.ts` (+ test) : une seule question
   à trois choix pour les quatre outils qui lancent une commande (terminal, serveur de dev, iOS,
   Android), au lieu de quatre copies ; `browser-tools.ts` : « Toujours autoriser » pour les sites.
3. **Popups** — `browser-manager.ts` : actions de l'agent marquées par onglet (CDP) ; popup
   (`new-window`) de l'utilisateur ouverte en fenêtre enfant gardée (même session, liens
   http(s) seulement, pas de popup imbriquée), fermée avec la conversation ; popup de l'agent
   bloquée et notée ; `browser-tools.ts` ajoute la note au résultat de l'outil. `index.ts` : les
   évènements de l'app ne partent qu'aux fenêtres de l'app, pas aux popups.
4. **Données du navigateur** — préférence `browserKeepCookies` (`shared/preferences.ts`) ;
   `BrowserManager.clearData()` ; partition en mémoire si les cookies ne sont pas gardés (pris en
   compte au prochain lancement) ; IPC `browser:clearData` ; `SettingsDialog` (Général).
5. Doc : `docs/architecture.md`, `docs/README.md` (navigateur), fiche, index. `./scripts/verify`
   entre chaque étape ; e2e des suites touchées (clair et sombre), captures regardées.

Aucune nouvelle dépendance.

## Journal

- 2026-10-15 — Fiche créée à partir de la comparaison avec Claude Code (fiche 071).
- 2026-10-15 — **Fait.**
  - **Autorisations retenues** : `ApprovalStore` (`approvals.json` à part des réglages) ; le
    gestionnaire de conversations ne fait que l'ajouter à `settingsView` ; IPC
    `settings:forgetSite` / `settings:forgetCommand` ; deux listes dans Réglages › Agents (vides :
    une phrase dit comment les remplir), recherche des réglages. Les Réglages ouverts suivent un
    « toujours » choisi pendant une conversation (`settings:changed`).
  - **Sites** : « Autoriser » (cette conversation), « Toujours autoriser » (sur ce Mac),
    « Refuser ».
  - **Commandes** : `approveCommand` (`main/mcp/command-approval.ts`) remplace les quatre copies de
    la question (terminal, serveur de dev, iOS, Android) : « Lancer » ou « Compiler », « Toujours
    dans ce projet », « Refuser ». « Projet » = dossier de la conversation (un worktree compte à
    part ; Android : le dossier du projet Gradle). Comme Claude Code, pas de contrôle du contenu du
    script derrière la commande.
  - **Popups** : chaque action de l'agent (clic, touche, saisie, défilement, JavaScript,
    navigation) marque l'onglet pour 1,5 s ; une popup (`new-window`) dans ce délai est bloquée et
    notée, et le résultat de l'outil le dit à l'agent avec la consigne de Claude Code. Sinon, une
    popup qui suit un geste de l'utilisateur de moins d'1 s (`input-event`) s'ouvre en fenêtre
    enfant : même session, bac à sable, `window.opener` gardé, liens http(s) seulement, pas de popup
    imbriquée, fermée avec la conversation. Sans geste : bloquée, comme dans Chrome. Les liens
    « nouvel onglet » restent des onglets. Les évènements de l'app ne partent plus qu'à ses propres
    fenêtres (`appWindows`), jamais aux popups des sites.
  - **Données du navigateur** : `browserKeepCookies` (oui par défaut). Non : session en mémoire
    (`bob-browser-memoire`) au lancement suivant, et ce qui est sur le disque effacé aussitôt.
    « Effacer » (Réglages › Général) : cookies, stockage, cache et authentifications, des deux
    sessions.
  - **Agent factice** : le résultat d'un outil MCP qu'il rend à son scénario contient maintenant
    tout le texte (avant : le premier bloc seulement), comme pour un vrai agent ; scénario `popup`.
  - **Écarts** : pas d'avis dans l'onglet Navigateur quand une popup de l'agent est bloquée (Claude
    Code en montre un) : l'agent est prié de le dire. Téléchargements et permissions des sites
    inchangés (comme Claude Code). L'interrupteur des cookies prend effet au lancement suivant pour
    la session en mémoire.
  - **Écueils** : `clearData` absent de l'objet passé à l'IPC (vu par l'e2e) ; essai e2e qui
    attendait la fermeture d'une popup en y exécutant du JavaScript (ne répond jamais pendant la
    fermeture) ; clic « utilisateur » de l'essai trop proche du clic de l'agent (attribué à
    l'agent, à raison).
  - **Essais** : `verify` (115 fichiers, 687 tests ; nouveaux : magasin, question commune, sites,
    popups côté outils, IPC) ; e2e complètes (723 vérifications, 425 s), puis `browser`,
    `settings`, `terminal` après les derniers ajouts : popup de l'agent bloquée et signalée, popup
    de l'utilisateur ouverte avec `window.opener`, « Toujours dans ce projet » listé puis révoqué
    dans les Réglages, « Effacer » et cookies plus gardés. Captures regardées : `81-reglages`,
    `32-commandes-autorisees` (clair et sombre).
  - **Non fait** : popups dans l'app packagée et avec un vrai site de connexion ; essai réel avec
    Bob et OpenCode.

- 2026-10-16 — **Essais réels** depuis le vrai `.dmg` (dossier de données jetable), avec IBM Bob
  et OpenCode, trois consignes chacun : question de l'app (`ask_user`) puis page web
  (`browser_navigate`), commande dans le terminal de l'app (`terminal_run`), popup déclenchée par
  l'agent. Les deux : tout en un tour, aucune demande d'autorisation pour les outils de Bobine,
  rien au journal. Titres réels relevés : Bob « Running Terminal Run (bobine) », « Running Browser
  Navigate (bobine) »… ; OpenCode `bobine_ask_user`, `bobine_terminal_run`… — tous reconnus et
  étiquetés. Coût Bob : environ 0,3 bobcoin par passage (deux passages). « Toujours dans ce projet » retenu
  dans `approvals.json` ; popup de l'agent bloquée, et chaque agent l'a expliqué à l'utilisateur.
