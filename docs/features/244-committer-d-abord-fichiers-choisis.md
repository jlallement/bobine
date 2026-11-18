# 244 — « Committer d'abord » : voir et choisir chaque fichier

- **Statut** : fait — maquettes validées (2026-11-18) ; non poussé, en attente de relecture
- **Dépend de** : 123 (fusion refusée, « Committer d'abord »), 240 (filles en worktree, même
  carte avant le lancement), 110 (cycle des worktrees : la vue Git et ses cases à cocher)
- **Agents** : les deux (comportement de Bobine, `git` dans le main process, aucun code propre à un
  agent, ADR-0011)
- **Trouvé par** : relecture de la fiche 240 (tech lead, 2026-11-18)

## Pourquoi

« Committer d'abord » de la carte « Fusion refusée » (fiche 123, `MainDirtyCard` + `CommitForm`)
committe **tous** les fichiers de `git status -uall` du dossier principal, non suivis compris (s'ils
ne sont pas ignorés), sans case à cocher. L'utilisateur n'en voit que **6** dans la carte
(`MAX_SHOWN`, « … et 34 autres ») et **20** dans le corps du message proposé (`BODY_FILES_MAX` de
`proposeCommitMessage`). Au-delà, des fichiers partent dans le commit sans avoir été vus : un `.env`
non ignoré, un export de 200 Mo, une note personnelle. Le commit est local, mais il sera fusionné,
puis poussé avec le reste.

La fiche 240 (branche `claude/fix-240-filles-non-commite-1b1357`, pas encore dans `main`) reprend
les mêmes morceaux pour « Committer d'abord » avant le lancement d'une fille en worktree
(`LaunchDirtyCard`, `LaunchDirty.tsx`), avec le même défaut. Les deux cartes sont corrigées ici, par
un composant commun.

La vue Git d'un worktree (fiche 110, `ChangesFileList`) a déjà ce qu'il faut : une case par
fichier, toutes cochées au départ, et le message proposé qui suit les cases (0.11, D4). On en
reprend l'apparence et la règle.

## Critères d'acceptation

- [x] Après « Committer d'abord », la liste **complète** des fichiers est visible avant de valider :
      une ligne par fichier (pastille d'état `M`/`A`/`U`/`D`/`R`, nom, dossier, comme la vue Git),
      **une case par fichier, toutes cochées au départ**. Longue (plus de 8 fichiers), elle défile
      dans un cadre de hauteur bornée et se déplie en entier (« Tout afficher » / « Réduire »).
- [x] Une case de tête coche ou décoche tout (état intermédiaire quand une partie est cochée), avec
      le compte « 39 sur 40 cochés ».
- [x] Seuls les fichiers cochés partent dans le commit ; les décochés restent non commités dans le
      dossier, intacts (contenu, état suivi ou non suivi).
- [x] Le message proposé ne cite que les fichiers cochés (type, sujet et corps recalculés à chaque
      case, tant que l'utilisateur n'a pas retouché le message — règle de la vue Git).
- [x] Aucun fichier coché : le bouton de validation est désactivé, et une ligne dit pourquoi
      (« Cochez au moins un fichier à committer. »).
- [x] Des fichiers décochés : une ligne dit ce qu'ils deviennent, propre à chaque carte (voir
      « Questions » ci-dessous, Q1).
- [x] Les deux cartes sont couvertes par **un composant commun** (`CommitChooser`) : « Fusion
      refusée » (carte « Sous-tâches » et barre d'un worktree, fiche 123) et l'avertissement avant
      le lancement d'une fille (fiche 240 : saisie `@rôle`, Tâches proposées, Lancer en parallèle).
- [x] Test unitaire **côté main** : `commitMain` avec un sous-ensemble de fichiers ; le fichier
      décoché (un `.env` non suivi) n'est pas dans le commit (`git show --name-only`) et reste non
      suivi dans `git status`.
- [x] Test unitaire **côté interface** : décocher un fichier, valider ; `onCommit` / l'IPC reçoit
      la liste sans lui, et le message proposé ne le cite pas ; tout décoché : bouton désactivé,
      raison affichée. Rejoué sans le correctif : il échoue.
- [x] Essai e2e contre l'agent factice : carte de fusion avec 40 fichiers dont un `.env`, décoché ;
      après « Committer puis fusionner », le `.env` est toujours non commité dans le dossier
      principal et absent de l'historique ; même chose pour le lancement d'une fille (suite de la
      fiche 240).
- [x] i18n fr/en ; CHANGELOG fr/en.

## Maquettes (validées le 2026-11-18)

`e2e/maquettes/screens-commit-choisi.mjs`, sur la vraie fenêtre :

```bash
pnpm build && node e2e/maquettes/run.mjs light f244
```

puis `dark`. Captures hors du dépôt (dossier de notes de la session). Six écrans :

1. **Fusion refusée, 5 fichiers** : liste entière, sans cadre défilant.
2. **Fusion refusée, 40 fichiers, `.env` vers la fin** : cadre défilant, faites défiler jusqu'au
   `.env` ; « Tout afficher ».
3. **Un fichier décoché** (le `.env`) : « 39 sur 40 cochés », case de tête intermédiaire, message
   sans lui, ligne « 1 fichier décoché reste… ».
4. **Tout décoché** : bouton désactivé, « Cochez au moins un fichier à committer. ».
5. **Lancement d'une fille (240), 5 fichiers** : le même composant sous « Partira à… ».
6. **Lancement d'une fille, un fichier décoché** : ligne propre au lancement.

Le résumé de la carte (6 fichiers, « … et N autres ») reste tant que le formulaire est fermé ; il
laisse la place à la liste à cocher quand « Committer d'abord » l'ouvre (pas deux listes).

## Décisions (2026-11-18, utilisateur : « Validé »)

- **Q1 — Fusion avec des fichiers décochés** : « Committer puis fusionner » committe les cochés,
  puis fusionne en mettant les décochés **de côté** le temps de la fusion (`stash`, comme « Mettre
  de côté »), et les remet ; la ligne le dit. Si la remise entre en conflit, rien n'est perdu :
  l'entrée reste dans `git stash`, et la note le dit (`stashFailed`, fiche 123). Pour le
  lancement d'une fille : « 1 fichier décoché reste dans ce dossier, non commité : la conversation
  fille ne l'aura pas. » ; la fille part comme « Partir quand même » (rappel dans la mère).
- **Q2 — Fichiers sensibles** : étiquette « secret ? » sur `.env*`, `*.pem`, `*.key`, `id_rsa*`,
  `*.p12` (`looksSecret`), le fichier reste coché.

## Plan

Pour le temps 2, après rebase sur `main` avec la 240 :

1. `src/renderer/src/components/panel/CommitChooser.tsx` (nouveau) : liste à cocher (case de tête,
   pastilles de la vue Git, cadre défilant, « Tout afficher »), `CommitForm` dessous avec
   `proposeCommitMessage(title, cochés)`, bouton désactivé et raison quand rien n'est coché, ligne
   des décochés (texte fourni par la carte). Rend `onCommit(message, files, left)`.
2. `MainDirtyCard.tsx` et `thread/LaunchDirty.tsx` : `CommitChooser` à la place de `CommitForm`.
3. `SubtasksMerge.tsx`, `WorktreeBar.tsx` : avec des décochés, la fusion part avec `stash` (Q1).
4. `styles.css` : `.commit-chooser*` sur les jetons, `.changes-check` et `.changes-badge` repris.
5. `fr.json` / `en.json` (`worktreeCycle.choose.*`), glossaire de `docs/traduction.md`.
6. Tests : `CommitChooser.test.tsx` (nouveau), `CommitBars.test.tsx`, test de `LaunchDirty`,
   `worktree-cycle.test.ts` (main : `.env` non suivi décoché).
7. e2e : `e2e/suites/worktree-cycle.mjs` ou `filles-fusion.mjs` (40 fichiers, `.env` décoché),
   `e2e/suites/filles-non-commite.mjs` (240).
8. CHANGELOG fr/en, fiche, index.

Aucune nouvelle dépendance. Côté main, `commitMain` → `commitIn` committe déjà seulement les
chemins reçus (`git commit --only -- …`) : le défaut est dans l'interface, qui envoie toute la
liste. Le test main verrouille ce contrat.

## Ce qui a été fait

- `panel/CommitChooser.tsx` (nouveau) : case de tête (intermédiaire si une partie est cochée),
  une ligne par fichier avec la pastille de la vue Git (`GIT_BADGES`, sorti de `ChangesTab` vers
  `ChangesList`), cadre défilant au-delà de 8 fichiers et « Tout afficher » / « Réduire »,
  étiquette « secret ? », ligne des décochés, puis `CommitForm`. Styles dans
  `commit-chooser.css`.
- `CommitForm` : `blocked` (raison écrite, bouton désactivé).
- `MainDirtyCard` et `LaunchDirtyCard` : `CommitChooser` à la place de `CommitForm` ; le résumé
  (6 fichiers) disparaît quand le formulaire s'ouvre. `onCommit(message, files, left)`,
  `onCommitted(left)`.
- Fusion : `WorktreeBar` (`merge(…, { stash: true })`) et `SubtasksMerge`
  (`start(…, stash)`) mettent les décochés de côté. Lancement : avec des décochés, la saisie
  `@rôle`, la carte « Tâches proposées » et « Lancer en parallèle… » partent en « anyway » (le
  main refuse sinon un dossier encore modifié), et le rappel dans la mère compte les décochés.
- Côté main, rien à changer : `commitIn` committe déjà seulement les chemins reçus
  (`git commit --only`), la fusion remet le `stash` même quand elle échoue, et le garde en cas de
  conflit. Les tests main verrouillent ce contrat.
- Tests : `CommitChooser.test.tsx` (nouveau) ; une ou deux par carte dans `CommitBars`,
  `SubtasksMerge`, `RoleComposerUncommitted`, `ChildProposals`, `ChildDialog` ; main :
  `worktree-cycle.test.ts` (cochés seuls, `.env` remis après la fusion, après une fusion qui
  échoue, et gardé dans `git stash` sur conflit), `children-merge.test.ts`,
  `children-uncommitted.test.ts`.
- e2e : `e2e/suites/commit-choisi.mjs` (nouveau : 40 fichiers dont un `.env`, tout décoché, `.env`
  décoché puis fusion) et `filles-non-commite.mjs` (carte « Tâches proposées » : `.env` décoché).

## Écarts au plan

- Côté main, aucun code : le défaut était dans l'interface seulement. Rejoués sans le correctif,
  les tests d'interface échouent (6, plus le fichier `CommitChooser.test.tsx`) ; les tests main
  passent, puisqu'ils décrivent le comportement déjà là.
- Les styles sont dans `commit-chooser.css` plutôt que `styles.css` (comme `pr-card.css`).

## Journal

- 2026-11-18 : fiche et maquettes (temps 1), depuis `main` ; `LaunchDirty.tsx` lu sur la branche
  de la 240. Arrêt pour validation.
- 2026-11-18 : maquettes validées, Q1 et Q2 retenues. Rebasée sur `main` (9176910, 240
  fusionnée). Code, tests, i18n, CHANGELOG.
- 2026-11-18 : `./scripts/verify` vert (code de sortie 0, 4827 tests). `pnpm build && pnpm e2e
  --changed` : toute la suite (216 tâches ; `Composer.tsx` et les locales font tout jouer), 214
  vertes, 2 échecs dans `filles` en clair seulement (contenu et coût du compte rendu d'une fille,
  hors de ce lot) ; `filles` rejouée seule : verte en clair et en sombre. `commit-choisi`,
  `filles-non-commite`, `filles-fusion` et `worktree-cycle` vertes en clair et en sombre.
  Captures regardées. Retouche après les captures : dans le panneau étroit, « Cochez au moins un
  fichier à committer. » passe sur sa propre ligne au-dessus des boutons (`commit-choisi`
  rejouée, verte).
