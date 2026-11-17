# Scénario de recette « POC complet » — faire construire une vraie petite app avec Bobine

**À rejouer à chaque version importante** (préversion, version), avec OpenCode puis, quand le
budget le permet, avec IBM Bob. Chaque passage remplit un rapport daté à partir du modèle
[`_modele-rapport-poc.md`](_modele-rapport-poc.md), rangé ici sous
`AAAA-MM-JJ-poc-complet-<agent>.md`. Première exécution : fiche
[238](../features/238-recette-poc-complet-premiere.md).

Le principe : Bobine fait construire un **gestionnaire de tâches** en trois morceaux (une API avec
ses tests, une page web, une petite app iOS en SwiftUI) et, en chemin, **chaque outil de Bobine
sert au moins une fois**, comme un utilisateur s'en servirait. On ne juge pas la qualité de l'app
produite : on juge si Bobine a permis de la produire **sans blocage**, et ce que ça a coûté.

Le scénario se joue au choix :

- par le **pilote de Bobine** ([`docs/pilote.md`](../pilote.md), `pnpm pilote`), conduit par
  Claude dans le rôle de l'utilisateur final (fiche [206](../features/206-session-longue-utilisateur.md)),
  avec computer use pour les fenêtres que le pilote ne voit pas ;
- par un **humain**, qui suit les mêmes étapes et remplit la même grille.

Durée visée : 3 à 4 h de jeu. Ordre des étapes imposé : la comparaison entre deux passages en
dépend.

## 0. Paramètres du passage

À fixer **avant de commencer**, et à recopier en tête du rapport.

| Paramètre | Première exécution | Autres passages |
|---|---|---|
| Version de Bobine | celle du dernier DMG publié (Release GitHub) | idem |
| Agent | OpenCode | IBM Bob (ou OpenCode avec d'autres modèles) |
| Modèle principal | modèle OpenAI de gamme intermédiaire : le palier « mini » proposé ce jour-là, de force comparable à un Qwen 27B | Bob : pas de choix du modèle par ACP |
| Modèle de remplacement (étape 4, changement en cours de route) | un autre modèle OpenAI, de gamme au-dessus ou au-dessous | Bob : sans objet (voir 4.2) |
| Modèle des filles « autre modèle » | un modèle d'une autre famille ou d'un autre fournisseur connecté (par exemple un modèle gratuit d'OpenCode) | Bob : sans objet |
| Accès au modèle | **abonnement ChatGPT** connecté dans OpenCode par l'utilisateur (pas de clé d'API) : coût affiché 0 $ | Bob : bobcoins |
| Plafond de l'agent | **20 millions de jetons de l'agent** sur le passage (total affiché par Bobine, cache compris), valeur par défaut que l'utilisateur peut changer | Bob : en bobcoins, fixé par l'utilisateur |
| Plafond par conversation | Réglages › Conversations › Pendant la réponse › **Plafond par conversation** (il compte un coût : sans effet à 0 $, à régler seulement avec Bob ou une clé d'API) | idem |
| Plafond de jetons du pilote | **2 millions de jetons** du modèle qui joue l'utilisateur (Claude), total du passage, valeur par défaut que l'utilisateur peut changer | idem |
| Dossier du passage | `~/Development/bobine-recette/poc-<version>-<agent>/` | idem |

Les noms exacts des modèles retenus sont écrits dans le rapport (identifiant OpenCode, par exemple
`openai/<modèle>`), pour que le passage suivant puisse les reprendre ou dire pourquoi il change.

**Budget.** Le plafond est un arrêt net. Avant chaque étape, on relit la dépense (puce de
consommation, **Toute mon activité…** ⇧⌘U, fiches [109](../features/109-cout-visible.md),
[137](../features/137-tableau-consommation.md) ; pour Bob, le quota sous son nom,
fiche [091](../features/091-quota-bob.md)) et les jetons du pilote. Si l'un des deux plafonds est
atteint, on s'arrête là, sans finir l'étape, et le rapport dit : étape atteinte, dépense, plafond.
Les étapes non jouées sont marquées « non jouée (plafond) », jamais « échec ».

**Relever les jetons de l'agent** (décidé le 2026-11-17 : OpenAI par abonnement ChatGPT, donc
0 $ affiché ; le plafond se compte en jetons). Avant chaque étape :

- **Toute mon activité…** (⇧⌘U), ou Réglages › Consommation : période « aujourd'hui » (ou celle du
  passage), agent OpenCode ; relever le total des jetons, et le détail par modèle (fiches
  [137](../features/137-tableau-consommation.md), [147](../features/147-activite-comparable.md)).
  Le profil étant neuf, tout ce qu'il compte vient du passage. Ce tableau lit le journal de
  consommation du profil (`usage.sqlite`, une ligne par tour, fiche
  [130](../features/130-journal-consommation.md)) : filles, relectures et fenêtre rapide comprises.
- Par conversation : détail de la puce de consommation (jetons, une ligne par échange).
- **Jetons du pilote** : relevés dans l'outil qui fait tourner Claude (pour Claude Code, `/cost`
  ou l'usage de la session), en fin d'étape.

**Limite d'usage de l'abonnement.** Si ChatGPT refuse de répondre parce que la limite de
l'abonnement est atteinte (message d'erreur de l'agent ou de Bobine, à recopier), on s'arrête comme
au plafond : c'est un **résultat** du passage (étape atteinte, jetons consommés, heure), pas un
défaut de Bobine. Seule la façon dont Bobine le montre (message clair ou non, carte figée…) peut
être notée comme défaut.

## 1. Prérequis

### Le Mac

- macOS avec **Xcode complet** et au moins un **simulateur iOS** (Xcode › Window › Devices and
  Simulators). Réglages › Diagnostic de Bobine doit montrer la ligne du simulateur verte
  (fiche [008](../features/008-simulateur-captures.md)).
- Node.js (pour l'API et pour le pilote), git.
- Un clone du dépôt de Bobine **au tag de la version essayée**, pour `pnpm pilote` seulement :
  l'app essayée, elle, est l'app installée.

### L'app essayée : celle du DMG publié

1. Télécharger le `.dmg` de la Release, l'ouvrir, glisser Bobine dans Applications (premier
   lancement non signé : [`docs/installation.md`](../installation.md)).
2. Vérifier la version : Réglages › À propos.
3. **Jamais** le build du dépôt ni l'agent factice : ils n'existent pas dans l'app installée, et ce
   n'est pas ce qu'on essaie.

### Un profil jetable, pas le vôtre

Bobine est lancée sur un **profil isolé**, vide au départ, comme une première installation. Le
profil temporaire (`--profil-temporaire`, fiche [148](../features/148-recommencer-a-neuf.md))
serait le choix naturel, mais **il est effacé à la fermeture** : l'étape 8.2 (quitter puis
relancer et reprendre la conversation) le rend impossible. **Décidé le 2026-11-17** : on utilise
un dossier de profil jetable (`pnpm pilote lancer --profil …`), créé vide, supprimé à la fin :

```bash
PASSAGE=~/Development/bobine-recette/poc-<version>-<agent>
mkdir -p "$PASSAGE/profil"
BOBINE_ONBOARDING=1 pnpm pilote lancer --app /Applications/Bobine.app --profil "$PASSAGE/profil" --journal "$PASSAGE/pilote"
```

- `BOBINE_ONBOARDING=1` (constaté le 2026-11-17) : un `--user-data-dir` hors profil temporaire compte
  comme un essai automatique, et l'accueil du premier lancement ne s'affiche pas sans cette variable
  (`src/main/onboarding/onboarding-state.ts`). Inutile à la relance de l'étape 8.2 (marque posée).
- Le pilote ajoute le trousseau simulé (`--use-mock-keychain`) : Bobine ne touche pas au vrai
  trousseau.
- **Pas** de `--agents-neufs` : les agents doivent trouver la connexion faite par l'utilisateur.
- Avec un profil donné par `--profil`, le premier « Choisir… » de l'accueil ouvre la vraie fenêtre
  de macOS (pas de dossier préréglé) : computer use, ou un humain.
- Avec un profil isolé, **le journal est dans le profil** : `$PASSAGE/profil/logs/main.log` et
  `agents.log`, pas `~/Library/Logs/Bobine/` (Réglages › Diagnostic › Journal montre le bon
  dossier).

Un humain sans pilote lance l'app de la même façon :
`open -n -a Bobine --args --user-data-dir="$PASSAGE/profil"`.

### L'agent, connecté par l'utilisateur lui-même

- **OpenCode** : installé, et le fournisseur (OpenAI) connecté **par l'utilisateur**
  (`opencode auth login`, ou Réglages › Agents › OpenCode, fiche
  [104](../features/104-fournisseurs-opencode.md)) avant le passage. L'agent ou le pilote qui joue
  le scénario **ne se connecte jamais, ne saisit et ne lit aucun identifiant** (ni clé, ni fichier
  d'authentification). Si la connexion manque, il s'arrête et le demande.
- **IBM Bob** : installé, SSO fait par l'utilisateur. **Avant** le passage, sauvegarder `~/.bob` ;
  **après**, le remettre :

  ```bash
  ditto ~/.bob "$PASSAGE/bob-sauvegarde"          # avant
  mv ~/.bob "$PASSAGE/bob-apres-recette"           # après : on garde l'état laissé par la recette
  ditto "$PASSAGE/bob-sauvegarde" ~/.bob
  ```

  Ne pas utiliser « Installer dans IBM Bob » d'un rôle pendant le passage (il écrit dans
  `~/.bob/settings/custom_modes.yaml`).

### Garde-fous

- Ne jamais toucher à `~/.ssh`, au trousseau, ni aux configurations réelles de `gh` ou `glab`. Le
  projet n'a **pas de dépôt distant** : rien n'est poussé, aucune PR n'est ouverte.
- L'identité git du projet est locale et fictive :
  `git config user.name "Recette Bobine"` et `git config user.email recette@example.invalid`,
  dans le dépôt du projet seulement (jamais `--global`).
- Pas de donnée personnelle dans le rapport ni dans les captures : chemins écrits avec `~`, pas de
  nom d'utilisateur, d'adresse, de compte ou de clé. Une capture qui en montre est recadrée ou
  retirée.

### Le projet de départ

Un dépôt git presque vide, avec **un commit** (les conversations filles et les worktrees en ont
besoin) :

```bash
mkdir -p "$PASSAGE/taches" && cd "$PASSAGE/taches"
git init -b main
git config user.name "Recette Bobine" && git config user.email recette@example.invalid
printf '# Taches\n\nPetit gestionnaire de tâches : API, page web, app iOS.\n' > README.md
git add README.md && git commit -m "chore: initial commit"
```

### Réglages faits avant l'étape 1 (dans Bobine, profil du passage)

- Réglages › Diagnostic › Journal : **Détaillé** (fiche [080](../features/080-journal-reglable.md)).
- Réglages › Conversations › Pendant la réponse › **Plafond par conversation** : avec Bob ou une
  clé d'API seulement (il compte un coût ; avec l'abonnement ChatGPT, 0 $, le laisser désactivé et
  suivre les jetons à la main) (fiches [157](../features/157-commande-bloquee-contexte-plafond.md),
  [164](../features/164-cout-conversation-toutes-sessions.md)).
- Réglages › Mémoire › **Mémoire activée** (fiche [182](../features/182-memoire-commune.md)) :
  vérifier qu'elle l'est.
- Le reste reste **par défaut** : c'est l'expérience d'un nouvel utilisateur.

## 2. Ce qu'on relève, à chaque étape

La même grille à chaque étape et à chaque passage : c'est elle qui permet de comparer deux
versions. Elle est dans le modèle de rapport.

| Relevé | Comment |
|---|---|
| Résultat | ✓ réussi, ~ réussi avec réserve, ✗ échec, « non jouée » (et pourquoi) |
| Durée | heure de début et de fin ; durées des tours dans `pnpm pilote journal --resume` |
| Interventions | chaque fois que le testeur a dû faire ce qu'un humain aurait fait parce que Bobine ou l'agent s'est arrêté avant d'avoir fini : `pnpm pilote intervention "<pourquoi>"` |
| Blocages | agent figé (`attendre` sort en `calme`), carte qui ne répond pas au clic, bandeau d'erreur, Bobine qui ne répond plus |
| Erreurs du journal | lignes `ERROR` et `WARN` de `main.log` et `agents.log` écrites pendant l'étape (commande ci-dessous) |
| Mémoire | mémoire de Bobine et des agents en fin d'étape (commande ci-dessous) |
| Jetons et coût de l'agent | puce de consommation de chaque conversation de l'étape, filles comprises ; total dans **Toute mon activité…** |
| Jetons du pilote | relevés dans l'outil qui fait tourner Claude, en fin d'étape |
| Captures | au moins une par outil essayé, nommées `<étape>-<quoi>.png` ; `pnpm pilote capture` pour la fenêtre, computer use pour le navigateur et le simulateur (vues natives, absentes des captures du pilote) |

**Erreurs du journal pendant l'étape.** Noter l'heure UTC au début de l'étape, puis à la fin :

```bash
DEBUT=$(date -u +%Y-%m-%dT%H:%M:%S)     # au début de l'étape
awk -v t="$DEBUT" '$1 >= t && ($2 == "ERROR" || $2 == "WARN")' \
  "$PASSAGE/profil/logs/main.log" "$PASSAGE/profil/logs/agents.log"
```

Chaque ligne est recopiée au rapport (secrets déjà masqués par Bobine ; chemins personnels
remplacés par `~`).

**Mémoire.** Même commande à chaque fois, en fin d'étape (taille résidente, en Mo) :

```bash
ps -axo rss=,command= | awk '!/awk/ && /\/Applications\/Bobine\.app\// {b += $1}
  !/awk/ && /(opencode|bob)[^ ]* acp/ {a += $1}
  END {printf "Bobine %d Mo, agents %d Mo\n", b / 1024, a / 1024}'
```

Le nombre de conversations actives (Réglages › Conversations, fiche
[102](../features/102-conversations-gardees-actives.md)) est noté avec : il explique la mémoire des
agents.

### Gravité des défauts

| Gravité | Sens | Suite |
|---|---|---|
| **Bloquant** | l'étape ne peut pas être finie dans Bobine, même avec une intervention | fiche + essai qui le rejoue |
| **Sérieux** | l'étape se finit, mais seulement avec une intervention qu'un utilisateur ordinaire ne trouverait pas, ou une perte (travail, message, réglage) | fiche + essai qui le rejoue |
| **Gênant** | ça marche, mais on hésite, on recommence, on cherche | noté ; fiche si récurrent |
| **Cosmétique** | aspect, texte, alignement | noté |

**Une capture pour chaque défaut, au moment où on le voit** (décidé le 2026-11-17), quelle que
soit sa gravité, avant toute autre action (pas de clic, pas de nouvelle tentative) : l'écran tel
qu'il est, c'est la preuve.

- Fenêtre de Bobine : `pnpm pilote note --gravite … --capture "<texte>"` (taille réelle, pas
  `--demi`).
- Vues natives absentes des captures du pilote (navigateur intégré, simulateur, fenêtres de
  macOS) : une capture computer use en plus, enregistrée sous
  `<étape>-defaut-<n>-<quoi>.png`.
- Si le défaut évolue (carte qui finit par répondre, agent qui repart), une seconde capture après.
- Le rapport cite la ou les captures sur la ligne de chaque défaut ; un défaut sans capture est
  signalé comme tel, avec la raison.

Gardé pour l'instant (décidé le 2026-11-17) : le pilote n'a que quatre gravités (`bloquant`, `genant`, `mineur`, `idee`) : on note un défaut
**sérieux** avec `--gravite genant` et le texte commençant par `SÉRIEUX :`, un défaut
**cosmétique** avec `--gravite mineur`. Le rapport, lui, utilise les quatre gravités ci-dessus.

Chaque défaut **sérieux ou bloquant** devient une fiche dans `docs/features/`, avec un essai qui
le rejoue : **contre l'agent factice** si possible (un scénario de `pnpm mock-agent`, voir
[`docs/mock-agent.md`](../mock-agent.md)) ; sinon, la trace réelle relevée dans `agents.log` et la
raison pour laquelle l'agent factice ne suffit pas. Un défaut n'est noté qu'après une
reproduction, ou avec la mention « vu une fois ».

**Bobine ou l'agent ?** Une erreur du modèle (code faux, consigne mal comprise) n'est pas un défaut
de Bobine. La façon dont Bobine la montre peut en être un. Le rapport sépare les deux.

## 3. Le scénario

Chaque étape donne : les **consignes** à taper (à recopier telles quelles, pour comparer les
passages), les **outils de Bobine** qu'elle doit faire servir avec leur fiche, ce qu'on
**attend**, et ce qu'on **relève** en plus de la grille commune.

Boucle du pilote pour chaque consigne : taper (computer use, ou `pnpm pilote envoyer`), puis
`pnpm pilote attendre` ; selon la raison de sortie, répondre à la carte, juger la réponse
(`etat --long`), ou intervenir et le noter. Détail : [`docs/pilote.md`](../pilote.md).

### Étape 1 — Cadrage (≈ 20 min)

**Outils** : mode Plan et plan annoté ([040](../features/040-plan-annote.md),
[098](../features/098-mode-plan-visible.md), [016](../features/016-questions-mode-plan.md)) ;
panneau **Tâches** et liste épinglée ([035](../features/035-panneau-taches.md),
[077](../features/077-taches-epinglees.md)) ; onglet **Session**
([166](../features/166-onglet-session.md)) ; **mémoire commune**
([182](../features/182-memoire-commune.md)).

1. Accueil du premier lancement : choisir le dossier `taches`, l'agent et le modèle principal.
2. Passer en mode **Plan** (puce du mode, ou ⇧⇥). Vérifier : zone de saisie à la couleur du mode,
   pastille **Plan**, ligne de rappel.
3. Consigne :

   > Nous allons construire un petit gestionnaire de tâches en trois morceaux : (1) une API HTTP
   > en Node.js sans framework, qui stocke les tâches dans un fichier JSON, avec des tests
   > `node --test` ; (2) une page web servie par l'API, qui liste, ajoute, coche et supprime les
   > tâches ; (3) une app iOS en SwiftUI, un seul écran qui liste les tâches lues sur l'API.
   > Propose un plan en étapes, avec l'arborescence et les routes de l'API. Ne modifie rien pour
   > l'instant.

4. Sur le document **Plan proposé** : sélectionner un passage, **Commenter**, écrire « Ajoute une
   route PATCH pour cocher une tâche », **Ajouter la remarque**, puis **Envoyer mes remarques**.
   À la version 2 : **Voir ce qui a changé**.
5. Consigne (toujours en Plan) :

   > Retiens pour ce projet : les messages de commit suivent Conventional Commits, en anglais.

   Une carte **Retenir ce souvenir ?** doit arriver : **Retenir**, portée **Ce projet**. Vérifier
   ensuite dans Réglages › Mémoire › Souvenirs.
6. **Exécuter le plan**. L'agent quitte le mode Plan et crée l'arborescence de base (pas encore le
   code : s'il va plus loin, le laisser, et le noter).
7. Ouvrir l'onglet **Session** (`pnpm pilote panneau session`) : environnement (agent, modèle,
   mode, dossier, branche), contexte par catégorie, modifications.
8. Ouvrir l'onglet **Tâches** (`pnpm pilote panneau taches`).

**Attendu** : plan en document, remarque prise en compte dans la version 2, souvenir retenu et
visible dans les réglages, mode Plan quitté par « Exécuter le plan », onglet Session cohérent.

**Le panneau Tâches et l'agent.** Il n'apparaît que si l'agent envoie une liste de tâches par ACP.
**IBM Bob** le fait ; **OpenCode** non (son outil `todowrite` ne passe pas par ACP, voir
[`docs/agents.md`](../agents.md), « Liste de tâches »). Avec OpenCode, l'absence de l'onglet est
**attendue** : la noter « non applicable », pas « échec ».

**Relever** : nombre de versions du plan ; le souvenir (texte exact) ; présence ou absence de
l'onglet Tâches ; capture du plan, de la carte de souvenir, de l'onglet Session.

### Étape 2 — Maquettes (≈ 20 min)

**Outils** : aperçu des pages HTML dans le navigateur intégré
([064](../features/064-apercu-html.md), [007](../features/007-mcp-navigateur.md)) ; liens vers des
fichiers ([052](../features/052-liens-fichiers.md)) ; question à choix
([016](../features/016-questions-mode-plan.md)).

Bobine n'a pas de fonction « maquettes » à part : une maquette est un fichier HTML que l'agent
écrit, et que Bobine montre dans le navigateur intégré quand on clique sur son lien.

1. Consigne :

   > Fais trois maquettes HTML statiques de la page web, très différentes (par exemple : liste
   > sobre, cartes, tableau dense), dans `maquettes/a.html`, `maquettes/b.html`,
   > `maquettes/c.html`, avec de fausses tâches. Donne-moi les liens, puis demande-moi laquelle
   > je choisis avec une question à choix.

2. Cliquer sur chaque lien `.html` dans le fil : chacune s'ouvre dans un onglet du **Navigateur**
   du panneau. Capture de chacune (computer use : la page est une vue native).
3. Répondre à la question à choix (si l'agent n'en pose pas, répondre en texte et le noter) :
   choisir **b**.

**Attendu** : trois pages qui s'affichent dans le navigateur intégré, pas dans Safari ; la question
à choix (carte), ou à défaut une réponse en texte.

**Relever** : les trois captures ; carte de question posée ou non ; liens qui ouvrent Safari ou le
Finder au lieu du navigateur intégré (défaut).

### Étape 3 — Experts (≈ 20 min)

**Outils** : **rôles** et section **Équipe** ([223](../features/223-roles.md)) ; conversations
filles et leur compte rendu ([097](../features/097-conversations-filles.md),
[160](../features/160-filles-pilotees-tech-lead.md),
[171](../features/171-comptes-rendus-filles-replies.md)).

Rôles fournis : Expert UX/UI, Expert Flutter, Architecte front-end, Architecte back-end, Expert
sécurité, Tech lead, Code reviewer. Il n'y a pas de rôle iOS ou SwiftUI fourni.

1. Dans la zone de saisie, taper `@` et choisir deux rôles, puis le texte. Consigne :

   > @Expert UX/UI @Architecte back-end Donnez votre avis sur le plan et sur la maquette
   > `maquettes/b.html` : trois remarques chacun, les plus importantes d'abord. Ne modifiez rien.

   Deux filles doivent partir **en parallèle**, une par rôle, sans carte d'accord.
2. Créer un rôle **Expert SwiftUI** par l'assistant (menu `@` › **+ Nouveau rôle**, ou section
   Équipe) : description « Relit le code SwiftUI d'une petite app iOS », lecture seule. Il servira
   à l'étape 6.
3. Attendre les comptes rendus dans la mère. Les déplier.
4. Consigne à la mère :

   > Tiens compte des avis des deux experts qui te paraissent justes, et dis lesquels tu écartes.

**Attendu** : deux filles visibles sous la mère dans la barre latérale, avec l'avatar de leur rôle ;
deux comptes rendus repliés dans la mère ; le rôle créé apparaît dans la section Équipe et dans le
menu `@`.

**Relever** : les deux filles partent-elles vraiment en même temps (heures de début) ; durée et coût
de chacune ; un rôle en lecture seule qui modifie quand même un fichier (avec OpenCode, la lecture
seule n'est que demandée : Bobine doit le signaler dans le fil de la fille).

### Étape 4 — Construction (≈ 60 min)

**Outils** : conversations filles, dont certaines avec un autre modèle
([097](../features/097-conversations-filles.md), [112](../features/112-cartes-propositions-filles.md),
[118](../features/118-filles-proposees.md), [160](../features/160-filles-pilotees-tech-lead.md)) ;
changement de modèle ([090](../features/090-puce-modele.md),
[092](../features/092-zone-de-saisie.md)) ; cartes d'autorisation
([006](../features/006-permissions-diffs.md), [203](../features/203-cartes-autorisation-lisibles.md),
[211](../features/211-autorisation-a-risque.md)) ; panneau terminal
([034](../features/034-panneau-terminal.md)) ; commandes « / »
([017](../features/017-commandes-slash.md), [039](../features/039-commandes-app.md),
[045](../features/045-commandes-personnelles.md)) ; file d'attente
([020](../features/020-file-messages.md)).

**4.1 Filles, dont une avec un autre modèle.**

1. Consigne à la mère :

   > /split Trois chantiers indépendants : (a) l'API et ses tests dans `api/` ; (b) la page web
   > dans `web/`, d'après la maquette b, qui appelle l'API ; (c) l'app iOS SwiftUI dans `ios/`,
   > un seul écran qui liste les tâches de l'API (projet Xcode compris).

2. Sur la carte **Tâches proposées** : pour la ligne (b), icône **Agent et modèle**, choisir le
   **modèle des filles « autre modèle »** ; garder le modèle principal pour (a) ; **Faire ici**
   pour (c) (l'iOS se fait dans la mère, étape 6). **Lancer** (a) et (b).
   Constaté le 2026-11-17 : **Faire ici** envoie la tâche (c) à la mère **tout de suite** ; l'iOS se
   fait alors à l'étape 4. Pour garder l'ordre des étapes, préférer **Refuser** pour (c) ; sinon le
   noter, et l'étape 6 commence avec un projet déjà écrit.
3. Si l'agent ne propose rien : menu **…** › **Lancer en parallèle…**, une fille par chantier, et
   le noter (intervention).
4. Suivre la carte **Sous-tâches** dans la mère, et la vue **Filles** de l'onglet Modifications.

**4.2 Changement de modèle en cours de route, dans la mère.**

Pendant que les filles travaillent, dans la mère : puce du modèle › **modèle de remplacement**
(ou `/model <nom>`). Consigne :

> Écris un `README.md` racine qui explique comment lancer l'API, la page et l'app iOS.

Vérifier : l'onglet Session montre le nouveau modèle, la réponse arrive, le coût de la mère compte
les deux modèles. Revenir ensuite au modèle principal.

Avec **IBM Bob**, il n'y a pas de choix du modèle (ni pour la mère, ni pour les filles) : 4.2 et
le modèle de (b) sont « non applicables ». À la place, et seulement si le budget le permet :
**Continuer avec** OpenCode sur une conversation à part (fiche
[108](../features/108-continuer-autre-agent.md)), noté comme variante.

**4.3 Cartes d'autorisation et panneau terminal.**

Consigne à la mère :

> Lance les tests de l'API dans le terminal de Bobine, puis démarre l'API en tâche de fond dans
> un autre onglet du terminal.

- Les commandes que l'agent lance **par les outils de Bobine** (terminal, serveur, compilation)
  demandent l'accord : carte **Lancer** / **Toujours dans ce projet** / **Refuser**. Répondre
  **Lancer** la première fois, **Toujours dans ce projet** la deuxième.
- Avec OpenCode, ses propres écritures et commandes **ne demandent rien** par défaut ([`docs/agents.md`](../agents.md)) :
  ne pas s'attendre à une carte pour elles. Avec Bob, chaque écriture et commande demande, filles
  comprises (la fille reste sur « Attend un accord »).
- Ouvrir l'onglet **Terminal** : les onglets de l'agent, sa sortie. Ouvrir un terminal à soi
  (**+**), y taper `node --version`, sélectionner la sortie, **Ajouter au message**.
- Mention `@terminal` dans un message : « @terminal les tests passent-ils ? ».

**4.4 Commandes.**

- `/context`, puis `/cost` dans la mère : réponses titrées, chiffres cohérents avec la puce.
- Créer une commande `/verifier-api` = « Lance les tests de l'API et résume les échecs en trois
  lignes », et l'utiliser une fois. Réglages › Commandes ne crée que des commandes **personnelles** ;
  une commande **du projet** est un fichier `.bobine/commands/verifier-api.md` (le réglage indique le
  dossier). Noter laquelle a servi.
- `/compact` une fois, si le contexte de la mère dépasse la moitié (sinon « non joué »).

**4.5 Message envoyé pendant que l'agent travaille.**

Pendant un tour long de la mère (ou d'une fille), écrire « Ajoute aussi une route GET /health »
et ↩ : le message attend au-dessus de la zone de saisie (« Partira à la fin de la réponse »). Écrire
un second message, puis sur le premier **Modifier**. Les deux partent ensemble à la fin du tour.

**Attendu (étape 4)** : deux filles finies, chacune sur sa branche `bobine/…`, comptes rendus dans
la mère ; tests de l'API verts ; README écrit avec le modèle de remplacement ; cartes d'autorisation
qui répondent au premier clic ; messages en attente partis ensemble.

**Relever** : modèle réellement utilisé par chaque fille (onglet Session de la fille) ; nombre de
cartes d'autorisation et le temps de réponse au clic ; carte qui ne réagit pas (bloquant ou
sérieux) ; coût de chaque fille et de la mère avant et après le changement de modèle.

### Étape 5 — Web (≈ 30 min)

**Outils** : serveurs de dev ([030](../features/030-lancer-app.md)) ; navigateur intégré
([007](../features/007-mcp-navigateur.md), [072](../features/072-navigateur-autorisations-comme-claude.md),
[129](../features/129-navigateur-defilement-zoom.md)) ; **annoter la page**
([132](../features/132-annoter-la-page.md), [146](../features/146-annoter-page-vivante.md)).

1. Fusionner d'abord les filles (a) et (b) : carte **Sous-tâches** › **Fusionner les N dans
   main** (ou « … recommandées … ») ([120](../features/120-fusionner-toutes-les-filles.md)).
   Tant que le dossier principal a des modifications non commitées, la carte refuse la fusion et
   propose **Committer d'abord** / **Mettre de côté** : prendre **Committer d'abord** et relever le
   message proposé (il devrait suivre le souvenir de l'étape 1).
2. Consigne à la mère :

   > Lance l'API comme serveur de dev de Bobine et ouvre la page dans le navigateur intégré.

   L'agent demande l'accord pour le serveur ; la page s'ouvre dans l'onglet **Navigateur**, avec
   la barre du serveur (journal, **Arrêter le serveur**).
3. Ajouter deux tâches, en cocher une, à la main.
4. **Annoter la page** (icône bulle avec un +) : au moins **deux remarques** sur de vrais défauts
   visibles (alignement, libellé, état vide, contraste ; à défaut, une demande de changement),
   sur deux zones, si possible après un défilement. **Envoyer à l'agent**.
5. L'agent corrige. Recharger la page, vérifier chaque point, le dire à l'agent.

**Attendu** : un message unique à l'agent avec une capture par écran annoté et les éléments visés ;
corrections visibles après rechargement.

**Relever** : capture de la page annotée (computer use) ; l'agent a-t-il vu les éléments visés
(sa réponse cite-t-elle le bon élément) ; serveur toujours vivant à la fin ; nombre d'allers-retours
pour une correction juste.

### Étape 6 — iOS (≈ 40 min)

**Outils** : simulateur iOS ([008](../features/008-simulateur-captures.md),
[009](../features/009-simulateur-video.md), [044](../features/044-simulateur-gestes-chassis.md),
[084](../features/084-zoom-appareils.md)) ; image jointe annotée
([067](../features/067-annoter-capture.md)) ; rôle créé à l'étape 3.

1. Consigne à la mère :

   > Fais l'app iOS dans `ios/` : un projet Xcode SwiftUI, un seul écran qui liste les tâches de
   > l'API (titre, case cochée). Compile-la avec l'outil de Bobine, lance-la dans le simulateur,
   > et fais une capture.

   **Décidé le 2026-11-17** : l'agent écrit **lui-même** le projet Xcode SwiftUI, sans XcodeGen ni
   autre générateur installé pour l'occasion, et sans aide du testeur. S'il n'y arrive pas
   (projet illisible par `xcodebuild`, compilation qui échoue en boucle), c'est un **résultat** à
   noter (nombre d'essais, dernière erreur, durée), pas une raison d'intervenir ; l'étape est alors
   « ✗ (agent) », et les points 2 à 6 ci-dessous sont « non joués (pas d'app compilée) ».
   Autre piège connu, à laisser à l'agent et à noter : l'accès en `http` à `localhost` (App
   Transport Security).
2. Carte **Compiler** : **Compiler**. L'onglet **iOS** montre le simulateur en direct.
3. Toucher l'app soi-même (faire défiler), essayer **Ajuster au panneau** et **Taille réelle**.
4. **Annoter sur une capture.** Il **n'existe pas** de mode « Annoter » sur le simulateur comme sur
   la page web. Ce qui existe : sous l'appareil, **Joindre cet écran au message** ; puis un clic
   sur l'image jointe, dans la zone de saisie, ouvre l'annotation (rectangle, flèche, crayon, texte,
   **Appliquer**). Entourer un défaut, écrire une remarque sur l'image, puis consigne :

   > Corrige ce qui est entouré sur la capture.

5. L'agent corrige, recompile, relance. Vérifier dans l'onglet iOS.
6. `@Expert SwiftUI Relis le code de ios/ : trois remarques au plus.` (rôle créé à l'étape 3).

**Attendu** : app compilée et lancée dans l'onglet iOS, image annotée reçue par l'agent, correction
visible, compte rendu du rôle.

**Relever** : nombre de compilations avant le premier succès ; durée de la première compilation ;
flux du simulateur fluide ou figé ; capture de l'image annotée et de l'écran corrigé (computer
use) ; erreurs de compilation affichées lisiblement ou non.

### Étape 7 — Relecture et git (≈ 25 min)

**Outils** : onglet **Modifications** et remarques sur le diff
([021](../features/021-recap-modifications.md), [085](../features/085-commentaires-diff.md)) ;
**Faire relire…** ([177](../features/177-faire-relire.md)) ; relecture par un rôle
([223](../features/223-roles.md)) ; vue Git, **Committer**, branches des worktrees
([110](../features/110-cycle-worktrees.md), [123](../features/123-fusion-explicite-committer.md)).

1. Onglet **Modifications** (⇧⌘D), vue **Conversation** : parcourir les fichiers. Sur une ligne,
   **+** et une remarque, puis **Envoyer à l'agent**.
2. `@Code reviewer Relis l'ensemble des modifications non commitées : erreurs d'abord.`
3. **Faire relire…** (barre des vues de Modifications) : agent de la conversation, **autre
   modèle** que la mère (OpenCode), points à surveiller « gestion des erreurs réseau ». Lire la
   carte **Relecture**, **Voir sur le diff**, garder une remarque et l'envoyer.
4. Vue **Git** : **Committer (N)**, relire le message proposé (il doit suivre le souvenir de
   l'étape 1 : Conventional Commits en anglais), **Committer**.
5. Vérifier les branches : `git branch` dans le terminal de Bobine montre `main` et les branches
   `bobine/…` des filles ; `git log --oneline` montre les fusions de l'étape 5 et le commit.

**Attendu** : remarques posées sur les bonnes lignes, relecture rendue par `report_findings` sur le
diff, commit fait depuis Bobine sans terminal, historique git cohérent.

**Relever** : nombre de remarques de chaque relecteur et leur gravité ; le message de commit
proposé suit-il le souvenir (sinon : défaut de mémoire ou de l'agent ? à trancher dans le
rapport) ; `git log --oneline --graph` recopié.

### Étape 8 — Accrocs volontaires (≈ 30 min)

**Outils** : arrêter l'agent ([041](../features/041-stabilisation.md),
[126](../features/126-finitions-campagne-octobre.md)) ; reprise après fermeture
([121](../features/121-relance-apres-panne-rejeu.md), [208](../features/208-rien-ne-survit-en-quittant.md)) ;
fenêtre rapide ([062](../features/062-fenetre-rapide.md)) ; pièces jointes
([005](../features/005-images-fichiers.md), [155](../features/155-saisie-colle-brouillons-exclusions.md)) ;
export ([043](../features/043-suite-audit-octobre.md)).

**8.1 Arrêt d'un tour.** Consigne :

> Ajoute une page « À propos » à la page web, avec des tests.

Au bout de 20 à 40 s de travail, **Arrêter** (le carré, ou Échap). Attendu : « Réponse
interrompue », l'outil en cours « interrompu », plus rien ne tourne (`pnpm pilote etat`). Puis
« Continue » : l'agent reprend.

**8.2 Bobine quittée en plein travail, puis relancée.** Relancer une consigne longue (« Ajoute des
tests pour chaque route de l'API »). Pendant le tour : **⌘Q**. Le dialogue « Un agent travaille
encore » doit s'afficher : **Quitter**. Puis :

```bash
pnpm pilote lancer --app /Applications/Bobine.app --profil "$PASSAGE/profil" --journal "$PASSAGE/pilote"
```

Attendu : aucun processus d'agent restant après la fermeture
(`ps -axo command= | grep -E '(opencode|bob)[^ ]* acp' | grep -v grep` vide avant la relance) ; la
conversation rouverte avec son fil identique, filles comprises ; un message « Continue là où tu en
étais » repart. La carte « Où en était-on ? » n'apparaît qu'après plus d'un jour : ne pas
l'attendre ici.

**8.3 Fenêtre rapide.** Depuis le Finder, ⌥⌘B (computer use : le pilote ne voit pas cette
fenêtre). Consigne : « Combien de tests compte l'API de ce projet ? ». Attendu : une nouvelle
conversation, avec l'agent et le dossier des nouvelles conversations, et la fenêtre de Bobine qui
s'ouvre dessus.

**8.4 Pièce jointe.** Préparer `$PASSAGE/taches-exemple.json` (cinq tâches fictives). Dans la
mère, trombone › **Joindre des fichiers…** (fenêtre de macOS : computer use) ou glisser le fichier ;
consigne : « Importe ces tâches dans les données de l'API ». Coller aussi un long texte (plus de
40 lignes) : il devient une pièce jointe « Texte collé ».

**8.5 Export.** Menu **…** de la mère › **Exporter en Markdown…**, puis **Exporter en JSON…**,
dans `$PASSAGE/exports/`. Ouvrir le Markdown : fil lisible, sans secret ni chemin inattendu.

**Relever** : temps entre le clic sur Arrêter et l'arrêt effectif ; fil avant / après relance
(captures) ; processus restants ; erreurs du journal autour de la relance ; taille des exports.

### Étape 9 — Clôture (≈ 20 min)

1. `pnpm pilote journal --resume` : durée, notes par gravité, interventions, durées des tours.
2. Relevés finaux : Réglages › Consommation (période du passage), mémoire, erreurs du journal sur
   tout le passage (`awk` ci-dessus avec l'heure de début du passage).
3. Vérifier l'app produite à la main : `node --test` dans `api/`, la page dans le navigateur
   intégré, l'app dans l'onglet iOS. Le noter (c'est le travail de l'agent, pas de Bobine).
4. Quitter Bobine (`pnpm pilote arreter`). Remettre `~/.bob` si Bob a servi. Garder le profil et
   le projet jusqu'à la fin de la rédaction du rapport, puis les supprimer (corbeille).
5. Remplir le rapport à partir du [modèle](_modele-rapport-poc.md), le committer dans
   `docs/recettes/`. Ouvrir une fiche par défaut sérieux ou bloquant.

## 4. Correspondance outils ↔ étapes

Pour vérifier qu'aucun outil n'a été oublié. Un outil qui n'a pas servi est noté « non joué » au
rapport, avec la raison.

| Outil de Bobine | Fiches | Étape |
|---|---|---|
| Mode Plan, plan annoté, question à choix | 016, 040, 098 | 1, 2 |
| Panneau Tâches, liste épinglée (Bob seulement) | 035, 077 | 1 |
| Onglet Session | 166 | 1, 4.2 |
| Mémoire commune | 182 | 1, 7 |
| Aperçu HTML dans le navigateur intégré | 064, 052 | 2 |
| Rôles, section Équipe, `@rôle`, création d'un rôle | 223 | 3, 6, 7 |
| Conversations filles, `/split`, Tâches proposées, Sous-tâches, vue Filles, fusion | 097, 112, 118, 120, 160, 161 | 3, 4.1, 5 |
| Modèle d'une fille, changement de modèle (OpenCode seulement) | 090, 160 | 4.1, 4.2 |
| Cartes d'autorisation | 006, 203, 211 | 4.3, 5, 6 |
| Panneau terminal, `@terminal` | 034, 057 | 4.3, 7 |
| Commandes « / » de Bobine et du projet | 017, 039, 045 | 4.4 |
| File d'attente | 020 | 4.5 |
| Serveur de dev, navigateur intégré | 007, 030 | 5 |
| Annoter la page | 132, 146 | 5 |
| Simulateur iOS, joindre l'écran, annoter l'image | 008, 044, 067, 084 | 6 |
| Modifications, remarques sur le diff | 021, 085 | 7 |
| Faire relire | 177 | 7 |
| Vue Git, Committer, branches des filles | 110, 123 | 7 |
| Arrêter | 041, 126 | 8.1 |
| Quitter en plein tour, reprise | 121, 208 | 8.2 |
| Fenêtre rapide | 062 | 8.3 |
| Pièces jointes, texte collé | 005, 155 | 8.4 |
| Export Markdown / JSON | 043 | 8.5 |
| Consommation, plafond | 019, 109, 137, 157, 164 | toutes |
| Journal Détaillé | 080 | toutes |

## 5. Ce que le scénario ne couvre pas

Volontairement hors champ, pour tenir en une demi-journée : émulateur Android, PR et CI (pas de
dépôt distant), tâches planifiées, aparté, worktree ouvert à la main, plusieurs dossiers, espace
Discussion, Linux et Windows. Ils ont leurs propres essais.
