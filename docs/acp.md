# ACP dans Bobine

**ACP** = Agent Client Protocol (protocole initié par Zed). JSON-RPC 2.0, messages ligne par ligne
sur stdin/stdout : le client (notre app) lance l'agent en sous-processus.

> À ne pas confondre avec l'*Agent Communication Protocol* d'IBM Research (agent-à-agent, fusionné
> dans A2A).

## Ce qu'on utilise

| Fonctionnalité ACP | Usage dans l'app |
|---|---|
| `initialize` | Négocier les capacités (images, fichiers…), authentification |
| `session/new` | Créer une session, **passer nos serveurs MCP** (McpHost) ; autres dossiers (`additionalDirectories`) si l'agent l'annonce, aussi à `session/load` / `session/resume` (fiche 179) |
| `session/prompt` | Envoyer texte, images (`image`), fichiers (`resource`, `resource_link`) |
| `session/update` | Streaming texte, appels d'outil, plan, diffs |
| `session/request_permission` | Boutons dans la carte de l'outil ; `cancelled` sur Stop / arrêt (fiche 006) |
| Modes / `session/set_mode` et options / `session/set_config_option` | Réglages dans la barre d'outils, mémorisés par profil (fiche 013) |
| Tous les messages, dans les deux sens | Montrés bruts (secrets masqués) dans l'onglet « Échanges ACP » du panneau, en mémoire, quel que soit le niveau du journal ; rien de lu ni de supposé d'un agent en particulier (fiche 135) ; `agents.log` en garde le résumé aux niveaux Détaillé et Trace (fiche 080) |

## Profils d'agent

Cible : **Bob**. OpenCode et l'agent factice servent aux essais. Claude Code et Codex ne sont plus
proposés (ils ont leur propre application) ; leurs relevés restent ci-dessous comme référence.

| Profil | Commande | Statut | Remarques |
|---|---|---|---|
| **Factice** | `node src/mock-agent/main.mts` | ✅ | Déterministe, scénarios scriptés — voir [mock-agent.md](mock-agent.md) |
| **Claude Code** *(retiré le 2026-10-11)* | `npx -y @agentclientprotocol/claude-agent-acp` | sondé | Ancien nom `@zed-industries/claude-code-acp`, déprécié |
| **Codex** *(retiré le 2026-10-11)* | `npx -y @agentclientprotocol/codex-acp` | testé (adaptateur 2.2.2) | Pas d'ACP natif dans Codex ; utilise la connexion de `~/.codex`. Son mode par défaut `agent` (« Auto review ») **ne demande jamais de permission au client** : l'app l'ouvre donc en **`workspace-write`** (demande avant d'écrire hors du dossier ou d'accéder au réseau). Sortie des commandes en contenu `terminal` ACP, pas encore affichée. Ancien nom `@zed-industries/codex-acp`, déprécié |
| **Bob** | `bob acp` | ✅ essayé jusqu'à la connexion (Bob 2.0.6) ; contrat sondé sur 2.0.9 (fiche 163) | Voir « Compatibilité Bob » ci-dessous |
| **OpenCode** | `opencode acp` | ✅ testé (OpenCode 2.0.31 et 1.19, modèles gratuits Zen) | ACP natif. Voir « Compatibilité OpenCode » ci-dessous. Clés des fournisseurs : `opencode auth login` (`~/.local/share/opencode/auth.json`) ou variables d'environnement (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`…, `OPENCODE_API_KEY` pour Zen) |

## Questions, plan et consommation selon l'agent (relevé le 2026-10-11)

| Agent | Questions à choix | Plan à valider | Consommation |
|---|---|---|---|
| Claude Code (adaptateur 0.89.1) | `AskUserQuestion` → élicitation `form` (`question_<n>` + `question_<n>_custom`, aperçus dans `_meta`) | `ExitPlanMode` → autorisation `switch_mode`, plan en contenu texte ; modes `default`, `acceptEdits`, `plan`, `auto`, `bypassPermissions` | `usage_update` (contexte) ; jetons du tour à vérifier |
| Codex (codex-acp 2.2.2) | Réglage « Collaboration mode » = Plan : élicitation `form`, question dans `title`, note `<clé>_note` (`_meta.codex.questionId`), réponse obligatoire | Autorisation `switch_mode` « Implement this plan? », plan dans `rawInput.plan` | `usage_update` (`used` / `size`) + `usage` du tour (entrée, sortie, cache, réflexion) ; pas de coût |
| OpenCode 1.18.31 | Aucune par ACP | Mode `plan` = pas de modification, sans validation | `usage_update` avec **coût** (`cost.amount`, `USD`) + `usage` du tour |
| OpenCode 2.0.31 (2026-10-16) | Outil `question` → élicitation `form` (`q0` + `q0_custom`, `toolCallId`) si le client annonce `elicitation.form` | Mode `plan` : refuse d'écrire de lui-même, sans validation | Identique à la 1.18 (fin de tour) |
| Bob 2.0.6 | Aucun outil de question par ACP : il pose ses questions en texte | Mode `plan` : plan en texte terminé par « Valides-tu ce plan ? », sans autorisation `switch_mode` ; on répond ou on repasse en mode `agent` | **Rien par ACP** (ni `usage_update`, ni `usage`) ; coût en bobcoins par tâche dans sa base locale `~/.bob/db/bob.db` (`tasks.costs`), lu en lecture seule par l'app |

Depuis la fiche 140 (ADR-0028), l'app ne lit plus les formes propres à Claude Code et à Codex (aperçu
en `_meta["_claude/askUserQuestionOption"]`, rôles inversés et note `_meta.codex`) : un questionnaire
se lit d'après le JSON Schema seul (`title` = en-tête, `description` = question, `required`,
« Autre » en `<clé>_custom`). Les lignes ci-dessus restent comme relevé.

## Particularités de Bob (d'après la doc IBM)

- ACP natif depuis la release d'août 2026, sans adaptateur.
- Authentification à l'`initialize` : `BOB_API_KEY` dans l'environnement, sinon **SSO**
  (jeton conservé ensuite sur la machine). → l'app doit gérer ce flux.
- **Confiance du workspace** vérifiée avant création de session : un workspace non approuvé fait
  échouer `session/new`. → écran d'approbation ou `--trust`.
- **MCP Elicitation** : des outils peuvent demander des informations en cours de session.
  Côté ACP : requête `elicitation/create` (mode `form` avec un JSON Schema, ou `url`).
  → formulaires inline dans le fil.
- Lancé à la main dans un terminal, `bob acp` semble bloqué : il attend un client sur stdio.

L'agent factice doit savoir **simuler** ces comportements (échec de confiance, demande d'auth,
élicitation) pour qu'on puisse les développer sans accès à Bob.

## Compatibilité Bob

**Bob Shell 2.0.9 est installé sur la machine de développement** (depuis le 05/11, paquet npm
`@ibm/bob`, commande documentée par IBM ; Bob se met désormais à jour tout seul, d'où la liste
`testedVersions` du profil et l'avertissement du Diagnostic). Les relevés plus bas ont été faits
sur **2.0.6** (script officiel, empreinte SHA-256 vérifiée), sauf mention de 2.0.9. Ses réponses
ACP ont été **sondées sans connexion** ; le reste vient de sa documentation et de son code.
Règle : ne rien supposer de non vérifié ni documenté.

**Ce qui change en 2.0.9** (fiche 163, sonde et essais le 05/11, 0 bobcoin) :

- **Licence** : un client qui annonce l'élicitation `form` (l'app le fait, fiche 011) n'est plus
  arrêté à `session/new` ; la licence est demandée **au premier message**, par un formulaire
  (`mode: form`, une case `accept` « I accept the IBM license agreement », message avec les chemins
  des fichiers de licence). Refusé : `session/prompt` échoue en `-32600` « A license agreement is
  required… », que l'app explique (« renvoyez votre message, puis acceptez-la dans le
  formulaire »). Sans élicitation, `session/new` échoue comme en 2.0.6 (panneau « Licence »).
- **Confiance** : en ACP, un dossier **jamais décidé** est traité comme approuvé ; seul un dossier
  marqué « Don't trust » (`DONT_TRUST` dans `~/.bob/trustedFolders.json`) est refusé, avec le
  message de 2.0.6 (panneau « Faire confiance »). `--trust` écrit toujours `TRUST_FOLDER`. Le
  « mode sans échec » (règles, skills, MCP et agents du dossier ignorés) ne vaut que pour Bob
  interactif.
- **Ordre à `session/new`** : mode demandé, confiance, connexion, puis licence (sans élicitation).
- **Mode de départ** : `_meta: { "bob/mode": "plan" }` à `session/new` (depuis 2.0.6) ouvre la
  session dans ce mode ; un mode inconnu est refusé (`invalidParams`). L'app s'en sert
  (`initialModeMeta` du profil).
- **Compaction** : `/compact` (nom principal depuis 2.0.3 ; alias `condense`, `compress`,
  `summarize`), utilisé par le profil depuis la fiche 165.
- **Journal de Bob** : en ACP, rien sur la sortie d'erreur ; un fichier par lancement dans
  `~/.bob/logs/shell/bob-shell-<date>.log`. Journal de l'app sur Trace : `BOB_LOG_LEVEL=debug`
  (fiche 165).
- Rien d'autre dans le contrat de l'app : capacités, connexion, coûts (`tasks`), quota par
  `/status` inchangés.

**SDK ACP 2.4** (fiche 181, 2026-11-06) : Bobine importe `@agentclientprotocol/sdk/unstable`
(protocole v1 complet, instable compris) par un seul module, `src/shared/acp-sdk.mts`
(ADR-0038). Sur le fil, rien ne change pour Bob : `pnpm bob-probe` (0 bobcoin) rend des réponses
**identiques** à la référence 2.0.9 et le contrat 10/10 ; la sonde hors ligne d'OpenCode 2.2.5
aussi. Retour au SDK 1.9 : un `git revert` du commit de montée, `pnpm install` (procédure et essai
dans la fiche 181).

**Autres dossiers** (`additionalDirectories`, fiche 179) : Bob 2.0.9 ne l'annonce pas (sonde du
2026-11-06) ; l'app ne lui envoie donc rien et ne propose pas d'en ajouter. Le jour où il
l'annoncera, la fonction marchera sans rien changer au profil. Recevoir le champ ne suffit pas
toujours : OpenCode le prend mais n'en dit rien à son modèle (recette 0.9, D13). L'app joint donc
au message une ligne de contexte en anglais (« Additional working directories for this
conversation: /a, /b », « …: none (removed /a) »), une fois par changement de la liste envoyée
dans la session, seulement quand elle a été envoyée : rien de nouveau pour un agent qui
n'annonce pas la capacité, Bob compris. Avant le premier message, la session rouverte est neuve :
l'ancienne, vide, est supprimée (`session/delete`, si l'agent l'annonce ; D14).

### Ce que Bob annonce réellement (`initialize`, Bob 2.0.6, identique en 2.0.9)

- `agentInfo` : `bob-shell`, titre « Bob ».
- `loadSession: true` ; `sessionCapabilities` : `list`, `resume`, `close`, `delete` (pas `fork`).
- `promptCapabilities` : images et contexte intégré ; MCP : `http`.
- `authMethods` : une seule méthode `sso` (« Log in with SSO », ouvre le navigateur).
- `_meta["bob/extensions"]` : version 1 (extensions propres à Bob, non documentées).

### Comportements vérifiés

| Situation | Réponse réelle de Bob |
|---|---|
| `session/new` dans un dossier non approuvé | Erreur `-32600` « Workspace "…" is not trusted. Pass --trust… or run Bob Shell interactively in this folder and choose a trust level, then reopen the ACP session. » |
| `session/new` avec `--trust`, sans clé ni SSO | Erreur `-32000` « Authentication required » (code ACP standard) |
| `session/new` avec `--trust` et `BOB_API_KEY` (clé factice) | Plus de demande de connexion (`authMethods` inchangé), mais erreur `-32600` « A license agreement is required. Review it with --show-license and accept it with --accept-license. » |
| `session/list` avant connexion | Répond (liste vide) |
| Connexion refusée **à un message** (session déjà ouverte) | **Relevé sur Bob 2.0.9** (fiche 200 ; `pnpm bob-probe`, sondage « refus au tour », trace `src/main/agent/__traces__/bob-2.0.9/`) : `session/prompt` répond `-32603` « Internal error », `data` `{"details": "ApiKeyError: {\"id\":\"harness\",\"title\":\"Request Failed\",\"description\":\"Invalid or expired API key.\"}"}` — **pas** `-32000`. Même réponse au message suivant de la même session. C'est la réponse de Bob à tout 401 de sa passerelle (`handleHttpError`) : clé d'API refusée (sonde : clé factice, licence déjà acceptée sur le Mac, 0 bobcoin) ou connexion SSO expirée (recette du 07/11 : jeton de rafraîchissement refusé après ~1 h 20, Bob se déconnecte — journal de Bob « Token refresh failed », « Logged out » — même message dans le fil). Une fois déconnecté, `session/new` (et la réouverture) répond `-32000` « Authentication required » (vérifié avec le vrai `~/.bob` expiré, sans message). `authenticate` `sso` lance la connexion dans le navigateur (`authenticate` de l'agent ACP de Bob ; pas déclenché par la sonde). L'app : profil Bob `authAtTurn.otherCodes` = `-32603` **et** « Invalid or expired API key » ensemble (un autre `-32603`, ou un « Authentication required » relayé d'un serveur MCP, reste une erreur de tour ordinaire), plus `authRequired` avec « Authentication required » gardé ; carte « Connexion expirée » générique (méthode `sso`, **clé d'API proposée** : Bob la préfère au SSO, et une clé refusée se remplace là), message renvoyé après `authenticate` dans la même session. Scénarios `connexion-expiree-bob` et `connexion-expiree-bob-tour` (erreur exacte), grille de conformité (parcours « connexion expirée au message ») ; essai réel de la reconnexion SSO **à faire** par l'utilisateur |
| Ordre des vérifications | Confiance du dossier **avant** l'authentification (2.0.9 : mode demandé, confiance, connexion, licence) |
| `--trust` (« faire confiance ») | **Mémorisé** : le dossier est ajouté à `~/.bob/trustedFolders.json` (pas seulement pour la session) |
| Modes (`session/new`) | `agent` (défaut), `plan`, `ask` ; pas d'options de configuration. Mode de départ par `_meta["bob/mode"]` (vérifié sur 2.0.9 ; inconnu : `invalidParams`) |
| Commandes annoncées | Skills (`create-skill`, `create-mode`, `configure-hooks`, `configure-mcp`, `build-mcp-server`, `office-insights`…) |
| Autorisation d'écriture | `request_permission` avec le diff, options `allow` / `allow_always` / `reject` ; le fichier n'est écrit qu'après accord |
| Autorisation d'une commande (`execute`, **relevé sur Bob 2.0.9**, fiche 211, trace `__traces__/bob-2.0.9/commande-hors-dossier-et-sudo-refusees.ndjson`, `bob acp` sans `--trust` ni `--auto-approve`) | `tool_call` `pending` puis `session/request_permission` : `kind: "execute"`, `title` = la commande brute, `rawInput: { command }` **seul** — ni `cwd`, ni `locations` (`[]` dans le `tool_call`, absent de la demande), ni `content`, ni `_meta`. Options `allow` (allow_once) / `allow_always` (allow_always) / `reject` (reject_once), sans rien sur ce que couvre « Always allow » (`allow_always` absent quand Bob exige un accord explicite : ligne « Approbations, suite »). `sudo` n'a aucun traitement à part. Refusée : deux `tool_call_update` `failed` de suite (le second avec « Tool call to execute_command was cancelled: Rejected by user »). Bob ne dit donc jamais qu'une commande écrit hors du dossier : l'app le lit dans `rawInput.command` (`permission-risk.ts`, générique : bandeau sur la carte, pas de « Toujours autoriser » quand un risque est repéré). Ce qui passe sans demande dépend des règles d'approbation de l'utilisateur (ligne suivante) : les lectures (`ls`, `cat … \| head`) et le `cat > ~/x << 'EOF'` vus sans carte le 2026-11-08 venaient de ses réglages, pas d'une règle propre à l'ACP (avec les défauts, même `ls` est demandé). « Always allow » retient la **commande exacte (chaque segment d'une commande enchaînée), pour la tâche (la session) seulement** (relevé du 2026-11-09, ligne suivante) |
| Règles d'approbation (`~/.bob/settings/settings.json`, partagé avec Bob IDE ; **relevé sur Bob 2.0.9 le 2026-11-09**, `bob acp` sans `--trust` ni `--auto-approve`, HOME jetable, traces brutes hors dépôt, 0,31 bobcoin) | **Héritées en ACP** : la section `approval` du fichier vaut pour `bob acp` comme pour `bob chat` et Bob IDE. Une commande passe sans `session/request_permission` (le `tool_call` va de `pending` à `completed`) si le groupe `execute` est dans `allowed_permissions` **et** chaque segment commence par une entrée de `allowedExecutors[execute_command].approvedCommands` : avec `"execute"` et `"echo"` ajoutés, `echo bobine-ok` passe ; `touch a.txt` est demandé. **Défauts** (pas de section `approval`) : `allowed_permissions: ["read"]` seulement, donc **toute commande est demandée, `ls` compris** (vu : `ls` puis `echo` demandés) ; liste `approvedCommands` par défaut `cat`, `git diff/log/rev-parse/show/status`, `grep`, `head`, `tail`, `ls`, `sort`, `wc`, `which`, `du`, `df`, qui ne sert qu'une fois `execute` permis. **`deniedCommands`** : refus **sans carte** — deux `tool_call_update` `failed`, le second avec « Tool call to execute_command was cancelled: Attempted to execute commands that are on the deny list: "rm". » (le modèle le lit ; l'app voit un outil échoué). **« Always allow »** (`allow_always`, proposé à chaque demande vue) : la commande exacte (`touch a.txt`) n'est plus demandée **dans la même session** ; une autre (`touch b.txt`) l'est ; dans une **nouvelle session** du même dossier, `touch a.txt` est redemandé. Bob l'enregistre dans la tâche (`approval_config.taskCommandApprovals` de la table `tasks`, avec `execute` ajouté aux `allowed_permissions` de la tâche), **pas** dans `settings.json` — que Bob réécrit pourtant au lancement (ajout de `approval.forbiddenApprovalGroups: []`, même sans section `approval`). **Dossier** : « Don't trust » refuse `session/new` (ligne plus haut), donc jamais d'outil ; un dossier **jamais décidé** est traité comme approuvé, approbations automatiques comprises (`ls` passé sans carte, `autoApprovalEnabled: true` dans la tâche). **Bobine ne passe jamais `--auto-approve`** : ce qui passe sans carte est ce que l'utilisateur a réglé pour Bob ; l'app n'en sait rien d'avance (aucun message ACP ne le dit) |
| Approbations, suite (**relevé sur Bob 2.0.9 et Bob IDE 2.3.0 le 2026-11-09**, fiche 213 ; `bob acp` en HOME jetable, client ACP d'essai, traces brutes hors dépôt) | **Format documenté** par IBM : [approval settings](https://bob.ibm.com/docs/shell/configuration/approval-settings) (`allowed_permissions` avec les groupes `read`, `edit`, `execute`, `mcp`, `skill`, `todo`, `subtask`, `subagent`, `mode` ; `permissionOptions[].enableOutsideWorkspace` ; `allowedExecutors[{toolId: "execute_command", approvedCommands, deniedCommands}]`, préfixe de la commande, la correspondance la plus longue gagne, égalité = autorisé ; fichier partagé avec Bob IDE). **`allow_always` n'est pas toujours proposé** : Bob l'omet quand il exige un accord explicite. Vu : `ls -la ~/.bob/settings/settings.json` → options `allow` / `reject` seulement, **même avec `--auto-approve`** ; écriture `write_file` hors du dossier avec `outsideWorkspaceAllowed: true` → `allow` / `reject`. Non vérifié : groupe interdit par une politique d'administration, commande que Bob ne sait pas découper. En revanche `curl … \| head`, `sudo -n true`, `cp README.md ../voisin/` et `rm` arrivent avec `allow_always` : **aucune vérification de sécurité des commandes n'a été constatée en `bob acp`** : le réglage « Command Security Verification » (un modèle qui classe la commande « dangereuse »), activé à l'écran de Bob IDE, n'a pas d'effet visible en ACP. **`--auto-approve`** fait tout passer sauf ces cas explicites. **`forbiddenApprovalGroups`** écrit par l'utilisateur est remis à `[]` par Bob au lancement (vu) : la clé ne vient en pratique que d'une politique d'administration, non essayée. **Relecture du fichier** (2.0.9, observation qui mêlait groupe et liste ; précisée sur 2.1.0, ligne « Règles d'approbation écrites par Bobine ») : une règle ajoutée pendant une session ne vaut pas pour cette session ; elle vaut pour la **session suivante** du même processus (`session/new`). **« Always allow » sur une commande enchaînée** retient chaque segment pour la tâche : après `cd <dossier> && npm test`, `npm test` seul passe. **« Always allow » sur une modification** : les modifications suivantes de la tâche passent (écriture puis insertion vues). **Liste de tâches** : `kind: "other"`, titre « Updating todo list », `rawInput.todos` = texte en cases à cocher (`[x] Vérifier\n[ ] Tester`). **Bob IDE, « Allow command globally »** (bouton « Add commands to global allow/deny list » sous la carte, variantes proposées : la commande entière et son premier mot) : ajoute le préfixe à `approval.allowedExecutors[execute_command].approvedCommands` (la liste par défaut y est recopiée), le retire de `deniedCommands` ; les autres clés du fichier sont gardées. **Sans le groupe `execute` permis, la liste n'a aucun effet** : la carte en cours reste affichée. Bob IDE relit le fichier quand il change ; qu'une règle écrite par un autre outil survive à une écriture de Bob IDE : vérifié ensuite (ligne « Réglages globaux de Bob IDE vus par `bob acp` ») |
| Demande d'autorisation retirée par l'agent (`$/cancel_request`, **relevé sur Bob 2.0.9 le 2026-11-09**, trace réelle `__traces__/bob-2.0.9/demandes-paralleles-cancel-request.ndjson`, fiche 214) | Bob envoie trois `session/request_permission` en parallèle (écritures de a.txt, b.txt, c.txt) ; la réponse `allow_always` à la première autorise le groupe « modifications » pour la tâche, et Bob envoie alors `$/cancel_request` pour les DEUX AUTRES demandes **parce qu'elles sont déjà autorisées**, puis les trois outils se terminent `completed` et les fichiers sont écrits : ce n'est pas un échec. Le SDK abandonne le signal de la requête (`signal` du gestionnaire, code -32800) : Bobine retire la demande (`permission-resolved`, `optionId: null`, `cancelledBy: 'agent'`), répond `cancelled` (permis par ACP) ; la carte disparaît sans bruit (ni « annulée », ni échec), la pastille d'attente tombe, l'outil garde l'état que l'agent lui donne ; une réponse de l'utilisateur arrivée après est sans effet. Même forme dans la trace 2.0.6 (`taches-autorisations-annulation`), après un Stop de l'utilisateur |
| Liste de tâches (`kind: "other"`, **relevé sur Bob 2.0.9 le 2026-11-09**, fiche 214, trace `__traces__/bob-2.0.9/liste-de-taches-autorisee-une-fois.ndjson`) | `rawInput.todos` est un texte à cases, une tâche par ligne : `[ ]` à faire, `[x]` fait (vus dans la trace) ; Bobine accepte aussi `[X]`, et `[-]` / `[~]` pour « en cours », et ignore les lignes sans case. La demande d'autorisation et le `tool_call` portent tous deux `rawInput.todos` ; Bob envoie ensuite un `plan` (entrées `pending` / `in_progress` / `completed`). Bobine lit `todos` (texte ou tableau) par `src/shared/todos.ts`, pour toute carte, sans regarder le titre ni le `kind` |
| Autres groupes en ACP (**relevé sur Bob 2.0.9 et Bob IDE 2.3.0 le 2026-11-09**, fiche 213 ; serveur MCP d'essai à deux outils, skill de dossier `.bob/skills/<nom>/SKILL.md`) | Tous arrivent en ACP avec **`kind: "other"`** : outil MCP (« Running Lire Meteo (essai) », `rawInput` = arguments), skill (« Using skill essai-banc », `{ skill_name }`), sous-agent (« Running subagent: … », `{ description, … }`), changement de mode (« Switching mode », `{ mode_id }`), liste de tâches (« Updating todo list », `{ todos }`). Options `allow` / `allow_always` / `reject`. **« Always allow »** : pour un outil MCP, **cet outil seulement** (le second outil du même serveur est redemandé) ; pour un skill, un sous-agent, un changement de mode : tout le groupe pour la tâche. `--auto-approve` : rien n'est demandé. `start_subtask` : jamais appelé par le modèle dans l'essai. Bob IDE, mêmes cas : cartes « Lire Meteo (essai) » (arguments en JSON), « Use Skill essai-banc », « Subagent (general) » (tâche affichée), « Switch mode to plan », boutons « Approve for task » (MCP) et « Approve skill / subagent / mode tools for task » ; mêmes portées. Un serveur MCP ajouté au dossier (`.bob/mcp.json`) n'est chargé par Bob IDE qu'au redémarrage. Conséquence : en ACP, seuls le `kind` et des titres propres à Bob distinguent ces groupes — **le `kind` ne suffit pas** à séparer MCP, skills, sous-agents, modes et liste de tâches |
| Réglages globaux de Bob IDE 2.3.0 (« Bob Settings », relevé à l'écran le 2026-11-09, fiche 213) | **Chat › Tool Auto-approval** (« appliqués à toutes les tâches ») : un interrupteur par groupe — Read (+ « Auto-approve reading files outside workspace »), Edit (+ même option pour l'écriture, « Proposed edit preview »), Execute (+ listes **Allowed Commands** et **Denied Commands** éditables, + **Command Security Verification**, activée), MCP, Mode, Subtasks, Subagents, Skills, Todo ; puis « Task limits » (Max Turns, coût). **MCP** : par serveur (portée Workspace ou globale, fichier `mcp.json`), par outil un interrupteur d'activation et une case **« Always allow »** (globale, valable dans toutes les tâches), délai réseau. **Modes** : Agent, Plan, Ask, et modes personnels. **Hooks** : globaux et par dossier (`settings.json`). Tout sauf la vérification de sécurité est lu aussi par `bob acp` (même fichier) |
| Réglages globaux de Bob IDE vus par `bob acp` (**relevé le 2026-11-09 avec le vrai profil de l'utilisateur**, profil d'essai, sauvegardé puis restauré ; fiche 213) | **Les interrupteurs de Bob IDE valent en ACP** : avec Edit, Todo, Skills activés pour toutes les tâches, écriture de fichier, liste de tâches et skill passent sans `session/request_permission`. **Le groupe MCP seul ne suffit pas** : un outil MCP reste demandé tant qu'il n'a pas sa case « Always allow » (écrite par Bob IDE dans le `mcp.json` du serveur : `"alwaysAllow": ["lire_meteo"]`) ; un serveur fourni par le client ACP (`session/new`) n'a pas cette case et reste demandé. **Execute** activé + commande de la liste (`git status`) : passe. **Moment** : un changement fait dans Bob IDE ne vaut pas pour la session ouverte, il vaut dès la session suivante du même processus `bob acp`. **Écriture par un autre outil** : Bob IDE relit le fichier aussitôt (sa liste affichée change) et garde la règle quand il écrit à son tour (`banc-externe` écrit à côté, puis `banc-ide` ajouté dans Bob IDE : les deux restent). **Piège** : quand `allowedExecutors` est absent, Bob utilise sa liste par défaut (`cat`, `ls`, `git status`…) ; écrire la clé avec une seule commande **remplace** cette liste (vu : Bob IDE n'affiche plus que la commande ajoutée). Bob IDE, lui, recopie la liste par défaut avant d'ajouter |
| Règles d'approbation écrites par Bobine (fiche 215, ADR-0044 ; [documentation d'IBM](https://bob.ibm.com/docs/shell/configuration/approval-settings) et essais du 2026-11-09 sur Bob 2.0.9, Bob IDE 2.3.0 et Bob 2.1.0) | **Défauts constatés** (pas de section `approval`) : seul le groupe `read` est permis (vu : `ls` demandé) ; liste `approvedCommands` de 15 commandes (cat, git diff, git log, git rev-parse, git show, git status, grep, head, tail, ls, sort, wc, which, du, df), celle que Bob IDE recopie dans le fichier à la première règle ajoutée. **Tableaux remplacés** : écrire `allowed_permissions` ou `allowedExecutors` sans recopier le défaut l'efface (vu : Bob IDE n'affiche plus que la commande ajoutée) ; Bobine recopie donc `read` et la liste, comme Bob IDE. Bob IDE ajoute une commande à une liste et la retire de l'autre (vu). Bob ajoute `forbiddenApprovalGroups: []` à `approval` au lancement quand la clé manque (vu). `autoApprovalEnabled` (vrai dans la tâche, vu) est lu par Bobine, jamais écrit ; ce que fait `false` n'est pas vérifié. Une politique d'administration pourrait interdire des groupes sans que le fichier le dise : non essayé, Bobine ne la verrait pas. Contrôle à chaque mise à jour : `pnpm bob-probe` (section écrite comme Bobine, relue après un lancement de `bob acp`) **Bob 2.1.0 (recette QA du 2026-11-09, puis essai ciblé dans une seule session, trace `approval-test/etape0/p3`)** : après écriture du fichier pendant une session ouverte (groupe `execute` ajouté, `echo` autorisée, `printf` refusée), **`printf` est refusée tout de suite** (liste relue à chaque appel), **`echo` reste demandée dans la session ouverte** (le groupe `execute` est figé pour la tâche) ; dans une nouvelle session, `echo` passe sans carte et `printf` est refusée. Règle exacte : **refusée partout = tout de suite ; autorisée partout = tout de suite seulement si le groupe `execute` était déjà permis au début de la conversation, sinon à la conversation suivante ; groupes = conversation suivante** (la recette avait vu « tout de suite » pour une autorisée parce qu'`execute` était déjà permis). `outsideWorkspaceAllowed` et `permissionOptions` en cours de session : non vérifié. Correspondance d'une règle (documentée par IBM, constatée) : mots de la règle en tête de ceux de la commande, la plus longue gagne, égalité = autorisée. **Contournement vu** : après « Refuser partout », Bob propose de passer par l'outil terminal de Bobine ; depuis la recette, les outils de l'app refusent une commande que les règles de l'agent refusent (fiche 215). `pnpm bob-probe` sur 2.1.0 : sondages d'approbation conformes, nouvelle colonne `is_unread` de `tasks` |
| Hooks de Bob en ACP (**relevé sur Bob 2.0.9 le 2026-11-09**, profil d'essai de l'utilisateur, fiche 213) | Événements de `bob` 2.0.9 : `SessionStart`, `UserPromptSubmit`, `PreCompact`, `PostCompact`, `PreToolUse`, `PostToolUse`, `Stop` (pas de `PermissionRequest`). Un hook `PreToolUse` (`settings.json` › `hooks`, groupe `matcher` + gestionnaires `command` ou `http`) **est appelé en ACP avant toute demande d'autorisation, aussi avec `--auto-approve`** : sortie 2 ou `permissionDecision: "deny"` → l'outil échoue **sans carte** (`tool_call_update` `failed`, texte = raison du hook) ; vu pour `rm a-supprimer.txt` (fichier intact), alors que `ls` passe au hook puis arrive en carte. `permissionDecision: "allow"` ne dispense pas de l'approbation (doc de Bob). Les garde-fous d'une équipe posés en hooks valent donc dans Bobine, quoi que Bobine réponde ensuite |
| Autorisations d'OpenCode 2.2.5 réglées sur `ask` (**relevé le 2026-11-09**, `opencode.json` jetable : `{"permission":{"edit":"ask","bash":"ask","external_directory":"ask","webfetch":"ask"}}`, modèle gratuit, fiche 213) | Écriture, commande et écriture hors du dossier demandées. **Identifiants d'options `once` / `always` / `reject`** (genres `allow_once` / `allow_always` / `reject_once`) : un client doit choisir par **genre**, pas par identifiant (ceux de Bob sont `allow` / `allow_always` / `reject`). « Always » est **proposé partout, hors du dossier compris**. Portée : après « always » sur une écriture, les écritures suivantes passent, **y compris dans une nouvelle session** du même processus ; après « always » sur `ls`, `ls -la` passe (motif sur la commande), `git status` est demandé. Écriture hors du dossier : deux demandes (écriture puis lecture du fichier voisin) |
| `session/load` | Rejoue l'historique (avec `user_message_chunk`) **après** sa réponse, pas avant comme le prévoit ACP |
| Coût d'un échange court | ≈ 0,02 bobcoin (≈ 10 000 jetons de contexte), ≈ 0,04 avec un outil |
| Commande longue (`sleep 150`, recette 0.11, M3) | Bob la met **lui-même** en arrière-plan : « Background process started (pid …) », et le tour finit aussitôt. Non documenté par IBM ; rien n'en est lu (aucune analyse de ce texte). Voir ci-dessous |

**Processus laissés par l'agent (fiche 195, M3)** : l'app lance chaque agent dans son propre groupe
de processus. Ce que l'agent lance **dans ce groupe** (commande en cours, commande mise en
arrière-plan par un shell ordinaire) est arrêté avec lui : en quittant Bobine, quand l'agent plante
(`kill -9`), quand la conversation est mise en veille ou que l'agent est arrêté. Rien n'en survit, et
rien n'est montré dans « En cours » (ce n'est pas un terminal ACP de l'app). Un processus que l'agent
**détache lui-même** (nouvelle session : `setsid`, shell détaché) n'est plus dans ce groupe : Bobine
ne le voit pas et ne l'arrête pas, ce peut être voulu (un serveur). Il n'existe pas de moyen simple et
fiable de le repérer depuis l'app (son parent disparaît, l'environnement d'un autre processus n'est
pas lisible sous macOS) : il n'est pas signalé. Scénarios factices `arriere-plan` (dans le groupe)
et `arriere-plan-detache` (détaché) ; essais de l'hôte d'agent et de l'e2e `pannes-visibles`. **À
vérifier sur le vrai Bob** (recette) : dans quel groupe est son processus d'arrière-plan
(`ps -o pid,pgid,command`). Un relevé dans le groupe de `bob acp` confirme qu'il est arrêté en
quittant ; dans un autre groupe, il continue après Bobine.

**Aparté (fiche 180)** : une question à côté ouvre une **deuxième** session chez Bob (`session/new`,
même dossier, `bob/mode` = `plan` par `initialModeMeta`), dans un second processus `bob acp`. Rien de
non documenté n'est supposé : la session est supprimée à la fermeture si Bob annonce
`sessionCapabilities.delete`, sinon fermée (`close`) ou laissée, et retenue par la conversation pour ne
pas reparaître dans « Reprendre une session… ». Son coût (relu dans la base de Bob, comme pour toute
session) s'ajoute à celui de la conversation. Non essayé avec le vrai Bob (pas disponible en
développement) : le coût d'un aparté court devrait être celui d'un échange court ci-dessus.

### Matrice

| Fonctionnalité | Bob | État dans l'app | Vérifié par |
|---|---|---|---|
| Lancement | `bob acp` | Profil `bob` → `bob acp` | Sondage réel |
| Flags dangereux | `--auto-approve`, `--trust` à éviter par défaut | Jamais passés par défaut | Test du profil |
| Environnement | Hérite de l'env de `bob acp` | `PATH` du shell de connexion (fiche 004) | Essai « Finder » |
| Clé API | `BOB_API_KEY` ; `BOBSHELL_API_KEY` est l'ancien nom, accepté (Bob **refuse de démarrer** si les deux diffèrent). Avec une clé, `session/new` passe sans SSO ; la clé n'est vérifiée qu'au premier message. Clé « générale » : exige `--team-id`, que `bob acp` n'accepte pas → clé personnelle | ✅ fiche 022 : clé saisie dans « Connexion requise » ou Réglages → Agents, chiffrée (trousseau), posée dans `BOB_API_KEY` au lancement, `BOBSHELL_API_KEY` retiré ; sinon celle de l'environnement | ✅ Bob réel 2026-10-13 (clé factice : session ouverte sans SSO ; deux noms différents : refus au démarrage ; 0 bobcoin) |
| Licence IBM | 2.0.6 : `-32600` « A license agreement is required. Review it with --show-license and accept it with --accept-license. » à `session/new`. **2.0.9** avec élicitation : formulaire au premier message (case `accept`), refusé → même `-32600` au `session/prompt` | ✅ fiche 022 : panneau « Licence à accepter », `bob --show-license` dans le terminal de l'app, « Réessayer » relance Bob ; jamais `--accept-license` par l'app. Fiche 163 : formulaire affiché comme toute élicitation (c'est l'utilisateur qui coche) ; refus au message expliqué (`agentHost.licenseAtPrompt`, motif `license` du profil) | Message relevé (clé factice, 2026-10-11) ; 2.0.9 : sonde (formulaire refusé, 0 bobcoin) ; scénarios `bob-licence-requise`, `bob-licence-formulaire` |
| **SSO** | Méthode `sso` | ✅ Panneau « Connexion requise » → `authenticate` (fiche 011) | ✅ Connexion réelle de l'utilisateur (2026-10-11) |
| SSO qui ne revient pas (fiche 207) | Rien de documenté : `authenticate` n'a pas de délai côté Bob, et la recette 0.11.1 l'a vu ne jamais répondre alors que la connexion était faite dans le navigateur | ✅ Générique, rien de supposé : pendant `authenticate`, « Réessayer » arrête l'agent et le relance (conversation : `retrySession` ; accueil : nouvel essai sans `authenticate`, l'agent du précédent arrêté) ; Bob relit sa connexion au démarrage. Cliqué trop tôt, la connexion en cours est coupée et la carte revient. Scénario `sso-sans-retour` | ⚠️ Essai réel avec Bob à faire par l'utilisateur |
| **Confiance du dossier** | Erreur `-32600` ci-dessus ; `--trust` mémorisé par Bob. **2.0.9** : en ACP, seul un dossier « Don't trust » est refusé (jamais décidé = approuvé) | ✅ Panneau dédié : terminal ici (commande `bob` proposée), Réessayer, ou « Faire confiance à ce dossier » (`--trust`, signalé comme mémorisé). Message reconnu, flag et commande déclarés par le profil Bob (`trust`, fiche 088) | Vrai Bob |
| Limite d'étapes (fiche 209) | `session.maxTurns` des réglages de Bob (100 par défaut, 0 = sans limite ; `--max-turns` n'existe que pour `bob run`, pas pour `bob acp`). **Comptée sur toute la session**, pas par tour comme le décrit ACP : le compte augmente à chaque requête au modèle et n'est pas remis à zéro dans un processus (vu). À la limite : `stopReason: max_turn_requests` (message coupé). Ensuite, **tout message est refusé en ~34 ms**, `max_turn_requests`, sans aucun `session/update` ni coût (essai du 2026-11-08), le message restant dans l'historique de Bob. Après une **relance** du processus, `session/load` remet le compte à zéro (vu) ; `session/load` ou `resume` **dans le même processus** : non vérifié | ✅ Générique : `max_turn_requests` → carte « s'est arrêté avant la fin » + « Continuer » ; sans aucun travail de l'agent pendant le tour (ni texte, réflexion, outil, plan) → carte « refuse de continuer ici » : « Rouvrir la session et continuer » (relance + `session/load` + message renvoyé une fois ; seulement avec `loadSession`, et pas deux fois de suite) ou « Nouvelle session avec le résumé » (ADR-0030, raison `turn-limit`). La file attend l'utilisateur. Rien n'est imposé au profil de Bob | Fil et journal de l'essai du 2026-11-08 (normal, sans `agents.log`) ; scénarios `limite-etapes-session`, `limite-etapes-tenace`. ✅ **Vérifié en réel 2026-11-09** (Bob 2.0.9, `session.maxTurns: 2` posé un moment) : limite comptée sur la session ; 2 lectures puis `max_turn_requests` en 4,0 s, « Continue » refusé en 6 ms sans mise à jour, relance + `session/load` (268 ms) remettent le compte à zéro, message renvoyé une fois, `end_turn` ; trace `__traces__/bob-2.0.9/limite-etapes-session-rouverte.ndjson` |
| Permissions / diffs | Diff dans la demande | ✅ fiche 006 | ✅ Bob réel (carte avec diff, « Allow once » → fichier écrit) ; grille 139 : « autorisation acceptée, puis refusée », « cycle d’un outil » |
| Refus et échecs (fiche 122) | Outil refusé (autorisation `reject_once`) ou outil MCP rendu en erreur : carte `failed` (relevé à la recette du 2026-10-23) | ✅ carte « refusé » pour une autorisation refusée (`reject_*`) ou un outil de Bobine refusé, « échec » pour un outil de Bobine en erreur ; générique, rien d'imposé au profil de Bob | Bob réel : à rejouer (scène 1.3) ; grille 139 : refus (titres bruts de Bob), trace reconstituée (refus puis Stop) |
| Récapitulatif des modifications | Diffs en **texte complet** (avant / après), outils `edit` passés à `completed` après « Allow once ». Fichier créé : `oldText: ""` (et non `null`) | ✅ fiche 021 (vide = créé) ; scénario `modifications` ; fiche 202 : règle générique, une fin d'outil **sans** le diff de sa demande d'autorisation le garde (rien de supposé sur Bob : instantanés des traces de Bob et grille `facon-bob` inchangés) | ✅ Bob réel 2026-10-12 (« Writing file » + « Applying diff to », 0,093 bobcoin) |
| Création d'un fichier (fiche 203, recette réelle 2026-11-08) | **2.0.9, trace `__traces__/bob-2.0.9/creation-fichier-neuf-autorisee-une-fois.ndjson`** : `tool_call` `pending` « Writing file <absolu> », `kind: edit`, `rawInput: { path (absolu), content, line_count }`, `locations` absolu, **sans contenu** ; puis `session/request_permission` (`allow` / `allow_always` / `reject`) avec `content: [{ type: diff, path (absolu), oldText: "", newText }]` — **`oldText: ""` pour un fichier NEUF**, comme pour un fichier vide réécrit ; `in_progress` ; fin `completed` avec le même diff (`oldText: ""`), `rawOutput.result` « Created file: <relatif> » | ✅ générique (`src/main/agent/new-files.ts`) : pour un outil `edit` pas encore lancé (`tool_call` en attente, demande d'autorisation), le main regarde une fois chaque chemin **absolu** proposé (`lstat`, rien n'est lu) ; absent → ses diffs `oldText: ""` deviennent `oldText: null` (convention de l'app : « Création de … », badge « nouveau fichier »), dans la demande comme dans la fin et donc dans le fil enregistré (réouverture) ; existant → « Modification ». Jamais pendant le rejeu de `session/load`, jamais pour un chemin relatif. Le `tool_call` sans contenu arrivé après la demande ne vide plus la carte (`tool-call-kept.ts`). Scénarios `creation-bob`, `modification-fichier-vide-bob` | ✅ Bob réel 2026-11-08 (1 message, ≈ 0,08 bobcoin, `bob acp` sans `--trust`, `trustedFolders.json` inchangé) |
| Premier lancement (fiche 188) | Rien de propre : `initialize`, `authenticate` (SSO), `session/new`, `session/prompt` (un message court), `session/cancel`, `session/delete` — tous documentés plus haut. Refus de session (connexion, licence, dossier) reconnus par `sessionBlocker` | ✅ essai « connecté ? » sans appel au modèle, « répond ? » sur demande ; agent lancé dans le dossier réservé de l'app, session d'essai dans un dossier jetable vide sous le dossier de données (jamais un projet : un Bob réglé pour tout approuver n'y fait rien) ; aucune autorisation d'outil (demande refusée, tour annulé) ; session notée avant le message, coût lu par la source du profil (Bob : sa base) **avant** la suppression — `session/delete` efface la ligne de coût chez Bob — puis gardé dans le journal de consommation ; supprimée après (`session/delete`, même après une annulation), sinon masquée et retentée au lancement suivant ; `--trust` jamais ajouté ; méthode `authenticate` seulement si l'agent l'annonce | ⚠️ Bob réel : **détection seulement** (`bob --version` → 2.0.9, 2026-11-07), aucune requête facturée ; l'essai réel reste à faire (coût : un message court, en bobcoins) |
| Suppression d'une session | `session/delete` accepté, la tâche disparaît de `~/.bob/db/bob.db` | ✅ fiche 026 (agent arrêté démarré le temps de la suppression, option dans la confirmation) | ✅ Bob réel 2026-10-12 (session de l'essai 021, 1 s, 0 bobcoin) |
| Worktree git | Session ouverte dans `<dépôt>/.worktrees/<nom>` sans nouvelle demande de confiance quand le dépôt est sous un dossier approuvé | ✅ fiche 036 | ✅ Bob réel 2026-10-12 (prêt tout de suite, 0 bobcoin) |
| Mode plan | Compétence `create-plan` ; plan écrit dans un fichier Markdown à la racine (autorisation demandée), réécrit en entier aux remarques, plan complet aussi dans la réponse ; reste en mode `plan` | ✅ fiche 040 (plan = fichier `.md` du tour) ; scénario `plan-fichier` | ✅ Bob réel 2026-10-12 (sondage, 0,34 bobcoin) |
| Modes / options | Modes `agent` / `plan` / `ask` ; mode de départ par `_meta["bob/mode"]` à `session/new` | ✅ génériques (fiche 013), Maj+Tab ; mode de départ dans `_meta` (`initialModeMeta`, fiche 163), refusé → `session/set_mode` | ✅ Bob réel ; `bob/mode` : 2.0.9 en HOME jetable (session ouverte en `plan`) |
| Historique de sessions | `loadSession` (rejeu **tardif**), `list`, `resume`, `close`, `delete` | ✅ fiche 015 ; rejeu tardif pris en compte ; sessions commencées ailleurs (`bob chat`, Bob IDE) reprises par « Reprendre une session… » (fiche 055) ; à la réouverture d'une conversation de l'app, le fil de Bobine est gardé et le rejeu de `session/load` ne sert qu'à ajouter les tours faits ailleurs entre-temps (fiche 103, ADR-0021) ; session perdue au « Relancer » (Bob ne la retrouve pas) : session neuve dans la même conversation, repère « Nouvelle session » et échange d'avant joint au prochain message (ADR-0030, rien de supposé de Bob : seule l'erreur de `session/load` compte) | ✅ Bob réel : conversation rechargée après redémarrage de l'app, puis continuée ; `session/list` réel 2026-10-14 (43 sessions, 11 dossiers, sans `nextCursor`), reprise rejouée sans prompt ; grille 139 : « reprise après redémarrage » (rejeu tardif) ; trace reconstituée `rejeu-tardif` |
| Liste de tâches | `plan` envoyé à chaque mise à jour de sa liste (todo, statuts `pending` / `in_progress` / `completed`, priorité) ; **chaque mise à jour demande une autorisation** (outil « Updating todo list », `kind: other`, `allow_once` / `allow_always` / `reject_once`) | ✅ Onglet « Tâches » (fiche 035), liste épinglée pendant le tour (fiche 077) ; « Toujours autoriser » retenu par l'app pour les conversations suivantes (fiche 042) | ✅ Bob réel 2026-10-13 (fiche 041) ; grille 139 : « plan » (`liste-taches`, une autorisation par mise à jour) |
| Conversations filles (étape 1) | Rien de propre à l'agent : une fille est une session ordinaire, ouverte dans un worktree (voir « Worktree git ») | ✅ fiche 097 : lancement par l'utilisateur ; compte rendu d'une fille envoyé à la mère en texte, dans le bloc placé avant le message de l'utilisateur (comme le contexte d'une branche) ; scénarios `modifications`, `permission`, `echo` | Bob réel : à faire (essais de la fiche 097, prompts 1 et 2) |
| Conversations filles (étape 2) | Rien de propre à l'agent : quatre outils de plus sur le serveur MCP `bobine` qu'il reçoit déjà (`start_child`, `message_child`, `child_status` à une mère ; `message_parent` à une fille), appelés comme `ask_user` (« Running Start Child (bobine) », autorisation accordée d'office par l'app). L'appel de `start_child` attend la carte « Tâches proposées » (fiche 112), dans la limite des ≈ 60 s d'un appel MCP chez Bob (même attente que `ask_user` : 45 s, puis réponse tardive) | ✅ fiche 097 : messages d'une autre conversation et réveil de la mère envoyés comme des prompts ordinaires, précédés d'un bloc de texte qui dit leur provenance ; scénarios `filles`, `filles-refus`, `filles-plafond`, `fille-message` | Bob réel : à faire (prompts 3 à 13 de la fiche 097) — à vérifier : que Bob se serve de `start_child` sans qu'on le lui dise, et finisse son tour pour attendre le réveil |
| Conversations filles proposées (fiche 118) | Rien de propre à l'agent : le contexte de session `<bobine_capabilities>` est du **texte ordinaire** joint au premier message de chaque session (comme le contexte d'une branche), seulement si la session a reçu `start_child` — en entier à une session neuve, en rappel de quelques lignes à une session rouverte (`session/load`, `session/resume`) et au message qui suit une compaction (fiche 223) ; `/split` joint de même `<child_conversations_request>`. Rien d'imposé au profil de Bob (ni mode, ni option, ni flag) ; le bloc ne nomme aucun agent ni ses outils. Chez Bob, le titre d'une tâche est le début du premier message : **tout ce que l'app joint** (contexte de session, `/split`, échange d'une bascule ou d'une branche, nouvelles des filles, provenance) part donc **après** le message (fiche 125, D18) ; un titre de session qui en porte encore la suite est coupé au premier bloc de l'app (`stripAppContext`), et il ne remplace jamais le titre d'une branche ni celui d'une conversation continuée avec un autre agent (D24) | ✅ fiche 118 : réglage « Proposer des conversations filles » (Jamais / Quand ça s'y prête / Toujours demander) ; scénario `chantiers` | ✅ Bob réel 2026-10-22 : avec le bloc, Bob juge les chantiers « ideal candidates for child conversations » et demande d'abord des précisions (`ask_user`) ; pas de proposition dans les 3 min de l'essai ; titre de tâche = message de l'utilisateur ; ≈ 2,9 bobcoins. À refaire plus long |
| Rôles (fiche 223, phase 2) | Rien de propre à l'agent : une fille ordinaire. La consigne du rôle est toujours du **texte ordinaire** dans le premier message, **après** la demande (`<bobine_role>`, comme tout contexte de l'app, fiche 125) ; le mode natif est posé en plus seulement s'il figure dans les modes ou options de catégorie `mode` que la session annonce (`session/set_mode` ou `set_config_option`), pour la fille seulement (jamais retenu comme défaut du profil). Bob demande un changement de mode avec `kind: "other"` : non attrapé par le refus de `switch_mode` (les écritures restent refusées). Aucun mode imposé au profil de Bob, aucun mode de Bob supposé (ses modes personnels ne sont pas lus). Lecture seule : réponse « refuser » (`reject_once`) aux demandes `edit`, `delete`, `move`, `switch_mode` — Bob demande avant d'écrire, `kind: edit` (traces 2.0.9) ; empreinte git du dossier comparée avant et après chaque tour, pour les agents qui écrivent sans demander (OpenCode, profil `writesWithoutAsking`). Liste des rôles dans la description de `start_child` et dans `<bobine_capabilities>` | ✅ agent factice : `roles-delegue`, `roles-inconnu`, `role-ecrit-avec-demande`, `role-ecrit-sans-demander`, mode natif `ask` présent ou absent (`echo`) | Bob 2.1.0 observé (2026-11-14, fiche 223) : propose de lui-même une fille avec `role` (« fais relire par l'expert sécurité » → `security-expert`, sans nommer `start_child`) ; dans une fille en lecture seule, demande l'écriture (`kind: edit`, « Applying diff… »), refusée par Bobine, continue sans s'arrêter et rend sa relecture, dossier inchangé ; une commande (`execute`) reste posée à l'utilisateur, avec son option `allow_always` (plus proposée depuis). Titre de la tâche tiré du début du premier message : la demande part donc avant `<bobine_role>` |
| Relecture avant fusion (fiche 177) | Rien de propre à l'agent : le relecteur est une fille ordinaire, dans le dossier de l'auteur ; sa consigne est un premier message ordinaire, et ses remarques reviennent par `report_findings`, un outil de plus sur le serveur MCP `bobine` (proposé à lui seul). Aucune option, aucun mode imposés : la lecture seule est demandée par la consigne et vérifiée par l'app (empreinte git du dossier), pas par un mode « lecture » d'un agent. À essayer avec Bob : qu'il appelle bien l'outil plutôt que d'écrire ses remarques en texte (sinon la carte dit « sans remarques structurées ») |
| Mémoire commune (fiche 182, ADR-0040) | Bob n'a **aucune mémoire documentée** ni de `sessionCapabilities.systemPrompt` (sonde 2.0.9). Rien de propre à l'agent : trois outils de plus (`remember`, `forget`, `recall`) sur le serveur MCP `bobine` qu'il reçoit déjà, qui répondent **tout de suite** (proposition seulement : pas d'appel ouvert, loin de la limite d'≈ 60 s d'un appel MCP) ; l'index `<bobine_memory>` et l'issue des propositions `<bobine_memory_outcomes>` sont du **texte ordinaire** joint au message (comme `<bobine_capabilities>`). Rien d'autre envoyé à Bob : ni `_meta`, ni option, ni fichier | ✅ génériques (fiche 182) ; appels autorisés d'office (la décision est la carte « Retenir ? ») | Agent factice (scénarios `memoire-*`, parcours `memory-flow.test.ts`) ; OpenCode réel (journal de la fiche 182). **À vérifier sur Bob réel à la recette** : qu'il lise l'index et appelle `remember` de lui-même (« Running Remember (bobine) ») |
| Repartir d'un message | Pas de `session/fork` ; aucune méthode ACP pour couper une session ; diffs en **texte complet** | ✅ fiche 023 : branche = nouvelle session qui reçoit l'échange repris en contexte ; fichiers remis en état d'après les diffs | ✅ Bob réel 2026-10-13 (contexte compris, fichier remis en état, ≈ 0,1 bobcoin par essai) |
| Continuer avec un autre agent | Rien de propre à l'agent : nouvelle session (`session/new`), l'échange d'avant en texte dans le bloc placé avant le premier message ; pas de choix de modèle par ACP chez Bob | ✅ fiche 108, ADR-0024 : même conversation, bascule posée dans le fil ; destination affichée d'après le profil (« service en ligne d'IBM Bob ») ; scénario `contexte-recu`, second agent factice `BOBINE_MOCK_PEER=1` | Bob réel : à faire (vers Bob depuis OpenCode, et l'inverse) ; grille 139 : « changement d’agent » (vers la persona OpenCode) |
| Panne réseau, 429 (fiche 142) | **Non relevé** : ni le format de l'erreur de `session/prompt` quand le modèle est injoignable (VPN, proxy, DNS), ni celui d'une limite de débit. Rien n'est supposé : l'app reconnaît les formats génériques (codes de Node, d'undici et de Bun, `fetch failed`, `Connection error.`, 429, `Too Many Requests`, `RESOURCE_EXHAUSTED`, 502/503/504 d'un proxy) dans le message, `data` (Bob 2.0.6 met la cause dans `data.details`) et la sortie d'erreur du tour. Budget épuisé (`BudgetExceededError`) : pas une panne passagère | ✅ fiche 142 : 5 tentatives (2, 4, 8, 16, 32 s), tout de suite au retour du réseau ou au réveil ; point d'extension `transientError` du profil, vide pour Bob ; scénarios `reseau-instable`, `reseau-coupe`, `limite-debit` | ⏳ **à relever avec Bob** : couper le Wi-Fi pendant un tour, lire `agents.log` (erreur de `session/prompt` et sortie d'erreur) ; si Bob réessaie lui-même sans rien dire par ACP (comme OpenCode 1.19, fiche 078), l'app n'y voit qu'un agent silencieux |
| Stop / panne | `session/cancel` honoré tout de suite (tour `cancelled` en 5 ms) ; processus tué en plein tour puis relancé : `session/resume` rouvre la même session en ≈ 1 s, sans rejeu, et Bob se souvient du début. Depuis la fiche 103, la relance passe par `session/load` (≈ 500 ms) : le rejeu **tardif** arrive pendant que le message qui a relancé Bob part (D21, recette 2026-10-23, scène 2.7) | ✅ fiche 041 : « Relancer » (ou un nouveau message) garde le fil de l'app et reprend la session. Fiche 121 : le message attend que le rejeu soit arrivé et calme (300 ms sans mise à jour, 2 s au plus, puis envoyé quand même avec un `WARN` au journal), puis le rejeu est réconcilié comme au ⌘Q ; scénario `--rejeu-tardif-ms` | ✅ Bob réel 2026-10-13 (0,29 bobcoin pour les deux sondages) ; fiche 121 : agent factice seulement, **scène 2.7 à rejouer avec Bob** (délai réel du rejeu dans le journal : « Rejeu de la session calme … après … ») ; grille 139 : « annulation », « panne puis relance » (rejeu tardif à 50 ms) |
| Consommation | Rien par ACP | ✅ Coût en bobcoins lu dans `~/.bob/db/bob.db` (adaptateur `costSource` du profil Bob, `bobDbCosts`, ADR-0015 ; lecture seule, ignoré à la moindre surprise) ; dépense du jour, des 7 jours et du mois dans le détail de la consommation. Fiche 109 : coût **par échange** = différence du coût cumulé entre l'envoi et la fin du tour ; le coût relu après la réponse (fin de tour, puis 1,5 s plus tard) revient au tour qui vient de finir tant qu'aucun autre n'a commencé ; coût de la conversation dans la liste et l'en-tête. Rien de supposé de plus : pas de jetons pour Bob. Fiche 130 : chaque tour a sa ligne dans le journal de consommation (`usage.sqlite`, ADR-0025), sans jetons ni modèle (Bob n'expose pas de réglage de catégorie `model`) ; le coût relu après coup réécrit la ligne du même tour. Scénario : `--cout-bob` (`MOCK_AGENT_USAGE=bob`) | ✅ Bob réel (0,0632 bobcoin affiché = valeur de Bob) ; coût par échange : agent factice seulement, **à essayer avec Bob** ; grille 139 : coût par la base (`--cout-bob`), fil durable comparé après la relecture du coût |
| Budget du compte | **Rien par ACP** (extensions : seulement `_bob/task/export` et `_bob/task/import`). Bob lit budget mensuel et consommation auprès de son service, avec la connexion de l'utilisateur ; Bobine ne l'interroge pas : elle lit l'écran `/status` de `bob chat`, seul endroit où Bob les affiche (« Monthly Budget », « Monthly Usage », « Unlimited » sans plafond ; montants à deux décimales) ; rien dans sa base locale. `bob chat` crée une tâche vide à son lancement (sans `directory` : absente de `session/list`), que `session/delete` retire | ✅ fiche 091, ADR-0017 : au démarrage, `bob chat --trust --disable-mcp --disable-subagents` dans un dossier réservé, `/status` tapé dans un pseudo-terminal, écran relu ; tâche vide supprimée par `session/delete` (identifiant lu sur l'écran, ou tâches vides du dossier dans `bob.db`). Bob se connecte lui-même : aucun jeton de Bob réutilisé (décision du 2026-10-13 respectée). Affiché sous le nom de l'agent, détail au clic ; scénario : faux `/status` (`MOCK_AGENT_QUOTA=1`) Dossier réservé **unique par machine** (D6, recette 0.11) : `~/Library/Caches/Bobine/agent-status/bob` (sous `BOBINE_CONFIG_HOME` en essai), jamais un par profil de Bobine : `--trust` est **mémorisé** dans `~/.bob/trustedFolders.json` (voir plus haut) et aucune autre voie documentée ne lance `bob chat` sans demander le niveau de confiance, donc Bob ne retient qu'une entrée. Les anciennes entrées `…/Application Support/Bobine*/agent-status/bob` (et celles des profils temporaires) peuvent être retirées à la main de ce fichier ; l'app n'y touche pas. Lecture abandonnée après 20 s ; après un échec (Bob pas connecté…), pas de lecture au lancement pendant 12 h (`<dossier>/bob.pause.json`), une relecture demandée passe ; jamais avec `--agents-neufs` (dossier personnel vide : rien de connecté, D11) | ✅ Bob réel 2026-10-20 (budget et consommation lus, 4,9 s, 0 bobcoin, aucune tâche laissée) ; sonde : options de `bob chat --help` |
| Budget épuisé | **Non provoqué.** Forme attendue, celle des autres refus de Bob relevés (`ApiKeyError: {…}` au tour, fiche 200) : JSON-RPC `-32603` « Internal error », cause dans `data.details` = `<Nom>Error: {"title":…,"description":…}` (par exemple `BudgetExceededError`) | ✅ `errorMessage` affiche « titre — description » ; scénario `budget-depasse` | Non vérifié avec Bob réel |
| Commande sans sortie (fiche 157) | **Non relevé** : rien n'indique que Bob 2.0.6 suive l'extension de terminal que l'app annonce (`_meta.terminal_output`) ; dans les relevés, la sortie de ses commandes arrive en texte dans le contenu de l'outil | Avis « Aucune sortie depuis N min » et « Interrompre » (`session/cancel`, comme ■) **seulement** pour une commande dont l'agent envoie la sortie au fil de l'eau (extension de terminal, fiche 018) ; rien d'imposé au profil de Bob ; scénario `commande-silencieuse` | ⏳ **à vérifier avec Bob** : s'il transmet un jour la sortie en cours (extension, ou `tool_call_update` à contenu croissant), l'avis pourra la suivre ; aujourd'hui, rien ne s'affiche chez lui |
| Plafond de coût (fiche 157, ADR-0035) | Coût en bobcoins dans sa base locale (voir « Consommation »), relu à la fin de chaque tour et, depuis la fiche 157, à la fin de chaque outil | ✅ plafond générique sur la consommation déjà calculée (devise du coût, sinon jetons) ; tour interrompu par `session/cancel` à la fin de l'outil en cours, carte « Continuer » / « Arrêter », « Continuer » renvoie un message ordinaire ; aucun cas propre à Bob hors de `bob-costs.ts` ; scénarios `cout-qui-monte`, `jetons-sans-cout` (`--sans-cout`) ; grille 139 : « plafond de coût » (carte en bobcoins pour Façon Bob, en dollars pour Façon OpenCode, aucune sans consommation) | ⏳ **à vérifier avec Bob** : qu'il écrive le coût de la tâche **pendant** le tour (sinon le plafond n'est vu qu'à la fin du tour : carte sans interruption) ; que `session/cancel` à la fin d'un outil arrête bien la suite |
| Serveurs MCP | Charge aussi **ses propres serveurs** (`~/.bob/settings/mcp.json`, `<dossier>/.bob/mcp.json`, `disabled` respecté) ; accepte les serveurs stdio et `http` du client ; appel d'outil abandonné après ≈ 60 s ; autorisation demandée pour chaque outil (« Running Screenshot (bobine) », `allow` / `allow_always` / `reject`, « toujours » valable pour la session seulement) ; **images des résultats transmises au modèle mais pas au client** | ✅ Serveur d'outils de l'app (fiches 028, 029) : outils sans risque autorisés d'office **si le titre suit exactement ce format** (« Running <Outil> (bobine) » ; OpenCode : `bobine_<outil>` — fiche 071 : un titre approché est signalé au journal, et l'autorisation demandée), images affichées par l'app ; navigateur intégré (fiche 007) utilisé par Bob sans consigne | ✅ Bob réel |
| Images et fichiers | `image`, `embeddedContext` | ✅ Blocs `image`, `resource`, `resource_link` (fiche 005) | ✅ Bob réel (image + fichier mentionné) |
| Commandes « / » | Skills + prompts MCP (`serveur:commande`) via `available_commands_update` ; `/compress` (non annoncée) compacte la conversation | ✅ Menu « / » (fiche 017) | ✅ Bob réel (6 skills) ; scénario `commandes-en-cours` (fiche 139) |
| Fichiers d'exclusion (fiche 155) | `.gitignore` (réglage `respectGitIgnore`, vrai par défaut) puis `.bobignore` de chaque dossier, de la racine du dossier de travail à celui du fichier, bibliothèque `ignore`, et `.env` toujours ; un fichier est exclu dès qu'un dossier, de la racine vers le bas, l'exclut (une négation `!` plus profonde ne le ré-inclut pas, contrairement à git, où le fichier le plus profond gagne) ; lecture et écriture refusées (« Access denied: … matches an ignore pattern (.bobignore or .gitignore) ») — ordre et portée **non vérifiés en réel**. **Inconnu** : ce que Bob fait du texte du message (rien n'indique qu'il le filtre) | ✅ adaptateur `exclusions` du profil Bob (`bob-exclusions.ts`, lu par `exclusions.ts` avec la même bibliothèque) : fichiers exclus non proposés aux mentions `@`, sautés par `@git-changes` (et c'est dit dans le bloc envoyé), confirmation avant de les joindre ; même ordre que Bob (et non celui de git) ; `respectGitIgnore` de Bob non lu (toujours vrai pour l'app). Rien d'imposé au profil de Bob | Agent factice (même déclaration), e2e `mentions`, `attachments` ; Bob réel : à faire (mention d'un fichier de `.bobignore` refusée par Bob lui-même ?) |
| Règles | `AGENTS.md` du dossier, `.bob/rules/**`, `.bob/rules-<mode>/**` (dossier, `~/.bob`, greffons `.bob/plugins/*`), seulement dans un dossier approuvé (non vérifié) | ✅ fiche 056 : listées dans « Réglages de la session », aperçu | ✅ Bob réel 2026-10-14 : règles listées = règles appliquées (mots de code, mode agent : pas `rules-plan`), 0,031 bobcoin |
| Skills | Lus dans `.bob/skills`, `.bob/plugins/*/skills`, `.agents/skills`, `.claude/skills` (dans `~` et dans le dossier, celui-ci seulement s'il est approuvé ; priorité `.bob` > `.agents` > `.claude`) ; anciennes commandes `commands/*.md` converties en skills. Annoncés comme commandes « / », filtrés selon le mode. Chaque utilisation demande une autorisation (« Using skill <nom> », `kind: other`) | ✅ Rien à faire : menu « / », autorisation, « Toujours autoriser » retenu (fiche 042) | ✅ Bob réel 2026-10-13 (skills de test dans les 4 emplacements du dossier et dans `~/.bob/skills`, `~/.agents/skills` ; `/bonjour-claude` exécuté, 0,043 bobcoin) |
| Skills (OpenCode 1.19) | Dossier : `.agents/skills`, `.claude/skills`, `.opencode/skill(s)`, `.opencode/command/*.md`. Global : `~/.agents/skills`, `~/.claude/skills`, `$XDG_CONFIG_HOME/opencode/skill(s)` et `command/` (par défaut `~/.config/opencode`). Annoncés comme commandes « / », sans autorisation | ✅ Rien à faire, sauf `XDG_CONFIG_HOME` / `XDG_DATA_HOME` repris du shell de connexion (`shell-env.ts`) : lancée depuis le Dock, l'app chercherait sinon au mauvais endroit | ✅ OpenCode réel 2026-10-13 (`HOME` jetable : 5 emplacements globaux annoncés ; `XDG_CONFIG_HOME` suivi) |
| Questions à choix / plan à valider | Pas d'outil de question par ACP ; utilise l'outil `ask_user` fourni par l'app (MCP HTTP) — fiche 028 | ✅ Cartes génériques (fiche 016) : questionnaire reconnu dans un formulaire, plan sur une autorisation `switch_mode` | Claude Code (code de l'adaptateur), Codex réel |
| Élicitation MCP | Documentée | ✅ Formulaire généré / page web, validés côté main (fiche 011) | Agent factice (formes réelles de Bob inconnues) ; grille 139 : « élicitation » (`bob-elicitation`) |
| Sous-agents | Outil `spawn_subagent` (actif par défaut, `--disable-subagents`) : autorisation demandée, puis seulement l'appel d'outil et son résultat `<task_result>` ; rien de la session du sous-agent, pas de `subagent_update`. Coût du sous-agent dans sa propre tâche (`parent_id`), non ajouté au parent | Carte « Sous-agent » (type, consigne, réponse sans `<task_result>`) ; coût de la conversation = tâche + sous-agents ; durée et coût du sous-agent en direct sur sa carte (fiche 053) | ✅ Bob réel 2026-10-13 (≈ 0,054 bobcoin), fiche 010 ; coût en direct : agent factice, ✅ Bob réel 2026-10-14 (coût relu 0,0029 → 0,006 → 0,0094 pendant les 8 s du sous-agent, = base de Bob ; 0,080 bobcoin l'essai) ; grille 139 : « sous-agent, message envoyé pendant » (`sous-agent-bob`, message en file) |
| Télémétrie | Statistiques d'usage envoyées par défaut (désactivables dans `/settings` de Bob) | — | Script d'installation |

### Contrat testé automatiquement (fiche 139)

Ce qui précède est vérifié, à chaque `./scripts/verify`, par la **grille de conformité**
(`src/main/conformance/`, ≈ 10 s) : treize parcours joués par le vrai gestionnaire de conversations
contre trois personas de l'agent factice — « façon Bob » (vrai profil `bob` : rejeu tardif, coût
par la base, `spawn_subagent`, titres bruts, modes sans options), « façon OpenCode » (vrai profil
`opencode` : patch en `pending {}`, `execute`, sous-agents en arrière-plan, `usage_update`) et
« ACP minimal » (agent déclaré dans les réglages, vrai profil personnalisé de la fiche 141 : ni
`loadSession`, ni images, ni plan, ni usage ; après une panne ou un redémarrage, session neuve qui
reçoit l'échange d'avant, ADR-0030). Parcours : prompt ; autorisation
acceptée puis refusée ; plan ; cycle d'un outil ; annulation ; panne puis relance ; reprise après
redémarrage ; sous-agent avec un message pendant ; compaction ; élicitation ; file d'attente ;
changement d'agent. À la fin de chacun : plus rien « en cours », pas de doublon, fil enregistré
(relu comme au lancement) identique au fil affiché, état de l'agent cohérent.

S'y ajoutent les scénarios aux limites joués à travers l'app (`limits.test.ts` : réseau coupé,
429, gros diff, binaire, 1 Mio de sortie, commandes en cours de session, textes difficiles,
démarrage lent) et les **traces ACP** rejouées (`src/main/agent/__traces__/`, instantané) :
`pnpm bob-probe --traces` et `pnpm opencode-probe --traces` enregistrent les échanges de leurs
sondages, nettoyés ; en attendant, trois traces sont reconstituées d'après les journaux de la
recette d'octobre (Bob 2.0.6 : tâches, autorisations, refus, Stop ; rejeu tardif. OpenCode 2.0.32 :
`execute` en erreur, sous-agent en arrière-plan mêlé au parent, patch).

Ce que la grille ne dit pas : le comportement réel de Bob ou d'OpenCode (seules leurs formes
relevées sont jouées) ; l'interface (pas d'e2e) ; le suivi d'un sous-agent par sa session
(rejeu de traces).

**Essais réels avec Bob** (2026-10-11, compte de l'utilisateur) : environ 0,22 bobcoin pour l'ensemble
(sondages, mode plan, trois écritures autorisées, reprise après redémarrage).

### Sonde du contrat (fiche 048)

`pnpm bob-probe` rejoue contre le Bob installé les sondages **gratuits** de cette section
(`initialize`, `session/list`, dossier non approuvé, dossier « Don't trust » (2.0.9), connexion
requise, licence avec une clé factice — à `session/new`, puis au premier message avec le formulaire
refusé (2.0.9) —, deux clés différentes), relit les colonnes de la table `tasks` de `~/.bob/db/bob.db`, et
vérifie la lecture du quota (fiche 091) : options de `bob chat --help` (rien d'autre n'est lancé ;
les libellés du panneau `/status` se vérifient dans l'app, « Budget du compte »). La sonde
n'observe que le comportement de Bob : elle ne lit jamais son code.
Aucun message n'atteint le modèle (0 bobcoin) : le seul message envoyé (« ping », 2.0.9) est
arrêté par le formulaire de licence, refusé, et la clé est factice. Bob tourne dans un `HOME`
jetable, sans la clé de l'utilisateur et télémétrie coupée : sa connexion, ses dossiers approuvés et son historique ne sont
ni lus ni modifiés. Seul `bob.db-shm` est rafraîchi par la lecture du schéma, comme à chaque lecture
des coûts par l'app. Les sondages qui demandent une session ouverte (modes, commandes, `session/load`)
restent manuels : ils exigent une vraie connexion, et l'app n'accepte jamais la licence.

Deux résultats :

- **Contrat de l'app** : ce que le code attend de Bob — capacités (`mcp.http`, `loadSession`,
  `resume`, `delete`, méthode `sso`), code `-32000`, messages reconnus (`main/agent/bob-contract.ts`,
  partagé avec l'hôte d'agent et le profil Bob), colonnes des coûts et lecture du quota. Un ✗ veut
  dire qu'une fonctionnalité de l'app ne marchera plus avec cette version de Bob.
- **Réponses** comparées à `scripts/bob-probe.expected.json` (enregistrées sur Bob 2.0.6) : chaque
  écart est listé (« chemin : attendu → obtenu »).

À lancer après chaque mise à jour de Bob Shell. Après un écart : mettre à jour cette section et la
matrice, corriger l'app si le contrat est rompu, puis `pnpm bob-probe --accept` pour enregistrer les
nouvelles réponses.

`--traces` enregistre aussi les échanges ACP de chaque sondage, nettoyés (secrets masqués, chemins
remplacés), dans `src/main/agent/__traces__/bob-<version>/`, rejoués par `trace-replay.test.ts`
(fiche 139).

### À chaque nouvelle version de Bob (fiche 198)

Bob ne tourne pas en CI (bobcoins, identifiants IBM) : ce suivi reste à la main. Dans l'ordre, du
gratuit au payant ; s'arrêter dès qu'une étape suffit.

1. **Version** : `bob --version` (gratuit, rien d'envoyé). Tant qu'elle n'est pas dans
   `testedVersions` du profil, l'app le dit une fois dans la conversation (par version
   majeure.mineure pour une version plus récente) et dans le Diagnostic.
2. **Sonde** : `pnpm bob-probe` — **0 bobcoin** (`HOME` jetable, clé factice, licence refusée,
   télémétrie coupée). Contrat de l'app (✗ = une fonction cassée), réponses comparées à
   `scripts/bob-probe.expected.json`.
3. **Coûts** : la sonde relit les colonnes de `tasks` dans `~/.bob/db/bob.db` (lecture seule). Une
   colonne disparue : `bob-costs.ts` à revoir, puis un échange court réel pour voir le coût bouger
   (≈ 0,02 bobcoin).
4. **Quota** : la sonde vérifie les options de `bob chat --help` ; puis un essai de « Budget du
   compte » dans l'app (≈ 5 s, 0 bobcoin, aucune tâche laissée) confirme les libellés de `/status`.
   Un libellé changé : `bob-status.ts` à revoir.
5. **Protocole** : la sonde affiche la `protocolVersion` rendue ; une autre que celle de l'app, et
   l'app refuse de démarrer Bob en le disant (fiche 198) — mise à jour du SDK ACP nécessaire.
6. **Accepter** : sonde verte ou écarts compris et documentés ici → `pnpm bob-probe --accept`,
   version ajoutée à `testedVersions` (un test vérifie que celle de la sonde y est), ligne dans le
   suivi de la fiche concernée.
7. **Essais réels payants** (seulement si un écart touche un comportement : modes, autorisations,
   sous-agents, reprise) : scènes de la matrice ci-dessus, ≈ 0,22 bobcoin pour l'ensemble
   (relevé du 2026-10-11).

Plancher (`minVersion` du profil) : **aucun** pour Bob, faute d'incompatibilité documentée. Une
version plus ancienne que 2.0.6 n'est qu'un avertissement dans la conversation.

## Compatibilité OpenCode

**OpenCode 2.0.31** (sorti le 2026-10-16 en parallèle de la 1.19 ; `opencode upgrade --major`
remplace la 1) a un ACP réécrit (`packages/cli/src/acp`). Relevés réels, modèle gratuit
`opencode/big-pickle`, `HOME` et `XDG_*` jetables (fiche 078) :

| Sujet | OpenCode 2.0.31 | Dans l'app |
|---|---|---|
| `initialize` | `loadSession` ; `list`, `resume`, `close`, `fork`, **`delete`**, `additionalDirectories` ; MCP `http` (plus `sse`) ; méthode `opencode-login` (`type: terminal` seulement si le client annonce `auth.terminal`) ; `_meta["opencode/child-session-updates"]` | Générique ; suppression proposée |
| Réglages | « Model », « Session Mode » (`build`, `plan`), « Effort » pour un modèle à variantes ; le modèle par défaut peut changer juste après `session/new` (`config_option_update`) ; pas de `modes` | Générique (fiche 013) |
| Commandes | `compact`, `init`, `review` annoncées ; **2.2.5** : `goal` en plus (« keep working until an objective is met [pause\|resume\|clear] », sans `input`), relevé sans modèle le 2026-11-05 (fiche 172) | `/compact` de l'agent ; `/goal` proposée dans le menu « / » comme toute commande annoncée et envoyée telle quelle (générique, pas de commande de l'app du même nom) |
| `session/list` | Sans dossier : toutes, y compris celles des sous-agents ; `nextCursor` toujours présent ; sessions vides « New session - <date> » | Sessions vides masquées (fiche 055) |
| `session/load` | Rejeu **avant** la réponse ; session d'un autre dossier : `-32602` ; sessions créées par la 1.19 rechargées et continuées | Générique |
| Sous-agents | Outil `subagent` (titre « subagent », `kind: think`, `rawInput: { agent, description, prompt }`), résultat `<subagent sessionID="ses_…" state="completed">`, `rawOutput.metadata.sessionID`. **Tout le travail du sous-agent** (réflexion, outils, texte) arrive dans le flux du parent, même `sessionId`, marqué `_meta["opencode/child-session"] = { id, parentID, depth, title }`, outils `ses_…:<id>` titrés « <titre> : <outil> » (avec la capacité client `opencode/child-session-updates`, il passerait par la méthode `opencode/session/child_update`, que l'app n'annonce pas) | Rangé **sous la carte** du sous-agent (`opencode-contract.ts`, profil `subagentStream`) ; session rechargeable (« Voir son travail ») ; grille 139 : « sous-agent, message envoyé pendant » (`sous-agent-bob`, message en file) |
| Questions | Outil `question` → `elicitation/create` | Questionnaire (fiche 016) |
| Compaction | `compaction_update` + `compaction_summary_chunk` (le client annonce `session.compaction`) | Carte de compaction |
| Mémoire (fiche 182) | Aucune mémoire propre ; pas de `sessionCapabilities.systemPrompt` (sonde 2.2.5) ; outils MCP `bobine_remember`, `bobine_forget`, `bobine_recall` comme les autres outils MCP | Index au premier message, et de nouveau après une compaction (`compaction_update`) |
| Liste de tâches | **Ni outil de liste, ni `plan`** | Rien ; la sonde surveille ; grille 139 : « plan » (`liste-taches`, une autorisation par mise à jour) |
| Diffs | `edit` : fichier entier (`oldText` / `newText`) et `metadata.files`. 2.0.32 : outil `patch` (modèles GPT), un diff par fichier. Les diffs sont recalculés sur le fichier **actuel** (patch de `rawOutput.metadata.files[]` appliqué à l'envers), en direct comme au rejeu : au rejeu, un fichier changé depuis n'a plus de diff, un fichier créé a son contenu actuel. **`write` (2.2.5, traces `__traces__/opencode-2.2.5/creation-*`, fiche 202)** : `tool_call` `pending` titré « write », `kind: edit`, `locations: []`, `rawInput: {}` ; puis `in_progress` avec `locations` (chemin absolu) et `rawInput: { path, content }` (au rejeu : dans le `tool_call`, `path` relatif) ; fin `completed` avec **un seul texte** « Created file successfully: <fichier> » (nouveau) ou « Wrote file successfully: <fichier> » (existant), `rawOutput.metadata: { truncated }`, **ni diff ni `metadata.files`**. Le diff n'existe que dans `session/request_permission` (permission `edit: ask`) : `toolCall.content[]` avec `oldText` (`null` pour un fichier créé) | Diff manquant refait depuis `rawOutput.metadata.files[].patch` (`{ file, patch, additions, deletions, status }`), un extrait par bloc (`opencode-diffs.ts`, profil `diffSource`, fiche 096). Fiche 202 : **pour tout agent**, une fin d'outil sans le diff de sa demande d'autorisation le garde (`tool-call-memory.ts`) ; **propre à OpenCode** (`diffSource`), un `write` fini par « Created file successfully » reçoit le diff « rien → `rawInput.content` », d'après ce que ses mises à jour précédentes ont dit. Reste : un fichier **réécrit** par `write` **sans** demande d'autorisation n'a aucun ancien texte connu, il n'est pas compté (rien plutôt qu'un diff faux) |
| Outils | `shell` (titre = commande), `read`, `glob`, `grep`, `edit`, `write`, `patch`, `subagent`, `question`, `execute` (« Code Mode » : du JS qui appelle d'autres outils) ; les outils MCP passent par `execute` (`tools.bobine.<outil>(…)` dans `rawInput.code`, envoyé en `in_progress`, parfois **après** l'appel MCP) | Appel MCP rattaché à la carte en cours dont le code cite l'outil, même si le code arrive après (fiche 079) ; libellés à la suite, captures sous la carte. Code Mode coupable seulement dans la configuration d'OpenCode (`codemode: false` par serveur), pas par ACP |
| Erreurs des outils (fiche 122) | La carte `execute` est dite `completed` même quand un outil appelé a échoué ; l'erreur est dans `rawOutput.metadata` : `toolCalls[]` (`tool`, `status: "error"`) et `error: true` (relevé 2.0.32, recette du 2026-10-22). Un outil MCP rendu sans `isError` est « completed » | Carte en échec (`toolStatus` du profil, `opencode-contract.ts`) ; la sonde vérifie que `toolCalls[].status` est toujours là. Les outils de Bobine rendent `isError` à un refus ou une erreur, et l'app met elle-même la carte « refusé » ou « échec » |
| Connexion expirée (recette 0.9, D10) | `session/prompt` refusé : `-32000` « Authentication required: provider authentication required » (`RequestError.authRequired`, code ACP standard ; relevé dans le binaire 2.2.5), la session ouverte et gardée | Générique, d'après le code et l'indice du profil dans le message (`authAtTurn.pattern` ; sans lui, erreur de tour ordinaire). Qu'OpenCode garde ou non le message refusé dans son historique (non relevé), la réouverture ne le prend pas pour un tour venu d'ailleurs. Carte « Connexion expirée » avec l'étape du profil (`opencode auth login`), statut dédié ; « Réessayer » relance l'agent, rouvre la session et renvoie le message une fois, sans repasser par « prêt » ; confirmation si des outils avaient tourné (`turn-auth.ts`). **Fiche 210** : le même refus vient d'un modèle dont le fournisseur n'est pas connecté — 2.2.5 liste aussi les modèles d'un fournisseur aux identifiants présents mais invalides, et rien dans `configOptions` (ni `group`, ni drapeau) ne le dit : seul `session/prompt` le révèle. Avec un réglage de catégorie `model`, la carte nomme le modèle (« Le modèle … n'a pas répondu ») et propose « Choisir un autre modèle » : le choix (`session/set_config_option`) renvoie le message une fois, dans la même session, sans relancer l'agent. Le modèle refusé est retenu par `(profil, modèle)`, en mémoire, et marqué « connexion à faire » dans le sélecteur (effacé par un tour réussi avec lui ou une reconnexion) ; l'identifiant n'est jamais découpé, aucun modèle n'est sondé (`refused-models.ts`) |
| Autorisations | **Aucune demande** par défaut, même hors du dossier (`external_directory` autorisé) | Rien d'imposé (décision du 2026-10-16) ; la règle à ajouter est dans `docs/agents.md` |
| Cartes d'autorisation (fiche 203, recette réelle) | Commande : le dossier répété dans `locations` (égal au dossier de la commande) ; écriture d'un nouveau fichier demandée avec un diff `oldText: null`. **Commande dans un autre dossier (2.2.5, traces `__traces__/opencode-2.2.5/commande-*`, `pnpm opencode-probe --only commande --traces`)** : `tool_call` `pending` titré « shell », `rawInput: { cwd: <dossier> }`, `locations: [<dossier>]` ; puis `in_progress`, titre = commande, **`rawInput: { command, workdir }` avec `workdir` RELATIF tel que le modèle l'a écrit** (`"docs"`, `"../autre"`) et **`locations: [{ path }]` ABSOLU résolu** (`<dossier>/docs`, `<maison>/autre`) ; `session/request_permission` reprend cette carte (`kind: execute`, `status: pending`), une seule demande même hors du dossier (permission `bash: ask`) ; refusée : `failed`, « The user declined this tool call » | Générique : un emplacement égal au dossier d'un `execute` n'est pas répété ; un `edit` dont chaque diff a `oldText` nul est une création ; `oldText: ""` ne l'est que si le main a constaté le fichier absent quand l'outil a été proposé (voir « Création d'un fichier » dans « Compatibilité Bob »). Dossier relatif (`commandFolderOf`) : résolu depuis le dossier de la conversation **pour l'affichage seulement**, et seulement s'il est confirmé par un emplacement absolu de l'agent égal au chemin résolu, sans `..`, `~` ni `$` (« Dans projet/docs », emplacement masqué) ; avec `..`, le chemin absolu entier, emplacement gardé ; sinon la valeur brute, emplacement gardé. Alerte « hors du dossier » sur le chemin résolu (`..` compris), et, au moindre doute, dès qu'un emplacement de l'agent est hors du dossier — vaut pour Bob s'il envoie la même chose |
| Règles | `~/.config/opencode/AGENTS.md`, tous les `AGENTS.md` du dossier jusqu'au dossier personnel (hors de celui-ci : jusqu'à la racine du dépôt, ou le dossier seul), `instructions` ; plus de `CLAUDE.md` | Règles choisies d'après la version annoncée (fiche 056) |
| Configuration | Mêmes fichiers que la 1 ; format natif `mcp.servers.<nom>` (`disabled`), `permissions` en tableau, `agents`, `commands`… ; `cli.json` pour le terminal | Serveurs MCP des deux formats (fiche 025) |
| Fournisseurs de modèles (fiche 104) | Bloc `provider.<id>` (`npm: "@ai-sdk/openai-compatible"`, `name`, `options.baseURL`, `options.apiKey: "{env:VAR}"`, `models.<id>.name`), `enabled_providers` (seuls proposés), `disabled_providers` ; `{env:VAR}` lu dans l'environnement de `opencode acp` ; `NODE_EXTRA_CA_CERTS` et `HTTPS_PROXY` honorés (relevé 2.0.32 du 2026-10-21, faux point d'accès) | Réglages › Agents › Fournisseurs de modèles : écrits dans le fichier, clé chiffrée dans le trousseau et posée par la variable, « Tester » (`GET /models` par le même proxy et les mêmes certificats), réseau d'entreprise pour tous les agents |

### Sonde de suivi (fiche 078)

`pnpm opencode-probe` rejoue ces relevés contre l'OpenCode installé, dans un `HOME` et des `XDG_*`
jetables (configuration, connexions et historique de l'utilisateur ni lus ni modifiés) :
`initialize`, réglages et commandes, `session/list` / `load` / `resume` / `delete` (sans modèle) ;
puis, avec un modèle gratuit de Zen : réponse et consommation, sous-agent (format, marque, session
rechargeable), question, outils de l'app (un faux serveur MCP « bobine » : l'appel est-il rattachable
à sa carte, par son titre ou par le code d'une carte en cours ?), édition, édition rejouée après
un changement du fichier (le diff refait depuis le patch, fiche 096), fichier créé, réécrit et
modifié par `write` et `edit`, autorisation accordée d'office puis demandée (`edit: ask`, accordée
une fois dans le bac à sable), puis session rouverte (fiche 202), liste de tâches,
`/compact`, règles chargées (mots de code) comparées à celles que liste l'app, et, sans modèle, les
fournisseurs de modèles (fiche 104 : un faux point d'accès compatible OpenAI, en HTTP, en HTTPS
auto-signé avec `NODE_EXTRA_CA_CERTS`, derrière un faux proxy `HTTPS_PROXY`). Rien n'est autorisé : une demande d'autorisation est notée,
puis refusée (sauf le sondage « création (autorisation demandée) », fiche 202, dans le dossier
jetable). ≈ 2 min, 0 $.

Trois résultats :

- **Contrat de l'app** : ce que le code attend d'OpenCode, vérifié avec le code de l'app lui-même
  (`opencode-contract.ts`, `subagent.ts`, `questions.ts`, `rules.ts`). ✗ : une fonction de l'app ne
  marche plus avec cette version ; ? : le modèle n'a pas fait ce qu'on lui demandait, relancer.
- **À regarder** : ce qu'OpenCode fait de nouveau et que l'app pourrait utiliser — un `plan` ACP
  (liste de tâches : onglet Tâches, fiche 035 ; liste épinglée, fiche 077), un outil de liste de
  tâches, `subagent_update`, une mise à jour ACP inconnue de l'app.
- **Réponses** comparées à `scripts/opencode-probe.expected.json` : chaque écart est listé.

Options : `--opencode <commande>` (ex. `~/.opencode2/bin/opencode`), `--model <id>`, `--offline`
(sans modèle), `--accept`, `--only <nom>` (seulement les sondages avec modèle dont le nom contient
`<nom>`, ex. `--only création` ; pas avec `--accept`). À lancer après chaque mise à jour d'OpenCode. Après un écart : mettre à
jour cette section et `docs/agents.md`, adapter l'app si le contrat est rompu, puis
`pnpm opencode-probe --accept`. `--offline --accept` ne remplace que les réponses des sondages
gratuits et les note sous `offline` (version, date) ; la version du dernier passage avec modèle
reste celle de `opencodeVersion`, et c'est elle que le profil compte parmi les versions testées
(fiche 172).

Suivi des versions :

| Version | Sonde | Écart | Suite |
|---|---|---|---|
| 2.0.32 (2026-10-17) | complète, `opencode/big-pickle` | — | réponses de référence |
| 2.2.5 (2026-11-05) | sans modèle (`--offline --accept`) | `session/new.commands` gagne `goal` ; contrat de l'app vert | reste : sonde avec modèle gratuit, puis `--accept` et `testedVersions` du profil |
| 2.2.5 (2026-11-06) | complète, `openai/gpt-6.1-sol` (abonnement de l'utilisateur, connexion copiée dans le profil jetable), **SDK ACP 1.9.0** : base de comparaison de la fiche 181 | contrat de l'app **21/21** ; `modifications rejouées.tools` `edit` → `patch` et `session/new.options` + `effort:thought_level` (dépendent du modèle, rendus génériquement, diff toujours refait) ; `édition.createdFileDiff` `false` → `true` | **pas d'`--accept`** : modèle payant, `big-pickle` reste la référence ; même sonde à rejouer sur le SDK 2.4.0 (fiche 181) |
| 2.2.5 (2026-11-07) | `--only création --traces`, `opencode/big-pickle` (fiche 202) | `write` fini sans diff (« Created » / « Wrote file successfully »), diff seulement dans la demande d'autorisation ; contrat « fichier créé par write compté » vert en direct et rouvert | sondages `création (…)` nouveaux dans les attentes : à accepter au prochain passage complet avec `big-pickle` |

| 2.2.6 (publiée le 2026-11-06) | **pas encore essayée** | — | première sonde hebdomadaire en CI ; correctif de la 2.2 essayée : aucun avis dans la conversation, le Diagnostic la dit non essayée |

**En CI, chaque semaine** (fiche 198) : `.github/workflows/opencode-probe.yml` (lundi 06:17 UTC,
et à la main dans l'onglet Actions) télécharge la dernière release `vX.Y.Z` d'OpenCode sur GitHub
(binaire Linux, vérifié avec le `SHA256SUMS` de la release par `scripts/ci/fetch-opencode.sh` ;
OpenCode 2 n'est pas sur npm) et lance
`pnpm opencode-probe --offline`. Linux, sans secret, 10 min au plus, ≈ 1 min en pratique. Un échec
= OpenCode a changé : lire le résumé du job, puis la procédure ci-dessus. Jamais de modèle en CI.

`--traces` enregistre les échanges de chaque sondage, nettoyés,
dans `src/main/agent/__traces__/opencode-<version>/` (fiche 139).

## Sous-agents

Le SDK 1.8 expose un événement **instable** `subagent_update` : le parent annonce une session
enfant (titre, description, état `running` / `idle`…), puis les `session/update` de l'enfant arrivent
sur la même connexion avec son propre `sessionId`. Les agents qui ne l'implémentent pas montrent leurs
sous-agents comme de simples appels d'outil (ex. outil Task de Claude Code).
Relevé du 2026-10-13 (fiche 010) : **ni Bob 2.0.6 ni OpenCode 1.19** ne l'implémentent. Bob : outil
`spawn_subagent` (« Running subagent: … », `kind: other`, autorisation demandée) ; OpenCode : outil
`task` (`kind: think`, `rawInput.subagent_type`). Dans les deux cas, seul le résultat final arrive
(`<task_result>…</task_result>`). Le scénario factice `sous-agent` sert de référence.

Depuis la fiche 140 (ADR-0028), ces formats sont lus par le profil de chaque agent
(`subagentFormat` : `bob-subagents.ts`, `opencode-subagents.ts`) ; l'hôte d'agent pose une marque
générique `_meta["bobine/subagent"]` (sous-agent, session à rejouer) sur la mise à jour, et le
reste de l'app ne lit que cette marque. Un agent sans `subagentFormat` garde de simples appels
d'outil.

Ce que l'app en tire quand même (fiche 053, relevé le 2026-10-14) :
- **Durée** (les deux) : début au premier `in_progress` (Bob l'envoie une fois le lancement
  autorisé), fin à `completed` / `failed` ou à la fin du tour.
- **Coût en direct** (Bob) : Bob crée une ligne par sous-agent dans `~/.bob/db/bob.db`
  (`parent_id` = tâche de la conversation, `task_type: subagent`, titre = `mask` ou consigne) et
  réécrit son `costs` à chaque dépense. L'app la relit toutes les 2 s pendant le travail. Bob ne
  garde pas les messages du sous-agent (table `messages` vide pour lui).
- **Travail rejoué** (OpenCode) : la réponse nomme la session enfant (`<task id="ses_…">`), que
  `session/load` rejoue depuis un autre processus (consigne, outils, réponse) ; `session/list` ne
  la montre pas.
- **Travail en direct** (OpenCode 2, fiche 078) : le travail du sous-agent arrive dans le flux de
  la conversation, marqué `_meta["opencode/child-session"]` ; l'hôte d'agent le range sous la carte
  (même description que le titre de la session du sous-agent, sinon la plus ancienne carte en
  cours), évènement `subagent-update`. Ses outils et sa réponse s'affichent dans la carte dépliée,
  sans rejeu ; un outil du sous-agent qui demande une autorisation sort dans le fil.

## Références

- Doc Bob Shell ACP : https://bob.ibm.com/docs/shell/features/acp
- SDK TypeScript : `@agentclientprotocol/sdk` 2.4 (entrée `unstable`, par `src/shared/acp-sdk.mts`)
- Client de référence open source : le panneau agent de Zed
