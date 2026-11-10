# Rejeu après corrections — cinq scènes avec de vrais agents (2026-10-23)

Protocole : [plan de campagne](2026-10-22-plan-campagne-recette.md) (§ 3, § 4, § 7.3) ;
défauts d'origine : [PV OpenCode](2026-10-23-recette-opencode.md), [PV Bob](2026-10-23-recette-bob.md),
[synthèse](2026-10-23-synthese-campagne.md). Corrections rejouées : fiches 121 à 126 (fusion `59a1f72`).

## Environnement

| | |
|---|---|
| Bobine | app packagée `dist/mac-arm64/Bobine.app`, construite le 2026-10-23 à 17:25 depuis `main` à `59a1f72` (commit de 17:15), lancée par `e2e/captures/recette-2026-10/pilote/lancer.sh` (données `Bobine-recette-2026-10` gardées, journal Trace) |
| Bob | IBM Bob 2.0.6 (Bob Shell, `bob acp`), mode Agent |
| OpenCode | 2.0.32, modèle `openai/gpt-6.1-sol` (GPT-6.1 Sol), mode build |
| Projet d'essai | `~/Development/bobine-recette/carnet-de-lecture`, `main` à `af45e0f` (deux fichiers `mobile/` non commités trouvés au départ, mis de côté puis rendus) |
| Pilotage | vraie souris (computer-use, plein écran), captures dans `e2e/captures/recette-2026-10/rejeu/` |
| Coût Bob | relu dans une copie de `~/.bob/db/bob.db` (lecture seule) : 21,2992 au départ |

## Scènes

| Scène | Défaut visé | Attendu | Observé | Verdict | Coût | Captures |
|---|---|---|---|---|---|---|
| 1.3 (Bob) | D5 (fiche 122) | un outil de Bobine refusé montre l'état « refusé », pas une coche verte | Nouvelle conversation Bob : « Lance `git log --oneline -3` dans le terminal de l'app ». Carte « Terminal — L'agent veut lancer dans le terminal : git log --oneline -3 » (1 Lancer / 2 Toujours dans ce projet / 3 Refuser) et ligne « À traiter · 1 » (icône question, titre en gras, « à l'instant », raison « Question : … »). Clic sur « Refuser » → la carte de l'outil passe aussitôt à **« ⊗ refusé »** (bouclier barré, gris), ligne de réponse « → Refuser » ; dépliée : « Error from tool mcp__bobine__terminal_run: The user refused to run "git log --oneline -3". Do not try again. » ; Bob : « L'utilisateur a refusé l'exécution de la commande dans le terminal. » **Reproduit** au tour suivant avec `npm test`, refusé au clavier (caractère « 3 ») : même état « refusé », aucune coche verte | ✓ | 0,1698 | 1.3-autorisation-terminal-a-traiter, 1.3-refuse-replie(-zoom), 1.3-refuse-deplie, 1.3-deux-refus-reproduit |
| 2.7 (Bob) | D21 (fiche 121) | après `kill -9` de `bob acp` pendant un tour, le message suivant ne corrompt plus le fil ; ⌘Q et relance : même fil | Conversation neuve, trois tours : `countBooks` dans `src/books.js` (1 lecture et 1 modification), son test puis `npm test` (2 lectures et 1 modification ; 1 modification et 1 commande ; « 41 tests, 0 échec »), puis `booksByYear` avec test. Avant la panne : compteur d'en-tête « 2 +11 −1 » puis « 2 +31 −1 », groupes dépliés capturés. **`kill -9` du pid 93840** (17:33:41, le `bob acp` lancé à 17:29:25 avec la conversation) juste après l'autorisation de `npm test` : en < 3 s bandeau rouge « L'agent s'est arrêté. Sortie : SIGKILL. », saisie « L'agent s'est arrêté : écrivez pour le relancer », pied « L'agent s'est arrêté. Relancer », pastille « Arrêté (planté) » ; le groupe « 3 modifications et 1 commande » reste ✓ et le début de réponse de Bob (« 42 ») reste au-dessus du bandeau. **Message aussitôt** (« Tu as été interrompu : où en étais-tu ? ») → bulle de l'utilisateur gardée, Bob relancé, journal `INFO Rejeu de la session calme (bob, d7f1d6be) : message envoyé après 305 ms`, réponse « La tâche était terminée : j'avais ajouté `booksByYear`… les 42 tests passaient » ✓. Comparaison carte par carte avec les captures d'avant : trois bulles, trois groupes (mêmes lignes, mêmes « Allow once »), bloc de code, texte « Now let me find… », « 41 tests, 0 échec » **identiques** ; aucun texte collé, aucune carte aplatie ; compteur **« 2 +31 −1 » inchangé**. Fil durable : les 19 éléments d'avant la relance sont identiques, deux ajoutés (bulle, réponse). **⌘Q puis lanceur** : conversation rouverte, même fil (groupes repliés comme d'habitude, dépliés identiques), même compteur, fichier du fil durable **octet pour octet** identique à celui d'après la relance | ✓ | 0,7324 | 2.7-avant-panne-*, 2.7-tour3-*, 2.7-panne-*, 2.7-relance-*, 2.7-apres-cmdq-* (15) |
| 2.5 (OpenCode + GPT-6.1 Sol) | D12 (fiche 122) | un sous-agent lancé « pendant que tu continues » reste « en cours » jusqu'à sa vraie fin, puis montre sa réponse finale | « Lance un sous-agent qui audite la sécurité de server.js… pendant que tu continues ; toi, lis src/books.js… ». Carte **« Sous-agent · 1 en cours »**, spinner, « general · Audit sécurité du serveur », chronomètre ; la mère finit son tour (« L'audit de server.js est en cours dans le sous-agent ») et la carte **reste « en cours »** (31 s, 39 s…) ✓ ; dépliée pendant qu'il tourne : CONSIGNE, puis SON TRAVAIL qui grandit en direct (lectures, `node …`), **aucune « Réponse »** (plus le texte « working in the background ») ✓. À la fin réelle : **« Sous-agent · 1 fini », ✓, 1 min 26 s**, RÉPONSE = le rapport final (4 problèmes, du plus grave au moins grave, références `server.js:88-91`…) ✓. Deuxième tour, **deux sous-agents en parallèle** : « 2 en cours » puis « 2 finis », 55 s chacun, réponses finales ✓. **Mais** les deux sous-agents d'un tour précédent, quand un autre message est parti avant leur fin, restent « en cours » pour toujours (nouveau défaut **D25**, reproduit). Le texte répété de la mère (« …par année ou auteur.`src/books.js` exporte… ») vient d'OpenCode (deux résumés dans ses propres morceaux, journal 15:36:54) : pas Bobine | ~ (D12 corrigé ; D25) | 0 | 2.5-sous-agent-en-cours-mere-ecrit, 2.5-mere-finie-sous-agent-toujours-en-cours-31s, 2.5-en-cours-deplie-son-travail-sans-reponse, 2.5-fini-1-min-26-reponse, 2.5-fini-reponse-finale-deplie, 2.5-fini-zoom, 2.5-deux-duos-en-cours, D25-repro-* |
| 3.3 (OpenCode + GPT-6.1 Sol) | D22 (fiche 123) | mère avec des modifications non commitées : « Fusionner les N dans main » refuse en nommant les fichiers et propose « Committer d'abord » / « Mettre de côté », puis la fusion marche ; « Committer » existe dans la vue Git hors worktree | Dossier principal sale (les `src/books.js` et `test/books.test.js` de 2.7). Nouvelle conversation OpenCode : « Deux chantiers indépendants, à confier chacun à une conversation fille… ». Carte « 2 tâches proposées » (fiche 124, voir plus bas), « Lancer » ×2 → deux filles en worktree (`bobine/20261023-1747-e7ae`, `…-ef93`), finies et commitées en ~1 min. Carte « Sous-tâches · 2 terminées » : « Les 2 branches sont finies et ne touchent pas les mêmes fichiers. » puis l'encadré **« ⚠ Fusion refusée : le dossier principal a 2 modifications non commitées. `src/books.js` `test/books.test.js` — La fusion dans main pourrait les écraser. Committez-les d'abord, ou mettez-les de côté : elles reviendront après la fusion. »** avec **« Committer d'abord » / « Mettre de côté » / « Puis nettoyer »**, chemin du dossier en infobulle ✓ (l'encadré remplace le bouton de fusion avant même un essai). « Committer d'abord » → formulaire « Message du commit » prérempli, « Annuler » / « Committer puis fusionner » ✓ (annulé). **« Mettre de côté »** → « ✓ 2 fusionnées dans main en 1 s. Vos 2 modifications mises de côté sont revenues. », lignes « ✓ fusionnée » ; git confirme : `main` à `115cead` (licence `9e59359` + changelog `7dae951`), `src/books.js` et `test/books.test.js` toujours modifiés, aucun stash laissé ✓. **Vue Git de la mère (pas un worktree)** : « Conversation 0 · Git 2 », cases cochées, **« Committer (2) »** → formulaire prérempli → « Committer » → « ✓ Commit 213ad1a fait. Défaire », « Aucune modification depuis le dernier commit » ; git : `213ad1a`, 2 fichiers, 31 insertions ✓. Écarts : le message proposé reprend le titre de la conversation coupé au milieu (« …à confier chacun à une », C14) ; l'infobulle du pied « Branche main · 2 fichiers modifiés » et sa pastille orange restent après le commit (à revoir plus bas) | ✓ (C14) | 0 | 3.3-*, 124-taches-proposees-* |
| 4.4 (OpenCode + GPT-6.1 Sol) | D17 (fiche 122) | `android_build` du projet Flutter `mobile/` trouve l'APK sous `mobile/build/app/outputs/flutter-apk` et la carte dit vrai ; `android_launch` montre une erreur entière si elle échoue | Nouvelle conversation : « Démarre l'émulateur Android et lance l'app mobile (mobile/, Flutter) : android_build puis android_launch, capture à la fin ». Carte « Compiler pour Android — ./gradlew assembleDebug » (1 Compiler / 2 Toujours / 3 Refuser) → « Compiler ». Groupe « 1 outil et 1 action sur l'émulateur Android ✓ » ; « Liste les émulateurs Android · Compile l'app Android ✓ », dépliée : **« Build succeeded in 11 s: …/mobile/build/app/outputs/flutter-apk/app-debug.apk. Call android_launch with apk_path to install and run it. »** ✓ (plus de « Build failed » pour un Gradle réussi). Groupe « 3 actions sur l'émulateur Android ✓ » : Démarre l'émulateur Medium_Phone_API_36.0, Lance app-debug.apk, Capture (miniature dans la carte) ; onglet Android ouvert seul, cadre, « en direct », l'app « Carnet de lecture » tourne (« Connexion impossible » : serveur web non lancé, normal). OpenCode passe tout par `execute` : les états suivent quand même. **Échec provoqué** (« appelle android_launch avec apk_path /tmp/inexistant.apk ») : carte **« Lance inexistant.apk ✗ échec »** (rouge), dépliée : « adb install -r : adb: failed to stat /tmp/inexistant.apk: No such file or directory » **en entier, sur deux lignes** ✓ — alors qu'OpenCode rend l'`execute` « completed » (journal : `metadata.toolCalls[0].status: "error"`, `error: true`), l'erreur atteint la carte (D5 côté OpenCode aussi). Toucher à la souris sur « Réessayer » dans le panneau : l'app recharge ✓. Écart connu : la carte « Liste les émulateurs Android · Compile l'app Android » déplie le JSON brut de `Promise.allSettled` d'OpenCode (défaut 6 du PV OpenCode, toujours là) | ✓ | 0 | 4.4-compile-deplie-build-succeeded-flutter-apk, 4.4-lancement-deplie-app-sur-emulateur, 4.4-launch-echec-erreur-entiere, 4.4-toucher-reessayer |

## Observations à coût nul

**Barre latérale « À traiter » (fiche 125)** ✓. Grille alignée : icône de raison dans une colonne,
titre sur une ligne tronquée par « … », heure alignée à droite (« à l'instant », « 1 min »,
« 7 min »), raison en seconde ligne grise (« Question : L'agent veut lancer dans le terminal… »,
« Autorisation : Modification de src/books.js », « Compte rendu à lire »). Titres en gras tant que
non lus, plus de pastille. Icônes : point d'interrogation accent (question), main accent
(autorisation), coche grise (compte rendu). La ligne disparaît une fois la conversation lue
(compte rendu affiché jusqu'en bas). Le titre d'une autorisation Bob est celui de l'utilisateur,
pas le préambule de Bobine (D24 non revu). Captures `125-a-traiter-*`.

**Carte « Tâches proposées » (fiche 124, D13)** ✓. Les deux propositions d'OpenCode arrivent
ensemble, chacune sur sa ligne (Refuser / Faire ici / Lancer), la nouvelle sous l'ancienne ;
« Lancer » sur la première → « ✓ Lancée », la seconde reste en place à 11 px près (la première
perd ses boutons et raccourcit) : le second clic, au même endroit, a lancé la seconde. Pas de
glissement gênant. Captures `124-taches-proposees-*`.

**Boutons de la carte du plan après « Ajouter la remarque » (fiche 124, D10)** ~. Le glissement
**vers la gauche** a disparu : « Envoyer mes remarques » et « Exécuter le plan » gardent leurs
abscisses (702-863 et 872-991 px) avec « Sélectionnez un passage… », « 1 remarque » ou
« 2 remarques ». Mais à la **première** remarque, le formulaire se replie et la barre **remonte** :
« Exécuter le plan » arrive exactement sous le pointeur resté sur « Ajouter la remarque », survolé
(D27, reproduit). Captures `124-plan-*`, `D27-*`.

## Nouveaux défauts

| # | Gravité | Agent | Défaut | Reproduction | Piste |
|---|---|---|---|---|---|
| **D25** | majeur | OpenCode (app) | Un sous-agent en arrière-plan reste « en cours » pour toujours, sans réponse, quand un autre message part avant que Bobine ait relevé sa fin. | (1) Deux sous-agents lancés « pendant que tu continues » (17:38:29), second message à 17:38:57 : OpenCode les finit à 17:38:51 (`session_message` « idle, succeeded »), Bobine relit leurs sessions jusqu'à 17:39:25 (réponse finale présente), puis plus rien ; cartes « 2 en cours » encore à 3 min 16, fil durable sans `endedAt`. Les deux suivants, sans message après eux, finissent bien (« 2 finis », 55 s). (2) Reproduit : un sous-agent « Liste des routes HTTP » (17:43:42), message suivant à 17:43:58 : fini côté OpenCode à 17:43:57, dernière relecture à 17:44:07, carte « en cours » à 1 min 41 et au-delà. | `agent/subagent-tracker.ts` (`check` : la seconde relecture identique appelle `end`, plus aucune relecture ensuite) puis l'application de `endedAt` / `answer` à une carte d'un tour qui n'est plus le dernier (réducteur ou `conversations/manager.ts`) ; scénario factice `sous-agent-arriere-plan` + un `prompt` envoyé avant la fin |
| **D26** | mineur | les deux (app) | Envoyer un message quand le fil est remonté ne ramène pas en bas : la bulle envoyée et la réponse restent hors de vue (seule la flèche ↓ le signale). Le pilote a cru que son message n'était pas parti et l'a renvoyé (doublon envoyé à l'agent). | 2.5 (deux envois du même message) puis 4.4 (fil remonté de 15 crans, « Merci, c'est tout pour Android. », Entrée : le fil ne bouge pas). | `useThreadScroll.ts` : `scrollToBottom()` n'est pas appelé à l'envoi (`App.tsx` ne l'appelle que pour « Afficher la conversation ») |
| **D27** | mineur | les deux (app) | Carte du plan : à la première remarque, le formulaire se replie et « Exécuter le plan » remonte sous le pointeur laissé sur « Ajouter la remarque » ; un double-clic exécuterait le plan (même risque que D10, dans l'autre axe). | Deux fois sur le plan d'OpenCode (« Ajouter la remarque » à (917, 524) puis (917, 511) → « Exécuter le plan » à (872-991, 497-526), survolé). Avec une remarque déjà là, la barre ne tombe pas sous le pointeur. | `PlanDocument` : garder la hauteur du pied pendant un instant, ou placer le formulaire de remarque sous la barre de boutons |
| **C14** | cosmétique | les deux (app) | Le message de commit proposé (« Committer d'abord », vue Git) reprend le titre de la conversation coupé au milieu d'une phrase : « feat: deux chantiers indépendants, à confier chacun à une ». | Vu deux fois en 3.3 (formulaire de la carte et de la vue Git). | `commitMessage` (fiche 110/123) : couper au mot, sans finir sur un article, ou prendre le premier membre de phrase |

Vu sans être noté (non reproduit) : juste après « Committer » dans la vue Git, la pastille orange
du pied « main • » et son infobulle « Branche main · 2 fichiers modifiés » sont restées 15 s ;
à l'ouverture de la conversation suivante, le pied disait « main » sans pastille.

## Coût Bob

| Scène | Conversation | Coût |
|---|---|---|
| 1.3 | « Lance `git log --oneline -3`… » | 0,1698 |
| 2.7 | « Rejeu 2.7 : dans src/books.js… » (3 tours + relance) | 0,7324 |
| **Total** | relu dans une copie de `bob.db` (21,2992 → 22,2014) | **0,9022 bobcoin** (plafond 4) |

OpenCode (abonnement) : 0 bobcoin. `~/.bob` n'a pas été écrit.

## Verdict

- **D21 corrigé** (2.7 ✓ avec Bob) : la condition du verdict de la synthèse est levée.
- **D5 corrigé** (1.3 ✓ avec Bob ; et côté OpenCode en 4.4, erreur passée par `execute`).
- **D22 corrigé** (3.3 ✓), **D17 corrigé** (4.4 ✓).
- **D12 corrigé pour son cas** (sous-agent attendu jusqu'au bout) mais **D25** (majeur, même
  fonction) le remplace quand l'utilisateur continue la conversation.
- **D3** (capture sans autorisation) : corrigé dans le code (fiche 124), pas rejoué ici (il
  faudrait retirer l'autorisation « Enregistrement de l'écran » de macOS, réglage système que le
  pilote ne touche pas).

Majeurs ouverts : **D25** (+ D3 non rejoué) ; bloquants : 0 ; score avec Bob : 74, inchangé ou
meilleur (famille « reprise et rejeu » réparée). **Release candidate** au sens du § 7.3 ; corriger
D25 avant le tag est recommandé (fonction mise en avant, l'utilisateur ne sait jamais si le
sous-agent a fini), D26 et D27 sont de petites corrections.

## Ce qui reste

- Fiche pour D25 (et D26, D27, C14), puis rejouer 2.5 avec OpenCode, message envoyé pendant que
  les sous-agents tournent.
- D3 : rejouer à la main par Jérôme, autorisation retirée.
- « Puis nettoyer » (carte Sous-tâches) pas essayé : worktrees retirés par le pilote après la
  scène.

## État laissé

Bobine quittée ; émulateur arrêté (`adb emu kill`) ; aucun processus `bob acp` ou `opencode acp`.
Projet d'essai : `main` à `af45e0f`, sans worktree, avec les deux fichiers `mobile/` non commités
trouvés au départ ; le résultat du rejeu (fusions des filles, commit `213ad1a` de 3.3) est gardé
sur la branche `rejeu-2026-10-23`. Captures : `e2e/captures/recette-2026-10/rejeu/` (58 PNG).

## Rejeu de 2.5 après la fiche 127 (2026-10-23, 20:40 → 20:53)

App repackagée depuis `main` à `c6a2943` (fusion de la fiche 127 : D25, D26, D27), `dist/mac-arm64/Bobine.app`
du 23 octobre à 20:39, lancée par le lanceur, mêmes données. OpenCode 2.0.32 + GPT-6.1 Sol, mode
Build (Plan pour D27). Aucun tour Bob : 0 bobcoin. Les heures de fin réelles des sous-agents sont
relues dans une copie de `~/.local/share/opencode/opencode.db` (`session_message`, type `idle`) ;
les heures d'envoi dans `agents.log` (`→ session/prompt`).

| Cas | Attendu | Observé | Verdict | Captures |
|---|---|---|---|---|
| D25, un sous-agent | un message de l'utilisateur part avant la fin du sous-agent ; la carte passe quand même à « fini » avec sa réponse finale | « Lance un sous-agent qui audite la gestion d'erreurs de server.js… pendant que tu continues ». Carte « Sous-agent · 1 en cours » ; message « Pendant ce temps : combien de lignes fait server.js ? » parti à **20:41:38**, la mère répond (« 106 lignes »), la carte reste « en cours » (28 s). Le sous-agent finit côté OpenCode à **20:41:47** : la carte passe à **« 1 fini », ✓, 55 s**, RÉPONSE = le rapport final (problèmes avérés, risques éventuels, références `server.js:51-52`…) | ✓ | 127-cas1-* |
| D25, deux sous-agents | même chose avec deux sous-agents en parallèle | Premier essai non probant : les deux sous-agents rapides (routes, `app.js`) ont fini à 20:43:27 et 20:43:30, avant le message (20:43:32) ; ils finissent bien (« 2 finis », 21 s). Second essai : « l'un audite la sécurité de server.js, l'autre évalue la couverture de test de src/books.js ». Message mis en file pendant le tour de la mère, parti à **20:45:08** ; carte « 2 en cours » ; fins réelles **20:45:31** (couverture) et **20:45:43** (sécurité). La carte passe par « 1 en cours, 1 fini » puis **« 2 finis »** (56 s et 1 min 26 s), réponses finales dans les deux lignes | ✓ | 127-cas2-* |
| D25, après ⌘Q et relance | les cartes restent finies avec leurs réponses | ⌘Q puis lanceur : les trois cartes (1 + 2 + 2 sous-agents) sont « fini », mêmes durées, mêmes réponses dépliées. Un troisième essai après relance (sous-agent qui lit `test/` et `public/`, message parti 3 s après) finit aussi : « 1 fini », 55 s, réponse, « Voir son travail » : 15 outils tous ✓ | ✓ | 127-relance-*, 127-cas3-* |
| D26 | le fil remonté redescend à l'envoi | Fil remonté de 15 crans (carte du sous-agent dépliée en haut), demande des deux sous-agents envoyée : le fil **redescend aussitôt**, la bulle et « Réfléchit… » sont visibles. Même chose à chaque envoi suivant | ✓ | 127-D26-* |
| D27 | la barre de boutons du plan ne bouge ni en x ni en y quand on ajoute une première remarque | Plan d'OpenCode (3 étapes, tri par année), sélection de « Vérifier », « Commenter », remarque saisie : la barre est à y = 593. « Ajouter la remarque » cliqué à (917, 534) : la remarque s'affiche, **la barre reste à y = 593, mêmes abscisses** (« Envoyer mes remarques » 702-863, « Exécuter le plan » 872-991) ; le pointeur tombe sur un espace vide de la carte, plus sur « Exécuter le plan » ; encore à la même place 3 s après | ✓ | 127-D27-* |

**Écarts vus au passage** (non bloquants pour le verdict) :

- **C15** (cosmétique, reproduit sur les six sous-agents) : la durée affichée est celle du suivi de
  Bobine, pas celle du sous-agent. Réel / affiché : 23 s / 55 s ; 8 s et 11 s / 21 s ; 28 s / 56 s ;
  40 s / 1 min 26 s. La fin n'est retenue qu'après deux relectures identiques espacées de 2 à 30 s
  (`subagent-tracker.ts`) ; prendre l'heure du dernier message de la session fille donnerait la
  vraie durée.
- Vu une fois, **non reproduit** (donc non numéroté) : dans la carte du sous-agent « Couverture
  des tests métier », la liste « Son travail » reçue en direct a gardé deux outils (`glob`,
  `grep`) « en cours » alors que le sous-agent avait fini et qu'OpenCode les rend « completed » à
  la relecture ; après ⌘Q et relance, ces deux lignes disent « interrompu ». Ils avaient démarré à
  l'instant même où le message intermédiaire partait (20:45:08). Le troisième essai, où la liste
  vient de « Voir son travail », est juste (15 outils ✓). À regarder : relire la session fille à
  la fin met-elle à jour le travail reçu en direct ?

**Verdict** : D25, D26 et D27 sont corrigés à la vraie souris. 2.5 passe à ✓. Plus aucun majeur
ouvert dans la campagne, hors D3 corrigé dans le code et pas rejoué avec l'autorisation retirée.
