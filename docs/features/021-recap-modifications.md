# 021 — Récapitulatif des modifications

- **Statut** : fait
- **Dépend de** : 006, 029

## Pourquoi

Voir d'un coup tout ce que l'agent a modifié dans la conversation, comme le panneau de diff de Claude
Code, et ouvrir un fichier dans l'éditeur.

## Critères d'acceptation

- [x] Onglet « Modifications » du panneau latéral (fiche 029) : fichiers touchés, +/−, diff complet par fichier.
- [x] Ouvrir le fichier dans l'éditeur par défaut / révéler dans le Finder.
- [x] Basé sur les diffs ACP reçus ; si le dossier est un dépôt git, option « diff git » réel.
- [x] Testé : agent factice ; e2e ; Bob réel.

## Plan

Comme le panneau de diff de Claude Code Desktop : un onglet « Modifications » et un raccourci dans
l'en-tête (« 3 fichiers +12 −4 ») dès que l'agent a modifié quelque chose.

- **Vue « Conversation »** (`shared/changes.ts`, pur) : les diffs ACP des appels d'outil
  **terminés** (pas ceux refusés ou en attente), regroupés par fichier. Les modifications qui
  s'enchaînent (le nouveau texte de l'une est l'ancien de la suivante) sont fusionnées en un seul
  diff ; sinon chaque modification est montrée à part (un agent peut n'envoyer que l'extrait
  modifié). Totaux +/− par fichier.
- **Vue « Git »**, si le dossier est dans un dépôt (`main/changes/git.ts`) : l'état réel du dossier
  par rapport au dernier commit, y compris ce que l'agent a fait par des commandes et ce que
  l'utilisateur a modifié lui-même. `git status --porcelain -z -uall`, `git diff HEAD --numstat -z`,
  puis par fichier `git show HEAD:<chemin>` et le fichier sur le disque, diffés dans le renderer
  (`computeDiff`, comme les cartes d'outil). Fichiers binaires et trop gros signalés, pas affichés.
  Bouton « Actualiser ».
- **Par fichier** : ouvrir dans l'éditeur par défaut (`shell.openPath`), révéler dans le Finder
  (`shell.showItemInFolder`) ; le main n'accepte qu'un chemin à l'intérieur du dossier de la
  conversation.
- IPC : `changes:git`, `changes:gitFile`, `changes:open`, `changes:reveal`.
- Agent factice : étape `edit-file` (carte d'outil avec diff, puis écriture réelle du fichier dans
  le dossier de la session) et scénario `modifications`.
- Pas d'annulation des modifications dans cette fiche (destructif : à concevoir à part).
- Aucune nouvelle dépendance (`diff` est déjà là ; `git` n'est appelé que si le dossier est un dépôt).

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-12 — Fait comme prévu. `shared/changes.ts` (regroupement, fusion des modifications
  enchaînées, totaux mis en cache : le fil change à chaque morceau de texte), `main/changes/git.ts`
  (`GitChangesReader`, garde-fou `insideWorkspace`), `ChangesTab`, raccourci « 2 +6 −1 » dans
  l'en-tête, `DiffView` sans en-tête (`bare`). Tests : analyse des sorties de git, vrai dépôt
  temporaire (sous-dossier, renommage, suppression, binaire, chemin hors du dossier), IPC, e2e
  `changesSuite` (vue « Conversation » avec fusion, vue « Git » avec un fichier modifié par
  l'utilisateur, diff chargé à la demande).
- Bug trouvé avant l'essai : un dossier dont le chemin passe par un lien symbolique (`/var` →
  `/private/var`) faussait le chemin dans le dépôt ; `git show HEAD:./chemin` (relatif au dossier
  courant) le règle.
- **Bob réel** (dépôt jetable `~/bob-essai/modifs-demo`) : « remplace Version 1 par Version 2 dans
  README.md, crée src/hello.js » → « Writing file » et « Applying diff to », deux autorisations,
  outils `completed`, diffs en **texte complet**. Écart : un fichier créé arrive avec
  `oldText: ""` et non `null` → traité comme créé (et reproduit par l'agent factice, option
  `emptyOldText`). Vues « Conversation » et « Git » identiques (2 fichiers +4 −1). Coût :
  0,093 bobcoin.
- Limites : pas d'annulation d'une modification (**levée par la fiche 043** : « Annuler cette
  modification », avec les garde-fous de la branche) ; un agent qui n'envoie que des extraits voit
  chaque modification montrée à part, avec des numéros de ligne relatifs à l'extrait (la vue « Git »
  donne alors le vrai diff) ; la vue « Git » se rafraîchit quand un outil se termine, ou à la main.
- 2026-11-07 — Recette 0.11 avec Bob (M2) : un gros diff déplié dans la vue Git restait sur
  « Chargement… » après une relecture du dépôt (fichier écrit par l'agent, « Actualiser »). Cause :
  la relecture vidait les diffs lus (`setGitDiffs({})`) sans relire ceux des fichiers encore
  dépliés ; seul un clic sur la ligne lisait un diff, d'où le déblocage en repliant puis dépliant.
  Une réponse en route au moment de la relecture pouvait aussi arriver après et poser un diff
  périmé. Maintenant, un effet lit le diff de chaque fichier déplié de la vue Git, une fois par
  état du dépôt (génération incrémentée à chaque relecture ; une réponse d'une génération passée
  est jetée). Test : `ChangesTab.test.tsx` (relecture pendant le chargement, réponse périmée jetée,
  relecture après affichage) ; il échoue sans le correctif.
