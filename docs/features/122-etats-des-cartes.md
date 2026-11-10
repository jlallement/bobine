# 122 — L'état d'une carte dit vrai : refusé, échec, sous-agent en arrière-plan

- **Statut** : fait (à rejouer avec un vrai agent : scènes 1.3, 2.5, 4.4)
- **Dépend de** : 010, 029, 032, 047, 053, 072, 078, 079, 117
- **Agents** : les deux pour les états « refusé » et « échec » ; OpenCode pour deux lectures de son
  format, déclarées dans son profil (ADR-0011, ADR-0015) : l'erreur d'un outil appelé par son
  `execute` (`rawOutput.metadata.toolCalls[]`) et le sous-agent lancé en arrière-plan
  (`rawOutput.metadata.status: "running"`).

## Pourquoi

La recette de la 0.4.0 (PV OpenCode et Bob du 2026-10-23) a trouvé des cartes du fil qui mentent sur
leur état, au point même qu'elles doivent montrer :

- **D5** : un outil de Bobine refusé par l'utilisateur (« Refuser » sur la commande du terminal)
  rend un texte ordinaire ; OpenCode le dit « completed » et la carte est cochée verte. Avec Bob,
  un refus est en rouge mais dit « échec », pas « refusé ».
- **D17** : `android_build` d'un projet Flutter réussit sous Gradle, mais l'outil cherche l'APK sous
  `android/…/build/outputs/apk` (Flutter l'écrit sous `<racine Flutter>/build/app/outputs/…`) :
  carte « Build failed » qui contient « BUILD SUCCESSFUL ». L'erreur d'`adb install` est coupée à sa
  première ligne (« adb: failed to install …apk: », sans la raison). Avec OpenCode 2, les outils de
  Bobine appelés par son outil `execute` portent leur erreur dans `rawOutput.metadata.toolCalls[]`
  (`status: "error"`), mais la carte reste verte.
- **D12** (majeur) : les sous-agents qu'OpenCode 2 lance en arrière-plan rendent leur outil tout de
  suite (`metadata.status: "running"`, texte « The subagent is working in the background… ») : la
  carte « Sous-agents » les dit « fini, < 1 s », sans résultat, alors qu'ils travaillent encore ;
  leur rapport final n'arrive jamais dans la carte.

## Critères d'acceptation

- [x] « refusé » et « échec » sont des états à part entière d'une carte d'outil (icône et mot, clair
      et sombre), comptés à part dans les groupes et la carte « Sous-agents ».
- [x] Un outil de Bobine refusé par l'utilisateur rend un résultat `isError` (l'agent sait que ça
      n'a pas tourné) et sa carte est « refusé », quel que soit l'agent ; un outil de Bobine en
      erreur (résultat `isError` ou exception) a sa carte « échec », même si l'agent la dit finie.
- [x] Une autorisation refusée par l'utilisateur (option `reject_*`) donne aussi « refusé », pas
      « échec » (Bob) ni ✓ (OpenCode).
- [x] `android_build` : Gradle réussi sans APK trouvé → « Build succeeded in N s, but no APK
      under … » (dossiers cherchés), carte non rouge ; l'APK d'un projet Flutter est cherché aussi
      sous `../build/app/outputs/flutter-apk` (et `../build/app/outputs/apk`) relatif au projet
      Gradle, et trouvé quand il existe.
- [x] Les erreurs d'`adb` (dont `adb install`) arrivent entières à l'agent et dans la carte.
- [x] OpenCode : une carte `execute` dont `rawOutput.metadata.toolCalls[]` porte `status: "error"`
      (ou `isError`, ou `metadata.error: true`) est « échec », en direct comme au rejeu ; la sonde
      `pnpm opencode-probe` contrôle que les appels d'outils de l'app ont bien ce `status`.
- [x] Sous-agent en arrière-plan (OpenCode 2) : ligne « en cours » sans durée finale tant que sa
      session n'a pas fini, même après la fin du tour ; quand elle finit, la ligne passe « fini »
      avec sa durée et sa réponse finale (« Réponse »), lue en rejouant sa session comme « Voir son
      travail ». « Voir son travail » pendant qu'il tourne montre l'état du moment (pas de cache).
- [x] L'interface ne connaît que des états génériques ; ce qui est propre à OpenCode reste dans
      `opencode-contract.ts` et son profil, listé dans Réglages › Agents et `docs/agents.md`.
- [x] Testé contre l'agent factice : scénarios `terminal-refus` (outil de Bobine refusé),
      `outils-execute-erreur` (erreur dans `toolCalls[]`), `sous-agent-arriere-plan` (sous-agent
      qui finit après son outil, puis après le tour) ; e2e touchés verts, captures regardées.

## Plan

**États génériques (fil partagé, renderer)**
- `shared/transcript.ts` : `status` d'une carte gagne `'refused'` ; champ `outcome?: 'refused' |
  'failed'` posé par l'app (événement `tool-outcome`, autorisation refusée) : il l'emporte sur la
  fin dite par l'agent, et sur « interrompu » en fin de tour. Événement `tool-outcome` dans
  `shared/agent.ts`.
- `ToolCall.tsx`, `SubagentsCard.tsx`, `shared/tool-groups.ts` : état « refusé » (icône `Ban`
  barrée… choisie à l'écran), comptes ; clés `toolCall.state.refused`, `toolCall.subagents.refused`
  (fr / en).

**D5 — outils de Bobine refusés ou en erreur**
- `mcp/tools.ts` : `ToolResult.refused?: true`, `refusedResult(text)` ; `mcp/command-approval.ts` :
  refus → `refusedResult` (avec `isError`) ; `mcp/tool-server.ts` : `refused` retiré avant l'envoi.
- `agent/app-tools-bridge.ts` : après l'appel, `tool-outcome` (`refused` / `failed`) pour la carte
  reliée (orphelins compris, à l'adoption).
- Agent factice : scénario `terminal-refus` (`terminal_run` refusé).

**D17 — Android**
- `android/gradle.ts` : `findBuiltApk` cherche aussi les dossiers de Flutter ; job réussi sans APK
  reste réussi (`apkSearched`) ; `android-tools.ts` : texte « Build succeeded … but no APK under ».
- `android/adb.ts` : message d'erreur entier (lignes non vides, borné).

**D5 OpenCode — `execute`**
- `agent/adapters.ts` : point d'extension `ToolStatusSource` (`id`, `failed(update)`) ;
  `opencode-contract.ts` : `OPENCODE_TOOL_STATUS` (lit `rawOutput.metadata.toolCalls[]`) ; profils
  OpenCode et factice ; `agent-host.ts` : statut `failed` appliqué à la mise à jour ;
  `capabilities.ts` + `docs/agents.md` : repère `inner-tool-errors`.
- Sonde : `opencode-probe` observe le `status` des `toolCalls[]` de l'outil de l'app.
- Agent factice : scénario `outils-execute-erreur`.

**D12 — sous-agents en arrière-plan**
- `adapters.ts` : `SubagentStream.background?(update)` ; `opencode-contract.ts` : `metadata.status
  === "running"`.
- `shared/subagent.ts` : `SubagentRun.background`, `answer`, `lost`. Réducteur : `background` sans
  fin → carte « en cours » ; fin → « fini » ; `lost` → « interrompu » ; la fin du tour ne le ferme
  pas (la sortie de l'agent, si).
- `agent/subagent-tracker.ts` : sous-agent détaché suivi après le tour, sa session relue
  (`follow`) à intervalle croissant ; fini quand le rejeu se termine par une réponse, sans outil en
  cours, deux fois de suite ; réponse émise avec la fin. `agent-host.ts` : option
  `loadSubagentWork` ; `conversations/manager.ts` : la fournit (`SubagentWorks`, sans cache tant
  qu'il tourne).
- `SubagentsCard.tsx` : la « Réponse » est la réponse finale quand elle est connue ; rien tant
  qu'il tourne (pas le texte d'attente de l'agent).
- Agent factice : scénario `sous-agent-arriere-plan` (session fille qui finit après un délai).

Pas de nouvelle dépendance. Pas d'ADR : deux points d'extension de plus dans le cadre de
l'ADR-0015.

## Journal

- 2026-10-23 — Fiche ouverte (lot validé par Jérôme avant la 0.5.0). Relevés dans le journal de la
  campagne (`agents.log`) : `toolCalls: [{ tool: "bobine.preview_start", status: "error" }]`,
  `error: true` ; sous-agent en arrière-plan : `metadata: { sessionID, status: "running" }`, outil
  jamais mis à jour ensuite, même au rejeu ; OpenCode n'envoie rien après la fin du tour (le
  parent reprend seul sans flux ACP) ; le rejeu de la session fille finie se termine par son
  rapport, celui d'une session qui tourne par des outils.
- 2026-10-23 — **D5 fait.** État `refused` et champ `outcome` dans le fil partagé ; événement
  `tool-outcome` émis par le pont des outils de l'app (résultat `refused` / `isError`, erreur
  levée, appel rattaché plus tard par le code d'`execute`) ; une autorisation refusée (`reject_*`)
  donne aussi « refusé ». `approveCommand` rend `refusedResult` (erreur pour l'agent), la marque
  `refused` est retirée par le serveur MCP. Interface : bouclier barré gris « refusé » (ni vert, ni
  rouge : c'est un choix de l'utilisateur), compté dans les groupes et la carte « Sous-agents ».
  Scénario `terminal-refus`, e2e `terminal` (capture `33-terminal-refus`) et `base` (le refus d'une
  autorisation dit maintenant « refusé ») ; e2e base, terminal, subagents, permissions verts.
- 2026-10-23 — **D17 fait.** `apkDirs` : dossiers d'Android puis de Flutter
  (`../build/app/outputs/flutter-apk`, `../build/app/outputs/apk`, relatifs au projet Gradle) ;
  Gradle réussi sans APK : job réussi, `apkSearched`, texte « Build succeeded in N s, but no APK
  under … » sans erreur. `adb` : message d'erreur entier (lignes non vides, 2 000 caractères au
  plus). En plus du plan : le libellé « Lance … » d'`android_launch` prenait la fin raccourcie d'un
  long chemin (« … » seul) ; il prend maintenant le nom du fichier avant de raccourcir.
  OpenCode : point d'extension `ToolStatusSource` (`adapters.ts`), `OPENCODE_TOOL_STATUS` dans
  `opencode-contract.ts` (`toolCalls[].status: "error"`, `isError`, `metadata.error: true` →
  `failed`), appliqué par l'hôte après `diffSource`, en direct comme au rejeu ; profils OpenCode et
  factice ; repère `execute-errors` (Réglages › Agents, `docs/agents.md`), ligne dans
  `docs/acp.md`. Sonde : nouvelle observation `toolCallsStatus` et vérification (si l'outil passe
  par `execute`) ; la valeur attendue `completed` vient du journal de la recette (2.0.32), à
  confirmer au prochain `pnpm opencode-probe`. Scénario `outils-execute-erreur` (format relevé, sans
  serveur MCP), test de l'hôte (direct, rejeu, sans adaptateur), e2e `browser`.
- 2026-10-23 — **D12.** `SubagentStream.background` (OpenCode : `rawOutput.metadata.status ===
  "running"`) ; `SubagentRun.background`, `answer`, `lost`. Le réducteur garde la carte « en cours »
  (statut `in_progress` malgré le `completed` de l'agent) ; la fin du tour et une erreur de tour
  ne la ferment pas, l'arrêt de l'agent et la relecture du disque si (« interrompu »). Le suivi
  (`SubagentTracker`) relit la session (`follow`, fourni par `host-options.ts` à partir de
  `SubagentWorks.load(…, { fresh: true })`, sans cache) après 2, 3, 5, 8, 13, 20 puis toutes les
  30 s ; fini quand la relecture se termine par un message, sans outil en cours, deux fois de suite
  et sans travail relayé en direct entre-temps ; la réponse part avec `endedAt`. Nouvelle session
  ou agent arrêté : `lost`. « Voir son travail » relit sans cache tant qu'il tourne. La « Réponse »
  de la carte est `answer`, rien tant qu'il travaille (plus le texte d'attente d'OpenCode). Repère
  `subagent-background` (Réglages › Agents, `docs/agents.md`). Scénario `sous-agent-arriere-plan`
  (session fille réécrite 4 s après l'outil, étape `child-session` + `later`), e2e `subagents`.
  Écart : pas de vérification dans la sonde (le modèle ne lance pas toujours en arrière-plan) ;
  le format vient du journal de la recette (2.0.32). Limite : un fil rouvert après avoir quitté
  l'app pendant qu'un sous-agent tournait le dit « interrompu » (le suivi ne reprend pas).
- 2026-10-23 — **Clôture.** `./scripts/verify` vert (1485 tests) ; e2e touchés verts en clair et
  sombre (`pnpm e2e --changed` : 108 sur 110, `handover` clair et `about` sombre bloqués par la
  charge puis verts relancés seuls), captures regardées : `33-terminal-refus`,
  `28e-outils-execute-echec`, `g3b-sous-agent-arriere-plan-en-cours`,
  `g3c-sous-agent-arriere-plan-fini`. Machine très chargée par les sessions parallèles : des
  suites ont échoué au démarrage (port DevTools pris, fenêtre absente au bout d'une minute) puis
  sont passées relancées seules. **Reste à rejouer avec un vrai agent** : scène 1.3 (refus d'une
  commande du terminal, OpenCode et Bob : « refusé »), 2.5 (sous-agent OpenCode en arrière-plan :
  « en cours » puis sa réponse), 4.4 (`android_build` Flutter, `android_launch` qui échoue) ; puis
  `pnpm opencode-probe` pour confirmer `toolCallsStatus`. Limites : « Voir son travail » déplié
  pendant qu'il tourne garde ce qu'il a lu tant que la carte reste affichée (la réponse finale,
  elle, arrive dans la carte) ; un fil rouvert après avoir quitté l'app pendant un sous-agent en
  arrière-plan le dit « interrompu ».
- 2026-10-23, écart (fiche 127, D25) : un sous-agent en arrière-plan restait « en cours » pour
  toujours si un autre message partait avant sa fin : le fil ne cherchait sa carte que dans le
  dernier tour. Corrigé par la fiche 127 (carte d'un tour précédent, session rattachée à sa carte).
