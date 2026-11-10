# 041 — Stabilisation : pannes, données, essais, journal

- **Statut** : fait
- **Dépend de** : toutes les fiches faites

## Pourquoi

L'app couvre l'essentiel de Claude Desktop ; avant d'ajouter des fonctionnalités, elle doit tenir
quand quelque chose tourne mal (agent qui plante ou ne répond plus, disque plein, fichier abîmé,
dossier supprimé) et laisser une trace lisible quand ça arrive. Les points restés « à vérifier »
sont vérifiés avec le vrai Bob.

## Critères d'acceptation

- [x] **Pannes de l'agent** (agent factice) : processus qui meurt en plein tour, qui ne répond
      plus (ni à la réponse ni à « Stop »), qui ne démarre jamais, qui écrit n'importe quoi sur
      stdout, commande introuvable, dossier de travail disparu. Dans chaque cas : message clair,
      aucune carte qui tourne indéfiniment, et un moyen de repartir.
- [x] **Données** : un historique ou des réglages abîmés n'empêchent jamais le démarrage et ne sont
      jamais écrasés sans copie ; une écriture impossible (disque plein, droits) est signalée sans
      faire planter l'app ; un fil enregistré en plein tour se rouvre propre.
- [x] **Erreurs non rattrapées** du main process journalisées, sans fenêtre d'erreur brutale ;
      plantage d'une vue (renderer) détecté et rechargé.
- [x] **Journal** : fichier de journal (main) dans le dossier des journaux de l'app, avec rotation ;
      menu Aide → « Afficher le journal ».
- [x] **Essais de bout en bout** : une suite lançable seule (`pnpm e2e <suite>`), capture d'écran
      automatique en cas d'échec.
- [x] **Découpage** de `agent-host.ts` et `manager.ts` en modules plus petits, comportement
      inchangé (tests verts avant et après).
- [x] **Vérifications avec le vrai Bob** : onglet Tâches (035), réponse longue qui continue
      pendant qu'on travaille ailleurs (036), changement d'agent dans l'UI (004), annulation,
      reprise d'une conversation. Coût en bobcoins noté.
- [x] Testé contre l'agent factice (nouveaux scénarios : `plantage`, `muet`, `bavard`, et option
      `--demarrage-bloque`).

## Plan

1. Agent factice : étapes `crash` (le processus s'arrête net), `hang` (ne répond plus, ignore
   `session/cancel`), `stdout-noise` (ligne non JSON sur stdout) ; option `--demarrage-bloque`
   (`initialize` sans réponse). Scénarios `plantage`, `muet`, `bavard`.
2. `AgentHost` :
   - délai maximal de démarrage (`initialize`, `session/new|load|resume`) → statut `error` clair ;
   - « Stop » sans effet au bout de quelques secondes → arrêt forcé du processus, tour clos ;
   - commande introuvable / dossier disparu → message explicite (plus de `spawn … ENOENT` brut).
3. Fil (`transcript.ts`) : un agent qui s'arrête ferme les outils du tour ; un fil relu du disque
   est « assaini » (outils en cours → interrompus, permissions en attente → annulées).
4. `ConversationStore` / réglages : index illisible → copie `index.json.corrupt-<date>` puis
   reprise sur la dernière bonne copie (`index.json.bak`) ; écritures protégées (erreur → avis dans
   la conversation, pas d'exception non rattrapée).
5. Main : journal fichier (`main/log.ts`, sans dépendance), `uncaughtException` /
   `unhandledRejection`, `render-process-gone` → rechargement ; menu Aide → Afficher le journal.
6. e2e : sélection de suite par argument, capture en cas d'échec.
7. Découpage : `agent-host.ts` → session/démarrage, file d'attente, outils de l'app ; `manager.ts`
   → persistance (fils et réglages) à part.
8. Essais réels avec Bob et OpenCode ; corrections ; fiche et index à jour.

## Journal

- 2026-10-13 — Fiche créée. Audit : pas de test du renderer hors e2e ; `agent-host.ts` (1 100
  lignes) et `manager.ts` (780) ; un agent mort en plein tour laisse ses outils « en cours » ; un
  `index.json` illisible est remplacé par une liste vide à la première écriture (perte de
  l'historique) ; une écriture qui échoue dans un minuteur lève une exception non rattrapée ;
  aucun délai sur le démarrage de l'agent ; aucun journal fichier.
- 2026-10-13 — Fait.
  - **Pannes** (`agent-host.ts`) : délais de démarrage (`initialize` 60 s, ouverture de session
    120 s) ; « Stop » sans effet au bout de 8 s → processus arrêté, message « ne répondait plus » ;
    commande introuvable et dossier disparu dits en clair ; un processus mort en plein tour ne
    donne plus qu'un avis (code de sortie + fin de stderr), et ses outils passent à « annulé ».
  - **« Relancer » garde le fil** (écart au plan, trouvé par l'essai `failures`) : avant, la
    reprise rejouait l'historique de l'agent et effaçait le tour interrompu et l'avis de panne.
    Désormais `session/resume` si l'agent le permet, sinon `session/load` avec rejeu ignoré, et si
    l'agent a perdu la session, une nouvelle session avec un avis. Écrire un message à un agent
    arrêté le relance d'abord (comme Claude Desktop).
  - **Ordre des messages** (bug trouvé en route) : la réponse à `session/prompt` pouvait passer
    avant les derniers morceaux de texte (files distinctes du SDK) ; la notification de fin de
    réponse était alors tronquée. L'hôte laisse passer les notifications reçues avant la fin du tour.
  - **Données** (`main/storage.ts`) : écritures atomiques synchronisées sur le disque ; index
    sauvegardé (`index.json.bak`) ; fichier illisible mis de côté (`.corrupt-<date>`) au lieu d'être
    écrasé, avis au lancement ; fil relu du disque « assaini » (`settleTranscript`) ; écriture
    impossible signalée une fois par type, sans exception (`conversations/history-writer.ts`).
  - **Journal** (`main/log.ts`) : `~/Library/Logs/Bob Desktop/main.log` (dans le dossier de données
    pour les essais), 1 Mo puis `main.old.log` ; démarrage, arrêts d'agent, tours en échec, erreurs
    IPC, exceptions non rattrapées, erreurs de l'interface (`app:reportError`). Aide → « Afficher le
    journal ». Interface plantée → rechargée (3 fois par minute au plus) ; erreur de rendu → écran
    de reprise (`ErrorBoundary`). Échec au démarrage → fenêtre d'erreur puis sortie.
  - **Essais** : `e2e/run.mjs` découpé en `e2e/lib.mjs` + une suite par fichier (`e2e/suites/`) ;
    `pnpm e2e <suite…> [--light|--dark]`, `--list` ; en cas d'échec, capture `echec-*.png` et texte
    de la fenêtre + sortie de l'app (`echec-*.txt`). Nouvelle suite `failures`. ESLint `no-undef`
    sur les `.mjs` (une constante non importée n'apparaissait qu'à l'exécution).
  - **Découpage** : `agent-host.ts` 1 270 → 950 lignes (`pending-requests.ts`,
    `app-tools-bridge.ts`, `message-queue.ts`, `process-utils.ts`) ; `manager.ts` 830 → 800
    (`history-writer.ts`, `content-search.ts`). Comportement inchangé, tests unitaires ajoutés.
  - **Bob réel** (2.0.6, ≈ 0,35 bobcoin au total, dont 0,063 d'un second passage involontaire de la
    sonde) : liste de tâches envoyée en `plan` (onglet Tâches, fiche 035 vérifiée) mais chaque mise
    à jour demande une autorisation ; Stop honoré en 5 ms ; processus tué en plein tour puis
    relancé : même session par `session/resume` en ≈ 1 s, sans rejeu, Bob se souvient du début.
  - **Incident pendant les essais** : une app d'essai restée orpheline (sortie standard coupée)
    échouait à écrire sur la console ; l'erreur était journalisée… sur la console, en boucle :
    `main.log` a atteint 14 Go et rempli le disque. Corrigé : le journal passe à `main.old.log` dès
    1 Mo (deux fichiers au plus, même en boucle), cesse d'écrire sur une console fermée (`EPIPE`)
    sans erreur ; le lanceur des essais arrête ses apps s'il s'arrête lui-même et n'attend plus une
    app déjà sortie ; chaque passage de `vitest` a son propre dossier temporaire, supprimé à la fin
    (`scripts/vitest-tmp.ts` ; 6 747 dossiers d'anciens passages supprimés).
  - **Réponse longue pendant qu'on travaille ailleurs** (036) : vérifiée par un test du gestionnaire.
  - **Non fait** : les trois anomalies jamais reproduites (texte tapé dans le navigateur, carte de
    question restée affichée, nom de processus du terminal) n'ont pas été retrouvées ; leurs
    protections d'alors restent en place. Pas de test du renderer hors e2e.
  - **À proposer** : mémoriser « Toujours autoriser » d'une session à l'autre pour les outils sans
    effet sur les fichiers (liste de tâches de Bob), comme Claude Desktop qui ne demande rien pour
    sa liste de tâches.
- 2026-10-13 — e2e : un lancement complet est resté bloqué 26 min dans la suite `failures` (connexion
  au process principal par `--inspect` sans délai maximal, non reproduit seule). Délais ajoutés
  (`mainProcess` : connexion 10 s, évaluation 30 s) et durée maximale par suite (5 min) : une suite
  bloquée devient un échec signalé, le lancement s'arrête et les apps lancées sont tuées.
- 2026-10-16 — Test instable : `agent-host.test.ts` « commandes « / » annoncées après l’ouverture
  de session » échouait environ 2 fois sur 24 lancements en parallèle (comme dans `verify`), jamais
  seul. Cause : après un redémarrage, il supposait les commandes encore vides à la fin de
  `start()`, alors que l'agent factice annonce celles de la nouvelle session juste après son
  ouverture, parfois traitées avant. L'app n'est pas en cause (afficher les commandes de la
  nouvelle session est le bon comportement). Le test vérifie maintenant la remise à zéro sur
  l'instantané « starting » du redémarrage, puis attend les nouvelles commandes ; il échoue bien si
  `doStart` ne remet plus la liste à zéro. 0 échec sur 24 lancements en parallèle et sur 20 du
  fichier entier, `verify` trois fois de suite.
