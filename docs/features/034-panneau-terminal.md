# 034 — Panneau terminal partagé avec l'agent

- **Statut** : fait
- **Dépend de** : 029

## Pourquoi

Dans Claude Code Desktop, l'utilisateur a des onglets de terminal à côté de la conversation ; l'agent
peut lire ce qui s'y affiche (« l'erreur que je viens d'avoir ») et y lancer une commande longue que
l'utilisateur garde sous les yeux.

## Critères d'acceptation

- [x] Onglets de terminal (pty) dans le panneau latéral, dans le dossier de la conversation : shell de
      connexion de l'utilisateur, couleurs, invite, saisie, plusieurs onglets, fermeture.
- [x] Outils : `terminal_read` (écran tel que l'utilisateur le voit, attente de nouvelle sortie),
      `terminal_run` (commande montrée à l'utilisateur avant de partir), `terminal_list`,
      `terminal_stop` (Ctrl+C).
- [x] Sélection → « Ajouter au message » (extrait cité dans la zone de saisie, avec l'onglet).
- [x] Ouverture comme dans Claude Desktop : bouton `>_` en haut à droite et raccourci ⌃` (ouvre le
      terminal à droite avec le clavier, ou le referme).
- [x] Testé : vrai shell (gestionnaire) ; outils (faux pseudo-terminal) ; e2e ; Bob réel.

## Notes

Nouvelle dépendance probable : `node-pty` + `xterm.js` (à justifier dans le plan).

## Plan

Modèle : le terminal de Claude Desktop — des onglets de shell à côté de la conversation, dans son
dossier ; l'agent lit ce qui est à l'écran, y lance une commande sous les yeux de l'utilisateur,
liste les onglets et arrête une commande ; l'utilisateur peut joindre un extrait au message.

- Dépendances (ADR-0007) : `node-pty`, `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/headless`,
  `@xterm/addon-serialize`.
- `main/terminal/terminal-manager.ts` : onglets par conversation (shell de connexion de
  l'utilisateur, dossier de la conversation, PATH complet) ; chaque onglet a son double
  `@xterm/headless` (écran pour l'agent, image pour réafficher) ; titre = programme au premier plan ;
  « occupé » quand ce n'est pas le shell ; fermés avec la conversation et l'app. Pseudo-terminal
  injecté (faux en test).
- Outils `terminal_list`, `terminal_read` (lignes de l'écran, attente de nouvelle sortie),
  `terminal_run` (commande montrée à l'utilisateur avant de partir, dans un onglet libre ou neuf),
  `terminal_stop` (Ctrl+C). Onglet « Terminal » du panneau.
- Renderer : onglet « Terminal » (bandeau d'onglets, +, fermer ; xterm.js ajusté à la taille, thème
  clair / sombre de l'app) ; sélection → « Ajouter au message » (extrait cité dans la zone de saisie).
- IPC `terminal:*` ; événements de sortie et de liste.

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-12 — Implémenté comme prévu (ADR-0007) : `main/terminal/` (`terminal-manager.ts`,
  `node-pty.ts`, `terminal-tools.ts`), `TerminalTab` (xterm.js), IPC `terminal:*`, scénario
  `terminal`. Tests : vrai `/bin/sh` (couleurs appliquées, programme au premier plan, Ctrl+C, image,
  réutilisation d'un onglet libre), outils ; e2e `terminalPanelSuite` (capture `31-terminal`).
  - `node-pty` 1.1.0 : binaires N-API précompilés, marchent tels quels dans Node et Electron 44 ;
    `spawn-helper` livré sans droit d'exécution (script d'installation non exécuté) : l'app le rend
    exécutable.
  - `/bin/sh` est bash sur macOS : tout shell connu compte comme « libre ». Pendant la première
    seconde, le nom du programme au premier plan est transitoire : onglet considéré libre.
  - L'onglet ouvert par l'agent **ne prend pas le focus** (sinon la réponse à une question partait
    dans le shell) ; il le prend quand l'utilisateur choisit un onglet.
  - `terminal_read` attend une nouvelle sortie puis 400 ms de calme (le zsh de l'utilisateur, avec
    oh-my-zsh, met du temps à démarrer : la commande passait après la lecture).
  - Polices : les « Nerd Fonts » courantes d'abord (invite powerlevel10k de l'utilisateur : icônes
    affichées avec « MesloLGLDZ Nerd Font Mono »), puis la police mono de l'app.
  - **Bob réel** : « Utilise le terminal à côté de notre conversation : lance « ls »… » →
    `terminal_run` (carte « ls /Users/me/bob-essai ») puis `terminal_read` ; liste exacte des
    fichiers. Coût : 0,113 bobcoin.
- 2026-10-12 — L'utilisateur ne trouvait pas comment ouvrir un terminal (seulement par le bouton du
  panneau, puis l'onglet « Terminal »). Ajout du bouton `>_` dans l'en-tête, comme Claude Desktop, et
  du raccourci ⌃` (capturé avant xterm.js, donc actif même quand le terminal a le clavier). Ouvert
  ainsi, le terminal prend le clavier ; ouvert par l'agent, toujours pas. Étapes ajoutées à la suite
  e2e `terminalPanelSuite`.
- 2026-10-14 — Bouton `>_` retiré de l'en-tête (fiche 049, demande de l'utilisateur : doublon) ;
  le terminal s'ouvre par ⌃`, le menu Affichage et l'onglet « Terminal » du panneau.
- 2026-10-23 (écart, fiche 126) : `terminal_run` sans `tab_id` ne prend plus un onglet libre de
  l'utilisateur ; il réutilise un onglet qu'il a ouvert, ou en ouvre un, avec `PAGER=cat` et
  `GIT_PAGER=cat` (plus de `git log` bloqué sur « (END) »).

- 2026-10-26 — Validation de livraison (fiche 151) : le scénario factice `terminal` relit
  avec `pollTool` jusqu’à la sortie de `echo`, plutôt que de confondre le premier prompt du
  shell et le résultat de la commande. Même attente de lecture, même assertion e2e sur la
  sortie reçue par l’agent ; arrêt sur erreur ou échéance existante. Terminal réel inchangé.
- 2026-10-27 — Préparation 0.6.0 (fiche 152) : l’essai de vrai shell relit jusqu’à la ligne de
  résultat dans le budget initial de deux secondes, au lieu de conclure sur le seul écho de la
  commande. Toutes les assertions restent présentes ; aucun changement du terminal de l’app.
