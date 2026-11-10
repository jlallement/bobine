# 019 — Consommation : jetons, contexte, coût

- **Statut** : fait (Claude Code réel à essayer)
- **Dépend de** : 003

## Pourquoi

Savoir ce qu'une conversation consomme : jetons, remplissage du contexte, coût (dollars ou
bobcoins), et quand l'agent résume la conversation (compaction).

## Critères d'acceptation

- [x] `usage_update` : jauge de contexte (`used` / `size`) près de la zone de saisie, coût cumulé si fourni (`cost.amount`, `cost.currency`).
- [x] `PromptResponse.usage` : jetons du tour (entrée, sortie, cache, réflexion), cumulés par conversation et mémorisés.
- [x] `compaction_update` : indication « conversation résumée » dans le fil.
- [x] Rien d'affiché si l'agent ne fournit rien (pas d'estimation inventée).
- [x] Testé : agent factice ; Codex, OpenCode réels.
- [x] Bob réel (bobcoins, lus dans sa base locale).
- [ ] Claude Code réel (après connexion).
- [x] Dépense récente avec Bob (aujourd'hui, 7 jours, ce mois) dans le détail de la consommation.
- [x] Budget épuisé : le message de Bob, pas « Internal error ».

## Notes

- Relevé réel (2026-10-11) : Codex envoie `usage_update` (`used` / `size`, sans coût) et `usage`
  dans la réponse de chaque tour ; OpenCode ajoute le coût (`cost` en USD, 0 pour les modèles
  gratuits) ; Claude Code envoie `usage_update`. Voir le tableau dans `docs/acp.md`.
- Claude Code envoie `usage_update` (contexte) ; Bob compte en bobcoins en interne (« Cost limit reached ») mais rien ne montre encore qu'il les transmet par ACP.

## Plan

- `src/shared/usage.ts` — types `ConversationUsage` (contexte, coût annoncé par l'agent, jetons
  cumulés + dernier tour), fonctions pures `withContext`, `addTurn`, formatage (jetons, %, coût :
  devise ISO via `Intl`, sinon « 12,5 bobcoins »).
- `transcript.ts` — `usage` dans l'état du fil (donc mémorisé avec la conversation, et conservé lors
  d'un `reset` / rejeu) ; `usage_update` et `turn-end.usage` ; élément `compaction` (statut, résumé
  en morceaux, erreur).
- `agent-host.ts` — `turn-end` porte `PromptResponse.usage` ; capacité client
  `sessionCapabilities.compaction: {}` (sinon l'agent ne doit pas envoyer `compaction_update`).
- Renderer — `UsageMeter` dans la barre de la zone de saisie : anneau de contexte (orange > 80 %,
  rouge > 95 %), détail au clic (contexte, jetons entrée / sortie / cache / réflexion, dernier
  échange, coût) ; masqué si l'agent ne fournit rien. Carte « Conversation résumée » dans le fil.
- Agent factice — `usage_update` (avec coût) et `usage` à chaque tour (`--sans-usage` pour s'en
  passer) ; scénario `compaction`.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-11 — Implémenté. `src/shared/usage.ts` (cumul, formatage, devise libre type bobcoins),
  `usage` dans l'état du fil (mémorisé, conservé au rejeu), élément `compaction`, capacité client
  `session.compaction`, `turn-end.usage`, `UsageMeter` (anneau + détail). Agent factice : usage et coût
  à chaque tour, `--sans-usage`, `--devise`, scénarios `compaction` et `contexte-plein`. 171 tests ;
  `pnpm e2e` : jauge, détail, coût cumulé, alerte, compaction, conservation après redémarrage.
  - **Essai réel Codex** : jauge 7 % (17 648 / 258 400), 2 échanges, entrée / sortie / cache, pas de coût.
  - **Essai réel OpenCode** : jauge 4 % (7 868 / 200 000), jetons, coût « 0,00 $US » (modèle gratuit).
  - Le total « jetons traités » additionne ce que l'agent rapporte à chaque échange (le contexte relu
    en cache compte à chaque fois) : libellé et infobulle le précisent.
- 2026-10-11 — **Bob réel** : aucune consommation par ACP. Bob enregistre le coût de chaque tâche
  (bobcoins) dans `~/.bob/db/bob.db` (`tasks.costs`, identifiant = session ACP) : adaptateur
  `src/main/agent/bob-costs.ts` (`node:sqlite`, lecture seule, aucune dépendance ajoutée), activé par
  `costSource: 'bob-db'` dans le profil Bob ; relu à l'ouverture et après chaque tour. Affiché :
  « 0,0632 bobcoins » pour une conversation de deux échanges (valeur identique à celle de Bob).
  Format non documenté : la moindre surprise donne « pas de coût ».
- 2026-10-13 — **Dépense récente et budget.** Le compteur de bobcoins de la barre latérale (fiche 027)
  est retiré : mal placé, et sans intérêt hors Bob. La dépense récente (aujourd'hui, 7 derniers jours,
  ce mois-ci, `readBobSpend`) s'affiche dans le détail de la jauge, section « IBM Bob sur ce Mac »,
  relue à chaque ouverture. Elle passe par l'IPC générique `usage:agentSpend(id)` : le main regarde
  le profil de la conversation (`costSource`), l'interface ne connaît pas Bob. Rien pour OpenCode.
  - **Budget du compte** : Bob 2.0.6 ne le transmet pas par ACP. Il le lit auprès de son service
    avec la connexion de l'utilisateur et ne l'affiche que dans `bob chat` (`/status`). L'app ne le
    reprend pas : il faudrait réutiliser le jeton de Bob sur une API non documentée (refusé par
    l'utilisateur).
  - **Budget épuisé** (forme supposée, non provoquée) : Bob répond « Internal error » et met la cause dans `data.details`
    (`BudgetExceededError: {"title":…,"description":…}`). `errorMessage` lit ce détail pour toutes
    les erreurs JSON-RPC, et affiche « Budget Exceeded — Oh no!… ». Scénario `budget-depasse`.
  - Agent factice : `MOCK_AGENT_CURRENCY`, `MOCK_AGENT_COST_SOURCE=bob-db` (base de
    `BOB_DESKTOP_CONFIG_HOME`). La base de Bob suit aussi `BOB_DESKTOP_CONFIG_HOME` pour le coût des
    conversations (option `bobDb` du gestionnaire). e2e `fun` (dépense, budget) et `usage` (rien hors
    Bob).
