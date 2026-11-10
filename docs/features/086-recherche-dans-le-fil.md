# 086 — Chercher dans la conversation ouverte (⌘F)

- **Statut** : fait
- **Dépend de** : 026, 040, 046
- **Agents** : les deux — interface seulement

## Pourquoi

Sur un long fil, retrouver une erreur, un nom de fichier ou une réponse de l'agent oblige à faire
défiler à l'œil. ⌘F, présent partout ailleurs, ne fait rien dans Bobine (feuille de route de
l'utilisateur, 2026-10-19).

## Existant

- ⌘F n'est lié à rien (ni menu, ni rôle « Find » d'Electron).
- ⌘K (fiches 026, 046) cherche dans les titres et le contenu de toutes les conversations, et
  ouvre celle choisie, sans aller au passage trouvé.
- Le fil est rendu en entier (pas de fenêtrage) ; le détail des outils est replié dans leurs
  cartes et groupes (« 8 actions dans le navigateur »), donc absent de la page tant qu'il est
  fermé.
- Le plan annoté (fiche 040) surligne des passages avec l'API de surlignage CSS
  (`CSS.highlights`) : rien n'est ajouté au DOM.

## Options à trancher

1. **Moyen** : la recherche intégrée de Chromium (`findInPage` d'Electron : surlignage natif, mais
   dans toute la fenêtre — barre latérale, panneau, zone de saisie — et sans style propre) ; ou
   une barre à nous, limitée au fil, insensible à la casse et aux accents, surlignage par
   `CSS.highlights` comme le plan.
2. **Détail des outils replié** : chercher seulement ce qui est affiché ; ou aussi dans les cartes
   repliées (sorties de commandes, résultats), en ouvrant celle qui contient le résultat courant.
3. **Lien avec ⌘K** : une conversation ouverte depuis un résultat trouvé dans son contenu ouvre
   ⌘F avec les mêmes mots, sur le premier résultat.

**Décisions de l'utilisateur (2026-10-20)**, comme proposé : une barre à nous, limitée au fil ;
seulement ce qui est affiché (≈ ½ jour ; les cartes repliées, ≈ 1 jour de plus, plus tard si
besoin) ; ⌘K relié à ⌘F.

## Critères d'acceptation

- [x] ⌘F (menu Édition › Rechercher…) ouvre une barre en haut à droite du fil, champ prêt à
      saisir ; Échap ou ✕ la ferme et retire le surlignage.
- [x] Résultats insensibles à la casse et aux accents, surlignés dans le fil ; le courant plus
      marqué, amené au centre ; compteur « 3 / 7 » ou « Aucun résultat ».
- [x] Entrée / ⌘G : suivant ; ⇧Entrée / ⇧⌘G : précédent (en boucle).
- [x] Les résultats suivent le fil qui change (réponse en cours, autre conversation).
- [x] ⌘K : une conversation trouvée par son contenu s'ouvre avec ⌘F rempli, sur le premier
      résultat.
- [x] Textes en français et en anglais.
- [x] Testé : unitaires (correspondances, accents) ; e2e (⌘F, compteur, suivant, Échap, ⌘K → ⌘F) ;
      essai à la vraie souris et au vrai clavier.

## Plan

- `src/renderer/src/thread-find.ts` (+ test) : texte replié (minuscules, sans accents) avec la
  correspondance vers le texte d'origine ; correspondances d'une recherche.
- `src/renderer/src/useThreadFind.ts` : nœuds de texte du fil, `Range` de chaque résultat,
  surlignage `CSS.highlights` (`thread-find`, `thread-find-current`), défilement.
- `FindBar.tsx` ; `App.tsx` : état de la barre, commandes du menu ; `SearchDialog.tsx` :
  `onSelect(id, query)` pour un résultat trouvé dans le contenu.
- `shortcuts.ts` : `find` (⌘F), `find-next` (⌘G), `find-previous` (⇧⌘G), menu Édition (`menu.ts`).
- `styles.css`, `fr.json`, `en.json` ; e2e `history.mjs`.

## Journal

- 2026-10-20 — Fiche créée : état des lieux et options.
- 2026-10-20 — Fait comme prévu. `thread-find.ts` (+ test : casse, accents précomposés ou écrits à
  part, ligatures, recherche vide, résultats sans chevauchement), `useThreadFind.ts` (texte affiché
  du fil — nœuds visibles seulement, `checkVisibility` —, plages, `CSS.highlights`, résultat courant
  amené au centre ; recalcul 150 ms après le dernier changement du fil ; compteur vide tant que la
  recherche tapée n'est pas calculée), `FindBar.tsx`, commandes `find`, `find-next`,
  `find-previous` dans le menu Édition, ⌘K → ⌘F.
  - Écart : la barre ⌘K → ⌘F s'ouvre une fois la conversation affichée (fil chargé) ; ouverte tout
    de suite, la zone de saisie, recréée en arrivant, lui reprenait le clavier.
  - Le compilateur React refuse l'état modifié directement dans un effet : le compte se déduit au
    rendu, l'état ne change que dans le minuteur ou par les actions.
  - e2e `history` : ⌘K « redis SATURE » → conversation ouverte avec ⌘F rempli, « 1 / 1 », résultat
    courant surligné, clavier dans la barre ; « PÔINTE » trouve « pointe » ; Échap retire le
    surlignage ; Édition › Rechercher… rouvre sur la dernière recherche ; Entrée / ⇧Entrée entre
    plusieurs résultats. Capture `93-recherche-fil`.
  - Essai au vrai clavier (app d'essai, agent factice) : ⌘F (raccourci du menu), saisie, « 1 / 5 »,
    Entrée, ⇧Entrée, ⌘G, Échap. Il a montré « Aucun résultat » un instant pendant la frappe :
    corrigé (compteur vide tant que le calcul n'est pas fait).
  - Hors de cette fiche : chercher aussi dans le détail replié des outils (≈ 1 jour).
