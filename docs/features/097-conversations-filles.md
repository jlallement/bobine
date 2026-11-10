# 097 — Conversations filles : lancer en parallèle, compte rendu, et outils pour l'agent

- **Statut** : fait
- **Dépend de** : 020 (file d'attente), 023 (branches), 029 (outils de l'app), 030 (cartes
  d'accord), 036 (worktrees), 095 (liste imbriquée) — décision : ADR-0019, plafond : ADR-0020
- **Agents** : les deux. Tout passe par l'ACP et le serveur MCP `bobine`, que Bob et OpenCode
  reçoivent déjà ; aucun code propre à un agent (ADR-0011).

## Pourquoi

Pour mener plusieurs chantiers en parallèle, il faut aujourd'hui ouvrir des conversations en
worktree, puis faire le facteur entre elles à la main. On veut qu'une conversation (la mère) puisse
avoir des filles :

- chacune dans son worktree ;
- rangées sous elle dans la liste ;
- qui lui rendent compte quand elles ont fini.

D'abord lancées par l'utilisateur (étape 1), ensuite par l'agent lui-même (étape 2).

Ce n'est pas un sous-agent : un sous-agent est une aide interne de l'agent, dans la même
conversation et le même dossier, qu'on ne peut ni ouvrir ni guider. Une fille est une vraie
conversation (voir ADR-0019).

## Maquettes

Captures hors git, dans `e2e/captures/` :

- `m099-sous-taches-{dark,light}.png` : les filles sous leur mère avec leur état (en cours, finie
  non lue), la carte « Sous-tâches » dans le fil de la mère, le compte rendu d'une fille finie.
- `m100-concepts-{dark,light}.png` : tâches, sous-agent, branche, worktree et fille, côte à côte.

**Vocabulaire de l'interface** : « conversation fille » dans les textes. La carte du fil s'appelle
« Sous-tâches ». « Lancer en parallèle… » est le geste. On n'emploie pas « sous-agent », qui reste
réservé aux sous-agents des agents.

## Critères d'acceptation

### Étape 1 — lancée par l'utilisateur

- [x] Une conversation a « Lancer en parallèle… » (menu « … » du titre et de la liste). La fenêtre
      demande une consigne. L'agent et le modèle sont par défaut ceux de la mère et restent
      modifiables.
- [x] La fille démarre dans un nouveau worktree créé depuis le dossier de la mère (branche
      `bobine/…`), avec la consigne comme premier message. Hors dépôt git, le geste est désactivé
      et une infobulle dit pourquoi.
- [x] Dans la liste, la fille est sous sa mère, en retrait, avec son état : en cours, attend un
      accord, finie non lue, erreur. Elle reprend le rendu des branches de la fiche 095, avec ses
      icônes.
- [x] Le fil de la mère a une carte « Sous-tâches » : une ligne par fille, avec son état, sa
      branche, ses fichiers (+/−) et « Ouvrir ».
- [x] À chaque fin de tour d'une fille, la mère reçoit un compte rendu dans son fil : titre, état,
      fichiers modifiés, branche, et les dernières lignes de sa réponse.
- [x] Ce compte rendu part à l'agent de la mère avec le prochain message de l'utilisateur. Il n'y a
      pas de réveil automatique à l'étape 1.
- [x] Une mère archivée ou supprimée laisse ses filles en conversations ordinaires, avec leur
      icône, et le lien vers la mère disparaît.

### Étape 2 — lancée par l'agent

- [x] Le serveur `bobine` propose `start_child`, `message_child` et `child_status` à une mère, et
      seulement `message_parent` à une fille. Les descriptions sont en anglais (ADR-0014) et disent
      quand s'en servir, et quand ne pas s'en servir.
- [x] `start_child` (titre, consigne) demande l'accord de l'utilisateur sur une carte (fiche 030) :
      Lancer, ou Refuser. Un refus renvoie à l'agent un résultat clair.
- [x] Plafond réglable (ADR-0020) : Réglages › Conversation, de 1 à 10, 5 par défaut, compte des
      filles en cours. Au-delà, `start_child` répond une erreur explicite, et « Lancer en
      parallèle… » est grisé avec une infobulle.
- [x] `message_child` et `message_parent` déposent le message dans la file d'attente de la
      conversation visée (fiche 020), avec sa provenance affichée (« De la conversation mère »).
- [x] `child_status` rend, pour chaque fille : titre, état, branche, fichiers modifiés, et la fin
      de son dernier message.
- [x] Une mère qui a lancé des filles est réveillée une fois, quand toutes ont fini leur tour et
      qu'elle est au repos, avec leurs comptes rendus groupés.
- [x] Testé contre l'agent factice :
  - scénario `filles` : start_child, accord, compte rendu, réveil groupé ;
  - scénario `filles-refus` : accord refusé ;
  - scénario `filles-plafond` : fille au-delà du plafond refusée (plafond réglé bas) ;
  - scénario `fille-message` : message de la mère à la fille, puis de la fille à la mère.
- [ ] Essais réels avec OpenCode (GPT-6.1 Sol) et avec Bob : les prompts ci-dessous, résultats
      notés dans le journal.

## Plan

À compléter par l'agent qui code. Points connus :

- **Données** : `startedFrom?: { id; title }` dans l'enregistrement et le résumé de conversation
  (`src/shared/agent.ts`, à côté de `branchedFrom`).
- **Main** : un nouveau module `src/main/conversations/children.ts`. Il crée la fille en
  réutilisant `createInWorktree` et pose les comptes rendus. Il gère le plafond et le réveil groupé
  en s'abonnant aux fins de tour.
  - `manager.ts` (1379 lignes) et `ipc.ts` (871) sont au bord de leur plafond ESLint : ne pas les
    grossir, extraire.
- **Outils** : un module d'outils de l'app (`src/main/mcp/`, à la manière des modules existants).
  Le contexte d'outil sait déjà sa conversation et sait parler à l'agent (`tellAgent`).
- **Renderer** :
  - « Lancer en parallèle… » dans `ConversationMenu` ;
  - la liste imbriquée et les icônes d'état dans `components/sidebar/` ;
  - la carte « Sous-tâches » et le compte rendu dans `components/thread/`.
- **Agent factice** : les quatre scénarios, et l'outil appelé comme un vrai agent le ferait.
- **Docs** : `docs/architecture.md` (lien mère-fille), `docs/mock-agent.md`, `docs/acp.md` (rien de
  propre à Bob : à confirmer avec la sonde).
- **Découpage possible** : étape 1, puis étape 2. Chacune sert seule.

### Plan de l'étape 1 (2026-10-20)

**Données.**

- `ConversationRecord.startedFrom` (`store.ts`) et `ConversationSummary.startedFrom` (`agent.ts`).
  Le résumé ne le porte que si la mère existe et n'est pas archivée : une mère supprimée ou
  archivée laisse ses filles en conversations ordinaires, sans rien réécrire. Désarchivée, la mère
  retrouve ses filles.
- Deux évènements de l'app et deux éléments du fil de la mère (`shared/transcript.ts`) :
  - `child-started` (fille lancée : titre, branche, consigne) ;
  - `child-report` (compte rendu de fin de tour : titre, issue, branche, fichiers +/−, fin de la
    réponse).
- Types et fonctions pures dans `src/shared/children.ts` :
  - les nouvelles de filles encore à transmettre, c'est-à-dire les éléments après le dernier
    message de l'utilisateur ;
  - le texte de contexte pour l'agent, en anglais (ADR-0014) ;
  - l'état d'une fille pour la liste et la carte : en cours, attend un accord, à lire, erreur,
    finie.

**Main.**

- `manager.ts`, au plafond (1046/1050) : sortir d'abord `withTimeout`, `inGitRepo`, `titleFrom` et
  la suppression de session d'un brouillon vers `conversations/helpers.ts`. Ensuite ajouter :
  - `createChild` : worktree depuis le dossier de la mère, conversation dans l'historique tout de
    suite, sans devenir l'active ;
  - `post` : poser un évènement de l'app dans un fil ;
  - `startedFrom` dans le résumé.
  - Pour `createInWorktree` et `createChild`, une seule fonction privée crée la conversation en
    worktree.
- `conversations/children.ts` (nouveau), classe `ChildConversations` :
  - `start` vérifie la mère : dans l'historique, ni fille, ni archivée. Il crée la fille, règle le
    modèle choisi, pose `child-started` chez la mère, puis envoie la consigne sans l'attendre.
  - Abonnée aux évènements du gestionnaire : à chaque `turn-end` ou `turn-error` d'une fille
    liée, elle pose un `child-report` dans le fil de la mère. Fichiers : `conversationChanges` du
    fil de la fille, comme le compteur de l'en-tête.
  - Handler IPC `conversation:startChild` déclaré dans ce module, puis branché dans `ipc.ts`
    (795/800 lignes : trois lignes de plus seulement).
- **Compte rendu à l'agent avec le prochain message** : nouvelle option `extraContext` d'`AgentHost`,
  lue au moment de l'envoi (`prompt`). Elle sert aussi pour la file d'attente, qui part par
  `prompt`. Le gestionnaire la branche sur les nouvelles de filles du fil de la mère. Une fois le
  message de l'utilisateur dans le fil, elles sont derrière lui, donc transmises : il n'y a pas
  d'état à tenir, et ça tient au redémarrage. Lancements et comptes rendus partent ensemble, dans
  un bloc `<child_conversations>` placé avant le message.
- `index.ts` : le module est branché sur le gestionnaire (`subscribe`) et sur l'IPC.

**Renderer.**

- `ConversationMenu.tsx` : « Lancer en parallèle… » pour une conversation de l'historique, ni
  fille ni archivée.
  - À l'ouverture du menu, l'état git du dossier est lu (`git:status`, canal existant).
  - Hors dépôt : élément désactivé, et une infobulle dit pourquoi.
- `sidebar/ChildDialog.tsx` (nouveau) : consigne, agent, modèle. L'agent et le modèle sont ceux de
  la mère. Le modèle n'est proposé que pour l'agent de la mère, dont on connaît les options ; avec
  un autre agent, c'est son dernier modèle choisi. L'active ne change pas.
- `dialogs/AppDialogs.tsx` et `App.tsx` : ouverture du dialogue, état des filles passé au fil. Le
  plus petit changement possible, `App.tsx` étant partagé.
- `Sidebar.tsx` et `history-order.ts` : les filles sont rangées sous leur mère, comme les branches
  (fiche 095), avec ↳ et une icône d'état à la place de l'icône de branche git.
- `thread/Subtasks.tsx` (nouveau), rendu par `Transcript.tsx` :
  - la carte « Sous-tâches » à l'endroit du dernier lancement, avec une ligne par fille vivante
    (état, branche, fichiers +/−, « Ouvrir »). Les lancements plus anciens sont une ligne simple ;
  - le compte rendu, avec une bordure de couleur selon l'issue.
- `styles.css` (sections barre latérale et fil), clés `children.*` et
  `conversationMenu.launchChild` (fr, en).

**Essais.**

- Unitaires :
  - `shared/children.test.ts` ;
  - réducteur du fil ;
  - `history-order.test.ts` ;
  - `conversations/children.test.ts`, contre l'agent factice et un vrai dépôt git jetable :
    lancement, compte rendu, contexte envoyé une seule fois, mère supprimée ou archivée.
- e2e : nouvelle suite `filles`, dans un dépôt git jetable comme `parallel`. Elle utilise les
  scénarios existants `modifications`, `permission` et `echo` : pas de nouveau scénario d'agent
  factice à l'étape 1.

**Dépendances** : aucune.

### Plan de l'étape 2 (2026-10-21)

**Données** (`shared/`).

- `ChildStart.by?: 'agent'` : fille lancée par `start_child`. Absent : par l'utilisateur.
- Provenance d'un message, `MessageOrigin` (`shared/children.ts`) : de la mère, d'une fille, ou le
  réveil groupé. Portée par l'évènement `user-message`, l'élément `user` du fil et le message en
  file d'attente (`QueuedMessage`, `QueuedMessageView`).
- `originContext(from)` : le texte en anglais joint avant un message venu d'une autre
  conversation. Il dit à l'agent d'où vient le message et avec quel outil répondre.
- `activeChildren(motherId, conversations, attention)` : les filles en cours d'une mère (état
  `running` ou `waiting` de `childState`). Le même compte sert au main et à l'interface.
- Préférence `maxChildren` : 1 à 10, 5 par défaut (ADR-0020).

**Main.**

- `mcp/children-tools.ts` (nouveau), sur le modèle des autres modules d'outils.
  - Le rôle se lit dans le résumé de la conversation, au début de la session :
    - une fille (mère existante, non archivée) reçoit seulement `message_parent` ;
    - une autre conversation, dans un dépôt git, reçoit `start_child`, `message_child` et
      `child_status` ;
    - hors dépôt, aucun outil (une fille a besoin d'un worktree).
  - Outils autorisés d'office (`autoAllow`) : ils n'agissent que dans l'app, et `start_child`
    demande lui-même l'accord. Le module joint `ChildConversations` par une fonction, car il est
    créé après le gestionnaire.
- `conversations/children.ts` grandit :
  - `start(motherId, request, by)` vérifie le plafond pour les deux étapes ;
  - `capacity(id)` : dépôt git, filles en cours, plafond. Il sert au menu, par un nouveau canal
    IPC déclaré dans `childHandlers` ;
  - `message(fromId, toId, text)` ;
  - `status(motherId)`.
- L'accord de `start_child` passe par `context.ask` (carte de questions : Lancer / Refuser), comme
  `approveCommand`. Une réponse tardive (au-delà de 45 s) :
  - acceptée : la fille démarre, et l'agent l'apprendra au réveil ;
  - refusée : l'agent en est informé par `tellAgent`.
- Pour tenir dans les 60 s d'un appel MCP chez Bob, `createChild` n'attend plus le démarrage de
  l'agent de la fille. Le modèle choisi est appliqué, puis la consigne envoyée, en arrière-plan.
- **Réveil groupé** (`conversations/children-wake.ts`, nouveau). Pour chaque mère, les filles
  attendues : lancées par `start_child`, ou relancées par `message_child`.
  - Une fille attendue a « fini » quand un tour se termine sans message en attente derrière lui.
    Un nouveau tour (`user-message` de la fille) la remet en cours.
  - Un message de la mère emporte les comptes rendus des filles finies : elles ne sont plus
    attendues.
  - Le contrôle se fait après chaque fin de tour d'une fille et chaque retour au repos de la mère.
    Quand toutes les filles attendues ont fini, que la mère est prête, sans file d'attente ni
    demande en cours, la mère reçoit un message de réveil. Les comptes rendus partent avec lui,
    par `extraContext`, comme à l'étape 1.
  - Une fille supprimée ou archivée ne bloque pas le réveil.
  - Une mère qui attend des filles n'est pas évincée (option `keepLive` du gestionnaire) : sinon,
    rouverte par `session/load`, elle perdrait ses comptes rendus (limite connue de l'étape 1).
  - Les filles lancées à la main ne sont jamais attendues.
- **Messages entre conversations** : `ConversationManager.prompt` reçoit `from`, et
  `AgentHost.send` le garde dans la file. Le message part tout de suite si l'agent est prêt,
  sinon à la fin de la réponse (fiche 020).
  - La file ne réunit que des messages de même provenance : chaque provenance part dans son tour.
  - `AgentHost` joint `originContext(from)` avant le message.
- `manager.ts` et `agent-host.ts` : quelques lignes chacun (`from`, `keepLive`, `ready`), le reste
  dans les nouveaux modules. `ipc.ts` : aucune ligne de plus (le canal passe par `childHandlers`).
- `index.ts` : le module d'outils, `keepLive`, l'état de l'attention et le plafond donnés à
  `ChildConversations`.

**Renderer.**

- Réglages › Conversation : « Conversations filles en cours », pas à pas de 1 à 10. `SizeStepper`
  prend un pas.
- `ConversationMenu` : « Lancer en parallèle… » lit `childCapacity` à l'ouverture du menu, au lieu
  de l'état git. Plafond atteint : l'élément est grisé, et une infobulle cite le réglage.
- `Transcript` :
  - un message venu d'une autre conversation porte sa provenance (« De la conversation mère »,
    « De la conversation fille « … » »), sans « Modifier » ni « Réessayer » ;
  - le réveil groupé est une ligne de l'app, traduite, et non une bulle.
- `QueuedMessages` : la provenance devant le texte.
- `Subtasks` :
  - un lancement par l'agent le dit (« L'agent a lancé la conversation fille … ») ;
  - un compte rendu attendu par l'agent dit qu'il partira à son réveil.
- Libellés des quatre outils (`shared/app-tools.ts`, groupe `children`).

**Agent factice.** Les scénarios appellent les outils comme Bob, avec l'étape `mcp-tool` : carte,
autorisation, puis `tools/call`.

- `filles` : deux `start_child`, puis le tour se termine. Au réveil (`when-prompt`), un point
  final.
- `filles-refus` : un `start_child` refusé ; l'agent dit ce qu'il fait à la place.
- `filles-plafond` : trois `start_child` de filles lentes (`/scenario lent`) ; au-delà du plafond,
  l'erreur est relayée.
- `fille-message` : la mère lance une fille, puis lui écrit (`message_child`, avec l'identifiant
  lu dans le résultat). La fille, reconnue à sa consigne, écrit à la mère (`message_parent`).

**Essais.**

- Unitaires :
  - `mcp/children-tools.test.ts` : rôles, accord, refus, plafond, réponse tardive ;
  - `conversations/children.test.ts`, contre l'agent factice : plafond, messages avec provenance,
    `status`, réveil groupé (une seule fois, pas pour les filles lancées à la main) ;
  - `children-wake.test.ts` ;
  - `message-queue.test.ts` ;
  - `shared/children.test.ts` ;
  - le pas à pas des Réglages.
- e2e : la suite `filles` gagne une deuxième partie, avec les scénarios `filles`, `filles-refus`,
  `filles-plafond` et `fille-message`.

**Dépendances** : aucune.

## Essais réels : prompts

### Préparation

- **Projet** : le « carnet » de l'essai du 2026-10-20 (dépôt git, `README.md` avec « À faire »).
  Son README liste justement trois chantiers indépendants : protéger l'export CSV contre
  l'injection, l'import CSV, une page d'aide.
- **Agent et modèle** :
  - OpenCode avec `openai/GPT-6.1 Sol`. La version `Fast`, plus rapide, convient aux essais
    négatifs.
  - Bob, avec son modèle par défaut. Préférer les prompts courts, marqués **(Bob)**, pour limiter
    les bobcoins.
- **Contrôle préalable**, dans une conversation neuve : « Quels outils de Bobine as-tu pour lancer
  ou suivre d'autres conversations ? Ne lance rien. » L'agent doit citer `start_child`,
  `message_child` et `child_status`.
- **Ce qu'on note pour chaque essai** :
  - l'outil appelé ou non ;
  - la carte d'accord ;
  - les filles dans la liste ;
  - le compte rendu ;
  - le réveil ;
  - le coût (`/context`, quota de Bob).

### Étape 1 — sans l'agent

1. **Fille à la main.** Dans la conversation « Carnet », « Lancer en parallèle… » avec cette
   consigne :
   > Ajoute un import CSV : un bouton « Importer » qui lit un fichier choisi par l'utilisateur, avec
   > les mêmes colonnes que l'export. Ajoute ses tests. Ne touche pas à l'export. Quand les tests
   > passent, committe sur ta branche.

   Attendu :
   - la fille apparaît sous la mère, avec une branche `bobine/…` ;
   - à la fin de son tour, la mère reçoit un compte rendu (fichiers, branche) ;
   - rien ne part à l'agent de la mère tout seul.
2. **La mère lit le compte rendu.** Dans la mère, après le compte rendu :
   > Résume ce que la conversation fille a fait, et dis-moi comment récupérer sa branche dans main.

   Attendu : l'agent connaît le nom de la branche et les fichiers, sans les avoir demandés.

### Étape 2 — l'agent lance et suit ses filles

3. **Parallèle explicite.**
   > Il reste trois points dans le README : protéger l'export CSV contre l'injection de formules,
   > l'import CSV, et une page d'aide. Ils sont indépendants : lance une conversation fille par
   > point, et coordonne. Quand tout est fini, fais-moi le point, avec les branches à fusionner
   > dans l'ordre.

   Attendu :
   - trois cartes d'accord, puis trois filles ;
   - la mère se met au repos ;
   - un seul réveil quand les trois ont fini ;
   - un point final avec trois branches.
4. **Parallèle implicite** (le modèle doit juger seul).
   > Les trois points restants du README sont gros et indépendants, et je veux pouvoir suivre
   > chacun séparément. Organise-toi.

   Attendu : des filles. Si l'agent fait tout lui-même, c'est que la description de `start_child`
   n'est pas assez claire : à noter.
5. **Négatif : lecture** (aucune fille).
   > Trouve où la recherche est implémentée et explique-la en deux phrases.

   Attendu : pas de `start_child`. Une lecture directe ou un sous-agent conviennent.
6. **Négatif : petite correction** (aucune fille). **(Bob)**
   > Corrige la faute de frappe « immédiatement » dans le README.

   Préparation : introduire la faute avant l'essai. Attendu : correction directe.
7. **Plafond.** Préparation : Réglages › Conversation, plafond des conversations filles à 2
   (5 par défaut, ADR-0020).
   > Lance quatre conversations filles, une par fichier de `public/` et de `src/`, pour ajouter un
   > commentaire d'en-tête à chaque fichier.

   Attendu :
   - 2 filles au plus en même temps ;
   - la 3ᵉ est refusée avec un message clair, qui cite le réglage ;
   - l'agent s'adapte : il attend qu'une fille finisse, regroupe, ou fait le reste lui-même.

   Remettre ensuite le plafond à 5.
8. **Un seul niveau.** Dans une fille ouverte à la main :
   > Découpe ton travail en deux conversations filles.

   Attendu : l'outil n'existe pas dans une fille ; l'agent le dit et travaille lui-même.
9. **Message de la mère à la fille.** Pendant que la fille « import » travaille, dans la mère :
   > Dis à la conversation fille de l'import d'accepter aussi le point-virgule comme séparateur.

   Attendu : `message_child`. Le message apparaît dans la file de la fille (« Partira à la fin de
   la réponse ») avec « De la conversation mère », et la fille en tient compte.
10. **Message de la fille à la mère.** Consigne de fille volontairement ambiguë :
    > Ajoute une page d'aide. Si un choix de fond se pose, demande à la conversation mère avant de
    > trancher.

    Attendu : `message_parent` (par exemple « En français ou en anglais ? »). La question apparaît
    dans la mère, puis la mère répond ou te la pose.
11. **Accord refusé.** Reprendre le prompt 3 et refuser une des cartes. Attendu : l'agent le note,
    lance les deux autres, et dit ce qu'il fait du point refusé.
12. **État.** Pendant que des filles travaillent :
    > Où en sont les conversations filles ?

    Attendu : `child_status`, et un résumé par fille (état, fichiers, branche).
13. **Essai court avec Bob** **(Bob)**, pour limiter les bobcoins :
    > Lance deux conversations filles : l'une ajoute un fichier `.editorconfig` standard, l'autre un
    > `CHANGELOG.md` avec un titre et une section « Prochaine version ». Fais-moi le point quand les
    > deux ont fini.

    Attendu : comme le prompt 3, à petite échelle. Noter le coût lu dans le quota de Bob.

## Journal

- 2026-10-20 — Fiche créée après la revue d'interface (maquettes `m099`, `m100`). Décision :
  ADR-0019, deux étapes, sur le choix de l'utilisateur. Rien n'est codé.
- 2026-10-20 — **Étape 1 faite** (branche `claude/fiche-097-filles-etape1-b33141`), selon le plan
  ci-dessus. L'étape 2 reste à faire.
  - **Fait** :
    - « Lancer en parallèle… » dans le menu du titre et dans celui de la liste ;
    - la fille dans un worktree, sous sa mère, avec son état ;
    - la carte « Sous-tâches » et le compte rendu de fin de tour ;
    - les nouvelles jointes au prochain message de l'utilisateur ;
    - la mère archivée ou supprimée.
  - **Essais** :
    - unitaires : `shared/children.test.ts` ; `conversations/children.test.ts`, contre l'agent
      factice et un vrai dépôt git ; liste et fil ;
    - e2e : nouvelle suite `filles`, en clair, en sombre et en anglais. La suite complète
      (`pnpm e2e`, 587 s) est verte.
  - **Écarts au plan et choix** :
    - **Modèle** : il n'est proposé que pour l'agent de la mère, le seul dont on connaît les
      options. Avec un autre agent, la fille prend le dernier modèle choisi avec lui (texte dans
      la fenêtre). Le modèle choisi est retenu pour l'agent, comme dans la zone de saisie.
    - **Lancements transmis aussi** : le bloc `<child_conversations>` porte les comptes rendus,
      mais aussi les lancements (titre, branche, consigne). L'agent de la mère sait ainsi qu'une
      fille travaille, et ne refait pas son travail.
    - **Mère archivée** : la fille ne lui rend plus compte ; elle est alors une conversation
      ordinaire. Désarchivée, la mère retrouve ses filles.
    - **Dans la liste**, une fille montre son état à gauche (en cours, attend un accord, erreur,
      finie) à la place de l'icône git. À droite, la pastille ne reste que pour la réponse à
      lire.
    - **Dans le fil**, la carte suit le dernier lancement. Les lancements plus anciens restent une
      ligne simple. Un compte rendu pas encore transmis le dit : « Partira à l'agent avec votre
      prochain message ».
    - **Consigne qui n'a pas pu partir** (agent à connecter…) : elle est rendue dans un avis du fil
      de la fille, pour être renvoyée.
    - Pas de nouveau scénario d'agent factice : `modifications`, `permission`, `erreur` et `echo`
      suffisent à l'étape 1.
    - `manager.ts` (1029/1050 lignes) : `withTimeout`, `inGitRepo`, `titleFrom` et
      `dropDraftSession` sont sortis dans `conversations/helpers.ts`. `ipc.ts` est à 798/800 :
      le handler est déclaré dans `children.ts`.
  - **Limite connue** (déjà vraie pour tous les éléments de l'app : avis, bandeau de branche) :
    - Une mère évincée puis rouverte par `session/load` voit son fil refait par le rejeu de
      l'agent. Elle perd alors ses lancements et ses comptes rendus, y compris ceux pas encore
      transmis. La carte disparaît avec son ancre. Les filles et la liste restent.
    - À traiter à part : garder les éléments propres à l'app au rejeu.
  - **Hors de mes fichiers** : `dialogs/AppDialogs.tsx` (ouverture de la fenêtre) et `App.tsx`
    (trois props). `agent-host.ts` (option `extraContext`), `shared/transcript.ts` et
    `shared/export.ts` (deux éléments du fil). `docs/traduction.md` (glossaire), `docs/acp.md`.
  - **À faire à l'intégration** :
    - essai à la vraie souris ;
    - prompts d'essai réel 1 et 2 ;
    - `fr.generated.d.ts` à régénérer ;
    - index des fiches et CHANGELOG.
  - **CHANGELOG proposé** :
    - fr (« Prochaine version ») : « Lancer en parallèle… », dans le menu d'une conversation,
      ouvre une conversation fille. Elle travaille dans son propre worktree, et apparaît sous sa
      mère avec son état. À chaque fin de tour, la mère reçoit son compte rendu (carte
      « Sous-tâches »), qui part à son agent avec votre prochain message.
    - en (« Next version »): “Run in parallel…”, in a conversation’s menu, opens a child
      conversation. It works in its own worktree and appears under its parent with its state. At
      the end of each turn, the parent gets its report (“Subtasks” card), which goes to its agent
      with your next message.
- 2026-10-20 — **Essais réels 1 et 2** sur l'app assemblée (098 + 097), OpenCode avec
  `openai/GPT-6.1 Sol`, projet « carnet » (état committé avant l'essai). Piloté par le port de
  débogage, sans le contrôle de l'écran.
  - **Prompt 1** :
    - la fille démarre sous sa mère, sur la branche `bobine/20261020-2252-d090`, avec la carte
      « Sous-tâches » ;
    - elle finit en 2 min 05 : import CSV, 23 tests réussis, commit `2ff5862` sur sa branche ;
    - le compte rendu arrive dans la mère (5 fichiers, +268), avec « Partira à l'agent avec votre
      prochain message » ;
    - dans la liste, la fille porte une coche et le point « non lu ».
  - **Prompt 2** : le message part avec le compte rendu, en bloc de contexte à part (journal ACP :
    2 blocs). L'agent de la mère connaît la branche, le commit et les tests, et donne la fusion
    (`git switch main`, `git merge …`, `npm test`) sans la faire.
  - **Petits défauts vus** :
    - le compte rendu affiche le Markdown brut de la fille (backticks, tirets) au lieu de le mettre
      en forme ;
    - le titre de la fille est le début de la consigne, faute de titre automatique ;
    - dans la fenêtre « Lancer en parallèle », le modèle est une liste native au nom complet
      (`openai/GPT-6.1 Sol`), pas le menu avec recherche de la fiche 092.
- 2026-10-21 — **Étape 2 faite** (branche `claude/fiche-097-filles-etape2-8afa98`), selon le plan
  de l'étape 2. Les essais réels (prompts 3 à 13, OpenCode et Bob) restent à faire.
  - **Fait** :
    - quatre outils dans `mcp/children-tools.ts` : `start_child`, `message_child`,
      `child_status` pour une mère (dossier dans un dépôt git), `message_parent` pour une fille ;
    - la carte d'accord Lancer / Refuser, et la réponse tardive ;
    - le plafond réglable (Réglages › Conversation, 1 à 10, 5 par défaut), compté sur les filles
      en cours, pour les deux étapes ; « Lancer en parallèle… » grisé avec une infobulle ;
    - les messages entre conversations, par la file d'attente, avec leur provenance (fil, file,
      export) ;
    - le réveil groupé de la mère (`conversations/children-wake.ts`).
  - **Essais** :
    - unitaires : `mcp/children-tools.test.ts`, `children-wake.test.ts`, `children.test.ts`
      (dont les quatre scénarios joués par le vrai serveur MCP), `message-queue.test.ts`,
      `agent-host.test.ts`, `shared/children.test.ts`, fil, file, liste ;
    - e2e : la suite `filles` gagne une deuxième partie (les quatre scénarios, le réglage, le
      menu au plafond), en clair, en sombre et en anglais ; suites touchées vertes
      (`settings`, `queue`, `questions`, `parallel`, `terminal`) ;
    - suite complète (`pnpm e2e`, 642 s) : verte sauf deux vérifications de `quick` en clair
      (capture d'écran annulée), passées en sombre ; relancée, `quick` est verte en clair et en
      sombre. Rien de cette suite n'est touché par l'étape 2.
  - **Écarts au plan et choix** :
    - **Filles attendues** : celles que l'agent a lancées, et aussi celles auxquelles il vient
      d'écrire (`message_child`) : il attend leur réponse. Une fille a fini quand un tour se
      termine sans message en file derrière lui.
    - **Pas de réveil sans nouvelle** : si les comptes rendus sont déjà partis avec un message
      de l'utilisateur, la mère n'est pas réveillée.
    - **Compte rendu pendant une réponse de la mère** : il est retenu, puis posé à la fin de sa
      réponse. Posé au milieu, il coupait le texte de l'agent en deux (vu dans les captures).
      Cela vaut aussi pour l'étape 1.
    - **Consigne qui n'a pas pu partir** : en plus de l'avis dans la fille, la mère reçoit un
      compte rendu en erreur. Son agent ne l'attend plus.
    - **`createChild` n'attend plus le démarrage de l'agent** : `start_child` doit répondre dans
      les ≈ 60 s d'un appel MCP chez Bob, carte d'accord comprise. Le modèle choisi dans la
      fenêtre est appliqué en arrière-plan, avant la consigne (`ready`).
    - **Accord tardif** (au-delà de 45 s, comme `ask_user`) : accepté, la fille démarre, et
      l'agent l'apprend au réveil ; refusé, l'agent en est informé par un message.
    - **La file ne réunit qu'une provenance par envoi** : un message de la mère et un message de
      l'utilisateur partent dans deux tours. Chaque message porte ainsi sa provenance.
    - **Jamais deux tours à la fois** : `AgentHost` compte un message en préparation comme une
      réponse. Un second envoi au même moment attend dans la file. Cela corrige aussi un cas
      ancien : une réponse tardive à `ask_user` et la file qui partaient ensemble.
    - **Mère qui attend ses filles** : elle n'est pas évincée (option `keepLive` du
      gestionnaire). Rouverte par `session/load`, elle perdrait ses comptes rendus (limite de
      l'étape 1).
    - **Réveil** : le texte part à l'agent en anglais (`WAKE_TEXT`). Le fil montre à la place une
      ligne de l'app, traduite. Un message d'une autre conversation n'a ni « Modifier » ni
      « Réessayer ».
    - **`message_child`** : la fille se désigne par son identifiant (rendu par `start_child` et
      `child_status`) ou par son titre exact.
    - Dans `children.ts`, la clé `children.limit` sert à l'erreur et à l'infobulle.
  - **Hors des fichiers prévus** (petits changements) :
    - `agent/agent-host.ts` (1043/1050 : `from`, garde de préparation ; `currentMode` sorti vers
      `session-controls.ts`), `agent/message-queue.ts`, `agent/prompt-content.ts`
      (`withContext`) ;
    - `common/Menus.tsx` : `Tip` prend un côté, et ne montre rien sans texte. L'élément du menu
      garde ainsi la même enveloppe, et l'infobulle passe à droite pour ne pas cacher
      « Épingler » ;
    - `settings/rows.tsx` (`SizeStepper` à pas réglable), `settings-search.ts`,
      `shared/export.ts`, `shared/app-tools.ts`, `renderer/panel-tabs.ts` ;
    - `ipc.ts` : aucune ligne de plus (type de `children`).
  - **À surveiller aux essais réels** :
    - que l'agent se serve de `start_child` sans qu'on le lui demande (prompt 4), et pas pour
      une lecture ou une petite correction (prompts 5 et 6) ;
    - qu'il finisse son tour après ses lancements au lieu d'attendre ou d'appeler
      `child_status` en boucle ;
    - le délai de Bob sur un appel MCP pendant la carte d'accord (réponse tardive au-delà de
      45 s) ;
    - le coût d'un réveil (un tour de la mère) ;
    - les filles d'OpenCode : prennent-elles la consigne entière quand elle est longue ?
  - **Limites connues** :
    - l'attente du réveil vit en mémoire : un redémarrage de l'app l'oublie (les agents des
      filles s'arrêtent aussi) ;
    - le compte rendu affiche encore le Markdown brut de la fille (défaut vu à l'étape 1).
- 2026-10-21 — **Correction après l'essai réel de l'étape 2** (OpenCode, projet « carnet ») : une
  fille qui venait de démarrer était aussitôt arrêtée par l'éviction des agents (`maxLive` = 4,
  fiche 043). Il y avait la mère A, qui attendait ses trois filles, et une conversation B ouverte
  par l'utilisateur. Depuis B, la fille C lancée par « Lancer en parallèle… » s'est évincée
  elle-même (« SIGTERM après 2 ms »). Son compte rendu disait « Aucun agent actif pour cette
  conversation ».
  - **Cause** : `evict()` épargnait seulement la conversation active, celles ouvertes à côté,
    celles qui répondent (`busy`) et les mères qui attendent. Une fille qui démarre n'était rien
    de tout ça : c'était la seule évinçable. `ready()` passait ensuite par `liveHost`, d'où
    l'erreur.
  - **Corrigé** :
    - un agent qui vient de démarrer n'est jamais arrêté par sa propre éviction (`evict` épargne
      la conversation en cours de démarrage, pour toute conversation). Avant, `ensureLive` pouvait
      même rendre un hôte déjà arrêté ;
    - `keepLive` épargne aussi :
      - une fille en cours : son agent démarre, travaille, attend un accord ou une réponse ;
      - une conversation dont la consigne ou le message envoyé par l'app n'est pas encore parti ;
    - `ready()` relance l'agent s'il le faut (`ensureLive`), au lieu d'échouer ;
    - si l'agent d'une fille ne démarre vraiment pas, le compte rendu et l'avis disent pourquoi :
      « Son agent n'a pas démarré : … » (détail de l'agent), ou « Son agent attend une action de
      votre part (connexion, dossier à approuver) ».
  - **Choix pour la limite** : `maxLive` reste une limite souple, comme pour les conversations qui
    répondent. Les filles en cours et la mère qui les attend ne sont jamais arrêtées. Elles
    comptent dans la limite : ce sont les conversations ordinaires au repos qui laissent la place.
    - Ne pas les compter aurait gardé jusqu'à quatre agents au repos de plus, sans raison.
    - Porter la limite à 1 + le plafond aurait gardé des agents vivants même sans filles.
    - Au pire, il y a donc 1 + plafond (5) + l'active + celle d'à côté agents vivants. C'est ce que
      l'utilisateur a choisi en réglant le plafond (ADR-0020).
  - **Bilan en double** (remarque de l'essai) : une fille écrit à sa mère (`message_parent`), puis
    finit pendant que la mère traite ce message. Son compte rendu seul ne réveille plus la mère :
    elle vient d'avoir de ses nouvelles. Le compte rendu part avec le prochain message. Une autre
    fille qui finit pendant ce même tour réveille encore la mère.
  - **Essais** :
    - unitaires (`children.test.ts`) : le cas de l'essai (deux agents vivants au plus, mère en
      attente, fille lancée depuis une autre conversation avec un modèle) échoue avant la
      correction et passe après ; agent introuvable ; bilan en double (`children-wake.test.ts`) ;
    - e2e : la partie « lancées par l'agent » de la suite `filles` tourne avec
      `BOBINE_MAX_LIVE=2`, une variable pour les essais seulement. Avant la correction, l'app ne
      répondait plus ; après, les deux filles finissent.
- 2026-10-21 — **Second retour de l'essai réel** : une fille qui testait le carnet dans le
  navigateur est restée bloquée douze minutes, et la fenêtre « Enregistrer sous » ne disait pas de
  quelle conversation venait le téléchargement.
  - **Cause du blocage** : une boîte `confirm()` de la page (bouton « Supprimer »), pas
    « Enregistrer sous ». Le détail et la correction sont dans le journal de la fiche 094 : les
    outils du navigateur ne restent plus jamais bloqués par une boîte de la page.
  - **Repérer la conversation** :
    - « Enregistrer sous » cite le titre de la conversation ;
    - pendant cette fenêtre ou une boîte de la page, la conversation est « attend votre réponse »
      dans la liste. Une fille qui attend ainsi compte comme en cours (plafond, éviction).
- 2026-10-21 — **Quatre petits défauts avant la fusion** (retours de l'essai réel) :
  1. **Carte d'accord au-delà du plafond** :
     - le plafond se vérifie maintenant avant la carte ;
     - une carte encore sans réponse prend une place, car l'agent peut appeler `start_child`
       plusieurs fois à la fois. Avec un plafond de 2 et trois appels simultanés, deux cartes
       s'affichent, et le troisième appel répond aussitôt l'erreur qui cite le réglage ;
     - une carte refusée ou acceptée libère sa place.
  2. **Bilan en double** (mères 42202d20 et be35cb19) :
     - l'app de cet essai a démarré à 07:33Z, donc avant la correction de 07:57Z (`4586910`,
       entrée « Correction après l'essai réel ») ;
     - l'ordre relevé : la dernière fille écrit à sa mère (`message_parent`), la mère commence un
       tour sur ce message, la fille finit pendant ce tour, puis le réveil arrive ;
     - c'est exactement le cas que traite cette correction : la fille a fini pendant que sa mère
       traitait son message, donc son compte rendu seul ne réveille plus la mère ;
     - le cas d'un tour commencé après la fin de toutes les filles était déjà couvert : leurs
       comptes rendus partent avec ce message ;
     - un essai d'intégration rejoue l'ordre du journal ; il échoue sans la règle et passe avec.
  3. **Sous-agents appelés « conversations filles »** : la description de `start_child` le dit
     maintenant : « Only this tool creates a child conversation: your own sub-agents are not child
     conversations, so never call them that. » L'effet reste à voir à la prochaine sonde ou au
     prochain essai réel.
  4. **Compte rendu en Markdown brut** : la fin de la réponse de la fille est maintenant rendue
     comme le reste du fil (même composant `Markdown`), sous le titre, en hauteur bornée qui
     s'efface. La carte ne grossit pas.
- 2026-10-21 — **Essais réels de l'étape 2** (session principale), OpenCode avec
  `openai/GPT-6.1 Sol`, projet « carnet ». Piloté par le port de débogage ; les cartes d'accord ont
  été tranchées comme l'aurait fait l'utilisateur.
  - **Contrôle préalable** : l'agent cite `start_child`, `child_status` et `message_child`, et
    sait qu'il sera prévenu ; il ne lance rien.
  - **5 et 6 (négatifs)** : pour une recherche ou une petite correction, aucune fille.
  - **3** : trois `start_child`, trois cartes, trois filles avec de vrais titres. La mère est
    réveillée une fois tout fini, assemble les trois branches dans une copie temporaire (48 tests
    réussis) et donne l'ordre de fusion avec les conflits à prévoir.
  - **12** : `child_status`, avec un résumé par fille.
  - **9** : `message_child`. Le message arrive dans la file de la fille avec « De la conversation
    mère ». La mère a aussi prévenu une autre fille de son propre chef. Les filles écrivent à leur
    mère (`message_parent`), et la mère fait le relais entre elles.
  - **8** : dans une fille, pas de petites-filles. Elle a pris des sous-agents, mais les a appelés
    « conversations filles » : la description de `start_child` le corrige depuis (à revérifier).
  - **4** (implicite) : l'agent découpe de lui-même en trois filles.
  - **11** (accord refusé) : l'agent fait le morceau refusé lui-même, dans un commit à part. Quand
    on refuse le lancement de l'app, la mère demande aussi à ses filles de ne pas lancer de serveur.
  - **10** (sur la version corrigée) : la fille pose sa question à sa mère, qui la remonte à
    l'utilisateur puis transmet la réponse.
  - **7** (plafond réglé à 2, version corrigée) :
    - avec quatre petits ajouts d'en-tête, l'agent prend ses sous-agents (conforme à la
      description) ;
    - avec trois vrais chantiers, la 3ᵉ fille est refusée en citant le réglage, et la mère la
      relance au réveil.
  - **Défauts trouvés et corrigés sur la branche** :
    - une fille qui démarre arrêtée par l'éviction (`4586910`) ;
    - les outils du navigateur figés par une boîte `confirm()` de la page, et « Enregistrer sous »
      qui ne disait pas qui demandait (`928f19b`) ;
    - la carte d'accord affichée malgré le plafond, et le compte rendu en Markdown brut
      (`73b5b68`).
  - **Revérifié en vrai** : avec 5 agents vivants pour une limite de 4, c'est une conversation au
    repos qui est arrêtée, jamais une fille.
  - **Reste** : l'essai court avec Bob (prompt 13), qui demande d'approuver le dossier d'essai dans
    la configuration de Bob ; l'effet de la nouvelle phrase de `start_child` sur les sous-agents.
- 2026-10-21 — **Essai réel avec Bob** (prompt 13), sur `main` construit, projet « carnet »
  approuvé dans Bob avec l'accord de l'utilisateur (une entrée dans `~/.bob/trustedFolders.json`).
  - Bob appelle `start_child` deux fois, avec des consignes précises (rédigées en anglais) ; deux
    cartes d'accord, acceptées dans les 60 s qu'accorde Bob à un appel d'outil.
  - Les worktrees des filles n'ont pas demandé d'approbation de dossier : Bob les accepte, puisqu'ils
    sont sous le dossier approuvé.
  - **Particularité de Bob** : en mode Agent, Bob demande l'accord avant chaque écriture et chaque
    commande. Chaque fille en a demandé deux (écrire son fichier, committer), à donner dans la
    fille. La carte « Sous-tâches » de la mère et la liste affichent bien « Attend un accord ».
  - Les deux filles finissent (`.editorconfig`, `CHANGELOG.md`, un commit chacune). La mère est
    réveillée une fois et fait un bilan unique, avec les deux branches et la façon de les fusionner.
  - **Coût** (base de Bob, colonne `costs`) : 0,105 (mère) + 0,099 + 0,099 = **0,30 bobcoin**.
  - **Journal** : aucun avertissement ni erreur.
  - **Idée** : avec Bob, il faut aller dans chaque fille pour donner ses accords. Pouvoir répondre
    depuis la carte « Sous-tâches » de la mère éviterait ces allers-retours. À proposer à part.
- 2026-10-22 — Fiche 118 : l'agent ne proposait pas de filles de lui-même. Contexte de session
  `<bobine_capabilities>`, réglage et `/split` ajoutés ; essai réel noté dans la fiche 118
  (OpenCode et Bob). La case « Essais réels » ci-dessus reste à cocher : les prompts de cette
  fiche n'ont pas été rejoués.

- 2026-10-26 — Essai court de la fiche 149, à la demande de l’utilisateur : OpenCode **2.1.4**
  avec **Big Pickle** (gratuit), deux filles pour deux fichiers jetables. Propositions, worktrees,
  apparition immédiate, comptes rendus et réveil groupé réussis en 34,2 s ; mère active, fichiers
  isolés dans les filles. Coût annoncé 0 USD. Ce n’est pas un rejeu de tous les prompts ci-dessus.
  Bob Shell **2.0.6**, après SSO : même scénario réussi en **14,9 s**, onze contrôles verts,
  dont les autorisations d’écriture distinctes et le maintien de la mère. Coût du passage propre :
  **0,264528 bobcoin** ; deux passages au total : **0,528602** (premier ralenti par le script manuel,
  corrigé). La suggestion de fusion du bilan de Bob est incorrecte pour ces fichiers non committés ;
  aucune fusion exécutée. Voir le journal détaillé de la
  [fiche 149](149-barre-laterale-familles-attention.md).
- 2026-10-26 — **Retours de la mère vers une fille existante** : essais manuels Bob 2.0.6 et
  OpenCode 2.1.4/Big Pickle. Une demande explicite de correction est transmise par `message_child` ;
  la fille reprend sa session et son worktree, corrige, puis informe sa mère. Une simple remarque
  naturelle fonctionne aussi dans ces conversations déjà orientées vers la transmission. La
  contre-épreuve en conversation neuve montre toutefois que **Bob demande une précision sans
  reprendre la fille**, tandis qu’OpenCode la reprend et corrige le fichier. Le choix appartient
  au modèle, il ne découle pas automatiquement d’ACP.
  Consignes consultables et résultats détaillés : [fiche 150](150-consignes-conversations-filles.md).
