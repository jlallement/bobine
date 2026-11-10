# 115 — Essais de bout en bout plus courts

- **Statut** : fait
- **Dépend de** : 041 (suites e2e), 106 (essais déterministes : ports libres, dossiers jetables,
  fenêtres jamais au premier plan)
- **Agents** : agent factice seulement (rien ne change pour Bob ni OpenCode, ni dans l'app)

## Pourquoi

`pnpm e2e` joue 53 suites en clair puis en sombre, une à la fois : ≈ 11 min (652 s mesurées pour
la fiche 106), plus autant en `--lang en`. C'est trop long pour être rejoué à chaque changement
et avant chaque push, alors on le saute, et le garde-fou ne sert plus. Trois leviers : jouer les
suites en parallèle, ne jouer pendant le travail que celles que les fichiers modifiés touchent,
et ne pas rejouer avant le push une suite complète déjà verte pour le même build.

## Critères d'acceptation

- [x] `pnpm e2e --jobs N` : les suites tournent dans N processus (3 par défaut ; `--jobs 1` :
      l'ancien comportement, une suite à la fois dans le même processus). Une ligne par suite
      finie (durée, job), sa sortie entière si elle échoue, un résumé (échecs, durée totale).
- [x] Aucune ressource partagée disputée : ports, dossiers de données et dépôts jetables, faux
      outils, trousseau simulé, presse-papiers, raccourci global, captures d'échec. Le délai
      maximal par suite et les captures d'échec marchent encore.
- [x] `pnpm build && pnpm e2e --jobs 3` trois fois de suite, clair et sombre : 0 échec, durées
      dans le journal.
- [x] `pnpm e2e --changed` : seulement les suites touchées par les fichiers modifiés depuis
      `main` (`--base <ref>`), commits de la branche et fichiers non commités compris ; fichiers
      « globaux » → tout ; suite sans carte → toujours jouée. Le lanceur affiche les fichiers, les
      suites choisies et pourquoi. Combinable avec `--jobs` et `--lang en`.
- [x] Tampon « suite complète verte » : une suite complète (sans filtre, deux thèmes) sans échec
      écrit `e2e/.last-green.json` (ignoré par git) avec l'empreinte des sources et la date ;
      `pnpm e2e --if-needed` (`pnpm e2e:pretag`) ne rejoue rien si l'empreinte est la même, sinon
      joue la suite complète. Aucun hook git installé.
- [x] `AGENTS.md` (commandes, définition de « fini »), en-tête de `e2e/run.mjs` à jour.
- [x] `./scripts/verify` vert ; logique pure testée (`scripts/e2e-select.test.ts`).

## Plan

**Inventaire des ressources partagées** (lecture de `e2e/lib.mjs` et des 53 suites) :

| Ressource | Partagée ? | Traitement |
|---|---|---|
| Dossier de données, dépôts git, faux SDK, faux `xcrun`/`adb`/`gh` | non : `mkdtemp` par suite (et par processus pour les outils neutres) | rien |
| Trousseau | non : `--use-mock-keychain` | rien |
| Ports DevTools et inspecteur du main | **oui** : choisis une fois au lancement du processus, libres seulement pendant que l'app tourne ; un autre processus peut les prendre entre deux apps de la même suite (≈ 1 chance sur 300 par paire et par suite) | tranche de la plage propre à chaque job (`BOBINE_E2E_JOB`/`BOBINE_E2E_JOBS`) |
| Ports des serveurs d'essai (pages, faux point d'accès) | non : `listen(0)` | rien |
| Captures `echec-NN-…` | **oui** : `NN` repart à 01 dans chaque processus, deux suites au même libellé tronqué s'écraseraient | nom de la suite dans le nom : `echec-<suite>-NN-…` |
| Presse-papiers de la machine | **oui** : `touches` et `diagnostic` y copient puis le relisent | verrou `presse-papiers` : jamais en même temps |
| Raccourci global ⌥⌘B | **oui** : chaque app d'essai l'enregistre (réglage par défaut), une seule le peut ; `quick` vérifie qu'il est à elle | `quick` tourne seule (≈ 15 s pour les deux thèmes), en tête de file |
| Instance unique, `blockedByOldApp` | non : verrou par dossier de données | rien |

**Fichiers** (seulement `e2e/`, `scripts/`, `package.json`, `.gitignore`, docs) :

1. `scripts/e2e-select.mts` — logique pure, typée et testée : arguments, motifs de fichiers,
   choix des suites, tâches, ordre de passage, ordonnancement (`alone`, `locks`), empreinte.
   Dans `scripts/` parce que `tsconfig.node.json` y vérifie les `.mts` (pas dans `e2e/`).
2. `e2e/catalog.mjs` — `SUITES` (nom, fichier, fonction, thèmes, `alone`, `locks`) et la carte
   des sources de chaque suite à côté, plus `GLOBAL_SOURCES`. Sorti de `run.mjs` pour que le
   lanceur parent ne charge ni `lib.mjs` ni les suites (ports, dossier jetable, Electron).
3. `e2e/pool.mjs` — pool de processus `node e2e/run.mjs <suite> --<thème> --jobs 1`, délai de garde
   au-dessus de celui de la suite, Ctrl+C transmis.
4. `e2e/state.mjs` — fichiers modifiés (git), empreinte, tampon vert, durées.
5. `e2e/run.mjs` — options, `--changed`, `--if-needed`, `--dry-run`, choix entre pool et
   exécution sur place.
6. `e2e/lib.mjs` — tranche de ports par job, nom de suite dans les captures d'échec.
7. `package.json` — `e2e:pretag` ; `.gitignore` — `e2e/.last-green.json`, `e2e/.durations.json`.

**Choix** :

- Une tâche = une suite dans un thème, dans son processus : un échec ou un blocage n'emporte
  qu'elle, et les apps qu'elle a lancées meurent avec son processus.
- Ordre : `quick` (seule) d'abord, puis les tâches les plus longues du dernier passage
  (`e2e/.durations.json`), pour ne pas finir sur une longue suite lancée en dernier.
- Une suite bloquée (délai dépassé) en parallèle est un échec de plus, les autres continuent ;
  avec `--jobs 1`, le lancement s'arrête comme avant.
- Carte : construite en rapportant les `data-testid` de chaque suite aux composants qui les
  posent, puis complétée des modules du main qu'elle exerce et de ses fixtures. Un test vérifie que
  chaque motif couvre au moins un fichier (carte à reprendre après un renommage). Fichiers globaux
  (tout essai les traverse : `send`, `ready`) : ceux de la consigne, plus le preload, l'IPC, les
  réglages, la session de l'agent, la zone de saisie, la barre latérale, le fil et le Markdown.
  Un fichier modifié que rien ne couvre (docs, scripts, tests unitaires) ne déclenche rien ; il
  est listé « hors carte ». Le filet reste `--if-needed` avant le push.
- Empreinte : contenu des fichiers sur le disque plutôt que `HEAD` + diff : un commit sans
  changement de contenu ne la change pas. Elle couvre `src/`, `e2e/`, `package.json`,
  `pnpm-lock.yaml`, `electron.vite.config.ts`, le lanceur, **et `out/`** : une suite verte sur un
  build périmé ne doit pas valoir pour des sources qu'elle n'a pas essayées. Tampon par langue.

Aucune nouvelle dépendance.

## Journal

- 2026-10-22 — Fiche créée et implémentée (lot de quatre chantiers parallèles ; celui-ci ne
  touche que les essais et la doc).
- 2026-10-22 — **Premiers passages** (`pnpm e2e --jobs 3`, trois de suite) : 5 min 01 s, 4 min 21 s,
  4 min 22 s, mais 4, 2 et 1 échecs. Aucun ne venait d'une ressource disputée ; tous de la charge
  (passage 1 : `./scripts/verify` lancé en même temps, charge ≈ 21 ; trois autres sessions faisaient
  tourner leurs propres e2e sur la machine) :
  - `settings` (×3) : barre latérale à ≈ 346 px au lieu de 380 après le glisser. Les mouvements
    partaient sans attendre que la page les traite ; le relâcher arrivait avant les derniers.
    → `drag` attend une image entre deux mouvements (`lib.mjs`, `ui.drag` et `attachPage`).
  - `filles` (×1) : survol d'un élément de menu mesuré pendant que le menu glissait encore.
    → `ui.center(selector)` (position immobile, celle qu'utilisait déjà `click`), employée par la
    suite pour le survol.
  - `notifications`, `changes` (×3, au même moment) : fenêtre de l'app absente après 20 s.
    → attente jusqu'à une minute, avec un message clair au lieu de « reading 'webSocketDebuggerUrl' ».
- 2026-10-22 — **Deuxième série** : 4 min 18 s ✓, 8 min 49 s (3 échecs), 4 min 15 s ✓. Échecs :
  - `handover` : clic sur un élément de menu pas encore rendu (course déjà présente avec l'ancien
    `click`). → `center`, donc `click`, attend que l'élément existe.
  - `mentions` : bloquée 5 min sans une ligne. Seul un appel CDP sans délai peut se figer ainsi.
    → chaque appel CDP de `withApp` est borné à une minute : un blocage devient un échec capturé.
  - `panel` (×1) : panneau élargi de 47 px au lieu de 120, avec l'image d'attente déjà en place.
    Hypothèse de l'occultation des fenêtres superposées écartée par une sonde (trois apps
    simultanées : `visible`, `requestAnimationFrame` en < 10 ms). Non reproduit en 46 passages de
    `panel` sous charge (un passage complet en même temps). Le journal des évènements de pointeur
    de la poignée est désormais affiché si la largeur ne suit pas.
  - Passage de surcharge volontaire (cinq apps à la fois) : `browser` a vu une requête encore
    « GET … » sans son statut 500. C'est le scénario `debogage-web` de l'agent factice, qui lit le
    journal réseau sans attendre la réponse : hors du périmètre de cette fiche (`src/mock-agent`),
    à reprendre à part.
- 2026-10-22 — **Preuve.** `pnpm build && pnpm e2e --jobs 3` trois fois de suite, chaque passage
  jouant les 53 suites en clair puis en sombre (104 tâches), pendant que l'utilisateur et trois
  sessions parallèles travaillaient sur la machine (charge 4 à 6) :

  | Passage | Résultat | Durée |
  |---|---|---|
  | 1 | ✓ 0 échec | 4 min 11 s (251 s) |
  | 2 | ✓ 0 échec | 4 min 13 s (253 s) |
  | 3 | ✓ 0 échec | 4 min 14 s (254 s) |

  Référence séquentielle (fiche 106) : 652 s. Gain : ÷ 2,6. `quick` seule en tête coûte ≈ 15 s ;
  la plus longue tâche (`browser`, ≈ 30 s) ne pèse plus sur la fin grâce à l'ordre par durée.
  Vérifié aussi : capture d'échec `echec-<suite>-NN-…` par thème sans collision, sortie entière
  de la suite affichée ; suite bloquée (délai ramené à 4 s pour l'essai) signalée et comptée ;
  `pnpm e2e:pretag` → « déjà verte », puis « sources ou build changés » après l'ajout d'un
  fichier dans `e2e/`, et « aucune suite verte » en `--lang en` ; `--changed --base HEAD` avec un
  fichier `e2e/fixtures/android-…` → `android` seule (2 tâches, 16 s).

  **Écarts au plan** : `SUITES` et la carte vivent dans `e2e/catalog.mjs` (pas dans `run.mjs`),
  pour que le lanceur parent ne charge pas `lib.mjs` ; la logique pure dans
  `scripts/e2e-select.mts` (vérifiée par `tsc`) ; empreinte du contenu plutôt que `HEAD` + diff, et
  `out/` compris ; une suite bloquée en parallèle n'arrête pas les autres ; `--dry-run`,
  `--verbose` et `e2e/.durations.json` en plus. Correctifs de robustesse de `lib.mjs` et de deux
  suites (`filles`, `panel`) trouvés en prouvant le parallélisme. `CONTRIBUTING.md` et
  `docs/README.md` mis à jour avec `AGENTS.md`. Pas de ligne de changelog : rien ne change pour
  l'utilisateur de l'app.
- 2026-10-22 — **Règle changée** à la demande de l'utilisateur : la suite complète
  (`pnpm e2e --if-needed`) n'est exigée qu'**avant un tag de version**, plus avant chaque push ;
  avant un push, seulement les suites touchées (`pnpm e2e --changed`). `e2e:prepush` renommé
  `e2e:pretag` ; `AGENTS.md`, `CONTRIBUTING.md`, `docs/README.md`, en-tête de `e2e/run.mjs`.
