# 118 — Des conversations filles proposées par l'agent, sans qu'on le lui dise

- **Statut** : fait
- **Dépend de** : 097 (conversations filles, ADR-0019, ADR-0020), 112 (carte « Tâches
  proposées »), 039 (commandes de l'app), 109 (familles d'outils de Bobine désactivables)
- **Agents** : les deux. Un bloc de texte ordinaire joint au premier message de chaque session, et
  une commande de l'app : rien de propre à Bob ni à OpenCode (ADR-0011), rien d'imposé à un profil.

## Pourquoi

Avec les vrais agents (Bob, OpenCode avec GPT-6.1 Sol), l'agent ne propose jamais de conversation
fille de lui-même. Il faut lui écrire « utilise l'outil pour créer des tâches filles, chacune dans
son worktree… ».

Diagnostic : l'agent ne connaît `start_child` que par sa description MCP, sans aucun contexte sur
la session. Ses propres sous-agents (`spawn_subagent` de Bob, `task` d'OpenCode) sont mis en avant
par son system prompt, listés avant, sans accord à demander : ils gagnent toujours.

On veut que l'agent sache, dès le début de la session, ce que l'app lui offre et quand s'en servir.
On veut aussi un geste explicite pour demander un découpage, et un réglage pour doser.

## Critères d'acceptation

- [x] **Contexte de session.** Au premier message de chaque session de l'agent (nouvelle, rouverte,
      après un redémarrage), une conversation qui a reçu `start_child` reçoit un bloc
      `<bobine_capabilities>` en anglais. Le bloc dit :
  - que l'utilisateur peut donner plusieurs chantiers indépendants dans un message ;
  - que `start_child` ouvre une fille dans son propre worktree, suivie par l'utilisateur, et que
    proposer ne coûte rien (l'utilisateur tranche sur une carte : Lancer, Faire ici, Refuser) ;
  - quand proposer : plusieurs tâches indépendantes qui changent des fichiers différents, une tâche
    longue à suivre à part ;
  - quand ne pas proposer : lecture, question, petit correctif, tâches liées, mêmes fichiers ;
  - que ses propres sous-agents servent à lire et chercher, pas à mener un chantier à part ;
  - de finir son tour après avoir proposé.
- [x] Le bloc n'est envoyé qu'une fois par session ; jamais à une fille, ni hors d'un dépôt git, ni
      quand la famille d'outils « Conversations filles » est coupée (fiche 109).
- [x] **Réglage** Réglages › Conversation, sous le plafond des filles : « Proposer des
      conversations filles » : Jamais / Quand ça s'y prête (défaut) / Toujours demander, avec une
      phrase d'aide. Jamais : pas de bloc. Toujours : le bloc demande de toujours proposer des
      filles avant un travail en plusieurs parties. Trouvable par la recherche des réglages.
- [x] **Commande `/split`** : envoie le message tapé après elle, avec un bloc qui demande de le
      découper en conversations filles par `start_child` (une par chantier indépendant, chacune
      dans son worktree), puis de finir le tour. Listée dans l'aide des commandes. Sans
      `start_child` dans la session (pas de dépôt git, fille, outils coupés), un message clair et
      rien n'est envoyé.
- [x] La description de `start_child` ajoute que proposer est peu coûteux : l'utilisateur tranche
      sur une carte.
- [x] Testé contre l'agent factice : scénario `chantiers` (propose deux filles seulement s'il a
      reçu `<bobine_capabilities>` ou la demande de `/split`, sinon fait le travail lui-même).
      Suite e2e `filles` : réglage Jamais → pas de carte ; Quand ça s'y prête → carte « Tâches
      proposées » ; `/split` → carte. Captures claire, sombre, `--lang en`.
- [x] Essai réel (OpenCode, Bob si possible) : « Trois chantiers : la fenêtre À propos, les essais
      plus courts, la carte de sous-agent », sans autre consigne, avec et sans le bloc ; coût noté.

## Plan

**Partagé (`src/shared/children.ts`)** — fonctions pures, testées :

- `ChildProposals = 'never' | 'whenFitting' | 'always'` et `CHILD_PROPOSALS` ;
- `capabilitiesContext(proposals)` : le bloc `<bobine_capabilities>`, `undefined` pour `never` ;
- `CHILDREN_REQUEST` : le bloc de `/split` (`<child_conversations_request>`).

**Envoi une fois par session (`src/main/agent/agent-host.ts`)** — pas d'état hors de la session :

- nouvelle option `sessionContext(appTools)` : lue au premier message de chaque session ouverte
  (`applySession` arme un drapeau, le premier `prompt` le consomme). Les outils de l'app déclarés
  à la session (`appToolNames`) disent si `start_child` y est : c'est le seul critère, il couvre
  le rôle de mère, le dépôt git et la famille coupée sans recalcul ;
- `PromptOptions.askChildren` (et `QueuedMessage.askChildren`, pour la file d'attente) : le bloc
  de `/split`, joint juste avant le message. Le message affiché reste le texte tapé.
- `host-options.ts` : `sessionContext` = `capabilitiesContext(réglage)` si `start_child` est
  déclaré.

**Réglage** : `Preferences.childProposals` (`shared/preferences.ts`, `parsePreferences`, valeurs
par défaut), `SettingsStore.preferences()`, commentaire de `Settings` ; contrôle segmenté dans
`ConversationSettings.tsx` ; entrée de `settings-search.ts` ; textes `fr.json` / `en.json`.

**Commande `/split`** : `shared/app-commands.ts` (`APP_COMMANDS`), `renderer/app-commands.ts`
(action `send` avec `askChildren`), `useConversations.send`, preload `agent.prompt` et IPC
`agent:prompt` (4ᵉ argument `{ askChildren?: boolean }`, vérifié), `manager.prompt` (refus clair
sans `start_child`). Les noms des commandes de l'app ne sont pas traduits (fiche 039 : `clear`,
`review`…) : une seule commande, `/split`, comme demandé.

**Outil** : une phrase de plus dans `START_CHILD` (`mcp/children-tools.ts`).

**Agent factice** : scénario `chantiers` dans `mock-agent/scenarios.mts` ; `docs/mock-agent.md`.

**E2e** : `e2e/suites/split.mjs`, une troisième partie (dépôt git jetable, une conversation neuve
par essai, car le bloc ne part qu'au premier message de la session).

**Docs** : `docs/acp.md` (« Compatibilité Bob »), `docs/agents.md` si la matrice change,
`CHANGELOG.md` et `CHANGELOG.en.md`, index des fiches.

**Dépendances** : aucune.

## Journal

- 2026-10-22 — Fiche créée.
- 2026-10-22 — Implémenté comme prévu :
  - `capabilitiesContext`, `CHILDREN_REQUEST`, `ChildProposals` dans `shared/children.ts` ;
  - `AgentHost` : option `sessionContext`, drapeau armé par `applySession` et consommé par le
    premier `prompt` ; `PromptOptions.askChildren`, porté aussi par la file d'attente ;
  - réglage `childProposals` (préférences, Réglages › Conversation, recherche des réglages) ;
  - `/split` (commande de l'app, IPC `agent:prompt` avec un 4ᵉ argument vérifié, refus clair dans
    `ConversationManager.prompt` sans `start_child`) ; phrase ajoutée à la description de
    `start_child` ; scénario `chantiers`.
- **Écarts au plan** :
  - `agent-host.ts` était à 2 lignes de son plafond ESLint (1 050). La surveillance du silence de
    l'agent (fiche 080) est sortie dans `agent/silence-watch.ts`, sans changer son comportement ;
    le seuil ne bouge pas.
  - Le critère d'envoi est « la session a reçu `start_child` » (outils déclarés à la session), pas
    un recalcul du rôle : il couvre d'un coup le dépôt git, la fille et la famille coupée.
  - Le bloc de `/split` est du contexte invisible : le fil montre le message tapé, sans la
    commande. Un message mis en file avec `/split` s'affiche et revient à la zone de saisie
    (« Modifier ») avec `/split` devant ; il ne part pas avec un message ordinaire.
  - Les commandes de l'app ne sont pas traduites (fiche 039) : `/split` seulement, pas de
    `/children`. C'est la seule commande de l'app au nom français ; à revoir si l'on préfère un nom
    anglais comme les autres (`/children`).
- Tests : unitaires (`shared/children`, `preferences`, `message-queue`, `app-commands`, IPC,
  preload), hôte d'agent (bloc une fois par session et de nouveau après un redémarrage, `/split`
  y compris en file), gestionnaire réel avec le serveur MCP (`children.test.ts` : mère, fille,
  « Jamais », `/split`, refus dans une fille). E2e `filles` (troisième partie) et `commands`
  (13 commandes, dont 10 de l'app), clair et sombre ; captures `filles-11-reglage-propositions`,
  `filles-12-propositions-contexte`, `filles-13-commande-filles` regardées.
- 2026-10-22 — **Essai réel**. App de la branche, conduite par le port de débogage (script hors
  git). Clone jetable de Bobine (`main`, sans cette fiche), message exact : « Trois chantiers : la
  fenêtre À propos, les essais plus courts, la carte de sous-agent », sans autre consigne. Les
  propositions sont refusées au fil de l'eau : aucune fille ne démarre. Réglage « Jamais » = sans
  le bloc, « Quand ça s'y prête » = avec.

  | Agent, modèle | Bloc | Ce que fait l'agent | Coût |
  |---|---|---|---|
  | OpenCode 2.0.32, `openai/gpt-6.1-sol` | sans (1) | lit un fichier, demande des précisions | 0 $ (abonnement ChatGPT), 23 k jetons |
  | idem | sans (2), deux tours | tour 1 : se met au travail lui-même (32 lectures, 6 `patch`, `verify`, e2e), arrêté après 6 min ; tour 2 (précisions) : idem, arrêté après 6 min. **Jamais** `start_child` | 0 $, 1,3 M jetons (cache compris) |
  | idem | avec, 4 passages (2 sur un clone de la branche, 2 sur `main`) | 2 fois : **propose trois filles** (une par chantier, `start_child` par son outil `execute`) en ≈ 40 s, puis, refusées, demande des précisions pour les faire ici ; 2 fois : demande des précisions en ≈ 11 s (« je pourrai les proposer en conversations séparées si les modifications sont indépendantes ») | 0 $, 7 à 58 k jetons |
  | Bob 2.0.6 (modèle par défaut) | avec, 3 passages plafonnés (3 min, puis 1 min) | lit les fiches (sous-agents de lecture, comme le bloc le dit), écrit « ideal candidates for child conversations » puis demande des précisions par `ask_user` (« … je vais lancer trois branches ») ; avec les précisions, relance ses sous-agents d'enquête et n'a rien proposé dans les 3 min | ≈ 2,9 bobcoins au total (0,3 + 1,6 + 1,0) |

  Constat : sans le bloc, aucun des deux agents n'a envisagé de filles ; avec, les deux les
  envisagent d'eux-mêmes, et OpenCode les propose une fois sur deux. L'autre fois, il demande
  d'abord des précisions, ce que justifie un message aussi court. Bob n'est pas allé jusqu'à la
  proposition dans le temps de l'essai : essai plus long à refaire avec Bob (budget).
- **Correctif après l'essai** : chez Bob, le titre d'une tâche est le début du premier message. Avec
  le bloc placé avant le message, la tâche s'appelait « <bobine_capabilities> For context… ». Le
  bloc est maintenant joint **après** le message ; relevé chez Bob : la tâche reprend le titre
  « Trois chantiers : … ». L'agent factice ignore ce bloc final pour choisir son scénario.
- Reste : les tâches de l'essai restent dans l'historique de Bob (`~/.bob/db/bob.db`), sans dossier
  (clones supprimés). Le contexte d'une bascule (fiche 108) et les nouvelles des filles passent
  encore avant le message : même effet sur le titre chez Bob, hors de cette fiche.
- 2026-10-22 — La commande est renommée `/split` (décision de l'utilisateur) : toutes les commandes de
  l'app sont en anglais, `/filles` était la seule en français. Clés `appCommands.list.split` et
  `appCommands.splitEmpty` ; scénario `chantiers`, suites `filles` et `commands`, docs à jour.
