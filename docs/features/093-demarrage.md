# 093 — Démarrage : dossier choisi d'abord, fenêtre retrouvée

- **Statut** : fait
- **Dépend de** : 004 (profils, dossier mémorisé), 027 (menu macOS), 074 (langues), 089 (réglages
  hors du gestionnaire)
- **Agents** : les deux — rien de propre à un agent : on retarde seulement le démarrage de l'agent,
  quel qu'il soit, jusqu'au choix du dossier.

## Pourquoi

Essai libre du 2026-10-20 (OpenCode + GPT-6.1 Sol, rapport dans `docs/recettes/`, hors git) :

- Au premier lancement, l'app démarre Bob dans `<données>/workspace`, un dossier que l'utilisateur
  n'a pas choisi : il tombe aussitôt sur « Dossier non approuvé », et ce dossier reste ensuite dans
  les dossiers récents.
- Sur la carte « Dossier non approuvé », l'action principale (« Faire confiance à ce dossier »)
  ressemble à un libellé.
- La fenêtre rouvre toujours à la taille par défaut, au centre, sans retrouver le plein écran.
- Le menu Fenêtre mélange l'anglais d'Electron (« Minimize », « Zoom », « Bring All to Front ») et
  le français de macOS.

## Critères d'acceptation

- [x] Tant qu'aucun dossier n'a été choisi (premier lancement, ou dossier mémorisé disparu), aucun
      agent ne démarre : l'accueil montre la carte « Choisissez le dossier de votre projet » (« L'agent
      y lira et modifiera des fichiers. Vous pourrez en changer à chaque conversation. ») et son
      bouton principal « Choisir un dossier… », qui ouvre le dialogue natif.
- [x] Pendant ce temps, la zone de saisie est inactive (« Choisissez d'abord un dossier »), la puce
      du dossier dit « Choisir un dossier », l'agent peut encore être changé (toujours sans démarrer).
- [x] Dossier choisi : l'agent démarre dedans, le dossier entre dans les récents.
      `<données>/workspace` n'y entre plus jamais.
- [x] Rien ne lit le dossier courant du processus à la place d'un dossier absent (git, commandes
      du projet, règles, serveurs MCP du projet, serveurs de dev, terminal).
- [x] Carte « Dossier non approuvé » : « Faire confiance à ce dossier » (ou « … pour cette session »)
      est le bouton principal, à droite ; « Ouvrir un terminal ici » et « Réessayer » sont
      secondaires, à sa gauche.
- [x] La fenêtre principale rouvre à sa position et à sa taille, agrandie (« Réduire/agrandir ») ou
      en plein écran si elle l'était ; une fenêtre restée sur un écran débranché revient au centre
      de l'écran principal, à une taille qui y tient.
- [x] Menu Fenêtre : « Minimiser », « Réduire/agrandir », « Tout ramener au premier plan » (libellés
      de macOS), en anglais avec l'interface en anglais ; les entrées ajoutées par macOS restent.
- [x] Essais (dossier de données imposé) : sans dossier choisi, l'agent factice démarre toujours
      dans `<données>/workspace`, comme avant ; `BOBINE_DEFAULT_WORKSPACE` vide rend le premier
      lancement réel.
- [x] Testé contre l'agent factice : suite e2e `startup` (premier lancement sans dossier, choix
      par le dialogue simulé, fenêtre retrouvée et ramenée sur l'écran, menu Fenêtre) ; suite `bob`
      pour la carte « Dossier non approuvé ».

## Plan

### 1. Premier lancement sans dossier

Aucun dossier choisi = `workspace` vide (`''`) dans la conversation : une valeur qui ne vit que dans
un brouillon (une conversation sans dossier ne peut pas recevoir de message, donc n'entre jamais
dans l'historique).

- `src/shared/agent.ts` : nouveau blocage `{ kind: 'workspace' }` dans `AgentBlocker`.
- `src/main/conversations/agentless.ts` (nouveau, pur) : `NO_FOLDER`, `hasFolder()`, instantané
  « dossier à choisir » (`needs-action` + blocage `workspace`, sans réglages ni commandes) ; celui
  d'un agent retiré y passe aussi (sorti de `manager.ts`, pour rester sous son plafond de taille).
- `src/main/conversations/manager.ts` :
  - `defaultWorkspace` devient optionnel (essais seulement) ; nouveau `neutralFolder` : dossier où
    lancer un agent hors conversation (diagnostic, sessions à reprendre) quand la conversation
    active n'a pas de dossier.
  - Au lancement : dossier imposé, réglage « Nouvelle conversation », dernier dossier, sinon
    `defaultWorkspace`, sinon aucun. Dossier disparu : aucun (avis gardé), plus de repli silencieux.
  - Un brouillon sans dossier n'a pas d'hôte : son instantané est celui de `no-folder.ts` ;
    `ensureLive` refuse (message « choisissez d'abord un dossier »), `select`, `open`, `create`,
    `startActive` et les brouillons qui suivent une suppression ou un archivage ne démarrent rien.
  - `create()` sans dossier (changer d'agent avant de choisir) : nouveau brouillon sans dossier,
    rien dans les récents.
  - `workspaceOf()` refuse une conversation sans dossier ; `readFolder()` rend « rien » aux
    lectures en tâche de fond ; `settingsView().inGitRepo` et `rules()` ne lisent rien sans dossier.
- `src/main/ipc.ts` : `git:status`, `commands:project`, `preview:list` passent par `readFolder()`
  (lus en tâche de fond : pas d'erreur au journal à chaque retour dans l'app) ; le reste passe par
  `workspaceOf()` et refuse.
- `src/main/agent-config/mcp-files.ts` : sans dossier, pas de fichier « projet » (ni lu, ni écrit).
- `src/main/index.ts` : `<données>/workspace` n'est plus que le dossier neutre ; `defaultWorkspace`
  = `BOBINE_DEFAULT_WORKSPACE`, sinon `<données>/workspace` pour un dossier de données imposé
  (essais), sinon aucun. `BOBINE_DEFAULT_WORKSPACE` vide : aucun (premier lancement réel en essai).
  `index.ts` est au bord de son plafond (850 lignes) : les dialogues natifs (joindre, dossier,
  export) passent tels quels dans `src/main/dialogs.ts`.
- Interface : `BlockerPanel.tsx` (carte `WorkspacePanel`, prop `onChooseWorkspace`) ; hors de mon
  périmètre mais inévitable, le plus petit changement possible : `Composer.tsx` (passer
  `onChooseWorkspace` au panneau, invite « Choisissez d'abord un dossier ») et
  `common/Menus.tsx` (puce « Choisir un dossier », pas de ligne vide dans la liste).
- i18n : `blocker.workspace.*`, `composer.placeholder.needsFolder`, `workspaceMenu.none`,
  `conversations.error.noFolder`.

### 2. Carte « Dossier non approuvé »

- `BlockerPanel.tsx` : pied de carte « Ouvrir un terminal ici », « Réessayer » (secondaires), puis
  la confiance en bouton principal à droite. Sans flag de confiance dans le profil : « Réessayer »
  reste le principal.

### 3. Fenêtre retrouvée

- `src/main/window-state.ts` (nouveau) : lecture du réglage (`parseWindowState`), position rendue
  visible (`visibleBounds` : pure, testée — la barre du haut doit être sur un écran, sinon centrée
  sur l'écran principal ; taille ramenée à l'écran), suivi de la fenêtre (`trackWindowState` :
  déplacement et taille enregistrés après 500 ms de calme, agrandie et plein écran au changement,
  tout à la fermeture ; taille « normale » par `getNormalBounds`).
- `src/main/settings.ts`, `settings-store.ts` : réglage `window` (position, taille, `maximized`,
  `fullScreen`), écrit sans prévenir les abonnés (rien d'autre n'en dépend).
- `src/main/index.ts` : `createMainWindow` part du réglage, réagrandit ou remet en plein écran
  à l'affichage.
- Hors champ : le zoom de la page (⌘+), qui n'est pas la fenêtre.

### 4. Menu Fenêtre

- `src/main/menu.ts` : sous-menu explicite du rôle `windowMenu` (rôles `minimize`, `zoom`, `front`
  avec `t()`), macOS y ajoute toujours ses entrées et la liste des fenêtres.
- i18n : `menu.minimize`, `menu.zoom`, `menu.front` (libellés de macOS : `MenuCommands.loctable`
  d'AppKit).

### Essais

- Unitaires : `manager.test.ts` (sans dossier : rien ne démarre, choix, changement d'agent, dossier
  disparu, essais), `window-state.test.ts`, `settings.test.ts`, `menu.test.ts`,
  `BlockerPanel.test.tsx`, `mcp-files.test.ts`.
- e2e : nouvelle suite `startup` (`e2e/suites/startup.mjs`) ; `bob` pour la carte de confiance.

Aucune nouvelle dépendance. Pas d'ADR : le choix du dossier passe par le mécanisme des blocages
existant, sans nouvelle approche.

## Journal

### 2026-10-20 — fait

Session 2 des corrections de l'essai libre (sessions parallèles 092 à 096, choix d'interface
tranchés par la session principale sur maquettes `m092-final-*`).

**Fait**

- Premier lancement sans dossier : brouillon à dossier vide, sans hôte d'agent, blocage
  `workspace` ; carte `WorkspacePanel` (titre, sous-titre, « Choisir un dossier… » qui ouvre le
  dialogue natif existant) ; zone de saisie inactive « Choisissez d'abord un dossier » ; puce
  « Choisir un dossier ». Changer d'agent avant de choisir ne démarre toujours rien. Le dossier
  choisi entre seul dans les récents ; `<données>/workspace` jamais.
- Rien ne lit le dossier courant du processus à la place d'un dossier absent : `workspaceOf()`
  refuse, `readFolder()` rend « rien » (git, commandes du projet, serveurs de dev), pas de fichier
  MCP « projet », pas de règles du projet, `inGitRepo` faux ; le diagnostic dit « Aucun dossier
  choisi » au lieu de « introuvable ».
- Dossier mémorisé disparu : l'avis reste (texte raccourci : « Le dossier « … » n'existe plus. »,
  il ne promet plus de « retour au dossier par défaut »), puis la carte de choix.
- Carte « Dossier non approuvé » : terminal et Réessayer en secondaires, la confiance en bouton
  principal à droite ; sans flag de confiance dans le profil, Réessayer reste le principal.
- Fenêtre retrouvée : réglage `window` (taille normale, agrandie, plein écran), enregistré après
  500 ms de calme et à la fermeture ; barre du haut hors de tout écran → centrée sur l'écran
  principal, taille ramenée à l'écran.
- Menu Fenêtre : sous-menu explicite du rôle `windowMenu` (« Minimiser », « Réduire/agrandir »,
  « Tout ramener au premier plan », libellés d'AppKit) ; un test vérifie qu'aucune entrée à rôle
  n'est sans libellé traduit.
- Essais : `<données>/workspace` reste le dossier par défaut d'une app au dossier de données imposé
  (toutes les suites existantes inchangées) ; `BOBINE_DEFAULT_WORKSPACE` (vide : aucun) pour un
  premier lancement réel, documenté dans `docs/README.md`.

**Écarts au plan et à la maquette**

- Icône de la carte de choix : dossier ouvert (`FolderOpen`) au lieu du cadenas de la maquette ;
  le cadenas dit « refusé », ici il reste seulement à choisir.
- Pas de focus automatique sur « Choisir un dossier… » : il dessinait un anneau absent de la
  maquette.
- `no-folder.ts` est devenu `agentless.ts` : l'instantané d'un agent retiré y est aussi sorti de
  `manager.ts`, pour tenir sous son plafond (1050). `index.ts` (plafond 850) : dialogues natifs
  déplacés tels quels dans `dialogs.ts`. `ipc.ts` est à 799 lignes sur 800.
- Le statut de la conversation sans dossier dans la liste reste « arrêté » (aucun hôte) ; le pied
  de la barre latérale, qui lit l'instantané, dit « Action requise » comme sur la maquette.
- Hors de mon périmètre, au plus petit : `Composer.tsx` (passer `onChooseWorkspace` au panneau,
  invite du blocage `workspace`), `common/Menus.tsx` (puce et infobulle « Choisir un dossier »,
  pas de ligne vide dans la liste). Note laissée à la session 092.

**Essais**

- `./scripts/verify` : lint, types et 1028 tests verts ; seule l'étape « Documentation » échoue, sur la
  ligne d'index de cette fiche, que la consigne de cette session interdit d'ajouter ici.
- `pnpm build && pnpm e2e` : toutes les suites vertes (532 s), clair et sombre ; puis `startup`,
  `diagnostic`, `bob` après le dernier correctif, et `startup --lang en`. Captures regardées :
  `44-premier-lancement`, `45-dossier-choisi`, `7-dossier` (clair, sombre, anglais), conformes aux
  maquettes `m092-final-*` (aux écarts ci-dessus près).
- Essai à la vraie souris (menu Fenêtre natif de macOS, vrai dialogue de dossier, plein écran
  retrouvé à la relance) : **pas fait**, l'accès à l'app de développement a été refusé. Le menu
  Fenêtre et la fenêtre retrouvée sont vérifiés par l'e2e (modèle du menu d'Electron, position et
  taille, agrandie, écran disparu), pas le plein écran ni le rendu natif du menu.

**Reste à faire / à signaler**

- La fenêtre rapide (`QuickEntry.tsx`, session 092) affiche un dossier vide tant qu'aucun n'est
  choisi ; un message envoyé de là attend dans la zone de saisie, sous la carte.
- Ligne de l'index `docs/features/README.md` et du CHANGELOG : à ajouter à la fusion (consigne de
  la session principale) ; `./scripts/verify` échoue seulement sur cette ligne d'index manquante.

**Lignes de CHANGELOG proposées**

- fr : « Au premier lancement, Bobine demande d'abord le dossier du projet : aucun agent ne démarre
  avant ce choix, et le dossier « workspace » de l'app n'apparaît plus dans les dossiers
  récents. »
- fr : « « Faire confiance à ce dossier » devient le bouton principal de la carte « Dossier non
  approuvé ». »
- fr : « La fenêtre rouvre à sa place et à sa taille, agrandie ou en plein écran si elle l'était ;
  restée sur un écran débranché, elle revient sur l'écran principal. »
- fr : « Menu Fenêtre en français : Minimiser, Réduire/agrandir, Tout ramener au premier plan. »
- en : “On first launch, Bobine asks for your project folder first: no agent starts before you
  choose it, and the app’s own “workspace” folder no longer shows up in recent folders.”
- en : “Trust this folder” is now the main button of the “Folder not trusted” card.
- en : “The window reopens where you left it, at the same size, maximized or full screen if it
  was; if its display was unplugged, it comes back on the main display.”
- en : “The Window menu follows the app language (Minimize, Zoom, Bring All to Front).”
- 2026-10-20 — **Essai réel à la souris**, après la fusion dans `main`, sur l'app construite (dossier
  de données neuf, `BOBINE_DEFAULT_WORKSPACE` vide pour un vrai premier lancement) :
  - Carte « Choisissez le dossier de votre projet », saisie « Choisissez d'abord un dossier », aucun
    agent lancé (journal) ; « Choisir un dossier… » ouvre le vrai dialogue ; les dossiers récents
    ne montrent que le dossier choisi.
  - Avec Bob sur un dossier qu'il ne connaît pas : « Faire confiance à ce dossier » est le bouton
    principal, à droite, après « Ouvrir un terminal ici » et « Réessayer » (pas cliqué, pour ne pas
    toucher à la configuration de Bob de l'utilisateur).
  - Menu Fenêtre natif : « Minimiser », « Réduire/agrandir », « Tout ramener au premier plan ».
  - Fenêtre déplacée en partie hors de l'écran puis app quittée et relancée : même taille, ramenée
    dans l'écran ; agrandie (« Réduire/agrandir ») puis relancée : de nouveau agrandie. Le plein
    écran (espace à part) n'a pas été essayé.
