# 206 — Session longue : Claude en utilisateur final de Bobine

- **Statut** : en cours (pilote de Bobine fait ; essai d'une heure à mener)
- **Dépend de** : 187 (barre de qualité V1), recettes réelles (183, 199, 204)
- **Agents** : les deux (OpenCode avec des modèles OpenAI selon le besoin, IBM Bob en partie).

## Pourquoi

Les recettes réelles trouvent à chaque fois ce que les essais avec l'agent factice ne voient pas.
L'utilisateur veut une session de plusieurs heures où Bobine sert à construire un vrai projet
(frontend, mobile, backend), avec Claude dans le rôle de l'utilisateur final : il pilote
Bobine, juge comme un humain le ferait, et note chaque accroc. Sans y laisser tout le quota de
tokens.

## Décisions de l'utilisateur (2026-11-08)

- **Projet** (choisi le 2026-11-08) : **carnet de bord de la maison**. Appareils (chaudière,
  voiture, électroménager), entretiens, factures et garanties en PDF, rappels d'échéance,
  recherche dans les documents. Front **Flutter** (iOS dans le simulateur, et web) et, en
  parallèle, **la même app web en React** — le but est aussi de juger Flutter web, moins connu,
  face à React sur la même API (deux conversations filles qui avancent côte à côte). Backend
  **Quarkus**, **PostgreSQL dans Docker**. Sur le Mac : Docker 29.9, Java 25, Xcode 27.2 avec
  iOS 27.2 ; Flutter pas installé (son installation fait partie de la session).
- **Computer use** : disponible chez l'utilisateur. On s'en sert (vraie souris, vraies fenêtres
  macOS : choix de dossier, trousseau, navigateur pour le SSO), le reste passe par le port de
  débogage de Bobine (moins cher).
- **Agent qui code** : OpenCode avec les modèles OpenAI selon le besoin, ou IBM Bob (bobcoins
  rechargés).
- **Priorités** : conversation longue avec tâches filles ; MCP, commandes, mémoire ; panneaux
  (terminal, navigateur, simulateur iOS) et mobile. Forge et CI : pas prioritaire.

## Rôles et coûts

- **Le développeur** : l'agent de Bobine. Le code ne passe pas par le quota Claude.
- **Le pilote** (modèle moins cher, Sonnet ou Haiku) : écrit la demande, attend la fin du tour,
  répond aux cartes, ouvre les panneaux, note ce qu'il voit.
- **Le juge** (Opus), une fois par étape : relit le journal du pilote et ses captures, classe
  les accrocs, dit ce qu'un humain aurait ressenti.
- **Captures** : à chaque moment qui compte (nouvel écran, carte, fin de tour, erreur, panneau) ;
  en demi-taille pour vérifier, en taille réelle pour juger un détail. Entre deux, l'état lu en
  texte (« pilote de Bobine » : une commande qui dit en quelques lignes ce qu'il y a à l'écran et
  attend la fin d'un tour sans regarder).
- **Étapes courtes** avec un journal écrit : chaque étape repart d'un contexte neuf.
- **Budget par étape** (actions, durée, captures) : le pilote passe la main au juge quand il est
  atteint ou qu'il est bloqué.

## Ce qu'on couvre

1. **Conversation longue** : une conversation principale de plusieurs heures qui délègue à des
   conversations filles (worktrees), les fusionne ; sous-agents ; contexte qui se remplit ;
   reprise après fermeture ; Modifications sur un long historique ; fluidité d'un fil de
   plusieurs milliers d'éléments. Question du juge : un humain s'y retrouve-t-il au bout de 3 h ?
2. **MCP, commandes, mémoire** : un vrai serveur MCP ajouté et utilisé ; les outils de l'app
   (navigateur, simulateur, questions) ; commandes personnalisées ; mémoire ; tâches
   planifiées ; skills si l'agent les gère (à vérifier avant de le promettre).
3. **Panneaux et mobile** : terminal, navigateur, simulateur iOS, Modifications, retour en
   arrière.

## Réalisme d'abord : Claude derrière le clavier

But principal (précisé par l'utilisateur le 2026-11-08) : voir Bobine travailler **comme si un
humain était derrière le clavier**. On ne désactive rien et on ne contourne rien.

- Claude répond lui-même à chaque carte d'autorisation, choisit les dossiers, ouvre les
  panneaux, lit les erreurs, comme un utilisateur ; computer use pour les fenêtres de macOS.
- Flutter, les dépendances, Docker : installés par l'agent depuis Bobine, comme le ferait un
  nouvel utilisateur.
- Quand l'agent s'arrête avant d'avoir fini (tour terminé trop tôt, agent figé ou planté,
  erreur), Claude fait ce qu'un humain ferait : relancer, préciser la demande, Arrêter,
  Relancer l'agent, nouvelle conversation, relancer Bobine. **Chaque fois qu'il a dû
  intervenir, c'est noté** (quand, pourquoi, ce qu'un humain aurait compris ou pas) : c'est la
  mesure principale de la session.
- Seule limite : ce que Claude n'a pas le droit de faire à la place de l'utilisateur, saisir un
  mot de passe (trousseau macOS, session) ou se connecter à un compte (SSO). Ces moments-là sont
  notés et l'utilisateur est prévenu ; ils font partie du résultat.
- Le journal écrit est l'état de la session : une session Claude interrompue (redémarrage,
  limite d'usage) reprend depuis lui.

## Critères d'acceptation

- [x] Projet choisi par l'utilisateur (carnet de bord de la maison).
- [x] Pilote de Bobine écrit et essayé (état de l'écran en texte, attente de fin de tour) :
      `pnpm pilote`, [docs/pilote.md](../pilote.md).
- [x] Essai d'une heure sur une étape : consommation de tokens par heure mesurée, partage
      pilote / juge et fréquence des captures ajustés.
- [ ] Session longue menée ; journal d'utilisateur (accroc, capture, gravité, reproduction).
- [ ] Accrocs triés avec l'utilisateur, fiches créées pour ceux retenus.

## Plan

1. Pilote de Bobine (petit outil, sert aussi aux recettes habituelles).
2. Essai d'une heure, mesure.
3. Session longue, par étapes.
4. Tri.

## Journal

- 2026-11-08 — Cadre discuté avec l'utilisateur, décisions notées ci-dessus.
- 2026-11-08 — **Pilote de Bobine** (`scripts/pilote/`, `pnpm pilote`, [docs/pilote.md](../pilote.md)) :
  `lancer` (profil temporaire de Bobine par défaut, port de débogage sur 127.0.0.1,
  `--force-renderer-accessibility`, trousseau simulé), `etat` (l'écran en 5 à 15 lignes, 400 à
  1 200 caractères, soit 100 à 300 jetons contre 1 500 à 3 000 pour une capture), `attendre`
  (lecture toutes les 1,5 s sans sortie ; raisons stables `tour-fini`, `carte`, `question`,
  `blocage`, `erreur`, `accueil`, `calme`, `delai`, un code de sortie chacune), `capture`, actions de
  secours par vrais évènements souris et clavier (`envoyer`, `repondre`, `cliquer`, `panneau`),
  journal du testeur (`note --gravite`, `intervention`, `journal --resume` : gravités,
  interventions, fins d'attente, durées de tour), `arreter` (cette instance seule). Essais : parties
  pures (`scripts/pilote/pilote.test.mjs`), suite e2e `pilote` (fr et en, agent factice : accueil,
  carte, réponse, tour fini, tour figé puis Arrêter, notes, résumé). Essayé à la main sur le build
  (`out/`, agent factice : accueil, carte, question à choix, panneaux, journal) et sur
  `dist/mac-arm64/Bobine.app` (accueil lu, capture, arrêt ; `--agents-neufs`, aucun message).
  Ajouts au renderer : `data-kind` (genre ACP) sur la carte d'outil, et un nom accessible au bouton
  Arrêter (il n'en avait aucun : computer use ne pouvait pas le viser par son nom).
- 2026-11-08 — **Essai d'une heure fait** (30 min réelles : OpenAI non connecté, budget Bob
  d'environ 18 bobcoins) : un backend Quarkus avec 16 tests construit ; 26 notes, 4 interventions,
  54 cartes d'autorisation ; 3 défauts sérieux, devenus les fiches 209, 210 et 211, corrigés et
  vérifiés avec de vrais agents le 2026-11-09. Mesure : le pilote consomme environ 200 000 jetons
  Sonnet par 30 minutes.
- 2026-11-15 — Nuit de stabilité, deux accrocs du pilote :
  - `lancer --dossier <d>` sur le profil temporaire s'arrêtait à l'étape « Où travailler ? » de
    l'accueil : « Choisir… » ouvre la fenêtre de macOS, que le pilote ne conduit pas. Le pilote
    passe maintenant `BOBINE_PRESET_FOLDER=<d>` (profil temporaire seulement) ; le premier choix de
    dossier de Bobine rend ce dossier sans fenêtre, une seule fois (`takePresetFolder`,
    `main/dialogs.ts`, testé) ; les suivants ouvrent la vraie fenêtre. L'accueil reste joué en
    entier (`cliquer "Choisir…"`). Relecture du tech lead : ce crochet d'essai n'est suivi que sur
    un profil temporaire (`--profil-temporaire`, fiche 148) ; sur le profil de l'utilisateur ou
    dans l'app installée, la variable est ignorée et dite une fois au journal (nouveau
    `log.debug`, écrit au niveau Détaillé). Testé dans les deux cas.
  - `envoyer` insérait le texte au curseur et emportait un brouillon laissé dans la zone de saisie.
    La zone est d'abord vidée comme au clavier (⌘A puis ⌫, commandes d'édition `selectAll` et
    `deleteBackward` du protocole DevTools), son contenu vérifié avant Entrée, et un message qui
    n'est pas parti est dit avec ce qui reste dans la zone.
  - `cliquer` passait déjà par de vrais évènements souris (`page.mouse`) ; une ligne de l'historique
    se vise par son titre (le bouton `.history-open` le plus intérieur) : rien à changer.
  - Suite e2e `pilote` : lancement avec `--dossier`, « Choisir… » dans l'accueil, dossier vérifié
    sur la conversation ; envoi par-dessus un brouillon (curseur au début), message exact vérifié.

## Écarts au plan

- Pilote : code `accueil` ajouté aux raisons de fin d'attente (l'accueil du premier lancement
  attend l'utilisateur sans être un tour). Le pilote ne peut pas essayer l'agent factice contre
  l'app packagée (il n'y est jamais embarqué) : l'essai de bout en bout se fait sur le build.
