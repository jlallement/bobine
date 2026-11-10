# ADR-0020 — Plafond des conversations filles : un réglage, 5 par défaut

- **Statut** : accepté
- **Date** : 2026-10-21

## Contexte

L'ADR-0019 fixe un plafond de 3 conversations filles actives par mère, en dur. L'utilisateur
préfère un réglage, avec 5 par défaut (2026-10-21), avant de faire l'étape 2 de la fiche 097, où
l'agent lance lui-même ses filles.

## Décision

Le nombre maximal de conversations filles **en cours** par mère devient un réglage :
**Réglages › Conversation**, de 1 à 10, **5 par défaut**.

- Une fille compte tant que son agent travaille, ou attend un accord ou une réponse. Une fille qui a
  fini son tour, une fille archivée et une fille supprimée ne comptent pas.
- Le plafond vaut pour les deux étapes :
  - « Lancer en parallèle… » est grisé quand il est atteint, et une infobulle dit pourquoi ;
  - `start_child` répond une erreur explicite à l'agent.

Le reste de l'ADR-0019 ne change pas. Il n'y a qu'un niveau, ton accord pour chaque fille lancée par
l'agent, et un worktree par fille.

## Alternatives écartées

- **Garder 3 en dur** : trop juste pour un découpage réel, l'utilisateur a demandé 5.
- **Pas de plafond** : le coût (bobcoins, quota de l'abonnement) peut filer si l'agent découpe trop.

## Conséquences

- L'ADR-0019 garde son statut, avec la mention « plafond remplacé par ADR-0020 ».
- Un réglage de plus, au bon endroit, et un seul chiffre à expliquer.
- Avec 5 filles et Bob, le coût d'un découpage peut être notable. L'accord pour chaque fille reste
  le garde-fou principal.
