# 165 — Indices des outils MCP, `/compact` et journal détaillé de Bob

- **Statut** : fait
- **Dépend de** : 028 (serveur d'outils de l'app), 039 (compaction), 080 (journal), 163 (Bob
  2.0.9)
- **Agents** : les deux pour les indices (MCP standard) ; Bob pour `/compact` et son journal
  (déclarés dans son profil, ADR-0011)

## Pourquoi

Trois retouches tirées des notes de version de Bob (relevé du 05/11) :

- Bob IDE 2.3.0 lit les annotations des outils MCP (`readOnlyHint`, `destructiveHint`). Le serveur
  `bobine` n'en déclare aucune : un agent ne peut pas distinguer une capture d'écran d'un clic.
- `/compact` est la commande principale de compaction de Bob depuis 2.0.3 (`compress` n'est plus
  qu'un alias, code de 2.0.9) ; le profil de Bob utilise encore `/compress`.
- Pour déboguer avec Bob, son propre journal (`~/.bob/logs/shell/bob-shell-<date>.log`, un par
  lancement, rien sur la sortie d'erreur en ACP) peut passer en `debug` (`BOB_LOG_LEVEL`).

## Critères d'acceptation

- [x] `tools/list` du serveur `bobine` donne `readOnlyHint: true` aux outils qui ne font que lire
      (captures, lecture de page, listes, journaux, état d'une fille, `ask_user`), et
      `destructiveHint: false` aux outils des filles qui n'agissent que dans l'app. Les autres
      restent sans annotation (MCP : potentiellement destructeurs). Un test vérifie que chaque
      nom annoté existe.
- [x] Profil Bob : `/compact`.
- [x] Journal sur « Trace » (Réglages › Diagnostic, ou `BOBINE_LOG=trace`) : Bob est lancé avec
      `BOB_LOG_LEVEL=debug` (variable déclarée par le profil) ; Réglages › Agents dit où Bob écrit
      son journal.
- [x] Testés (serveur d'outils, profil, lancement de l'agent) ; doc `docs/acp.md`,
      `docs/agents.md`.

## Plan

- `src/main/mcp/tool-hints.ts` (nouveau) : outils en lecture seule et outils sans effet hors de
  l'app, par nom ; `tool-server.ts` les ajoute à `tools/list`. `ToolDefinition.annotations`.
- `profiles.ts` : `compactCommand: '/compact'` ; champ `traceEnv` (variables posées quand le
  journal est sur Trace) et `logFiles` (où l'agent écrit son journal) ; Bob :
  `{ BOB_LOG_LEVEL: 'debug' }`, `~/.bob/logs/shell/`.
- Lancement de l'agent : `traceEnv` ajouté à l'environnement si le journal est sur Trace.
- `capabilities.ts` : repère `agent-log` ; i18n fr/en ; `docs/agents.md`.

Aucune dépendance nouvelle.

## Journal

- 05/11 : fiche ; vérifié dans Bob 2.0.9 : `compact` (alias `condense`, `compress`, `summarize`),
  `BOB_LOG_LEVEL` lu par `bob acp`, journal dans `~/.bob/logs/shell/` (rien sur stderr).
- 05/11, fait :
  - `mcp/tool-hints.ts` : 19 outils en lecture seule (`readOnlyHint`), 4 outils des filles sans
    effet hors de l'app (`destructiveHint: false`, `openWorldHint: false`) ; tout le reste sans
    indice. Les planches de captures rejouent des actions : pas en lecture seule.
    `ToolDefinition.annotations`, posées par `tools/list` (`withHints`).
  - Profil Bob : `/compact` ; `traceEnv` (`BOB_LOG_LEVEL=debug`) appliqué par `spawnAgent` quand
    le journal est sur Trace ; `logFiles` (`~/.bob/logs/shell/`) → repère `agent-log` dans
    Réglages › Agents (fr/en), `docs/agents.md`, `docs/acp.md`.
  - L'agent factice garde `/compress` pour son scénario façon Bob 2.0.6 (résumé en texte) ; la
    persona « façon Bob » de la grille choisit son scénario de compaction elle-même : inchangée.
  - Essais : `catalog.test.ts` (chaque nom annoté existe, capture / clic / commande),
    `agent-process.test.ts` (variables en Trace seulement), `capabilities.test.ts` ; tests
    `src/main/mcp` et `src/main/agent` (398) verts. Pas d'e2e : rien de visible avec le profil
    factice des essais. Pas de ligne au CHANGELOG (rien de visible pour l'utilisateur hormis le
    repère de Réglages › Agents).
