# 280 — Commits « perdus » d'une branche déjà fusionnée

- **Statut** : fait
- **Dépend de** : 036, 097, 228
- **Agents** : les deux (git seulement, rien d'ACP)

## Pourquoi

Recette Bob de la 1.0.0 ([2026-11-24](../recettes/2026-11-24-recette-bob-1-0.md), défaut **D1**,
gênant) : la boîte « Supprimer » d'une conversation fille dont la branche est déjà fusionnée dans
`main` annonce « perdus : 3 commits dans la branche ». Rien n'est perdu : la boîte fait peur à tort,
et coche « Supprimer aussi le worktree » seulement quand rien n'est perdu.

Cause confirmée : `Worktrees.status` (`src/main/changes/worktrees.ts`) comptait
`rev-list --count <départ>..<branche>`, soit tous les commits faits depuis le départ, fusionnés ou
non. Même défaut, sous une autre forme, dans Réglages › Données › « Worktrees orphelins »
(`WorktreeCycle.orphans`) : `HEAD..<branche>`, juste seulement si le dépôt principal est sur la
branche de la fusion.

## Critères d'acceptation

- [x] Ne compte comme perdus que les commits gardés par aucune autre référence : branches locales
      (la cible de la fusion, la branche de la mère, une petite-fille…), étiquettes, branches
      distantes ; et, pour une conversation, seulement ceux faits depuis le départ.
- [x] Branche fusionnée : 0 ; non fusionnée : son vrai compte ; fusionnée en partie : le reste.
- [x] Même calcul pour la boîte « Supprimer » et pour « Worktrees orphelins ».
- [x] Testé sur de vrais dépôts git temporaires (`worktrees.test.ts`, `worktree-cycle.test.ts`) ;
      les deux essais échouent sans le correctif.

## Plan

- `lostRevisions(branch, base?)` dans `worktrees.ts`, pour
  `rev-list --count <branche> [^<départ>] --not --exclude=<branche> --branches --tags --remotes --`.
- `Worktrees.status` et `WorktreeCycle.orphans` s'en servent.
- Autres lecteurs vérifiés, inchangés :
  - corbeille : ne compte rien, elle tient les worktrees ; une fois vidée, ils passent dans
    « Worktrees orphelins », corrigé ici ;
  - cartes de travaux (barre du worktree, fusion des filles `children-merge.ts`) : leur « en avance »
    se compte contre la branche cible (`<cible>..<branche>`), déjà 0 après fusion, et c'est le bon
    sens pour « à fusionner » ;
  - puce de branche (`git/repo.ts`) : avance sur la branche suivie, sans rapport.

## Journal

- 2026-11-24 : correctif et essais. Choix : toute autre référence garde les commits (pas seulement
  la cible et la mère), parce que c'est exactement ce que `git branch -D` laisse en place. Limite
  connue, assumée : deux orphelins qui partagent des commits absents de partout ailleurs
  s'annoncent mutuellement « rien de perdu » ; les filles partent toutes du commit de la mère, ce
  partage n'arrive qu'en branchant à la main une branche sur une autre. Pas d'e2e locale (méthode
  « marché ») ; aucun texte ni écran changé.
