# 060 — Statut des serveurs MCP : « Tester »

- **Statut** : fait
- **Dépend de** : 025
- **Agents** : les deux (l'app se connecte elle-même au serveur, comme un agent le ferait)

## Pourquoi

Réglages › Serveurs MCP montre la configuration, pas l'état : on ne sait pas si un serveur démarre,
ni ce qu'il propose. `opencode mcp list` le dit pour OpenCode, `bob mcp list` non. Et pour savoir si
Bob voit un serveur, il faudrait lui envoyer un message, qui coûte des bobcoins.

## Critères d'acceptation

- [x] Chaque serveur a un bouton « Tester » ; « Tout tester » les teste l'un après l'autre.
- [x] Le test se connecte au serveur (commande locale ou HTTP), fait `initialize`, liste ses outils
      (et ses ressources et prompts s'il en annonce), puis ferme : « joignable · nom version ·
      N outils », les noms des outils au survol ; sinon l'erreur, avec la fin de sa sortie d'erreur.
- [x] Délai borné (première fois via `npx` : téléchargement compris) ; le processus est toujours
      arrêté ; rien n'est envoyé à un modèle, rien n'est enregistré.
- [x] État visible : pastille par serveur (joignable, en erreur, désactivé, pas testé) dans
      Réglages › Serveurs MCP, testés d'eux-mêmes à l'ouverture ; section « Serveurs MCP » dans
      « Réglages de la session » (serveurs de l'agent pour le dossier de la conversation, avec leur
      état). Résultats partagés, gardés 5 minutes.
- [x] Testé : unitaire (serveur stdio d'essai, serveur HTTP de l'app, serveur muet, commande
      introuvable), e2e avec captures ; essai réel avec `server-everything` et `server-memory`.

## Plan

1. `shared/mcp.ts` : `McpTestResult`.
2. `main/agent-config/mcp-probe.ts` (nouveau) : client MCP minimal (stdio : JSON par ligne ;
   HTTP « Streamable » : POST, réponse JSON ou flux SSE, `Mcp-Session-Id`). Les requêtes du
   serveur vers le client (racines, échantillonnage…) reçoivent « méthode inconnue ».
3. `McpSettings.test` ; IPC `mcp:test` ; preload.
4. `McpSettings.tsx` : bouton par serveur, « Tout tester », ligne de résultat.
5. Fixture `e2e/fixtures/mcp-serveur.mjs` ; tests ; e2e `mcp`.

Pas de nouvelle dépendance : le serveur MCP de l'app est déjà écrit à la main (ADR-0003).

## Journal

- 2026-10-14 — Fiche créée.
- 2026-10-14 — Fait. `mcp-probe.ts` (+ tests : serveur stdio d'essai paginé qui interroge le client,
  serveur HTTP de l'app, serveur qui plante, muet, introuvable, adresse fausse), `McpSettings.test`,
  IPC `mcp:test`, bouton « Tester » et « Tout tester », ligne de résultat (noms des outils au
  survol ; pour une erreur, le message et la ligne utile de la sortie d'erreur, sans la pile
  d'appels). Fixture `e2e/fixtures/mcp-serveur.mjs`, e2e `mcp`, captures `b3` (clair, sombre).
  **Essai réel** : `server-everything` et `server-memory` ajoutés par l'écran des réglages (portée
  « ce dossier », `~/bob-essai/mcp-060`) pour Bob puis copiés vers OpenCode : joignables tous les
  deux (13 outils, 7 ressources, 4 prompts ; 9 outils, 1 ressource), premier lancement par `npx`
  en 3 s. Confirmé par `opencode mcp list` (« connected ») et `bob mcp list` (« enabled »).
- 2026-10-14 — État visible, à la demande de l'utilisateur (« comment on voit s'ils sont up ? ») :
  `mcp-status.ts` (résultats partagés, gardés 5 min, serveurs activés testés l'un après l'autre),
  pastilles dans les réglages (test à l'ouverture des seuls résultats périmés), section « Serveurs
  MCP » de « Réglages de la session » (clic : Réglages › Serveurs MCP). L'agent factice lit les
  serveurs MCP comme Bob (`mcpConfig: 'bob'`), pour l'essai de bout en bout. Captures `b4`.
- 2026-10-14 — **Bug bloquant** signalé par l'utilisateur : clic sur un serveur de « Réglages de
  la session », puis Réglages refermés → plus aucun clic possible. Même piège Radix que la
  fiche 049 (menu **modal** qui ouvre une fenêtre : `pointer-events: none` reste sur la page),
  ici dans « Réglages de la session », mais aussi dans le menu de l'historique (« Reprendre une
  session… ») et celui des notifications bloquées (« Réglages »). Tous les menus déroulants
  passent en `modal={false}` ; `menus-modal.test.ts` refuse un `Dropdown.Root` modal. e2e `mcp`
  (clic sur un serveur, Échap, la page répond) — rouge avant la correction — et `resume` (le menu
  de l'historique se rouvre après la fenêtre).
