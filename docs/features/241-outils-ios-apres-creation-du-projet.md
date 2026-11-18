# 241 — Outils iOS absents d'une conversation ouverte avant le projet Xcode

- **Statut** : à faire
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

- [ ] Quand un projet Apple (ou Android, même mécanisme à vérifier) apparaît dans le dossier d'une
      conversation dont la session n'a pas ces outils, Bobine le dit dans le fil (une ligne, avec
      « Redémarrer l'agent ») ; ou les outils sont ajoutés sans redémarrer si l'agent accepte une
      liste d'outils qui change (`notifications/tools/list_changed`, à vérifier pour OpenCode et
      Bob, `docs/acp.md`).
- [ ] À défaut, la famille iOS est proposée dès que Xcode est installé, et l'outil répond
      clairement « aucun projet Xcode dans ce dossier ».
- [ ] Essai contre l'agent factice : session ouverte sans projet, création d'un `.xcodeproj` par
      l'essai, l'avis apparaît ; après redémarrage, `outils-mcp` liste `ios_build`.

## Rejouer

**Agent factice : oui.** Le scénario `outils-mcp` liste les outils déclarés par le serveur MCP de
l'app (`tools/list`) : ouvrir une conversation dans un dossier sans projet, créer un dossier
`X.xcodeproj` dans le dossier pendant la session, renvoyer `outils-mcp` : `ios_build` est absent ;
le menu ⚙ annonce plus d'outils « au prochain démarrage ». La trace réelle ci-dessus sert de
référence.

## Journal

- 2026-11-17 — Ouverte par la recette « POC complet » (fiche 238), étape 6.
