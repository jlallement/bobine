# ADR-0068 — Préversions de la ligne suivante publiées depuis sa branche

- **Statut** : accepté (décision de Jérôme, 2026-11-23)
- **Date** : 2026-11-23
- **Fiches** : [059](../features/059-dmg-github.md), [218](../features/218-publication-preversion.md),
  [274](../features/274-avis-nouvelle-version.md) (avis de nouvelle version, ADR-0066)

## Contexte

`release.yml` (fiche 218) ne publie qu'un tag dont le commit est sur `main`, avec `ci.yml` vert
sur macOS, Linux et Windows pour ce commit. La ligne 1.1 vit sur la branche `1.1`, qui reçoit
`main` mais n'y est jamais fusionnée. Jérôme veut publier une préversion **1.1.0-rc.1** depuis
`1.1`, pendant que la 1.0 continue ses rc (1.0.0-rc.4) depuis `main` : la règle « tag hors de
`main` refusé » l'interdit, et `ci.yml` ne tourne pas sur les poussées de `1.1`.

## Décision

1. **Une branche de publication par ligne, liste fermée.** Le job `guard` lit la ligne dans le
   tag : `v1.0.*` doit venir d'un commit de `origin/main`, `v1.1.*` d'un commit de `origin/1.1`.
   Toute autre ligne est refusée (`::error::`) ; ouvrir une ligne ou changer sa branche est une
   décision (ce tableau, dans `release.yml`, et la fiche 218), jamais une liste ouverte.
2. **CI sur `1.1`.** `ci.yml` tourne aussi sur les poussées de `1.1` (et d'aucune autre branche),
   pour que le `guard` trouve `verify` vert sur les trois systèmes pour le commit tagué.
3. **Le reste ne change pas.** Tag = version de `package.json` ; un tag avec suffixe donne une
   Release « préversion », jamais « Latest » ; notes tirées des deux changelogs du commit tagué.

## Alternatives écartées

- **Toute branche dont le commit a une CI verte** — un tag sur une branche de travail
  publierait ; c'est ce que le `guard` existe pour empêcher.
- **Publier la 1.1 depuis `main`** — imposerait de fusionner `1.1` dans `main`, contraire au
  choix de garder la 1.0 stable en parallèle.
- **Préversions de la 1.1 hors GitHub Releases (artefacts à la main)** — pas d'attestation, pas
  de notes, pas d'avis de nouvelle version pour les testeurs de la 1.1.

## Conséquences

- Un tag lance `release.yml` **tel qu'il est au commit tagué**, et une poussée de `1.1` lance le
  `ci.yml` de `1.1` : ces deux changements doivent être dans `1.1` (fusion de `main` dans `1.1`)
  avant le premier tag `v1.1.*`.
- Un tag `v1.1.*` posé sur un commit de `main` passe la règle de branche (`main` est ancêtre de
  `1.1`), mais pas celle de la version : `package.json` de `main` est en 1.0.x.
- « Latest » : une 1.0.x finale publiée après une 1.1 rc devient « Latest » (une préversion ne
  peut pas l'être). Quand la 1.1.0 finale existera, une 1.0.x publiée après elle deviendrait
  « Latest » (comportement par défaut de GitHub) : à régler avant cette situation (par exemple
  `--latest=false` pour un correctif d'une ligne plus ancienne).
- Avis de nouvelle version (ADR-0066) : inchangé. Une préversion n'est proposée qu'à la même
  majeure.mineure, jamais une version plus ancienne ; une 1.0.0-rc.4 ne voit pas la 1.1.0-rc.1,
  une 1.1.0-rc.1 ne voit pas la 1.0.0 (tests de `src/shared/update-check.test.ts`).
- Réglages GitHub (propriétaire) : si un ruleset protège `main`, protéger `1.1` de la même façon.
