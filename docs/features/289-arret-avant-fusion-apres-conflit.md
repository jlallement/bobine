# 289 — S'arrêter avant de fusionner un conflit résolu par l'agent

- **Statut** : fait (1.2), à repasser par le testeur
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

- [x] Fusion enchaînée (carte de groupe, carte « Sous-tâches », carte d'un travail) : au conflit, la
      consigne part au travail comme avant ; à la fin de son tour, si les marqueurs ont disparu, la
      résolution est commitée **dans la branche du travail** et la base (`main`) n'avance pas. La
      chaîne s'arrête là ; les travaux suivants restent en attente.
- [x] La carte dit l'état « conflit résolu, à relire » : pastille de la ligne, phrase du pied (qui
      nomme le travail, les fichiers et la base), et donne accès au diff par l'existant : « Voir la
      résolution » (ses modifications, onglet Conversation du travail) et « Faire relire » (fiche 265)
      quand la carte le propose.
- [x] Rien n'entre dans la base sans clic : la fusion repart par les boutons existants de la carte
      (« Fusionner … dans main », « Fusionner dans main » d'un travail), donc par tous leurs refus
      (fusion en cours, tour en cours, travail au travail ou en relecture, dossier principal non
      commité avec « Committer d'abord » / « Mettre de côté », base extraite ailleurs, branche non
      commitée).
- [x] L'état survit à un redémarrage de l'app (posé dans le fil de la conversation, comme toute
      fusion enchaînée, fiche 103).
- [x] Vue Git d'un worktree, « Laisser l'agent résoudre » : même arrêt ; la barre dit « Conflit
      résolu par l'agent dans …, dans la branche : rien n'est entré dans main », « Fusionner dans
      main » part au clic avec ses refus. Pour une fille, l'état est dit chez la mère (sa ligne
      « à relire ») et relu par la vue Git après un redémarrage.
- [x] Worktree sans mère : après un redémarrage, rien n'est fusionné et « Fusionner dans main »
      reste le seul chemin (la note ne revient pas : hors champ, voir plus bas).
- [x] Un clic tombé entre l'affichage « à relire » et la fin de la chaîne (remise du stash) est
      refusé (« fusion en cours ») : rien ne part.
- [x] Sans conflit : rien ne change. Conflit dont il reste des marqueurs : rien ne change (« Réessayer »,
      « Abandonner », « Voir le conflit »). Conflit résolu à la main puis « Réessayer » : la fusion part
      sur ce clic, comme avant.
- [x] L'historique final est le même qu'avant (commit de fusion réécrit, la base en premier parent :
      `mergeIntoBase`), seulement décalé au clic.
- [x] Essais : unitaires (moteur `ChildrenMerger`, `WorktreeCycle.concludeMerge`, cartes) et e2e
      contre l'agent factice (scénario `conflits`, qui retire les marqueurs à la consigne de conflit)
      dans `filles-fusion` (rejoue le journal, redémarrage compris) et `parcours-deleguer`.

### Résolu automatiquement ou par l'utilisateur

**Définition (depuis le rapport du testeur, 2026-11-27) : la marque enregistrée.** Dès que la consigne
de conflit part à l'agent — fusion enchaînée d'une carte, ou « Laisser l'agent résoudre » de la vue Git
—, une marque est écrite dans le dossier git du worktree (`bobine-agent-resolution.json` :
tête de la branche avant le tour, commit de base fusionné, fichiers en conflit). Elle survit au
redémarrage. Tant qu'elle est au stade `resolving`, **toute** conclusion de cette fusion, quel que soit
le chemin (fin du tour, « Réessayer », « Fusionner » de la vue Git, après redémarrage, fin à la main
d'une résolution partielle), se fait dans la branche et s'arrête « à relire » ; rien n'entre dans la
base. Elle passe au stade `review` quand l'arrêt a été dit (fil de la mère, note de la vue Git) : la
fusion suivante est celle de l'utilisateur. Elle tombe à la fusion dans la base ou à l'abandon
(`main/changes/merge-conclude.ts`).

Jamais « résolu » : marqueurs restants dans ce que la résolution touche (index, ou commit fait par
l'agent), branche défaite par l'agent (tête d'avant plus dans la branche : échec dit, avec cette
tête), branche entrée dans la base pendant le tour, fusion abandonnée.

Est « résolu par l'utilisateur » ce qui n'a jamais été confié à l'agent : une fusion de la vue Git
arrêtée sur des conflits, finie à la main, puis « Réessayer » — elle part sur ce clic, comme avant.

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
   l'état est toujours là ; « Voir la résolution » ouvre la vue Git du travail (écart : onglet
   Conversation, voir le journal) ; clic sur la fusion
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
     « Voir la résolution » (`openGit(…, 'conversation')`, onglet Conversation) et « Faire relire » (`onReview`, carte de groupe), puis le pied
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
- 2026-11-26 : **rouge e2e de la vue Git constaté** sur le build de `2ec05491` (ancienne vue Git) :
  `worktree-cycle`, clair et sombre, « ✗ fiche 289 : « Laisser l'agent résoudre » s'arrête… »,
  « ✗ main n'a pas bougé… », « ✗ après redémarrage (sans mère) : rien n'est fusionné… » ; les 235
  autres jeux du `--changed` de ce build étaient verts.
- 2026-11-26 : sur `0f13512a`, `worktree-cycle` montrait que la fusion au clic après relecture avance
  `main` en fast-forward (le commit de fusion est fait à la résolution) : la note dit « Fusionné dans
  main (fast-forward) » et non plus « (commit de fusion) » ; l'historique est le même (sujet
  « Merge branch… »). Essai ajusté (écart assumé). `verify` y a échoué une fois sur un délai sans
  rapport (`file-tree.test.ts`, 21 s sous charge), vert seul ensuite.
- 2026-11-27 : **vert** sur `38a4ee0a` : `./scripts/verify` 0 ; `pnpm build` 0 ;
  `pnpm e2e --themes both worktree-cycle filles-fusion parcours-deleguer filles-retouches
  travaux-groupe filles-tech-lead commit-redige` 14/14 (clair et sombre). Pas de `--changed` complet
  (règle de la nuit : le tech lead joue la suite complète sur la branche d'intégration). Captures
  regardées : `e2e/captures/289-fusion-a-relire-*`, `289-voir-la-resolution-*` (vue Conversation),
  `289-worktree-a-relire-*`.
- 2026-11-27 : retouches de la revue UX/BA : pied de carte dans l'ordre « à relire », ce qui est déjà
  fusionné, nettoyage, mise de côté (première phrase en gras ; résumé « ne touchent pas les mêmes
  fichiers » masqué pendant qu'un travail est à relire) ; « N à relire » dans l'en-tête de la carte de
  groupe ; textes reformulés pour ne promettre aucun bouton « Fusionner » (quand le dossier principal
  n'est pas commité, le geste est « Mettre de côté » ou « Committer d'abord ») ; deux entrées
  publiées du CHANGELOG anglais rétablies (« Request review »).
- « Voir la résolution » ouvre l'onglet **Conversation** du travail : il montre **toutes** les
  modifications de l'agent dans cette conversation, regroupées par fichier (`shared/changes.ts`),
  pas seulement le tour de résolution. Le compte (« +1 −5 » sur README.md dans l'e2e) part du fichier
  avec ses marques, alors que la ligne de la carte (« +1 −1 ») compare la branche à sa base. Un autre
  fichier touché pendant ce tour s'y ajouterait, ainsi que tout ce que l'agent a modifié avant.

### Reste à faire avant la 1.2.0 finale (second passage du testeur)

- **N1** : l'agent peut supprimer lui-même la marque pendant son tour (elle est dans le dossier git
  du worktree, à sa portée) : la ligne passe alors en échec avec un message faux, et « Réessayer »
  fusionne sa résolution. Limite assumée pour la version candidate : l'app ne fusionne jamais d'elle-
  même, et un agent qui écrit dans `.git` peut aussi bien fusionner lui-même. Piste : doubler la
  marque côté app (hors de portée de l'agent), ou conclure prudemment dès qu'une fusion est en cours
  ou qu'un commit est apparu depuis la consigne.
- **N4** : consigne refusée avant toute action de l'agent, résolution à la main, « Réessayer » : un
  arrêt « à relire » de trop (prudent, un clic de plus).
- **N5** : `rowMergeState` fait passer une ligne `resolved` avant un plan frais en `conflict`
  (affichage seulement ; le clic relit git).
- Après redémarrage, le compte « 2 modifications… » de la ligne peut être périmé (affichage seulement,
  confirmé par le testeur).

### Reste à faire, après la 1.2.0

- La barre latérale met une coche verte à un travail « à relire » (elle ne connaît pas l'état de
  fusion) ; elle devrait le dire comme la carte.
- 2026-11-27 : **rapport du testeur** (vrais dépôts, `scratchpad/testeur-289/`) : un chemin faisait
  entrer une résolution non relue dans `main` — redémarrage pendant le tour de résolution, puis
  « Fusionner » (T11) ; autres défauts : fusion cliquée pendant le tour (T10, I2), marqueurs indexés ou
  commités dits « résolus » (T1, T2), commit de fusion de l'agent avec la branche en premier parent
  (T2), `reset --hard` dit « à relire » (T6b), fichiers de la résolution incomplets (T5b), « à relire »
  collé à un worktree supprimé (C4), consigne mise en file sur une conversation occupée (point 7).
  **Rouge constaté** : `children-merge-agent.test.ts`, 10 échecs sur 10 avant le correctif.
- Correctif : la marque (ci-dessus) ; la chaîne et « Laisser l'agent résoudre » concluent après le tour
  par `concludeAgent` (jamais dans la base, même si un clic pendant le tour a dit « à relire ») ; la
  vue Git refuse « Fusionner », « Réessayer » et « Laisser l'agent résoudre » pendant un tour de la
  conversation (`turn` dans la vue, bouton grisé avec sa raison) ; « à relire » nomme les fichiers de
  la consigne et ceux où le commit de fusion diffère de ses deux parents ; « à relire » d'un worktree
  disparu dit qu'il n'existe plus. Essais : `children-merge-agent.test.ts` (T1, T2, T2b, T3, T5b, T6b,
  T9, T10, T11), `worktree-ipc-agent.test.ts` (I1, I2, I3, I5, point 7, en vrai dépôt), les 23 essais
  du testeur rejoués tels quels : verts. `toolError` et `lineCounts` sortis dans `git-text.ts` (borne de
  800 lignes de `worktree-cycle.ts`).
- 2026-11-27 : e2e `filles-fusion-redemarrage` (nouvelle) : l'app fermée pendant le tour de résolution
  (tour retenu par le verrou de l'agent factice), au redémarrage « Fusionner » s'arrête « à relire »,
  le clic suivant fusionne. La ligne garde « à relire » même lue dans un plan d'avant la conclusion.
  **Vert** sur `4d52447e` : `./scripts/verify` 0, `pnpm build` 0, `pnpm e2e --themes both
  worktree-cycle filles-fusion filles-fusion-redemarrage parcours-deleguer filles-retouches
  travaux-groupe filles-tech-lead commit-redige` 16/16. Captures regardées : `289-fusion-a-relire-*`
  (en-tête « 1 à relire »), `289-voir-la-resolution-*`, `289-worktree-a-relire-*`,
  `289-redemarrage-a-relire-*`.
- 2026-11-27 : second passage du testeur (`scratchpad/testeur-289b/`) : défauts du premier passage
  fermés. Corrigés : **N2** marque tronquée ou incomplète (M3b, M4) — écriture d'un coup (fichier
  temporaire puis `rename`) et, présente mais illisible, elle vaut « l'agent a été sollicité » : arrêt
  « à relire », marque gardée, aucune tête vide ni « défait » ; **N3** message d'une marque périmée
  (M5b) — « sa branche n'est plus celle que son agent devait résoudre » (vrai que l'auteur soit
  l'agent ou l'utilisateur), avec la tête d'alors, et un clic de plus fusionne la branche telle
  qu'elle est. Rouge constaté : 3 échecs sur 4 dans `children-merge-agent.test.ts` (« second
  passage ») sur `4cebe2f4`.
- 2026-11-27 : **rc.2 rouge sur le Mac de GitHub** (3 cœurs) : `worktree-cycle` clair, « après redémarrage
  (sans mère) : rien n'est fusionné ; « Fusionner dans main » reste le seul chemin » puis délai dépassé
  sur `main-dirty`. Capture de l'échec 01 : la vue Git dit « 2 commits sur la branche · Committer ·
  Fusionner dans main », bouton pâle, sans note ; l'agent dit « Prêt ». **Cause : un vrai défaut de
  l'app** (hypothèse b). Au redémarrage, l'agent de la conversation du worktree démarre quand on ouvre
  la conversation ; la vue Git lue à ce moment-là disait `turn` (le statut `starting` comptait pour un
  tour, via `inTurn`), donc « Fusionner dans main » grisé ; et cette vue n'était relue qu'à la fin
  d'un outil, jamais quand le tour (ou le démarrage) finit : le bouton restait grisé, le clic sans
  effet. Sur une machine rapide, l'agent est prêt avant la lecture. Correctif : un agent qui démarre
  n'est pas un tour (`ownTurn`) ; la vue Git est relue quand le tour de l'agent commence ou finit
  (`agentStatus` dans la clé de `useWorktreeCycle`). Rouge : `worktree-ipc.test.ts` (« agent qui
  démarre »), et l'e2e qui tient désormais l'agent du worktree au démarrage (`MOCK_AGENT_START_LOCK`,
  posé une fois l'app prête) au lieu d'une pause d'une seconde. Sous charge (12 processus qui
  occupent le processeur) : `worktree-cycle` clair 10 passages verts sur 10.
  Rouge reproduit en local sur le code de `87336ee1` (même e2e) : « ✗ après redémarrage, l'agent
  encore au démarrage (starting) : « Fusionner dans main » n'est pas grisé », puis les deux échecs vus
  sur GitHub. Vert sur `d9420b82` : `./scripts/verify` 0 (sans charge ; sous charge, deux délais sans
  rapport, `log.test.ts` et `file-tree.test.ts`), `pnpm build` 0, huit suites en clair et en sombre
  16/16.
- 2026-11-27 : **second rouge sur le Mac de GitHub** (`1382fd93`, en anglais) :
  `filles-fusion-redemarrage` clair, « au clic suivant : main a la résolution et les travaux
  restants ». Capture : en-tête « 1 replied, 1 to review, 1 merged », pied « 1 task merged into main
  in 1 s. », « Page d'aide » toujours « conflict resolved · to review » : le second clic n'a fusionné
  que « Notes de version ». **Cause : un vrai défaut de l'app**, même famille que le précédent. Après
  le redémarrage, l'agent du travail à relire démarre (session rechargée) ; le moteur de fusion le
  tenait pour « au travail » (`childState` range `starting` avec les tours) : le plan l'écartait des
  travaux à fusionner et le bouton ne prenait que l'autre. Correctif : pour la fusion, un agent qui
  démarre n'est pas au travail (`mergeState`, `children-merge.ts`). Essai unitaire rouge d'abord
  (« un travail dont l'agent démarre encore… », `expected 'running' to be 'ready'`) ; l'e2e attend le
  bon signal (« Fusionner les 2 ») avant chaque clic et tient l'agent du travail au démarrage
  (« Voir la résolution » l'ouvre, `MOCK_AGENT_START_LOCK`), ce qui rend le rouge déterministe.
