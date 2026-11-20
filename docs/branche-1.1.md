# Branche `1.1`

Créée le 2026-11-20 depuis la 1.0.0-rc.2 (`7ea2758`, « chore: release 1.0.0-rc.2 »), pour
préparer la 1.1 sans déranger la sortie de la 1.0.

## La règle

- **`main` = ligne 1.0** : corrections seulement (recette, préversions, 1.0, puis 1.0.x). Aucune
  nouvelle fonction n'y entre avant le tag 1.0.
- **`1.1` = nouvelles fonctions** (première : fiche 271, vue des fichiers). Elle est **remise à
  jour régulièrement depuis `main`** (`git merge main`), pour que chaque correction de la 1.0 y
  arrive et que la fusion finale reste petite.
- **Après le tag 1.0**, `1.1` est fusionnée dans `main` ; le travail de la 1.1 continue alors sur
  `main`, et cette branche disparaît.
- Les branches de travail d'une fonction 1.1 partent de `1.1` et y reviennent, pas dans `main`.

## Publication

La publication refuse un tag posé hors de `main` : le job `guard` de
`.github/workflows/release.yml` vérifie que le commit tagué est un ancêtre de `origin/main` (et
que `ci.yml` y est vert). **Aucune version, même une préversion, ne se publie depuis `1.1`** : la
fusionner dans `main` d'abord.
