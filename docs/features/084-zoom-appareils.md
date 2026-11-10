# 084 — Zoom du simulateur iOS et de l'émulateur Android

- **Statut** : fait
- **Dépend de** : 044, 081
- **Agents** : les deux — affichage des onglets seulement ; rien ne change pour l'agent (captures,
  touchers et outils inchangés)

## Pourquoi

L'appareil est toujours réduit pour tenir en entier dans le panneau : on ne peut ni le voir en
grand pour lire un détail, ni à sa taille réelle. Claude Code propose quatre boutons : dézoomer,
ajuster au panneau, taille réelle, zoomer (demande de l'utilisateur, 2026-10-19, à la place de la
rotation, fiche 083).

## Existant

- `SimulatorTab` et `AndroidTab` : échelle = « ajuster » (`min` largeur / hauteur de la place
  disponible, `useDeviceRoom`), cadre et écran dessinés à cette échelle ; gestes (toucher,
  balayage, molette, appui long) convertis avec la même échelle (`useScreenGestures`).
- Barre de commandes collée sous l'appareil (`DeviceControls`, fiche 081).
- En haut de l'onglet : nom de l'appareil, système, images par seconde (`simulator-bar`).
- ⌘+ / ⌘− / ⌘0 sont pris par le zoom de toute l'app (menu Affichage, rôles d'Electron).

## Décisions (2026-10-19)

- Zoom seulement (la rotation est reportée, fiche 083).
- Boutons en haut de l'onglet, à droite du nom de l'appareil et des images par seconde.

## Proposition

- Quatre boutons : dézoomer, **ajuster** (par défaut, comme aujourd'hui), **taille réelle** (un
  point de l'appareil = un point de l'écran du Mac, comme « Point Accurate » de l'app Simulator ;
  un dp sur Android), zoomer. Paliers : 25, 33, 50, 67, 75, 100, 125, 150, 200, 300 %.
- Au-delà du panneau, l'appareil défile dans les deux sens ; la barre de commandes reste en bas,
  visible. Les gestes restent justes (même échelle).

Choix de l'utilisateur sur la maquette (2026-10-19) : niveau affiché à côté des boutons
(« 62 % ») ; **pas** de pincement au trackpad ; **pas** de mémoire : « ajuster » à chaque
ouverture de l'onglet.

## Critères d'acceptation

- [x] Onglets iOS et Android : en haut, à droite du nom de l'appareil et des images par seconde,
      dézoomer, ajuster (actif par défaut), taille réelle, zoomer, et le niveau (« 62 % », mis en
      forme selon la langue). Paliers de 25 à 300 % ; aux bornes, le bouton est inactif.
- [x] Taille réelle : un point de l'appareil (dp sur Android) = un point de l'écran du Mac.
- [x] Zoomé, l'appareil défile dans les deux sens et reste centré quand il est plus petit que la
      place ; la barre de commandes reste en bas, visible.
- [x] Touchers, balayages et appui long restent justes à tout zoom. Zoomé, la molette déplace la
      vue au lieu de faire défiler l'app (choix de l'utilisateur, 2026-10-19) ; en « ajuster »,
      elle fait défiler l'app comme avant.
- [x] « Ajuster » à chaque ouverture de l'onglet ; en « ajuster », le panneau redimensionné garde
      l'appareil en entier comme aujourd'hui.
- [x] Textes en français et en anglais.
- [x] Testé : unitaires (paliers) ; e2e `simulator` et `android` (zoom, taille réelle, défilement,
      toucher juste une fois zoomé, retour à « ajuster »), captures claires et sombres ; essai à la
      vraie souris.

## Plan

- `src/renderer/src/device-zoom.ts` (+ test) : paliers, palier suivant / précédent, échelle d'après
  le zoom et l'échelle « ajuster » ; `useDeviceZoom`.
- `DeviceControls.tsx` : `DeviceZoomControls` (quatre boutons et niveau), partagé par les deux
  onglets.
- `SimulatorTab.tsx`, `AndroidTab.tsx` : échelle = celle du zoom ; boutons dans `simulator-bar` ;
  `device-stage zoomed` quand le zoom n'est pas « ajuster ».
- `styles.css` : `.device-stage.zoomed` (prend la place, défile, appareil centré par marges
  automatiques), boutons et niveau.
- `fr.json`, `en.json` ; e2e `simulator.mjs`, `android.mjs`.
- Pas de nouvelle dépendance.

## Journal

- 2026-10-19 — Fiche créée (zoom choisi à la place de la rotation, fiche 083).
- 2026-10-19 — Fait. `device-zoom.ts` (+ test : paliers, bornes, « ajuster »), `useDeviceZoom`
  (garde au centre ce qu'on regardait en changeant de zoom : depuis « ajuster », le milieu de
  l'écran) ; `DeviceZoomControls` dans `DeviceControls.tsx` (quatre boutons, niveau mis en forme
  par `Intl` : « 62 % » / « 62% ») ; onglets iOS et Android : échelle du zoom, scène
  `device-stage zoomed` qui défile (appareil centré par marges automatiques), barre de commandes
  fixe en bas ; `useScreenGestures` : option `wheelScrolls`.
  - Écart au plan, décidé avec l'utilisateur en cours de route : zoomé, la molette au-dessus de
    l'appareil faisait les deux à la fois (déplacer la vue et faire défiler l'app). Elle déplace
    maintenant la vue ; on fait défiler l'app en glissant.
  - La référence de la scène est créée par `useDeviceZoom` (le compilateur React refuse qu'un hook
    modifie un élément reçu en paramètre).
  - e2e `simulator` et `android` : « ajuster » au départ, taille réelle (402 points / 411 dp de
    large), défilement, barre visible, centre gardé, toucher juste une fois zoomé, molette qui
    déplace la vue sans geste envoyé, palier 125 %, retour à « ajuster » (l'appareil tient en
    entier ; la place peut avoir changé avec l'avis de flux interrompu). Captures `28e`, `29e`.
  - Essai à la vraie souris (app d'essai, simulateur factice) : zoomer, taille réelle, ajuster,
    molette (vue déplacée zoomé, défilement de l'app en « ajuster »), clic → toucher.
