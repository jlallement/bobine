# Tour de table — lot 0 : observations sur les vrais agents (2026-11-24)

Lot 0 de l'étude [`docs/tour-de-table-etude-technique.md`](../tour-de-table-etude-technique.md)
(§ 3.6 « Risques », § 3.7 « À observer ») et de l'[ADR-0072](../adr/0072-tour-de-table.md) :
observer OpenCode et IBM Bob **avant tout code**, pour lever ou confirmer les risques par des faits.
Aucun code de Bobine n'a été écrit ni lancé : les agents ont été pilotés directement en ACP.

## Versions

| Élément | Version |
|---|---|
| OpenCode | **2.3.0** (`opencode --version` ; `initialize` : `agentInfo.version` « 2.3.0 ») |
| IBM Bob Shell | **2.1.0** (`bob --version`, commit `8afc0007b` ; `initialize` : `bob-shell` « 2.1.0 ») |
| Node (client d'essai) | 26.13.0 |
| macOS | Darwin 27.2.0, 24 Go de mémoire |
| Bobine | branche `etude/tour-de-table` (1.1.0-rc.2), non lancée |

## Protocole

- **Client ACP d'essai** : un client JSON-RPC minimal (ndjson sur stdio) écrit pour l'occasion, qui
  horodate chaque message entrant et sortant. Gardé **hors du dépôt** (scripts jetables, non
  réutilisables tels quels) ; les traces brutes aussi, car elles contiennent des chemins personnels.
  `clientCapabilities` : ni `fs`, ni `terminal` ; élicitation `form` annoncée à Bob comme le fait
  Bobine (aucune n'est arrivée).
- **Dépôt jetable** : `~/Development/bobine-recette/lot0-tour-de-table/`, dépôt git d'un commit,
  `README.md` et `calc.js` (une moyenne avec un `<=` fautif, un `maximum` sans cas vide).
- **Question commune** (courte, la même pour tous) : « Lis calc.js. Y a-t-il un bug ? Réponds en 3
  lignes au plus, sans rien modifier. » (variante Bob : « … en une phrase … »).
- **OpenCode** : `HOME` et `XDG_*` **jetables, partagés par tous les processus** de l'essai (donc un
  même stockage `opencode.db`, comme dans Bobine), clés retirées de l'environnement, aucune
  connexion : seuls les modèles gratuits de Zen (`opencode/*-free`, `opencode/big-pickle`). Ni
  `~/.config/opencode` ni `~/.local/share/opencode` de l'utilisateur n'ont été lus ou touchés.
  Le modèle réellement utilisé a été relu dans la base **jetable** d'OpenCode
  (`session_message.data.model`), pour vérifier ce que l'ACP ne dit pas.
- **Bob** : `bob acp` sans option, avec le vrai `HOME` (la connexion de l'utilisateur, jamais lue :
  pas de SSO demandé). `~/.bob` sauvegardé par `ditto` avant, `settings.json` comparé après.
  Lectures accordées une fois si Bob les demandait, tout le reste refusé. Coûts lus comme l'app
  (fiche 109) : `tasks.costs` de `~/.bob/db/bob.db`, en lecture seule, nos trois lignes seulement.
- **Mémoire** : `ps -o rss` sur le processus et ses descendants, et `footprint` (empreinte physique
  macOS) pour corriger le double compte des pages partagées.

Horaires (UTC) : OpenCode de 20:42 à 20:47, Bob de 20:47:49 à 20:48:30.

## Observations

### Tableau « question → observé → conséquence »

| # | Question | Observé | Conséquence pour la conception |
|---|---|---|---|
| O1 | 3 puis 5 `opencode acp` en même temps, même dossier, même stockage, modèles différents : démarrent-ils ? | **Oui, tous.** `initialize` en 158–180 ms, `session/new` en 473–575 ms, à 3 comme à 5. Aucun message d'erreur, rien sur stderr, journal d'OpenCode partagé : 764 lignes, **toutes `INFO`** (aucun verrou, aucun `SQLITE_BUSY`). Les 5 questions simultanées ont abouti (`end_turn`) en 2,6 à 14,9 s. | Risque 5 levé pour OpenCode à 5 participants. Rien à sérialiser au démarrage. |
| O2 | Comment régler le modèle d'une session ? | Option de configuration ACP `model` (`session/set_config_option`, `configId: "model"`). Pas de `models` ni de `session/set_model` annoncés (`session/new` : `models` absent). | Confirme l'étude (§ 2.1) : pas de `set_model`. |
| O3 | Identifiant invalide ou refusé | **Erreur explicite** : `-32602` « Invalid params: model not found: opencode/nexiste-pas », `data: { providerId, modelId }`. Même erreur pour `nexiste/pas` et `big-pickle` (sans fournisseur). La session **garde son modèle précédent** : un participant réglé sur un modèle refusé a répondu avec `big-pickle` (vu dans la base d'OpenCode), une réponse quasi identique à celle du vrai participant `big-pickle`. | Risque 2 **confirmé** : si l'app ignore l'erreur (repli d'`applyModel`), deux participants répondent avec le même modèle. Le mode strict est indispensable : une erreur de `set_config_option` met le participant en erreur, sans envoi. |
| O4 | La liste des modèles est-elle stable ? | **Non.** Au premier lancement (cache vide), `session/new` a listé 12 modèles gratuits, dont `glm-5.3-flash-free` et `minimax-m3.1-flash-free` ; une minute plus tard, la liste en comptait 10, ces deux-là remplacés par `hy4-flash-free` et `tidepool-alpha-free`. Choisir un modèle de la première liste a donné O3 (« model not found »). | Un participant retenu dans les préférences peut disparaître du catalogue sans prévenir. Le mode strict le rattrape au lancement ; la ligne du participant doit dire « modèle introuvable », pas une erreur vague. |
| O5 | La réponse de `set_config_option` dit-elle le modèle réellement appliqué ? | **Pas toujours.** Deux réglages d'affilée juste après `session/new` (beam-free puis deepseek) : 2 essais sur 3, la réponse au second dit encore `beam-free` ; deux `config_option_update` arrivent ensuite (`beam-free`, puis `deepseek-…`). Le modèle réellement utilisé était bien `deepseek-…` dans les 3 cas. Un seul réglage de modèle par session (cas du tour) : réponse juste dans les 14 essais. | Le mode strict ne doit pas se fier à la seule réponse : relire l'état après le dernier `config_option_update` (déjà suivi par `snapshot.controls`), et ne poser qu'**un** réglage de modèle à la fois. |
| O6 | L'agent confirme-t-il le modèle utilisé ? | **Non.** Ni la réponse de `session/prompt` (`usage` : jetons seulement), ni `usage_update` (`used`, `size`, `cost`), ni aucune autre mise à jour ne nomme le modèle. Seul indice : `usage_update.size` change avec le modèle (200 000, 262 144, 1 048 576). Aucun `config_option_update` pendant ou après les tours. | La seule vérification possible par ACP est **avant** l'envoi (état des réglages). Ne rien bâtir sur `size`. Le nom affiché du participant est celui du réglage vérifié. |
| O7 | OpenCode a-t-il un mode en lecture seule annoncé ? | Réglage « Session Mode » (`mode`) : `build`, `plan`, et tout agent `primary` du dossier (ici `participant`, fichier `.opencode/agents/participant.md` au format de Bobine, `edit`, `shell`, `subagent` refusés). Changer de mode **garde le modèle** réglé. | — |
| O8 | Mode `plan`, demande d'écrire un fichier | Demande simple : refus en texte, aucun outil appelé. **Demande insistante : fichier écrit.** `write` refusé par OpenCode (« Cannot use write to modify files outside the Plan directory »), mais la commande `echo bonjour > note.txt` passe par `shell` **sans aucune demande d'autorisation** et crée le fichier. | **`plan` n'est pas une lecture seule.** Ne pas s'en servir comme garde d'un participant. |
| O9 | Agent `participant` installé (format de Bobine), même demande insistante | **Rien d'écrit.** Ni `write`, ni `edit`, ni `shell` dans son catalogue (« Unknown tool 'write' ») ; `execute` (Code Mode) n'a pas accès au disque (« Cannot import "node:fs": it isn't available in Code Mode »). Restent `read`, `glob`, `grep` et `webfetch` (réseau, appelé puis en échec ici). Aucune demande d'autorisation. | Risque 1 levé **à condition** d'avoir l'agent installé : c'est la seule lecture seule tenue par OpenCode. Sans lui, la lecture seule reste « demandée ». `webfetch` reste permis : un participant peut lire le web. |
| O10 | Mode par défaut (`build`), même demande | Fichier écrit tout de suite par `write`, **aucune demande d'autorisation** (comme relevé en fiche 224). | Rappelle que sans agent installé, le niveau `requested` est réel : `ReadOnlyWatch` ne verrait l'écriture qu'après coup. |
| O11 | Même question, 3 modèles en parallèle | Voir « Mesures » : 2,6 à 14,9 s ; 11 761 à 18 220 jetons au total par participant (cache compris), dont 87 à 170 en sortie ; coût `0` USD (`usage_update.cost`). Réponses en Markdown court, en français, citant `calc.js:4`. Toutes ont trouvé le même bug ; plusieurs ont ajouté `maximum([])`. | Le multiplicateur « ≈ N + 1 fois les jetons » tient en ordre de grandeur : un participant lit le code (1 à 2 outils) et coûte ≈ 12 à 18 k jetons, cache compris, contre ≈ 6 k pour une réponse sans lecture. |
| O12 | Mémoire d'un `opencode acp` | **Deux processus par agent** : `opencode acp` et un `opencode serve --stdio --port 0`. RSS : 630–670 Mo par agent ; **empreinte physique 74 + 286 = 360 Mo**. 5 agents : ≈ 3,2 Go en RSS, ≈ 1,8 Go en empreinte. | Le chiffre de l'étude (≈ 300 Mo par agent, fiche 102) est **sous-estimé pour OpenCode 2.3.0** : ≈ 360 Mo d'empreinte. 5 participants + 1 mère OpenCode ≈ 2,2 Go. |
| B1 | Deux `bob acp` simultanés, même dossier | **Oui.** `initialize` en 387–389 ms, `session/new` en 701–705 ms ; les deux questions en 4,6 et 4,7 s ; rien sur stderr ; `tasks.locked_by` et `lock_lease_until` restés vides. Les deux processus, lancés dans la même seconde, ont partagé le même fichier de journal `~/.bob/logs/shell/bob-shell-<horodatage>.log` (vide). | Risque 5 levé pour Bob à 2 (le tour n'en lance qu'un par défaut : une place par profil sans modèle). |
| B2 | Coûts attribués à la bonne tâche ? | **Oui.** Une ligne `tasks` par session, `costs` = `{ cost, contextTokens }` : 0,069512 et 0,069504 bobcoin, 11 786 et 11 782 jetons de contexte ; l'écriture refusée n'a augmenté que la tâche 0 (0,117542), la tâche 1 inchangée. Coût **définitif dès la fin du tour** (identique 2 s plus tard). | La lecture par tâche de la fiche 109 vaut avec plusieurs Bob en même temps. |
| B3 | Débit | Seul : 4,66 s pour la même question. À deux : 4,6 et 4,7 s. Aucune erreur, aucun 429. | Pas de ralentissement visible à 2. La forme d'une limite de débit reste non relevée. |
| B4 | Les lectures demandent-elles une autorisation ? | **Non**, avec les réglages de l'utilisateur (section `approval` sans `allowed_permissions`, donc le défaut : groupe `read` permis). `glob` (« Finding files with pattern "**/calc.js" ») et `read` (« Reading file … ») : `tool_call` `kind: read`, **aucun** `session/request_permission`. | Un participant Bob ne bloque pas sur des cartes pour lire. Un utilisateur qui a retiré `read` des groupes permis aurait des cartes : non essayé, rien n'est supposé. |
| B5 | Demande d'écriture refusée | `session/request_permission` (`kind: edit`, « Writing file …/note.txt », options `allow` / `allow_always` / `reject`) ; `reject` → `tool_call_update` `failed`, « Tool call to write_file was cancelled: Rejected by user » ; Bob conclut en anglais « The file creation was rejected. No changes were made. », `end_turn`. Aucun fichier écrit. | Le refus d'office du rôle en lecture seule (niveau `enforced`) suffit pour Bob ; le tour finit proprement. |
| B6 | Mémoire d'un `bob acp` | Un seul processus `node` : RSS 284 Mo, empreinte 227–234 Mo. | Conforme à l'étude (≈ 300 Mo). |
| B7 | `-32603` « Server Error » | **Non rencontré** (5 tours sans erreur). | Reste ouvert. |
| B8 | Connexion SSO | Non demandée : `authMethods: ["sso"]` annoncé, mais `session/new` et les tours sont passés avec la connexion existante. | — |

### Mesures, même question à 3 puis 5 modèles (OpenCode)

| Passage | Modèle (vérifié dans la base) | Durée | `inputTokens` (hors cache) | `cachedReadTokens` | `outputTokens` | `totalTokens` | `usage_update` | Outils |
|---|---|---|---|---|---|---|---|---|
| 3 | big-pickle | 8,9 s | 4 407 | 7 168 | 87 | 11 898 | used 6 172 / 200 000, 0 USD | read |
| 3 | deepseek-v4.1-flash-free | 5,7 s | 4 455 | 13 568 | 150 | 18 190 | used 6 247 / 200 000, 0 USD | glob, read |
| 3 | minimax-m3.1-flash-free **demandé**, big-pickle **utilisé** (O3) | 7,2 s | 4 438 | 7 168 | 105 | 11 918 | used 6 181 / 200 000, 0 USD | read |
| 5 | big-pickle | 6,9 s | 814 | 10 752 | 90 | 11 859 | 6 142 / 200 000 | read |
| 5 | deepseek-v4.1-flash-free | 4,5 s | 4 455 | 13 568 | 170 | 18 220 | 6 277 / 200 000 | glob, read |
| 5 | mimo-v2.6-flash-free | 14,9 s | 6 136 | 11 456 | 113 | 17 730 | 6 089 / 200 000 | glob, read |
| 5 | nemotron-3.5-lightning-free | 2,6 s | 6 852 | 6 336 | 114 | 13 552 | 6 985 / 262 144 | read |
| 5 | hy4-flash-free | 4,7 s | 3 164 | 8 448 | 116 | 11 761 | 6 021 / 1 048 576 | read |

Mémoire (arbre du processus, RSS) : 630 à 672 Mo par participant, au repos comme au plus fort du
tour (+ 15 Mo au plus).

## Extraits de traces

Chemins personnels remplacés par `~` ; identifiants d'appels raccourcis. Aucun secret : les
échanges ACP ne contiennent ni clé ni jeton.

**O3, modèle refusé (OpenCode)**

```json
{"t":475,"dir":"out","msg":{"method":"session/set_config_option","params":{"sessionId":"ses_df0b3f82…","configId":"model","value":"opencode/glm-5.3-flash-free"}}}
{"t":486,"dir":"in","msg":{"error":{"code":-32602,"message":"Invalid params: model not found: opencode/glm-5.3-flash-free","data":{"providerId":"opencode","modelId":"opencode/glm-5.3-flash-free"}}}}
```

**O5, réponse en retard sur le réglage (OpenCode)** — horodatages en ms depuis le lancement du
client :

```text
409 out set_config_option  opencode/beam-free
412 in  réponse            currentValue = opencode/beam-free
413 out set_config_option  opencode/big-pickle
414 in  config_option_update  opencode/beam-free
418 in  réponse            currentValue = opencode/beam-free      ← pas big-pickle
418 out set_config_option  opencode/deepseek-v4.1-flash-free
419 in  config_option_update  opencode/big-pickle
420 in  réponse            currentValue = opencode/big-pickle     ← pas deepseek
420 in  config_option_update  opencode/deepseek-v4.1-flash-free
```

**O8, mode `plan` : écriture par le shell, sans autorisation (OpenCode)**

```json
{"t":5556,"msg":{"update":{"sessionUpdate":"tool_call_update","status":"failed","kind":"edit","title":"write","content":[{"type":"content","content":{"type":"text","text":"Cannot use write to modify files outside the Plan directory…"}}]}}}
{"t":9567,"msg":{"update":{"sessionUpdate":"tool_call_update","status":"in_progress","kind":"execute","title":"echo bonjour > note.txt && cat note.txt","rawInput":{"command":"echo bonjour > note.txt && cat note.txt","cwd":"~/Development/bobine-recette/lot0-tour-de-table"}}}}
```

Aucun `session/request_permission` dans la trace ; `git status` après le tour : `?? note.txt`.

**O9, agent `participant` : Code Mode sans disque (OpenCode)** — l'agent a essayé
`require("node:fs")` dans `execute` ; réponse de l'outil : « Cannot import "node:fs": it isn't
available in Code Mode ». `git status` après le tour : rien de neuf.

**B4, lecture sans autorisation (Bob)**

```json
{"t":3701,"msg":{"update":{"sessionUpdate":"tool_call","title":"Reading file ~/Development/bobine-recette/lot0-tour-de-table/calc.js","kind":"read","rawInput":{"path":"~/Development/bobine-recette/lot0-tour-de-table/calc.js"}}}}
```

**B5, écriture refusée (Bob)**

```json
{"t":9192,"permission":{"kind":"edit","title":"Writing file ~/…/note.txt","options":["allow:allow_once","allow_always:allow_always","reject:reject_once"],"chose":"reject"}}
{"t":9193,"msg":{"update":{"sessionUpdate":"tool_call_update","status":"failed","rawOutput":{"result":"Tool call to write_file was cancelled: Rejected by user"}}}}
```

## Consommation

| Agent | Tours | Jetons | Argent | Bobcoins |
|---|---|---|---|---|
| OpenCode (modèles gratuits de Zen) | 16 | 251 621 au total (entrée hors cache 73 857, cache lu 169 344, sortie 4 345, réflexion 4 075) | 0 USD (`usage_update.cost` à 0 partout) | — |
| Bob 2.1.0 | 4 (2 questions simultanées, 1 écriture refusée, 1 question seule) | contexte 11 778 à 12 027 par tâche (selon Bob) | — | **0,2565** (0,117542 + 0,069504 + 0,069496), budget de 3 respecté |

Une question avec deux lectures coûte ≈ 0,07 bobcoin chez Bob, plus que l'« échange court » de
`docs/acp.md` (≈ 0,02, sans outil).

Les trois tâches de l'essai restent dans l'historique de Bob de l'utilisateur
(`7c739ee6…`, `b9e6a5dc…`, `5a9e9ec1…`, titre « Analyser calc.js pour bug » pour la première) : rien
n'a été supprimé.

## État de `~/.bob` après l'essai

- `settings/settings.json` : **identique** à la sauvegarde (SHA-256 `646f2f6a…`), rien à restaurer.
- `trustedFolders.json` : identique (le dossier jetable, jamais décidé, est traité comme approuvé en
  ACP, comme relevé en 2.0.9).
- Nouveaux : deux journaux vides dans `logs/shell/` ; Bob a supprimé deux anciens journaux vides du
  2026-11-24 (rotation de ses journaux, pas de notre fait).

## Non observé, et pourquoi

- **`-32603` « Server Error » de Bob** : pas survenu en 5 tours. Reste en attente d'une trace réelle.
- **Limite de débit** (429 ou autre) de la passerelle IBM ou de Zen : rien vu à 2 Bob et à 5
  OpenCode ; non provoquée (coût, quota gratuit).
- **Bob avec le groupe `read` retiré** des autorisations : non essayé (il aurait fallu changer les
  réglages de l'utilisateur).
- **OpenCode avec la configuration réelle de l'utilisateur** (fournisseurs connectés, modèles
  payants, serveurs de langage d'un vrai projet) : volontairement non touchée ; les essais ont tourné
  dans un stockage jetable partagé. La mémoire sur un vrai projet (serveurs de langage) reste à
  mesurer en recette.
- **Le « Plan directory » d'OpenCode** (où `plan` peut écrire avec `write`) : non cherché ; sans
  effet sur la conception puisque `plan` est écarté.
- **Qualité d'une synthèse** sur 3 à 5 avis et effet de la réplique : hors du lot 0 (recette).

## Modifications apportées à l'étude et à l'ADR-0072

1. Étude § 2.1 et ADR, décision 2 : mode strict précisé — une erreur de `set_config_option` (dont
   `-32602` « model not found ») met le participant en erreur ; la valeur est relue **après** les
   `config_option_update` (la réponse seule peut être en retard) ; un seul réglage de modèle à la
   fois. Aucune confirmation du modèle pendant le tour : la vérification se fait avant l'envoi.
2. Étude § 2.1 : le catalogue des modèles gratuits change d'un lancement à l'autre ; un participant
   retenu peut disparaître.
3. Étude § 3.6, risque 1, et ADR « À surveiller » : `plan` n'est pas une lecture seule (shell sans
   autorisation) ; seul l'agent `participant` installé tient la lecture seule ; `webfetch` reste
   permis.
4. Étude § 1.7, § 3.6 risque 3 et ADR « Conséquences » : mémoire d'OpenCode 2.3.0 ≈ 360 Mo
   d'empreinte (deux processus), ≈ 650 Mo en RSS ; 5 + 1 OpenCode ≈ 2,2 Go.
5. Étude § 2.9 : plusieurs `bob acp` simultanés, coûts par tâche, débit à 2, lectures sans
   autorisation (réglages par défaut), écriture refusée : passés de « non observé » à « observé ».
6. Étude § 3.6 et § 3.7 : chaque risque marqué levé, confirmé ou ouvert, avec renvoi à ce rapport.
