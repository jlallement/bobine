# 294 — Zone de saisie alignée sur le fil, texte à la taille du message envoyé

- **Statut** : proposé — maquette à valider, rien de codé
- **Dépend de** : 159 (taille du texte de la conversation, mode présentation), 092 (repli de la
  barre de la saisie), 167 (hauteur de la saisie qui suit la largeur), 173 (rien ne fait défiler le
  fil de côté)
- **Agents** : les deux — purement visuel, rien de propre à un agent

## Pourquoi

Après usage réel de la 1.2.0-rc.2, Jérôme : « la zone de prompt est un peu étroite et on écrit un
peu gros à l'intérieur ». Avec la capture d'une autre application : « la zone de saisie prend la
largeur du fil mais sans compter les icônes sur les côtés, si bien que quand on tape, on tape dans
la largeur du fil ». Sur la taille, il a choisi « comme le message envoyé » : le texte tapé prend
la taille de la bulle envoyée et suit le réglage de taille de la conversation.

Aujourd'hui (mesuré sur l'app réelle, `34f9f5be`) : le cadre de la saisie a la largeur de la
colonne du fil et le texte tapé y est en retrait de 17 px de chaque côté (16 px de marge intérieure
et 1 px de bord) ; il est en 15 px fixes, quand la bulle envoyée est en `--conv-size − 1` (14 px
par défaut, 11 à la taille 12, 21 à la taille 22).

| Cadrage (fenêtre 1 280 × 820, agent factice) | Bord gauche texte agent | Bord gauche texte tapé | Bord droit colonne (bulles) | Bord droit texte tapé |
|---|---|---|---|---|
| Largeur normale (740) | 444 | 461 (+17) | 1 136 | 1 119 (−17) |
| Largeur étroite (640) | 494 | 511 (+17) | 1 086 | 1 069 (−17) |
| Largeur large (960) | 334 | 351 (+17) | 1 246 | 1 229 (−17) |
| Fenêtre de 760 px | 284 | 301 (+17) | 736 | 719 (−17) |
| Panneau de droite ouvert | 324 | 341 (+17) | 936 | 919 (−17) |

Texte tapé : 15 px / 22,5 px à toutes les tailles ; bulle : 14/21 (défaut), 11/16,5 (taille 12),
21/31,5 (taille 22).

## Maquette

`docs/maquettes/294-zone-de-saisie.html` (autonome, clair et sombre, case « Montrer les repères »
pour tracer les bords de la colonne). Captures dans `docs/maquettes/294/` :

- `app-avant-*.png` : l'app réelle avant (normale clair et sombre, étroite, large, fenêtre étroite,
  panneau de droite), sans annotation ;
- une planche par cadrage, « avant » puis « après » au même cadrage : `normale-clair.png`,
  `normale-sombre.png`, `etroite-clair.png`, `large-clair.png`, `fenetre-etroite-clair.png`,
  `panneau-clair.png`, `taille-22-clair.png`, `taille-12-clair.png`, `accueil-clair.png` ;
- la paire avec repères : `normale-reperes-clair.png` ;
- les trois choix : `choix-barre-clair.png`, `choix-autour-clair.png`, `choix-debord-clair.png`.

Mesuré dans la maquette (Chromium d'Electron) : après, bord gauche du texte tapé = bord gauche du
texte de l'agent et bord droit = bord droit des bulles, à 0 px, aux trois largeurs, en fenêtre
étroite et panneau ouvert ; cadre à 7 px du bord de la zone quand la colonne la remplit ; aucun
défilement de côté.

## Proposition

1. **Alignement.** Le bloc de la saisie (`.composer-dock` : cadre, menus « / » et « @ », panneau
   de blocage, ligne du dossier) déborde de la colonne, de chaque côté, de la marge intérieure du
   cadre plus son bord (17 px). Le texte tapé occupe alors exactement la colonne du fil. Le débord
   reste toujours dans la gouttière de la colonne (24 px, constante) : le cadre garde au moins 7 px
   jusqu'au bord de la zone, aucun défilement de côté, et rien ne dépend de la largeur de la
   fenêtre.
2. **Taille.** Le texte tapé et l'invite prennent la taille et l'interligne de la bulle envoyée :
   `calc(var(--conv-size) - 1px)`, interligne 1,5 ; ils suivent le réglage (12 à 22) et le mode
   présentation.
3. **Ce qui ne bouge pas** : la barre d'icônes reste dans le cadre, sous le texte, avec ses marges
   (elle se déplace avec le cadre, donc reste alignée sur le texte) ; les avis et cartes du fil
   restent à la largeur de la colonne ; la saisie rapide (fenêtre à part, fiche 062) n'est pas
   touchée.
4. **Modification d'un message envoyé** (`.msg-user-edit`) : pas alignée comme la saisie. C'est une
   bulle en cours de modification, dans le fil : elle a déjà la taille de la bulle et la largeur de
   la colonne, comme les bulles ; la faire déborder la mettrait dans la gouttière du fil, que la
   fiche 173 coupe (`overflow-x: clip`). Pas de planche.

## Questions pour Jérôme

1. **Barre d'icônes** — A (recommandée) : elle suit le cadre, donc reste alignée sur le texte comme
   aujourd'hui ; B : elle reste à son ancienne place, 17 px en retrait du texte. Impact : nul en A
   (rien ne change dans le cadre) ; risque : B crée deux alignements dans le même cadre et retire
   34 px à la barre (repli plus tôt) ; gain de B : aucun visible. En fait, il n'y a pas vraiment de
   choix : A est la seule qui garde le cadre d'un seul bloc.
2. **Ligne du dossier et avis** — A (recommandée) : la ligne du dossier suit le cadre (elle
   appartient à la saisie), les avis restent sur la colonne (ce sont des cartes du fil) ; B : seul
   le cadre bouge, la ligne du dossier reste sur la colonne. Impact : quelques pixels ; risque de B :
   la ligne paraît décalée de 17 px sous le cadre ; gain de A : le bloc de saisie se lit d'un seul
   tenant.
3. **Valeur du débord** — A (recommandée) : marge intérieure actuelle, 16 px (débord de 17 px),
   la même que dans la bulle envoyée ; B : 12 px (débord de 13 px). Impact : B rapproche le cadre de
   la colonne de 4 px ; risque de B : texte serré contre le coin arrondi (rayon 20 px), saisie plus
   tassée ; gain de A : rien à changer dans le cadre.

## Critères d'acceptation

- [ ] Bord gauche du texte tapé = bord gauche du texte de l'agent, à 1 px près, mesuré (positions
      calculées) aux trois largeurs, en fenêtre étroite (colonne qui remplit la zone) et panneau de
      droite ouvert.
- [ ] Largeur du texte tapé = largeur de la colonne (bord droit = bord droit des bulles), à 1 px
      près, mesurée aux mêmes cadrages.
- [ ] Le cadre ne touche ni ne dépasse jamais le bord de la zone (au moins 7 px) ; aucun défilement
      horizontal, barre latérale ouverte ou repliée, panneau ouvert ou agrandi.
- [ ] Taille calculée du texte tapé et de l'invite = celle de la bulle envoyée (et même
      interligne), aux tailles 12, 15 et 22, et en mode présentation.
- [ ] La hauteur de la saisie suit le texte jusqu'à 240 px, y compris quand la taille du texte
      change pendant qu'un texte est tapé (aujourd'hui la hauteur n'est recalculée qu'au texte et à
      la largeur : à corriger à la cause).
- [ ] Toutes les formes de la saisie gardent leur rendu : accueil, onglet Discussion, saisie vers
      un rôle, mode Plan, tour de table, file d'attente, pièces jointes et images, glisser-déposer,
      pastille « ↑ Messages précédents », menus « / » et « @ », repli de la barre (`data-fold`),
      flèche « Aller en bas », fondu du bas du fil, lecture seule ; clair et sombre, français et
      anglais.
- [ ] Un essai e2e mesure l'alignement et la taille, et rougit avec l'ancien style.
- [ ] Testé contre l'agent factice (scénario : `echo`).

## Plan (après validation de la maquette)

- `src/renderer/src/styles.css` : variable de gouttière de la colonne (24 px) et de débord
  (marge intérieure + bord, bornée par la gouttière) ; `.column > .composer-dock` en marge
  négative ; `.composer textarea` en `calc(var(--conv-size) - 1px)` ; `overflow-clip-margin` sur la
  colonne qui porte la saisie pour ne pas couper son ombre (la colonne coupe à son bord, 7 px
  au-delà du cadre) ; flèche « Aller en bas » avec repère (`thread-extras.css`, `right: 24px`)
  recalée sur le nouveau bord du cadre.
- `src/renderer/src/useTextareaLayout.ts` : recalcul de la hauteur quand la taille du texte change
  (réglage, mode présentation), pas seulement au texte et à la largeur ; unitaire.
- `useBarFold` : rien à changer a priori (il mesure la place réelle) ; la barre gagne 34 px, donc
  se replie un peu plus tard — à vérifier sur les essais existants qui fixent un niveau de repli.
- Essai e2e de mesure (trois largeurs, fenêtre étroite, panneau, tailles 12, 15, 22), captures
  avant/après aux mêmes cadrages.
- Aucune dépendance nouvelle.

## Journal

- 2026-11-28 : captures « avant » de l'app réelle et mesures (tableau ci-dessus) ; maquette HTML et
  planches ; à la demande de Jérôme (« Je veux des maquettes »), rien n'est codé avant sa
  validation. Remarques : à la taille 12, le texte tapé passe en 11 px (comme la bulle), petit mais
  voulu ; à la taille 22, la saisie montre 7 lignes avant de défiler (plafond de 240 px inchangé).
