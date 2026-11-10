# 027 — Réglages et raccourcis clavier

- **Statut** : fait
- **Dépend de** : 004

## Pourquoi

Une vraie fenêtre de réglages et les raccourcis habituels de Claude Desktop / Claude Code.

## Critères d'acceptation

- [x] Fenêtre de réglages : agents, dossiers récents, apparence, notifications, terminal (les clés
      d'API relèvent de la fiche 022).
- [x] Raccourcis : Cmd+N (nouvelle conversation), Cmd+K (recherche), Cmd+, (réglages), Échap (arrêter), Maj+Tab (mode).
- [x] Thème clair / sombre / système.
- [x] Menu macOS de l'app ; raccourcis actifs même dans le terminal et le navigateur intégré.

## Notes

Maj+Tab est livré avec la fiche 016, Échap (arrêter) avec la fiche 020.

## Plan

- **Menu macOS de l'app** (`main/menu.ts`) au lieu du menu par défaut d'Electron : Bob Desktop
  (À propos, Réglages… ⌘,), Fichier, Édition (rôles standard : copier, coller…), Affichage,
  Conversation, Fenêtre, Aide. Les raccourcis sont ceux du menu : ils marchent même quand le
  clavier est dans le terminal ou dans une page du navigateur intégré (qui ne transmettent pas les
  touches à l'interface). Chaque entrée envoie une commande au renderer (`app:command`).
- **Raccourcis** (source unique `shared/shortcuts.ts`, montrée aussi dans les réglages) :
  ⌘N nouvelle conversation, ⌘K rechercher une conversation, ⌘, réglages, ⌘/ raccourcis, ⌘L zone de
  saisie, ⌘. arrêter la réponse, ⌘B barre latérale, ⌘J panneau de droite, ⌃` terminal,
  ⌘⇧D modifications, ⌥⌘↑ / ⌥⌘↓ conversation précédente / suivante. Déjà là : Maj+Tab (mode),
  Échap (arrêter), Entrée / Maj+Entrée.
- **⌘K** : recherche rapide parmi les conversations (titre et dossier), ↑↓ Entrée. La recherche
  dans le contenu reste pour la fiche 026.
- **Réglages** (`SettingsDialog`, Radix Dialog — nouvelle dépendance de la famille Radix,
  ADR-0005) : Général (thème système / clair / sombre, notifications), Terminal (police, taille),
  Agents (disponibilité de chaque agent, dossiers récents à oublier), Raccourcis, À propos. Ouverts
  par ⌘, ou la roue dentée au pied de la barre latérale.
- **Thème** : `nativeTheme.themeSource` dans le main ; le CSS (`prefers-color-scheme`), xterm.js et
  les pages du navigateur intégré suivent sans code de plus.
- Réglages persistés dans `settings.json` (`theme`, `terminalFontFamily`, `terminalFontSize`),
  IPC `settings:setPreferences`, `settings:forgetWorkspace`.
- Clés d'API : fiche 022 (pas ici).

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-12 — Fait comme prévu. `shared/shortcuts.ts` (source unique), `main/menu.ts`
  (`buildMenuTemplate`, testé : chaque raccourci présent une fois, envoie sa commande, outils de
  développement seulement en dev), `shared/preferences.ts`, `SettingsDialog`, `SearchDialog`
  (`shared/conversation-search.ts`, sans casse ni accents), police et taille appliquées aux
  terminaux ouverts. Nouvelle dépendance : `@radix-ui/react-dialog` 1.1.23 (famille Radix,
  ADR-0005). Suite e2e `settingsSuite` : le main est lancé avec `--inspect` et l'essai clique les
  vraies entrées du menu (`Menu.getApplicationMenu().getMenuItemById(…).click()`).
- Écart : le raccourci du terminal ⌃` reste aussi géré par l'interface (fiche 034), en plus du
  menu ; le premier qui le voit l'utilise, sans double bascule.
- Limites : raccourcis fixes (pas de personnalisation) ; ⌘K cherche dans les titres, dossiers et
  agents, pas encore dans le contenu (fiche 026).
- 2026-10-12 — Section « Conversation » (demande de l'utilisateur : texte du fil trop gros) : police
  des réponses (à empattements comme Claude, ou celle du système) et taille du texte (12 à 22 px,
  16 par défaut ; les messages de l'utilisateur 1 px plus petits). Variables CSS `--conv-font` et
  `--conv-size`, posées par l'app ; seul le fil change. Aperçu dans les réglages, essai e2e.
- 2026-10-13 — Rubrique plus longue que la fenêtre : le titre reste en haut pendant le défilement
  et la croix de fermeture reste au coin (elle défilait avec le contenu). Vérifié dans `pnpm e2e mcp`.
- 2026-10-13 — Petites touches choisies par l'utilisateur :
  - **Copier** : bouton sur chaque bloc de code (texte affiché) et sous chaque réponse (Markdown
    complet), au survol.
  - **Heure des messages** au survol (envoi ; fin de la réponse), date complète en infobulle :
    `at` sur `user-message` et `turn-end`, gardé dans le fil (absent d'un fil rejoué par l'agent).
  - **Confirmation avant de quitter** si un agent répond (« Annuler » par défaut) ; pas pour un
    arrêt du Mac ni un signal (`main/quit-guard.ts`).
  - **Couleur d'accent** (orange, bleu, vert, violet ; clair et sombre) et **largeur du fil**
    (étroite, normale, large).
  - **Empêcher la mise en veille** tant qu'un agent travaille (activé par défaut ;
    `powerSaveBlocker` « prevent-app-suspension », `main/keep-awake.ts`).
  - **Nouvelle conversation** : agent, dossier et mode (« Exécution » / « Plan », traduits dans les
    modes de chaque agent) par défaut ; « comme la conversation en cours » sinon. Changer d'agent
    sur une conversation commencée garde son dossier.
  - **Archiver** : menu de la conversation ; section « Archivées » repliable en bas de la barre
    latérale ; l'agent est arrêté ; écrire dans une conversation archivée la ressort.
  - e2e `pnpm e2e touches` (presse-papiers du Mac remis en place après l'essai).
- 2026-10-13 — Options d'ambiance choisies par l'utilisateur :
  - **Accueil** : salutation selon l'heure (Bonjour, Bon après-midi, Bonsoir) avec le prénom
    (Réglages › Général) ; **suggestions de départ** (Explique ce projet, Trouve des bugs, Écris
    des tests, Prépare un plan) qui remplissent la zone de saisie sans envoyer (`ComposerInbox`).
  - **Thèmes Sépia** (sur le clair) et **Nuit noire** (sur le sombre) : `data-palette`, et
    `colorSchemeOf` pour macOS / Chromium. **Police du code** (SF Mono, Menlo, JetBrains Mono, Fira
    Code, Cascadia Code, si installées).
  - **Bobcoins dépensés** : d'abord en bas de la barre latérale, puis déplacés (2026-10-13, retour
    de l'utilisateur : mal placés, et sans intérêt hors Bob) dans le détail de la consommation des
    conversations Bob — voir la fiche 019.
  - **Sommaire de la conversation** (comme Claude Desktop) : un trait par message en haut à
    gauche du fil, celui qu'on lit mis en avant, liste au survol, clic → message ; seulement s'il y
    a la place à gauche du fil et au moins deux messages (`ConversationOutline`).
  - e2e `pnpm e2e fun` (base de Bob d'essai dans le dossier personnel jetable).
- 2026-10-15 — Retour de l'utilisateur : fenêtre trop petite, et barre de défilement qui partait
  du haut (le titre de la rubrique était « collé » dans la zone qui défile). En-tête fixe (titre
  de la rubrique ou « Recherche », croix) rendu par la fenêtre, titres retirés des sections ; seul
  le contenu dessous défile. Fenêtre agrandie : 940 × 720 au plus, dans la fenêtre de l'app. e2e
  `mcp` : la zone qui défile commence sous l'en-tête.
