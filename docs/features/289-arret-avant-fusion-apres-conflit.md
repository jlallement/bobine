# 289 — S'arrêter avant de fusionner un conflit résolu par l'agent

- **Statut** : en cours (1.2)
- **Dépend de** : 110 (conflit renvoyé à l'agent), 120 et 264 (fusion enchaînée depuis la carte,
  carte de groupe, carte d'un travail), 123 et 287 (refus de la fusion), 177 et 265 (« Faire
  relire »)
- **Agents** : aucun. La fusion enchaînée, git et la carte ne dépendent d'aucun agent ; la consigne
  de conflit reste la même (fiche 110), rien n'est propre à Bob ni à OpenCode (ADR-0011).

## Pourquoi

Évaluation réelle « Bricole » (`bricole-evaluation/journal.md`, séance 3) :

- 21:16 : fusion des deux travaux recommandés depuis la carte de groupe ; le second entre en
  conflit, Bobine renvoie le conflit au travail (« résout le conflit »), puis « 2 travaux fusionnés
  dans master en 1 min 3 s ». « Aucun geste de l'utilisateur. »
- 21:17 : « Après cette résolution automatique, master est rouge : `npm test` → 2 échecs […].
  Bobine a fusionné la résolution sans faire tourner les tests ni la relire ; ni la carte ni la
  conversation principale ne le signalent. Un utilisateur confiant pousserait un master cassé. »

Une résolution de conflit est du code neuf écrit par l'agent, que personne n'a relu. Décision de
l'utilisateur (2026-11-26) : **s'arrêter avant de fusionner**. Le conflit résolu reste dans la
branche du travail, la carte demande une relecture, et la fusion ne part que sur un clic.

## Critères d'acceptation

- [ ] Fusion enchaînée (carte de groupe, carte « Sous-tâches », carte d'un travail) : au conflit, la
      consigne part au travail comme avant ; à la fin de son tour, si les marqueurs ont disparu, la
      résolution est commitée **dans la branche du travail** et la base (`main`) n'avance pas. La
      chaîne s'arrête là ; les travaux suivants restent en attente.
- [ ] La carte dit l'état « conflit résolu, à relire » : pastille de la ligne, phrase du pied (qui
      nomme le travail, les fichiers et la base), et donne accès au diff par l'existant : « Voir la
      résolution » (vue Git du travail, comme « Voir le conflit ») et « Faire relire » (fiche 265)
      quand la carte le propose.
- [ ] Rien n'entre dans la base sans clic : la fusion repart par les boutons existants de la carte
      (« Fusionner … dans main », « Fusionner dans main » d'un travail), donc par tous leurs refus
      (fusion en cours, tour en cours, travail au travail ou en relecture, dossier principal non
      commité avec « Committer d'abord » / « Mettre de côté », base extraite ailleurs, branche non
      commitée).
- [ ] L'état survit à un redémarrage de l'app (posé dans le fil de la conversation, comme toute
      fusion enchaînée, fiche 103).
- [ ] Vue Git d'un worktree, « Laisser l'agent résoudre » : même arrêt ; la barre dit « Conflit
      résolu par l'agent dans …, dans la branche : rien n'est entré dans main », « Fusionner dans
      main » part au clic avec ses refus. Pour une fille, l'état est dit chez la mère (sa ligne
      « à relire ») et relu par la vue Git après un redémarrage.
- [ ] Worktree sans mère : après un redémarrage, rien n'est fusionné et « Fusionner dans main »
      reste le seul chemin (la note ne revient pas : hors champ, voir plus bas).
- [ ] Un clic tombé entre l'affichage « à relire » et la fin de la chaîne (remise du stash) est
      refusé (« fusion en cours ») : rien ne part.
- [ ] Sans conflit : rien ne change. Conflit dont il reste des marqueurs : rien ne change (« Réessayer »,
      « Abandonner », « Voir le conflit »). Conflit résolu à la main puis « Réessayer » : la fusion part
      sur ce clic, comme avant.
- [ ] L'historique final est le même qu'avant (commit de fusion réécrit, la base en premier parent :
      `mergeIntoBase`), seulement décalé au clic.
- [ ] Essais : unitaires (moteur `ChildrenMerger`, `WorktreeCycle.concludeMerge`, cartes) et e2e
      contre l'agent factice (scénario `conflits`, qui retire les marqueurs à la consigne de conflit)
      dans `filles-fusion` (rejoue le journal, redémarrage compris) et `parcours-deleguer`.

### Résolu automatiquement ou par l'utilisateur

Est « résolu automatiquement » **exactement** le cas où la fusion enchaînée (`ChildrenMerger.mergeRow`)
a envoyé elle-même la consigne de conflit au travail (`prompt` avec `from: merge`) et où le tour de
l'agent qui suit a retiré les marqueurs. C'est le seul chemin où Bobine fait résoudre un conflit puis
fusionnait sans geste de l'utilisateur ; l'état « à relire » est posé là, et nulle part ailleurs.

Second chemin, ajouté sur décision du tech lead (2026-11-26) : « Laisser l'agent résoudre » de la vue
Git d'un worktree (`worktree:resolveWithAgent`, fiche 110) quand une fusion y est arrêtée sur des
conflits. Même règle : la résolution est commitée dans la branche (`concludeMerge`), rien n'entre dans
la base sans un clic sur « Fusionner dans main ».

Tout le reste part d'un clic de l'utilisateur sur une résolution qu'il a faite lui-même, et ne change
pas : « Réessayer » sur la carte ou dans la vue Git après une résolution à la main (`mergeContinue`),
« Laisser l'agent résoudre » quand il ne reste plus de conflit en cours (rien n'est envoyé à l'agent),
et les fusions de la vue Git.

**Hors champ (décision du tech lead, 2026-11-26)** : pour une conversation en worktree **sans mère**
(« Nouvelle conversation dans un worktree »), la note « à relire » de la vue Git ne survit pas au
redémarrage : pas de nouveau stockage pour cela. Après redémarrage, rien n'est fusionné et
« Fusionner dans main » reste le seul chemin (affirmé par l'e2e `worktree-cycle`).

## Plan

Écrit avant de coder.

1. **Trace réelle d'abord** : `e2e/suites/filles-fusion.mjs` rejoue déjà le cas du journal (fusion
   de la carte de groupe, le deuxième travail entre en conflit, l'agent factice le résout). La suite
   attend désormais, après la résolution : la fusion arrêtée (`data-status="review"`), la ligne
   « conflit résolu · à relire », `main` sans la résolution. Contrôles qui ne lèvent pas : sur le code
   actuel, ils échouent (rouge constaté, noté au journal), la suite va au bout. Puis : redémarrage,
   l'état est toujours là ; « Voir la résolution » ouvre la vue Git du travail ; clic sur la fusion
   (dossier principal non commité : « Mettre de côté ») ; `main` a la résolution.
2. **Git** (`src/main/changes/worktree-cycle.ts`) : `concludeMerge(target)` — la fusion arrêtée
   dans le worktree est commitée dans sa branche (fichiers sans marqueur ajoutés, commit, puis
   `mergeIntoBase` pour le même historique qu'avant), sans toucher à la base ni au dossier principal.
   Rend `resolved`, `conflicts` (marqueurs restants) ou `not-merging` (plus de fusion en cours et la
   base absente de la branche : fusion abandonnée pendant le tour). `mergeContinue` partage le commit.
3. **Moteur** (`src/main/conversations/children-merge.ts`) : après le tour de l'agent, `concludeMerge`
   au lieu de `merge` ; `resolved` → ligne `resolved`, fusion `review`, chaîne arrêtée (stash remis,
   nettoyage des seules lignes fusionnées, comme pour un arrêt).
4. **Contrat partagé** (`src/shared/children-merge.ts`) : `MergeRowState` + `resolved`,
   `ChildrenMergeStatus` + `review` (non active : `settledMerge` la garde telle quelle au redémarrage).
5. **Cartes** (renderer) :
   - `SubtasksMerge.tsx` : pastille `resolved` (couleur d'avertissement), `rowMergeState` la garde
     tant que le travail n'est pas fusionné ; pied : phrase « à relire » dans le résultat, rangée
     « Voir la résolution » (`openGit`) et « Faire relire » (`onReview`, carte de groupe), puis le pied
     habituel (résumé, `MergeButtons` ou `MainDirtyCard`) qui porte la fusion et ses refus.
   - `WorkGroup.tsx` : passe `onReview` au pied.
   - `WorkMerge.tsx` (carte d'un travail) : issue `resolved` gardée même branche prête, avec « Voir
     la résolution » ; « Fusionner dans main » et « Faire relire » restent ceux de la carte.
   - CSS : `.subtask-merge-state.resolved`, `.work-merge-box.review`.
6. **Textes** (`fr.json`, `en.json`) : pastilles, phrases du résultat, « Voir la résolution », et
   `workGroup.merge.resolving` / `childrenMerge.progress` qui promettaient « puis la fusion reprend ».
   Guide (`docs/guide/{fr,en}/conversations-filles.md`) mis à jour.
7. **Essais** : `children-merge.test.ts` (arrêt, base intacte, reprise au clic, marqueurs restants,
   fusion abandonnée), `worktree-cycle.test.ts` (`concludeMerge` en vrai dépôt), tests des cartes
   (`SubtasksMerge.test.tsx`, `WorkGroup.test.tsx` ou `WorkCard.test.tsx`), e2e `filles-fusion` et
   `parcours-deleguer`.
8. Clôture : index, CHANGELOG (fr, en), journal.

9. Ajout (décision du tech lead, 2026-11-26) : `worktree:resolveWithAgent` → `concludeMerge`, issue
   `resolved` (`ResolveOutcome`), dit chez la mère par `ChildMergeRecorder.resolved` ; `worktree:info`
   relit `review` ; `WorktreeBar` : note `resolved` (nouvel état de la note existante, pas d'écran).
   Essais : `worktree-ipc.test.ts`, `WorktreeBar.test.tsx`, e2e `worktree-cycle`.

Aucune nouvelle dépendance. Pas d'ADR : la décision prolonge la fiche 120 (fusion enchaînée) sans
nouveau choix structurant ; elle est consignée ici.

## Journal

- 2026-11-26 : fiche et plan.
- 2026-11-26 : **rouge constaté** avant le correctif (seules les clés i18n et les essais avaient
  changé, aucun comportement) :
  - `pnpm vitest run src/main/conversations/children-merge.test.ts` : 3 échecs sur 28 —
    « expected 'done' to be 'review' » (×2 : la fusion va au bout après la résolution de l'agent),
    « expected 'conflict' to be 'failed' » (fusion abandonnée pendant le tour : refaite en silence) ;
    le cas « résolu à la main puis Réessayer » passait déjà (non-régression voulue).
  - `pnpm build && pnpm e2e filles-fusion` (clair) : `✗ fiche 289 : la fusion s'arrête après la
    résolution du conflit par l'agent […] (null)`, `✗ fiche 289 : rien de la résolution ni des travaux
    suivants n'est entré dans main`, puis l'exception attendue (`ENOENT …/.worktrees/…/README.md` :
    branche déjà fusionnée et nettoyée). La capture d'échec montre « 3 travaux fusionnés dans main en
    1 s » sans aucun geste : le cas du journal Bricole, rejoué.
- 2026-11-26 : correctif selon le plan. Écarts :
  - Une fusion abandonnée par l'agent pendant son tour (plus de `MERGE_HEAD`, base absente de la
    branche) n'est plus refaite en silence : ligne `failed`, raison dite (`childrenMerge.error.notResolved`).
  - La relance passe par le pied habituel de la carte : si la recommandation de l'agent de la
    conversation précède la résolution, elle est « À revoir » (un compte rendu est arrivé depuis) et
    le travail tombe dans « Inclure les M autres… » avec confirmation — règle existante (fiche 160),
    cohérente avec « à relire ».
  - Pas de nouveau scénario d'agent factice : `conflits` retire déjà les marqueurs à la consigne de
    conflit (fiche 110), c'est exactement le comportement à rejouer.
  - Capture « avant » en clair seulement (la suite rouge s'arrête sur l'exception avant le sombre).
- 2026-11-26 : vérification du premier lot : `./scripts/verify` sorti 0 (commit 2ec05491).
  Fusion de `1.2` (1.2.0-rc.1) ; « Prochaine version » gardée en tête des deux CHANGELOG.
- 2026-11-26 : second chemin, « Laisser l'agent résoudre » de la vue Git (décision du tech lead).
  **Rouge constaté** : `worktree-ipc.test.ts`, 2 échecs sur 21 (« expected { status: 'merged' … } to
  deeply equal { status: 'resolved' … } » : la fusion reprenait d'elle-même).
  Limite assumée : pour une conversation en worktree **sans mère** (« Nouvelle conversation dans un
  worktree »), la note « à relire » de la vue Git ne survit pas au redémarrage (rien où la poser sans
  nouveau stockage) ; la fusion, elle, ne part toujours que sur un clic.
