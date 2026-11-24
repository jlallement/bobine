# 278 — Pyramide des essais remise à l'endroit

- **Statut** : en cours — étape 1 faite (2026-11-24), étape 2 en attente d'une campagne `e2e.yml` verte
- **Dépend de** : 115 (lanceur e2e), 277 (journées types, `e2e/affirm.mjs`), ADR-0069
- **Agents** : les deux — rien de propre à un agent ; essais contre l'agent factice seulement

## Pourquoi

Près de 2 000 vérifications vivaient dans les e2e (126 suites, environ 25 min de suite complète
à trois tâches), alors que la plupart vérifiaient un composant ou une fonction du main. Une e2e
coûte cher, échoue pour des raisons de minutage et ne dit pas où est le défaut. On les remplace
par des tests Vitest (composant, main sans fenêtre) et par des étapes de journées types, et on
ne garde en e2e que ce qui a besoin de la vraie app.

## Critères d'acceptation

- [x] Inventaire de chaque vérification e2e, avec sa classe et son remplaçant
  (`docs/tests/inventaire-e2e-{A,B,C}.md`).
- [x] Remplaçants écrits avant toute suppression (six branches `test/remplacants-*`, assemblées
  sur `test/pyramide`), `verify` vert.
- [x] Plan de suppression validé par l'utilisateur (`docs/tests/plan-suppressions.md`) : une
  vérification ne part que si son remplaçant nommé existe et est vert.
- [x] Étape 1 : vérifications dont le remplaçant Vitest est vert retirées, suites vidées
  supprimées, `verify` vert, `pnpm e2e --list` cohérent.
- [ ] Campagne `e2e.yml` complète (macOS + Linux, clair et sombre) verte sur les suites réduites.
- [ ] Étape 2 : les 35 vérifications « à confirmer » (étapes de journées) retirées une fois leur
  journée verte.

## Plan

Voir `docs/tests/plan-suppressions.md` (règle, tableaux par suite, risques). Aucune dépendance
nouvelle. Outils de l'étape 1 (jetables, non versionnés) : appariement des lignes d'inventaire
avec les `check(…)` de chaque suite (ordre du texte, puis similarité des libellés relue à la
main pour 35 suites), retrait par l'arbre syntaxique, nettoyage des variables devenues inutiles
guidé par ESLint.

## Journal

- 2026-11-24 — Inventaire, remplaçants, assemblage et plan (voir les inventaires et le plan).
- 2026-11-24 — **Étape 1 faite** (rien poussé, aucune e2e jouée en local, ADR-0069) :
  - 8 suites supprimées : `fil`, `astuces`, `export`, `providers`, `roles-meme-icone`,
    `textes-plateforme`, `reprise`, `touches` ; l'entrée `usage` du catalogue aussi (sa fonction
    `usageSuite` n'avait plus rien ; `usage-bob`, même fichier, reste). Catalogue : 127 → 118
    entrées, 126 → 118 fichiers de suite.
  - 1 219 lignes d'inventaire retirées (1 231 « vert » + la creuse `usage` n° 7, moins 13 lignes
    « attente » restées telles quelles, ci-dessous) ; `check(…)` dans les suites : 1 970 → 754.
    Le `check(true)` hors macOS de `profil` (ligne 79) est retiré.
  - Les actions qui amènent l'app dans l'état d'une vérification gardée sont gardées : on retire
    le `check`, pas forcément l'étape. Sont partis en plus : 42 lancements de l'app (`withApp`,
    dont celui de l'entrée `usage`) qui ne vérifiaient plus rien et dont aucun lancement suivant ne dépend (même profil ou
    vérification après eux), et les scénarios entiers devenus vides (`folderMenu`,
    `withSlowAgent`, `withStoppedDraft`, `fillesProposedSuite`, `noAgent`, `damagedProfile`,
    `restoredResumes`, `trashFamily`, trois phases de `replay-changes`, `foldsSurviveRestart`,
    `changesRows`, `scheduledRunSuite`, `requestedRun`, `conflictRun`, deux des trois dépôts de
    `filles-non-commite`).
  - **Captures qui affirment** : les quatre rendus que le plan ne voyait plus que par une capture
    (risque 2 : fond du thème Fjord dans `settings`, ligatures coupées puis activées dans
    `polices`, fond Nuit noire / Aurore dans `fun`) sont mesurés par `affirm` (style calculé) à
    la place de leur capture. `settings` n° 14 garde sa mesure dans le `waitFor` qui le précède.
    Les 113 vérifications `capture` qui restent sont déjà des `check` qui mesurent le DOM à côté
    de leur capture : elles restent telles quelles.
  - **Écarts au plan** : 13 lignes « attente » (`waitFor` qui porte un contrat) n'ont pas de
    `check` à elles ; leur `waitFor` synchronise aussi la suite, il reste (`parallel` 4,
    `historique-saisie` 17, `base` 14, `usage` 9, `nouvelle-version` 9, `gitlab` 9, `memoire` 1
    et 8, `resume` 3, `commit-choisi` 6, `roles-travail` 6, 7, 11). Aucun scénario d'agent
    factice retiré : les six que plus aucune e2e n'emploie (`commande-dossier-bob`,
    `liste-taches-bob`, `outil-mcp-bob`, `contexte-plein`, `connexion-a-faire-fournisseur`,
    `tache-plan`) restent documentés dans `docs/mock-agent.md` (comportements de Bob, essais à la
    main). Aucune aide ni fixture orpheline.
  - Durée estimée de la suite complète (durées du 2026-11-23, à remesurer) : 74 min de temps
    machine avant ; après, entre ≈ 39 min (au prorata des vérifications gardées) et ≈ 62 min
    (seulement les suites et lancements retirés) ; à trois tâches, ≈ 25 min → ≈ 13 à 21 min.
  - Reste : campagne `e2e.yml` sur la branche, regard sur les captures, puis étape 2.
