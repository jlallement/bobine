# 089 — Découper les plus gros fichiers

- **Statut** : fait (2026-10-20) — toutes les recommandations retenues, ADR-0016 ; lots 0 à 9
  faits (2 et 5 dans des sessions à part, fusionnés ici) ; reste au-dessus des seuils : `App`
  (décision 4) et trois onglets du panneau, exceptions écrites dans le code
- **Dépend de** : 087 (utilitaires dupliqués) et 088 (adaptateurs Bob / OpenCode), **fusionnées
  avant le premier commit de ce chantier**
- **Agents** : les deux — refactorisation interne, rien de propre à un agent (ce qui l'est passe
  dans les adaptateurs de la fiche 088)

## Pourquoi

L'audit qualité du 2026-10-20 juge la macro-architecture saine (couches respectées, main découpé
par domaine, dépendances injectées), mais quatre ou cinq fichiers sont devenus des objets-dieux :
chaque nouvelle fonction s'y ajoute, les relire coûte cher, et deux sessions qui y travaillent en
même temps se gênent. Ce plan propose comment les découper sans rien changer pour l'utilisateur.

## Quand, et comment lire ce plan

- **Après 087 puis 088.** Elles ont touché une trentaine de fichiers (087) et `agent-host.ts`,
  `profiles.ts`, `BlockerPanel.tsx` (088). Toutes deux sont reprises dans la branche de ce chantier
  (lot 0) ; rien n'a été découpé avant.
- Le code est désigné par **fichier et nom de méthode ou de fonction**, jamais par numéro de ligne.
  Les mesures ont été refaites après 087 et 088 (lot 0, commande dans « Mesures ») ; tous les noms
  cités existent toujours.
- Chaque cible donne : ce qui existe, 2 ou 3 façons de découper avec une recommandation, l'ordre
  des étapes, les risques et le filet de tests. Les décisions attendues sont regroupées à la fin
  (« Décisions »).

### Règles communes à toutes les étapes

- **Comportement inchangé** : pas de ligne dans `CHANGELOG.md`, captures e2e identiques.
- Un commit `refactor:` par extraction, `./scripts/verify` entre chaque ; les suites e2e listées
  pour la cible pendant le travail ; la suite complète avant chaque push.
- Pas de nouvelle dépendance. Les nouveaux modules suivent les modèles qui existent déjà
  (`pending-requests.ts`, `message-queue.ts`, `app-tools-bridge.ts` côté hôte ; `useThreadFind`,
  `useGitStatus`, `useFileDrop` côté renderer ; `quick-entry.ts`, `keep-awake.ts` testés avec des
  faux à la place d'Electron).
- Une extraction qui n'est pas couverte par un test unitaire commence par un **test de
  caractérisation** (il fige le comportement actuel), commité avant le déplacement.

## Mesures (2026-10-20, après 087 et 088)

Lignes hors blancs et commentaires (`max-lines` d'ESLint), sans les tests :

| Fichier | Lignes | Plus grosse fonction (lignes · complexité) |
|---|---|---|
| `renderer/src/components/SettingsDialog.tsx` | 1 313 | `Agents` 237 · `SettingsDialog` complexité 29 |
| `main/conversations/manager.ts` | 1 310 | aucune > 64 (`branch`) ; `onEvent` complexité 22 |
| `main/agent/agent-host.ts` | 1 046 | `doStart` 238 · 37 ; `openSession` 117 · 24 ; `prompt` 82 · 25 |
| `main/index.ts` | 982 | `start` 616 |
| `renderer/src/App.tsx` | 930 | `App` 814 · 116 |
| `renderer/src/components/Composer.tsx` | 618 | `Composer` 523 · 80 (dont une fonction fléchée · 37) |

Pour refaire la mesure :

```bash
npx eslint src --no-warn-ignored -f json -o /tmp/mesures.json --rule '{"max-lines-per-function":["warn",{"max":60,"skipBlankLines":true,"skipComments":true}],"complexity":["warn",{"max":10}],"max-lines":["warn",{"max":500,"skipBlankLines":true,"skipComments":true}]}'
```

À noter : le problème de `ConversationManager` n'est pas la taille de ses fonctions (toutes
courtes) mais leur nombre et leur mélange — une règle par fonction ne le verrait pas.

## Cible 1 — `ConversationManager` (`main/conversations/manager.ts`)

### Aujourd'hui

83 méthodes (57 publiques, 26 privées). L'interface `ConversationController` de `main/ipc.ts`
(un `Pick` du gestionnaire) en liste 46 ; `main/index.ts` en appelle d'autres directement
(`preferences` à sept endroits, `notificationsEnabled`, `shownIds`, `newConversationTarget`,
`checkAgent`, `startActive`, `stopAll`, `hasDraftSessions`, `dropDraftSessions`). Les blocs :

| Bloc | Méthodes | Lien avec les conversations |
|---|---|---|
| **Réglages** | `settingsView`, `preferences`, `setPreferences`, `setNewConversation`, `setCommands`, `setNotifications`, `notificationsEnabled`, `forgetTool`, `forgetWorkspace`, `setApiKey`, `removeApiKey` ; en privé `keyInfo`, `keyStore`, `remember`, `rememberTool`, `agentSeen`, `saveSettings` ; la moitié de `setControl` | `settingsView` lit la conversation active (agent, dossier, dépôt git) ; le reste ne lit que `this.settings` |
| **Agent hors conversation** | `checkAgent`, `agentSessions`, `subagentWork` (cache `subagentWorks`) ; `resumeSession` | lancent un agent à part ; seul `resumeSession` crée une conversation |
| **Branche et fichiers** | `branchPreview`, `branch`, `revertFile` ; `branchTitle`, `toPromptAttachment` | calculs sur le fil et le dossier, puis orchestration (brouillon, agent, envoi) |
| Agents vivants | `ensureLive`, `evict`, `retired`, `restart`, `discard`, `dropDraftSession(s)`, `hasDraftSessions`, `stopAll`, `startActive` | cœur du gestionnaire |
| Fils et écriture | `transcriptOf`, `releaseTranscripts`, `scheduleSave`, `flush`, `saveable`, `saveIndex`, `settled`, `loadedTranscripts`, `onEvent`, `touch` | cœur |
| Navigation, historique | `select`, `create`, `createInWorktree`, `open`, `release`, `shownIds`, `configure`, `worktreeStatus`, `rename`, `delete`, `setArchived`, `setPinned`, `search` | cœur |
| Relais (hôte, profil) | `respondPermission`, `respondElicitation`, `authenticate`, `retrySession`, `trustForSession`, `unqueue`, `sendNow`, `cancel`, `useApiKey`, `stepCommand` | une ligne chacune |

La conversation lit aussi les réglages : défauts d'une nouvelle conversation (`create`,
`ensureLive`), réglages mémorisés par agent (`ensureLive`, `setControl`), outils toujours
autorisés, version vue de l'agent (`rules`), dossiers récents (`agentSessions`). Les réglages sont
écrits par le même `HistoryWriter` que l'index et les fils.

### Façons de découper

- **A. Les réglages seulement.** Une classe `SettingsStore` (dans `main/settings.ts`, à côté de
  `loadSettings`, ou un nouveau `main/settings-store.ts`) tient `settings`, l'écrit par le
  `HistoryWriter` (injecté : un seul écrivain, ordre des écritures gardé) et prévient de ses
  changements. Le gestionnaire la reçoit dans ses options (ou la crée d'après `settingsFile` : les
  tests ne changent pas) et garde `settingsView`, qui assemble la conversation active et les
  réglages. Dans `ipc.ts`, un `SettingsController` prend les neuf méthodes de réglage.
- **B. A, puis les blocs peu liés en collaborateurs, façade gardée.** Après A : l'essai d'un agent
  et la liste de ses sessions dans `main/agent/agent-check.ts` (fonctions qui reçoivent profils,
  clés, PATH ; `resumeSession` reste au gestionnaire), le cache de `subagentWork` dans une petite
  classe, les calculs de branche et d'annulation dans `conversations/branching.ts` (fonctions sur
  le fil et le dossier : aperçu, fil hérité, contexte, issue d'une annulation et son avis).
  `ConversationManager` garde l'orchestration et son API publique.
- **C. Registre partagé et services.** Un `ConversationRegistry` (la `Map`, `get`, `summary`,
  `saveIndex`, `emitList`) partagé par des services (navigation, historique, agents vivants,
  branche) ; plus de façade, `ipc.ts` reçoit plusieurs contrôleurs. Le plus propre sur le papier,
  mais le plus gros diff, `manager.test.ts` à réécrire, et le registre que tout le monde touche
  risque de devenir le prochain objet-dieu.

**Recommandation : B**, en s'arrêtant là pour remesurer. A seul laisse ≈ 1 100 lignes ; C coûte
beaucoup pour un gain incertain. Ce qui reste (agents vivants, fils, navigation) forme le vrai
cœur du gestionnaire et peut rester ensemble.

### Étapes

1. **Tests de caractérisation des réglages** dans `manager.test.ts` : aujourd'hui seuls
   `forgetTool`, `setNewConversation` et `setControl` y sont testés ; `setPreferences`,
   `preferences` (valeurs par défaut), `setApiKey`, `removeApiKey`, `useApiKey`,
   `setNotifications`, `setCommands`, `forgetWorkspace`, `newConversationTarget` ne le sont que
   par `ipc.test.ts` (avec un faux gestionnaire) et les essais e2e. Vérifier aussi quand
   `onSettingsChanged` est appelé (et quand il ne l'est pas : `setNewConversation`,
   `forgetWorkspace`, `remember`), car `index.ts` y accroche thème, langue, raccourci, cookies.
2. `SettingsStore` extrait ; le gestionnaire délègue (API inchangée) ; `verify`.
3. `SettingsController` dans `ipc.ts` ; les méthodes de délégation retirées ; `ipc.test.ts` suit.
4. `agent-check.ts` (`checkAgent`, `agentSessions`) puis le cache de `subagentWork`.
5. `branching.ts` (`branchPreview`, la préparation de `branch`, `revertFile`), avec ses tests
   unitaires ; l'orchestration reste dans le gestionnaire.
6. Remesurer ; mettre `docs/architecture.md` à jour (ligne « Historique » et tableau des
   responsabilités).

### Risques

- Un `onSettingsChanged` oublié ou ajouté change le comportement en silence (thème, langue, menu,
  cookies du navigateur, veille). L'étape 1 le fige.
- Les réglages et l'index passent par le même `HistoryWriter` : en créer un second casserait
  l'ordre et la sûreté des écritures (fiche 041).
- Les setters rendent `AgentSettingsView` et le renderer s'en sert : garder la valeur rendue.
- `settingsView` dépend de la conversation active : ne pas la déplacer dans `SettingsStore` (ou
  lui passer l'active en argument), sinon un nouveau cycle apparaît.

### Filet de tests

`manager.test.ts` (42 essais, solide sur la navigation, l'historique, la branche, les sessions),
plus les tests de l'étape 1 ; `ipc.test.ts` ; `settings.test.ts`. E2E : `settings`, `touches`,
`auth`, `language`, `fun`, `user-commands`, `notifications`, `permissions` (« toujours
autoriser », fiche 042), `history`, `branch`, `changes`, `resume`, `diagnostic`, `subagents`,
`rules`, `parallel`, `restart`, `failures`.

## Cible 2 — `AgentHost` (`main/agent/agent-host.ts`)

### Aujourd'hui

1 046 lignes, 46 méthodes. `doStart` (238 lignes, complexité 37) fait tout le démarrage :
remise à zéro de l'état, contrôle du dossier, clés données à l'agent et masquées dans le journal,
`spawnAgent`, branchement du journal (fin de la sortie d'erreur, lignes d'`agents.log`, arrêt du
processus, `AcpLog`, flux « tap » qui notent l'activité), promesse `failed`, gestionnaire de
sortie du processus, connexion ACP avec **trois gestionnaires en ligne** (`requestPermission` :
outils de l'app accordés d'office et outils retenus ; `elicitation/create` : traduction du
formulaire ou de l'URL ; `session/update` : outils de l'app, commandes, sessions enfants, rejeu,
modes et options, sous-agents), puis `initialize` et la lecture des capacités. `openSession`
(117 lignes) enchaîne ouverture ou réouverture, rejeu, reprise d'une session perdue et réglages
initiaux.

La séquence d'abandon `this.child = undefined` / `this.connection = undefined` /
`connection.close()` / `killTree(child)` est recopiée dans le `catch` de `doStart`, deux fois dans
`openSession` (lecture seule) et dans `reopenAfterAction` ; `stop` et le gestionnaire de sortie
en ont chacun une variante.

**Depuis 088** : ce qui est propre à Bob et à OpenCode est dans des adaptateurs portés par le
profil (`agent/adapters.ts`, ADR-0015) ; `blockerFor`, `reportCost` et `routeChildUpdate` restent
dans l'hôte, désormais génériques, et peuvent suivre le découpage ci-dessous. L'option `bobDb`
de l'hôte a disparu.

### Façons de découper

- **A. Méthodes privées dans la même classe.** Une méthode `abandon(connection, child)` pour la
  séquence recopiée ; `doStart` coupé en `launch` (processus et journal), `connect` (client ACP,
  qui appelle `onPermissionRequest`, `onElicitation`, `onSessionUpdate`) et `initialize` ;
  `openSession` coupé en ouverture, reprise d'une session perdue, application de la session.
  Fichier aussi long, fonctions courtes.
- **B. A, plus des modules à part comme ceux qui existent.** `agent/agent-process.ts` : lancement
  et journal (rend le processus, les flux, `failed`, la fin de la sortie d'erreur) ; un routeur de
  `session/update` (`agent/session-updates.ts`) qui dit quoi faire d'une mise à jour (ignorer,
  commandes, sous-agent, mode, émettre), testable seul. `AgentHost` garde l'état et ses
  transitions.
- **C. Machine à états explicite** (table des transitions de statut). Réécriture d'un code
  sensible au temps (démarrages concurrents, arrêt pendant un `await`) ; risque fort pour Bob, qu'on
  ne peut pas essayer en développement.

**Recommandation : B**, dans l'ordre ci-dessous ; C écartée.

### Étapes

1. `abandon(connection, child)` à la place des copies (le plus petit pas, sans risque).
2. Gestionnaires ACP sortis de `doStart` en méthodes privées.
3. `agent-process.ts` (lancement, journal, `failed`) ; `session-list.ts` partage déjà `spawnAgent`
   et doit continuer de marcher.
4. Routeur de `session/update` dans son module, avec des tests unitaires par cas (écho de nos
   messages, rejeu après `session/load` comme Bob 2.0.6, commandes arrivées avant l'identifiant de
   session, sessions enfants).
5. `openSession` coupé ; `prompt` (82 lignes, complexité 25) seulement si c'est simple.

### Risques

- Les gardes `if (this.child !== child) return` après chaque `await` (arrêt pendant le démarrage)
  doivent toutes rester, au même endroit.
- `failed` doit exister, avec son `catch` vide, avant tout `await` (rejet non géré sinon) ; l'ordre
  des écouteurs `exit` (journal puis statut) compte.
- Règles du rejeu (`ignoreReplay`, `replaying`, écho de `user_message_chunk`) : subtiles, faites
  pour des agents réels ; le routeur doit les reprendre à l'identique.

### Filet de tests

`agent-host.test.ts` (68 essais contre l'agent factice), `session-list.test.ts`,
`pending-requests.test.ts`, `app-tools-bridge.test.ts`. E2E : `base`, `restart`, `failures`,
`auth`, `bob`, `subagents`, `permissions`, `questions`, `queue`, `resume`, `diagnostic`, `plan`,
`usage`. Après le dernier pas : `pnpm opencode-probe --offline`, et `pnpm bob-probe` si Bob est
installé sur la machine.

## Cible 3 — `start()` (`main/index.ts`)

### Aujourd'hui

`start` (616 lignes) crée tout à la suite : environnement du shell, serveur d'outils, navigateur,
autorisations retenues, serveurs de dev, simulateur, Android, terminaux, notifications, profils,
serveurs MCP, clés, veille, aperçu HTML, fenêtre rapide, menu, `ConversationManager` (avec un
`onSettingsChanged` qui règle cookies, veille, raccourci, thème, langue et menu), suivi de
l'attention, sortie de l'app (confirmation, signaux, sessions vides supprimées), installation,
puis `createHandlers` (≈ 250 lignes de branchements) et la fenêtre principale.

Trois références posées après coup contournent des dépendances circulaires :
- `manager.current` : le navigateur (`keepCookies`), les autorisations retenues (vue des
  réglages) et la veille lisent ce qui vit dans le gestionnaire, créé après eux ;
- `tracker.current` : le gestionnaire alimente le suivi de l'attention, qui a besoin du
  gestionnaire (`shownIds`, `state`, `notificationsEnabled`, `preferences`) ;
- `menu.refresh` : `onSettingsChanged` reconstruit le menu, défini plus bas.

Les deux causes : les réglages sont dans le gestionnaire (cible 1), et le gestionnaire envoie ses
évènements par des fonctions uniques passées à sa construction (`emit`, `emitList`) au lieu de
laisser s'abonner ceux qui en ont besoin.

### Façons de découper

- **A. Fonctions de construction par domaine**, références tardives gardées : appareils
  (simulateur, Android et leurs outils), panneaux (navigateur, terminaux, serveurs de dev), sortie
  de l'app (à côté de `quit-guard.ts`), effets d'un changement de réglage, assemblage des
  dépendances de `createHandlers`. Mécanique ; les cycles restent.
- **B. A, et les cycles cassés.** `SettingsStore` (cible 1) créé en premier : navigateur,
  autorisations, veille, raccourci, thème et langue le lisent directement ; `onSettingsChanged`
  devient un abonnement (`settings.onChange`) par effet. Le gestionnaire accepte des abonnés à
  ses évènements et à sa liste : le suivi de l'attention s'abonne une fois créé. Le menu devient
  un petit objet créé avant les abonnements.
- **C. Conteneur d'injection** (awilix, tsyringe…) : nouvelle dépendance, structurante, pour une
  seule racine de composition. Non justifié.

**Recommandation : B**, après les étapes 1 à 3 de la cible 1.

### Étapes

1. Sortie de l'app (`before-quit`, signaux, arrêt du Mac, sessions vides) dans une fonction
   testable avec des faux.
2. Assemblage des dépendances de `createHandlers` hors de `start`.
3. Appareils et panneaux dans leurs fonctions de construction.
4. `SettingsStore` créé en premier, abonnements : `manager.current` disparaît.
5. Abonnés du gestionnaire : `tracker.current` disparaît.
6. Menu en objet : `menu.refresh` disparaît.

### Risques

- `index.ts` importe Electron : **aucun test unitaire**, seulement les essais de bout en bout. Les
  fonctions extraites reçoivent Electron en paramètre pour devenir testables.
- Ordre d'initialisation : un abonné posé trop tard rate des évènements. Le commentaire actuel dit
  que le gestionnaire alimente le suivi « pendant sa construction » : vérifier ce qui est émis à
  ce moment (les avis attendent `startActive`) avant de passer aux abonnements.
- Le drapeau `quitting` et le menu natif ne se voient pas en e2e (mémoire « essayer à la vraie
  souris ») : un essai réel est nécessaire.

### Filet de tests

Suite e2e **complète** (tout passe par `start`), puis `pnpm package && pnpm e2e:packaged`. Essai
réel : lancement, menu macOS, raccourci de la fenêtre rapide changé, langue et thème changés à
chaud, quitter pendant un tour (confirmation).

## Cible 4 — `App()` (`renderer/src/App.tsx`)

### Aujourd'hui

`App` fait 814 lignes, complexité 116, avec 55 appels de hooks (21 `useState`, 9 `useCallback`,
8 `useEffect`, 5 `useRef`…). Elle tient, dans l'ordre : le panneau (état mémorisé, agrandi,
onglets ouverts et fermés, demande de l'agent, ⌃` du terminal, `closeTab`), les modifications
(`openChanges`), les liens de fichiers et l'aperçu (`openFileLink`, `openActiveLink`, `openRule`,
`openPreviewLink`), le travail des sous-agents, le plan annoté (`executePlan`), la branche
(`editMessage`), la vue côte à côte (`openBeside`, `closeBeside`), réglages / recherche /
reprise, la recherche dans le fil (⌘F, `pendingFind`), les commandes du menu (`runMenuCommand`,
complexité 24), le suivi du bas du fil (`measureBottom`, `onScroll`, `scrollToBottom`), les
commandes de l'app (`runAppCommand`), la zone de saisie (`ComposerInbox`, dépôt de fichiers), puis
≈ 330 lignes de JSX et cinq dialogues.

### Façons de découper

- **A. Hooks dédiés, `App` reste l'assembleur** : `usePanel` (panneau, onglets, agrandi,
  terminal), `useFileLinks` (liens, aperçu, règles), `useBeside`, `useThreadScroll`,
  `useMenuCommands` (abonnement unique) ; `runAppCommand` et le pas de `runMenuCommand` en
  fonctions pures (`app-commands.ts`) testables sans React.
- **B. A, plus des sous-composants** : la conversation (fil, barre de recherche, saisie), la zone
  de travail (conversation et panneau), un hôte des dialogues.
- **C. Un état global** (Zustand, ou un grand `useReducer` dans un contexte) : nouvelle dépendance
  ou nouveau flux de données ; trop pour ce besoin.

**Recommandation : A**, puis B pour les dialogues seulement si `App` dépasse encore ≈ 300 lignes.

### Étapes

1. Fonctions pures d'abord (`runAppCommand`, pas suivant / précédent de l'historique), avec tests.
2. `useThreadScroll`, puis `usePanel`, puis `useFileLinks` et `useBeside`, un commit chacun, avec
   des tests `renderHook` (Testing Library, déjà là).
3. `useMenuCommands` ; remesurer ; dialogues (B) si besoin.

### Risques

- **Ajustements pendant le rendu** (`maximizedFor`, `shownTab`, `closedTabs`, `seenRequest`,
  `pendingFind`) : ils doivent rester pendant le rendu dans le hook, pas passer dans un
  `useEffect` (rendu en trop, scintillement, captures qui changent).
- **Fonctions stables** pour les éléments mémoïsés du fil (fiche 047) : `openActiveLink`,
  `loadActiveSubagentWork`… doivent garder la même identité ; la suite `long-thread` le mesure.
- L'abonnement unique au menu (référence `menuHandler`) doit rester unique.

### Filet de tests

Faible aujourd'hui : pas de test d'`App`, renderer couvert à 41 %, `useConversations` à 11 %
(mesures de l'audit). Les tests des hooks extraits sont à écrire dans ce chantier. E2E : `panel`,
`base`, `links`, `parallel`, `history` (⌘K → ⌘F), `plan`, `branch`, `changes`, `git`,
`terminal` (⌃`), `settings`, `resume`, `commands` (`/model`, `/mode`…), `pinned-plan`, `quick`
(message repris dans la saisie), `attachments` (dépôt), `touches`, `long-thread` ; captures
claires et sombres regardées.

## Cible 5 — `Composer` (`renderer/src/components/Composer.tsx`)

### Aujourd'hui

`Composer` fait 523 lignes, complexité 80, et contient une fonction fléchée de complexité 37
(`onKeyDown`) : brouillon mémorisé, pièces jointes, menu des commandes « / » (`pickCommand`),
mentions `@` (curseur, recherche de fichiers, `pickEntry`), collage, ce qui arrive de la
conversation (fichiers déposés, message repris, suggestion de départ), annotation d'image,
extrait de terminal, hauteur automatique, envoi, raccourcis clavier, barre d'outils.

### Façons de découper

- **A. Hooks et une fonction pure** : `useSlashMenu`, `useMentions`, `useComposerInbox`,
  `useAutoHeight` ; les raccourcis dans `composer-keys.ts` (touche et état → action), testable.
- **B. A, plus la barre d'outils** en sous-composant.
- **C. Un seul `useComposer`** qui rend tout : déplace le problème sans le résoudre.

**Recommandation : A**, B si la barre d'outils reste longue.

### Étapes et risques

Raccourcis d'abord (fonction pure + tests), puis menus « / » et `@`, puis réception et hauteur.
Risques : composition IME (Entrée pendant une saisie japonaise), Maj+Tab qui change de mode, ordre
entre le menu ouvert et l'envoi ; la mise au point de `fresh` / `key` faite par `App`.

### Filet de tests

`Composer.test.tsx` (5 essais) à compléter ; E2E : `commands`, `user-commands`, `attachments`,
`mentions`, `queue`, `questions` (Maj+Tab), `quick`, `annotate`, `base`, `plan`, `touches`.

## Cible 6 — `SettingsDialog.tsx` et le dossier `components/`

### Aujourd'hui

`SettingsDialog.tsx` (1 313 lignes) contient 16 composants : `SettingsDialog`, `SearchResults`,
`Row`, `LanguageRow`, `General`, `SizeStepper`, `Conversation`, `Terminal`, `ApiKeyRow`,
`ClearBrowserDataRow`, `BackupRow`, `ReloadShellPath`, `Agents`, `AgentRow`, `Shortcuts`,
`About`. Des sections ont déjà leur fichier (`CommandsSettings.tsx`, `McpSettings.tsx`,
`DiagnosticsSettings.tsx`, `LogSettings.tsx`). `components/` compte 72 fichiers à plat ; 49
s'importent entre eux par `./`. Les essais e2e passent par `data-testid`, jamais par un chemin.

### Façons de découper

- **A. `components/settings/` seulement** : un fichier par section (`General`, `Conversation`,
  `Terminal`, `Agents` avec `AgentRow`, `ApiKeyRow`, `ReloadShellPath`, `About`, `Shortcuts`),
  les lignes communes (`Row`, `SizeStepper`, `LanguageRow`) ensemble, et les `*Settings.tsx`
  existants rangés là.
- **B. A, puis tout `components/` rangé par domaine** : `thread/` (fil, outils, Markdown, cartes),
  `composer/` (saisie, menus `/` et `@`, annotation), `panel/` (panneau et ses onglets),
  `settings/`, `sidebar/` (barre latérale, titre, menu de conversation), `dialogs/` (recherche,
  reprise, branche, installation), `common/` (menus, bordures d'erreur, logo).
- **C. Rien** : pas de déplacement, l'historique git reste simple.

**Recommandation : B**, mais le rangement complet en **un seul commit, à la toute fin**, quand
aucune autre branche n'est ouverte : il touche les imports de presque tous les composants et
entrerait en conflit avec n'importe quel travail en cours. `git log --follow` suit les fichiers
déplacés.

### Filet de tests

`SettingsDialog.test.tsx` (9 essais) ; typecheck (un import cassé ne compile pas) ; E2E :
`settings`, `auth`, `mcp`, `diagnostic`, `language`, `fun`, `user-commands`, `touches`, puis la
suite complète pour le rangement.

## Option — une règle ESLint de taille et de complexité

Le lint tourne avec `--max-warnings=0` : toute règle est bloquante. Ce qu'elle donnerait
aujourd'hui (hors tests, lignes sans blancs ni commentaires) :

| Seuil | Fonctions au-delà |
|---|---|
| `max-lines-per-function` 100 / 150 / 200 / 300 | 52 / 33 / 25 / 10 |
| `complexity` 15 / 20 / 25 / 40 | 64 / 38 / 17 / 6 |

Une partie des longues fonctions sont des **tables** : `createTools` des outils du navigateur, du
simulateur, d'Android et des serveurs de dev, `createHandlers` (`ipc.ts`), `createApi`
(`preload/api.ts`), l'agent factice. Leur longueur est une liste de déclarations, pas une
complexité : les découper serait artificiel. De même, les grands `switch` (`reduceTranscript`,
`applyUpdateItems`, `reducer` de `useConversations`, `parsePreferences`) ont une complexité
élevée mais lisible.

- **A. Pas de règle** : on remesure à chaque audit avec la commande ci-dessus.
- **B. `complexity` seule**, seuil 40 : après ce chantier, restent `SimulatorTab` (60),
  `reduceTranscript` (53), `AndroidTab` (43) et une fonction de `shared/launch.ts` (42), chacune
  avec un `eslint-disable-next-line complexity -- raison` ; puis on descend le seuil.
- **C. Trois règles, en cliquet**, posées à la fin du chantier : `complexity` 40 ;
  `max-lines-per-function` 300 (sans blancs ni commentaires), coupée pour les tables
  (`src/main/**/*-tools.ts`, `src/main/ipc.ts`, `src/preload/api.ts`) ; exceptions justifiées pour
  `AndroidTab`, `ChangesTab`, `SimulatorTab` ; `max-lines` 800 par fichier, le seul garde-fou qui
  aurait vu `ConversationManager` (seuil à confirmer par la mesure de fin). Tests, agent factice
  et fichiers générés exclus. Chaque seuil baisse quand un fichier est assaini.

**Recommandation : C**, en dernier : les seuils sont ceux que le code atteint après le chantier,
pas un objectif qui obligerait à des dizaines d'exceptions. La règle sert à empêcher de nouveaux
objets-dieux, pas à mesurer la qualité.

## Décisions

| N° | Question | Options | Recommandation |
|---|---|---|---|
| 1 | `ConversationManager` | A réglages / B réglages + collaborateurs / C registre et services | **B** |
| 2 | `AgentHost` | A méthodes privées / B + modules / C machine à états | **B** |
| 3 | `start()` | A fonctions par domaine / B + cycles cassés / C conteneur | **B** (après 1) |
| 4 | `App()` | A hooks / B + sous-composants / C état global | **A**, B pour les dialogues si besoin |
| 5 | `Composer` | A hooks + fonction pure / B + barre d'outils / C hook unique | **A** |
| 6 | Réglages et `components/` | A `settings/` / B + rangement par domaine / C rien | **B**, rangement en dernier |
| 7 | Règle ESLint | A aucune / B `complexity` / C trois règles en cliquet | **C**, à la fin |

**Décision de l'utilisateur (2026-10-20)** : toutes les recommandations sont retenues (1 B, 2 B,
3 B, 4 A, 5 A, 6 B, 7 C). 1 B et 3 B font l'objet de
[ADR-0016](../adr/0016-reglages-hors-gestionnaire-composition-par-abonnements.md) (réglages hors
du gestionnaire ; démarrage du main par abonnements, sans références posées après coup). Le reste
ne demande pas d'ADR : pas de dépendance, pas de changement de protocole ni des couches. (088 a pris
l'ADR-0015.)

## Critères d'acceptation

- [x] Décisions de l'utilisateur notées ci-dessus ; ADR-0016 écrit (1 B, 3 B).
- [x] Rien ne change pour l'utilisateur : suite e2e complète verte à la fin (42 suites, clair et
  sombre, 922 essais), captures regardées, essai réel de l'app packagée (menu, réglages à chaud,
  sortie) ; pas de ligne dans le CHANGELOG. Non vu en réel : la boîte native « Un agent travaille
  encore » (voir le journal du lot 3).
- [x] Les réglages ne sont plus dans `ConversationManager` ; `ConversationController` ne contient
  plus de méthode de réglage (lot 1 ; il garde `settingsView`, qui rapporte les réglages à la
  conversation active, et `useApiKey`, qui relance l'agent de la conversation).
- [x] `main/index.ts` n'a plus `manager.current`, `tracker.current` ni `menu.refresh` (lot 3).
- [x] `doStart` (52 lignes · 9) et `Composer` (286 · 22) sous les seuils retenus, la séquence
  d'abandon de l'hôte n'existe plus qu'à un endroit ; **sauf `App`** (484 · 77), resté au-dessus
  par la décision 4 (hooks, puis seulement les dialogues) : exception écrite à côté de la fonction.
- [x] Chaque module extrait a ses tests unitaires (réglages, routeur de `session/update`,
  commandes de l'app, raccourcis de la saisie, hooks du renderer) ; seul `useTextareaLayout`
  (hauteur de la zone de saisie) n'en a pas : jsdom ne mesure rien, les e2e le couvrent.
- [x] `docs/architecture.md` à jour (responsabilités, tableau d'état).
- [x] Règle ESLint posée (option C), seuils d'après la mesure de fin ; rappelée dans `AGENTS.md`.

## Plan

Ordre proposé, un lot = une branche ; les lots qui touchent des fichiers différents peuvent
avancer dans des sessions parallèles, les autres sont fusionnés l'un après l'autre.

| Lot | Contenu | Après | Ordre de grandeur |
|---|---|---|---|
| 0 | Fusion de 087 puis 088 ; remesurer ; corriger les noms de cette fiche — **fait** | — | — |
| 1 | Cible 1, étapes 1 à 3 (réglages) — **fait** | 0 | ½ à 1 jour |
| 2 | Cible 2 (`AgentHost`) — **fait** | 0 | 1 jour |
| 3 | Cible 3 (`start()`) — **fait** | 1 | 1 jour |
| 4 | Cible 1, étapes 4 à 6 (agent hors conversation, branche) — **fait** | 1 | ½ jour |
| 5 | Cible 4 (`App`) — **fait** | 0 | 1 jour |
| 6 | Cible 5 (`Composer`) — **fait** | 0 | ½ jour |
| 7 | Cible 6 : `components/settings/` — **fait** | 0 | ½ jour |
| 8 | Cible 6 : rangement de `components/` par domaine, seul, aucune autre branche ouverte — **fait** | 5, 6, 7 | ½ jour |
| 9 | Règle ESLint (si retenue), seuils = mesure de fin — **fait** | tous | ¼ jour |

Côté main (1, 3, 4), hôte de l'agent (2) et renderer (5, 6, 7) touchent des fichiers distincts :
trois sessions peuvent avancer en même temps. Fichiers touchés : ceux nommés dans chaque cible,
leurs tests, `docs/architecture.md`, cette fiche. Aucune nouvelle dépendance.

## Journal

- **2026-10-20** — Plan rédigé (session parallèle à 087 et 088) d'après l'audit qualité du jour et
  une lecture des six fichiers ; mesures prises avec ESLint sur `main` (`96ee140`). Constats en
  plus de l'audit : `ConversationManager` compte 83 méthodes (et non ≈ 70) mais aucune longue —
  c'est un problème de cohésion ; ses méthodes de réglage n'ont presque pas de tests unitaires
  (tests de caractérisation à écrire d'abord) ; la séquence d'abandon de l'hôte est recopiée
  quatre fois (`doStart`, deux fois `openSession`, `reopenAfterAction`). En attente de la
  décision de l'utilisateur.
- **2026-10-20** — L'utilisateur retient toutes les recommandations (1 B, 2 B, 3 B, 4 A, 5 A,
  6 B, 7 C). ADR écrit. Prochaine étape : lot 0, une fois 087 puis 088 fusionnées.
- **2026-10-20** — 087 fusionnée dans `main` et reprise ici ; 088 a pris le numéro 0015, l'ADR
  de ce chantier devient l'ADR-0016. Le lot 0 attend la fusion de 088.
- **2026-10-20** — **Lot 0 fait.** 088 n'était pas encore dans `main` : à la demande de
  l'utilisateur, sa branche (`claude/fervent-lederberg-cbffa7`, avec `main` déjà fusionné) est
  fusionnée ici ; quand 088 arrivera dans `main`, ce seront les mêmes commits. Mesures refaites :
  quasi inchangées (quelques lignes de moins ou de plus), tous les noms cités existent toujours ;
  côté hôte, l'option `bobDb` a disparu et `blockerFor`, `reportCost`, `routeChildUpdate` sont
  devenus génériques. La séquence d'abandon de l'hôte est toujours recopiée quatre fois.
  `eslint.config.mjs` porte désormais `no-duplicate-imports` (087) et les blocs de 088 : la règle
  du lot 9 s'y ajoutera. Prochains lots possibles en parallèle : 1 (réglages), 2 (`AgentHost`),
  5 (`App`) ; 6 et 7 ensuite côté renderer.
- **2026-10-20** — **Lot 1 fait** (réglages hors du gestionnaire, cible 1 étapes 1 à 3) :
  - tests de caractérisation d'abord (`manager.test.ts`, bloc « réglages » : préférences,
    notifications, commandes « / », dossiers récents, nouvelle conversation, outils oubliés, clés
    d'API, annonces des agents, réglages de session, et quand `onSettingsChanged` est appelé) ;
  - `main/settings-store.ts` (`SettingsStore`, 181 lignes, tests dans `settings-store.test.ts`) :
    il tient les réglages, les fait écrire par le `HistoryWriter` du gestionnaire (fonction `save`
    injectée) et prévient ses abonnés (`onChange`) pour les mêmes changements qu'avant ; le
    gestionnaire le crée s'il ne le reçoit pas (option `settings`, prévue pour le lot 3) et y
    branche `onSettingsChanged` ;
  - `ipc.ts` : `SettingsController` (huit méthodes) ; les handlers `settings:*` changent les
    réglages puis rendent `settingsView` du gestionnaire. `index.ts` lit les préférences par
    `conversations.settings` en attendant le lot 3.
  - Écart : `setNewConversation` ne passe plus l'agent demandé à `profileOrDefault`, qui ne pouvait
    pas échouer (il retombe sur un autre agent) ; rien ne change pour l'utilisateur.
  - Mesures : `manager.ts` 1 310 → 1 170 lignes, 83 → 67 méthodes ; `ConversationController`
    46 → 38 méthodes.
  - Vérifié : `./scripts/verify` ; e2e `settings touches auth language fun user-commands
    notifications permissions quick diagnostic`, clair et sombre (227 essais), captures regardées.
    La suite complète tournera avant le push.
- **2026-10-20** — **Lot 4 fait** (cible 1, étapes 4 à 6) :
  - `main/agent/agent-check.ts` : `checkAgent` (diagnostic) et `unknownSessions` (« Reprendre une
    session… »), qui ne reçoivent que le profil, les clés, le PATH et les dossiers connus ; le
    gestionnaire garde `resumeSession` et un `profileById` commun aux trois ;
  - `main/agent/subagent-works.ts` : le cache du travail des sous-agents rejoué, avec ses tests ;
  - `conversations/branching.ts` : aperçu d'une branche, préparation (fil hérité, contexte,
    titre, fichiers remis) et annulation d'une modification (issue et avis), avec leurs tests ; le
    gestionnaire garde l'orchestration (brouillon, agent, envoi, avis dans le fil).
  - Écart évité : les méthodes déplacées restent `async`, pour qu'une erreur (agent inconnu) arrive
    toujours en promesse rejetée ; les tests du gestionnaire l'ont vu.
  - Mesures : `manager.ts` 1 170 → 1 020 lignes (1 310 avant le lot 1), 68 méthodes.
  - Vérifié : `./scripts/verify` ; e2e `branch changes resume diagnostic subagents history
    parallel`, clair et sombre (159 essais), captures regardées.
- **2026-10-20** — **Lot 3 fait** (cible 3, `start()` de `main/index.ts`, ADR-0016) :
  - étape 1 : `QuitFlow` (`quit-guard.ts`) — confirmation si un agent travaille, sessions des
    conversations vides supprimées une fois, arrêt de tout, relance sur demande ; testé avec des
    faux ;
  - étapes 2-3 : `setupSimulator`, `setupAndroid`, `setupBrowser` (gestionnaire, outils de
    l'agent, contrôleur IPC ; contrôleurs testés avec des faux), un seul `send` muet pendant la
    fermeture (type `SendEvent` dans `ipc.ts`) ; installation : `nodeInstallerIo` et
    `refusalMarker` dans `self-install.ts` ;
  - étapes 4 à 6 : historique (`ConversationStore`, `HistoryWriter`) et `SettingsStore` ouverts
    d'abord et passés au gestionnaire (options `history`, `settings`) ; abonnements
    (`ConversationManager.subscribe`, `SettingsStore.onChange`, `ApprovalStore.onChange`,
    `HistoryWriter.onFailure` / `onIdle`) posés dans le même ordre d'appel qu'avant (le suivi de
    l'attention voit un évènement avant les fenêtres, une nouvelle liste après elles) ; le menu est
    une simple fonction `refreshMenu` créée avant ses abonnés. `manager.current`,
    `tracker.current` et `menu.refresh` ont disparu.
  - Écarts : `emit` / `emitList` du gestionnaire deviennent facultatifs (on peut s'abonner) ;
    l'option `onSettingsChanged` reste pour les tests mais `index.ts` ne s'en sert plus. Rien
    n'est émis entre la construction du gestionnaire et les abonnements (vérifié : les avis
    attendent `startActive`, aucune écriture avant).
  - Mesures : `index.ts` 982 → 846 lignes ; `start()` 616 → 478 lignes. Le reste de `start()` est
    surtout l'assemblage des dépendances de `createHandlers` : c'est la racine de composition, à
    traiter comme une table dans la règle ESLint du lot 9 (exception), plutôt que la découper
    artificiellement.
  - Vérifié : `./scripts/verify` ; suite e2e **complète** (42 suites, clair et sombre, 922
    essais) sur le build d'avant le dernier commit (installation), puis `pnpm package --dir &&
    pnpm e2e:packaged` sur le build final ; essai réel sur la copie packagée (dossier de données
    jetable, Bob en attente d'approbation, aucune session ouverte chez lui) : menu macOS présent,
    thème Clair et langue English appliqués à chaud, menu reconstruit en anglais, réglages
    enregistrés, sortie par l'évènement « quit » propre (agent arrêté, code 0) ; arrêt par SIGTERM
    sans question sur une instance de développement. Pas vu en réel : la boîte native « Un agent
    travaille encore » (la copie packagée n'a pas l'agent factice, et l'instance de développement
    de l'utilisateur, ouverte, partage l'identifiant d'Electron : je n'y ai pas touché) ; elle
    reste couverte par `QuitFlow` (tests) et la suite e2e `touches`.
- **2026-10-20** — **Lot 2 fait** (cible 2, `AgentHost`, option B), branche
  `claude/objective-haibt-ca1162`, non poussée. Un commit par étape, `./scripts/verify` vert entre
  chaque : `abandon()` (la séquence d'abandon n'existe plus qu'à un endroit ; `stop` et la sortie
  du processus gardent leur variante) ; gestionnaires ACP en méthodes (`onPermissionRequest`,
  `onElicitation`, `onSessionUpdate`) ; `agent/agent-process.ts` (`launchAgent` : processus, fin
  de la sortie d'erreur, `agents.log`, arrêt dans `main.log`, `AcpLog`, flux « tap », `failed` ;
  `spawnAgent` y déménage depuis `process-utils.ts`, `session-list.ts` l'importe de là), 5 tests ;
  `agent/session-updates.ts` (`routeUpdate`, pur), 9 tests (écho de nos messages pendant un tour,
  rejeu après `session/load` comme Bob 2.0.6, commandes avant l'identifiant de session, sessions
  enfants, `ignoreReplay`, sous-agents relayés) ; `openSession` coupé (`newSessionRequest`,
  `reopenRequest`, `recoverLostSession`, `applySession`) et `prompt` allégé de parties synchrones
  (`currentMode`, `turnFailed`, `afterTurn`).
  **Écarts au plan** : une étape de plus, `doStart` coupé (`onAgentExit`, `connect`,
  `initializeRequest`, `readAnnouncement` : l'option A, comprise dans B) ; un commit `test:` corrige
  une course dans les nouveaux tests (écoute de `close` posée trop tard). Les méthodes qui font une
  requête (`initialize`, `session/new`, `load`, `resume`) rendent sa promesse sans l'attendre :
  l'`await` reste dans `doStart` et `openSession`, et le rejeu se termine au même tour de
  microtâche qu'avant. Gardes `this.child !== child` : 8 avant, 8 après, aux mêmes moments ;
  `failed` est créée avec son `catch` dans `launchAgent`, synchrone, avant tout `await` ; ordre des
  écouteurs `exit` gardé (journal, `failed`, puis statut). Deux différences, dans le journal
  seulement et dans une course rare (un agent arrêté qui sort après que l'hôte en a lancé un
  autre) : la fin de sa sortie d'erreur ne se mêle plus à celle du nouvel agent, et ses morceaux
  de texte regroupés sont écrits avec lui au lieu de vider ceux du nouveau. Un tour de microtâche de
  plus entre la reprise d'une session perdue et la fin du rejeu, sans effet (aucune session connue
  à ce moment-là).
  **Mesures après** : `doStart` 52 lignes · complexité 9 (238 · 37 avant), `openSession` 38 · 12
  (117 · 24), `prompt` 62 · 13 (82 · 25). Le fichier reste à 1 035 lignes : les fonctions
  raccourcissent, pas le fichier (ce qui part dans les modules revient en signatures et
  commentaires). Plus complexes restantes : `readAnnouncement` 25 (lecture des capacités, une suite
  de `?.`), `routeUpdate` 15, `onSessionUpdate` 13, `blockerFor` et `authenticate` 12.
  **Vérifié** : `agent-host.test.ts` (68 essais) inchangé et vert ; e2e `base restart failures auth
  bob subagents permissions questions queue resume diagnostic plan usage`, clair et sombre, 260
  vérifications vertes, captures regardées ; `pnpm bob-probe` (Bob 2.0.6) vert.
  `pnpm opencode-probe --offline` **ne démarre pas, sur `main` aussi** : depuis 087,
  `agent-config/rules.ts` importe `../agent/process-utils` sans extension, ce que Node seul ne
  résout pas (la sonde charge `rules.ts` sans bundler). Avec ce seul import remplacé localement (non
  commité), la sonde est verte (OpenCode 2.0.32, réponses identiques). À corriger à part : la sonde
  n'importe aucun module de ce lot.
- **2026-10-20** — **Lot 5 fait** (cible 4, `App`, option A puis B pour les dialogues seulement),
  un commit `refactor:` par étape, `verify` vert entre chaque. Fonctions pures dans
  `renderer/app-commands.ts` (`appCommandActions` rend ce que fait une commande « / » de l'app,
  `applyAppCommand` le fait ; `stepConversation`, pas du menu). Hooks : `useThreadScroll`,
  `usePanel`, `useFileLinks` (avec `useConversationScope`), `useBeside`, `useMenuCommands` ; puis,
  `App` dépassant encore 300 lignes, l'hôte des dialogues `components/AppDialogs.tsx`
  (`useAppDialogs` et `AppDialogs` : réglages, recherche, reprise, suppression, branche). 61
  essais unitaires ajoutés (`renderHook` pour les hooks, Testing Library pour les dialogues).
  **Mesures** : `App` passe de 814 lignes · complexité 116 à **484 · 77**, `App.tsx` de 930 à 553
  lignes. Ce qui reste : le JSX (en-tête, accueil, fil, panneau, ≈ 300 lignes), les props de
  `Composer` (≈ 60), le plan annoté, la branche d'un message et ⌘F ; aller plus bas demanderait
  l'option B complète (sous-composants conversation et zone de travail), non retenue. Nouveaux
  modules : `usePanel` 121 lignes · 24, `appCommandActions` complexité 20, `AppDialogs` 77 · 12,
  les autres sous 60 · 10. Les ajustements pendant le rendu (`maximizedFor`, `shownTab`,
  `closedTabs`, `seenRequest` dans `usePanel` ; `pendingFind` dans `App`) restent pendant le
  rendu ; `openActiveLink`, `loadActiveSubagentWork` et les fonctions de la conversation d'à côté
  gardent les mêmes dépendances (donc la même identité) ; un seul abonnement au menu.
  **Écarts au plan** : (1) le document en aperçu est tenu par `usePanel`, pas par `useFileLinks` :
  c'est un onglet du panneau (`closeTab('document')` le vide, il décide si l'onglet existe), et
  sinon les deux hooks dépendaient l'un de l'autre ; `useFileLinks` l'ouvre par `showDocument`.
  (2) `useConversationScope` donne à une conversation affichée ses liens et le travail de ses
  sous-agents : l'active et celle d'à côté s'en servent (deux paires de fonctions recopiées en
  moins). (3) `runMenuCommand` devient une table `Record<MenuCommand, () => void>` donnée à
  `useMenuCommands` : le typage refuse une commande oubliée ; une commande inconnue ne fait
  toujours rien. (4) `PANEL_MIN_WIDTH` passe de `SidePanel.tsx` à `panel-tabs.ts` pour que
  `usePanel` ne charge pas les composants du panneau (xterm…). (5) `useConversations.ts` exporte
  les types `Conversation` et `Conversations`. **À savoir pour la suite** : l'import de
  `SettingsDialog` est maintenant dans `AppDialogs.tsx` (le lot 7 devra l'y suivre) ;
  `AppDialogs.tsx` ira avec les dialogues au lot 8.
  **E2E** (`panel base links parallel history plan branch changes git terminal settings resume
  commands pinned-plan quick attachments touches long-thread`, clair et sombre) : premier passage,
  1 échec dans `base` clair (sous-menu « Modèle » de « Réglages de la session » refermé avant le
  clic : le menu avait bougé, instabilité de timing déjà décrite à la fiche 056, machine chargée
  par d'autres sessions) ; `base` rejouée 3 fois, verte ; second passage complet vert (231 s).
  Captures comparées pixel à pixel à une série prise avant le lot : 104 sur 132 diffèrent, mais
  105 diffèrent aussi entre deux passages du même build (heures, noms horodatés, texte du scénario
  « lent », survol, pastilles d'attention et cloche selon le focus et l'état des notifications de
  macOS) ; les 3 qui ne diffèrent qu'avant / après (décalage d'une fraction de pixel du texte, une
  image de l'animation du logo) et celles du panneau, de l'aperçu, du terminal, du côte à côte et
  des dialogues ont été regardées : aucune différence d'interface. Suite complète (`pnpm e2e`) non
  jouée : elle tourne avant le push du chantier.
- **2026-10-20** — Lots 2 et 5 fusionnés ici (branches `claude/objective-haibt-ca1162` et
  `claude/amazing-kowalevski-468c43`, à la demande de l'utilisateur) ; conflits de doc seulement,
  toutes les entrées gardées. Suite e2e complète verte sur l'ensemble (922 essais).
- **2026-10-20** — **Lot 6 fait** (cible 5, `Composer`, option A puis B pour la barre) :
  `composer-keys.ts` (ce que fait une touche selon les menus, l'agent et le texte ; mode suivant),
  `composer-view.ts` (ce que la saisie tire de l'état de l'agent), `useCommandMenu`, `useMentions`,
  `useComposerInbox` (boîte de la conversation et extraits du terminal), `useTextareaLayout`
  (hauteur, curseur ; il détient la référence de la zone, la règle `react-hooks` refusant qu'un
  hook modifie un ref reçu), composants `ComposerBar` et `ComposerAttachments`, `ReadOnlyBanner`
  et le choix de l'invite hors du composant. `Composer` : 523 lignes · 80 → 286 · 22. Tests :
  touches, état, menus, boîte.
- **2026-10-20** — **Lot 7 fait** (cible 6, réglages) : `SettingsDialog.tsx` découpé par section
  (`GeneralSettings`, `ConversationSettings`, `TerminalSettings`, `AgentsSettings`,
  `ShortcutsSettings`, `AboutSettings`, lignes communes dans `rows.tsx`), rangé avec
  `McpSettings`, `CommandsSettings`, `DiagnosticsSettings`, `LogSettings` dans
  `components/settings/`. Découpage fait par script (blocs et commentaires gardés, imports élagués),
  aucun code changé hors des noms des sections. E2E des lots 6 et 7 : 17 suites, clair et sombre,
  387 essais.
- **2026-10-20** — **Lot 8 fait** : `components/` rangé en `thread/`, `composer/`, `panel/`,
  `settings/`, `sidebar/`, `dialogs/`, `common/` (70 fichiers, `git mv`, imports relatifs
  réécrits par script, mocks des tests compris) ; placement des éléments partagés : `BesidePane`
  et `DiffView` dans `thread/`, `ImageAnnotator`, `DropOverlay` et `QuickEntry` dans `composer/`,
  `Menus`, `CopyButton`, `CodeText`, `SpoolMark` dans `common/`. `docs/architecture.md` décrit le
  rangement.
- **2026-10-20** — **Lot 9 fait** (option C) : `complexity` 40, `max-lines-per-function` 300,
  `max-lines` 800 sur `src/` (tests, agent factice, types générés à part). Tables sans limite de
  longueur de fonction (`*-tools.ts`, `ipc.ts`, `preload/api.ts`) ; `agent-host.ts` et
  `manager.ts` plafonnés à 1 050 lignes, `index.ts` à 850. Exceptions écrites à côté de la
  fonction : `start` (racine de composition), `App` (décision 4), `AndroidTab`, `ChangesTab`,
  `SimulatorTab` (pas encore découpés), `reduceTranscript` et une validation de `launch.ts` (longs
  `switch` lisibles). `AGENTS.md` le rappelle.
- **2026-10-20** — **Fiche close.** `Composer` : état dérivé sorti dans `composer-view.ts`
  (complexité 47 → 22, sous le seuil). Suite e2e complète sur le dernier commit : 42 suites, clair
  et sombre, 922 essais, verte ; captures de la saisie et des réglages regardées. Bilan :
  `manager.ts` 1 310 → 1 035 lignes (83 → 68 méthodes, réglages, essai d'agent et branche sortis),
  `agent-host.ts` `doStart` 238 → 52, `index.ts` `start` 616 → 478 sans références posées après
  coup, `App` 814 → 484, `Composer` 523 → 286, `SettingsDialog.tsx` 1 313 → 8 fichiers. À noter
  pour plus tard : `pnpm opencode-probe --offline` ne démarre plus depuis 087 (import sans extension
  dans `agent-config/rules.ts`, vu au lot 2) ; `AndroidTab`, `ChangesTab`, `SimulatorTab` et `App`
  sont les prochains à découper.
- **2026-10-20** — Sonde d'OpenCode réparée (cassée par 087, vu au lot 2) : `isDirectory` vit dans
  `main/is-directory.ts`, sans alias ni import de valeur hors de Node, réexporté par
  `process-utils.ts` ; `agent-config/rules.ts` l'importe avec son extension, comme les autres modules
  chargés par la sonde. `pnpm opencode-probe --offline` repasse (réponses identiques à OpenCode
  2.0.32).
