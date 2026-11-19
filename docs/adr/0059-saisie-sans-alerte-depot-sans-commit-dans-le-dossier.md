# ADR-0059 — Lancement d'un travail : choix affiché par défaut, dépôt sans commit dans le dossier

- **Statut** : proposé (fiche 262, maquettes de la fiche 260 validées le 2026-11-19)
- **Date** : 2026-11-19
- **Remplace en partie** : ADR-0055 (décisions 2 et 3 ; les décisions 1, 4 et 5 restent)

## Contexte

L'ADR-0055 voulait qu'aucune fille ne parte en worktree d'un dossier modifié sans un choix de
l'utilisateur, montré avant l'envoi. Dans la saisie `@rôle`, ce choix a pris la forme d'un encadré
jaune à trois boutons, affiché dès le rôle choisi, qui retenait l'envoi (Entrée n'envoyait pas, le
focus sautait sur « Committer d'abord ») ; « Demander un avis en lecture seule » obligeait à
renvoyer. Sur un dépôt sans commit, l'encadré disait « part du dernier commit () ». Recette du
2026-11-19, constats R1, R2, R6.

Un dépôt sans commit n'a pas de worktree possible (`git worktree add` part d'un commit). Le main le
refusait (`worktrees.noCommit` : « un worktree part d'un commit »), et ce texte, rendu à l'agent par
`start_child`, l'a conduit à fabriquer un commit vide (`Initial commit` vide relevé dans le dépôt
d'essai le 2026-11-19 à 21:08, pendant un tour de la mère, 18 s avant le premier worktree de fille).

## Décision

1. **Le choix est affiché, pas demandé.** Sous la saisie, une ligne discrète dit où partira un
   rôle qui écrit ; d'un dossier modifié, en orange : « Partira du dernier commit, sans vos N
   modifications ». Le défaut est « Partir sans elles ». **Entrée envoie toujours**, et la requête
   porte explicitement ce choix (`uncommitted: 'anyway'`). « Changer… » propose : Committer
   d'abord (le `CommitChooser`, puis le message part), Partir sans elles, Juste un avis en lecture
   seule (`readOnly`, appliqué sans renvoyer), Voir les modifications. Le choix est retenu pour ce
   dossier jusqu'au prochain commit (clé racine du dépôt + HEAD, mémoire de la fenêtre, rien sur le
   disque), et la ligne le dit toujours. Même ligne, sans « Juste un avis », dans la carte « Tâches
   proposées » et « Lancer en parallèle… ».
2. **Le main reste la garde finale, sans défaut caché.** Un lancement en worktree d'un dossier
   modifié sans `uncommitted` explicite est toujours refusé (outil de l'agent, propositions sans
   réponse, appel IPC sans choix). Un rôle de conseil (`readOnly`) part toujours en lecture seule
   dans le dossier de la mère, sans lecture ni choix (inchangé).
3. **Sans worktree possible, le travail se fait dans le dossier.** Dépôt sans aucun commit, ou
   dossier hors dépôt git : la fille (rôle qui écrit, fille sans rôle, proposition de l'agent)
   travaille directement dans le dossier de sa mère, sans worktree ni branche ; le main le décide
   lui-même (`ChildConversations.folderState`, `ChildLink.inPlace`). Bobine ne crée jamais de
   commit pour en obtenir un, et la description de `start_child` dit à l'agent de ne pas le faire.

## Alternatives écartées

- **Garder l'encadré, sans retenir l'envoi** — l'alerte avant la frappe reste (R1), pour un choix
  qui a un défaut sûr : le dossier de la mère n'est jamais touché par « partir sans elles ».
- **Défaut « sans elles » côté main** (`uncommitted` absent = `anyway`) — un outil ou un essai
  partirait sans le non commité sans que personne ne l'ait vu ; le renderer porte le choix qu'il
  a affiché.
- **Committer d'office le dépôt vide** (commit initial, vide ou de tous les fichiers) — un commit
  que l'utilisateur n'a pas voulu (ADR-0055, alternatives).
- **Refuser les filles sur un dépôt sans commit** — c'est ce qui a poussé l'agent au commit vide ;
  et l'utilisateur n'y gagne rien : il ne peut pas lancer de rôle sur un projet neuf.

## Conséquences

- Canal `conversation:childFolder` (remplace `conversation:childFolderDirty`) : `LaunchFolderState`
  (`worktree` avec racine, HEAD et non commité, ou `here` avec `noCommit` / `notRepo`).
- Une fille dans le dossier de sa mère écrit dans les mêmes fichiers qu'elle : pas de diff de
  branche, pas de fusion, pas de relecture de branche ; l'agent de la mère en est averti par le
  résultat de `start_child`. À surveiller à la recette : deux agents qui écrivent le même fichier.
- « Juste un avis » retenu pour un dossier vaut pour le rôle suivant qui écrit, dans ce dossier,
  jusqu'au prochain commit ; la ligne le dit (R6).
- Les e2e cliquent « Changer… » au lieu des anciens boutons ; le bloc `launch-dirty` disparaît.
