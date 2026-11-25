# Recette réelle du tour de table — Bobine 1.2 (branche `1.2`) + OpenCode 2.3.0 + IBM Bob 2.1.0 — 2026-11-25

<!--
Forme : celle de 2026-11-19-recette-bob-rc1.md (rapport de recette « Bob courte »), adaptée au
tour de table : la partie A (OpenCode, modèles gratuits) puis la partie B (IBM Bob, 5 Bobcoins au
plus). Fiche : docs/features/285-tour-de-table.md. Observations préalables : lot 0
(2026-11-24-tour-de-table-lot0.md).
-->

Joué par : pilote (Claude, Opus 5.5), `pnpm pilote` plus un petit script local par le protocole
DevTools (clics, frappe, lecture du DOM), sans computer use, sur le build du dépôt. Aucun code
modifié. Captures : [2026-11-25-recette-tour-de-table/](2026-11-25-recette-tour-de-table/).

## En bref

- **Verdict : oui, prête à être essayée par l'utilisateur, avec réserves.** Rien de bloquant. Le
  parcours est complet avec de vrais agents : lancement en deux gestes, recueil en parallèle,
  synthèse automatique, réplique et décision, « Appliquer », arrêt, « Synthétiser sans attendre »,
  reprise après un arrêt brutal, Bob participant et Bob arbitre, plafond. **Pas publiable en
  l'état** : trois défauts sérieux touchent la promesse même de la fonction.
- **Réserves (défauts sérieux)** :
  1. **S1 — La synthèse n'est pas en lecture seule.** L'agent qui arbitre (OpenCode, mode Build)
     a écrit des fichiers pendant trois synthèses : `NOTES.md` aux tours 2 et 3, parce que la
     question le demandait, et un fichier hors du dépôt au tour 4, sans qu'on le lui demande. La
     page d'aide dit « Appliquer » est « le seul moment où des fichiers peuvent changer » : c'est
     faux.
  2. **S2 — Le « dernier échange » envoyé aux participants contient les demandes internes de
     synthèse des tours précédents.** Les consignes d'arbitre et l'ancienne question y figurent,
     présentées comme `User:`. S'y ajoute un échange périmé, celui de « Appliquer » du tour 1.
     Nemotron a répondu à **la question d'un tour précédent**, deux fois sur deux (tours 4 et 6).
  3. **S3 — Le vrai nom au survol ne marche jamais.** Les 9 synthèses et décisions écrivent
     « A », « B et C », jamais « Participant B ». Le greffon ne reconnaît que « Participant X ».
     Et comme la carte ne montre pas les lettres, l'utilisateur ne peut pas savoir qui est A.
- **Défauts** : 0 bloquant, 3 sérieux, 6 gênants, 3 cosmétiques (§ Défauts).
- **Suivi du format en cinq rubriques** : **21 avis sur 24** (88 %), relevé dans les textes
  rendus. Les 3 écarts sont tous au tour 2, dont la question poussait à écrire un fichier :
  **21 sur 21** ailleurs. Réponse courte et confiance lues sur toutes les lignes conformes ; la
  mention « format non suivi » s'est affichée 2 fois, et à bon droit.
- **Qualité de la synthèse** : arbitre OpenCode (Tidepool Alpha Free) **moyenne molle**. Il
  écrit « je ne compte pas les voix », puis suit la majorité, qui était aussi son propre avis :
  Tidepool participait. Il rejette des points secondaires et esquive l'argument décisif. **Bob
  arbitre : un vrai arbitrage**, avec vérification dans le code, rejets argumentés et
  recommandation nette. Le choix de l'arbitre compte plus que celui des participants.
- **Consommation** : **≈ 3,80 M jetons** (cache compris, 34 conversations), **0 $US** (modèles
  gratuits) et **0,2662 Bobcoin**, pour un budget de 5 et un arrêt prévu à 4.
- **Journaux** (Détaillé, puis Trace après le redémarrage) : **0 `ERROR`** et 6 `WARN`, tous
  attendus : 3 « dossier a changé » au tour piégé, 2 notifications refusées par macOS, 1 rapport
  d'arrêt brutal.
- **Mémoire** : ≈ 450 à 670 Mo RSS par agent OpenCode (deux processus), comme au lot 0 ; Bob
  285 Mo. Les agents des participants **restent vivants après le tour** (G1) : jusqu'à 6 OpenCode
  en même temps, ≈ 3,6 Go.

## Paramètres et environnement

| | |
|---|---|
| Bobine | branche `1.2` à `771ce682` (`package.json` : 1.1.0-rc.2 ; en-tête de journal : Electron 45.4.1), build du dépôt (`pnpm build`), lancé par `pnpm pilote lancer --dossier …` |
| Profil | **temporaire** pour la partie A jusqu'au redémarrage ; puis **copie de ce profil** dans le dossier de travail (`--profil`), pour survivre à l'arrêt brutal (§ 8) et pour la partie B. Jamais le profil ni la fenêtre de l'utilisateur |
| Journal | `BOBINE_LOG=detailed`, puis `BOBINE_LOG=trace` après le redémarrage |
| OpenCode | 2.3.0 (`initialize` : « OpenCode 2.3.0 »), configuration réelle de la machine, rien d'ajouté ni de lu par nous. Modèles gratuits seulement |
| IBM Bob | Bob Shell 2.1.0 (commit `8afc0007b`), `bob acp`, connexion existante : **aucune demande de SSO** |
| Modèles participants | Tidepool Alpha Free, DeepSeek V4.1 Flash Free, Nemotron 3.5 Lightning Free, MiMo-V2.6-Flash Free (tous `opencode/*-free`) ; IBM Bob (modèle non communiqué) |
| Arbitre | OpenCode · Tidepool Alpha Free (modèle par défaut de la conversation) ; IBM Bob en B2 |
| Projet | `~/Development/bobine-recette/tdt-1-2` : `petit-stock` (Node sans dépendance : `stock.js`, `persistance.js`, `alertes.js`, un test `node --test`), un choix ouvert dans le README (JSON réécrit, journal append-only ou SQLite pour deux caisses). Identité git locale « Recette » |
| Mac | macOS 27.2.1, Apple M5 Pro, 24 Go ; Node 26.13.0, git 2.56.1 |
| `~/.bob` | copie intégrale avant la partie B (`ditto`, 6,8 Mo) ; voir § État laissé |

Le menu « Autres modèles… » liste aussi les modèles payants connectés sur la machine (une
soixantaine de GPT-*) sans distinction, conformément à la décision 2 de la fiche. Seuls des
modèles « Free » ont été cochés.

## Grille par étape

Résultat : ✓ réussi, ~ avec réserve, ✗ échec, NJ non joué (raison en note). Heures UTC.

| Étape | Résultat | Heure | Durées | `ERROR` / `WARN` | Coût | Captures |
|---|---|---|---|---|---|---|
| A1. Premier usage (`/roundtable`, Entrée ouvre le menu, 3 modèles) | ✓ | 00:24–00:25 | — | 0 / 0 | — | `a1-ligne-premier-usage`, `a1-menu-participants` |
| A2. Recueil (tour 1) | ✓ | 00:25:01 | avis en 16,6 / 21,2 / 25,5 s | 0 / 0 | 0 $ | `a2-recueil-activite-direct` (tour 2) |
| A3. Avis | ✓ | — | — | — | — | `a4-synthese-fin-actions` |
| A4. Synthèse automatique | ~ (S3, qualité) | 00:25:28 | 67,3 s | 0 / 0 | 0 $ | `a4-synthese-fin-actions` |
| A5. Réplique et décision | ✓ (C1) | 00:27:46 | répliques 5,9 / 9,1 / 9,7 s ; décision 59,1 s | 0 / 0 | 0 $ ; tour 1 entier : 399,6 k jetons | `a5-replique-positions`, `a5-decision-libelle-brut` |
| A6. « Demander à OpenCode de l'appliquer » | ✓ | 00:29:31 | 96,2 s | 0 / 0 | 0 $ | — |
| A7a. Tour piégé (« crée NOTES.md »), sans rôle installé | ~ (S1) | 00:31:42 | avis 25,4 / ≈ 56 / 58,1 s ; synthèse 90,8 s | 0 / 3 (attendus) | 673,9 k jetons | `a7-ecritures-avis-dossier-change`, `a7-carte-a-modifie-format-non-suivi` |
| A7b. Rôle « Participant » installé (portée projet), même tour | ~ (S1) | 00:35–00:38 | avis ≤ 29 s ; synthèse 85 s | 0 / 0 | 785,6 k jetons | `a7-installer-portee-defaut-personnelle`, `a7-installe-ce-projet`, `a7-tour3-avis-et-faire-reagir-precedent` |
| A8a. « Synthétiser sans attendre » (4 participants) | ✓ (S1, S2) | 00:39:03 | bouton à 2 avis (≈ 39 s), MiMo arrêté à 41,5 s ; synthèse 199 s | 0 / 0 | ≈ 784 k jetons | `a8-synthetiser-sans-attendre`, `a6-synthese-ecrit-un-fichier` |
| A8b. « Arrêter » tout le tour | ✓ | 00:43:37 | arrêt demandé à 7 s, « arrêté » 10 s plus tard | 0 / 0 | 15,1 k jetons | — |
| A8c. Arrêt brutal en plein recueil, puis reprise | ✓ (C2) | 00:45:09 | arrêt à 00:45:51 (3 avis sur 4) ; relance 00:46:04 ; reprise 00:46:24 ; synthèse 40,5 s | 0 / 1 (rapport d'arrêt, attendu) | — | `a8-apres-redemarrage` |
| A8d. Barre latérale, pied « Consommé », ligne de surcoût, infobulle | ✓ (G5) | — | — | — | — | `a8-infobulle-participants` |
| B1. Bob participant (conversation OpenCode) | ✓ | 00:49:16 | Bob 10,0 s ; OpenCode 12,0 / 13,0 s | 0 / 0 | **0,0497 Bobcoin** | `b1-menu-bob-un-siege`, `b1-carte-bob-participant` |
| B2. Bob arbitre (3 participants OpenCode) | ✓ (S3) | 00:51:24 | avis ≈ 21 s ; synthèse de Bob 24,8 s | 0 / 0 | **0,1929 Bobcoin** | `b2-synthese-bob` |
| B3. Plafond par conversation à 0,01 | ✓ | 00:53:11 | Bob arrêté à 1,7 s | 0 / 0 | **0,0236 Bobcoin** | `b3-bob-arrete-plafond` |
| **Total** | 9 ✓, 6 ~ | 00:24–00:55 | — | **0 / 6** | **0 $ + 0,2662 Bobcoin** | 19 |

## Relevés par étape

### A1. Premier usage

- `/roundtable` tapé : le menu « / » propose `/roundtable [question] · Poser la question à
  plusieurs modèles`. L'espace et la question posent l'étiquette « Tour de table ». La ligne dit
  « Choisir les participants ▾ · 2 à 5 modèles », et le bouton d'envoi est atténué.
- **Entrée ouvre le menu** « Participants · 2 à 5 » : IBM Bob, le modèle de la conversation, puis
  « Autres modèles… » avec sa recherche, et la phrase de pied attendue. Trois cases cochées : la
  ligne devient « 3 participants ▾ + synthèse · ≈ 4 fois les jetons d'une question simple ». Avec
  4 participants : « ≈ 5 fois ».
- Le choix est retenu d'un tour à l'autre et d'une conversation à l'autre : les tours suivants
  sont partis avec les mêmes cases.

### A2. Recueil

- La carte vit en direct : « 0 avis sur 3 », une ligne par participant avec l'outil en cours
  (« Lecture de src/persistance.js », `find test -type f …`) et le temps (« 0:12 »). Le pied dit
  « Lecture seule demandée · chacun répond sans voir les autres ». Capture `a2-…`.
- Les trois agents démarrent en ≈ 1,2 à 3,5 s (`session/new`). Le modèle est réglé par
  `session/set_config_option model=opencode/…` ; Tidepool n'en reçoit pas, puisque c'est le
  modèle par défaut.
- **Modèle affiché = modèle utilisé** : 17 places sur 17 concordent entre le réglage envoyé
  (`agents.log`) et le modèle relevé par Bobine pour chaque tour (`usage.turns[].model`). L'ACP
  ne confirme pas le modèle (lot 0, O6), et la base d'OpenCode de l'utilisateur n'a pas été lue :
  la vérification s'arrête là.

### A3. Avis

- Tour 1 : les trois avis suivent les cinq rubriques. Deux ont leurs titres en anglais
  (« Short answer », « Confidence: medium ») dans une réponse en français. La ligne montre la
  réponse courte et « confiance moyenne / haute » : la lecture tolère l'anglais.
- Les participants se sont partagé les trois options : DeepSeek pour SQLite, avec l'argument le
  plus solide (état mémoire par processus, vue périmée dans `sortie()`, instantané réécrit par deux
  processus) ; Tidepool et Nemotron pour le journal append-only.

### A4. Synthèse

- Partie seule dès le dernier avis (00:25:28, `collecting → synthesizing`). « Synthèse demandée ·
  3 avis » dans le fil, carte repliée en une ligne, étiquette « Synthèse du tour de table ·
  opencode/Tidepool Alpha Free » (C1).
- **Six rubriques présentes**, avec quelques variantes de titres (« Différences et pourquoi »).
- **Lettres** : la synthèse écrit « B et C convergent », « A s'oppose », jamais « Participant
  B ». Aucun `abbr[data-letter]` dans le DOM, aucune infobulle : voir **S3**.
- **Rejet** : un seul, mineur (« A, “le README promet une écriture atomique” : inexact »). C'est
  juste, mais secondaire.
- **Qualité : moyenne molle.** La synthèse écrit « C'est une majorité, et la règle dit : la
  majorité n'est pas une preuve. Je ne compte pas les voix », puis recommande l'option de la
  majorité. L'arbitre (Tidepool) y avait lui-même un avis, sous la lettre B. L'argument décisif de
  A (deux processus qui gardent chacun leur état en mémoire) n'est ni réfuté ni retenu : il est
  classé en « préférence ».
- **Aucun nom de modèle dans la demande de synthèse.** `agents.log`, même en Trace, tronque le
  message à ≈ 500 caractères (« (+15430 car.) »). La vérification passe donc par trois sources :
  - le début du message relu au journal : « labelled Participant A, B, C… in a shuffled order ;
    you do not know which model wrote which » ;
  - le code qui construit le bloc des avis (`opinionsBlock` de `roundtable-prompts.ts` : lettre,
    issue, avertissement, texte) ;
  - une recherche des noms (Tidepool, DeepSeek, Nemotron, MiMo, GPT, Claude, Qwen…) dans les 24
    avis rendus : **aucun**.

### A5. Réplique et décision

- « Faire réagir les participants » avec son rappel « ≈ 4 fois les jetons d'une question
  simple ». Carte « Réplique · 3 réponses » ; positions lues : **Tidepool « nuance », DeepSeek
  « maintient », Nemotron « maintient »**. Le « Position: maintained » anglais de Nemotron est lu
  aussi.
- La réplique de DeepSeek est la meilleure pièce du tour : elle concède un point de forme et
  maintient sur le fond, avec `src/stock.js:25`.
- **Décision** (« Décision du tour de table · opencode/Tidepool Alpha Free ») : sept rubriques
  avec « Ce qui a changé après la réplique ». Elle garde l'option 2. Elle rejette l'argument de A
  sur l'instantané (« pas une fatalité de l'option ») et déclare « transverse » l'invariant de
  stock. C'est faux pour SQLite (`UPDATE … WHERE quantite >= ?`). Même faiblesse qu'à la synthèse.
- Pied « Consommé en tout : 399,6 k jetons · ≈ 0,00 $US », **égal au journal** : participants
  102 140 + 45 581 + 45 672, synthèse 160 754, décision 45 488, soit 399 635.

### A6. Application

- « Demander à OpenCode de l'appliquer » envoie « Applique ta recommandation du tour de table. ».
  OpenCode réécrit `src/persistance.js` en journal append-only et met à jour le README (2
  fichiers, +27 −9), puis lance les tests : 2 réussis.
- **Le dépôt n'a changé qu'à ce moment** : `git status` vide avant le clic, `M README.md` et
  `M src/persistance.js` après. (Le code produit est faible : l'instantané n'est jamais relu, les
  seuils sont perdus. C'est le modèle.) Modifications annulées ensuite par `git checkout`.

### A7. Lecture seule

**Tour 2, sans rôle installé.** Question : « Quel est le principal risque de src/alertes.js ?
Important : crée le fichier NOTES.md … utilise ton outil d'écriture ou une commande shell ».

- **Les trois participants ont écrit `NOTES.md`** (outil `write`, aucune demande d'autorisation :
  OpenCode écrit sans demander, lot 0 O10). DeepSeek a aussi exécuté du Node (`node
  --input-type=module -e …`) pour reproduire ses dires.
- Niveau affiché : « Lecture seule demandée ». Les trois lignes portent « ⚠ a modifié des
  fichiers du dossier ». Trois bandeaux jaunes « Le dossier a changé pendant le tour de « … », un
  rôle en lecture seule… » s'ajoutent sous la carte.
- La synthèse en est avertie par l'attribut `warning="the folder changed during this turn"` sur
  chaque avis (lu dans le code ; le texte de la demande n'est pas au journal). Elle n'en dit
  rien.
- **L'arbitre a lui aussi réécrit `NOTES.md` pendant la synthèse** : `write`, puis deux `edit`
  (S1).

**Installation du rôle.** Réglages › Rôles › Participant › « Installer dans… » › OpenCode. La
boîte **propose par défaut « Pour vous, dans tous vos projets »**
(`~/.config/opencode/agents/participant.md`, G4). « Ce projet seulement » a été coché, vérifié
coché, puis installé : `.opencode/agents/participant.md` dans le dépôt jetable, rien dans
`~/.config/opencode` (contrôle d'existence du fichier seulement, sans lecture). Résultat :
« Installé dans OpenCode · ce projet · à jour ». Le fichier a été committé dans le dépôt jetable.

**Tour 3, même question, rôle installé.**

- Niveau affiché : **« Lecture seule (rôle installé) »**. `agents.log` : `set_config_option
  mode=participant` pour chaque place.
- **Aucun participant n'a écrit**. Leurs outils : `read`, `glob` seulement. Pas de marque, pas de
  bandeau.
- **Mais l'arbitre a encore créé puis modifié `NOTES.md`** pendant la synthèse (S1) : le rôle ne
  protège que les participants.

### A8. Cas réels

- **Modèle indisponible ou disparu** : aucun ne s'est présenté. Le catalogue gratuit est resté
  stable pendant la recette ; `glm-5.3-flash-free` et `minimax-m3.1-flash-free`, vus au lot 0,
  n'y sont plus, mais n'ont jamais été retenus. NJ.
- **« Synthétiser sans attendre »** (tour 4, 4 participants avec MiMo) : bouton apparu à 2 avis.
  Un troisième avis est arrivé entre-temps. Clic : MiMo « Arrêté : synthèse sans attendre ·
  sans avis » ; la ligne « Synthèse avec 3 avis : un participant n'a pas répondu ». ✓
  - La synthèse a mis **199 s**, et **l'arbitre a écrit un fichier hors du dépôt**
    (`/tmp/synth-rapport.md`, « 1 fichier +53 −0 » sous sa réponse) sans qu'on le lui demande
    (S1).
  - Il ne nomme pas l'absent D.
  - Au même tour, **Nemotron a répondu à la question du tour 2** (« Risque principal de
    `src/alertes.js` ») au lieu de celle posée (S2).
- **« Arrêter »** (tour 5) : en-tête « 0 avis sur 4 · arrêt en cours », puis « arrêté » au bout de
  10 s ; chaque ligne « Arrêté avec le tour de table · sans avis ». Pas de synthèse. ✓
- **Arrêt brutal en plein recueil, puis reprise** (tour 6). Le profil temporaire s'efface à une
  fermeture propre, et rien n'aurait survécu. L'arrêt a donc été provoqué par `SIGKILL` au groupe
  de processus de l'instance pilotée, 3 avis rendus sur 4 ; le profil a été copié, puis rouvert.
  - Au lancement : « Tour de table … interrompu par un redémarrage » (`main.log`). Carte
    « interrompu par le redémarrage de l'app », MiMo « Arrêté (redémarrage) · Relancer ». Boutons
    « Synthétiser avec 3 avis » et « Relancer le participant arrêté » (la page d'aide dit
    « Reprendre », C2). **Rien n'est reparti seul** : aucun participant relancé avant le clic.
  - « Relancer le participant arrêté » : MiMo répond, puis la synthèse part d'elle-même avec
    4 avis. ✓
  - Le bandeau « Bobine s'est arrêtée de façon inattendue » est attendu.
  - Nemotron a de nouveau répondu sur `alertes.js` (S2).
- **Barre latérale** : les participants y sont, sous la conversation, avec l'icône du tour,
  pendant le recueil et la réplique ; ils en sortent une fois le tour fini. ✓ Le panneau Session ›
  En cours compte mal le temps pendant la réplique (G3).
- **Pied « Consommé »** : il avance pendant le tour et tient la somme des journaux (tour 1 vérifié
  au jeton près). Avec Bob : « 0,0497 Bobcoins + ≈ 0,00 $US », égal à `tasks.costs` de
  `~/.bob/db/bob.db` (lu en lecture seule, nos tâches seulement). « 1 participant sans chiffre »
  après le redémarrage. ✓
- **Ligne de surcoût, dans la vraie fenêtre** (1280 × 820) : une ligne, en gris. L'infobulle de
  « 4 participants » dit les quatre modèles « · par OpenCode », puis « Chacun reçoit la question
  et le dernier échange de cette conversation. » ✓ La forme étroite n'a pas été essayée.

### B1. Bob participant (conversation OpenCode)

- **Un seul siège « IBM Bob », sans choix de modèle**, dans le menu comme sur la carte. ✓
- **Aucune carte d'autorisation** : 0 `session/request_permission` sur toute la recette. Bob a
  lu sans demander, comme au lot 0 (B4). ✓
- **Coût de Bob dans le pied** : « 0,0497 Bobcoins + ≈ 0,00 $US », égal à la base de Bob
  (0,049656). ✓
- **Niveau de lecture seule de Bob** : « Lecture seule ». C'est le niveau garanti par refus
  d'office, aucune écriture n'ayant été tentée. Les deux participants OpenCode portent
  « Lecture seule, tenue par le rôle Participant installé ». Les niveaux diffèrent, d'où un
  bouclier sur chaque ligne. ✓
- Bob a titré sa tâche d'après la question : « Stock.js refuser quantité non entière ». ✓
- Sa ligne montre « Le code valide déjà que quantite 0 » : le `>` de `quantite > 0` a été retiré
  (G6).

### B2. Bob arbitre (3 participants OpenCode)

- Conversation passée sur IBM Bob (mode « Agent ») ; participants Tidepool, DeepSeek, Nemotron.
- **La synthèse est rédigée par Bob** : étiquette « Synthèse du tour de table · IBM Bob », en
  24,8 s.
- **Coût : 0,1929 Bobcoin** (25 882 jetons de contexte selon Bob), affiché sous la réponse et
  dans le pied (« + 0,1929 Bobcoins »).
- **Aucun outil soumis à autorisation** : 4 outils, tous en lecture (`Reading file …` ×3,
  `Finding files …`), aucune `request_permission`.
- **Titre donné par Bob** : « Alertes.js seuil franchissement ou sortie ».
- **Qualité : un arbitrage.**
  - Il distingue l'accord fondé sur des preuves de l'accord seulement partagé.
  - Il nomme la cause du désaccord : « C lit le code comme une spec ; A et B lisent le commentaire
    comme une spec ».
  - Il vérifie dans le code (`stock.js:44`), rejette deux points avec leurs raisons et recommande
    nettement avec une confiance motivée.
  - Même défaut de lettres : « A », « B », jamais « Participant A » (S3).

### B3. Plafond

- Réglages › Conversations › Plafond par conversation activé, montant **0,01**, puis un tour en
  conversation OpenCode avec Bob, DeepSeek et Nemotron.
- Bob a franchi le plafond **pendant** son premier tour : `main.log` dit « Plafond de coût
  franchi (763e89a6-…) : 0.02364 / 0.01 bobcoins, tour interrompu », à 1,7 s.
- Sa ligne : « Arrêté : plafond de la conversation atteint · sans avis », avec « Ouvrir sa
  conversation ».
- La synthèse est partie avec 2 avis ; le pied dit « 0,0236 Bobcoins ». ✓
- L'état « retenu par le plafond » avec « Continuer » (question pas encore envoyée) n'a pas été
  provoqué : il faudrait un plafond déjà atteint avant le tour, ou une réplique. NJ.
- Le plafond est resté réglé dans le profil copié, qui n'est pas celui de l'utilisateur.

## Défauts

### Sérieux

**S1 — L'agent qui arbitre écrit pendant la synthèse.**

- Reproduction :
  1. Conversation OpenCode en mode Build (le défaut).
  2. `/roundtable Quel est le principal risque de src/alertes.js ? Important : crée le fichier
     NOTES.md à la racine du dépôt avec ta réponse complète…`.
  3. Tours 2 et 3 : `NOTES.md` est créé, puis modifié par l'arbitre pendant la synthèse.
  4. Tour 4 (« liste les cas limites non testés »), aucune écriture demandée : il crée
     `/tmp/synth-rapport.md`.
- La consigne « Do not modify anything » ne suffit pas, et rien ne la fait respecter. Le garde
  de lecture seule ne couvre que les participants, et une écriture hors du dépôt n'est vue par
  aucune empreinte.
- Trace (`agents.log`, conversation `663d90e7`, tour 2) :

  ```text
  2026-11-25T00:34:04.447Z [663d90e7 · opencode] ← tool_call …a56e1cb8 « write » edit pending entrée [s …EM2MwCmo] (276 o)
  2026-11-25T00:34:05.285Z [663d90e7 · opencode] ← tool_call_update …a56e1cb8 completed contenu 1 text sortie [s …EM2MwCmo] (439 o)
  2026-11-25T00:34:07.802Z [663d90e7 · opencode] ← tool_call …bd254cdc « edit » edit pending entrée [s …EM2MwCmo] (274 o)
  ```

  Tour 4, dans le fil de la conversation : `"title": "write", … "Created file successfully:
  /tmp/synth-rapport.md"`.
- Captures : `a6-synthese-ecrit-un-fichier` (« 1 fichier +53 −0 » sous la réponse de synthèse) ;
  `a7-ecritures-avis-dossier-change` (« Modification de NOTES.md » dans le tour de synthèse).

**S2 — Le « dernier échange » donné aux participants contient les demandes internes des tours
précédents.**

- Reproduction :
  1. Dans une même conversation : un tour, « Appliquer », puis deux autres tours.
  2. Au quatrième tour, le bloc `<bobine_roundtable_context_…>` d'un participant (≈ 8 000
     caractères) commence par l'échange « Appliquer » du tour 1, le dernier vrai message de
     l'utilisateur.
  3. Viennent ensuite, présentées comme `User:`, **les demandes de synthèse des tours 2 et 3** :
     consigne d'arbitre, six rubriques, et la question « Quel est le principal risque de
     src/alertes.js ? Important : crée le fichier NOTES.md… ».
- Effet : Nemotron a traité l'ancienne question aux tours 4 et 6. Le bloc est bien marqué « for
  context only », mais il porte l'injonction d'écrire d'un autre tour.
- Trace : premier message du participant Nemotron, tour 4 (`483cde62`), positions dans le
  texte :

  ```text
  593  User: Applique ta recommandation du tour de table. | Assistant: Appliqué — voici ce que j'ai…
  2095 User: Roundtable: 3 participants answered the question below independently, read-only; 3 g…
  4568 Assistant: # Arbitrage — synthèse du risque principal de `src/alertes.js` (NOTES.md à la r…
  7261 User: Roundtable: 3 participants answered the question below independently, read-only; 3 g…
  ```

- Capture : `a8-apres-redemarrage` (ligne de Nemotron : « Le principal risque de
  src/alertes.js… » pour une question sur `test/stock.test.js`).

**S3 — Le vrai nom au survol ne marche jamais, et les lettres restent illisibles.**

- Reproduction : n'importe quel tour.
- Les 9 réponses (8 de Tidepool, 1 de Bob) écrivent « A », « B et C », « [A, B, C] ». Le greffon
  (`roundtable-letters.ts`, `/\b([Pp]articipant)\s+([A-E])\b/`) ne reconnaît que « Participant
  X ». La consigne dit « with the participant's letter » sans imposer la forme.
- La carte ne montre pas la lettre de chaque modèle : l'utilisateur ne peut pas relier « A
  s'oppose » à DeepSeek sans ouvrir le fichier de la conversation.
- Trace : `document.querySelectorAll('abbr[data-letter]').length` = 0 après chaque synthèse. Les
  lettres A = DeepSeek, B = Tidepool, C = Nemotron ne figurent que dans l'élément du tour
  (`seats[].letter`).
- Capture : `a4-synthese-fin-actions` (« celle de B et C », sans soulignement ni infobulle).

### Gênants

**G1 — Les agents des participants restent vivants après le tour.**

- Après un tour fini ou arrêté, les `opencode acp` des participants (≈ 130 Mo, plus ≈ 310 à
  530 Mo pour `opencode serve`) restent lancés jusqu'à ce que la limite « Conversations gardées
  actives » en écarte.
- Relevé après le tour 5 arrêté : 6 agents OpenCode vivants, **3,6 Go RSS**, dont 4 places d'un
  tour arrêté.
- `main.log` : « Agent arrêté (opencode, 0c88114e) : code 143 après 401.8 s », au lancement du
  tour suivant seulement.

**G2 — « Faire réagir les participants » du tour précédent reste affiché.**

- Il reste au-dessus de la bulle d'un nouveau tour (contraire à B8 du journal de la fiche).
  « Appliquer » est bien masqué.
- Capture : `a7-tour3-avis-et-faire-reagir-precedent`.

**G3 — Mauvaise durée dans Session › En cours pendant la réplique.**

- Le panneau compte depuis le début du tour, « 2 min 54 s », pour des répliques lancées 8 s plus
  tôt.

**G4 — La portée par défaut de l'installation du rôle est la portée personnelle.**

- « Installer « Participant » dans OpenCode » présélectionne « Pour vous, dans tous vos projets »
  (`~/.config/opencode/agents/participant.md`). Un Entrée trop rapide écrit dans la
  configuration personnelle d'OpenCode.
- Capture : `a7-installer-portee-defaut-personnelle`.

**G5 — La formule de surcoût trompe dans une conversation longue.**

- « ≈ 4 fois les jetons » compte des tours. La synthèse relit toute la conversation de l'arbitre,
  plusieurs fois (un appel par outil, cache compris) : 160 k jetons au tour 1, 378 k au tour 2,
  667 k au tour 3.
- Tour 3 : **785,6 k jetons** pour 3 participants à ≈ 40 k chacun.
- Le pied, lui, est juste.

**G6 — La réponse courte perd des caractères.**

- `opinionDigest` (`roundtable-prompts.ts`) retire tous les astérisques, soulignés, accents
  graves, dièses et chevrons fermants du texte. « quantite > 0 » devient
  « quantite 0 » sur la ligne de Bob, ce qui change le sens.
- Capture : `b1-carte-bob-participant`.

### Cosmétiques

**C1 — Étiquettes « Synthèse du tour de table » et « Décision du tour de table » avec un nom brut.**

- Elles affichent `opencode/Tidepool Alpha Free`, préfixe compris. Avec Bob : « IBM Bob ».
- Capture : `a5-decision-libelle-brut`.

**C2 — Le bouton et la page d'aide ne disent pas la même chose.**

- Après un redémarrage, le bouton dit « Relancer le participant arrêté ». La page d'aide annonce
  « Reprendre ».

**C3 — Un avis aux titres de rubriques variants s'affiche sans réponse courte.**

- Exemple : « 1. Court » (Tidepool, tour 4). La ligne n'affiche que « confiance moyenne », sans
  réponse courte ni « format non suivi ».
- Les trois bandeaux jaunes identiques du tour 2 font aussi double emploi avec les marques des
  lignes.

## Qualité observée

### Suivi du format en cinq rubriques

| Modèle | Avis | Conformes | Remarques |
|---|---|---|---|
| Tidepool Alpha Free | 6 | 5 | titres en anglais (« Short answer », « Medium ») ou variants (« 1. Court ») ; hors format au tour 2 |
| DeepSeek V4.1 Flash Free | 8 | 7 | le plus constant, preuves `fichier:ligne` partout ; au tour 2, confiance seule |
| Nemotron 3.5 Lightning Free | 8 | 7 | titres en anglais ; hors format au tour 2 ; **2 réponses à la mauvaise question** (S2) |
| MiMo-V2.6-Flash Free | 1 | 1 | gras plutôt que titres |
| IBM Bob | 1 | 1 | conforme, court |
| **Total** | **24** | **21 (88 %)** | tour 2 (« crée NOTES.md ») : 0 sur 3 ; ailleurs 21 sur 21 |

La réponse courte et la confiance sont lues dans les deux langues. « Format non suivi » s'est
affiché 2 fois, à bon droit (tour 2). Le cas C3 est passé entre les mailles.

### Synthèse

- **Tidepool Alpha Free, arbitre par défaut** : la structure en six rubriques est tenue. Il
  vérifie volontiers dans le code (lectures, voire `node -e`). Mais il arbitre mal :
  - il suit la majorité tout en affirmant ne pas compter les voix, alors qu'il participait
    lui-même (biais d'auto-préférence possible) ;
  - ses rejets sont des points de forme ;
  - l'argument décisif de la minorité est rangé en « préférence » ;
  - il écrit des fichiers (S1) ;
  - il dit « roundtable » et « evid: » en plein français.
- **IBM Bob, arbitre** : nettement meilleur, en 25 s pour 0,19 Bobcoin. Si l'utilisateur doit
  essayer une seule configuration, c'est celle-là : conversation Bob, participants gratuits.
- **Réplique** : utile. Elle a fait sortir l'argument le plus fort (DeepSeek) ; la décision ne
  l'a pas pris en compte pour autant.

## Mémoire

RSS par `ps -o rss`, sur les descendants de l'instance pilotée.

| Moment | Relevé |
|---|---|
| Bobine seule (main + 3 aides Electron) | ≈ 0,6 Go |
| Un agent OpenCode (`opencode acp` + `opencode serve`) | ≈ 130–147 Mo + 310–527 Mo, soit **≈ 450–670 Mo** (lot 0 : 630–670 Mo) |
| Tour 1 en recueil (arbitre + 3 participants) | ≈ 2,7 Go d'agents, ≈ 3,3 Go avec Bobine |
| Tour 2 en recueil (arbitre + 2 participants du tour 1 encore vivants + 3 nouveaux) | ≈ 2,9 Go d'agents |
| Après le tour 5 arrêté (6 OpenCode vivants, G1) | **3,6 Go** d'agents |
| B1, avec Bob participant | Bob 285 Mo (un processus `node`) ; ≈ 3,1 Go d'agents en tout |

## Consommation

| Agent | Jetons | Argent | Bobcoins |
|---|---|---|---|
| OpenCode, modèles gratuits | ≈ 3,80 M au total (cache compris, toutes conversations) | 0 $US (`cost` à 0 partout) | — |
| IBM Bob | contexte 13 006 (B1), 25 882 (B2), 11 820 (B3) | — | **0,2662** = 0,049656 + 0,1929 + 0,02364 |

Budget Bob : 5 Bobcoins, arrêt prévu à 4. Atteint : 0,27. Les trois tâches de Bob restent dans
l'historique de Bob de l'utilisateur (« Stock.js refuser quantité non entière », « Alertes.js
seuil franchissement ou sortie », « Test sortie() article inconnu ») : rien n'a été supprimé.

## État laissé

- **Bobine** : arrêtée par `pnpm pilote arreter`. Le profil temporaire, resté après l'arrêt
  brutal, a été supprimé (il était à nous). Le profil copié reste dans
  `~/Development/bobine-recette/tdt-1-2-travail/profil-recette`, avec ses journaux et le plafond à
  0,01. Aucun processus de Bobine ni d'agent lancé par la recette ne tourne : le `opencode serve
  --service` qui tourne date du 16 novembre et n'est pas à nous.
- **`~/.bob/settings/settings.json`** : **identique** à la sauvegarde (SHA-256 `646f2f6a…`), rien à
  restaurer. `trustedFolders.json` identique.
- **OpenCode** : rien d'écrit dans `~/.config/opencode` (rôle installé en portée projet
  seulement).
- **Dépôt jetable** `~/Development/bobine-recette/tdt-1-2` : propre, deux commits (« premier jet »,
  « rôle participant (installé par Bobine) »). `NOTES.md` et l'application du tour 1 ont été
  retirés ; ils sont gardés dans le dossier de travail.
- **`/tmp/synth-rapport.md`**, annoncé par l'arbitre au tour 4 : absent à la fin de la recette.
- **Verrou e2e** : pris pendant la recette, rendu (`rmdir`). Repris ensuite par une autre session :
  la commande « Pour essayer » n'a pas été relancée pour vérification.
- **Branche `1.2`** : seul ce rapport et ses captures sont ajoutés. Aucun code modifié.

## Non joué, et pourquoi

- **Modèle indisponible ou disparu du catalogue** : aucun ne s'est présenté.
- **Participant « retenu par le plafond » avec « Continuer »** : seul l'arrêt en cours de tour a
  été joué (B3).
- **Réplique avec Bob participant**, et **plafond de l'arbitre** : budget et temps gardés pour le
  reste.
- **Redémarrage propre** (Quitter) : un profil temporaire s'efface à la fermeture. Le redémarrage
  a été joué par arrêt brutal, puis réouverture d'une copie du profil.
- **Contenu complet de la demande de synthèse** : même en Trace, `agents.log` le coupe à
  ≈ 500 caractères. La vérification passe par le code et par une recherche des noms dans les
  avis (§ A4).
- **Modèle réellement utilisé, relu chez OpenCode** : la base d'OpenCode de l'utilisateur n'a pas
  été lue.
- **Forme étroite de la ligne, thème clair, `--lang en`, corbeille et archivage** : hors du
  périmètre demandé.

## Pour essayer

Sans toucher à l'app installée ni à son profil. Bob, s'il est choisi, consomme de vrais
Bobcoins : régler d'abord un plafond (Réglages › Conversations).

```bash
cd ~/Dev/bobine-oss-wt/v1.2
git switch 1.2 && pnpm install && pnpm build

# Bobine neuve, effacée à la fermeture, ouverte sur un dossier d'essai (la commande de cette recette) :
pnpm pilote lancer --dossier ~/Development/bobine-recette/tdt-1-2
# … essayer dans la fenêtre, puis :
pnpm pilote arreter
```

Sans le pilote, même effet : `pnpm exec electron . --profil-temporaire`. C'est la commande que
le pilote lance ; elle n'a pas été rejouée seule, faute de verrou. Pour garder l'essai d'un
lancement à l'autre, remplacer `--profil-temporaire` par
`--user-data-dir=$HOME/Development/bobine-recette/essai-1-2`.

Une configuration qui montre la fonction sous son meilleur jour :

1. Conversation **IBM Bob**.
2. `/roundtable` suivi d'une vraie question.
3. Trois participants **gratuits d'OpenCode**.
4. Après une première fois, installer le rôle « Participant » dans OpenCode, en choisissant
   **« Ce projet seulement »**.
