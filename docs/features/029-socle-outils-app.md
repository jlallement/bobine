# 029 — Socle des outils de l'app : serveur MCP générique et panneau latéral

- **Statut** : fait
- **Dépend de** : 028

## Pourquoi

Dans Claude Code Desktop, l'agent a ses propres outils (navigateur, simulateur, terminal…) et
l'utilisateur voit le résultat dans un panneau à côté de la conversation. La fiche 028 a prouvé le
mécanisme avec Bob : l'app fournit un serveur MCP et Bob appelle ses outils tout seul. Cette fiche
en fait le socle commun de toutes les fiches d'outils (007, 008, 030–034).

## Critères d'acceptation

- [x] `QuestionServer` devient un serveur MCP générique : registre d'outils par module (questions,
      navigateur, simulateur…), chaque module déclare ses outils et leurs gestionnaires.
- [x] Panneau latéral à onglets, redimensionnable, repliable ; l'onglet s'ouvre quand l'agent se sert
      de l'outil correspondant. Seul l'onglet « Tâches » existe pour l'instant (les autres arrivent
      avec leurs fiches).
- [x] Autorisations : les outils de l'app qui n'agissent que dans l'app sont autorisés sans demande
      (comme `ask_user`) ; jamais un appel de type edit / delete / move / execute ; les autres
      passent par la demande normale. Option `confirmAppTools` pour tout demander (son interface :
      fiche 027).
- [x] Images dans les résultats d'outils : affichées dans la carte d'outil du fil (captures), qu'elles
      viennent de l'app ou de l'agent.
- [x] Appels longs : livrés avec la fiche 030 (attente plafonnée à 40 s, l'outil répond « encore en
      cours » et l'agent le rappelle).
- [x] Coût en contexte : un module n'est proposé que si `enabled(dossier)` l'accepte.
- [x] Testé : agent factice (scénario `outil-app`) ; tests du serveur et de l'hôte ; e2e du panneau ;
      Bob réel (sonde).

## Relevé sur Bob 2.0.6 (sonde `probe-bob-tools.mjs`, 2026-10-11, 0,065 bobcoin)

- **Images** : Bob transmet au modèle l'image d'un résultat d'outil MCP (il a reconnu une capture
  unie bleu-vert, « #1a9a99 »). Mais il ne la renvoie **pas** au client : le `tool_call_update` ne
  contient que le texte. L'app doit donc afficher elle-même les images que ses outils renvoient.
- **Autorisation** : chaque outil MCP demande une autorisation (« Running Screenshot (bob-desktop) »,
  options `allow`, `allow_always`, `reject`, `kind: other`). « Toujours autoriser » vaut pour la
  session (2ᵉ appel sans demande) et n'est pas enregistré dans `~/.bob/settings`.
- Titre de l'appel : « Running » + nom de l'outil mis en forme (`ask_user` → « Ask User ») + serveur.

## Plan

- `main/mcp/tools.ts` : types `AppTool` (définition MCP, `autoAllow`, onglet du panneau, `call`),
  `AppToolModule` (`enabled(contexte)`, `tools(contexte)`), `matchAppTool(titre, outils)` (reconnaît
  « Running Screenshot (bob-desktop) » comme « bob-desktop_screenshot »).
- `main/mcp/tool-server.ts` : `QuestionServer` devient `AppToolServer` ; un point d'accès par session
  avec sa liste d'outils ; résultats texte + image.
- `main/mcp/ask-user-tool.ts` : `ask_user` devient le premier outil (module « questions »).
- `AgentHost` : outils de la session = `ask_user` + modules actifs ; autorisation sans demande pour
  les outils `autoAllow` (jamais pour un appel de type edit / delete / move / execute), option
  `confirmAppTools` pour tout demander ; lien appel d'outil de l'agent ↔ appel reçu par le serveur
  (titre) ; événements `tool-media` (images à afficher dans la carte d'outil) et `panel-open`.
- Fil : `images` sur l'élément outil (de l'app, ou blocs image envoyés par l'agent) ; carte d'outil
  qui les affiche.
- Panneau latéral à onglets (renderer) : bouton dans l'en-tête, largeur réglable et mémorisée,
  ouverture automatique sur `panel-open`. Premier onglet : « Tâches » (fiche 035).
- Agent factice : étape générique `mcp-tool` (mise en scène de Bob, images retirées du résultat
  comme Bob) ; `ask-user` en devient un cas.
- Hors périmètre, reporté à la première fiche qui en a besoin (030 / 008) : tâches longues en fond
  (outil « attendre / état »). Interface du réglage `confirmAppTools` : fiche 027.

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-11 — Sonde Bob (relevé ci-dessus), puis implémenté comme prévu : `tools.ts`,
  `tool-server.ts`, `ask-user-tool.ts`, `AgentHost` (`sessionTools`, `callAppTool`, `autoAllowed`,
  événements `tool-media` et `panel-open`), images dans `ToolCall`, `SidePanel` + `PlanList`, étape
  `mcp-tool` et scénario `outil-app` de l'agent factice. Tests : `tools.test.ts`, serveur (texte +
  image, erreur, outil inconnu), hôte (autorisé d'office + image + onglet ; autorisation demandée si
  l'outil touche le système ou avec `confirmAppTools` ; module désactivé). e2e `panelSuite` :
  capture `23-panneau-taches`. `E2E_ONLY=<suite>` pour ne jouer qu'une suite.
  - Pas encore d'e2e pour l'affichage des captures : aucun outil réel ne renvoie d'image avant la
    fiche 007 (couvert par les tests de l'hôte et du fil).
  - Corrigé en route : jauge de consommation qui passait sur deux lignes quand la zone de saisie est
    étroite ; le panneau laisse toujours 720 px à la conversation.
- 2026-10-12 — Onglets du panneau en icônes, libellé en info-bulle (demande de l'utilisateur, comme
  Claude Desktop) : globe (Navigateur), pomme (iOS), robot (Android) — dessinées au trait de Lucide,
  qui n'a pas d'icônes de marque —, terminal, tâches, modifications. Corrigé en passant : la rangée
  d'onglets partageait la largeur avec l'espace vide qui la suit et coupait le dernier onglet.

