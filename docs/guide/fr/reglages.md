# Réglages : confidentialité et données

Ce que Bobine retient sur ce Mac, et comment le relire, le sauvegarder ou l'effacer. Bobine
n'envoie rien ailleurs qu'à l'agent que vous utilisez : elle n'a pas de télémétrie.

Les réglages (⌘,) sont rangés en trois groupes : Général, Apparence, Notifications, Raccourcis
clavier ; Conversations, Agents, Serveurs MCP, Commandes ; Confidentialité, Données, Diagnostic,
Nouveautés. Le champ de recherche, en haut, retrouve chaque réglage (⌘F).

Ici, vous pouvez :

- [revoir et révoquer ce que vous avez autorisé](#autorisations) ;
- [gérer les données du navigateur intégré](#navigateur) ;
- [sauvegarder l'historique, et le restaurer](#sauvegarde) ;
- [récupérer une conversation supprimée](#corbeille) ;
- [oublier un dossier récent](#dossiers-recents) et [nettoyer les worktrees orphelins](#orphelins) ;
- [remettre la consommation à zéro](#consommation) ;
- [essayer Bobine comme neuve, ou la réinitialiser](#recommencer).

<a id="autorisations"></a>

## Revoir et révoquer ce que vous avez autorisé

Réglages › Confidentialité › **Autorisé sans demander** liste tout ce que vous avez autorisé une
fois pour toutes :

- **Outils** : les outils de l'agent pour lesquels vous avez répondu « toujours » ;
- **Sites** : ceux que le navigateur intégré ouvre sans demander ;
- **Commandes · dossier** : les commandes et compilations « Toujours dans ce projet » ;
- **Préparation des worktrees · dossier** : les commandes de `.bobine/worktree.json` que vous avez
  autorisées (voir [Worktrees](worktrees.md#accord)).

✕ (**Révoquer**), puis confirmez : la prochaine fois, l'agent (ou Bobine) redemandera.

<a id="navigateur"></a>

## Les données du navigateur intégré

Réglages › Confidentialité › **Navigateur intégré** :

- **Garder les connexions** (activé par défaut) : cookies et connexions du navigateur intégré,
  d'un lancement à l'autre ;
- **Données du navigateur** › **Effacer** : cookies, connexions, stockage des sites et cache. Il
  faudra se reconnecter aux sites.

<a id="sauvegarde"></a>

## Sauvegarder l'historique

Réglages › Données › **Sauvegarde de l'historique** › **Sauvegarder…** : une copie datée de tout
le profil (conversations, réglages, autorisations, tâches planifiées, consommation, mémoire), sans
les clés d'API, dans le dossier de votre choix. Une sauvegarde contient aussi la corbeille.
Restaurée sur un autre Mac, la mémoire revient, mais ses souvenirs sont à revalider.

**Restaurer…** remet une sauvegarde à la place du profil actuel, après confirmation ; ce qu'il y
avait avant est gardé à côté et se restaure de la même façon. La restauration remet les
conversations de Bobine, pas l'historique interne de l'agent : une réponse peut réapparaître quand
l'agent reprend sa session. Les clés d'API saisies pour les agents déclarés (Réglages › Agents) ne
sont pas dans une sauvegarde : il faut les ressaisir après une restauration.

Pour une seule conversation : son menu **…** › **Exporter en Markdown…** ou **Exporter en JSON…**.

<a id="corbeille"></a>

## Récupérer une conversation supprimée

Une conversation supprimée (menu **…** › **Supprimer** › **Mettre à la corbeille**) va dans la
**Corbeille** : Réglages ›
Données › **Corbeille** la montre, avec le nombre de jours qui lui restent. **Restaurer** la remet
dans la liste des conversations ; **Effacer définitivement** l'efface tout de suite. Sinon, elle
s'efface seule 30 jours après.

**Supprimer aussi chez** *l'agent*, décoché d'office et proposé seulement si l'agent sait le
faire, efface aussi sa session chez l'agent ; c'est définitif. Restaurée, la conversation continue
alors dans une session neuve, qui reçoit l'échange d'avant en texte.

La mémoire commune a ses propres réglages : voir [Mémoire commune](memoire.md).

<a id="dossiers-recents"></a>

## Oublier un dossier récent

Réglages › Données › **Dossiers récents** : ✕ retire un dossier de la liste. Le dossier lui-même
n'est pas touché.

<a id="orphelins"></a>

## Nettoyer les worktrees orphelins

Réglages › Données › **Worktrees orphelins** : les worktrees dont la conversation a été supprimée.
**Nettoyer** les efface avec leur contenu, après confirmation. Voir
[Worktrees](worktrees.md#orphelins).

<a id="consommation"></a>

## Remettre la consommation à zéro

Bobine note chaque échange avec un agent (agent, modèle, projet, jetons, coût, durée) pour la page
**Mon activité** (⇧⌘U). Réglages › Données › **Remettre à zéro…** efface tout, après confirmation.
C'est définitif : exportez d'abord (Mon activité › **Exporter…** › tout l'historique) pour le
garder. Le quota des agents, comme celui d'IBM Bob, n'est pas concerné.

<a id="recommencer"></a>

## Essayer Bobine comme neuve, ou la réinitialiser

Réglages › Données › **Recommencer à neuf** :

- **Essayer Bobine comme neuve** › **Ouvrir** : une seconde Bobine s'ouvre sur un profil vide,
  effacé à sa fermeture. La vôtre n'est pas touchée. Avec **Agents comme sur un Mac neuf**, les
  agents de cette seconde Bobine redemandent connexion et confiance des dossiers ; vos vraies
  connexions restent.
- **Réinitialiser Bobine** › **Réinitialiser…** : tout ce que Bobine garde sur ce Mac part dans un
  dossier daté de la corbeille, avec un LISEZ-MOI (conversations, réglages, clés d'API, sites
  autorisés, consommation, données du navigateur, journaux). Puis Bobine redémarre comme au
  premier lancement. Cochez **Mettre aussi l'app à la corbeille** pour la désinstaller.

Vos projets, leurs worktrees et vos agents (leurs connexions, réglages et sessions) ne sont jamais
touchés.

Depuis un terminal, avec l'app installée :

```bash
open -n -a Bobine --args --profil-temporaire
```
