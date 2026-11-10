# 078 — OpenCode 2 : compatibilité et sonde de suivi

- **Statut** : fait
- **Dépend de** : 010, 022, 025, 039, 048, 053, 055, 056
- **Agents** : OpenCode — sa version 2 change son ACP ; Bob n'est pas concerné (ADR-0011).

## Pourquoi

Tous les relevés d'OpenCode de Bobine datent des 1.18 / 1.19 (11–14 octobre 2026). OpenCode 2 est
sorti en parallèle (`opencode upgrade --major`, 2.0.26 → 2.0.31) avec un ACP réécrit : sous-agents
relayés dans le flux du parent, questions par élicitation, compaction, outils renommés,
configuration déplacée. Il faut savoir ce que ça casse dans Bobine, l'adapter, et être prévenu
quand OpenCode change encore — par exemple le jour où il enverra un vrai `plan` ACP.

## Critères d'acceptation

- [x] Inventaire de ce que Bobine suppose d'OpenCode 1.19, et verdict pour OpenCode 2 (ci-dessous).
- [x] Relevés réels sur OpenCode 2.0.31 (modèle gratuit Zen, dossiers `HOME` / `XDG_*` jetables) :
      initialize, sessions, réglages, sous-agents, questions, compaction, consommation,
      règles, configuration MCP, connexion, liste de tâches.
- [x] Sous-agents d'OpenCode 2 : leur travail, relayé en direct dans le flux du parent, ne se
      mélange plus au fil ; il s'affiche **sous la carte « Sous-agent »** (outils et réponse),
      repliable, gardé dans l'historique. Cartes reconnues au format 2 (`subagent`, `agent`,
      `<subagent sessionID=…>`), « Voir son travail » toujours possible.
- [x] Règles actives : celles d'OpenCode 2 (`AGENTS.md` jusqu'au dossier personnel, sans repli sur
      `CLAUDE.md`) ou de la 1.19, selon la version annoncée par l'agent.
- [x] Serveurs MCP : les fichiers au format 2 (`mcp.servers`, `disabled`) sont lus et modifiés ;
      ceux au format 1 restent au format 1 (lu par les deux versions).
- [x] Questions d'OpenCode 2 (`question` → `elicitation/create`) affichées comme un questionnaire.
- [x] Scénarios de l'agent factice qui imitent OpenCode 2 (sous-agent, question) ; e2e touchés verts.
- [x] `pnpm opencode-probe` : sonde de suivi lancée après chaque mise à jour d'OpenCode ; compare
      ses réponses à des attentes enregistrées, vérifie le contrat de l'app et signale notamment
      l'arrivée d'un `plan` ACP. Documentée dans `docs/acp.md` et `AGENTS.md`.
- [x] `docs/agents.md` et `docs/acp.md` passent à OpenCode 2 (écarts de la 1.19 notés).

## Décisions (utilisateur, 2026-10-16)

- **Installation** : OpenCode 2.0.31 dans un dossier à part, `~/.opencode2/bin/opencode` (paquet npm
  officiel `@opencode/cli-darwin-arm64`, empreinte vérifiée, signé « Anomaly Innovations »). La 1.19
  reste la commande `opencode` de l'utilisateur.
- **Travail des sous-agents** : sous la carte « Sous-agent », en direct (option recommandée), plutôt
  qu'à plat dans le fil.
- **Autorisations** : OpenCode 2 ne demande plus rien par défaut, même hors du dossier. Bobine le
  dit (doc, matrice) sans compenser : rien d'imposé que l'agent ne fasse pas en terminal.
- **OpenCode 1** : compatibilité gardée (npm `latest` est encore la 1.19.3) ; la matrice passe à
  OpenCode 2, écarts de la 1.19 notés.

## Inventaire : ce que Bobine suppose d'OpenCode 1.19, et OpenCode 2

| Où | Supposé (1.18 / 1.19) | OpenCode 2.0.31 (relevé) | Verdict |
|---|---|---|---|
| `profiles.ts` : commande | `opencode acp` | inchangé | ✅ |
| `initialize` | `loadSession`, `list`, `resume`, `close`, `fork`, pas `delete` ; MCP `http` + `sse` ; images | + `delete`, `additionalDirectories` ; MCP `http` seulement ; `agentInfo` « OpenCode » 2.0.31 ; `_meta["opencode/child-session-updates"]` | ✅ générique (suppression maintenant proposée) |
| Connexion (fiche 022) | `opencode-login` sans `type`, `authenticate` ne fait rien | identique (type `terminal` seulement si le client annonce `auth.terminal`, que Bobine n'annonce pas) | ✅ |
| Réglages (fiche 013) | « Model » et « Session Mode » (`build` / `plan`) en options | identiques ; + « Effort » (`thought_level`) pour un modèle à variantes ; le modèle par défaut peut changer juste après `session/new` (`config_option_update`, catalogue rechargé) | ✅ générique |
| Commandes, `/compact` (fiche 039) | `/compact` non annoncé, `compactCommand` | `compact` **annoncé** (avec `init`, `review`) | ✅ la commande de l'agent passe avant |
| Compaction | réponse texte | `compaction_update` + `compaction_summary_chunk` (Bobine annonce `session.compaction`) | ✅ carte de compaction |
| Consommation (fiche 019) | `usage_update` avec coût USD + `usage` | identique (fin de tour) | ✅ |
| `session/list` (fiche 055) | sans dossier : hors dépôt seulement | sans dossier : **toutes** ; `nextCursor` toujours présent ; sessions de **sous-agents listées** | ✅ ; sessions de sous-agents proposées dans « Reprendre » (limite) |
| `emptySessionTitle` | « New session - <date ISO> » | identique | ✅ |
| `session/load` / `resume` | rejeu avant la réponse | identique ; session d'un autre dossier : `-32602` | ✅ |
| Sessions de la 1.19 | — | listées, rechargées et continuées par la 2 (même base) | ✅ l'historique de Bobine se rouvre |
| Sous-agents (`subagent.ts`, fiches 010, 053) | outil `task`, `rawInput.subagent_type`, résultat `<task id="ses_…">` ; rien du sous-agent par ACP | outil `subagent` (titre « subagent », `kind: think`), `rawInput: { agent, description, prompt }`, résultat `<subagent sessionID="ses_…" state="completed">`, `rawOutput.metadata.sessionID` ; **tout le travail du sous-agent** (réflexion, outils, texte) relayé dans le flux du parent, marqué `_meta["opencode/child-session"]`, outils préfixés `ses_…:` et titrés « <tâche> : <outil> » | ❌ carte non reconnue ; texte du sous-agent collé à la réponse du parent → **à adapter** |
| « Voir son travail » (fiche 053) | `session/load` de la session enfant | toujours possible (consigne préfixée « You are a subagent… ») | ✅ |
| Questions | aucune par ACP (outil `ask_user` de l'app) | outil `question` → `elicitation/create` `form` (`q0` + `q0_custom`, `toolCallId`) | ✅ reconnu par `questions.ts` |
| Liste de tâches | outil `todowrite`, sans `plan` | **ni outil de liste ni `plan`** | — rien à afficher ; la sonde surveille |
| Diffs (fiches 021, 023) | extraits | **fichier entier** (`oldText` / `newText`) pour `edit` ; rien pour un fichier créé par `write` | ✅ remise en état exacte ; ⚠️ fichiers créés absents du récapitulatif |
| Outils | `bash`, `apply_patch`, `task`, `todowrite` | `shell` (titre = commande), `patch`, `subagent`, `execute` (« Code Mode », JS qui appelle d'autres outils), `question` | ✅ rien ne dépend des noms |
| Outils de l'app (fiches 029, 071) | titre `bobine_<outil>` | identique (`McpTool.name`) | ✅ |
| Autorisations | demande pour écrire hors du dossier | **ne demande rien** par défaut (hors du dossier compris) ; mode `plan` : refuse d'écrire de lui-même | doc |
| Règles (`rules.ts`, fiche 056) | `AGENTS.md` jusqu'à la racine git (sinon `CLAUDE.md`) ; `~/.config/opencode/AGENTS.md` sinon `~/.claude/CLAUDE.md` ; `instructions` | `~/.config/opencode/AGENTS.md`, puis **tous** les `AGENTS.md` du dossier jusqu'au dossier personnel (hors du dossier personnel : jusqu'à la racine du dépôt, ou le dossier seul) ; **plus de `CLAUDE.md`** ; `instructions` (motifs cherchés à chaque niveau jusqu'à la racine du dépôt) | ❌ → règles selon la version |
| Serveurs MCP (`mcp-files.ts`, fiche 025) | `mcp.<nom>`, `enabled` | format 1 encore lu ; format natif `mcp.servers.<nom>`, `disabled`, `timeout` en objet ; config du projet cherchée dans **tous** les dossiers parents (et `.opencode/opencode.json(c)`) | ❌ fichiers au format 2 mal lus → à adapter |
| Skills, commandes, agents | `.opencode/command`, `.opencode/skill(s)`… | + `commands/`, `agents/`, `skills/` (anciens noms encore lus) ; `.claude/skills`, `.agents/skills` | ✅ rien à faire |
| `XDG_*` (`shell-env.ts`) | suivis | suivis (même emplacements) | ✅ |

## Plan

1. **Adaptateur OpenCode** (`main/agent/opencode-contract.ts`, sans alias, partagé avec la sonde) :
   `childSessionOf(update)` lit `_meta["opencode/child-session"]` ; titre des sessions vides,
   méthode de connexion. Profil : `subagentStream: 'opencode'` (OpenCode, agent factice), repère
   `subagent-live` dans `capabilities.ts` et `docs/agents.md`.
2. **Hôte d'agent** : une mise à jour d'un sous-agent ne va plus au fil ; le suivi des sous-agents
   (`subagent-tracker.ts`) la rattache à sa carte (même consigne, sinon la plus ancienne en cours) et
   émet `subagent-update` ; sans carte, ses outils restent à plat, son texte est écarté.
3. **Fil** (`shared/transcript.ts`) : `work` sur la carte d'outil (outils et texte du sous-agent,
   sans sa réflexion), fermé en fin de tour ; une autorisation demandée par un outil du sous-agent
   sort la carte dans le fil. `shared/branch.ts` : ses modifications comptent dans le récapitulatif.
4. **`subagent.ts`** : format 2 (`agent`, `<subagent sessionID=…>`, `metadata.sessionID`).
5. **Carte** (`ToolCall.tsx`) : « Son travail » en direct quand il est là, sinon « Voir son travail ».
6. **Règles** : `rules.ts` choisit le format 1 ou 2 d'après la version annoncée (`agentsSeen`).
7. **Serveurs MCP** : `mcp-files.ts` lit `mcp.<nom>` et `mcp.servers.<nom>` ; écrit au format du
   fichier.
8. **Agent factice** : étape `opencode-child`, scénarios `sous-agent-opencode2` et
   `question-opencode2` ; e2e `subagents` (et `questions`).
9. **Sonde** : `scripts/opencode-probe.mts` + `main/agent/opencode-probe.ts` (fonctions pures,
   testées), `scripts/opencode-probe.expected.json`, `pnpm opencode-probe [--opencode <cmd>]
   [--model <id>] [--offline] [--accept]`.
10. Docs : `agents.md`, `acp.md`, `architecture.md`, `AGENTS.md`, CHANGELOG.

Pas de nouvelle dépendance.

## Journal

- 2026-10-16 — Fiche créée. Lu : note `opencode-2.md` (session « liste de tâches épinglée »), code
  ACP d'OpenCode 2.0.31 (`packages/cli/src/acp`, outil `subagent`, découverte des règles et de la
  configuration, guide de migration V1). Relevés réels sur 2.0.31, modèle `opencode/big-pickle`
  (gratuit, 0 $), `HOME` et `XDG_*` jetables : voir l'inventaire. Seul effet hors bac à sable : un
  `opencode --version` lancé avant les relevés a écrit `~/.local/share/opencode/log/opencode.log`.
- 2026-10-16 — **État à la pause** (à la demande de l'utilisateur ; commit WIP, typecheck vert,
  tests unitaires touchés verts, `./scripts/verify` et e2e pas encore lancés) :
  - Fait : `main/agent/opencode-contract.ts` (`childSessionOf`, `childUpdateForCard`, constantes) ;
    `shared/subagent.ts` reconnaît le format 2 (`agent`, `<subagent sessionID=…>`,
    `rawOutput.metadata.sessionID`) ; évènement `subagent-update` (`shared/agent.ts`) ;
    `SubagentTracker.cardFor(child)` ; réducteur : `work` sur la carte (outils et messages du
    sous-agent).
  - Reste, dans l'ordre du plan : brancher l'hôte d'agent (`agent-host.ts`, gestion de
    `session/update` : `childSessionOf` si le profil a `subagentStream: 'opencode'`, sinon rien ;
    `cardFor` → `subagent-update`, sans carte : outils à plat, texte écarté) ; champ de profil
    `subagentStream` + repère `subagent-live` (`capabilities.ts`, `docs/agents.md`, i18n) ; réducteur :
    `work` fermé en fin de tour (`closeUnfinishedTools`, `settleTranscript`), autorisation d'un
    outil du sous-agent sortie dans le fil, modifications du sous-agent dans `shared/branch.ts` ;
    `ToolCall.tsx` (« Son travail » en direct) ; tests (`subagent.test.ts`, tracker, réducteur,
    `opencode-contract`) ; étapes 6 à 10 du plan (règles, MCP, agent factice, sonde, docs).
  - Scripts de relevés et journaux bruts : dossier de notes partagé, `opencode2-releves/`.
- 2026-10-17 — Reprise après la pause, plan suivi jusqu'au bout.
  - Hôte d'agent : `routeChildUpdate` (profil `subagentStream: 'opencode'`, OpenCode et agent
    factice) ; repère `subagent-live` (`capabilities.ts`, `docs/agents.md`, fr/en).
  - Fil : `work` fermé en fin de tour (`closeUnfinishedTools`, `settleTranscript`) ; un outil du
    sous-agent qui demande une autorisation sort de sous la carte, dans le fil, et sa suite l'y
    rejoint ; `withSubagentWork` fait compter ses modifications dans le récapitulatif
    (`changes.ts`) et dans « repartir d'un message » (`branch.ts`). Carte : « Son travail » en
    direct (`WorkList`, partagé avec le rejeu), plus de bouton « Voir son travail » dans ce cas.
  - Règles : `openCode2Rules` (version annoncée, retenue dans `agentsSeen` ; inconnue = 2), tests
    sur les arbres des essais réels. Serveurs MCP : `entries` / `placeNew` par format ; un serveur
    garde sa table et sa forme, un nouveau va dans `mcp.servers` si le fichier l'a ; `mcp.timeout`
    n'est pas un serveur.
  - Agent factice : étape `opencode-child`, scénarios `sous-agent-opencode2`, `question-opencode2` ;
    e2e `subagents` et `questions` (captures `g3-sous-agent-opencode2`, `12-question-opencode2`
    regardées, clair et sombre).
  - Sonde : `pnpm opencode-probe` (`scripts/opencode-probe.mts`, `main/agent/opencode-probe.ts`,
    comparaison commune extraite de `bob-probe.ts` dans `main/agent/probe-report.ts`). Le contrat
    est vérifié avec le code de l'app (`opencode-contract.ts`, `subagent.ts`, `questions.ts`,
    `rules.ts`) ; « À regarder » signale un `plan` ACP, un outil de liste de tâches,
    `subagent_update` ou une mise à jour inconnue ; les vérifications qui dépendent du modèle
    sont « ? » (à relancer) quand il n'a pas fait ce qu'on lui demandait. Contre OpenCode 2.0.31 :
    15 vérifications sur 15, rien à regarder, ≈ 2 min 30, 0 $ ; règles chargées = règles listées
    (ALPHA, CHARLIE, DELTA, ECHO, FOXTROT, HOTEL, INDIA). Contre la 1.19 sans modèle : 8 sur 8.
  - Écarts au plan : comparaison des sondes extraite dans `probe-report.ts` (re-exportée par
    `bob-probe.ts`, rien ne change pour `pnpm bob-probe`) ; les relevés qui varient avec le modèle
    (réflexion, jetons, rechargement du catalogue) ne sont pas comparés, seulement des faits
    stables. Pas d'ADR : décisions prises avec l'utilisateur dans le cadre de l'ADR-0011.
  - Limites : les sessions des sous-agents d'OpenCode 2 apparaissent dans « Reprendre une
    session… » (rien ne les distingue dans `session/list`) ; un fichier créé par `write` n'a pas de
    diff (absent du récapitulatif) ; un sous-agent lancé en arrière-plan (`background`) finit après
    le tour, sans suite visible (OpenCode n'envoie plus rien après la fin du tour).
- 2026-10-17 — Constat pendant un essai d'OpenCode 1.19 dans l'app : quand le modèle refuse
  (« Rate limit exceeded », modèles gratuits de Zen), OpenCode réessaie sans rien envoyer par ACP
  et ne termine pas le tour ; l'app affiche « Réfléchit… » sans fin, sans rien expliquer. Seul son
  journal (`opencode.log`) le dit. Rien à corriger dans l'app tant qu'OpenCode n'envoie rien ; une
  piste : signaler un agent silencieux depuis plusieurs minutes.
- 2026-10-17 — **OpenCode 1.19 refusé par les modèles gratuits, la 2 non.** Trace ACP brute
  (`opencode acp`, configuration jetable, `opencode/big-pickle`), deux essais coup sur coup : la
  1.19.0 reçoit « Rate limit exceeded » à chaque tentative et ne répond jamais ; la 2.0.31 répond
  « ok » en 3 s, sans erreur. L'OpenCode de l'utilisateur n'a aucun compte (`opencode auth list` :
  0 identifiant) : il n'utilise que ces modèles gratuits, d'où « OpenCode ne marche plus » dans
  Bobine. Cause côté service non connue.
  - **Aucun message d'erreur** : pendant 90 s après le `session/prompt`, la 1.19 n'envoie rien —
    ni mise à jour, ni réponse d'erreur, ni sortie d'erreur ; l'erreur n'est que dans son journal
    (`opencode.log`). Bobine attend une réponse qui ne vient pas. Pas vérifié pour la 2 (la panne
    provoquée n'en était pas une : le modèle local d'Ollama était seulement lent).
- 2026-10-17 — **Machine de l'utilisateur passée à OpenCode 2** (à sa demande) : `opencode upgrade
  --major` (méthode curl) → 2.0.32, même emplacement (`~/.opencode/bin/opencode`), signé « Anomaly
  Innovations » comme la 1.19. La 1.19 est sauvegardée dans `~/opencode-1.19-sauvegarde-2026-10-17`
  (binaire, configuration, sessions). Configuration lue telle quelle (elle ne contenait que le
  schéma) ; pas de `AGENTS.md` ni de `CLAUDE.md` globaux. OpenCode 2 fait tourner un service en
  arrière-plan (`opencode service status`). `pnpm opencode-probe` sur la 2.0.32 : contrat de l'app
  respecté, réponses identiques à la 2.0.31, modèle gratuit sans limite de débit.
  - **Défaut trouvé dans Bobine (essai réel, planche contact)** : OpenCode 2 appelle les outils de
    l'app par son outil `execute` (« Code Mode » : du JavaScript qui appelle les outils MCP), pas
    directement. Toutes les cartes s'appellent alors « execute », sans le libellé de l'outil de
    l'app, et la capture ou la planche n'apparaît pas sous la carte (elle est dans le contenu de
    l'outil, l'association de `AppToolsBridge` ne se fait pas). Le verdict « rien ne dépend des
    noms » de l'inventaire était donc faux pour les outils de l'app. À corriger (fiche à part).
  - Le modèle gratuit `opencode/big-pickle` ne lit pas les images (« this model does not support
    image input ») : avec lui, la planche contact ne sert à rien ; l'agent a reconstitué
    l'animation depuis la page, à tort. Avec un modèle qui voit les images (Bob), elle marche.
