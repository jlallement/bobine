# 166 — Onglet « Session » : la session courante en un coup d'œil

- **Statut** : fait
- **Dépend de** : 019 (consommation), 029 / 082 (panneau à onglets), 060 (sonde MCP), 109 (poids
  des outils de Bobine), 113 (coût en un seul endroit), 034 (terminal), 117 / 118 (filles),
  122 (sous-agents en arrière-plan), 165 (`/compact`)
- **Agents** : les deux — uniquement des données génériques (ACP, outils de l'app, git) ; rien de
  propre à un agent dans l'interface (ADR-0011)

## Pourquoi

Dans Claude Desktop, la colonne de droite résume la session courante : environnement, contexte
occupé et sa répartition, modifications, tâches en arrière-plan. Dans Bobine, ces informations
existent mais sont dispersées (sous la zone de saisie, dans la puce de consommation, dans plusieurs
onglets, dans les réglages). Un onglet « Session » les rassemble, lisibles d'un coup d'œil.

## Décisions (questions du 2026-11-05)

- **Emplacement** : premier onglet du panneau de droite (`PanelTab` `session`).
- **Ouverture** : le panneau s'ouvre de lui-même sur « Session » à l'ouverture d'une conversation,
  seulement s'il reste 500 px à la conversation (fiche 113) ; sinon rien ne s'ouvre. Une fois que
  l'utilisateur a fermé le panneau dans une conversation, il ne se rouvre pas de lui-même pour elle.
- **Environnement** : lecture seule avec liens — agent, modèle, mode, dossier, branche ou worktree ;
  un clic ouvre le menu existant (modèle, mode) ou le dossier (`files:openLink`).
- **Contexte** : place occupée, **pas d'argent**. Le coût reste uniquement dans la puce de
  consommation (fiche 113 inchangée).
  - Barre colorée et lignes, chaque estimation précédée de « ≈ » :
    - **Messages** : texte du fil et résultats d'outils, `estimateTokens` (≈ caractères / 4) ;
    - **Outils de Bobine** : poids déjà calculé par la fiche 109 (`mcp/catalog.ts`) ;
    - **Autres serveurs MCP** : définitions `tools/list` obtenues comme « Tester » (fiche 060).
      **Mesure sur demande uniquement** (décision de l'utilisateur du 2026-11-05) : l'onglet ne
      lance jamais un serveur MCP de lui-même, il lit le cache des résultats de « Tester »
      (Réglages › Serveurs MCP, menu ⚙, ou sa propre mesure), même anciens. Sans aucun résultat,
      la ligne affiche « Mesurer » (s'il y a des serveurs configurés pour l'agent) ; avec un
      résultat, « ≈ N », « 2 sur 3 mesurés » s'il en manque, et un bouton pour rafraîchir ;
      « mesure… » pendant la mesure. Sans serveur configuré : pas de ligne ;
    - **Agent (non détaillé)** : total donné par l'agent − somme des estimations (prompt système,
      outils intégrés, skills, mémoire : Bobine ne devine rien) ; jamais négatif ;
    - **Libre** : taille − total.
  - Sans total de l'agent (pas de `usage_update` : **c'est le cas de Bob**, `docs/acp.md`) :
    « ≈ N utilisés » avec le détail connu, sans pourcentage, sans « Libre » ni « Agent ».
  - Après une compaction (`/compact` envoyé par Bobine, ou baisse nette de `used` entre deux
    `usage_update`), seuls les messages postérieurs comptent ; l'écart va dans « Agent ».
- **Modifications** (fiche 207, remplace la ligne unique) : deux lignes. « Conversation » : ce que
  la conversation a modifié (« Aucune » ou « N fichiers +a −b », comme Modifications ›
  Conversation, qu'elle ouvre) ; « Dossier » : ce qui n'est pas commité (« Aucune » ou « N
  fichiers non commités +a −b », comme Modifications › Git, qu'elle ouvre), absente hors dépôt git.
  Pas de Committer / PR ici.
- **En cours** (cette conversation seulement) : commandes des terminaux (voir le journal du
  2026-11-07), serveurs de dev, sous-agents en
  arrière-plan, conversations filles qui travaillent ; chacun avec sa **durée** et, quand Bobine
  sait l'arrêter, un bouton **Arrêter** (carré) :
  - terminal : arrêter la commande, pas l'onglet (2026-11-07) ; serveur de dev : `preview:stop` ;
  - fille : interrompt son tour (comme Stop de sa zone de saisie : `agent:cancel` de la fille) —
    la fille et son worktree restent ;
  - sous-agent en arrière-plan : ACP n'a pas d'annulation d'un sous-agent seul → pas de bouton
    (seulement état et durée), sauf si un mécanisme générique existe déjà dans le code.
  - Ligne repliée « Terminées : N » qui déplie ce qui a fini pendant la session de l'app.
- **Format des jetons** (consigne de l'utilisateur, 2026-11-05) : en mode compact, partout dans
  l'app (puce de consommation, Mon activité, onglet Session), comme Claude Desktop — moins de
  1 000 : nombre brut (« 733 ») ; ensuite « 1k », « 1,2k », « 122,9k », puis « 1,2M » : au plus
  une décimale, zéro final retiré, séparateur décimal de la langue, sans espace avant l'unité.
  Dans l'onglet Session, toutes les valeurs de jetons sont en format compact.
- **Écarté** : section Outils / serveurs MCP (reste dans Réglages et le menu ⚙), coût, quota.

## Critères d'acceptation

- [x] Onglet « Session » premier du panneau, dans le menu « + », clair et sombre, `--lang en`.
- [x] Ouverture d'office à l'ouverture d'une conversation si la conversation garde ≥ 500 px ; pas
      d'ouverture sur une fenêtre étroite ; fermé par l'utilisateur → reste fermé pour elle.
- [x] Environnement : agent, modèle, mode, dossier, branche ou worktree, à jour quand ils changent ;
      les liens ouvrent les menus existants et le dossier.
- [x] Contexte avec total (agent factice qui envoie `usage_update`) : barre, lignes Messages,
      Outils de Bobine, Autres MCP, Agent (non détaillé), Libre ; « ≈ » sur les estimations ;
      la somme des lignes égale la taille ; « Agent » jamais négatif.
- [x] Contexte sans total (agent factice sans `usage_update`, comme Bob) : « ≈ N utilisés », détail
      connu, ni pourcentage ni « Libre ».
- [x] Compaction : après `/compact` ou une baisse nette de `used`, les messages d'avant ne comptent
      plus.
- [x] Aucun coût ni quota dans l'onglet ; la puce de consommation est inchangée.
- [x] Ligne « +N −M » qui ouvre l'onglet Modifications ; absente sans git ou sans modification.
      (Remplacée par les lignes « Conversation » et « Dossier », fiche 207.)
- [x] En cours : commande d'un terminal (pas un shell à l'invite), serveur de dev, sous-agent en
      arrière-plan et fille d'un scénario apparaissent avec leur durée ; Arrêter coupe la
      commande du terminal (l'onglet reste), le serveur, le tour de la fille ; « Terminées : N »
      compte et déplie ce qui a fini (sauf les commandes des terminaux).
- [x] Aucun texte en dur (clés `fr.json` / `en.json`, glossaire de `docs/traduction.md`), aucun
      code propre à un agent dans les composants.
- [x] Testé contre l'agent factice : unités (estimation, compaction, ouverture) et nouvelle suite
      e2e `session` (avec et sans `usage_update`, en cours, fenêtre étroite), clair et sombre,
      captures regardées ; `pnpm e2e --changed` vert ; `./scripts/verify` vert.
- [x] `docs/architecture.md`, index, `CHANGELOG.md` et `CHANGELOG.en.md` à jour.

## Plan

Confirmé après lecture du code (2026-11-05) :

1. **Onglet** : `shared/panel.ts` (`session` en tête de `PANEL_TABS`, onglet par défaut du
   panneau) ; `renderer/src/panel-tabs.ts` : « Session » toujours affiché en premier (hors ordre
   d'arrivée de la fiche 154), sauf fermé (✕) — il revient alors par le menu « + » ;
   `PanelIcons.tsx` (icône `Gauge`) ; `SidePanel.tsx` monte `panel/SessionTab.tsx`, découpé en
   `SessionEnvironment.tsx`, `SessionContext.tsx`, `SessionRunning.tsx`.
2. **Ouverture d'office** : logique pure `panelAutoOpen` dans `panel-tabs.ts` (place gardée par la
   conversation = fenêtre − barre latérale affichée (`fittedSidebarWidth`, fiche 113) − panneau
   ≥ `CONVERSATION_MIN_WIDTH` de la fiche 113) ; `usePanel.ts` l'applique quand une conversation
   non vide devient active (ou que son premier message arrive), panneau fermé, « Mon activité »
   fermée, et que l'utilisateur n'a pas fermé le panneau pour elle (mémoire de la session de
   l'app, par conversation). Un panneau déjà ouvert garde son onglet.
3. **Estimation du contexte** : `shared/context-breakdown.ts` (pur, testé) : messages depuis la
   dernière compaction (`estimateTokens` des textes de l'utilisateur, de l'agent, du contenu et
   des diffs des outils, de la sortie des terminaux), outils de Bobine
   (`conversation:appTools`, fiche 109, déjà exposé), autres MCP ; lignes, « ≈ », bornes.
   Autres MCP : la sonde de la fiche 060 renvoie en plus `toolTokens` (poids estimé des
   définitions `tools/list`) ; l'onglet lit le cache de `renderer/mcp-status.ts` (5 min) et lance
   en fond un test des serveurs périmés, jamais bloquant (« … » le temps du test).
4. **Compaction** : `ConversationUsage.contextSince` (identifiant d'élément du fil) posé par
   `transcript.ts` quand `used` baisse nettement entre deux `usage_update` (seuil :
   `CONTEXT_DROP` dans `usage.ts`) ; la commande `/compact` (élément `user` `compaction`), un
   élément `compaction` (`compaction_update`) ou une passation (`handover`) servent aussi de
   repère. Seuls les éléments postérieurs comptent dans « Messages ».
5. **En cours** : `renderer/src/session-running.ts` (pur, testé : suivi de ce qui tourne et de ce
   qui a fini depuis le lancement) et le hook `useSessionRunning` (abonnements `terminal:changed`,
   `preview:changed`, filles de la liste des conversations, sous-agents en arrière-plan du fil).
   Durées : `startedAt` ajouté à `TerminalTabInfo` (main `terminal-manager.ts`) et à
   `DevServerView` (`startedAt`, `endedAt`, main `dev-servers.ts`) ; sous-agents :
   `subagentRun.startedAt/endedAt` ; filles : première fois vues au travail. Arrêts :
   `terminal:close`, `preview:stop`, `agent:cancel` de la fille ; sous-agent : aucun mécanisme
   générique → pas de bouton.
6. **Modifications** : `changes:git` (comme l'onglet Modifications) → `changesSummary`, relu à la
   fin de chaque outil ; clic → `openChanges('git')`.
7. **Environnement** : `composerView` (agent, réglages de mode et de modèle), `ModeChip` et
   `ModelChip` existants réutilisés (mêmes menus), dossier par `files:openLink` (`.`, révélé),
   branche ou worktree (`summary.branch`, `git.branch`) → onglet Modifications vue git.
8. **Textes** : `fr.json` / `en.json` (`sessionTab.*`).
9. **Essais** : unités (panel-tabs, usePanel, context-breakdown, usage/transcript, session-running,
   mcp-probe, SessionTab) ; scénarios de l'agent factice (avec et sans `usage_update`, compaction,
   sous-agent en arrière-plan) ; suite e2e `session` dans `e2e/catalog.mjs`.
10. **Docs** : `docs/architecture.md`, index, changelogs FR/EN.

Pas de nouvelle dépendance. Pas d'ADR prévu.

## Journal

- 2026-11-05 — Fiche écrite après une série de questions à l'utilisateur (décisions ci-dessus).
  Implémentation confiée à une session fille, relue ensuite par la session mère.
- 2026-11-05 — Implémenté (session fille). Fait : onglet « Session » premier et toujours affiché
  sauf fermé (✕, puis menu « + »), onglet par défaut du panneau ; ouverture d'office
  (`panelAutoOpens`, `usePanel`) ; environnement avec `ModelChip` / `ModeChip` réutilisés, dossier
  par `files:openLink`, branche ou worktree vers l'onglet Modifications (vue git) ; contexte
  (`shared/context-breakdown.ts`, compaction `contextSince` sur une baisse d'au moins 25 % et
  1 000 jetons, `toolTokens` de la sonde MCP) ; ligne « +N −M » de `changes:git` ; « En cours »
  (`session-running.ts`, `useSessionRunning`, `startedAt` des terminaux, `startedAt`/`endedAt`
  des serveurs de dev). Essais : unités (panel-tabs, usePanel, context-breakdown,
  session-running, useSessionRunning, SessionTab, mcp-probe, dev-servers, terminal-manager),
  suite e2e `session` (fr et en, clair et sombre), suite complète verte.
  Écarts et précisions :
  - « À l'ouverture d'une conversation » : quand une conversation **non vide** devient active, ou
    à l'arrivée de son premier message (une conversation vide garde l'écran d'accueil). Un
    panneau déjà ouvert garde son onglet ; un onglet « Session » fermé (✕) n'est pas rouvert.
    Toute fermeture du panneau (✕, bouton de l'en-tête, menu, ⌃`, dernier onglet fermé) compte
    comme « fermé par l'utilisateur ».
  - Aucun nouveau scénario d'agent factice : `echo` (avec `usage_update`), `--sans-usage`
    (nouvelle valeur `MOCK_AGENT_USAGE=none` du profil factice), `compaction`,
    `sous-agent-arriere-plan-lent`, `lancer-app`, `attend-stop` (fille) couvrent les cas.
  - Messages : texte de l'utilisateur et de l'agent, titre, contenu et diffs des outils, sortie des
    terminaux ACP ; ni la réflexion, ni le travail des sous-agents. Les commandes des terminaux ACP
    de l'agent ne sont pas dans « En cours » (seulement les terminaux du panneau).
  - « Terminées » : suivi dans le renderer depuis le lancement ; pour une conversation qu'on ne
    regarde pas, une fin (terminal fermé, fille) est vue au retour, à l'heure du retour.
  - Sous-agent en arrière-plan : pas de bouton Arrêter (aucun mécanisme générique), l'infobulle
    le dit.
  - Suites e2e existantes adaptées (le panneau s'ouvre désormais au premier message) :
    `ui.closePanel()` dans `e2e/lib.mjs`, appelé par `composer`, `fun`, `plan`, `pinned-plan`,
    `usage-board` ; `panel` part de « Session ». Les captures de beaucoup de suites montrent
    maintenant le panneau ouvert.
- 2026-11-05 — Format compact des jetons (consigne de l'utilisateur relayée par la session mère) :
  `formatTokens(n, true)` compacte dès 1 000 (« 1k », « 1,2k », « 1,2M », sans espace) au lieu
  de 10 000 (« 258 k ») ; tous les appels compacts de l'app suivent. Les appels non compacts
  (nombres exacts, ex. « 3 157 sur 200 000 » du détail de la puce) ne changent pas.
- 2026-11-05 — Correction après relecture de la session mère : les lignes du contexte
  dépassaient le total annoncé (« 3,2k sur 200k » pour ≈ 506 + ≈ 4,1k). Les estimations ne
  étaient ramenées que si elles dépassaient la taille ; elles le sont maintenant dès qu'elles
  dépassent `used` (à proportion, en entiers dont la somme vaut exactement `used`, toujours
  marquées « ≈ »), « Agent » vaut alors 0 et « Libre » = taille − `used`. Sans total, la somme
  brute reste affichée telle quelle. Test unitaire du cas et vérification e2e (somme des lignes
  occupées = total annoncé, valeurs exactes en `data-tokens`). Capture `session-1-total` prise
  souris écartée (plus d'infobulle sur la ligne Agent).
- 2026-11-05 — Autres serveurs MCP mesurés sur demande seulement (décision de l'utilisateur) :
  plus d'appel automatique de `testMcpServers` à l'affichage ; `useMcpTokens` lit le cache de
  `mcp-status.ts` et `measure` lance la mesure (« Mesurer », ou rafraîchir). Ligne présente dès
  qu'un serveur est configuré, « 1 sur 2 mesuré » quand il en manque. Essais : unités (aucune
  sonde à l'affichage, « Mesurer » la lance) ; e2e `session` avec un serveur d'essai qui note ses
  lancements (aucun à l'ouverture, un au clic), captures `session-1b-mesurer` et
  `session-1-total`.
- 2026-11-05 — Retouches demandées par l'utilisateur : la note du contexte dit « ≈ : estimé »
  (« ≈: estimated »), la précision « environ 4 caractères par jeton » passe dans son infobulle,
  et aucun texte de l'onglet ne parle plus d'une estimation « de Bobine » (sans total : « seul ce
  qui est connu est compté »). Section Environnement réalignée : une seule colonne de valeurs
  (icône de 16 px, 6 px, texte) — Agent `Bot` (comme Réglages › Agents), Modèle `Cpu` (icône non
  utilisée ailleurs), Mode, Dossier, Branche — ; puces Modèle et Mode discrètes dans l'onglet
  seulement (ni cadre ni fond au repos, fond au survol, marge intérieure compensée), anneau de
  focus au clavier seulement ; lignes de 32 px. Essai e2e : les cinq icônes au même x (±1 px),
  libellés alignés, lignes de même hauteur.
- 2026-11-07 — Terminaux dans « En cours » : seulement pendant qu'une commande tourne (demande de
  l'utilisateur, qui trouvait qu'ouvrir un terminal créait une « tâche » sans fin, nommée
  d'après le dossier). Écart aux décisions du 2026-11-05 :
  - Un terminal du panneau n'apparaît que si son programme au premier plan n'est pas un shell
    (`busy` de `terminal-manager.ts`, inchangé) : ligne au nom de la commande (`sleep`, `node`,
    `bob`…), durée depuis le début de la commande. `TerminalTabInfo.command` (`name`,
    `startedAt`) porte l'information ; le début est le premier moment où le main la voit (au plus
    ≈ 0,4 s de retard), un autre nom au premier plan est une autre commande. Une ligne par
    commande (clé `terminal:<onglet>:<début>`).
  - Mise à jour : pas de relecture périodique. À chaque sortie du terminal, le main relit le
    programme au premier plan, puis une seconde fois après 400 ms de silence (`QUIET_MS`, déjà
    utilisé pour la lecture de l'agent) ou à la fin de la seconde de démarrage du shell : une
    commande muette (`sleep 30`) ne prend le premier plan qu'après l'écho d'Entrée, et la fin
    réécrit toujours l'invite. Un changement de titre ou de commande émet `terminal:changed`,
    comme avant pour le titre.
  - « Arrêter » ne ferme plus l'onglet (son shell, son historique, son écran seraient perdus) :
    nouveau canal `terminal:stop` → `TerminalManager.stop` : Ctrl+C, comme au clavier ; si la
    même commande tourne encore 2 s plus tard (elle ignore Ctrl+C : `vim`, `tmux`, un
    `trap '' INT`), SIGTERM à son groupe de processus au premier plan (`foreground.ts`,
    `ps -o tpgid=`, jamais le shell lui-même). Pas de SIGKILL : une commande qui ignore aussi
    SIGTERM reste, et l'onglet la montre. `tmux` : SIGTERM ferme le client, les sessions tmux
    restent (c'est leur rôle). Une commande qui ignore SIGHUP (`nohup`) n'est pas concernée :
    SIGHUP n'est pas utilisé. Canal permis en profil en lecture seule, comme les autres du
    terminal.
  - « Terminées » : une commande finie d'un terminal n'y va pas, elle disparaît. Son résultat
    reste dans le terminal, et chaque `ls` ou `cat` y ferait sinon une ligne ; « Terminées »
    reste pour le travail de fond (serveurs, sous-agents, filles). Un onglet fermé n'y va plus
    non plus.
  - Limites (celles du titre de l'onglet, inchangées) : un shell lancé dans le shell (`zsh` dans
    `zsh`), ou un script dont le programme au premier plan est un shell (`./build.sh`), compte
    comme l'invite et n'apparaît pas ; `tmux` apparaît sous le nom `tmux` tant que le client
    tourne ; une commande très courte peut apparaître un instant (comme le titre de l'onglet).
  - Essais : unités `session-running` (invite → absent, commande → présent avec nom et début,
    invite → disparu sans « Terminées », commande suivante → autre ligne), `useSessionRunning`,
    `terminal-manager` (faux pty : commande muette vue après l'écho, début, fin à l'invite, shell
    dans le shell ; « Arrêter » : Ctrl+C puis SIGTERM seulement si la même commande tourne
    encore ; vrai shell : commande `perl` qui ignore SIGINT arrêtée, shell toujours là). Suite
    e2e `session` : terminal à l'invite → aucune ligne, `sleep 30` → ligne « sleep », Arrêter →
    disparue et onglet gardé, « Terminées : 3 » ; captures `session-2a-terminal-invite` et
    `session-2-en-cours`.
