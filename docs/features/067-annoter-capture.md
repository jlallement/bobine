# 067 — Annoter une image avant de l'envoyer

- **Statut** : fait
- **Dépend de** : 005, 062, 066
- **Agents** : les deux (l'image annotée reste une image jointe)

## Pourquoi

Une capture montre tout l'écran ; il faut encore dire où regarder (« ce bouton-là », « cet écart »).
Entourer, flécher ou écrire sur l'image avant de l'envoyer le dit sans phrase, et l'agent le voit.

## Critères d'acceptation

- [x] Un clic sur une image jointe (zone de saisie, fenêtre rapide) ouvre l'annotation : rectangle,
      flèche, crayon, texte ; quatre couleurs (rouge par défaut) ; « Annuler le dernier » (⌘Z),
      « Tout effacer ».
- [x] « Appliquer » remplace l'image jointe par l'image annotée, à sa taille d'origine (traits
      proportionnés à l'image) ; « Fermer » ou Échap ne change rien.
- [x] Image annotée en PNG, en JPEG si elle dépasse la taille d'une pièce jointe.
- [x] Fenêtre rapide : elle s'agrandit le temps de l'annotation.
- [x] Testé : unitaire (formes, flèche, passage écran → image, dessin vérifié sur un contexte
      simulé, annuler) ; e2e (capture simulée, rectangle et flèche à la souris, texte, appliqué :
      image changée, mêmes dimensions ; fermer sans appliquer), captures clair / sombre.

## Plan

1. `renderer/annotation.ts` : formes (`rect`, `arrow`, `pen`, `text`), passage des coordonnées de
   l'écran à l'image, pointe de flèche, `drawShapes(ctx, formes)` (contexte 2D injecté).
2. `components/ImageAnnotator.tsx` : fenêtre Radix, canevas d'affichage (image à l'échelle de la
   fenêtre), outils et couleurs, saisie du texte en place, export à la taille de l'image
   (`toDataURL`).
3. Zone de saisie : clic sur une image jointe → annotation ; `useAttachments.replaceImage`.
4. Fenêtre rapide : même chose, fenêtre agrandie pendant l'annotation (hauteur max relevée).
5. e2e `annotate`.

Pas de nouvelle dépendance (canevas 2D).

## Journal

- 2026-10-15 — Fait selon le plan.
  - `annotation.ts` : formes en coordonnées de l'image, traits et texte proportionnés à sa
    largeur (lisibles une fois l'image réduite par l'agent), texte avec un contour blanc (lisible
    sur tout fond), un simple clic n'est pas une forme ; `drawShapes` sur un contexte 2D injecté
    (testé sur un contexte simulé : jsdom n'a pas de canevas).
  - `ImageAnnotator.tsx` : canevas d'affichage net (densité de l'écran), image jamais agrandie,
    saisie du texte en place (Entrée valide, Échap l'abandonne sans fermer), ⌘Z ; export au
    format d'origine par un canevas hors écran, PNG sinon JPEG 85.
  - Intégration : clic sur une image jointe (`attachment-annotate`, `quick-annotate`) ;
    `useAttachments.replaceImage` ; fenêtre rapide agrandie (hauteur max 680 px) le temps de
    l'annotation, ses touches ignorées pendant ce temps (la fenêtre d'annotation est dans un
    portail : ses évènements remontaient jusqu'à la carte, Entrée aurait envoyé le message).
  - **Défauts trouvés par l'e2e** : (1) avec l'outil texte, un clic sur l'image faisait perdre le
    focus au texte en cours, validé vide et effacé — le canevas ne prend plus le focus ; (2) à la
    réouverture, le canevas montrait un instant sa taille par défaut (300 × 150) avant l'image —
    caché jusqu'à ce qu'elle soit chargée (`data-ready` pour les essais).
  - Tests : unitaires (`annotation.test.ts`) ; e2e `annotate` (Échap sans changement ;
    rectangle, flèche, texte à la souris ; appliqué : image changée, mêmes dimensions ; fenêtre
    rapide agrandie puis revenue à sa taille). Captures regardées : `n0` (clair, sombre), `n1`
    (clair), `n2` (sombre).
- 2026-10-15 — **Retour de l'utilisateur : « plein de boutons qui ne fonctionnent pas »** dans
  l'annotation, ouverte depuis une image jointe. Cause : les barres du haut (en-tête de la
  conversation, barre latérale, panneau) sont des zones « déplaçables » (`-webkit-app-region:
  drag`) ; macOS prend les clics qui y tombent pour déplacer la fenêtre avant qu'ils n'atteignent
  la page, même sous une fenêtre de l'app. La barre d'outils de l'annotation (y 25 → 82 px)
  chevauche ces barres (0 → 52 px). Les e2e ne le voyaient pas : leurs clics passent par le CDP,
  directement à la page. Correction pour toutes les fenêtres et menus de l'app : voile, fenêtre et
  menus Radix en `no-drag` (placés après les barres dans la page, ils les annulent tant qu'ils
  sont ouverts) — vaut aussi pour la croix des Réglages dans une petite fenêtre. Et la vue native
  du navigateur intégré, posée par-dessus toute la page, se masque tant qu'une fenêtre de l'app est
  ouverte (sinon elle en prend les clics, panneau Navigateur ouvert). e2e : `annotate` (voile et
  fenêtre en `no-drag`, chevauchement de la barre constaté), `browser` (page native masquée sous
  les Réglages, puis réaffichée). Un essai à la vraie souris n'a pas pu être fait (deux instances
  d'Electron sous le même identifiant d'app) : à confirmer par l'utilisateur.
