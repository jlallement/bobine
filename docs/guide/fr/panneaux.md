# Panneaux

Le panneau de droite montre ce que fait l'agent, et vous laisse la main : la session, les
modifications, le navigateur intégré, le terminal, le simulateur iOS, l'émulateur Android, la
liste de tâches.

Ici, vous pouvez :

- [ouvrir, fermer et agrandir le panneau](#panneau) ;
- lire l'[onglet Session](#session) ;
- relire et annoter les [modifications](#modifications) ;
- utiliser le [navigateur intégré](#navigateur), et [annoter une page](#annoter) ;
- utiliser le [terminal](#terminal) ;
- voir le [simulateur iOS](#simulateur-ios) et l'[émulateur Android](#android) ;
- suivre la [liste de tâches](#taches) et les [échanges ACP](#echanges-acp).

<a id="panneau"></a>

## Ouvrir, fermer et agrandir le panneau

- ⌘J ouvre ou ferme le panneau (Affichage › Panneau de droite). Il s'ouvre de lui-même sur
  l'onglet Session quand la fenêtre a la place.
- Les onglets n'apparaissent que pour les outils qui servent dans la conversation ; les autres
  sont dans le menu **+** (« Ouvrir un outil »). Un nouvel onglet s'ajoute à droite.
- ✕ (ou un clic molette) ferme un onglet sans arrêter l'outil ; il revient quand l'agent s'en sert
  de nouveau.
- **Agrandir le panneau** (⇧⌘J, ou double-clic sur son bord) lui donne la place de la
  conversation. Son en-tête dit alors si l'agent répond ou attend votre réponse ; un clic vous
  ramène à la conversation.
- Faites glisser son bord pour changer sa largeur.

<a id="session"></a>

## L'onglet Session

La conversation d'un coup d'œil :

- **Environnement** : agent, modèle et mode (à changer d'un clic), dossier,
  [autres dossiers](plusieurs-dossiers.md), branche ou worktree ;
- **Contexte** : la place occupée dans le contexte de l'agent, par catégorie (messages, outils de
  Bobine, autres serveurs MCP, agent, libre). C'est une estimation, sans aucun coût ;
- **Modifications** : les fichiers modifiés (un clic ouvre la vue Git) ;
- **Pull request**, quand il y en a une : voir [Suivi des PR](suivi-pr-ci.md) ;
- **En cours** : terminaux, serveurs de dev, sous-agents, conversations filles, avec leur durée et
  un bouton pour les arrêter.

<a id="modifications"></a>

## Les modifications

L'onglet **Modifications** (⇧⌘D) a deux ou trois vues :

- **Conversation** : ce que l'agent a modifié dans cette conversation, fichier par fichier, avec
  leur diff. Chaque modification s'annule fichier par fichier.
- **Git** : l'état du dépôt, pour [committer](worktrees.md#committer) et, dans un worktree,
  [ouvrir une PR ou fusionner](worktrees.md#vue-git) ;
- **Filles**, dans une conversation mère : voir
  [Conversations filles](conversations-filles.md#suivre).

**Remarques sur le diff.** Au survol d'une ligne du diff, **+** ajoute une remarque (⇧-clic pour
une plage de lignes ; ⌘↩ pour l'ajouter). **Envoyer à l'agent** les envoie toutes en un message
qui cite le fichier, les lignes et le code. Elles sont gardées jusqu'à l'envoi.

L'icône **Faire relire…** de la barre des vues lance une relecture par un autre agent :
voir [Faire relire](faire-relire.md).

Un fichier d'une carte d'outil, d'un diff ou d'un lien s'ouvre à la bonne ligne dans votre éditeur
(VS Code, Cursor, Zed, IDE de JetBrains), choisi dans Réglages › Général.

<a id="navigateur"></a>

## Le navigateur intégré

Les pages que l'agent ouvre s'affichent dans l'onglet **Navigateur** ; vous pouvez aussi saisir
une adresse (`localhost:3000`…). L'agent peut lire la page, cliquer, remplir, faire une capture.
Avant d'ouvrir un site, il demande votre accord (voir
[Autorisations](conversations.md#autorisations)).

- **Liens.** Dans le fil, un lien vers une adresse de votre Mac (`http://localhost:3000`…) s'ouvre
  dans le navigateur intégré ; ⌥-clic l'ouvre dans le navigateur du Mac. Les autres liens
  s'ouvrent dans le navigateur du Mac.
- **Zoom.** La page ayant le focus : ⌘+, ⌘− et ⌘0. Une puce « 110 % » dans l'adresse remet la page
  à 100 % d'un clic. Les autres raccourcis : [Raccourcis clavier](raccourcis.md#navigateur).
- **Taille d'écran.** Quand l'agent impose une taille (mobile…), une puce dans l'adresse le dit ;
  un clic l'annule. Elle s'annule aussi à la fin de son tour.
- **Joindre la page au message** : l'icône de la barre d'outils joint une capture de la page à
  votre prochain message.
- **Téléchargements.** Chaque fichier demande « Enregistrer sous », même quand c'est l'agent qui
  clique : rien n'est enregistré sans votre accord.
- **Serveurs de dev.** Ceux que l'agent lance ont leur barre dans l'onglet, avec leur journal et
  **Arrêter le serveur**.
- **Connexions.** Les cookies et connexions du navigateur intégré sont gardés d'un lancement à
  l'autre ; voir [Réglages](reglages.md#navigateur).

<a id="annoter"></a>

### Annoter une page

1. Cliquez sur l'icône **Annoter la page** (une bulle avec un +) dans la barre d'outils.
2. Cliquez là où vous voulez laisser une remarque, écrivez-la, puis **Ajouter** (ou ⌘↩). La page
   défile et zoome comme d'habitude ; vous pouvez annoter plusieurs écrans.
3. **Envoyer à l'agent** : les remarques partent en un message, avec une capture par écran annoté
   et les éléments visés.

Échap quitte le mode Annoter ; les remarques restent jusqu'à l'envoi.

<a id="terminal"></a>

## Le terminal

L'onglet **Terminal** (⌃`) est un vrai terminal, dans le dossier de la conversation. **+** ouvre un
nouveau terminal.

- L'agent y lance ses commandes dans ses propres onglets, sans pager (`git log` ne bloque pas), et
  ne touche jamais aux vôtres. Il demande votre accord avant de lancer une commande.
- Sélectionnez du texte, puis **Ajouter au message** pour le joindre à votre message.
- La mention `@terminal` joint les dernières lignes du terminal.
- **Ouvrir un terminal ici**, dans le menu du dossier sous la zone de saisie, ouvre ce terminal
  dans le dossier de la conversation.

La police du terminal se règle dans Réglages › Apparence.

<a id="simulateur-ios"></a>

## Le simulateur iOS

L'onglet **iOS** montre le simulateur en direct : l'agent peut le démarrer, installer et lancer
l'app, toucher l'écran, faire des captures et filmer un geste. Vous pouvez aussi toucher et faire
défiler l'app vous-même.

Il faut Xcode complet (pas seulement les outils en ligne de commande), un runtime iOS et un
simulateur (Xcode › Window › Devices and Simulators). Les touchers et la vidéo passent par AXe,
livré avec Bobine. Réglages › Diagnostic vérifie le tout.

- En haut : **Dézoomer**, **Ajuster au panneau** (par défaut), **Taille réelle** (1:1),
  **Zoomer**. Zoomé, la molette déplace la vue.
- Sous l'appareil : **Accueil**, **Verrouiller** et **Joindre cet écran au message**.

Avant de compiler, l'agent demande votre accord (**Compiler**, **Toujours dans ce projet** ou
**Refuser**).

<a id="android"></a>

## L'émulateur Android

L'onglet **Android** fait de même avec l'émulateur Android (il faut le SDK Android) : appareil en
direct, gestes, boutons Retour, Accueil et Apps récentes, et **Joindre cet écran au message**.

<a id="taches"></a>

## La liste de tâches

Quand l'agent tient une liste de tâches, l'onglet **Tâches** la montre, avec « faites / total »
dans son nom. Pendant qu'il travaille, la liste est aussi juste au-dessus de la zone de saisie ;
un clic la replie sur une ligne.

<a id="echanges-acp"></a>

## Les échanges ACP

Pour comprendre ce que fait l'agent : menu **+** › **Échanges ACP**. Les messages échangés entre
Bobine et l'agent s'y affichent en direct, dans les deux sens ; un clic déplie le JSON brut. Filtre,
pause, et copie en NDJSON. Les clés et jetons sont masqués ; seuls les 2 000 derniers messages de
la conversation sont gardés, en mémoire seulement.
