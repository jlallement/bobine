# 037 — Git, pull requests et CI

- **Statut** : retiré le 2026-10-14 (fiche 049), sauf la branche du dossier
- **Dépend de** : 021, 036

## Pourquoi

Finir le travail sans quitter l'app : voir la branche, committer, pousser, ouvrir une pull request
(GitHub) ou une merge request (GitLab) et suivre la CI et les commentaires de revue, comme le
panneau PR de Claude Code Desktop. Les remarques de revue se font dans la PR / MR, l'agent les lit
de là (décision du 13 octobre : pas d'annotation de diff dans l'app).

## Critères d'acceptation

- [x] Branche courante dans l'en-tête de la conversation, avec un point quand le dossier a des
      modifications non commitées ; un clic ouvre l'onglet « Git » du panneau.
- [x] Onglet « Git » : état (branche, avance / retard sur la branche distante, fichiers modifiés),
      commit de toutes les modifications avec un message (proposé par l'agent sur demande, jamais
      sans clic), poussée sur `origin`.
- [x] Pull request / merge request : création depuis l'onglet (titre, description proposés d'après
      les commits, branche de base, brouillon) ; ensuite état, vérifications CI, décision de revue,
      commentaires (fil et commentaires de code). GitHub via `gh`, GitLab via `glab` ; dépôt distant
      inconnu ou outil absent : dit clairement quoi faire.
- [x] CI en échec ou commentaires : message prêt dans la zone de saisie en un clic (« Envoyer à
      l'agent »), et proposé tout seul quand une vérification passe au rouge — jamais envoyé sans
      l'accord de l'utilisateur.
- [x] Testé : dépôt git local avec un `origin` nu (vraies commandes git), `gh` simulé ; unités pour
      les analyses (`git status --porcelain=v2`, JSON de `gh` et de l'API GitLab).

## Plan

- `shared/git.ts` : `GitStatus`, `PullRequest` (vérifications, commentaires), `forgeOf(url)`,
  messages pour l'agent (`ciMessage`, `commentsMessage`), consigne du message de commit.
- `main/git/repo.ts` (`GitRepo`, `Run` injecté) : état (`status --porcelain=v2 --branch`, dernier
  commit, branche par défaut de `origin`, URL du distant), `commitAll`, `push -u origin HEAD`,
  sujets des commits en avance (description de la PR).
- `main/git/forge.ts` : `GithubForge` (`gh pr view --json …`, `gh api …/pulls/N/comments`,
  `gh pr create`) et `GitlabForge` (API REST par `glab api` : merge request de la branche,
  pipelines et jobs, notes, création) ; analyseurs purs testés.
- `main/git/service.ts` : façade pour l'IPC (`git:status`, `git:commit`, `git:push`, `git:pr`,
  `git:prDraft`, `git:createPr`), outils `gh` / `glab` du PATH (`BOB_GH` / `BOB_GLAB` pour les
  essais), disponibilité vérifiée.
- Renderer : onglet `git` du panneau (`GitTab`), puce de branche dans l'en-tête (`App`), rafraîchi
  à la fin de chaque tour de l'agent et toutes les 30 s (PR : 60 s) tant que l'onglet est ouvert.
- e2e `git` : dépôt avec `origin` nu, scénario `modifications`, faux `gh` à états ; outils neutres
  `gh` / `glab` pour les autres suites.

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-13 — Plan écrit, chantier lancé (après la fiche 043 et les correctifs du simulateur).
- 2026-10-13 — **Implémenté comme prévu.** `shared/git.ts` (types, `forgeOf`, messages pour
  l'agent, consigne du message de commit et extraction de la réponse), `main/git/repo.ts`
  (`parseStatusV2`, `GitRepo`), `main/git/forge.ts` (`parseGithubPr`, `parseGitlabMr`,
  `GithubForge`, `GitlabForge`), `main/git/service.ts`, six canaux IPC `git:*`, onglet `git` du
  panneau (`GitTab`), puce de branche dans l'en-tête (`useGitStatus` : relu au changement de
  conversation, au début et à la fin de chaque tour, toutes les 30 s onglet ouvert ; PR toutes les
  60 s). Tests unitaires : analyses git / gh / API GitLab, forges avec `Run` factice, IPC. e2e
  `git` : dépôt réel avec `origin` nu (URL de lecture GitHub, URL de poussée locale), scénario
  `modifications`, faux `gh` à états ; captures `73-git-commit` et `74-git-pr` regardées ; outils
  `gh` / `glab` neutres pour les autres suites.
  **Choix** : GitLab passe par l'API REST (`glab api`, placeholders `:id`), plus stable que les
  sous-commandes de `glab` et sans invite interactive ; brouillon de MR = titre préfixé « Draft: ».
  Le brouillon de PR est lié au commit de tête : refait après chaque commit (premier essai e2e :
  brouillon figé sur « init »). Le message « CI en échec » remplace le contenu de la zone de saisie
  (comme une suggestion) ; proposé une fois par ensemble de vérifications en échec.
  **Non testé en vrai** : GitLab (pas de `glab` ni de dépôt GitLab sous la main) ; GitHub réel non
  essayé non plus pour ne pas créer de PR sur le dépôt de l'utilisateur — la création passe par
  `gh pr create --head --base --title --body [--draft]`, documentée et stable.
- 2026-10-13 — Retour de l'utilisateur (« toujours pas dans un dépôt git ») : c'était son dossier
  (« Bob Desktop », vide, et non le dépôt `bob-desktop`), mais le message ne disait pas lequel.
  Trois correctifs : l'onglet Git donne le chemin complet du dossier ; un échec de git (binaire
  introuvable depuis l'app, dépôt refusé…) est montré comme tel dans les onglets Git et
  Modifications, « pas un dépôt » n'est dit que si git le dit (`notARepoOrError`) ; bouton
  « Créer un dépôt git dans ce dossier » (`git init` + branche `main`, canal `git:init`). e2e `git`
  commence désormais hors dépôt (chemin dit, création), capture `72b-git-sans-depot`.
- 2026-10-14 — **Vue « Git » retirée** à la demande de l'utilisateur (fiche 049) : jugée trop
  incomplète (pas de liste de fichiers, ni de choix, ni de pull, ni d'historique) et en doublon
  avec l'onglet « Modifications ». Supprimés : onglet `git`, `GitTab`, commit, poussée, création et
  suivi de pull / merge request, CI, commentaires de revue, `git init`, forges `gh` / `glab`
  (`forge.ts`, `service.ts`), canaux IPC correspondants. Reste : `GitRepo.status` et `git:status`
  pour la puce de branche, déplacée de l'en-tête vers la zone de saisie.
