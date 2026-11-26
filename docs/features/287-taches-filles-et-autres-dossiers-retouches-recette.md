# 287 — Tâches filles et « Autres dossiers » : retouches de la recette Bricole

- **Statut** : fait (1.2, lot 1 des retouches), en attente de relecture
- **Dépend de** : 110 et 123 (cycle d'un worktree, « Committer d'abord »), 120 et 264 (fusion
  depuis la carte, carte de groupe, ADR-0022, ADR-0061), 179 (autres dossiers), 244 (fichiers
  cochés), 246 (message rédigé)
- **Agents** : les deux, générique. Les tâches filles, la fusion et l'onglet Git ne dépendent
  d'aucun agent ; « Autres dossiers » suit la capacité annoncée `additionalDirectories` (OpenCode
  l'a, pas Bob : `docs/agents.md`), sans rien de propre à un agent dans l'interface (ADR-0011).

## Pourquoi

L'évaluation réelle de Bobine 1.2 (projet « Bricole », OpenCode, `bricole-evaluation/journal.md`,
séances 3 à 4) a relevé quatre défauts sur les tâches filles et « Autres dossiers » :

1. **Commit partiel** — 21:55, séance 3 : « Fusion des 3 recommandés depuis la carte de groupe […]
   « Committer d'abord » → message rédigé […] → « Committer puis fusionner ». Premier essai : commit
   50b4f8c fait mais **fusion refusée** : « Fusion refusée : le dossier principal a 6 modifications
   non commitées… » […] (l'agent avait écrit d'autres fichiers entre-temps) ». Résumé de la séance 3,
   point 5 : « commit/fusion en deux temps quand l'agent écrit encore ». L'agent qui écrivait était
   celui de la conversation principale, dans le dossier principal (« elle code déjà les niveaux
   directement dans master (non commité) », 21:42).
2. **Carte « À revoir » après fusion et nettoyage depuis l'onglet Git** — 02:05, séance 4 : « Après
   cette fusion faite depuis l'onglet Git de la fille puis « Nettoyer », la carte de groupe de la
   conversation mère et Modifications › Travaux affichent toujours « README : Bonne bricole ! · 1 a
   répondu · **À revoir** — Le travail a refait un tour depuis cette recommandation », jamais
   « fusionné » » (capture `s4-26-carte-fille-apres-nettoyage.png`).
3. **Grisé sans raison** — 21:11 et 21:13, séance 3 : « « Fusionner le travail prêt dans master » est
   **désactivé** […] sans dire pourquoi (pas d'infobulle lue par le pilote) » ; « reste grisé ; la
   raison n'est écrite qu'en haut de la carte ». 23:00 : « (grisé : modifications non commitées dans
   les 4 filles) ». 21:12 : « « Ajouter un dossier… » (Session › Environnement) est **désactivé**
   pendant que l'agent répond ; le guide dit « l'ajout et le retrait attendent la fin de sa
   réponse », l'écran ne le dit pas. »
4. **Fenêtre de choix sur Téléchargements** — 22:22, séance 3b : « Il ouvre la fenêtre de choix de
   macOS « Ajouter un dossier à la conversation » **sur Téléchargements** (dernier dossier de
   macOS), pas près du dossier de la conversation (`~/Dev`) : premier irritant pour le collègue. »
   Redit à 02:05, séance 4.

## Causes (lues dans le code, avant correctif)

1. Le renderer enchaîne deux appels : `children:commitMain` (ou `worktree:commitMain`) committe,
   puis `children:merge` (ou `worktree:merge`) décide. Tous les refus de la fusion (dossier principal
   encore modifié, travail qui répond encore, relecture en cours, base extraite ailleurs…) tombent
   **après** le commit (`SubtasksMerge.tsx`, `WorkMerge.tsx`, `WorktreeBar.tsx` : `onCommit`). Le
   main n'avait aucune garde « un tour écrit dans ce dossier ».
2. La pastille « fusionné » d'une ligne vient soit d'un élément `children-merge` du fil de la mère
   (posé seulement par `ChildrenMerger`, la fusion depuis une carte), soit de la branche lue
   (`plan`). Une fusion depuis l'onglet Git (`worktree:merge`) ne laisse rien dans le fil de la
   mère ; après « Nettoyer », la fille est archivée et sa branche supprimée, le plan ne la lit plus :
   il ne reste que la recommandation, caduque (« À revoir »).
3. Les boutons sont `disabled` avec un `title` (`WorktreeBar`) ou une infobulle `Tip`
   (`SessionFolders`) : un bouton `disabled` ne reçoit ni le survol ni le focus, l'infobulle ne
   s'ouvre jamais. La carte (`MergeButtons`) n'en a aucune.
4. `chooseDirectory` (`main/dialogs.ts`) n'a pas de `defaultPath` : macOS ouvre le dernier dossier
   (Téléchargements).

## Critères d'acceptation

- [x] « Committer puis fusionner » (carte de groupe, carte d'un travail, onglet Git d'une fille)
  pendant un tour dans le dossier principal, ou du travail à fusionner : refusé **avant** tout commit,
  la raison affichée ; aucun commit créé, ni dans le dossier principal ni dans le worktree.
- [x] Les autres refus connus d'avance (relecture en cours, base extraite ailleurs, autres fichiers
  apparus depuis le choix) aussi refusés avant le commit.
- [x] Fusion puis « Nettoyer » depuis l'onglet Git d'une fille : sa ligne dans la carte de la mère
  et dans Modifications › Travaux dit « fusionné · branche supprimée », plus « À revoir ».
- [x] « Fusionner » grisé (carte, onglet Git) et « Ajouter un dossier… » / retrait désactivés :
  la raison au survol **et** au focus clavier (`aria-disabled`, infobulle `Tip`, comme le bouton du
  tour de table, B11 de la fiche 285), une raison par cause tirée de l'état.
- [x] « Ajouter un dossier… » ouvre la fenêtre de choix sur le dossier parent du dossier de la
  conversation (dossier principal pour un worktree) ; parent absent ou illisible : comme avant.
- [x] Testé contre l'agent factice (verrou de fin de tour `MOCK_AGENT_TURN_LOCK` pour tenir un tour).

## Plan

1. **Commit puis fusion, d'un seul geste côté main.**
   - `ChildrenMerger.start(…, { stash, commit })` : contrôles d'abord (fusion en cours, travaux
     supprimés, au travail, en relecture), puis, avec `commit` : tour en cours dans le dossier
     principal (`main/changes/folder-turn.ts`, pur : conversation hors worktree, non archivée, dont
     le dossier est dans le dépôt, au travail ou en attente d'accord), base extraite ailleurs,
     fichiers modifiés hors de ceux cochés sans « mettre de côté » ; seulement ensuite
     `cycle.commitMain`, puis la fusion comme avant.
   - `WorktreeCycle.commitThenMerge(target, commit, { stash })` : mêmes refus que `merge` lus avant
     le commit (fusion arrêtée avec des marqueurs, worktree non commité, rien à fusionner, base
     extraite ailleurs, autres fichiers dans le dossier principal), puis commit, puis `merge`.
     `worktree:merge` prend `commit` ; le canal refuse d'abord si un tour tourne dans la fille ou
     dans le dossier principal.
   - Les canaux `children:commitMain` et `worktree:commitMain` disparaissent (plus aucun chemin à
     deux temps) ; `SubtasksMerge`, `WorkMerge`, `WorktreeBar` passent `commit` à la fusion.
2. **Fusion et nettoyage depuis l'onglet Git dits dans le fil de la mère.**
   `main/conversations/child-merge-record.ts` : une fusion réussie d'une fille par `worktree:merge`,
   `mergeContinue` ou `resolveWithAgent` pose un élément `children-merge` (une ligne `merged`, état
   `done`) dans le fil de sa mère ; `worktree:cleanup` marque cette ligne `cleaned` (ou en pose une,
   fusionnée et nettoyée, si la branche était déjà dans la base ou sa PR fusionnée). La carte lit
   déjà cet élément : rien à changer à l'affichage.
3. **Dire pourquoi c'est grisé.** `common/ReasonButton.tsx` : `aria-disabled` + `Tip` (le mécanisme
   du bouton du tour de table), clic sans effet ; CSS : `[aria-disabled='true']` partout où
   `.btn:disabled` et `.session-link:disabled` sont stylés. Raisons :
   - onglet Git : « non commité », « rien à fusionner » (textes existants) ;
   - carte : fusion déjà en cours, base extraite ailleurs, travaux qui répondent encore, non
     commités (`shared/children-merge.ts`, `mergeBlockReasons`, pur) ;
   - « Ajouter un dossier… » et « Retirer » : l'agent répond (texte précisé).
4. **Fenêtre de choix à côté du dossier.** `extraFolderStart` (pur, `additional-directories.ts`) :
   dossier parent du dossier de la conversation (pour un worktree : son équivalent dans le dépôt
   principal), seulement s'il existe et se lit ; rien pour une discussion ou sans dossier.
   `chooseDirectory(labels, defaultPath)`.
5. Essais : unitaires (garde, refus avant commit sur un vrai dépôt jetable, enregistrement de la
   fusion, raisons, `extraFolderStart`) ; e2e `taches-filles-retouches` (tour tenu : aucun commit ;
   fusion et nettoyage depuis l'onglet Git : carte « fusionné » ; raisons au focus clavier) ;
   `dossiers` : raison au focus pendant un tour.

Aucune dépendance nouvelle. Pas d'ADR : la fusion reste celle de l'ADR-0022 et sa trace dans le fil
celle de l'ADR-0061 ; seul le lieu d'où elle part change.

## Journal

- 2026-11-26 : fiche, causes et plan.
- 2026-11-26 : fait, selon le plan.
  - Point 1 : `changes/commit-then-merge.ts` (`commitThenMerge`, `assertOnlyChecked`,
    `markersLeft`), `changes/folder-turn.ts` (`turnInFolder`, `inTurn`) ; `ChildrenMerger.start(…,
    { stash, commit })` ; canaux `children:commitMain` et `worktree:commitMain` retirés ;
    `children:merge` signale le dépôt changé (vues Git à relire).
  - Point 2 : `conversations/child-merge-record.ts`, branché dans `worktree-ipc.ts`.
  - Point 3 : `common/ReasonButton.tsx`, `mergeBlockReasons` ; boutons convertis : pied de la carte
    (« Fusionner… », « Inclure les autres… » et sa confirmation), onglet Git (« Fusionner dans… »),
    carte d'un travail (« Fusionner dans… » en relecture), Session (« Ajouter un dossier… »,
    « Retirer »). Texte `sessionTab.foldersBusy` précisé.
  - Point 4 : `extraFolderStart` / `extraFolderStartOf`, `chooseDirectory({ …, defaultPath })`.
  - Essais : unitaires (`folder-turn`, `worktree-cycle` sur un vrai dépôt, `children-merge`,
    `worktree-ipc`, `additional-directories`, `dialogs`, `children-merge` partagé, composants) ;
    e2e `filles-retouches` (nouvelle) et `dossiers` (complétée).
- Écarts au plan :
  - Le journal (21:55) montre que l'agent qui écrivait était celui de la **conversation
    principale**, dans le dossier principal, pas celui de la fille. La garde couvre les deux : tour
    dans le dossier principal (toute conversation hors worktree dont le dossier est dans le dépôt),
    tour de la fille elle-même (onglet Git), travaux au travail ou en relecture (carte).
  - Ajout non prévu, à la cause d'une régression que le point 2 aurait ouverte : les lignes de la
    carte de groupe et de « Sous-tâches » lisaient la **dernière fusion de la carte** ; une fusion
    faite depuis l'onglet Git (posée à part) aurait caché la pastille d'une fusion d'avant faite par
    la carte, une fois sa branche nettoyée. Chaque ligne lit maintenant la dernière fusion qui la
    touche (`rowMerge(…, items)`), comme Modifications › Travaux le faisait déjà.
  - Sur la carte de groupe, la ligne d'un travail ne dit pas « branche supprimée » (choix de la
    fiche 264, inchangé) ; Modifications › Travaux le dit.
- Limites connues, non traitées ici :
  - Une écriture dans le dossier principal entre la dernière lecture et le `git commit` (quelques
    millisecondes, hors tour d'agent) peut encore faire refuser la fusion après le commit.
  - Pendant le tour, la liste de « Committer d'abord » se met à jour et **coche** les fichiers que
    l'agent vient d'écrire (comportement de la fiche 244, vu sur la capture
    `287-committer-refuse-tour`) : le refus est maintenant certain pendant le tour, mais après lui
    un nouveau clic committerait aussi ces fichiers s'ils restent cochés. À trancher (fiche à part).
  - Le dialogue natif ne se pilote pas : le `defaultPath` est vérifié par les essais unitaires et
    par la suite `dossiers` (options reçues par le dialogue simulé), pas à l'écran.
  - Saisie d'un chemin au clavier : reportée (consigne du lot).
- 2026-11-26 : recette réelle (séance 6 de l'évaluation Bricole, vrai OpenCode, build de
  `c876dde6`, dépôt jetable).
  - Confirmé, « Committer puis fusionner » pendant un tour de la mère : refus au clic, bandeau
    « … répond encore : rien n'a été commité ni fusionné. Réessayez à la fin de son tour. » ;
    `git log -1` du dossier principal et des deux worktrees identiques avant et après, fichier
    toujours modifié. Tour fini, même bouton : commit puis deux fusions, carte « 2 travaux · 2
    fusionnés ».
  - Confirmé, fusion et « Nettoyer » depuis l'onglet Git d'une fille : fille non recommandée
    (Committer, « Fusionné dans main (fast-forward). », Nettoyer) ; fille recommandée puis passée
    « À revoir » après un tour de plus (le cas de la séance 4) : « Fusionné dans main (commit de
    fusion). », Nettoyer, la carte de la mère dit « fusionné » (plus « À revoir »).
    Modifications › Travaux : les deux « fusionné · nettoyé ».
  - Confirmé, raisons des boutons grisés : « Ajouter un dossier… » pendant un tour (survol souris
    et focus au clavier : « L'agent répond : l'ajout et le retrait d'un dossier attendent la fin de
    son tour. ») ; « Fusionner dans main » de l'onglet Git d'une fille non commitée (« Committez
    d'abord : 1 modification non commitée. », clic sans effet) puis fusionnée (« Rien à fusionner :
    main a déjà tout. »).
  - Confirmé, non-régression : fusion de la carte avec conflit renvoyé à la fille (résolu, README
    sans marqueur, `git status` propre) ; fusion groupée ordinaire de deux travaux en un clic.
  - Non éprouvé à l'écran : la raison sur le bouton de fusion de la **carte** (aucun état
    rencontré ne l'a grisé : pas de bouton pendant que les filles tournent, bouton actif avec une
    fille prête et une autre en cours, actif aussi pendant un tour de la mère) ; la fenêtre native
    « Ajouter un dossier… » (non pilotable, `defaultPath` écrit dans aucun journal).
  - Détails relevés : panneau Session « Dossier : 1 fichier non commité +1 −0 » resté affiché
    après le commit et la fusion faits par Bobine, `git status` vide, corrigé seulement en
    changeant d'onglet du panneau ; dans Modifications › Travaux, libellé « fusionné · nettoyé »
    (la fiche annonçait « fusionné · branche supprimée ») coupé en « fusionné · » à la largeur par
    défaut du panneau ; « 1 fichier +10 −7 » affiché pour une fille de +5 dont le conflit a été
    résolu.
  - Remarque : pendant un tour de la mère (dossier principal propre), « Fusionner le travail prêt
    dans main » de la carte fusionne (fast-forward), alors que « Committer puis fusionner » est
    refusé dans la même situation : seul le chemin avec commit est gardé.
