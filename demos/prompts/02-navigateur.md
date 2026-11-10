# 2 — Le navigateur intégré

L'agent ouvre les pages dans le navigateur du panneau latéral : vous le voyez cliquer, taper,
défiler, et vous pouvez reprendre la main à tout moment.

## 2.1 Tester la boutique comme un client

**Montre** : clics, lecture de la page, capture, puis correction et nouvel essai.

```text
Lance le site avec preview_start, ouvre la boutique dans le navigateur de Bobine, ajoute un café et un croissant au panier, puis dis-moi si le total affiché est juste. Montre-moi une capture du panier.
```

Puis, dans la même conversation :

```text
Corrige le calcul, recharge la page et refais le même panier pour le prouver.
```

**À regarder** : le total affiché (2,50 €) au lieu de 4,30 € ; après la correction, le même
parcours rejoué et la nouvelle capture.

## 2.2 Console et réseau

**Montre** : l'agent lit la console et les requêtes réseau de la page, comme les outils de
développement d'un navigateur.

```text
Dans la boutique, ajoute un produit puis clique sur « Commander ». Il ne se passe rien à l'écran : regarde la console et le réseau du navigateur de Bobine et explique-moi pourquoi. Fais ensuite en sorte que le client voie un message clair quand la commande ne passe pas, et vérifie-le.
```

**À regarder** : `browser_console` (une erreur `SyntaxError`), `browser_network`
(`POST /api/commandes` → 501) ; le message affiché après la correction.

## 2.3 Remplir un formulaire

**Montre** : saisie dans les champs, case à cocher, envoi, lecture des messages d'erreur.

```text
Ouvre la page d'inscription du site et remplis le formulaire : prénom Camille, adresse camille.martin@exemple.fr, un mot de passe de dix caractères, âge 34 ; coche le règlement et envoie. Dis-moi ce qui se passe. Si c'est un bug, corrige-le et refais l'essai.
```

**À regarder** : « Adresse e-mail invalide » pour une adresse correcte ; la vérification corrigée,
puis « Bienvenue, Camille ! ».

## 2.4 Sur un téléphone et en mode sombre

**Montre** : l'émulation d'une taille d'écran et du mode sombre, sans quitter Bobine.

```text
Regarde la boutique et la page d'inscription comme sur un téléphone (375 px de large) puis en mode sombre, avec browser_resize et une capture à chaque fois. Fais-moi la liste de ce qui ne va pas, du plus gênant au moins gênant, sans rien corriger.
```

**À regarder** : les produits qui débordent de l'écran ; les libellés du formulaire presque
invisibles en mode sombre.

## 2.5 Vous cliquez, l'agent vérifie

**Montre** : le navigateur est partagé : ce que vous faites dans le panneau, l'agent le voit.

Avant : dans le navigateur du panneau, ajoutez vous-même trois cookies et un thé au panier.

```text
J'ai rempli le panier moi-même dans le navigateur. Vérifie le total ligne par ligne et dis-moi s'il est juste.
```
