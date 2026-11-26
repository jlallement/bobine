# Travaux délégués et fusion

Un **travail** est une demande confiée à un rôle de l'Équipe, ou à un autre agent, qui la fait de
son côté, dans sa propre conversation, puis rend une **réponse**. Vous le lancez avec `@rôle` dans
la saisie, depuis le menu **…** (« Lancer en parallèle… »), ou l'agent vous le propose quand votre
demande contient plusieurs chantiers indépendants. Un travail qui écrit du code travaille dans son
propre [worktree](worktrees.md), sur une nouvelle branche ; quand il est prêt, vous le fusionnez
depuis sa carte.

Un travail a sa vraie conversation : vous pouvez l'ouvrir, lui écrire, l'arrêter. Ce n'est pas un
sous-agent (ceux que l'agent lance lui-même restent dans le flux de ses outils).

Il faut un dossier dans un dépôt git. Il n'y a qu'un niveau : un travail ne lance pas d'autre
travail.

Ici, vous pouvez :

- [lancer un travail](#lancer) ;
- [répondre aux travaux proposés par l'agent](#taches-proposees) ;
- [suivre les travaux](#suivre) ;
- [fusionner leurs modifications](#fusionner) ;
- [régler ce que l'agent propose](#reglages).

<a id="lancer"></a>

## Lancer un travail

**Avec un rôle.** Tapez `@` dans la saisie et choisissez un rôle (voir [Agents](agents.md)), puis
écrivez votre demande. La ligne sous la saisie dit où il partira : un rôle de conseil lit ce
dossier sans rien modifier ; un rôle qui écrit part du dernier commit, dans sa branche
(**Changer…** propose d'autres choix). Entrée envoie toujours.

**Sans rôle.** Dans le menu **…** de la conversation (dans son en-tête, ou sur sa ligne de la barre
latérale), choisissez **Lancer en parallèle…**, écrivez la **Consigne**, choisissez l'**Agent** et,
quand l'agent le permet, le **Modèle**, puis **Lancer** (ou ⌘↩). Avec IBM Bob, l'agent choisit son
modèle.

Le travail apparaît sous sa conversation d'origine, dans la barre latérale ; la conversation
affichée ne change pas. Son en-tête dit d'où il vient et y ramène d'un clic.

« Lancer en parallèle… » est grisé hors d'un dépôt git, ou quand le nombre de travaux en cours
atteint le plafond (voir [Réglages](#reglages)). Il n'existe pas dans un travail, un brouillon ou
une conversation archivée.

Le worktree d'un travail se prépare comme les autres, mais n'attend pas votre accord : voir
[Préparer chaque nouveau worktree](worktrees.md#accord).

<a id="taches-proposees"></a>

## Répondre aux travaux proposés par l'agent

Quand l'agent juge qu'une partie du travail peut partir à part, il la propose sur une carte
**N travaux proposés**. Rien ne démarre sans vous. Pour chaque ligne :

- **Lancer** : le travail démarre ;
- **Faire ici** : l'agent s'en charge lui-même, dans la conversation ;
- **Refuser** : l'agent ne le relance pas ;
- l'icône **Agent et modèle** : changer l'agent ou le modèle avant de lancer.

**Tout lancer** lance chaque ligne encore proposée. Au clavier : ↑ ↓ pour choisir une ligne, ↩ pour
la lancer.

L'agent peut suggérer l'agent de chaque travail, et son modèle avec OpenCode (jamais avec IBM Bob),
avec sa raison : « Suggéré par l'agent, à confirmer ». Vous gardez la suggestion ou la changez.

**Expiré** : l'agent a redémarré avant votre réponse. **Lancer** reste possible.

**Demander un découpage.** Commencez votre message par `/split` : l'agent propose un travail par
chantier indépendant. Par exemple :
`/split Trois chantiers : l'import, l'export, la page d'aide.`

<a id="suivre"></a>

## Suivre les travaux

**Dans le fil**, chaque travail a **une seule carte**, à sa place pour toujours : sous votre bulle
`@Rôle …`, ou à la place des travaux proposés (une **carte de groupe** pour plusieurs travaux
lancés ensemble). La carte montre l'activité en direct, puis la **réponse** complète, en Markdown,
puis ses actions : **Demander à <agent> d'appliquer cette réponse**, **Répondre à <rôle>**,
**Ouvrir sa conversation**. Le pied de chaque réponse donne son heure, sa durée et son coût.

La fin d'un travail se lit sur sa carte : **a répondu** (avec le nombre de fichiers pour un travail
qui écrit), **arrêté** ou **en erreur**. Quand un travail répond hors de vue, un repère en bas du
fil le dit (« ↑ 2 travaux ont répondu · Voir ») ; **Voir** fait défiler jusqu'à sa carte.

**Le coût**, une seule fois par carte : un montant ; **gratuit** quand l'agent annonce un coût nul
pour un modèle qui se dit gratuit (« free » à la fin de son nom) ; **coût inconnu** quand il annonce
un coût nul pour un autre modèle (connexion par abonnement, par exemple), ou quand une partie des
travaux n'a pas de coût (« ≈ 0,05 $US + coût inconnu »). Bobine ne présente jamais un modèle payant
comme gratuit. Avec un coût inconnu, le plafond de coût ne peut pas se déclencher.

**Dans la barre latérale**, chaque travail est sous sa conversation d'origine, avec son état :
**En cours**, **Attend un accord**, **A répondu, à lire**, **A répondu**, **Arrêté**, **En
erreur**. Il apparaît dès son lancement.

**Ce que reçoit l'agent.** La carte le dit : « Pas encore transmise à <agent> — elle le sera avec
votre prochain message », puis « Transmise ». Des travaux lancés par l'agent : il est réveillé une
seule fois, quand tous ont répondu.

**Les messages entre conversations.** L'agent peut écrire à ses travaux, et un travail peut écrire
à sa conversation d'origine. Ces messages passent par la file d'attente et disent leur
provenance (« De la conversation d'origine… », « Du travail… ») ; un clic ouvre l'autre
conversation.

**La vue Travaux.** Dans l'onglet **Modifications**, la vue **Travaux** liste les worktrees des
travaux : état, branche, fichiers modifiés, avis de l'agent. Pour chacun :
<!-- si: finder -->
l'afficher dans le Finder,
<!-- si: !finder !explorer
l'afficher dans le gestionnaire de fichiers,
-->
<!-- si: explorer
l'afficher dans l'Explorateur de fichiers,
-->
l'ouvrir dans votre éditeur, [le faire relire](faire-relire.md) ou
**Ouvrir** sa conversation.

**Avec IBM Bob en mode Agent**, chaque écriture ou commande d'un travail demande votre accord dans
sa conversation : il reste sur « Attend un accord » tant que vous n'y avez pas répondu.

<a id="avis-de-la-mere"></a>

## L'avis de l'agent

L'agent lit les réponses, vérifie le travail, renvoie ses corrections, puis dit si la branche est
prête. Sur la ligne du travail :

- **Recommandé** : prêt à fusionner ;
- **Pas encore recommandé** ;
- **À revoir** : le travail a refait un tour depuis cet avis.

Le survol donne la raison. C'est toujours vous qui fusionnez.

<a id="fusionner"></a>

## Fusionner les modifications

Un travail qui écrit se fusionne **depuis sa carte** : **Fusionner dans main**, après **Voir les
modifications** et, si vous le voulez, **Faire relire** (voir [Faire relire](faire-relire.md)). Une
carte de groupe propose **Fusionner les N prêts dans main** ; avec un avis de l'agent,
**Fusionner les N recommandés dans main**, et **Inclure les M autres…** pour les autres, après
confirmation.

**Puis nettoyer (archiver, supprimer les branches)** : une case, avant le bouton. Elle archive la
conversation de chaque travail fusionné et supprime son worktree et sa branche.

Les branches entrent l'une après l'autre, dans l'ordre de lancement, avec l'état de chaque ligne
en direct. **Arrêter** s'arrête après la fusion en cours.

**Un conflit.** Le travail concerné le résout lui-même, dans sa branche, puis la fusion s'arrête :
rien de sa résolution n'entre dans `main` sans vous. Sa ligne dit **conflit résolu · à relire** ;
**Voir la résolution** ouvre sa vue Git, **Faire relire** la confie au Code reviewer. Quand elle vous
convient, le bouton habituel de la carte la fusionne (avec les travaux restés en attente). S'il
reste des conflits : **Réessayer**, **Abandonner** ou **Voir le conflit** (sa vue Git).

**Le dossier principal a des modifications non commitées** : la fusion ne part pas. Comme pour un
worktree : **Committer d'abord** ou **Mettre de côté**. Voir
[Fusionner dans `main`](worktrees.md#fusionner).

Rien n'est poussé, et aucune PR n'est ouverte : pour une PR, passez par la
[vue Git du travail](worktrees.md#pr).

**Archiver ou supprimer leur conversation d'origine** : ses travaux deviennent des
conversations ordinaires. Désarchivée, elle les retrouve.

<a id="reglages"></a>

## Régler ce que l'agent propose

Réglages › Conversations, rubrique **Travaux délégués** :

- **Proposer des travaux** : **Jamais**, **Quand ça s'y prête** (par défaut) ou **Toujours
  demander**. Ce réglage dit à l'agent s'il doit proposer des travaux ; dans tous les cas, chaque
  proposition passe par la carte des travaux proposés et attend votre accord.
- **Travaux en même temps, au plus** : de 1 à 10 par conversation (5 par défaut). Au-delà, « Lancer en
  parallèle… » est grisé. Les relectures comptent dans ce nombre.

Les outils des travaux se coupent dans Réglages › Serveurs MCP › Outils de Bobine, famille
**Travaux délégués**.
