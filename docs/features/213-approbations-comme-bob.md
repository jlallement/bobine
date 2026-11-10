# 213 — Approbations au niveau de Bob IDE et Bob Shell

- **Statut** : à faire (étape 0 faite le 2026-11-09 ; ADR et maquettes ensuite)
- **Dépend de** : 042 (autorisations retenues), 203 (cartes lisibles), 211 (cartes à risque)
- **Agents** : les deux pour le sélecteur, « Tout approuver », la trace et les corrections de
  cartes (générique ACP : `kind`, options `allow_once` / `allow_always`) ; **Bob seul** pour les
  règles globales (`~/.bob/settings/settings.json`, partagé avec Bob IDE et Bob Shell), déclarées
  dans son profil (`specificItems`, ADR-0011).

## Pourquoi

Banc commun du 2026-11-09 (10 messages, même projet, relevés dans le bloc-notes de la session) :

| | Sans auto | Avec auto |
|---|---|---|
| Bob Shell (`bob chat`) | 13 confirmations | 0 (`--auto-approve`) |
| Bob IDE 2.3.0 | 11 | 4 (tous les groupes cochés : il reste les commandes) + 9 cases à recocher par tâche |
| Bobine (Bob en ACP) | 14 | 1 (`--auto-approve`) |

Les équipes travaillent aujourd'hui dans Bob IDE et Bob Shell. Bobine doit pouvoir les remplacer
au jour le jour sans demander plus souvent, **sans jamais accepter à la place de l'utilisateur
plus que Bob IDE ou Bob Shell ne lui permettent d'accepter lui-même** (on ne doit pas pouvoir
dire que Bobine contourne les permissions de Bob).

Constats qui guident le plan :
- `--auto-approve` (Bob Shell, `bob acp`) fait tout passer sans rien demander : `cp` hors du
  dossier, `rm -rf`, `chmod -R 777`, `git push --force`, `curl`. Seul l'outil d'écriture de
  fichiers de Bob reste bloqué hors du dossier ; une commande `cp` fait la même chose sans carte.
- Bob IDE n'a pas de « tout approuver » : sélecteur « Permissions » par tâche (groupes Read,
  Edit, Execute, MCP, Skill, Todo, Subtask, Subagent, Mode ; Read seul par défaut ; interrupteur
  « Auto-approve » allumé). Même avec Execute coché, les commandes du banc ont été demandées :
  seules celles de la liste globale passent. Réglages globaux dans « Settings › Tool
  Auto-approval » et boutons « Allow / Deny command globally » sous la carte : ils écrivent
  dans `settings.json`, que `bob acp` lit aussi.
- Bob Shell : boutons qui disent leur portée (« Approve edit tools for task », « Always Allow
  Command for task »…), Ctrl+Y bascule l'auto-approbation pour la session, « (auto-approve) »
  dans la barre d'état.
- « Toujours » de Bob : tout le groupe pour la tâche (modifications, liste de tâches), ou la
  **commande exacte** pour la tâche ; rien n'est écrit dans `settings.json`.
- Défauts constatés dans Bobine : carte fantôme quand Bob annule sa demande (`$/cancel_request`
  ignoré, la pastille ✋ reste), carte de liste de tâches vide (pas de `rawInput.todos`), titre
  « Updating todo list » non traduit dans Réglages, chemin `/private/tmp/…` trop long sur une carte
  de commande, agent par défaut démarré inutilement avant le choix d'un agent personnalisé.

## Principe

- **Bob garde la logique.** Ses règles (globales et de tâche) décident ce qui est demandé. Bobine
  ne réimplémente ni comparaison de commandes ni règle d'approbation.
- **Bobine ne fait que répondre plus vite**, pour les genres d'action que l'utilisateur a choisis,
  et **seulement si l'agent propose « Toujours »** (sinon c'est que l'agent veut un accord
  explicite : carte montrée, quel que soit le mode). Elle répond `allow_always` quand il est
  proposé, pour que l'agent retienne lui-même.
- **Garde-fous de Bobine, toujours actifs, même en « Tout approuver »** : bandeau de risque
  existant (fiche 211, `permission-risk.ts`), carte montrée dès qu'un risque est repéré.
- **Trace écrite** de chaque accord automatique : une ligne dans le fil et une dans
  `agents.log` (action, mode, heure).
- **Jamais `--auto-approve`.**

## Ce que voit l'utilisateur

| | Portée | Vient de |
|---|---|---|
| Sélecteur « Autorisations » dans la barre de saisie : Lecture, Modifications (dans le dossier), Autres outils (MCP, skills, sous-agents, modes, liste de tâches) ; défaut réglable dans Réglages | la conversation | Bob IDE |
| Pas de case « Commandes » : une commande passe seule si elle est dans la liste globale de Bob, ou en « Tout approuver » | — | Bob IDE |
| Boutons de carte qui disent leur portée : « Autoriser toutes les modifications pour cette conversation », « Toujours autoriser cette commande pour cette conversation »… | la conversation | Bob Shell |
| Bob seulement : « Autoriser cette commande partout » / « Refuser cette commande partout » sur la carte (préfixe modifiable) ; Réglages › Agents › Bob › Approbations (groupes, commandes autorisées et refusées, hors du dossier) | toutes les tâches, Bob IDE et Bob Shell compris | Bob IDE |
| « Tout approuver » : interrupteur en bas du sélecteur et raccourci clavier, confirmation à la première activation dans la conversation, pastille visible (barre de saisie et liste des conversations), un clic l'éteint ; jamais enregistré, ne survit ni à la conversation ni à un redémarrage | la conversation | Bob Shell (Ctrl+Y) |
| Carte toujours montrée : accord explicite voulu par l'agent, risque repéré | partout | Bobine |

Attendu sur le banc (10 messages) : environ 6 à 7 cartes avec les défauts (Lecture seule, un
« Toujours » sur la première modification et la première liste de tâches), environ 4 avec
Modifications et Liste de tâches cochées, 0 en « Tout approuver » hors risque.

## Plan

### Étape 0 — Résultats (2026-11-09, détail dans `docs/acp.md`, ligne « Approbations, suite »)

| Question | Réponse | Conséquence pour le plan |
|---|---|---|
| Format de `settings.json` documenté ? | **Oui** : page IBM « approval settings » (groupes, `allowedExecutors`, préfixes, priorité au refus le plus long, fichier partagé avec Bob IDE) | Écrire ce fichier ne repose pas sur un format deviné ; `bob-probe` surveille quand même les clés |
| Accord explicite sans « Toujours » ? | **Oui** : Bob omet `allow_always` pour l'écriture dans `~/.bob`, l'outil fichier hors du dossier (quand il est permis), un groupe interdit, une commande non découpable, une commande signalée par sa vérification de sécurité. Même `--auto-approve` montre alors la carte | La règle « Bobine ne répond seule que si l'agent propose Toujours » est **confirmée** : elle respecte exactement les cas où Bob veut un accord explicite |
| Commandes à risque | `cp` hors du dossier, `sudo`, `curl`, `rm` arrivent **avec** `allow_always` en ACP | Le bandeau de la fiche 211 reste le seul garde-fou de Bobine sur ces cas ; « Tout approuver » s'y arrête |
| Vérification de sécurité des commandes | Réglage « Command Security Verification » de Bob IDE (un modèle classe la commande « dangereuse » ou non), activé à l'écran ; aucun effet constaté en `bob acp` (`curl … \| head`, `sudo -n true`, `cp` hors du dossier, `rm` arrivent avec « Toujours »). Dans Bob IDE, `rm -rf` et `cp` hors du dossier n'ont pas été signalés | Bobine avec Bob en ACP n'a pas ce filet : **à demander à IBM** (option ou `_meta` en ACP). On ne le réimplémente pas |
| Groupe interdit (`forbiddenApprovalGroups`) | Écrit par l'utilisateur, remis à `[]` par Bob au lancement (vu) : la clé ne se règle donc pas dans le fichier ; une politique d'administration pourrait la remplir (non essayé) | Bobine n'écrit jamais cette clé ; si un groupe est interdit et que Bob n'offre pas « Toujours », Bobine montre la carte |
| Quand une règle du fichier vaut | À la **session suivante** (`session/new`), pas dans la session en cours | « Autoriser partout » répond aussi « pour cette conversation » à la carte en cours |
| Portée de « Toujours » | Modification : toutes les modifications de la conversation. Commande : **chaque segment** (après `cd x && npm test`, `npm test` passe). Liste de tâches : le groupe | Libellés : « toutes les modifications de cette conversation », « cette commande (et chacune de ses parties) pour cette conversation » |
| Liste de tâches en ACP | `kind: "other"`, titre « Updating todo list », `rawInput.todos` en texte à cases | Carte : afficher `rawInput.todos` ; groupe « Liste de tâches » reconnu par ce champ, pas par le `kind` |
| « Allow command globally » de Bob IDE | Ajoute le préfixe choisi (commande entière ou premier mot) à `allowedExecutors[execute_command].approvedCommands`, le retire des refusés, garde les autres clés. **Sans le groupe `execute` permis, la liste n'a aucun effet** (la carte reste) | « Autoriser partout » doit aussi permettre `execute` pour tous les projets (comme cocher Execute dans « Settings › Tool Auto-approval »), en le disant : seules les commandes de la liste passent alors |
| Préfixes larges | Rapport public (PromptArmor) : une commande autorisée par préfixe peut servir à en lancer d'autres (`<`, `>(…)`) | Bobine propose par défaut la **commande entière**, et prévient quand le préfixe est un seul mot |
| Une règle écrite par Bobine survit-elle à une écriture de Bob IDE ? | **Oui** (essai avec le profil de l'utilisateur) : Bob IDE relit le fichier aussitôt et garde la règle quand il écrit. **Piège** : si `allowedExecutors` est absent, l'écrire avec une seule commande efface la liste par défaut de Bob | Bobine recopie la liste par défaut de Bob (comme Bob IDE) avant d'ajouter une commande ; test qui le vérifie |
| Réglages globaux de Bob IDE vus par `bob acp` (profil réel) | Edit, Todo, Skills activés : plus de carte en ACP. MCP activé : outil encore demandé sans sa case « Always allow » (dans `mcp.json`) ; un serveur MCP fourni par le client n'en a pas. Changement valable à la session suivante | Rien à faire côté Bobine pour en profiter ; Réglages › Bob › Approbations peut proposer « Always allow » par outil MCP pour les serveurs de Bob (écriture dans `mcp.json`), pas pour les serveurs de Bobine |

| Outils MCP, skills, sous-agents, modes (`bob acp` et Bob IDE, serveur MCP d'essai) | Tous demandés, en ACP avec `kind: "other"` (titres propres à Bob). « Toujours » : **cet outil MCP seulement** (l'autre outil du même serveur est redemandé) ; tout le groupe pour un skill, un sous-agent, un mode. Mêmes portées dans Bob IDE (« Approve skill / subagent / mode tools for task ») | Le `kind` ne sépare pas ces groupes : le sélecteur propose **Lecture, Modifications, Autres outils** (MCP, skills, sous-agents, modes, liste de tâches), sans lire les titres de Bob ; le détail fin reste au « Toujours » de la carte, décidé par Bob |
| OpenCode 2.2.5, configuration par défaut | **Ne demande rien** : commande, création de fichier, `cp` et écriture hors du dossier passent sans carte | Ni le sélecteur, ni le bandeau de risque n'ont d'effet avec OpenCode tel quel. Décision à prendre : laisser OpenCode ainsi (documenté), ou que son profil lui passe une configuration `ask` (alors cartes, bandeau et sélecteur s'appliquent) |

| Réglages globaux de Bob IDE (écran « Bob Settings ») | Un interrupteur par groupe pour toutes les tâches (Read, Edit, Execute, MCP, Mode, Subtasks, Subagents, Skills, Todo), options « hors du dossier » pour Read et Edit, listes de commandes autorisées et refusées, vérification de sécurité ; par outil MCP, une case « Always allow » globale (dans `mcp.json`) | Réglages › Agents › Bob › Approbations reprend **ces mêmes groupes** (c'est le fichier de Bob, pas le sélecteur générique) ; « Always allow » d'un outil MCP de Bob : plus tard, seulement si le besoin se confirme (il écrit dans `mcp.json`) |

| Hooks de Bob (`PreToolUse`) en ACP | Appelés avant toute demande, même avec `--auto-approve` ; un refus du hook fait échouer l'outil sans carte, avec sa raison | Les garde-fous d'équipe posés en hooks valent dans Bobine ; Bobine affiche la raison de l'échec (outil échoué) ; rien à ajouter au plan |
| OpenCode réglé sur `ask` | Tout est demandé ; options `once` / `always` / `reject` ; « always » proposé même hors du dossier, et valable aussi dans une nouvelle session | Bobine choisit l'option par son **genre** ACP, jamais par identifiant. Avec OpenCode, la règle « Toujours proposé » ne protège rien de plus : seul le bandeau de risque (fiche 211) arrête une écriture hors du dossier. Le « Toujours » d'OpenCode est plus large que celui de Bob : à dire sur la carte (« c'est l'agent qui décide ce que couvre toujours », déjà affiché) |

Non fait : réponse de Bobine arrivée après un `$/cancel_request` de Bob (couvert par la correction de
la carte fantôme, étape 1) ; `start_subtask` (jamais appelé par le modèle).

### Étape 0 — Protocole suivi

Hygiène (pour toutes les sous-étapes) : HOME jetable par cas (`~/.bob` de test, authentification
copiée puis effacée), projets jetables (`prepare.sh` du banc), jamais `--trust` ni
`--auto-approve` sauf mention ; ne jamais lire, afficher ni modifier `~/.bob/settings/`,
`~/.bob/db`, le trousseau, `.env.local` réels ; `shasum ~/.bob/trustedFolders.json` = `1762e4f0…`
à la fin ; aucun processus `bob` restant. Traces brutes hors dépôt ; celles retenues pour les tests
sont nettoyées et rangées dans `src/main/agent/__traces__/bob-2.0.9/`.

**0.a — `bob acp` (client ACP de test du banc, sans Bobine)**
1. *Accord explicite* : la demande arrive-t-elle sans `allow_always` ? Cas : écriture de fichier
   dans `~/.bob/` (outil fichier), commande que la vérification de sécurité de Bob pourrait
   signaler, commande hors du dossier (`cp` vers le voisin), `sudo -n true`.
   ⚠ `docs/acp.md` note qu'en 2026-11-08 la commande hors du dossier et `sudo` portaient
   `allow_always` : si aucun cas n'arrive sans « Toujours », la règle « répondre seulement si
   l'agent propose Toujours » ne protège rien de plus que le bandeau, et il faut le dire dans
   l'ADR (le garde-fou sera alors le seul bandeau de la fiche 211).
2. *Groupe interdit* : `forbiddenApprovalGroups: ["execute"]` (et `["edit"]`) dans le
   `settings.json` jetable : carte, refus silencieux, absence de « Toujours » ? Et une réponse
   `allow_always` à une telle demande est-elle acceptée par Bob ?
3. *Lecture du fichier* : une règle ajoutée (`approvedCommands` + `execute`) pendant qu'une session
   tourne vaut-elle dans cette session, dans une nouvelle session du même processus, ou seulement
   au lancement suivant ?
4. *Portée de « Toujours » par genre* : modification, suppression, liste de tâches, outil MCP,
   commande, commande enchaînée (`cd x && npm test`) — ce que couvre `allow_always` pour la suite
   de la session (pour écrire des libellés justes).
5. *Réponse immédiate* : Bob accepte-t-il une réponse envoyée dans la milliseconde (pas d'état
   intermédiaire attendu) ? Et une réponse arrivée après son `$/cancel_request` ?

**0.b — Bob IDE 2.3.0 (avec le compte de l'utilisateur, une fois, projet jetable)**
6. Sauvegarde de `~/.bob/settings/settings.json` réel, puis : « Allow command globally » sur une
   carte, « Deny command globally », cocher un groupe dans « Settings › Tool Auto-approval ».
   Relevé des **noms de clés** et de la forme des valeurs écrites (sans afficher les valeurs
   réelles de l'utilisateur ; diff structurel par script `python3 -I`). Format de référence pour
   Bobine.
7. Une règle écrite comme Bobine l'écrira survit-elle au lancement de Bob IDE (qui réécrit le
   fichier) ? Bob IDE ouvert pendant l'écriture : la voit-il, l'écrase-t-il ?
8. Restauration de la sauvegarde, empreinte vérifiée.

**0.c — Sans essai**
9. Chercher une documentation d'IBM sur `settings.json` › `approval` (site de Bob, notes de
   version). Sinon : contrôle du format ajouté à `pnpm bob-probe` (clés attendues présentes,
   types), et l'ADR assume le choix.

Sortie : résultats ajoutés à `docs/acp.md` (« Compatibilité Bob »), traces rangées, plan des
étapes 2 à 5 corrigé si un résultat le contredit.

### Étape 1 — Corrections des cartes (indépendante, peut commencer tout de suite)

Fiche à part (corrections), sans choix d'interface :
- `$/cancel_request` de Bob : la carte se ferme, la pastille ✋ disparaît
  (`src/main/agent/pending-requests.ts`, `agent-host.ts`, vue `acp-view.ts`).
- Carte de liste de tâches : afficher `rawInput.todos` (statut et texte), comme Bob IDE.
- Titre « Updating todo list » traduit dans Réglages (`RememberedApprovals.tsx`, clés `fr.json` /
  `en.json`).
- Chemin de la carte de commande raccourci (`~`, dossier de la conversation).
- Agent par défaut démarré avant le choix d'un agent personnalisé : à reproduire, puis corriger.
Chaque correction rejoue d'abord la trace réelle du banc (test qui échoue avant), puis scénario de
l'agent factice et suite e2e touchée.

### Étape 2 — ADR (après l'étape 0)

- **ADR « Bobine répond à la place de l'utilisateur selon le mode choisi »** : remplace la règle
  « Bobine ne passe jamais `--auto-approve` » de `docs/acp.md` (elle reste vraie) ; conditions :
  genre coché, `allow_always` proposé, aucun risque repéré, trace écrite ; « Tout approuver » non
  enregistré.
- **ADR « Bobine écrit les règles d'approbation de Bob »** : sur un clic seulement, section
  `approval` seule, autres clés gardées telles quelles, écriture atomique + sauvegarde, jamais un
  groupe de `forbiddenApprovalGroups` ; format documenté ou surveillé par `bob-probe`.

### Étape 3 — Maquettes (validées par l'utilisateur avant le code d'interface)

Clair et sombre, fr et en : sélecteur « Autorisations » ouvert (défaut, tout coché) ; confirmation
de « Tout approuver » ; pastille dans la barre de saisie et dans la liste des conversations ;
ligne « autorisé automatiquement » dans le fil ; carte de commande Bob avec « pour cette
conversation » et « partout » (préfixe modifiable) ; carte de liste de tâches avec les tâches ;
Réglages › Agents › Bob › Approbations.

### Étape 4 — Code, en trois fiches successives

**4.a Sélecteur et réponses automatiques (générique)**
- Main : un module pur `auto-approval.ts` (`decide(request, mode, risk) → 'ask' | optionId`),
  appelé là où `session/request_permission` arrive (`agent-host.ts` / `pending-requests.ts`) ;
  mode par conversation (en mémoire, défaut lu dans les réglages) ; ligne d'audit dans
  `acp-log.ts` ; évènement vers le renderer pour la ligne du fil.
- Partagé : types du mode et des groupes (`src/shared/`), IPC typé dans le preload.
- Renderer : sélecteur dans la barre de saisie, défaut dans Réglages (à côté des autorisations
  retenues, fiche 042), ligne du fil, libellés de portée sur les boutons.
- Correspondance genre ACP → groupe : `read`/`search` → Lecture ; `edit`/`delete`/`move` →
  Modifications ; `other` (MCP, skills, sous-agents, modes, liste de tâches : vu à l'étape 0) →
  Autres outils ; `execute` → jamais par le sélecteur ; `fetch` et genres inconnus → carte.

**4.b « Tout approuver » (générique)**
- Même module : mode `all` = tout genre, toujours sous les deux conditions (Toujours proposé,
  aucun risque). Jamais écrit sur disque ; remis à zéro à la fin de la conversation et au
  redémarrage.
- Interrupteur, raccourci clavier (à choisir, sans conflit avec les raccourcis existants),
  confirmation, pastille dans la barre de saisie et la liste des conversations.

**4.c Règles globales de Bob (Bob seul)**
- Main : `bob-approval-rules.ts` — lire / écrire la section `approval` de
  `~/.bob/settings/settings.json` (lecture seulement des clés `approval`, écriture atomique via
  `storage.ts`, sauvegarde, refus d'un groupe interdit) ; déclaré dans le profil Bob
  (`specificItems`), ligne dans la matrice de `docs/agents.md`.
- Carte de commande Bob : « Autoriser / Refuser cette commande partout » (préfixe modifiable,
  commande entière par défaut, avertissement pour un préfixe d'un seul mot) ; réponse « pour
  cette conversation » envoyée en même temps (le fichier ne vaut qu'à la conversation suivante,
  vu à l'étape 0). Si le groupe `execute` n'est pas permis pour tous les projets, la première
  autorisation « partout » le demande explicitement (« les commandes de votre liste passeront
  sans demander dans Bobine, Bob IDE et Bob Shell »), sans quoi la liste ne sert à rien.
- Ne jamais écrire `forbiddenApprovalGroups` (clé d'administration).
- Réglages › Agents › Bob › Approbations : groupes, commandes autorisées et refusées, hors du
  dossier.
- `bob-probe` : contrôle du format.

### Étape 5 — Vérification de fin

- `./scripts/verify`, suites e2e touchées (clair et sombre, captures regardées), avant / après
  envoyés à l'utilisateur.
- Agent factice : scénarios ajoutés à `docs/mock-agent.md` — demande de chaque genre avec et sans
  `allow_always`, annulation par l'agent (`$/cancel_request`), demande à risque en « Tout
  approuver », réponse automatique tracée.
- Banc du 2026-11-09 rejoué avec le vrai Bob dans Bobine (défauts, groupes cochés, « Tout
  approuver », cas à risque), comparé au tableau ci-dessus ; suite e2e complète avant fusion.
- `docs/acp.md`, `docs/agents.md`, `docs/architecture.md` si besoin, CHANGELOG fr et en.

## Décisions à prendre par l'utilisateur

1. Cases cochées par défaut : **Lecture seule, comme Bob IDE** (recommandé : rien de plus
   permissif que Bob IDE sans choix de l'utilisateur), ou Lecture + Modifications + Autres
   outils.
2. Accord pour que Bobine écrive dans `~/.bob/settings/settings.json` sur un clic (ADR).
3. Raccourci clavier de « Tout approuver ».
4. Demander à IBM d'ouvrir à `bob acp` la vérification de sécurité des commandes de Bob IDE
   (option de lancement ou réglage) : sans elle, Bobine protège moins que Bob IDE sur les
   commandes dangereuses, quoi qu'on fasse côté Bobine.
5. OpenCode ne demande rien par défaut (étape 0) : laisser tel quel, ou que son profil lui
   passe une configuration `ask` pour que cartes, bandeau de risque et sélecteur s'appliquent.

## Critères d'acceptation

- [ ] Étape 0 faite, résultats dans `docs/acp.md`, traces rangées.
- [ ] Corrections de cartes faites (carte fantôme, liste de tâches, titre, chemin).
- [ ] Deux ADR acceptés ; maquettes validées.
- [ ] Une demande d'un genre coché, sans risque, avec `allow_always` proposé, est acceptée sans
      carte et tracée (fil et `agents.log`) ; sans `allow_always` ou avec risque, la carte est
      montrée.
- [ ] « Tout approuver » ne survit ni à la conversation ni au redémarrage ; pastille visible.
- [ ] Bob : une commande autorisée « partout » dans Bobine passe sans carte dans une nouvelle
      conversation et dans Bob IDE ; le reste de `settings.json` est intact.
- [ ] Testé contre l'agent factice (scénarios de l'étape 5) ; banc rejoué avec le vrai Bob.

## Journal

- 2026-11-09 — Banc fait sur Bob Shell, Bob IDE 2.3.0 et Bobine, avec et sans auto-approbation,
  cas à risque compris. Plan discuté avec l'utilisateur : rien de plus permissif que Bob IDE,
  confort par le sélecteur et le « Toujours » de Bob, « Tout approuver » en option non
  enregistrée, règles globales écrites dans le fichier de Bob comme le fait Bob IDE.
- 2026-11-09 — Étape 0 faite (7 cas `bob acp` en HOME jetable, ≈ 1 bobcoin ; Bob IDE : un
  « Allow command globally », fichier réel sauvegardé puis restauré, empreinte vérifiée ;
  documentation IBM trouvée). Plan ajusté :
  règle « Toujours proposé » confirmée, « Autoriser partout » doit aussi permettre `execute`,
  commande entière par défaut, libellés par segment, liste de tâches reconnue par
  `rawInput.todos`, vérification de sécurité absente en ACP (à demander à IBM). Reste à vérifier :
  survie d'une règle écrite à côté de Bob IDE ouvert.
