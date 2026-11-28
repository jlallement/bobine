# 293 — Figma en un clic (serveur MCP distant connecté par l'agent)

- **Statut** : spec et maquette validées par Jérôme le 2026-11-27 ; relevés R4, R5, R6 faits (R1,
  R2, R3, R7 à R9 non) ; ADR-0077 proposé ; lot 1 (moteur, main) et lot 2 (interface) codés, en
  attente de relecture ; lot 3 (fil) et recette réelle à faire
- **Dépend de** : 025 (serveurs MCP des agents), 060 (« Tester » un serveur), 079 et 122 (outil
  `execute` d'OpenCode 2), 126 (confirmation dans la ligne), 287 (raison d'un bouton grisé)
- **Agents** : OpenCode seulement. La connexion OAuth au serveur de Figma est faite **par l'agent**,
  qui garde le jeton ; Figma n'accepte que les applications de sa liste publique
  (https://developers.figma.com/docs/figma-mcp-server/, relue le 2026-11-27) : OpenCode y est,
  IBM Bob et Bobine n'y sont pas. Capacité déclarée dans le profil d'OpenCode (repère
  `mcp-oauth`, ADR-0011) ; rien de supposé sur Bob.
- **Maquette** : [`docs/maquettes/293-figma-en-un-clic.html`](../maquettes/293-figma-en-un-clic.html),
  captures dans `docs/maquettes/293/` (`<planche>-<940|736|640|420>-<clair|sombre>.png`, Chrome sans
  fenêtre à l'échelle 1, colonne de droite des Réglages seulement, à sa hauteur utile ; 940 =
  fenêtre des Réglages à sa largeur réelle, 736 = fenêtre la plus étroite, en clair seulement)

## Pourquoi

Brancher Figma à son agent demande aujourd'hui trois commandes dans un terminal, un navigateur
qui ne s'ouvre pas tout seul et une attente sans retour : on abandonne avant d'avoir vu un outil
Figma. Pour l'utilisateur d'OpenCode qui travaille avec des maquettes Figma (développeur front,
designer qui code), il faut un bouton « Connecter Figma » dans Réglages › Serveurs MCP, une page
Figma qui s'ouvre, un état clair (« Connecté », « Expiré », « Refusé »), et des appels Figma
reconnaissables dans le fil.

## Périmètre

**Dans la fiche** : Figma seul (`https://mcp.figma.com/mcp`), dans l'onglet OpenCode de Réglages ›
Serveurs MCP : ajouter, se connecter, se reconnecter, se déconnecter, retirer. Et (lot 3, Q4
tranchée) le nom de l'outil Figma à la place de « execute » dans le fil.

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
   **Figma** en carte pleine, avec le logo officiel de Figma (boîte de 56 px, dessin ≈ 26 px, non modifié) : « Serveur
   officiel de Figma. La connexion se fait dans votre navigateur, avec
   OpenCode. » et le bouton **Connecter Figma**. La ligne n'existe pas si un serveur de cette
   adresse est déjà déclaré (quel que soit son nom).
2. Clic : Bobine écrit le serveur `figma` (`{ type: remote, url }`) dans le fichier d'OpenCode,
   portée **tous les dossiers** (Q2), comme « Ajouter un serveur » ; la ligne devient une ligne de
   serveur ordinaire, puis la connexion part aussitôt (étape 3). Nom déjà pris par un autre
   serveur : `figma-2`, sans rien écraser.
3. Bobine lance `opencode mcp auth figma --standalone` (main), lit l'adresse de la page de
   connexion dans sa sortie, vérifie qu'elle est en `https` sur l'hôte attendu `www.figma.com`, et
   l'ouvre dans le navigateur par défaut. Ligne d'état : « ◌ Connexion en cours (www.figma.com) ·
   Rouvrir la page · Annuler » ; la consigne (« autorisez l'accès, puis revenez ici ») et le délai de 10 min
   sont dans son info-bulle.
4. L'utilisateur autorise l'accès sur la page de Figma. OpenCode reçoit le retour, écrit sa sortie
   (« Connected to figma »), finit. Bobine relit l'état chez OpenCode (source de vérité, voir
   « Source de l'état ») : **Connecté**.
5. « Vaut pour les nouvelles conversations ; relancez une conversation ouverte » : dans l'info-bulle
   de « Connecté par OpenCode », et déjà dit dans « Fichiers d'OpenCode » (texte existant) ; pas de
   ligne de plus sous la liste (à revoir selon le relevé R3).

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

**Gabarit d'un état** (retour de Jérôme du 2026-11-27 : pas de pavé) : **une ligne** sous l'adresse,
au poids de la ligne de résultat de « Tester » (« ✓ Joignable · … », 11,5 px, couleur discrète) :
icône + texte court (l'état ne repose jamais sur la seule couleur), puis les actions en **liens**
(boutons plats à la hauteur du texte, couleur d'accent, soulignés au survol, atteignables au
clavier, contour au focus), séparées par « · », qui reste en fin de ligne avec ce qui le précède. Le détail va
dans l'info-bulle de la ligne (`title`, sans adresse). Une ligne à 940 px ; à 736 px, deux au plus.
Seul bouton plein du parcours : « Connecter Figma ».

| État | Ligne d'état (sous l'adresse) | Info-bulle | Ce que fait Bobine |
|---|---|---|---|
| **Absent** | — : carte « Figma » sous la liste (logo officiel, boîte de 56 px, nom, une phrase, **Connecter Figma**, bouton plein) | — | Rien de lancé. Carte cachée si un serveur `https://mcp.figma.com/mcp` existe déjà dans un des deux fichiers |
| **Ajouté, à connecter** | ⓘ À connecter · *Se connecter* — pastille grise ; crayon, copie, corbeille ; pas de « Tester » | La connexion se fait dans votre navigateur, avec OpenCode. | Lit l'état chez OpenCode : aucune connexion. Pas de test de Bobine (fiche 060) pour ce serveur : sans jeton, Figma répond toujours 401 (relevé) |
| **Connexion en cours** | ◌ Connexion en cours (www.figma.com) · *Rouvrir la page* · *Annuler* — pastille ambre qui pulse ; « Se connecter » des autres serveurs grisé (« Une connexion est déjà en cours ») | Page ouverte dans votre navigateur : autorisez l'accès, puis revenez ici. Sans réponse, abandon au bout de 10 min. | Processus lancé, adresse gardée en mémoire du main, page ouverte une fois ; délai 10 min ; une seule connexion à la fois dans toute l'app |
| **Connecté** | ✓ Connecté par OpenCode · *Se déconnecter* — pastille verte | Le jeton reste chez OpenCode : Bobine ne le voit jamais. Vaut pour les nouvelles conversations ; relancez une conversation ouverte. | État relu chez OpenCode (connexion présente, pas expirée) |
| **Expiré** | ⚠ Connexion expirée · *Se reconnecter* — pastille ambre | — | État relu : connexion « à renouveler » selon OpenCode (forme exacte : R1) |
| **Refusé** | ✕ Accès refusé sur la page de Figma · *Réessayer* — pastille rouge | — | Sortie d'OpenCode qui dit le refus (forme exacte : R2) ; état relu : à connecter |
| **Erreur** | ✕ <raison courte> · *Réessayer* · *Dans un terminal* — pastille rouge ; raisons : « Pas de réponse en 10 min », « Page inattendue (<hôte>) », « OpenCode s'est arrêté » | La connexion n'a pas abouti : <détail, sans adresse> | Délai dépassé, page refusée par la vérification d'hôte, processus mort : processus tué, état relu |
| **Commande non reconnue** (agent trop ancien, ou sortie qui a changé) | ⓘ Pas de page de connexion · *Dans un terminal* · *Réessayer* | OpenCode n'a pas proposé de page de connexion. | Aucune adresse lue en 30 s, ou commande inconnue : processus tué. Pas de `minVersion` supposée : seule la 2.3.0 est relevée |
| **Commande copiée** (après *Dans un terminal*) | ✓ Copiée : `opencode mcp auth figma` · *Réessayer ici* | À coller dans un terminal : OpenCode y ouvre lui-même la page de Figma. | Commande copiée dans le presse-papiers (et `cd` du dossier pour un serveur « ce dossier ») |
| **Agent absent** | — : carte « Figma », bouton grisé, raison en clair dessous : « OpenCode n'est pas installé. » | même raison | `opencode` introuvable (même recherche que le lancement de l'agent) : rien de lancé |

Choix : « Bobine ne voit jamais le jeton » passe en **info-bulle** de « Connecté » (rassurant, pas
une action ; dit aussi dans la fiche et l'aide) ; en cours, **seul l'hôte reste visible** (c'est la
vérification de sécurité que l'utilisateur peut contrôler) ; consigne et délai en info-bulle, la
page de Figma disant elle-même quoi faire.

« Dans un terminal » : copie la commande exacte (`opencode mcp auth figma`, et `cd` du dossier
pour un serveur « ce dossier »), à lancer par l'utilisateur. Dans un vrai terminal, OpenCode
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

**« Se connecter » pour Figma seul** (Q1 tranchée par Jérôme : « Figma seul »), mécanisme
générique dessous. Raison : la seule chose qui ne se généralise
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
  est en ASCII imprimable et fait au plus 4 096 caractères ; se lit en entier par `new URL` ; est
  en `https:` ; a pour hôte exactement l'hôte attendu du préréglage (`pageHost`), écrit tel quel
  (majuscules et `:443` admis, aucun encodage) ; a pour chemin exactement le chemin attendu du
  préréglage (`pagePath`, Figma : `/oauth/mcp`, celui de l'`authorization_endpoint` publié),
  **écrit tel quel** (ni `..`, ni `.`, ni encodage, ni `\`) ; n'a pas d'identifiants
  (`user:pass@`) ; n'a ni `request` ni `request_uri` (à la casse près), ni `;` dans la requête ;
  porte un **`redirect_uri` exigé** par le préréglage (`pageLoopbackRedirect`, Figma : oui, relevé
  `http://127.0.0.1:<port>/callback` ; sans lui, ce pourrait être la page de consentement du client
  d'un tiers), **unique** et écrit sous ce nom exact (`REDIRECT_URI`, `redirect%255Furi`, et tout nom qui,
  décodé, rogné de ses espaces et débarrassé de `[]` et de `\0`, vaut `redirect_uri`, `request` ou
  `request_uri` — `redirect_uri%20`, `redirect_uri+`, `redirect_uri[]`, `redirect_uri%00` : refus,
  on ne parie pas sur celui que lira le serveur ; `redirect%5Furi` seul est le même nom une fois
  décodé, accepté et vérifié comme les autres) ; ce retour, décodé
  une fois, ne contient ni `\` ni `@`, est en `http`, a pour hôte **écrit** exactement `127.0.0.1`
  ou `localhost` (ni `127.1`, ni `0x7f.1`, ni `[::1]`, ni point final, ni majuscules) et un port en
  chiffres. Un préréglage qui ne l'exige pas accepte une page sans retour, jamais un mauvais. Sinon : rien d'ouvert, état **Erreur** « Page inattendue (<hôte>) »,
  processus arrêté. C'est l'adresse normalisée par `URL`, celle qui a été vérifiée, qui est ouverte.
- **Pas d'adresse après la fin** : une adresse lue après la sortie du processus, ou sur une
  dernière ligne sans retour à la ligne (peut-être coupée), n'est jamais ouverte.
- **Jamais l'adresse complète au journal ni au renderer** (elle porte `state`, `code_challenge`,
  `client_id`) : **aucune ligne de sortie n'est journalisée**, à aucun niveau ; le journal dit ce
  qui a été reconnu (page ouverte ou refusée avec l'hôte, connexion, expiration, annulation, échec
  dits par l'agent) et compte les lignes non reconnues. Les messages d'erreur du système
  (lancement, ouverture de la page) passent par `scrubUrls`, qui masque tout mot pouvant porter une
  adresse ou un paramètre (avec ou sans schéma, `https:/`, antislashs, `clé=valeur`).
- **Une seule connexion à la fois** dans l'app (un second clic est refusé par le main, pas
  seulement grisé) tant que le processus de la tentative vit, ou qu'une déconnexion tourne. Chaque
  opération porte un numéro : la relecture d'une tentative finie, si une autre opération est partie
  depuis pour le même serveur (ou si l'app se ferme), n'émet rien et ne range rien. Le port de retour (`127.0.0.1:<port>/callback`) appartient à OpenCode.
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

### Relevés du tech lead (2026-11-27, OpenCode 2.3.0, macOS, deux profils isolés par `XDG_*`)

Faits :

- **R5** — `opencode auth list --format json --standalone` rend `[]` (code 0) aussi bien sans
  serveur déclaré qu'avec `figma` déclaré **sans** connexion ; sans `--format json` : « No
  authenticated integrations ». Donc : intégration absente = **à connecter** (pas de
  `connections: []`).
- **R6** — Pendant « Waiting for authorization... », le processus `opencode mcp auth figma
  --standalone` a **un enfant** (`opencode`, le serveur privé) qui écoute le port de retour
  `127.0.0.1:<port>`. `SIGTERM` comme `SIGINT` sur le parent : fin en 0,3 s, dernière ligne
  « └  Cancelled », enfant disparu, port libéré ; un nouvel essai repart aussitôt avec un nouveau
  port (trois fois de suite). `auth list` reste `[]`. Conséquence : arrêter **l'arbre** (`killTree`),
  pas le seul parent.
- **R4** — Profil connecté. Dans le dossier d'origine : intégration `figma` avec une connexion
  `oauth`. Dans un **autre dossier** qui déclare le **même nom et la même adresse** : la même
  connexion est vue (la connexion vaut pour tout le profil OpenCode). Dans un dossier qui déclare la
  **même adresse sous un autre nom** (`maquettes`) : `[]`. Dans un dossier **sans** serveur
  déclaré : `[]`. Conséquences : `auth list` ne montre que les serveurs déclarés pour le dossier
  courant, la commande tourne donc dans le bon dossier (un serveur « tous les dossiers » est vu de
  partout) ; la connexion est attachée au **nom** : un `figma-2` de repli (nom `figma` déjà pris par
  un autre serveur) a **sa propre connexion**, à faire, et le retirer puis redéclarer `figma` ne
  reprend pas celle de `figma-2`.
- **Avant connexion** — Une conversation Bobine ouverte sur un dossier où `figma` est déclaré sans
  connexion : l'agent répond « 0 figma tools ».
- **Expiration de la tentative** (essai du matin) — Sans accord, fin au bout d'environ 618 s,
  lignes « ■  Authorization expired » puis « └  Failed », **code de sortie 0**.
- **Sorties brutes** (octets, codes ANSI, tourniquet ; `client_id`, `state`, `code_challenge` et
  port remplacés par des valeurs factices) : `src/main/agent-config/fixtures/opencode-2.3.0-mcp-auth/`
  (`sortie-reussie.txt`, `sortie-annulee.txt`, `LISEZMOI.md`), copiées telles quelles et rejouées
  par les essais du moteur. L'expiration n'a pas été gardée en octets (relevée à l'écran).

**Pas faits** (ils demandent un clic de Jérôme, qui n'était plus devant le Mac) : **R2** (refus sur
la page de Figma), **R3** (outils dans une conversation déjà ouverte). Pas faits non plus : **R1**
(forme de l'état expiré dans `auth list`), **R7**, **R8**, **R9**. Le code n'en suppose rien :

- une fin de sortie non reconnue donne l'état générique **Erreur** ;
- le **refus** n'est pas reconnu : `TODO(R2)` (2026-11-27), point d'extension prévu dans la lecture
  de sortie de l'adaptateur (`McpAuthLine` `refused`), branché quand le relevé existera ; jusque-là
  un refus finit en Erreur (« La connexion n'a pas abouti ») ;
- `status.status === "needs_auth"` n'est lu que comme champ **facultatif** (type de l'API relu dans
  le code, jamais vu en sortie) : son absence ne change rien (essai).

### Restant à relever

- **R1** — Forme de l'état « expiré » dans `auth list --format json` (le `status` prévu par le type
  apparaît-il sans tentative de connexion ?). Méthode : profil isolé, jeton laissé expirer ou
  révoqué depuis le compte Figma.
- **R2** — Sortie et état quand l'utilisateur **refuse** sur la page de Figma (texte, code de
  sortie, état relu).
- **R3** — Les outils de Figma arrivent-ils dans une conversation **déjà ouverte** après la
  connexion, ou faut-il relancer l'agent ? (Le texte « relancez une conversation ouverte » en
  dépend.)
- R4, R5, R6 : faits (ci-dessus).
- **R7** — Deux serveurs de même nom (global et dossier) : lequel `mcp auth` prend-il ?
- **R8** — OpenCode 1.19 et 2.4.1 : `mcp auth --standalone` et `auth list --format json` existent-ils
  et rendent-ils la même chose ? (Sinon : état « commande non reconnue », pas de version imposée.)
- **R9** — Windows et Linux : ouverture de la page, fin du processus et de son serveur privé ; et
  la sortie d'OpenCode hors terminal Unicode (cas d'une app graphique sous Windows) : sa
  bibliothèque d'invite remplacerait `●`, `◆`, `■`, `└` par de l'ASCII. La lecture de l'adaptateur
  ne dépend d'aucun symbole de tête (préfixe court ignoré, statuts reconnus à leur texte) ; les
  variantes ASCII sont des essais étiquetés « hypothèse, non relevée sous Windows ». L'essai en vrai
  processus est écrit pour être portable (aucun signal à un numéro de processus, mort de l'enfant
  prouvée par un battement qui s'arrête), mais n'a tourné que sur Mac.

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
| `mcp.auth.toConnect` | À connecter | Not signed in |
| `mcp.auth.toConnectTip` | La connexion se fait dans votre navigateur, avec {{agent}}. | You sign in in your browser, through {{agent}}. |
| `mcp.auth.connect` | Se connecter | Sign in |
| `mcp.auth.pending` | Connexion en cours ({{host}}) | Signing in ({{host}}) |
| `mcp.auth.pendingTip` | Page de connexion ouverte dans votre navigateur : autorisez l'accès, puis revenez ici. Sans réponse, abandon au bout de {{minutes}} min. | Sign-in page opened in your browser: allow access, then come back here. With no answer, it stops after {{minutes}} min. |
| `mcp.auth.reopen` | Rouvrir la page | Reopen the page |
| `mcp.auth.connected` | Connecté par {{agent}} | Signed in through {{agent}} |
| `mcp.auth.connectedTip` | Le jeton reste chez {{agent}} : Bobine ne le voit jamais. Vaut pour les nouvelles conversations ; relancez une conversation ouverte pour qu'elle reçoive ces outils. | The token stays with {{agent}}: Bobine never sees it. Applies to new conversations; restart an open conversation for it to get these tools. |
| `mcp.auth.disconnect` | Se déconnecter | Sign out |
| `mcp.auth.disconnectAsk` | Se déconnecter de {{name}} ? {{agent}} oubliera l'accès ; il faudra vous reconnecter. | Sign out of {{name}}? {{agent}} will forget the access; you will need to sign in again. |
| `mcp.auth.expired` | Connexion expirée | Sign-in expired |
| `mcp.auth.reconnect` | Se reconnecter | Sign in again |
| `mcp.auth.refused` | Accès refusé sur la page de {{name}} | Access denied on the {{name}} page |
| `mcp.auth.failedTip` | La connexion n'a pas abouti : {{detail}} | Sign-in did not complete: {{detail}} |
| `mcp.auth.reason.timeout` | Pas de réponse en {{minutes}} min | No answer within {{minutes}} min |
| `mcp.auth.reason.unexpectedPage` | Page inattendue ({{host}}) | Unexpected page ({{host}}) |
| `mcp.auth.reason.stopped` | {{agent}} s'est arrêté | {{agent}} stopped |
| `mcp.auth.retry` | Réessayer | Try again |
| `mcp.auth.noPage` | Pas de page de connexion | No sign-in page |
| `mcp.auth.noPageTip` | {{agent}} n'a pas proposé de page de connexion. | {{agent}} did not offer a sign-in page. |
| `mcp.auth.inTerminal` | Dans un terminal | In a terminal |
| `mcp.auth.inTerminalTip` | Copie « {{command}} » ; dans un terminal, {{agent}} ouvre lui-même la page. | Copies “{{command}}”; in a terminal, {{agent}} opens the page itself. |
| `mcp.auth.copied` | Copiée : <code>{{command}}</code> | Copied: <code>{{command}}</code> |
| `mcp.auth.copiedTip` | À coller dans un terminal : {{agent}} y ouvre lui-même la page de {{name}}. | Paste it in a terminal: {{agent}} opens the {{name}} page there. |
| `mcp.auth.retryHere` | Réessayer ici | Try again here |
| `mcp.auth.unknown` | État de la connexion inconnu | Sign-in status unknown |
| `mcp.auth.busy` | Une connexion est déjà en cours. | A sign-in is already in progress. |
| `mcp.auth.agentMissing` | {{agent}} n'est pas installé. | {{agent}} is not installed. |
| `mcp.auth.removeAskConnected` | Retirer le serveur « {{name}} » ? {{agent}} garde l'accès tant que vous ne vous déconnectez pas. | Remove the “{{name}}” server? {{agent}} keeps the access until you sign out. |
| `mcp.state.toConnect`, `connecting`, `connected`, `expired` (pastille) | à connecter, connexion en cours, connecté, connexion expirée | not signed in, signing in, signed in, sign-in expired |
| `capabilities.mcpOAuth.label` / `.detail` | Connexion des serveurs MCP distants / Par `{{command}}` ; le jeton reste chez {{agent}} | Remote MCP server sign-in / Through `{{command}}`; the token stays with {{agent}} |
| `toolCall.calledTools.search` (lot 3) | Cherche parmi les outils de {{server}} | Searches {{server}}'s tools |

**Astuce** (`tips`, une fois, dans l'onglet OpenCode tant que Figma est absent) : « Vous travaillez
avec des maquettes Figma ? « Connecter Figma » donne à OpenCode les outils de Figma. » / « Working
from Figma designs? “Connect Figma” gives OpenCode Figma's tools. » (clé `tips.mcpFigma`) : **non
retenue** par défaut, voir la fin de Q5.

## Forme retenue et variante écartée

**Décision de Jérôme (2026-11-27)** : la **ligne**, avec le logo officiel de Figma. Une fois le
serveur ajouté, c'est une ligne de serveur ordinaire (interrupteur, crayon, copie, corbeille) avec
le logo (boîte de 28 px) devant le nom ; avant, la ligne « Figma » en carte pleine (boîte de 56 px, nom, phrase,
« Connecter Figma »). Toutes les planches de Réglages de la maquette ont cette forme.

**Écartée : la tuile** (bloc « Connecteurs » en tête de l'onglet, façon Claude). Avis UX : le gain
réel, c'est le logo, que la ligne a aussi ; la tuile, seule dans son bloc, fait galerie vide et
promet un catalogue qui n'existe pas, introduit un motif que rien d'autre n'a dans des Réglages tout
en lignes, allonge les états longs (4 à 5 lignes dans 300 px) et cache les actions du serveur
derrière un menu ⋯ propre à lui. Elle deviendra juste avec trois préréglages ou plus. (Planches
retirées de la maquette ; elles sont dans le commit `be6fb081`.)

**Logo de Figma : ce que disent ses règles** (page lue le 2026-11-27 :
https://www.figma.com/using-the-figma-brand/, « Figma Trademark Guidelines ») :
- on peut utiliser les marques de Figma pour **désigner Figma** et dire qu'un produit « fonctionne
  avec » Figma ; on peut utiliser le mot et les logos pour renvoyer vers Figma ;
- **ne pas modifier** les marques ni en intégrer des morceaux dans les siennes ;
- **ne pas laisser croire** à une affiliation, un parrainage ou une caution de Figma ;
- la marque de l'app doit rester **plus visible** que celles de Figma (évident dans Bobine) ;
- logos à prendre au lien « Download our logos » de la page (archive `static.figma.com`, zip
  d'≈ 78 Ko) ; zone de protection, couleurs et fonds clair et sombre sont dans le « Brand Book »
  (non lu : fichier Figma ou PDF à télécharger) ; un accord écrit séparé peut s'appliquer.

Donc l'usage pour désigner l'intégration paraît permis, logo non modifié.

**Archive officielle** (téléchargée par le tech lead avec l'accord de Jérôme, 2026-11-27) :
`https://static.figma.com/uploads/4fbf4d754dbbc027ba1530205f8747cd97d532e5` (lien « Download our
logos » de la page de marque), zip de 78 237 octets, sha256
`79615c11b3a407d978753ce79359a7f1f765cd3332066a61f49ea637031298a0`. Contenu (`Figma Brand
Assets/`) : `Figma Icon (Full-color)` (`.svg`, `.png`), `Figma Icon (Mono-line)` (`black`,
`white`, `.svg` et `.png`), `Figma Wordmark` (`Black`, `White`), `Figma Lockup`, plus `.DS_Store`
et `__MACOSX/` (non extraits). **Aucun fichier de consignes d'usage** : les règles sont celles de
la page ci-dessus. Seuls les SVG et PNG ont été extraits ; les six SVG, lus comme du texte, n'ont ni
script, ni gestionnaire d'événement, ni lien (`href`), ni `<foreignObject>`, ni image ou style.

**Fichier retenu : `Figma Icon (Full-color).svg`** (646 octets, sha256
`9798b710e015c7f3fa6101779e323568d6a5a022651d427021262ce850467b07`), le même dans les deux thèmes,
copié tel quel dans `docs/maquettes/293/`. Essai de rendu de 16 à 40 px, clair et sombre : la
pleine couleur se lit sur les deux fonds ; la mono-ligne blanche disparaît sur fond clair et ses
traits fins se brouillent sous 28 px ; la noire disparaît sur fond sombre. **Taille** : la boîte du
fichier (1024 × 1280) contient la marge de protection de Figma, le dessin n'en occupe que 47 % de
haut ; en boîte de 16 px, le dessin fait 7,5 px, illisible. Retenu, sans recadrer : boîte de
**56 px** dans la ligne « Figma » à ajouter (dessin ≈ 26 px, le repère visuel de la ligne, centré sur
le bloc de texte) et de **28 px** devant le nom du serveur ajouté (dessin ≈ 13 px, un repère). La
marge de protection, transparente, est rattrapée par la mise en page (marges négatives : 10 px à
gauche, 6 px à droite et 10 px en haut et en bas pour la boîte de 56 px, la carte gardant la hauteur
d'une ligne de serveur à trois lignes ; 4 px de chaque côté pour celle de 28 px, remontée de 1 px
pour s'aligner sur les capitales et la ligne de base du nom). Rien d'autre : ni recoloration, ni
fond, ni recadrage.

**Dans l'app** (à l'implémentation, proposé) : fichier d'origine tel quel dans
`src/renderer/src/assets/brands/figma/Figma Icon (Full-color).svg`, nommé par le préréglage
(`shared/mcp-presets.ts`), avec son empreinte vérifiée par un essai ; jamais recoloré ni recadré,
seulement mis à l'échelle.
Mention de marque à prévoir : « Figma et le logo Figma sont des marques de Figma, Inc. », dans
Réglages › À propos ou l'avis des composants (fiche 217 : celui-ci liste des licences de logiciels,
le logo n'en est pas un ; l'archive n'impose aucune formule ; à trancher à l'implémentation).
**Textes** : « Serveur officiel de Figma » décrit le serveur, jamais Bobine ; jamais « partenaire »,
« certifié », « recommandé par Figma », « intégration officielle » ni rien qui laisse croire que
Figma cautionne Bobine.

## Écarts au plan (lot 1)

- **Canaux en plus** : `mcp:addPreset` (ajout du préréglage, séparé de `mcp:connect` : le renderer
  enchaîne les deux, et l'ajout se fait aussi sans connexion) et `mcp:reopenPage` (« Rouvrir la
  page » : l'adresse ne quitte jamais le main). `connect` rend un `McpConnectResult` (refus
  `busy`, `not-offered`, `agent-missing`, `disabled`) et `disconnect` un `McpDisconnectResult`
  (`done` seulement si l'état relu ne montre plus la connexion ; sinon `timeout`, `failed`,
  `still-connected`, `unconfirmed`, `agent-missing`, `busy`, `not-offered`) au lieu de lever une
  erreur.
- **Raisons d'erreur** : `failed` ajoutée (« La connexion n'a pas abouti » : fin d'échec dite par
  l'agent sans cause reconnue, dont le refus tant que R2 manque) à `timeout`, `unexpected-page`,
  `stopped`. L'expiration dite par OpenCode donne `timeout`.
- **Adresse adverse** : l'hôte en majuscules et le port 443 écrit sont acceptés (même hôte, même
  origine pour `URL`) ; c'est l'adresse **normalisée par `URL`**, celle qui a été vérifiée, qui est
  ouverte. Toute adresse contenant un caractère hors ASCII imprimable est refusée (IDN compris).
  Deux adresses : **la première décide** (ouverte, ou tentative arrêtée si elle est refusée) ; une
  suivante est ignorée et journalisée sans elle.
- **Nom ambigu** (R7 non relevé) : un nom déclaré deux fois (tous les dossiers et ce dossier) n'est
  connectable que si les deux déclarations ont l'adresse du même préréglage ; sinon rien n'est
  proposé ni lancé.
- **Entrée standard** de la commande : un tube jamais écrit (comme l'agent) ; sous Windows, l'arrêt
  de l'arbre commence par le fermer (ADR-0050).
- **Une seule connexion à la fois, précisé** (relecture du lot 1) : la place est rendue quand le
  processus de la tentative est fini, pas après la relecture de l'état. Raison : l'essai R1 du
  testeur exige qu'un second clic pendant cette relecture soit accepté ; la relecture devenue
  périmée n'émet alors rien et ne range rien (numéro d'opération). La déconnexion, elle, garde la
  place jusqu'à son état final.
- **Préréglage déjà déclaré** : rien n'est dupliqué. Déclaré **pour ce dossier seulement**, il est
  gardé tel quel (pas de second serveur « tous les dossiers ») : c'est une limite de « tous les
  dossiers », la connexion ne vaudra que là où il est déclaré (relevé R4). Déclaré mais
  **désactivé** : aucune connexion lancée, refus `disabled` (le lot 2 l'affichera).
- **Lot 2** (à faire) : exposer la commande à copier (« Dans un terminal », `terminalArgs`) ; une
  variable d'essai qui impose la fausse commande à la place d'`opencode` pour les e2e ; afficher les
  refus `disabled` et les résultats de déconnexion.

## Écarts au plan (lot 2)

- **Pas d'état « Refusé »** : le refus sur la page de Figma n'est pas relevé (R2) ; le main ne rend
  jamais `refused`. S'il le rendait, la ligne dit l'échec générique (« La connexion n'a pas
  abouti »), sans texte inventé. La planche « refusé » de la maquette reste à brancher avec le
  relevé (`TODO(R2)` dans `McpAuth.tsx` et `opencode-mcp-auth.ts`).
- **R3 non relevé** : rien n'affirme si les outils arrivent dans une conversation déjà ouverte.
  L'info-bulle de « Connecté par OpenCode » dit seulement « Le jeton reste chez OpenCode : Bobine
  ne le voit jamais. » (la fin prévue, « Vaut pour les nouvelles conversations ; relancez… », est
  retirée de `mcp.auth.connectedTip`) ; le guide n'en dit rien non plus.
- **Textes** : en plus de la table, `mcp.auth.expiredTip`, `unknownTip`, `reasonTip.*` (détail de
  l'info-bulle d'une erreur), `disabled`, `notOffered`, `copyFailed`, `signOut.*` (résultats de
  « Se déconnecter » : délai, échec, toujours connecté, non confirmé), `mcp.preset.listLinkTip`,
  `mcp.state.toConnect|connecting|connected|expired|authUnknown|authError` (pastilles). « Retirer le
  serveur » de la fiche devient « Supprimer le serveur « figma » ? OpenCode garde l'accès… » : même
  verbe que le bouton et la confirmation existante (fiche 126).
- **Page inattendue** : l'hôte refusé vient de la sortie de l'agent, de longueur quelconque. Au-delà
  de 14 caractères il est raccourci **par le début** (« …com.evil.test » : la fin, le domaine, est
  ce qui se vérifie), en entier au survol (`title`) et pour un lecteur d'écran ; sans cela, deux
  lignes au plus à 736 px n'étaient pas tenables.
- **Serveur désactivé** : « Serveur désactivé : activez-le pour vous connecter. », sans action (le
  main refuse aussi, `disabled`) ; connecté, « Se déconnecter » reste proposé.
- **Résultats de « Se déconnecter » et refus de « Se connecter »** (`busy`, `disabled`,
  `not-offered`) : dits à la place du texte de l'état, en rouge, avec les mêmes actions, tant que
  l'état du serveur ne change pas (une note par serveur, jamais un état inventé).
- **Commande copiée** : la pastille garde l'état de la connexion (rouge après une erreur), là où la
  maquette la montrait grise : la copie ne change pas l'état.
- **Confirmation de déconnexion** : le gabarit existant de l'app (`ConfirmRow`, fiche 126 : phrase,
  bouton rouge puis « Garder » à côté) ; la maquette avait « Garder » à droite et le bouton dessous.
- **IPC** : canal `mcp:openPresetList` (« Liste de Figma » ouverte par le main, adresse en donnée du
  préréglage, `listUrl`) ; `McpAuthView.terminal` (commande à copier, `cd` du dossier si le serveur
  n'est déclaré que là) ; `McpServerEntry.authPreset` posé par le main (serveur connecté par
  l'agent : logo, ligne d'état, ni « Tester » ni « Tout tester », ni test automatique à l'ouverture,
  y compris dans « Réglages de la session » et Diagnostic). Préréglage : `logo`, `listUrl`,
  `McpPresetId`. `declaredPreset` déplacé du moteur vers `shared/mcp-presets.ts` (même règle).
- **« Réglages de la session »** (menu ⚙, relecture du tech lead) : ces serveurs n'y sont jamais
  testés ; la ligne dit l'état de connexion (`mcp.state.*` : « connecté », « à connecter »,
  « connexion expirée »…, pastille de l'onglet), lu dans le **magasin partagé** de `mcp-auth.ts`
  (le même que l'onglet des Réglages : dernier état connu, relu chez l'agent à l'ouverture du menu,
  tenu par `mcp:authState`) ; inconnu : « connexion par OpenCode », jamais « pas encore testé ».
  Lecture seule. Fiche 234 : la relecture attend l'affichage (300 ms au plus) ; arrivée après, elle
  est gardée pour l'ouverture suivante, le menu affiché ne change pas. Ligne sortie de `Menus.tsx`
  (`common/SessionMcpServer.tsx`). Onglet « Session » : ces serveurs ne comptent plus dans la ligne
  des outils mesurés (jamais mesurés). E2e : l'agent factice connecte comme OpenCode sous
  `MOCK_AGENT_MCP_OAUTH=opencode` (seulement avec `BOBINE_CONFIG_HOME` et `BOBINE_FAKE_MCP_AUTH`,
  `docs/mock-agent.md`).
- **Commande copiée** (relecture du tech lead) : jamais `&&` ; un serveur « ce dossier » donne
  **deux lignes** (`cd`, puis la commande), chaque mot cité pour le shell du système
  (`terminalCommand`, `mcp-oauth-command.ts`) : macOS et Linux `cd '<dossier>'` (apostrophe
  `'\''`, vérifié par un vrai `sh`) ; Windows, PowerShell (terminal par défaut) : `Set-Location
  -LiteralPath '<dossier>'` (apostrophe doublée, ni `$` ni `[` interprétés). `cmd.exe` n'est pas
  visé (non vérifié sous Windows, R9). La ligne montre la commande, l'info-bulle le tout ;
  « Connecter Figma » ajoute pour tous les dossiers : pas de `cd`.
- **Essais de bout en bout** : `BOBINE_FAKE_MCP_AUTH` (script Node lancé par l'exécutable de l'app,
  `ELECTRON_RUN_AS_NODE=1` ; vide : agent absent) et `BOBINE_FAKE_MCP_AUTH_MS` (délai raccourci),
  **gardées** : sans effet dans l'app installée (`mcp-oauth-forced.ts`, `app.isPackaged`, essai
  unitaire), contrairement à `BOBINE_GH`. La page est notée par `BOBINE_OPEN_LOG` (existant) au lieu
  d'être ouverte. Fausse commande : `e2e/fake-opencode-mcp.mjs` (sorties d'OpenCode 2.3.0 imitées,
  état dans un fichier JSON, appels notés à part). L'essai e2e a un agent de plus (l'agent factice) :
  sa copie (36 px) rétrécit la colonne ; la mesure « une ligne à 940, deux au plus à 736 » la masque
  le temps de mesurer (les captures la montrent).
- **Mention de marque** : dans `THIRD-PARTY-NOTICES.md` (« Interface fonts, icons and artwork »,
  écrit par `scripts/third-party/render.mts`, livré dans `Contents/Resources/licenses/`) : « Figma and
  the Figma logo are trademarks of Figma, Inc. (« Figma et le logo Figma sont des marques de Figma,
  Inc. ») ». Aucun écran de l'app ne liste ces avis aujourd'hui (fiche 217 : « À propos › Licences :
  plus tard ») : rien d'ajouté à l'interface.
- **Fins de ligne** : `.gitattributes` (nouveau) marque `src/renderer/src/assets/brands/**` `-text`,
  pour que `core.autocrlf` (Windows) ne change pas l'empreinte du logo. Le logo est livré comme un
  fichier à part (`?no-inline`), pas réécrit en adresse `data:` par Vite (empreinte vérifiée dans le
  build par l'e2e).

## Décisions de Jérôme (2026-11-27)

Réponses à ses questions, avec ses mots :
- **Q1** « Se connecter » : « Figma seul (Recommandé) ». Le mécanisme reste générique dessous.
- **Q2** portée de « Connecter Figma » : « Tous les dossiers (Recommandé) ».
- **Q3** onglet IBM Bob : « Oui, une ligne (Recommandé) » — la ligne d'aide maquettée.
- **Q4** nom de l'outil dans le fil : « Oui, dans cette fiche (Recommandé) » — le lot 3 en fait
  partie.
- **Q5** forme : « 1. Ligne 2. Oui télécharge » — la ligne avec le logo officiel ; archive des
  logos téléchargée.
- L'astuce « Vous travaillez avec des maquettes Figma ? » n'est pas retenue (décision par défaut).

## Questions pour Jérôme

- Valider l'ADR-0077 (proposé).
- R2 (refus sur la page de Figma) et R3 (conversation déjà ouverte) : un clic de sa part, avec
  le profil isolé, avant le lot 2 de préférence.

## Critères d'acceptation

- [x] Onglet OpenCode : « Connecter Figma » ajoute `figma` (portée de Q2) dans le fichier
      d'OpenCode, au format déjà présent (`mcp.servers` ou `mcp`), puis lance la connexion ;
      ligne cachée si l'adresse est déjà déclarée, sous n'importe quel nom.
- [x] La page n'est ouverte que si l'adresse lue est `https://www.figma.com/…`, sans identifiants ;
      toute autre adresse : rien d'ouvert, état Erreur avec l'hôte, processus tué.
- [x] Chaque état du tableau s'affiche avec ses boutons, clair et sombre, français et anglais, à la
      largeur réelle et étroite des Réglages ; rien de tronqué sans `title`. (Sauf « Refusé » : R2 ;
      anglais vérifié par les essais unitaires et les textes, captures en français seulement.)
- [x] Une seule connexion à la fois (refus côté main, bouton grisé avec raison).
- [x] « Annuler » ou quitter l'app tue l'arbre de processus (vérifié : plus de processus après
      2 s) ; fermer puis rouvrir les Réglages pendant la connexion retrouve l'état « en cours ».
- [x] Délai : processus tué à 10 min (raccourci en essai), état Erreur « pas de réponse ».
- [x] État final relu par `auth list` ; code de sortie jamais utilisé pour juger la fin.
- [x] Aucune adresse complète dans `agents.log`, l'IPC ou le DOM (essai : recherche de
      `code_challenge` et `state=` dans le journal et le DOM après un parcours).
- [x] « Tester » n'est pas lancé pour un serveur à connexion par l'agent ; pastille selon l'état.
- [x] Onglet Bob : ligne d'aide (Q3), aucun bouton.
- [x] **Un état = une ligne** sous l'adresse à 940 px (deux au plus à 736 px, jamais un « · » seul
      en début de ligne) ; actions en liens atteignables au clavier (focus visible), contraste
      suffisant en clair et en sombre ; icône + texte, jamais la couleur seule ; rien de tronqué sans
      `title`. Seul bouton plein : « Connecter Figma ».
- [x] Logo de Figma **non modifié** : le fichier livré a la même empreinte sha256 que celui de
      l'archive officielle (`9798b710…`) ; lisible dans ses deux tailles (boîtes de 56 et 28 px, dessins ≈ 26 et 13 px),
      en clair et en sombre (captures regardées).
- [x] `specificItems` et `docs/agents.md` : repère `mcp-oauth` (test existant des repères).
- [ ] (Lot 3) Une carte `execute` finie avec `toolCalls: [{ tool: "figma.whoami" }]` s'intitule
      « figma · whoami » ; une carte sans ce champ garde « execute ».
- [x] **Unitaires** (lot 1) : lecture de la sortie (ANSI, tourniquet, adresse seule sur sa ligne, « Connected
      to », « Authorization expired », erreur, sortie inconnue), vérification d'adresse (http, autre
      hôte, `user@`, trop longue, adresse coupée), lecture de `auth list` (connecté, expiré, absent,
      JSON invalide), machine d'états (une seule connexion, annulation, délai).
- [x] **E2e** contre une **fausse commande** (`e2e/fake-opencode-mcp.mjs`, imposée par une variable
      d'essai comme `BOBINE_GH`) : parcours connexion réussie, refus, délai (raccourci), page
      inattendue, déconnexion, retrait ; captures clair et sombre regardées. Jamais le vrai
      OpenCode ni Figma en test automatisé. (Sans « refus » : R2 non relevé.)
- [ ] **Recette réelle manuelle** (Mac, OpenCode 2.3.0, profil isolé `XDG_*`, compte Figma de
      Jérôme) : connecter, appeler `whoami` dans une nouvelle conversation, se déconnecter,
      reconnecter ; R1 à R7 relevés et reportés ici et dans `docs/acp.md`.

## Plan

0. **Relevés R1 à R8** (essai réel, profil isolé ; R4, R5, R6 faits le 2026-11-27) ; puis ADR « connexion OAuth d'un serveur MCP
   par l'agent : Bobine ouvre une page lue dans sa sortie, après vérification d'hôte ».
1. **Lot 1 — moteur (main)**, ≈ 1,5 j — **fait le 2026-11-27** (voir Journal et « Écarts ») :
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
   est à 679 lignes, plafond 800), `McpSettings.tsx` (ligne du préréglage avec logo, état sous la
   ligne du serveur), logo dans `assets/brands/figma/`, mention de marque, styles, `fr.json` /
   `en.json` ; fausse commande e2e, suite `mcp` étendue (ou
   `mcp-figma`).
3. **Lot 3 — fil** (Q4 tranchée : dans cette fiche), ≈ ½ j : `opencode-contract.ts` (outils appelés), marque
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
- 2026-11-27 — Retour de Jérôme (« plus visuel, comme les connecteurs de Claude Code, l'icône
  Figma en tuile ») : avis UX, variantes V1 (tuile) et V2 (ligne enrichie), repli sans logo,
  règles de marque de Figma lues (logo non téléchargé : accord demandé, Q5). L'ancienne Q5
  (astuce) devient une décision par défaut. Captures refaites à l'échelle 1 (colonne de droite,
  hauteur utile) et doublons retirés : 58 fichiers, 2,4 Mo au lieu de 6,4 Mo.
- 2026-11-27 — **Décision de Jérôme** : « 1. Ligne 2. Oui télécharge » — forme ligne avec le logo
  officiel retenue, téléchargement de l'archive officielle des logos autorisé (archive seulement,
  pas le Brand Book). Maquette ramenée à une seule forme (tuile et repli retirés, pointillés de la
  ligne « Figma » remplacés par une carte pleine, emplacement du logo dans toutes les planches de
  Réglages). Logo pas encore téléchargé : accord reçu relayé, à confirmer de la main de Jérôme.
- 2026-11-27 — **Décisions de Jérôme** sur Q1 à Q4 (voir « Décisions de Jérôme »). Archive des
  logos téléchargée par le tech lead ; extraites les seules images, SVG vérifiés ; logo retenu :
  `Figma Icon (Full-color).svg`, copié tel quel dans `docs/maquettes/293/` et branché dans toutes
  les planches de Réglages (boîtes de 40 et 28 px). Captures refaites et regardées : 40 PNG + le
  SVG, 1,6 Mo.
- 2026-11-27 — Relecture du tech lead : logo trop discret dans la ligne « Figma ». Boîte portée de
  40 à 56 px (dessin ≈ 26 px), marges négatives de mise en page, carte à la hauteur d'une ligne de
  serveur à trois lignes ; logo de 28 px devant le nom remonté de 1 px et rapproché (4 px).
  Captures refaites et regardées (1,6 Mo).
- 2026-11-27 — Retour de Jérôme (« J'aime pas trop le gros bloc avec les lignes pointillées quand
  la connexion est en cours ou expirée ») : (A) les pointillés d'annotation sont retirés des
  captures, visibles seulement par la case « Montrer ce qui change » du HTML, et chaque légende dit
  en mots ce qui est nouveau ; (B) chaque état devient une ligne au poids de « ✓ Joignable · … »,
  actions en liens, détail en info-bulle (jeton, consigne, délai, nouvelles conversations) ; ligne
  d'aide sous la liste retirée ; « Faire dans un terminal » devient « Dans un terminal » (copie) et
  un état « Copiée : … » ; textes raccourcis. Mesuré : une ligne à 940 px pour tous les états, deux
  au plus à 736 px. Captures refaites et regardées (1,5 Mo).
- 2026-11-27 — **Validation de Jérôme** : « Ok pour moi » (maquette allégée). Dernière retouche :
  « Connexion en cours (www.figma.com) · Rouvrir la page · Annuler » au lieu de « En cours » (une
  ligne à 940 px, mesurée en français et en anglais : « Signing in (www.figma.com) · Reopen the
  page · Cancel ») ; le « · » reste en fin de ligne quand la ligne passe à la ligne (736 px).
- 2026-11-27 — **Étape 0** (relevés du tech lead reportés) : R4, R5, R6, « avant connexion » et
  expiration dans « Contrat réel » ; sorties brutes copiées en fixtures
  (`src/main/agent-config/fixtures/opencode-2.3.0-mcp-auth/`) ; R1, R2, R3, R7 à R9 notés « pas
  faits ». ADR-0077 écrit, statut **proposé**.
- 2026-11-27 — **Lot 1 (moteur, main)** codé, sans interface :
  - `shared/mcp.ts` : `McpAuthStatus`, `McpAuthReason`, `McpAuthState`, `McpAuthView`,
    `McpConnectResult`, `oauth` sur `McpAgentView` ; `shared/mcp-presets.ts` : Figma en donnée
    (`url`, `pageHost: www.figma.com`), `presetForUrl` (adresse comparée normalisée) ;
  - `agent/adapters.ts` : `McpOAuthSource`, `McpAuthLine` (dont `refused`, point d'extension
    `TODO(R2)` non branché), `McpAuthStored` ; `agent-config/opencode-mcp-auth.ts` : arguments
    (`--standalone` toujours, sauf la commande à copier), lecture des lignes (glyphes d'OpenCode
    retirés, adresse seule sur sa ligne, « Connected to », « Authorization expired », « Failed »,
    « Cancelled »), lecture de `auth list` (`mcp_…` seulement, méthode `oauth`, `needs_auth`
    facultatif, sortie illisible = inconnu) ; `agent/profiles.ts` : `mcpOAuth` sur OpenCode ;
    `agent/capabilities.ts` : repère `mcp-oauth` (+ `docs/agents.md`) ;
  - `agent-config/mcp-oauth-output.ts` : lignes de terminal (UTF-8 coupé, `\r` seul et retour du
    curseur = effacement, codes retirés, contrôles neutralisés en U+FFFD, ligne > 8 192 caractères
    jetée entière, tourniquet compacté au fil de l'eau), `checkPageUrl`, `scrubUrls` ;
  - `agent-config/mcp-oauth.ts` : moteur `McpOAuth` (une connexion ou déconnexion à la fois,
    réservée avant toute attente ; délai 10 min, 30 s sans adresse ; chaque fin traitée une fois,
    arbre toujours arrêté par `killTree`, même après une fin naturelle ; fin jugée par
    `attemptOutcome` à la sortie et à l'état relu ; état d'erreur gardé jusqu'à une connexion relue ;
    commandes courtes bornées à 30 s et 1 Mio) ;
  - `McpSettings` : `addPreset` (tous les dossiers, format du fichier gardé, pas de doublon
    d'adresse, `figma-2`… si le nom est pris, fichier illisible = refus), « Tester » refusé pour ces
    serveurs, méthodes de connexion ; `mcp-oauth-setup.ts` (environnement de l'agent,
    `shell.openExternal`, `broadcast`) ; `index.ts` : arrêt à la fermeture (`shutdown`) ;
  - IPC : `mcp:addPreset`, `mcp:authStates`, `mcp:connect`, `mcp:cancelConnect`, `mcp:reopenPage`,
    `mcp:disconnect`, événement `mcp:authState` ; preload ; `read-only-guard.ts` (lire, rouvrir,
    annuler : sûrs ; ajouter, connecter, déconnecter : refusés en lecture seule) ;
  - essais unitaires : fixtures réelles rejouées (d'un bloc, octet par octet, en morceaux, en CRLF),
    adresses adverses, moteur sur faux processus et horloge simulée (fins en course, une connexion
    à la fois, fermeture, agent absent, IBM Bob, recherche de `state=`, `code_challenge`,
    `client_id` dans tout ce qui sort), et un essai sur une **fausse commande** réelle
    (`fixtures/fake-agent-mcp-auth.mjs`, Node) : enfant arrêté avec le parent à « Annuler ».
  - Pas d'e2e : aucune interface ne change dans ce lot.
- 2026-11-27 — **Relecture du lot 1** (testeur adverse : six essais rouges et 46 mutations ; tech
  lead : deux points de plus et ses décisions). ADR renuméroté **0077** (0075 et 0076 sont pris sur
  la branche `1.2-291-fichiers-locaux`). Corrigé à la cause :
  - A : numéro d'opération par serveur ; une fin périmée (autre opération partie, app fermée)
    n'émet rien et ne range rien ; relecture bornée ; déconnexion occupée jusqu'à son état final ;
  - B : le processus est marqué sorti avant de vider les lecteurs ; jamais d'adresse lue après la
    fin ni d'une dernière ligne sans retour à la ligne ;
  - C : plus aucune ligne de sortie au journal, seulement le genre reconnu et un compteur ;
    `scrubUrls` élargi (sans schéma, `https:/`, antislashs, `clé=valeur`) pour les seuls messages
    d'erreur du système ;
  - D : chemin exact de la page (`pagePath` du préréglage, écrit tel quel), hôte écrit tel quel,
    `redirect_uri` unique et vers cette machine s'il existe ;
  - E : déconnexion au résultat typé honnête (`McpDisconnectResult`), « déconnecté » au journal
    seulement si l'état relu le confirme ;
  - F : essais ajoutés pour les mutations survivantes (`mcp-oauth-races.test.ts`,
    `shared/mcp-presets.test.ts`, cas ajoutés aux autres) ;
  - G : messages montrés à l'utilisateur dans `mcp-settings.ts` traduits (`mcpOAuth.error.*`) ;
  - H : essai en vrai processus sans aucun signal à un numéro de processus (battement de l'enfant) ;
    lecture des lignes indépendante du symbole de tête (variantes ASCII : hypothèse) ;
  - I : serveur désactivé : refus `disabled` ; déclaré pour ce dossier seulement : gardé tel quel.
  - Les six essais du testeur sont gardés comme essais permanents (`mcp-oauth.revue.test.ts`).
  - Mutations (script du testeur, élargi aux nouvelles règles) : avant 32 tuées sur 46 ; après
    58 sur 69. Les 11 survivantes sont des doublons voulus (défense en profondeur) qu'aucune entrée
    ne peut distinguer : port, identifiants et suffixe d'hôte (déjà refusés par la vérification de
    l'hôte écrit), chemin normalisé (impliqué par le chemin écrit), « première adresse »
    (`urlSeen`/`url`), place rendue à la fermeture (deux remises à zéro, et `quitting` refuse tout),
    garde de péremption de `remember` (aucun appel périmé possible), ligne incomplète et `close`
    sans `exit` (le processus est toujours marqué sorti avant).
- 2026-11-27 — **Second passage du testeur** (sur `d5dac27b`) : A, B, C, E, G, H, I tiennent ; choix
  de A accepté par le tech lead. Corrigé :
  1. déconnexion : le numéro n'est réservé qu'après lecture de l'environnement, et la déconnexion
     émet elle-même un état dans un `finally` dès qu'elle a réservé ; `connect` réserve avant
     l'attente (double clic) mais toute issue y émet un état (fin de tentative, agent absent) ;
  2. préfixe ignoré limité à 1–3 symboles (ni lettre ni chiffre) ou à un seul caractère : `see`,
     `or`, `Go:` devant une adresse ne font plus « la page » ;
  3. R4 réécrit sur le contrat actuel ; R1 à R3 dotés du `redirect_uri` local exigé (sinon creux) ;
     les six essais recopiés rougissent chacun sous une mutation ;
  4. D durci : `redirect_uri` local exigé par le préréglage, `request`/`request_uri`, noms
     déguisés et `;` refusés, retour sans `\` ni `@`, hôte écrit `127.0.0.1` ou `localhost`, port
     en chiffres ;
  5. journal : une fin périmée écrit « fin périmée (…), ignorée », jamais « fin (…) ».
  Essais du second passage gardés (`mcp-oauth.revue2.test.ts`, balayage D avec réponses attendues).
- 2026-11-27 — **Trois restes du lot 1** (avant le lot 2) : (1) vérification de la page : tout nom
  de paramètre qui, décodé (par `URLSearchParams` puis une fois de plus), sans espaces, `[]` ni
  `\0`, vaut `redirect_uri`, `request` ou `request_uri` est refusé, sauf l'unique `redirect_uri`
  exact (`redirect_uri%20=`, `redirect_uri+=`, `redirect_uri[]=`, `redirect_uri%00=`… à côté d'un
  vrai retour local : essais) ; la fixture réelle passe toujours ; (2) déconnexion : chaque fin émet
  **un seul** état (essai qui rougit si l'on retire `!emitted` du `finally`) ; (3) commentaire
  corrigé : `redirect%5Furi` seul est accepté (même nom une fois décodé, valeur vérifiée), essai
  qui le fixe.
- 2026-11-27 — **Lot 2 (interface)** codé :
  - `components/settings/McpAuth.tsx` (nouveau) : ligne d'état sous l'adresse (un état = une ligne,
    actions en liens, détail en info-bulle et description accessible, `role="status"` poli), pastille
    d'après l'état, ligne « Figma » à ajouter (logo de 56 px, « Connecter Figma », agent absent :
    grisé et raison dessous), ligne d'aide d'un agent sans la capacité (d'après les profils, lien
    « Liste de Figma » ouvert par le main), confirmation de déconnexion dans la ligne ;
    `mcp-auth.ts` (état relu à l'ouverture, après chaque action, au changement de dossier ou de
    serveurs ; événement `mcp:authState` ; une relecture plus ancienne qu'un événement ne l'écrase
    pas ; notes des refus et résultats) ; `brand-logos.ts` ; `mcp-auth.css` ;
  - `McpSettings.tsx` : logo devant le nom, ligne d'état à la place de « Tester », carte et ligne
    d'aide sous la liste ; `mcp-status.ts` : ces serveurs jamais testés ;
  - main : `authPreset` dans la vue, `terminal` dans `McpAuthView`, `mcp:openPresetList`,
    `mcp-oauth-forced.ts` (fausse commande gardée), page par `fileOpeners` (`BOBINE_OPEN_LOG`) ;
  - logo copié octet pour octet (`assets/brands/figma/`), empreinte vérifiée (unitaire et e2e sur le
    fichier livré) ; mention de marque dans `THIRD-PARTY-NOTICES.md` ;
  - essais : `McpAuth.test.tsx` (39), `mcp-oauth-forced.test.ts`, `mcp-preset-logos.test.ts`, cas
    ajoutés à `mcp-settings`, `mcp-ipc`, `mcp-oauth` ; e2e `mcp-figma` (clair et sombre ; captures
    `e2e/captures/c0…c12-figma-*-{940,736}-{light,dark}.png`, avant : `avant-293-opencode-*`) ;
  - contrastes mesurés par l'e2e (WCAG, ≥ 4,5 partout) : clair — phrase 5,33, « Connecter Figma »
    4,81, état neutre 5,33, lien 4,81, « · » 5,33, connecté 6,75, expiré 5,47, erreur 6,54 ; sombre —
    5,24, 6,08, 5,24, 4,58, 5,24, 6,84, 6,22, 5,43 ;
  - documentation : guide (Agents › Connecter Figma à OpenCode, fr et en), `docs/architecture.md`,
    ADR-0077 (surface d'essai), `CHANGELOG.md` et `CHANGELOG.en.md`.
- 2026-11-27 — **Relecture du lot 2 par le tech lead** : décisions sur hôte raccourci, pastille
  rouge sous « Copiée », `ConfirmRow`, mention de marque (gardés) ; corrigé : menu « Réglages de la
  session » (état de connexion depuis le magasin partagé, jamais « pas encore testé », essais
  unitaires et e2e, captures `c13-figma-menu-session-*`, `c14-figma-menu-session-expire-*`) ;
  commande copiée sur deux lignes, citée par système (essais par plateforme simulée et par `sh`).
  Captures anglaises regardées (`en-c*-figma-*`) : textes justes, rien de tronqué ; à 736 px les
  ligne « Copiée : … » de l’essai passe à 3 lignes (fr et en) à cause de la copie vers l’agent
  factice (absente de l'app installée) ; mesurées sans elle : 2 au plus.
- 2026-11-28 — **Relecture adverse du lot 2** (testeur, sur `639483e2`), corrigée à la cause :
  1. **Commande « Dans un terminal » (bloquant)** : `joinCommandLine` + `&&` exécutait du code venu
     du nom du dossier (`proj$(touch${IFS}PWNED)`). `terminalCommand` (`mcp-oauth-command.ts`) :
     une ligne par commande, chaque mot cité ; POSIX `cd -- '…'` (apostrophe `'\''`) ; Windows,
     **PowerShell seulement** : `Set-Location -LiteralPath '…'`, apostrophes droites **et
     typographiques** (U+2018 à U+201B, lues comme `'` par PowerShell) doublées ; `cmd.exe` et son
     changement de lecteur ne sont pas visés. Refus (pas de « Dans un terminal ») : mot vide,
     caractère de contrôle (retour à la ligne), `"` sous Windows. Essais : Q4 du testeur
     (`mcp-oauth-inj.revue.test.ts`, adapté au contrat à deux lignes, assertion intacte), dossiers
     hostiles passés par un vrai `sh` (`$(…)`, `` ` ``, `;`, `&`, `|`, `${IFS}`, apostrophes,
     `'\''`, `-n`, `--`, non ASCII), refus, plateformes simulées. Autres `joinCommandLine` : formulaire
     et résumé d'un serveur dans `McpSettings.tsx` (montré, jamais copié ni passé à un shell) ;
     rien d'autre copié.
  2. **Double clic sur « Se connecter »** : une action par serveur à la fois (le second clic est
     ignoré) ; un `busy` n'est jamais dit quand ce serveur est déjà « en cours ». Essais Q1 et
     « une seule demande au main ».
  3. **Focus** : quand l'action fait disparaître le bouton cliqué, le focus revient à la première
     action de la nouvelle ligne (sinon à la ligne, `tabIndex=-1`, `role=group`, nommée par son
     texte), jamais si l'utilisateur est allé ailleurs ; « Connecter Figma » le rend à la ligne du
     serveur ajouté. Essais Q2, Q3, « allé ailleurs », « après Connecter Figma ».
  4. **Largeurs** : la règle (une ligne à 940, deux au plus à 736) est mesurée pour tous les états
     (en cours, connecté, confirmation, à connecter, expiré, erreurs, copiée, pas de page, deux
     serveurs), en français et en anglais, pour l'app réelle (IBM Bob et OpenCode) ; l'essai a un
     troisième agent (l'agent factice, une copie de 36 px en plus) : relevé et dit, jamais de
     débordement ni de « · » en tête, une ligne de plus admise (« Connexion en cours (www.figma.com) »
     y fait 3 lignes en français). « Copiée : <commande> » ne passe plus à la ligne : la commande
     se raccourcit (`…`), en entier au survol.
  5. **Mutations** : les 8 survivantes du testeur (sur 25) adaptées au code actuel, plus 12 pour
     les correctifs : 19 tuées sur 20 ; la survivante (« Tout tester » sans le filtre) est
     équivalente : `testMcpServers` écarte aussi ces serveurs (`mcp-status.test.ts`). Script :
     `mutate-l2b.py` (dossier de travail du lot).
  6. **Gardes** : essai du branchement (`mcp-oauth-setup.test.ts`, `electron` simulé) : app
     installée, ni fausse commande, ni délai raccourci, ni page notée ; `MOCK_AGENT_MCP_OAUTH` :
     aucun profil factice dans l'app installée (`profiles.test.ts`).
  7. **`BOBINE_OPEN_LOG`** : pour ce parcours, `pageOpener` (`mcp-oauth-forced.ts`) ne lit la
     variable que hors de l'app installée ; l'app installée ouvre toujours le navigateur. Les autres
     usages (`file-openers.ts`, `thread-ipc-electron.ts`) sont inchangés : à garder de même dans une
     fiche à part (proposé au tech lead).
  8. **Fausse commande e2e** : `e2e/json-state.mjs` (écriture atomique réessayée sur `EPERM`,
     `EBUSY`, `EACCES`, lecture à attente bornée, pauses de 20 ms), utilisée par la fausse commande
     et la suite ; essai `scripts/e2e-json-state.test.mjs`.
  9. **« Copiée » après une connexion faite dans le terminal** : l'état est relu quand la fenêtre
     reprend le focus, tant qu'une note « Copiée » est affichée (aucune boucle). Essai.

