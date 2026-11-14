# ADR-0049 — Touches de thème : dégradés, lueur et verre, comme des jetons vérifiés

- **Statut** : accepté (maquettes v3 « Touches légères » validées par l'utilisateur le 14/11/2026)
- **Date** : 2026-11-14

## Contexte

L'ADR-0027 fait des thèmes une liste fermée de **couleurs** dans `src/shared/themes.ts`, chacune
vérifiée par un test de contraste. Le thème Aurore (fiche 226), qui remplace Sépia, ajoute un peu
de décor : une lueur en haut de la barre latérale, des dégradés doux (bulle de l'utilisateur,
action principale, conversation active, liseré de la saisie au focus, fonds à 1–2 % de
luminosité), une ombre teintée sous les cartes qui attendent une décision, et du verre dépoli
(`backdrop-filter`) sur ce qui flotte. Ce ne sont plus des couleurs unies : on sort un peu du
cadre de l'ADR-0027, sans vouloir perdre ce qui le justifie (pas de couleur non vérifiée).

## Décision

- **Les touches sont des jetons**, dans la même source (`src/shared/theme-aurora.ts`, lu par
  `themes.ts`) : des couleurs et des opacités, jamais des chaînes CSS écrites à la main. Le
  générateur en tire des variables `--touch-*` et `--glass-*`. Dans les autres thèmes, ces
  variables sont **neutres** (`none`, `var(--surface)`, `var(--shadow)`…) : le CSS les lit
  partout, et rien ne change pour Clair, Sombre, Nuit noire ou Fjord.
- **Le test de contraste mesure ce qui est vraiment sous le texte** : les deux extrémités de
  chaque dégradé ; la lueur composée en tout point de la barre latérale, sous les feux, pour trois
  largeurs de barre ; le verre composé sur le contenu flouté qu'il recouvre (le fond plus 20 % de
  texte, méthode des maquettes). Une touche qui échoue ne se publie pas.
- **Le verre seulement sur ce qui flotte** (menus, popovers, Réglages) : jamais sur un panneau fixe
  ni sur un message du fil. Aucun dégradé animé, aucun `backdrop-filter` sur ce qui défile.
- **Repli sans réglage** : avec « Réduire la transparence » ou « Augmenter le contraste » de macOS
  (`prefers-reduced-transparency: reduce`, `prefers-contrast: more`), le verre devient opaque, la
  lueur disparaît et les dégradés deviennent unis (la couleur de leur départ ; les fonds de base
  reprennent la couleur de la palette).
- **Pas d'image ni de SVG de fond.** Le décor reste du CSS (`linear-gradient`,
  `radial-gradient`, `box-shadow`, `backdrop-filter`).

## Alternatives écartées

- **Écrire le décor directement dans `styles.css`** — plus court, mais plus rien ne vérifierait le
  contraste du texte posé sur un dégradé ou sous la lueur : c'est exactement ce que l'ADR-0027
  voulait éviter.
- **Un réglage « Effets »** (marche/arrêt du décor) — un réglage de plus pour un cas que macOS
  couvre déjà par ses options d'accessibilité.
- **Verre partout (version 2 des maquettes : fond aurore, panneaux en verre)** — jugé « trop
  coloré partout », coûteux au rendu (flou recalculé sur de grandes surfaces), contrastes minces.
- **Deux dosages livrés (« légères » et « marquées »)** — l'utilisateur a retenu « légères » seul.

## Conséquences

- Ajouter une touche : des couleurs dans `AURORA_TOUCHES`, une valeur neutre pour les autres
  thèmes, une ligne dans `aurora.css`, et le test dit ce qui ne passe pas.
- `aurora.css` ne contient aucune couleur ; un nouveau composant flottant dit s'il prend le verre
  (`--glass-*`) ou non.
- Le liseré de la saisie au focus est décoratif (le curseur dit le focus) : il n'a pas de seuil de
  contraste, comme l'ancienne bordure au focus de la saisie n'en avait pas.
- À surveiller : le coût du `backdrop-filter` à l'ouverture des menus sur un Mac modeste ; le
  rendu de `prefers-reduced-transparency` dépend de Chromium (présent dans Electron 45).
