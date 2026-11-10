# ADR-0031 — Une page de l'app dans la zone principale : « Mon activité »

- **Statut** : accepté
- **Date** : 2026-10-24

## Contexte

Le 23/10, la consommation de toutes les conversations a été rangée dans un onglet des réglages
(Réglages › Consommation, fiche 137 ; « Tranchées » de `docs/feuille-de-route-2026-10-23.md` :
« un onglet des réglages, pas une fenêtre à part »). À l'usage, le tableau y est à l'étroit (fenêtre
modale) et caché : Jérôme a validé le 24/10 une maquette qui en fait une page de la fenêtre
principale, façon GitHub (grille d'activité sur un an), ouverte depuis la barre latérale. Jusqu'ici,
la zone principale ne montrait qu'une conversation (ou l'accueil).

## Décision

La zone principale peut montrer une **page de l'app** à la place du fil et de la zone de saisie :
« Mon activité » est la première (fiche 144). Elle a sa ligne dans la zone fixe de la barre latérale
(en surbrillance tant qu'elle est ouverte), un raccourci du menu Fenêtre (⇧⌘U), son titre dans la
barre de titre sans menu de conversation, et elle se referme dès qu'une conversation s'ouvre
(`useActivityPage`, qui enveloppe `select`, `create` et `resumeSession`). Le panneau latéral et la
vue côte à côte restent disponibles. L'onglet Réglages › Consommation disparaît ; ce qui est une
action d'entretien (« Remettre à zéro… ») reste dans les réglages, dans Données. Les données ne
changent pas de chemin : le main calcule tout (`usage:*`), le renderer affiche.

## Alternatives écartées

- **Garder l'onglet des réglages** (décision du 23/10) — trop étroit pour une grille sur un an et
  un graphique lisible, et pas à portée de main.
- **Une fenêtre à part** — une fenêtre de plus à gérer (position, thème, focus, menu) pour une
  page qu'on consulte puis qu'on quitte ; la zone principale a déjà la place et la barre latérale.
- **Un onglet du panneau latéral** — le panneau suit la conversation active ; la consommation est
  celle de toutes.

## Conséquences

- Une page de l'app n'a pas de zone de saisie : tout ce qui suppose une conversation affichée
  (⌘F, sommaire, modifications) est masqué tant qu'elle est ouverte.
- Elle doit tenir dans une zone principale étroite (barre latérale et panneau ouverts) : mise en
  page par requêtes de conteneur, jamais de défilement horizontal de la page ; quand elle est
  ouverte, le panneau cède jusqu'à sa largeur minimale.
- Une prochaine page (par exemple des skills) suivra le même chemin : ligne dans la zone fixe,
  entrée de menu, refermée à l'ouverture d'une conversation.
- Remplace la ligne « Consommation : un onglet des réglages » des décisions du 23/10.
