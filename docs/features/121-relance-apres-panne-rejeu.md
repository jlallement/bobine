# 121 — Relance après panne : le rejeu tardif n'est plus fondu dans le tour (D21)

- **Statut** : fait (essai réel Bob à faire : scène 2.7 du PV)
- **Dépend de** : 103 (fil durable, ADR-0021), 041 (stabilisation, « Relancer »), 015 (rejeu
  tardif de Bob), 080 (journal)
- **Agents** : les deux. Rien de propre à un agent : l'attente porte sur tout rejeu de
  `session/load` quand le fil de l'app est gardé ; Bob 2.0.6 est celui qui rejoue **après** sa
  réponse (`docs/acp.md`), d'où le défaut.

## Pourquoi

Recette du 2026-10-23, scène 2.7 (D21, majeur) : après une panne de Bob (`kill -9` en plein tour),
le message suivant relance l'agent (`session/load`, fil gardé) et part aussitôt. Le rejeu de Bob,
qui arrive **après** la réponse à `session/load`, tombe alors dans le tour vivant : bulles de
l'utilisateur perdues, textes collés (« pongpong 2 »), cartes de plan aplaties, compteurs de diff
doublés, et le fil durable l'enregistre pour toujours. Au ⌘Q puis réouverture, l'utilisateur écrit
bien après le rejeu : le fil est fidèle. Il faut que la relance se comporte comme le ⌘Q.

## Critères d'acceptation

- [x] À la relance avec fil gardé, un message envoyé tout de suite ne part qu'une fois le rejeu de
      `session/load` arrivé et calme (300 ms sans mise à jour), même s'il arrive après la réponse.
- [x] Le rejeu est réconcilié avec le fil gardé (`replayed`, fiche 103), jamais fondu dans le tour :
      fil après relance = fil d'avant + le nouvel échange, sans doublon ni texte collé.
- [x] Attente bornée à 2 s : au-delà, le message part quand même et le journal le dit (`WARN`).
- [x] Inchangé : ⌘Q puis réouverture (rejeu déjà calme, aucune attente), fil non gardé (le rejeu
      refait le fil), `session/resume` (pas de rejeu), session perdue (nouvelle session).
- [x] Testé contre l'agent factice : option `--rejeu-tardif-ms <ms>` (rejeu commencé N ms après la
      réponse à `session/load`, comme Bob 2.0.6), test de l'hôte « fil gardé, rejeu tardif, message
      envoyé immédiatement ».
- [ ] Rejoué avec le vrai Bob : scène 2.7 du PV (`kill -9` en plein tour, message aussitôt).

## Plan

1. Agent factice (`src/mock-agent/agent.mts`, `main.mts`, `docs/mock-agent.md`) : `--rejeu-tardif-ms
   <ms>` retarde le rejeu tardif (implique `--rejeu-tardif`).
2. Test rouge (`src/main/agent/agent-host.test.ts`) : fil gardé, rejeu tardif de 150 ms, `prompt()`
   dès `start()` fini → aujourd'hui le rejeu est fondu dans le tour.
3. `ReplayBuffer` (`replay-buffer.ts`) : `expect()` arme l'attente d'un rejeu, `settled(maxMs)` se
   résout quand le rejeu a été entendu puis s'est calmé (ou `false` au bout du délai) ; `clear()`
   et `finish()` désarment. Le calme « sans rien entendu » ne compte pas : le rejeu de Bob peut
   commencer plus de 300 ms après la réponse. `loaded()` (réponse à `session/load`) : un rejeu déjà
   entendu était complet avant la réponse (ACP : OpenCode, agent factice) → rien à attendre.
   `waitCalm(maxMs, scope)` attend et journalise.
4. `AgentHost` (`agent-host.ts`) : `reopenRequest` arme l'attente (`session/load` + fil gardé) ;
   session perdue → désarmée ; `prompt()` attend `waitCalm(2 s)` pendant la préparation du message
   (un autre message attend dans la file), vérifie que l'agent est toujours le même et prêt, puis
   réconcilie comme avant (`finish()`). Délai `TIMEOUTS.replayWaitMs` (remplaçable en test).
5. Doc : `docs/acp.md` (ligne « Stop / panne »), `CHANGELOG.md`, `CHANGELOG.en.md`, cette fiche.

## Journal

- 2026-10-23 — Fiche créée (D21 de la campagne de recette, `docs/recettes/2026-10-23-recette-bob.md`).
- 2026-10-23 — **Test rouge d'abord** : avec `--rejeu-tardif-ms 150` et un tour assez long
  (`--delay 40`), le message envoyé dès `start()` reçoit le rejeu dans sa réponse (texte de la
  réponse rejouée collé 3 fois, aucun `replayed`) : D21 reproduit sans Bob.
- 2026-10-23 — Correction faite (plan 1 à 5). **Écart au plan** : la première version attendait
  aussi le calme d'un rejeu fait **pendant** `session/load` (OpenCode, agent factice par défaut) :
  ≤ 300 ms de plus avant le message, qui a cassé `manager.test.ts` « « Relancer » garde la file
  d'attente ». D'où `loaded()` : un rejeu entendu avant la réponse est complet, rien à attendre ;
  seul le rejeu tardif (Bob) retient le message. `agent-host.ts` restait sous son plafond de lignes
  (1050) en mettant l'attente journalisée dans `ReplayBuffer.waitCalm`.
- 2026-10-23 — Tests : hôte (rejeu tardif + message immédiat ; rejeu qui ne vient pas, attente
  bornée ; rejeu déjà calme comme au ⌘Q, sans attente), `ReplayBuffer` (4 cas d'attente).
  `./scripts/verify` vert (1464 tests). `pnpm build && pnpm e2e --changed` (110 passages, quasi
  toute la suite : `agent-host.ts` est partagé) : vert sauf `base light` et `handover light`,
  instables (menus de modèle et d'agent qui ne s'ouvrent pas à temps) : rejoués seuls, verts une
  fois sur trois à deux sur trois ; `handover` échoue de même sur `main` (1 sur 3) ; ces chemins
  (sessions neuves) ne passent pas par l'attente. Suite `restart` verte ; captures de reprise
  regardées.
- **Reste à faire** : rejouer la scène 2.7 avec le vrai Bob (`kill -9` en plein tour, message
  aussitôt, puis ⌘Q et réouverture) : fil identique au direct (bulles, cartes de plan, lignes de
  sous-agents, compteurs `+N −M` non doublés) ; le journal donne le délai réel du rejeu tardif
  (« Rejeu de la session calme … après … »). Si Bob commence son rejeu plus de 2 s après sa réponse,
  le `WARN` « pas calme » le dira et il faudra revoir le délai.
