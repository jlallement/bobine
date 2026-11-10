# 123 — Fusion refusée expliquée, « Committer » hors worktree

- **Statut** : fait (scène 3.3 des PV à rejouer avec un vrai agent)
- **Dépend de** : 110 (cycle complet d'un worktree, ADR-0022), 120 (fusionner toutes les filles),
  097 (conversations filles), 021 (onglet Modifications), 080 (journal)
- **Agents** : les deux. Tout passe par `git` en ligne de commande dans le main process ; aucun
  code propre à un agent (ADR-0011).

## Pourquoi

Campagne de recette du 2026-10-23 (PV Bob, défaut **D22**, scène 3.3 ; PV OpenCode, « Manques ») :
quand la mère a des modifications non commitées dans le dossier principal — le cas ordinaire, elle
travaille pendant que ses filles tournent —, « Fusionner les N dans main » s'arrête avec « La
branche de base n'a pas pu avancer dans le dépôt principal : Aborting ». La vraie raison de git
(« Your local changes to the following files would be overwritten by merge… ») est perdue, et la
mère n'a pas de « Committer » : il n'existe qu'en worktree. L'utilisateur est bloqué sans savoir
quoi faire.

## Maquette (à valider à la lecture)

**Carte « Sous-tâches » de la mère, dossier principal sale.** Le pied de carte (fond
`--surface-2`) garde sa phrase d'état ; sous elle, à la place de « Fusionner les N dans main », un
encadré bordé `--warn` :

```
┌ Sous-tâches · 2 terminées ────────────────────────────────────────────────┐
│ ✓ Import CSV        bobine/…-a1                                 fini     │
│ ✓ Page d'aide       bobine/…-b2                                 fini     │
├───────────────────────────────────────────────────────────────────────────┤
│ Les 2 branches sont finies et ne touchent pas les mêmes fichiers.          │
│ ┌───────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠ Fusion refusée : le dossier principal a 2 modifications non         │ │
│ │   commitées.                                                           │ │
│ │   public/index.html · public/style.css                    (mono)      │ │
│ │   La fusion dans main pourrait les écraser. Committez-les d'abord, ou │ │
│ │   mettez-les de côté : elles reviendront après la fusion.             │ │
│ │                    [Committer d'abord] [Mettre de côté] [Puis nettoyer]│ │
│ └───────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

- Au-delà de 6 fichiers : « … et 3 autres ». Le chemin du dossier principal est en infobulle.
- **Committer d'abord** ouvre, dans l'encadré, le formulaire de la barre de worktree : « Message du
  commit », message proposé modifiable (`feat: organise le carnet` + liste des fichiers, titre de
  la mère), « Annuler » et « Committer puis fusionner » (accent). Tous les fichiers listés sont
  commités dans le dossier principal, puis la fusion part.
- **Mettre de côté** lance la fusion après `git stash push -u` dans le dossier principal. Pendant
  la fusion, le pied dit « Vos 2 modifications sont mises de côté le temps de la fusion. » À la
  fin, le résultat dit « … Vos 2 modifications mises de côté sont revenues. », ou, si elles ne
  reviennent pas proprement, « Vos modifications mises de côté n'ont pas pu revenir sans conflit
  (public/index.html) : elles restent dans git stash (a1b2c3d). » Comme le reste de l'élément
  `children-merge`, c'est dans le fil de la mère.
- **Vue Git d'un worktree** (« Fusionner dans main » de la barre) : le même encadré sous les
  boutons, mêmes actions ; « Mettre de côté » fusionne et remet ; la note de fin le dit.
- **Erreurs de git**, partout dans le cycle : les lignes `error:` / `fatal:` et ce qui les suit
  (fichiers, « Please commit your changes… ») sont montrées en entier, sur plusieurs lignes ; jamais
  le seul « Aborting ».

**Vue Git d'une conversation ordinaire** (pas en worktree) : les cases à cocher de la vue Git et
une barre réduite, sans départ ni « Ouvrir une PR » ni « Fusionner » :

```
┌ Modifications   [Conversation 2] [Git 2]                    feat  ⟳ ┐
│ [Committer 2 fichiers]                                               │
│ ☑ M  README.md                                           +3 −1       │
│ ☑ U  src/app.js                                          +12 −0      │
└──────────────────────────────────────────────────────────────────────┘
→ formulaire « Message du commit » (proposé, modifiable) [Annuler] [Committer]
→ ✓ Commit a1b2c3d créé.                                     [Défaire]
```

## Critères d'acceptation

- [x] Fusion des filles : le plan lit l'arbre du dépôt principal quand la base y est extraite ;
      sale, la fusion ne part pas (`children:merge` refuse aussi), et le pied dit pourquoi avec les
      fichiers, « Committer d'abord » et « Mettre de côté ».
- [x] « Committer d'abord » : message proposé modifiable ; les fichiers sont commités dans le
      dossier principal, puis la fusion part.
- [x] « Mettre de côté » : `git stash push -u` avant la chaîne, remis après (`stash apply` puis
      `drop` de cette entrée seulement, retrouvée par son hash) ; issue dite dans le fil de la
      mère ; si la remise échoue, l'entrée reste et le fil le dit.
- [x] Vue Git d'un worktree : « Fusionner » vérifie de même et propose les mêmes actions.
- [x] Erreurs de git du cycle : lignes `error:`/`fatal:` en entier, jamais le seul « Aborting ».
- [x] « Committer » (fichiers cochés, message proposé modifiable, « Défaire » tant que c'est le
      dernier commit et qu'il n'est pas poussé) dans la vue Git d'une conversation ordinaire ; pas
      de « Ouvrir une PR » ni de « Fusionner ».
- [x] Tests unitaires sur dépôts jetables (dossier principal sale) ; e2e `filles-fusion` et `git`
      étendus contre l'agent factice, clair et sombre, captures regardées.

## Plan

Pas d'écart à l'ADR-0022 (la base entre dans le worktree, puis avance en fast-forward) : la
vérification et la mise de côté se font avant, dans le dossier principal. Pas de nouvel ADR, pas
de nouvelle dépendance.

### Fichiers

- `src/main/changes/git-errors.ts` (nouveau) : `gitError(stderr)` (lignes `error:`/`fatal:` et la
  suite, sans `Aborting` ni `hint:`). Tests.
- `src/main/changes/worktree-cycle.ts` : `mainDirty(target)` (arbre du dépôt principal si la base y
  est extraite), `stashMain` / `restoreMain`, `merge(target, { stash })` et `mergeContinue`
  rendent `main-dirty` au lieu de partir ; `commitIn` / `undoCommitIn` (même code pour un worktree,
  le dossier principal, et une conversation ordinaire) ; `gitError` partout. Tests sur dépôts
  jetables.
- `src/shared/worktree-cycle.ts` : `MainDirty`, `StashOutcome`, `MergeOutcome` `main-dirty`,
  `stash` sur `merged`.
- `src/shared/children-merge.ts` : `blocked` `main-dirty`, `stash` d'une fusion enchaînée.
- `src/main/conversations/children-merge.ts` : plan, `start(…, { cleanup, stash })`, refus, mise de
  côté autour de la chaîne, `commitMain`. `children-merge-ipc.ts` : `children:commitMain`. Tests.
- `src/main/changes/worktree-ipc.ts` : `worktree:merge` avec `{ stash }`, `worktree:commitMain`,
  `changes:commit`, `changes:undoCommit` (dossier de la conversation). Tests.
- `src/shared/ipc.ts`, `src/preload/api.ts` : canaux.
- Renderer : `panel/CommitForm.tsx` (formulaire partagé), `panel/MainDirtyCard.tsx` (encadré),
  `panel/FolderCommitBar.tsx` (barre hors worktree) ; `WorktreeBar.tsx`, `ChangesTab.tsx`,
  `SidePanel.tsx`, `App.tsx`, `thread/SubtasksMerge.tsx` ; `styles.css`, `fr.json`, `en.json`.
  Tests des composants.
- `e2e/suites/filles-fusion.mjs`, `e2e/suites/git.mjs`.
- `CHANGELOG.md`, `CHANGELOG.en.md`, fiches 110 et 120 (une ligne d'écart), `README.md` des fiches,
  `docs/architecture.md` si besoin.

### Choix

- **« Sale »** : toute entrée de `git status --porcelain -uall` du dossier principal (suivis et non
  suivis, pas les ignorés) — c'est ce que `stash -u` range. Seulement quand la base est extraite
  dans le dossier principal : sinon la base avance par sa référence, l'arbre n'y est pour rien.
- **Message proposé** de « Committer d'abord » : `proposeCommitMessage` avec le titre de la mère
  (carte), ou celui de la mère de la fille (barre d'un worktree), sinon neutre.
- **« Défaire » hors worktree** : refusé si le commit n'est plus le dernier, ou s'il est déjà dans
  la branche suivie (`@{u}`) : on ne réécrit pas ce qui est poussé.
- **Mise de côté** : une seule pour toute la chaîne (avant la première fille, remise après la
  dernière, même sur arrêt ou échec), pas une par fille.

## Journal

- 2026-10-23 — Fiche créée d'après D22 et les « Manques » des PV de recette ; maquette et plan.
- 2026-10-23 — **Fait**, selon le plan, sur la branche du worktree (pas de push, pas de PR).
  - **Main** : `changes/git-errors.ts` (`gitError`, `gitErrorLine` pour le journal) ;
    `WorktreeCycle` gagne `mainDirty`, `stashMain` / `restoreMain`, `commitMain`, `commitIn` /
    `undoCommitIn` (le commit du worktree passe par eux), `merge` / `mergeContinue` avec
    `{ stash }` et l'issue `main-dirty` ; `ChildrenMerger` : refus `main-dirty` dans le plan,
    `start(…, stash)` (refus sans, une mise de côté pour toute la chaîne, remise à la fin),
    `commitMain`. Canaux `worktree:commitMain`, `children:commitMain`, `changes:commit`,
    `changes:undoCommit` ; `worktree:merge` et `worktree:mergeContinue` prennent `{ stash }`.
    `manager.ts` n'est pas touché (le dossier vient de `workspaceOf`).
  - **Interface** : `panel/CommitForm.tsx` (le formulaire de la barre du worktree, sorti pour être
    partagé), `panel/MainDirtyCard.tsx` (encadré et phrase de remise), `panel/FolderCommitBar.tsx` ;
    `useWorktreeCycle` dit quand le main a répondu (`known`), pour ne pas montrer la barre hors
    worktree le temps de savoir. Cases à cocher de la vue Git dans les deux cas.
  - **Essais** : `git-errors.test.ts` ; `worktree-cycle.test.ts` (dossier principal sale : refus
    d'avance sans rien bouger, base pas extraite là, mise de côté et remise, remise en conflit,
    erreur de git en entier quand l'arbre se salit après la vérification, « Committer d'abord »,
    commit hors worktree, sous-dossier, « Défaire » refusé une fois poussé) ;
    `children-merge.test.ts` (plan et départ refusés, chaîne avec mise de côté, remise qui échoue,
    « Committer d'abord » puis fusion, canaux) ; `worktree-ipc.test.ts` ; `CommitBars.test.tsx`
    et `SubtasksMerge.test.tsx`. E2E `filles-fusion` (dossier principal sale : carte, formulaire
    proposé, « Mettre de côté » sur la fusion des trois avec conflit et nettoyage, modifications
    revenues) et `git` (« Committer » hors worktree, puis « Défaire »), clair et sombre : captures
    `123-fusion-refusee`, `123-fusion-committer-d-abord`, `120-fusion-finie`,
    `123-committer-hors-worktree`, `123-committe-hors-worktree` regardées.
  - **Écarts et choix** :
    - « Committer d'abord » commite tous les fichiers listés puis lance la fusion (bouton
      « Committer puis fusionner ») : c'est ce que « d'abord » promet. Pas de « Défaire » dans
      l'encadré : la vue Git de la mère l'offre désormais.
    - Dans la barre d'un worktree, l'issue de la mise de côté est dite dans la note de fin, pas dans
      le fil de la conversation (le fil de la mère, lui, la porte dans l'élément `children-merge`).
    - La barre hors worktree n'apparaît qu'avec au moins un fichier coché, ou après un commit
      (pour « Défaire ») : rien de plus dans une vue Git propre.
    - « Défaire » hors worktree refuse un commit déjà dans la branche suivie (`@{u}`).
    - Barre d'un worktree : « Mettre de côté » est retenu pour la reprise après un conflit
      (« Réessayer », « Laisser l'agent résoudre », qui prend lui aussi `{ stash }`) : pas de
      seconde question une fois le conflit résolu. Trouvé par la suite e2e `worktree-cycle`, dont
      le dossier principal garde `notes.txt` non commité : elle passe maintenant par l'encadré
      (capture `123-worktree-fusion-refusee`) et vérifie la remise.
    - Pendant une chaîne mise de côté, si la mère réécrit le dossier principal, la fille suivante
      échoue sur un refus `main-dirty` dit en clair, et la chaîne s'arrête.
    - L'essai `filles-fusion` relève la carte au moment où la deuxième fille passe à « l'agent
      résout le conflit » (observateur posé avant le clic) : cet état dure parfois moins qu'une
      sonde, et l'essai échouait de temps en temps en sombre.
  - **E2E** : `pnpm build && pnpm e2e --changed` (toutes les suites, l'interface partagée ayant
    bougé) : 109 sur 110 vertes ; `handover` clair a échoué une fois sous charge (machine partagée
    avec d'autres sessions qui lançaient leurs essais), vert relancé seul, sur cette branche comme
    sur `d80a5dd` : sans lien avec cette fiche. `git`, `worktree-cycle`, `filles-fusion` : verts en
    clair et sombre, relancés une à la fois.
  - **Non vérifié** : la scène 3.3 des PV (Bob et OpenCode) est à rejouer avec un vrai agent ;
    `--lang en` pas relancé (les essais comparent par `L('clé')`).

