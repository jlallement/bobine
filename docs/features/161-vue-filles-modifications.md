# 161 — Vue « Filles » dans l'onglet Modifications

- **Statut** : fait
- **Dépend de** : 021 (onglet Modifications), 097 (conversations filles), 156 (éditeur), 158 (menu
  du dossier), 160 (recommandation de fusion)
- **Agents** : les deux (rien de propre à un agent : les filles sont des conversations de l'app)

## Pourquoi

Depuis la conversation mère, on veut voir d'un coup d'œil les worktrees de ses filles sans
remonter le fil jusqu'à la carte « Sous-tâches » : où en est chacune, sur quelle branche, ce
qu'elle a changé, et y aller (conversation, Finder, éditeur).

## Critères d'acceptation

- [x] L'onglet Modifications d'une mère a une troisième vue, « Filles N », à côté de
      « Cette conversation » et « Git ».
- [x] Seulement les filles **directes** de la conversation ouverte (`startedFrom.id`), dans l'ordre
      des lancements : ni les autres worktrees, ni les petites-filles.
- [x] Une conversation sans fille n'a pas la vue (ni le bouton).
- [x] Une ligne par fille : titre, branche, état (en cours, attend un accord, terminée, erreur),
      +N −M du dernier compte rendu, « Recommandée » / « Pas encore prête » de la mère.
- [x] Actions : « Ouvrir » (la conversation), « Afficher dans le Finder » et « Ouvrir dans
      <éditeur> » (le worktree).
- [x] Cycle de vie : une fille lancée apparaît, son état et son compte rendu se mettent à jour
      seuls ; une fille supprimée disparaît ; la dernière disparue, la vue se ferme et l'onglet
      revient à sa vue par défaut.
- [x] Testé contre l'agent factice (scénarios des filles, suite e2e `filles`, clair et sombre).

## Plan

- `renderer/src/children-rows.ts` (nouveau, pur) : lignes des filles d'une mère (ordre des
  lancements, état, dernier compte rendu, recommandation), extrait de `SubtasksCard` qui
  l'utilise aussi : la carte du fil et la vue disent la même chose.
- `components/panel/ChildrenView.tsx` (nouveau) : la liste et ses actions.
- `ChangesTab.tsx` : découpé (exception ESLint `max-lines-per-function` de la fiche 089 retirée) :
  barre des vues et barre des remarques dans leurs composants ; vue `children` ajoutée, repli sur la
  vue par défaut quand il n'y a plus de fille.
- `SidePanel.tsx`, `App.tsx` : les filles de la conversation active (mêmes données que la carte).
- Main : `openInEditor` ouvre aussi le dossier lui-même (`path` = `.`) — le worktree d'une fille.
- i18n fr/en ; suite e2e `filles` : la vue, puis sa disparition.

## Journal

- 29/10 : fiche et plan.
- 29/10, fait :
  - `shared/children-rows.ts` (`childrenOf`, `childRows`) : la carte « Sous-tâches » et la vue
    partagent le calcul ; ses badges (`Branch`, `FileStats`, `VerdictBadge`) sont exportés de
    `thread/Subtasks.tsx`.
  - `ChangesTab` découpé en `ChangesBars.tsx` (barre des vues, barre des remarques) et
    `ChangesList.tsx` (liste des fichiers, diffs) : l'exception `max-lines-per-function` est retirée.
  - Cycle de vie : la vue reçoit les filles à chaque rendu d'`App` (liste des conversations,
    attention, fil de la mère) ; choisie puis vidée, elle revient à la vue par défaut.
  - Main : `openInEditor` accepte `.` (le dossier lui-même, `editorFolderLaunch`) ; un
    sous-dossier reste refusé (« introuvable »).
  - Écart : une ligne souple (flex) plutôt que la grille de la carte, l'éditeur pouvant manquer
    et le panneau étant étroit (vu sur les captures).
  - Essais : `ChildrenView.test.tsx` (filles directes, ordre, actions, cycle de vie), éditeur
    (`.`), suite e2e `filles` (pas de vue sans fille ; « Filles 2 » dans l'état de la carte,
    captures `filles-161-vue-filles`).
- 30/10, correction : « Filles » se place avant « Git ». Le bouton Git n'apparaît qu'une fois le
  dépôt lu (≈ 100 ms) ; placé avant, il poussait « Filles » de 51 px sous le pointeur, et un clic
  rapide ouvrait Git (vu par la suite e2e `filles`, qui échouait par intermittence).
