# Plusieurs dossiers

Une conversation travaille dans un dossier, son dossier de travail. Vous pouvez donner à l'agent
d'autres dossiers en plus : une bibliothèque que votre app utilise, le serveur d'une app mobile, un
dépôt de documentation.

**Agents :** seulement ceux qui le prennent en charge. OpenCode (2.0.31 et plus) oui ; IBM Bob pas
pour l'instant. Voir [Agents](agents.md).

Ici, vous pouvez :

- [ajouter un dossier](#ajouter) ;
- [retirer un dossier](#retirer) ;
- connaître [les limites](#limites).

<a id="ajouter"></a>

## Ajouter un dossier

1. Ouvrez l'onglet **Session** du panneau de droite (⌘J si le panneau est fermé).
2. Dans **Environnement**, sur la ligne **Autres dossiers**, au choix :
   - tapez ou collez le chemin du dossier dans le champ **Chemin d'un dossier…**, puis ↩ (ou
     **Ajouter ce dossier**) ; un chemin part de la racine, ou de `~` pour votre dossier
     personnel ;
   - glissez un dossier sur le champ (« Déposer pour ajouter ») ;
   - ou cliquez sur **Choisir un dossier…** : la fenêtre de choix s'ouvre dans le dossier qui
     contient celui de la conversation ; choisissez le dossier, puis **Ajouter**.

Un seul dossier à la fois. Un lien vers un dossier est suivi : c'est le dossier réel qui est
ajouté et montré. Bobine refuse, en disant pourquoi sous le champ, un dossier trop large (votre
dossier personnel, tout dossier qui le contient, la racine d'un disque), le dossier de travail ou
un dossier qu'il contient (l'agent y a déjà accès), un dossier déjà dans la liste, et un chemin
qui ne mène à aucun dossier.

Le dossier apparaît dans **Autres dossiers**. La session de l'agent repart aussitôt avec la
nouvelle liste ; le fil de la conversation est gardé. Avec votre message suivant, Bobine dit à
l'agent quels dossiers il a en plus.

La ligne « Autres dossiers » n'apparaît qu'une fois l'agent démarré, et seulement s'il prend en
charge plusieurs dossiers. Pendant que l'agent répond (ou démarre), le champ est en lecture seule et
ses boutons, comme la croix, attendent la fin de son tour ; le survol, ou le focus au clavier, dit
pourquoi.

<!-- si: finder -->
Un clic sur le nom d'un dossier l'affiche dans le Finder.
<!-- si: !finder !explorer
Un clic sur le nom d'un dossier l'affiche dans le gestionnaire de fichiers.
-->
<!-- si: explorer
Un clic sur le nom d'un dossier l'affiche dans l'Explorateur de fichiers.
-->

<a id="retirer"></a>

## Retirer un dossier

Cliquez sur la croix à droite du dossier. La session repart sans lui, et l'agent l'apprend avec
votre message suivant.

<a id="limites"></a>

## Limites

- Les mentions `@` et les pièces jointes ne proposent que les fichiers du dossier de travail.
- L'onglet Modifications ne suit que le dossier de travail. L'onglet
  [Fichiers](panneaux.md#fichiers), lui, montre aussi les autres dossiers.
- Les autres dossiers ne passent ni aux branches (« Repartir de ce message ») ni aux travaux
  délégués.
- Si vous passez la conversation à un agent qui ne prend pas plusieurs dossiers, la liste reste
  affichée en grisé, avec « Non transmis : … ».
