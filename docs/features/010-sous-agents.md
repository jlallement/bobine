# 010 — Sous-agents imbriqués

- **Statut** : fait en partie — cartes « Sous-agent » ; imbrication écartée (aucun agent ne
  transmet le travail de ses sous-agents)
- **Dépend de** : 003

## Pourquoi

Claude Code et Bob lancent des sous-agents ; on veut voir leur travail imbriqué sous l'outil qui les
a lancés, repliable, comme dans Claude Code.

## Critères d'acceptation

- [ ] `subagent_update` (instable) : sous-fil imbriqué sous l'appel d'outil parent, repliable.
- [ ] Statut du sous-agent (en cours, fini, échec) et son résumé.
- [ ] Repli : sans `subagent_update`, l'outil `Task` reste une carte normale.
- [ ] Testé : agent factice ; OpenCode réel ; Bob (`--disable-subagents` existe).

## Notes

Voir « Sous-agents » dans `docs/acp.md`.

## Verdict (essai réel, 2026-10-13)

Ni Bob 2.0.6 ni OpenCode 1.19 n'envoient `subagent_update`, ni aucune mise à jour venant de la
session du sous-agent : on ne voit que l'appel d'outil du parent et son résultat. Il n'y a donc rien
à imbriquer ; la fiche est écartée tant qu'un agent ne transmet pas ce travail.

| Agent | Ce qui arrive par ACP |
|---|---|
| Bob 2.0.6 | Outil `spawn_subagent` : `tool_call` « Running subagent: <consigne> », `kind: other`, `rawInput: { description, name: "explore" }` ; **autorisation demandée** avant de lancer le sous-agent ; résultat `<task_result>…</task_result>`. Rien de la session du sous-agent n'arrive par ACP (vu). Sous-agents actifs par défaut (`session.subagents`, `--disable-subagents`). |
| OpenCode 1.19 | Outil `task`, `kind: think` : titre = description, `rawInput: { description, prompt, subagent_type: "general" }` ; résultat `<task id="ses_…" state="completed"><task_result>…</task_result></task>`. Pas d'autorisation demandée. |

**Coût** : Bob enregistre chaque sous-agent dans sa propre tâche (`parent_id`, `task_type: subagent`)
sans l'ajouter au coût du parent. Le coût affiché d'une conversation oubliait donc ses sous-agents :
`readBobTaskCost` additionne maintenant la tâche et ses descendantes (relevé : 0,048 + 0,0059).

**Cartes « Sous-agent »** (faites, à la demande de l'utilisateur) : `src/shared/subagent.ts`
reconnaît les deux formats (`subagentOf`, sur le modèle de `planOf`) ; l'élément `tool` du fil porte
`subagent` (type, consigne, consigne complète d'OpenCode). La carte affiche « Sous-agent », le type
(`explore`, `general`) et la consigne ; dépliée : la consigne, la réponse mise en forme sans les
balises (`subagentResult`), et une note disant que l'agent ne transmet que la réponse. Autorisation
de Bob : « Lancer ce sous-agent ? ».

**Suite** (fiche 053) : durée sur la carte, coût de chaque sous-agent de Bob en direct (relu dans sa
base), et « Voir son travail » pour OpenCode, dont la session du sous-agent se recharge.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-13 — Essai réel (dossier `~/bob-essai/sous-agent-010`, consigne : lire un fichier avec un
  sous-agent) : ni Bob ni OpenCode ne transmettent le travail du sous-agent (voir le verdict).
  Fiche écartée. Correctif au passage : coût des sous-agents ajouté à celui de la conversation
  (`bob-costs.ts`). Coût de l'essai : ≈ 0,054 bobcoin ; OpenCode gratuit.
- 2026-10-13 — Cartes « Sous-agent » : `subagent.ts` (+ tests), `transcript.ts`, `ToolCall.tsx` ;
  scénarios factices `sous-agent-bob` et `sous-agent-opencode` (formats relevés) ; e2e
  `subagents`.
