# 030 — Lancer l'app du projet (serveurs de dev) et l'ouvrir dans le navigateur

- **Statut** : fait
- **Dépend de** : 007

## Pourquoi

Dans Claude Code Desktop, l'agent démarre le serveur de dev du projet par son nom, ouvre l'app dans
le navigateur intégré et lit les journaux du serveur pour trouver les erreurs de compilation.

## Critères d'acceptation

- [x] Fichier de lancement du projet (`.bob/launch.json`, sinon `.claude/launch.json`) : nom,
      commande (`runtimeExecutable` + `runtimeArgs`, ou `command` en une ligne), port, URL.
- [x] Outils : `preview_start` (démarre ou réutilise le serveur, ouvre le navigateur sur son URL),
      `preview_list`, `preview_logs` (filtre erreurs / texte), `preview_stop`.
- [x] L'agent peut créer le fichier de lancement s'il manque (avec l'accord de l'utilisateur, par son
      autorisation habituelle d'écriture) ; le format lui est donné par les outils.
- [x] Serveurs visibles dans l'onglet (état, journal, arrêt) ; arrêtés avec l'app (voir l'écart
      ci-dessous).
- [x] Testé : agent factice + petit serveur de test ; e2e ; Bob réel.

## Plan

- `shared/launch.ts` : format du fichier de lancement (celui de Claude Code :
  `{ version, configurations: [{ name, runtimeExecutable, runtimeArgs, port, url?, cwd?, env? }] }`),
  lecture et validation ; `.bob/launch.json`, sinon `.claude/launch.json`.
- `main/preview/dev-servers.ts` : serveurs lancés par l'app, **par dossier et par nom** (deux
  conversations du même projet partagent « web ») ; groupe de processus détaché, journaux en mémoire
  (1 000 dernières lignes), attente du port ; tout est arrêté à la fermeture de l'app.
- **Appels longs** (reporté de la fiche 029) : un outil n'attend jamais plus de 40 s (`TOOL_BUDGET_MS`)
  ; au-delà il répond « encore en cours » et l'agent rappelle l'outil (le démarrage continue).
- `main/preview/preview-tools.ts` : `preview_start` (démarre ou réutilise, puis ouvre l'URL dans le
  navigateur de la conversation), `preview_list`, `preview_logs` (erreurs / recherche / nombre de
  lignes), `preview_stop`. Avant le premier lancement d'une commande, l'app la montre à l'utilisateur
  (carte « Lancer « web » : `npm run dev` ? ») : l'autorisation de Bob n'affiche que le nom de l'outil.
  Accord mémorisé pour la session de l'app (dossier + commande).
- Création du fichier de lancement : l'agent l'écrit avec ses propres outils (autorisation habituelle
  de modification) ; `preview_start` sans configuration explique le format attendu.
- UI : sous la barre d'adresse, les serveurs du dossier (état, Arrêter) et leurs journaux.
- Écart au critère « arrêt à la fermeture de la conversation » : les serveurs sont partagés par
  dossier ; ils s'arrêtent avec l'app, ou à la demande.

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-11 — Implémenté comme prévu : `shared/launch.ts`, `main/preview/dev-servers.ts`,
  `preview-tools.ts`, IPC `preview:*`, `DevServersBar` (état, journal, arrêt), scénario `lancer-app`.
  Tests : format, serveurs réels (port, attente au-delà du délai, échec, commande absente, port déjà
  pris, `command` par le shell), outils (accord de la commande, refus, réponse tardive, pas de
  fichier, plusieurs configurations) ; e2e `launchSuite`.
  - **Bob réel, 1er essai** (0,314 bobcoin) : Bob a appelé `preview_list` (qui ne donnait pas le
    format), a écrit `.bob/launch.json` à sa façon (`"command": "npx --yes serve . -l 3456"`, `url`,
    sans `port`), `preview_start` a échoué, et Bob a lancé le serveur lui-même dans le shell
    (`npx serve … &`) — processus hors de l'app, arrêté à la main après l'essai.
  - Corrigé : forme `command` acceptée (lancée par `/bin/sh -c`), port déduit de l'URL, un serveur
    « existant » doit vraiment répondre, le format et la consigne « ne lance pas les serveurs dans
    le shell » sont dans la description des outils, une page qui ne s'ouvre pas n'est plus un échec.
  - **Bob réel, 2ᵉ essai** (0,110 bobcoin) : `preview_start` directement → carte « Lancer « quiz » :
    `npx --yes serve . -l 3456` » → capture ; aucune autorisation de Bob ; « Le serveur de dev tourne
    sur http://localhost:3456/quiz.html et le quiz s'affiche correctement ». Serveur arrêté avec
    l'app. `~/bob-essai/.bob/launch.json` (écrit par Bob) est resté en place.
