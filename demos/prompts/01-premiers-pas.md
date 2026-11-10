# 1 — Premiers pas

## 1.1 Le tour du projet, en diagramme

**Montre** : la lecture du projet, un diagramme Mermaid dessiné dans le fil, les liens vers les
fichiers (un `.md` s'ouvre en aperçu, un `.html` dans le navigateur intégré).

```text
Fais le tour de ce projet et explique-le-moi en cinq lignes, avec un diagramme Mermaid qui montre ses parties et comment chacune se lance.
```

**À regarder** : le diagramme rendu dans la réponse ; un clic sur `site/index.html` ouvre la page à
côté du fil.

## 1.2 Une modification, puis l'annuler

**Montre** : la carte d'autorisation avec le diff, l'onglet Modifications, le retour en arrière.

```text
Dans README.md, ajoute une section « Horaires » : du lundi au samedi de 8 h à 19 h, le dimanche de 9 h à 13 h.
```

**À regarder** : avec Bob, « Autoriser cette modification ? » et le diff ; l'onglet Modifications
du panneau (`README.md +N`) ; « Annuler » remet le fichier dans son état d'avant.

## 1.3 Des questions à choix avant d'agir

**Montre** : l'agent vous interroge par un questionnaire de Bobine, puis applique vos réponses et
vous montre le résultat.

```text
Avant de toucher au style du site, pose-moi trois questions à choix avec l'outil ask_user de Bobine : la couleur principale, la forme des boutons et la taille du texte. Ensuite applique mes réponses dans site/style.css, lance le site avec preview_start et montre-moi la boutique avec une capture.
```

**À regarder** : le questionnaire (touches 1 à 9, flèches, Entrée) ; le serveur du site dans la
barre au-dessus de la zone de saisie ; la capture sous la carte de l'outil.

## 1.4 La liste de tâches épinglée

**Montre** : le plan de l'agent épinglé au-dessus de la zone de saisie, coché au fil du travail.

```text
Fais d'abord une liste de tâches et coche chaque étape quand elle est faite : 1) lancer le site avec preview_start ; 2) ouvrir chaque page du site dans le navigateur de Bobine ; 3) prendre une capture de chacune ; 4) me dire en une phrase par page ce qu'on y voit.
```

**À regarder** : « Tâches 0 / 4 » puis 1 / 4… ; à la fin, la carte « Plan » revient dans le fil.
Avec Bob, chaque mise à jour de la liste demande votre accord. OpenCode 2 n'a pas de liste de
tâches.
