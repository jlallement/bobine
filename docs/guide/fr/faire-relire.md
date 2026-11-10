# Faire relire

Avant de fusionner, faites relire le travail par un autre agent. Le relecteur lit les
modifications sans rien changer : les erreurs d'abord, puis ce qui se simplifie. Ses remarques
arrivent sur les lignes du diff, avec leur gravité. Vous gardez celles qui servent et les envoyez
à la conversation relue, comme vos propres remarques.

Il faut un dossier dans un dépôt git, avec des modifications.

Ici, vous pouvez :

- [lancer une relecture](#lancer) ;
- [lire ses remarques](#remarques) ;
- [envoyer les remarques à l'agent](#envoyer) ;
- savoir [ce que fait le relecteur](#relecteur).

<a id="lancer"></a>

## Lancer une relecture

1. Ouvrez l'onglet **Modifications** (⇧⌘D).
2. Cliquez sur l'icône **Faire relire…** (une loupe sur un cadre, dans la barre des vues).
   Pour relire une fille depuis sa mère : vue **Filles**, la même icône sur sa ligne.
3. Le dialogue dit ce qui sera relu :
   - dans un worktree, tout le travail de la branche (commits et modifications non commitées) ;
   - sinon, les modifications non commitées du dossier.
4. Si vous voulez, précisez les **Points à surveiller** (par exemple « la gestion des erreurs
   réseau »).
5. Choisissez l'**Agent** et, quand il le permet, le **Modèle** : ceux de la conversation relue
   sont proposés. Un autre agent, ou un autre modèle, donne un regard différent.
6. Cliquez sur **Lancer la relecture** (ou ⌘↩).

La relecture est une conversation de plus, « Relecture : … », rangée comme une fille : elle coûte
comme telle, et compte dans le plafond des conversations filles. Son coût s'affiche sur sa carte et
sur sa ligne.

On ne peut pas faire relire une conversation qui répond encore, une relecture, un brouillon ou une
conversation archivée.

<a id="remarques"></a>

## Lire les remarques

Dans le fil de la conversation relue, une carte **Relecture** suit le relecteur : « Relecture en
cours par … », puis le nombre de remarques (dont le nombre de gravité haute), son avis général et
son coût.

- **Voir sur le diff** ouvre la vue Git : chaque remarque est posée sur ses lignes, avec sa
  gravité **Haute**, **Moyenne** ou **Basse**.
- La liste **Remarques de la relecture**, au-dessus des fichiers, les reprend toutes, même celles
  d'un fichier déjà commité. Un clic montre la remarque sur son diff ; ✕ la retire.
- **Ouvrir la relecture** ouvre la conversation du relecteur, avec sa réponse complète.

Une remarque se modifie ou se supprime comme les vôtres.

Une relecture lancée depuis la vue **Filles** de la mère pose sa carte et ses remarques dans la
**fille** relue : ouvrez la fille pour les lire.

<a id="envoyer"></a>

## Envoyer les remarques à l'agent

Retirez les remarques qui ne servent pas, puis cliquez sur **Envoyer à l'agent** dans la barre des
remarques. Elles partent en un message à la conversation relue, chacune avec son fichier, ses
lignes, sa gravité et le code cité. L'agent garde son contexte et corrige.

**Effacer les remarques** les retire toutes sans rien envoyer.

<a id="relecteur"></a>

## Ce que fait le relecteur

- Il travaille dans le dossier de la conversation relue, sans worktree ni branche.
- Il a pour consigne de ne rien modifier, créer, supprimer ni committer, et de ne lancer que des
  commandes de lecture.
- Bobine vérifie que le dossier n'a pas changé pendant la relecture. S'il a changé (par le
  relecteur, par la conversation relue ou par vous), la carte le dit : vérifiez la vue Git, les
  lignes citées ont pu bouger. Bobine ne défait rien.
- S'il finit sans remarques structurées, la carte le dit, et sa réponse est dans son fil.

**Agents :** les deux. Avec IBM Bob, pas de choix du modèle. Selon ses réglages, OpenCode peut
écrire sans demander d'autorisation : la consigne et la vérification de Bobine sont alors les
seules gardes.
