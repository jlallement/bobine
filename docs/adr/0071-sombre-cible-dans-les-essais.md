# ADR-0071 — Thème sombre ciblé dans les essais de bout en bout

- **Statut** : accepté (décision de l'utilisateur du 2026-11-24)
- **Date** : 2026-11-24

## Contexte

Chaque suite e2e était jouée deux fois, en clair puis en sombre (`pnpm e2e`, `--changed`). Les
mesures du 2026-11-24 (fiche 279) montrent que le passage sombre coûte autant que le clair (32,1
contre 32,5 min de temps machine), alors que presque aucune suite n'y vérifie quoi que ce soit de
propre au sombre : le sombre n'y change que les captures. Le rendu sombre ne bouge, lui, que
quand un fichier de thème ou de style change.

## Décision

1. **Par défaut** (`pnpm e2e`, une suite nommée, `--changed`) : le clair pour toutes les suites ;
   le sombre seulement pour celles qui ont un **contrôle propre au sombre** (une vérification qui
   dépend du thème : jetons ou palette sombre), déclarées `dark: true` dans `e2e/catalog.mjs`.
   Une capture seule ne suffit pas.
2. **Le sombre pour toutes les suites jouées** quand `--changed` voit un fichier de thème ou de
   style modifié (`THEME_SOURCES` du catalogue : `src/renderer/**/*.css`, palettes, `theme.ts`,
   `appearance.*`, Réglages › Apparence, générateur des jetons, `e2e/palette.mjs`).
3. **Les deux thèmes partout** : la campagne de nuit (`e2e.yml`, `schedule`, macOS et Linux,
   `--themes both`) et
   la suite complète avant un tag (`pnpm e2e --if-needed`). Seule une suite complète aux deux
   thèmes pose le tampon vert (`e2e/.last-green.json`) ; le passage par défaut n'en est pas une.
4. **À la demande** : `--themes both` (tout), `--light` / `--dark` (un seul thème partout).

Remplace, dans la définition de « fini » d'`AGENTS.md` et la fiche 115, la règle « suites
touchées, clair et sombre ». ADR-0069 est inchangé par ailleurs.

## Alternatives écartées

- **Garder les deux thèmes partout** — sûr, mais environ 9 min de plus à chaque suite complète
  pour des captures que personne ne regarde à chaque passage.
- **Le clair seulement, le sombre la nuit** — les suites qui vérifient un rendu sombre ne le
  verraient plus avant la nuit.
- **Garder le sombre pour les suites qui n'en ont qu'une capture** — leur rendu sombre ne change
  qu'avec un fichier de thème ou de style, qui fait déjà tout jouer en sombre (point 2).

## Conséquences

- Suite par défaut : 125 tâches au lieu de 227 (115 suites : 112 à thème, dont 10 en sombre, et
  3 sans thème).
- Un défaut purement sombre hors de ces suites, sans fichier de thème touché (un composant qui
  écrit une couleur en dur, par exemple), n'est vu que la nuit ou à la relecture des captures. La
  campagne de nuit se regarde chaque matin (ADR-0069).
- Une nouvelle suite qui vérifie un rendu sombre doit être déclarée `dark: true` ; un nouveau
  fichier de thème doit entrer dans `THEME_SOURCES` (les tests du lanceur vérifient que chaque
  motif couvre un fichier).
- La campagne de nuit joue macOS et Linux, les deux thèmes partout : le sombre complet est vu
  chaque nuit sur les deux systèmes ; les e2e Linux à chaque poussée sur `main` gardent le sombre
  ciblé.
