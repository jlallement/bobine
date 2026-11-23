# ADR-0069 — Méthode d'essais et de publication

- **Statut** : accepté (décision de l'utilisateur, appliquée dès la rc.4)
- **Date** : 2026-11-23

## Contexte

On passait plus de temps à essayer qu'à coder : suites e2e touchées jouées en local pendant le
travail et avant chaque push, suite complète locale à chaque lot, maquettes pour tout changement
d'interface, chasse en usage réel « jusqu'à zéro trouvaille » avant chaque version, et tout essai
instable bloquant. Les apps de bureau comparables suivent une méthode plus légère : intégration
continue sur chaque branche, suite complète la nuit, fumée sur des parcours réels, gel avant une
version. Le dépôt est public (fiche 250) : les runners macOS et Linux de GitHub sont gratuits.

## Décision

1. **Pendant le développement** : `./scripts/verify`, et les suites e2e touchées
   (`pnpm e2e --changed`, noms donnés par `--dry-run`) jouées **sur GitHub** : `e2e.yml` lancé à
   la main sur la branche de travail, `systeme: les-deux` (macOS + Linux), pas en local.
2. **Pousser `main`** : `verify` vert et suites touchées vertes sur GitHub. Plus de suite complète
   locale à chaque push.
3. **Suite complète** : chaque nuit sur GitHub (`e2e.yml`, `schedule`), et une fois en local juste
   avant un tag : `pnpm build && pnpm e2e --if-needed`.
4. **Fumée des parcours réels** : les journées types `parcours-*` (fiche 277). Une nouvelle
   fonction ajoute son étape au parcours concerné.
5. **Avant une version à tester** : une chasse en usage réel limitée (environ 2 h). Seuls les
   bloquants et les régressions retiennent la version ; l'agaçant et le cosmétique vont sur la
   liste de la version suivante.
6. **Maquettes** : seulement pour un nouvel écran ou un vrai changement de parcours ; sinon,
   captures avant/après à la relecture.
7. **Essais instables** : mis en quarantaine (indicatifs, nommés, avec la raison — `quarantine`
   d'`e2e/catalog.mjs`), corrigés à côté, sans bloquer.
8. **Gel de la 1.0** : plus de nouvelle fonction dans la ligne 1.0, seulement des corrections
   (les fonctions vont sur la ligne 1.1, ADR-0068).

Restent inchangés : pas de test truqué (on corrige la cause), un test par bug corrigé, rien ne
régresse sur Mac.

Remplace : les règles d'exécution des e2e de la fiche 115 (suites touchées en local pendant le
travail et **avant chaque push**, journal du 2026-10-22) et la règle « suite e2e avant chaque
push » d'`AGENTS.md`. Le lanceur (`pnpm e2e`, `--changed`, `--if-needed`) ne change pas.

## Alternatives écartées

- **Garder la méthode d'avant** — sûre mais trop lente : l'essai coûtait plus que le code.
- **Rendre les e2e bloquants à chaque pull request** — minutes et attente à chaque poussée, et
  les suites encore instables bloqueraient tout ; la nuit et la branche suffisent.
- **Supprimer les essais instables** — on perdrait la couverture ; la quarantaine la garde visible.

## Conséquences

- Moins d'attente locale ; le Mac reste libre pendant que GitHub joue les suites.
- Une régression hors des suites touchées peut atteindre `main` et n'être vue que la nuit : la
  campagne de nuit se regarde chaque matin, et un rouge se corrige avant tout nouveau travail.
- Le tag garde son filet : suite complète locale, plus la chasse limitée.
- La quarantaine doit rester courte et nommée ; une suite qui y reste longtemps se signale.
- Les maquettes et la chasse coûtent moins, au prix de petits défauts reportés à la version
  suivante (listés, pas oubliés).
