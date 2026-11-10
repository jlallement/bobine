# 151 — Validation et livraison du lot familles / consignes

- **Statut** : fait
- **Dépend de** : 149, 150, 115 ; contrôles des fiches 009, 120, 144
- **Agents** : agent factice pour les essais ; aucun changement propre à Bob ou OpenCode.

## Pourquoi

L’utilisateur demande de committer et pousser le lot une fois propre. Les vérifications unitaires
et les scénarios des nouvelles interfaces passent, mais trois contrôles e2e préexistants empêchent
une validation globale verte : état intermédiaire de fusion, version AXe pendant le direct et
confirmation de remise à zéro de l’activité. Il faut identifier leur cause sans masquer un défaut.

## Critères d’acceptation

- [x] Les trois contrôles passent dans les deux thèmes avec toutes leurs assertions utiles.
- [x] Toute anomalie produit avérée reçoit un correctif et un test de régression ciblé.
- [x] Aucun contrôle désactivé, délai relevé ou assertion retirée pour obtenir un résultat vert.
- [x] `./scripts/verify`, build et `pnpm e2e --changed` verts avant le push.
- [x] Captures concernées regardées, fiches 149/150 et index à jour, diff relu.
- [x] Modifications committées et poussées sur la branche courante `main`, conformément à la
      demande après clarification de l’état Git ; worktrees des filles conservés.

## Plan

1. **Diagnostic** : confronter `e2e/suites/{simulator,filles-fusion,usage-board}.mjs` aux composants
   réels et aux scénarios factices. Relever, sur échec, événements de fusion, états DOM et cible
   effective du clic de remise à zéro. Dépôts, profils et outils de test restent jetables.
2. **Simulateur** : observer la version avant le passage aux FPS et vérifier qu’elle reste
   consultable pendant le direct. Conserver les contrôles de débit, vidéo et interruption ; ne
   pas exiger simultanément deux présentations que l’interface alterne volontairement.
3. **Fusion / activité** : corriger la cause démontrée (synchronisation du test ou produit), en
   gardant observation de la résolution, progression, stash/restauration et résultat Git ; garder
   confirmation avant effacement et vérification de reprise de collecte. Si le hook de fusion
   est en cause, couvrir les réponses asynchrones par un test dédié avant sa correction.
4. **Validation** : suites ciblées d’abord ; `VITEST_MAX_WORKERS=2 ./scripts/verify`, puis build et
   e2e sélectionnés depuis `main`, sans vérification lourde concurrente. Regarder les captures ;
   reprendre les échecs jusqu’à un passage global propre, sans appels à un vrai modèle.
5. **Livraison** : mise à jour des fiches et changelogs si comportement visible corrigé ; revue
   complète (dont types IPC, visibilité et capacité des filles, infobulles, persistance des
   consignes). Conserver le petit ajustement d’import `simctl.ts` déjà présent dans le dossier.
   Vérifier la branche distante avant commit/push, sans écraser de travail distant ni modifier
   les worktrees des conversations filles. Aucune fonctionnalité optionnelle ajoutée au lot.

6. **Terminal si le passage global le confirme** : le terminal peut rendre le prompt de démarrage
   avant la sortie de la commande. Adapter le scénario factice avec `pollTool` existant : relire
   jusqu’au résultat attendu, arrêter sur erreur ou échéance existante ; conserver l’assertion
   e2e sur la sortie effectivement reçue par l’agent. Couvrir prompt intermédiaire puis sortie
   et erreur d’outil. Aucun changement du terminal réel ou de son contrat d’attente.

7. **Question à choix unique** : attendre la disparition du questionnaire après le choix, qui
   envoie déjà la réponse ; retirer le second clic conditionnel visant une carte en cours de
   démontage. Conserver le contrôle du résultat exact renvoyé par l’agent.

8. **Ouverture du menu de changement d’agent** : la capture préalable au choix contient déjà
   la confirmation. Ouvrir ce menu au clavier dans le pilote pour séparer l’ouverture du choix
   souris, pendant que ses destinations asynchrones apparaissent. Garder sélection réelle,
   destination, confirmation, transfert du contexte une fois et titre conservé ; reprise ciblée
   puis passage global complet, sans modifier le menu du produit.

9. **Même ouverture dans le scénario d’accueil** : ouvrir également le menu des agents au
   clavier dans `base` et contrôler que sa consultation conserve l’agent factice. La capture
   d’échec montre Bob choisi par le clic d’ouverture, arrêté sur le dossier non approuvé ; aucun
   appel au modèle. Même traitement que `handover`, sans modifier le menu du produit. Relancer
   les deux suites ciblées puis le passage global avec deux jobs pour limiter la contention.

## Journal

- 2026-10-26 — Autorisation explicite de pousser quand le lot est propre. Plan rédigé avant les
  changements de diagnostic et corrections des trois derniers contrôles.
- Diagnostic : le main émet bien toutes les étapes de fusion, dont `resolving`, tandis que le DOM
  ne montre que l’attente puis le résultat. Ancien plan `running: false` utilisé par
  `useChildrenMerge` pour conclure à une interruption. Régression reproduite par deux tests rouges,
  puis corrigée en rattachant chaque lecture à la mère et à l’état interrogé. Trois régressions
  vertes après correction, 32 tests ciblés hook/carte/moteur verts. Pas de modification du moteur
  Git ni du mécanisme de résolution de l’agent.
- Simulateur : version relevée à son apparition avant le passage aux FPS, version aussi vérifiée
  dans leur infobulle ; les deux thèmes passent, contrôles vidéo/interruption inchangés.
- Activité : reprise verte dans les deux thèmes. La lecture asynchrone des worktrees orphelins,
  au-dessus du bouton, peut déplacer ce dernier ; l’essai attend désormais la ligne de résultat
  vide propre à son profil jetable avant de viser. Confirmation et effacement restent vérifiés.
- `pnpm e2e filles-fusion simulator usage-board --jobs 2` : **6 tâches vertes, 59 s**. Captures
  clair/sombre regardées : progression et résultat de fusion, confirmation d’effacement,
  simulateur en direct. Revue des changements terminée (visibilité/capacité des filles, états,
  IPC typé, consignes persistées/exportées, infobulle unique, bornes des composants).
- Réutilisation de `ui.enter()` déjà disponible pour les détails natifs des consignes : aucune
  extension de l’API de `e2e/lib.mjs` nécessaire. Le fichier revient identique à `HEAD`.
- Références distantes actualisées : `main` et `origin/main` identiques avant livraison. Contrôle
  de secrets sur les fichiers modifiés/nouveaux : aucun signal. Six worktrees des filles laissés
  en place. Manifest des fichiers relus et journaux conservés hors git dans `e2e/captures/`.
- Validation générale finale : `VITEST_MAX_WORKERS=2 ./scripts/verify` vert, lint et typage,
  **279 fichiers / 2 082 tests** ; build final vert. Journaux conservés hors git. Le passage
  obligatoire `pnpm e2e --changed --jobs 3` joue les 129 tâches sélectionnées ; résultat à consigner.
- Passage global : terminal clair et sombre lisent le prompt avant l’exécution de `echo` ; la
  capture montre la bonne sortie dans xterm mais pas dans la réponse MCP antérieure. Le scénario
  factice suppose à tort que la première lecture contient déjà le résultat. Les autres suites
  continuent ; aucune publication sur ce passage en échec.
- Premier passage terminé : **126 tâches réussies / 129, trois échecs en 10 min 21 s**. Le
  troisième est un second clic du pilote sur « Envoyer » après une réponse unique déjà envoyée ;
  la capture contient bien « Langage choisi : Rust. », le questionnaire a disparu. Plan étendu
  avant correction de ces deux synchronisations ; produit inchangé.
- Synchronisations corrigées : `pollTool` existant réutilisé pour relire le terminal jusqu’au
  résultat, sans modifier le terminal réel ni son attente de 1 500 ms ; arrêt sur erreur conservé.
  Régression unitaire rouge avant correction, deux tests verts après (prompt intermédiaire puis
  sortie ; erreur sans répétition). Question unique : attente du démontage après le clic qui
  envoie déjà la réponse, contrôle de la réponse exacte maintenu.
- `pnpm e2e terminal questions --jobs 2` : **quatre tâches vertes, 18 s**. Nouvelle vérification
  générale lancée avant de reprendre tout le passage pré-push ; aucun contrôle assoupli.
- Reprise générale : **279 fichiers / 2 084 tests verts**, lint vert, mais deux accès au scénario
  dans les nouveaux tests doivent être protégés pour le typage strict. Garde explicite ajoutée ;
  `pnpm typecheck` repassé vert. Nouvelle exécution complète de `verify` pour clore ce contrôle.
  Captures terminal/questions clair et sombre regardées.
- Vérification finale après garde de typage : `VITEST_MAX_WORKERS=2 ./scripts/verify`
  **entièrement vert : lint, typage, 279 fichiers / 2 084 tests** (258 s de tests). Journaux
  bruts et preuve rouge/verte conservés hors git dans `e2e/captures/151-*.log`.
- Deuxième passage global : **128 tâches réussies / 129, un échec en 10 min 19 s**. Terminal et
  questions verts dans les deux thèmes. `handover light` : après le contrôle du menu, avant le
  clic de choix prévu, la capture `h1-menu-continuer-light.png` contient déjà la boîte de
  confirmation. Le clic d’ouverture du pilote a donc également sélectionné la destination
  asynchrone ; le second clic attend une ligne de menu déjà démontée. Ouverture au clavier
  prévue pour distinguer ces gestes, sans modifier le produit ni retirer de contrôle.
- `pnpm e2e handover --jobs 2` : **deux tâches vertes, 8 s** ; captures des menus dans les
  deux thèmes regardées, ouverture distincte du choix. Lint et formatage du pilote modifié verts.
  Aucun changement des sources ou tests TypeScript depuis `verify` entièrement vert ; reprise
  du build et des 129 tâches e2e sur ce dernier ajustement du pilote.
- Troisième passage : le scénario `base light` retrouve la même sélection lors de l’ouverture
  souris du menu des agents. L’agent Bob a démarré puis refusé le dossier non approuvé ; aucun
  prompt envoyé au modèle. Preuve conservée hors git (`151-base-click-through-light.txt/png`).
  Le transfert `handover` corrigé passe. Plan étendu avant de corriger le second site du pilote.
- Troisième passage terminé : **128 tâches réussies / 129, un échec en 10 min 20 s**, limité
  à l’ouverture du menu dans `base light`. Les autres scénarios passent. Correctif du pilote
  appliqué au second site ; assertion ajoutée pour garder l’agent factice pendant la consultation.
- `pnpm e2e base handover --jobs 2` : **quatre tâches vertes, 18 s** ; l’agent factice reste
  sélectionné à la consultation. Lint et formatage du second ajustement de pilote verts.
  Nouveau build puis passage global des 129 tâches avec deux jobs, mêmes assertions et délais.
- 2026-10-27 — **Passage global entièrement vert** : build puis
  `pnpm e2e --changed --jobs 2`, **129 tâches réussies, zéro échec, 14 min 36 s**. Mêmes suites
  et assertions, moins de concurrence ; aucun contrôle sauté. Journaux du build et du passage
  conservés hors git (`151-two-jobs-*.log`). Captures concernées regardées dans les deux thèmes,
  dont les menus de `base` et `handover`. Sources et changelogs inchangés depuis leur validation,
  derniers ajustements de pilotes relus et lintés. Fiches 149/150 et index clôturés pour la
  validation ; commit et push à effectuer, puis résultat de livraison à consigner.
- 2026-10-27 — Lot committé et poussé sur `origin/main` :
  `5e51962a7ed19ef4424f4baf7cc5a6d04f83c701` (`feat: stabilize conversation families and expose child instructions`).
  Push confirmé (`79765bb..5e51962`), dépôt propre et aligné après livraison. Six worktrees des
  filles conservés. Cette clôture documentaire est livrée séparément ; aucune source ni essai
  ne change après le passage global vert.
