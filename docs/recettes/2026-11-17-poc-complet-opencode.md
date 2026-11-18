# Rapport de recette « POC complet » — Bobine 1.0.0-beta.7 + OpenCode (openai/gpt-6-luna) — 2026-11-17

Scénario : [scenario-poc-complet.md](scenario-poc-complet.md). Joué par : pilote (Claude, Opus 5.5),
avec computer use. Fiche du passage : [238](../features/238-recette-poc-complet-premiere.md).
Captures : [`2026-11-17-poc-complet-opencode/`](2026-11-17-poc-complet-opencode/) (31 images,
2,2 Mo, recadrées et vérifiées : aucune donnée personnelle visible). Heures en UTC (heure de Paris
moins une heure) sauf mention.

## En bref

- **Résultat** : 9 étapes jouées sur 9 ; **2 réussies** (2, 4), **6 avec réserve** (1, 3, 5, 6,
  7, 8), 0 en échec, 0 non jouée ; l'étape 9 (clôture) n'a pas de verdict propre.
- **Interventions** : 5 pendant le jeu (liste au § Interventions), plus 2 avant l'étape 1
  (reconnexion d'OpenAI par l'utilisateur, accueil réactivé par une variable).
- **Défauts de Bobine** : 0 bloquant, **2 sérieux**, 10 gênants, 5 cosmétiques ou mineurs. Les trois
  plus graves :
  1. D1 — Filles de rôle parties dans un worktree **sans le travail non commité** de la mère :
     comptes rendus vides ; l'avis n'est que dans le fil de la fille (fiche [240](../features/240-filles-de-role-sans-modifications-non-commitees.md)).
  2. D2 — **Outils iOS absents** d'une conversation ouverte avant la création du projet Xcode ; le
     remède (« Redémarrer l'agent ») n'est que dans le menu ⚙ (fiche [241](../features/241-outils-ios-apres-creation-du-projet.md)).
  3. D3 — Message de commit proposé par Bobine **ignorant le souvenir** « Conventional Commits en
     anglais » (français, coupé), reproduit 2 fois sur 2.
- **Consommation** : agent **17 780 172 jetons** (cache compris, `usage.sqlite`) / plafond
  20 000 000 ; « Mon activité » affiche 635,2k jetons (entrée 580,8k, sortie 54,4k : **sans le
  cache**, voir D6) ; coût affiché 0,2403 $US (estimation de Bobine ; abonnement ChatGPT, rien de
  facturé). Pilote : **636 134 jetons** de contexte en fin de passage, sans compaction / plafond
  2 000 000 (mesure : contexte de la session Claude Code, voir § Consommation). Plafond atteint :
  **non**. Limite d'usage de l'abonnement atteinte : **non**.
- **Durée** : 1 h 46 min de jeu (19:47Z → 21:34Z, préparation comprise), dont environ 22 min
  d'écran du Mac verrouillé (deux fois) où rien n'a pu être fait.
- **Journaux** : **0 `ERROR`**, **6 `WARN`** sur tout le passage.
- **Mémoire maximale** : Bobine 1 008 Mo (étape 2), agents 652 Mo (étape 5, 5 conversations
  actives).
- **Comparé au passage précédent** : premier passage, pas de comparaison.

## Paramètres et environnement

| | |
|---|---|
| Bobine | 1.0.0-beta.7, DMG `Bobine-1.0.0-beta.7-arm64.dmg` (149 118 918 o) de la [Release v1.0.0-beta.7](https://github.com/jlallement/bobine/releases/tag/v1.0.0-beta.7), installé dans `/Applications` par le pilote à la demande de l'utilisateur (la beta.6 était installée ; mise à la corbeille). Téléchargé par `curl` : pas d'attribut de quarantaine, donc le premier lancement « non signé » n'a pas été exercé |
| Profil | dossier jetable `~/Development/bobine-recette/poc-1.0.0-beta.7-opencode/profil`, journal Détaillé (réglé avant l'étape 1) |
| Agent | OpenCode 2.3.0 |
| Modèle principal | `openai/gpt-6-luna` |
| Modèle de remplacement (4.2) | `openai/gpt-6.1-terra` |
| Modèle des filles « autre modèle » | `openai/gpt-5.6-terra` (fille web, 4.1 ; relecteur « Faire relire », 7.3) |
| Accès au modèle | abonnement ChatGPT dans OpenCode (connexion faite par l'utilisateur) |
| Plafond de l'agent | 20 M jetons ; plafond par conversation désactivé |
| Plafond du pilote | 2 M jetons |
| Mac | macOS 27.2.1, Apple M5 Pro, 24 Go |
| Xcode, simulateur | Xcode 27.2 (27B52), iPhone 17 sous iOS 27.2 |
| Node.js, git | v26.13.0, 2.56.1 |
| Pilote | `pnpm pilote` au commit `0f592e4` (`v1.0.0-beta.7-3`, deux commits de tests et de doc après le tag) ; computer use oui |

**Choix des modèles.** L'abonnement ChatGPT ne propose aucun palier « mini » ce jour-là
(`opencode models`, après reconnexion : gpt-5.5, gpt-5.6-luna/sol/terra, gpt-6-astra/luna/sol,
gpt-6.1-sol/terra, et leurs variantes `-fast`). L'utilisateur a demandé « un modèle adapté, le plus
proche d'un Qwen 30B et de ce que Bob propose en moyenne », et pas de modèle gratuit pour les filles
(quota trop faible). Hypothèse du pilote, non vérifiée : « luna » est le plus petit palier de la
famille 6. `gpt-5.5` est refusé (« not supported when using Codex with a ChatGPT account »).

## Grille par étape

Résultat : ✓ réussi, ~ avec réserve, ✗ échec, NA non applicable, NJ non jouée (raison en note).
Jetons agent : somme des `total_tokens` de `usage.sqlite` (cache compris) des tours commencés pendant
l'étape. Jetons pilote : non relevés par étape (voir § Consommation).

| Étape | Résultat | Début–fin (UTC) | Durée | Interventions | Blocages | `ERROR` / `WARN` | Mémoire Bobine / agents (Mo) | Jetons agent | Coût agent | Jetons pilote | Captures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0. Préparation | — | 19:47–19:52 | 5 min | 2 (avant jeu) | essai de l'accueil : « Connexion expirée » | 0 / 1 | — | 5 759 | 0 $ | — | `0-accueil-connexion-expiree.jpg` |
| 1. Cadrage | ~ | 19:52–19:58 | 6 min | 1 | 0 | 0 / 1 | 662 / 152 | 190 232 | 0,0099 $US | — (230 k cumulés) | `1-*.jpg` |
| 2. Maquettes | ✓ | 19:58–20:00 | 2 min | 0 | 0 | 0 / 1 | 1 008 / 152 | 72 265 | 0,0034 $US | — | `2-maquette-a/b/c.jpg` |
| 3. Experts | ~ | 20:00–20:07 | 7 min | 1 | 0 | 0 / 0 | 780 / 420 | 665 861 | 0,0089 $US | — | `3-defaut-*.jpg` |
| 4. Construction | ✓ | 20:07–20:19 | 12 min | 0 | 0 | 0 / 3 | 789 / 639 | 4 186 514 | 0,1401 $US | — | `4-*.jpg` |
| 5. Web | ~ | 20:19–20:30 | 11 min | 1 | 0 | 0 / 0 | 892 / 652 | 4 583 604 | 0,0556 $US | — | `5-*.jpg` |
| 6. iOS | ~ | 20:30–20:58 | 28 min (dont ~10 min écran verrouillé) | 2 | 0 | 0 / 0 | 606 / 365 | 4 595 001 | 0,0224 $US | — | `6-*.jpg` |
| 7. Relecture et git | ~ | 20:58–21:06 | 8 min | 0 | 0 | 0 / 0 | 549 / 515 | 794 784 | 0 $ (voir D8) | — | `7-*.jpg` |
| 8. Accrocs volontaires | ~ | 21:06–21:33 | 27 min (dont ~12 min écran verrouillé) | 0 | 0 | 0 / 0 | 677 / 234 | 2 686 152 | 0 $ (voir D8) | — | `8-*.jpg` |
| 9. Clôture | — | 21:33–21:34 | 1 min | 0 | 0 | 0 / 0 | 677 / 234 | 0 | 0 $ | — | `9-defaut-mon-activite-jetons.jpg` |
| **Total** | 2 ✓, 6 ~ | 19:47–21:34 | 1 h 46 min | 5 (+2 avant jeu) | 0 | **0 / 6** | max 1 008 / 652 | **17 780 172** | 0,2403 $US | **636 134** (contexte final) | 31 images |

## Grille par outil

| Outil | Étape | Résultat | Note (une ligne) |
|---|---|---|---|
| Mode Plan, plan annoté, question à choix | 1, 2 | ✓ | Plan en document, remarque → version 2, « Voir ce qui a changé » ; question à choix en carte (posée avant les liens : côté agent). |
| Panneau Tâches, liste épinglée | 1 | NA | Onglet présent mais vide (« L'agent n'a pas encore de liste de tâches ») : attendu avec OpenCode. |
| Onglet Session | 1, 4.2 | ✓ | Agent, modèle (GPT-6.1 Terra après `/model`), mode, dossier, branche, contexte par catégorie, modifications. |
| Mémoire commune | 1, 7 | ~ | Souvenir proposé en carte seulement après relance (agent) ; retenu et visible dans Réglages › Mémoire ; ignoré par le message de commit proposé (D3). |
| Aperçu HTML dans le navigateur intégré | 2 | ✓ | Trois liens, trois onglets du Navigateur, pas Safari. |
| Rôles, section Équipe, `@rôle`, création d'un rôle | 3, 6, 7 | ~ | Menu `@`, création d'« Expert SwiftUI » (lecture seule), `@expert-swiftui` tapé à la main reconnu ; D1. |
| Conversations filles, `/split`, Tâches proposées, Sous-tâches, vue Filles, fusion | 3, 4.1, 5 | ~ | Carte « 3 tâches proposées », vue Filles, fusion refusée puis « Committer puis fusionner » ; D1, D9. |
| Modèle d'une fille, changement de modèle | 4.1, 4.2 | ✓ | Fille web sur gpt-5.6-terra (constaté dans `usage.sqlite`) ; `/model` refusé clairement pendant un tour, accepté ensuite. |
| Cartes d'autorisation | 4.3, 5, 6 | ~ | 10 cartes (8 « Terminal » dont 2 refusées exprès, 1 « Lancer l’app », 1 « Compiler pour iOS »), toutes prises au premier clic ; D5 (libellé de « Toujours »). |
| Panneau terminal, `@terminal` | 4.3, 7 | ✓ | Onglets de l'agent, terminal à soi, « Ajouter au message », `@terminal` lu juste. |
| Commandes « / » de Bobine et du projet | 4.4 | ~ | `/context`, `/cost`, `/model` OK ; commande du projet faite en commande personnelle (écart du scénario) ; `/compact` NJ (8 % de contexte). |
| File d'attente | 4.5 | ~ | Deux messages partis ensemble ; D12 (ordre après « Modifier »). |
| Serveur de dev, navigateur intégré | 5 | ~ | Carte « Lancer l'app », barre « tasks en marche » ; outil employé après une intervention (agent). |
| Annoter la page | 5 | ✓ | Deux remarques, un message avec deux captures et les éléments visés ; corrigé en un aller-retour. |
| Simulateur iOS, joindre l'écran, annoter l'image | 6 | ~ | Après redémarrage de l'agent (D2) : compilation, simulateur en direct, image annotée corrigée en un aller-retour. |
| Modifications, remarques sur le diff | 7 | ~ | Remarque sur une ligne envoyée et appliquée ; D7 (« + » invisible en panneau étroit). |
| Faire relire | 7 | ✓ | Relecteur sur gpt-5.6-terra, `report_findings`, carte « rien à signaler » ; « Voir sur le diff » NJ (aucune remarque). |
| Vue Git, Committer, branches des filles | 7 | ~ | Commit depuis Bobine (avec « Défaire ») ; D3, D4. |
| Arrêter | 8.1 | ✓ | `session/cancel` 146 ms après le clic ; « Réponse interrompue » ; « Continue » reprend. |
| Quitter en plein tour, reprise | 8.2 | ~ | Dialogue, aucun processus restant, fil identique ; D10 (relance sur une nouvelle conversation). |
| Fenêtre rapide | 8.3 | ✓ | ⌥⌘B depuis le Finder, nouvelle conversation dans `taches`, fenêtre principale ouverte dessus. |
| Pièces jointes, texte collé | 8.4 | ✓ | Fichier par le trombone (fenêtre de macOS) et « Texte collé · 45 lignes ». |
| Export Markdown / JSON | 8.5 | ✓ | 231 640 o et 1 435 416 o, lisibles, sans secret ; D14 (extension doublée). |
| Consommation, plafond | toutes | ~ | D6 (deux mesures sous « Jetons traités »), D8 (coût estimé malgré l'abonnement). |
| Journal Détaillé | toutes | ✓ | `agents.log` a permis de suivre les tours, les outils MCP et les annulations. |

## Relevés propres à chaque étape

### 0. Préparation

- Bobine installée : 1.0.0-beta.6 (`CFBundleVersion`), remplacée par la beta.7 (vérifiée :
  `CFBundleVersion` 1.0.0-beta.7, journal « Démarrage de Bobine 1.0.0-beta.7 »).
- `pnpm pilote lancer --profil …` n'a **pas** montré l'accueil du premier lancement : un
  `--user-data-dir` donné hors profil temporaire compte comme un essai (`testRun`,
  `src/main/onboarding/onboarding-state.ts`), sauf `BOBINE_ONBOARDING=1`. Relancé sur un profil neuf
  avec cette variable (écart au scénario, corrigé dans celui-ci).
- Au premier lancement, avant le choix d'OpenCode, Bobine démarre le vrai IBM Bob (agent par
  défaut, essai de connexion) et lit son quota, qui supprime une session dans le vrai `~/.bob`
  (D17) ; une deuxième lecture, avec suppression, suit la relance de l'étape 8.
- Essai de l'accueil avec le modèle par défaut (GPT-6.2 Astra) : bandeau « Connexion expirée ». En
  ligne de commande, `opencode run` échouait aussi (« Request failed: 400 ») sur tous les modèles
  OpenAI : la connexion manquait. L'utilisateur s'est reconnecté par « Se connecter dans le
  terminal » de Bobine. « Réessayer » : « OpenCode a répondu en 2,6 s · OK », modèle affiché
  `opencode/Hy4 flash Free` alors que la puce montrait GPT-6.2 Astra (D16).
- Capture : `0-accueil-connexion-expiree.jpg`.

### 1. Cadrage

- Mode Plan : couleur de la saisie, pastille « Plan », ligne « Mode Plan : l'agent lit et propose,
  il ne modifie rien. Maj+Tab pour passer en Build. ».
- Versions du plan : **2** (16 s, puis 15 s après la remarque ; la route PATCH figurait déjà dans la
  version 1) ; « Voir ce qui a changé » montre le diff des deux versions.
- Souvenir : la consigne « Retiens pour ce projet… » donne d'abord une réponse en texte (« Je peux
  te le proposer pour la mémoire partagée du projet »), sans carte. Après relance (intervention 1) :
  carte « Retenir ce souvenir ? — Commit messages use Conventional Commits and are written in
  English. », portée « Ce projet · taches » ; **Retenir** ; visible dans Réglages › Mémoire
  (fichier `commit-message-convention.md`). Côté agent : l'outil `remember` était disponible.
- « Exécuter le plan » : 2 min 24 s, 14 fichiers +625 −2. L'agent a écrit **tout le code** (API,
  page, sources SwiftUI sans projet Xcode) et lancé `npm test` (3 tests).
- Onglet Tâches : présent et vide (NA avec OpenCode).
- Captures : `1-plan-propose.jpg`, `1-plan-v2-ce-qui-a-change.jpg`, `1-carte-souvenir.jpg`,
  `1-onglet-session.jpg`.

### 2. Maquettes

- Trois maquettes ouvertes dans le navigateur intégré (`http://127.0.0.1:51640/…/a.html`, `b`,
  `c`), un onglet chacune.
- Question à choix posée : **oui**, en carte (« Quelle maquette préfères-tu pour la page web ? »),
  mais **avant** les liens (la consigne demandait l'inverse : côté agent). Choix : B.
- Captures : `2-maquette-a.jpg`, `2-maquette-b.jpg`, `2-maquette-c.jpg`.

### 3. Experts

- Filles des rôles : parties à la même seconde (20:00:52Z), sans carte d'accord, avatars de rôle
  sous la mère, branches `bobine/20261117-2100-d022` et `…-38f3`, modèle hérité gpt-6-luna. Premier
  tour : 14,6 s et 13,8 s ; coût affiché 0,00 $US.
- **D1** : les deux comptes rendus sont vides (« je n'ai pas pu évaluer le plan ni la maquette… seul
  `README.md:1-3` est présent ») ; voir fiche 240. Intervention 2 : réponse dans chaque fille avec
  le chemin du dossier d'origine → trois remarques sur le plan et trois sur la maquette chacune.
- Consigne 3.4 : la mère appelle `child_status`, puis `message_child` pour redemander les comptes
  rendus complets (ceux qu'elle avait reçus étaient tronqués : « (cut: 2531 characters in all) »,
  D11), applique (maquette, README) et liste ce qu'elle écarte (61 s).
- Lecture seule : les rôles appelés ne sont pas en lecture seule ; « rien modifié » sur les deux.
- Rôle « Expert SwiftUI » créé par l'assistant en trois étapes (modèle Code reviewer, lecture
  seule, portée Personnel) ; apparaît dans Équipe et dans le menu `@` ; l'assistant affiche
  « Avec OpenCode, la lecture seule n'est que demandée ».
- Captures : `3-defaut-fille-sans-modifications.jpg`, `3-defaut-comptes-rendus-vides.jpg`.

### 4. Construction

- Filles :

  | Chantier | Modèle demandé | Modèle constaté (`usage.sqlite`) | Branche | Durée (tours) | Jetons | Coût affiché |
  |---|---|---|---|---|---|---|
  | (a) API et tests | modèle principal | openai/gpt-6-luna | `bobine/20261117-2109-9700` | 101 s (3 tours) | 137 733 | 0,00 $US |
  | (b) Page web | autre modèle | openai/gpt-5.6-terra | `bobine/20261117-2109-4d35` | 130 s (1 tour) | 80 115 | 0,00 $US |
  | (c) iOS | « Faire ici » | — | — | — | — | — |

  « Faire ici » envoie **tout de suite** la tâche (c) à la mère (« About the child conversation…
  do this task yourself, now ») : l'iOS s'est fait à l'étape 4, pas à l'étape 6 (écart au
  scénario). La mère a écrit un projet Xcode et l'a compilé avec `xcodebuild` (Debug et Release) en
  186 s. Elle a vérifié les deux branches (`npm test`, `node --check`) et les a recommandées
  (`recommend_merge`), sans fusionner.
- Changement de modèle de la mère : pendant un tour, la puce est désactivée et `/model` répond
  « Model : openai/GPT-6.1 Terra » puis « Réglage impossible maintenant (statut : busy) » (refus
  clair ; la première ligne peut faire croire au changement). Après le tour : `/model
  openai/gpt-6.1-terra`, onglet Session « GPT-6.1 Terra », README écrit en 25 s. Coût de la mère :
  luna 2 717 877 jetons / 0,0543 $US avant, terra 226 245 jetons / 0,0885 $US pour ce seul tour.
  Retour à Luna par `/model`. Capture `4-modele-remplacement-session.jpg`.
- Cartes d'autorisation : 5 à cette étape (`cd api && npm test` → Lancer ; `cd .worktrees/…/api
  && npm test` → Toujours dans ce projet ; `… && npm start` → Lancer, D5 ; `curl …/health` →
  Lancer ; `npm test` de `/verifier-api` → Lancer), toutes prises au premier clic (moins d'une
  seconde). La première commande échoue (`api/` pas encore sur `main` : côté agent).
- Commandes : `/context` « Contexte : 87 389 / 1 050 000 jetons (8 %) » (= puce 8 %) ; `/cost`
  « Jetons traités : 4 051 903 sur 17 échanges (216 288 en entrée, 26 082 en sortie) · Coût :
  0,1556 $US » ; `/verifier-api` (commande **personnelle** : Réglages › Commandes ne crée que des
  commandes personnelles, une commande du projet est un fichier `.bobine/commands/*.md`) : « 6
  réussis, 0 échec » ; `/compact` NJ. Capture `4-context-cost.jpg`.
- Terminal à soi : onglet 4, `node --version`, « Ajouter au message » → bloc « Terminal 4
  (taches) : v26.13.0 » ; `@terminal les tests passent-ils ?` → réponse juste.
- File d'attente : « 2 messages partiront à la fin de la réponse », partis ensemble en un message ;
  D12. Capture `4-defaut-file-ordre.jpg`.

### 5. Web

- Fusion : la carte Sous-tâches (placée à la dernière fille lancée, loin dans le fil) affiche
  « Fusion refusée : le dossier principal a 23 modifications non commitées » avec « Committer
  d'abord / Mettre de côté / Puis nettoyer ». Committer d'abord → message proposé D3 → remplacé à la
  main → « 2 fusionnées dans main en 1 s ». Captures `5-fusion-refusee.jpg`,
  `5-defaut-message-commit.jpg`. Ensuite, vue Git périmée (D4, `5-defaut-vue-git-perimee.jpg`).
- Serveur de dev : premier essai, l'agent lance un serveur maison (`node -e …`) dans le terminal,
  sur le worktree (intervention 3 : Refuser + consigne). Ensuite carte « Lancer l'app — L'agent veut
  lancer « tasks » dans taches : npm start », restée en attente après la fin du tour ; Lancer →
  message automatique « J'ai autorisé « npm start » : relance preview_start. » → page
  `http://localhost:3000/` dans le Navigateur, barre « tasks en marche ».
- Remarques annotées : **2** (titre ; tâche cochée, après défilement), un seul message avec deux
  captures, « Élément : h1#page-title » et « … label.task-label, texte « Appeler le plombier » ».
  L'agent a corrigé les deux bons éléments. Allers-retours : **1**. Serveur vivant à la fin.
  Captures `5-page-annotee.jpg`, `5-message-annotations.jpg`, `5-page-corrigee.jpg`.

### 6. iOS

- Projet Xcode écrit par l'agent lui-même, sans XcodeGen (étape 4). Premier essai à l'étape 6 :
  `xcrun simctl` puis `xcodebuild` dans le terminal (intervention 4 : Refuser + consigne) ; l'agent
  répond que `ios_build` n'est pas dans sa session : **D2** (fiche 241). Intervention 5 : menu ⚙ ›
  Redémarrer l'agent (47 outils au lieu de 35).
- Compilations avant le premier succès : **2** avec l'outil de Bobine (la première compile mais
  l'installation échoue, « IXErrorDomain code=13 », Info.plist incomplet ; l'agent le complète) ;
  `ios_build` 5,0 s après la carte « Compiler pour iOS ». Capture `6-app-lancee.jpg`.
- Flux du simulateur : en direct ; « Taille réelle » (100 %) et « Ajuster au panneau » (68 %) OK.
- Joindre l'écran : vignette jointe (deux fois, voir § Outillage) ; clic → éditeur (rectangle,
  flèche, crayon, texte) ; rectangle sur le titre et texte « Afficher le nombre de taches restantes
  sous le titre » ; « Appliquer ». Prompt « 2 bloc(s) text+image (75.4 Ko) » ; correction « 1 tâche
  restante » en 1 min 25 s, recompilée sans nouvelle carte. Captures `6-image-annotee.jpg`,
  `6-ecran-corrige-simulateur.jpg`.
- `@expert-swiftui Relis le code de ios/…` (tapé sans le menu, reconnu : « Partira à Expert
  SwiftUI… lecture seule demandée · dans ce dossier ») : 17,9 s, lectures seulement, 2 remarques.

### 7. Relecture et git

- Remarque sur le diff (ligne 10 de `TasksView.swift`) envoyée et appliquée ; D7.
- Remarques : `@Code reviewer` **2** (1 à corriger : `web/index.html:30` maxlength 500 contre 200
  côté API ; 1 suggestion : test de traversée de répertoire) ; « Faire relire » **0** (« Relecture par
  OpenCode : rien à signaler », gpt-5.6-terra, 105 s, `report_findings`). Capture
  `7-relecture-rien-a-signaler.jpg`.
- Message de commit proposé : « feat: nous allons construire un petit gestionnaire de tâches en
  … » + liste des fichiers. **Ne suit pas le souvenir.** Côté Bobine : la proposition est dérivée du
  titre de la conversation, sans appel à l'agent (fiche 110), et ne lit pas la mémoire. Remplacé à
  la main ; « Commit b00f71c fait » avec « Défaire ». Capture `7-defaut-message-commit-bis.jpg`.
- `git log --oneline --graph` (terminal de Bobine, fin d'étape 7) :

  ```text
  * b00f71c fix: address review feedback on web, API and iOS app
  *   400c1da Merge branch 'main' into bobine/20261117-2109-4d35
  |\
  | *   e30e089 Merge branch 'main' into bobine/20261117-2109-9700
  | |\
  | | * ecb1f1a feat: scaffold task manager API, web page and iOS app
  | * | 1773f29 feat(api): add task management endpoints
  | |/
  * / 0cd1279 feat(web): add task manager interface
  |/
  * 9970242 chore: initial commit
  ```

  `git branch` : `main` et les quatre branches `bobine/…`.

### 8. Accrocs volontaires

- Arrêt : clic à 21:06:24.803Z, `session/cancel` à 21:06:24.949Z, réponse « cancelled » à
  21:06:24.979Z (37,5 s de tour). « Réponse interrompue. » ; le groupe d'outils affiche « ✕ 1
  échec » et non « interrompu » (D13) ; « Continue » finit la page À propos (8 tests). Capture
  `8-arret.jpg`.
- ⌘Q en plein tour : dialogue « Un agent travaille encore — « Nous allons construire… » est en
  train de répondre. Quitter arrêtera l'agent. » (Annuler / Quitter). Quitter → 5 agents arrêtés à
  21:08:39Z (code 143), **aucun processus d'agent restant**, serveur :3000 arrêté. Relance : aucune
  ligne `ERROR`/`WARN` ; Bobine s'ouvre sur une **nouvelle conversation** (D10) ; fil de la mère
  identique, dernier outil « Modification — interrompu », filles présentes. « Continue là où tu en
  étais » → 35 s, un test par route, 14 tests verts. Captures `8-dialogue-quitter.jpg`,
  `8-fil-apres-relance.jpg`.
- Fenêtre rapide : ⌥⌘B depuis le Finder → « Demander à OpenCode… — Nouvelle conversation ·
  OpenCode · taches » → nouvelle conversation, fenêtre principale ouverte dessus. Réponse :
  « `api/server.test.js` contient 13 tests » (la mère en annonçait 14 : côté agent). Pas de
  capture gardée : celle prise montrait le Finder et des fichiers personnels.
- Pièce jointe et texte collé : trombone → fenêtre de macOS → « taches-exemple.json » ; collage de
  45 lignes → « Texte collé · 45 lignes » ; prompt « 3 bloc(s) text+resource » ; 5 tâches importées.
  Capture `8-pieces-jointes.jpg`.
- Exports : menu de la conversation › Exporter en Markdown… / en JSON… (fenêtre de macOS) ;
  Markdown 231 640 o, 4 548 lignes, lisible (agent, dossier, dates, « ## Vous » / « ## OpenCode ») ;
  JSON 1 435 416 o ; aucun motif de secret (`sk-`, `Bearer`, `access_token`, `api_key`) ; chemins
  absolus du projet et de `~/Library` (sorties de `xcodebuild`), attendus. Exports non commités.

### 9. Clôture

- App produite vérifiée à la main : `node --test` dans `api/` → 14 tests, 14 réussis ; API démarrée
  hors de Bobine le temps d'un essai : `/` et `/about.html` en 200, 7 tâches servies ; app iOS
  vérifiée à l'étape 6 (capture `simctl`). Travail de l'agent : deux serveurs coexistent (`server/`
  de l'étape 1, `api/` de la fille) et le `start` racine pointe sur l'ancien.
- Résumé du pilote (`journal --resume`) : « Session : 1 h 45 min · 16 attente(s), 6 min 13 s à
  attendre · Notes : 17 — Bloquant 0, Gênant 10, Mineur 4, Idée 3 · Interventions : 4 · Tours
  mesurés : 4 — médiane 38 s, max 2 min 24 s ». Le pilote n'a mesuré que 4 tours (voir
  § Outillage) ; l'intervention 5 (redémarrage de l'agent) n'y a pas été notée.
- « Mon activité » : 50 échanges dans 9 conversations, temps de travail 40 min 52 s, jetons traités
  635,2k, coût 0,2403 $US « 1 échange sans coût communiqué ». Capture
  `9-defaut-mon-activite-jetons.jpg`.

## Défauts

| N° | Gravité | Étape | Côté | Ce qui se passe | Reproduction | Journal / capture | Fiche |
|---|---|---|---|---|---|---|---|
| D1 | sérieux | 3 | Bobine | Un `@rôle` non lecture seule part dans un worktree créé depuis le commit, sans les 17 fichiers non commités de la mère ; comptes rendus vides ; l'avis « 17 modifications non commitées… ne sont pas ici » n'est que dans le fil de la fille, rien avant l'envoi ni dans la mère. | 2 / 2 (deux filles du même envoi) | `main.log` 20:00:51 « opencode acp dans …/.worktrees/20261117-2100-d022 » ; `3-defaut-fille-sans-modifications.jpg`, `3-defaut-comptes-rendus-vides.jpg` | [240](../features/240-filles-de-role-sans-modifications-non-commitees.md), agent factice |
| D2 | sérieux | 6 | Bobine | Conversation ouverte sans projet Xcode : jamais d'outils `ios_*` ni d'onglet iOS, même après création du projet ; le remède n'est que dans le menu ⚙ (« Redémarrer l'agent ») ; rien dans le fil. | vu une fois ; cause lue dans le code (`simulator-tools.ts:57`) | `agents.log` 20:34:20 « session/load… tools/list : 47 outil(s) » ; `6-menu-outils-35-47.jpg` | [241](../features/241-outils-ios-apres-creation-du-projet.md), agent factice |
| D3 | gênant | 5, 7 | Bobine | Message de commit proposé « feat: nous allons construire un petit gestionnaire de tâches en » : dérivé du titre, en français, coupé, sans le souvenir « Conventional Commits en anglais ». | 2 / 2 | `5-defaut-message-commit.jpg`, `7-defaut-message-commit-bis.jpg` | — (à décider) |
| D4 | gênant | 5 | Bobine | Après « Committer puis fusionner », la vue Git garde « Committer (23) / 23 fichiers depuis le dernier commit » (git status vide) jusqu'à « Actualiser ». | vu une fois | `5-defaut-vue-git-perimee.jpg` | — |
| D5 | gênant | 4 | Bobine | « Toujours dans ce projet — Sans redemander dans ce dossier » ne retient que la commande exacte (`command-approval.ts`) : la commande suivante du même dossier redemande. | vu une fois (comportement voulu, libellé trompeur) | `4-defaut-toujours-redemande.jpg` | — |
| D6 | gênant | 4, 9 | Bobine | « Jetons traités » : `/cost` compte le cache (4 051 903 pour la mère), « Mon activité » non (635,2k pour tout le passage). | vu une fois | `4-context-cost.jpg`, `9-defaut-mon-activite-jetons.jpg` | — |
| D7 | gênant | 7 | Bobine | Remarque sur le diff : le « + » au survol du numéro de ligne n'est pas visible dans le panneau à sa largeur normale ; visible une fois le panneau agrandi. | vu une fois | — (pas de capture du panneau étroit ; constat par zoom) | — |
| D8 | gênant | toutes | Bobine | Coût estimé en $US sur chaque tour de la mère (≈ 0,001 à 0,09 $) malgré l'abonnement ChatGPT ; les filles affichent 0,00 $US ; après le redémarrage de l'agent (20:34Z), plus aucun coût. | à chaque tour | `1-plan-propose.jpg` (« ≈ 0,001 $US »), `9-defaut-mon-activite-jetons.jpg` | — |
| D9 | gênant | 5 | Bobine | La carte Sous-tâches (et son bouton de fusion) reste à la position de la dernière fille lancée, loin dans un long fil : il a fallu une quinzaine de défilements pour la retrouver. | vu une fois | — (pas de capture : non prise sur le moment, et une capture ne montre pas une distance de défilement ; constat du pilote seul, emplacement relevé au § 5) | — |
| D10 | gênant | 8 | Bobine | Après ⌘Q puis relance, Bobine s'ouvre sur une nouvelle conversation et non sur celle qui travaillait. | vu une fois | `8-fil-apres-relance.jpg` (fil retrouvé par la barre latérale) | — |
| D11 | gênant | 3 | Bobine | Comptes rendus de filles transmis tronqués à la mère (« (cut: 2531 characters in all) ») : la mère a redemandé le texte complet par `message_child`. | vu une fois | — (pas de capture : la troncature n'est lisible que dans l'export JSON de la mère, gardé hors du dépôt dans le dossier du passage, non commité) | — |
| D12 | cosmétique | 4 | Bobine | File d'attente : un message modifié repasse en dernière position. | vu une fois | `4-defaut-file-ordre.jpg` | — |
| D13 | mineur | 8 | Bobine | Après Arrêter, le groupe d'outils affiche « ✕ 1 échec » au lieu d'« interrompu » (l'échec peut venir d'une commande antérieure : non tranché). | vu une fois | `8-arret.jpg` | — |
| D14 | cosmétique | 8 | Bobine | Export : un nom saisi avec « .md » donne « .md.md ». | vu une fois | ligne « Conversation exportée : …/recette-bobine-export-mere.md.md » | — |
| D15 | cosmétique | 5 | Bobine | La fusion depuis la carte écrit « Merge branch 'main' into bobine/… » dans l'historique de `main`. | vu une fois | `git log` ci-dessus | — |
| D17 | gênant | 0, 8 | Bobine | Profil jetable : avant tout choix d'agent, Bobine lance le vrai `bob acp` (essai de connexion de l'accueil) puis lit le quota de Bob, ce qui crée puis **supprime une session dans le vrai `~/.bob`** de l'utilisateur ; recommencé à la relance (8.2), alors qu'OpenCode était l'agent choisi. Gravité : gênant et non sérieux parce que, d'après le code, la suppression ne vise que des sessions vides du dossier réservé de Bobine (voir sous le tableau) et que rien n'a bloqué ; mais un profil jetable n'isole pas des données réelles de Bob, et l'agent par défaut démarre avant que l'utilisateur l'ait choisi. | 2 / 2 lancements | `main.log` 19:48:06.982Z « Agent lancé (bob, 9faf592c) : bob acp dans ~/…/profil/workspace », 19:48:12.028Z et 21:09:00.515Z « Quota de IBM Bob : 1 session(s) vide(s) supprimée(s) » ; pas de capture (rien à l'écran) | — |
| D16 | mineur | 0 | Bobine | Essai de l'accueil : « Modèle : opencode/Hy4 flash Free » alors que la puce de la conversation montrait GPT-6.2 Astra. | vu une fois | — (pas de capture gardée : le terminal voisin montrait l'URL de connexion OAuth) | — |

**D17, quelle session a été supprimée.** Bobine ne journalise pas son identifiant, et la vérifier
demanderait de lire `~/.bob` (exclu de la recette). Le code le borne : la lecture du quota tourne
dans le dossier réservé `~/Library/Caches/Bobine/agent-status/bob` (`quotaStatusDir`,
`src/main/agent/quota.ts:48`), puis supprime la tâche créée par ce `/status` et les tâches **sans
premier message** dont l'espace de travail est ce dossier (`emptyTasksIn`,
`src/main/agent/bob-status.ts:74-75` et `:217-231`). Ce ne peut donc pas être une conversation de
l'utilisateur dans un autre dossier ; c'est, selon toute vraisemblance, la session que la lecture
venait de créer. L'essai de connexion de l'accueil ouvre lui aussi une session Bob dans
`~/…/profil/workspace` et la supprime (`src/main/onboarding/agent-readiness.ts:249-269`), sans ligne
de journal ; `onboarding-sessions.json` du profil est vide (`[]`), donc aucune suppression en
attente. Non expliqué : « Agent lancé (bob) : bob acp dans ~/…/taches » (19:52:00Z, arrêté après
904 ms) à l'ouverture du projet.

**Côté agent (le modèle, pas Bobine)** : souvenir proposé en texte avant d'utiliser l'outil
(étape 1) ; question à choix posée avant les liens (2) ; serveur maison dans le terminal au lieu de
l'outil serveur de dev (5) ; `xcodebuild` dans le terminal au lieu de `ios_build` (6, en partie
expliqué par D2) ; première commande `cd api` alors que `api/` n'était pas fusionné (4) ; 14 puis
13 tests annoncés pour le même fichier (8). Bobine les a tous montrés clairement (cartes de commande
lisibles, refus pris en compte).

**Non retenus après vérification** (notes du pilote corrigées) : « pas de retour de `/model` »
(le retour était dans le fil, hors de l'écran) ; « pas de choix du modèle dans Faire relire » (la
liste s'affiche bien) ; « Joindre cet écran sans effet » (deux vignettes jointes, la fenêtre en
arrière-plan ne se redessinait pas).

## Interventions

| Heure | Étape | Ce que le testeur a fait | Pourquoi | Un humain l'aurait-il trouvé ? |
|---|---|---|---|---|
| 19:49Z | 0 | L'utilisateur a refait la connexion OpenAI (bouton « Se connecter dans le terminal ») | OpenCode répondait 400 à toutes les requêtes OpenAI | oui (Bobine propose le bouton) |
| 19:49Z | 0 | Relance du pilote avec `BOBINE_ONBOARDING=1` sur un profil neuf | pas d'accueil avec `--profil` | sans objet (outillage) |
| 19:54Z | 1 | « Oui, propose-le avec ton outil de mémoire de Bobine. » | souvenir proposé en texte, sans carte | probablement (relance naturelle) |
| 20:02Z | 3 | Réponse dans chaque fille : le chemin du dossier d'origine | filles sans les fichiers non commités (D1) | difficilement (l'avis n'est que dans la fille) |
| 20:22Z | 5 | Refuser la commande `node -e …` + « utilise l'outil serveur de dev de Bobine » | serveur maison sur le worktree | oui, s'il connaît l'outil |
| 20:32Z | 6 | Refuser `xcodebuild` + « utilise ios_build » | compilation hors de l'outil de Bobine | oui, s'il connaît l'outil |
| 20:34Z | 6 | Menu ⚙ › Redémarrer l'agent, puis consigne renvoyée | outils iOS absents de la session (D2) | difficilement (rien dans le fil) |

« Committer d'abord » (5.1) n'est pas compté : c'est l'issue que la carte propose.

## Erreurs du journal

Lignes `ERROR` et `WARN` de `main.log` et `agents.log`, tout le passage (aucune `ERROR`) :

```text
# Préparation
2026-11-17T19:52:12.001Z WARN  Mémoire : clé des empreintes créée
# Étape 1
2026-11-17T19:55:58.774Z WARN  L’agent n’a rien envoyé depuis 64.2 s pendant un tour (opencode, f7836b04)
# Étape 2
2026-11-17T19:59:10.027Z WARN  L’agent n’a rien envoyé depuis 72.1 s pendant un tour (opencode, f7836b04)
# Étape 4
2026-11-17T20:10:14.031Z WARN  IPC agent:setControl : Error: Réglage impossible maintenant (statut : busy)
2026-11-17T20:11:03.650Z WARN  L’agent n’a rien envoyé depuis 61.7 s pendant un tour (opencode, f7836b04)
2026-11-17T20:11:26.076Z WARN  L’agent n’a rien envoyé depuis 68.1 s pendant un tour (opencode, 0388a442)
```

## Consommation

- **Agent** (`usage.sqlite` du profil, 50 tours dans 9 conversations) : entrée 580 800, sortie
  54 353, cache lu 17 116 032, **total 17 780 172** ; coût affiché 0,2403 $US. Par modèle :
  gpt-6-luna 17 307 437 (45 tours) ; gpt-6.1-terra 226 245 (1) ; gpt-5.6-terra 240 731 (2) ;
  hy4-flash-free 5 759 (essai de l'accueil) ; gpt-6.2-astra 1 tour sans jetons (essai refusé). La
  mère pèse l'essentiel : la puce de contexte de la mère montrait 34 à 41 % aux étapes 6 à 8,
  et chaque appel d'outil relit ce contexte (cache).
- **Pilote** : Claude Code ne donne pas de cumul de jetons par session ; la mesure prise est le
  contexte de la session : 230 023 jetons après l'étape 1, **636 134** en fin de passage, sans
  compaction (sous le plafond de 2 M quelle que soit la façon de compter le cache). Le quota
  hebdomadaire de l'abonnement Claude est passé de 47 % à 48 %.
- Pas de limite d'usage de l'abonnement ChatGPT rencontrée.

## Outillage de la recette (pas Bobine)

- **Pilote** (`scripts/pilote/cdp.mjs`, `mainPage`) : quand le navigateur intégré a des pages, le
  pilote peut s'attacher à l'une d'elles au lieu de la fenêtre de Bobine (`etat` rend « agent ? »,
  `envoyer` échoue, `attendre` sort aussitôt, `capture` capture la page) ; une page reste une cible
  même onglet fermé. Deux captures de note ont ainsi montré la maquette B : remplacées par des
  captures computer use du même moment. `attendre` n'a pas vu la carte « Retenir ce souvenir ? »,
  et a pris la carte « Tâches proposées » déjà traitée pour une carte en attente. `envoyer` a échoué
  une fois dans une conversation fille.
- **Computer use** : en arrière-plan, la saisie posée d'un coup n'ouvre pas le menu `@`, « Entrée »
  n'envoie pas toujours, et la fenêtre ne se redessine pas toujours (captures périmées) ; le plein
  écran a été demandé pour ces gestes, les fenêtres de macOS et les listes natives. L'écran du Mac
  s'est verrouillé deux fois (≈ 22 min perdues).
- **Scénario** : écarts corrigés dans [scenario-poc-complet.md](scenario-poc-complet.md) (accueil et
  `BOBINE_ONBOARDING=1`, « Faire ici » immédiat, commande du projet = fichier, fusion refusée avec
  des modifications non commitées).

## Ce qui reste

- **Non joué** : `/compact` (contexte à 8 %) ; « Voir sur le diff » de Faire relire (aucune
  remarque) ; capture propre de la fenêtre rapide.
- **Chemin d'installation réel non exercé** : la beta.7 a été installée par le pilote (DMG
  récupéré de la Release en ligne de commande, copié par `ditto`), pas par un navigateur ; la
  quarantaine de macOS et le premier lancement d'une app non signée n'ont donc pas été vus.
- **Fiches à ouvrir** : D3 (message de commit qui ignore le souvenir, 2 / 2) ; défauts du pilote
  (§ Outillage : cible CDP qui peut être une page du navigateur intégré, `attendre` qui manque des
  cartes ou en prend une déjà traitée). D17 n'a pas de fiche (gênant).
- Profil et projet du passage à mettre à la corbeille après relecture (§ État laissé).

## État laissé

Bobine quittée (`pilote arreter`), aucun processus d'agent restant ; serveur de l'API arrêté ;
simulateur iPhone 17 éteint ; profil et projet **gardés** dans
`~/Development/bobine-recette/poc-1.0.0-beta.7-opencode/` jusqu'à la relecture du rapport, à
mettre ensuite à la corbeille (avec `profil-essai-sans-accueil/`) ; `~/.bob` **touché** (D17 : deux
lectures du quota, chacune avec une session supprimée ; un essai de connexion) ; le presse-papiers de
l'utilisateur contient le texte fictif de 45 lignes (étape 8.4) ; aucun fichier laissé dans
`~/Documents` (exports déplacés).
