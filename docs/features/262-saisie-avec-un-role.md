# 262 — Saisie avec un rôle : une ligne discrète, Entrée envoie, jamais de commit vide

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 260 (lot 1, écran B des maquettes `docs/maquettes/260-travail-delegue.html`)
- **Agents** : les deux — tout est générique (rôles, travaux, worktree, git)

## Pourquoi

Recette du 2026-11-19 (`docs/recettes/2026-11-19-exploration-opencode-sol.md`, constats R1, R2,
R6). Choisir un rôle qui écrit affichait, avant même de taper, un gros avertissement jaune (« 10
modifications non commitées… part du dernier commit () », parenthèses vides sur un dépôt sans
commit) et trois boutons. Entrée n'envoyait pas : le focus sautait sur « Committer d'abord ».
« Demander un avis en lecture seule » ne faisait que changer l'option, il fallait renvoyer. Sur un
dépôt sans aucun commit, un commit vide a fini dans l'historique. Le deuxième rôle est parti en
lecture seule sans que la saisie le dise.

## Règles (écran B)

1. **Jamais d'avertissement avant la frappe.** Choisir un rôle pose la puce et une ligne discrète
   sous la saisie, qui dit où et comment le rôle travaillera.
2. **Rôle de conseil** (`readOnly`) : toujours en lecture seule, dans le dossier, non commité
   compris ; aucune lecture du dossier, aucun avertissement (déjà la logique du main, gardée).
3. **Rôle qui écrit, dossier avec du non commité** : la ligne dit en orange « Partira du dernier
   commit, sans vos N modifications », avec un menu discret « Changer… » : « Committer d'abord »,
   « Partir sans elles », « Juste un avis, en lecture seule », « Voir les N modifications ».
   - Défaut : « Partir sans elles » ; **Entrée envoie toujours**, avec le choix affiché, porté
     explicitement par la requête (`uncommitted: 'anyway'` ou `'readOnly'`).
   - « Juste un avis » ne vaut que pour l'envoi en cours (décision du tech lead) ; ensuite, de
     nouveau « Partir sans elles ». Rien n'est gardé, ni en mémoire ni sur le disque.
   - « Committer d'abord » ouvre le choix de commit existant (`CommitChooser`) ; le commit fait,
     le message part (Entrée pendant ce temps : le bouton du commit prend le focus, c'est l'étape
     choisie).
   - « Juste un avis » s'applique sans renvoyer le message.
4. **Dépôt sans aucun commit, ou dossier hors dépôt git** : « Ce dépôt n'a pas encore de commit :
   le rôle travaillera directement dans ce dossier » (ou « Ce dossier n'est pas un dépôt git : … ») ;
   pas de worktree, jamais de commit. Le main en décide lui-même (garde finale), pour un rôle, une
   fille sans rôle et les propositions de l'agent.
5. Le main reste la garde finale : `refuseUncommitted` refuse toujours un lancement en worktree d'un
   dossier modifié **sans** choix (outil de l'agent, propositions sans réponse) ; il laisse partir
   une requête qui porte `anyway` ou `readOnly`. Aucun défaut silencieux côté main.
6. Carte « Tâches proposées » et dialogue « Lancer en parallèle… » : la même ligne et le même menu
   (sans « Juste un avis »), défaut « sans elles » ; mise en page de la carte inchangée (fiche 264).

## Critères d'acceptation

- [x] Choisir un rôle qui écrit, dossier modifié : aucun encadré, la ligne orange et « Changer… » ;
      Entrée envoie avec `anyway`.
- [x] « Juste un avis » : la ligne le dit, Entrée envoie `readOnly`, sans renvoyer.
- [x] « Juste un avis » pour l'envoi en cours seulement ; le suivant revient à « sans elles ».
- [x] Expert UX/UI devient un rôle de conseil (`readOnly: true`), consigne en accord.
- [x] « Committer d'abord » : `CommitChooser`, puis le message part.
- [x] Rôle de conseil : ni lecture du dossier ni avertissement.
- [x] Dépôt sans commit : ligne dédiée, la fille part dans le dossier de la mère, sans worktree ni
      commit, par la saisie, la carte « Tâches proposées » et « Lancer en parallèle… ».
- [x] Main : `refuseUncommitted` avec `anyway`, sans choix, dépôt sans commit (pas de worktree, pas
      de commit), dossier hors dépôt.
- [x] Testé contre l'agent factice (main : `children-uncommitted.test.ts`, vrai dépôt git
      temporaire, avec et sans commit, et hors dépôt ; e2e `filles-non-commite`, partie (c)).

## Plan

Fichiers touchés :

- `src/shared/launch-folder.ts` : `LaunchFolderState` (`worktree` avec racine, HEAD et non commité,
  ou `here` avec la raison `noCommit` / `notRepo`).
- `src/main/conversations/launch-folder.ts` : `state(workspace)` (racine, HEAD vérifié, statut).
- `src/main/conversations/children.ts` : `folderState`, place du lancement décidée au main
  (`here` sans commit ou hors dépôt), `refuseUncommitted` seulement pour un worktree ; IPC
  `conversation:childFolder` (remplace `childFolderDirty`).
- `src/main/conversations/helpers.ts` (`childDetachedRequest`, `ChildLink.inPlace`), `manager.ts`.
- `src/main/mcp/children-tools.ts` : texte rendu à l'agent pour une fille dans le dossier ; la
  description de `start_child` interdit le commit (vide) fait pour obtenir un worktree.
- `src/shared/ipc.ts`, `src/preload/api.ts`, `src/main/read-only-guard.ts` : le canal renommé.
- Renderer : `components/thread/LaunchLine.tsx` (nouveau : ligne, menu « Changer… », liste des
  modifications, `CommitChooser`, `useLaunchFolder`), `launch-choice.ts` (mémoire dossier + HEAD),
  `useRoleCompose.tsx`, `RoleCompose.tsx`, `Composer.tsx`, `ChildProposals.tsx`,
  `ChildDialog.tsx` ; `LaunchDirty.tsx` supprimé (plus d'utilisateur).
- i18n fr/en (`launchLine.*`), CSS de la ligne.
- Tests : `launch-choice.test.ts`, composer (`RoleComposerUncommitted.test.tsx` réécrit),
  `ChildProposals.test.tsx`, `ChildDialog.test.tsx`, main (`children` dépôt sans commit,
  `launch-folder`), e2e qui cliquaient l'ancien bloc.

Pas de nouvelle dépendance.

## Limites connues

- **Dépôt sans commit** : la fille (rôle qui écrit, fille sans rôle, proposition de l'agent)
  travaille dans le même dossier que la mère. Pas de branche, pas de diff de branche, pas de
  fusion ni de relecture de branche ; deux agents peuvent écrire le même fichier en même temps.
  L'agent de la mère en est averti par le résultat de `start_child`. Accepté (tech lead).
- **Dossier hors dépôt git** : comportement gardé tel quel. Un `@rôle` qui écrit part dans le
  dossier (même règle que sans commit) ; `start_child` et « Lancer en parallèle… » restent
  indisponibles, la mère n'ayant ces outils que dans un dépôt.
- Les textes déjà existants de la ligne du rôle (« dans une conversation fille ») attendent la
  fiche 266.

## Journal

- 2026-11-19 : fiche et plan.
- 2026-11-19 : fait.
  - **Cause du commit vide.** Ni Bobine ni « Committer d'abord » ne peuvent en faire un
    (`commitIn` refuse une liste vide et committe `--only` des chemins). Le seul commit vide
    relevé est `3e66fdc « Initial commit »` du dépôt d'essai `~/Dev/test-bobine` (aucun fichier
    suivi), à 21:08:30, pendant un tour d'OpenCode de la mère (21:08:18–21:08:34, `main.log`) et
    18 s avant le premier worktree de fille (21:08:48). Sur un dépôt sans commit, le main refusait
    le worktree avec `worktrees.noCommit` (« un worktree part d'un commit ») ; `start_child` rendait
    ce texte à l'agent, et sa description lui dit de committer d'abord : l'agent a fabriqué le
    commit qui manquait, vide puisqu'il n'y avait rien à committer (`git commit --allow-empty`,
    déduit des horaires et du contenu : ni `agents.log` ni la session d'OpenCode n'ont été lus). Cause supprimée : sans
    commit (ou hors dépôt), le main ne demande plus de worktree, la fille travaille dans le
    dossier ; la description de `start_child` interdit de committer pour obtenir un worktree.
  - **Main** : `LaunchFolder.state` (racine, HEAD vérifié par `rev-parse --verify --quiet`, une
    autre erreur de git est levée, jamais prise pour un dépôt vide) ;
    `ChildConversations.folderState` / `inPlace` remplacent `refuseUncommitted` : rôle en lecture
    seule → dossier de la mère (inchangé) ; sans commit ou hors dépôt → dossier de la mère
    (`ChildLink.inPlace`), sans choix ni refus ; sinon worktree, refusé d'un dossier modifié sans
    `uncommitted` explicite. Canal `conversation:childFolder` (remplace `childFolderDirty`).
    `start_child` dit à l'agent qu'une fille sans branche écrit dans son dossier.
  - **Renderer** : `LaunchLine` (segment de ligne, menu « Changer… » Radix, liste des
    modifications, `CommitChooser`), `useLaunchFolder`, `launch-choice.ts` (mémoire par racine +
    HEAD, retirée ensuite : voir plus bas). `useRoleCompose` envoie toujours (dossier pas encore lu : lu d'abord, un instant) ;
    « Committer d'abord » ouvert : Entrée mène au bouton du commit, puis le message part. Un choix
    du menu rend le focus à la saisie (`ComposerFocus`). Carte « Tâches proposées » et
    « Lancer en parallèle… » : même ligne, sans « Juste un avis » ; « Lancer » n'attend plus que
    la lecture du dossier (ou un commit ouvert). `LaunchDirty.tsx` supprimé (plus d'utilisateur),
    bloc armé (`useArmedCard`) inutile pour une ligne : les choix sont dans un menu ouvert par
    l'utilisateur.
  - **Écarts au plan / à la maquette** : « Juste un avis, en lecture seule » est une entrée du
    menu (consigne du tech lead, confirmée) alors que la légende de la maquette B le refusait
    comme option.
    Dossier propre : « Changer… » est là aussi (travailler dans son worktree / juste un avis).
    `ADR-0059` (proposé) remplace en partie l'ADR-0055 (décisions 2 et 3). La maquette de la 260
    est reformatée par Prettier (sinon `verify` échouait sur `prettier --check`).
  - **Tests** : `launch-choice.test.ts` ; `RoleComposerUncommitted.test.tsx` réécrit (ligne,
    Entrée, menu, avis, mémoire par dossier + HEAD, commit, fichiers décochés, dépôt sans commit,
    hors dépôt, dossier lu à l'Entrée, focus rendu) ; `ChildProposals.test.tsx`,
    `ChildDialog.test.tsx` ; main : `children-uncommitted.test.ts` (dépôt sans commit : rôle,
    fille sans rôle, `start_child` ; hors dépôt ; état avec HEAD ; avis explicite),
    `children-tools.test.ts`, `children.test.ts` (canal). e2e mises à jour :
    `filles-non-commite` (ligne, Entrée, « Changer… », partie (c) sans commit), `session`,
    `roles-gestion` ; non lancées (tech lead).
- 2026-11-19 : décisions du tech lead sur les doutes.
  - « Juste un avis » ne vaut que pour l'envoi en cours : la mémoire par racine + HEAD est
    retirée. « Partir sans elles » est le défaut de chaque envoi, et « Committer d'abord » n'a
    rien à garder (le commit change HEAD, le dossier relu dit ce qui reste) : une mémoire qui ne
    garderait que le défaut serait du code mort. `launch-choice.ts` ne garde que `uncommittedOf`.
    Test : l'envoi suivant, même dossier, même HEAD, part avec `anyway`.
  - **Expert UX/UI** passe en rôle de conseil (`readOnly: true`) ; sa consigne (fr, en) dit qu'il
    propose une direction sans rien modifier, que l'agent principal ou un architecte applique.
    Effet sur l'existant : les rôles fournis sont relus du code à chaque lecture, jamais copiés ;
    ils suivent donc la nouvelle valeur. Une copie personnelle de même nom n'existe que si
    l'utilisateur l'a enregistrée depuis Réglages › Rôles, ce qui n'est possible qu'après une
    modification (bouton désactivé sinon) : elle garde sa valeur. Un rôle déjà installé dans un
    agent (Bob, OpenCode) apparaît « à mettre à jour » (empreinte différente). Tests :
    `library.test.ts`, `builtin.test.ts`, `export/adapters.test.ts`. Les essais qui voulaient un
    rôle qui écrit prennent Architecte front.
  - Rebasé sur `main` (`fe49ace`) ; le commit de formatage de la maquette, déjà dans `main`, a
    disparu au rebasage.
