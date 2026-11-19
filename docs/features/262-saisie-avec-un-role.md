# 262 — Saisie avec un rôle : une ligne discrète, Entrée envoie, jamais de commit vide

- **Statut** : en cours
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
   - Le choix est retenu pour ce dossier jusqu'au prochain commit : mémoire de la fenêtre, clé
     racine du dépôt + HEAD, rien sur le disque.
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

- [ ] Choisir un rôle qui écrit, dossier modifié : aucun encadré, la ligne orange et « Changer… » ;
      Entrée envoie avec `anyway`.
- [ ] « Juste un avis » : la ligne le dit, Entrée envoie `readOnly`, sans renvoyer.
- [ ] Choix retenu pour le dossier jusqu'au prochain commit (HEAD changé : défaut).
- [ ] « Committer d'abord » : `CommitChooser`, puis le message part.
- [ ] Rôle de conseil : ni lecture du dossier ni avertissement.
- [ ] Dépôt sans commit : ligne dédiée, la fille part dans le dossier de la mère, sans worktree ni
      commit, par la saisie, la carte « Tâches proposées » et « Lancer en parallèle… ».
- [ ] Main : `refuseUncommitted` avec `anyway`, sans choix, dépôt sans commit (pas de worktree, pas
      de commit), dossier hors dépôt.
- [ ] Testé contre l'agent factice (main : `children` avec un vrai dépôt git temporaire).

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

## Journal

- 2026-11-19 : fiche et plan.
