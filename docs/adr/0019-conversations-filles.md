# ADR-0019 — Conversations filles : lien mère-fille, compte rendu, et outils de l'app pour l'agent

- **Statut** : accepté — plafond de 3 filles remplacé par ADR-0020 (réglage, 5 par défaut)
- **Date** : 2026-10-20

## Contexte

Bobine sait faire tourner des conversations en parallèle, chacune dans son worktree (fiche 036),
mais elles ne se connaissent pas. Pour coordonner plusieurs chantiers, l'utilisateur doit faire le
facteur entre elles. C'est ce qui s'est passé le 2026-10-20 : cinq sessions en worktree (fiches
092 à 096), une session coordinatrice, des allers-retours à la main.

Les sous-agents des agents (l'outil `task` d'OpenCode, les sous-agents de Bob) ne couvrent pas ce
besoin :

- ils tournent pendant le tour de l'agent principal, qui reste bloqué ;
- ils écrivent dans le même dossier, donc plusieurs écrivains se marchent dessus ;
- l'utilisateur ne peut ni les ouvrir, ni leur parler, ni les arrêter.

L'utilisateur a choisi le 2026-10-20 de donner aux conversations un lien mère-fille, en deux
étapes : d'abord lancées par lui, puis par l'agent. Contrainte : rester générique (Bob et OpenCode,
ADR-0011) et maintenable, sans orchestrateur.

## Décision

**Une conversation peut avoir une mère** (`startedFrom`, comme `branchedFrom` pour les branches).
Il n'y a qu'**un seul niveau** : une fille n'a pas de filles.

**Une fille tourne toujours dans son propre worktree**, créé depuis le dossier de la mère. C'est une
règle de l'app : l'agent n'a pas à la choisir. Sans dépôt git, il n'y a pas de fille, et l'app dit
pourquoi.

**Étape 1 — lancée par l'utilisateur.** Depuis une conversation, « Lancer en parallèle… » ouvre une
fille avec une consigne. L'agent et le modèle sont par défaut ceux de la mère.

- La fille s'affiche sous sa mère, dans la liste (fiche 095), avec son état.
- À chaque fin de tour de la fille, l'app pose un **compte rendu** dans le fil de la mère : état,
  fichiers modifiés, branche, et la fin de sa dernière réponse.
- Ce compte rendu part à l'agent de la mère avec le prochain message de l'utilisateur. Il n'y a pas
  de réveil automatique : un réveil coûte un tour.

**Étape 2 — lancée par l'agent.** Le serveur MCP de l'app (`bobine`, fiche 029) gagne quelques
outils. Leurs descriptions sont en anglais (ADR-0014) et disent quand s'en servir (travail long,
indépendant, qui modifie des fichiers) et quand ne pas s'en servir (lecture, recherche, petite
correction : le faire soi-même ou avec un sous-agent).

- `start_child` : demande l'accord de l'utilisateur à chaque fois, sur une carte comme celle de
  « Lancer l'app ».
- `message_child`, et `message_parent` dans une fille : le message entre dans la file d'attente de
  la conversation visée, avec sa provenance affichée.
- `child_status` : état, fichiers et branche des filles.

Garde-fous :

- au plus 3 filles actives par mère ;
- dans une fille, seul `message_parent` est proposé ;
- l'utilisateur peut refuser toute fille.

Quand l'agent a lancé des filles, il est **réveillé une fois** quand toutes ont fini leur tour et
qu'il est au repos. Il reçoit alors leurs comptes rendus groupés.

Rien n'est propre à un agent : tout passe par l'ACP et le serveur MCP que Bob et OpenCode reçoivent
déjà.

## Alternatives écartées

- **Les sous-agents seuls** : boîte noire, même dossier, tour bloqué (voir le contexte).
- **Montrer les sous-agents dans la liste, sans communication** : peu de travail, mais ça ne règle
  pas la coordination.
- **Une orchestration complète** (plans de filles, fusion automatique des branches, arbres
  profonds) : beaucoup de code et de cas à maintenir, pour un usage rare.
- **Des filles sans worktree** : conflits d'écriture entre filles et avec la mère.
- **Réveiller la mère à chaque compte rendu** : un tour payé par fille et par tour. Le réveil
  groupé, seulement pour les filles lancées par l'agent, suffit.

## Conséquences

- **Coût** : chaque fille consomme (bobcoins de Bob, quota de l'abonnement d'OpenCode). D'où
  l'accord à chaque fille et le plafond de 3.
- **Fusion** : les branches des filles se fusionnent toujours hors de l'app (terminal, ou en le
  demandant à l'agent), comme pour la fiche 036. Le compte rendu donne le nom de la branche.
- **Mère archivée ou supprimée** : ses filles restent, en conversations ordinaires, avec leur
  icône.
- **Dépendance au modèle** : un petit modèle peut ignorer `start_child`, ou en abuser. Les
  descriptions, l'accord et le plafond limitent l'abus. L'étape 1 marche sans l'agent.
- **Essais** : chaque comportement a un scénario d'agent factice. Les essais réels, avec Bob et
  OpenCode, suivent les prompts de la fiche 097.
