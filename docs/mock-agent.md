# Agent ACP factice

Un agent ACP qui ne contient aucun modèle : il joue des **scénarios scriptés**. Il sert à tester
l'app de façon rapide, gratuite et déterministe, et à simuler Bob sans y avoir accès
([ADR-0004](adr/0004-agent-factice-pour-tests.md)).

Code : `src/mock-agent/`. Exécuté directement en TypeScript par Node (pas d'étape de build).

## Le lancer

Dans l'app, il n'est proposé que sur demande (jamais dans l'app installée) :
`BOBINE_AGENT_PROFILE=mock pnpm dev` (l'imposer, comme les essais de bout en bout) ou
`BOBINE_MOCK_AGENT=1 pnpm dev` (le proposer dans la liste). Sinon, l'app part sur le premier vrai agent
installé.

En ligne de commande :

```bash
pnpm mock-agent --list                    # liste les scénarios
pnpm mock-agent --scenario permission     # parle ACP sur stdin/stdout
```

| Option | Variable d'environnement | Défaut | Rôle |
|---|---|---|---|
| `--scenario <nom>` | `MOCK_AGENT_SCENARIO` | `demo` | Scénario joué à chaque prompt |
| `--delay <ms>` | `MOCK_AGENT_DELAY_MS` | `40` | Délai entre deux morceaux (0 dans les tests) |
| `--sans-options` | `MOCK_AGENT_OPTIONS=none` (app, fiche 210) | non | N'expose que des modes, sans options de configuration (simule un agent comme Bob pourrait l'être) |
| `--store <dossier>` | `MOCK_AGENT_STORE` | dossier temporaire | Où les sessions sont mémorisées (pour `session/load` après redémarrage) |
| `--sans-historique` | — | non | Aucune capacité de reprise (`loadSession` faux, pas de `sessionCapabilities`) |
| `--sans-rejeu` | — | non | Sait reprendre (`session/resume`) mais pas rejouer (`session/load`) |
| `--sans-usage` | `MOCK_AGENT_USAGE=none` (app) | non | Ne rapporte aucune consommation (ni `usage_update`, ni `usage` du tour), comme Bob côté ACP : onglet « Session » sans total (fiche 166) |
| `--dossiers-en-plus` | `MOCK_AGENT_DIRECTORIES=1` (app) | non | Annonce `sessionCapabilities.additionalDirectories`, comme OpenCode (fiche 179). Sans elle, des dossiers envoyés quand même à `session/new`, `load` ou `resume` sont refusés (`invalidParams`) |
| `--sans-cout` | `MOCK_AGENT_USAGE=tokens` (app) | non | Contexte et jetons du tour, sans coût (comme Codex) : plafond en jetons (fiche 157) |
| `--sans-images` | — | non | Agent texte seul : ni images, ni fichiers embarqués (`promptCapabilities` à faux) |
| `--sso` | — | non | Annonce toujours la méthode SSO à `initialize`, comme Bob, quel que soit le scénario de départ : un scénario choisi en cours de conversation (`/scenario connexion-expiree-bob`) peut alors demander la connexion (fiche 200). La méthode (`mock-sso`) porte le nom exact de Bob 2.0.9, « Log in with SSO », en anglais quelle que soit la langue (`--langue`) : l'app la libelle d'après le profil (`authMethodLabels`, fiche 205) |
| `--rejeu-tardif` | — | non | Rejoue l'historique **après** la réponse à `session/load`, comme Bob 2.0.6 |
| `--rejeu-tardif-ms <ms>` | `MOCK_AGENT_REPLAY=late` (app : 50 ms) | `0` | Rejeu tardif commencé `ms` après la réponse à `session/load` (implique `--rejeu-tardif`) : un message envoyé dès la relance le croise (D21, fiche 121) |
| `--sans-reprise` | — | non | Sait rejouer (`session/load`) mais pas reprendre sans rejeu (`session/resume`) |
| `--journal-messages <fichier>` | — | non | Essais : une ligne par `session/prompt` reçu (première ligne du texte), pour compter les envois (recette 0.9, D10) |
| `--demarrage-bloque` | — | non | Ne répond jamais à `initialize` (agent bloqué au démarrage, fiche 041) |
| `--panne <où>` | `MOCK_AGENT_PANNE` | aucune | Panne au démarrage (fiche 195) : `plantage-initialize` (le processus s'arrête net à `initialize`, ligne `panic: initialize` sur stderr), `bloque-session-new` (`session/new` ne répond jamais), `bloque-session-load` (`session/load` et `session/resume` ne répondent jamais) |
| — | `MOCK_AGENT_TENACE=1` | non | Agent tenace (fiche 195) : ignore SIGTERM et survit à la fin de sa connexion ; seul SIGKILL l'arrête (essai « rien ne reste en quittant », orphelins après un `kill -9` de Bobine) |
| `--demarrage-lent <ms>` | `MOCK_AGENT_SLOW_START_MS` | aucun | `initialize` répond après ce délai : démarrage lent (8000 pour la fiche 142, 1500 dans les essais ; fiche 139) |
| `--sans-plan` | — | non | N'envoie aucun `plan` (agent sans liste de tâches, comme OpenCode 2 ou un agent ACP minimal ; fiche 139) |
| `--arriere-plan-ms <ms>` | — | celui du scénario | Délai de fin des sous-agents en arrière-plan (`sous-agent-arriere-plan`, 4 s ; `…-lent`, 12 s), raccourci pour la grille de conformité (fiche 139) |
| `--devise <code>` | `MOCK_AGENT_CURRENCY` (app) | `USD` | Devise du coût rapporté à chaque tour (ex. `bobcoins`) |
| `--bob-db <fichier>` | `MOCK_AGENT_COST_SOURCE=bob-db` + `BOBINE_CONFIG_HOME` (app) | aucune | Base de Bob où écrire les sous-agents (étape `bob-subagent`, fiche 053). L'app ne la passe que sous un dossier personnel d'essai, jamais la vraie base ; comme Bob, `session/delete` y efface la tâche et ses sous-agents, coût compris (recette 0.10, D10) |
| `--cout-bob` | `MOCK_AGENT_USAGE=bob` (app) | non | Consommation comme Bob 2.0.6 (fiche 109) : rien par ACP, coût cumulé de la tâche (0,0125 par tour) écrit dans `--bob-db` 300 ms après chaque réponse. Avec `MOCK_AGENT_COST_SOURCE=bob-db` et `MOCK_AGENT_CURRENCY=bobcoins` dans l'app |
| `--titres` | — | non | Propose un titre de conversation (`session_info_update`) après le premier message |
| `--titres-invite` | — | non | Titre de session = début du texte envoyé, blocs de l'app compris, sur une ligne, comme Bob (fiche 125) ; dans l'app : `MOCK_AGENT_TITLES=prompt` |
| `--mode-depart <clé>` | — | non | Mode de départ lu dans `_meta[<clé>]` à `session/new`, comme `bob/mode` chez Bob 2.0.6+ (fiche 163) ; mode inconnu refusé (`invalidParams`) |
| `--trust` | — | non | Tous les dossiers sont approuvés (comme `bob acp --trust`) ; sinon, un fichier `.mock-agent-trusted` approuve un dossier |
| `--nom <titre>` | — | `Agent factice` | Nom annoncé à `initialize` (`agentInfo.title`), celui que montre l'interface |
| `--max-etapes <N>` | `MOCK_AGENT_MAX_ETAPES` | `3` | Limite d'étapes d'une session, pour les scénarios `limite-etapes-*` (fiche 209) |
| `--langue <fr\|en>` | `MOCK_AGENT_LANG` (app et agent) | `fr` | Langue de l'agent (fiche 167) : nom, modes, options et modèles, commandes « / », écho, libellés de permission et phrases des scénarios courants. Les essais `pnpm e2e --lang en` la posent à la langue des essais ; voir ci-dessous |

`MOCK_AGENT_API_KEY` dans l'environnement de l'agent dispense des connexions (`bob-auth-requise`,
`connexion-terminal`), comme `BOB_API_KEY` pour Bob ; le profil « Agent factice » la déclare comme
clé d'API (fiche 022).

Dans l'app (profil « Agent factice »), `MOCK_AGENT_COST_SOURCE=bob-db` donne au profil la source de
coût de Bob (`costSource: bobDbCosts(…)`, ADR-0015) : la base lue est celle de
`BOBINE_CONFIG_HOME`, jamais la vraie dans les essais.

`MOCK_AGENT_QUOTA=1` lui donne la source de quota de Bob (`quotaSource: bobStatusQuota(…)`, fiche
091) branchée sur un faux `bob chat`, `src/mock-agent/status-screen.mts` : il enregistre une session
vide dans le magasin de l'agent factice à son lancement, comme Bob, puis affiche le panneau de
`/status` (« Fetching budget... », puis `--plafond` / `MOCK_QUOTA_LIMIT`, 1000 par défaut ou
`illimite`, et `--consomme` / `MOCK_QUOTA_USED`, 812.5 par défaut). `MOCK_QUOTA_SLOW_MS` : rien
d'écrit ni d'affiché avant ce délai (`bob chat` lent ; quitter pendant la lecture, fiche 208).
Suite e2e `quota`.

**Réglages de session exposés** : modes `code` / `ask`, et (sauf `--sans-options`) les options `model`
(select groupé : `factice-rapide`, `factice-precis`) et `verbose` (booléen). Le scénario `echo` affiche
les valeurs effectivement appliquées par l'agent.

`MOCK_MODELS=long` remplace la liste des modèles par une liste plate d'une quarantaine de noms façon
OpenCode (« openai/GPT-6.1 Sol », « opencode/Big Pickle »…), les deux modèles factices en tête
(« factice/Factice rapide ») : menu des modèles avec recherche et barre de saisie repliée (fiche 092,
suite e2e `composer`).

`MOCK_MODELS=<valeur=nom,…>` (ex. `llmaas/qwen3-32b=LLMaaS/Qwen3 32B`) ajoute un groupe
« Fournisseurs » à la liste des modèles : modèles d'un fournisseur déclaré (fiche 108).

`BOBINE_MOCK_PEER=1` ajoute dans l'app un second agent factice, « Agent factice B » (profil
`mock-peer`, `--nom Agent factice B`, fournisseurs lus comme ceux d'OpenCode), pour continuer une
conversation avec un autre agent (fiche 108, suite e2e `handover`).

Depuis Electron (fiche 003) : `ELECTRON_RUN_AS_NODE=1 <electron> src/mock-agent/main.mts`.

**En cours de session**, un prompt `/scenario <nom>` joue ce scénario pour ce tour, et `/scenario`
seul liste les scénarios. Pratique pour tout essayer depuis l'UI sans relancer l'agent. La commande
est lue dans le **dernier** bloc de texte du prompt (une branche, fiche 023, envoie d'abord
l'échange repris en contexte).
Premier message d'une fille lancée avec un rôle (fiche 223, commence par `<bobine_role`) :
`/scenario <nom>` est cherché sur n'importe quelle ligne, après la consigne du rôle.
L'agent annonce ces commandes (`available_commands_update`) juste après l'ouverture de session :
`/scenario <nom>`, `/aide` (= `/scenario`) et `/demo` (= `/scenario demo`), proposées par le menu « / ».

### Langue (fiche 167)

L'app ne traduit rien de ce qui vient d'un agent (ADR-0014) : en anglais, c'est l'agent factice
qui parle anglais. Les scénarios restent écrits en français ; `src/mock-agent/langue.mts` donne
l'anglais de leurs phrases (dictionnaire appliqué aux textes envoyés : réponses, réflexions,
mises à jour d'outils, plans, demandes de permission). Une phrase absente du dictionnaire reste
en français : l'y ajouter quand un essai anglais la montre. Les mots courts (« Refuser »,
« Question ») ne se traduisent que seuls, les phrases aussi au milieu d'un texte.

Dans l'app, le profil passe `--langue` d'après `MOCK_AGENT_LANG`, jamais d'après la langue de
l'interface (qui n'a aucun effet sur les agents) ; `e2e/lib.mjs` la pose à celle des essais. Les
essais comparent les textes de l'agent avec `M('phrase française')`, comme ceux de l'app avec
`L('clé')`.

## Scénarios

| Nom | Ce qu'il simule |
|---|---|
| `demo` | Tout à la fois : réflexion, plan, outil, permission, diff, texte |
| `streaming-texte` | Réponse Markdown (liste, code, tableau) en streaming |
| `plantage-signal`, `plantage-segfault` | Commence un outil puis le processus meurt par SIGKILL ou SIGSEGV, sans un mot (fiche 195) |
| `arriere-plan`, `arriere-plan-detache` | Met `sleep 41.3` en arrière-plan dans son groupe, ou détache `sleep 41.4` (nouvelle session), puis finit son tour : le premier est arrêté avec l'agent, le second non (fiche 195, M3) |
| `plantage-avec-enfant` | Lance `sleep 31.7` dans le groupe de l'agent, puis le processus meurt par SIGKILL : la commande ne doit pas lui survivre (fiche 195, D3) |
| `flot-stderr` | 20 000 lignes (≈ 4 Mo) sur stderr pendant le tour, puis une réponse normale (fiche 195) |
| `connexion-coupee` | Commence à répondre, puis ferme stdout sans s'arrêter : connexion coupée, processus vivant (fiche 195) |
| `tableaux` | Tableaux Markdown : alignements (`:---`, `---:`, `:---:`), puis un tableau large de huit colonnes |
| `code-colore` | Blocs de code colorés (TypeScript, JSON, HTML, shell, diff) : coloration syntaxique de la palette (fiche 134) |
| `mermaid` | Diagrammes Mermaid (fiche 063) : organigramme, séquence, puis un bloc invalide |
| `lien-html` | Lien vers une page HTML du dossier, `site/index.html` (fiche 064) |
| `pensee` | Réflexion (`agent_thought_chunk`) puis réponse |
| `appel-outil` | Outil de lecture : `pending` → `in_progress` → `completed` |
| `permission` | Modification soumise à permission (autoriser / toujours / refuser) |
| `diff` | Modification avec diff, sans permission |
| `plan-fichier` | Mode plan à la manière de Bob : plan écrit dans `plan.md`, réécrit aux remarques (« Remarques sur le plan »), exécuté ensuite (« Exécute le plan ») |
| `modifications` | Modifie **réellement** `README.md` (deux fois) et crée `src/app.js` dans le dossier de la session : récapitulatif des modifications (fiche 021) |
| `conflits` | Fiche 110 : sur la consigne de résolution de conflits envoyée par l'app (« left conflicts »), réécrit `README.md` sans marqueurs et sans committer ; tout autre message joue `modifications` (suite e2e `worktree-cycle`) |
| `patch-opencode` | Comme OpenCode 2.0.32, outil « patch » : crée `notes.md` et `src/calc.js`, puis complète `notes.md` et modifie `README.md` s'il existe ; carte terminée avec un diff par fichier et `rawOutput.metadata.files[]` (`file`, `patch` unifié, `additions`, `deletions`, `status`). Au rejeu (`session/load`), les fichiers modifiés n'ont plus de diff, seul le patch reste (fiche 096, e2e `replay-changes`) |
| `ecriture-opencode` | Comme OpenCode 2.2.5 (traces `__traces__/opencode-2.2.5/creation-*`), outil `write` : crée `nouveau.txt` (annoncé sans rien, puis `rawInput: { path, content }`, fin par le seul texte « Created file successfully », **sans diff**), un `patch` modifie `README.md` s'il existe, puis `write` crée `autorise.txt` après une demande d'autorisation, seule à porter le diff (fiche 202 ; grille aux limites, e2e `replay-changes`) |
| `outil-en-preparation` | Comme OpenCode : outil « patch » annoncé `pending` avec `rawInput: {}` pendant 3 s (75 pauses, au délai de base de 40 ms : le modèle écrit le patch), puis `in_progress` 1 s avec ses `locations` (`{cwd}/notes.md`), puis `completed`. Ni la carte, ni le résumé de groupe, ni l'indicateur ne disent « patch » (fiche 128, e2e `activity`) |
| `outil-en-preparation-interrompu` | Le même patch annoncé, mais il reste `pending` jusqu'à l'interruption du tour (Échap) : la carte devient « Modification · interrompu ». Sans interruption il n'en sort pas ; exclu du test de catalogue (fiche 128) |
| `shell-en-preparation` | Outil `shell` (`kind: execute`) annoncé avec le seul `{cwd}` pendant 3 s, puis `in_progress` avec sa commande, puis `completed` avec une sortie JSON dont les chaînes ont des retours à la ligne (D6 : sortie indentée, fiche 128) |
| `plan` | Plan en trois étapes qui progresse |
| `titres-bob` | Titres bruts comme Bob 2.0.6, trois autorisations à la suite : « Applying diff to <chemin absolu> », « cd <dossier> && npm test 2>&1 », « Updating todo list » avec `rawInput.todos` — fiche 125 |
| `commande-bob` | Comme Bob 2.0.9 : la commande de la capture m07 (193 caractères, cinq commandes) dans le **titre seulement**, sans `rawInput`, à autoriser — 0.11, M1 (e2e `autorisation-commande`) |
| `commande-courte` | `git status --short` dans `rawInput.command`, titre générique « Run shell command », à autoriser — 0.11, M1 |
| `commande-tres-longue` | Commande de 31 lignes (heredoc) dans `rawInput.command`, `cwd: /tmp/build-2291` hors du dossier de la conversation, à autoriser — 0.11, M1 |
| `commande-commit` | `git add -A && git commit -m "feat(calc): add add() and sub()"` (parenthèses entre guillemets, comme Bob 2.1.0 en recette) : « Pour tous les projets » propose deux parties — fiche 215 (e2e `regles-approbation`) |
| `commande-lint` | `npm run lint` dans `rawInput.command` (absente des listes par défaut de Bob), titre générique, à autoriser — fiche 215 (e2e `regles-approbation`) |
| `commande-piegee` | `rawInput.command` avec un `\r` seul (cache `curl … \| sh` derrière `echo ok`), un U+202E (RLO), un U+200B et une espace cadratin U+2003 (`rm -rf` d'un seul mot) ; titre « npm test » qui annonce une autre commande — relecture de M1 |
| `commande-texte` | Texte ordinaire qui ne doit pas déclencher l'alerte : espace insécable dans un message entre guillemets (signalée discrètement), emoji (U+FE0F, U+200D), nom de fichier en NFD — troisième relecture de M1 |
| `commande-tableau` | `rawInput.command` en tableau d'arguments (argument vide, espaces, guillemet, nombre) : cité à la façon POSIX, aucun opérateur marqué — relecture de M1 |
| `commande-opencode` | Comme OpenCode : `rawInput.command` sans `cwd`, le dossier de la conversation répété dans `locations` (`{cwd}`) : « Dans projet », dit une seule fois — fiche 203 (e2e `autorisation-commande`) |
| `commande-sous-dossier` | Comme OpenCode 2.2.5 (trace réelle) : carte « shell » avec `rawInput.cwd`, puis `rawInput.workdir` **relatif** (`docs`) et l'emplacement absolu : « Dans projet/docs », dit une fois — fiche 203 |
| `commande-dossier-relatif-sortant` | Comme OpenCode 2.2.5 : `workdir: "../.."`, l'emplacement absolu résolu : alerte « hors du dossier », chemin entier, emplacement gardé — fiche 203 |
| `commande-sous-dossier-absolu` | `rawInput.workdir` = `{cwd}/src/renderer` (absolu), répété dans `locations` : « Dans projet/src/renderer » — fiche 203 |
| `commande-hors-dossier` | Commande avec une espace cadratin (U+2003), `cwd` long hors du dossier, répété dans `locations` : chemin entier jamais coupé, les deux alertes — fiche 203 |
| `creation-fichier` | Comme OpenCode : écriture de `{cwd}/notes.md` à autoriser, `kind: edit`, diff avec `oldText: null` : « Création de notes.md », « Autoriser la création de ce fichier ? » — fiche 203 |
| `creation-sous-dossier` | Création de `{cwd}/src/renderer/src/components/thread/notes.md` : le dossier grisé, coupé par le début s'il ne tient pas — fiche 203 |
| `modification-hors-dossier` | Modification d'un fichier hors du dossier (`/Users/ada/Dev/autre-projet/…`, rien n'est écrit) : chemin en `~`, début coupé, nom entier — fiche 203 |
| `creation-sous-dossier-nom-long` | Création de `docs/guide-utilisateur-de-la-bobine-tres-long-nom.md` (recette réelle) : ligne d'outil et Modifications coupent le dossier d'abord, l'extension reste visible — fiche 203 |
| `creation-nom-tres-long` | Création d'un fichier au nom seul plus large que la carte : coupé à la fin, compteurs visibles — fiche 203 |
| `creation-bob` | Comme Bob 2.0.9, message pour message (trace `bob-2.0.9/creation-fichier-neuf-autorisee-une-fois`) : `tool_call` en attente « Writing file {cwd}/notes/alpha.txt », autorisation avec un diff `oldText: ""`, puis le fichier vraiment écrit et la fin qui répète le diff : « Création de notes/alpha.txt » (l'app a regardé le disque à la demande) — fiche 203 |
| `commande-ecriture-hors-dossier` | Comme Bob 2.0.9 (trace `bob-2.0.9/commande-hors-dossier-et-sudo-refusees`) : `rawInput.command` seul, sans `locations`, `echo "docker.host=…" > {cwd:../dehors/x.properties} && cat …` (chemin à côté du dossier de la session, jamais le vrai dossier personnel ; rien n'est lancé) — bandeau « Écrit hors du dossier de la conversation », pas de « Toujours autoriser » — fiche 211 |
| `commande-sudo` | Même forme : `sudo ln -sf {cwd}/docker.sock /var/run/docker.sock && ls -la /var/run/docker.sock` — bandeau « droits d'administrateur (sudo) » et « dossier système » (une ligne par chemin, la raison la plus précise) — fiche 211 |
| `commande-lecture-hors-dossier` | Même forme : `ls -la /var/run/docker.sock 2>/dev/null \|\| echo absent` — une lecture : aucun bandeau, « Toujours autoriser » offert avec la note « C'est l'agent qui décide ce que couvre « toujours » » — fiche 211 |
| `ecriture-hors-dossier` | Outil `edit` comme Bob 2.0.9 (`rawInput.path`, emplacement, diff) sur `{cwd:../dehors/outil.toml}` ; accepté, rien n'est écrit — bandeau « Écrit hors du dossier de la conversation » — fiche 211 |
| `modification-fichier-vide-bob` | Même forme sur `notes/vide.txt`, fichier vide créé avant le tour : « Modification », pas « Création » — fiche 203 |
| `liste-taches` | Comme Bob 2.0.6 : chaque mise à jour de la liste de tâches demande une autorisation (« Updating todo list ») — fiche 042 |
| `annulation-par-agent` | Comme Bob 2.0.9 (trace réelle `bob-2.0.9/demandes-paralleles-cancel-request`) : modification de `{cwd}/a.txt`, puis l'agent retire sa demande (`$/cancel_request`, après 3 pas) et l'outil se termine `completed` : la carte disparaît sans bruit (ni « annulée », ni échec), la pastille d'attente tombe, une réponse tardive de l'utilisateur est sans effet (fiche 214, e2e `permissions`) |
| `commande-dossier-bob` | Comme Bob 2.0.9 : `cd {cwd} && npm test` (titre et `rawInput.command`) : le dossier de la conversation est une pastille « workspace » (chemin entier en infobulle) ; avec `MOCK_AGENT_ALWAYS_SCOPE=bob`, le profil factice déclare la portée de « Toujours » comme Bob (« Toujours dans cette conversation » et sa précision) — fiche 214 |
| `outil-mcp-bob` | Comme Bob 2.0.9 : outil `kind: other` « Running Meteo (essai) » avec `rawInput` `{ ville, unite, jours }` : la carte montre les arguments, « Toujours » est retenu par Bobine pour cet outil (fiche 214) |
| `liste-taches-bob` | Comme Bob 2.0.9 (trace `bob-2.0.9/liste-de-taches-autorisee-une-fois`) : « Updating todo list », `kind: "other"`, `rawInput.todos` en texte à cases (`[x]`, `[-]`, `[ ]`) ; les tâches arrivent aux données de la carte (`todos`, analyseur `src/shared/todos.ts`) — fiche 214 |
| `roles-delegue` | Rôles (fiche 223) : `start_child` avec `role: security-expert` (rôle fourni, en lecture seule) et une tâche qui joue `echo` : la fille dit ce qu'elle a reçu (consigne du rôle en tête, lecture seule) |
| `roles-inconnu` | `start_child` avec `role: astronaute` : refusé avec la liste des rôles connus, cité dans le fil (fiche 223) |
| `role-ecrit-avec-demande` | Fille en lecture seule qui demande à écrire `notes.md` (`kind: edit`, options de Bob) : Bobine refuse d'office, la fille le dit (« Écriture refusée… ») ; acceptée, elle écrirait vraiment (fiche 223) |
| `role-ecrit-sans-genre` | Fille en lecture seule : outil annoncé `kind: edit` (`tool_call`), puis une demande d'autorisation **sans** `kind` : Bobine retient le genre annoncé et refuse (relecture de la fiche 223) |
| `role-ecrit-sans-demander` | Fille qui écrit `notes-role.md` sans rien demander, comme OpenCode réglé par défaut : le garde-fou de Bobine le voit à la fin du tour (fiche 223). Avec `MOCK_AGENT_WRITES=silent` (app), le profil factice déclare `writesWithoutAsking` comme OpenCode : la lecture seule d'un rôle n'est alors que demandée, et l'interface le dit (e2e `roles-travail`, phase 3B) |
| `sous-agent` | Session enfant annoncée par `subagent_update`, ses updates arrivent sur la même connexion |
| `echo` | Décrit les réglages appliqués (mode, modèle…) et le prompt reçu (texte, images, fichiers) — sert aussi aux remarques sur la page (fiche 132, suite `browser-annotate`) : un message, une image |
| `dossiers` | Dit le dossier de travail et les autres dossiers reçus à l'ouverture de la session (`additionalDirectories`), « Aucun autre dossier reçu. » sinon, puis la ligne de contexte de l'app sur ces dossiers s'il y en a une dans le message (fiche 179) |
| `contexte-recu` | Décrit le contexte caché reçu avant le message (`<earlier_conversation>`) : agent d'avant, nombre de messages et de réponses, première demande ; « Aucun contexte reçu » sinon — bascule d'agent (fiche 108), branche (fiche 023) |
| `aparte` | Aparté de Bobine (fiche 180) : décrit la consigne `<bobine_aside>` reçue (lecture seule), le fil principal joint ou non (nombre de messages de l'utilisateur) et les réglages de la session (mode) ; **joué d'office** pour un prompt qui porte la consigne, sauf `/scenario` en tête de la question (`/btw /scenario permission` : demande d'écriture, refusée d'office par l'aparté) |
| `lent` | Très longue réponse, pour tester le bouton Stop (`session/cancel`) |
| `attend-stop` | Commence à répondre puis attend `session/cancel` sans limite : l'annulation ne peut pas arriver après la fin (grille de conformité, « annulation ») |
| `liens-fichiers` | Réponse avec des liens vers `plan.md`, `src/app.ts:3`, `outil.command`, le dossier `docs` et une page web : aperçu, app par défaut, Finder (fiche 052, e2e `links`) |
| `liens-web` | Une adresse locale (`http://localhost:3000/essai`) et une adresse du web : navigateur intégré, navigateur du Mac (fiche 154, e2e `links`) |
| `fil-long` | 300 appels d'outils terminés en 30 étapes (lectures, recherches, commandes), titrés comme OpenCode 2 (`read`, `grep`, la commande) avec `rawInput` et des emplacements sous le dossier de la session : rendu d'un long fil, mesuré par la suite e2e `long-thread` (fiche 047) ; cartes lisibles (fiche 107) |
| `erreur` | Commence puis échoue avec une erreur JSON-RPC |
| `reseau-instable` | Panne réseau passagère (fiche 142) : « Internal error » avec `data: { details: 'TypeError: fetch failed', cause: 'read ECONNRESET' }` les deux premières fois que la session le joue, puis répond : une reconnexion renvoie le même message (e2e `network`) |
| `reseau-coupe` | Réseau coupé en plein flux (fiches 139, 142) : texte et lecture en cours, puis, sans pause, « Internal error » sans détail à chaque tentative, la cause (`getaddrinfo ENOTFOUND`) seulement sur la sortie d'erreur ; le processus reste vivant |
| `limite-debit` | Limite de débit (fiche 142) : « 429 Too Many Requests » (`data: { status: 429 }`) une fois, puis répond |
| `budget-depasse` | Échoue comme Bob quand le budget est épuisé (forme supposée, non relevée en réel) : « Internal error », cause dans `data.details` (`BudgetExceededError: {"title":…,"description":…}`) |
| `plantage` | Lance un outil puis le processus s'arrête net (code 3, message sur stderr) — fiche 041 |
| `muet` | Commence à répondre puis ne répond plus, même à `session/cancel` (agent figé) — fiche 041 |
| `bavard` | Écrit une ligne hors protocole sur stdout, puis répond normalement — fiche 041 |
| `refus` | `stopReason: refusal` |
| `limite-etapes-session` | *(au lancement)* Comme Bob 2.0.9 (fiche 209) : chaque étape (texte, outil) compte une requête au modèle, sur **toute la session** ; à `--max-etapes` le tour finit en `max_turn_requests`, message coupé en pleine phrase ; ensuite chaque message est refusé aussitôt (`max_turn_requests`, **aucun `session/update`**, message gardé dans l'historique). Le compte vit dans le processus : `session/load` dans le même processus ne le remet pas à zéro, une relance puis `session/load` si. Un message qui contient « continu » ne demande que deux étapes |
| `limite-etapes-tenace` | *(au lancement)* Comme `limite-etapes-session`, mais le compte est enregistré avec la session : il survit à la relance ; seule une session neuve repart de zéro (repli « Nouvelle session avec le résumé ») |
| `bob-auth-requise` | `session/new` refusé (`auth_required`) tant que `authenticate` (SSO simulé) n'est pas appelé |
| `sso-sans-retour` | Comme `bob-auth-requise`, mais `authenticate` ne répond jamais : la connexion est notée (`.mock-agent-logged-in` dans le dossier où l'agent a été lancé), un agent relancé ouvre sa session — « Réessayer » de l'attente du navigateur (fiche 207) |
| `bob-workspace-non-approuve` | `session/new` refusé : workspace non approuvé (code `-32600` et message identiques à Bob 2.0.6) |
| `bob-premiere-connexion` | Dossier à approuver **puis** connexion SSO (ordre réel de Bob) |
| `sous-agent-bob` | Comme Bob 2.0.6 : `spawn_subagent` (« Running subagent: … », `rawInput.name`), autorisation, puis seul le résultat `<task_result>` ; avec `--bob-db`, sa ligne dans la base de Bob et son coût qui monte (0,0021 puis 0,0058) |
| `sous-agents-paralleles` | Deux sous-agents au format de Bob 2.0.6 lancés ensemble (fiche 117) : deux `spawn_subagent`, deux autorisations l'une après l'autre (refuser la première échoue les deux), puis avec `--bob-db` leurs lignes dans la base de Bob et leurs coûts (0,0021 et 0,0012, puis 0,0041 et 0,0037) ; le premier finit avant le second. Le comportement de Bob avec deux sous-agents à la fois n'est pas relevé |
| `sous-agent-opencode` | Comme OpenCode 1.19 : outil `task` (`kind: think`), `rawInput.subagent_type` à la mise à jour, résultat `<task id="ses_mock_enfant" …><task_result>` ; la session du sous-agent se recharge par `session/load` (une lecture, sa réponse) |
| `sous-agent-opencode2` | Comme OpenCode 2.0.31 : outil `subagent` (`rawInput: { agent, description, prompt }`), travail du sous-agent relayé dans le flux de la session (étape `opencode-child` : `_meta["opencode/child-session"]`, outils `ses_…:` titrés « <tâche> : <outil> »), résultat `<subagent sessionID="ses_mock_enfant2">` et `rawOutput.metadata.sessionID` |
| `sous-agent-arriere-plan` | Comme OpenCode 2.0.32 : sous-agent `general` lancé en arrière-plan, outil `subagent` rendu aussitôt (`rawOutput.metadata.status: "running"`, texte « working in the background ») ; sa session `ses_mock_fond` (rechargeable) n'a qu'une lecture en cours, puis son rapport 4 s plus tard, après le tour (fiche 122, e2e `subagents`) |
| `sous-agent-arriere-plan-lent` | Comme `sous-agent-arriere-plan` (outil `call_fond_lent`, session `ses_mock_fond_lent`), mais son rapport arrive 12 s après : le temps d'envoyer un autre message avant sa fin (D25, fiche 127, e2e `subagents`) |
| `bob-licence-requise` | `session/new` refusé (`-32600`, message de Bob 2.0.6) tant que le fichier `.mock-agent-license` n'est pas dans le dossier |
| `bob-licence-formulaire` | Bob 2.0.9 : licence demandée au premier message par un formulaire (case `accept`) ; cochée → réponse, refusée → `-32600` licence (fiche 163) |
| `premier-essai` | Message d'essai du premier lancement (fiche 188) : répond « OK », consommation et coût annoncés en fin de tour comme tout tour ; avec les scénarios `connexion-terminal`, `connexion-expiree`, `lent`, `plantage`, `reseau-instable` et `--demarrage-lent`, couvre chaque issue de l'essai |
| `premier-essai-outil` | Demande d'emblée un outil (écriture de `essai.txt`) : l'essai du premier lancement doit refuser et annuler le tour ; « ESSAI-OUTIL-AUTORISE » si l'outil a été autorisé |
| `connexion-terminal` | Connexion à faire dans un terminal, comme `opencode-login` (`authenticate` ne fait rien) : levée par le fichier `.mock-agent-logged-in`, dans le dossier de la session **ou dans celui où l'agent a été lancé** (`loggedInAt` : l'essai du premier lancement, fiche 188, ouvre sa session dans un dossier jetable et lance l'agent dans le dossier réservé de l'app, où tourne la commande de connexion ; pour une conversation, les deux dossiers sont le même) |
| `connexion-expiree` | Connexion expirée en pleine conversation, comme OpenCode 2.2.5 : la session s'ouvre, le message est refusé (`authRequired`, étape `login-required`) tant que `.mock-agent-logged-in` n'est pas là — dossier de la session ou dossier de lancement, voir `connexion-terminal` (recette 0.9, D10) |
| `connexion-expiree-outil` | Comme `connexion-expiree`, mais le refus arrive après un appel d'outil : le tour avait commencé |
| `connexion-expiree-sso` | Comme `connexion-expiree`, mais la connexion se refait par SSO (`authenticate`) : rien de documenté chez Bob, essais seulement |
| `connexion-expiree-bob` | Comme `connexion-expiree-sso`, avec l'erreur exacte de Bob 2.0.9 relevée par `pnpm bob-probe` : `-32603` « Internal error », `data.details` « ApiKeyError: {… "Invalid or expired API key."} » (connexion SSO expirée ou clé refusée, fiche 200) |
| `connexion-expiree-bob-tour` | Les mêmes étapes, à choisir en cours de conversation (`/scenario`) : la méthode SSO doit être annoncée au lancement (`--sso`) ; parcours « connexion expirée au message » de la grille de conformité |
| `connexion-expiree-echo` | Comme `connexion-expiree`, puis décrit le message reçu (ce que l'app renvoie et joint après la reconnexion) |
| `connexion-expiree-rouverture` | Comme `connexion-expiree`, mais la réouverture de la session (`session/load`) est refusée elle aussi tant que la connexion n'est pas refaite |
| `connexion-expiree-modele` | Modèle d'un fournisseur non connecté (fiche 210) : avec `factice-rapide` (modèle par défaut), le message est refusé (`-32000` « provider authentication required », étape `when-model` puis `login-required`) tant que `.mock-agent-logged-in` n'est pas là ; avec `factice-precis`, « Ce modèle est connecté, je peux répondre. » |
| `connexion-expiree-modele-aucun` | Comme `connexion-expiree-modele`, mais aucun modèle ne répond avant la connexion : changer de modèle ramène la carte, avec le nouveau modèle |
| `connexion-expiree-autre` | Refus `-32000` au message sans indice de connexion dans le texte : erreur de tour ordinaire, pas de carte de connexion |
| `bob-elicitation` | Formulaire riche (`elicitation/create`, mode `form`) ; la réponse oriente la suite |
| `elicitation-url` | Demande d'ouvrir une page web (`elicitation/create`, mode `url`) |
| `questions` | Questions à choix au format de Claude Code (`AskUserQuestion`) : choix unique, multiple, « Autre » (aperçus en `_meta` retirés, fiche 140) |
| `plan-a-valider` | Sortie du mode plan au format de Claude Code (`ExitPlanMode`, genre `switch_mode`) |
| `question-bob` | Appelle l'outil `ask_user` du serveur MCP de l'app, comme Bob (carte d'outil, autorisation, `tools/call`) |
| `question-opencode2` | Outil `question` d'OpenCode 2.0.31 : élicitation `form` (`q0`, `q0_custom`, `toolCallId`), réponse renvoyée dans le résultat de l'outil |
| `navigateur` | Pilote le navigateur intégré sur la page `MOCK_BROWSER_URL` (saisie, clic, lecture, capture) avec les outils `browser_*` |
| `navigateur-vue` | Ouvre `MOCK_BROWSER_URL` + `vue` : page longue avec un bouton `#cible` qui compte ses clics (fiche 129) |
| `navigateur-clic` | Clique au centre de `#cible` par coordonnées CSS (lues dans la page), capture, puis dit les clics reçus et la fenêtre CSS : juste même page zoomée (fiche 129) |
| `navigateur-mobile` | `browser_resize` mobile, clic sur `#cible`, défilement, puis une demande d'autorisation qui garde le tour ouvert ; la taille s'annule à la fin du tour (fiche 129) |
| `popup` | Clique sur un bouton de la page `MOCK_BROWSER_URL` + `popup` qui ouvre une fenêtre de connexion : l'app la bloque et le dit à l'agent (fiche 072) |
| `telechargement` | Clique sur « Exporter » de la page `MOCK_BROWSER_URL` + `export` (un CSV) : l'app demande « Enregistrer sous » à l'utilisateur et le dit à l'agent ; après une pause, une autre action lui apprend la décision (enregistré et où, ou annulé) (fiche 094) |
| `boite-page` | Clique sur « Supprimer » de la page `MOCK_BROWSER_URL` + `confirm`, qui ouvre une boîte `confirm()` : l'outil rend la main, l'outil suivant échoue tout de suite ; après une pause, une autre action lui apprend la réponse de l'utilisateur (fiches 094, 097) |
| `planche-contact` | Filme la page `MOCK_BROWSER_URL` + `anime` pendant un clic qui fait glisser un carré (`browser_filmstrip`, planche contact, fiche 075) |
| `outils-mcp` | Liste les outils que le serveur MCP de l'app déclare (`tools/list`), sans carte ni appel : « Outils du serveur MCP : ask_user, … » (fiche 109) |
| `outils-execute` | Comme OpenCode 2 (« Code Mode ») : une seule carte `execute` dont le code ouvre la page `MOCK_BROWSER_URL` + `anime`, la capture et la filme (fiche 079) |
| `outils-execute-erreur` | Comme OpenCode 2.0.32 : carte `execute` dite « completed » dont l'appel de `preview_start` est en erreur dans `rawOutput.metadata.toolCalls[]` (`status: "error"`, `error: true`) ; sans serveur MCP — la carte doit être en échec, en direct et au rejeu (fiche 122, e2e `browser`) |
| `debogage-web` | Débogue la page `MOCK_BROWSER_URL` + `debug` : console, réseau, JavaScript, mobile sombre, onglets |
| `planche-ios` | Filme le simulateur iOS pendant un balayage vers le haut (`ios_filmstrip`, planche contact, fiche 075) — avec de faux `xcrun` / `axe` en e2e |
| `simulateur` | Pilote le simulateur iOS (`ios_*`) : lance l'app, lit l'écran, touche « Ajouter un », saisit « Zoé », capture — avec de faux `xcrun` / `axe` en e2e |
| `planche-android` | Filme l'émulateur Android pendant un balayage vers le haut (`android_filmstrip`, planche contact, fiche 076) — avec un faux SDK en e2e (faux `screenrecord` en images brutes) |
| `android` | Pilote l'émulateur Android (`android_*`) : lance l'app, lit l'écran, touche « Ajouter un », saisit « Ada », capture — avec un faux SDK en e2e |
| `terminal` | Lance une commande dans le terminal à côté de la conversation (`terminal_run`), puis relit l’écran jusqu’à la sortie attendue (le prompt peut arriver avant) |
| `terminal-refus` | Demande `npm test -- --refus` dans le terminal (`terminal_run`) : refusée, l'outil rend une erreur et la carte dit « refusé », alors que l'agent la dit finie comme OpenCode (fiche 122, e2e `terminal`) |
| `terminal-refusee-partout` | Tente `node --version` par le terminal de l'app (`terminal_run`), comme Bob 2.1.0 après un « Refuser partout » (recette QA de la fiche 213) : refusée par les règles d'approbation du profil, sans question ni lancement ; avis dans le fil, outil « refusé » (fiche 215, e2e `regles-approbation`) |
| `lancer-app` | Lance le serveur « web » du fichier de lancement (`preview_start`), lit son journal et la page |
| `outil-app` | Appelle l'outil `screenshot` du serveur MCP de l'app, comme Bob (étape générique `mcp-tool` ; seul le texte du résultat est relayé, comme Bob) |
| `filles` | Lance deux conversations filles avec `start_child` (« Import CSV » : `/scenario modifications`, « Page d'aide » : `/scenario streaming-texte`), chacune après la carte d'accord, puis finit son tour. Réveillé quand elles ont fini (message de réveil), il fait le point (fiche 097) |
| `filles-refus` | Demande une conversation fille (`start_child`) ; refusée, il dit qu'il fait le travail lui-même ; « Faire ici » (fiche 112), il dit qu'il la fait dans cette conversation |
| `filles-plafond` | Trois `start_child` de filles qui attendent un accord (`/scenario permission`) : au-delà du plafond réglé (Réglages › Conversations), l'erreur de l'outil est relayée (ADR-0020) |
| `fille-message` | La mère lance « Séparateur CSV » puis lui écrit (`message_child`, avec l'identifiant lu dans le résultat de `start_child`). La fille, reconnue à sa consigne (« Tu es la conversation fille »), écrit à sa mère (`message_parent`) puis attend un moment : le message de la mère est en file pendant ce temps |
| `filles-rafale` | Un long relevé (le fil défile), puis trois `start_child` **en parallèle**, comme OpenCode : « Liste à lire », puis « Tests serveur » (≈ 2,4 s après), puis « Application mobile » (≈ 4,8 s après), chacune annoncée par une ligne de texte : la carte « Tâches proposées » grandit pendant que les premières attendent (fiche 124) |
| `filles-modele` | Modèle de fille suggéré (fiche 160) : `start_child` avec `model: factice-precis` et une raison. Avec `MOCK_CHILD_MODEL=none` (profil sans `childModelChoice`, comme Bob) : ignoré (la réponse le dit), carte sans modèle ; sinon carte où l'utilisateur confirme ou change le modèle |
| `filles-tech-lead` | Mère tech lead (fiche 160) : `start_child` avec un agent inconnu (erreur claire, sans carte), puis « Import CSV » avec `model: factice-precis` et une raison (présélectionnés sur la carte). Au réveil : `message_child` (`/scenario fille-corrigee`) et `recommend_merge` « pas prête » ; au réveil suivant (le récapitulatif commence par « Correction faite ») : `recommend_merge` « prête ». Aucune fusion par l'agent |
| `relecture` | Relecteur (fiche 177) : joué d'office sur la consigne de relecture de l'app (« Code review request from Bobine. ») ; `/scenario <nom>` dans les points à surveiller en choisit un autre. Rend deux remarques sur `src/app.js` (une haute, ligne 2 ; une basse, lignes 1 à 3) par `report_findings` si la consigne cite ce fichier, sinon une liste vide |
| `relecture-vide` | Relecteur (fiche 177) : `report_findings` avec une liste vide (« rien à signaler ») |
| `relecture-muette` | Relecteur (fiche 177) : répond en texte sans appeler `report_findings` (carte « sans remarques structurées ») |
| `relecture-modifie` | Relecteur fautif (fiche 177) : crée `relecture.txt` dans le dossier relu, puis rend une remarque : l'app signale que le dossier a changé |
| `memoire-retient` | Mémoire (fiche 182) : propose la préférence `tests-e2e` par `remember`, cite la réponse « waiting for the user's approval » et finit son tour sans attendre ; au message suivant, dit l'issue reçue dans `<bobine_memory_outcomes>` (« vous avez retenu » / « vous n'avez pas retenu ») |
| `memoire-index` | Mémoire (fiche 182) : dit s'il a reçu l'index `<bobine_memory>` et s'il y voit `tests-e2e`, sans rien retenir |
| `memoire-secret` | Mémoire (fiche 182) : tente `remember` avec une fausse clé `sk-…` ; cite le refus de l'app |
| `memoire-oublie` | Mémoire (fiche 182) : `recall` de `tests-e2e`, puis `forget` (carte « Oublier ? ») |
| `memoire-rafale` | Mémoire (fiche 182) : onze `remember` dans un tour ; dix cartes, le onzième refusé (« too many pending proposals ») |
| `memoire-injection` | Mémoire (fiche 182) : carte `fetch` d'une page web piégée, puis `remember` d'une « procédure » qui contient `curl … \| sh` : carte avec le bandeau « contenu externe », commande surlignée, aucun bouton mis en avant |
| `memoire-sans-outil` | Mémoire (fiche 182) : dit si `remember` figure dans `tools/list` du serveur MCP de l'app (mémoire coupée : non) |
| `fille-corrigee` | Fille corrigée (fiche 160) : crée `test/separateur.test.js`, puis répond « Correction faite : … » |
| `fille-bavarde` | Fille bavarde (fiche 160) : 30 fichiers créés dans `releve/`, puis une très longue réponse terminée par `MARQUEUR-FIN-DE-REPONSE` |
| `filles-bavarde` | Mère d'une fille bavarde (fiche 160) : la lance ; au réveil, dit « Compte rendu borné » si le contexte reçu cite 8 fichiers et compte les 22 autres sans la fin de la réponse |
| `chantiers` | Deux chantiers indépendants. Propose deux conversations filles (`start_child` : « Fenêtre À propos », « Essais plus courts », `/scenario streaming-texte`) **seulement** s'il a reçu le contexte de session `<bobine_capabilities>` (premier message d'une session, réglage autre que « Jamais ») ou la demande de `/split` (`<child_conversations_request>`) ; sa réponse dit lequel. Sinon, il dit faire les deux chantiers lui-même (fiche 118) |
| `commande` | Commande dont la sortie arrive en morceaux, en couleurs, code 0 |
| `commande-echec` | Commande en échec (code 2) |
| `compaction` | L'agent résume la conversation (`compaction_update`, résumé en morceaux) puis libère le contexte |
| `compaction-texte` | Résumé envoyé en texte, sans `compaction_update`, comme Bob ; aussi en réponse à `/compress` (fiche 126) |
| `contexte-plein` | Contexte à 95 % : jauge en alerte |
| `commande-silencieuse` | Commande dont la sortie s'arrête une minute (extension de terminal) : « Aucune sortie depuis N min » et « Interrompre » (fiche 157) |
| `cout-qui-monte` | Quatre lectures, coût cumulé annoncé pendant chacune (0,4 → 1,6 $) : plafond franchi en plein outil, tour interrompu à sa fin (fiche 157) |
| `contexte-80` | Contexte à 85 % : puce orange et « Compacter » (fiche 157) |
| `jetons-sans-cout` | Réponse comptée en jetons sans coût (avec `--sans-cout`) : plafond en jetons (fiche 157) |
| `question-plan` | Question obligatoire au format générique (`required`, « Autre » en `<clé>_custom`), puis plan dans `rawInput.plan` (fiche 140 ; ancien `codex-question-plan`) |
| `diff-geant` | Modification d'un fichier de 6 000 lignes : un diff de plus de 5 000 lignes, sans rien écrire (fiche 139) |
| `fichier-binaire` | Lecture d'une image dont la sortie a des octets bruts (NUL, contrôles), puis création d'un binaire en diff (fiche 139) |
| `sortie-1mo` | Commande dont la sortie fait 1 Mio (16 morceaux de 64 Kio, 16 384 lignes), code 0 : l'app en garde la fin, sous sa limite (fiche 139) |
| `commandes-en-cours` | `available_commands_update` envoyé pendant le tour : la commande `/revue` s'ajoute au menu « / » (fiche 139) |
| `textes-limites` | Emoji (séquences ZWJ, drapeaux), écrit de droite à gauche (arabe, hébreu, mélangé), lignes de 6 000 caractères sans espace, dans la réflexion, un titre d'outil et la réponse (fiche 139) |
| `debordements` | Tout ce qui peut être plus large que la colonne : mot, lien et chemin sans espace (texte, titre, liste, citation), ligne de code, tableau, code dans une liste, Mermaid, diff, sortie de terminal, image de 2 400 px, titres d'outils, sous-agent (outil `task`) (fiche 173) |

Les scénarios `bob-*` d'authentification et de workspace agissent à la création de session : ils
se choisissent au lancement (`--scenario`), pas avec `/scenario`.

Les scénarios aux limites (fiche 139) sont rangés dans `src/mock-agent/scenarios-limites.mts`.
Aucun n'est un relevé de Bob ou d'OpenCode : ce sont des formes plausibles, que la fiche 142
(pannes réseau côté app) utilise et confronte au premier essai réel.

## Personas de la grille de conformité (fiche 139)

La grille (`src/main/conformance/`) joue quatorze parcours contre trois formes d'agent, réglées par
les options ci-dessus. Les deux premières reprennent les vrais profils `bob` et `opencode` de l'app
(leurs adaptateurs), seule la commande change.

| Persona | Profil | Options de l'agent factice |
|---|---|---|
| Façon Bob | `bob` | `--sans-options --rejeu-tardif-ms 50 --titres-invite --cout-bob --sso --bob-db <base d'essai>` |
| Façon OpenCode | `opencode` | `--arriere-plan-ms 300` (usage par `usage_update`, par défaut) |
| ACP minimal | agent déclaré dans `settings.json` (`customAgents`), profil personnalisé de la fiche 141, sans adaptateur | `--sans-historique --sans-images --sans-plan --sans-usage --sans-options` |

## Écrire un scénario

Un scénario (`src/mock-agent/scenarios.mts`) est une liste d'**étapes** :

| Étape | Effet |
|---|---|
| `{ kind: 'text', text }` | Texte de l'agent, envoyé en morceaux |
| `{ kind: 'thought', text }` | Réflexion, en morceaux |
| `{ kind: 'update', update }` | N'importe quel `session/update` brut (outil, plan, mode…) |
| `{ kind: 'pause', ticks }` | Attente de `ticks` × délai de base |
| `{ kind: 'parallel', branches }` | Branches d'étapes jouées en même temps (appels d'outils parallèles, comme OpenCode) ; l'étape finit quand toutes ont fini (fiche 124) |
| `{ kind: 'permission', toolCall, options, branches }` | Demande de permission, puis la branche de l'option choisie |
| `{ kind: 'permission', …, agentCancels: { afterTicks, steps } }` | Comme Bob 2.0.9 : après `afterTicks` × délai de base, l'agent retire sa demande (`$/cancel_request`, par le signal d'annulation de la requête) ; le client répond `cancelled`, et le tour continue avec `steps` (une réponse arrivée avant, `selected`, joue la branche choisie comme d'habitude) — fiche 214 |
| `{ kind: 'elicitation', message, schema, onAccept, onDecline }` | Formulaire, puis suite selon la réponse |
| `{ kind: 'update', update }` avec `{cwd}` | Dans `locations[].path`, les valeurs texte de `rawInput` et le chemin d'un diff (`content[].path`, fiche 203) d'un outil (mise à jour ou demande d'autorisation), `{cwd}` est remplacé par le dossier de la session : un scénario cite des fichiers du dossier réel sans les toucher (fiche 107). `{cwd:<relatif>}` : ce chemin résolu et normalisé depuis le dossier de la session (`{cwd:../..}`), comme l'emplacement absolu qu'OpenCode envoie pour un `workdir` relatif (fiche 203) |
| `{ kind: 'edit-file', path, content?, edit? }` | Modifie un fichier du dossier de la session (chemin relatif) : carte d'outil `edit` avec le diff (texte complet), écriture réelle, outil terminé. `edit: { from, to }` remplace un extrait ; `emptyOldText` annonce un fichier créé avec `oldText: ""`, comme Bob |
| `{ kind: 'write-file', path, content }` | Écrit un fichier du dossier de la session (chemin relatif) sans rien envoyer : ce que fait l'outil d'un agent entre son autorisation et sa fin (scénarios `creation-bob`, `modification-fichier-vide-bob`) |
| `{ kind: 'opencode-patch', files }` | Outil « patch » d'OpenCode 2.0.32 : `files: [{ path, content? , edit? }]` (plusieurs entrées pour un fichier s'enchaînent), écriture réelle, diffs en direct et `rawOutput.metadata.files[]` ; l'échange gardé pour le rejeu n'a que les diffs des fichiers créés, comme OpenCode quand un fichier a changé depuis |
| `{ kind: 'when-prompt', includes, then, else }` | Suite selon le message reçu (contient `includes`, sans tenir compte de la casse) |
| `{ kind: 'when-model', model, then, else }` | Suite selon le modèle de la session au moment du message (fiche 210) |
| `{ kind: 'echo' }` | Décrit le prompt reçu |
| `{ kind: 'child', sessionId, steps }` | Joue des étapes au nom d'un sous-agent |
| `{ kind: 'opencode-child', child, steps }` | Joue des étapes comme le travail d'un sous-agent d'OpenCode 2 : dans le flux de la session, marquées `_meta["opencode/child-session"]`, outils préfixés `<id>:` et titrés « <titre> : <outil> » |
| `{ kind: 'child-session', sessionId, history }` | Garde la session d'un sous-agent, rechargeable par `session/load` et absente de `session/list`, comme OpenCode 1.19 |
| `{ kind: 'bob-subagent', id, title?, cost?, done? }` | Avec `--bob-db` : ligne du sous-agent dans la base de Bob (créée, coût réécrit, terminée), comme Bob 2.0.6 |
| `{ kind: 'fail', message, data?, code?, stderr? }` | Erreur JSON-RPC (interne, ou `code`) ; `stderr` est écrit avant sur la sortie d'erreur |
| `{ kind: 'flaky', failures, fail, then }` | Joue `fail` les `failures` premières fois que la session passe par cette étape, puis `then` (panne passagère, fiche 142) |

Options de scénario : `stopReason`, et `session: { requireAuth, untrustedWorkspace }`.

Ajouter un scénario = une entrée dans le catalogue, un test dans `mock-agent.test.ts`, une ligne
dans le tableau ci-dessus.

Les scénarios des conversations filles appellent les outils comme les autres outils de l'app :
sans serveur MCP (catalogue de `mock-agent.test.ts`), ils se jouent sans erreur ; avec le vrai
serveur et le module des filles, ils sont joués par `conversations/children.test.ts` et par la
suite e2e `filles`. Les filles prennent l'agent de la mère : sa consigne commence par
`/scenario …`, et ses tours suivants jouent le scénario de lancement (`echo` dans les essais).

`echo` montre aussi le contexte de session : dans un dépôt git, avec les outils des filles, le
premier message d'une session arrive avec le bloc `<bobine_capabilities>` (fiche 118) ; après
`/compact` ou à la reprise d'une session (`--store`), le même bloc en rappel court (fiche 223).

## L'utiliser dans les tests

`src/mock-agent/testing.mts` lance l'agent dans un vrai sous-processus et s'y connecte :

```ts
const turn = await withMockAgent(
  { scenario: 'permission', onPermission: () => ({ outcome: { outcome: 'selected', optionId: 'allow' } }) },
  async (ctx) => {
    await initialize(ctx)
    return ctx.buildSession('/tmp/projet').withSession((s) => playTurn(s, 'Bonjour'))
  }
)
expect(turn.stopReason).toBe('end_turn')
```
