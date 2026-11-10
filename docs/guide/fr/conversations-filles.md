# Conversations filles et fusion

Une conversation fille travaille de son côté, dans son propre [worktree](worktrees.md), sur une
nouvelle branche. Vous la lancez depuis une conversation « mère », ou l'agent vous la propose
quand votre demande contient plusieurs chantiers indépendants. À chaque fin de tour, la fille rend
compte à sa mère. Quand le travail est prêt, vous fusionnez les branches d'un geste.

Une conversation fille est une vraie conversation : vous pouvez l'ouvrir, lui écrire, l'arrêter.
Ce n'est pas un sous-agent (ceux que l'agent lance lui-même ont leur carte « Sous-agents »).

Il faut un dossier dans un dépôt git. Il n'y a qu'un niveau : une fille ne lance pas de fille.

Ici, vous pouvez :

- [lancer une conversation fille](#lancer) ;
- [répondre aux tâches proposées par l'agent](#taches-proposees) ;
- [suivre les filles](#suivre) depuis la mère ;
- [fusionner leur travail](#fusionner) ;
- [régler ce que l'agent propose](#reglages).

<a id="lancer"></a>

## Lancer une conversation fille

1. Dans le menu **…** de la conversation (dans son en-tête, ou sur sa ligne de la barre latérale),
   choisissez **Lancer en parallèle…**.
2. Écrivez la **Consigne** : ce que la fille doit faire.
3. Choisissez l'**Agent** (par défaut, celui de la mère) et, quand l'agent le permet, le
   **Modèle**. Avec IBM Bob, l'agent choisit son modèle.
4. Cliquez sur **Lancer** (ou ⌘↩).

La fille apparaît sous sa mère dans la barre latérale ; la conversation affichée ne change pas.
Son en-tête dit d'où elle vient (« ↳ depuis « … » ») et y ramène d'un clic.

« Lancer en parallèle… » est grisé hors d'un dépôt git, ou quand le nombre de filles en cours
atteint le plafond (voir [Réglages](#reglages)). Il n'existe pas dans une fille, un brouillon ou
une conversation archivée.

Un worktree de fille se prépare comme les autres, mais n'attend pas votre accord : voir
[Préparer chaque nouveau worktree](worktrees.md#accord).

<a id="taches-proposees"></a>

## Répondre aux tâches proposées par l'agent

Quand l'agent juge qu'une partie du travail peut partir dans une fille, il la propose sur une
carte **Tâches proposées**. Rien ne démarre sans vous. Pour chaque ligne :

- **Lancer** : la fille démarre ;
- **Faire ici** : l'agent s'en charge lui-même, dans la conversation ;
- **Refuser** : l'agent ne la relance pas ;
- l'icône **Agent et modèle** : changer l'agent ou le modèle avant de lancer.

Au clavier : ↑ ↓ pour choisir une ligne, ↩ pour la lancer. Cliquez sur le titre d'une ligne pour
lire la consigne complète.

La mère peut suggérer l'agent de chaque fille, et son modèle avec OpenCode (jamais avec IBM Bob),
avec sa raison : « Suggéré par la mère, à confirmer ». Vous gardez la suggestion ou la changez.

**Expirée** : l'agent a redémarré avant votre réponse. **Lancer** reste possible.

**Demander un découpage.** Commencez votre message par `/split` : l'agent propose une fille par
chantier indépendant. Par exemple :
`/split Trois chantiers : l'import, l'export, la page d'aide.`

<a id="suivre"></a>

## Suivre les filles depuis la mère

**Dans la barre latérale**, chaque fille est sous sa mère, avec son état : **En cours**,
**Attend un accord**, **Finie, à lire**, **Erreur**, **Finie**. Elle apparaît dès la création de
son worktree.

**Dans le fil de la mère** :

- une ligne par lancement (« Conversation fille lancée : … »), qui se déplie sur la consigne
  exacte ; de même pour chaque « Consigne pour… » envoyée ensuite ;
- la carte **Sous-tâches** : une ligne par fille, avec sa branche, ses fichiers modifiés, son coût,
  son état et **Ouvrir** ; le coût total en tête ;
- un **compte rendu** à chaque fin de tour d'une fille, replié sur deux lignes (titre et coût, puis
  la première phrase) ; dépliez-le pour la réponse, la branche, les fichiers et le nombre
  d'échanges.

**Ce que reçoit l'agent de la mère.** Une fille que vous avez lancée : son compte rendu part avec
votre prochain message. Des filles lancées par l'agent : il est réveillé une seule fois, quand
toutes ont fini.

**Les messages entre mère et filles.** L'agent de la mère peut écrire à ses filles, et elles
peuvent lui écrire. Ces messages passent par la file d'attente et disent leur provenance (« De la
conversation mère… », « De la conversation fille… ») ; un clic ouvre l'autre conversation.

**La vue Filles.** Dans l'onglet **Modifications** de la mère, la vue **Filles** liste les
worktrees des filles : état, branche, fichiers modifiés, avis de la mère. Pour chacune :
l'afficher dans le Finder, l'ouvrir dans votre éditeur, [la faire relire](faire-relire.md) ou
**Ouvrir** sa conversation.

**Avec IBM Bob en mode Agent**, chaque écriture ou commande d'une fille demande votre accord dans
la fille : elle reste sur « Attend un accord » tant que vous n'y avez pas répondu.

<a id="avis-de-la-mere"></a>

## L'avis de la mère

La mère lit les comptes rendus, vérifie le travail, renvoie ses corrections à la fille, puis dit
si la branche est prête. Sur la ligne de la fille :

- **Recommandée** : prête à fusionner ;
- **Pas encore prête** ;
- **À revoir** : la fille a refait un tour depuis cet avis.

Le survol donne la raison. C'est toujours vous qui fusionnez.

<a id="fusionner"></a>

## Fusionner le travail des filles

En bas de la carte **Sous-tâches**, dès qu'une fille finie a des commits à fusionner, une phrase
dit lesquelles sont prêtes, lesquelles travaillent encore, lesquelles touchent les mêmes fichiers
et lesquelles ont des modifications non commitées (à committer depuis leur vue Git : elles sont
laissées de côté).

Pour fusionner :

1. Activez **Puis nettoyer** si vous voulez, ensuite, archiver chaque fille fusionnée et supprimer
   son worktree et sa branche (désactivé par défaut).
2. Cliquez sur le bouton de fusion :
   - sans avis de la mère : **Fusionner les N dans main** ;
   - avec un avis : **Fusionner les N recommandées dans main**. Pour prendre aussi les autres :
     **Inclure les M autres…**, puis confirmez.

Les branches entrent l'une après l'autre, dans l'ordre de lancement, avec l'état de chaque ligne
en direct. **Arrêter** s'arrête après la fusion en cours.

**Un conflit.** La fille concernée le résout elle-même, puis la fusion reprend. S'il reste des
conflits : **Réessayer**, **Abandonner** ou **Voir le conflit** (sa vue Git).

**Le dossier principal a des modifications non commitées** : la fusion ne part pas. Comme pour un
worktree : **Committer d'abord** ou **Mettre de côté**. Voir
[Fusionner dans `main`](worktrees.md#fusionner).

Rien n'est poussé, et aucune PR n'est ouverte : pour une PR, passez par la
[vue Git de la fille](worktrees.md#pr).

**Archiver ou supprimer la mère** : ses filles deviennent des conversations ordinaires. Désarchivée,
elle les retrouve.

<a id="reglages"></a>

## Régler ce que l'agent propose

Réglages › Conversations, rubrique **Sous-tâches** :

- **Proposer des conversations filles** : **Jamais**, **Quand ça s'y prête** (par défaut) ou
  **Toujours demander**. Ce réglage dit à l'agent s'il doit proposer des filles ; dans tous les
  cas, chaque proposition passe par la carte « Tâches proposées » et attend votre accord.
- **Conversations filles en cours** : de 1 à 10 par conversation (5 par défaut). Au-delà,
  « Lancer en parallèle… » est grisé. Les relectures comptent dans ce nombre.

Les outils des filles se coupent dans Réglages › Serveurs MCP › Outils de Bobine, famille **Conversations
filles**.
