# 7 — Simulateur iOS

Il faut Xcode et un simulateur (essayé avec l'iPhone Air, iOS 26). L'onglet Simulateur montre
l'appareil en direct ; vous pouvez y cliquer et y glisser à la souris.

## 7.1 Compiler, lancer, essayer

```text
Compile l'app iOS du projet avec ios_build, lance-la sur le simulateur, puis touche « Ajouter » deux fois. Le compteur sous le titre suit-il le nombre de pastilles ? Fais une planche contact du deuxième tap avec ios_filmstrip.
```

**À regarder** : la compilation (une à deux minutes la première fois) ; l'app qui démarre dans
l'onglet Simulateur ; « 3 pastilles » alors qu'il y en a cinq ; la planche contact sous la carte.

## 7.2 Corriger et prouver

Dans la même conversation :

```text
Corrige le compteur de l'app iOS et rends le bouton « Mélanger » lisible. Recompile, relance, et prouve que c'est réglé avec une planche contact d'un tap sur « Ajouter ».
```

## 7.3 Les Réglages de l'iPhone, sans compiler

```text
Démarre le simulateur iPhone Air avec ios_boot, ouvre l'app Réglages (bundle com.apple.Preferences) avec ios_launch, lis l'écran avec ios_describe, touche « Général », puis fais une planche contact avec ios_filmstrip d'un balayage vers le haut au milieu de l'écran. Décris en deux phrases ce que tu vois.
```

## 7.4 Le site dans Safari

```text
Lance le site avec preview_start, puis ouvre la boutique dans Safari sur le simulateur avec ios_open_url (http://localhost:8765/boutique.html). Fais une capture : la page tient-elle dans la largeur de l'iPhone ?
```
