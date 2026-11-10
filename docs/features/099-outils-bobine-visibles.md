# 099 — Les outils de Bobine visibles dans les Réglages et dans le menu ⚙

- **Statut** : fait
- **Dépend de** : 025 (serveurs MCP des agents), 029 (socle des outils de l'app), 060 (statut des serveurs MCP) et les modules d'outils
  (navigateur, lancer l'app, terminal, simulateur iOS, émulateur Android, conversations filles 097)
- **Agents** : les deux. Les outils de Bobine passent par son serveur MCP `bobine`, que Bob et OpenCode
  reçoivent de la même façon ; rien de propre à un agent.

## Pourquoi

Bobine donne aux agents une soixantaine d'outils, par son propre serveur MCP `bobine` :

- questions ;
- navigateur intégré ;
- lancer l'app ;
- terminal ;
- simulateur iOS ;
- émulateur Android ;
- conversations filles.

On ne les voit nulle part : Réglages › Serveurs MCP ne montre que les serveurs propres à chaque agent,
lus dans leurs fichiers de config. L'utilisateur a du mal à savoir ce qui existe, ce que l'agent peut
faire, et à quelles conditions (2026-10-21).

## Maquette

`e2e/captures/m101-planche-outils-{dark,light}.png` (hors git). Les captures brutes sont dans
`m101-outils-reglages-*.png` et `m101-outils-menu-*.png`. Les conditions et les accords de la
maquette sont indicatifs : ceux de l'app viennent du code.

## Choix d'interface

Tranchés par la session principale :

- **Réglages › Serveurs MCP** : un premier onglet « Bobine », avant les onglets des agents, avec le
  nombre d'outils.
  - En tête, une phrase : ces outils sont fournis par Bobine à tous les agents, par son serveur MCP
    `bobine`, sans rien à installer ; chaque conversation ne reçoit que ceux qui servent dans son
    dossier.
  - Une carte par famille, avec :
    - le titre et le nombre d'outils ;
    - ce qu'elle permet, en une phrase en français ;
    - quand elle est proposée (pastille neutre : « Toujours », « Projet Xcode dans le dossier »,
      « Dans un dépôt git »…) ;
    - si elle demande l'accord de l'utilisateur, et quand (pastille orange) ;
    - repliée par défaut. Dépliée, elle liste les noms des outils, en police à chasse fixe, avec leur
      description en infobulle (celle que voit l'agent, en anglais, ADR-0014).
- **Menu ⚙ de la conversation**, section « Serveurs MCP » : une première ligne « bobine · intégré » et
  « N outils dans cette conversation · Voir les outils ». Un clic ouvre l'onglet « Bobine ».
  - N, c'est ce que la conversation reçoit vraiment : les modules retenus pour son dossier.
  - La ligne « Aucun serveur MCP » de l'agent devient « Aucun autre serveur MCP ».
- **Lecture seule** : pas d'interrupteur pour activer ou couper une famille (choix de simplicité).
- **Vocabulaire** : « outils de Bobine », « intégré ». Le nom technique `bobine` reste visible, puisque
  c'est celui que l'agent cite.

## Critères d'acceptation

- [x] L'onglet « Bobine » de Réglages › Serveurs MCP liste toutes les familles d'outils de l'app,
      avec leur nombre exact d'outils, leur phrase, leur condition et leur accord.
- [x] La liste est tirée des modules d'outils du main (`AppToolModule`, `tools`, `enabled`), pas d'une
      liste tenue à la main. Ajouter un outil le fait apparaître sans autre changement.
- [x] Chaque module porte ses textes (titre, phrase, condition, accord) dans des clés i18n françaises
      et anglaises, à côté de sa définition.
- [x] Une carte dépliée montre les noms des outils, avec leur description en infobulle.
- [x] Le menu ⚙ montre « bobine · intégré » avec le nombre d'outils reçus par la conversation ouverte.
      Il est juste : par exemple, pas d'outils iOS hors projet Xcode, pas d'outils de filles hors
      dépôt git. Un clic ouvre l'onglet « Bobine ».
- [x] Rien de propre à un agent ; les onglets des agents ne changent pas.
- [x] Testé : unités (liste tirée des modules, nombre par conversation), e2e `mcp` (onglet, carte
      dépliée, ligne du menu ⚙), en clair, en sombre et en anglais, captures regardées.

## Plan

### Main

1. **`src/main/mcp/tools.ts`** : `AppToolModule` gagne
   - `about` (obligatoire) : clés i18n `title`, `summary`, `condition`, `approval?` — chaque module
     les porte dans sa définition, rangées sous `appToolFamilies.<id>` dans `fr.json` / `en.json` ;
   - `catalog?(context)` : tous les outils que le module peut donner, quel que soit le dossier ou le
     rôle (par défaut `tools`). Seul `children` en a besoin (mère ou fille selon la conversation).
   - `moduleTools(modules, context)` : les modules retenus (`enabled`) et leurs outils, partagé par
     le pont et le décompte du menu ⚙.
2. **`ask-user-tool.ts`** : `askUserModule(ask)`, pour que la famille « Questions » vienne aussi d'un
   module ; `app-tools-bridge.ts` l'utilise (même liste d'outils qu'avant, dans le même ordre).
3. **`src/main/mcp/catalog.ts`** (nouveau) : `appToolsCatalog(modules)` (familles, nombre, textes,
   noms et descriptions) et `conversationToolNames(modules, workspace, id)` ; contexte de
   description inerte (`ask`, `tellAgent` jamais appelés : `tools()` ne fait que créer des
   fermetures — vérifié module par module).
4. **`AgentHost.appToolNames()`** : les outils vraiment enregistrés à l'ouverture de la session
   (aucun si l'agent n'accepte pas MCP par HTTP). **`ConversationManager`** : `appToolsCatalog()` et
   `appToolNames(id)` (ceux de la session vivante, sinon ceux que son dossier recevrait).
5. **IPC** (lecture seule) : `mcp:appTools` (familles) et `conversation:appTools` (noms reçus par
   une conversation). Les handlers `mcp:*` sortent d'`ipc.ts` (798 / 800 lignes) vers
   `src/main/agent-config/mcp-ipc.ts`, sur le modèle de `childHandlers`.

### Renderer

6. **`components/settings/AppToolsTab.tsx`** (nouveau) : phrase d'en-tête, une carte par famille
   (titre, nombre, phrase, pastille neutre de condition, pastille orange d'accord), repliée ;
   dépliée, les noms en chasse fixe, description de l'agent en infobulle (`title`).
7. **`McpSettings.tsx`** : onglet « Bobine » en premier (choisi par défaut), avec le nombre total
   d'outils ; les onglets des agents ne changent pas. Prop `initialTab` pour ouvrir un onglet précis.
8. **Menu ⚙** (`Menus.tsx`) : section MCP sortie dans `SessionMcpSection` (complexité) ; première
   ligne « bobine · intégré » / « N outils dans cette conversation · Voir les outils », noms des
   outils au survol ; clic → onglet « Bobine ». « Aucun serveur MCP » → « Aucun autre serveur MCP ».
   Les lignes des serveurs de l'agent ouvrent l'onglet de **son** agent (avant : le premier onglet,
   qui est désormais « Bobine »).
9. **`AppDialogs`** / **`SettingsDialog`** / **`App.tsx`** : `openMcpSettings(tab?)`.

### Textes, essais, docs

10. Clés `appToolFamilies.*`, `mcp.bobine.*`, `sessionSettings.mcp.appTools*` (fr, en) ; glossaire
    de `docs/traduction.md` (« outils de Bobine », « intégré »).
11. Unités : `catalog.test.ts` (toutes les familles, nombres = `tools()`, conditions : pas d'iOS
    hors projet Xcode, pas de filles hors dépôt git, fille = `message_parent`), pont inchangé,
    `mcp-ipc`, `AppToolsTab`, `SessionSettingsMenu`.
12. e2e `mcp` : onglet « Bobine » (nombre = somme des cartes), carte dépliée (noms, infobulle), ligne
    du menu ⚙ (N = outils reçus, sans `ios_*` ni `start_child` dans un dossier vide), clic → onglet
    « Bobine » ; les étapes existantes passent d'abord par l'onglet de Bob. Clair, sombre, `--lang en`.
13. `docs/architecture.md` (canaux), `CHANGELOG.md` / `CHANGELOG.en.md`, index des fiches.

Aucune nouvelle dépendance.

## Journal

- 2026-10-21 — Fiche créée après la question de l'utilisateur (« j'ai du mal à voir ce qui existe »).
  Maquette `m101`, choix tranchés par la session principale. Rien n'est codé.
- 2026-10-21 — Fait, sur la branche `claude/fiche-099-outils-bobine-101cf8`.
  - **Main** : `AppToolModule.about` (clés `appToolFamilies.<id>`, obligatoire : un module sans
    textes ne compile pas) et `catalog` (seul `children` s'en sert : outils d'une mère et d'une
    fille). `ask_user` devient `askUserModule`, utilisé par le pont et par le catalogue ;
    `moduleTools` est la sélection commune (`enabled`). `mcp/catalog.ts` : `appToolsCatalog`,
    `conversationToolNames`. Menu ⚙ : `AgentHost.appToolNames` (outils vraiment enregistrés à
    l'ouverture de la session, aucun si l'agent n'accepte pas MCP par HTTP), sinon ceux que le
    dossier recevrait. Canaux `mcp:appTools` et `conversation:appTools` ; les handlers `mcp:*`
    sortis d'`ipc.ts` (798 → 760 lignes) dans `agent-config/mcp-ipc.ts`. `APP_TOOLS_SERVER_NAME`
    passe dans `shared/mcp.ts` (le menu l'affiche).
  - **Conditions et accords vérifiés dans le code**, module par module : questions (toujours, pas
    d'accord) ; terminal (toujours ; `terminal_run`, chaque nouvelle commande de la conversation) ;
    navigateur (toujours ; site hors du Mac, `siteToApprove`) ; lancer l'app (toujours ;
    `preview_start`, première fois qu'une commande est lancée dans le dossier) ; simulateur iOS
    (`hasAppleProject` : `Package.swift`, ou `.xcodeproj` / `.xcworkspace` à 3 niveaux ;
    `ios_build`) ; émulateur Android (`hasAndroidProject` : `settings.gradle` + `gradlew` ;
    `android_build`) ; filles (mère : dossier dans un dépôt git, fille : `message_parent` seul ;
    `start_child`, une carte par fille). Tous les outils sont `autoAllow` : aucun accord de l'agent
    en plus de ceux-là (`confirmAppTools` n'est pas réglable dans l'interface).
  - **Renderer** : `AppToolsTab.tsx` (cartes repliées, bouton sur toute la tête de carte,
    `aria-expanded`), `McpSettings.tsx` découpé (onglets, puis `AgentServers` pour un agent),
    `SessionMcpSection` dans `Menus.tsx`, `openMcpSettings(tab)` dans `AppDialogs`.
  - **Essais** : unités `mcp/catalog.test.ts` (vrais modules sur des faux inertes),
    `agent-config/mcp-ipc.test.ts`, `agent-host.test.ts` (outils reçus), `McpSettings.test.tsx`,
    `SessionSettingsMenu.test.tsx` ; e2e `mcp` (onglet, nombre = somme des cartes, pastilles, carte
    dépliée, ligne du menu ⚙ à 28 outils dans un dossier vide, clic → onglet « Bobine », serveur →
    onglet de l'agent), `rules`, `base`, `settings`, en clair, en sombre et `--lang en` ; captures
    `a9-mcp-bobine`, `b4-mcp-session`, `i0-regles-actives` regardées. 57 outils sur ce Mac.
  - **Écarts au plan et à la maquette** :
    - Questions : pas de pastille « Sans accord » ; une famille sans accord n'a que sa condition
      (la pastille orange ne sert qu'aux accords).
    - Ordre des cartes : celui où l'agent reçoit les modules (`index.ts` : terminal avant le
      navigateur), pas celui de la maquette.
    - Émulateur Android : sans SDK Android sur le Mac, le module n'existe pas, donc pas de carte.
    - « Bobine » est l'onglet ouvert par défaut ; les lignes des serveurs de l'agent et « Aucun autre
      serveur MCP » du menu ⚙ ouvrent l'onglet de l'agent de la conversation (avant : le premier
      onglet, désormais « Bobine »).
    - Icône (clé) devant « bobine · intégré », alignée sur les pastilles des serveurs de l'agent.
    - Hors fiche : `e2e/suites/rules.mjs` comparait des textes français en dur et échouait déjà en
      `--lang en` ; passé à `L()`. La suite `mcp` aussi (« Joignable », « 3 outils »…).
  - **Pas fait** : l'essai à la vraie souris (accès à la fenêtre refusé) ; seuls les e2e (CDP) ont
    cliqué. La suite e2e complète n'a pas tourné (pas de push depuis cette session).
- 2026-10-23 (écart, fiche 126) : la famille imposée (« Questions ») affiche « Toujours » au lieu
  d'un interrupteur grisé ; les interrupteurs ont une zone cliquable et accessible à leur taille.
