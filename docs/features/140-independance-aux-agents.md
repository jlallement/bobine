# 140 — Indépendance aux agents

- **Statut** : fait (essai à la vraie souris et suite e2e complète à la fin des vagues)
- **Dépend de** : 054 (ce que l'app sait faire avec un agent), 056 (règles actives), 025 et 104
  (serveurs MCP et fournisseurs dans les fichiers des agents), 088 (adaptateurs dans le profil,
  ADR-0015)
- **Agents** : les deux. Rien ne change pour Bob ni pour OpenCode : le code qui leur est propre
  change de place (leurs modules, branchés par leur profil). Seul ajout visible : le Diagnostic
  prévient quand la version d'un agent n'est pas celle que l'app a vérifiée.
- **Feuille de route** : vague 4 de `docs/feuille-de-route-2026-10-23.md` (§ 0), lot 140 de
  l'étude (« Itération 4 »). Prépare la 141 (profil « Agent ACP personnalisé »).

## Pourquoi

Bobine tiendrait un troisième agent ACP à 80 % sans toucher l'interface. Le reste est du code
propre à Bob ou à OpenCode resté hors de leurs modules : reconnaissance des sous-agents dans
`shared`, `_meta` de Claude et de Codex lus dans `shared/questions.ts`, étiquettes `'bob' |
'opencode'` traduites par des tables (le modèle qu'écarte l'ADR-0015), heuristiques non déclarées.
Jérôme veut un code le moins possible dépendant de Bob ou d'OpenCode ; la 141 en a besoin pour
qu'un agent se déclare sans toucher au code.

## Critères d'acceptation

- [x] **Sous-agents** : point d'extension `SubagentFormat` (`agent/adapters.ts`), porté par le
      profil (`subagentFormat`), code dans `bob-subagents.ts` et `opencode-subagents.ts`. Le main
      marque la mise à jour (`_meta["bobine/subagent"]`) ; `shared` et le suivi des sous-agents ne
      lisent que cette marque générique.
- [x] **`_meta` de Claude et de Codex** retirés de `shared/questions.ts` (justification au plan) ;
      scénarios `questions` et `codex-question-plan` gardés cohérents.
- [x] **Sources portées par le profil** : `RulesSource`, `McpConfigSource`, `ProvidersSource`
      remplacent `RulesFormat`, `McpFormat`, `ProvidersFormat` et leurs tables ; code dans
      `agent-config/bob-*.ts` et `agent-config/opencode-*.ts`. Tests existants inchangés sur le fond.
- [x] **Heuristiques** : chacune devient un point d'extension ou une règle générique documentée
      (libellés d'outils, fichier créé, compaction par commande).
- [x] **ESLint** refuse les littéraux `'bob'` et `'opencode'` hors des modules d'agent, des profils,
      des tests et de l'agent factice.
- [x] **`testedVersions`** dans le profil ; le Diagnostic prévient quand la version annoncée n'en
      fait pas partie (testé). Un test vérifie que les versions des sondes (`scripts/*-probe.expected.json`)
      y figurent.
- [x] `grep` ne trouve plus de format propre à un agent dans `src/shared` ni `src/renderer`.
- [x] `docs/agents.md`, `docs/architecture.md`, `docs/acp.md` à jour ; cahier des charges d'un
      troisième agent ci-dessous.
- [x] Testé contre l'agent factice : suites e2e `subagents`, `questions`, `rules`, `mcp`,
      `providers`, `diagnostic`, `bob`, en clair et en sombre.

## Plan

### 1. Sous-agents : `SubagentFormat`

- `adapters.ts` : `SubagentFormat { subagentOf(title, rawInput): Subagent | undefined;
  sessionId?(output, rawOutput): string | undefined }`.
- `agent/bob-subagents.ts` (titre « Running subagent: », `name`, `description`) et
  `agent/opencode-subagents.ts` (1.19 : `subagent_type` ; 2 : `agent` + `prompt`, titre
  `subagent|task` ; session dans `<task id>`, `<subagent sessionID>`, `rawOutput.metadata.sessionID`).
- Profils : Bob → format de Bob ; OpenCode → format d'OpenCode ; agents factices → l'un puis
  l'autre (ses scénarios imitent les deux).
- `agent/subagent-marks.ts` (générique) : retient le titre de chaque appel, demande au format,
  et pose `_meta["bobine/subagent"] = { subagent?, sessionId? }` sur la mise à jour, dans
  `AgentHost.onSessionUpdate`, avant le tri (fil, rejeu, travail d'un sous-agent, relecture).
- `shared/subagent.ts` : types, `SUBAGENT_META`, `subagentMarkOf(update)`. Le réducteur et
  `SubagentTracker` lisent la marque. `subagentResult` devient une **règle générique** : les paires
  de balises qui enveloppent toute la réponse sont retirées (`<task_result>`, `<task …>`,
  `<subagent …>` en sont des cas).
- Les fils enregistrés gardent leurs cartes : on enregistre les éléments, pas les mises à jour.

### 2. `_meta` de Claude et de Codex : retirés

Choix : **retirer**, pas d'adaptateur. Ni Bob ni OpenCode n'envoient ces formes ; un adaptateur
ne serait branché sur aucun profil réel (seulement l'agent factice), du code mort qu'AGENTS.md
refuse (« sans cas particuliers pour eux »). Retirés : aperçu `_meta["_claude/askUserQuestionOption"]`
(et l'aperçu des options dans la carte, qui n'a plus de source), rôles inversés et note
`_meta.codex`, marque `_meta.customAnswer`. Gardé, générique : choix `enum` / `oneOf` / `anyOf`,
`required`, champ « Autre » `<clé>_custom` (convention d'OpenCode 2, aussi celle de Claude Code).
Scénario `codex-question-plan` → `question-plan` : question obligatoire au format générique, puis
plan dans `rawInput.plan`. Scénario `questions` : sans aperçu.

### 3. Sources portées par le profil

- `adapters.ts` : `RulesSource { describe(); list(ctx) }`, `McpConfigSource` (l'actuel `Format` de
  `mcp-files.ts`, plus `describe()`), `ProvidersSource` (fichier, lecture et transformations du
  texte ; l'écriture sûre, la copie `.bak` et l'affichage restent génériques).
- `rules.ts` garde le générique (aperçu, dédoublonnage, outils de chemins) ; `bob-rules.ts`,
  `opencode-rules.ts` (1.19 et 2, choisies d'après la version annoncée). `mcp-files.ts` garde
  `AgentMcpConfig(source, loc)` ; `bob-mcp.ts`, `opencode-mcp.ts`. `provider-files.ts` garde
  `AgentProvidersConfig(source, loc)` ; `opencode-providers.ts`.
- `capabilities.ts` : « Fichiers de règles » et « Fichiers MCP » lisent `describe()`.
- La sonde d'OpenCode importe `OPENCODE_RULES` (chargé sous Node : extensions explicites).

### 4. Heuristiques

- `tool-label.ts` (noms usuels de la cible dans `rawInput`) : règle générique, commentaire sans
  noms d'agents.
- `changes.ts` (`oldText: ""` = fichier créé) : règle générique (un ancien texte vide crée le
  fichier).
- `transcript.ts` (`/compact|compress` reconnu dans le fil) : l'hôte marque le message envoyé
  `compaction: true` quand il est la commande de compaction de la session (annoncée ou du profil) ;
  le réducteur lit la marque.
- Gardés, génériques et documentés : `rawInput.plan` d'un `switch_mode`, extension
  `terminal_output` (négociée par capacité), noms `compact` / `compress` des commandes annoncées
  (main).

### 5. ESLint

`no-restricted-syntax` : `Literal[value=/^(bob|opencode)$/i]` (et gabarits) dans `src/**` hors
`profiles.ts`, `**/bob-*.ts`, `**/opencode-*.ts`, tests, agent factice, types générés. Fusionné
avec les sélecteurs existants du renderer (une règle par bloc).

### 6. `testedVersions`

Profil : `testedVersions?: string[]` (Bob `2.0.6` ; OpenCode `1.19`, `2.0.31`, `2.0.32`) ; une
entrée vaut pour ses sous-versions (`1.19` → `1.19.3`). Diagnostic, groupe de l'agent : ligne
« Version vérifiée », avertissement si la version annoncée n'en fait pas partie. Test unitaire,
et cohérence avec `scripts/*-probe.expected.json`.

### 7. Docs

`docs/agents.md` (matrice, « Ajouter un agent »), `docs/architecture.md`, `docs/acp.md`,
`docs/mock-agent.md`, index, CHANGELOG (le message du Diagnostic).

Conflits possibles : 139 (scénarios factices) — seul le scénario `codex-question-plan` est
renommé et `questions` perd son aperçu ; 142 (erreurs des agents) — rien touché.

## Brancher un troisième agent ACP (cahier des charges de la 141)

Ce qu'il faut désormais, et seulement cela :

1. **Un profil** (`AgentProfile`) avec `id`, `label`, `command`, `args`, `env` : c'est tout ce
   qui est obligatoire. Tout le reste vient d'ACP : capacités lues à `initialize` (fiche 054),
   modes et options, commandes, consommation par `usage_update`, reprise, élicitations,
   compaction annoncée, outils de l'app par MCP HTTP. Les questions à choix se lisent d'après le
   JSON Schema seul ; la sortie des commandes par l'extension `terminal_output` que l'app annonce.
2. **Rien d'autre n'est requis.** Sans les champs suivants, l'agent marche ; il lui manque
   seulement ce qu'il ferait hors d'ACP :
   - `subagentFormat` : sans lui, ses sous-agents restent de simples appels d'outil ;
   - `rules`, `mcpConfig`, `providers` : sans eux, pas de « Règles actives », de serveurs MCP ni de
     fournisseurs dans les réglages pour cet agent ;
   - `compactCommand` : sans lui, « /compact » n'est proposé que si l'agent annonce `compact` ou
     `compress` ;
   - `testedVersions` : sans lui, le Diagnostic ne compare pas de version ;
   - `apiKeys`, `terminalSteps`, `license`, `trust`, `costSource`, `quotaSource`, `diffSource`,
     `toolStatus`, `emptySessionTitle`, `defaultControls`, `destination`, `chartSlot`.
3. **Pour la 141 (profil déclaré sans code)** : les champs de données (`id`, `label`,
   `command`, `args`, `env`, `installHint`, `testedVersions`, `compactCommand`, `defaultControls`)
   peuvent venir d'un réglage ; les champs qui portent du code (formats et sources) ne se
   déclarent pas, ils restent absents. Rien dans l'interface, `shared` ou l'hôte d'agent n'a besoin
   de connaître l'agent : l'identifiant du profil n'est comparé nulle part (ESLint), et `'bob'` /
   `'opencode'` ne s'écrivent que dans leurs modules.
4. **Points d'attention pour la 141** : l'identifiant doit éviter `mock*` (rangé après les vrais
   agents) et ceux des profils existants ; `chartSlot` absent → « Autres » dans le graphique ; la
   page de l'agent (Réglages › Agents) liste « Propre à <agent> » vide, ce qui est juste.

## Journal

- **2026-10-24** — Fiche et plan.
- **2026-10-24** — Fait, sur `claude/fiche-140-independance-7fc875` (partie de
  `integration/vagues`) :
  - **Sous-agents** : `SubagentFormat` (`adapters.ts`), `bob-subagents.ts`,
    `opencode-subagents.ts` ; agents factices : les deux formats (OpenCode d'abord, comme avant).
    `SubagentMarker` (`subagent-marks.ts`) pose `_meta["bobine/subagent"]` sur chaque mise à jour et
    sur l'appel d'outil d'une demande d'autorisation ; `ProfileUpdates` (`profile-updates.ts`)
    regroupe diffs, échecs et marques avant le tri. `shared/subagent.ts` : marque, types, réponse
    « sans balises » en règle générique (paires qui enveloppent toute la réponse). Sonde d'OpenCode :
    importe `opencode-subagents.ts`.
  - **Questions** : `_meta` de Claude Code et de Codex et `_meta.customAnswer` retirés, aperçu des
    options retiré de la carte et des styles ; scénario `question-plan` (ancien
    `codex-question-plan`), `questions` sans aperçu ; e2e `questions` suit.
  - **Sources** : `RulesSource`, `McpConfigSource`, `ProvidersSource` ; `bob-rules.ts`,
    `opencode-rules.ts`, `bob-mcp.ts`, `opencode-mcp.ts`, `opencode-providers.ts` ;
    `AgentMcpConfig(source, loc)`, `AgentProvidersConfig(source, loc)`, `activeRules(source, ctx)`.
    Tests existants inchangés sur le fond (seule l'étiquette devient l'objet).
  - **Heuristiques** : compaction par commande marquée par l'hôte (`compaction.ts`,
    `compaction: true`) ; libellés d'outils et `oldText: ""` documentés en règles génériques.
  - **ESLint** : `NO_AGENT_LITERAL` ; ignore des modules d'agent étendu à `src/main/**/bob-*.ts`.
  - **`testedVersions`** et ligne « Version » du Diagnostic ; repères `subagent-calls` et
    `tested-versions` dans « Propre à » et la matrice.
  - **Docs** : ADR-0028 (proposé), `architecture.md`, `agents.md` (matrice, « Brancher un autre
    agent ACP »), `acp.md`, `mock-agent.md`, CHANGELOG fr/en.
- **Vérifié** : `./scripts/verify` vert (255 fichiers, 1 790 tests) ; e2e `subagents`, `questions`,
  `rules`, `mcp`, `providers`, `diagnostic`, `bob`, `commands`, `settings`, clair et sombre : 18/18
  (captures regardées : questions sans aperçu, sous-agents de Bob et d'OpenCode, page d'agent).
  Suite complète et essai à la souris : à la fin des vagues.
- **Écarts au plan** :
  - Deux repères ajoutés à « Propre à » (`subagent-calls`, `tested-versions`) : l'ADR-0011 veut que
    tout ce que l'app sait d'un agent y soit visible.
  - `agent-host.ts` (plafond 1050) : appels d'outil notés par `AppToolsBridge.noteUpdate` pour
    rester sous le plafond.
  - Noms usuels de compaction (`compact`, `compress`) gardés, mais dans le main (`compaction.ts`) :
    le comportement reste identique (un `/compress` tapé à l'agent factice, qui n'annonce rien,
    donne toujours la carte).
- **Ce qui reste hors périmètre** (relevé, non traité) : `shared/launch.ts` lit `.bob/launch.json`
  (fichier de l'app hérité du nom « Bob Desktop », pas un format d'agent) ; clés `bob:` du
  stockage local du renderer (ancien nom de l'app) ; commentaires qui citent Bob ou OpenCode en
  exemple. L'extension `terminal_output` (Codex, Claude Code) reste : elle est négociée par une
  capacité que l'app annonce, donc générique.
- **Conflits possibles à la fusion** : 139 (scénarios de l'agent factice : seul
  `codex-question-plan` est renommé et `questions` modifié) ; 142 (`agent-host.ts` à 1048/1050 des
  deux côtés, `profiles.ts` : champ `testedVersions` ajouté avant `welcomeHint`, 142 ajoute
  `transientError` après `license`).
