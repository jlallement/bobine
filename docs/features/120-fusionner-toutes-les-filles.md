# 120 — Fusionner toutes les filles finies depuis la carte « Sous-tâches »

- **Statut** : fait (essai réel Bob et OpenCode à faire)
- **Dépend de** : 097 (conversations filles), 110 (cycle complet d'un worktree, ADR-0022), 103
  (fil durable), 117 (carte « Sous-tâches »), 080 (journal)
- **Agents** : les deux. Tout passe par `git` en ligne de commande dans le main process et, en cas
  de conflit, par le message générique de la fiche 110 à la conversation fille ; aucun code propre
  à un agent (ADR-0011).

## Pourquoi

Quand trois filles ont fini, l'utilisateur doit aujourd'hui ouvrir chacune, aller dans sa vue Git
et refaire le cycle de la fiche 110 (fusionner, résoudre, nettoyer) trois fois. La mère sait déjà
tout : ses filles, leur ordre de lancement, leurs branches. Depuis sa carte « Sous-tâches », on
veut fusionner toutes les filles finies dans la base, l'une après l'autre, avec les conflits
résolus par la fille concernée.

## Maquette validée

1. **Pied de la carte « Sous-tâches »** (fond `--surface-2`), quand au moins une fille finie
   (`done` ou `unread`) a une branche non fusionnée : une phrase d'état et deux boutons.
   - Phrase : « Les 3 branches sont finies et ne touchent pas les mêmes fichiers. », ou « 2 branches
     finies ; « E2E plus courts » travaille encore. », ou « Les branches « A » et « B » touchent
     src/x.ts toutes les deux : la seconde pourra entrer en conflit. » Recouvrement calculé par le
     main : `git diff --name-only <base>...<branche>` pour chaque fille.
   - Une fille finie avec des modifications non commitées est exclue et dite (« « A » a des
     modifications non commitées : à committer depuis sa vue Git. ») ; pas de commit automatique.
   - « Fusionner les N dans main » (accent ; `main` = branche de base) et « Puis nettoyer » (bordé,
     bascule, décoché par défaut : chaque fille fusionnée est archivée, worktree et branche
     supprimés, comme « Nettoyer » de la fiche 110).
2. **Fusion enchaînée**, côté main, dans l'ordre de lancement, par `WorktreeCycle.merge`
   (ADR-0022). Sur chaque ligne : « fusionnée » (`--ok`), « fusion en cours » (accent, spinner),
   « en attente » (`--muted`), « conflit » (`--err`), « déjà à jour ». Pied : « Fusion dans main,
   l'une après l'autre : 1 sur 3 faite. Au premier conflit, la fille concernée le résout, puis la
   fusion reprend. » et « Arrêter ». Conflit : `conflictPrompt` part à la fille, la chaîne reprend à
   la fin de son tour si les marqueurs ont disparu, sinon s'arrête et le dit avec « Réessayer » et
   « Abandonner ». Fin : « 3 fusionnées dans main en 12 s ».
3. **IPC** : `children:mergePlan`, `children:merge`, `children:mergeStop` ; l'état est poussé par
   l'évènement de conversation habituel (élément `children-merge` du fil de la mère).

## Critères d'acceptation

- [x] Pied de carte avec la phrase d'état (prêtes, au travail, recouvrements, non commitées) et
      les deux boutons ; absent sans fille finie à fusionner.
- [x] Fusion enchaînée dans l'ordre de lancement, par `WorktreeCycle.merge` ; état de chaque ligne
      en direct ; « déjà à jour » pour une fille sans rien à fusionner.
- [x] Conflit : consigne générique à la fille (fiche 110), reprise à la fin de son tour si les
      marqueurs ont disparu, sinon arrêt dit, avec « Réessayer » et « Abandonner ».
- [x] « Arrêter » finit la fusion en cours (jamais de base à moitié avancée), les autres restent en
      attente.
- [x] « Puis nettoyer » : filles fusionnées archivées, worktrees et branches supprimés.
- [x] État mémorisé dans le fil de la mère (élément `children-merge`) : survit au redémarrage et au
      rejeu (fiche 103) ; une fusion interrompue par la fermeture de l'app est dite.
- [x] Refus clairs : base extraite dans un autre worktree, fille supprimée entre-temps, fusion déjà
      en cours ; pas de push, pas de PR.
- [x] Toute commande git dans `agents.log` (fiche 080).
- [x] Tests unitaires sur dépôts git jetables : deux filles sans recouvrement fusionnées dans
      l'ordre, recouvrement détecté, conflit sur la deuxième résolu puis reprise, arrêt,
      nettoyage, fille avec modifications non commitées exclue.
- [x] Testé contre l'agent factice : suite e2e `filles-fusion` (scénario `conflits`), clair,
      sombre, `--lang en`, captures regardées.

## Plan

Pas d'écart à l'ADR-0022 : chaque fille passe par `WorktreeCycle.merge` (la base entre dans le
worktree, puis avance en fast-forward). Pas de nouvel ADR, pas de nouvelle dépendance.

### Fichiers

- `src/shared/children-merge.ts` (nouveau) : types (`ChildrenMerge`, lignes et états,
  `ChildrenMergePlan`, candidates), recouvrements (`mergeOverlaps`), phrase d'état
  (`mergeSummary`, messages i18n), fusion interrompue (`settledMerge`), dernière fusion du fil.
  Tests.
- `src/shared/agent.ts`, `src/shared/transcript.ts` : évènement et élément `children-merge` ; le
  réducteur remplace l'élément de la même fusion (`runId`) au lieu d'en ajouter un.
  `src/shared/export.ts` : une ligne à l'export.
- `src/main/changes/worktree-cycle.ts` : `branchState` (état léger d'une branche : modifications,
  commits d'avance, fusion arrêtée, fichiers modifiés depuis la base), `baseElsewhere`,
  `baseBranchOf` publics. Tests.
- `src/main/conversations/children-merge.ts` (nouveau) : `ChildrenMerger` (`plan`, `start`,
  `stop`) : ordre de lancement lu dans le fil de la mère, boucle de fusion, consigne de conflit et
  reprise, arrêt, nettoyage, état posé par `post`. Tests sur dépôts jetables.
- `src/main/conversations/children-merge-ipc.ts` (nouveau) : canaux `children:*`, arguments
  vérifiés ; `childrenMergeDeps` pour `index.ts` (à 822 lignes sur 850). `manager.ts` (1046 sur
  1050) n'est pas touché.
- `src/shared/ipc.ts`, `src/preload/api.ts`, `src/main/ipc.ts`, `src/main/index.ts` : canaux, API,
  branchement.
- `src/renderer/src/components/thread/SubtasksMerge.tsx` (nouveau) : pied de carte, état de
  chaque ligne ; `Subtasks.tsx` l'accueille ; `Transcript.tsx` cache l'élément `children-merge` ;
  `App.tsx` passe les actions (plan, fusion, arrêt, ouvrir la vue Git d'une fille).
- `styles.css`, `fr.json`, `en.json`.
- `e2e/suites/split-fusion.mjs` (nouveau), `e2e/catalog.mjs`.
- `docs/architecture.md`, `CHANGELOG.md`, `CHANGELOG.en.md`, `docs/features/README.md`.

### Choix

- **Ordre** : celui des éléments `child-started` du fil de la mère.
- **Candidates** : filles finies (`done` ou `unread`), sans modification non commitée, avec des
  commits que la base n'a pas. Une fille arrêtée sur un conflit (fusion déjà tentée) est reprise.
- **Nettoyage** : à la fin de la chaîne, pour les filles fusionnées ou déjà à jour.
- **« Réessayer »** reprend la chaîne à la fille en conflit (`WorktreeCycle.merge` reprend une
  fusion arrêtée) ; **« Abandonner »** est `git merge --abort` dans la fille (canal
  `worktree:mergeAbort` de la fiche 110) ; « Voir le conflit » ouvre sa vue Git.

## Journal

- 2026-10-22 — Fiche créée d'après la maquette validée ; plan ci-dessus.
- 2026-10-22 — **Fait**, selon le plan, sur la branche du worktree (pas de fusion dans `main`, pas
  de push).
  - **Main** : `conversations/children-merge.ts` (`ChildrenMerger`), `children-merge-ipc.ts`
    (canaux, `childrenMerger` pour `index.ts`, une ligne de plus) ; `WorktreeCycle` gagne
    `branchState` et `baseElsewhere`, et `baseBranch` devient public. `manager.ts` n'est pas touché.
  - **Fil** : évènement et élément `children-merge` ; le réducteur remplace l'élément de la même
    fusion (`runId`), il n'en ajoute pas un par étape. L'élément n'est pas affiché à sa place
    (`Transcript`), ne part pas à l'agent de la mère, et donne une ligne à l'export.
  - **Interface** : `thread/SubtasksMerge.tsx` (hook `useChildrenMerge`, pastille de ligne, pied
    de carte) ; la carte relit les branches quand l'état d'une fille ou de la fusion change, et à
    chaque retour sur la mère (une fille commitée depuis sa vue Git est donc vue en revenant).
  - **Essais** : `shared/children-merge.test.ts` (phrase d'état, recouvrements, fusion interrompue,
    élément remplacé), `conversations/children-merge.test.ts` (dépôts jetables : deux filles dans
    l'ordre de lancement, recouvrement, conflit résolu puis reprise, conflit qui reste puis
    « Réessayer », arrêt, nettoyage, fille non commitée, filles au travail, refus, fille supprimée
    pendant la chaîne, base extraite ailleurs, canaux IPC), `thread/SubtasksMerge.test.tsx`
    (pied de carte, progression, arrêt, fin, conflit, interruption). Suite e2e `filles-fusion`
    (clair, sombre, `--lang en`) : captures `120-fusion-pied`, `120-fusion-en-cours`,
    `120-fusion-finie` regardées ; redémarrage de l'app vérifié.
  - **Écarts et choix** :
    - « Réessayer » reprend la chaîne à la fille en conflit (et aux suivantes) au lieu d'ouvrir
      seulement la fille ; « Abandonner » est `git merge --abort` dans la fille (fiche 110) ; un
      troisième bouton, « Voir le conflit », ouvre sa vue Git.
    - « Arrêter » pendant que la fille résout un conflit attend la fin de son tour : couper le tour
      laisserait la fusion à moitié dans son worktree.
    - Les filles « déjà à jour » sont nettoyées avec les fusionnées (leur travail est dans la base).
    - Une fille qui devient non commitée pendant la chaîne est sautée (« non commitée ») ; une
      fille supprimée pendant la chaîne échoue sur sa ligne ; les autres continuent. La base extraite
      ailleurs, un fast-forward refusé dans le dépôt principal : la chaîne s'arrête.
    - « Dépôt sans commit » : une fille ne peut pas exister sans commit (le worktree l'exige,
      fiche 036) ; le cas tombe dans le refus générique (erreur de git dite sur la ligne).
    - La lecture des branches passe `--no-optional-locks` à `git status` : sinon elle prend un
      instant le verrou de l'index et fait échouer un `git add` lancé au même moment (vu en e2e).
  - **Non vérifié** : essai réel avec Bob et OpenCode (résolution d'un vrai conflit par l'agent) ;
    la capture « en cours » montre selon la vitesse la deuxième fille en résolution ou déjà
    fusionnée (l'état « l'agent résout le conflit » est vérifié par l'essai, et rendu par le test
    du composant).
- 2026-10-23 — **Écart (fiche 123, D22 de la recette)** : le plan lit aussi le dossier principal ;
  non commité, la fusion ne part pas (refus `main-dirty` avec les fichiers, « Committer d'abord »,
  « Mettre de côté » autour de toute la chaîne, dit dans l'élément `children-merge`).
- 2026-10-26 — **Progression masquée par une ancienne lecture** (fiche 151) : le main envoyait
  bien `resolving`, mais le hook réutilisait un plan antérieur `running: false` et déclarait
  momentanément la fusion interrompue. Les lectures sont rattachées à la mère et à l’état qu’elles
  ont interrogé ; seule une réponse actuelle peut constater un arrêt. Tests de régression :
  départ après un plan au repos, résolution pendant une lecture lente, réponse périmée, changement
  de mère, et reprise d’une véritable interruption après redémarrage. Deux tests rouges avant le
  correctif, trois verts après ; les 32 tests ciblés hook/carte/moteur passent. Reprise e2e ciblée
  `filles-fusion simulator usage-board` : les six tâches clair/sombre passent (59 s), avec
  résolution visible, progression, restauration du stash et résultat Git vérifiés ; captures regardées.
