# Essai libre avec OpenCode + GPT-6.1 Sol — 20 octobre 2026

Essai « comme un humain » : Bobine pilotée à la vraie souris et au clavier (computer-use, plein
écran), sur un petit projet réaliste, avec **OpenCode 2.0.32** et le modèle **openai/GPT-6.1 Sol**
(abonnement ChatGPT de l'utilisateur, connecté par `opencode auth login`). Pas de script : on
travaille sur le projet et on note ce qui accroche. Bob reste la cible : cet essai complète les
recettes avec Bob, il ne les remplace pas.

## En bref

- **Le cœur marche bien** : 19 tours, 8 min 25 s de travail de l'agent, aucun blocage de l'app,
  2 avertissements seulement dans `main.log`, tous deux attendus (notifications refusées par
  macOS en développement, agent tué exprès).
- **7 défauts**. Le plus gênant : **le texte tapé juste après un choix de mode est perdu**,
  l'infobulle de la puce avalant le clic. Le plus visible : **la barre de saisie devient
  illisible** dès que le nom du modèle est long ou la fenêtre étroite.
- **Une dizaine de soucis d'interface** et **7 manques** (commit, fusion du worktree, titres
  automatiques, téléchargements…), détaillés plus bas.
- Durée : environ 30 min de pilotage, de 18 h 04 à 18 h 31.

## Environnement et méthode

| | |
|---|---|
| Bobine | `electron .` sur `out/` construit depuis `20dda7c` (0.3.0, Electron 44.7.2) |
| Isolement | dossier de données temporaire, `--use-mock-keychain`, `BOBINE_LOG=trace`, CDP sur 9333 (pour diagnostiquer, pas pour piloter) |
| Agent | OpenCode 2.0.32, `openai/gpt-6.1-sol` puis `gpt-6.1-sol-fast` |
| Projet | « Carnet de lecture » : app web sans dépendance (`server.js`, `public/`, `src/books.js`, `node --test`), git, un commit, un README avec 4 points « À faire » dont 2 bugs volontaires |
| Pilotage | clics, frappe, glisser-déposer réels ; les clics « en arrière-plan » n'ouvrent pas les menus Radix, d'où le plein écran |

## Parcours

1. Premier lancement, choix d'OpenCode et du dossier par le dialogue natif, choix du modèle.
2. « Explique ce projet » (suggestion de l'accueil).
3. Correction de deux bugs avec `@src/books.js` ; un message mis en file d'attente pendant la
   réponse.
4. Relecture du diff, onglet Git, commit demandé à l'agent.
5. Mode Plan : plan, remarque sur un passage, version 2, « Exécuter le plan ».
6. Autorisation « Lancer l'app » (`npm start`), navigateur intégré, essai manuel de la page.
7. Capture de la page annotée (cadre et texte) et envoyée à l'agent.
8. Échap pendant une réponse, modification du message (branche de conversation).
9. Renommage, ⌘K, nouvelle conversation, conversation en worktree en parallèle, fusion au
   terminal intégré.
10. `/` et `/context`, Réglages, quitter et relancer, reprise de la conversation.
11. Changement de modèle en cours de route, sous-agent (audit de sécurité), notification en
    arrière-plan.
12. Glisser-déposer depuis le Finder, agent tué (`kill -9`) puis relancé, `/compact`.

## Ce qui marche bien

- Choix de l'agent, du dossier et du modèle ; le modèle et le mode sont retenus d'une
  conversation à l'autre et après relance.
- Fil : streaming, outils regroupés (« 9 lectures, 4 recherches et 1 commande »), tableaux, code,
  sous-agent avec son rapport et « Son travail ».
- `@` : liste des fichiers, `@git-changes`, `@terminal`, puce de pièce jointe.
- File d'attente (« Partira à la fin de la réponse », envoyer / modifier / retirer).
- **Mode Plan** : commentaire d'un passage, version 2 avec « Voir ce qui a changé », « Exécuter le
  plan » qui repasse en Build. Le meilleur moment de l'essai.
- Autorisations en questionnaire ; « Toujours dans ce projet » retrouvé et révocable dans
  Réglages › Agents.
- Navigateur intégré piloté par l'agent ; « Joindre cette page », annotation, envoi.
- Échap, menu « … » des conversations, ⌘K avec recherche dans la conversation ouverte
  (« étoiles 1/10 »).
- Worktree : deux conversations en parallèle, pastilles d'activité et « non lu ».
- Terminal intégré (zsh de l'utilisateur, git, pager).
- Quitter et relancer : arrêt propre ; la session vide de l'accueil est supprimée
  (`session/delete`) ; l'agent se souvient du fil.
- **Plantage de l'agent** : bandeau « L'agent s'est arrêté. Sortie : SIGKILL. », message
  d'invite, relance au message suivant avec le contexte.
- Glisser-déposer depuis le Finder : cadre « Déposez pour joindre au message », pièce jointe.
- `/compact` : « Conversation résumée pour libérer du contexte ».
- La cloche explique pourquoi macOS bloque les notifications (app sans signature).

## Défauts

Classés par gêne pour l'utilisateur.

1. **Texte perdu après le choix d'un mode (ou d'un modèle).** Après le choix, le focus revient
   sur la puce, dont l'infobulle s'ouvre (infobulle Radix au focus) **par-dessus la zone de
   saisie** (`div.tooltip` à 474,799, 275×24). Le clic de l'utilisateur tombe sur l'infobulle, la
   saisie n'a pas le focus, le texte tapé part dans le vide et Entrée n'envoie rien. Reproduit
   3 fois, avec un journal des évènements focus et pointeur pris par CDP. Pistes :
   `pointer-events: none` sur les infobulles ; rendre le focus à la saisie après un choix dans un
   menu de la barre.
2. **Barre de saisie illisible.** Avec « GPT-6.1 Sol Fast », toutes les puces se tronquent, même
   en plein écran sans panneau : « car… », « m… », « Bu… », « GPT-6.1 Sol F… », « OpenCo… ». En
   demi-écran, il ne reste que « c », « GP… », « O… ». La puce du modèle (fiche 090) fait
   déborder une barre déjà pleine. Pistes : ne tronquer que la puce du modèle, masquer le
   pourcentage, ou passer sur deux lignes.
3. **Téléchargements bloqués en silence** dans le navigateur intégré (`will-download` →
   `preventDefault`, `browser-manager.ts:406`). Le bouton « Exporter » (CSV) du projet ne fait
   rien, sans message. Pour qui teste un export, c'est une impasse.
4. **Après une relance, les modifications de la conversation sont incomplètes** : 2 fichiers
   (+13) au lieu de 5 (+176 −11). Au rejeu (`session/load`), OpenCode renvoie ses « patch » sans
   contenu `diff` (« 1 text » au lieu de « 1 text, 2 diff » en direct) ; le diff reste dans
   `rawOutput.metadata.files[].patch`. Le fil rejoué diffère aussi : « 2 actions dans le
   navigateur » devient « 2 outils », « Réponse interrompue. » disparaît, un bloc « Réflexion »
   apparaît.
5. **Chronomètre du tour faux, par moments** : « 1 min 07 » au bout de 6 s, au 2e tour.
   `WorkingIndicator` calcule le début une seule fois au montage (`useState`) ; si le statut
   « occupé » arrive avant le message de l'utilisateur dans le fil, `findLast(user)` rend l'id
   du tour précédent et la `Map` renvoie son début. Vu une fois sur six.
6. **La liste des conversations se retrie sous le curseur** (tri par activité). Mon clic a ouvert
   la mauvaise conversation et le message est parti au mauvais endroit.
7. **Noms propres à Bob avec OpenCode.** L'app écrit `.bob/launch.json` dans le projet (le
   dossier n'est pas ignoré : il apparaît dans `git status`). La branche du worktree s'appelle
   `bob/20261020-1821-0ee3`.

## Interface

- Premier lancement : l'app part sur Bob dans `<données>/workspace`, un dossier que
  l'utilisateur n'a pas choisi, et affiche aussitôt « Dossier non approuvé ». Ce dossier reste
  ensuite dans les dossiers récents.
- « Faire confiance à ce dossier », l'action principale de la carte, ressemble à un libellé.
- Menu des modèles : une quarantaine d'entrées en liste plate, sans recherche ni regroupement par
  fournisseur. Il s'ouvre en haut de la liste, pas sur le modèle choisi, et déborde de la
  fenêtre.
- Langues mélangées. En anglais, venus d'OpenCode : « Session Mode », « Build — The default
  agent… », « Compact the session », « guided AGENTS.md setup », « Model : … ». Venus
  d'Electron : « Minimize », « Zoom », « Bring All to Front », et « Cancel / OK » de `confirm()`.
- Vocabulaire : « Exécution » dans Réglages contre « Build » dans la puce. « Branche » désigne
  une conversation dérivée, alors que la puce voisine montre la branche git ; et cette
  « branche » de conversation travaille dans le même dossier que l'original.
- Une branche et son original portent le même titre tronqué dans la liste.
- Diff du panneau replié coupé à droite, sans coloration syntaxique.
- La liste des remarques du plan chevauche la fin du plan.
- Annotation : un texte long ne revient pas à la ligne et sort de l'image.
- « Joindre cette page » en panneau agrandi : aucun retour (la saisie est cachée).
- Dans une branche, le panneau Navigateur est vide alors que le serveur tourne.
- La page n'est pas rechargée quand l'agent modifie le code sans passer par le navigateur.
- Le `confirm()` de la page grise toute l'app, barre latérale comprise.
- La fenêtre n'est pas remise en plein écran à la relance.
- Les listes de Réglages › Agents sont tronquées (« Comme la conversation en co… »).

## Manques

- **Committer depuis l'onglet Git** (message, bouton) : aujourd'hui, il faut le demander à
  l'agent.
- **Rapatrier un worktree** (fusionner, supprimer) : limite connue de la fiche 036, faite ici au
  terminal. Il manque aussi un avertissement : le worktree part du dernier commit, sans les
  modifications non committées du dossier principal.
- **Titre automatique** des conversations : aujourd'hui, c'est le début du premier message.
- **Téléchargements** dans le navigateur intégré (voir défaut 3).
- **Recherche dans le menu des modèles.**
- **Quota de l'abonnement ChatGPT** (fenêtres de 5 h et de la semaine), si OpenCode l'expose un
  jour : le pendant du quota de Bob (fiche 091).
- ~~Commenter une ligne du diff~~ : la fonction existe (le « + » qui apparaît au survol d'une ligne,
  dans Modifications), mais je ne l'ai pas trouvée pendant l'essai. C'est donc un souci de
  découverte, pas un manque.
- **Notifications** dans les builds sans certificat : limite macOS connue ; seuls le badge du Dock
  et les pastilles restent.

## Fonctions à questionner

Rien d'inutile à proprement parler, mais quelques éléments brouillent l'écran :

- Les badges « IBM Bob » du menu `/` quand on travaille avec OpenCode.
- iOS et Android dans « Ouvrir un outil » pour un projet web.
- « Exporter en JSON » dans le menu d'une conversation (pour qui ?).
- Le message « J'ai autorisé « npm start » : relance preview_start. » que l'app écrit en bulle
  utilisateur après une autorisation tardive : clair, mais surprenant.

## Pour la suite

Cet essai couvre l'éventail des fonctions. Il ne dit rien de **l'usure**. Pour la voir, il faut
une session de **1 h 30 à 2 h** sur une vraie évolution en plusieurs étapes (40 à 60 tours) :
longues conversations, compression subie et non demandée, plusieurs conversations et worktrees
qui vivent ensemble, relances, et Bob en parallèle pour comparer.
