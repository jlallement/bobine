# 152 — Version 0.6.0 macOS, Linux différé

- **Statut** : fait
- **Dépend de** : 059, 111, 115, 145, 149, 150, 151
- **Agents** : les deux ; aucun changement du protocole ou de l’interface des agents.

## Pourquoi

Jérôme retient une 0.6.0 macOS avec les améliorations déjà validées, sans attendre la préversion
Linux. Les notes contiennent encore des étapes intermédiaires devenues obsolètes ; la version du
paquet est 0.5.0. Il faut préparer et publier un DMG cohérent, puis essayer celui réellement livré.

## Critères d’acceptation

- [x] Version 0.6.0 dans `package.json`, notes FR/EN datées du 27 octobre 2026, cohérentes avec
      les familles stables, les états par icônes et l’annotation de la page vivante.
- [x] Linux reste expérimental et absent de cette publication ; sa cible est reportée dans la
      fiche 145 et l’index. L’ADR-0032 accepté reste intact : les futurs paquets Linux pourront
      accompagner une version ultérieure du Mac avec le même numéro et le même tag.
- [x] `./scripts/verify`, build et suite complète `pnpm e2e --if-needed` verts avant le tag.
- [x] App macOS packagée vérifiée (`codesign`, `pnpm e2e:packaged`), capture regardée.
- [x] Commit de préparation poussé après le contrôle `pnpm build && pnpm e2e --changed`.
- [x] Tag `v0.6.0` publié, workflow Release vert, seul le DMG macOS joint à la Release.
- [x] DMG publié téléchargé, monté en lecture seule, version, architecture ARM64 et signature
      vérifiées ; le même DMG a passé `e2e:packaged` nativement sur le runner ARM64 avant sa
      publication, avec un agent factice externe et aucun appel à un vrai modèle.

## Plan

1. **Préparation** : vérifier main et les versions distantes ; lire le commutateur GitHub
   `BOBINE_LINUX_RELEASE` (absent = publication Linux désactivée). Aucun secret affiché.
2. **Métadonnées** : passer `package.json` à 0.6.0 ; renommer « Prochaine version » / « Next
   version », supprimer les descriptions contradictoires de la barre latérale et de la page
   figée ; conserver les informations utiles et les versions historiques. Mettre à jour la
   fiche 145 et son entrée d’index, ajouter cette fiche. Aucune dépendance nouvelle, aucun
   changement fonctionnel, aucune modification d’un ADR accepté.
3. **Synchronisation si un test existant échoue** : dans l’essai de vrai shell, une lecture peut
   ne contenir que l’écho de la commande. Relire jusqu’au résultat dans le budget initial de deux
   secondes ; conserver couleurs, absence d’échappements, sortie et événements. Aucun changement
   du terminal réel, aucun délai relevé. Reprise ciblée puis `verify` complet.
4. **Validation et préparation locale** : `VITEST_MAX_WORKERS=2 ./scripts/verify` ; relire les
   métadonnées, la documentation et cet ajustement de test, puis créer le commit local de préparation.
   Aucun push à ce stade ; le commit permet d’essayer un build portant la référence qui sera taguée.
5. **Paquet et architecture** : relever l’architecture réelle, pas seulement le nom du DMG.
   Le Mac d’exécution local est Intel ; son paquet local est un essai de comportement uniquement.
   Ajouter `e2e/packaged-ci.mjs` : HOME et profils shell jetables, un exécutable `opencode`
   factice externe à l’app qui lance l’agent ACP factice du dépôt via Node, puis l’essai packagé
   existant, sans message modèle. Le tester sur le paquet local, mêmes assertions.
6. **Recette native avant publication** : dans `release.yml`, vérifier Node et le Mach-O ARM64,
   monter le DMG en lecture seule, lancer ce pilote sur l’app montée puis démonter ; capturer
   l’écran en artefact. Le workflow publie seulement si ce contrôle et la signature passent.
   Aucun agent réel installé pour ce contrôle, aucun changement de l’app ou dépendance nouvelle.
7. **Validation finale** : lint/typage/tests, commit du contrôle natif ; build et
   `pnpm e2e --if-needed --jobs 2` pour les sources/build qui seront tagués. Regarder les captures
   des Nouveautés dans les deux thèmes. Contrôle `--changed` avant push et tampon vert avant tag.
8. **Publication** : pousser main, vérifier le commutateur Linux et l’absence de tag 0.6.0 ;
   taguer et pousser `v0.6.0`. Suivre le workflow sans toucher aux worktrees des filles.
9. **Recette du téléchargement** : vérifier les fichiers de la Release et télécharger son DMG ;
   contrôler son empreinte publiée, monter en lecture seule, vérifier sa version, son Mach-O ARM64
   et sa signature. Le test natif a déjà porté sur ce DMG dans le workflow ARM64 ; l’hôte Intel
   ne peut pas l’exécuter. Regarder sa capture CI, démonter, consigner le résultat dans la fiche
   et l’index, sans modifier le tag.

## Journal

- 2026-10-27 — Choix utilisateur confirmé : 0.6.0 macOS uniquement, Linux livré ultérieurement.
  Main propre et alignée, dernière Release publiée v0.5.0. Aucun commutateur
  `BOBINE_LINUX_RELEASE` défini sur GitHub : le workflow existant ne publiera pas Linux sur le tag.
- Préparation : `package.json` à 0.6.0 ; notes datées et consolidées en FR/EN (trois sections
  latérales, annotation de la page vivante, limite de délégation implicite). Les sections 0.5.0
  et antérieures restent identiques. Cible Linux reportée dans la fiche 145 et l’index, aucun ADR
  accepté modifié. `pnpm install --frozen-lockfile` a restauré le stockage local après une tentative
  automatique de pnpm dans le bac à sable ; lockfile et versions des dépendances inchangés.
- Premier `verify` : lint et typage verts ; **2 083 tests verts / 2 084**. Le test de vrai shell
  lit seulement l’écho de `printf …; echo $((6*7))` avant l’exécution et conclut trop tôt. Plan
  complété avant correction : attendre la ligne de résultat dans les mêmes deux secondes, avec
  toutes les assertions existantes, sans modification du terminal de l’app.
- Ajustement du seul test de vrai shell : lectures successives jusqu’à la ligne `42`, bornées
  par une échéance de deux secondes prise avant la première lecture. Les quatre tests ciblés
  passent (3,3 s), toutes les assertions d’origine restent présentes. Revue et formatage verts ;
  nouvelle exécution complète de `verify` avant le commit de préparation.
- `VITEST_MAX_WORKERS=2 ./scripts/verify` entièrement vert après la synchronisation du test :
  lint, typage et **279 fichiers / 2 084 tests**. Aucun délai relevé, aucune assertion retirée.
  Commit local de préparation avant la construction du paquet et la suite complète de pré-tag.
- Le paquet local passe `codesign`, version 0.6.0 et tous les contrôles de lancement,
  isolation, découverte d’agents, terminal et AXe ; architecture réelle **x86_64**, comme le Node
  et le Mac d’exécution locaux, malgré le dossier `mac-arm64` choisi par le builder. Ce paquet
  local ne sera pas publié. Les journaux du dernier workflow réussi confirment un runner
  `macos-15-arm64` : le livrable GitHub sera contrôlé nativement sur ce runner avant publication.
  Plan complété avant d’ajouter ce contrôle et son pilote isolé à agent factice.
- Pilote CI testé avec succès sur le paquet local Intel : mêmes contrôles de lancement,
  isolation, absence de profil factice embarqué, découverte via le shell de connexion, terminal
  et AXe ; seul OpenCode est trouvé, sous la forme de la fixture externe. Aucun vrai agent appelé.
  Le workflow ajoute le contrôle Node/Mach-O ARM64 et monte le DMG en lecture seule avant cet
  essai, puis conserve la capture en artefact. Reprise de `verify` avant le commit de ce contrôle.
- `verify` entièrement vert avec le pilote de paquet : lint, typage, **279 fichiers / 2 084
  tests**. Syntaxe du bloc shell natif vérifiée par `bash -n`. Capture locale regardée. Le contrôle
  CI est committé avant le build et la suite complète qui doivent porter la référence du tag.
- Premier pré-tag à deux jobs : **126 tâches réussies / 129**, quatre contrôles en échec
  (cycle de worktree sombre, diagnostic des capacités, infobulle de l’historique clair). La capture
  du diagnostic montre une découverte des vrais Bob/OpenCode installés et Bob encore en attente.
  Avant correction : réutiliser le principe du shell/PATH neutre de `diagnostic` pour `platform`
  (script neutre/export dans `e2e/lib.mjs`, appliqué seulement à cette suite), garder tous ses
  contrôles de capacités. Reprendre ces trois suites sans concurrence ; ne pas forcer la vue Git
  ni supprimer les assertions d’infobulle. Puis passage complet à un job avant tout tag.
- Reprise `pnpm e2e worktree-cycle history platform --jobs 1` : **cinq tâches vertes, 1 min 11 s**.
  Worktree/historique inchangés, toutes les assertions passent sans concurrence. Le diagnostic
  utilise seulement le shell/PATH neutre appliqué à `platform` ; les autres suites restent
  inchangées. Lint/formatage des deux fichiers de pilote verts, aucun nouveau délai. Passage
  complet de pré-tag repris à un seul job après commit de cette isolation.
- Passage à un job : le contrôle des propositions en rafale observe une ancre prise avant le
  déplacement CDP du pointeur, puis un déplacement pendant l’arrivée des lignes. Avant correction
  du test : viser le bouton stabilisé par `ui.center`, laisser traiter l’événement de survol,
  mesurer ensuite l’ancre et vérifier qu’une seule proposition est encore là. Garder l’égalité
  stricte avant/après, la ligne dépliée, l’ordre et le bouton sous le point visé. Aucun changement
  du composant ou de son mécanisme de retenue du fil ; reprendre `filles` isolément pour vérifier
  cette synchronisation avant un nouveau passage complet.
- Premier passage complet à un job : **128 tâches réussies / 129, 27 min 21 s** ; seul le
  contrôle de rafale échoue. Ajustement du pilote : visée stabilisée, événement de survol traité,
  puis ancre ; nouvelle assertion confirmant qu’une seule proposition est encore présente.
  L’égalité stricte de position, l’ordre, la ligne dépliée et la cible du bouton restent vérifiés.
- Reprises `filles --light` puis `filles --dark` : **vertes**, 1 min 04 s chacune ; ancre avant/après
  identique (1090,548) et condition de départ verte dans les deux thèmes. Lint vert ; aucun
  changement du composant ni du défilement de l’app. `about --lang en --jobs 1` : **deux tâches
  vertes, 14 s**. Captures des Nouveautés FR/EN clair/sombre regardées.
- Pré-tag final sur `180ca49` : **129 tâches vertes, zéro échec, 27 min 01 s**, avec
  `pnpm build && pnpm e2e --if-needed --jobs 1`. Le tampon de suite complète verte est produit
  pour ce build et ces sources. Aucune modification de l’app après les contrôles ; publication
  et recette ARM64 natives restent à effectuer. Notes FR/EN clair/sombre regardées.
- Commits de préparation poussés sur `main`, puis tag `v0.6.0` sur
  `180ca49adf0b1402fc447c24ed391c4972b4e4c4`. Contrôle de pré-push : build vert,
  `--changed` ne sélectionne que la fiche de suivi hors carte ; `--if-needed` confirme le tampon
  complet vert pour les mêmes sources/build. GitHub : `BOBINE_LINUX_RELEASE` toujours absent,
  aucun tag 0.6.0 préexistant. Workflow de publication 40519611305 en cours.
- **Publication réussie** : workflow [40519611305](https://github.com/jlallement/bobine/actions/runs/40519611305)
  vert sur le tag `v0.6.0` (`180ca49`). `verify`, construction, signature et essai natif du DMG
  monté en lecture seule sont verts sur ARM64 ; Linux est sauté. Capture native récupérée et
  regardée. [Release 0.6.0](https://github.com/jlallement/bobine/releases/tag/v0.6.0) stable, seul
  fichier joint : `Bobine-0.6.0-arm64.dmg`. Notes publiées identiques à la section FR de la 0.6.0.
- Recette du téléchargement : **129 997 371 octets**, empreinte SHA-256 vérifiée contre GitHub :
  `d93485f52ccf23b353e90d624a22705c1e77719cd1c5ae2ed2973bef2f55a610`. DMG monté en lecture seule,
  version 0.6.0, Mach-O **arm64**, identifiant `dev.bobine.app`, signature ad hoc et runtime durci ;
  `codesign --verify --deep --strict` vert. Image démontée après contrôle. L’exécution native de
  ce même DMG a été validée dans le workflow ARM64 avant publication ; aucune exécution ARM64
  revendiquée sur l’hôte Intel local. Aucun message envoyé à un vrai modèle.
- Clôture documentaire après le tag ; le tag publié reste inchangé. Les six worktrees des filles
  sont conservés. Aucun changement fonctionnel de l’app ou dépendance nouvelle dans ce lot.
