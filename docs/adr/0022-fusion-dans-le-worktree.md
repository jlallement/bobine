# ADR-0022 — La fusion d'un worktree se fait dans le worktree, puis la base avance en fast-forward

- **Statut** : proposé
- **Date** : 2026-10-21
- **Précise** : la fiche 036 (worktrees) et la fiche 110 (cycle complet)

## Contexte

Une conversation en worktree travaille sur sa branche `bobine/…`, créée depuis le commit courant
d'une branche de base (en général `main`). Pour ramener ce travail dans la base sans terminal
(fiche 110), l'app doit fusionner, et donc décider **où** la fusion a lieu, car c'est là que les
conflits apparaissent et que quelqu'un doit les résoudre. Trois contraintes :

- l'agent de la conversation ne travaille que dans son worktree (ACP : un dossier par session) ;
- le dépôt principal est le dossier de l'utilisateur : il ne doit jamais être laissé avec des
  marqueurs de conflit, ni voir ses modifications en cours touchées ;
- pas d'usine à gaz : `git` en ligne de commande, pas de bibliothèque git.

## Décision

**La base entre d'abord dans le worktree ; la base n'avance ensuite qu'en fast-forward.**

1. Dans le worktree : `git merge <base>`. Fast-forward (rien à faire) ou commit de fusion. Les
   conflits restent dans le worktree, listés fichier par fichier ; « Laisser l'agent résoudre »
   envoie à la conversation un message ordinaire (fichiers en conflit, consigne de retirer les
   marqueurs sans committer), puis l'app vérifie les fichiers, les ajoute et termine la fusion.
   « Abandonner » : `git merge --abort`.
2. La base avance : `git merge --ff-only <branche>` dans le dépôt principal si la base y est
   extraite (le dossier de l'utilisateur reçoit le travail ; git refuse si ses modifications en
   cours chevauchent, et l'app le dit) ; `git branch -f <base> <branche>` si la base n'est
   extraite nulle part ; refus expliqué si elle est extraite dans un autre worktree.

Le refus est net quand le worktree a des modifications non commitées : on committe d'abord.

## Alternatives écartées

- **Fusionner dans le dépôt principal** (`git merge <branche>` à la racine) — les conflits
  tombent dans le dossier de l'utilisateur, hors de portée de l'agent ; le dossier reste sale si
  on abandonne à moitié.
- **Rebase de la branche sur la base** — réécrit l'historique de la branche pendant qu'une
  conversation (et parfois une mère, fiche 097) y fait référence ; les conflits se résolvent
  commit par commit, plus dur à expliquer dans l'interface.
- **Bibliothèque git (isomorphic-git, nodegit)** — une dépendance lourde pour quelques commandes.

## Conséquences

- La branche du worktree contient la base après fusion : la PR (si `gh`) et la fusion donnent le
  même résultat, et une seconde fusion plus tard est un simple fast-forward.
- Un dépôt principal sur une autre branche que la base reste intact : seule la référence `<base>`
  bouge.
- Le mécanisme est générique (fiche 110, agents : les deux) : la résolution est un message à
  l'agent, sans outil ni mode particulier.
- À surveiller : un agent qui committe de lui-même pendant la résolution (la fusion est alors
  terminée par lui ; l'app le constate et avance la base).
