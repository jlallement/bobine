# 4 — Annoter une capture

Vous montrez à l'agent ce que vous voulez dire en dessinant sur l'image avant de l'envoyer.

**Joindre une image** :

- une page du navigateur : bouton « Joindre cette page au message » de l'onglet Navigateur ;
- l'écran du simulateur ou de l'émulateur : « Joindre cet écran au message » de leur onglet ;
- n'importe quelle zone du Mac : bouton « Capture d'écran » de la zone de saisie (glisser pour
  choisir une zone, Espace pour une fenêtre, Échap pour annuler) ;
- ou coller, glisser une image.

**Annoter** : cliquer sur la vignette jointe (« Annoter l'image ») : Rectangle, Flèche, Crayon,
Texte, quatre couleurs, ⌘Z pour annuler le dernier trait, puis « Appliquer ».

## 4.1 Quelle forme ?

Avant : ouvrez la page Formes dans le navigateur (après avoir lancé le site :
http://localhost:8765/formes.html), joignez la page et entourez une des six formes.

```text
Sur l'image jointe, j'ai entouré une des six formes. Laquelle ? Donne sa forme et sa couleur, et dis-moi où elle se trouve sur la page.
```

## 4.2 Des remarques dessinées

**Montre** : une relecture de maquette faite au crayon, appliquée par l'agent.

Avant : ouvrez la boutique, joignez la page, puis dessinez : une flèche vers le titre et le texte
« plus grand » ; un rectangle autour de « Commander » et le texte « en vert » ; une croix au crayon
sur le cookie et le texte « à retirer ».

```text
J'ai dessiné mes remarques sur la capture de la boutique. Applique-les toutes, puis montre-moi le résultat avec une capture.
```

## 4.3 Le bug entouré

Avant : dans le navigateur, ajoutez vous-même un café et un croissant ; joignez la page, entourez
le total et écrivez « faux ».

```text
J'ai entouré un problème sur la capture. Trouve la cause dans le code, corrige-la, puis vérifie dans le navigateur en refaisant le même panier.
```

## 4.4 Sur l'iPhone

Avant : l'app Pastilles tourne sur le simulateur (démo 7.1). Dans l'onglet Simulateur : « Joindre
cet écran au message », puis un rectangle autour du bouton « Mélanger ».

```text
Le bouton que j'ai entouré est presque illisible. Corrige l'app iOS, recompile-la, relance-la et montre-moi une capture du résultat.
```

Même chose sur Android depuis l'onglet de l'émulateur, avec « l'app Android ».

## 4.5 N'importe quelle fenêtre du Mac

Avant : autorisation « Enregistrement de l'écran » donnée à Bobine. Bouton « Capture d'écran » de
la zone de saisie, choisissez une zone (un graphique, un message d'erreur, une page d'une autre
app), puis annotez.

```text
Explique-moi ce que j'ai entouré sur cette capture et ce que je devrais en retenir.
```
