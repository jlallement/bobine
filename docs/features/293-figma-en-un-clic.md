# 293 — Figma en un clic (serveur MCP distant connecté par l'agent)

- **Statut** : proposé — spec et maquette à valider, rien de codé
- **Dépend de** : 025 (serveurs MCP des agents), 060 (« Tester » un serveur), 079 et 122 (outil
  `execute` d'OpenCode 2), 126 (confirmation dans la ligne), 287 (raison d'un bouton grisé)
- **Agents** : OpenCode seulement. La connexion OAuth au serveur de Figma est faite **par l'agent**,
  qui garde le jeton ; Figma n'accepte que les applications de sa liste publique
  (https://developers.figma.com/docs/figma-mcp-server/, relue le 2026-11-27) : OpenCode y est,
  IBM Bob et Bobine n'y sont pas. Capacité déclarée dans le profil d'OpenCode (repère
  `mcp-oauth`, ADR-0011) ; rien de supposé sur Bob.
- **Maquette** : [`docs/maquettes/293-figma-en-un-clic.html`](../maquettes/293-figma-en-un-clic.html),
  captures dans `docs/maquettes/293/` (`<planche>-<940|736|640|420>-<clair|sombre>.png`, Chrome sans
  fenêtre à l'échelle 1,5 ; 940 px = largeur réelle des Réglages, 736 px = fenêtre la plus étroite)

## Pourquoi

Brancher Figma à son agent demande aujourd'hui trois commandes dans un terminal, un navigateur
qui ne s'ouvre pas tout seul et une attente sans retour : on abandonne avant d'avoir vu un outil
Figma. Pour l'utilisateur d'OpenCode qui travaille avec des maquettes Figma (développeur front,
designer qui code), il faut un bouton « Connecter Figma » dans Réglages › Serveurs MCP, une page
Figma qui s'ouvre, un état clair (« Connecté », « Expiré », « Refusé »), et des appels Figma
reconnaissables dans le fil.

## Périmètre

**Dans la fiche** : Figma seul (`https://mcp.figma.com/mcp`), dans l'onglet OpenCode de Réglages ›
Serveurs MCP : ajouter, se connecter, se reconnecter, se déconnecter, retirer. En option (lot 3,
question Q4) : le nom de l'outil Figma à la place de « execute » dans le fil.

**Onglet IBM Bob** : pas de Figma. Une seule ligne d'aide dit pourquoi, d'après la documentation
de Figma et rien d'autre : Figma n'accepte que les applications de sa liste, et Bobine ne sait le
connecter que par OpenCode (Q3). Rien n'est dit, ni supposé, de ce que Bob saurait faire.

**Hors périmètre** :
- d'autres connecteurs, une galerie, un catalogue ;
- le serveur de bureau de Figma (application Figma ouverte, offres payantes) ;
- l'inscription de Bobine chez Figma, ou toute connexion faite par Bobine elle-même (Bobine ne
  parle jamais à Figma, n'emprunte jamais le nom d'une application listée) ;
- tout affichage de coût ou de quota ;
- Windows et Linux : rien de propre au Mac dans le mécanisme, mais la recette réelle n'est faite
  que sur Mac (à relever avant d'annoncer ailleurs).

## Parcours

### Premier branchement (« Connecter Figma »)

1. Réglages › Serveurs MCP › onglet **OpenCode**. Sous la liste des serveurs, une ligne
   **Figma** : « Serveur officiel de Figma. La connexion se fait dans votre navigateur, avec
   OpenCode. » et le bouton **Connecter Figma**. La ligne n'existe pas si un serveur de cette
   adresse est déjà déclaré (quel que soit son nom).
2. Clic : Bobine écrit le serveur `figma` (`{ type: remote, url }`) dans le fichier d'OpenCode,
   portée **tous les dossiers** (Q2), comme « Ajouter un serveur » ; la ligne devient une ligne de
   serveur ordinaire, puis la connexion part aussitôt (étape 3). Nom déjà pris par un autre
   serveur : `figma-2`, sans rien écraser.
3. Bobine lance `opencode mcp auth figma --standalone` (main), lit l'adresse de la page de
   connexion dans sa sortie, vérifie qu'elle est en `https` sur l'hôte attendu `www.figma.com`, et
   l'ouvre dans le navigateur par défaut. La ligne dit : « Page de connexion ouverte dans votre
   navigateur (www.figma.com). Autorisez l'accès, puis revenez ici. » ; boutons **Rouvrir la
   page** et **Annuler**.
4. L'utilisateur autorise l'accès sur la page de Figma. OpenCode reçoit le retour, écrit sa sortie
   (« Connected to figma »), finit. Bobine relit l'état chez OpenCode (source de vérité, voir
   « Source de l'état ») : **Connecté**.
5. Ligne d'aide sous l'état : « Pour les nouvelles conversations avec OpenCode ; relancez une
   conversation ouverte pour qu'elle reçoive les outils de Figma. » (à confirmer par le relevé
   R3, sinon retirée).

### Reconnexion après expiration

1. À l'ouverture de l'onglet (et après chaque action), Bobine relit l'état chez OpenCode : jeton
   expiré → **Connexion expirée**, bouton **Se reconnecter**.
2. Même déroulé que l'étape 3 du premier branchement (OpenCode dit lui-même « has expired
   credentials. Re-authenticating... » ; il ne pose aucune question hors terminal, relu dans son
   code 2.3.0).

### Déconnexion

1. **Se déconnecter** (bouton discret de la ligne connectée) → confirmation dans la ligne
   (fiche 126) : « Se déconnecter de Figma ? OpenCode oubliera l'accès ; il faudra vous
   reconnecter. » · **Se déconnecter** · **Garder**.
2. Bobine lance `opencode mcp logout figma --standalone`, puis relit l'état : **À connecter**. Le
   serveur reste déclaré.

### Retrait

1. Corbeille de la ligne, comme tout serveur. Si Figma est connecté, la confirmation le dit :
   « Retirer le serveur « figma » ? OpenCode garde l'accès à Figma tant que vous ne vous
   déconnectez pas. » · **Supprimer** · **Garder**.
2. Retirer n'enlève que la déclaration (l'accès d'OpenCode peut servir à un autre dossier qui
   déclare le même serveur, relevé R4). Pour tout oublier : **Se déconnecter** d'abord.
3. Le serveur retiré, la ligne « Connecter Figma » revient.

## États

« Ce que fait Bobine » : tout part du main (ADR, règle 1) ; le renderer ne reçoit que l'état, l'hôte
de la page et une raison courte, jamais l'adresse complète.

| État | Ce que l'utilisateur voit (ligne du serveur) | Boutons | Ce que fait Bobine |
|---|---|---|---|
| **Absent** | Ligne « Figma » sous la liste : nom, une phrase, icône neutre (globe) | **Connecter Figma** (principal) | Rien de lancé. Ligne cachée si un serveur `https://mcp.figma.com/mcp` existe déjà dans un des deux fichiers |
| **Ajouté, à connecter** | Pastille grise, « À connecter : la connexion se fait dans votre navigateur, avec OpenCode. » | **Se connecter** (principal), crayon, copie, corbeille ; pas de « Tester » | Lit l'état chez OpenCode : aucune connexion pour ce serveur. Le test de Bobine (fiche 060) n'est pas lancé pour ce serveur : sans jeton, Figma répond toujours 401 (relevé) |
| **Connexion en cours** | Pastille ambre qui pulse, « Page de connexion ouverte dans votre navigateur (www.figma.com). Autorisez l'accès, puis revenez ici. » ; en petit : « Sans réponse, abandon au bout de 10 min. » | **Rouvrir la page**, **Annuler** ; « Se connecter » des autres serveurs grisé (raison au survol : « Une connexion est déjà en cours ») | Processus lancé, adresse gardée en mémoire du main, page ouverte une fois ; délai 10 min ; une seule connexion à la fois dans toute l'app |
| **Connecté** | Pastille verte, « Connecté par OpenCode. Bobine ne voit jamais le jeton. » | **Se déconnecter** (discret), crayon, copie, corbeille | État relu chez OpenCode (connexion présente, pas expirée) |
| **Expiré** | Pastille ambre, « Connexion expirée. » | **Se reconnecter** (principal) | État relu : connexion présente, « à renouveler » selon OpenCode (forme exacte : R1) |
| **Refusé** | Pastille rouge, « Accès refusé sur la page de Figma. » | **Réessayer** | Sortie d'OpenCode qui dit le refus (forme exacte : R2, non relevée) ; état relu : à connecter |
| **Erreur** | Pastille rouge, « La connexion n'a pas abouti : <raison courte> », détail au survol (sans adresse) | **Réessayer**, **Faire dans un terminal** | Délai dépassé, page refusée par la vérification d'hôte, sortie non reconnue, processus mort : processus tué, état relu |
| **Agent absent** | Ligne « Figma » présente, bouton grisé ; raison : « OpenCode n'est pas installé. » | — | `opencode` introuvable (même recherche que le lancement de l'agent) : rien de lancé |
| **Commande non reconnue** (agent trop ancien, ou sortie qui a changé) | « OpenCode n'a pas proposé de page de connexion. Faites-le dans un terminal : `opencode mcp auth figma` » | **Copier la commande**, **Réessayer** | Aucune adresse lue en 30 s, ou commande inconnue : processus tué. Pas de `minVersion` supposée : seule la 2.3.0 est relevée |

« Faire dans un terminal » : la commande exacte à copier (`opencode mcp auth figma`, et `cd` du
dossier pour un serveur « ce dossier »), à lancer par l'utilisateur. Dans un vrai terminal, OpenCode
ouvre lui-même le navigateur (relu dans son code : `process.stdin.isTTY && process.stdout.isTTY`).

## Règles d'architecture

- **Seul le main process lance la commande de l'agent** et ouvre la page (`shell.openExternal`).
  Le renderer demande par l'IPC typé (`mcp:connect`, `mcp:cancelConnect`, `mcp:disconnect`,
  `mcp:authStates`) et reçoit un état (`mcp:authState`, événement) : état, hôte, raison courte.
- **Générique d'abord (ADR-0011, ADR-0015).** La capacité « connexion OAuth d'un serveur MCP
  distant par l'agent » est un champ du profil (`mcpOAuth`), porté par un adaptateur dans les
  modules d'OpenCode (`agent-config/opencode-mcp-auth.ts`) :
  - `connect(server)` : commande et arguments (`['mcp', 'auth', name, '--standalone']`) ;
  - `readOutput(line)` : reconnaît l'adresse, la fin (« Connected to », « Authorization expired »,
    échec) ;
  - `disconnect(server)` : `['mcp', 'logout', name, '--standalone']` ;
  - `states()` : `opencode auth list --format json --standalone`, lu en connexions par nom de
    serveur ;
  - `version` relevée : 2.3.0.
  Le moteur (`agent-config/mcp-oauth.ts` : lancement, délai, annulation, une seule connexion,
  vérification de l'adresse, journal) ne connaît ni OpenCode ni Figma.
- **Figma est un préréglage**, une donnée de `shared/mcp-presets.ts` : nom proposé, adresse,
  hôte attendu de la page (`www.figma.com`), clé de texte. Aucun `if figma` dans le code.
- **Pas de code propre à un agent dans l'UI.** L'onglet montre « Connecter Figma » et « Se
  connecter » pour un agent dont la vue porte `oauth: true` (posé par le main d'après le profil).
  L'onglet d'un agent sans la capacité (Bob, et tout agent déclaré par l'utilisateur) affiche la
  ligne d'aide générique « <préréglage> : pas proposé pour <agent> … ne sait le connecter que par
  <agents qui ont la capacité> », calculée d'après les profils, jamais d'après un identifiant :
  elle reste vraie pour tout agent, sans rien affirmer de Bob.
- **`specificItems`** : repère `mcp-oauth`, « Connexion des serveurs MCP distants : par
  `opencode mcp auth`, jeton gardé par OpenCode ». **`docs/agents.md`** : ligne `mcp-oauth`
  (Bob : « — : aucune commande documentée relevée » ; OpenCode : ✓ 2.3.0).

**« Se connecter » pour Figma seul, ou pour tout serveur distant ?** Recommandation : **Figma
seul dans cette fiche**, mécanisme générique dessous. Raison : la seule chose qui ne se généralise
pas sans risque est la vérification de l'hôte de la page ; pour Figma, il est connu et déclaré
(`www.figma.com`, aussi annoncé par `https://api.figma.com/.well-known/oauth-authorization-server`,
relevé). Pour un serveur quelconque, il faudrait le déduire des métadonnées OAuth du serveur
(RFC 9728 puis RFC 8414) : faisable, mais c'est une deuxième fiche, avec un second serveur relevé
en réel. (Q1)

## Sécurité

- **Le jeton reste chez l'agent.** Bobine ne lit jamais la base d'OpenCode (`opencode.db`), ne
  lance jamais `opencode auth export`, ne garde ni ne journalise rien de la connexion. L'état vient
  de `auth list` sans secret (relevé : identifiant, nom, type, méthode).
- **L'adresse est une donnée** (sortie d'un processus). Bobine n'ouvre qu'une adresse qui :
  se lit en entier par `new URL`, est en `https:`, a pour hôte exactement l'hôte attendu du
  préréglage, sans identifiants (`user:pass@`), longueur ≤ 4 096. Sinon : rien d'ouvert, état
  **Erreur** « Page inattendue (<hôte>) », processus tué.
- **Jamais l'adresse complète au journal ni au renderer** (elle porte `state`, `code_challenge`,
  `client_id`) : le journal dit l'hôte et l'étape (« MCP : connexion de « figma » par OpenCode :
  page ouverte (www.figma.com) ») ; la sortie de la commande est filtrée avant d'être journalisée.
- **Une seule connexion à la fois** dans l'app (un second clic est refusé par le main, pas
  seulement grisé). Le port de retour (`127.0.0.1:<port>/callback`) appartient à OpenCode.
- **Annulation** : « Annuler », le délai ou la fermeture de l'app tuent l'arbre de processus lancé
  (`killTree`, comme « Tester »). Fermer les Réglages ne l'arrête pas (on ferme souvent la fenêtre
  pour aller au navigateur) : la connexion continue dans le main, et la ligne montre son état à la
  réouverture. `--standalone`
  met le serveur privé d'OpenCode dans cet arbre ; OpenCode annule aussi sa tentative à
  l'interruption (relu dans son code ; à vérifier : R6).
- **Délai** : 10 min (proche de celui d'OpenCode, relevé « environ 10 min »), puis processus tué.
  OpenCode finit **avec le code 0** même sur « Authorization expired » : la fin se juge à la sortie
  **et** à l'état relu, jamais au code de sortie.
- **`--standalone` toujours** : sans lui, les commandes parlent au service de fond d'OpenCode
  (`opencode serve --service`), qui peut avoir été lancé avec un autre environnement (relevé : un
  service du 16 novembre, dossier `~`, tourne sur ce Mac). Environnement : celui avec lequel Bobine
  lance l'agent (réseau d'entreprise, `XDG_*` de l'utilisateur), dossier = dossier de la conversation
  affichée.
- Rien n'est demandé à Figma par Bobine ; aucun appel réseau de Bobine dans ce parcours.

## Source de l'état (relevé)

`opencode auth list --format json --standalone` (2.3.0) rend les intégrations, dont celle du
serveur MCP : `{ "id": "mcp_<empreinte>", "name": "figma", "connections": [{ "type":
"credential", "id": "cred_…", "label": "…", "method": "oauth" }] }`. Le type de l'API d'OpenCode
(relu dans son code) prévoit sur une connexion un `status` facultatif `{ status: "needs_auth",
message, url? }`. Règle proposée : connexion `oauth` présente sans `status` → **Connecté** ;
avec `status.status === "needs_auth"` → **Expiré** ; aucune → **À connecter** ; commande en échec
ou JSON inattendu → état **inconnu** (pastille grise, « État de la connexion inconnu », « Se
connecter » proposé).

`opencode mcp list` **n'est pas** une source fiable : il répond « No MCP servers configured » alors
que le serveur est déclaré et connecté, avec ou sans `--standalone` (relevé). Il ne sert pas.

## Contrat réel

### Relevé (2026-11-27, OpenCode 2.3.0, profil isolé `essai-figma`, `XDG_*` seuls)

| Commande ou source | Rendu |
|---|---|
| `opencode mcp --help` | sous-commandes `list`, `add`, `auth`, `logout` ; `auth` et `list` ont `--standalone` (« Run with a private server instead of the background service ») et `--server` |
| `opencode mcp add --help` | `--url`, `--header`, `--env`, `--global` (sinon : fichier du projet) |
| `opencode mcp list --standalone` (dans `projet/`) | « No MCP servers configured », code 0, 0,2 s — alors que le serveur est déclaré et connecté |
| `opencode debug config --standalone` | sources : dossier de configuration (vide), `projet/opencode.json` avec `mcp.servers.figma` `{ type: remote, url }` |
| `opencode auth list --format json --standalone` | intégration `figma`, une connexion `credential`, `method: "oauth"` (rien de secret) ; sans `--format json` : « figma  figma  stored » |
| Code d'OpenCode 2.3.0 (lu dans l'exécutable, MIT) | `mcp auth` : sans terminal, pas de question « Re-authenticate? » ; navigateur ouvert **seulement si stdin et stdout sont des terminaux** (cause de l'accroc 1) ; sortie : consigne, puis l'adresse seule sur sa ligne, puis « Waiting for authorization... », puis « Connected to <nom> », ou l'erreur, ou « Authorization expired » ; à l'interruption, `integration.oauth.cancel` (5 s) ; inscription du client par DCR chez Figma |
| `POST https://mcp.figma.com/mcp` sans jeton (`initialize`) | **401**, `WWW-Authenticate: Bearer resource_metadata="https://mcp.figma.com/.well-known/oauth-protected-resource", scope="mcp:connect", authorization_uri=…` |
| Métadonnées OAuth de Figma | `authorization_endpoint: https://www.figma.com/oauth/mcp`, `registration_endpoint` présent, PKCE `S256`, portée `mcp:connect` |
| Sortie de l'essai du matin (`auth.log`) | codes ANSI et tourniquet (« Starting authorization... ») ; « Authorize figma in your browser. This window will close automatically. » ; l'adresse ; « Waiting for authorization... » ; « Connected to figma » ; « Done » |
| Panneau « Échanges ACP » de Bobine (conversation « List the names of the tools… ») | 3 `tool_call` `execute` (`kind: other`, `rawInput: {}`), puis `in_progress` avec `rawInput.code` : `search({ namespace: "figma", limit: 100 })`, `search({ query: "whoami", namespace: "figma" })`, `await tools.figma.whoami()` ; fin `completed` avec `rawOutput.metadata.toolCalls: [{ tool: "search", input: { namespace: "figma", … } }]` puis `[{ tool: "figma.whoami", status: "completed" }]` |

Accrocs du brief, expliqués : (1) navigateur non ouvert = pas de terminal (code relu) ; (2) code 0
sur expiration (essai) ; (3) `mcp list` vide (relevé ci-dessus, cause non établie : liste du
serveur, pas de la configuration) ; (4) « execute » = Code Mode d'OpenCode (fiche 079) ; (5)
`mcp logout <nom>` existe.

### À relever par un essai réel avant de coder

- **R1** — Forme de l'état « expiré » dans `auth list --format json` (le `status` prévu par le type
  apparaît-il sans tentative de connexion ?). Méthode : profil isolé, jeton laissé expirer ou
  révoqué depuis le compte Figma.
- **R2** — Sortie et état quand l'utilisateur **refuse** sur la page de Figma (texte, code de
  sortie, état relu).
- **R3** — Les outils de Figma arrivent-ils dans une conversation **déjà ouverte** après la
  connexion, ou faut-il relancer l'agent ? (Le texte « relancez une conversation ouverte » en
  dépend.)
- **R4** — **Portée** : la connexion vaut-elle pour un autre dossier qui déclare la même adresse
  (l'empreinte `mcp_…` dépend-elle de l'adresse, du nom, du dossier) ? Et pour un serveur déclaré
  « tous les dossiers » ?
- **R5** — `auth list` d'un serveur déclaré **sans** connexion : intégration listée avec
  `connections: []`, ou absente ?
- **R6** — Annulation : processus tué pendant « Waiting for authorization... » → port libéré,
  tentative annulée, un nouvel essai part sans erreur.
- **R7** — Deux serveurs de même nom (global et dossier) : lequel `mcp auth` prend-il ?
- **R8** — OpenCode 1.19 et 2.4.1 : `mcp auth --standalone` et `auth list --format json` existent-ils
  et rendent-ils la même chose ? (Sinon : état « commande non reconnue », pas de version imposée.)
- **R9** — Windows et Linux : ouverture de la page, fin du processus et de son serveur privé.

## Appels Figma dans le fil

**Constat** (relevé ci-dessus) : OpenCode 2.3.0 appelle les outils MCP depuis du JavaScript, par son
outil `execute` (« Code Mode », fiche 079). Le fil montre trois cartes « execute » : Bobine ne
rattache par nom que **ses propres** outils (elle est leur serveur) ; ceux de Figma ne passent
jamais par elle. Mais OpenCode les nomme lui-même à la fin de la carte :
`rawOutput.metadata.toolCalls[].tool` vaut `figma.whoami`, ou `search` avec `input.namespace:
"figma"`. Le profil d'OpenCode lit déjà ce tableau pour les échecs (`toolStatus`, fiche 122).

**Proposition (lot 3, Q4)** : à la fin d'une carte `execute`, l'adaptateur d'OpenCode rend aussi
les outils appelés ; le main pose la marque générique `_meta["bobine/calledTools"]` (liste de
`{ server?, tool }`) ; le fil titre la carte d'après elle, comme les outils de l'app (fiche 079) :
« figma · whoami » ; `search` d'un espace → « Cherche parmi les outils de figma » ; plusieurs
appels à la suite (« figma · get_design_context · figma · get_screenshot »). Pendant l'appel, la
carte garde « execute » (le code peut arriver après l'appel, fiche 079 : rien deviné du code).
Générique : vaut pour tout serveur MCP appelé par le Code Mode d'OpenCode, pas seulement Figma.
Écarté : écrire `codemode: false` sur le serveur dans la configuration d'OpenCode (déjà écarté par
la fiche 079, et l'effet sur les titres n'est pas relevé).

## Textes (clés proposées, ADR-0014)

Vocabulaire : « se connecter » / *sign in*, « connexion » / *sign-in* (glossaire, « Autorisations,
connexion ») ; « serveur MCP » ; « tous les dossiers » / *all folders* ; « navigateur » / *browser*.

| Clé | Français | Anglais |
|---|---|---|
| `mcp.preset.figma.name` | Figma | Figma |
| `mcp.preset.figma.summary` | Serveur officiel de Figma. La connexion se fait dans votre navigateur, avec {{agent}}. | Figma's official server. You sign in in your browser, through {{agent}}. |
| `mcp.preset.connect` | Connecter {{name}} | Connect {{name}} |
| `mcp.preset.notOffered` | {{name}} : pas proposé pour {{agent}}. {{name}} n'accepte que les applications de sa liste ; Bobine ne sait le connecter que par {{agents}}. | {{name}}: not available for {{agent}}. {{name}} only accepts the apps on its list; Bobine can only connect it through {{agents}}. |
| `mcp.preset.listLink` | Liste de {{name}} | {{name}}'s list |
| `mcp.auth.toConnect` | À connecter : la connexion se fait dans votre navigateur, avec {{agent}}. | Not signed in: you sign in in your browser, through {{agent}}. |
| `mcp.auth.connect` | Se connecter | Sign in |
| `mcp.auth.pending` | Page de connexion ouverte dans votre navigateur ({{host}}). Autorisez l'accès, puis revenez ici. | Sign-in page opened in your browser ({{host}}). Allow access, then come back here. |
| `mcp.auth.pendingDelay` | Sans réponse, abandon au bout de {{minutes}} min. | With no answer, it stops after {{minutes}} min. |
| `mcp.auth.reopen` | Rouvrir la page | Reopen the page |
| `mcp.auth.connected` | Connecté par {{agent}}. Bobine ne voit jamais le jeton. | Signed in through {{agent}}. Bobine never sees the token. |
| `mcp.auth.disconnect` | Se déconnecter | Sign out |
| `mcp.auth.disconnectAsk` | Se déconnecter de {{name}} ? {{agent}} oubliera l'accès ; il faudra vous reconnecter. | Sign out of {{name}}? {{agent}} will forget the access; you will need to sign in again. |
| `mcp.auth.expired` | Connexion expirée. | Sign-in expired. |
| `mcp.auth.reconnect` | Se reconnecter | Sign in again |
| `mcp.auth.refused` | Accès refusé sur la page de {{name}}. | Access denied on the {{name}} page. |
| `mcp.auth.failed` | La connexion n'a pas abouti : {{reason}} | Sign-in did not complete: {{reason}} |
| `mcp.auth.reason.timeout` | pas de réponse en {{minutes}} min | no answer within {{minutes}} min |
| `mcp.auth.reason.unexpectedPage` | page inattendue ({{host}}) | unexpected page ({{host}}) |
| `mcp.auth.reason.stopped` | {{agent}} s'est arrêté | {{agent}} stopped |
| `mcp.auth.noPage` | {{agent}} n'a pas proposé de page de connexion. Faites-le dans un terminal : | {{agent}} did not offer a sign-in page. Do it in a terminal: |
| `mcp.auth.inTerminal` | Faire dans un terminal | Do it in a terminal |
| `mcp.auth.copyCommand` | Copier la commande | Copy the command |
| `mcp.auth.unknown` | État de la connexion inconnu. | Sign-in status unknown. |
| `mcp.auth.busy` | Une connexion est déjà en cours. | A sign-in is already in progress. |
| `mcp.auth.agentMissing` | {{agent}} n'est pas installé. | {{agent}} is not installed. |
| `mcp.auth.newConversations` | Pour les nouvelles conversations avec {{agent}} ; relancez une conversation ouverte pour qu'elle reçoive ces outils. | For new conversations with {{agent}}; restart an open conversation so it gets these tools. |
| `mcp.auth.removeAskConnected` | Retirer le serveur « {{name}} » ? {{agent}} garde l'accès tant que vous ne vous déconnectez pas. | Remove the “{{name}}” server? {{agent}} keeps the access until you sign out. |
| `mcp.state.toConnect`, `connecting`, `connected`, `expired` (pastille) | à connecter, connexion en cours, connecté, connexion expirée | not signed in, signing in, signed in, sign-in expired |
| `capabilities.mcpOAuth.label` / `.detail` | Connexion des serveurs MCP distants / Par `{{command}}` ; le jeton reste chez {{agent}} | Remote MCP server sign-in / Through `{{command}}`; the token stays with {{agent}} |
| `toolCall.calledTools.search` (lot 3) | Cherche parmi les outils de {{server}} | Searches {{server}}'s tools |

**Astuce** (`tips`, une fois, dans l'onglet OpenCode tant que Figma est absent) : « Vous travaillez
avec des maquettes Figma ? « Connecter Figma » donne à OpenCode les outils de Figma. » / « Working
from Figma designs? “Connect Figma” gives OpenCode Figma's tools. » (clé `tips.mcpFigma`, Q5 de la
maquette : retirable sans rien changer d'autre).

## Questions pour Jérôme

**Q1 — « Se connecter » : Figma seul, ou tout serveur distant de l'onglet OpenCode ?**
- A (recommandé) : Figma seul ; mécanisme générique dessous, ouverture à tous dans une fiche
  suivante. Impact : petit. Risque : faible (hôte connu). Gain : livrable vite, sûr.
- B : tout serveur distant qui répond 401 `Bearer`. Impact : + vérification de l'hôte par les
  métadonnées OAuth, un second serveur à relever. Risque : moyen (page ouverte sur un hôte lu à
  distance). Gain : GitHub, Linear… sans nouvelle fiche.

**Q2 — Portée de « Connecter Figma »**
- A (recommandé) : **tous les dossiers**, sans question. Impact : nul. Risque : Figma proposé dans
  toutes les conversations d'OpenCode (≈ 50 outils, du contexte en plus : à mesurer, R3). Gain :
  un vrai clic ; l'accès d'OpenCode semble de toute façon global (R4).
- B : demander la portée (deux boutons). Impact : un choix de plus. Gain : contexte léger hors des
  projets qui servent Figma.

**Q3 — Onglet IBM Bob**
- A (recommandé) : une ligne d'aide « Figma : pas proposé pour IBM Bob. Figma n'accepte que les
  applications de sa liste ; Bobine ne sait le connecter que par OpenCode. » avec le lien vers la
  liste de Figma. Risque : nul (rien d'affirmé sur Bob). Gain : pas de recherche inutile.
- B : rien. Gain : écran inchangé ; l'utilisateur de Bob se demande pourquoi.

**Q4 — Nom de l'outil Figma dans le fil (au lieu de « execute »)**
- A (recommandé) : lot 3 de cette fiche, générique (tout serveur appelé par le Code Mode
  d'OpenCode). Impact : adaptateur `toolStatus` + marque `_meta` + titre ; ≈ ½ j. Risque : faible
  (lu à la fin de la carte, champ déjà sondé par `pnpm opencode-probe`). Gain : le fil se lit.
- B : fiche à part, plus tard. C : rien.

**Q5 — Astuce « Vous travaillez avec des maquettes Figma ? »**
- A (recommandé) : non, pas d'astuce : la ligne « Connecter Figma » suffit (sobriété). B : oui,
  une fois.

## Critères d'acceptation

- [ ] Onglet OpenCode : « Connecter Figma » ajoute `figma` (portée de Q2) dans le fichier
      d'OpenCode, au format déjà présent (`mcp.servers` ou `mcp`), puis lance la connexion ;
      ligne cachée si l'adresse est déjà déclarée, sous n'importe quel nom.
- [ ] La page n'est ouverte que si l'adresse lue est `https://www.figma.com/…`, sans identifiants ;
      toute autre adresse : rien d'ouvert, état Erreur avec l'hôte, processus tué.
- [ ] Chaque état du tableau s'affiche avec ses boutons, clair et sombre, français et anglais, à la
      largeur réelle et étroite des Réglages ; rien de tronqué sans `title`.
- [ ] Une seule connexion à la fois (refus côté main, bouton grisé avec raison).
- [ ] « Annuler » ou quitter l'app tue l'arbre de processus (vérifié : plus de processus après
      2 s) ; fermer puis rouvrir les Réglages pendant la connexion retrouve l'état « en cours ».
- [ ] Délai : processus tué à 10 min (raccourci en essai), état Erreur « pas de réponse ».
- [ ] État final relu par `auth list` ; code de sortie jamais utilisé pour juger la fin.
- [ ] Aucune adresse complète dans `agents.log`, l'IPC ou le DOM (essai : recherche de
      `code_challenge` et `state=` dans le journal et le DOM après un parcours).
- [ ] « Tester » n'est pas lancé pour un serveur à connexion par l'agent ; pastille selon l'état.
- [ ] Onglet Bob : ligne d'aide (si Q3 = A), aucun bouton.
- [ ] `specificItems` et `docs/agents.md` : repère `mcp-oauth` (test existant des repères).
- [ ] (Lot 3) Une carte `execute` finie avec `toolCalls: [{ tool: "figma.whoami" }]` s'intitule
      « figma · whoami » ; une carte sans ce champ garde « execute ».
- [ ] **Unitaires** : lecture de la sortie (ANSI, tourniquet, adresse seule sur sa ligne, « Connected
      to », « Authorization expired », erreur, sortie inconnue), vérification d'adresse (http, autre
      hôte, `user@`, trop longue, adresse coupée), lecture de `auth list` (connecté, expiré, absent,
      JSON invalide), machine d'états (une seule connexion, annulation, délai).
- [ ] **E2e** contre une **fausse commande** (`e2e/fake-opencode-mcp.mjs`, imposée par une variable
      d'essai comme `BOBINE_GH`) : parcours connexion réussie, refus, délai (raccourci), page
      inattendue, déconnexion, retrait ; captures clair et sombre regardées. Jamais le vrai
      OpenCode ni Figma en test automatisé.
- [ ] **Recette réelle manuelle** (Mac, OpenCode 2.3.0, profil isolé `XDG_*`, compte Figma de
      Jérôme) : connecter, appeler `whoami` dans une nouvelle conversation, se déconnecter,
      reconnecter ; R1 à R7 relevés et reportés ici et dans `docs/acp.md`.

## Plan

0. **Relevés R1 à R8** (essai réel, profil isolé) ; puis ADR « connexion OAuth d'un serveur MCP
   par l'agent : Bobine ouvre une page lue dans sa sortie, après vérification d'hôte ».
1. **Lot 1 — moteur (main)**, ≈ 1,5 j :
   - `shared/mcp.ts` : `McpAuthState`, `oauth` sur `McpAgentView` ; `shared/mcp-presets.ts`
     (Figma) ; `shared/ipc.ts` : canaux.
   - `main/agent/adapters.ts` : `McpOAuthSource` ; `main/agent-config/opencode-mcp-auth.ts`
     (commande, lecture de sortie, `auth list`) ; `main/agent/profiles.ts` : `mcpOAuth`.
   - `main/agent-config/mcp-oauth.ts` : lancement (`startProcess`, `killTree`), délai, une seule
     connexion, vérification d'adresse, `shell.openExternal`, journal filtré.
   - `main/agent-config/mcp-ipc.ts`, `mcp-settings.ts` : canaux, pas de test 060 pour ces serveurs.
   - `main/agent/capabilities.ts` : repère `mcp-oauth`.
   - Unitaires.
2. **Lot 2 — interface**, ≈ 1 j : `components/settings/McpAuthRow.tsx` (nouveau : `McpSettings.tsx`
   est à 679 lignes, plafond 800), `McpSettings.tsx` (ligne du préréglage, état sous la ligne du
   serveur), styles, `fr.json` / `en.json` ; fausse commande e2e, suite `mcp` étendue (ou
   `mcp-figma`).
3. **Lot 3 — fil** (si Q4 = A), ≈ ½ j : `opencode-contract.ts` (outils appelés), marque
   `_meta["bobine/calledTools"]`, titre dans `ToolCall.tsx` ; agent factice : scénario
   `outils-mcp-execute` ; sonde d'OpenCode : `toolCalls[].tool` d'un serveur MCP tiers.
4. **Clore** : recette réelle, `docs/agents.md`, `docs/acp.md` (Compatibilité OpenCode),
   `docs/architecture.md` (IPC), fiche, index, `CHANGELOG.md` et `CHANGELOG.en.md`.

Taille : ≈ 3 j avec le lot 3, relevés compris. **Aucune dépendance nouvelle.**

## Journal

- 2026-11-27 — Fiche et maquette (BA et UX) : relevés en lecture seule sur le profil isolé
  `essai-figma` (commandes d'aide, `mcp list`, `debug config`, `auth list`, code de l'exécutable
  2.3.0, réponses publiques de Figma, panneau « Échanges ACP » de l'instance pilotée). Rien de
  codé ; R1 à R9 à relever avant de coder.
