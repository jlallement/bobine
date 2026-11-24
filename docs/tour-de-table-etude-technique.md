# Tour de table (`/roundtable`) — étude technique

> Statut : **étude**, pour la 1.2. Rédigée le 2026-11-24 sur la branche `etude/tour-de-table` (coupée
> de `1.1`, 1.1.0-rc.2), révisée le même jour après les décisions de l'utilisateur (fiche 285,
> « Décisions de l'utilisateur »). Elle repose sur le code lu ; chaque affirmation cite
> `fichier:ligne`. Fiche de fonctionnalité : `docs/features/285-tour-de-table.md`, qui fait foi
> pour le parcours. Décision structurante : `docs/adr/0072-tour-de-table.md` (accepté le 2026-11-24, décisions C1
> à C8 de la fiche).
> Alignée le 2026-11-24 sur les maquettes finales (`docs/maquettes/1.2-tour-de-table-v2.html`) et
> sur les décisions D1 à D4 de la fiche (anciennes questions ouvertes).
> Lot 0 (observations sur OpenCode 2.3.0 et Bob 2.1.0) fait le 2026-11-24 :
> [`recettes/2026-11-24-tour-de-table-lot0.md`](recettes/2026-11-24-tour-de-table-lot0.md) ;
> risques et inconnues mis à jour (§ 3.6, § 3.7).

## 0. En bref

- **Presque tout existe.** Une fille en lecture seule, sur un autre agent ou un autre modèle, dans le
  dossier de la mère, avec sa réponse entière gardée dans le fil de la mère, est déjà ce que fait une
  bulle « @Rôle » à plusieurs rôles (fiche 263, `roles/invoke.ts:62`). Il manque trois choses :
  - l'orchestration : attendre les avis, demander la synthèse, puis la réplique ;
  - un modèle **imposé**, sans repli silencieux, à chaque participant ;
  - une carte qui montre l'état du tour et son total consommé.
- **Recommandation : option A, « surcouche des filles ».** Un participant est une conversation
  fille en lecture seule, lancée par `ChildConversations.start` avec un rôle figé fourni par le code
  (`roleSnapshot`). Un petit module main `roundtable/` tient la machine d'états du tour dans un
  élément du fil de la mère (`roundtable`), persisté et rejoué comme le reste du fil. On écarte
  l'orchestrateur dédié (des hôtes d'agent hors conversation, façon aparté) : il réécrirait la
  lecture seule, les coûts, la persistance et la reprise.
- **Coût.** Un tour à N participants coûte au moins N + 1 réponses de modèle, et N + 1 de plus avec
  la réplique. L'interface le dit par un multiplicateur de la consommation de jetons (« + synthèse
  · ≈ 4 fois les jetons d'une question simple »), calculé sur le nombre de participants, sans
  estimation en argent ni en nombre de jetons. Après coup, le pied de la carte donne le total consommé, avec
  les chiffres que les agents communiquent. Pas de plafond propre au tour : le plafond par
  conversation s'applique tel quel à chaque conversation (§ 2.6).

## 1. Les briques existantes

### 1.1 Conversations filles (`src/main/conversations/children.ts`)

| Brique | Où | Ce qu'elle fait, ce qui compte pour le tour de table |
|---|---|---|
| `ChildConversations.start` | `children.ts:243` | Seule entrée pour lancer une fille (menu, IPC, `start_child`, bulles). Refuse : consigne vide, mère brouillon, **mère déjà fille** (`children.error.oneLevel`, `:248`), mère archivée, modèle demandé alors que le profil ne le permet pas (`:252`), plafond atteint (`:255-256`). |
| `ChildRequest` | `children.ts:74-111` | `text`, `title`, `profileId`, `model {controlId, value}`, `role` / `roleSnapshot`, `notices`, `uncommitted`, `ask`, `card`. **Pas de pièces jointes** : la consigne part en texte seul (`launch`, `:962`). |
| `launchRole` / `inPlace` | `children.ts:1017`, `:329-341` | Un rôle `readOnly` ne prend jamais de worktree (`:334`). |
| `childDetachedRequest` | `helpers.ts:377-406` | Rôle en lecture seule : dans le dossier de la mère, sans worktree (`here`, `:391`). Le rôle est noté dans l'enregistrement (`record.role`, `store.ts:64`). La lecture seule tient donc **hors dépôt git** aussi : aucun `inGitRepo` sur ce chemin. |
| `createChild` → `createDetached` | `manager.ts:486`, `:510` | Une fille entre aussitôt dans l'historique, avec son propre `AgentHost` (`manager.ts:1321`), donc **son propre processus d'agent**. |
| `born` | `children.ts:411-450` | Pose `child-started` dans le fil de la mère, avec `card` ou `request`. Ajoute la fille aux attendues seulement si `by === 'agent'` (`:425`). |
| `launch` | `children.ts:929-1000` | `ready` → `applyModel` → mode natif et consigne du rôle (`roleFirstMessage`) → empreinte de lecture seule → `prompt`. Sur échec : `child-report` en erreur posé chez la mère, et `waking.finished` (`:985-998`). |
| `applyModel` | `children-review.ts:812-829` | `session/set_config_option` sur le réglage de catégorie `model`, `remember: false` (pour la fille seulement). **Repli silencieux** : option absente (`:821`) ou refus de l'agent (`:825-828`), et la fille part avec le modèle que l'agent a pris. Voir le risque R2. |
| `onEvent` | `children.ts:665-712` | À chaque fin de tour d'une fille, un `child-report` est posé chez la mère. Il est retenu tant que la mère répond (`held`, `:696-708`). La **réponse entière** n'y est que si la fille a une carte (`hasCard` → `keptReply`, `:693`). |
| `hasCard` | `children.ts:719-730` | Vrai si son `child-started` porte `request` ou `card`. |
| `reply` (« Répondre à… », « Relancer ») | `children.ts:759-822` | Message à une fille qui a sa carte **et un rôle** ; relance comme au lancement une fille qui n'a jamais démarré. Pour un rôle non figé, il passe par `findRole`, qui échouerait sur un rôle fourni par le code (`:788`). |
| `deliver` | `children.ts:881-911` | Message d'une autre conversation : file d'attente si l'agent répond, sinon envoi tout de suite ; un échec est dit dans le fil visé. |
| `wake` | `children.ts:914-923` | `prompt(motherId, WAKE_TEXT, [], { from: { kind: 'wake' } })`. |
| `keepLive` | `children.ts:872-878` | Une fille en cours, ou une mère qui attend, n'est jamais mise en veille (`manager.ts:1356-1362`). |
| `status` / `fullText` | `children.ts:561`, `:579` | Ce que voient `child_status` et `child_status full`. |
| `choices` / `modelAllowed` | `children.ts:606-630` | Liste des modèles prise du réglage `model` **de la mère seulement**, si son profil le permet. |

### 1.2 Réveil groupé (`children-wake.ts`)

- `ChildWake` attend des filles **par mère** dans un seul ensemble (`awaited`, `:25`). Il réveille
  la mère une fois que toutes ont fini **et** qu'elle est au repos : prête, sans file d'attente, sans
  demande en cours (`check`, `:119-151`).
- Il ne réveille que s'il reste une nouvelle de fille non transmise (`childNews`, `:147-150`).
- Il vit **en mémoire** : un redémarrage l'oublie (`:7-8`).
- Les filles lancées par l'utilisateur ne sont jamais attendues (`:7`).

À en retenir : sa logique « toutes ont fini, et la mère est au repos » est la bonne. Mais le
réutiliser tel quel mêlerait l'attente du tour à celle des filles lancées par `start_child`. Son
déclencheur (`childNews`) et son texte (`WAKE_TEXT`, `shared/children.ts:577`, qui parle de branches
et de fusion) ne conviennent pas non plus.

### 1.3 Outils de la mère (`src/main/mcp/children-tools.ts`)

- `start_child` (`:63`, `:197-262`) : une carte d'accord par fille (`context.proposeChild`, `:607`) et
  le plafond vérifié avant la carte (`cannotStart`, `:645-664`). Il exige un dépôt git (`:651-656`).
- `resolveChoice` (`:523-566`) n'accepte un modèle que pour **l'agent de la mère** (`:549-551`). Pour
  un autre agent, il refuse : « takes its last chosen model ».
- `childModelChoice` : l'argument `model` n'est déclaré que si le profil le permet (`:220`). Un
  `model` envoyé quand même est ignoré, avec un avertissement (`:250`, `MODEL_IGNORED`).
- Bornes : `PARENT_MESSAGE_CHARS = 2 × REPORT_CHARS` (`:428`) ; `child_status full` est coupé à
  `FULL_TEXT_CHARS = 40 000` (`:440`).

### 1.4 Rôles (`src/main/roles/`)

- **Lancement d'un rôle** (`launch.ts`) :
  - `nativeMode` pose le mode natif s'il existe ;
  - `readOnlyLevel` (`:39-46`) donne `enforced` si l'agent demande avant d'écrire, et seulement
    `requested` si son profil déclare `writesWithoutAsking` (OpenCode, `profiles.ts:626`), sauf mode
    installé en lecture seule ;
  - `roleFirstMessage` met la demande en tête puis le bloc `<bobine_role>` (`shared/roles.ts:526-539`).
- **Refus d'office** : `permission-answers.ts:144`, si `readOnly` est passé à l'hôte.
  `host-options.ts:140` le passe dès que `record.role?.readOnly`.
- **Garde-fou après coup** : `ReadOnlyWatch` (`read-only-watch.ts`) prend une empreinte git avant le
  message et la compare à la fin du tour. Il ne suit qu'une fille dont `role.readOnly` est vrai
  (`:44-46`). Hors dépôt, l'empreinte n'est pas prise : rien n'est vérifié.
- **Bulles « @Rôle »** (`invoke.ts:62-134`) : une fille par rôle, lancées **l'une après l'autre**
  (`:83-85`), même texte, titre « Rôle · demande » (`:120-122`), au plus `MAX_ROLES_PER_MESSAGE = 10`
  (`shared/roles-ipc.ts:46`). Un rôle refusé n'empêche pas les autres. C'est le précédent le plus
  proche du tour de table.

### 1.5 Fil, carte de groupe et clé de carte

- `RoleRequest` (`shared/role-request.ts:28-44`) : bulle d'une demande, complétée travail après
  travail.
- `workLayout` (`shared/work-groups.ts:76-123`) range sans nouvel état (ADR-0061) :
  - les propositions d'un tour forment une carte de groupe ;
  - une bulle à plusieurs rôles forme une carte de groupe (`:94-104`) ;
  - un lancement dont la clé `card` n'est portée par aucune proposition devient **une carte seule**
    (`:105-111`).

  Donner une clé neuve à chaque participant ferait donc N cartes seules. Il faut apprendre à
  `workLayout` un genre « tour de table » (§ 2.5).
- Rendu : `WorkGroup.tsx` (carte de groupe, avec un total partiel des coûts, `:122-128`),
  `WorkGroupRow.tsx` (ligne d'un travail) et `WorkCard.tsx` (carte-réponse). Ces composants masquent
  déjà la fusion pour un travail en lecture seule (`WorkGroupRow.tsx:218`, `WorkMerge.tsx:81`,
  `WorkFoot.tsx:468`). `ChildProposals.tsx` (cartes d'accord) servira au lancement par l'agent,
  après la v1.

### 1.6 Contextes joints par l'hôte (`AgentHost`)

- **Ordre des blocs à chaque message** (`agent-host.ts:594-601`) : demande `/split` (`CHILDREN_REQUEST`),
  `extraContext`, autres dossiers, `originContext(from)`, `options.context`, contexte de session.
- **`extraContext`** (`host-options.ts:176-192`) : échange d'avant une bascule (fiche 108), nouvelles
  des filles (`childContext`), issue des propositions de mémoire, rappel des rôles. Un travail mis à
  la corbeille est écarté (`input.exists`, `:181`).
- **`sessionContext`** (`host-options.ts:194-210`) : capacités, une seule fois par session (fiche
  118), et index de la mémoire.
- **`originContext`** (`shared/children.ts:587-608`) : dit à l'agent d'où vient un message (mère,
  fille). Le réveil n'en a pas.
- **`PromptOptions.context`** (`agent-host.ts:227-236`) : texte envoyé à l'agent sans paraître dans le
  fil. **Il lève si l'agent répond** (`:516`) : on ne peut s'en servir qu'au repos.
- **`/split`** : `PromptOptions.askChildren` → `CHILDREN_REQUEST` (`shared/children.ts:872-881`). Le
  gestionnaire refuse si la session n'a pas `start_child` (`manager.ts:693`). Côté renderer :
  `app-commands.ts:121`. `/btw` (aparté) ouvre au contraire une interface à part (`:125`).
  `/roundtable` tient des deux : une commande de la saisie, avec une ligne dans la saisie, sous la
  question.

### 1.7 Plafonds et ressources

- **`maxChildren`** : 5 par défaut, de 1 à 10 (`shared/preferences.ts:243`, `:263`). Ce sont les filles
  « en cours » ou « en attente » (`activeChildren`, `shared/children.ts:523`), plus les préparations
  (`children.ts:383-396`).
- **`maxLive`** : 6 par défaut, de 2 à 12 (`preferences.ts:246`, `:265`). Limite **souple** : une fille
  en cours ou une mère qui attend n'est jamais mise en veille (`manager.ts:1356-1362`).
- **Mémoire** : environ 300 Mo par agent vivant, mesurés pour Bob 2.0.6 et OpenCode 2.0.32 (fiche
  102, § Mesure). **Lot 0** ([rapport](recettes/2026-11-24-tour-de-table-lot0.md), O12 et B6) :
  Bob 2.1.0 ≈ 230 Mo d'empreinte physique (RSS 285 Mo), mais OpenCode 2.3.0 lance **deux
  processus** par agent (`opencode acp` et `opencode serve --stdio`), ≈ 360 Mo d'empreinte
  (RSS ≈ 650 Mo). Un tour à 5 participants OpenCode, avec une mère OpenCode, garde donc 6 agents
  vivants, soit environ **2,2 Go** d'empreinte (≈ 3,9 Go en RSS), hors serveurs de langage d'un vrai
  projet, et met en veille les autres conversations au repos.
- **Plafond de coût par conversation** (`conversations/cost-cap.ts`, ADR-0035), désactivé par
  défaut (`shared/preferences.ts:248`). Son fonctionnement avec les filles, et donc avec le tour de
  table, est détaillé au § 2.6.

### 1.8 Consommation

- **Ce que rapporte chaque profil** (fiches 109, 266, `docs/acp.md` § « Questions, plan et
  consommation ») :
  - OpenCode rapporte les jetons du tour (`usage`) et un coût en USD (`usage_update.cost`) ;
  - Bob ne rapporte **rien par ACP**. Ses bobcoins sont lus dans sa base locale après la réponse
    (`costSource: bobDbCosts`, `profiles.ts:556`) ;
  - l'agent factice rapporte ce qu'on lui demande (`--sans-usage`, `--sans-cout`, `--cout-bob`).
- **`UsageDigest`** (`shared/usage.ts:299-312`) : résumé par conversation (jetons, coût, gratuité),
  gardé dans l'index (`store.ts:66`). Les fonctions utiles :
  - `digestsPartial` (`:407`) additionne les coûts d'une même unité et compte ceux qui manquent ;
  - `digestsTotal` (`:382`) refuse d'additionner des unités différentes.
- **Journal** (`usage/journal.ts`, `usage-db.ts:21-56`) : une ligne par tour, avec `parent_id` pour
  une fille (`:25`), le modèle, les jetons et le coût. C'est la source de « Mon activité » (fiche
  144). Les participants y figurent déjà comme filles de la mère. Le tour de table n'y touche pas
  en v1.

### 1.9 Destination des données (fiche 108)

`destinationOf` (`conversations/handover.ts:34`) dit où partent les messages, dans cet ordre :

1. le fournisseur déclaré, nom et adresse ;
2. sinon le préfixe du modèle ;
3. sinon la phrase du profil (Bob : « le service en ligne d'IBM Bob, facturé en bobcoins ») ;
4. sinon « le modèle par défaut ».

Le tour de table envoie la même question à **plusieurs** destinations : le menu des participants
montre l'agent de chacun, et l'infobulle de « N participants » dans la ligne du tour de table donne
la destination complète de chacun, comme « Continuer avec » (fiche 108, point 5).

### 1.10 Famille, corbeille, archivage

- **Archivage** : une fille est archivée avec sa mère et en ressort avec elle (`archivedWith`,
  `family.ts:43-52`).
- **Suppression** de la mère : ses filles sont supprimées avec elle, ou détachées
  (`family-delete.ts:39`, fiche 228).
- **Corbeille** : un travail mis à la corbeille ne réveille plus la mère et n'est plus transmis
  (`exists`, fiche 272 ; `children-wake.ts:145-147`, `host-options.ts:181`).

Un participant, s'il est une fille, a tout cela sans rien écrire.

## 2. Réponses aux questions

### 2.1 N filles en lecture seule sur des modèles différents du même agent OpenCode, en parallèle

**Est-ce déjà possible ?** Oui, à un détail près : le modèle n'est pas imposé de façon sûre.

- **Un processus par fille.** Chaque conversation a son `AgentHost` (`manager.ts:1321`), qui lance
  son propre processus.
- **Côté utilisateur** (`conversation:startChild`, `ChildStartRequest`, `shared/children.ts:51-63`) :
  `start` accepte un `profileId` et un `model` pour tout profil qui a `childModelChoice`
  (`children.ts:252`). Rien n'oblige ce modèle à être celui de la mère.
- **Côté agent** : `resolveChoice` ne connaît que le réglage `model` de la mère (`children-tools.ts:549`).
- **En parallèle.** Les lancements sont mis en ordre par mère (`launchTurn`, `children.ts:459-472`),
  mais seule la pose dans le fil est sérialisée : chaque agent démarre et répond en parallèle. Une
  fille en lecture seule ne crée pas de worktree, donc pas de `git worktree add` concurrent.

**Limites**

| Limite | Valeur | Effet sur un tour |
|---|---|---|
| `maxChildren` | 5 (1–10) | Les participants en cours comptent comme des filles. Un tour à 5 participants demande 5 places libres. Les autres filles en cours de la mère les prennent. |
| `maxLive` | 6 (2–12) | Limite souple : les participants en cours et la mère qui attend restent vivants (`keepLive`). Les conversations ordinaires au repos sont mises en veille. |
| Mémoire | environ 300 Mo par agent (fiche 102) ; OpenCode 2.3.0 ≈ 360 Mo d'empreinte, deux processus (lot 0, O12) | Avec OpenCode : de 3 participants + 1 mère ≈ 1,5 Go à 5 + 1 ≈ 2,2 Go d'empreinte. Ce que le projet ajoute n'est pas compté (serveurs de langage d'OpenCode, MCP de l'utilisateur). |
| Places du tour | 2 à 5 (décision) | Bornées par `min(5, maxChildren − filles actives)`. **Vérification atomique** : refuser tout le tour s'il manque des places, et le dire sur la ligne du tour de table. Ne jamais lancer 3 participants sur 5. |
| Une seule génération | `children.error.oneLevel` | Pas de tour de table depuis une conversation fille ; un participant ne peut pas lancer de filles. |

Une fois au repos, un participant peut être mis en veille comme toute conversation. La réplique le
rouvre ensuite (`session/load` ou `resume`, que Bob et OpenCode annoncent) : `deliver` → `prompt` →
`ensureLive`.

**Comment le modèle d'une fille est-il fixé ?** Par **l'option de configuration ACP** de catégorie
`model` (`session/set_config_option`), après `ready` (`children.ts:941-942` → `applyModel`).

- Ce n'est **pas** `session/set_model` : la méthode instable n'est utilisée nulle part. Les réglages
  sont génériques (`session-controls.ts`, fiche 013).
- OpenCode expose « Model » ainsi (`docs/acp.md`, § Compatibilité OpenCode, ligne « Réglages »). Son
  modèle par défaut peut changer juste après `session/new` (`config_option_update`) : il faut donc
  vérifier après coup.
- Pour le tour de table, `applyModel` doit devenir **strict** :
  - une erreur de `session/set_config_option` met le participant en erreur, sans repli. OpenCode
    2.3.0 refuse un modèle inconnu par `-32602` « Invalid params: model not found: <id> » et **garde
    le modèle précédent** : sans mode strict, le participant répond avec le modèle par défaut (vu au
    lot 0, O3) ;
  - relire `snapshot.controls` après l'appel **et après les `config_option_update` qui suivent** :
    la réponse à un réglage peut porter la valeur précédente quand deux réglages se suivent (lot 0,
    O5) ; ne poser qu'un réglage de modèle à la fois ;
  - si la valeur courante n'est pas celle demandée, le participant est en erreur « modèle non
    appliqué » **avant** l'envoi de la question.

  Sans cela, deux participants peuvent répondre avec le même modèle et la synthèse comparerait un
  modèle à lui-même. OpenCode ne dit jamais, pendant ou après le tour, quel modèle a répondu (ni
  `usage`, ni `usage_update`, lot 0, O6) : la vérification ne peut se faire qu'avant l'envoi.
- **Le catalogue change.** Les modèles gratuits annoncés par OpenCode ont changé entre deux
  lancements à une minute d'intervalle (cache vide, puis catalogue à jour ; lot 0, O4). Un
  participant retenu dans les préférences peut donc disparaître : le mode strict le dit au
  lancement (« modèle introuvable »).
- **Plusieurs processus.** 3 puis 5 `opencode acp` lancés ensemble dans le même dossier, sur le même
  stockage, chacun avec son modèle : tous prêts en moins de 0,6 s, aucun conflit ni erreur, les 5
  réponses obtenues (lot 0, O1).

**Profil sans choix de modèle (Bob)**

- `childModelChoice` est absent (`profiles.ts:161`, pas déclaré pour Bob) : un `model` est refusé
  (`children.ts:252-254`).
- Un participant Bob est donc « Bob, avec son modèle ». Rien de plus n'est supposé : Bob n'expose
  pas de réglage de modèle par ACP (`docs/acp.md:169`).
- **Règle générique**, sans code propre à Bob : un profil sans choix de modèle n'a **qu'une place**
  par tour. Deux participants identiques n'apportent pas d'avis indépendant sur un autre modèle. La
  règle se lit sur `ProfileSummary.childModel` (`profiles.ts:710`), comme ailleurs.
- Le menu des participants affiche alors « IBM Bob », une seule fois.

**Les participants, dernier choix retenu.** Ils vivent dans les préférences
(`roundtableParticipants: { profileId; model? }[]`, 0 à 5 entrées, vérifiées au chargement),
écrites à chaque case cochée ou décochée dans le menu à cases de la saisie. Il n'y a ni bouton
« Enregistrer » ni entrée dans les Réglages. Avec moins de deux entrées, la ligne dit « Choisir
les participants ▾ » et Entrée ouvre le menu au lieu d'envoyer. Une entrée dont le profil n'existe
plus est signalée sur la ligne ; rien ne part avec moins de deux participants. La présence du modèle n'est pas vérifiée à l'avance : le mode strict s'en charge au
lancement.

### 2.2 Indépendance

**Comment garantir qu'un participant ne voit pas les autres avis ?** C'est le comportement naturel
d'une fille :

- elle a sa propre session ACP, dans son propre processus ;
- elle ne reçoit que son premier message ;
- `CHILDREN_REQUEST` le dit même à l'agent : « a child does not see this conversation »
  (`shared/children.ts:876`).

Trois fuites possibles, à fermer :

1. **Le dossier partagé.** Les participants en lecture seule travaillent dans le dossier de la mère
   (`helpers.ts:391`). Rien n'y est écrit par les autres participants (lecture seule). La mère, en
   revanche, peut écrire pendant le tour : c'est un fait, à ne pas cacher, pas une fuite d'avis.
2. **La mémoire de Bobine** (fiche 182). Un participant qui a l'outil `remember` reçoit l'index de la
   mémoire (`host-options.ts:203-208`) et pourrait y écrire. Le rôle du participant doit donc
   n'avoir **aucune famille d'outils de Bobine** (`role.mcp = []`, `shared/roles.ts:65`). C'est aussi
   moins de contexte, donc moins de coût.
3. **La réplique.** Elle rompt l'indépendance volontairement : c'est son but. Elle ne transmet que la
   synthèse (§ 2.4).

**Quel contexte transmettre ?** Décision D2 de la fiche (2026-11-24) :

- **la question**, telle que tapée après `/roundtable` ;
- **les pièces jointes de la saisie** (fichiers, images, `@mentions`) ;
- **le dernier échange** de la mère, s'il existe : dernier message et dernière réponse, rendus par
  `conversationText` (`shared/branch.ts:59`, utilisé par la bascule de la fiche 108), bornés à
  8 000 caractères. Pas de case à cocher : l'infobulle de « N participants » le dit ;
- **une consigne de participant** (rôle figé : avis indépendant, critique, lecture seule, réponse
  structurée en cinq rubriques, 400 mots au plus, langue de la question).

Le participant lit lui-même le code du dossier, en lecture seule. **Ne pas** joindre tout l'échange
de la mère : le coût serait multiplié par N, et les avis orientés vers son cadrage.

**Où ce contexte se construit-il aujourd'hui ?**

- Pour une fille : `ChildConversations.launch` (`children.ts:954-962`), avec `roleFirstMessage`
  (`roles/launch.ts`) et la ligne `IN_PLACE_LINE`.
- Il n'y a **pas de pièces jointes** pour une fille : `prompt(childId, first)` est appelé sans
  `attachments` (`:962`). C'est à ajouter (`ChildRequest.attachments`, passé à `prompt`). Les mêmes
  `PromptAttachment` partent à chaque participant : un agent qui ne prend pas les images les refuse
  à l'envoi (`buildPrompt`, `agent-host.ts:574`), et le participant passe en erreur avec la raison.

### 2.3 Agrégation

**Comment la mère reçoit-elle les réponses complètes ?**

Aujourd'hui, le compte rendu qui part à l'agent de la mère est borné :

- à `REPORT_CHARS = 1200` au total (`shared/children.ts:182`) ;
- à `RECAP_CHARS = 400` pour le début de la réponse (`:173`, `reportLine`, `:458-479`) ;
- l'agent est invité à lire le reste par `child_status full` (40 000 caractères au plus,
  `children-tools.ts:440`).

La carte, elle, garde la réponse entière jusqu'à `REPLY_KEEP_CHARS = 20 000` (`shared/children.ts:148`,
`ChildReport.reply`, `:130`), si la fille a sa carte.

Pour une synthèse critique, 400 caractères par avis ne suffisent pas, et compter sur
`child_status full` dépend du bon vouloir de l'agent. Il y a deux autres obstacles :

- `child_status` n'existe que pour une session « mère » : dépôt git et outils de l'app
  (`children.ts:509-514`) ;
- chez Bob, **chaque appel d'outil MCP demande une autorisation** (`docs/acp.md:267`).

**Forme de la consigne de synthèse**

| Forme | Pour | Contre | Verdict |
|---|---|---|---|
| **Message de l'app** : `prompt(mère, consigne, [], { from: { kind: 'roundtable', … }, context: avis })` | Déterministe. Ouvre un tour (c'est un réveil). Marche avec tout agent, sans outil ni autorisation. Les avis passent dans `context`, invisibles dans le fil, qui affiche une ligne de l'app comme pour le réveil. | `context` lève si la mère répond (`agent-host.ts:516`) : il faut envoyer au repos (même règle que `ChildWake.check`, `children-wake.ts:137-140`) et réessayer si l'utilisateur a tapé entre-temps. | **Retenue** |
| Contexte joint au prochain message (`extraContext`) | Aucun tour en plus. | Rien ne part tant que l'utilisateur n'écrit pas : pas de synthèse automatique. | Non |
| Outil (`roundtable_answers`) | La mère lit à la demande. | Un aller-retour de plus. Rien ne garantit qu'elle l'appelle. Autorisation à chaque appel chez Bob. Exige les outils de l'app. | Non (v1) |

**Détails de la forme retenue**

- **Nouvelle provenance** `MessageOrigin = { kind: 'roundtable'; id; step: 'synthesis' | 'verdict' }`
  (`shared/children.ts:552-558`). `originContext` la laisse sans texte : la consigne suffit, comme
  pour le réveil.
- **Le bloc d'avis** est en anglais (ADR-0014), balisé `<bobine_roundtable>`, un avis par
  participant :
  - avec l'issue (`done`, `stopped`, `error`) et, pour un absent, la raison ;
  - chaque avis coupé à **6 000 caractères**, coupe annoncée (les avis visent 400 mots, soit
    environ 3 000 caractères) ;
  - au plus 5 × 6 000 caractères, soit environ 7 500 jetons (`estimateTokens`, `usage.ts:461`) ;
  - **anonymisés** (décision 11 et D1 de la fiche) : désignés par une lettre (« Participant A »),
    tirée dans un ordre mélangé à chaque tour, sans nom de modèle ni d'agent, sans table des
    lettres pour la mère. La table lettre → participant reste dans l'élément `roundtable` ;
    l'interface s'en sert pour montrer le vrai nom au survol d'une lettre dans la synthèse.
- **La consigne** impose les six rubriques de la fiche (accords ; divergences et pourquoi ; ce que
  je retiens ; ce que je rejette, argumenté ; ce qui reste ouvert ; ma recommandation) et ses
  règles (ne pas compter les voix, ne rien modifier, langue de la question).
- **Ne pas** compter deux fois : les `child-report` des participants doivent être **retirés** de
  `childContext` (filtre dans `extraContext`, `host-options.ts:179-184`, à côté de `exists`). Sinon,
  le prochain message de l'utilisateur emporterait aussi leurs comptes rendus courts, avec la phrase
  « recommend_merge… » (`REPORT_IS_NOT_PROOF`), sans rapport.
- **Retirer aussi** les participants des outils de la mère (`children()`, `children.ts:554-558`,
  utilisé par `findChild` et `child_status`). Le tour reste mené par l'app : un `message_child` de la
  mère vers un participant ajouterait ce participant aux attendues de `ChildWake` et causerait un
  second réveil (`WAKE_TEXT`).

**Quorum et « Synthétiser sans attendre »**

- La synthèse part **d'elle-même** (décision D3 de la fiche) quand tous les
  participants sont terminés (fini, en erreur, arrêté, supprimé) **et** qu'au moins **2** avis
  sont exploitables (fini, réponse non vide), au premier repos de la mère.
- La carte propose « Synthétiser sans attendre » dès 2 avis exploitables, même si d'autres
  participants travaillent encore ; ceux-ci sont arrêtés. Pas de minuterie ni de délai.
- Un participant en erreur compte comme terminé : avec 2 avis exploitables, la synthèse part sans
  geste et nomme l'absent. « Relancer » reste sur sa ligne tant que d'autres travaillent.
- Moins de 2 avis exploitables : pas de synthèse ; la carte le dit et propose « Relancer » sur les
  participants en échec (`reply` avec `retry`), sans autre bouton.
- **La carte se replie en une ligne** à l'arrivée de la synthèse (rendu, renderer : en-tête avec
  les noms et « N avis › », puis la ligne du total) ; un clic la rouvre.

### 2.4 Tour de réplique

**Peut-on le faire avec l'existant ?** Oui, avec `deliver` vers chaque participant, puis un second
regroupement.

- **Envoi** : ni `messageChild` (il pose une `child-instruction` et ajoute aux attendues de
  `ChildWake`, `children.ts:590-603`), ni `reply` (il pose une bulle `role-request` de suite, et
  passe par `findRole` pour un participant jamais démarré, `:786-789`). On réutilise `deliver`
  (`children.ts:881`), qui est privée : elle doit être exposée à l'orchestrateur, ou un
  `ChildConversations.followUp(childId, text, from)` ajouté. Le reste vient de l'existant : envoi
  tout de suite ou en file d'attente, erreur dite dans le fil visé, empreinte de lecture seule
  (`readOnly.prepare`), garde du plafond (§ 2.6).
- **Contenu** : la synthèse entière du tech lead, bornée à 8 000 caractères, la lettre qui désigne
  ce participant (« You are participant B »), et la consigne :
  - « maintiens ou révise ta position, en 200 mots au plus ; ne change d'avis que devant un
    argument ou une preuve, et dis lequel » ;
  - « un seul tour, ne relance pas de question ».

  L'app n'extrait pas les objections : la rubrique « Ce que je rejette » les donne par lettre.
  Chaque participant a déjà son premier avis dans sa session : inutile de le renvoyer. **Ne pas**
  renvoyer les avis entiers des autres : coût N × (N − 1) avis.
- **Second regroupement** : même machine d'états, étape `rebuttal`. Quand tout est terminé et la mère
  au repos : `prompt(mère, consigne de décision, …, { from: { kind: 'roundtable', step: 'verdict' },
  context: répliques })`, répliques bornées et désignées comme les avis.
- **Un seul tour**, garanti par l'état : bouton visible seulement en phase `synthesized`, jamais
  après `rebuttal`. Le main refuse un second appel (vérifie la phase), le renderer ne fait pas foi.
- **Rappel du surcoût**, en gris à côté du bouton : « ≈ N + 1 fois les jetons d'une question
  simple » (N répliques et la décision), calculé sur les participants qui ont répondu. Aucun
  dialogue.

### 2.5 Modèle de données

**Faut-il un nouvel élément de fil, ou réutiliser la carte de groupe avec un « genre » ?** Les
deux, chacun à sa place.

- **Nouvel élément `roundtable`**, posé et **remplacé sur place** par identifiant, comme
  `reduceRoleRequest` (`shared/role-request.ts:53-65`). Il porte ce qui ne se déduit pas des
  filles :

  ```ts
  interface Roundtable {
    roundtableId: string
    question: string
    attachments?: AttachmentView[]          // vues, comme un message (pas le contenu)
    withLastExchange?: true                  // le dernier échange est parti (décision D2)
    seats: {
      childId?: string                       // absent tant que la fille n'est pas créée
      letter: string                         // désignation pour la mère (A, B…), tirée au lancement
      profileId: string
      model?: { controlId: string; value: string; name: string }
      state: 'starting' | 'answering' | 'answered' | 'error' | 'stopped' | 'removed'
      error?: string
    }[]
    phase: 'collecting' | 'synthesizing' | 'synthesized' | 'rebutting' | 'deciding'
         | 'done' | 'stopped' | 'interrupted'
    motherTurns?: { step: 'synthesis' | 'verdict'; usage?: UsageDigest }[]
    at: number
  }
  ```

  ADR-0061 dit « le fil se range sans nouvel état », mais cela vaut pour des travaux indépendants.
  Un tour a une **machine d'états** (quorum, synthèse demandée, réplique faite) qu'on ne peut pas
  relire des `child-report` sans heuristique : d'où l'élément.
- **Les participants sont des filles ordinaires.** Leur `child-started` porte `card: roundtableId`,
  donc `hasCard` est vrai, la réponse entière est gardée et la carte-réponse se rend telle quelle.
- **`workLayout` apprend un genre.** Les lancements dont `card` est l'identifiant d'un `roundtable`
  forment **une carte de groupe ancrée sur l'élément `roundtable`** (`WorkGroupData.roundtable`),
  pas N cartes seules. Les lignes réutilisent `WorkGroupRow`, repliées : une liste, sans vue côte à
  côte. L'en-tête (question), le pied (actions, total consommé) et le sous-titre de chaque ligne
  (agent · modèle, réponse courte, confiance) sont propres au genre. La fusion est masquée d'office
  (lecture seule).
- **La synthèse** est la réponse de la mère au message `from: roundtable`. Elle reste dans le fil de
  la mère, à sa place : c'est sa voix de tech lead. La carte la cite par un lien « Voir la
  synthèse ».

**Persistance.** Tout est dans le fil de la mère et dans l'index : l'élément `roundtable`, les
`child-started` et `child-report` (avec la réponse), le message de synthèse. Les participants sont des
conversations ordinaires de l'historique. Aucun fichier nouveau, aucune migration.

**Rejeu après un redémarrage.** Les agents des filles sont arrêtés et l'attente en mémoire est
perdue (`children-wake.ts:7-8`). Au chargement du fil de la mère, une réconciliation pure,
`settleRoundtable(items, summaries)` :

- un participant encore `answering` sans compte rendu : `stopped` (« arrêté (redémarrage) ») ;
- la phase `collecting` devient `interrupted` ;
- la carte propose « Synthétiser avec k avis » (si k ≥ 2) et « Relancer » sur les participants
  interrompus (chemin `relaunch` / `reply` `retry`) ;
- un message de synthèse déjà parti reste le tour ordinaire de la mère (rejeu ADR-0021).

Rien ne repart seul au redémarrage : jamais de coût non demandé.

**Corbeille**

- **Un participant supprimé** avant la synthèse : son état devient `removed` et il sort de la
  synthèse et de la réplique (même filtre `exists` que la fiche 272). Après la synthèse, son avis
  reste lisible dans la carte (`child-report` gardé dans le fil de la mère).
- **La mère supprimée** : confirmation de famille (fiche 228), participants supprimés avec elle.
  Sinon, ils sont détachés et deviennent des conversations ordinaires : l'élément disparaît avec la
  mère.

**Archivage.** Les participants sont archivés avec la mère (`archivedWith`) et ressortent avec elle.
Réplique et synthèse sont refusées sur une mère ou un participant archivés (même règle que `reply`,
`children.ts:779`).

**Liste latérale.** Décision D4 de la fiche : les participants
apparaissent sous la mère comme des filles, dans la liste imbriquée repliable existante (fiche 095),
sans regroupement en v1. Un regroupement sous une ligne « Tour de table » serait un rendu
(renderer), pas un état : à décider après la recette.

### 2.6 Coût

#### Ce que chaque profil donne

| Profil | Jetons | Coût | Moment | Source |
|---|---|---|---|---|
| OpenCode | ✓ par tour (`usage`) | ✓ USD, estimation de l'agent (« ≈ ») ; 0 pour un modèle gratuit ou un abonnement (« non communiqué », fiche 266) | fin de tour | ACP |
| Bob | ✗ | ✓ bobcoins | **après** la réponse (relu jusqu'à 1,5 s après) | base locale `~/.bob/db/bob.db`, en lecture seule (ADR-0015) |
| Agent factice | selon option | selon option (`--devise`, `--cout-bob`, `--sans-usage`) | réglable | scénario |
| Profil personnalisé sans `usage` | ✗ | ✗ | — | — |

#### Avant l'envoi : un multiplicateur de jetons, pas d'estimation

Décision de l'utilisateur : aucune estimation, ni en argent, ni en nombre de jetons. La ligne du
tour de table dit seulement « N participants ▾ + synthèse · ≈ N + 1 fois les jetons d'une question
simple » (en anglais « + synthesis · ≈ N+1× the tokens of a plain question »), en gris, sur une
ligne ; en saisie étroite, la forme courte « ≈ N + 1 fois plus de jetons ». C'est un calcul sur le
nombre de participants (renderer), sans canal ni lecture du journal. Les destinations sont dans
l'infobulle.

#### Coût réel du tour

`total = Σ participants + Σ tours de la mère marqués « roundtable »`.

- **Participants.** Le `UsageDigest` de leur conversation (index, `store.ts:66`) couvre tous leurs
  tours : avis **et** réplique, puisqu'un participant ne sert qu'au tour. Mis à jour en direct comme
  les cartes de filles (fiche 117). Ce que l'utilisateur échange ensuite dans la conversation d'un
  participant s'y ajoute ; le total le compte, sans le distinguer (rare, et visible dans la
  conversation).
- **Mère.** Seuls ses tours ouverts par `from: roundtable` (synthèse, décision). À la fin d'un tel
  tour, l'orchestrateur relève le `TurnUsage` du tour (`usage.turns`, `costEnd − costStart`, fiche
  109) dans `motherTurns`. Il le réécrit sur un `usage-report` tardif (Bob), comme le journal le fait
  déjà (`journal.ts:9-11`).
- **Pied de la carte**, une ligne : jetons et coûts **par unité**, jamais additionnés entre unités
  (`digestsTotal`, `usage.ts:382-393` ; `digestsPartial`, `:407`, déjà utilisé par
  `WorkGroup.tsx:122`), avec le nombre de participants sans chiffre. Exemple : « Consommé : 182 000
  jetons · ≈ 0,04 $US + 0,6 bobcoin ».
- **« Mon activité »** : reporté après la v1. Regrouper un tour demanderait une migration du journal
  (colonne `roundtable_id`, `usage-db.ts:21`), remplie au `user-message`. Ce n'est pas simple ; en
  attendant, les participants comptent déjà comme filles de la mère (`parent_id`).

#### Plafond par conversation, inchangé

Pas de plafond propre au tour, pas de réglage, pas de migration. Le gardien existant s'applique à
chaque conversation du tour, séparément :

- **Un gardien unique, pour toutes les conversations**, filles comprises : créé dans
  `src/main/index.ts:697`, abonné au gestionnaire (`conversations/cost-cap.ts:90`).
- **Figé au premier message** : à l'évènement `user-message` (`cost-cap.ts:178`), si le réglage est
  activé, `freeze` pose `cost-cap-set: 'settings'` dans le fil (`cost-cap.ts:219-231`). Le premier
  message d'une fille suit ce chemin (`launch` → `this.conversations.prompt(childId, first)`,
  `children.ts:962`, où `conversations` est le gestionnaire, `children.ts:143-146`, `:183` ;
  évènement émis par `agent-host.ts:607-608`). Chaque participant né avec le réglage activé a donc
  son propre plafond, au montant des réglages ; le réglage est désactivé par défaut
  (`shared/preferences.ts:248`).
- **Dépense comptée** : celle de la conversation seule (`spentIn`, `shared/cost-cap.ts:84-89`,
  plafond effectif `effectiveCap`, `:100-109`). Le coût des filles ne remonte pas dans celui de la
  mère ; seul l'aparté s'y ajoute (`shared/transcript.ts:409-410`).
- **Franchi pendant un tour**, sans outil en cours : `session/cancel` et carte « Plafond atteint »
  à la fin du tour, dans le fil de cette conversation (`cost-cap.ts:202-216`, `:179-190`).
- **Tout envoi passe par la garde** (`promptGate`, `manager.ts:664-672`, chaîné à
  `cost-cap.ts:86-89`) : un message vers une conversation au plafond est retenu, avec la carte.
  C'est le cas des messages de l'app vers une fille (`deliver` → `prompt`, `children.ts:897`) et
  vers la mère. « Continuer » renvoie le message retenu avec ses options, `from` et `context`
  compris (`cost-cap.ts:133-134`).

Effets sur le tour, sans nouvelle interface :

- participant au plafond pendant son avis : tour interrompu ; l'orchestrateur le voit comme un
  participant arrêté, avec la raison « plafond atteint » (lue de l'élément `cost-cap` de son fil) ;
- synthèse ou décision retenue au plafond de la mère : la carte habituelle est dans le fil de la
  mère ; l'élément reste en `synthesizing` et la carte du tour dit « retenue par le plafond » ;
  « Continuer » l'envoie ;
- réplique retenue au plafond d'un participant : sa ligne dit « réplique retenue : plafond
  atteint » ; la carte « Plafond atteint » est dans sa conversation.

L'orchestrateur doit seulement reconnaître ces deux cas (tour annulé par le gardien, message
retenu) pour ne pas attendre indéfiniment ; aucun réglage ni code de plafond n'est ajouté.

### 2.7 Pannes

| Panne | Ce qui existe | Pour le tour |
|---|---|---|
| Agent qui ne démarre pas (connexion, licence, dossier non approuvé) | `launch` → compte rendu en erreur et `startFailure` (`children.ts:967-1010`) | Participant `error`, avec la raison ; « Relancer » (`reply` `retry`, `children.ts:781`) |
| Modèle non appliqué | Repli silencieux (`children-review.ts:821-828`) | **Strict** : participant `error` « modèle non appliqué », question non envoyée ; « Choisir un autre modèle » ouvre le menu des participants, pour les tours suivants |
| Modèle refusé au message (`-32603`) | `modelRefusedAtTurn` d'OpenCode (`profiles.ts:657`), « Model unavailable » et quota gratuit relevés (`docs/acp.md:414-415`) | `turn-error` → participant `error`, la raison du profil ; « Relancer » |
| `-32603` « Server Error » de Bob au travail | **Non relevé de façon stable** (attendre la trace réelle) | Erreur de tour ordinaire, aucune nouvelle tentative supposée |
| Silence | Bandeau de silence (fiche 194, `silence-watch.ts`) dans le fil du participant | Ligne « silencieux depuis 3 min » (lue du même état) ; « Synthétiser sans attendre » si deux avis sont là, ou « Arrêter » sur la ligne |
| Arrêt par l'utilisateur | ■ dans le fil du participant ; `turnStopped` (fiche 258) | « Arrêter le tour de table » : annule tous les participants en cours, phase `stopped`, sans synthèse |
| Plafond par conversation | `CostCapGuard` (§ 2.6) | Participant arrêté ou message retenu, carte habituelle dans la conversation concernée |
| Écriture malgré la lecture seule | Refus d'office (`enforced`) ou garde-fou après coup (`requested`, OpenCode) | Participant marqué « a modifié le dossier » (alerte de `ReadOnlyWatch`), dit aussi à la mère dans le bloc d'avis |
| Mère occupée quand les avis sont là | `ChildWake` attend le repos | Même règle : « synthèse en attente : l'agent répond » ; envoi au premier repos |
| Mère supprimée ou archivée pendant le tour | Fiches 228, 272 | Tour abandonné, participants arrêtés avec la famille |
| Redémarrage de l'app | Agents arrêtés | `interrupted` (§ 2.5) |

### 2.8 Lancement par l'agent, après la v1

Recommandation : un **outil dédié `propose_roundtable`**, pas une extension de `start_child`.

- **Contrat différent.** N participants, lecture seule imposée, synthèse par l'app, réveil propre.
  Une extension de `start_child` (déjà la plus longue description d'outil,
  `children-tools.ts:63-87`, payée en contexte à chaque session) brouillerait les deux usages.
- **Pas besoin de git.** `start_child` exige un dépôt (`cannotStart`, `:651`) ; un tour de table en
  lecture seule n'en a pas besoin.
- **Même carte d'accord.** Une élicitation, comme `proposeChild`, rendue par une variante de
  `ChildProposals`. Elle reprend la ligne du tour de table (participants retenus, multiplicateur de
  jetons, destinations). Rien ne part sans l'utilisateur.
- Arguments : `question` et, au plus, une raison ; les participants sont ceux retenus par
  l'utilisateur. Un choix de participants par l'agent viendrait plus tard, avec `resolveChoice`
  étendu aux modèles **vus** d'un autre agent (`modelsSeen`, fiche 108).
- Donné seulement à une conversation qui n'est pas une fille, ni un participant.
- Chez Bob, chaque appel d'outil MCP demande une autorisation (`docs/acp.md:267`) : la carte
  d'accord en tient lieu, rien de plus n'est supposé.

### 2.9 Compatibilité Bob

**Observé ou documenté, et utilisé par le tour**

- **Pas de réglage de modèle par ACP** (`docs/acp.md:169`, `docs/agents.md`, ligne `child-model`) :
  un participant Bob, son modèle.
- **Rien de consommé par ACP.** Bobcoins par tâche dans `~/.bob/db/bob.db`, relus après la réponse
  (fiche 109). Le total du pied de la carte les montre tels quels, sans « ≈ » (fiche 245).
- **`loadSession`, `resume`, `close`, `delete`** annoncés : la réplique après une mise en veille
  rouvre la session.
- **Demande d'autorisation pour écrire.** Refusée d'office pour un rôle en lecture seule : niveau
  `enforced`, puisque Bob n'est pas `writesWithoutAsking`.
- **`session.maxTurns` compté sur toute la session** (`docs/acp.md:240`) : sans effet sur un
  participant neuf, qui fait un avis et une réplique.
- **Authentification refusée au message** : `-32603` « Invalid or expired API key »
  (`authAtTurn`) → carte de connexion dans le fil du participant ; participant `error`.
- **Modes** : `_meta["bob/mode"]` à `session/new` ne sert qu'à `plan` / `agent` (`initialModeMeta`,
  `profiles.ts:563`). Un mode natif en lecture seule installé par Bobine (`bob-custom-modes.ts:48`,
  groupes `[read, mcp]`) se poserait après coup, comme pour tout rôle (`nativeMode`). Pas
  indispensable : le refus d'office suffit.
- **Plafond par conversation** : coût connu après la réponse ; le gardien pose alors la carte sans
  interrompre (`capDecision` → `ask`, `shared/cost-cap.ts:192`). Un avis de Bob n'est donc jamais
  coupé par le plafond ; seul le message suivant (réplique) est retenu.

**Observé au lot 0** (Bob 2.1.0, [rapport](recettes/2026-11-24-tour-de-table-lot0.md), B1 à B6)

- **Deux `bob acp` en même temps**, même dossier, même `~/.bob` : tous deux prêts en 0,7 s, aucune
  erreur, `tasks.locked_by` resté vide. Seul partage relevé : un même fichier de journal pour deux
  processus lancés dans la même seconde.
- **Coûts par tâche** : une ligne `tasks` par session, coût juste pour chacune, définitif dès la fin
  du tour ; ≈ 0,07 bobcoin pour une question qui lit un fichier.
- **Débit** : 4,6 et 4,7 s à deux, 4,66 s seul ; aucune erreur.
- **Lectures sans autorisation** avec les réglages par défaut (groupe `read` permis) : `glob` et
  `read` passent sans `session/request_permission`. Un participant Bob ne bloque pas sur des cartes
  pour lire.
- **Écriture refusée** : `failed`, « Tool call to write_file was cancelled: Rejected by user »,
  puis `end_turn` ; rien d'écrit.

**Non observé, rien n'est supposé**

- **Débit** au-delà de deux tâches, et la forme d'une limite de débit de la passerelle IBM (429 non
  relevé, `docs/acp.md:260`).
- **Lectures avec le groupe `read` retiré** des réglages de Bob : un participant Bob passerait alors
  par des cartes d'autorisation dans son fil, qui ne sont pas refusées (seuls `edit`, `delete`,
  `move`, `execute` le sont).
- **Le `-32603` « Server Error »** vu au travail : en attente d'une trace réelle (pas survenu au
  lot 0).

**Scénarios d'agent factice** pour ces comportements : `--sans-options` (pas de modèle), `--cout-bob`
(coût après coup), `role-ecrit-avec-demande` (écriture refusée), `connexion-expiree-bob`.

### 2.10 Essais

**Agent factice : à ajouter** (`docs/mock-agent.md`)

1. **Comportement selon le modèle**, indispensable : tous les participants d'un même profil
   partagent la même variable `MOCK_AGENT_SCENARIO`. Nouvelle option `MOCK_AGENT_SCENARIO_BY_MODEL`
   (`factice-rapide=avis-court,factice-precis=erreur`) : le scénario joué dépend du modèle courant
   de la session. Sans elle, impossible d'avoir un participant en panne et un autre sain dans le
   même essai.
2. **Scénario `tour-de-table-recu`.** Il dit ce que l'agent a reçu :
   - pour un participant : question, pièces jointes, dernier échange, consigne de participant,
     lecture seule, et **aucun autre avis**, ce qui prouve l'indépendance ;
   - pour la mère : nombre d'avis dans `<bobine_roundtable>`, lettres, coupes, étape.
3. **`MOCK_AGENT_REFUSE_MODEL=<valeur>`** : `session/set_config_option` refusé pour ce modèle, pour le
   mode strict.

Déjà là : `modele-indisponible`, `quota-gratuit`, `muet`, `lent`, `silence-annulable`, `erreur`,
`--sans-usage`, `--cout-bob`, `--devise`, `role-ecrit-sans-demander`, `BOBINE_MOCK_PEER=1` (un second
agent), `MOCK_MODELS` (plus de modèles). Le total par unité s'essaie avec ces options, sans option
nouvelle.

**Unitaires**

- Réducteur et réconciliation de `roundtable`.
- `workLayout` (genre tour de table).
- Machine d'états de l'orchestrateur : quorum, « Synthétiser sans attendre », synthèse au repos,
  réessai si la mère est occupée, réplique unique, arrêt, redémarrage, message retenu ou tour
  annulé par le plafond par conversation.
- Bloc d'avis : coupes à 6 000 caractères, lettres et mélange, absents, anglais.
- Dernier échange : bornes, conversation vide.
- Exclusion des participants de `childContext` et des outils de la mère.
- `applyModel` strict.
- Vérification atomique des places.
- Préférence `roundtableParticipants` : lecture, bornes, profil disparu.
- Total du pied : unités mêlées, participant sans chiffre, coût Bob tardif.

**Composants** : ligne du tour de table (participants, multiplicateur de jetons et sa forme
courte, places manquantes, participant indisponible, premier usage « Choisir les participants ») ;
menu à cases (2 à 5, une seule place pour un profil sans modèle, choix retenu à chaque case, aucun
modèle mis à part) ; carte dans chaque phase (collecte, partiel, deux avis, synthèse en attente ou
retenue, synthétisé et replié, réplique, décision, `interrupted`, `stopped`) ; lettres de la
synthèse et leur infobulle ; ligne du total (connu, partiel, unités mêlées).

**e2e**

- Suite `tour-de-table`, en clair, en sombre et `--lang en`.
- Journée `parcours-tour-de-table` (fiche 277), qui enchaîne dans une même instance :
  1. `/roundtable` sans participant retenu : Entrée ouvre le menu, trois cases cochées (deux
     modèles factices et l'agent factice B), dont un au modèle refusé, puis Entrée envoie ;
  2. carte, avis, synthèse automatique malgré le participant en erreur, carte repliée, total au pied
     de la carte ;
  3. réplique, décision ;
  4. second `/roundtable` en deux gestes (ligne, Entrée) ; redémarrage pendant la collecte →
     `interrupted` → « Synthétiser avec 2 avis » ;
  5. plafond par conversation activé et bas : participant arrêté au plafond, synthèse retenue puis
     « Continuer » ;
  6. un participant mis à la corbeille ;
  7. mère archivée puis rouverte.

  Après chaque étape, le journal du main ne montre aucune erreur (`e2e/parcours.mjs`).

## 3. Architecture cible

### 3.1 Options comparées

| | **A. Surcouche des filles** (recommandée) | **B. Orchestrateur dédié** (hôtes éphémères, façon aparté) | **C. Tout par l'agent de la mère** (`/split` + consigne) |
|---|---|---|---|
| Principe | Un participant est une fille en lecture seule (`ChildConversations.start`, rôle figé fourni par le code, `card = roundtableId`). Un module `roundtable/` tient la machine d'états dans un élément du fil. | Un `AgentHost` par participant, hors conversation, comme `aside.ts` (session neuve, tout refusé, coût ajouté à la mère par `withAsideCost`, `shared/usage.ts:108`). Tout l'état dans un nouveau module. | `/roundtable` joint une consigne : « appelle `start_child` N fois en lecture seule, puis synthétise ». L'app ne fait rien de plus. |
| Lecture seule | Acquise (`enforced`, `ReadOnlyWatch`, refus d'office) | À refaire. L'aparté refuse tout, lectures demandées comprises : un avis sans lecture du code est faible. | Dépend de l'agent |
| Modèle par participant | `model` de `ChildRequest`, à rendre strict | À écrire | Seulement le modèle de la mère (`resolveChoice`) |
| Persistance, reprise | Fil et index existants ; réconciliation pure | **En mémoire** (comme l'aparté) : rien après un redémarrage, ni réplique après une mise en veille | Comptes rendus existants |
| Ouvrir un participant | Oui, c'est une conversation | Non | Oui |
| Coût par participant, total | Acquis (`UsageDigest`, `digestsPartial`) | À refaire (lignes `aside`) | Acquis, non regroupé |
| Plafond par conversation | S'applique tel quel à chaque participant | Ne s'applique pas aux hôtes éphémères | S'applique tel quel |
| Corbeille, archivage, famille | Acquis | Sans objet (rien de visible) | Acquis |
| Liste latérale | N filles de plus | Rien | N filles |
| Déterminisme | L'app décide, l'agent écrit seulement la synthèse | Idem | **Aucun** : l'agent peut oublier un participant, ne pas attendre, ne pas synthétiser. Comptes rendus bornés à 1 200 caractères. Carte d'accord à chaque `start_child`. Dépôt git exigé. |
| Bob | Participant générique | Idem | Bob ne choisit pas de modèle ; autorisation à chaque outil |
| Risque de régression | Moyen : on touche `children.ts`, `work-groups.ts`, `host-options.ts` (filles très utilisées) | Faible sur l'existant, fort sur le neuf | Faible |
| Taille | L + M + S + M (lots 1 à 4) | L à XL | S |

**Pourquoi A**

- Fiabilité : la lecture seule, la reprise, les coûts, le plafond par conversation, la famille et
  les pannes de démarrage sont déjà éprouvés par les recettes 1.0 et 1.1.
- Simplicité : un élément de fil et un module d'orchestration de quelques centaines de lignes, plutôt
  qu'un second moteur d'agents.
- Le participant reste une conversation qu'on peut ouvrir. C'est utile pour comprendre un avis
  étrange, et c'est l'esprit de la fiche 260 : « une demande, une réponse ».

**Ce que A coûte**

- Des points d'entrée à généraliser dans `children.ts` : `deliver` exposé, pièces jointes, modèle
  strict, places réservées ensemble.
- Des exclusions à ne pas oublier : `childContext`, outils de la mère, `ChildWake`.

### 3.2 Modules

**Nouveaux**

| Module | Rôle |
|---|---|
| `src/shared/roundtable.ts` | Types (`Roundtable`, `RoundtableSeat`, `RoundtableStartRequest`), réducteur (remplacement sur place), `settleRoundtable` (rejeu), `roundtableBlock` (bloc d'avis en anglais, lettres, coupes), consignes (`PARTICIPANT_ROLE`, `SYNTHESIS_TEXT`, `REBUTTAL_TEXT`, `VERDICT_TEXT`), quorum (`usableAnswers`), `participantIds(items)` (pour les exclusions), `roundtableTotal` (total par unité), `parseRoundtableStartRequest`. |
| `src/main/roundtable/roundtable.ts` | Orchestrateur `Roundtables` : `start`, suivi des participants (abonné aux évènements comme `ChildConversations.onEvent`), synthèse au repos, réplique, décision, arrêt, réconciliation au chargement, prise en compte du plafond par conversation (tour annulé, message retenu). Dépend de `ChildConversations` (start, followUp, places) et du gestionnaire (`post`, `prompt`, `view`, `cancel`, `state`). |
| `src/main/roundtable/ipc.ts` | Gestionnaires des canaux ci-dessous, avec arguments vérifiés. |
| `src/renderer/src/components/roundtable/RoundtableLine.tsx` | Ligne dans la saisie, sous la question : « N participants ▾ », multiplicateur de jetons (forme courte en saisie étroite), infobulle des destinations, places manquantes, premier usage. |
| `src/renderer/src/components/roundtable/RoundtableParticipants.tsx` | Menu à cases des participants (2 à 5), sur le modèle du menu de modèle ; écrit la préférence à chaque case. |
| `src/renderer/src/components/thread/RoundtableCard.tsx` | En-tête et pied du genre (actions, total consommé) ; lignes par `WorkGroupRow`. |

**Touchés**

| Module | Changement |
|---|---|
| `conversations/children.ts` | `ChildRequest.attachments` ; `model` strict (option) ; réservation de N places en une fois ; `followUp` (expose `deliver`) ; `children()` sans les participants ; rien d'autre. |
| `conversations/children-review.ts` | `applyModel` rend s'il a appliqué (le repli reste pour les autres usages). |
| `conversations/host-options.ts` | `extraContext` : filtre des participants dans `childNews`. |
| `conversations/store.ts` | `record.roundtable?: { id; seat }` vérifié au chargement (exclusions, rangement). |
| `shared/children.ts` | `MessageOrigin` de genre `roundtable`. |
| `shared/transcript.ts` | Élément et évènement `roundtable`. |
| `shared/work-groups.ts` | Genre « tour de table » dans `workLayout`. |
| `shared/app-commands.ts`, `renderer/app-commands.ts` | `/roundtable` (ligne dans la saisie, envoi par Entrée). |
| `shared/preferences.ts` | `roundtableParticipants` (dernier choix du menu), sans entrée dans les Réglages. |
| `shared/ipc.ts`, preload, `read-only-guard.ts` | Canaux, classés (sûrs ou non). |
| Locales `fr.json` / `en.json`, `docs/mock-agent.md`, `src/mock-agent/` | Textes, scénarios. |

Non touchés en v1 : `conversations/cost-cap.ts`, `usage/` (journal, « Mon activité »),
`mcp/children-tools.ts` (`propose_roundtable` après la v1).

### 3.3 Canaux IPC

| Canal | Arguments → résultat | Sûr en lecture seule (fiche 196) |
|---|---|---|
| `roundtable:options` | `motherId` → profils disponibles, modèles par profil (`snapshot` de la mère, `modelsSeen`, modèles refusés de la fiche 210), places libres, destinations | oui |
| `roundtable:start` | `motherId, RoundtableStartRequest` → `{ roundtableId }` ou erreur (places, participant invalide, profil sans modèle en double, tour déjà en cours) | non |
| `roundtable:synthesize` | `motherId, roundtableId` → `void` (« Synthétiser sans attendre », quorum vérifié au main) | non |
| `roundtable:rebuttal` | `motherId, roundtableId` → `void` (phase vérifiée) | non |
| `roundtable:stop` | `motherId, roundtableId` → `void` | non |

Le choix des participants s'enregistre par le canal des préférences existant. Les changements de l'élément arrivent
par le flux d'évènements existant : aucun canal d'abonnement nouveau.

### 3.4 Évènements du fil

| Évènement | Posé par | Effet |
|---|---|---|
| `roundtable` (`Roundtable` complet, remplacé par `roundtableId`) | orchestrateur, à chaque changement de phase ou de participant | élément `roundtable` |
| `child-started` avec `card: roundtableId` | `ChildConversations.born` (existant) | rangé dans la carte du tour |
| `child-report` avec `reply` | `ChildConversations.onEvent` (existant, `hasCard`) | ligne du participant, carte-réponse |
| `user-message` avec `from: { kind: 'roundtable', id, step }` | `AgentHost.prompt` (existant) | ligne de l'app « Synthèse demandée · k avis » à la place du texte |
| `notice` dans le fil d'un participant | existant | modèle non appliqué, lecture seule demandée seulement |
| `cost-cap-*` | `CostCapGuard` (existant, inchangé) | plafond par conversation, dans la conversation concernée |

### 3.5 Lots

Chaque lot passe par `./scripts/verify` et les e2e touchées, avec captures. Les lots 1 et 2 forment
le **minimum publiable** : un tour de table sans synthèse n'apporte rien de plus que des travaux
lancés à la main.

| Lot | Contenu | Dépend de | Taille |
|---|---|---|---|
| **0. Observations réelles** (Jérôme, sans code de l'app) | 3 à 5 `opencode acp` simultanés dans un même dossier, chacun réglé sur un modèle par `session/set_config_option` (conflits de stockage ? `config_option_update` qui écrase ?) ; 2 `bob acp` simultanés (0 bobcoin sans message ; puis un message court chacun) ; lectures demandées ou non par Bob en ACP ; RSS des N + 1 processus. Traces sous `__traces__/`. | — | S |
| **1. Lancer et recueillir** | `/roundtable` et le bouton, ligne du tour de table, menu à cases et préférence `roundtableParticipants`, places réservées ensemble, participants en lecture seule (rôle figé, `mcp: []`, pièces jointes, dernier échange), modèle strict, élément `roundtable`, genre de `workLayout`, carte en liste repliable (collecte, avis, erreurs, arrêts), exclusions de `childContext` et des outils de la mère, réconciliation au redémarrage. Scénarios factices 1, 2 et 3. | 0 conseillé | **L** |
| **2. Synthèse** | Machine d'états : quorum, envoi au repos (avec réessai), provenance `roundtable`, bloc d'avis (6 000 caractères, lettres anonymes), consigne en six rubriques, carte repliée, « Synthétiser sans attendre », moins de deux avis, ligne de l'app, lien vers la synthèse, total consommé au pied (participants et tours de la mère). | 1 | M |
| **3. Réplique et suite** | Bouton et son rappel « ≈ N + 1 fois les jetons d'une question simple », `followUp` vers chaque participant (synthèse et lettre), second regroupement, décision, réplique unique garantie au main, « Appliquer ». | 2 | S |
| **4. Robustesse et recette** | Corbeille et archivage, hors git, plafond par conversation (orchestrateur face à un tour annulé ou un message retenu ; essais), journée `parcours-tour-de-table`, recette avec OpenCode, puis Bob sur décision de l'utilisateur. | 1–3 | M |
| **Après la v1** | `propose_roundtable` (lancement par l'agent) ; total dans « Mon activité » (migration `roundtable_id`) ; regroupement des participants dans la barre latérale si la recette le demande. | 1–3 | M, M, S |

### 3.6 Risques

1. **Lecture seule seulement demandée chez OpenCode.** — **Confirmé** ([lot 0](recettes/2026-11-24-tour-de-table-lot0.md), O8 à O10).
   `writesWithoutAsking` (`profiles.ts:626`) donne le niveau `requested` (`roles/launch.ts:39-46`) :
   OpenCode peut écrire sans rien demander, et `ReadOnlyWatch` ne le voit qu'après coup, dans un
   dépôt git seulement. Observé sur 2.3.0 :
   - mode par défaut (`build`) : fichier écrit tout de suite, sans demande ;
   - **mode `plan` : pas une lecture seule.** `write` est refusé hors de son dossier de plans, mais
     `echo … > note.txt` passe par `shell` sans demande et crée le fichier. **Écarté comme parade** ;
   - **agent `participant` installé** (format de Bobine, `opencode-agents.ts:48`, `edit`, `shell`,
     `subagent` refusés) : rien d'écrit même sur demande insistante ; outils d'écriture absents,
     `execute` (Code Mode) sans accès au disque. Reste `webfetch` (lecture du web). **Seule parade
     tenue par OpenCode.**

   Conséquence : le rôle du participant nomme ce mode natif quand il est annoncé (lecture seule
   alors tenue par l'agent) ; jamais `plan`. Sans l'agent installé, la ligne du participant dit
   « lecture seule demandée », comme pour les rôles. Exiger l'installation ou non avant un tour
   OpenCode : **décision à prendre** (ADR-0072, « À surveiller »).
2. **Modèle non appliqué en silence.** — **Confirmé** ([lot 0](recettes/2026-11-24-tour-de-table-lot0.md), O3 à O6). Le repli d'`applyModel`
   (`children-review.ts:821-828`), plus OpenCode qui change de modèle juste après `session/new`
   (`docs/acp.md:396-398`), peut faire répondre deux participants avec le même modèle, et la
   synthèse serait trompeuse. Vu : un modèle refusé (`-32602` « model not found », catalogue changé
   entre deux lancements) laisse la session sur `big-pickle`, qui répond à sa place ; la réponse à
   un réglage peut porter la valeur précédente ; aucun signal ACP ne nomme le modèle qui a répondu.
   Parade : mode strict (§ 2.1), erreur de réglage = participant en erreur, valeur relue après les
   `config_option_update`, un seul réglage de modèle à la fois, juste avant l'envoi.
3. **Coût et ressources.** — **Confirmé**, mémoire plus haute que prévu ([lot 0](recettes/2026-11-24-tour-de-table-lot0.md), O11, O12, B2).
   - N + 1 (jusqu'à 2N + 2) réponses de modèle ; un participant qui lit le code : ≈ 12 à 18 k jetons
     cache compris chez OpenCode, ≈ 0,07 bobcoin chez Bob ;
   - environ 2,2 Go d'empreinte pour 5 + 1 agents OpenCode 2.3.0 (deux processus par agent,
     ≈ 360 Mo), ≈ 3,9 Go en RSS ;
   - un quota de fournisseur vite épuisé (fiche 267) ;
   - un coût Bob connu après coup seulement, et des profils muets.

   Parades : multiplicateur de jetons sur la ligne du tour de table et à côté de la réplique, total réel au pied
   de la carte, plafond par conversation pour qui l'active, places réservées ensemble. Pas
   d'estimation ni de plafond propre au tour (décision de l'utilisateur).
4. **Régression sur les filles.** — **Ouvert** (hors du champ du lot 0 : se juge au code, lot par lot). Le tour touche la machinerie la plus utilisée de la 1.1 :
   `children.ts`, `childContext`, `ChildWake`, `workLayout`, outils de la mère. Une exclusion oubliée
   donnerait un double réveil, des comptes rendus en double à la mère, ou N cartes seules. Parades :
   - les exclusions en un seul point (`participantIds`), testées une par une ;
   - les suites e2e `filles*`, `roles-travail`, `travaux-groupe` et `parcours-deleguer` à chaque lot.
5. **Concurrence entre processus du même agent.** — **Levé** pour 5 `opencode acp` et 2 `bob acp`
   ([lot 0](recettes/2026-11-24-tour-de-table-lot0.md), O1, B1 à B3) : même dossier, même stockage, tous prêts en moins d'une seconde, aucun
   verrou, aucune erreur, coûts de Bob justes par tâche, pas de ralentissement à deux. Reste
   **ouvert** : la forme d'une limite de débit (rien de provoqué). Une panne reste une erreur de
   participant, sans nouvelle tentative supposée.

Autres risques, moindres :

- contexte de la mère alourdi par les avis (≈ 7 500 jetons pour 5 avis bornés), invisible chez Bob
  (pas de jauge) ;
- biais de la mère envers un modèle cité par son nom (paré par les lettres anonymes, D1) ;
- liste latérale encombrée (D4 : mesurée à la recette) ;
- confidentialité : la question, les pièces jointes et le dernier échange partent à N fournisseurs
  (agent de chacun dans le menu, destinations dans l'infobulle de la ligne).

### 3.7 Ce qui reste inconnu, à observer sur les vrais agents

Relevés du [lot 0](recettes/2026-11-24-tour-de-table-lot0.md) (OpenCode 2.3.0, Bob 2.1.0) :

- ~~OpenCode, plusieurs processus simultanés, chacun sur un autre modèle~~ : **levé**. La valeur
  réglée tient (vérifiée dans la base d'OpenCode), pas de conflit de stockage, aucun
  `config_option_update` pendant ou après les tours. Mais un modèle refusé laisse l'ancien en place
  et le catalogue change (risque 2, **confirmé**).
- ~~OpenCode, mode `plan` ou agent « participant »~~ : **réponse**. `plan` écrit par le shell ;
  l'agent « participant » installé n'écrit pas (risque 1).
- ~~Bob, deux `bob acp` simultanés~~ : **levé** (base, coûts par tâche, débit à deux).
- ~~Bob en ACP, lectures demandées ?~~ : **non**, avec les réglages par défaut. Avec le groupe
  `read` retiré : **ouvert**, non essayé.
- Le `-32603` « Server Error » de Bob au travail : **ouvert**, pas survenu au lot 0.
- Limite de débit (passerelle IBM, Zen) au-delà de 2 Bob ou 5 OpenCode : **ouvert**.
- Mémoire réelle de N + 1 agents sur un vrai projet (serveurs de langage d'OpenCode) : **ouvert**
  (mesuré sur un dépôt jetable : ≈ 360 Mo d'empreinte par OpenCode).
- Qualité : une synthèse sur 3 à 5 avis bornés tient-elle dans le contexte d'un petit modèle ? Le
  verdict après réplique change-t-il quelque chose (à juger en recette, pas en CI) ? **Ouvert.**
- Le multiplicateur « ≈ N + 1 fois les jetons d'une question simple » : **tient en ordre de
  grandeur** sur le dépôt jetable (≈ 12 à 18 k jetons par participant qui lit un fichier, cache
  compris) ; à confirmer en recette sur un vrai projet, avec le total réel.
