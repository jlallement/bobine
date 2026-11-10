# Sorties réelles de `gh` (fiche 176)

Relevées le 2026-11-06 avec `gh` 2.103.3, en lecture seule, sur des PR publiques, puis réduites et
anonymisées (dépôt, auteurs, textes) : `gh pr view <n> --json <PR_VIEW_FIELDS>` (une PR en
brouillon avec un contrôle en échec, une verte approuvée, une fusionnée, une avec changements
demandés ; une dont les contrôles sont des `StatusContext`) et `gh run view --job <id>
--log-failed` (un job Go en échec, début, échecs, fin de job). L'essai
`main/changes/pr-tracking-real.test.ts` les lit tels quels.

Ajouts de la recette 0.9 (0.9.1, fiche 183, dépôt privé de recette) : `run-log-failed-ansi.txt`
(journal d'un job dont les commandes sont colorées, `ESC[36;1m…`, D18), `pr-view-fresh-no-checks.json`
(PR juste ouverte : GitHub n'a encore attaché aucun contrôle, `statusCheckRollup` vide et
`mergeable` encore `UNKNOWN`, D16) et `pr-view-conflicting.json` (PR en conflit avec la base,
D20). Les deux PR sont reprises de la forme de `pr-view-passing-approved.json`, avec les valeurs
relevées pendant la recette.

Règles de la branche de base (0.9.1, remarques du tech lead sur D20), lues en lecture seule :
`gh api repos/{owner}/{repo}/branches/<base>` (`branch-protected.json` : protection classique avec
trois contrôles requis ; `branch-unprotected.json` : dépôt de recette, rien de requis) et
`gh api repos/{owner}/{repo}/rules/branches/<base>` (`rules-required-checks.json` : un ruleset
avec `required_status_checks` ; `rules-none.json` : des rulesets sans contrôle requis ;
`rules-unavailable.txt` : dépôt privé d'un compte gratuit, 403 « Upgrade to GitHub Pro », les
rulesets n'y existent pas). Une règle de chaque type est gardée, sources anonymisées.

`mergeStateStatus` et `baseRefName` (demandés depuis 0.9.1) ont été relevés ensuite sur les mêmes
PR, en lecture seule, et ajoutés à leurs fichiers : `BLOCKED` (brouillon, changements demandés),
`CLEAN` (verte approuvée), `UNKNOWN` (fusionnée, et PR neuve), `DIRTY` (PR en conflit de la
recette) ; la base d'une branche de travail est anonymisée (`feature-base`).

`run-log-failed-caret.txt` (0.9.1, D18) : vraie sortie de `gh run view --job <id> --log-failed` sur
le dépôt de recette, telle quelle. Les couleurs y sont écrites en notation caret (les deux
caractères `^[`, puis `[36;1m`), pas avec l'octet ESC ; `run-log-failed-ansi.txt`, reconstruit
avant ce relevé, garde la forme avec l'octet ESC (d'autres outils l'écrivent ainsi).
