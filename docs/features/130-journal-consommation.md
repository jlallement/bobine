# 130 — Journal de consommation (collecte, SQLite)

- **Statut** : fait
- **Dépend de** : 019 (consommation), 053 (sous-agents vivants), 091 (quota de Bob), 103 (fil
  durable, ADR-0021), 108 (continuer avec un autre agent, ADR-0024), 109 (coût par tour)
- **Agents** : les deux. Le journal lit ce que le fil lit déjà : les champs ACP standard
  (`usage_update`, `usage` de la réponse à `session/prompt`, réglages de catégorie `mode` et
  `model`) et la source de coût déclarée dans le profil (`costSource`, ADR-0015 : la base de Bob).
  Rien de nouveau n'est supposé de Bob : il n'expose pas de réglage de modèle, ses lignes n'ont donc
  pas de modèle.
- **ADR** : [ADR-0025](../adr/0025-journal-consommation-sqlite.md)
- **Feuille de route** : vague 1 de `docs/feuille-de-route-2026-10-23.md` (§ 0), lot 131 de
  l'étude. Le tableau (Réglages › Consommation) viendra en fiche 137 (lot 145 de l'étude).

## Pourquoi

Le futur tableau de consommation (fiche 137) a besoin de l'historique : par jour, par agent, par
modèle, par projet. Aujourd'hui, ce qui existe se perd : le détail par tour ne garde que les 100
derniers tours d'un fil, le modèle n'est enregistré nulle part, et supprimer une conversation ou
passer à un autre agent efface sa consommation. Chaque jour sans journal est perdu : ce lot ne fait
que la collecte, sans interface.

## Critères d'acceptation

- [x] Un tour fini (réponse, arrêt ou erreur) donne une ligne dans `userData/usage.sqlite`, même
      sans jetons ni coût (on compte les échanges et la durée).
- [x] Le coût de Bob relu après coup est pris en compte, sur la ligne du même tour.
- [x] Changer de modèle en cours de conversation donne deux lignes à deux modèles distincts.
- [x] La ligne reste après suppression de la conversation et après passage à un autre agent.
- [x] Une base abîmée ou illisible ne fait pas tomber l'app : elle est journalisée, mise de côté et
      recréée ; une base d'une version plus récente de l'app n'est jamais écrasée.
- [x] Coûts : montant **et** unité par ligne, jamais d'estimation de prix (fiche 019) ; les
      agrégats ne mélangent jamais deux unités.
- [x] Le modèle est porté par le message de l'utilisateur (`user-message`) et par `TurnUsage`, qui
      garde aussi le cache (lu, écrit) et la réflexion de chaque tour.
- [x] Lecture : une fonction de requête (période, agent, modèle) et une agrégation pure (par jour,
      par modèle, par projet, worktrees regroupés sur leur dépôt), testées.
- [x] Confidentialité : rien du journal (chemins des dossiers compris) ne part dans l'export de
      Diagnostic ni dans un signalement ; le journal de l'app ne cite que le nom du fichier.
- [x] Tests unitaires : schéma, migration, base abîmée, mise à jour du coût, unités mélangées,
      requêtes.
- [x] Testé contre l'agent factice : scénario `demo` avec passage de « Factice rapide » à « Factice
      précis » ; options `--cout-bob`, `--sans-usage`, `--devise bobcoins`.
- [x] e2e court : deux tours dans l'app buildée, puis lecture des lignes de la base.

## Plan

### Schéma retenu (`usage.sqlite`, version 1)

Une table `turns`, une ligne par tour, `PRAGMA user_version` = version du schéma, mode WAL.

| Colonne | Type | Contenu |
|---|---|---|
| `id` | TEXT PK | `<conversation>:<début du tour en ms>` : stable, et la même heure que `at` du message de l'utilisateur dans le fil (la reprise depuis les fils, fiche 137, s'en sert pour ne rien compter deux fois) |
| `conversation_id`, `parent_id` | TEXT | conversation ; mère si c'est une fille (fiche 097) |
| `started_at`, `ended_at` | INTEGER | millisecondes UTC ; le découpage par jour se fait à la lecture |
| `profile_id`, `profile_label` | TEXT | profil d'agent et son libellé à ce moment |
| `model_id`, `model_name` | TEXT | réglage de catégorie `model` à l'envoi (absent chez Bob) |
| `mode_id`, `mode_name` | TEXT | réglage de catégorie `mode` à l'envoi |
| `workspace`, `repo_root` | TEXT | dossier ; racine du dépôt git, celle du dépôt principal pour un worktree |
| `stop_reason` | TEXT | `stopReason` ACP, `error` (tour en échec), `interrupted` (agent arrêté ou app quittée pendant le tour) |
| `input_tokens`, `output_tokens`, `cached_read_tokens`, `cached_write_tokens`, `thought_tokens`, `total_tokens` | INTEGER | `usage` du tour ; `NULL` si l'agent ne le donne pas |
| `cost_amount`, `cost_currency` | REAL, TEXT | coût du tour (différence du coût cumulé annoncé), avec son unité ; `NULL` sans coût annoncé |
| `context_used`, `context_size` | INTEGER | dernier `usage_update` du tour |
| `tool_calls`, `tools` | INTEGER, TEXT | nombre d'outils ; détail par genre ACP en JSON (`{"read":2,"edit":1}`) |
| `subagents`, `subagent_cost_amount`, `subagent_cost_currency` | INTEGER, REAL, TEXT | sous-agents lancés et leur coût (détail : chez Bob, déjà compris dans le coût du tour) |

Index : `started_at` ; `(profile_id, started_at)` ; `conversation_id`.

### Étapes

1. **ADR-0025** (`docs/adr/0025-journal-consommation-sqlite.md`) : SQLite plutôt qu'un JSONL par
   mois ; ce qui fait foi pour quoi (le fil pour l'affichage d'une conversation, le journal pour la
   consommation dans le temps).
2. **Modèle par tour** (`src/shared/`) : `user-message` et l'élément `user` du fil gagnent `model` ;
   `TurnUsage` gagne `model`, `cachedRead`, `cachedWrite`, `thought` (`usage.ts` : `startTurn`
   garde le modèle dans `pending`, `endTurn` le pose sur le tour). Hôte : `sessionChoices`
   (`session-controls.ts`) donne mode et modèle à l'envoi, sans allonger `agent-host.ts` (au
   plafond).
3. **Base** (`src/main/usage/usage-db.ts`) : `openUsageDb(file)` : migrations en tête du module,
   WAL, `quick_check` ; base abîmée → journalisée, renommée `usage.sqlite.broken-<date>` (avec ses
   `-wal`, `-shm`), recréée ; version plus récente → journal désactivé sans rien toucher ; échec de
   tout → journal muet. `upsert(row)`, `select(filter)`.
4. **Suivi des tours** (`src/main/usage/journal.ts`) : `UsageJournal.onEvent(payload)` sur le flux
   du gestionnaire (`ConversationManager.subscribe`) : début au `user-message` (contexte de la
   conversation lu à ce moment : profil, dossier, mère ; coût cumulé connu), outils (`tool_call` par
   genre), sous-agents (`subagent-run`), contexte et coût (`usage_update`, `usage-report`), fin au
   `turn-end` / `turn-error` (ou `interrupted` si l'agent s'arrête pendant le tour) → une ligne.
   Coût annoncé après la fin (Bob), ou sous-agent fini après : la ligne du dernier tour est
   réécrite (même `id`). `handover` : le coût cumulé repart de zéro. Rien n'est supprimé avec la
   conversation. Racine du dépôt lue sur le disque (`repo-root.ts`, `.git` dossier ou fichier de
   worktree), sans lancer git.
5. **Lecture** (`src/main/usage/report.ts`) : `selectTurns(db, filtre)` (période, agent, modèle) et
   `aggregateTurns(lignes, dayOf)` pure : totaux par jour, par modèle, par projet ; coûts rangés
   par unité.
6. **Branchement** (`src/main/usage/setup.ts`, deux lignes dans `index.ts`) : base ouverte au
   démarrage, abonnement, fermeture au départ de l'app (tours en cours écrits `interrupted`).
7. **Tests** : `usage-db.test.ts` (schéma, migration d'une base v0, base abîmée, version plus
   récente), `journal.test.ts` (ligne sans consommation, coût tardif, handover, unités, outils,
   sous-agents ; agent factice : `demo` avec changement de modèle, `--cout-bob`, `--sans-usage`,
   `--devise bobcoins`), `report.test.ts`, `repo-root.test.ts` ; `usage.test.ts` et
   `transcript.test.ts` pour le modèle par tour ; e2e court (suite `usage`).
8. **Docs** : `architecture.md`, cette fiche, l'index, `docs/acp.md` (compatibilité Bob), les deux
   CHANGELOG.

Pas de nouvelle dépendance : `node:sqlite` est déjà utilisé pour lire la base de Bob.

## Journal

### 2026-10-23 — fait

- **Fait** : ADR-0025 ; `src/main/usage/` (`usage-db.ts`, `journal.ts`, `repo-root.ts`,
  `report.ts`, `setup.ts`) branché dans `index.ts` (abonnement, fermeture au départ) ; modèle à
  l'envoi (`sessionChoices` dans `session-controls.ts`, une ligne de moins dans `agent-host.ts`) porté
  par `user-message`, l'élément `user` du fil et `TurnUsage`, qui garde aussi cache et réflexion.
  Aucun plafond ESLint relevé : `agent-host.ts` et `manager.ts` ne grossissent pas, `index.ts` prend
  trois lignes.
- **Tests** : `usage-db.test.ts` (schéma, WAL, ligne complète relue, réécriture du même tour,
  filtres, migration d'une base v0 sans perte, base abîmée mise de côté et recréée, base plus
  récente intacte, dossier impossible, fichier écrasé en cours de route) ; `journal.test.ts` (tour
  sans consommation, coût par tour façon OpenCode, coût de Bob après coup, conversation rouverte,
  changement de modèle, bascule d'agent, tour interrompu, erreur, sous-agents, unités mélangées ;
  agent factice : `demo` avec « Factice rapide » puis « Factice précis », `--sans-usage`,
  `--devise bobcoins`, `--cout-bob`) ; `setup.test.ts` (vrai `ConversationManager` : lignes gardées
  après une bascule d'agent et la suppression de la conversation, modèle de l'agent d'après) ;
  `report.test.ts`, `repo-root.test.ts` ; `usage`, `transcript`, `session-controls`, `agent-host`.
- **e2e** : `usage-bob` relit `usage.sqlite` après la fermeture de l'app (deux lignes, coût de Bob
  relu sur chacune, sans jetons) ; suites jouées : `usage`, `usage-bob`, `handover`, `history`, clair
  et sombre (8/8). Pas de changement d'interface, donc pas de nouvelle capture à regarder.
- **Écarts au plan** :
  - Identifiant : `<conversation>:<début du tour en ms>` plutôt qu'un numéro de tour ; c'est l'heure
    `at` du message dans le fil, que la reprise depuis les fils (fiche 137) pourra rapprocher sans
    doublon, et elle ne demande aucun compteur qui survive aux redémarrages.
  - Coût de départ d'une conversation rouverte : lu une fois dans le fil (`knownCost`), sinon le
    premier tour après un redémarrage compterait toute la session d'OpenCode. Le reste du suivi ne
    lit pas le fil.
  - La remise à neuf d'une base qui s'abîme **pendant** le lancement (codes `SQLITE_CORRUPT`,
    `SQLITE_NOTADB`) est codée mais pas reproduite en test : SQLite sert ses pages en cache et son WAL,
    et réécrit le fichier à la fermeture. L'essai vérifie seulement que rien ne lève ; la base
    abîmée au lancement, elle, est testée.
  - `pnpm e2e --changed` sélectionne la suite complète (fichiers globaux touchés : `transcript.ts`,
    `agent.ts`, `index.ts`, `agent-host.ts`). Elle n'a pas été jouée ici : le § 0 de la feuille de
    route la réserve à la session de coordination, au moment des fusions, jamais en parallèle.
- **Confidentialité** : aucun chemin du journal n'est lu par le Diagnostic, le rapport ou le
  signalement (rien ne les y relie) ; les messages du journal de l'app ne citent que `usage.sqlite`.
- **Reste (fiche 137)** : reprise depuis les fils, IPC et vue, export CSV, « Remettre à zéro ». La
  mère d'une fille est lue dans le résumé de la conversation : absente si la mère est archivée ou
  supprimée au moment du tour.
