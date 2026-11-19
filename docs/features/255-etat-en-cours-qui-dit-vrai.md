# 255 — Un état « en cours » qui dit vrai (sous-agents en arrière-plan, bilan par tour)

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 053 (suivi des sous-agents), 122 (sous-agent en arrière-plan), 156 (durée du
  tour), 185 (bilan du tour), 194 (bandeau de silence), 232 (OpenCode 2.3.0 : réponse hors tour)
- **Agents** : les deux — le défaut a été vu avec OpenCode 2.3.0 (sous-agents toujours en
  arrière-plan, réponse hors tour), mais le correctif est générique : il s'appuie sur ce que
  l'app sait déjà de tout agent (carte de sous-agent en arrière-plan reconnue par le profil,
  `subagentStream.background` ; mises à jour reçues hors de tout tour) et ne suppose rien de Bob.
  Aucun cas « opencode » dans l'UI ni dans l'hôte (ADR-0011).

## Pourquoi

Exploration du 2026-11-19 avec OpenCode 2.3.0 et GPT-6.1 Sol
([rapport](../recettes/2026-11-19-exploration-opencode-sol.md), constats D1, D5, D13, D34 ; c'est la
plainte n° 1 de Jérôme) :

- **D1** : un sous-agent travaille 1 à 2 min en arrière-plan ; le tour ACP du parent finit en
  ≈ 10 s. Bobine dit « Terminé en 10 s », « OpenCode Prêt », aucune pastille « en cours ». La
  réponse du parent arrive ensuite hors tour et le bilan ne bouge plus.
- **D5** : avec un message en file, seul le dernier tour garde son bilan (un tour de 1 min 30
  remplacé par « Terminé en 4 s »).
- **D13** : la durée compte le temps passé à attendre la décision de l'utilisateur (carte de
  propositions, question) ; le bilan s'affiche sous « Sous-tâches · 2 en cours ».
- **D34** : le bilan reste collé en bas du fil, sous des cartes arrivées après lui.

## Contrat observé (journal ACP réel, `explo-sol-traces/agents.log`, OpenCode 2.3.0)

Journal « Détaillé » de la session (les morceaux de texte y sont regroupés, « ×N », et écrits à
l'évènement suivant : l'heure d'une réponse hors tour se lit par la relecture du sous-agent qui la
suit, voir plus bas). Trois tours avec un sous-agent, même forme à chaque fois :

| Heure (UTC) | Conversation | Observé |
|---|---|---|
| 19:37:02 | `f5dfb69d` (mère) | `tool_call` « subagent » `think` `pending` |
| 19:37:05,6 | | `tool_call_update` `in_progress` (deux fois, `rawInput` : agent, description, consigne), puis aussitôt `completed` (`rawOutput.metadata.status: "running"`, fiche 232) |
| 19:37:08,5 | | `tool_call` « Inventaire des endpoints REST: shell » `pending`, `_meta["opencode/child-session"]` : le travail du sous-agent relayé tant que le tour dure — jamais fini ici |
| 19:37:09,3 | | `agent_message_chunk` ×3 (158 car.), `usage_update`, **`end_turn` en 10,0 s** |
| 19:37:11 → 19:38:22 | (relectures) | la session du sous-agent relue par `session/load` (2, 3, 5, 8, 13, 20 s…) : il travaille encore |
| ≈ 19:38:2x | `f5dfb69d` | réponse du parent **hors tour** (446 car., deux `agent_message_chunk` au rechargement de 19:45) : **aucun `tool_call_update`** sur la carte, **aucun `usage_update`**, **aucune fin de tour** |
| 19:38:22 → 19:38:26 | (relectures) | relecture avancée par la parole hors tour (`nudge`, fiche 232) : deux relectures à 4 s d'intervalle, la même réponse finale du sous-agent → fin du sous-agent vue par l'app |

Mêmes séquences à 19:25:09 (mère `96a5bee1`, `end_turn` en 13,2 s, sous-agent fini vers 19:27:10,
réponse hors tour de 1099 car.) et à 19:41:14 (`end_turn` en 11,2 s ; l'utilisateur envoie un
autre message à 19:41:36, tour de 4,3 s, **pendant** que le sous-agent travaille encore ; il finit
vers 19:42:06, réponse hors tour de 554 car.). Les relevés de la sonde (fiche 232,
`__traces__/opencode-2.3.0/sous-agent*.ndjson`, heures exactes) donnent le même ordre : la réponse
hors tour commence 1 à 4 s après la fin du sous-agent, s'écrit en 1 à 2 s, et deux sous-agents
donnent deux réponses hors tour.

Ce qu'il faut en retenir :

1. La fin de tour ACP (`end_turn`) n'est **pas** la fin du travail : rien dans le protocole ne dit
   quand l'agent a fini de travailler hors tour. L'app le sait seulement par ses propres moyens :
   la carte de sous-agent en arrière-plan reste « en cours » jusqu'à ce que sa session relue soit
   finie (fiche 122), et l'agent qui parle hors tour est vu (fiche 232).
2. La réponse hors tour arrive en général **avant** que l'app ne voie la fin du sous-agent (c'est
   elle qui avance la relecture), parfois juste après.
3. Aucune fin explicite de la réponse hors tour : seul le silence la marque.

## Cause dans Bobine

- L'état « en cours » (indicateur, pied de la barre latérale, pastille de la conversation) ne
  suivait que le statut de l'hôte, `busy` du `session/prompt` au `end_turn`.
- Le bilan (`lastTurnFacts`) prenait la réponse qui a fini le tour ACP et écartait exprès la
  réponse hors tour (fiche 232) ; il ne regardait que le dernier tour, et s'affichait en bas du fil.
- La durée (`turnDurations`) allait de l'envoi à la fin de la réponse, attente de l'utilisateur
  comprise.

## Décisions

- **« En cours » après le tour** (évènement `background-work`, drapeau `backgroundWork` du fil et
  de la conversation listée) : vrai tant qu'au moins un sous-agent en arrière-plan de la
  conversation travaille, puis tant que
  l'agent parle hors tour, et jusqu'à **5 s de silence** après la dernière de ces activités (fin
  d'un sous-agent ou parole hors tour). Les 5 s couvrent la réponse attendue après la fin d'un
  sous-agent (1 à 4 s observées, quand elle n'est pas déjà arrivée) et la fin de son écriture.
  Une réponse plus tardive remet la conversation « en cours » le temps qu'elle s'écrive : c'est
  vrai, l'agent écrit. Aucune attente sans borne : un agent qui ne répond jamais ne laisse pas la
  conversation « en cours » pour toujours.
- Pendant ce temps l'agent reste **prêt** : un message part tout de suite (pas en file), comme
  OpenCode le permet (vu à 19:41:36). Pas de bouton Stop : `session/cancel` n'arrête pas un
  sous-agent en arrière-plan.
- **Fin du travail** : quand il retombe, l'hôte émet `background-work` (`active: false`) avec
  l'heure de la dernière parole hors tour ; les réponses hors tour du dernier tour en reçoivent
  l'heure **si ce tour a lancé un sous-agent en arrière-plan** (sinon elles restent hors tour, comme en 232 :
  après un autre message, le rapport n'allonge pas le tour de ce message).
- **Durée du bilan = temps de travail de l'agent** : de l'envoi du message à la fin de sa dernière
  réponse du tour (réponse hors tour comprise, ci-dessus), **moins le temps passé à attendre
  l'utilisateur** (autorisation, question, propositions de filles, toute demande de l'app). Cette
  attente est **affichée à part** dans le bilan dès qu'elle atteint 1 s : « Terminé en 31 s ·
  40 s à vous attendre ». La durée courte à côté de l'heure de la réponse (fiche 156) est la même.
- **Un bilan par tour**, sous la réponse qui finit ce tour (plus en bas du fil) ; celui du dernier
  tour quand l'agent ne travaille plus du tout (ni tour, ni travail après le tour) ; jamais sous
  un tour dont un sous-agent en arrière-plan travaille encore. Coût du tour : le tour de la
  consommation fini entre ce message et le suivant.
- Les **filles** (Sous-tâches) restent des conversations à part avec leur propre état : la mère
  dont le tour est fini est prête, son bilan est donné ; il se lit maintenant sous sa réponse, pas
  sous la carte.

## Critères d'acceptation

- [x] Tant qu'un sous-agent en arrière-plan travaille, ou que l'agent parle hors tour (et 5 s
      après), l'indicateur sous le fil, le pied de la barre latérale et la ligne de la
      conversation disent « en cours » ; le message suivant part tout de suite.
- [x] Le bilan du tour n'apparaît qu'à la fin de ce travail, sa durée va jusqu'à la fin de la
      réponse hors tour.
- [x] Chaque tour garde son bilan, sous sa réponse ; un tour arrêté ou en échec n'en a pas.
- [x] La durée exclut l'attente de l'utilisateur, affichée à part.
- [x] Agent factice : scénario qui rejoue la séquence réelle du 2026-11-19 ; tests unitaires
      (hôte, fil, durée, bilan, ligne de la barre latérale).
- [x] e2e `subagents` complétée (bilan après la réponse hors tour, « en cours » pendant).

## Plan

1. Fiche (ce plan), index.
2. **Main** — `src/main/agent/background-work.ts` (nouveau) : sous-agents en arrière-plan en cours
   (ce que voit le suivi), parole hors tour, fenêtre de 5 s ; évènement `background-work` au
   début, et à la fin avec l'heure de la dernière parole hors tour. Tenu par le suivi des
   sous-agents (`subagent-tracker.ts` : `subagent-run`, `nudge`, `reset`), pour que
   `agent-host.ts`, partagé avec d'autres lots et plafonné à 1050 lignes, ne change presque pas.
3. **Partagé** — évènement `background-work` ; `TranscriptState.backgroundWork` (posé, retiré à la
   fin ou quand l'agent n'est plus prêt ni occupé) ; `shared/turn-stamps.ts` (nouveau :
   `turnStart`, `stampReplies` sortis de `transcript.ts`, plafonné à 800 lignes, et la fin du
   travail qui date la réponse hors tour) ; `askedAt` / `answeredAt` des demandes (autorisation,
   question), datées par `pending-requests.ts` ; `turn-duration.ts` : temps de travail et attente
   par tour (`turnTimes`).
4. **Liste** — `helpers.ts` (`summaryOf` : `ConversationSummary.backgroundWork`, agent prêt),
   `manager.ts` (liste réémise à `background-work`).
5. **Renderer** — `TurnFooter` / `WorkingIndicator` (le sous-agent en cours ou « Travaille après le
   tour… », temps depuis l'envoi), `BesidePane`, pied de la barre latérale (« Travaille
   encore… », point orange, classe `ready` gardée), `conversation-state.ts` (ligne « En cours »),
   `Transcript.tsx` + `TurnSummary.tsx` (`turnFacts` : un bilan par tour, sous sa réponse, attente
   à part), `App.tsx`.
6. **i18n** : `activity.background`, `sidebar.status.background`, `turnSummary.waited` (fr, en).
7. **Agent factice** : scénario `sous-agent-hors-tour-explo-2-3` (séquence réelle de 19:37, et un
   message « où en est » pendant le travail, comme à 19:41:36).
8. **Tests** : `background-work.test.ts`, `agent-host-background.test.ts` (hôte contre l'agent
   factice), fil (`subagent-background.test.ts`), durée, bilan, indicateur, barre latérale,
   `summaryOf`, `pending-requests` ; e2e `subagents` complétée (non lancée ici).
9. Docs (`acp.md` : OpenCode 2.3.0 et Compatibilité Bob ; `architecture.md` ; `mock-agent.md`),
   changelogs.

Aucune nouvelle dépendance ; pas d'ADR (aucun choix structurant : un état dérivé de ce que l'app
voit déjà, un évènement de fil).

## Journal

### 2026-11-19

- Trace réelle étudiée (voir « Contrat observé »), plan écrit.
- Premier jet : drapeau dans l'instantané de l'hôte (`AgentSnapshot.backgroundWork`). Abandonné :
  `agent-host.ts` (1049 lignes comptées sur 1050), `manager.ts` (1050/1050) et `transcript.ts`
  (793/800) dépassaient leur plafond ESLint, qu'on ne remonte pas (fiche 089). Le travail après le
  tour est donc un évènement du fil, tenu par le suivi des sous-agents ; `agent-host.ts` gagne
  même une ligne (l'émission de `subagent-run` passe dans `subagentTrackerOptions`), `manager.ts`
  ne change que d'une condition, `transcript.ts` perd `turnStart` et `stampReplies` (déplacés dans
  `turn-stamps.ts`).
- La liste est réémise à chaque `background-work` par la même branche que `user-message` et
  `turn-end`, qui marque aussi l'activité (`updatedAt`) : la réponse hors tour est une activité de
  la conversation, comme une fin de tour.
- Chaque lancement de sous-agent en arrière-plan réannonce le travail (même déjà en cours) : un
  fil qui l'aurait oublié (agent relancé après un plantage, statut passé par « démarre ») le revoit.
- Tests : unitaires (fenêtre de silence, deux sous-agents, fin pendant un tour, arrêt), hôte de
  bout en bout contre l'agent factice (la réponse hors tour datée finit le tour ; un message
  envoyé pendant le travail part tout de suite et n'est pas allongé par le rapport ; arrêt), fil,
  durée (attente retirée, chevauchements), bilan par tour (D5, D34), indicateur et barre latérale.
  e2e `subagents` complétée (« en cours » pendant le travail, bilan sous la réponse hors tour à la
  fin), **non lancée** : à lancer par le tech lead.

### Écarts et doutes

- **Notification « a fini »** : elle part toujours à la fin du tour ACP (`attention.ts`, fin de
  tour), même si l'agent travaille encore ; la ligne de la barre latérale dit pourtant « En
  cours » (l'état « en cours » passe avant « Réponse à lire »). Retarder la notification touche
  aux notifications : hors du périmètre, à décider.
- **Filles** : une fille dont le sous-agent travaille après son tour est « En cours » dans la
  liste, mais `childState` (carte Sous-tâches, réveil de la mère, compte des filles actives) ne
  regarde que le statut de l'agent ; la mère peut être réveillée avant le rapport. Pas touché :
  le lot « états des filles » travaille en parallèle sur `children.ts`.
- **Mon activité** (« travail d'agent ») ne retire pas l'attente de l'utilisateur et ne compte
  pas la réponse hors tour : calculé ailleurs, hors périmètre.
- **5 s** : choisi sur les relevés (réponse 1 à 4 s après la fin du sous-agent, écriture en 1 à
  2 s). Une réponse plus tardive remet la conversation « en cours » le temps qu'elle s'écrive, et
  le bilan se recalcule ensuite ; l'ancienne durée s'affiche entre les deux.
- **Demande retirée par l'agent** (`$/cancel_request`) : la carte disparaît (fiche 214) et son
  attente avec ; elle compte alors dans la durée (rare).
- Le journal réel (« Détaillé ») regroupe les morceaux de texte et les écrit à l'évènement
  suivant : l'heure exacte de la réponse hors tour ne s'y lit pas ; elle est déduite des
  relectures du sous-agent qui l'encadrent et des relevés exacts de la fiche 232.
