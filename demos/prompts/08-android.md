# 8 — Émulateur Android

Il faut Android Studio et un émulateur (essayé avec `Medium_Phone_API_36.0`) qui a de la place
libre : si l'installation échoue avec « not enough space », Android Studio › Device Manager › ⋮ ›
Wipe Data (efface les données de l'émulateur). La première compilation se fait hors ligne si
Android Studio a déjà compilé un projet sur ce Mac (Gradle 9.1, plugin Android 8.11.1).

## 8.1 Compiler, lancer, essayer

```text
Compile l'app Android du projet avec android_build, lance-la sur l'émulateur (package fr.bobine.pastilles), puis touche « Ajouter » deux fois. Le compteur sous le titre suit-il le nombre de pastilles ? Fais une planche contact du deuxième tap avec android_filmstrip.
```

**À regarder** : l'émulateur qui démarre dans son onglet ; « 3 pastilles » alors qu'il y en a
cinq ; la planche contact.

## 8.2 Le journal de l'app

```text
Ajoute dans l'app Android une ligne de journal (Log.i, étiquette « Pastilles ») à chaque tap sur « Ajouter », avec le nombre de pastilles. Recompile, relance, touche deux fois « Ajouter » et montre-moi ces lignes avec android_logcat.
```

## 8.3 Les Paramètres d'Android, sans compiler

```text
Démarre l'émulateur Android avec android_boot (rappelle-le tant qu'il démarre), ouvre les Paramètres (package com.android.settings) avec android_launch, puis fais une planche contact avec android_filmstrip d'un balayage vers le haut au milieu de l'écran. Décris en deux phrases ce que tu vois.
```

## 8.4 Le site dans Chrome

```text
Lance le site avec preview_start, puis ouvre la boutique dans Chrome sur l'émulateur avec android_open_url (http://10.0.2.2:8765/boutique.html). Si Chrome affiche son écran d'accueil, passe-le. Fais une capture : la page tient-elle dans la largeur du téléphone ?
```
