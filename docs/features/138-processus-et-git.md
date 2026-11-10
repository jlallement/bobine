# 138 — Processus et git

- **Statut** : fait
- **Dépend de** : 036, 041, 110, 114, 120, 123
- **Agents** : tous (rien de propre à un agent : processus lancés par l'app, commandes git du main,
  session Electron)

## Pourquoi

Lot 138 de l'étude du 23 octobre (`docs/feuille-de-route-2026-10-23.md`, « Itération 4 ») : quatre
défauts de fond, invisibles tant que tout va bien, qui laissent des traces quand ça va mal.

- Un agent qui ignore SIGTERM n'est jamais tué : `killTree` n'envoie rien d'autre.
- Les agents sont lancés dans leur propre groupe de processus (`detached`) : un plantage du main
  laisse des `bob acp` et `opencode acp` vivants, que rien ne nettoie au lancement suivant.
- Plusieurs conversations, la relecture de l'état git et une fusion lancent git en même temps dans
  le même dépôt : l'une échoue sur `index.lock`.
- La session Electron par défaut (celle des fenêtres de l'app et de l'aperçu HTML) accorde toute
  permission demandée : seul le navigateur intégré avait un gestionnaire.

## Critères d'acceptation

- [x] **Arrêt sûr** : SIGTERM au groupe, puis SIGKILL au groupe au bout de 3 s ; une seule logique
      pour les agents, les sondes MCP et les serveurs de développement. Test avec une fausse horloge.
- [x] **Registre des processus enfants** : `<données>/agents.pids` (pid, groupe, commande, heure),
      écrit de façon atomique au lancement, mis à jour à l'arrêt. Au démarrage, les groupes restés
      vivants sont arrêtés, seulement si `ps` confirme la même commande lancée à la même heure (un
      pid réattribué est ignoré) ; le journal dit ce qui a été fait. Tests unitaires (pid
      réattribué ignoré) et test d'intégration (vrai processus, main « coupé », nettoyé au lancement
      suivant).
- [x] **File git par dépôt** : les commandes qui écrivent passent une à une ; les lectures passent
      ensemble, jamais pendant une écriture. Branchée sur tous les appels git du main. Une erreur
      `index.lock` laissée par un autre processus est relancée une fois après un court délai, puis
      montrée en entier. Tests : deux écritures ne se chevauchent pas, une lecture attend l'écriture,
      relance sur `index.lock`.
- [x] **Permissions de la session par défaut** : tout est refusé, sauf ce que l'app utilise vraiment
      (relevé ci-dessous).
- [x] Aucun code propre à un agent ; e2e touchées vertes (`failures`, `restart`, `parallel`,
      `worktree-cycle`, `filles-fusion`, `git`, et celles qui copient : `about`, `touches`,
      `diagnostic`), clair et sombre.

## Plan

**1. Arrêt sûr** — nouveau `src/main/process-group.ts` (sans `electron`) :
`signalGroup(pid, signal)` (le groupe, sinon le processus seul), `terminateGroup(pid, graceMs)`
(SIGTERM puis SIGKILL au groupe après le délai, minuterie `unref`) et `stopGroup(child)`.
`killTree` (`agent/process-utils.ts`) et `DevServers.stopServer` (`preview/dev-servers.ts`)
l'appellent ; le `killGroup` local de `dev-servers.ts` disparaît.

Le SIGKILL part au groupe même si le chef est déjà mort : ses petits-enfants (ex. `npx` → adaptateur
→ agent) restent dans le groupe. L'identifiant d'un groupe n'est pas réattribuable tant qu'un membre
vit ; s'il n'en reste aucun, l'envoi échoue sans effet.

**2. Registre** — nouveau `src/main/process-registry.ts` (sans `electron`) :
- `ProcessRegistry` : entrées `{ pid, pgid, command, startedAt }` dans `agents.pids` (JSON, écrit
  par `writeFileAtomic` de `storage.ts`) ; `track(child, command)` à l'appel de `spawn`, retrait à
  la sortie du chef quand son groupe est vide (sinon nouvel essai après le délai d'arrêt ; s'il vit
  encore, l'entrée reste pour le lancement suivant). Une erreur d'écriture est journalisée, jamais
  propagée au lancement.
- `openProcessRegistry(file)` : rend les entrées du lancement précédent et repart d'un registre
  vide, avant tout lancement. `trackChild` ne fait rien tant qu'aucun registre n'est ouvert (tests,
  sondes lancées hors de l'app).
- `parsePs` (`ps -A -ww -o pid=,ppid=,pgid=,lstart=,command=`, `LC_ALL=C`) et `orphanGroups`
  (fonction pure) : un chef retrouvé n'est arrêté que si son groupe, sa commande (nom du programme
  puis arguments, dans l'ordre : `node /…/bob acp` correspond à `bob acp`) et son heure de départ
  (à 3 s près) correspondent ; sinon il est ignoré (pid réattribué). Chef disparu : le groupe n'est
  arrêté que si tous ses membres sont partis après l'heure notée et que l'un d'eux a été adopté par
  `launchd` (ppid 1), signe d'un orphelin.
- `reapOrphans(entries, deps)` : `ps`, puis `terminateGroup` par groupe retenu ; une ligne de
  journal par groupe arrêté ou ignoré.
- Branché dans `spawnAgent` (`agent/agent-process.ts` : conversations et sessions à reprendre),
  `mcp-probe.ts` et `DevServers.spawn`.

**3. File git** — nouveau `src/main/git/git-queue.ts` (sans `electron`) :
- `GitQueue` : verrou lecteurs / rédacteur en file d'attente (premier arrivé, premier servi : une
  lecture qui arrive derrière une écriture en attente attend son tour, la relecture périodique de
  `git:status` ne peut pas affamer une fusion).
- `gitCommandKind(args)` : sous-commande après les options globales (`-C`, `-c`,
  `--no-optional-locks`…) ; liste blanche des lectures (`status`, `diff`, `show`, `rev-parse`,
  `log`, `rev-list`, `ls-files`, `symbolic-ref`, `merge-base`, `worktree list`, `stash list`,
  `branch --show-current`…), tout le reste est une écriture (prudence).
- `repoKeyOf(cwd)` : dossier git commun (`.git` du dépôt principal, retrouvé depuis un worktree par
  `gitdir:` puis `commondir`) ; un worktree et son dépôt partagent donc la même file (les fusions
  de l'ADR-0022 touchent les deux). Hors dépôt : le dossier lui-même.
- `queuedGit(run)` : un `Run` qui fait passer les commandes `git` par la file de leur dépôt (les
  autres, `gh` par exemple, passent tout droit), ajoute `--no-optional-locks` aux lectures (un
  `git status` de l'app ne prend plus `index.lock` au passage, ce qui faisait échouer le commit lancé
  au même moment par l'agent ou l'utilisateur), et relance une fois, après 400 ms, une commande
  refusée par un verrou (`Unable to create '….lock': File exists`). `gitRun` : l'instance de l'app.
- `index.ts` : `gitRun` au lieu de `runCommand` pour `Worktrees`, `gitChangesText`, `GitRepo`,
  `GitChangesReader`, `worktreeCycleDeps` (dont `WorktreeCycle`) et `childrenMerger` ;
  `workspace-files.ts` (`git ls-files`) passe aussi par `gitRun`.
- Message en entier : `Worktrees.exec` et `GitRepo.status` montrent `gitError` (fiche 123) au lieu
  de la dernière ligne, qui pour un verrou ne disait que « remove the file manually to continue ».

**4. Permissions** — nouveau `src/main/default-permissions.ts` : `setPermissionRequestHandler` et
`setPermissionCheckHandler` sur `session.defaultSession`. Relevé de ce que l'app utilise :
- **presse-papiers en écriture** (`clipboard-sanitized-write`) : boutons « Copier »
  (`CopyButton`, À propos) par `navigator.clipboard.writeText` → **accordé**, seulement à la page
  de l'app (fichier du renderer, ou URL de développement), pas à un cadre de l'aperçu HTML ;
- coller une image (`clipboardData` d'un évènement `paste`) : aucune permission ;
- notifications : `Notification` d'Electron dans le main, pas l'API web → refusé ;
- son : joué par le main → rien ;
- tout le reste (micro, caméra, géolocalisation, lecture du presse-papiers, plein écran d'une page,
  MIDI, HID, série, USB…) → **refusé**.

Branchement : `setupProcessSafety(userData)` (nouveau `src/main/process-safety.ts`) ouvre le
registre, lance le nettoyage et pose les permissions ; un appel au début de `start()` dans
`index.ts` (au plafond : une ligne d'import, une d'appel, celle de `gitRun`).

**Hors champ** : `Worktrees.removeIfUntouchedSync` reste synchrone, hors file (fermeture de l'app :
plus de boucle d'évènements ; échec déjà ignoré) ; terminal (pty : SIGHUP à la fermeture du maître),
simulateur et émulateur Android (pas en groupe à part) ne sont pas dans le registre.

Aucune nouvelle dépendance.

## Journal

- 2026-10-24 : fiche créée, plan écrit.
- 2026-10-24 : fait, selon le plan.
  - **Arrêt sûr** : `process-group.ts` (`signalGroup`, `terminateGroup`, `stopGroup`) ; `killTree`
    et `DevServers.stopServer` l'appellent, le `killGroup` de `dev-servers.ts` a disparu. Tests à
    fausse horloge (`process-group.test.ts`).
  - **Registre** : `process-registry.ts`, branché dans `spawnAgent`, `mcp-probe.ts` et
    `DevServers.spawn`. Tests unitaires (lecture de `ps`, commande, pid réattribué, chef disparu,
    fichier abîmé, retrait quand le groupe est vide) et test d'intégration : un vrai processus
    factice qui lance un descendant et ignore SIGTERM, main « coupé », arrêté au démarrage suivant
    (SIGKILL du délai), un processus sans rapport noté sous un autre nom laissé vivant. Essai sur
    l'app construite : un faux agent laissé dans `agents.pids` est arrêté au lancement, le journal
    dit « Processus resté du lancement précédent arrêté : … » et « … laissé : … — pid réattribué ».
  - **File git** : `git/git-queue.ts` ; `index.ts` passe `gitRun` à `Worktrees`, `gitChangesText`,
    `GitRepo`, `GitChangesReader`, `worktreeCycleDeps`, `childrenMerger` ; `workspace-files.ts` aussi.
    Tests : deux écritures ne se chevauchent pas, une lecture attend l'écriture, une écriture attend
    les lectures en cours et passe avant une lecture arrivée après elle, une file par dépôt (worktree
    compris, sur un vrai dépôt), relance unique sur `index.lock`, erreur rendue en entier.
  - **Permissions** : `default-permissions.ts`. Seule `clipboard-sanitized-write` est accordée, à
    la page de l'app, hors cadre. Vérifié : sur l'app construite, lecture du presse-papiers,
    notifications web et micro refusés (et notés dans `main.log`) ; la suite `about` échoue sur
    « Copier les infos techniques » si la liste est vide, passe avec.
  - `index.ts` au plafond : `openTerminal` sorti dans `terminal/terminal-app.ts` pour faire de la
    place ; `RENDERER_FILE` exporté par `renderer-windows.ts` (page de l'app, aussi pour les
    permissions).
  - **Écart au plan** : en plus, les lectures passent `--no-optional-locks` (un `git status` de
    l'app ne prend plus `index.lock` au passage, ce qui pouvait faire échouer un commit de l'agent ;
    `WorktreeCycle.branchState` le faisait déjà).
  - **e2e** (clair et sombre) : `failures`, `restart`, `parallel`, `worktree-cycle`,
    `filles-fusion`, `git`, `changes`, `branch`, `about`, `touches`, `diagnostic` verts. `about` et
    `touches` se gênent en parallèle (même presse-papiers du système, déjà le cas avant) : rejouées
    une à une (`--jobs 1`). Pas de suite complète (session de coordination).
  - **Reste** (hors champ, voir le plan) : `removeIfUntouchedSync` hors file ; terminal,
    simulateur et émulateur Android hors registre ; les commandes git de l'agent lui-même ne passent
    pas par la file (seule la relance sur verrou protège l'app).
- 2026-11-06 : échec intermittent de `children.test.ts` (« préparation visible avant le
  worktree… », fiche 149) : `fatal: failed to read .git/worktrees/<nom>/commondir: Undefined
  error: 0`.
  - **Cause** : `git worktree add` écrit `.git/worktrees/<nom>/commondir` en deux temps (fichier
    créé, puis rempli). Pendant ce court instant, une commande qui parcourt les worktrees et lit
    leur `HEAD` (`worktree add`, `worktree list`, `branch -D`) trouve un `commondir` vide et
    s'arrête (vérifié sur git 2.56 en plantant un `commondir` vide ; `status`, `rev-parse`,
    `show`, `symbolic-ref` n'y sont pas sensibles). Les deux filles du test créaient leur worktree
    en même temps, et les essais des conversations passaient `gitCommand` à `Worktrees`, **sans la
    file git** : les deux `worktree add` se chevauchaient.
  - **Pas un défaut de l'app** : `index.ts` passe `gitRun` (la file) à `Worktrees` ; `worktree add`
    et `branch -D` y sont des écritures, une à la fois, et `worktree list` une lecture, jamais
    pendant une écriture.
  - **Correction** : `children.test.ts`, `children-merge.test.ts` et `manager.test.ts` créent leurs
    worktrees par `queuedGit(gitCommand)`, comme l'app. Deux tests dans `worktrees.test.ts` : un
    `commondir` vide fait échouer la création (le mécanisme), et quatre créations en parallèle par
    la file ne lancent jamais deux `worktree add` à la fois (sans la file : quatre à la fois, le
    test échoue).
  - **Reste** : un `git worktree add` lancé hors de l'app (agent, terminal) au même instant
    qu'une création de l'app peut encore la faire échouer ; rare, non traité (une relance sur
    cette erreur dans `queuedGit` le couvrirait).
- 2026-11-06 : le test « worktree à demi écrit » échouait sur le runner macOS de GitHub (release
  0.9.0, deux fois) : la création passait au lieu d'être refusée.
  - **Cause** : pas le git (Homebrew 2.56.0 sur le runner comme en local, celui que résout node ;
    il refuse bien dans un shell sur le runner). Le `git commit` qui prépare le dépôt d'essai lance
    `git maintenance run --auto --detach` en arrière-plan, dont la tâche `worktree-prune` efface
    l'entrée cassée. Sur un Mac rapide, elle a fini avant que le test plante l'entrée ; sur le
    runner, plus lent, elle passe juste après (entrée disparue en moins de 300 ms, vu par trois
    sondes sur une branche jetable, `debug/git-probe-commondir`) et `worktree add` ne voit plus rien.
  - **Correction** : le dépôt d'essai de `worktrees.test.ts` a `maintenance.auto=false`. Et le test
    ne dépend plus de ce que fait git : refus → l'erreur cite `commondir` (fiche 123) et aucun
    dossier de worktree n'est créé ; création → worktree utilisable, sur sa branche, dépôt principal
    intact. Les deux branches essayées en local ; cinq passages verts sur le runner macOS.
  - **Constat** : quand git refuse, la branche `bobine/…` a déjà été créée et reste, vide. Sans
    effet dans l'app (la file git empêche ce chevauchement entre ses créations) ; à nettoyer si un
    jour la création relance sur cette erreur.
