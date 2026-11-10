# Pilote de Bobine

`pnpm pilote` lit l'écran de Bobine en quelques lignes de texte, attend sans rien coûter qu'il se
passe quelque chose pour un humain, agit en secours et tient le journal du testeur. Il sert à la
session longue de la fiche 206 (Claude dans le rôle de l'utilisateur), et aux recettes
habituelles.

Code : `scripts/pilote/` (Node, ESM, sans dépendance). Essais : `scripts/pilote/pilote.test.mjs`
(parties pures) et la suite e2e `pilote` (`pnpm build && pnpm e2e pilote`, aussi `--lang en`).

## Pourquoi

Avec computer use, Claude clique et tape comme un humain, mais il ne lit l'écran qu'en capture
(1 500 à 3 000 jetons l'image) et ne sait pas attendre sans regarder. Le pilote passe par le port
de débogage de Bobine (protocole DevTools, sur 127.0.0.1 seulement) :

| Besoin | Sans pilote | Avec pilote |
|---|---|---|
| Savoir où on en est | une capture (≈ 1 500–3 000 jetons) | `etat` : 400 à 1 200 caractères (≈ 100–300 jetons) |
| Attendre la fin d'un tour de 10 min | des captures à intervalles | `attendre` : rien pendant l'attente, une sortie à la fin |
| Noter un accroc | du texte dans la conversation | `note` : journal horodaté, état et capture joints |

Les captures restent pour les moments qui comptent (nouvel écran, carte, erreur, jugement d'un
détail) : `capture --demi` pour vérifier, taille réelle pour juger.

## Commandes

```bash
pnpm pilote lancer [--app <Bobine.app | dossier buildé>] [--dossier <projet>]
                   [--profil <dossier> | (profil temporaire par défaut)] [--agents-neufs]
                   [--port N] [--lang fr|en] [--journal <dossier>] [--agent-factice <scénario>]
                   [--vrai-trousseau]
pnpm pilote etat [--json] [--long]
pnpm pilote attendre [--max 20m] [--calme 3m] [--json]
pnpm pilote capture [--demi] [--zone fil|carte|panneau|fenetre]
pnpm pilote envoyer "<texte>"
pnpm pilote repondre "<libellé d'un bouton de la carte>"
pnpm pilote cliquer "<libellé>"
pnpm pilote panneau session|terminal|navigateur|ios|android|taches|modifications|acp
pnpm pilote note --gravite bloquant|genant|mineur|idee [--capture] "<texte>"
pnpm pilote intervention [--capture] "<pourquoi>"
pnpm pilote journal [--resume]
pnpm pilote arreter
```

- **`lancer`** : Bobine avec `--remote-debugging-port` (sur 127.0.0.1) et
  `--force-renderer-accessibility` (boutons cliquables par leur nom avec computer use), attend la
  fenêtre, écrit `instance.json` : les autres commandes n'ont besoin d'aucun argument. Par défaut,
  le build du dépôt (`out/`, lancé par l'Electron du dépôt) ; `--app` pour une `.app`. **Toujours
  un profil temporaire** (`--profil-temporaire` de Bobine, fiche 148 : vraie première
  installation, effacée à la fermeture), sauf `--profil <dossier>` donné explicitement. Trousseau
  simulé (`--use-mock-keychain`) sauf `--vrai-trousseau` : la boîte du trousseau bloquerait Bobine,
  et Claude n'y tape pas de mot de passe. `--agent-factice <scénario>` : l'agent factice imposé
  (build de développement seulement, jamais dans l'app packagée). Une seule instance pilotée à la
  fois.
- **`arreter`** : quitte cette instance et elle seule (SIGTERM, puis SIGKILL à son groupe de
  processus au bout de 10 s), par son pid, après avoir vérifié que ce pid porte bien le port de
  débogage du pilote (un pid réutilisé par un autre programme n'est jamais tué). Après un SIGKILL,
  le profil temporaire (`bobine-profil-*` dans les fichiers temporaires) peut rester.
- **`etat`** : 5 à 15 lignes. État de l'agent, conversation (titre, agent, modèle, mode), tour (en
  cours avec son activité et sa durée, ou fini avec son résumé), carte en attente (titre, commande,
  dossier, fichier, question, boutons), blocages, bandeaux et erreurs, dernier message de l'agent
  (300 caractères et nombre de mots ; `--long` : en entier), outils du tour (nombre par genre,
  dernier), panneau (onglets, compte, « En cours », Modifications), conversations de la barre
  latérale et leurs pastilles, accueil (étape, texte, boutons), réglages, dialogues et menus
  ouverts. `--json` : la lecture brute.
- **`attendre`** : lit l'écran toutes les 1,5 s sans rien écrire, et rend la main quand il faut un
  humain. Première ligne : la raison (code stable), puis `etat`. Code de sortie par raison :

  | Raison | Sortie | Quand |
  |---|---|---|
  | `tour-fini` | 0 | plus rien ne tourne depuis 3 s (tour fini, ou rien n'a démarré) |
  | `carte` | 10 | une carte attend une décision (autorisation, plan, propositions), ici ou dans une autre conversation |
  | `question` | 11 | l'agent pose une question (choix, formulaire) |
  | `blocage` | 12 | connexion, dossier, licence, agent qui demande une action, commande sans sortie, agent silencieux, plafond de coût, limite d'étapes de l'agent (fiche 209) |
  | `erreur` | 13 | nouvelle erreur ou nouveau bandeau, agent planté, Bobine injoignable |
  | `accueil` | 14 | l'accueil du premier lancement attend l'utilisateur |
  | `calme` | 15 | un tour tourne mais rien ne bouge à l'écran depuis `--calme` (3 min) |
  | `delai` | 16 | `--max` atteint (20 min) |

  Une erreur du pilote lui-même sort en 1, un usage faux en 2. Chaque attente est notée au journal
  (raison, durée, durée du tour lue à l'écran) : les durées de tour en sortent sans effort.
- **`capture`** : PNG dans `captures/` du journal ; `--demi` : moitié de la taille ; `--zone` :
  le fil, la dernière carte, le panneau, ou la fenêtre (défaut).
- **Actions de secours** (`envoyer`, `repondre`, `cliquer`, `panneau`) : de vrais évènements
  souris et clavier envoyés par le protocole DevTools, pas `element.click()`. `repondre` attend
  que la carte soit armée (fiche 203). `cliquer` vise l'élément cliquable visible dont le nom
  (texte ou `aria-label`) vaut le libellé, à défaut le contient ; s'il ne le trouve pas, il liste
  ce qui est cliquable. Computer use reste le chemin principal ; ces actions servent aux essais et
  quand computer use n'est pas disponible.
- **`note`** et **`intervention`** : une entrée au journal avec l'heure, le texte, la gravité
  (note), l'`etat` du moment, et une capture en demi-taille avec `--capture`. Une intervention,
  c'est chaque fois que le testeur a dû faire ce qu'un humain aurait fait parce que Bobine ou
  l'agent s'est arrêté avant d'avoir fini : c'est la mesure principale de la fiche 206.
- **`journal`** : le journal Markdown ; `--resume` : durée de la session, notes par gravité,
  interventions (liste), attentes et leurs raisons, durées des tours (médiane, max, total).

## Fichiers

Dossier du pilote : `BOBINE_PILOTE_DIR`, sinon `.pilote/` à la racine du dépôt (ignoré par git).

- `instance.json` : l'instance pilotée (pid, port, app, profil, dossier du journal).
- `sessions/<date>/journal.md` et `journal.jsonl` : le journal (lisible, et une entrée JSON par
  ligne pour le résumé). Le journal est l'état de la session : une session Claude interrompue
  reprend depuis lui (`lancer --journal <dossier>` pour continuer le même).
- `sessions/<date>/captures/` et `bobine.log` (sortie de Bobine).

## Avec computer use

Boucle type d'une étape :

1. `pnpm pilote lancer --dossier ~/carnet` (ou l'app installée : `--app /Applications/Bobine.app`).
2. Computer use : cliquer, choisir un dossier dans la fenêtre de macOS, taper la demande, Entrée.
3. `pnpm pilote attendre` : rien ne se dépense pendant que l'agent travaille.
4. Selon la raison : `carte` → lire la carte dans la sortie, décider, cliquer le bouton (computer
   use ; `repondre` en secours) ; `tour-fini` → juger la réponse (`etat --long`, une capture si
   l'écran compte) ; `calme`, `erreur`, `blocage` → faire ce qu'un humain ferait, puis
   `intervention "…"`.
5. `note --gravite … "…"` à chaque accroc ; `journal --resume` à la fin de l'étape, pour le juge.

## Robustesse aux changements de l'interface

La lecture (`scripts/pilote/lecture.mjs`) ne cherche aucun texte : elle lit des repères posés
pour les essais e2e, que ces essais protègent déjà.

- `data-testid` : `agent-status`, `title-menu`, `composer-bar`, `mode-chip`, `model-chip`,
  `agent-menu`, `composer-input`, `working`, `turn-summary`, `turn-duration`, `tool`,
  `tool-label`, `tool-group`, `permission`, `command-text`, `command-cwd`, `diff-path`,
  `question-text`, `choice`, `elicitation`, `blocker-*`, `app-alert-*`, `silence-banner`,
  `turn-retry`, `stalled-notice`, `cost-cap-card`, `pane-error`, `crash-screen`, `side-panel`,
  `session-running`, `changes-summary`, `history-item`, `settings`, `settings-heading`,
  `onboarding`, `onboarding-waiting`, `queued-item`, `welcome`, `temporary-profile`,
  `panel-toggle`.
- Attributs d'état : `data-status` et `data-kind` des outils (le second ajouté pour le pilote),
  `data-activity` du tour, `data-tab` des onglets, `data-state` des pastilles, `data-armed` des
  cartes, `aria-current` de l'étape de l'accueil.
- Quelques classes de structure : `permission-card`, `pc-title`, `pc-sub`, `pc-actions`,
  `msg-user`, `msg-agent`, `notice-error`, `notice-warning`, `status-dot`, `side-panel-tab`,
  `onboarding-title`.

Les actions visent les libellés traduits de l'app (`L('clé')`, langue lue dans `<html lang>`) ou
ceux que le testeur lit dans `etat`. Un repère qui disparaît fait manquer une ligne d'`etat`, sans
casser le reste ; la suite e2e `pilote` le voit.

## Limites

- Fenêtre principale seulement : ni la fenêtre rapide, ni l'aide, ni les fenêtres de macOS
  (choix de dossier, trousseau, navigateur du SSO), qui restent à computer use.
- La page du navigateur intégré et l'écran du simulateur sont des vues natives : absentes des
  captures du pilote (computer use les voit).
- `attendre` juge sur ce qui est à l'écran : un tour qui avance sans rien afficher ressemble à un
  tour figé (`calme`) ; régler `--calme` à la durée de la plus longue commande attendue.
- L'agent factice n'existe pas dans l'app packagée : contre `dist/…/Bobine.app`, le pilote voit
  les vrais agents de la machine (`--agents-neufs` pour leur donner un dossier personnel vide).
- Une seule instance pilotée à la fois.
