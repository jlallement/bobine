# 267 — Corrections de la recette réelle de la refonte (travail délégué)

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 260 (cadre), 261–266 (lots), 258 (états des travaux), 259 (modèle refusé)
- **Agents** : les deux — tout est générique ; la reconnaissance du quota épuisé est déclarée dans
  le profil d'OpenCode (`modelRefusedAtTurn`, comme le refus de modèle de la 259), ADR-0011

## Pourquoi

Recette réelle du 20 novembre avec OpenCode (`docs/recettes/2026-11-20-recette-refonte-travail-delegue.md`).
La refonte tient, mais la relecture donne une fausse assurance : `@Code reviewer` « Relis ce qui a
été fait » n'a relu que le dernier commit, un commit de fusion, et la carte a dit « Rien à
signaler » (N1) ; le clic sur `fichier:ligne` ouvre un diff « Aucune modification » (N2). Un quota
gratuit épuisé s'affiche en erreur brute en anglais (N3). L'activité d'une carte montre des
commandes de dix lignes (N4). Plus une série de mineurs (N5–N10, R7, F6, F8, D14, D17, D24).

## Critères d'acceptation

- [x] **N1** `@Code reviewer` sans portée précise (portée d'office) :
  - non commité : le non commité, plus les commits de la conversation non relus s'il y en a
    (`git diff <base>`, une branche : la branche contre sa base) ;
  - rien de non commité, une branche : la branche contre sa base (inchangé) ;
  - rien de non commité, branche principale : les commits de la conversation (premier parent
    depuis sa création, ou depuis le dernier commit relu), à défaut les 5 derniers ; **jamais un
    commit de fusion seul** (sa base devient le point commun de ses parents).
  - La carte dit toujours ce qui a été relu (« Relu : 4 commits, 12 fichiers (ffa5062..db4a5e1) »),
    remarques ou rien à signaler.
- [x] **N2** `fichier:ligne` d'une portée commitée : le diff de la portée relue (base..commit relu),
  même si le fichier a changé depuis — et la vue le dit ; une portée avec du non commité : le diff
  relu à nouveau à chaque changement du dépôt ; fichier hors de la portée : dit, avec le code cité.
- [x] **N3** « Free usage limit reached » (`-32603` d'OpenCode 2.3.0) : carte « Modèle refusé » avec
  « Choisir un autre modèle », motif précis dans le profil, sans faux positif ; dans la carte d'un
  travail, l'état et le choix d'un autre modèle **du travail**.
- [x] **N4** Activité en direct : une seule ligne coupée (première ligne, ≈ 80 caractères), la
  commande entière en infobulle.
- [x] **N5** Saisie avec un rôle : essais de composant et e2e (envoi pendant la lecture du dossier,
  juste après le choix du rôle, double Entrée) ; texte jamais perdu.
- [x] **N6** Consigne des rôles : « résumé de deux lignes », plus « compte rendu » (fr, en).
- [x] **N7** Aide avant la frappe en gris (`--muted`).
- [x] **N9** « Relancer » ne repose pas de bulle.
- [x] **N10** Tuile et tableau de Mon activité : même compte d'échanges sans coût.
- [x] **R7 / D35** « À lire » tombe quand la réponse est vue (carte dépliée et visible, ou
  conversation affichée), erreurs comprises.
- [x] **F8** Après « Répondre à <rôle> », focus dans la saisie.
- [x] **F6** Big Pickle : signal regardé, décision documentée.
- [x] **D14** Indicateur : durée du tour, l'étape en plus petit.
- [x] **D17** Travaux de la barre latérale dans l'ordre de lancement.
- [x] **D24** Première étiquette de mois entière.
- [x] Testé contre l'agent factice (scénarios `quota-gratuit`, `commande-longue`) ; captures `267-*`
  clair et sombre pour N1, N2, N3, N4, N10.

## Plan

**N1 — portée d'office** (`src/main/conversations/review-target.ts`, `src/shared/review.ts`,
`children-review.ts`, `src/shared/children.ts`)

1. `TargetSource` : `startedAt` (création de la conversation) et `lastReviewed` (commit de fin de
   la dernière relecture finie de cette conversation, lu dans son fil).
2. Nouvelle portée `commits` : `base` (commit, ou l'arbre vide), `commit` (HEAD relu), `commits`
   (nombre), `withUncommitted`. Calcul : premier parent depuis HEAD, au plus 50 commits ; base = le
   dernier relu s'il est ancêtre de HEAD et différent, sinon le premier commit d'avant la création
   de la conversation, sinon (aucun commit de la conversation) les 5 derniers. Une plage réduite à
   un commit de fusion : base = `merge-base --octopus` de ses parents.
3. Non commité (`auto`) : branche → branche contre sa base (non suivis compris) ; branche principale
   avec des commits de la conversation non relus → `commits` + `withUncommitted` ; sinon le non
   commité seul (comme avant).
4. `Review` : `commits`, `head` (commit de fin relu), `withUncommitted` ; `reviewBrief`,
   `askText`, contexte de la mère (`children.ts`) pour `commits`.
5. Carte : ligne « Relu : … » (`ReviewScopeLine` dans `WorkReview.tsx`), dans tous les états finis.

**N2 — diff d'une remarque** (`git.ts` `fileDiff`, `ReviewFileDiff.tsx`, `ChangesTab.tsx`, `ipc.ts`)

6. `DiffTarget.until` (le commit relu, portée commitée) ; `changes:gitFile(…, since, until)` : la
   version relue au lieu du disque, et `changedSince` si le disque diffère. Bandeau : « version
   relue · ce fichier a changé depuis ». Sans `until` : relu à chaque relecture du dépôt
   (`git` en dépendance : cause du « Aucune modification » figé après le correctif). Fichier
   inchangé dans la portée : « Pas modifié dans ce qui a été relu ».

**N3 / N8 — quota** (`opencode-contract.ts`, `profiles.ts`, `turn-auth.ts`, carte d'un travail)

7. `modelRefusedAtTurn.quota` : motif `^(Internal error: )?Free usage limit reached\b` au code
   `-32603`, vaut pour le modèle de la session (le message ne le nomme pas) ; `model.reason:
   'quota'` → sous-titre « quota gratuit épuisé ». Agent factice : scénario `quota-gratuit`.
8. Carte d'un travail « attend » à cause d'un modèle refusé : le dire, avec « Choisir un autre
   modèle » (réglage de modèle **du travail**, `setControl` sur sa conversation, le message refusé
   repart comme dans la 259).

**Mineurs**

9. N4 `WorkCard.tsx` `factText` : première ligne, 80 caractères, `title` = commande entière.
10. N5 `useRoleCompose.tsx` : tests de composant (lecture du dossier, juste après le choix, double
    Entrée) ; texte remis si l'envoi n'a pas eu lieu ; e2e ciblé.
11. N6 `builtin-fr.ts`, `builtin-en.ts`.
12. N7 `RoleCompose.tsx`, `roles.css` : classe `role-destination-hint`, `--muted`.
13. N9 `roles:reply` avec `retry` : pas de nouvelle bulle (`children.ts`, `WorkFoot.tsx`).
14. N10 `usage/stats.ts` : un coût nul en monnaie d'un modèle non gratuit compte « sans coût ».
15. R7 `attention.ts` : réponse en erreur effacée comme une réponse finie ; signal « vu » du
    renderer pour une carte dépliée et visible (`attention:seen`).
16. F8 `useRoleCompose` / `WorkFoot` : focus vérifié par un essai, corrigé si besoin.
17. D14 `WorkingIndicator.tsx` ; D17 `history-order.ts` (`createdAt`) ; D24 `UsageChart.tsx`.

Pas de nouvelle dépendance.

## Causes trouvées

- **N1** : portée d'office `commit` = HEAD contre son premier parent. Dans la recette, HEAD était
  `db4a5e1`, fusion de `master` **dans** la branche du travail d'édition (premier parent : la
  branche), puis `master` avancé dessus : le diff ne portait que le thème sombre.
- **N2** : deux causes. (1) La remarque visait `src/storage.ts`, hors de la plage relue
  (`e5af1b1..disque`) : « Aucune modification » sans explication. (2) `ReviewFileDiff` lisait le
  diff une seule fois (`useEffect` sur `[conversationId, path, since]`) : la liste Git se
  rafraîchissait après le correctif (+22 −8, capture `092019`), pas lui. Le bloc n'avait par
  ailleurs aucun style (icône qui débordait à gauche).
- **N3** : `modelRefusedAtTurn` ne reconnaissait que « Model unavailable: <id> » ; le refus de quota
  (`agents.log` 07:55:01.908Z et 07:56:10.930Z) ne nomme pas le modèle.
- **N8** : un travail refusé ainsi passe « en attente » (`needs-action`, pas de `turn-error`) ; sa
  carte disait « Attend votre réponse dans sa conversation » sans raison ni issue.
- **N4** : `factText` prenait le titre de l'outil entier (la commande de l'agent).
- **N5** : non reproduit tel quel (essais de composant : Entrée juste après le choix du rôle,
  double Entrée, envoi refusé ; e2e `travail-recette`). Un vrai chemin de perte trouvé en
  cherchant : pour un rôle qui écrit, l'envoi attend la lecture du dossier, et ce qui était tapé
  pendant cette attente était effacé au départ de la demande. Corrigé. Hypothèse la plus probable
  pour la recette : l'outil de test (texte posé par DevTools sans évènement de saisie React : l'état
  de la saisie restait vide, Entrée n'envoyait rien et React remettait la zone à vide).
- **N6** : la consigne `REPORT` des rôles intégrés (fr, en).
- **N7** : classe `role-destination-warn` (`--warn`) pour une aide.
- **N9** : « Relancer » passait par `roles:reply`, qui pose toujours une bulle de suite.
- **N10** : la tuile comptait les tours sans aucun coût ; le tableau dit aussi « coût inconnu » un
  coût nul en monnaie d'un modèle qui ne se dit pas gratuit (fiche 266).
- **R7 / D35** : (1) la règle de la fiche 258 laissait une réponse **en erreur** « à lire » tant que
  la conversation du travail n'était pas ouverte, alors que la carte (263) la montre entière ; (2)
  le reste de la recette vient du pilote, dont la fenêtre n'a pas le focus (`scripts/pilote`) :
  « vu » demande la fenêtre au premier plan (fiche 024), rien ne pouvait tomber. La règle de la 258
  (mère affichée, fenêtre au premier plan) est gardée ; un essai fixe aussi le cas sans focus.
- **F8** : toutes les saisies montées recevaient le jeton de suite et demandaient le focus ; avec
  deux conversations côte à côte, l'autre pouvait le prendre. Le focus lui-même était bien demandé
  (essai qui le fixe, avec un terminal qui l'avait avant).
- **F6** : OpenCode envoie `cost: { amount: 0, currency: "USD" }` pour Big Pickle
  (`__traces__/opencode-2.3.0/*.ndjson`), exactement comme pour un modèle payant par abonnement
  (GPT-6.1 Sol) ; son nom ne dit pas « free », et la liste des modèles n'a aucune autre
  information. Aucun signal fiable : laissé « coût inconnu » (règle de la fiche 266).
- **D14** : l'indicateur montrait le temps de l'étape (fiche 128), la durée du tour en infobulle.
- **D17** : `nestChildren` gardait l'ordre de la liste, triée par dernière activité.
- **D24** : la dernière étiquette de mois (« nov. ») dépassait de la grille ; la zone défilait de ce
  dépassement et, calée à droite, coupait la première en « . ». En fenêtre étroite, une étiquette
  à moitié sous le bord gauche se lisait aussi « 's ».

## Journal

- 2026-11-20 : fiche et plan.
- 2026-11-20 : fait, un commit par point (N1, N2, N3/N8, N4, N6/N7, N9, N10, N5, R7, F8, D14, D17,
  D24), chacun avec l'essai qui échoue sans lui.
  - **N1** `review-target.ts` : `conversationRange` (premier parent, 50 commits au plus ;
    `lastReviewed` si ancêtre de HEAD, sinon la création de la conversation à la seconde près — un
    commit de la même seconde compte d'avant —, sinon les 5 derniers ; plage réduite à une fusion :
    `merge-base --octopus` de ses parents) ; non commité : plus ces commits s'il y en a de non
    relus ; branche : non suivis compris. `ChildReviews.target` passe `createdAt` et
    `lastReviewed` (dernière carte `reported` de portée commitée avec `head`). `Review` : `commits`,
    `head`, `withUncommitted` ; `reviewBrief`, `askText`, contexte de la mère. `review-scope.ts`
    (`reviewRange`, `reviewedText`) ; ligne `work-review-scope` dans la carte, et dans la carte
    « Relecture » d'avant pour la portée `commits`. Essais `review-target.test.ts` (la recette
    rejouée, création, dernier relu, fusion seule, 5 derniers, non commité, branche),
    `children-review.test.ts`, `WorkReview.test.tsx`.
  - **N2** `git.ts` `fileDiff(…, since, until)` : la version de `until` au lieu du disque,
    `changedSince` ; IPC et preload ; `DiffTarget.until` (= `Review.head`) ; `ReviewFileDiff` :
    « version relue (a..b) », « a changé depuis la relecture », « pas changé dans ce qui a été
    relu », relu avec l'état du dépôt (`refresh`) ; styles. Essais `git.test.ts`,
    `ChangesTab.test.tsx` (dont celui qui échoue sans `refresh`), `WorkReview.test.tsx`.
  - **N3 / N8** `MODEL_UNAVAILABLE.quota` (motif ancré), `turn-auth.ts`, `model.quota`, avis
    `agentHost.modelQuota`, sous-titre de la carte ; `thread/WorkBlocked.tsx` (`WorkWaiting` :
    l'instantané du travail, raison et `ModelPickButton` → `agent:setControl` du travail). Scénarios
    `quota-gratuit`, `commande-longue`. Essais `turn-quota.test.ts` (l'erreur réelle, faux
    positifs, hôte d'agent), `BlockerPanel.test.tsx`, `WorkCard.test.tsx`.
  - **N4** `oneLine` (80 caractères, première ligne), infobulle `title`, CSS une ligne.
  - **N5** `typedAfter` dans `dispatch` ; essais `RoleComposerLoss.test.tsx`.
  - **N6** `builtin-fr.ts`, `builtin-en.ts` (« résumé de deux lignes, sans titre » ; ADR-0046 : la
    consigne d'un rôle intégré est dans la langue de l'interface, ADR-0014 ne s'applique qu'aux
    textes de l'app). Un rôle déjà installé dans un agent (mode natif) est signalé « à mettre à
    jour » par le mécanisme existant.
  - **N9** `RolesReplyRequest.retry`, `ChildConversations.reply(…, { retry })`.
  - **N10** `stats.ts` `addTotals` : `costNotReported` + `isFreeModel`.
  - **R7** `AttentionTracker.reportSeen` : `done` ou `error`.
  - **F8** `RoleInvokeOptions.motherId`, posé par la carte ; une autre saisie l'ignore.
  - **D14** `WorkingIndicator` : `.working-time` = tour, `.working-step` = étape (si ≠ tour).
  - **D17** `nestChildren` : filles triées par `createdAt`.
  - **D24** `MonthLabels` : calée à droite près du bord, masquée à moitié défilée.
  - **e2e** : `relecture-commits` (N1, N2 ; captures `267-relecture-portee`, `-diff-relu`,
    `-corrige-depuis`), `travail-recette` (N3, N4, N5, N8 ; `267-quota-carte`, `-quota-travail`,
    `267-activite-commande`), `cout-connexion` (N10 ; `267-activite-cout-inconnu`) ; `activity`
    (commentaire D14).

- 2026-11-20 : `./scripts/verify` vert (5 412 essais ; une fois, `bob-costs.test.ts` en délai sous
  charge, vert seul puis au verify suivant, fichier non touché). `pnpm build && pnpm e2e --changed`
  (fichiers globaux touchés : toute la suite, 228 tâches, clair et sombre, une campagne) : vert en
  20 min 38 s. Captures `267-*` regardées (clair et sombre).

## Écarts au plan

- R7 : pas de signal « carte vue » du renderer : la règle de la 258 suffit une fois les erreurs
  comprises, et le cas observé venait du pilote sans focus. « Carte dépliée et visible » n'est donc
  pas une condition plus stricte que « fil de la conversation affiché » (voir Doutes).
- N5 : le remontage de la saisie pendant un envoi (conversation neuve, accueil → fil) ne remet pas
  le texte en cas d'échec ; il reste dans l'historique de la saisie (↑), enregistré avant l'envoi.

## Doutes

- R7 : faut-il que « vu » demande la carte à l'écran (et dépliée dans une carte de groupe), et non
  seulement le fil de la mère affiché ? Ce serait plus strict que la fiche 258 ; à trancher.
- Le pilote des recettes ne donne pas le focus à la fenêtre : toute recette future y verra des
  « à lire » qui ne tombent pas.
- Onglet Modifications à la largeur des e2e : « Actualiser » est au-delà du bord du panneau, et son
  clic fait défiler le panneau de côté (vu dans `267-relecture-corrige-depuis`, corrigé dans la
  capture seulement) ; constat à part.

## Hors de ce lot

- **D21** (« Merge branch 'main' into bobine/… » : sens du commit de fusion, ADR-0022) : suite à
  décider. La relecture n'en dépend plus (N1).
