# 279 — Pyramide des essais remise à l'endroit

- **Statut** : en cours — étapes 1 et 2 faites, lots 2 et 3 du plan de vitesse codés (2026-11-24) ; reste la campagne `e2e.yml` complète sur les suites réduites
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
- [x] Étape 2 : les 35 vérifications « à confirmer » (étapes de journées) retirées une fois leur
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
- 2026-11-24 — **Étape 2 faite** (branche `test/pyramide-etape2`, rien poussé, aucune e2e jouée
  en local) :
  - Condition vérifiée sur GitHub (`gh run view`, résultat par suite et par thème) : chaque
    journée-remplaçant est verte sur macOS et Linux, en clair et en sombre — `parcours-deleguer`
    3 fois sur 3 (45352665736, 45352675204, 45352684067 ; le job Linux de 45352665736 est rouge
    sur `filles` sombre, pas sur la journée) ; `parcours-premier-lancement`, `parcours-longue`
    (45345873473 ; le Mac y est rouge sur `parcours-deleguer` sombre seulement) ;
    `parcours-matinee`, `parcours-reglages`, `parcours-pannes`, `parcours-outils` (45342287255 ;
    rouges dans ce passage : `parcours-longue`, `parcours-premier-lancement` et une fois
    `parcours-deleguer`, vertes ensuite). `parcours-reglages`, retouchée après (étape 6, réseau
    rendu au signal), est revue verte sur les deux systèmes dans 45361829816 ; toutes les
    journées vertes sous Linux dans la campagne complète 45373764336 de `main`. Les numéros
    d'étape du plan ont été recomptés sur les `journee.step(…)` actuels : ils correspondent.
    Aucune vérification gardée faute de journée verte.
  - 35 `check` retirés (`check(…)` : 754 → 719), dans 20 suites. Supprimées entièrement : `acp`,
    `filles-non-commite`, `mentions` (catalogue : 118 → 115 entrées) ; leurs sources propres à la
    journée qui les remplace sont ajoutées aux sources de `parcours-outils` (`@terminal`, échanges
    ACP) et de `parcours-matinee` (rôle qui écrit sur un dossier modifié), pour que
    `pnpm e2e --changed` lance la journée quand elles changent.
  - Réduites : `profil`, `restart`, `mermaid`, `git`, `terminal`, `aparte`, `composer`,
    `filles-fusion`, `network`, `onboarding`, `filles`, `browser`, `command-output`,
    `roles-travail`, `pannes-visibles`, `sommaire`, `tables`.
  - Actions gardées parce qu'elles préparent une vérification gardée (leçon de `discussion`) :
    `profil` (restauration : la suite efface ensuite une conversation de la liste rétablie),
    `terminal` (terminal refermé avant la commande de l'agent ; attente de l'onglet rouvert avant
    la saisie), `browser` (scénario `changement-de-site` et attente de 2 s : la navigation qui
    suit doit être hors d'une action de l'agent), `git` (attente de la branche modifiée),
    `filles` (accord de la fille, retour à la mère : la suppression qui suit en dépend),
    `aparte`, `sommaire`, `network`, `command-output`, `tables`, `pannes-visibles` (les tours
    sont menus à leur fin, captures comprises).
  - Actions retirées, devenues sans objet : `restart` (suppression finale de la conversation,
    rien après), `onboarding` (relance de l'app qui ne vérifiait que l'absence d'accueil ; attente
    de l'agent lancé), `roles-travail` (lancement `freshRun` entier : profil neuf, rôles en
    lecture seule, rien dans le dépôt dont dépendent les lancements suivants), `mermaid`,
    `composer`, `pannes-visibles` (relevés qui ne servaient qu'aux `check` retirés).
    `filles-fusion` : le `check` des worktrees devient une garde (`throw`) — sans elle, un
    worktree introuvable ferait committer `git` hors du dossier d'essai.
  - Écart au plan : aucun. Non fait : campagne `--lang en` des journées (risque 6 du plan) ;
    campagne `e2e.yml` des suites réduites (étapes 1 et 2), à lancer avant fusion.
- 2026-11-24 — **Lots 2 et 3 du plan de vitesse** (branche `test/vitesse-theme-jobs`, rien
  poussé, aucune e2e jouée en local ; décisions de l'utilisateur du 2026-11-24, ADR-0071) :
  - **Sombre ciblé.** `dark: true` dans `e2e/catalog.mjs` pour les suites qui ont un contrôle
    propre au sombre, relu dans chaque suite : `aurore` (`--bg` d'`auroraNight`), `composer` (Plan
    distinct de l'accent sur `black` et `fjordNight`), `settings` (fond de `fjordNight` ; menu ☰
    opaque sur Aurore nuit hors macOS), `fun` (fond de `black`), `tables` (couleurs `hljs` aux
    jetons du thème), `mermaid` (diagramme aux couleurs de `variantOf(scheme)`),
    `command-output` (fond et vert ANSI de la variante), `turn-guards` (alerte du compteur aux
    jetons du thème), `parcours-outils` (sortie de commande aux jetons du thème),
    `browser-annotate` (épingle dessinée à l'`--accent` du thème). 10 suites.
  - **Écarts à la liste du plan** (14 suites) : `filles`, `polices` et `terminal` n'ont en sombre
    que des captures (Aurore nuit, `31-terminal-black`), aucun `check` ; `parcours-reglages`
    passe en sombre puis revient au système dans les deux thèmes (`nativeTheme.themeSource`), sans
    rien qui dépende du thème joué. Leur rendu sombre ne change qu'avec un fichier de thème ou de
    style, qui fait jouer tout le sombre. Aucune autre suite n'a de contrôle lié au thème
    (`history`, `inbox`, `mcp` comparent des couleurs entre elles ; `profil` a une branche réservée
    au clair ; `android` ne s'en sert que pour un marqueur).
  - Lanceur (`scripts/e2e-select.mts`, `e2e/run.mjs`) : `--themes auto|both|light|dark`
    (`--light`, `--dark` gardés) ; `auto` par défaut ; `THEME_SOURCES` (catalogue) touché par
    `--changed` → le sombre pour toutes les suites jouées ; `--if-needed` → les deux thèmes
    partout ; seule une suite complète `both` pose le tampon vert. `e2e.yml` : `--themes both` la
    nuit (`schedule`) seulement, sur les trois passages du Mac.
  - **Jobs.** `--jobs` par défaut : `min(5, floor(cœurs / 3))` en local (5 sur le Mac à 15
    cœurs), 3 en CI (`GITHUB_ACTIONS` ou `CI`) ; Linux sur GitHub garde son `--jobs 2`.
  - `pnpm e2e --dry-run` : 227 tâches avant (3 jobs) → 125 après (5 jobs) ; `--themes both` et
    `--if-needed` : 227.
  - Tests du lanceur : sélection des thèmes (suite déclarée sombre, fichier CSS touché, `--themes
    both`, `--if-needed`, nuit dans `e2e.yml`), jobs par défaut. `AGENTS.md`, `docs/README.md`,
    fiche 115 et ADR-0071.
  - Non fait : les deux passages complets verts à 5 tâches que le plan demandait avant de changer
    le défaut (pas d'e2e locale dans ce lot), et la campagne `e2e.yml` de la branche.
