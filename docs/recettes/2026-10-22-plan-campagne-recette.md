# Plan de campagne de recette « comme un humain » — Bob et OpenCode (GPT-6.1)

**Statut : protocole validé dans ses grandes lignes le 2026-10-22** (app packagée, projet
« Carnet de lecture », OpenCode d'abord) ; couverture rendue exhaustive à la demande de Jérôme :
simulateurs iOS et Android en cas à part entière, chaque élément replié déplié et capturé,
historique, recherche, archivage, réglages. Le résultat sera un **procès-verbal de recette** par
agent (modèle § 7), écrit au fil de l'eau par le pilote.

## 1. Pourquoi cette campagne

| Essai | Date | Agent | Ce qu'il a montré | Ce qu'il n'a pas montré |
|---|---|---|---|---|
| Passage complet (script CDP) | 2026-10-19 | Bob 2.0.6, app packagée 0.2.0 | 11 cas sur 12 verts, 1,41 bobcoin | aucune usure, pas de vraie souris, un cas par conversation |
| Essai libre (vraie souris) | 2026-10-20 | OpenCode 2.0.32 + GPT-6.1 Sol, 0.3.0 | 7 défauts, 10 soucis, 7 manques en 30 min | les longues conversations, la compaction subie, plusieurs worktrees ensemble |

Depuis : fil durable (103), continuer avec l'autre agent (108), coût (109), cycle des worktrees
(110), filles proposées et fusionnées (112, 117, 118, 120), « À traiter » (119), fenêtre
« À propos » (116) — **jamais essayés longtemps avec un vrai agent**. Objectif : une vraie
évolution en plusieurs étapes, 2 à 3 h par agent, toutes les fonctions, un PV qui tranche.

## 2. Dispositif

| | Choix | État |
|---|---|---|
| Bobine | **App packagée** `dist/mac-arm64/Bobine.app` (0.4.0, signature ad hoc), construite depuis `main` à `d936609` | construite le 2026-10-22, `pnpm e2e:packaged` vert |
| Isolement | `--user-data-dir` temporaire (gardé jusqu'à la fin de la campagne : la reprise entre actes en dépend), `--use-mock-keychain`, `BOBINE_LOG=trace` ; **pas** de `BOBINE_AGENT_PROFILE` : le choix de l'agent fait partie de la recette | `e2e/captures/recette-2026-10/pilote/lancer.sh` |
| Pilotage | computer-use (clics, frappe, glisser-déposer réels), Bobine en **plein écran** ; CDP seulement pour diagnostiquer | accès à demander : Bobine (complet), Finder, Simulateur et émulateur (lecture : ils sont pilotés par Bobine), Terminal (clic) |
| Agents | OpenCode 2.0.32 + `openai/gpt-6.1-sol` (abonnement ChatGPT, `opencode auth login` déjà fait) ; Bob Shell 2.0.6 (SSO déjà fait dans `~/.bob`) | installés, versions relevées le 2026-10-22 |
| Projet d'essai | `~/Development/bobine-recette/carnet-de-lecture` : app web Node sans dépendance (`server.js`, `src/books.js`, `public/`, `test/`, `data/books.json`, 12 livres), **2 bugs volontaires** (recherche sensible à la casse, moyenne fausse), README avec 8 points « À faire », git, 1 commit ; `mobile/` : compagnon **Flutter** (`flutter create`, iOS `mobile/ios/Runner.xcworkspace` + Android `mobile/android/gradlew`), précompilé une fois pour que la première compilation ne mange pas la recette | créé et compilé le 2026-10-22, 2 commits |
| Simulateur iOS | iPhone Air iOS 26.0 (Xcode 26.6) ; AXe embarqué dans l'app | — |
| Émulateur Android | AVD `Medium_Phone_API_36.0`, SDK `~/Library/Android/sdk` | — |
| Relevés | `e2e/captures/recette-2026-10-2x-<agent>/` : captures (§ 3), `journaux/main.log`, `agents.log`, `conversations/`, `bob.json` (coûts lus dans `~/.bob/db/bob.db`, lecture seule) | — |

**Pourquoi Flutter pour le mobile.** Une seule commande donne un vrai projet Xcode (schéma
`Runner`, compilé par `xcodebuild`, donc par `ios_build`) et un vrai projet Gradle, dans la même
histoire (« l'app mobile lit la même API »). Risque assumé : `android_build` cherche l'APK sous
`android/` alors que Flutter l'écrit dans `mobile/build/` ; l'agent devra passer par
`android_launch` avec `apk_path`. C'est précisément le genre de chose que la recette doit juger.

### Budget bobcoins (plafond 15 à 20, visé 8 à 14)

Relevé dans `bob.db` le 2026-10-22 : 0,1 à 0,35 bobcoin par tâche sur un petit projet (19 octobre :
1,41 pour 12 tours), **jusqu'à 1 bobcoin** quand le contexte atteint 54 000 jetons. Les outils de
Bobine pèsent ≈ 5 850 jetons par tour toutes familles confondues, ≈ 3 500 sans iOS ni Android
(fiche 109).

| Poste | Estimation | Garde-fou |
|---|---|---|
| Acte Bob complet (≈ 40 tours, 2 conversations longues, 3 filles, 1 sous-agent) | 6 à 10 | coût relu dans `bob.db` à chaque fin de scène ; **arrêt à 12**, les scènes restantes passent à OpenCode et le PV le dit |
| Acte croisé | 1 à 2 | Bob sollicité 3 tours |
| Acte mobile avec Bob | 1 à 2 | joué d'abord avec OpenCode ; avec Bob seulement si l'acte Bob est resté sous 8 |
| **Total** | **8 à 14** | familles iOS / Android désactivées dans les actes web (scène 0.4) |

OpenCode : abonnement, pas de plafond ; le pilote note les jetons de chaque tour pour comparer.

## 3. Règles de relevé et de capture

1. **Tout ce qui est replié est déplié, et capturé dans les deux états** : carte d'outil,
   groupe d'outils, diff, « Réponse » d'un sous-agent, « Son travail », compte rendu de fille,
   détail de la puce de consommation, liste épinglée, section de réglages, infobulle au survol.
   Nom : `<acte>.<scène>-<quoi>-replie.png` / `-deplie.png`.
2. **Chaque carte nouvelle** est capturée une fois en direct, une fois **au rejeu** (après
   « Quitter et relancer », scène 2.7), une fois en **sombre** et une fois en **anglais** (fin
   de campagne) ; les quatre sont comparées.
3. **Zoom** (`app_zoom`) sur toute zone de moins de 300 px où un texte est tronqué, un chiffre
   affiché, une pastille colorée.
4. Un défaut n'est noté qu'après **une reproduction** (recette du 19 octobre : 4 fausses alertes
   sur 12 venaient du pilote) ; la reproduction est décrite dans le PV.
5. **Objectivité** : le PV sépare ce qui est observé (capture, journal, chiffre) de ce qui est
   jugé (clair, pratique). Un bug de l'agent (GPT se trompe) n'est pas un bug de Bobine ; la
   façon dont Bobine le montre peut en être un. Le même scénario est joué avec les deux agents
   pour que la comparaison tienne.
6. Le pilote **relit le journal** (`agents.log` au niveau Trace) après chaque scène douteuse,
   et note les `WARN` / `ERROR` de `main.log` en fin d'acte.

## 4. Ce que le pilote regarde à chaque carte du fil

À chaque apparition d'une carte, six points (✓ / ✗ / ~ et une ligne), en direct puis au rejeu :

1. **Titre lisible** : « Lecture de src/books.js », « Recherche « TODO » », chemin relatif
   (fiche 107) ; jamais d'identifiant brut ni de JSON.
2. **État** : en cours (chronomètre, spinner), fini, échoué, refusé ; cohérent avec l'agent.
3. **Dépliage** : replié, on sait ce que c'est ; déplié, c'est formaté (diff coloré, sortie de
   commande, image, planche contact).
4. **Regroupement** : « 9 lectures, 4 recherches et 1 commande » (047) ; un outil de Bobine a
   sa carte nommée ; un outil appelé par `execute` (OpenCode 2, 079) est rattaché à sa carte.
5. **Durée et coût** quand ils existent (sous-agents, filles), cohérents avec `bob.db` ou la
   puce de consommation.
6. **Rejeu** : même carte, même nom, même contenu (défaut 4 du 20 octobre).

| Carte | Fiches | Scènes |
|---|---|---|
| Outil de l'agent : lecture, recherche, commande (sortie), modification avec diff et « Annuler » | 006, 018, 021, 107 | toutes |
| Outils regroupés | 047 | 1.2, 2.2 |
| Autorisation (écrire, commande, outil de Bobine, site extérieur, popup) ; « Toujours dans ce projet » | 006, 042, 072 | 1.3, 1.5, Bob partout |
| Question : `ask_user` (Bob) / `question` → formulaire (OpenCode) | 016, 028 | 1.4, 2.3 |
| Plan : document dans le fil, remarque, version 2, « Voir ce qui a changé », « Exécuter », zone de saisie couleur Plan, pastille et rappel | 040, 098 | 2.1, 2.2 |
| Liste de tâches : panneau « Tâches », liste épinglée, repli sur une ligne, progression dans l'en-tête | 035, 077 | 2.2 (Bob) ; OpenCode : constater l'absence |
| Sous-agents : carte, une ligne par sous-agent (état, type, consigne, durée, coût), « Réponse », « Voir son travail » | 010, 053, 117 | 2.5 |
| Tâches proposées : groupées par tour, « Faire ici », agent et modèle au choix | 112, 118 | 3.1 |
| Sous-tâches : lignes des filles, pastille de coût, compte rendu dans la mère (coût, échanges), « Fusionner les N », « Puis nettoyer », « Arrêter » | 097, 117, 120 | 3.2, 3.3 |
| Départ du worktree (branche, commit, date, avertissement) ; en-tête « ↳ depuis « … » » | 110, 117 | 3.1, 3.4 |
| Vue Git : « Committer » (message proposé, défaire), « Ouvrir une PR », « Fusionner dans main », conflits, « Laisser l'agent résoudre », « Nettoyer » | 110 | 1.8, 3.3, 3.4 |
| Remarques sur le diff (le « + » au survol), envoi groupé | 085 | 1.6 |
| Compaction : carte (OpenCode) / texte (Bob) ; compaction subie | 019, 039 | 2.6 |
| Bandeau panne, relance avec contexte ; « l'agent n'a rien envoyé depuis N min » | 041 | 2.7 |
| File d'attente : « Partira à la fin de la réponse », modifier, retirer | 020 | 1.3 |
| Branche de conversation ; fichiers remis en état ; titres dans la liste | 023, 095 | 1.7 |
| « Continuer avec l'autre agent » : destination des données, contexte transmis | 108 | X.1, X.2 |
| Onglets du panneau nommés ; panneau agrandi ; navigateur, terminal, serveurs | 029, 030, 034, 082 | 1.5, 2.8 |
| Page / écran joints, annotation, capture d'écran du Mac | 062, 066, 067 | 1.5, 2.4, 4.3 |
| Tableaux, Mermaid, liens vers fichiers, aperçu `.md`, style des réponses | 052, 063, 070 | 1.1, 2.4 |
| « À traiter », compteur du Dock, bannières groupées, son, rebond | 024, 068, 101, 119 | 3.2 |
| Puce de consommation et détail par échange, quota Bob, poids des outils, familles désactivables | 019, 091, 099, 109, 113 | 0.3, 0.4, Bob partout |
| Chronomètre du tour, liste figée sous le pointeur, branches sous leur original | 095 | toutes |
| Simulateur iOS : onglet, flux, châssis, gestes, zoom, planche contact | 008, 009, 044, 075, 084 | acte 4 |
| Émulateur Android : onglet, cadre (téléphone, tablette, paysage), gestes, zoom, planche contact | 032, 033, 076, 081, 084 | acte 4 |

## 5. Le scénario

Un projet, une histoire : faire évoluer le « Carnet de lecture » sur une demi-journée. Même
scénario pour les deux agents, **OpenCode d'abord**, Bob ensuite (★ = obligatoire avec Bob,
le reste si le budget le permet). Tours indicatifs : ≈ 70 avec OpenCode, ≈ 40 avec Bob.

### Acte 0 — Installation, premier contact, réglages (20 min, 0 bobcoin)

- 0.1 ★ Ouvrir le `.dmg`, glisser dans Applications (quarantaine : ce que dit macOS, fiche 058),
  premier lancement : dialogue du dossier, choix de l'agent, « Faire confiance » (Bob), choix
  du modèle (OpenCode : menu avec recherche, 092) ; fenêtre retrouvée à la relance (093).
- 0.2 ★ Réglages, **toutes les sections** une à une, capture de chacune : Général (langue,
  thème ×4, fenêtre rapide, compteur du Dock, données du navigateur), Conversation (filles
  proposées, conversations gardées actives), Agents et dossiers (« Annoncé par l'agent »,
  « Propre à … », autorisations retenues, worktrees orphelins, fournisseurs OpenCode 104 :
  en ajouter un faux et « Tester »), Serveurs MCP (onglet Bobine, « Tester » un serveur de
  l'agent), Commandes (créer une commande personnelle `/revue-fr`), Raccourcis, Notifications,
  Terminal, Diagnostic (chaque ligne verte ou expliquée), À propos (Nouveautés), fenêtre
  « À propos de Bobine » du menu (116 : « Copier les infos techniques »).
- 0.3 ★ **Recherche dans les réglages** (051) : « son », « dock », « raccourci », avec et sans
  accent ; un résultat ouvre la section et met le réglage en évidence.
- 0.4 ★ Désactiver les familles iOS et Android pour ce projet (109) ; relever le poids des
  outils avant / après dans « bobine · intégré » ; les réactiver à l'acte 4.
- 0.5 Fenêtre rapide ⌥⌘B depuis le Finder (062) : une question, capture d'écran du Mac
  (autorisation « Enregistrement de l'écran » : ce que fait l'app si elle manque).

### Acte 1 — Prise en main et premières corrections (≈ 18 tours)

- 1.1 ★ « Explique ce projet » (suggestion de l'accueil) : tableau, liens vers fichiers, aperçu
  `.md` du README dans le panneau, ouverture dans l'app par défaut, « Montrer dans le Finder ».
- 1.2 ★ « Corrige les deux bugs listés dans le README » avec `@src/books.js` : cartes de
  modification, diffs, regroupement ; `npm test` lancé par l'agent (sortie de commande).
- 1.3 ★ Pendant la réponse, un second message (file d'attente : le modifier, puis l'envoyer) ;
  une autorisation « une fois » puis « Toujours dans ce projet » ; Réglages › Agents : la
  retrouver et la révoquer ; refuser une autorisation et voir ce que l'agent en fait.
- 1.4 ★ « Avant de refactorer le tri, demande-moi quel comportement je veux pour les livres
  sans année » (Bob : `ask_user` ; OpenCode : `question`) ; répondre « Autre » en texte libre.
- 1.5 ★ « Lance l'app et vérifie la page » : autorisation « Lancer l'app », `.bob/launch.json`
  proposé, navigateur piloté par l'agent (console, réseau, redimensionnement mobile, sombre,
  onglets), onglet nommé du panneau, panneau agrandi (saisie d'adresse à la souris), « Joindre
  cette page », annotation (cadre + texte long), envoi ; essai manuel de la page (recherche,
  tri, « Exporter en CSV » → téléchargement par « Enregistrer sous », 094 ; `prompt()` de
  « Noter », popup) ; `@terminal` après un `git log` dans le terminal intégré ; sélection du
  terminal → « Ajouter au message ».
- 1.6 ★ Modifications › Conversation : deux remarques ligne par ligne, envoi groupé ; l'agent
  corrige ; « Annuler » une modification ; vue Git : `@git-changes`.
- 1.7 ★ Échap pendant une réponse ; modifier un message plus haut et repartir (branche) ;
  fichiers remis en état ; les deux conversations dans la liste (titre, imbrication) ; revenir
  à l'original.
- 1.8 ★ Vue Git : « Committer » avec le message proposé, le modifier, « Défaire », recommitter.
- 1.9 `/review` sur les modifications en cours ; `/init` (regarder ce qu'il propose, refuser).

### Acte 2 — Une évolution longue en mode Plan (≈ 22 tours)

- 2.1 ★ Maj+Tab → mode Plan (zone de saisie colorée, pastille, rappel) : « Ajoute la page de
  statistiques du README (point 3) » ; plan dans le fil ; remarque sur un passage ; version 2 ;
  « Voir ce qui a changé » ; seconde remarque ; version 3.
- 2.2 ★ « Exécuter le plan » : retour en Build ; liste de tâches (Bob : panneau « Tâches »,
  liste épinglée, repli, progression dans l'en-tête ; OpenCode : constater) ; pendant
  l'exécution : ⌘F dans le fil (« stats », 1/N, suivant), ⌘K, renommer la conversation,
  ouvrir une autre conversation et revenir (pastille d'activité, non lu).
- 2.3 Une question de l'agent en cours de route (sinon la provoquer).
- 2.4 ★ « Dessine en Mermaid l'architecture de l'app » ; capture d'écran du Mac depuis la zone
  de saisie, annotée, envoyée ; glisser-déposer d'une image depuis le Finder ; coller une
  image ; `@` un fichier.
- 2.5 ★ « Lance un sous-agent pour auditer la sécurité de server.js pendant que tu continues » :
  carte « Sous-agents », coût en direct (Bob), « Réponse », « Voir son travail » (OpenCode) ;
  puis deux sous-agents dans le même tour (ligne chacun, total).
- 2.6 ★ Continuer (points 4 et 5 du README) jusqu'à la **compaction subie** ; `/context` et
  `/cost` avant et après ; puis `/compact` (OpenCode) ou `/compress` (Bob) ; vérifier que
  l'agent se souvient du plan ; détail de la puce de consommation (par échange).
- 2.7 ★ `kill -9` de l'agent au milieu d'un tour : bandeau, relance au message suivant ;
  mettre le Mac en veille 2 min pendant un tour (103) ; « Quitter et relancer » Bobine ;
  **comparer le fil rejoué aux captures prises en direct**, carte par carte.
- 2.8 ★ `/` : la liste (origines), `/clear`, la commande personnelle `/revue-fr` (0.2), une
  commande du projet (`.bob/commands/` ou `.opencode/commands/` créée par l'agent), `/split`
  (préparé pour 3.1) ; mentions `@git-changes` et `@terminal`.
- 2.9 Règles actives (056) : curseurs de la zone de saisie › « Règles actives », ouvrir
  `AGENTS.md` en aperçu ; demander à l'agent de créer `AGENTS.md`, revoir la liste.

### Acte 3 — Parallèle : filles, worktrees, fusion (≈ 18 tours)

- 3.1 ★ Un message avec trois chantiers indépendants (points 5, 6, 7 du README) : l'agent
  propose-t-il des filles de lui-même (118) ? Sinon `/split`. Carte « Tâches proposées » : une
  fille avec l'autre agent, une avec un autre modèle (OpenCode), une « Faire ici » ; carte de
  départ du worktree dans chaque fille ; en-tête « ↳ depuis ».
- 3.2 ★ Pendant que les filles travaillent : « À traiter » (ordre, raison, temps écoulé),
  compteur du Dock, bannières groupées, son, rebond ; ouvrir une fille, répondre à une
  autorisation ; comptes rendus dans la mère (coût, échanges) ; pastilles de coût sur
  « Sous-tâches ».
- 3.3 ★ Provoquer un conflit (la mère modifie `README.md` qu'une fille touche aussi) ;
  « Fusionner les N dans main » depuis « Sous-tâches » : état ligne par ligne, « Arrêter »
  puis reprendre, conflit résolu par la fille, « Puis nettoyer » ; Réglages › Agents : plus
  de worktree orphelin.
- 3.4 ★ Une conversation en worktree créée à la main (menu du dossier) ; « Ouvrir une PR » (si
  `gh` connecté : regarder, **ne pas** la créer sur un dépôt public ; sinon la raison affichée) ;
  « Fusionner dans main » avec « Laisser l'agent résoudre » ; « Nettoyer » ; un worktree
  orphelin fabriqué au terminal, nettoyé depuis Réglages.
- 3.5 Reprendre une session commencée ailleurs (`bob chat` / `opencode` au terminal, un
  échange) dans « Reprendre une session… » (055) ; sessions vides masquées (OpenCode).
- 3.6 Réglages › Conversation › conversations gardées actives à 2 : ouvrir 4 conversations,
  constater l'éviction et la reprise (102).

### Acte 4 — Mobile : simulateur iOS et émulateur Android (≈ 14 tours)

Familles iOS et Android réactivées (0.4). Point 8 du README : « l'app mobile lit la même API ».

- 4.1 ★ « Compile l'app mobile pour le simulateur iOS et lance-la » : `ios_build` (schéma
  `Runner`, erreurs lisibles, compilation en tâche de fond : que montre la carte pendant les
  2 min ?), `ios_boot`, `ios_launch` ; onglet « iOS » : flux vidéo (images par seconde
  affichées), **châssis** ; captures de la carte repliée et dépliée.
- 4.2 ★ « Fais lire la liste des livres depuis http://localhost:3000/api/books » : l'agent
  modifie `lib/main.dart`, recompile, relance ; `ios_describe` / `ios_tap` sur la liste ; essai
  **à la souris** dans le panneau : toucher, glisser (balayage), appui long ; zoom (dézoomer,
  ajuster, taille réelle, zoomer, défilement de l'appareil zoomé) ; panneau agrandi.
- 4.3 ★ « Planche contact d'un défilement de la liste » (`ios_filmstrip`) : grille dans la
  carte ; « Joindre l'écran » → annotation → envoi ; `ios_screenshot` comparé au flux.
- 4.4 ★ Android : « Démarre l'émulateur et lance l'app » : `android_build` (Gradle, APK trouvé
  ou pas : noter), `android_launch` avec `apk_path` si besoin ; onglet « Android » : cadre
  téléphone, flux, toucher et balayage à la souris, zoom ; `android_filmstrip` ; **rotation
  paysage** depuis l'émulateur (le cadre tourne, 081) ; AVD tablette si disponible.
- 4.5 « Joindre l'écran » Android annoté ; erreurs lisibles : demander l'app sur un appareil
  éteint, sur un schéma inexistant ; que dit la carte, que dit l'agent.
- 4.6 Avec Bob, si le budget le permet : 4.1 et 4.3 seulement (autorisations de compilation
  « Compiler » / « Toujours »).

### Acte croisé — Bob ↔ OpenCode (≈ 6 tours, 1 à 2 bobcoins)

- X.1 ★ Depuis la conversation de l'acte 2 (OpenCode) : « Continuer avec Bob… » ; destination
  affichée ; Bob reprend (« résume ce qui a été fait et ce qui reste ») ; la fille apparaît
  sous l'originale avec l'agent indiqué.
- X.2 ★ L'inverse depuis une conversation Bob : « Continuer avec OpenCode… », choix du modèle
  (récents et fournisseurs en avant), destination : fournisseur ou préfixe du modèle.
- X.3 Une fille Bob lancée depuis une mère OpenCode (3.1), et l'inverse.

### Acte 5 — Historique, recherche, rangement (15 min, 0 bobcoin)

- 5.1 ★ ⌘K : recherche dans les titres, puis **dans le contenu** (un mot d'une vieille
  conversation, avec accent et sans) ; résultat ouvert au bon endroit ; recherche dans la
  conversation ouverte.
- 5.2 ★ Barre latérale : regroupement par dossier, épingler, renommer, brouillon conservé en
  changeant de conversation, menu « … » (exporter en JSON : regarder le fichier ; supprimer avec
  confirmation ; suppression côté agent), **archiver** si l'action existe (sinon : manque),
  conversations filles sous leur mère, largeur de la barre à la souris (113).
- 5.3 Historique après relance : titres, ordre, pastilles non lu, « À traiter » vidé quand on a
  lu.

### Fin — langue, thèmes, export (15 min)

- F.1 ★ Interface en anglais : rejouer 1.1, une autorisation, une question, la carte
  « Sous-tâches » ; relever les textes venus de l'agent ou d'Electron (074).
- F.2 ★ Thème sombre, sépia, nuit noire : captures des cartes clés (plan, sous-agents,
  sous-tâches, diff avec remarques, simulateur).
- F.3 « Signaler un problème » (regarder l'issue préremplie, **ne pas** l'envoyer) ; « Copier
  les infos techniques » ; `/cost` final ; coûts relus dans `bob.db`.

## 6. Couverture : chaque fiche « fait » et la scène qui la joue

Les fiches internes (outillage, refactorisations, e2e, packaging) ne s'observent pas en
utilisant l'app ; elles sont listées pour que rien ne manque sans raison.

| Fiches | Scènes | Remarque |
|---|---|---|
| 003 fil en streaming · 047 outils regroupés · 070 style · 107 cartes lisibles | toutes | grille § 4 |
| 004 profils et dossier · 093 démarrage · 058 installation · 073 nouveautés, .dmg | 0.1, 0.2 | |
| 005 images et fichiers (coller, glisser, `@`) · 067 annotation · 094 téléchargements | 1.5, 2.4 | |
| 006 permissions et diffs · 042 retenues · 072 sites, commandes, popups, données du navigateur | 1.3, 1.5, 0.2 | |
| 007 navigateur · 030 lancer l'app · 031 débogage web · 064 aperçu HTML | 1.5 | aperçu HTML : demander « montre-moi stats.html en aperçu » en 2.2 |
| 008, 009, 044, 075, 084 simulateur iOS | 4.1 à 4.3 | |
| 032, 033, 076, 081, 084 émulateur Android | 4.4, 4.5 | |
| 010, 053, 117 sous-agents | 2.5 | |
| 011 spécificités Bob (confiance, SSO, élicitation) · 022 authentification · 100 trousseau | 0.1 (Bob) | SSO déjà fait : noter seulement ce que l'app montre |
| 013 modes et options · 090 puce du modèle · 092 zone de saisie · 098 mode Plan visible | 0.1, 2.1 | défaut 1 du 20 octobre : texte tapé après un choix de mode |
| 015 historique · 026 avancé · 046 recherche · 086 ⌘F · 095 liste et fil · 113 barre réglable | 2.2, 5.1 à 5.3 | |
| 016 questions · 028 `ask_user` | 1.4, 2.3 | |
| 017 commandes de l'agent · 039 de l'app · 045 personnelles et du projet | 0.2, 2.8 | |
| 018 sortie des commandes · 034 terminal · 057 mentions | 1.2, 1.5, 2.8 | |
| 019 consommation · 091 quota Bob · 099 outils visibles · 109 coût · 113 | 0.4, 2.6, Bob | |
| 020 file de messages | 1.3 | |
| 021 récapitulatif · 085 remarques sur le diff · 049 branche dans la saisie | 1.6, 1.8 | |
| 023 modifier et relancer | 1.7 | |
| 024 notifications · 068 son · 101 rebond · 119 « À traiter » | 3.2 | notifications : limite macOS sans certificat, à constater |
| 025 serveurs MCP · 060 « Tester » · 104 fournisseurs OpenCode · 056 règles actives | 0.2, 2.9 | |
| 027 réglages et raccourcis · 051 recherche dans les réglages · 074 anglais · 102 actives | 0.2, 0.3, 3.6, F.1 | |
| 029 socle des outils · 082 panneau agrandi, onglets | 1.5, 4.2 | |
| 035 tâches · 077 épinglée | 2.2 | Bob seulement |
| 036 parallèle et worktrees · 110 cycle complet · 096 branche `bobine/…` | 3.4 | |
| 040 plan annoté | 2.1 | |
| 041 stabilisation · 103 fil durable · 080 journal | 2.7 | |
| 052 liens vers fichiers · 063 Mermaid | 1.1, 2.4 | |
| 054 capacités par agent · 061 diagnostic · 116 « À propos » | 0.2 | |
| 055 reprendre ailleurs | 3.5 | |
| 062 fenêtre rapide · 066 joindre page / écran | 0.5, 1.5, 4.3 | |
| 097, 112, 118, 120 filles · 108 continuer avec l'autre agent | 3.1 à 3.3, X.1 à X.3 | |
| 069 nom et icône · 014, 050 finitions · 071, 114 durcissement | transversal | icône dans le Dock et le `.dmg` ; durcissement : 114 par un lien vers un fichier caché (`.env`) dans le fil |
| 001, 002, 012, 041 (interne), 043, 048, 059, 065, 078, 079, 087, 088, 089, 105, 106, 111, 115 | — | outillage, sondes, refactorisations, CI : non observables en usage |
| 038 (à faire), 083 (reporté) | — | hors périmètre |

## 7. Le PV de recette (modèle)

Un fichier par agent : `docs/recettes/2026-10-2x-recette-<agent>.md`, écrit scène par scène.

```markdown
# PV de recette — <agent> <version> — <date>

## En bref
- cas joués / verts / avec réserve / rouges / non joués ; tours ; durée ; coût
- les 3 défauts les plus gênants, une ligne chacun
- score d'utilisabilité : NN / 100 (§ 7.2), avec les 3 familles les plus faibles

## Environnement
(Mac, Bobine : version et commit, agent, modèle, projet et commit de départ, isolement)

## Cas
| # | Scène | Fiches | Attendu | Observé | Verdict | Coût | Captures |
| 1.1 | Explique ce projet | 052, 070 | tableau, liens cliquables, aperçu .md | … | ✓ / ~ / ✗ / — | 0,12 | 1.1-… |

Verdict : ✓ conforme · ~ conforme avec réserve (dite) · ✗ non conforme · — non joué (pourquoi).

## Cartes du fil (grille § 4)
| Carte | Titre | État | Dépliage | Regroupement | Durée / coût | Rejeu | Sombre | Anglais | Note |

## Défauts
Numérotés, par gêne : **bloquant** (impossible de continuer sans contournement), **majeur**
(fonction inutilisable ou trompeuse), **mineur** (gêne, contournement évident), **cosmétique**.
Pour chacun : reproduction, captures, extrait de journal, piste (fichier, ligne) si vue.

## Pas pratique (sans être faux)
## Manques
## Ce qui marche bien (à ne pas casser)
## Comparaison avec l'autre agent (second PV)
## Journal : WARN / ERROR relevés
## Fichiers
```

### 7.2 Score d'utilisabilité

Seize familles : prise en main et réglages · fil et cartes · autorisations · questions · plan ·
tâches · sous-agents · filles et fusion · git et worktrees · navigateur et lancement · terminal
et mentions · simulateur iOS · émulateur Android · coût et quota · reprise, pannes et rejeu ·
historique et recherche. Trois notes de 0 à 3 par famille :

| Critère | 0 | 3 |
|---|---|---|
| **Ça marche** | ne fait pas ce qui est annoncé | fait exactement ce qui est annoncé, en direct et au rejeu |
| **C'est clair** | il faut deviner ce qui se passe | on comprend sans la doc ce qui se passe et ce qu'on peut faire |
| **C'est pratique** | plus lent ou plus pénible qu'au terminal | on ne voudrait plus faire autrement |

Score = somme / (16 × 9) × 100. Un **bloquant** plafonne sa famille à 3 / 9, un **majeur** à
6 / 9. Donné par agent, puis moyenne ; les trois familles les plus faibles font la feuille de
route de la release.

### 7.3 Décision de release

Proposition : **release candidate si aucun bloquant, au plus 3 majeurs ouverts, score ≥ 70 avec
Bob**. Sinon : une fiche par défaut majeur, puis on rejoue les scènes concernées, pas la campagne.

## 8. Comment Claude déroule la campagne

- **Une session Claude Code par acte** (actes 0 + 1 ensemble), dans ce dépôt, le PV comme
  mémoire de travail : la ligne du PV est écrite **avant** de passer à la scène suivante ; une
  session qui dépasse 2 h clôt son acte, la suivante reprend à la scène notée.
- Le pilote joue **l'utilisateur**, pas l'agent : consignes de développeur, courtes, parfois
  ambiguës ; il accepte ou refuse comme le ferait Jérôme ; il lit la réponse et réagit à ce
  qu'il voit.
- Ce que le pilote ne fait pas seul : dépasser le plafond de bobcoins ; créer la PR, envoyer le
  signalement GitHub ; écrire dans `~/.bob` ; cliquer dans le Terminal (`kill -9` passe par
  Bash) ; toucher aux réglages système (hors lecture).
- À la fin : synthèse des deux PV (score, top 10 des défauts, recommandations pour la release),
  puis Jérôme relit et décide des fiches à ouvrir.

## 9. Préparation (état au 2026-10-22, soir)

- [x] Bobine 0.4.0 packagée depuis `main` (`dist/mac-arm64/Bobine.app`, `dist/Bobine-0.4.0-arm64.dmg`).
- [x] Projet `~/Development/bobine-recette/carnet-de-lecture` (web, tests verts, 1 commit).
- [x] `mobile/` Flutter créé et précompilé (`Runner.app` simulateur, `app-debug.apk`), commité (`c3da3e9`).
- [x] `pnpm e2e:packaged` vert sur cette app (Bob et OpenCode trouvés, terminal, AXe 1.8.0).
- [x] Script `e2e/captures/recette-2026-10/pilote/lancer.sh` (dossier de données
  `~/Library/Application Support/Bobine-recette-2026-10`, trousseau factice, journal Trace, CDP 9333).
- [x] Passage OpenCode joué en entier le 2026-10-22/23 (21:32 → 00:18, une seule session, actes
  enchaînés) : PV `2026-10-23-recette-opencode.md`, 45 cas, score 74 / 100, 0 bloquant, 2 majeurs ;
  1,34 bobcoin dépensé (fille Bob, « Continuer avec Bob », `/split`).
- [x] AVD `Medium_Phone_API_36.0` agrandi à 16 Go (Jérôme, 2026-10-23) ; scène 4.4 rejouée avec Bob (0,62 bobcoin, PV Bob).
- [x] Passage Bob joué le 2026-10-23 (09:36 → 10:56, une session) : PV `2026-10-23-recette-bob.md`, 38 lignes, score 74 / 100, 0 bloquant, 1 majeur nouveau (D21) ; 10,60 bobcoins (campagne : 11,94). Acte 4 joué avec Bob (4.1 à 4.4).
- [x] Synthèse de campagne : `2026-10-23-synthese-campagne.md` (release candidate sous réserve de D21).
