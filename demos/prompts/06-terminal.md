# 6 — Terminal et serveur

Le terminal du panneau est partagé : l'agent y lance ses commandes (après votre accord), vous y
voyez la sortie en direct et pouvez y taper vous-même.

## 6.1 Les tests dans le terminal partagé

```text
Lance les tests du dossier calculs dans le terminal de Bobine (python3 -m unittest discover -s calculs -v), lis la sortie, corrige ce qui échoue et relance-les jusqu'à ce qu'ils passent.
```

**À regarder** : la carte « L'agent veut lancer dans le terminal » (Lancer, Toujours dans ce
projet, Refuser) ; deux tests en échec, la correction, puis cinq tests verts dans l'onglet
Terminal.

## 6.2 Le serveur du site et ses journaux

```text
Lance le site avec preview_start, ouvre dans le navigateur une page qui n'existe pas (/menu-du-jour.html), puis montre-moi ce que le serveur a écrit dans ses journaux (preview_logs). Crée ensuite cette page dans le style du site, avec trois plats du jour, et montre-la-moi.
```

**À regarder** : le serveur dans la barre au-dessus de la zone de saisie (arrêt, journaux) ; la
ligne « 404 » des journaux ; la nouvelle page dans le navigateur.

## 6.3 Vous tapez, l'agent explique

Avant : dans l'onglet Terminal, tapez vous-même `python3 -m unittest discover -s calculs`.

```text
@terminal explique-moi ces échecs en deux phrases, sans rien corriger.
```

**À regarder** : `@terminal` joint la sortie du terminal au message.
