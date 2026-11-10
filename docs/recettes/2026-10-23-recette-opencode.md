# PV de recette — OpenCode 2.0.32 + GPT-6.1 Sol — 2026-10-22/23

Protocole : [plan de campagne](2026-10-22-plan-campagne-recette.md). Pilote : Claude (Opus 5.5),
computer-use (vraie souris, vrai clavier), Bobine en plein écran. Captures :
`e2e/captures/recette-2026-10/opencode/`.

## En bref

**Campagne OpenCode jouée en entier le 2026-10-22/23, 21:32 → 00:18 (≈ 2 h 45 de pilotage) :
actes 0 à 5, acte croisé et fin. PV clos.** Reste pour la campagne : rejouer 4.4 une fois l'AVD
agrandi, et le PV Bob (second passage, autre session).

- **Cas** : 45 — **19 verts** (0.3, 0.4, 1.1, 1.4, 1.6, 1.7, 2.3, 2.9, 3.0, 3.5, 3.6, 4.0, 4.3,
  X.2, X.3, 5.1, 5.3, F.1, F.2), **22 avec réserve** (0.1, 0.2, 0.5, 1.2, 1.3, 1.5, 2.1, 2.2, 2.4,
  2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.5, X.1, 5.2, F.3), **3 rouges** (1.9 : commandes
  d'OpenCode muettes, faute de l'agent ; 2.5 : sous-agents « finis » qui tournent, D12 ; 4.4 :
  app non installée sur Android, AVD plein — dispositif), **1 renvoyé** (1.8, joué en 3.4).
  **Non jouables** dans ce dispositif, dits dans leur ligne : compaction subie (2.6), veille du Mac
  (2.7), bannières et son (3.2), app Android (4.4), issue GitHub préremplie (F.3, accès au
  navigateur refusé), vérification du fichier exporté (5.2, feuille d'enregistrement non pilotable).
- **Tours** : 73 (actes 0-1 : 23 ; 2 : 21 ; 3 : 13 ; 4 : 10 ; croisé, 5 et fin : 6 dont 3 de
  Bob), plus 4 tours de filles. **Jetons OpenCode** (somme des `usage`) : 378 751 en entrée,
  53 885 en sortie, 13 800 064 lus en cache, 14 237 796 au total ; 0,00 $ (abonnement ChatGPT).
  **Bob : 1,3442 bobcoin** sur 3 tâches (fille 7 : 1,0253 ; « Continuer avec Bob » : 0,0788 ;
  `/split` : 0,2400), relus dans une copie de `~/.bob/db/bob.db`, sous le plafond (≈ 4).
- **Défauts** : **0 bloquant, 2 majeurs, 16 mineurs, 11 cosmétiques**. Les 3 plus gênants :
  1. **D12** (majeur) — sous-agents d'OpenCode en arrière-plan affichés « fini, < 1 s », sans
     leur résultat.
  2. **D17 + D5** — un outil de Bobine qui échoue ou est refusé garde une coche verte, et
     l'erreur est parfois coupée (Android surtout).
  3. **D14 + D15** — cycle des worktrees : brouillon dans un worktree supprimé après
     « Nettoyer » ; changer d'agent sur une conversation en worktree vide supprime le worktree.
  Puis D3 (majeur : capture d'écran muette sans l'autorisation macOS), D10 / D13 (boutons qui
  glissent sous le pointeur), D11 (liens `http://localhost` morts), D8 (onglet fermé au lieu
  d'affiché).
- **Score d'utilisabilité (§ 7.2) : 74 / 100** (106 / 144). Familles les plus faibles :
  **sous-agents (4/9)**, **émulateur Android (4/9)**, **git et worktrees (5/9)**. Détail plus bas.
- **Décision de release (§ 7.3)** côté OpenCode : aucun bloquant, 2 majeurs (≤ 3), score ≥ 70 —
  les critères seraient tenus ; la règle porte sur le score **avec Bob** : à trancher après le PV
  Bob.
- **Journaux** : 10 `WARN` sur toute la session (1 provoqué en 2.7, 9 liés à D14 / D15 en 3.4),
  **0 `ERROR`**.

**État laissé** : Bobine quittée, en français, thème Système ; dossier de données gardé ; familles
iOS et Android allumées ; simulateur iPhone Air démarré (app Carnet installée) ; émulateur arrêté,
**AVD plein** (268 Mo libres) ; projet sur `main` à `af45e0f`, deux fichiers mobiles non commités
(notes en étoiles), 40 tests web verts ; `/Applications/Bobine.app` installée en 0.1 ; un
« README » importé dans calibre en 1.1 (à retirer à la main si besoin).

## Environnement

| | |
|---|---|
| Mac | macOS 27.0 (26A428), écran Retina 3024 × 1964 (1372 × 891 points vus par le pilote) |
| Bobine | 0.4.0 packagée (signature ad hoc), `main` à `d936609`, Electron 44.7.2 ; installée par le `.dmg` dans `/Applications/Bobine.app` (scène 0.1), lancée par `e2e/captures/recette-2026-10/pilote/lancer.sh` avec `BOBINE_PACKAGED_APP=/Applications/Bobine.app` |
| Isolement | `--user-data-dir=~/Library/Application Support/Bobine-recette-2026-10`, `--use-mock-keychain`, `BOBINE_LOG=trace`, `BOBINE_DEFAULT_WORKSPACE=` (vide, voir Journal 21:35), CDP 9333 (diagnostic seulement) |
| Agent | OpenCode 2.0.32, modèle `openai/gpt-6.1-sol` (abonnement ChatGPT) |
| Projet | `~/Development/bobine-recette/carnet-de-lecture`, départ au commit `c3da3e9` ; Node 26.11.1 |

## Cas

Verdict : ✓ conforme · ~ conforme avec réserve (dite) · ✗ non conforme · — non joué (pourquoi).

| # | Scène | Fiches | Attendu | Observé | Verdict | Coût | Captures |
|---|---|---|---|---|---|---|---|
| 0.1 | Installation, premier lancement, agent, modèle, relance | 058, 069, 073, 004, 093, 092 | `.dmg` clair, quarantaine expliquée ; dossier demandé ; choix de l'agent ; « Faire confiance » (Bob) ; modèle par menu avec recherche ; fenêtre retrouvée | `.dmg` soigné et bilingue (glisser sur Applications, « pas les droits d'administrateur ? double-cliquez ») ; glisser à la souris → copie dans `/Applications` ✓. **Quarantaine non observable** : `.dmg` construit sur ce Mac, sans `com.apple.quarantine`. Premier lancement : carte « Choisissez le dossier de votre projet », saisie « Choisissez d'abord un dossier », agent par défaut IBM Bob. Panneau de choix natif **en anglais** (« Search », « New Folder », « Cancel » ; seul « Choisir » en français) : langue native non réglée quand le dossier de données est imposé (fiche 074), donc propre au dispositif. Dossier choisi → Bob démarre aussitôt (session créée, 0 bobcoin) ; « Faire confiance » **non observable** (dossier déjà approuvé par Bob à la préparation). Menu de l'agent : « IBM Bob / OpenCode » ; OpenCode prêt en ≈ 5 s, modèle par défaut « Flint 40B Free ». Menu du modèle : recherche « sol » → 6 modèles, fournisseur à droite ; GPT-6.1 Sol choisi. Relance (⌘Q puis lanceur) : plein écran, dossier, agent et modèle retrouvés ✓ | ~ (2 points non observables, dits) | 0 | 0.1-dmg-fenetre, 0.1-premier-lancement, 0.1-dossier-panneau, 0.1-dossier-choisi-bob, 0.1-agent-menu, 0.1-opencode-pret, 0.1-modele-menu, 0.1-modele-recherche, 0.1-modele-choisi, 0.1-relance-retrouvee |
| 0.2 | Réglages, toutes les sections ; « À propos de Bobine » | 027, 025, 060, 104, 042, 045, 054, 061, 073, 116 | chaque section lisible ; fournisseur faux ajouté et « Tester » ; serveur MCP « Tester » ; `/revue-fr` créée ; diagnostic vert ou expliqué ; « Copier les infos techniques » | 9 sections (Général, Conversation, Terminal, Agents et dossiers, Serveurs MCP, Commandes, Raccourcis clavier, Diagnostic, À propos ; les notifications, le Dock et le son sont dans Général). **Général** : 5 thèmes (Système, Clair, Sombre, Sépia, Nuit noire) appliqués à l'instant ✓ ; Langue (Système / Français / English), fenêtre rapide (Désactivé, ⌥⌘B, ⌥Espace, ⇧⌥Espace). **Conversation** : aperçu vivant de la police (à empattements ✓). **Agents et dossiers** : OpenCode déplié = 6 capacités annoncées + 10 « Propre à OpenCode » ; faux fournisseur `fauxllm` (http://127.0.0.1:9/v1) écrit dans `~/.config/opencode/opencode.jsonc` (clé en `{env:FAUXLLM_API_KEY}`), « Tester » → « Connexion refusée : connect ECONNREFUSED 127.0.0.1:9 » + conseil clair ✓ ; suppression en deux clics (défaut 1) ; autorisations retenues : « Aucun » partout ; dossiers récents ; worktrees orphelins « Aucun ». **Serveurs MCP** : onglets Bobine 57 / IBM Bob 0 / OpenCode 0 ; poids ≈ 5 887 jetons ; familles avec outils au dépliage ; serveur `essai-recette` (commande inexistante, « ce dossier ») → « Commande introuvable : mcp-introuvable. Est-elle installée et dans le PATH ? » ✓ ; le supprimer laisse `opencode.json` vide dans le projet (défaut 2). **Commandes** : `/revue-fr` créée (nom, description, argument, consigne) ✓. **Raccourcis** : 23 lignes, lecture seule. **Diagnostic** : « 1 point à regarder » = Enregistrement de l'écran refusé, avec chemin des Réglages Système et commande `open` à copier ✓ ; Bob, OpenCode (27 modèles), Xcode 26.6, 1 simulateur, AXe 1.8.0, SDK Android verts. **À propos** : 0.4.0, Nouveautés avec « Prochaine version » en tête (build de `main` avant le tag : normal, à vérifier au tag). Menu Bobine › « À propos de Bobine » : fenêtre sobre, « Copier les infos techniques » → « ✓ Copié », presse-papiers = version, commit `d936609`, Electron, Chromium, Node, macOS, langue, 2 agents ✓ ; « Nouveautés » ouvre Réglages › À propos ✓. Son : non vérifiable par le pilote (audio) | ~ (défauts 1, 2) | 0 | 0.2-* (50 captures) |
| 0.3 | Recherche dans les réglages | 051 | « son », « dock », « raccourci », avec et sans accent ; un résultat ouvre la section et met le réglage en évidence | « son » → Son quand un agent attend, Notifications, Commandes (« personnelle ») ; « dock » → 3 réglages ; « raccourci » → la section + Fenêtre rapide + chaque raccourci ; « theme » = « thème » ; « ecran » trouve « écran » (mise en veille, fenêtre rapide, largeur du fil) ; « zzzz » → « Aucun réglage ne correspond à « zzzz ». ». Clic sur un résultat : bonne section, réglage sur fond teinté ≈ 3 s puis normal ✓ (vu pour Son dans Général, Proxy dans Agents) ; le champ de recherche se vide | ✓ | 0 | 0.3-* (11) |
| 0.4 | Couper les familles iOS et Android ; poids des outils avant / après | 099, 109, 113 | interrupteurs par famille ; poids relevé dans « bobine · intégré » avant / après | Réglages › Serveurs MCP : interrupteurs Simulateur iOS (12 outils, ≈ 1 106 jetons) et Émulateur Android (13, ≈ 1 113) coupés → étiquette « Coupée », en-tête « au plus ≈ 3 668 jetons pour les familles activées (≈ 5 887 pour toutes) » et avis « S'applique aux prochaines sessions… redémarrage de leur agent (menu ⚙ de la conversation) ». Zone de saisie › curseurs › « bobine · intégré » : **avant** 56 outils ≈ 5 732 jetons, ligne « Au prochain démarrage de l'agent : 31 outils — Redémarrer l'agent pour les appliquer » ; clic → agent relancé → **après** 31 outils ≈ 3 513 jetons ✓ (journal : `tools/list` 56 puis 31). « Voir les outils » ouvre Réglages › Serveurs MCP. Écart au plan : le réglage est **global** (pas « pour ce projet ») ; 57 outils dans les Réglages pour 56 reçus par la conversation, sans explication à l'écran | ✓ | 0 | 0.4-* (7) |
| 0.5 | Fenêtre rapide ⌥⌘B depuis le Finder ; capture d'écran du Mac sans l'autorisation | 062, 066 | petite fenêtre par-dessus le Finder ; question → nouvelle conversation ; capture : ce que fait l'app quand l'autorisation manque | ⌥⌘B depuis le Finder : barre flottante « Demander à OpenCode… », pied « Nouvelle conversation · OpenCode · carnet-de-lecture », bouton appareil photo ✓. Appareil photo → la barre se masque, `screencapture -i` (sélection à la souris, rectangle visible) ; au relâché la barre revient **sans rien de joint, sans un mot**, rien au journal (2 reproductions) alors que Réglages › Diagnostic sait l'autorisation refusée (défaut 3). Question « Quelle version de Node ce projet demande-t-il ? » + Entrée → conversation créée dans la fenêtre principale (titre = la question), réponse en ≈ 15 s : carte « 2 recherches et 1 lecture », puis « Node.js 22, d'après le README.md (ligne 4) » ✓. Puce de consommation : contexte 6 369 / 1 050 000 (1 %), 23 916 jetons (entrée 8 374, sortie 182, cache 15 360), 0,00 $US, détail par échange (21:47) ✓ | ~ (défaut 3) | 1 tour, 23 916 jetons | 0.5-* (14) |
| 1.1 | « Explique ce projet » (suggestion de l'accueil) | 052, 070, 003, 047 | tableau, liens vers fichiers, aperçu `.md` du README, ouverture dans l'app par défaut, « Montrer dans le Finder » | La suggestion **remplit** la saisie (« Explique-moi ce projet : à quoi il sert, comment il est organisé et comment le lancer. ») sans l'envoyer — on peut compléter ✓ ; ajouté « Un tableau des fichiers principaux ». En direct : « Lecture de carnet-de-lecture/ » puis « Réfléchit… 5 s », la carte devient « 10 lectures et 2 recherches », texte écrit en flux avec « Écrit… 37 s » ; fin ≈ 50 s : « 10 lectures, 2 recherches et 1 commande » (dont `npm test`, lancé **sans autorisation** : permissions par défaut d'OpenCode), titres, listes, schéma en bloc de code, **tableau** à en-tête ✓, blocs de code avec bouton copier. Les fichiers du tableau sont en `code`, **pas des liens** (GPT n'écrit pas de liens ; seule la syntaxe Markdown est cliquable, fiche 052 → manque). Relance « en liens Markdown cliquables » → 12 liens ✓ ; clic sur README.md → onglet « Aperçu » du panneau, rendu propre (titres, listes, code), en-tête relire / ouvrir avec l'app par défaut (infobulle ✓) / Finder / fermer ✓ ; « Ouvrir avec l'app par défaut » → **calibre** (réglage de ce Mac, qui a importé le README dans sa bibliothèque : effet de bord hors Bobine) ; « Montrer dans le Finder » → dossier ouvert, README.md sélectionné ✓. Carte `npm test` dépliée : dossier, sortie avec ✔ par test ✓ | ✓ | 2 tours | 1.1-* (15) |
| 1.2 | « Corrige les deux bugs listés dans le README » avec `@src/books.js` | 006, 018, 021, 047, 057, 107 | mention de fichier ; cartes de modification avec diff ; regroupement ; `npm test` lancé par l'agent | `@books` → liste « Fichiers · carnet-de-lecture » : books.js (src), books.json, books.test.js en tête, puis du bruit (`AppFrameworkInfo.plist`, `contents.xcworkspacedata`… : correspondance floue lettre à lettre) ; Tab → puce « books.js » au-dessus du message et `@src/books.js` dans le texte ✓. **Envoi alors que le fil était remonté : le fil ne redescend pas** (défaut 4). Réponse en ≈ 30 s : « 2 lectures, 2 commandes et 1 modification » (`git status --short`, « Modification de src/books.js et 1 autre », `npm test`) ; dépliée : sortie brute d'OpenCode (« Success. Updated the following files: M … ») puis un diff par fichier, numéros de ligne avant / après, lignes rouges / vertes, « 12 lignes inchangées » repliées, +5 −3 et +22 −1 ✓ ; en-tête de chaque diff en **chemin absolu** ; lignes longues coupées à droite. Fil : « Corrigé dans src/books.js » avec liens, « npm test : 8 tests réussis ». En-tête de la conversation : « 2 +27 −4 » = `git diff --stat` ✓ ; branche « main • » (modifié). Pas de bouton « Annuler » sur la carte du fil (il est dans Modifications, 1.6) | ~ (défaut 4) | 1 tour | 1.2-* (10) |
| 1.3 | File d'attente ; autorisations « une fois » / « Toujours dans ce projet » ; révocation ; refus | 020, 006, 042 | message en file, le modifier, l'envoyer ; autorisation retenue puis révoquée ; refus | **File** : pendant la réponse, Entrée → bandeau « Partira à la fin de la réponse » au-dessus de la saisie, avec ↵ (« Interrompre et envoyer maintenant »), ✎, × ✓ ; ✎ remet le texte dans la saisie, modifié, Entrée → de nouveau en file ✓ ; parti seul à la fin de la réponse, l'agent a répondu (« C'est déjà fait ») ✓. **Autorisations** : OpenCode ne demande rien pour ses propres outils (écriture, commandes : permissions par défaut d'OpenCode) ; essai avec l'outil Terminal de Bobine (« lance `git log --oneline -3` dans le terminal de l'app »). Section « À traiter 1 » en tête de la barre latérale (« Question · L'agent veut lancer dans … ») ✓ ; carte « Terminal — L'agent veut lancer dans le terminal : git log --oneline -3 » avec 1 Lancer / 2 Toujours dans ce projet (« révocable dans Réglages › Agents ») / 3 Refuser, « Passer », « Envoyer », aide « 1–9 ou Entrée » ✓. « Lancer » → onglet « 1 · git » dans le panneau Terminal, ligne de réponse « → Lancer » dans le fil ✓ ; mais `git log` s'ouvre dans le **pager** (« (END) ») : la commande reste « busy » jusqu'à ce qu'on tape q, et la sortie disparaît ensuite (pas pratique). Carte « execute » à **JSON brut** dans le groupe (défaut 6). Second essai `npm test` : la touche « 2 » brute (AZERTY, sans Maj) ne choisit rien, le caractère « 2 » oui → « → Toujours dans ce projet », commande lancée ✓. Réglages › recherche « commandes toujours » → « Commandes toujours autorisées : npm test · carnet-de-lecture × » ✓ ; × → révoquée (un clic, sans confirmation) ✓ ; relancer `npm test` → **redemandé** ✓. « Refuser » → l'agent : « L'exécution a été refusée dans l'app ; les tests n'ont pas été relancés » ✓ ; mais la carte de l'outil refusé porte une **coche verte** (défaut 5, 2 reproductions). « Passer » non essayé | ~ (défauts 5, 6) | 6 tours | 1.3-* (25) |
| 1.4 | « Avant de refactorer le tri, demande-moi… les livres sans année » ; réponse « Autre » en texte libre | 016, 028 | question d'OpenCode (`question`) en formulaire ; « Autre » en texte libre | Carte question en ≈ 15 s : étiquette « Livres sans année », « Lors du tri par année, où veux-tu placer les livres sans année ? », 3 choix avec explication + « 4 Autre… (ou une précision) », « Passer » / « Envoyer », « À traiter » et « Attend votre réponse » ✓. Clic sur 4 → champ actif (bordure et numéro colorés), saisi « À la fin, mais triés par titre entre eux », Envoyer → la carte se replie en une ligne « Lors du tri… → « À la fin, mais triés par titre entre eux » » ✓ ; l'agent : « Compris… Aucun changement effectué pour l'instant » ✓ | ✓ | 1 tour | 1.4-* (4) |
| 1.5 | « Lance l'app et vérifie la page » ; navigateur ; essai à la main ; joindre et annoter ; terminal | 007, 030, 031, 029, 082, 094, 066, 067, 034, 057, 072 | autorisation « Lancer l'app », `.bob/launch.json` proposé ; navigateur piloté (console, réseau, mobile, sombre) ; onglets nommés, panneau agrandi, adresse à la souris ; « Joindre cette page », annotation, envoi ; recherche, tri, CSV par « Enregistrer sous », `prompt()` de « Noter » ; `@terminal` ; sélection → « Ajouter au message » | **Lancement** : 1ᵉʳ appel « Lance le serveur » → consigne de Bobine (« No launch configuration… Create .bob/launch.json ») ; l'agent **écrit** `.bob/launch.json` sans demander (OpenCode n'a pas de permission d'écriture) ; carte « Lancer l'app — L'agent veut lancer « web » dans carnet-de-lecture : npm start — Démarre la commande (port 3000) ; arrêtée avec l'app » ✓ ; « Lancer » → onglet Navigateur ouvert sur localhost:3000, barre « web en marche » ✓. Diagnostic de l'agent juste (`/src/books.js` en 404). **Navigateur piloté** (sur demande) : « 1 outil et 7 actions dans le navigateur » : console + réseau, mobile clair, capture, JS, mobile sombre, capture ; captures dans la carte et en miniature cliquable ✓ ; mais `execute` en JSON brut (D6, 2ᵉ fois), sortie console/réseau en JSON avec des `\n` littéraux, titre « Ouvre reload » (C4). **Correction du 404** demandée, liste affichée. **Panneau** : onglets Navigateur / Terminal / Modifications 4 / Aperçu, agrandi ⤢ par-dessus le fil ✓ ; adresse `localhost:3000/api/books` saisie à la souris → JSON ✓. Dans le panneau étroit, **un clic sur l'icône d'un onglet inactif le ferme** (D8, 2 fois) ; « + » le rouvre. **Essai à la main** : recherche « camus » → 2 livres (bug corrigé) ✓ ; tri (menu natif) par année ✓ ; « Exporter en CSV » → « Enregistrer sous » natif « Fichier proposé par localhost:3000. », la conversation passe « À traiter » pendant la fenêtre, bandeau « Fichier enregistré : carnet-recette-1.5.csv — Afficher dans le Finder » ✓ (fichier : `1.5-export.csv`) ; **« Noter » ne fait rien** : `prompt()` lève « prompt() is not supported » dans le navigateur intégré (D7) ; popup : la page n'en ouvre pas (non joué). **Joindre / annoter** : « Joindre cette page au message » → « ✓ Page jointe au message », miniature dans la saisie ; clic → éditeur (cadre, flèche, crayon, texte, 4 couleurs, annuler, Fermer, Appliquer) ; cadre autour de « Noter » + texte long (renvoi à la ligne dans sa boîte) ✓ ; envoyé, image annotée dans la bulle, l'agent l'a lue et a trouvé `prompt()` (public/app.js:37) ✓. **Terminal** : `git --no-pager log` tapé dans le terminal intégré ; sélection à la souris → bouton « Ajouter au message » → bloc « Terminal 1 (carnet-de-lecture) : ``` … ``` » dans la saisie ✓ ; `@term` → « @terminal — Dernières lignes du terminal de la conversation » en tête (puis du bruit de fichiers) ✓ ; réponse juste. La bulle de l'utilisateur montre les ``` en clair | ~ (défauts 6, 7, 8) | 6 tours | 1.5-* (46), 1.5-export.csv |
| 1.6 | Modifications › Conversation : deux remarques, envoi groupé ; « Annuler » une modification ; `@git-changes` | 021, 085, 057 | remarques ligne par ligne (« + » au survol), envoi groupé, l'agent corrige ; annuler un fichier ; mention de l'état git | ⇧⌘D → onglet « Modifications 4 », vues « Conversation 4 » / « Git 4 », « 4 fichiers +41 −5 », une ligne par fichier (+/−, annuler, ouvrir, Finder), diffs dépliables ✓. Survol d'une ligne → icône de bulle dans la marge ; clic → « Ligne 27 » + champ (« ⌘↩ pour ajouter ») ; ajoutée, la remarque s'affiche sous la ligne avec ✎ et 🗑 ; barre « 1 remarque · 🗑 · Envoyer à l'agent » en tête (**elle défile avec la liste**, absente quand on est descendu) ; 2ᵉ remarque sur server.js:41 par ⌘↩ → « 2 remarques » ✓. « Envoyer à l'agent » → un message « Remarques sur les modifications : 1. src/books.js, ligne 27 : ``` … ``` Remarque : … » (``` en clair dans la bulle) ; l'agent répond aux deux (garde `averageRating`, sert `src/` en lecture seule avec types MIME), 8 tests, diff mis à jour en direct ✓. « Annuler cette modification » (infobulle) sur `.bob/launch.json` → confirmation dans la ligne « Remettre launch.json dans son état d'avant la conversation ? Créé par l'agent : il sera supprimé. Remettre / Garder » → « annulée », note dans le fil « Modification annulée : .bob/launch.json, créé par l'agent, a été supprimé. », Git 4 → 3 ✓ (l'en-tête garde « 4 +55 −8 »). Vue Git : « 3 fichiers +44 −8 · depuis le dernier commit », branche `main` — **pas de bouton « Committer » ici** (voir 1.8). `@git` → « @git-changes — État et diff du dossier depuis le dernier commit » en tête ; réponse en 3 puces justes ✓ | ✓ | 2 tours | 1.6-* (17) |
| 1.7 | Échap pendant une réponse ; modifier un message plus haut (branche) ; fichiers remis ; liste ; retour à l'original | 023, 095 | arrêt net ; branche avec remise des fichiers ; deux conversations dans la liste ; original intact | « Ajoute le filtre par statut » puis Échap après 12 s → « Réponse interrompue. », carte en cours « patch » (**nom brut**) passée en « × échec », dépliée « Tool execution interrupted » ; aucun fichier touché ✓. Survol d'un message → heure + ✎ ; ✎ → message éditable, « Repart de ce message dans une nouvelle conversation », Annuler / Envoyer ; Envoyer → dialogue « Repartir de ce message ? Une nouvelle conversation reprend l'échange jusqu'à ce message. L'originale reste dans l'historique, telle quelle. ☑ Remettre 1 fichier dans leur état d'alors · server.js · 1 commande lancée depuis ce message : ses effets restent. » (C7) ✓. Branche : en-tête « … · branche », bandeau « Nouvelle branche de « … » : l'échange ci-dessus est repris, l'agent l'a reçu en contexte. 1 fichier remis… — Voir l'original », réponse juste ; sur disque `server.js` revenu à son état d'avant les remarques ✓. Liste : la branche sous l'originale avec ↳ ✓, mais **même titre tronqué** (« Explique-moi ce projet : à quoi… ») et pas d'infobulle. « Voir l'original » → original intact ✓ ; ses fichiers sur disque restent ceux de la branche (attendu, fiche 023) mais son onglet Modifications affiche toujours `server.js +17 −4` et `launch.json` **sans** la mention « annulée » vue avant (état gardé en mémoire du composant, `ChangesTab.tsx:98`) | ✓ | 2 tours | 1.7-* (15) |
| 1.8 | Vue Git : « Committer » avec le message proposé, le modifier, « Défaire », recommitter | 110, 021, 049 | bouton « Committer » dans la vue Git | **Non jouable sur `main`** : la vue Git d'une conversation dans le dossier du projet n'a que la liste « 3 fichiers +31 −5 · depuis le dernier commit » et la branche ; « Committer », « Défaire » et le message proposé n'existent que dans la barre d'une conversation **en worktree** (`WorktreeBar.tsx`, fiche 110) → à jouer en 3.4. La puce « main • » sous la saisie ouvre la vue Git ✓. Contournement d'utilisateur : « Committe l'état actuel… » → l'agent fait 3 commandes, commit `18f5b9c fix: correct book search and rating average and serve source modules safely` ; vue Git « Aucune modification depuis le dernier commit », puce « main » sans point ✓ | — sur `main` (manque, voir Manques) ; **joué en 3.4** dans une conversation en worktree : « Committer » avec message proposé, modifié, « Défaire », recommit ✓ | 1 tour | 1.8-* (2) |
| 1.9 | `/review` sur les modifications ; `/init` (regarder, refuser) | 017, 039, 045 | liste `/` avec origines ; `/review` rend une revue ; `/init` propose, on refuse | `/` → liste « Commandes » avec description et origine à droite : `/compact`, `/init`, `/review` « OpenCode », `/revue-fr` « Vous » (vert), les commandes de l'app (`/clear`, `/context`, `/cost`, `/help`, `/mode`, `/model`, `/split`) étiquetées « IBM Bob · OpenCode » ; descriptions d'OpenCode en anglais (« Compact the session », « guided AGENTS.md setup ») ✓. `/review` + Entrée → envoyé ; **rien ne revient** : journal `session/prompt « /review » → end_turn en 8 ms` ; `/review commit` idem (9 ms) — mais le journal d'OpenCode montre qu'il **travaille ensuite** (git, `npm test`) sans rien envoyer : défaut d'OpenCode, que Bobine montre par un silence complet (ni « Réfléchit… », ni « tour fini sans réponse »). `/init` → même chose (13 ms) ; OpenCode **écrit `AGENTS.md` en arrière-plan** (21 lignes, gardé en `1.9-AGENTS-ecrit-par-init.md`) : aucune carte, aucune question, impossible de refuser ; la vue Git ne l'a montré qu'après ↻ ; pas de bouton d'annulation dans la vue Git → fichier retiré par le pilote | ✗ (agent) / ~ (Bobine : silence) | 3 tours vides | 1.9-* (8) |
| 2.1 | Maj+Tab → mode Plan ; « Ajoute la page de statistiques (point 3) » ; remarque ; v2 ; « Voir ce qui a changé » ; 2ᵉ remarque ; v3 | 013, 040, 098 | saisie colorée, pastille, rappel ; plan dans le fil ; remarques sur un passage ; versions et différence | Relance de Bobine (⌘Q puis lanceur) : conversation rouverte, **`launch.json` de nouveau listé sans « annulée »** (D9). Maj+Tab → bordure violette, pastille « Plan », placeholder « Explorer et planifier avec OpenCode… », rappel « Mode Plan : l'agent lit et propose, il ne modifie rien. Maj+Tab pour passer en Build. » ✓. Plan en ≈ 40 s : carte « Plan proposé · version 1 » (cadre orange), corps Markdown, barre « Sélectionnez un passage pour le commenter. · Envoyer mes remarques · Exécuter le plan » ✓. Sélection → bulle « Commenter » → passage cité + champ, « Annuler / Ajouter la remarque » ; le passage reste surligné ✓. **D10** : après l'ajout, mon clic sur « Envoyer mes remarques » a lancé « Exécuter le plan » (mode Build, « Exécute ce plan. », 2 modifications) ; Échap sans effet (focus dans la remarque), arrêt par ■ → « Réponse interrompue. », fichiers défaits par le pilote (`git checkout`). Retour en Plan, « Envoyer mes remarques » → message « Remarques sur le plan : 1. Passage : « … » Remarque : … Mets à jour le plan… Reste en mode plan » ✓ ; « Plan proposé · version 2 · Voir ce qui a changé » ; le bouton affiche un diff ligne à ligne des deux versions (rouge / vert) et devient « Voir le plan » ✓. 2ᵉ remarque → « Plan proposé · version 3 » qui en tient compte (« Partir de l'état actuel, sans reprendre les SVG retirés », lien dans le README) ✓ ; v1 et v2 restent dans le fil | ~ (D9, D10) | 4 tours (dont 1 exécution non voulue) | 2.1-* (18) |
| 2.2 | « Exécuter le plan » ; liste de tâches (OpenCode : constater) ; ⌘F, ⌘K, renommer, autre conversation et retour ; aperçu HTML | 040, 035, 086, 046, 015, 095, 064 | retour en Build ; ⌘F 1/N ; ⌘K ; renommage ; pastille d'activité ; « montre-moi stats.html en aperçu » | « Exécuter le plan » (v3) → saisie repasse en **Build**, message « Exécute ce plan. », carte désactivée « L'agent travaille… » ✓. **Pas de liste de tâches** avec OpenCode (ni panneau « Tâches », ni progression) : constaté, attendu. ⌘F « stats » → barre « 1 / 3 ▲ ▼ × », surlignage orange, Entrée passe à 2/3 puis 3/3 en défilant ✓. ⌘K « node » → 3 résultats avec titre, extrait, mot surligné, « affichée » pour la conversation courante, agent · dossier ✓ ; ouvrir un résultat → la conversation s'ouvre **avec ⌘F pré-rempli** sur « node » (1/3) ✓. Pendant ce temps la conversation qui travaille montre un ⟳ dans la liste ✓. Menu « … » : Épingler, Ouvrir à côté, Lancer en parallèle…, Renommer, Exporter en Markdown / JSON, **Archiver**, Supprimer ; « Renommer » → champ en place, « Carnet : bugs, plan des statistiques » ✓. L'agent attend l'autorisation « Lancer l'app » : la conversation passe dans « À traiter 1 » (« Question : L'agent veut lancer « we… ») ✓ ; réponse après 2 min 24 : « Toujours dans ce projet » → Bobine envoie elle-même, dans une bulle de l'utilisateur, « J'ai autorisé « npm start » : relance preview_start. » (relance tardive voulue), l'agent relance ✓. Résultat : `/stats.html` (3 tableaux à barres CSS, sombre et mobile vérifiés), 13 tests ✓. « Montre-moi public/stats.html en aperçu » → l'agent ouvre l'URL dans le navigateur et écrit un lien `public/stats.html` → `http://localhost:3000/stats.html` ; **cliquer ce lien ne fait rien** (D11, 2 clics) | ~ (D6, D11) | 3 tours | 2.2-* (17) |
| 2.3 | Une question de l'agent en cours de route (provoquée) | 016, 028 | carte question, choix multiples | Demande « point 4… demande-moi quels filtres afficher (plusieurs choix possibles) » → carte « Filtres à afficher · Quels filtres veux-tu afficher… · Plusieurs choix possibles. », cases à cocher Statut / Étiquette + « 3 Autre réponse… », aide « 1–9 ou Espace : cocher · Entrée : valider » ✓ ; deux cases cochées (orange) → ligne « → Statut, Étiquette » ✓ ; l'agent implémente (« Modification de src/books.js et 5 autres »), 17 tests, vérifie au navigateur (le panneau se rouvre seul sur le navigateur) ✓ | ✓ | 1 tour | 2.3-* (4) |
| 2.4 | Mermaid ; capture d'écran du Mac depuis la saisie ; glisser une image depuis le Finder ; coller une image ; `@` un fichier | 063, 062, 066, 067, 005, 057 | diagramme rendu ; capture annotée envoyée ; image glissée et collée ; mention | **Mermaid** : diagramme rendu dans le thème sombre, lisible, flèches et libellés ✓ ; au survol `</>` (source, avec bouton retour), ⤢ (agrandi par-dessus l'app, Échap ferme), copier ✓. **Capture depuis la saisie** : 📷 → fenêtres de Bobine masquées (écran noir en plein écran), sélection d'une zone → **rien de joint, aucun message** (D3 confirmé hors fenêtre rapide) ; 2ᵉ essai annulé par Échap → Bobine revient ✓ ; donc pas d'annotation possible. **Coller** (⌘V d'un PNG) → miniature ✓. **Glisser depuis le Finder** (Bobine sortie du plein écran) → voile « Déposez pour joindre au message », nom du fichier sous le pointeur, 2ᵉ miniature ✓. **`@stats`** → `stats.js`, `stats.html` en tête puis le bruit habituel (`settings.gradle.kts`, `LaunchImage.png`…) ; ↓ + Tab → puce « stats.html » + `@public/stats.html` ✓. Envoi des trois pièces : bulle avec deux images et la puce, réponse juste sur chaque image ✓ | ~ (D3) | 3 tours | 2.4-* (17) |
| 2.5 | Un sous-agent (audit de `server.js`) pendant que l'agent continue ; puis deux dans le même tour | 010, 053, 117 | carte « Sous-agents », une ligne par sous-agent (état, type, consigne, durée, coût), « Réponse », « Voir son travail » | Carte « Sous-agent · 1 fini » : ✓ vert, type « general », titre « Audit sécurité du serveur », « < 1 s », « Réponse › » ; dépliée : CONSIGNE (le texte complet donné au sous-agent) ✓ puis RÉPONSE = « The subagent is working in the background… You will be notified automatically when it finishes… » : OpenCode 2 lance le sous-agent **en arrière-plan** (`metadata.status: "running"`) et Bobine l'affiche **fini en moins d'une seconde** (D12). « Voir son travail » → « SON TRAVAIL » : la liste de ses outils, qui **grandit en direct** (13 lectures, `git status`, `node …`) pendant que la carte dit « fini » ✓ pour la liste. L'agent ajoute en parallèle `test/server.test.js` (18 tests) et finit son tour : « L'audit de sécurité du sous-agent est encore en cours. » ; rien n'arrive ensuite dans le fil (3 min). **Deux sous-agents** dans un tour → « Sous-agents · 2 finis », deux lignes « < 1 s » (D12 reproduit) ; pas de total (OpenCode ne donne ni durée ni coût). Les conclusions n'arrivent qu'en les demandant au tour suivant (8 problèmes de sécurité, accessibilité, couverture) ; la « Réponse » des cartes reste le texte « working in the background » | ✗ (D12) | 3 tours | 2.5-* (9) |
| 2.6 | Points 4 et 5 ; compaction subie ; `/context`, `/cost` avant et après ; `/compact` ; mémoire du plan ; détail de la puce | 019, 039, 091, 109 | compaction subie visible ; `/compact` ; l'agent se souvient ; détail par échange | **Compaction subie : non jouable** : fenêtre de GPT-6.1 Sol = 1 050 000 jetons, la conversation (33 échanges, points 1 à 5 faits) n'en occupe que 9 à 12 % ; il faudrait ≈ 800 000 jetons de plus. `/context` et `/cost` → **le même encadré gris** (« Contexte : 97 369 / 1 050 000 jetons (9 %) · Jetons cumulés : 128 400 en entrée, 16 194 en sortie, sur 31 tours · Coût : 0,00 $US »), sans rappel de la commande ✓ (contenu) / pas pratique (forme). Point 5 (PATCH/DELETE, boutons, 27 tests) joué entre-temps, avec le `kill -9` de 2.7. `/compact` (OpenCode) → bulle « /compact », carte « ✳ Conversation résumée pour libérer du contexte › » ✓ ; dépliée : le résumé d'OpenCode en anglais, **Markdown brut** (`## Next Move`, `### Active`…, non rendu) (C8). Après : « rappelle-moi le plan… et ma remarque sur les SVG » → juste (tableaux HTML, barres CSS, pas de SVG) ✓ ; `/context` → 24 947 (2 %) ✓ ; la puce affichait encore 12 % juste après `/compact`, puis 2 % au tour suivant. Détail de la puce : contexte, « Jetons traités (33 échanges) 7 027 754 » (entrée, sortie, lus en cache 6 823 040, réflexion, dernier échange), coût 0,00 $US, moyenne par échange, liste par échange (heure, entrée → sortie, coût) ✓ ; le tour tué n'y figure pas | ~ (compaction subie non jouée, C8) | 4 tours | 2.6-* (7) |
| 2.7 | `kill -9` de l'agent au milieu d'un tour ; relance au message suivant ; veille du Mac ; quitter et relancer Bobine ; fil rejoué comparé au direct, carte par carte | 041, 103, 080 | bandeau panne ; relance avec contexte ; fil rejoué identique | **kill -9** (22:54:06, pid 91968) pendant « patch… 1 min 29 » du point 5 : en < 3 s bandeau rouge « L'agent s'est arrêté. Sortie : SIGKILL. », la carte en cours passe « ⊘ 1 annulé », saisie « L'agent s'est arrêté : écrivez pour le relancer », pied « L'agent s'est arrêté. Relancer » ✓. Message suivant → agent relancé sans clic, il retrouve la session (« L'API et les fonctions métier avaient été commencées, mais l'interface restait à faire ») et finit le point 5 (27 tests) ✓. **Veille du Mac : non jouée** — le pilote peut l'endormir (`pmset sleepnow`) mais pas la réveiller sans Jérôme (`pmset schedule wake` demande `sudo`). **Quitter et relancer** : pas d'entrée de menu de ce nom ; ⌘Q puis lanceur, conversation rouverte en 5 s. Comparaison (13 captures `2.7-rejeu-*` contre celles prises en direct) : bandeau SIGKILL et « 1 annulé » ✓ ; sous-agents (« 2 finis », lignes, consigne, réponse) identiques ✓, et « Voir son travail » contient maintenant le **rapport final** du sous-agent ✓ ; Mermaid, images jointes, puce `stats.html` ✓ ; ligne de réponse à la question ✓ ; relance tardive et groupes d'outils ✓ (« Modification de src/books.js et 5 autres », vue en direct, est rangée dans « 1 modification, 2 commandes et 6 actions dans le navigateur » comme à la fin du tour en direct) ; plans v1, v2, v3 avec « Voir ce qui a changé » ✓ ; « Réponse interrompue. » et « ✗ 1 échec » ✓. **Écarts** : les trois encadrés de `/context` et `/cost` **ont disparu** (C9) ; `launch.json` « annulée » oublié (D9, déjà noté) | ~ (veille non jouée, C9) | 1 tour | 2.7-* (20) |
| 2.8 | `/` (origines), `/clear`, `/revue-fr` (0.2), une commande du projet créée par l'agent, `/split` préparé ; `@git-changes`, `@terminal` | 017, 039, 045, 057 | commandes de l'app, de l'agent, personnelles et du projet, chacune avec son origine ; toutes utilisables | `/revue` → `/revue-fr <fichier> (facultatif) · Revue de code en français · Vous` ; Tab → rappel de la syntaxe au-dessus de la saisie ; `/revue-fr server.js` → la bulle montre la consigne développée (« Fais une revue en français de server.js… », `$ARGUMENTS` remplacé), revue juste (critique → lisibilité) ✓ ; l'envoi depuis le fil remonté ne ramène pas en bas (D4, 4ᵉ fois). L'agent crée `.opencode/commands/tests.md` (front matter `description`, `!npm test`) ; `/te` → `/tests · Lance les tests et résume les échecs` **aussitôt**, étiquetée « OpenCode » (pas « projet ») ; l'envoyer → `end_turn` en 579 ms, **rien** (même défaut d'OpenCode que `/review`, 1.9). `/split` + Tab → rappel `/split [message]` ; non lancé (acte 3). `/clear` → nouvelle conversation vide, même agent, modèle et dossier ; l'ancienne reste dans la liste ✓. `@git-changes` et `@terminal` : joués en 1.5 et 1.6 ✓ | ~ (agent : commandes muettes ; D4) | 3 tours | 2.8-* (11) |
| 2.9 | Règles actives : curseurs › « Règles actives » ; créer `AGENTS.md` ; revoir la liste ; aperçu | 056 | liste des fichiers de règles, mise à jour, aperçu | Avant : curseurs → « Réglages · OpenCode » (Model, Effort, Session Mode — **en anglais**, noms d'OpenCode), « Serveurs MCP · bobine · intégré · 31 outils… ≈ 3 513 jetons », « Règles actives · Aucun fichier de règles · Un AGENTS.md dans le dossier donne des consignes à l'agent. » ✓. « Crée un AGENTS.md court… » → fait ; le menu montre aussitôt « AGENTS.md · projet » ✓ ; clic → onglet Aperçu, rendu propre ✓. Dans la réponse, `` [`AGENTS.md`](AGENTS.md) `` (code en lien) → aperçu ✓ | ✓ | 1 tour | 2.9-* (5) |
| 3.0 | Partir d'un `main` propre | — | l'agent committe l'état | « Committe tout l'état actuel… » → `6f81900 feat: add reading statistics, filters and book management`, « Répertoire de travail propre » ✓ | ✓ | 1 tour | 3.0-commit-depart |
| 3.1 | Un message avec les chantiers 6, 7, 8 : filles proposées d'elles-mêmes ? Carte « Tâches proposées » : une fille avec un autre modèle, une avec Bob, une « Faire ici » | 097, 112, 118, 117, 110 | l'agent propose des filles sans `/split` ; agent et modèle au choix ; carte de départ du worktree ; en-tête « ↳ depuis » | **Oui, de lui-même** (réglage « Quand ça s'y prête ») : carte « 1 tâche proposée · 1 en attente — L'agent propose de confier ce travail à des conversations filles, chacune dans son propre worktree. Vous pouvez aussi lui demander de le faire ici. », ligne « 6 — Liste à lire priorisée » avec ≡ (options), Refuser, Faire ici, Lancer ; aide « ↑↓ pour choisir une ligne, Entrée pour la lancer » ✓. Dépliée : consigne complète (base `6f81900`, fichiers permis / interdits, commit, rapport) — **en lecture seule** (pas pratique). ≡ → Agent (IBM Bob / OpenCode) et Modèle (liste complète, ~60 modèles) ✓. Les propositions 7 puis 8 arrivent **une à une dans la même carte**, et chaque arrivée décale les boutons : **deux clics perdus** (D13). Lancements : **6 → OpenCode `openai/GPT-6 Astra`** ; **7 → IBM Bob** (« Le dernier modèle choisi avec cet agent ») ; **8 → « Faire ici »** (ligne « ↵ Faite ici », la mère fait le mobile et commite `bd26086`). Carte finale repliée en trois lignes d'état « Lancée / Lancée / Faite ici » ✓. Carte « Sous-tâches » sous l'outil : ligne par fille (état, branche `bobine/20261022-2312-e4cd`, « Ouvrir ») ✓. Fille : carte de départ « Parti de main · 6f81900 · 22 oct. 2026, 23:10 « feat: add reading statistics… » · Vue Git » et en-tête « ↳ depuis « Carnet : bugs, plan des… » » ✓ ; dans la liste, sous la mère avec ↳ | ~ (D13) | 2 tours (mère) | 3.1-* (14) |
| 3.2 | Pendant que les filles travaillent : « À traiter », Dock, bannières, son ; ouvrir une fille, répondre à une autorisation ; comptes rendus dans la mère ; pastilles de coût | 024, 068, 101, 119, 097, 117, 109, 035, 077 | ordre et raison dans « À traiter » ; compteur ; comptes rendus avec coût et échanges ; pastilles justes | « À traiter » : « 7 — Tests serveur et page · Autorisation : Updating todo list · fil… » puis « 6 — Liste à lire priorisée · Compte rendu à lire · fille de « Carn… » » avec point non lu ✓ ; compteur du Dock « 1 » = « À traiter 1 » ✓. **Bannières, son, rebond : non observés** (Bobine au premier plan en plein écran pendant toute la scène ; audio hors de portée du pilote). **Fille Bob** : autorisations de Bob en anglais (« Allow once / Always allow / Reject » : boutons de l'agent) ; « Always allow » vaut **par commande** (chaque `node -e` différent redemande) ; Bob tâtonne (sondes JSDOM) → refus + message en file « Fais court… », envoyé par ↵ « Interrompre et envoyer » ✓. Panneau « Tâches 0/8 » puis « 2/5 », liste épinglée dans le fil, barre de progression, repli en « Plan » à la fin ✓ (Bob seulement). Puce « 0,5844 bobcoins » puis « 1,0253 bobcoins » ; quota « <n> % du quota » en pied ✓. Fini : 29 tests, `ccbb6cb`. **Coût relu dans `bob.db`** (lecture seule) : `{"cost":1.025348}` = la puce ✓ (sous le plafond de 2). **Comptes rendus dans la mère** : « « 7… » a été arrêtée · aucun fichier modifié » (mon interruption), « « 6… » a fini son tour · branche · 9 fichiers +360 −12 · 0,00 $US · 1 échange », « « 7… » a fini son tour · 1 fichier +22 −0 · **0,5844 bobcoins** · 2 échanges » — coût **périmé** (1,0253 dans la fille, la carte Sous-tâches et `bob.db` ; 1 observation, non reproduite pour ne pas relancer Bob) ; puis « Les conversations filles ont toutes fini : l'agent reprend avec leurs comptes rendus. » et la mère résume seule (6 fini, 7 partiel, 8 intégré) ✓. **Sous-tâches · 2 terminées** : pastilles « 0,00 $US » et « 1,0253 bobcoins », « 9 fichiers +360 −12 », « Les 2 branches sont finies et ne touchent pas les mêmes fichiers. · Fusionner les 2 dans main · Puis nettoyer » ✓ | ~ (bannières non observées ; coût périmé dans un compte rendu) | Bob 1,0253 bobcoin | 3.2-* (16) |
| 3.3 | Conflit provoqué sur `README.md` ; « Fusionner les N dans main » ; « Arrêter » puis reprendre ; conflit résolu par la fille ; « Puis nettoyer » ; plus d'orphelin | 097, 117, 120, 110 | état ligne par ligne ; arrêt propre ; la fille résout ; nettoyage | Aucune fille ne touchait README : la fille 6 réécrit la ligne du point 6 (`1cdc506`), la mère la même ligne sur `main` (`74c4e4b`). La carte Sous-tâches dit encore « Les 2 branches sont finies et ne touchent pas les mêmes fichiers » (vrai entre filles ; **rien sur le conflit avec main**). « Fusionner les 2 dans main » → ligne 6 « ⟳ l'agent résout le conflit », ligne 7 « en attente », pied « Fusion dans main, l'une après l'autre : 0 sur 2 faite. Au premier conflit, la fille concernée le résout, puis la fusion reprend. · Arrêter » ✓. « Arrêter » → « Arrêt après la fusion en cours… » ✓. Dans la fille, Bobine envoie la consigne (anglais, ADR-0014) « Merging the base branch `main`… left conflicts in README.md… Do not commit… the app finishes the merge » ; la fille résout sans commit ✓ ; compte rendu dans la mère « Conflit résolu dans README.md… » avec « Partira à l'agent quand ses conversations filles auront toutes fini. » ✓. Carte : « Fusion arrêtée : 1 fusionnée dans main, les autres restent en attente. », 6 « ✓ fusionnée », 7 « en attente », « Fusionner dans main · Puis nettoyer » ✓. « Fusionner dans main » → « 1 fusionnée dans main en 1 s. », les deux « ✓ fusionnée » ✓ ; `main` = `12a9799`, README = version de la fille, **40 tests verts**. Mais **« Puis nettoyer » disparaît** une fois la fusion finie (je n'avais pas cliqué « Puis nettoyer » d'abord) : il faut ouvrir chaque fille › Modifications › Git, barre du worktree (« Départ : main à 6f81900 · … · Fusionné dans main · Committer · Ouvrir une PR · Fusionner dans main · Nettoyer · Le dépôt n'a pas de dépôt distant : rien où pousser la branche. ») › « Nettoyer » → « Archiver la conversation, puis supprimer le worktree et la branche … ? Ressortie, la conversation continue dans le dossier principal. Garder / Nettoyer » ✓ → worktree et branche supprimés, conversation dans « Archivées » ✓ ; **l'app ouvre alors un brouillon dont le dossier est le worktree supprimé** (D14, 2 fois). Réglages › Worktrees orphelins : « Aucun. » ✓. Outil « Updating todo list · IBM Bob » toujours autorisé (3.2) révoqué | ~ (D14) | 2 tours + 1 de la fille | 3.3-* (16) |
| 3.4 | Conversation en worktree créée à la main : « Committer » (message proposé, le modifier, « Défaire », recommitter — cas 1.8) ; « Ouvrir une PR » regardé ; « Fusionner dans main » avec « Laisser l'agent résoudre » ; « Nettoyer » ; orphelin fabriqué au terminal, nettoyé depuis Réglages | 036, 110, 096, 021, 049 | worktree et branche `bobine/…` ; barre du worktree complète ; PR : la raison affichée ; conflit résolu par l'agent ; orphelin détecté et nettoyé | Menu du dossier sous la saisie : « Dossier de travail » (dossiers, « Choisir un dossier… », « Nouvelle conversation dans un worktree — Sa propre branche et son propre dossier, pour travailler en parallèle ») ; il garde les **worktrees supprimés** (D14) et un clic sur l'un d'eux donne une erreur IPC brute « Error invoking remote method 'agent:configure': Error: Dossier introuvable : … ». Le brouillon avait pris **Bob** (dernier agent utilisé) et le **modèle GPT-6 Astra** (choisi pour la fille 6) : rien ne le signale. Worktree créé (`bobine/20261022-2325-095a`, carte « Parti de main · 12a9799 · 22 oct. 2026, 23:23 ») ; **passer de Bob à OpenCode supprime le worktree et sa branche**, puis OpenCode ne démarre pas (« ENOENT: process.cwd failed… ») (D15, 2 fois). Contournement : agent et modèle choisis dans le dossier principal, **puis** worktree (`bobine/20261022-2327-c08c`) ✓. README modifié par l'agent ; Modifications › Git : barre « bobine/… · Départ : main à 12a9799 · 22 oct. 2026, 23:23 « Merge branch… » · 1 fichier à committer · Committer (1) · Ouvrir une PR · Fusionner dans main · Le dépôt n'a pas de dépôt distant : rien où pousser la branche. », case par fichier ✓. « Committer (1) » → « Message du commit » proposé « docs: ajoute dans README.md une section « Contribuer » de trois l — README.md » (titre de la conversation **coupé au milieu d'un mot**, en français) ; modifié en « docs: add a Contributing section to the README » → « Commit 665ee38 fait. · Défaire » ✓ ; « Défaire » → « Commit défait : ses modifications sont de nouveau à committer. » ✓ ; recommit avec le message proposé → `2bda643` ✓. **« Ouvrir une PR » : deux clics, rien** (D16). Conflit fabriqué au terminal (`main` : section « Licence » au même endroit, `6326711`) → « Fusionner dans main » → « Fusion arrêtée : 1 fichier en conflit. · Conflit dans 1 fichier : README.md · Abandonner / Réessayer / Laisser l'agent résoudre » ✓ → l'agent garde les deux sections, sans marqueur → « Fusionné dans main (commit de fusion). » (`4e11801`, 40 tests verts) ✓. « Nettoyer » → même confirmation qu'en 3.3, worktree et branche supprimés, brouillon fantôme (D14, 3ᵉ fois, avec « Git 33 »). Orphelin `git worktree add .worktrees/20261022-2330-orph -b bobine/20261022-2330-orph` → Réglages › Agents › Worktrees orphelins : « bobine/20261022-2330-orph · Nettoyer » ✓ → supprimé (dossier et branche), « Aucun. » ✓ — **sans confirmation** alors que le texte dit « supprime… avec ce qu'ils contiennent » ; « Dossiers récents » garde les chemins des worktrees supprimés | ~ (D14, D15, D16) | 3 tours | 3.4-* (24) |
| 3.5 | Reprendre une session commencée au terminal ; sessions vides masquées | 055 | la session du terminal listée, reprise avec son échange, on continue | `opencode run -m openai/gpt-6.1-sol "…combien de livres…"` dans le projet (Bash) → session « Nombre de livres dans data/books.json ». ⇧⌘O → « Reprendre une session — Une session commencée ailleurs (terminal, Bob IDE…) s'ouvre comme une conversation : l'agent rejoue l'échange, et vous continuez ici. », agent (OpenCode), « Ce dossier / Tous les dossiers », filtre ✓. « Ce dossier » était le worktree fantôme de 3.4 (D14) → « Aucune autre session de OpenCode dans ce dossier. Voir tous les dossiers » ; « Tous les dossiers » → sessions groupées par dossier (`carnet-de-lecture`, `bobine`) avec l'heure ; celles déjà ouvertes dans Bobine sont masquées ✓, **mais les sessions des sous-agents de 2.5 (« Audit sécurité du serveur », « Audit accessibilité… », « Audit couverture… ») sont proposées** comme des sessions à reprendre. Reprendre → conversation « Nombre de livres… », échange rejoué (commande `node -e`, réponse « 12 livres »), dossier `carnet-de-lecture`, GPT-6.1 Sol ✓ ; message suivant → « 8 livres sont au statut « lu ». » ✓ | ✓ | 1 tour | 3.5-* (4) |
| 3.6 | Conversations gardées actives à 2 ; quatre conversations ouvertes ; éviction et reprise | 102 | au plus 2 agents en mémoire ; la conversation évincée se recharge quand on y revient | Réglages › Conversation › « Conversations gardées actives — Au-delà, les plus anciennes sont mises en veille et rechargées quand vous y revenez. Chaque conversation active garde son agent en mémoire (environ 300 Mo). » 6 → 2 (− grisé à 2, minimum) ✓. Ouverture de « Carnet… », « Crée un AGENTS.md… », « Quelle version de Node… », la branche « Explique-moi… » : à chaque ouverture `main.log` montre « Agent lancé » puis « Agent arrêté (… code 130) » du plus ancien ; `pgrep` : **2** `opencode acp` ✓. Retour sur « Carnet… » (évincée) : rien ne le signale dans la liste (pas de pastille « en veille »), pied « OpenCode · Prêt » ; message → l'agent répond avec le contexte (« 74c4e4b — docs: mark reading list work as under review ») ✓. Réglage remis à 6 | ✓ | 1 tour | 3.6-* (5) |
| 4.0 | Rallumer les familles iOS et Android ; poids des outils | 099, 109 | 31 → 56 outils | Réglages › Serveurs MCP : « Simulateur iOS 12 outils ≈ 1 106 jetons · Projet Xcode ou Swift dans le dossier · Accord avant de compiler » et « Émulateur Android 13 outils ≈ 1 113 jetons · Projet Android (Gradle) dans le dossier · Accord avant de compiler » rallumées ✓. La conversation « Carnet… » était en veille depuis la relance : son agent démarre directement avec **56 outils ≈ 5 732 jetons** ; pas besoin de « Redémarrer l'agent » ✓ | ✓ | 0 | 4.0-* (3) |
| 4.1 | « Compile l'app mobile pour le simulateur iOS et lance-la » : `ios_build`, `ios_boot`, `ios_launch` ; onglet iOS (flux, images par seconde, châssis) | 008, 009, 044, 075, 084 | autorisation de compilation ; carte pendant la compilation ; app lancée ; onglet en direct | `execute` (recherche d'outils, D6), « Liste les simulateurs iOS », « Démarre le simulateur E882EF45-7C44-4725-8D92-A7B377EB99F3 » (**UDID brut** dans le titre) → l'onglet **iOS** s'ouvre seul : châssis iPhone Air, flux « en direct » ✓. Carte « Compiler pour iOS — L'agent veut compiler l'app iOS dans carnet-de-lecture : xcodebuild -workspace …/mobile/ios/Runner.xcworkspace -scheme Runner -configuration » (commande coupée), 1 Compiler / 2 Toujours dans ce projet / 3 Refuser ✓. **Pendant la compilation (33 s)** : une ligne « Compile l'app iOS Runner » avec spinner, et « Compile l'app iOS Runner… 42 s » en pied ; la ligne **ne se déplie pas** (aucune sortie de `xcodebuild`, aucune étape). Fini : « Build succeeded in 33 s: …/Bobine-recette-2026-10/cache/DerivedData/…/Runner.app (fr.bobine.carnetMobile). Call ios_launch with app_path… » ✓. « Lance Bobine-recette-20… » : **titre tiré du chemin du dossier de données**, pas du nom de l'app (C10) ; dépliée « fr.bobine.carnetMobile launched on "iPhone Air" (pid 8828). Screen: 420×912 points » ✓. « Lit l'écran du simulateur » : arbre d'accessibilité lisible (« StaticText "Chargement impossible : Connexion impossible…" [ref_4] ») → l'agent comprend que l'API est arrêtée, lance le serveur web, relit : **12 livres affichés dans l'app** ✓. En-tête de l'onglet : « iPhone Air iOS… · en direct · 30 … · − · ajuster · 1:1 · + · 79 % » : nom de l'appareil et **images par seconde tronqués** à la largeur normale du panneau | ~ (C10, compilation muette) | 1 tour | 4.1-* (13) |
| 4.2 | L'app lit la liste depuis l'API (déjà fait en 4.1), évolution, recompilation, relance ; `ios_describe` / `ios_tap` ; à la souris : toucher, glisser, appui long ; zoom ; panneau agrandi | 009, 044, 082, 084 | gestes de l'agent et de l'utilisateur ; zoom ; défilement de l'appareil zoomé | « Affiche la note en étoiles, recompile, relance, touche le premier livre » → recherche, « Modification de mobile/lib/main.dart et 1 autre », `flutter analyze`, `flutter test`, « Compile l'app iOS Runner » (**sans redemander l'accord** : « Compiler » vaut pour la conversation), « Lance… · Lit l'écran », « Touche l'écran · Lit l'écran du simulateur » (arbre d'accessibilité après le toucher) ; app relancée avec ★★★★★ ✓. **À la souris** : clic sur « Noter » → dialogue « Noter « La Peste » » (1 à 5 sur 5, Annuler) ✓ ; glisser vers le haut → la liste défile ✓ ; appui long 1,5 s sur une ligne → rien (l'app n'en a pas) ; sur le champ de recherche → focus, pas de menu : non concluant ; **frappe au clavier du Mac → rien dans le champ** (manque : pas de saisie clavier vers le simulateur). Zoom : « − » 79 → 75 %, « 1:1 » 100 %, « + » 125 % ✓ ; la molette fait défiler la vue zoomée (pas l'app) ✓ ; « ajuster » revient à 79 % ✓. Panneau agrandi : en-tête complet « iPhone Air iOS 26.0 · en direct · 30 fps · − ajuster 1:1 + · 83 % » ✓ ; boutons sous l'appareil « Accueil », « Verrouiller », « Joindre cet écran au message » (infobulles) ✓ | ~ (saisie clavier absente, appui long non concluant) | 1 tour | 4.2-* (18) |
| 4.3 | Planche contact d'un défilement (`ios_filmstrip`) ; « Joindre l'écran » → annotation → envoi ; `ios_screenshot` comparé au flux | 075, 084, 066, 067, 008 | grille dans la carte ; écran joint et annoté ; capture conforme au flux | « 2 actions sur le simulateur iOS » ; **replié, le groupe ne montre que la capture finale** en miniature ; déplié : « Filme le simulateur pendant un geste » et « Capture le simulateur ». Planche dépliée : « Contact sheet over 2000 ms: 8 frames… out of 24 different screens (61 frames received). Times: 1 → 0 ms … 8 → 1867 ms. Each frame is scaled ×0.612… Swiped from (210, 740) to (210, 260). » + grille 4 × 2 numérotée ✓ ; clic → grille agrandie en pleine largeur de la carte ✓. Capture finale = l'écran du flux (« Émile ou De l'éducation » en bas) ✓. Bouton « Joindre cet écran au message » → miniature dans la saisie ✓ ; éditeur d'annotation ; une flèche et un texte tracés **à côté de l'image** (zone grise) ne laissent rien, sans retour (« Appliquer » reste grisé) ; sur l'image : flèche vers le bouton ↻ de la barre et texte « Ce bouton n'a pas de libellé lisible » ✓ → envoyé ; l'agent relit l'écran (« Lit l'écran du simulateur ») et répond : « actualise la liste… libellé d'accessibilité « Actualiser » » ✓ | ✓ | 1 tour + 1 | 4.3-* (10) |
| 4.4 | Android : démarrer l'émulateur, lancer l'app (`android_build`, APK trouvé ?, `android_launch` avec `apk_path`) ; onglet, cadre, toucher et balayage, zoom, `android_filmstrip`, rotation paysage | 032, 033, 076, 081, 084 | APK Flutter introuvable sous `android/` : ce que dit la carte ; l'app lit l'API (10.0.2.2) ; cadre qui tourne | `execute`, « Liste les émulateurs Android », « Démarre l'émulateur Medium_Phone_API_36.0 » → onglet **Android** ouvert seul, cadre téléphone, « en direct » ✓ ; en-tête étroit « Medium_Phone_A… · en direct · 0… » (nom d'AVD brut, tronqué). « Compiler pour Android — ./gradlew assembleDebug » (1 Compiler…) ✓. **Carte de compilation contradictoire (D17)** : « Build failed after 9 s. » en tête, « BUILD SUCCESSFUL in 8s » plus bas, « Aucun APK produit sous build/outputs/apk » en dernière ligne, et **coche verte**. L'agent comprend seul (« l'outil n'a pas détecté l'APK dans le dossier de sortie propre à Flutter »), trouve l'APK, **configure un relais vers l'API** (`adb reverse`) — Bobine ne l'aide pas sur 10.0.2.2 ni sur le relais. `android_launch` avec `apk_path` → **échec** : la carte « Lance … » (titre vide) montre « adb install -r : adb: failed to install …apk: » **sans la raison** (coupée), avec une coche verte ; l'agent relance `adb` à la main et trouve « not enough space ». APK release arm64 (17,2 Mo) : même refus. **Cause : l'AVD de Jérôme est plein** (`/data` 5,4 / 5,8 Go, 268 Mo libres ; apps tierces dedans) → **app non lancée sur Android**, rien supprimé (dispositif, pas Bobine). Sur l'écran d'accueil : balayage vers le haut → tiroir d'apps ✓ ; toucher « Horloge » ✓ ; boutons Retour / Accueil / Apps / « Joindre » sous le cadre ✓. `android_filmstrip` : grille 4 × 2 visible **même repliée** (dernière image du groupe) ✓. Rotation (`adb … accelerometer_rotation 0`, `user_rotation 1`) : l'écran d'accueil reste portrait (lanceur verrouillé) ; dans l'Horloge, **le cadre tourne en paysage** et s'ajuste (37 %) ✓ ; panneau agrandi : « Medium_Phone_API_36.0 emulator-5554 · en direct · 0 fps » à écran fixe, 18 fps quand il bouge ✓. Rotation remise (portrait, auto) | ✗ (app non lancée : AVD plein) / ~ (Bobine : D17, erreur coupée) | 2 tours + 1 | 4.4-* (19) |
| 4.5 | « Joindre l'écran » Android annoté ; erreurs provoquées : appareil éteint, schéma inexistant | 033, 076, 066, 067, 009 | écran joint et annoté ; erreurs lisibles dans la carte et chez l'agent | « Joindre cet écran au message » sous le cadre Android → miniature, éditeur, cadre autour de la rangée d'apps + texte « L'app Carnet n'est pas installée : où est-elle ? » → envoyé ; l'agent répond juste (installation échouée faute d'espace) ✓. **Appareil éteint** (`adb emu kill` par Bash) : l'onglet affiche « Flux vidéo interrompu (error: device offline) : captures successives. », écran noir dans le cadre ✓ ; `android_tap` → « No Android device running. Call android_devices then android_boot. » ✓ (clair), mais la carte « Touche l'écran » porte une **coche verte** (D17). **Schéma inexistant** : l'accord « Compiler pour iOS » est **redemandé** (autre commande) ✓ ; carte « Compile l'app iOS Inexistant » : « Build failed after 2 s. xcodebuild: error: The workspace named "Runner" does not contain a scheme named "Inexistant". » ✓ lisible, **coche verte** (D17) ; l'agent cite l'erreur | ~ (D17) | 3 tours | 4.5-* (8) |
| X.1 | « Continuer avec Bob… » depuis « Carnet : bugs, plan des statistiques » ; destination des données ; Bob reprend ; résumé juste ? | 108 | dialogue avec destination ; une conversation fille sous l'originale avec l'agent indiqué | Pas dans le menu du titre ; dans la **puce de l'agent** sous la saisie : « Continuer avec · IBM Bob… » / « Nouvelle conversation avec · IBM Bob · OpenCode » ✓. Dialogue « Continuer avec IBM Bob — La conversation reste la même : une nouvelle session s'ouvre chez IBM Bob, le fil reste affiché. · Vos messages partiront à · Agent IBM Bob · Service le service en ligne d'IBM Bob, facturé en bobcoins · L'échange jusqu'ici (118 messages) partira en texte avec votre prochain message, pas avant. Les résultats complets des outils ne sont pas transmis : seulement leur titre et les fichiers touchés. · OpenCode ne recevra plus rien de cette conversation ; sa session reste chez lui. » ✓ (clair et honnête). **Écart au plan** : pas de conversation fille, la **même** conversation continue, avec un séparateur « ⇄ Suite avec IBM Bob · Avant : OpenCode. L'échange précédent lui est transmis en texte avec le premier message. » ✓. « Résume ce qui a été fait et ce qui reste » → 5 lignes, **en partie fausses** : « deux conversations filles… non encore fusionnées », « 27 tests » (réel : fusionnées en 3.3, 40 tests) — les fusions faites par l'app (carte Sous-tâches) ne figurent pas dans le texte transmis (manque). Puce « 0,0788 bobcoins » ; `bob.db` : 0,07882 ✓ ; titre de la tâche chez Bob : « This conversation started with another a… » (D18) | ~ (contexte transmis incomplet, D18) | 1 tour Bob, 0,0788 bobcoin | X.1-* (5) |
| X.2 | Depuis la conversation (Bob) : « Continuer avec OpenCode… » ; choix du modèle ; destination ; un tour | 108 | récents et fournisseurs en avant ; destination = fournisseur | Puce › « Continuer avec · OpenCode · GPT-6.1 Sol (récent · openai) · Flint 40B Free (récent · opencode) · GPT-6 Astra (récent · openai) · OpenCode — autre modèle… » ✓. « autre modèle… » → dialogue avec liste complète (« Modèle par défaut d'OpenCode », puis récents en tête) ; `openai/GPT-6.1 Sol` → « Vos messages partiront à · Agent OpenCode · Modèle GPT-6.1 Sol · Fournisseur « openai », configuré dans OpenCode » ✓ ; « fauxllm » absent (supprimé en 0.2) ✓. Séparateur « Suite avec OpenCode · GPT-6.1 Sol » ✓. « Le résumé ci-dessus est-il exact ? Vérifie avec git » → OpenCode corrige Bob (« partiellement périmé… déjà dans main ») ✓ | ✓ | 1 tour | X.2-* (5) |
| X.3 | Une fille OpenCode lancée depuis une mère Bob (`/split`, chantier d'une ligne) | 097, 112, 118, 108 | carte « Tâches proposées » chez Bob ; fille OpenCode ; compte rendu dans la mère | Retour sur Bob (même dialogue, 0 bobcoin), `/split Corrige une seule faute du README…` → bulle sans « /split », Bob : « I'll propose it as a child conversation » → « 1 tâche proposée · README : renommer la section Contribuer » ✓ ; ≡ → Agent IBM Bob / **OpenCode** ✓, mais avec OpenCode le modèle n'est **pas choisissable** (« Le dernier modèle choisi avec cet agent ») alors qu'il l'est depuis une mère OpenCode (3.1). Lancée → fille OpenCode finie en ≈ 30 s (`af45e0f`, 40 tests), compte rendu dans la mère Bob (« 0,00 $US · 1 échange ») et Bob reprend seul ✓. « Puis nettoyer » coché puis « Fusionner dans main » → « fusionnée · nettoyée — 1 fusionnée dans main en 1 s. Conversation archivée, worktree et branche supprimés. » ✓, **sans brouillon fantôme** (D14 ne se produit pas quand on reste dans la mère). La carte garde les filles 6 et 7 de 3.1 mais **leurs marques « fusionnée » ont disparu** depuis la relance (C11). Tâche Bob intitulée « <child_conversations_request> » (D18). `bob.db` : 0,23999 ; **total Bob de la session 1,3442 bobcoin** | ✓ (réserves D18, C11) | 1 tour Bob + 1 fille, 0,24 bobcoin | X.3-* (6) |
| 5.1 | ⌘K : titres puis contenu, avec et sans accent ; résultat ouvert au bon endroit ; ⌘F dans la conversation ouverte | 015, 046, 086 | recherche plein texte insensible aux accents ; ouverture au bon message | « agents » → 4 conversations (titre et contenu), extrait avec le mot surligné, agent et dossier, « affichée » ✓. « etranger » / « étranger » → « Aucune conversation. » : le mot n'existe que dans des **sorties d'outils** (lectures de `data/books.json`, README), qui ne sont pas indexées (vu dans `conversations/*.json`) — attendu, mais à savoir. « deja fait » = « déjà fait » → 2 résultats (originale et branche) ✓ ; ouvrir le résultat de la branche → la conversation s'ouvre défilée sur le message, mot surligné, ⌘F « déjà fait 1 / 1 » ✓ | ✓ | 0 | 5.1-* (6) |
| 5.2 | Barre latérale : par dossier, épingler, renommer, brouillon, « … » (export JSON, supprimer, suppression côté agent), archiver / désarchiver, filles sous leur mère, largeur | 015, 026, 095, 113 | chaque action et son effet | Options de la liste : « Les plus récentes d'abord / Par dossier de travail / Reprendre une session… » ; « Par dossier » → `carnet-de-lecture` (compteur) puis « Archivées » ✓. **Les archivées de 3.3/3.4** : dans la section repliable « Archivées » en bas de la liste, filles sous leur mère avec ↳ et ✓ ✓. La fille README (X.3), archivée par « Puis nettoyer », reste dans « À traiter » (« Compte rendu à lire ») tant qu'on ne l'a pas lue, hors du compteur « Archivées 3 » ; l'ouvrir la range (« Archivées 4 ») et vide « À traiter » ✓ — mais rouvrir une fille nettoyée relance l'agent dans le dossier principal, qui refuse sa session : bandeau « L'agent n'a pas retrouvé la session (Invalid params: session … does not belong to cwd …) : la conversation continue dans une nouvelle session, sans sa mémoire du début. » (honnête, texte brut). « Épingler » → section « Épinglées » ✓ ; brouillon tapé, autre conversation, retour → brouillon gardé ✓ ; **archiver** une épinglée (clic du pilote sur « Archiver », les menus d'une épinglée et d'une autre n'ont pas les mêmes positions) → dans « Archivées », **épingle perdue** ; « Désarchiver » → de retour dans le dossier ✓. « Exporter en JSON… » → feuille « Enregistrer » native, nom proposé d'après le titre, dossier Documents ✓ ; **enregistrement non vérifié** : l'outil du pilote refuse de valider cette feuille (deux essais), fichier non regardé. « Supprimer » → « Supprimer « Nombre de livres… » ? La conversation disparaît de l'historique de Bobine. Cette action est définitive. ☑ Supprimer aussi la session dans l'historique de OpenCode (si l'agent le permet) · Annuler / Supprimer » ✓ → disparue ; `opencode session list` ne l'a plus ✓. Renommer : joué en 2.2. Bordure de la barre glissée → barre plus large, titres moins tronqués ✓ | ~ (export non vérifié, épingle perdue à l'archivage) | 0 | 5.2-* (17) |
| 5.3 | Relance : titres, ordre, pastilles non lu, « À traiter » vidé | 015, 095, 119 | tout retrouvé | ⌘Q puis lanceur : regroupement par dossier, largeur de la barre, titres et ordre gardés ; « À traiter » vide ✓ ; aucune pastille non lu restante (toutes lues) | ✓ | 0 | 5.3-apres-relance |
| F.1 | Interface en anglais : « Explique ce projet », une autorisation d'outil de Bobine, une question, la carte « Sous-tâches » ; textes restés en français ou venus de l'agent / d'Electron | 074, 014 | tout en anglais sauf le contenu | Réglages › Général › Langue « English » → bascule **immédiate**, sans relance ✓ (y compris menus natifs : File, Edit… « Find… », « Writing Tools »). Accueil « Good evening — ready to get started? », suggestions « Explain this project / Find bugs / Write tests / Make a plan » ✓. Autorisation « Terminal — The agent wants to run in the terminal: git status — 1 Run · The command runs in a terminal tab, visible here · 2 Always in this project · 3 Deny · 1–9 or Return: choose », « Waiting on you », « Waiting for your answer » ✓. Question « README language · Should the README stay in French? · Keep French / Switch to English / Other… (or add details) » ✓. Carte « Subtasks · 3 finished », « 1 file +1 −1 », « $0.00 », « merged · cleaned up », « 1 merged into main in 1 s. Conversation archived, worktree and branch deleted. », séparateur « Continued with IBM Bob · Before: OpenCode… » ✓, au rejeu « Proposed plan · version 2 · View what changed », « Response interrupted. » ✓. **Restés en français** : seulement du contenu — messages et réponses en français, titres de conversations et de tâches proposées écrits par l'agent (« 6 — Liste à lire priorisée »), texte de l'app mobile (« Noter ») : normal. **Venus d'Electron en anglais dans l'interface française** : « Quit and Keep Windows » dans le menu Bobine (0.1) et le panneau « Choisir un dossier » (Search, New Folder, Cancel) — dus au dossier de données imposé (langue native non gérée, `index.ts:248`), à revérifier sans `--user-data-dir` | ✓ | 1 tour | F.1-* (9) |
| F.2 | Thèmes sombre, sépia, nuit noire : cartes clés | 027, 050 | lisibles dans chaque thème | Sépia : fil, carte « proposed task », Sous-tâches, panneau iOS lisibles ✓. Nuit noire : Sous-tâches, carte « Subagents · 2 done », plan « Proposed plan · version 2 » lisibles, contrastes corrects ✓. Sombre : tout le reste de la campagne (captures des actes 0 à 4) ✓. Diff avec remarques : non recapturé (les remarques de 1.6 ont été envoyées, la vue n'en garde pas). En rouvrant l'onglet iOS, **D8 reproduit une 3ᵉ fois** (clic sur l'icône → onglet fermé ; rouvert par « + › Open a tool › iOS ») | ✓ | 0 | F.2-* (5) |
| F.3 | « Signaler un problème » (regarder sans envoyer) ; « Copier les infos techniques » ; `/cost` final ; coûts relus dans `bob.db` | 061, 116, 109, 091 | issue préremplie visible ; rapport copiable ; coûts cohérents | « Report an issue » est dans Réglages › Diagnostics (et la fenêtre « À propos ») ; il ouvre le navigateur du Mac : **non regardé**, l'accès du pilote à Chrome a été refusé — non cliqué. Bouton copier du Diagnostic → ✓, presse-papiers : rapport complet (version, dossier, journal, Shell PATH, « ! Screen recording: denied… → System Settings › … » avec la commande `open`, Bob 2.0.6, OpenCode 2.0.32 « 27 offered, opencode/Flint 40B Free by default », Xcode 26.6, AXe 1.8.0, SDK Android) ✓ — **rien sur l'AVD plein**. « Copier les infos techniques » : joué en 0.2 ✓. `/cost` côté Bob → « Cost: 0.24 bobcoins » : **seulement la dernière session Bob** de la conversation (elle en a eu deux : 0,0788 + 0,2400). `bob.db` (copie lue hors ligne) : 3 tâches de la session, **1,3442 bobcoin** au total | ~ (issue non regardée, `/cost` partiel) | 0 | F.3-* (4) |


## Cartes du fil (grille § 4)

| Carte | Titre | État | Dépliage | Regroupement | Durée / coût | Rejeu | Sombre | Anglais | Note |
|---|---|---|---|---|---|---|---|---|---|
| Outils regroupés (0.5) | ✓ « 2 recherches et 1 lecture » | ✓ coche verte | ✓ chaque outil se déplie à son tour | ✓ 3 outils en une ligne | — | à faire (2.7) | à faire | à faire | |
| Recherche (glob) (0.5) | ~ « Recherche « {package.json,.nvmrc,…,AGENTS.md} » » : le motif brut, long | ✓ | ~ sortie = chemin **absolu** (`/Users/me/…/package.json`) | ✓ | — | | | | |
| Lecture (0.5) | ✓ « Lecture de package.json » (relatif) | ✓ | ~ sous-titre en chemin absolu, puis sortie brute d'OpenCode (« Read file /Users/…, lines 1-11 » + numéros de ligne), sans coloration | ✓ | — | | | | |
| Modification (1.2) | ✓ « Modification de src/books.js et 1 autre » | ✓ | ~ diff coloré, numéros, replis « N lignes inchangées » ✓ ; mais sortie brute en anglais d'OpenCode au-dessus, en-tête du diff en chemin absolu, lignes longues coupées | ✓ dans « 2 lectures, 2 commandes et 1 modification » | — | | | | pas d'« Annuler » sur la carte |
| Commande (1.1, 1.2) | ✓ « npm test », « git status --short » | ✓ | ✓ dossier + sortie, ✔ par test | ✓ | — | | | | |
| Autorisation Terminal (1.3) | ✓ « L'agent veut lancer dans le terminal : git log --oneline -3 » | ✓ en attente (« Attend votre réponse 21 s », « À traiter ») puis ligne « → Lancer / Toujours dans ce projet / Refuser » | — | — | — | | | | 1–9 au clavier : voir AZERTY |
| Terminal de l'app (1.3) | ✓ « Lance « git log --oneline -3 » dans le terminal », « Lit le terminal » | ✗ refusée = ✓ verte (D5) | ✓ texte de l'outil | ✓ | — | | | | |
| execute (OpenCode 2) (1.3) | ✗ « execute » | ✓ | ✗ JSON brut (D6) | ~ rangée dans le groupe | — | | | | |
| Autorisation « Lancer l'app » (1.5) | ✓ « L'agent veut lancer « web » dans carnet-de-lecture : npm start » | ✓ | ✓ port et arrêt expliqués | — | — | | | | |
| Serveurs de dev (1.5) | ✓ « Lance le serveur », « Lance le serveur web » | ~ ✓ même quand l'outil rend « pas de configuration » | ✓ consigne lisible | ✓ « 2 actions sur les serveurs de dev et 1 modification » | — | | | | |
| Navigateur (1.5) | ✓ « Lit la structure de la page », « Exécute du JavaScript », « Affiche la page en taille mobile en sombre », « Capture la page » ; ✗ « Ouvre reload » | ✓ | ~ structure et capture lisibles ; JS et console/réseau en JSON (`\n` littéraux) | ✓ « 1 outil et 7 actions dans le navigateur » | — | | | | miniature cliquable ✓ |
| Image jointe annotée (1.5) | — | — | ✓ image annotée dans la bulle | — | — | | | | |
| Plan proposé (2.1) | ✓ « Plan proposé · version N » | ✓ | ✓ Markdown, passage commenté surligné, « Voir ce qui a changé » ↔ « Voir le plan » (diff) | — | — | | | | D10 : boutons qui glissent |
| Question à choix multiples (2.3) | ✓ étiquette + question + « Plusieurs choix possibles » | ✓ | ✓ cases, « Autre réponse », ligne de réponse « → Statut, Étiquette » | — | — | | | | |
| Sous-agents (2.5) | ✓ « Sous-agent(s) · N fini(s) », type, titre | ✗ « fini < 1 s » pour un sous-agent qui tourne (D12) | ✓ consigne + réponse ; ✓ « Son travail » en direct | ✓ une ligne par sous-agent | ✗ durée fausse, pas de coût (OpenCode n'en donne pas) | | | | |
| Compaction (2.6) | ✓ « Conversation résumée pour libérer du contexte » | ✓ | ~ résumé en Markdown brut (C8) | — | — | | | | |
| Bandeau panne (2.7) | ✓ « L'agent s'est arrêté. Sortie : SIGKILL. » | ✓ ; carte en cours → « ⊘ 1 annulé » | — | — | — | | | | |
| Mermaid (2.4) | — | — | ✓ rendu, source, agrandi, copier | — | — | | | | |
| Remarques sur le plan (2.1) | ✓ passage cité + remarque | — | ✓ message « Remarques sur le plan » lisible | — | — | | | | |
| Question `question` (1.4) | ✓ étiquette + question | ✓ en attente puis réponse en une ligne | ✓ choix expliqués, « Autre » en champ libre | — | — | | | | |
| File d'attente (1.3) | ✓ « Partira à la fin de la réponse » | ✓ | — | — | — | | | | infobulles ✓ |
| Recherche (texte) (0.5) | ✓ « Recherche « node\|Node » » | ✓ | ✓ « Found 10 matches » + lignes, chemins absolus | ✓ | — | | | | |

## Score d'utilisabilité (§ 7.2)

Notes 0 à 3 : ça marche · c'est clair · c'est pratique. Un majeur plafonne sa famille à 6 / 9.

| Famille | Marche | Clair | Pratique | Total | Justification |
|---|---|---|---|---|---|
| Prise en main et réglages | 2 | 3 | 2 | 7 | Réglages complets et cherchables (0.2, 0.3), « Tester » utile ; D1, D2, Bob lancé avant qu'on choisisse l'agent |
| Fil et cartes | 2 | 2 | 2 | 6 (plafond D3) | Flux, regroupements, diffs et Mermaid bons ; `execute` en JSON (D6), chemins absolus (C5), D4, D3 |
| Autorisations | 2 | 3 | 2 | 7 | Cartes exemplaires, « Toujours » révocable ; refus marqué ✓ (D5), relance dans une bulle de l'utilisateur, 1–9 sur AZERTY |
| Questions | 3 | 3 | 3 | 9 | Choix expliqués, multiples, « Autre » libre, ligne de réponse sobre (1.4, 2.3, F.1) |
| Plan | 3 | 3 | 1 | 7 | Mode Plan visible, versions et différence ; D10 a lancé une exécution non voulue |
| Tâches | 3 | 3 | 2 | 8 | Absentes avec OpenCode (attendu) ; vues avec la fille Bob : panneau, liste épinglée, progression |
| Sous-agents | 1 | 1 | 2 | 4 (plafond D12) | « Fini < 1 s » pour un sous-agent qui tourne, réponse jamais mise à jour ; « Voir son travail » sauve un peu |
| Filles et fusion | 2 | 3 | 2 | 7 | Propositions spontanées, autre agent / modèle, fusion avec conflit résolu par la fille ; D13, coût périmé, « Puis nettoyer » perdu |
| Git et worktrees | 1 | 2 | 2 | 5 | Commit / Défaire / fusion avec l'agent bons ; D14, D15, D16, erreurs IPC brutes |
| Navigateur et lancement | 2 | 2 | 2 | 6 | Lancement, inspection, joindre-annoter excellents ; `prompt()` muet (D7), liens `http` morts (D11), onglets qui se ferment (D8) |
| Terminal et mentions | 3 | 3 | 2 | 8 | Sélection → message, `@terminal`, `@git-changes` ; pager de `git log`, mentions de fichiers bruyantes |
| Simulateur iOS | 3 | 2 | 2 | 7 | Compilation, lancement, gestes, zoom, planche contact ; compilation muette, en-tête tronqué, C10, pas de clavier |
| Émulateur Android | 1 | 1 | 2 | 4 | Cadre, gestes, rotation bons ; APK Flutter introuvable annoncé « failed » mais ✓, raison d'échec coupée (D17) ; app non installée (AVD plein, hors Bobine) |
| Coût et quota | 2 | 2 | 2 | 6 | Puce détaillée, pastilles justes, `bob.db` = puce ; `/cost` partiel (Bob), `/context` = `/cost`, coût périmé dans un compte rendu |
| Reprise, pannes et rejeu | 3 | 2 | 2 | 7 | `kill -9` et relance propres, rejeu fidèle carte par carte ; C9, D9, bandeaux de protocole bruts |
| Historique et recherche | 3 | 3 | 2 | 8 | ⌘K plein texte sans accents, ouverture au bon message ; sorties d'outils non indexées, épingle perdue à l'archivage |
| **Total** | | | | **106 / 144 = 74 / 100** | Plus faibles : sous-agents, émulateur Android, git et worktrees |

## Défauts

### Bloquants

### Majeurs

**D3 — Capture d'écran sans l'autorisation « Enregistrement de l'écran » : rien, sans un mot**
(fenêtre rapide, scène 0.5). Contexte : Réglages › Diagnostic affiche « Enregistrement de l'écran :
refusé : une capture ne montrerait que le fond d'écran ». Reproduction (2 fois) : ⌥⌘B depuis le
Finder → appareil photo → la barre se masque, `screencapture -i` attend une sélection (rectangle
visible pendant le glisser) → relâcher → la barre revient, **aucune image jointe, aucun message**,
rien dans `main.log`. Ni le fond d'écran annoncé par le Diagnostic, ni « Capture d'écran
indisponible » (la clé existe dans `fr.json`). L'utilisateur ne sait pas que l'autorisation manque
ni où la donner ; il croit à un raté et recommence. Classé majeur : fonction inutilisable et muette
dans ce cas, qui est celui de toute installation neuve où l'autorisation a été refusée. Piste :
`src/main/screen-capture.ts:50` (`captureScreen` rend `null` quand le fichier est vide, comme pour
Échap) ; `systemPreferences.getMediaAccessStatus('screen')` est déjà lu pour le Diagnostic
(`src/main/index.ts:948`). Captures : 0.5-capture-selection, 0.5-capture-sans-autorisation-rien-joint.
**Rejoué depuis la zone de saisie (2.4) : même chose** (3ᵉ reproduction) ; capture
2.4-capture-saisie-rien-joint.

**D12 — Sous-agents d'OpenCode 2 lancés en arrière-plan affichés « fini, < 1 s »** (2.5).
Reproduction (2 tours : un sous-agent, puis deux) : demander un sous-agent « pendant que tu
continues » → OpenCode rend aussitôt l'outil `task` avec `metadata.status: "running"` et le texte
« The subagent is working in the background… » ; la carte affiche ✓, « 1 fini » / « 2 finis »,
« < 1 s ». Pendant ce temps « Voir son travail » montre le sous-agent qui lit encore, et l'agent
lui-même écrit « l'audit est encore en cours ». Quand le sous-agent finit, rien ne change dans la
carte (la « Réponse » reste le texte d'attente) et ses conclusions n'apparaissent pas : il faut
les demander. Fonction trompeuse sur le point même qu'elle doit montrer (en cours / fini), d'où
« majeur ». Atténuation vue au rejeu (2.7) : une fois le sous-agent fini, « Voir son travail »
contient son rapport final — encore faut-il savoir l'y chercher. Piste : lire `metadata.status`
(`running`) dans l'adaptateur OpenCode et garder la ligne « en cours » tant que la session fille
(`session/load` déjà fait pour « Voir son travail ») n'a pas fini ; y prendre la réponse finale. Journal : `agents.log` lignes ≈ 1024 et 1091.
Captures : 2.5-sous-agent-reponse-running, 2.5-son-travail, 2.5-deux-sous-agents-zoom,
2.5-deux-reponse-running.

### Mineurs

**D4 — Envoyer un message quand le fil est remonté ne ramène pas en bas** (scènes 1.1, 1.2).
Reproduction (2 fois) : dans une conversation finie, remonter le fil (molette) jusqu'au tableau
de la réponse, écrire dans la saisie, Entrée → le message part (la saisie se vide, l'agent répond)
mais le fil reste où il était : on ne voit ni son message ni la réponse qui s'écrit ; il faut
cliquer la flèche ↓. Attendu : l'envoi ramène en bas, comme dans Claude Desktop. Captures :
1.1-envoi-sans-defilement, 1.2-envoi-sans-defilement, 1.3-a-traiter-envoi-sans-defilement (3ᵉ fois).

**D5 — Un outil refusé est marqué ✓ (fini) dans le fil** (scène 1.3). Reproduction (2 fois,
`npm test` puis `git status`) : demander une commande dans le terminal de l'app, choisir
« Refuser » → la ligne « → Refuser » est juste, l'agent comprend, mais la carte « Lance « npm
test » dans le terminal » porte la coche verte d'un outil réussi ; dépliée : « The user refused to
run "npm test". Do not try again. ». La grille § 4 (point 2) attend l'état « refusé ». Journal :
`MCP ← terminal_run … : The user refused…` puis `tool_call_update … completed` : l'outil de Bobine
rend un texte ordinaire, pas une erreur, donc OpenCode le dit « completed ». Piste : rendre
`isError` (ou un état « refusé » connu de l'app) quand l'utilisateur refuse, dans l'outil
`terminal_run` du serveur MCP de Bobine (`src/main/mcp/`). Captures : 1.3-refus-coche-verte,
1.3-refus-deplie, 1.3-refus-2-coche-verte.

**D6 — Carte « execute » d'OpenCode 2 : nom brut et JSON** (scène 1.3, 1 occurrence à ce stade :
OpenCode ne cherche ses outils qu'une fois par session). Dans « 1 outil et 1 action dans le
terminal », une ligne « execute » (identifiant brut) qui, dépliée, montre le JSON de la recherche
d'outils (`{"items": [{"path": "tools.bobine.terminal_run", "description": …, "signature": …}]}`).
La grille § 4 (point 1) exclut l'identifiant brut et le JSON. Un titre comme « Recherche
d'outils de Bobine » suffirait. **Reproduit en 1.5** (« 1 outil et 7 actions dans le
navigateur », même JSON pour `browser_console` / `browser_network`). Même famille : la ligne
« Lit la console de la page · Lit les requêtes réseau de la page » (deux outils appelés par un seul
`execute`) se déplie en un tableau JSON de chaînes avec des `\n` **littéraux** au lieu de lignes.
Captures : 1.3-execute-json-brut, 1.5-execute-json-brut-2, 1.5-console-reseau-json.

**D7 — `prompt()` ne marche pas dans le navigateur intégré, sans un mot** (scène 1.5).
Reproduction (3 clics sur « Noter », puis diagnostic par CDP) : le bouton ne fait rien ; dans la
page, `window.prompt('Note de 1 à 5 ?')` lève « prompt() is not supported. » (limite d'Electron),
l'erreur reste dans la console de la page. `alert` / `confirm` sont gérés (fiche 094,
`browser/page-dialogs.ts`), pas `prompt`. Le développeur qui essaie son app dans Bobine croit son
bouton cassé alors qu'il marche dans Chrome ; l'agent, lui, a deviné juste à partir du code.
Piste : fournir un `prompt` à la page (preload du navigateur, ou boîte de l'app comme pour
`confirm`), ou au moins un bandeau « cette page a appelé prompt(), non pris en charge ».
Captures : 1.5-noter-sans-effet, 1.5-annotation-cadre-texte.

**D8 — Panneau étroit : cliquer l'icône d'un onglet inactif le ferme** (scène 1.5). Reproduction
(2 fois : Terminal, puis Navigateur) : panneau à sa largeur normale, l'onglet actif a son nom, les
autres ne montrent qu'une icône ; cliquer cette icône pour y aller **ferme l'onglet** (il passe
dans le menu « + › Ouvrir un outil »). Le terminal garde sa session, le navigateur sa page, mais
l'utilisateur ne comprend pas où est passé son onglet. Piste : `styles.css:3639-3690` — un onglet
réduit à `min-width: 34px` avec `overflow: hidden`, et le ✕ qui devient visible au survol prend la
place de l'icône. Captures : 1.5-onglets-zoom, 1.5-onglet-terminal-ferme,
1.5-onglet-navigateur-ferme, 1.5-menu-outils-navigateur.

**D9 — Une modification annulée réapparaît comme active** (1.7, 2.1). Reproduction (2 fois :
changement de conversation, puis « Quitter » et relance) : Modifications › Conversation, ↶ sur
`.bob/launch.json` créé par l'agent → « Remettre » → la ligne dit « annulée », le fichier est
supprimé du disque. Revenir sur la conversation → la ligne `launch.json +11 −0` est de nouveau là,
sans « annulée », avec son bouton ↶, et compte dans « 4 fichiers » de l'en-tête ; la vue Git, elle,
ne la montre pas. L'utilisateur croit le fichier présent. Piste : l'état « annulée » vit dans un
`useState` de `ChangesTab.tsx:98`, il n'est ni gardé ni recalculé d'après le disque. Captures :
1.7-original-modifications-sans-annulee, 2.1-rejeu-annulee-perdue.

**D10 — Après « Ajouter la remarque », « Exécuter le plan » prend la place d'« Envoyer mes
remarques »** (2.1). Reproduction (2 fois) : carte du plan, barre « Sélectionnez un passage pour
le commenter. · Envoyer mes remarques · Exécuter le plan » ; sélectionner, « Commenter », taper,
« Ajouter la remarque » → le texte d'aide devient « 1 remarque » (plus court), les deux boutons
glissent vers la gauche et « Exécuter le plan » se trouve exactement sous le pointeur, là où était
« Envoyer mes remarques ». Au 1ᵉʳ essai, le clic suivant a lancé l'exécution (passage en Build,
« Exécute ce plan. », fichiers écrits) au lieu d'envoyer la remarque ; il a fallu arrêter et
défaire à la main. Un bouton qui part dans le dos de l'utilisateur vers une action qui écrit des
fichiers : mineur seulement parce que la capture d'après montre le bon placement. Piste : largeur
fixe pour le texte d'aide, ou boutons alignés à droite. Captures : 2.1-execute-par-erreur,
2.1-boutons-apres-ajout, 2.1-boutons-zoom.

**D13 — Carte « Tâches proposées » : chaque nouvelle proposition décale les boutons sous le
pointeur** (3.1). Reproduction (2 fois : arrivée de « 7 — Tests serveur et page », puis de
« 8 — Application mobile Flutter ») : l'agent ajoute ses propositions une à une pendant son tour ;
la nouvelle ligne s'insère et repousse la ligne qu'on s'apprêtait à lancer ; le clic sur
« Lancer » tombe à côté (rien lancé, ici sans dommage, mais il pourrait tomber sur « Refuser » ou
« Faire ici » d'une autre ligne). Même famille que D10. Piste : ajouter les nouvelles lignes
**sous** celles déjà affichées sans déplacer la ligne dépliée, ou geler la mise en page sous le
pointeur. Captures : 3.1-deuxieme-proposition-decale, 3.1-troisieme-proposition-decale.

**D14 — Après « Nettoyer » une fille, l'app ouvre un brouillon dans le worktree supprimé** (3.3).
Reproduction (2 fois : filles 6 et 7) : fille › Modifications › Git › « Nettoyer » › « Nettoyer » →
la fille part dans « Archivées » ; la fenêtre affiche « Bonsoir, on s'y met ? » avec pour dossier
`20261022-2312-e4cd` (puis `20261022-2313-32a2`) et pour branche `bobine/20261022-…` — le dossier
et la branche qu'on vient de supprimer —, agent « Agent · Arrêté » (sans nom d'agent), sélecteur de
modèle absent, Modifications : « Le dossier n'est pas un dépôt git. » Un message envoyé là
partirait dans un dossier inexistant. Attendu : revenir à la mère (ou à son dossier principal,
comme le dit la confirmation : « la conversation continue dans le dossier principal »). Captures :
3.3-apres-nettoyer-brouillon-fantome, 3.3-apres-nettoyer-brouillon-fantome-2.

**D15 — Changer d'agent sur une conversation en worktree encore vide supprime le worktree**
(3.4). Reproduction (2 fois : Bob → OpenCode, puis OpenCode → Bob) : menu du dossier › « Nouvelle
conversation dans un worktree » → carte « Parti de main… », branche `bobine/2026…` ; choisir
l'autre agent dans la puce → le worktree et sa branche disparaissent (`git worktree list` : seul
`main`), le nouvel agent est lancé dans le dossier supprimé et échoue (« L'agent n'a pas pu
démarrer. ACP connection closed … ENOENT … uv_cwd »), la saisie dit « écrivez pour réessayer ».
Journal : `Agent lancé (opencode…) : opencode acp dans …/.worktrees/20261022-2325-095a` juste après
`session/delete` de Bob. Le brouillon est inutilisable, et rien n'invite à choisir l'agent
**avant** de créer le worktree. Piste : le changement d'agent d'une conversation vide la recrée
(nettoyage de l'ancienne, worktree compris) ; garder le dossier. Captures :
3.4-changer-agent-worktree-supprime, 3.4-changer-agent-worktree-supprime-2.

**D16 — « Ouvrir une PR » ne fait rien sans dépôt distant** (3.4). Reproduction (2 clics) : barre
du worktree, bouton actif « Ouvrir une PR » → rien (ni message, ni journal) ; seule la ligne
générale « Le dépôt n'a pas de dépôt distant : rien où pousser la branche. » l'explique. Attendu :
bouton désactivé avec cette raison en infobulle, ou un message au clic. Capture :
3.4-ouvrir-pr-sans-effet.

**D17 — Outils Android : échecs mal dits** (4.4). Reproduction (2 outils) :
(1) `android_build` d'un projet Flutter : Gradle réussit, l'outil cherche l'APK sous
`mobile/android/…/build/outputs/apk` (Flutter l'écrit sous `mobile/build/app/outputs/…`), passe le
job en échec et ajoute « Aucun APK produit sous build/outputs/apk » ; la carte commence par
« Build failed after 9 s. », contient « BUILD SUCCESSFUL » et porte une **coche verte**
(`src/main/android/gradle.ts:124-130`, `android-tools.ts:115-120`). Attendu : « Build succeeded,
mais l'APK n'est pas là où Gradle le met d'habitude » et, pour Flutter, chercher aussi
`../build/app/outputs/flutter-apk/`. (2) `android_launch` qui échoue : « adb install -r : adb:
failed to install …apk: » — la raison (« not enough space ») est coupée, coche verte, titre
« Lance … » vide ; l'agent a dû relancer `adb` lui-même. Même famille que D5 (état d'erreur non
montré). **Généralisé en 4.5** : `android_tap` sans appareil (« No Android device running… ») et
`ios_build` d'un schéma inexistant (« Build failed after 2 s. xcodebuild: error… ») ont aussi une
coche verte. Le journal montre pourtant `status: "error"` / `"error": true` dans la sortie de
`execute` (OpenCode 2) : l'erreur de l'outil de Bobine, rendue par `execute`, n'atteint pas l'état
de la carte (adaptateur OpenCode, `rawOutput.metadata.toolCalls[].status`). Captures : 4.4-build-failed-deplie, 4.4-build-successful-aucun-apk,
4.4-lance-erreur-coupee.

**D18 — Titres des tâches de Bob pollués par le contexte de Bobine** (X.1, X.3). Reproduction
(2 sessions Bob, lues dans une copie de `~/.bob/db/bob.db`) : après « Continuer avec Bob… », la
tâche s'appelle « This conversation started with another a… » ; après `/split`, «
<child_conversations_request> ». Bob titre une tâche avec le début du premier message ; Bobine y
met son préambule ou son bloc **avant** le message de l'utilisateur. `docs/acp.md` (fiche 118)
dit pourtant que le bloc `/split` est joint **après** le message chez Bob pour cette raison :
écart entre la doc et le comportement (cas de la session neuve qui reçoit aussi l'historique).
L'utilisateur qui retrouve ses tâches dans Bob (IDE, `bob`) ou dans « Reprendre une session… » ne
les reconnaît pas. Mineur.

**D11 — Un lien `http://` dans le fil ne fait rien** (2.2). Reproduction (2 clics, panneau
ouvert puis fermé) : l'agent écrit `[public/stats.html](http://localhost:3000/stats.html)` ;
cliquer : rien, ni navigateur intégré, ni navigateur du Mac, ni message. Diagnostic (CDP) : le lien
a `target="_blank"` ; `src/main/renderer-windows.ts:32-34` n'ouvre que les `https://` et refuse
tout le reste en silence. Or `http://localhost:…` est le lien le plus fréquent d'un agent qui
développe une app web (1.5 : « L'app est lancée sur http://localhost:3000 »). Attendu : ouvrir dans
le navigateur intégré (c'est ce que fait l'agent lui-même), au moins pour `localhost`. Capture :
2.2-lien-http-sans-effet.

**D1 — La confirmation de suppression est invisible sous le pointeur** (Réglages › fournisseurs,
serveurs MCP ; scène 0.2). Reproduction (2 fois, fournisseur puis serveur MCP) : cliquer la
corbeille → l'icône reste grise sur fond gris clair, rien ne dit qu'il faut cliquer encore ;
écarter le pointeur → elle passe en rouge (« Cliquer encore pour supprimer » n'est que dans
l'infobulle). L'utilisateur, qui garde le pointeur sur le bouton, croit que le clic n'a rien fait.
Piste : `src/renderer/src/styles.css:593` (`.icon-button:hover:not(:disabled)`, plus spécifique)
écrase `.icon-button.danger` (`styles.css:6545`). Captures :
0.2-fournisseur-confirmer-sous-pointeur, 0.2-fournisseur-confirmer-hors-pointeur,
0.2-mcp-confirmer-sous-pointeur, 0.2-mcp-confirmer-hors-pointeur.

**D2 — Retirer le seul serveur MCP du projet laisse un `opencode.json` vide** (scène 0.2).
Reproduction : projet sans `opencode.json` ; Réglages › Serveurs MCP › OpenCode › Ajouter un
serveur, portée « Ce dossier », Enregistrer, puis le supprimer → `opencode.json` reste à la racine
du projet avec `{"mcp": {}}`, non suivi par git (`git status` : `?? opencode.json`). L'app laisse
une trace dans le dépôt de l'utilisateur pour une action annulée. (Même chose côté fournisseurs :
`"provider": {}` reste dans `~/.config/opencode/opencode.jsonc`, sans conséquence visible.)

### Cosmétiques

**C1 — Espaces insécables manquantes** (scène 0.2) : dans Général › Sauvegarde de l'historique,
« Le menu « … » » est coupé entre « … et » (le chevron fermant commence la ligne suivante) ; dans
Agents › Fournisseurs, « : ils valent aussi… » commence une ligne par deux-points. Capture :
0.2-general-2, 0.2-agents-fournisseurs.

**C2 — « Fichier de OpenCode »** (Agents › Fournisseurs de modèles ; aussi « Déclarés dans les
fichiers de OpenCode » dans Serveurs MCP) : « d'OpenCode ».

**C3 — Deux « Plein écran » dans le menu Affichage** (scène 0.5, vu 2 fois) : « Plein écran 🌐F »
et « Plein écran ⌃⌘F », et aucun ne dit « Quitter le plein écran » alors que la fenêtre est en
plein écran (⌃⌘F la fait bien sortir). Capture : 0.5-menu-affichage-plein-ecran-double.

**C4 — « Ouvre reload »** (scène 1.5, 1 fois) : rechargement de la page titré comme une
navigation vers l'adresse « reload » ; attendu « Recharge la page ». Capture :
1.5-ouvre-reload-deplie.

**C5 — Chemins absolus dans les cartes** (1.2, 1.5) : en-tête des diffs
(`/Users/me/Development/bobine-recette/carnet-de-lecture/src/books.js`, tronqué en « …/.bob/… »
pour `launch.json`), sous-titre des lectures, dossier des commandes. Les titres sont relatifs
(fiche 107), pas le reste de la carte.

**C6 — Carte d'outil au nom brut tant que l'outil n'a pas d'arguments** (1.7) : « patch » (et
« patch… 11 s » dans la ligne d'état) pendant l'écriture, resté tel quel après Échap.

**C7 — « Remettre 1 fichier dans leur état d'alors »** (1.7, dialogue et bandeau de branche) :
accord au singulier (« son état »).

**C10 — « Lance Bobine-recette-20… »** (4.1) : le titre de la carte `ios_launch` reprend le
premier segment du chemin de l'app (`…/Application Support/Bobine-recette-2026-10/cache/…`), pas
le nom de l'app (« Runner » ou « fr.bobine.carnetMobile »). Avec le dossier de données normal ce
serait « Lance Bobine… » : toujours faux. Capture : 4.1-carte-lance-deplie.

**C11 — Marques « fusionnée » perdues à la relance** (X.3) : la carte Sous-tâches de 3.3 montrait
6 et 7 « ✓ fusionnée » ; après relance de Bobine, plus rien (ni branche), alors que la ligne d'état
« 1 fusionnée dans main en 1 s. » est restée.

**C8 — Résumé de compaction en Markdown brut** (2.6) : la carte « Conversation résumée » dépliée
montre `## Next Move`, `### Active`, `- (none)` en texte monospace, au lieu du rendu Markdown du
reste du fil.

**C9 — Les réponses de `/context` et `/cost` ne sont pas rejouées** (2.7). Trois encadrés vus en
direct (deux avant `/compact`, un après), aucun après ⌘Q et relance ; les bulles des commandes
n'existaient déjà pas en direct. Le fil rejoué n'est plus celui qu'on a vu (grille § 4, point 6),
sans perte grave : ce sont des relevés de l'instant. Captures : 2.6-cost-identique,
2.6-memoire-et-context-apres, 2.7-rejeu-sans-context-cost, 2.7-rejeu-fin-sans-context.

## Pas pratique (sans être faux)

- **Nom de l'agent changeant** (0.1) : « IBM Bob » dans le menu de l'agent et avant le premier
  contact, « Bob » sur la puce et en bas de la barre latérale une fois l'agent lancé (nom annoncé
  par l'agent). Même agent, deux noms à l'écran.
- **Bob démarré sans qu'on le demande** (0.1) : au choix du dossier, l'agent par défaut (Bob) est
  lancé et une session créée avant que l'utilisateur ait pu choisir OpenCode. 0 bobcoin, mais un
  processus et une session inutiles quand on voulait un autre agent.
- **Jargon de protocole dans Réglages › Agents › « Propre à OpenCode »** (0.2) :
  `_meta["opencode/child-session"]`, `rawOutput.metadata.files`, `session/load`… Utile au
  développeur de Bobine, opaque pour l'utilisateur qui déplie l'agent pour savoir « ce que Bobine
  sait faire avec lui ».
- **`git log` lancé par l'agent s'ouvre dans le pager** (1.3) : l'onglet reste « busy: git » sur
  « (END) » jusqu'à ce qu'on tape q, et la sortie s'efface alors. Les commandes de l'agent dans le
  terminal de l'app gagneraient à tourner avec `GIT_PAGER=cat` / `PAGER=cat`.
- **Raccourcis 1–9 des cartes sur un clavier AZERTY** (1.3) : la carte lit `Number(event.key)`
  (`QuestionCard.tsx:82`) ; la touche « 2 » sans Maj donne « é » et ne choisit rien. C'est l'usage
  Mac français (les chiffres sont en Maj), mais l'aide « 1–9 » ne le dit pas.
- **Mention `@` : correspondance floue bruyante** (1.2) : `@books` propose aussi
  `AppFrameworkInfo.plist`, `contents.xcworkspacedata`, `WorkspaceSettings.xcsettings`…
- **Branche et originale indiscernables dans la liste** (1.7) : même titre tronqué, seule la
  flèche ↳ les distingue ; « · branche » n'apparaît que dans l'en-tête.
- « annulée » oublié : reproduit en 2.1, devenu le défaut **D9**.
- **Modifications de l'originale après une branche** (1.7) : l'onglet décrit ce que la
  conversation a fait (`server.js +17 −4`), pas le disque (`+3 −1` après la remise en état de la
  branche) ; la vue Git, elle, dit vrai. Cohérent avec la fiche 023, mais rien ne prévient.
- **Interruption affichée « échec »** (1.7) : une carte arrêtée par Échap passe en « × échec »
  (texte d'OpenCode « Tool execution interrupted »), alors que rien n'a échoué.
- **Tour fini sans un mot** (1.9) : quand l'agent termine sans rien envoyer (`/review`, `/init`
  d'OpenCode : `end_turn` en 8 à 13 ms), le fil n'affiche que la bulle de l'utilisateur ; aucun
  « l'agent a fini sans répondre ». On attend sans savoir.
- **Commandes de l'app étiquetées « IBM Bob · OpenCode »** (1.9) : dans la liste `/`, l'origine de
  `/clear`, `/cost`, `/split`… se lit comme « vient de Bob et d'OpenCode » ; « Bobine » (ou rien)
  serait plus juste, comme « Vous » pour les commandes personnelles.
- **Vue Git sans rafraîchissement ni annulation** (1.9) : un fichier écrit hors tour (AGENTS.md
  par `/init`) n'apparaît qu'après ↻ ; la vue Git n'a pas de ↶ (seule la vue Conversation en a).
- **Relance tardive dans une bulle de l'utilisateur** (2.2) : « J'ai autorisé « npm start » :
  relance preview_start. » apparaît comme si l'utilisateur l'avait tapé, avec un nom d'outil
  interne ; une ligne de service (« Autorisation transmise à l'agent ») serait plus honnête.
- **Modifications › Conversation garde des fichiers supprimés** (2.1, 2.2) : après l'exécution
  arrêtée puis défaite au terminal, `stats.html`, `stats.js` restaient listés « A » avec leurs
  lignes (même famille que D9 : l'onglet dit ce que la conversation a fait, pas le disque).
- **`/context` et `/cost` identiques et anonymes** (2.6) : deux encadrés gris pareils, sans la
  commande ; « Jetons cumulés : 128 400 en entrée » (hors cache) contre « Jetons traités
  7 027 754 » dans la puce (cache compris) : deux chiffres pour la même question.
- **Un plan exécuté reste « à exécuter »** (2.7) : au rejeu, le plan v3 déjà exécuté garde
  « Envoyer mes remarques · Exécuter le plan » actifs, sans mention « exécuté » ; un clic relance
  toute l'exécution.
- **Interrompu : « échec » ou « annulé » selon la cause** (1.7, 2.1, 2.7) : Échap ou ■ → « ✗ 1
  échec » ; agent tué → « ⊘ 1 annulé ». Dans les deux cas l'utilisateur a arrêté, rien n'a échoué.
- **Compilation iOS muette** (4.1, 4.2) : pendant les 30 à 60 s de `xcodebuild`, la carte n'a
  qu'un spinner et ne se déplie pas ; ni étape ni dernière ligne du journal de compilation.
- **Planche contact cachée quand le groupe est replié** (4.3) : la miniature visible est la
  capture finale ; la grille, qui est l'intérêt de l'outil, n'apparaît qu'en dépliant deux niveaux.
- **Saisie clavier vers le simulateur** (4.2, manque) : taper au clavier du Mac dans le champ de
  l'app (focalisé à la souris) n'envoie rien ; seul l'agent peut taper (`ios_type`).
- **Sessions de sous-agents dans « Reprendre une session… »** (3.5) : les sessions filles
  qu'OpenCode crée pour ses sous-agents (2.5) apparaissent au milieu des sessions de l'utilisateur.
- **Agent et modèle du brouillon hérités sans le dire** (3.4) : après des filles Bob / Astra, une
  nouvelle conversation part avec Bob, puis OpenCode avec GPT-6 Astra au lieu de GPT-6.1 Sol.
- **Message de commit proposé tronqué** (3.4) : « docs: ajoute dans README.md une section
  « Contribuer » de trois l » — le titre de la conversation coupé au milieu d'un mot.
- **Nettoyer un orphelin sans confirmation** (3.4), alors que le texte prévient que le contenu est
  supprimé ; « Dossiers récents » et le menu du dossier gardent les worktrees supprimés.
- **Erreurs IPC brutes** (3.4) : « Error invoking remote method 'agent:configure': Error: Dossier
  introuvable : … » affiché tel quel dans le fil.
- **« Puis nettoyer » perdu si l'on fusionne d'abord** (3.3) : après « Fusionner dans main », la
  carte Sous-tâches ne propose plus de nettoyer ; il faut ouvrir chaque fille et passer par sa
  vue Git. Un « Nettoyer les N » sur la carte finale éviterait le détour.
- **Conflit avec `main` non annoncé** (3.3) : « ne touchent pas les mêmes fichiers » ne compare
  que les filles entre elles ; un conflit avec `main` n'est découvert qu'à la fusion (géré
  ensuite très proprement par la fille).
- **Consigne d'une tâche proposée en lecture seule** (3.1) : on peut changer l'agent et le modèle,
  pas raccourcir la consigne (utile pour borner le coût d'une fille Bob) ; ⌘A dans la consigne
  sélectionne toute la page.
- **Coût périmé dans un compte rendu de fille Bob** (3.2, 1 observation) : « 0,5844 bobcoins ·
  2 échanges » alors que la fille, la carte Sous-tâches et `bob.db` disent 1,0253 ; sans doute lu
  avant que Bob n'écrive son coût final. À reproduire à l'acte Bob.
- **« Always allow » de Bob vaut par commande** (3.2) : chaque `node -e` différent redemande ;
  sémantique de Bob, mais l'infobulle de Bobine (« vaudra aussi pour les prochaines
  conversations ») laisse croire à une autorisation large.
- **`/cost` de Bob limité à la session en cours** (F.3) : après deux « Continuer avec Bob », la
  conversation a coûté 0,32 bobcoin, `/cost` dit 0,24.
- **Archiver retire l'épingle** (5.2), et désarchiver ne la rend pas.
- **Menus « … » de positions différentes** (5.2) : une conversation épinglée a « Désépingler » et
  pas « Lancer en parallèle… » ; « Archiver » tombe là où était « Exporter en JSON… ».
- **Rouvrir une fille nettoyée** (5.2) : bandeau « L'agent n'a pas retrouvé la session (Invalid
  params: session … does not belong to cwd …) » — message de protocole brut.
- **Révoquer une autorisation : un clic** (1.3), alors que supprimer un fournisseur ou un serveur
  en demande deux. Cohérent avec le risque, mais les deux gestes se ressemblent (×, corbeille).

## Manques

- **Contexte transmis à l'autre agent sans les actions de l'app** (X.1) : les fusions, commits et
  nettoyages faits par les boutons de Bobine (Sous-tâches, vue Git) n'apparaissent pas dans
  l'échange transmis ; Bob a résumé un état périmé.

- **Chemins en `code` non cliquables** (1.1) : GPT-6.1 écrit les fichiers en `code`
  (`README.md`, `src/books.js`), jamais en lien Markdown ; Bobine ne rend cliquables que les liens
  Markdown. Il a fallu demander « en liens Markdown cliquables » pour obtenir l'aperçu. Un `code`
  qui désigne un fichier existant du dossier pourrait être cliquable.
- **Committer depuis une conversation sur `main`** (1.8) : la vue Git montre les modifications
  mais n'offre ni « Committer » ni message proposé hors worktree ; il faut le demander à l'agent
  ou passer par le terminal.

## Ce qui marche bien (à ne pas casser)

- **Cartes d'autorisation et de question** (1.3, 1.4, 1.5) : une phrase qui dit exactement ce que
  l'agent veut faire, des choix numérotés expliqués, « Autre » en texte libre, puis une ligne de
  réponse sobre dans le fil ; « À traiter » s'allume et s'éteint au bon moment.
- **File d'attente** (1.3) : bandeau clair, modifier / retirer / envoyer maintenant, départ
  automatique.
- **Joindre et annoter une page** (1.5) : du bouton du navigateur à la bulle envoyée, sans
  friction ; l'agent lit l'annotation.
- **Terminal ↔ message** (1.5) : sélection → « Ajouter au message », et `@terminal`.
- **Fenêtre « À propos » et « Copier les infos techniques »** (0.2) : exactement ce qu'il faut pour
  un signalement.
- **Mode Plan** (2.1, 2.2) : visible sans ambiguïté (couleur, pastille, rappel), versions et « Voir
  ce qui a changé », retour automatique en Build à l'exécution.
- **⌘F et ⌘K** (2.2) : rapides, comptés, et ⌘K ouvre la conversation avec la recherche déjà posée.
- **Recherche dans les réglages** (0.3) : insensible aux accents, résultat mis en évidence.
- **« Tester » un fournisseur ou un serveur MCP** (0.2) : message d'erreur précis et conseil utile.

## Défauts de l'agent (OpenCode 2.0.32), hors Bobine

- **Commandes `/review` et `/init` asynchrones** (1.9) : `session/prompt` rend `end_turn` en
  ≈ 10 ms, puis OpenCode travaille (git, `npm test`, écriture d'`AGENTS.md`) sans aucune
  `session/update` : rien n'arrive au client. À signaler à OpenCode ; à vérifier dans
  `pnpm opencode-probe`.
- **Pas de permission pour écrire ni lancer** (1.1, 1.2, 1.5) : permissions par défaut
  d'OpenCode ; les cartes d'autorisation de Bobine n'apparaissent qu'avec ses propres outils.
- **`git log` sans `--no-pager`** dans le terminal de l'app (1.3).
- **Commandes du projet muettes aussi** (2.8) : `/tests` (`.opencode/commands/tests.md`) rend
  `end_turn` en 579 ms sans rien envoyer, comme `/review` et `/init`.
- **Sous-agents en arrière-plan** (2.5) : OpenCode 2 rend l'outil `task` tout de suite
  (`status: "running"`) et ne signale pas la fin au client ACP ; les conclusions n'arrivent qu'au
  tour suivant, si on les demande. Bobine pourrait mieux le montrer (D12), mais la fin du
  sous-agent ne lui est pas annoncée.
- **Résumé de compaction périmé** (2.6) : « confirmed all 18 tests pass » alors que 27 passaient.

## Comparaison avec l'autre agent (second PV)

(à faire après l'acte Bob)

## Journal : WARN / ERROR relevés

Actes 0 et 1 : **aucun** `WARN` ni `ERROR` dans `main.log` (51 lignes) ni dans `agents.log`
(≈ 145 Ko, niveau Trace). Acte 2 : un `WARN` attendu, `20:54:06Z Agent opencode (b00cf3fc…) :
exited Sortie : SIGKILL.` (le `kill -9` de 2.7) ; « Tour fini … : erreur en 98.1 s » et
« cancelled en 62.5 s » (arrêt en 2.1) en `INFO` ; aucun `ERROR`. Acte 3 : `21:17:52Z L'agent
n'a rien envoyé depuis 71.0 s pendant un tour (opencode, b00cf3fc)` (la mère pendant que ses filles
travaillaient ; aucun bandeau vu) ; puis, après chaque « Nettoyer » ou changement d'agent en
worktree (D14, D15) : `IPC changes:git : Error: spawn git ENOENT`, `…Unable to read current
working directory`, `Agent opencode … error Internal error: Internal service failure`, `Agent
bob|opencode … error ACP connection closed` (×4), `IPC agent:configure : Error: Dossier
introuvable : …/.worktrees/20261022-2325-095a` ; aucun `ERROR`. Acte 4, acte croisé, acte 5 et
fin : aucun `WARN`, aucun `ERROR`. **Total : 10 `WARN`, 0 `ERROR`** (`main.log` 27 Ko,
`agents.log` 2,6 Mo, copiés dans `journaux/` à 00:17). Relevé utile : le Diagnostic lance Bob et OpenCode hors conversation
(19:42:09) ; « Quota de IBM Bob : 1 session(s) vide(s) supprimée(s) » à chaque démarrage.

## Journal du pilote

- 21:32 — `.dmg` ouvert (`open`, équivalent du double-clic) : un volume « Bobine » était déjà monté,
  le nouveau monte en « Bobine 1 » (montage d'avant la recette, pas un défaut).
- 21:34 — premier lancement avec le seul `--user-data-dir` : Bobine se croit en essai (fiche 093 :
  dossier de données imposé ⇒ dossier par défaut `<données>/workspace`) et lance **Bob** dans ce
  dossier ; Bob refuse (« Workspace … is not trusted »), 0 bobcoin. Erreur du dispositif, pas de
  Bobine : app quittée, dossier de données effacé (journaux gardés dans
  `journaux/lancement-0-mode-essai/`), `lancer.sh` corrigé (`BOBINE_DEFAULT_WORKSPACE=` vide).
- 21:35 — vrai premier lancement.
- 21:45 — après la fenêtre rapide, la barre des menus montrait « Finder » et le Dock restait
  par-dessus Bobine : le pilote a cru à une sortie du plein écran ; ⌃⌘F l'a en fait fait **sortir**
  (puis rentrer). Fausse alerte du pilote, non notée en défaut.
- 21:49 — fin de l'acte 0. Acte 1 commence.
- 21:52 — « Ouvrir avec l'app par défaut » sur README.md : l'app par défaut des `.md` sur ce Mac
  est **calibre**, qui a ajouté « README » à la bibliothèque de Jérôme (livre n° 11, dossier
  `Inconnu(e)`). Pas touché par le pilote : à retirer dans calibre si besoin.
- 22:05 — CSV de l'export enregistré dans `~/Downloads` (le dialogue n'autorise pas d'autre
  dossier au pilote), puis déplacé dans `opencode/1.5-export.csv`.
- 22:22 — `AGENTS.md` écrit par `/init` en arrière-plan : copié dans
  `opencode/1.9-AGENTS-ecrit-par-init.md`, puis supprimé du projet (« refuser » impossible dans
  l'app).
- 22:25 — fin des actes 0 et 1 ; journaux copiés ; Bobine quittée.
- 22:27 — acte 2 : Bobine relancée, conversation de l'acte 1 rouverte.
- 22:29 — 2.1 : clic du pilote sur « Exécuter le plan » au lieu d'« Envoyer mes remarques » (le
  bouton avait glissé, D10) ; arrêt par ■, fichiers défaits au terminal (`git checkout`, `rm` de
  `public/stats.*`), scène reprise.
- 22:44 — 2.4 : sortie du plein écran le temps de glisser une image depuis le Finder, puis retour.
- 22:54:06 — 2.7 : `kill -9 91968` (agent OpenCode de la conversation) par Bash.
- 23:01 — 2.7 : ⌘Q puis relance au lanceur pour la comparaison du rejeu.
- 23:08 — fin de l'acte 2 ; journaux copiés ; Bobine quittée.
- 23:10 — acte 3 : relance ; l'agent committe l'état (`6f81900`).
- 23:13 — fille Bob (chantier 7) lancée : seule exception Bob autorisée de la session, plafond
  2 bobcoins ; consigne non raccourcissable (lecture seule) ; Bob recadré par un message ; coût
  final 1,025348 relu dans `bob.db` (lecture seule). « Always allow » donné à « Updating todo
  list » (Bob), révoqué en 3.3.
- 23:19 — conflit fabriqué par deux messages (fille 6 et mère réécrivent la ligne 6 du README).
- 23:28 — conflit de 3.4 fabriqué au terminal (commit `6326711` sur `main`, section « Licence »).
- 23:30 — worktree orphelin fabriqué au terminal (`git worktree add .worktrees/20261022-2330-orph`).
- 23:31 — session de terminal : `opencode run -m openai/gpt-6.1-sol "…"` par Bash.
- 23:36 — fin de l'acte 3 ; journaux copiés ; Bobine quittée.
- 23:37 — acte 4 : relance ; familles iOS et Android rallumées. L'émulateur `emulator-5554`
  tournait déjà (lancé avant la session).
- 23:48 — AVD plein : diagnostic par `adb` (`df`, `install` direct de l'APK de 17 Mo : « not
  enough space ») ; `pm trim-caches 4G` sans effet ; rien supprimé (l'AVD contient des apps de
  Jérôme). `./gradlew assembleDebug` relancé deux fois au terminal pour comprendre D17.
- 23:52 — rotation par `adb` (`accelerometer_rotation 0`, `user_rotation 1`), remise ensuite
  (`user_rotation 0`, `accelerometer_rotation 1`, valeurs d'avant).
- 23:54 — émulateur arrêté (`adb emu kill`) pour l'erreur « appareil éteint ».
- 23:57 — fin de l'acte 4 ; journaux copiés ; Bobine quittée.
- 23:58 — acte croisé : Bob autorisé (plafond 3 bobcoins en plus) ; `bob.db` lu par une **copie**
  dans le dossier temporaire du pilote (l'ouverture en lecture seule directe échouait, verrou WAL).
- 00:01 — X.3 : fille OpenCode depuis la mère Bob, fusionnée et nettoyée depuis la carte.
- 00:05 — 5.2 : « Archiver » cliqué par erreur sur la conversation épinglée (positions du menu),
  désarchivée ensuite ; « Nombre de livres… » supprimée (aussi chez OpenCode) ; export JSON non
  validé par l'outil du pilote (feuille d'enregistrement), annulé deux fois.
- 00:09 — F.1 : interface en anglais ; F.2 : sépia, nuit noire ; F.3 : accès à Chrome refusé par
  Jérôme → « Report an issue » non cliqué.
- 00:17 — français et thème Système remis ; journaux copiés ; Bobine quittée. PV clos.

## Fichiers

- PV : `docs/recettes/2026-10-23-recette-opencode.md` (ce fichier) ; protocole :
  `docs/recettes/2026-10-22-plan-campagne-recette.md`.
- Captures : `e2e/captures/recette-2026-10/opencode/` — 542 PNG nommées `<scène>-<quoi>` (actes
  0-1 : 235 ; acte 2 : 105, dont 13 `2.7-rejeu-*` pour la comparaison du rejeu ; acte 3 : 79 ;
  acte 4 : 68 ; croisé, 5 et fin : 55), plus `1.5-export.csv` (export CSV de la page) et
  `1.9-AGENTS-ecrit-par-init.md` (fichier écrit par `/init`).
- Journaux : `e2e/captures/recette-2026-10/opencode/journaux/` — `main.log`, `agents.log` (niveau
  Trace, copiés en fin de session) ; `lancement-0-mode-essai/` pour le faux premier lancement.
- Outils du pilote : `e2e/captures/recette-2026-10/pilote/lancer.sh` (corrigé :
  `BOBINE_DEFAULT_WORKSPACE=` vide), `pilote/cap.sh` (range une capture computer-use en PNG).
- Données de Bobine (gardées pour la suite) : `~/Library/Application Support/Bobine-recette-2026-10`.
