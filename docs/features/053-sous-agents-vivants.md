# 053 — Sous-agents vivants : durée, coût en direct, travail rejoué

- **Statut** : fait
- **Dépend de** : 010, 054
- **Agents** : les deux (durée) ; Bob (coût en direct : seul à l'écrire, dans sa base) ; OpenCode
  (travail rejoué : seul à garder la session du sous-agent) — ADR-0011

## Pourquoi

Une carte « Sous-agent » ne bouge pas tant que le sous-agent travaille : on ne sait ni depuis
combien de temps il tourne, ni combien il coûte. Bob IDE affiche le coût de chaque sous-agent en
direct. Bob l'écrit dans sa base locale à chaque dépense ; OpenCode ne l'envoie pas par ACP.

## Critères d'acceptation

- [x] Carte « Sous-agent » en cours : durée qui défile ; terminée : durée finale.
- [x] Bob : coût du sous-agent en bobcoins dans l'en-tête de la carte, mis à jour pendant qu'il
      travaille, final à la fin. Lu en lecture seule dans la base de Bob ; la moindre surprise donne
      « pas de coût », jamais d'erreur.
- [x] Déclaré dans le profil de Bob, listé sous « Propre à IBM Bob » (fiche 054) et dans
      `docs/agents.md`.
- [x] OpenCode : « Voir son travail » sur une carte terminée rejoue la session du sous-agent
      (`ses_…`) dans un agent à part, en lecture seule, sans appel au modèle ; déclaré dans le
      profil d'OpenCode, listé sous « Propre à OpenCode ».
- [x] Testé contre l'agent factice (scénarios `sous-agent-bob`, `sous-agent-opencode`).

## Plan

1. **Durée (les deux)** : `main/agent/subagent-tracker.ts` (nouveau) suit les sous-agents vus en
   direct (pas au rejeu) : début au premier `in_progress`, fin à `completed` / `failed` ou à la fin
   du tour. Évènement `subagent-run` (`shared/agent.ts`) ; le fil garde `subagentRun` (début, fin,
   coût) sur la carte (`shared/transcript.ts`), donc aussi dans l'historique.
2. **Coût de Bob** : `readBobSubagents(parent)` (`bob-costs.ts`) lit les lignes `subagent` de la
   conversation ; le suivi relit toutes les 2 s tant qu'un sous-agent travaille, une dernière fois
   à la fin (et 1,5 s après), et relit aussi le coût de la conversation. Ligne ↔ carte : même
   consigne (titre de la ligne = consigne de Bob), sinon ordre de création après le début de la
   carte ; sinon pas de coût. Profil : `subagentCosts: 'bob-db'`.
3. **Travail d'un sous-agent OpenCode** : identifiant `ses_…` lu dans la réponse
   (`shared/subagent.ts`) ; `ConversationManager.subagentWork` lance un agent à part, `initialize`
   puis `session/load`, construit le fil rejoué avec le réducteur partagé, arrête l'agent. Profil :
   `subagentReplay: true`. Affiché dans la carte dépliée (« Voir son travail »).
4. `capabilities.ts` + `docs/agents.md` : repères `subagent-cost-bob-db`, `subagent-replay`.
5. `ToolCall.tsx` : durée qui défile et coût dans l'en-tête de la carte ; travail du sous-agent.
6. Agent factice : `--bob-db` (écrit les lignes de Bob pendant `sous-agent-bob`), session enfant
   rechargeable pour `sous-agent-opencode`.
7. Tests : suivi (horloge et lecteur factices), `readBobSubagents`, réducteur, e2e `subagents`
   (durée, coût qui monte, travail d'OpenCode), captures clair / sombre.

Pas de nouvelle dépendance.

## Journal

- 2026-10-14 — Fiche créée. Relevé dans Bob 2.0.6 : chaque sous-agent a sa ligne dans
  `~/.bob/db/bob.db` (`parent_id` = tâche de la conversation, `task_type: subagent`, titre = la
  consigne), dont `costs` est réécrit à chaque dépense ; Bob ne garde pas les
  messages du sous-agent (aucun dans `messages`).
- 2026-10-14 — Essai réel OpenCode 1.19.0 (modèle gratuit `big-pickle`, 0 bobcoin) : l'outil
  `task` arrive en `pending` (titre `task`, `rawInput` vide), puis `in_progress` avec la consigne,
  puis `completed`. La session enfant (`ses_…`, dans la réponse) se recharge par `session/load`
  depuis un autre processus : consigne, outil `read`, réponse rejoués. `session/list` ne montre
  pas les sessions enfants. Bob ne garde pas les messages de ses sous-agents : pas de rejeu possible.
- 2026-10-14 — Fait. `subagent-tracker.ts` (+ tests à horloge factice), `readBobSubagents`,
  évènement `subagent-run` et `subagentRun` sur la carte, `session-replay.ts` et
  `ConversationManager.subagentWork` (IPC `conversation:subagentWork`), durée et coût dans
  l'en-tête de la carte, « Voir son travail » (outils du sous-agent en cartes, sa réponse non
  répétée). Profils : `subagentCosts: 'bob-db'` (Bob), `subagentReplay` (OpenCode), listés sous
  « Propre à … » (fiche 054) et dans `docs/agents.md`. Agent factice : `--bob-db` (jamais la vraie
  base : seulement sous `BOB_DESKTOP_CONFIG_HOME`), étapes `bob-subagent` et `child-session`.
  Bob 2.0.6 devrait envoyer `in_progress` une fois le lancement autorisé (non vérifié) ; rejeu réel
  d'une session de sous-agent OpenCode par `replaySession` (lecture et réponse rejouées, 0 appel au
  modèle). Essai réel du coût en direct avec Bob : voir l'entrée suivante. e2e `subagents` : coût 0,0021 pendant le travail puis
  0,0058, travail rejoué ; captures `g1`, `g2` regardées (clair, sombre).
- 2026-10-14 — **Essai réel avec Bob 2.0.6** (à la demande de l'utilisateur ; dossier
  `~/bob-essai/sous-agent-053`, trois fichiers `.txt`, app de dev avec la vraie base de Bob) : un
  sous-agent `explore` lancé après « Allow once ». Carte : durée qui défile (1 s → 7 s), coût relu
  en direct 0,0029 → 0,006 → 0,0094 bobcoin, final = ligne de Bob (`0.00935`, titre = consigne,
  rattachée par la consigne) ; coût de la conversation 0,0801 = tâche 0,0707 + sous-agent 0,0094.
  Corrigé au passage : l'indicateur sous le fil montrait le titre brut de Bob (« Running subagent:
  … ») et sa durée passait à la ligne ; il reprend le libellé de la carte (« Sous-agent : … »),
  sans ponctuation en double. Coût de l'essai : 0,080 bobcoin.
