# 110 — Cycle complet des worktrees et sortie git

- **Statut** : fait
- **Dépend de** : 021 (récapitulatif des modifications), 036 (worktrees), 080 (journal), 097
  (conversations filles) — décision : ADR-0022 (proposé)
- **Agents** : les deux. Tout passe par `git` en ligne de commande dans le main process et par un
  message ordinaire à l'agent ; aucun code propre à un agent (ADR-0011).

## Pourquoi

Une conversation en worktree (fiche 036) ou une fille (fiche 097) travaille sur sa branche, et
l'app en montre le diff. Mais pour que ce travail revienne dans `main`, il faut aujourd'hui ouvrir
un terminal : committer, pousser, fusionner, nettoyer. C'est le point 8 de la feuille de route de
l'audit du 2026-10-21 (section 9) : **le travail de l'agent revient dans `main` sans terminal**.

## Ce que l'app fait déjà (relu le 2026-10-21)

- **Création** (`main/changes/worktrees.ts`, `Worktrees.create`) : « Nouvelle conversation dans un
  worktree » dans le menu du dossier, si le dossier est dans un dépôt git avec au moins un commit.
  `git worktree add -b bobine/<date>-<heure>-<hasard> <dépôt>/.worktrees/<nom> HEAD` ;
  `/.worktrees/` exclu localement ; un sous-dossier garde son chemin relatif. La conversation
  retient `worktree: { root, path, branch, base }` (`base` : le commit de départ, pour compter les
  commits de la branche). Rien n'est dit de ce commit dans le fil, ni des modifications non
  commitées du dossier d'origine, qui ne sont pas dans le worktree.
- **Filles** (`conversations/children.ts`) : « Lancer en parallèle… » et `start_child` créent la
  fille par le même `createInWorktree` ; la mère reçoit un compte rendu (branche, fichiers) et
  `child_status` dit « its branch is not merged ».
- **Diff** (`panel/ChangesTab.tsx`, `main/changes/git.ts`) : onglet « Modifications », vue
  « Conversation » (diffs ACP) et vue « Git » (`git status` / `git diff HEAD` du dossier, diff par
  fichier à la demande, « Ouvrir », « Afficher dans le Finder », remarques sur les lignes). Aucune
  action git : ni commit, ni poussée (la vue « Git » avec commit et PR de la fiche 037 a été
  retirée par la fiche 049).
- **Suppression** (`ConversationMenu.tsx`, `Worktrees.status / remove`) : la confirmation dit les
  modifications non commitées et les commits de la branche ; « Supprimer aussi le worktree et la
  branche » coché seulement s'il n'y a rien à perdre ; un worktree jamais touché disparaît à la
  fermeture de l'app. Un worktree dont la conversation a été supprimée sans cette case reste sur le
  disque, invisible depuis l'app.
- **Branche** : montrée sous la zone de saisie (`ComposerContext`) et dans la liste (icône).

## Critères d'acceptation

- [x] **Départ explicite** : à la création d'un worktree (conversation ou fille), le fil dit de
      quelle branche et de quel commit il part (hash court, date, sujet). Si le dossier d'origine
      a des modifications non commitées, un avis le dit : elles ne sont pas dans le worktree.
      La même information est rappelée en tête de la vue « Git » du worktree.
- [x] **Commit** depuis la vue « Git » du worktree : les fichiers ont une case (toutes cochées au
      départ) ; « Committer » propose un message dérivé du titre de la conversation et des
      fichiers (Conventional Commits, sans appel à l'agent), modifiable ; seuls les fichiers cochés
      sont commités ; le commit fait est montré, avec « Annuler » (`git reset --soft`) tant que
      rien d'autre n'a été fait.
- [x] **PR** : si `gh` est installé et authentifié (détecté, jamais requis), « Ouvrir une PR »
      pousse la branche sur le dépôt distant, crée la PR (titre et corps proposés, modifiables)
      vers la branche de base, et affiche le lien. Sinon, une phrase dit ce qui manque (`gh`
      absent, non connecté, pas de dépôt distant, rien à pousser).
- [x] **Fusion assistée** : « Fusionner dans <base> » ramène la base dans le worktree puis avance
      la base (fast-forward) ; dit si c'était un fast-forward ou une fusion. Les conflits sont
      listés fichier par fichier, avec « Laisser l'agent résoudre » (message générique à la
      conversation : fichiers en conflit, consigne de retirer les marqueurs sans committer) qui
      retente à la fin de son tour, « Réessayer » et « Abandonner » (`git merge --abort`).
      Refusé clairement s'il reste des modifications non commitées.
- [x] **Nettoyage** : après la fusion, « Nettoyer » archive la conversation (qui continue dans le
      dossier principal si on la ressort), supprime le worktree et la branche. Réglages › Agents et
      dossiers liste les worktrees orphelins (dossier `.worktrees/` sans conversation) avec
      « Nettoyer ».
- [x] Toute commande git passe par le main process, est journalisée dans `agents.log` (niveau
      Détaillé, fiche 080) ; rien n'est lancé depuis le renderer.
- [x] Tests unitaires sur des dépôts git jetables : commit (fichiers cochés, message, annulation),
      fusion fast-forward, fusion avec commit sur la base, conflit (abandon, résolution puis
      reprise), PR (`gh` simulé), nettoyage et orphelins.
- [x] Testé contre l'agent factice : scénario `conflits` (résout un conflit dans README.md) ; suite
      e2e `worktree-cycle` (clair, sombre, `--lang en`), captures regardées.

## Plan

### Choix (ADR-0022, proposé)

La fusion se fait **dans le worktree d'abord** : `git merge <base>` dans le worktree, puis la base
est avancée en fast-forward (`git merge --ff-only` dans le dépôt principal si la base y est
extraite, sinon `git branch -f`). Les conflits apparaissent donc dans le dossier où l'agent
travaille, et « Laisser l'agent résoudre » est un simple message. Le dépôt principal n'est jamais
laissé avec des marqueurs de conflit. Alternative écartée : fusionner dans le dépôt principal
(`git merge <branche>` à la racine), qui met les conflits hors de portée de l'agent et salit le
dossier de l'utilisateur.

### Fichiers

- `src/shared/worktree-cycle.ts` (nouveau) : types (`WorktreeCycleView`, `MergeOutcome`,
  `PrOutcome`, `OrphanWorktree`), `proposeCommitMessage(title, files)`, `proposePr(title,
  commits, files)`, `conflictPrompt(base, branch, files)` (anglais, ADR-0014),
  `hasConflictMarkers(text)`. Tests.
- `src/main/changes/worktrees.ts` : `create` relève aussi la branche de départ, la date et le sujet
  du commit, et le nombre de modifications non commitées du dossier d'origine.
- `src/main/changes/worktree-cycle.ts` (nouveau) : `WorktreeCycle` (`Run` injecté) : `info`,
  `commit`, `undoCommit`, `merge`, `mergeContinue`, `mergeAbort`, `pullRequest` (`gh`), `cleanup`
  (suppression), `orphans`, `removeOrphan`. Chaque commande git dans `agents.log`. Tests sur
  dépôts jetables.
- `src/main/changes/worktree-ipc.ts` (nouveau) : canaux `worktree:*` (`ipc.ts` est à son
  plafond), comme `childHandlers`.
- `src/main/conversations/store.ts` : `worktree` gagne `baseBranch`, `baseDate`, `baseSubject`,
  `dirtyAtStart` (facultatifs : les anciens enregistrements restent lus).
- `src/main/conversations/manager.ts` : avis de départ dans le fil à la création ;
  `leaveWorktree(id)` (archive, dossier principal, plus de worktree) pour le nettoyage.
- `src/shared/ipc.ts`, `src/preload/api.ts`, `src/main/index.ts` : canaux, API, branchement.
- `src/renderer/src/components/panel/WorktreeBar.tsx` (nouveau) : départ, commit (message
  proposé), PR, fusion, conflits, nettoyage ; `ChangesTab.tsx` : cases à cocher dans la vue
  « Git » d'un worktree et la barre.
- `src/renderer/src/components/settings/AgentsSettings.tsx` : « Worktrees orphelins ».
- `src/mock-agent/scenarios.mts` : scénario `conflits`.
- `e2e/suites/worktree-cycle.mjs` (nouveau), `e2e/run.mjs`.
- `fr.json` / `en.json`, `docs/mock-agent.md`, `docs/architecture.md`, `CHANGELOG*.md`.

### Hors périmètre

- Rebase, squash, choix du type de fusion : fast-forward si possible, sinon un commit de fusion.
- PR sans `gh` (API GitHub, `glab`) : une phrase dit ce qui manque.
- Fusionner une branche dont la base est extraite dans un autre worktree : refusé avec la raison.

## Journal

- 2026-10-21 — Fiche créée après relecture de l'existant (036, 097, 021, 049). Plan ci-dessus.
- 2026-10-21 — **Fait**, selon le plan, sur la branche du worktree (pas de fusion dans `main`).
  - **Main** : `changes/worktree-cycle.ts` (`WorktreeCycle`), `changes/worktree-ipc.ts` (canaux
    `worktree:*`, `worktreeCycleDeps` pour `index.ts` à son plafond de lignes), `Worktrees.create`
    relève le départ, `ConversationManager.worktreeOf / worktreePaths / leaveWorktree`, avis de
    départ posés dans le fil à la création (`worktreeStartNotices`, avant le premier message :
    un brouillon les garde en mémoire et les écrit avec le fil au premier message). Pour tenir le
    plafond de `manager.ts` (1050 lignes), `summaryOf` et `motherOf` sont sortis dans
    `conversations/helpers.ts`.
  - **Renderer** : `panel/WorktreeBar.tsx` (barre, formulaires et note en trois composants ;
    « ce qui bloque » calculé par `prBlocker` / `mergeBlocker` de `shared/worktree-cycle.ts`),
    cases à cocher de la vue « Git » de `ChangesTab` (celles décochées sont retenues, un nouveau
    fichier est coché), `useWorktreeCycle`, `settings/OrphanWorktrees.tsx` (Réglages › Agents et
    dossiers, entrée de la recherche des réglages).
  - **Message de commit proposé** : type deviné (`docs` si tous les fichiers sont de la doc,
    `test` si tous des tests, `fix` si le titre parle de correction, sinon `feat`), sujet = titre
    de la conversation en minuscule initiale coupé à 60 caractères, corps = liste des fichiers
    avec leur état. PR : titre de la conversation, corps = commits et fichiers.
  - **Essais** : `shared/worktree-cycle.test.ts` (textes, blocages), `changes/worktree-cycle.test.ts`
    (dépôts jetables : départ, commit des fichiers cochés, annulation, fast-forward, commit de
    fusion, conflit abandonné puis résolu, base non extraite, base dans un autre worktree, dépôt
    principal avec modifications qui chevauchent, PR par `gh` simulé dont PR déjà là et ce qui
    manque, orphelins), `changes/worktree-ipc.test.ts` (arguments, « Laisser l'agent résoudre »
    = consigne puis reprise, nettoyage, dépôts des orphelins), scénario `conflits` de l'agent
    factice (`mock-agent.test.ts`), `children.test.ts` ajusté (l'avis de départ précède la
    consigne de la fille). Suite e2e `worktree-cycle` : clair, sombre et `--lang en` ; captures
    `110-worktree-depart` à `116-worktrees-orphelins` regardées. Suites touchées relancées :
    `changes`, `parallel`, `filles`, `settings`, `auth`, `git`.
  - **Écarts et limites** :
    - « Ouvrir une PR » n'a pas été essayé contre GitHub (pas de PR réelle) : `gh` est simulé
      dans les tests ; la suite e2e vérifie seulement le blocage avec sa raison, qui dépend de la
      machine (`gh` absent, non connecté, ou pas de dépôt distant : le PATH du shell de connexion
      est repris par l'app, fiche 004).
    - Le nettoyage archive la conversation (son agent est arrêté) ; ressortie, elle continue dans
      le dossier principal avec son fil (ADR-0021), sans sa session de worktree.
    - « Annuler » un commit n'est proposé que pour le dernier commit fait depuis la barre, tant
      qu'il n'est pas dans la base ; une PR ou une poussée ne s'annulent pas.
    - Après « Laisser l'agent résoudre », si l'agent a committé lui-même la fusion, l'app
      avance la base sans redemander.
    - ADR-0022 reste **proposé** : le choix « la base entre dans le worktree, puis avance en
      fast-forward » est à valider.
- 2026-10-23 — **Écart (fiche 123)** : « Fusionner » vérifie d'abord le dossier principal (refus
  d'avance avec les fichiers, « Committer d'abord », « Mettre de côté »), les erreurs de git sont
  montrées en entier, et « Committer » / « Défaire » existent aussi hors worktree (même code).
- 2026-10-23 (écart, fiche 126) : « Nettoyer » un worktree orphelin (Réglages) demande
  confirmation dans la ligne, avec ce qui sera perdu ; le titre de conversation repris par le
  message de commit proposé n'est plus coupé au milieu d'un mot.
- 2026-11-07 (0.11, D4, trouvé en recette réelle : le commit a932731 annonçait README.md qu'il ne
  contenait pas) : le message proposé suit les cases cochées tant qu'il n'est pas retouché
  (`CommitForm` reçoit la proposition du moment ; retouché, le texte de l'utilisateur reste) ;
  curseur à la fin ; sujet honnête : le titre de la conversation s'il tient en entier (60
  caractères), sinon un résumé des fichiers cochés (« update app.js », « add 4 files in
  src/panel », `honestSubject` / `filesSubject`). Apparence inchangée. Essais :
  `worktree-cycle.test.ts`, `CommitBars.test.tsx`, e2e `git` (cocher puis décocher pendant que le
  formulaire est ouvert, curseur).
