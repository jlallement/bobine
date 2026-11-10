# 055 — Reprendre les sessions commencées ailleurs

- **Statut** : fait
- **Dépend de** : 015, 026, 054
- **Agents** : les deux (`session/list` annoncé par Bob 2.0.6 et OpenCode 1.19) ; sessions vides
  d'OpenCode masquées (propre à OpenCode, ADR-0011)

## Pourquoi

Une session commencée dans `bob chat`, dans Bob IDE ou dans l'interface terminal d'OpenCode n'existe
pas dans Bob Desktop. Les deux agents savent lister leurs sessions et les rejouer : l'app peut les
proposer, et les reprendre comme une conversation de son historique.

## Critères d'acceptation

- [x] « Reprendre une session… » montre les sessions de l'agent (titre, dossier, date), celles du
      dossier de la conversation d'abord, ou de tous les dossiers ; sans celles que l'app connaît
      déjà, ni celles dont le dossier n'existe plus.
- [x] Choisir une session crée la conversation et l'ouvre : l'agent rejoue l'échange
      (`session/load`), on peut continuer. Une session déjà reprise s'ouvre au lieu d'être doublée.
- [x] La liste est lue sans ouvrir de session (pas de `session/new`), donc sans rien créer chez
      l'agent ; ni prompt ni coût.
- [x] Agent sans `session/list` : l'entrée le dit, rien n'est lancé.
- [x] OpenCode : ses sessions vides (« New session - <date> », jamais écrites) sont masquées ;
      déclaré dans son profil, listé sous « Propre à OpenCode » et dans `docs/agents.md`.
- [x] « Annoncé par l'agent » (fiche 054) montre `session/list`.
- [x] Testé contre l'agent factice (sessions mémorisées dans un autre dossier, reprise, doublon) ;
      essai réel en lecture avec Bob et OpenCode (liste ; reprise d'une session sans prompt).

## Relevé (2026-10-14, sans prompt)

| | Bob 2.0.6 | OpenCode 1.19 |
|---|---|---|
| `session/list` sans `cwd` | 43 sessions, 11 dossiers, pas de `nextCursor` | 62 sessions, pas de `nextCursor` |
| Avec `cwd` | sessions du dossier | sessions du dossier |
| Titre | premier message de l'utilisateur, entier | titre généré, ou « New session - <date ISO> » si rien n'a été écrit |
| Sous-agents | absents | absents (sessions enfants) |
| Bruit | — | sessions vides ouvertes par l'app avant le premier message, dossiers temporaires d'essais |

## Plan

1. `main/agent/agent-process.ts` (nouveau) : lancement d'un agent et connexion ACP, sortis
   d'`AgentHost` pour être partagés ; `listAgentSessions(profile, { cwd?, credentials })` :
   `initialize`, puis `session/list` (pages suivies jusqu'à 500 sessions), agent arrêté.
2. `ConversationManager.agentSessions(profileId, cwd?)` : liste filtrée (déjà connues, dossier
   disparu, sessions vides déclarées par le profil), triée par date ;
   `resumeSession(profileId, session)` : crée l'enregistrement (`sessionId`, dossier, titre de
   l'agent) et l'ouvre — le rejeu existant (`session/load`, fiche 015) fait le reste.
3. Profil d'OpenCode : `emptySessionTitle` ; `capabilities.ts` : `list` annoncé, repère
   `hidden-empty-sessions` ; `docs/agents.md`.
4. IPC `agent:listSessions`, `conversation:resumeSession` ; preload.
5. Interface (choix de l'utilisateur) : fenêtre « Reprendre une session… » (`ResumeDialog`),
   ouverte par le menu Fichier et par le menu « … » de « Récents ». Agent (ceux qui annoncent
   `session/list`), « Ce dossier » ou « Tous », filtre texte ; sessions groupées par dossier, avec
   leur date ; « Reprendre ».
6. Agent factice : sessions mémorisées dans `--store` déjà listées ; scénario d'essai.
7. Tests : manager (liste, filtres, reprise, doublon), `agent-process`, e2e, captures.

## Journal

- 2026-10-14 — Fiche créée ; relevé de `session/list` sur Bob et OpenCode (sans prompt, 0 bobcoin).
- 2026-10-14 — Fait. `session-list.ts` (+ tests), lanceur `spawnAgent` partagé avec `AgentHost`,
  `agentSessions` / `resumeSession` (+ tests contre l'agent factice), IPC, `ResumeDialog` (menu
  Fichier ⇧⌘O et menu de « Récents »), profil d'OpenCode `emptySessionTitle`, `session/list` dans
  « Annoncé par l'agent » (absent d'une annonce retenue avant la fiche : non affiché). e2e
  `resume` : session du dossier seule, tous les dossiers groupés, filtre, reprise rejouée, on
  continue, plus proposée ensuite ; captures `h0`, `h1` (clair, sombre).
  Écarts au plan : (1) OpenCode 1.19 ne liste sans dossier que les sessions hors dépôt git :
  « Ce dossier » demande la liste sans dossier et le dossier, « Tous les dossiers » demande aussi
  chaque dossier connu de l'app (récents, historique, 30 au plus) ; (2) un agent compare le texte
  du chemin (`/var` contre `/private/var`) : le dossier est aussi demandé sous son chemin réel, et
  l'app compare les chemins réels. Bouton principal désactivé grisé dans toute l'app.
  **Essais réels** (aucun message envoyé, 0 bobcoin) : Bob 2.0.6 — 43 sessions, 11 dossiers ;
  reprise de la session du sous-agent de la fiche 053 : échange et carte « Sous-agent » rejoués.
  OpenCode 1.19 — tous les dossiers : 32 sessions proposées sur 62 (vides et dossiers disparus
  masqués) ; dans ce dépôt, « Ce dossier » : seule « Test de commandes et site web » (6 vides
  masquées), reprise : 3 messages et 4 outils rejoués. Chaque essai OpenCode a ouvert une session
  vide de plus chez OpenCode (l'app en ouvre une avant le premier message), masquée par le filtre.
