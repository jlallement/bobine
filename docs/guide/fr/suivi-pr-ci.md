# Suivi des PR et de la CI

Une fois la pull request d'un worktree ouverte, Bobine la suit pour vous : contrôles de la CI,
commentaires, avis de relecture, conflit avec la base. Elle peut envoyer à l'agent les contrôles
en échec, et fusionner la PR quand tout est vert.

Il faut la commande `gh` (GitHub CLI), installée et connectée à GitHub. Sans elle, rien de tout
cela n'apparaît : voir [Dépannage](depannage.md#gh).

Ici, vous pouvez :

- [suivre la PR](#suivre) ;
- [faire corriger les contrôles en échec](#corriger) ;
- [fusionner quand tout est vert](#fusion-auto) ;
- [pousser de nouveaux commits](#pousser).

<a id="suivre"></a>

## Suivre la PR

Ouvrez une PR depuis la vue Git du worktree ([Ouvrir une pull request](worktrees.md#pr)), ou
laissez l'agent l'ouvrir : Bobine trouve aussi une PR ouverte ailleurs pour la même branche.

Dans l'onglet **Modifications**, vue **Git**, une carte montre :

- le numéro et le titre de la PR (un clic l'ouvre sur GitHub), et son état : **Ouverte**,
  **Brouillon**, **Fusionnée** ou **Fermée** ;
- ses contrôles : en échec, en cours, réussis, chacun avec son lien ;
- le nombre de commentaires, l'avis de relecture (**Approuvée**, **Changements demandés**,
  **Relecture demandée**) et **Fusionnable** ou **En conflit avec la base**.

L'onglet **Session** a aussi une ligne **Pull request** ; un clic mène à la vue Git.

**À quel rythme.** Toutes les 30 secondes tant qu'un contrôle tourne, puis de plus en plus
espacé (jusqu'à 10 minutes). Fenêtre en arrière-plan : au plus toutes les 10 minutes, et plus du
tout après 30 minutes, jusqu'à votre retour. Le suivi s'arrête quand la PR est fusionnée ou fermée.
**Actualiser** relit tout de suite.

<a id="corriger"></a>

## Faire corriger les contrôles en échec

Quand un contrôle échoue, cliquez sur **Corriger les contrôles en échec** : Bobine envoie à l'agent
la liste des contrôles en échec, avec leur lien et un extrait de leur journal, et lui demande de
corriger, de vérifier, de committer et de pousser sur la même branche.

Pour que ce soit automatique, cochez **Corriger d'office** : Bobine envoie les échecs d'elle-même,
une fois par nouveau commit de la PR, et trois fois au plus. Décochée par défaut.

<a id="fusion-auto"></a>

## Fusionner quand tout est vert

Cochez **Fusionner quand tout est vert** : Bobine fusionne la PR dès qu'elle est prête, avec la
méthode que le dépôt permet (commit de fusion, squash ou rebase, affichée entre parenthèses).
Décochée par défaut.

« Prête » veut dire : PR ouverte, pas en brouillon, sans conflit, tous les contrôles réussis, et
aucun avis de relecture en attente ni de changements demandés.

C'est Bobine qui fusionne, pas GitHub : il faut que Bobine soit ouverte. Les deux cases ne sont pas
gardées quand vous relancez Bobine.

Une fois la PR fusionnée, **Nettoyer** apparaît dans la vue Git : voir
[Nettoyer](worktrees.md#nettoyer).

<a id="pousser"></a>

## Pousser de nouveaux commits

Tant que la PR est ouverte, **Ouvrir une PR** devient **Pousser vers la PR** : un clic pousse les
nouveaux commits de la branche. Le bouton disparaît quand tout est poussé.
