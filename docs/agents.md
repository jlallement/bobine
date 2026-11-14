# Agents : ce qui est commun, ce qui est propre à chacun

Bobine pilote deux vrais agents, **IBM Bob** (la cible) et **OpenCode** (modèles gratuits),
plus un agent factice pour les essais, et tout agent ACP que l'utilisateur déclare dans Réglages ›
Agents (fiche 141). Cette page dit ce que l'app fait avec chacun, et pourquoi.

OpenCode : relevés sur **OpenCode 2.0.31** (fiche 078). La 1.19 reste prise en charge ; ses écarts
sont notés « 1.19 : … ». `pnpm opencode-probe` dit ce qui change à chaque mise à jour d'OpenCode.

**Règle** ([ADR-0011](adr/0011-fonctions-propres-a-un-agent.md)) : le générique d'abord. Ce que
permet le protocole ACP marche pour tous les agents, sans cas particulier. Une fonction propre à un
agent est déclarée dans son profil (`src/main/agent/profiles.ts`), qui porte aussi son code
([ADR-0015](adr/0015-adaptateurs-dans-le-profil.md)), visible dans l'app, listée ici sous son
repère, et sa fiche dit « Agents : … ».

**Dans l'app** : Réglages › Agents, ouvrez la page d’un agent. Vous y trouvez « Ce qu’il
annonce » (première table ci-dessous, d’après son dernier démarrage) et « Propre à <agent> »
(deuxième table, tirée du profil : `src/main/agent/capabilities.ts`). Un test vérifie que chaque
repère des deux tables figure sur cette page.

## Annoncé par l'agent (protocole ACP)

Relevé à `initialize` (Bob le 2026-10-14, OpenCode 2.0.31 le 2026-10-16), sans appel au modèle.

| Repère | Fonction | Bob 2.0.6 | OpenCode 2.0.31 |
|---|---|---|---|
| `reopen` | Reprendre une conversation de l'historique : le fil de Bobine est gardé (ADR-0021) ; avec `session/load`, les échanges faits ailleurs entre-temps sont ajoutés à la fin ; avec `session/resume` seul, rien n'est rattrapé ; sans l'un ni l'autre (ou session perdue), session neuve qui reçoit l'échange d'avant en texte (ADR-0030) | ✓ `session/load` (rejeu après la réponse), `session/resume` | ✓ `session/load`, `session/resume` ; sessions de la 1.19 comprises |
| `list` | Reprendre une session commencée ailleurs (`session/list`) | ✓ 43 sessions relevées, tous dossiers | ✓ dont des vides et celles des sous-agents |
| `delete` | Supprimer la session chez l'agent | ✓ | ✓ (1.19 : ✗, la session reste chez OpenCode) |
| `images` | Images dans les messages | ✓ | ✓ |
| `embedded-files` | Contenu des fichiers joints | ✓ | ✓ |
| `app-tools` | Outils de l'app (navigateur, simulateur, questions…) par MCP HTTP | ✓ | ✓ (1.19 : aussi SSE ; 2 : appelés par `execute`, rattachés à sa carte, fiche 079) |
| `additional-directories` | Autres dossiers dans une conversation (onglet Session), donnés à `session/new`, `session/load`, `session/resume` ; un changement rouvre la session, fil gardé (fiche 179) | ✗ non annoncé (2.0.9) : ligne absente, rien envoyé | ✓ `sessionCapabilities.additionalDirectories` (2.0.31+) |

Annoncé mais pas encore utilisé par l'app : `session/fork` (OpenCode).

## Propre à un agent (déclaré dans son profil)

| Repère | Bob | OpenCode | Pourquoi |
|---|---|---|---|
| `cost-bob-db` | ✓ bobcoins lus dans `~/.bob/db/bob.db`, en lecture seule, sous-agents compris | — : coût en USD envoyé par ACP (`usage_update`), générique | Bob n'envoie rien par ACP (fiche 019) |
| `quota-bob-status` | ✓ plafond et consommation du mois selon le serveur de Bob, lus au démarrage par `/status` de `bob chat` (tâche vide supprimée) ; après un échec (Bob pas encore connecté), relus quand Bob se montre prêt (session ouverte, fiche 205) | — : pas de quota | Bob n'envoie rien par ACP ni en local (fiche 091, ADR-0017) |
| `subagent-cost-bob-db` | ✓ coût de chaque sous-agent, relu toutes les 2 s pendant qu'il travaille | — : rien par ACP, ni dans un fichier lisible | Bob réécrit le coût du sous-agent à chaque dépense (fiche 053) |
| `subagent-calls` | ✓ outil `spawn_subagent`, titre « Running subagent: … », type dans `rawInput.name` (`bob-subagents.ts`) | ✓ outil `subagent` (`rawInput.agent` + `prompt`), 1.19 : `task` (`subagent_type`) ; session nommée dans la réponse ou `rawOutput.metadata.sessionID` (`opencode-subagents.ts`) | Aucun agent ne dit par ACP qu'un appel d'outil lance un sous-agent : le format du profil le reconnaît, l'hôte pose la marque générique `_meta["bobine/subagent"]` que lit le reste de l'app (fiches 010, 140) |
| `subagent-replay` | — : Bob ne garde pas les messages de ses sous-agents | ✓ « Voir son travail » rejoue la session `ses_…` du sous-agent, à part | Session du sous-agent nommée dans sa réponse, rechargeable (fiche 053) |
| `subagent-live` | — : Bob ne transmet que le résultat | ✓ travail du sous-agent (outils, réponse) rangé en direct sous sa carte, pas dans le fil | OpenCode 2 relaie ce travail dans le flux de la conversation, marqué `_meta["opencode/child-session"]` (fiche 078) |
| `subagent-background` | — : pas de sous-agent en arrière-plan relevé chez Bob | ✓ sous-agent dont l'outil rend la main avec `metadata.status: "running"` gardé « en cours » après le tour ; sa session `ses_…` relue (comme « Voir son travail ») jusqu'à ce qu'elle finisse par une réponse, montrée dans la carte | OpenCode 2 lance des sous-agents en arrière-plan et n'envoie plus rien après la fin du tour (fiche 122) |
| `replay-diffs` | — : pas de diff perdu relevé chez Bob | ✓ diff d'une modification refait depuis `rawOutput.metadata.files[].patch` quand OpenCode ne le joint plus ; diff d'un fichier **créé** par `write` refait depuis son entrée (`rawInput.content`) quand la fin dit « Created file successfully » (fiche 202) | Au rejeu, OpenCode recalcule ses diffs sur le fichier actuel et les perd s'il a changé depuis (fiche 096) ; son `write` (2.2.5) ne joint jamais de diff, sauf dans la demande d'autorisation (fiche 202). Le texte de Réglages › Agents ne cite encore que le rejeu (texte à valider) |
| `execute-errors` | — : Bob marque lui-même en échec un outil en erreur | ✓ carte `execute` en échec quand un appel porte `status: "error"` (ou `isError`, `error: true`) dans `rawOutput.metadata.toolCalls[]` | OpenCode 2 dit « completed » la carte de son outil `execute` même quand un outil appelé a échoué (fiche 122) |
| `writes-without-asking` | — : Bob demande avant d'écrire (`kind: edit`, refus possible) | ✓ réglé par défaut, OpenCode écrit sans demander (relevé 2.2.5) | Rôle en lecture seule (fiche 223) : Bobine ne peut refuser que ce qu'on lui demande ; pour cet agent, la lecture seule n'est que demandée (dit dans le fil de la fille), sauf mode natif choisi par le rôle (`mode: plan`) ; Bobine compare le dossier avant et après chaque tour et signale tout changement |
| `hidden-empty-sessions` | — | ✓ sessions « New session - <date> » masquées dans « Reprendre une session… » | OpenCode garde les sessions ouvertes sans message ; l'app en ouvre une avant chaque premier message (fiche 055) |
| `start-mode` | `_meta["bob/mode"]` à `session/new` (2.0.6+, vérifié sur 2.0.9) : `plan` ou `agent` | — | Mode de départ d'une nouvelle conversation demandé dès l'ouverture ; refusé (`invalidParams`) : session ouverte sans, puis `session/set_mode` comme pour les autres (fiche 163) |
| `agent-log` | `~/.bob/logs/shell/bob-shell-<date>.log` (un par lancement, rien sur la sortie d'erreur en ACP) ; `BOB_LOG_LEVEL=debug` quand le journal de l'app est sur Trace | — | Journal propre à l'agent (`logFiles`, `traceEnv` du profil, fiche 165) |
| `always-scope` | ✓ « Toujours » retenu par Bob jusqu'à la fin de la conversation : une commande et chacune de ses parties, toutes les modifications de fichiers (relevé sur 2.0.9, fiche 213) ; la carte dit « Toujours dans cette conversation » et la portée | — : sans déclaration, « Toujours autoriser » et « C'est l'agent qui décide ce que couvre « toujours » » (le « always » d'OpenCode survit à une nouvelle session) | Portée déclarée par le profil, jamais devinée dans l'UI (fiche 214, ADR-0011) |
| `compact-command` | `/compact` (nom principal depuis 2.0.3 ; `/compress` en est un alias) | `/compact` (annoncé par OpenCode 2, pas par la 1.19) | Commande non annoncée par l'agent (fiche 039) |
| `rules-files` | `AGENTS.md` du dossier, `.bob/rules/`, `.bob/rules-<mode>/` (dossier, `~/.bob`, greffons) | `~/.config/opencode/AGENTS.md`, `AGENTS.md` du dossier jusqu'au dossier personnel (hors de celui-ci : jusqu'à la racine du dépôt), `instructions`. 1.19 : jusqu'à la racine du dépôt, repli sur `CLAUDE.md` et `~/.claude/CLAUDE.md` ; choisi d'après la version annoncée | Chaque agent a ses fichiers de consignes (fiches 056, 078) |
| `ignore-files` | ✓ `.gitignore` et `.bobignore` de chaque dossier, de la racine au fichier, et `.env` (Bob 2.0.6 refuse de lire ces fichiers ; ordre non vérifié en réel) | — : aucun fichier d'exclusion documenté | Bobine met elle-même dans le message les mentions `@`, les pièces jointes et `@git-changes` : ces fichiers ne sont pas proposés, sont sautés (et c'est dit), ou demandent confirmation (fiche 155) |
| `mcp-files` | `.bob/mcp.json`, `~/.bob/settings/mcp.json` | `opencode.json`, `~/.config/opencode/opencode.json` ; `mcp.<nom>` (format 1, lu par les deux versions) et `mcp.servers.<nom>` (format 2) | Les serveurs MCP restent dans les fichiers de l'agent (fiches 025, 078) |
| `approval-rules` | ✓ section `approval` de `~/.bob/settings/settings.json` (format documenté par IBM, partagé avec Bob IDE et Bob Shell) : commandes autorisées et refusées partout (liste par défaut recopiée avant la première modification), groupes, accès hors du dossier ; écrit seulement sur une action explicite, jamais `forbiddenApprovalGroups` ; format contrôlé par `pnpm bob-probe` | — : OpenCode règle ses autorisations dans `opencode.json` (`permission`), pas repris | Remplacer Bob IDE au quotidien : les règles « pour tous les projets » se gèrent dans Bobine (fiche 215, ADR-0044) |
| `role-export` | ✓ « Installer dans… » d'un rôle : mode personnalisé dans `~/.bob/settings/custom_modes.yaml` (partagé avec Bob IDE) ou `.bob/custom_modes.yaml` du projet (format documenté par IBM ; `slug` = nom du rôle, `groups` `[read, mcp]` en lecture seule, sinon `[read, edit, execute, mcp]`) ; seule l'entrée de Bobine est ajoutée, remplacée ou retirée, le reste et les commentaires gardés (`yaml`), copie avant d'écrire ; listé par ACP après `agent`, `plan`, `ask` (2.1.0, `pnpm bob-probe`) | ✓ agent `mode: primary` dans `~/.config/opencode/agents/<id>.md` ou `.opencode/agents/<id>.md` (format V2 de la documentation : lecture seule = `permissions` refusant `edit`, `shell`, `subagent`, outils MCP laissés) ; listé et choisi par ACP (réglage de mode, 2.2.5, `pnpm opencode-probe --offline`) ; que les permissions tiennent n'est pas sondé (il faudrait un modèle) | Un rôle de Bobine devient aussi un mode ou un agent natif, à sens unique, sur un geste explicite ; « Dans Bobine, lancer ce rôle dans ce mode » : la fille y est mise quand sa session l'a, et la lecture seule est alors tenue par l'agent (fiche 223, phase 4, ADR-0047) |
| `model-providers` | — : pas de fournisseur à choisir | ✓ points d'accès compatibles OpenAI (modèles internes, LLMaaS) de `~/.config/opencode/opencode.json` (`provider.<id>`, `enabled_providers`), ajoutés et testés dans Réglages › Agents ; clé chiffrée dans le trousseau, posée au lancement par la variable `{env:VAR}` du fichier | OpenCode choisit son modèle parmi des fournisseurs configurés dans son fichier (fiche 104) |
| `child-model` | — : jamais de modèle choisi pour une fille, ni suggéré, ni présélectionné, ni proposé dans « Lancer en parallèle… » ni dans « Faire relire… » (fiche 177) | ✓ la mère peut suggérer un modèle (option du réglage « Model ») avec sa raison ; l'utilisateur le confirme ou le change sur la carte avant le lancement | `childModelChoice: 'ask'` du profil (fiche 160, ADR-0036) ; Bob ne propose pas de choix du modèle par ACP |
| `api-key` | `BOB_API_KEY` (ancien nom `BOBSHELL_API_KEY` retiré) | — : clés des fournisseurs par `opencode auth login` | Connexion sans SSO (fiche 022) |
| `terminal-login` | — : SSO par `authenticate` | `opencode auth login` | `authenticate` ne fait rien chez OpenCode (1.19, 2.0.31 — fiche 022) |
| `auth-method-labels` | `sso` (« Log in with SSO » chez Bob 2.0.9) → « Se connecter par SSO » / « Sign in with SSO » | — | Le nom d'une méthode de connexion (`authMethods` d'`initialize`) vient de l'agent, en anglais chez Bob ; libellé traduit déclaré par le profil, nom de l'agent pour une méthode inconnue (fiche 205) |
| `license` | `bob --show-license` ; l'app ne l'accepte jamais | — | Licence IBM exigée à `session/new` (fiche 022) |
| `tested-versions` | 2.0.6, 2.0.9, 2.1.0 (`scripts/bob-probe.expected.json` : 2.1.0, recette QA du 2026-11-09) | 1.19, 2.0.31, 2.0.32 (`scripts/opencode-probe.expected.json`) | Versions que l'app a vérifiées ; le Diagnostic prévient quand l'agent en annonce une autre (fiche 140) |
| `folder-trust` | `--trust`, retenu par Bob dans `~/.bob/trustedFolders.json` | — | Bob refuse un dossier non approuvé (fiche 011) |

## Génériques, mais différents d'un agent à l'autre

Rien de propre à un agent dans l'app : chaque différence vient de ce que l'agent annonce ou envoie.

| Fonction | Bob 2.0.6 | OpenCode 2.0.31 |
|---|---|---|
| Modes | `agent`, `plan`, `ask`, et modes personnels | réglage « Session Mode » : `build`, `plan`, et agents personnels ; en `plan`, refuse d'écrire de lui-même |
| Choix du modèle | ✗ (pas par ACP) | réglages « Model » et « Effort » (modèle à variantes) |
| Continuer avec un autre agent (fiche 108) | vers Bob : sans choix de modèle ; destination affichée : son service en ligne (profil) | vers OpenCode : modèles récents et ceux des fournisseurs déclarés mis en avant ; destination : fournisseur déclaré (nom, adresse) ou préfixe du modèle |
| Autorisations | demande pour écrire et lancer une commande | **ne demande rien** par défaut, hors du dossier compris (1.19 : demandait hors du dossier) ; pour retrouver la demande : `{ "action": "external_directory", "resource": "*", "effect": "ask" }` dans `permissions` de `opencode.json` |
| Diffs et remise en état | fichier entier : remise en état exacte | fichier entier pour `edit` : remise en état exacte ; rien pour un fichier créé par `write` (1.19 : extraits, remise en état approchée) |
| Sous-agents | `spawn_subagent`, autorisation demandée | outil `subagent` (1.19 : `task`), sans autorisation ; travail transmis en direct |
| `session/list` sans dossier | toutes les sessions | toutes (1.19 : seulement celles hors dépôt git ; l'app demande aussi chaque dossier connu, fiche 055) |
| Questions à choix | outil `ask_user` de l'app | son outil `question` → formulaire (`elicitation/create`), affiché en questionnaire |
| Liste de tâches | `plan` ACP, autorisation à chaque mise à jour | ni outil de liste ni `plan` (1.19 : outil `todowrite`, sans `plan`) |
| Consommation (fiches 019, 109) | coût en bobcoins lu dans sa base locale après chaque réponse, pas de jetons | jetons du tour et coût en USD par ACP (0 pour les modèles gratuits) |
| Compaction | `/compress`, réponse texte | `/compact` → `compaction_update` (carte de compaction) |
| Commandes « / » et skills | `.bob/commands`, `.bob/skills`… | `.opencode/commands`, `.opencode/skills`, `.agents/skills`, `.claude/skills`… |

Détails et relevés : [acp.md](acp.md).

## Pistes

| Piste | Agents | Fiche |
|---|---|---|
| Règles actives de la conversation, mentions `@git-changes` et `@terminal` | les deux | — |
| Réglages de l'agent, dont la limite de coût par tâche (`session.maxCost`) | les deux ; limite : Bob | — |
| Échange de tâches avec Bob IDE (`_bob/task/export`, `import`) | Bob | — |
| Dupliquer une session (`session/fork`) | OpenCode | écarté : « repartir d'un message » marche pour les deux |
| Partage public d'une session (`share`) | OpenCode | écarté : publie la conversation en ligne |

## Ajouter une fonction propre à un agent

1. Un champ dans `AgentProfile` (`profiles.ts`), lu côté main seulement. Si l'app doit faire
   quelque chose hors d'ACP pour cet agent (lire un coût, reconnaître un message), le champ porte
   l'adaptateur, derrière un point d'extension générique de `agent/adapters.ts` ; son code reste
   dans les modules de l'agent (`bob-*.ts`, `opencode-*.ts`, dans `agent/` ou `agent-config/`),
   que seul `profiles.ts` importe ([ADR-0015](adr/0015-adaptateurs-dans-le-profil.md)). Ce que le
   fil doit en savoir passe par une marque générique posée par le main (ex. `_meta["bobine/subagent"]`),
   jamais par une lecture du format de l'agent dans `shared` ou le renderer
   ([ADR-0028](adr/0028-independance-aux-agents.md)). Jamais d'étiquette comparée dans l'hôte
   d'agent, jamais de test sur l'identifiant du profil dans l'interface, jamais de `'bob'` ou
   `'opencode'` en dur hors de ces modules (ESLint le refuse).
2. Sa ligne dans `specificItems` (`capabilities.ts`) : repère, libellé, ce que ça change.
3. Sa ligne dans la deuxième table ci-dessus, sous le même repère.
4. « Agents : Bob », « OpenCode » ou « les deux » dans sa fiche, avec la raison.

## Brancher un autre agent ACP

**Sans code** (fiche 141) : Réglages › Agents › « Ajouter un agent ACP… ». On y déclare le nom, la
commande avec ses arguments, les variables d'environnement, et au besoin la variable de la clé
d'API (valeur saisie sur la page de l'agent, au trousseau) et la commande de compaction. C'est
enregistré dans `settings.json` (`customAgents`) ; le main en bâtit le profil
(`agent/custom-profiles.ts`) : identifiant `custom-<nom>`, champs de données seulement, rangé après
les vrais agents ; pas de couleur propre dans le graphique (« Autres ») ; « Propre à » vide, sauf la
clé d'API et la compaction déclarées. La persona « ACP minimal » de la grille de conformité (fiche
139) passe par ce chemin.

**Dans le code** : ce qui marche sans rien écrire, pour tout agent qui parle ACP : session, fil, outils et
autorisations, plan, modes et options, commandes « / », consommation par `usage_update`,
reprise (`session/load`, `session/resume`, `session/list`), images, outils de l'app par MCP HTTP,
élicitations, compaction annoncée (`compaction_update`). Le profil ne déclare que ce que l'agent a
en propre, champ par champ, et chacun est facultatif :

| Champ du profil | Quand le déclarer |
|---|---|
| `id`, `label`, `command`, `args`, `env`, `installHint` | Toujours (seuls obligatoires : `id`, `label`, `command`, `args`, `env`) |
| `testedVersions` | Versions essayées : une version plus récente ou plus ancienne est signalée une fois dans la conversation, toute autre dans le Diagnostic (fiche 198) |
| `minVersion` | Seulement pour une incompatibilité **documentée** (avec sa raison) : en dessous, démarrage refusé et expliqué. Vide pour Bob et OpenCode |
| `subagentFormat` | L'agent lance des sous-agents par un outil : sans lui, de simples appels d'outil |
| `subagentReplay`, `subagentStream` | Il garde la session de ses sous-agents, ou relaie leur travail dans le flux |
| `rules`, `mcpConfig`, `providers` | Ses fichiers de règles, de serveurs MCP, de fournisseurs, à montrer ou modifier |
| `compactCommand` | Sa commande de compaction, s'il ne l'annonce pas sous un nom usuel |
| `alwaysScope` | Ce que couvre le « Toujours » qu'il retient (fiche 214) : dit sur la carte d'autorisation |
| `apiKeys`, `terminalSteps`, `license`, `trust` | Clé d'API, connexion dans un terminal, licence, dossier à approuver |
| `authMethodLabels` | Libellés traduits de ses méthodes de connexion, par identifiant (fiche 205) |
| `costSource`, `quotaSource`, `diffSource`, `toolStatus`, `emptySessionTitle` | Ce qu'il ne dit pas par ACP, ou dit à sa façon |
| `defaultControls`, `destination`, `chartSlot`, `welcomeHint` | Réglages de départ, destination affichée, couleur du graphique, astuce |

