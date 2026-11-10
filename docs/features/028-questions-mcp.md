# 028 — Questions interactives pour Bob (outil MCP fourni par l'app)

- **Statut** : fait
- **Dépend de** : 016 (carte de questions), ADR-0003 (MCP hébergé dans le main)

## Pourquoi

Bob pose ses questions en texte : il n'a aucun outil de question par ACP. ACP sait pourtant afficher
des questions (élicitation, fiche 016) et laisse le client **fournir des serveurs MCP** à l'agent
(`mcpServers` de `session/new`). L'app fournit donc un outil `ask_user` : quand l'agent l'appelle,
l'app affiche la carte de questions (choix unique ou multiple, descriptions, « Autre ») et renvoie la
réponse comme résultat de l'outil. Rien à configurer côté Bob : il découvre l'outil et s'en sert seul.

## Relevé réel (Bob 2.0.6, 2026-10-11)

- Bob accepte un serveur MCP `http` du client (`mcpCapabilities.http`), l'interroge (`server/discover`,
  `initialize`, `tools/list`) et appelle `ask_user` **spontanément** quand il doit faire choisir
  l'utilisateur (« Quel shell veux-tu utiliser ? » : bash / zsh, avec descriptions).
- Il demande l'autorisation avant l'appel (« Running Ask User (bob-desktop) »).
- Coût de l'essai : 0,043 bobcoin.

- Bob abandonne un appel d'outil MCP au bout d'environ **60 s** (« Request timed out ») et n'envoie
  pas de `progressToken` : impossible de prolonger l'attente.
- La doc de Bob Shell liste un outil `ask_followup_question` (catégorie « Question »), celui de Bob
  IDE ; il n'est pas proposé par `bob acp` 2.0.6 (absent des outils enregistrés, crochet
  `askFollowUp` vide dans le code ; Bob dit lui-même n'avoir aucun outil de question).

## Critères d'acceptation

- [x] Serveur MCP HTTP (Streamable HTTP, réponses JSON) dans le main, sur 127.0.0.1, un chemin secret
      par session d'agent ; seuls `initialize`, `tools/list`, `tools/call`, `ping` sont servis.
- [x] Transmis à l'agent seulement s'il annonce `mcpCapabilities.http` ; à l'ouverture, au rechargement
      et à la reprise de session.
- [x] `ask_user { question, options[{label, description?}], multiSelect?, allowOther? }` → carte de
      questions de la fiche 016 ; résultat : choix, texte libre, ou « l'utilisateur a passé ».
- [x] La carte remplace l'appel d'outil dans le fil ; l'autorisation de Bob pour **cet outil seulement**
      est accordée automatiquement (il ne fait que poser une question).
- [x] Annulation du tour : question annulée, résultat d'erreur pour l'agent.
- [x] Réponse tardive (au-delà de 45 s) : l'outil répond à l'agent que la question est affichée et qu'il
      doit finir son tour ; la carte reste ouverte après le tour ; la réponse part ensuite comme
      message de l'utilisateur (« Réponse à ta question « … » : … »).
- [x] Testé : unitaires (arguments, schéma, réponse), serveur HTTP, agent factice qui appelle l'outil,
      e2e ; Bob réel.

## Plan

- `src/shared/ask-user.ts` — description de l'outil, validation des arguments, schéma d'élicitation
  (`answer` + `answer_custom`, reconnu par l'adaptateur de la fiche 016), texte de réponse.
- `src/main/mcp/question-server.ts` — serveur HTTP ; un point d'accès par session (`register`).
  Devenu `tool-server.ts` (serveur générique) avec la fiche 029.
- `AgentHost` — `mcpServers` à l'ouverture ; `askUser` réutilise les élicitations (réponse validée dans
  le main) ; lien avec l'appel d'outil de l'agent (`toolCallId`) ; autorisation automatique pour cet
  outil.
- Agent factice — scénario `question-bob` qui appelle `ask_user` sur le serveur reçu.

## Journal

- 2026-10-11 — Fiche créée après l'essai réel ci-dessus (sonde : `probe-bob-mcp.mjs`).
- 2026-10-11 — Implémenté : `shared/ask-user.ts`, `main/mcp/question-server.ts` (Streamable HTTP,
  réponses JSON, jeton par session, `Origin` refusé, pas de délai côté serveur), `AgentHost`
  (`mcpServers`, `askUser`, autorisation automatique limitée à cet outil, réponse tardive), agent
  factice (étape `ask-user` qui rejoue la mise en scène de Bob, scénario `question-bob`). 212 tests ;
  `pnpm e2e` (carte sans autorisation, réponse renvoyée à l'agent).
  - **Bob réel** : sans mentionner l'outil, Bob affiche « Quel shell veux-tu utiliser… » (bash / zsh
    avec descriptions) dans la carte ; choix zsh → « Tu as choisi zsh — voici ton script » (0,043
    bobcoin). Réponse au bout de 55 s : Bob finit son tour (« J'attends ta réponse… »), la réponse
    part en message, Bob répond avec le script zsh (0,066 bobcoin).
  - Détail corrigé en route : « 0 bobcoins » n'est plus affiché avant le premier échange.
