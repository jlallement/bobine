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

- 2026-11-20 : décisions du tech lead sur les doutes. R7 : la règle de la fiche 258, erreurs
  comprises (pas de signal « carte vue »). Pilote, remontage de la saisie (N5), chiffre de la tuile,
  rôles déjà installés (N6) : acceptés, en limites ci-dessous. « Actualiser » qui débordait de
  l'onglet Modifications : corrigé. La barre (`ChangesBars.tsx`) regroupe branche, « Faire
  relire » et « Actualiser » dans un bloc calé à droite (`.changes-bar-actions`), et la barre passe
  à la ligne (`flex-wrap`) au lieu de déborder. Cause : la liste des vues ne rétrécit pas
  (`flex-shrink: 0`), et la barre n'avait pas le droit de passer à la ligne. À la largeur des e2e,
  « Actualiser » sortait de 24 à 26 px, et son clic faisait défiler l'onglet de côté. e2e
  `relecture-commits` : contournement retiré ; assertion « aucun débordement horizontal » (diff relu,
  après « Actualiser », fenêtre de 900 px) ; elle échoue sans le correctif (vérifié : 26 px, puis
  24 px défilés). Capture `267-relecture-900`.

- 2026-11-20 : revues UX et QA indépendantes, tout appliqué (sauf le point 16 de la revue UX,
  noté en suite), chaque défaut avec un essai qui échoue sans son correctif.
  - **Portée d'office, règles écrites** (`review-target.ts`) :
    - commits de la conversation = premier parent depuis HEAD, datés d'après sa création **et**,
      quand `git config user.email` est connue, faits par l'utilisateur local : un commit d'un autre
      (un `git pull`) arrête la plage ;
    - depuis le **HEAD relu** de la dernière relecture finie d'une plage de commits
      (`Review.reviewedHead`, toujours enregistré, non commité compris) ; `head`/`until` ne
      servent qu'au diff ;
    - tout relu jusqu'à HEAD : dossier propre, la plage de la conversation **relue de nouveau**,
      et dit (« nouvelle relecture des N commits… ») ; avec du non commité, le non commité seul ;
    - fusion seule : la base commune de ses parents seulement si les autres côtés apportent des
      commits d'après la création, dans la limite de 50 commits ; sinon son premier parent ;
    - clone superficiel : jamais l'arbre vide, la plage part du commit frontière, et dit ;
    - sous-modules exclus des fichiers (`diff --raw`, mode 160000), comptés et dits ;
    - git en échec ou trop lent : « La relecture n'a pas pu lister les fichiers », jamais « rien
      à relire » (`ReviewListError`) ;
    - `--end-of-options` avant les révisions venues d'ailleurs (base d'un worktree, branche de
      base) : une base « `--output=…` » n'écrit plus de fichier (essai) ;
    - « Relancer » repart sans rien de la portée d'avant ; le main refuse `retry` d'un travail qui
      a répondu ou travaille encore.
  - **Carte** : « Relu : les 4 commits de cette conversation, 3 fichiers », « … depuis la dernière
    relecture », « les 5 derniers commits (début de la conversation introuvable) », historique
    partiel, sous-modules ; plage en chasse fixe discrète (infobulle) ; sans remarque, fondu dans
    « Rien à signaler · relu : … » ; avec remarques, sous l'avis, avant la liste.
  - **Diff d'une remarque** : plage introuvable → contre HEAD, dit ; `changedSince` gardé pour un
    binaire ou un trop gros ; fichier hors de la portée → ses lignes citées, telles qu'elles
    sont, mises en avant, sans +/− ; « Corrigé depuis… » court avec « Voir la version actuelle » ;
    liste Git vide sur une ligne sous un diff relu. Essais : supprimé, renommé, binaire, commit
    inconnu.
  - **Travail bloqué par un modèle refusé** : `ConversationSummary.modelRefused` (instantané de
    son agent) ; en-tête « quota épuisé » / « modèle refusé » (`workCard.cue.*`, alerte), ligne
    de groupe, barre latérale (alerte, pas la main), Session › En cours (« bloqué », sans durée ni
    Arrêter) ; la carte dit « Le message repartira avec le modèle choisi » et un échec du
    changement de modèle ; son état lu par `roles:workState` (sans le fil), une lecture plus
    ancienne qu'un statut reçu jetée.
  - **Carte de quota** : « Choisir un autre modèle » principal, la clé d'API en contour ; invite
    « … ou ajoutez une clé d'API » ; pas d'avis en double dans le fil tant que la carte est là.
  - **Activité** : blancs réduits à une espace puis coupe à 80 ; un heredoc se lit « un script node
    (9 lignes) ».
  - **N5** : une demande refusée revient toujours devant ce qui a été tapé depuis, séparée d'un
    retour à la ligne.
  - Actions d'une carte en un bloc qui passe à la ligne entier ; barre de défilement de la grille
    de Mon activité au survol seulement, réglée par colonne ; e2e : les captures `echec-*` d'une
    suite repassée au vert sont effacées (`staleFailureFiles`).
  - **e2e** : `relecture-commits` (+ `267-relecture-rien-a-signaler`, `-hors-portee`),
    `travail-recette` (en-tête bloqué, barre latérale, action principale, pas d'avis en double),
    `activity` (`267-indicateur-etape`, `-720`, scénario `etapes-longues`), `roles-travail`
    (`roles-travail-3a-jeton-vide`, aide grise vérifiée par sa couleur calculée),
    `cout-connexion` (`267-activite-720`, pas de barre permanente).

- 2026-11-20 : après les revues, `./scripts/verify` vert (5 438 essais). e2e ciblées, une
  campagne à la fois : `relecture-commits travail-recette changes activity roles-travail
  cout-connexion`, puis `filles repere connexion-expiree` — vertes. Suite complète (228 tâches,
  clair et sombre) : un premier passage a eu 11 échecs (`filles`, `repere`, `inbox` sombre en
  délai, sous la charge d'une campagne d'un autre worktree lancée pendant la nôtre, verts seuls ;
  `connexion-expiree` attendait l'avis en double que la revue UX retire : essai mis à jour). Un
  second passage, sans autre campagne (relevé toutes les 30 s), est vert en 21 min 14 s. Aucune
  capture `echec-*` restante. Captures `267-*` et `roles-travail-3a-jeton-vide` regardées.

## Écarts au plan

- R7 : pas de signal « carte vue » du renderer : la règle de la 258, erreurs comprises, est retenue
  (décision du tech lead).

## Limites connues

- Dépôt jeune : moins de 5 commits en tout, « les 5 derniers » relisent depuis le premier commit
  (l'arbre vide) — accepté.
- Les commits de la conversation sont reconnus à leur date (à la seconde) et à leur auteur
  (`user.email` du dépôt) : un commit fait dans la même seconde que la création compte d'avant ;
  sans adresse configurée, la date seule.
- `lastReviewed` ne vient que d'une relecture de plage de commits (`commits`, `commit`) : une
  relecture du non commité seul laisse les commits d'avant à relire.

- Le pilote des recettes (`scripts/pilote`) ne donne pas le focus à la fenêtre. « Vu » l'exige
  (fiche 024) : en recette par le pilote, les « à lire » ne tombent pas.
- N5 : quand la saisie est remontée pendant un envoi (conversation neuve, de l'accueil au fil), un
  échec ne remet pas le texte dans la zone. Il reste dans l'historique de la saisie (↑),
  enregistré avant l'envoi.
- Mon activité : les échanges à coût nul d'un modèle qui ne se dit pas gratuit comptent maintenant
  « sans coût communiqué » dans la tuile. Son chiffre augmente pour les utilisateurs d'un
  abonnement (dit dans le CHANGELOG).
- N6 : un rôle intégré déjà installé dans un agent (mode natif) est signalé « à mettre à jour »
  par le mécanisme existant, jusqu'à sa réinstallation.
- F6 : Big Pickle reste « coût inconnu » ; aucun signal fiable de gratuité.
- La reconnaissance du quota épuisé est celle d'OpenCode 2.3.0 (motif déclaré dans son profil) ;
  un autre texte ou un autre code reste une erreur de tour ordinaire.

## Suites

- Revue UX, point 16 : harmoniser les formats de durée (« 1 min 05 » de l'indicateur, « 1:05 » de
  la carte, « 1 min 46 s » du pied) — à décider.
- À 720 px, l'invite de la saisie passe sous « Messages précédents » (vu dans
  `267-indicateur-720`), et « Code ⌘1 / Discussion ⌘2 » déborde de la barre latérale (D25) :
  constats à part, non traités ici.

## Hors de ce lot

- **D21** (« Merge branch 'main' into bobine/… » : sens du commit de fusion, ADR-0022) : suite à
  décider. La relecture n'en dépend plus (N1).
