# 241 — Outils iOS absents d'une conversation ouverte avant le projet Xcode

- **Statut** : en cours (e2e `outils-projet` et `--changed` à jouer)
- **Dépend de** : 008 (simulateur iOS), 109 (familles d'outils, menu ⚙), 099 (outils de l'app)
- **Agents** : les deux (choix des outils proposés par Bobine, indépendant de l'agent)
- **Trouvé par** : recette « POC complet » du 2026-11-17, étape 6
  ([rapport](../recettes/2026-11-17-poc-complet-opencode.md), défaut D2)

## Pourquoi

Le cas le plus courant d'un nouveau projet : on ouvre une conversation dans un dossier vide, l'agent
y écrit une app iOS, puis on lui demande de la compiler et de la lancer dans le simulateur « avec
l'outil de Bobine ». L'agent répond qu'il ne le peut pas : les outils `ios_*` ne sont pas dans sa
session. La famille iOS n'est proposée que si le dossier contient un projet Apple **à l'ouverture
de la session** (`src/main/simulator/simulator-tools.ts:57`,
`enabled: (context) => hasAppleProject(context.workspace)`). L'onglet iOS n'apparaît pas non plus.

Bobine le sait : le menu ⚙ de la saisie affiche « bobine · intégré — 35 outils dans cette
conversation » et « Au prochain démarrage de l'agent : 47 outils — Les réglages ont changé ·
Redémarrer l'agent pour les appliquer ». Mais rien ne le dit dans le fil, ni quand l'agent répond
que l'outil manque ; l'utilisateur ordinaire ne pense pas à ouvrir ce menu.

Gravité : **sérieux** (l'étape ne se finit qu'avec une intervention qu'un utilisateur ordinaire
ne trouverait pas). Vu une fois ; la cause, lue dans le code, rend le défaut systématique.

## Ce qui a été observé (2026-11-17, Bobine 1.0.0-beta.7, OpenCode 2.3.0, openai/gpt-6-luna)

- La mère `f7836b04` a été ouverte à 19:49Z sur un dépôt qui ne contenait que `README.md`. Elle a
  écrit `ios/TaskManager.xcodeproj` vers 20:12Z.
- Consigne (20:32Z) : « Pas xcodebuild dans le terminal : utilise l'outil ios_build de Bobine… ».
  Réponse : « l'outil Bobine `ios_build` / `ios_screenshot` n'est pas disponible dans les outils
  exposés à cette session ».
- Menu ⚙ : capture `docs/recettes/2026-11-17-poc-complet-opencode/6-menu-outils-35-47.jpg`.
- Après « Redémarrer l'agent » (`agents.log`) :

  ```text
  2026-11-17T20:34:20.618Z [f7836b04 · opencode] → session/load #1 s …4PDCt09Q, 1 serveur(s) MCP (330 o)
  2026-11-17T20:34:20.935Z [f7836b04 · opencode] MCP tools/list : 47 outil(s)
  2026-11-17T20:34:39.930Z [f7836b04 · opencode] MCP → ios_boot
  2026-11-17T20:35:13.484Z [f7836b04 · opencode] MCP → ios_build
  ```

  Les filles ouvertes à 20:00Z et 20:09Z (avant le projet) avaient reçu 32 outils.

## Critères d'acceptation

- [x] Quand un projet Apple ou Android apparaît dans le dossier d'une conversation dont la session
      n'a pas ces outils, Bobine les ajoute sans redémarrer si l'agent relit sa liste
      (`notifications/tools/list_changed` : OpenCode 2.3.0 oui, vérifié en réel ; Bob inconnu), et
      le fil le dit d'une ligne ; sinon le fil le dit (une ligne, avec « Redémarrer l'agent »).
      Android : même mécanisme (`android-tools.ts`, `hasAndroidProject`), même correctif.
- [x] ~~À défaut, la famille iOS est proposée dès que Xcode est installé~~ : écarté (≈ 12 outils de
      contexte en plus dans toutes les conversations, fiche 109), le critère précédent suffit.
- [x] Essai contre l'agent factice : session ouverte sans projet, création d'un `.xcodeproj`
      pendant un tour (`cree-projet-xcode`), l'avis apparaît ; après redémarrage, `outils-mcp` liste
      `ios_build` (e2e `outils-projet`) ; et l'agent factice qui suit la liste (`--suit-outils`) a
      `ios_build` sans redémarrer.

## Enquête (2026-11-18)

- **Bobine** : le serveur MCP annonçait `listChanged: false` et refusait le `GET` (405) : il ne
  pouvait rien notifier ; la liste d'une session était figée à son ouverture (`register`).
- **OpenCode 2.3.0**, essai réel hors tests automatisés (serveur MCP HTTP d'essai `listChanged:
  true`, ACP brut, `HOME`/`XDG_*` jetables, `opencode/big-pickle`) : il ouvre le flux SSE (`GET`)
  après `notifications/initialized` ; à la notification, il relit la liste dans la seconde et le
  modèle appelle le nouvel outil au tour suivant. Témoin sans notification : jamais de relecture.
- **Bob** : rien dans `docs/acp.md` ni dans sa documentation publique → inconnu ; la solution marche
  sans (avis).
- Maquettes (clair, sombre, 390 px) et compte rendu validés par le tech lead le 2026-11-18 (dossier
  de notes de la session, `241-maquettes/`) : avis A (fin du tour qui crée le projet), B (redonné
  sous la réponse « outil manquant », Bobine ne lit pas la réponse de l'agent), C (ligne discrète
  après redémarrage), D (ligne discrète, agent qui relit). Périmètre retenu : « socle + D ».

## Ce qui a été fait

- **Serveur MCP** (`mcp/tool-server.ts`) : `listChanged: true` ; `GET` avec `accept:
  text/event-stream` → flux SSE gardé ouvert (sinon 405, et 404 venu d'une page comme avant) ;
  `ToolEndpoint.update(tools, waitMs)` remplace la liste, envoie `notifications/tools/list_changed`
  sur chaque flux et attend un `tools/list` (`listed`, `ignored`, `no-stream`) ; `register(…,
  onListed)` dit ce que l'agent a relu. Journal : flux ouvert, notification, liste pas relue.
- **Familles qui suivent le dossier** : `AppToolModule.followsWorkspace` (iOS, Android).
  `AppToolsBridge` distingue la liste servie de celle que l'agent a (`given`, mise à jour à chaque
  relecture) : `missingFamilies`, `serveFamilies`, `givenFamilies`. Le menu ⚙ montre ce que
  l'agent a, et « au prochain démarrage » tant qu'il ne l'a pas.
- **`agent/app-tools-endpoint.ts`** (`AppToolsEndpoint`, sorti d'`AgentHost` qui était à son plafond
  de lignes) : ouvre et révoque le point d'accès ; à chaque fin de tour, une famille utile qui
  manque est servie et notifiée ; relue dans les 10 s → `app-tools` `live`, sinon `pending` (redit à
  chaque fin de tour ; plus d'attente dans la session après une notification ignorée) ; relue plus
  tard → `live` ; session suivante → `session`.
- **Fil** : évènement `app-tools` ; `shared/transcript-notice.ts` (forme des avis sortie de
  `transcript.ts`, à son plafond, avec `noticeText` et `reduceAppTools`) : un seul avis
  « à redémarrer » par famille, retiré et redonné à la fin, remplacé par une ligne discrète.
  `NoticeRestart.tsx` : « Redémarrer l'agent » (contrôle `restartAgent` du tour, `agent:restart`,
  comme le menu ⚙), icône d'appareil ; textes fr/en (iOS, Android, autre famille).
- **Agent factice** : `cree-projet-xcode` (écrit `ios/Essai.xcodeproj` pendant le tour) ;
  `--suit-outils` / `MOCK_AGENT_SUIT_OUTILS=1` (`suit-outils.mts`) : se connecte au serveur MCP,
  ouvre le flux et relit la liste à chaque notification, comme OpenCode 2.3.0.
- **Essais** : serveur (flux, notification, relecture, `ignored`, `no-stream`, révocation),
  `AppToolsEndpoint` (rien, relue, sans flux puis relue plus tard, ignorée, session suivante, sans
  HTTP), réducteur, bouton dans le fil — tous échouent sans le correctif (rejoués sur `main`) ;
  e2e `outils-projet` (macOS : `needs: ['simulator']`, famille iOS proposée là seulement) —
  **pas encore joué** (machine partagée, en attente du feu vert).

## Écarts au plan

- `Transcript.tsx` n'est touché que pour le bouton et l'icône (recoupement minimal avec la 240) ;
  la forme des avis a quitté `transcript.ts` pour tenir son plafond de 800 lignes.
- Bob réel : à relever (ouvre-t-il le `GET` ? relit-il la liste ?) — `docs/acp.md`, matrice.

## Rejouer

**Agent factice : oui.** Le scénario `outils-mcp` liste les outils déclarés par le serveur MCP de
l'app (`tools/list`) : ouvrir une conversation dans un dossier sans projet, créer un dossier
`X.xcodeproj` dans le dossier pendant la session, renvoyer `outils-mcp` : `ios_build` est absent ;
le menu ⚙ annonce plus d'outils « au prochain démarrage ». La trace réelle ci-dessus sert de
référence.

## Journal

- 2026-11-17 — Ouverte par la recette « POC complet » (fiche 238), étape 6.
- 2026-11-18 — Enquête (OpenCode 2.3.0 suit `list_changed`, Bob inconnu), maquettes validées
  (« socle + D »), correctif, essais unitaires et e2e `outils-projet`.
