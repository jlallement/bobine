# Rapport de recette « Bob courte » avant la rc — Bobine `main` (1.0.0-beta.9 + lots rc) + IBM Bob 2.1.0 — 2026-11-19

<!--
Forme : _modele-rapport-poc.md, adaptée au scénario court de la rc (6 étapes au lieu de 9) :
la grille garde les mêmes colonnes, les étapes sont celles de la demande de recette.
-->

Scénario : recette Bob courte demandée par l'audit avant la rc
([2026-11-19-audit-avant-rc.md](../audits/2026-11-19-audit-avant-rc.md), B9) — fonctions propres à
Bob et chemins à risque de la rc, en 6 étapes. Joué par : pilote (Claude, Opus 5.5), `pnpm pilote`
seul (sans computer use), sur le build du dépôt. Captures :
[2026-11-19-recette-bob-rc1/](2026-11-19-recette-bob-rc1/).

## En bref

- **Verdict rc côté Bob : oui.** Aucun défaut bloquant ni sérieux. Les sondes de contrat sont
  vertes (Bob 2.1.0 et OpenCode 2.3.0, réponses identiques aux relevés).
- **Résultat** : 6 étapes jouées sur 6 ; 4 réussies, 2 avec réserve (5. Commit, 6. Navigateur).
- **Interventions** : 0 au sens de la fiche 206 ; 1 message de rattrapage à l'étape 6, à cause de
  D2.
- **Défauts** : 0 bloquant, 0 sérieux, 2 gênants, 2 cosmétiques. Les deux plus gênants :
  1. **D1** — le coût de la rédaction du message de commit par Bob n'est compté nulle part : ni dans
     la conversation, ni dans Mon activité, ni dans le plafond (critère de la fiche 246 non tenu
     avec Bob).
  2. **D2** — carte « Site web » : « Envoyer » est actif sans choix, alors que l'option 1
     « Autoriser » paraît choisie. Un clic envoie une réponse vide, traitée comme un refus. Bob
     refuse ensuite de réessayer tant que l'utilisateur ne l'a pas réautorisé en toutes lettres.
- **Consommation** : **1,1456 Bobcoins affichés** (conversation, sous-agent compris ; même total
  dans Mon activité › « Aujourd'hui », lu dans la base de Bob), **plus la rédaction du message de
  commit, non mesurable** (D1 ; un tour court de 1,8 s, sans outil). Plafond de la conversation :
  4 Bobcoins, non atteint. Budget de la recette : 12, arrêt prévu à 10 — loin de l'un et de
  l'autre.
- **Durée** : 9 min 47 s de jeu (10:25:41 → 10:35:28), 10 tours Bob (9 dans la conversation, 1
  pour le commit), médiane 9 s, max 36 s.
- **Journaux** (Détaillé) : **0 `ERROR`, 0 `WARN`** dans `main.log` comme dans `agents.log`.
- **Mémoire** : Electron et `bob acp` ensemble ≈ 1,08 Go en fin de passage.
- **Comparé à la recette Bob du 2026-10-23** ([lien](2026-10-23-recette-bob.md)) : la reprise
  après relance de l'agent rejoue un fil propre (D21 d'alors non reproduit : 5 messages, 5
  réponses, 11 outils avant comme après). Le coût des sous-agents s'affiche sur leur carte, et le
  premier tour coûte 0,21 Bobcoin au lieu de 2,68.

## Paramètres et environnement

| | |
|---|---|
| Bobine | `main` à `9071838` (en-tête de journal : 1.0.0-beta.9, Electron 45.3.4), build du dépôt (`pnpm build`), lancé par `pnpm pilote lancer --dossier …` |
| Profil | **temporaire** (`--profil-temporaire`, vérifié dans la ligne de commande du processus ; effacé à la fermeture, vérifié) ; journal Détaillé |
| Agent | IBM Bob — Bob Shell 2.1.0 (commit `8afc0007b`), `bob acp`, connexion SSO déjà faite par Jérôme |
| Modèle principal | non communiqué par Bob |
| Accès au modèle | Bobcoins |
| Plafond de l'agent | 12 Bobcoins pour la recette, suivi à la main (Bobine n'a pas de plafond par agent, seulement par conversation) ; plafond par conversation 4 Bobcoins (Réglages › Conversations) |
| Projet | `~/Development/bobine-recette/rc1-bob` : dépôt jetable (`petit-calcul`, Node sans dépendance, 1 fonction, 1 test), identité git locale « Recette » |
| Pages web | `~/Development/bobine-recette/rc1-site` servies par `python3 -m http.server` sur 127.0.0.1:8765, plus `https://example.com/` comme site extérieur |
| Mac | macOS 27.2.1, Apple M5 Pro, 24 Go |
| Node.js, git | 26.13.0, 2.56.1 |
| Pilote | `pnpm pilote` de `main` ; computer use : non (clics par le protocole DevTools, plus un petit script local pour 3 contrôles sans nom accessible : interrupteur du plafond, champ Montant, liste Journal) |
| `~/.bob` | copie intégrale avant le passage (`ditto`, 6,4 Mo) ; voir § État laissé |

## Sondes de contrat (0 Bobcoin)

| Sonde | Résultat |
|---|---|
| `pnpm bob-probe` | ✓ « Bob se comporte comme prévu » — tout le contrat de l'app vert (outils de l'app par MCP HTTP, `session/load`, `session/resume`, `session/delete`, SSO, dossier non approuvé, connexion requise, licence, clé expirée, coûts lisibles dans `tasks`, quota par `/status`, règles d'approbation gardées par Bob) ; **réponses identiques** à celles de Bob 2.1.0 du 2026-11-14 |
| `pnpm opencode-probe --offline` | ✓ « OpenCode se comporte comme prévu » ; réponses identiques à celles d'OpenCode 2.3.0 du 2026-11-17 ; « À regarder : rien de nouveau » |

## Grille par étape

Résultat : ✓ réussi, ~ avec réserve, ✗ échec, NA non applicable, NJ non jouée (raison en note).

| Étape | Résultat | Début–fin | Durée des tours | Interventions | Blocages | `ERROR` / `WARN` | Coût agent (Bobcoins) | Captures |
|---|---|---|---|---|---|---|---|---|
| 0. Accueil, réglages | ✓ | 10:25–10:28 | — | 0 | 0 | 0 / 0 | 0 (essai de l'accueil passé) | `0-plafond-par-conversation` |
| 1. Premier tour | ✓ | 10:28:17–10:28:28 | 10 s | 0 | 0 | 0 / 0 | 0,2068 | `1-cout-premier-tour` |
| 2. Petite construction | ✓ | 10:29:07–10:30:16 | 36 s + 21 s | 0 | 0 | 0 / 0 | 0,1797 + 0,0934 | `2-carte-commande`, `2-carte-pour-tous-les-projets`, `2-reglages-approbations-apres` |
| 3. Sous-agent | ✓ | 10:30:41–10:30:51 | 9 s | 0 | 0 | 0 / 0 | 0,1086 (dont sous-agent 0,0069) | — (la carte montre un chemin complet) |
| 4. Reprise | ✓ | 10:31:05–10:31:40 | 1 s | 0 | 0 | 0 / 0 | 0,0492 | — |
| 5. Commit | ~ | 10:31:56–10:33:20 | 1,8 s (rédaction) | 0 | 0 | 0 / 0 | **non mesurable (D1)** | `5-message-de-commit-redige`, `5-commit-fait` |
| 6. Navigateur intégré | ~ | 10:33:35–10:35:05 | 6 + 14 + 2 + 6 s | 0 (1 message de rattrapage, D2) | 0 | 0 / 0 | 0,1998 + 0,1529 + 0,0515 + 0,1037 = 0,5079 | `6-carte-site-web` |
| **Total** | 4 ✓, 2 ~ | 10:25–10:35 | 1 min 45 s | 0 | 0 | **0 / 0** | **1,1456 + rédaction du commit** | 8 |

## Relevés propres à chaque étape

### 0. Accueil et réglages

- Accueil joué en entier : Agent (IBM Bob trouvé, OpenCode trouvé) → Connexion (« IBM Bob est
  prêt · Il a démarré en 0,7 s ») → Dossier (« Choisir… » préréglé) → Essai.
- **Essai de l'accueil passé** (« Passer cette étape ») : il envoie un message au modèle (payant
  avec Bob) avant que l'utilisateur puisse régler un plafond. Il n'a pas été joué, pour que le
  plafond soit réglé avant le premier tour comme le demandait la recette ; son coût n'est donc pas
  mesuré.
- Plafond : Réglages › Conversations › « Plafond par conversation » activé, Montant 4 ; relu dans
  le détail de la consommation de la conversation : « Plafond 4 Bobcoins (réglages) ».
- Journal : Réglages › Diagnostic › Journal sur Détaillé (`Niveau du journal : detailed` dans
  `main.log`).
- Réglages › Agents › IBM Bob : « Prêt · 2.1.0 », capacités annoncées et section « Propre à IBM
  Bob » (règles d'approbation, consommation, sous-agents, reprise…), dont « Versions vérifiées : 2.0.6, 2.0.9, 2.1.0 ».

### 1. Premier tour

- Demande : « Lis ce petit projet et résume-le en trois lignes, sans rien modifier. »
- 7 lectures, réponse juste (projet `petit-calcul`, `totalHT`, test `node:test`), **10 s**.
- Coût hors protocole (fiche 157) **affiché au bon tour** : « Terminé en 10 s · 0,2068 Bobcoins »,
  même montant dans la barre de saisie, dans le détail de la consommation et dans Mon activité.
  **Pas de « ≈ »** devant les Bobcoins. Jetons : « non communiqué », cohérent (Bob ne les envoie
  pas) ; l'onglet Session donne une estimation du contexte connu (≈ 6k, « IBM Bob ne donne pas le
  remplissage de son contexte »).
- Titre donné par Bob : « Résumé du projet **Bobine** en trois lignes » (D4).

### 2. Petite construction

- Demande : `totalTTC(lignes, taux)` + son test, puis `npm test`. Résultat juste (2 tests verts,
  arrondi au centime), 36 s, 2 fichiers +10 −1.
- Cartes : 2 « Autoriser cette modification ? » (fichier et diff ; note « IBM Bob : toutes les
  modifications de fichiers de cette conversation »), 1 « Autoriser cette commande ? » (`npm
  test`, dossier `rc1-bob`, note « cette commande et chacune de ses parties, jusqu'à la fin de la
  conversation »). Réponse au premier clic : oui, 3 fois sur 3. Après « Toujours dans cette
  conversation » sur la 2ᵉ modification, aucune autre carte de modification.
- « Toujours cette commande ici » : **non applicable à Bob**. Ce choix (fiche 247, D5) est celui
  des commandes lancées par les outils de Bobine (`command-approval.ts`, serveur MCP de l'app). Les
  cartes de commande de Bob proposent les options de Bob (« Autoriser une fois », « Toujours dans
  cette conversation », « Refuser ») et le pied « Pour tous les projets » de la fiche 215. Aucun
  outil de commande de Bobine n'a servi dans ce passage.
- **Règles d'approbation de Bob (fiche 215), premier essai réel** :
  - Avant : Réglages › Agents › IBM Bob › Approbations lit correctement `~/.bob/settings/settings.json`
    (Lecture activée, « Commandes de la liste » coupé, « liste par défaut de Bob » de 15 commandes
    signalée comme absente du fichier, aucune commande refusée).
  - 2ᵉ `npm test` : pied « Pour tous les projets » déplié, encadré « Première commande autorisée
    partout… », **« Autoriser partout »**. `main.log` : `Règles d'approbation (bob) :
    allowCommandEverywhere écrit`. La carte reçoit « Toujours dans cette conversation » ; le fil
    affiche « `npm test` autorisée pour tous les projets · Gérer ».
  - Après : les Réglages relisent « Commandes de la liste » activé et 16 commandes, `npm test` en
    tête.
  - **Copie de sauvegarde** `~/.bob/settings/settings.json.bobine.bak` écrite au même moment,
    **identique octet pour octet** au `settings.json` d'avant l'écriture (vérifié par `cmp` contre
    la copie de la recette, sans rien afficher). Droits du fichier gardés (`600`).

### 3. Sous-agent

- Demande : un seul sous-agent (`spawn_subagent`) qui vérifie si le README mentionne `totalTTC`.
- Carte « Lancer ce sous-agent ? » avec la consigne complète de Bob et la note « L'agent ne
  transmet pas le travail du sous-agent… ». Autorisé une fois.
- Carte « Sous-agent · 1 fini » : rôle `explore`, 2 s, **0,0069 Bobcoins** sur la ligne et en
  tête ; « Réponse › » ouvre son compte rendu. Réponse de la mère juste (« totalTTC n'est pas
  mentionné dans le README »). Tour : 9 s, 0,1086 Bobcoins.

### 4. Reprise

- Le profil temporaire est effacé à la fermeture : la reprise a été jouée dans la même instance.
  1. Réglages › Agents › IBM Bob › **Relancer** : `bob acp` arrêté (SIGTERM après 325 s) et relancé.
  2. Message suivant : « Sans relire les fichiers : quel est le nom de la fonction que tu as
     ajoutée tout à l'heure ? » → `session/load` en 277 ms, réponse « totalTTC » en 1 s
     (0,0492 Bobcoins) : **la session de Bob reprend avec sa mémoire**.
  3. « Nouvelle conversation », puis retour à la conversation par l'historique.
- Fil après la relance comme après le retour : 5 messages, 5 réponses, 11 outils (7 + 2 + 1 + 1),
  sans doublon ni texte collé (D21 du 2026-10-23 non reproduit).

### 5. Commit (fiche 246)

- Vue Git (Modifications › Git) → « Committer (2) » : « Rédaction par IBM Bob… 2 s », puis
  « Rédigé par IBM Bob en 3 s, d'après 2 fichiers », « Rédiger à nouveau ». Session jetable vue
  dans `agents.log` (`session/new` sans serveur MCP, tour `end_turn` en 1,8 s, `session/delete`
  2,3 s après la fin du tour).
- Message proposé, juste et en anglais :

  ```text
  feat(prix): add totalTTC function with VAT rounding

  Implements `totalTTC` which applies a tax rate to the HT total and rounds the result to the
  nearest centime. Adds corresponding tests.
  ```

- « Committer » → « Commit 6d91966 fait. » ; `git log` du projet : `6d91966 feat(prix): add
  totalTTC…` ; vue Git à 0.
- **Coût de la rédaction : non mesurable (D1).** Coût de la conversation inchangé (0,6378 avant
  et après) ; Mon activité › « Aujourd'hui » (lu dans la base de Bob) égal au total de la
  conversation, en fin de passage aussi (1,1456). La dépense de la session jetable n'apparaît
  nulle part. Estimation de la demande (0,02–0,035) ni confirmée ni infirmée ; un tour sans outil
  de 1,8 s, comparé au tour de reprise (1 s, 0,0492), la met plutôt vers 0,03–0,06.
- `git log --oneline` du projet :

  ```text
  6d91966 feat(prix): add totalTTC function with VAT rounding
  79dab34 chore: initial
  ```

### 6. Navigateur intégré (garde de la fiche 249)

- Tour 1 : « ouvre http://localhost:8765/a.html, puis clique sur le lien vers example.com ».
  Page locale ouverte sans carte (localhost) ; **le clic vers `https://example.com/` est arrêté
  par la garde**, et Bob le dit (« Le navigateur de Bobine a bloqué la navigation… les sites
  externes doivent être approuvés explicitement »). 3 actions, 6 s, 0,1998.
- Tour 2 : « ouvre example.com avec browser_navigate, puis http://localhost:8765/b.html ». **Carte
  « Site web »** : « L'agent veut ouvrir example.com dans le navigateur intégré. L'autoriser ? »
  (Autoriser · Toujours autoriser · Refuser). Le pilote clique « Envoyer » en croyant l'option 1
  choisie (elle porte le cadre de focus) → réponse **« Sans réponse »**, navigation refusée ; page
  B locale ouverte, titre « Page B locale » juste (D2). 14 s, 0,1529.
- Tour 3 : « Réessaie » → Bob refuse : « L'utilisateur a refusé… l'instruction reçue est de ne pas
  réessayer ». 2 s, 0,0515.
- Tour 4 : « je me suis trompé de bouton… réessaie » → nouvelle carte ; clic direct sur
  « 1 Autoriser » (envoie aussitôt) → page ouverte, titre « Example Domain » juste. 6 s, 0,1037.
- Demande d'outil MCP par Bob (`session/request_permission` « Running Browser Navigate
  (bobine) ») : accordée par Bobine en 0 ms, comme prévu (la décision est la carte « Site web »).
- Budget de l'étape (≤ 1 Bobcoin) tenu : 0,5079.

## Défauts

| N° | Gravité | Étape | Côté | Ce qui se passe | Reproduction | Journal / capture | Fiche |
|---|---|---|---|---|---|---|---|
| D1 | gênant | 5 | Bobine | Le coût de la rédaction du message de commit par Bob n'est ajouté ni à la conversation (0,6378 avant et après), ni à Mon activité, ni au plafond. Critère de la fiche 246 « Coût de la rédaction ajouté au coût de la conversation » non tenu avec Bob. Une dépense réelle reste invisible et échappe au plafond. **Cause probable** : avec Bob, le coût n'arrive pas par ACP mais par la base `~/.bob/db/bob.db`. La session jetable est supprimée chez Bob (`session/delete`) 2,3 s après la fin du tour (`LATE_COST_MS`) : soit l'hôte jetable ne relit pas la base, soit la ligne `tasks` disparaît avec la session avant d'être lue. Mon activité (« Aujourd'hui », lu dans la même base) ne la voit pas non plus, ce qui va dans le sens de la seconde hypothèse. | vu une fois (une seule rédaction jouée) ; à rejouer avec le scénario d'agent factice « coût tardif, puis suppression de la session » | `agents.log` 09:31:57–09:32:01 ; `5-message-de-commit-redige.jpg` | à ouvrir |
| D2 | gênant | 6 | Bobine | Carte « Site web » (question à choix) : aucune option n'est choisie, mais l'option 1 « Autoriser » porte le cadre de focus et « Envoyer » est actif. Un clic sur « Envoyer » envoie une réponse vide (« Sans réponse »), que la garde traite comme un refus. Ensuite Bob refuse de réessayer (« l'instruction reçue est de ne pas réessayer ») jusqu'à un message explicite de l'utilisateur. On reste du côté sûr, mais c'est trompeur. **Cause probable** : la question de la carte n'est pas marquée obligatoire, et `QuestionCard` ne désactive « Envoyer » que si une question obligatoire est sans réponse ; le cadre de focus ressemble à une sélection. | vu une fois ; pas reproduit pour ne pas dépenser | note du pilote 10:34:50 ; `6-carte-site-web.jpg` | à ouvrir |
| D3 | cosmétique | 0 | Bobine | Réglages › Conversations : l'interrupteur « Plafond par conversation » (`label.switch` > `input` sans texte) n'a pas de nom accessible ; `pnpm pilote cliquer` ne le trouve pas, un lecteur d'écran non plus. | toujours | `0-plafond-par-conversation.jpg` | — |
| D4 | cosmétique | 1 | agent, induit par Bobine | Bob intitule la conversation « Résumé du projet **Bobine** en trois lignes » pour le projet `petit-calcul`. **Cause probable** : le contexte que Bobine joint au premier message (2 blocs, 4,5 Ko) parle de Bobine, et Bob en tire son titre (`session_info_update`). | vu une fois | `1-cout-premier-tour.jpg` | — |

**Bloquants pour la rc : aucun.** D1 et D2 peuvent attendre la 1.0 finale. D1 est à corriger avant la
finale, parce qu'une dépense en Bobcoins échappe au plafond.

## Remarques (pas des défauts)

- **Pas de plafond par agent ni par jour** : Bobine n'a que le plafond par conversation. Le budget
  de 12 Bobcoins de la recette a été suivi à la main (Mon activité › « Aujourd'hui » fait le
  compte, sans arrêter quoi que ce soit). Idée pour après la 1.0.
- **Essai de l'accueil avant tout réglage** : il coûte un tour au modèle (avec Bob) et vient avant
  que l'utilisateur ait pu régler un plafond ; son montant est annoncé (« celui d'un message très
  court »), et il se passe. Pas joué ici.
- **Quota du mois** non affiché : voulu sur un profil temporaire (`setupQuotas` coupé quand
  `disposable`), donc pas vérifié dans ce passage.

## Interventions

| Heure | Étape | Ce que le testeur a fait | Pourquoi | Un humain l'aurait-il trouvé ? |
|---|---|---|---|---|
| — | — | aucune au sens de la fiche 206 | — | — |
| 10:35:02 | 6 | message « je me suis trompé de bouton… réessaie » | D2 : refus involontaire, puis Bob qui ne veut plus réessayer | oui, en lisant la réponse de Bob |

## Erreurs du journal

`main.log` et `agents.log` (niveau Détaillé) de tout le passage : aucune ligne `ERROR` ni `WARN`.

```text
(aucune)
```

## État laissé

- Bobine quittée par `pnpm pilote arreter` ; **profil temporaire effacé** (aucun
  `bobine-profil-*` restant) ; serveur web d'essai arrêté.
- Projet d'essai gardé : `~/Development/bobine-recette/rc1-bob` (2 commits, dépôt local
  seulement), `~/Development/bobine-recette/rc1-site` (2 pages).
- **`~/.bob`** : copie intégrale avant le passage dans
  `~/Development/bobine-recette/bob-backup-2026-11-19-rc1/.bob`. Fichiers modifiés pendant le
  passage (noms seulement, aucun contenu lu) : `settings/settings.json` (écrit par « Autoriser
  partout »), `settings/settings.json.bobine.bak` (sauvegarde de Bobine, identique au
  `settings.json` d'origine), `settings/auth-secrets.json` (écrit par Bob, non ouvert, non
  restauré), `db/bob.db`, `db/bob.db-wal`, `db/bob.db-shm` (Bob), 6 journaux
  `logs/shell/bob-shell-20261119T10*.log` (un par lancement de `bob acp`). **`settings/settings.json`
  restauré** depuis la copie (identique vérifié, droits `600`) ; `settings/mcp.json` absent avant
  comme après. La commande `npm test` autorisée partout pendant l'essai n'y figure donc plus.
