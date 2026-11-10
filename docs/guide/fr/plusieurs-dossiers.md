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
2. Dans **Environnement**, sous « Dossier », cliquez sur **Ajouter un dossier…**.
3. Choisissez le dossier, puis **Ajouter**.

Le dossier apparaît dans **Autres dossiers**. La session de l'agent repart aussitôt avec la
nouvelle liste ; le fil de la conversation est gardé. Avec votre message suivant, Bobine dit à
l'agent quels dossiers il a en plus.

La ligne « Autres dossiers » n'apparaît qu'une fois l'agent démarré, et seulement s'il prend en
charge plusieurs dossiers. Pendant que l'agent répond, l'ajout et le retrait attendent la fin de sa
réponse.

Un clic sur le nom d'un dossier l'affiche dans le Finder.

<a id="retirer"></a>

## Retirer un dossier

Cliquez sur la croix à droite du dossier. La session repart sans lui, et l'agent l'apprend avec
votre message suivant.

<a id="limites"></a>

## Limites

- Les mentions `@` et les pièces jointes ne proposent que les fichiers du dossier de travail.
- L'onglet Modifications ne suit que le dossier de travail.
- Les autres dossiers ne passent ni aux branches (« Repartir de ce message ») ni aux conversations
  filles.
- Si vous passez la conversation à un agent qui ne prend pas plusieurs dossiers, la liste reste
  affichée en grisé, avec « Non transmis : … ».
