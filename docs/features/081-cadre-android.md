# 081 — Émulateur Android : un vrai cadre d'appareil

- **Statut** : fait
- **Dépend de** : 032 (émulateur), 033 (vidéo), 044 (châssis iOS), 076 (planche contact Android)
- **Agents** : générique — onglet du panneau ; pour les agents, seul le paysage change (captures et
  touchers suivent enfin l'orientation réelle), sans rien de propre à un agent.

## Pourquoi

Recette du 2026-10-19 avec Bob 2.0.6 (`docs/recettes/2026-10-19-bob-2.0.6.md`, cas 10) : l'émulateur
marche (`android_boot`, `android_launch`, `android_filmstrip`, onglet « en direct »), mais l'onglet
« ne ressemble à rien » : l'écran est posé brut dans le panneau, sans tour de téléphone ni coins
arrondis, collé au bas du panneau. L'onglet iOS, lui, montre un iPhone (fiche 044). L'utilisateur
veut un habillage d'appareil digne de ce nom, téléphone ou tablette selon l'AVD — « si les rendus
fournis sont moches, en inventer un joli », par exemple avec un tour bleu comme dans IntelliJ /
Android Studio.

Captures de référence (app packagée, 2026-10-19) : `e2e/captures/recette-bob-2026-10-19/10-android-light.png`
(Android) et `09-ios-light.png` (iOS).

## Aujourd'hui

**Onglet Android** (`renderer/components/AndroidTab.tsx`) : un `<canvas>` (vidéo H.264, fiche 033)
ou une `<img>` (captures toutes les 1,5 s) en `object-fit: contain` dans `.simulator-screen`. Pas de
cadre, pas de coins ; un fin liseré noir de chaque côté. Un clic = un toucher (`screenPoint` : position
dans l'image, ramenée en dp). **Pas de glisser ni de molette** (l'onglet iOS les a depuis la fiche 044).
Retour, Accueil, Apps récentes dans la barre du haut.

**Onglet iOS** (`SimulatorTab.tsx` + `device-chassis.ts`, fiche 044) : châssis dessiné en CSS (tour
`#1a1a1c`, coins selon le type d'appareil de `simctl`, bouton d'accueil pour les anciens modèles),
dimensionné pour tenir dans le panneau (`ResizeObserver`), écran posé exactement à l'échelle : un
point du pointeur = (position − boîte de l'écran) / taille × points. Clic = toucher, glisser =
balayage, molette = défilement.

**Côté main** (`AndroidManager`) : taille et densité lues une fois par appareil (`wm size`,
`wm density`, mises en cache) → écran en dp (411×914 pour `Medium_Phone_API_36.0`). C'est la taille
**physique** : l'orientation n'est jamais lue. D'après le code (pas essayé), en paysage la capture
(2400×1080 px) est écrasée dans 411×914, et les touchers de l'onglet comme de l'agent tombent à côté.

**Ce que dit l'appareil** (relevé sur `Medium_Phone_API_36.0`, émulateur 37.1.11, Android 16) :

- `config.ini` de l'AVD (`adb emu avd path` → `~/.android/avd/Medium_Phone.avd`) :
  `hw.device.name=medium_phone`, `hw.lcd.width=1080`, `hw.lcd.height=2400`, `hw.lcd.density=420`,
  `skin.name=skin.path=1080x2400` (pas d'habillage : seulement la résolution), `showDeviceFrame=yes`,
  `hw.initialOrientation=portrait` ;
- `adb shell dumpsys window displays` : `cur=1080x2400` (taille dans l'orientation courante),
  `mCurrentRotation=ROTATION_0`, `mDisplayCutout` vide, `mRoundedCorners` à 0 (l'émulateur générique
  ne déclare ni encoche ni coins ; un vrai téléphone branché les déclare) ;
- `getprop ro.build.characteristics` = `emulator` (ne dit pas téléphone ou tablette).

**Ce que fournissent le SDK et Android Studio** :

- SDK : `platforms/android-33/skins/` — HVGA, QVGA, WVGA800, WXGA720… : habillages de 2010 (fond
  gris, clavier, croix directionnelle). Aucun pour les AVD récents (Medium Phone : `skin.path` = la
  résolution).
- Android Studio (`Android Studio.app/Contents/plugins/android/resources/device-art-resources/`) :
  `phone` et `tablet` génériques (images « 9-patch » datées, tour noir brillant, grille de
  haut-parleur) et une image par Pixel (`pixel_6` … `pixel_10_pro`, `pixel_tablet`) : `back.webp`,
  `mask.webp` (coins, perforation de la caméra), `layout` (position de l'écran, rayon des coins).
  **Le « tour bleu » d'IntelliJ, c'est `pixel_10`** (finition indigo). Pas d'image pour
  `medium_phone` ni pour les autres profils génériques.

L'AVD n'est pas choisi par Bobine : l'agent démarre un des AVD créés par le développeur dans Android
Studio (`android_devices` les liste, `android_boot` en démarre un). `Medium_Phone_API_36.0` est le
seul de la machine de l'utilisateur ; c'est un profil générique (taille d'un téléphone moyen, aucun
modèle réel). Le cadre doit donc aller à n'importe quel AVD, Pixel ou pas.

## Options

1. **Cadre dessiné par l'app** (CSS, comme le châssis iOS) — **recommandé**. Tour métallique (dégradé
   de la finition), cadre noir, écran aux coins arrondis, perforation de la caméra, boutons sur la
   tranche ; proportions tirées de la taille de l'écran en dp ; téléphone ou tablette selon le plus
   petit côté (≥ 600 dp = tablette, le seuil `sw600dp` d'Android). Marche pour tout AVD et tout
   appareil branché, sans Android Studio, en paysage (le cadre tourne), net à toute taille. On ne
   reproduit aucun modèle réel (pas de marque).
2. **Images d'Android Studio lues sur la machine** (pas livrées : ce sont des images de Pixel de
   Google). Le plus réaliste pour un AVD Pixel. Mais : rien pour Medium Phone et les profils
   génériques (il faut l'option 1 en repli de toute façon), rien sans Android Studio (le SDK seul ne
   les a pas), format interne non documenté (`layout`, `webp`, masques) qui peut changer d'une
   version à l'autre, images à la résolution de l'appareil (lourdes, floues une fois réduites).
3. **Habillages du SDK** (`skins` de l'AVD ou de la plateforme) : datés, absents pour les AVD
   récents. Écarté.
4. **Images d'appareils dessinées par nous et livrées** (PNG/SVG) : l'option 1 en plus lourd et
   moins souple (une image par taille et orientation). Écarté.

## Finitions (option 1)

Maquette : quatre finitions du même téléphone (écran réel de l'émulateur), puis paysage et tablette,
en clair et en sombre ; à gauche, l'onglet d'aujourd'hui.

- **A — Indigo** : tour bleu, façon Pixel 10 (l'exemple de l'utilisateur) ;
- **B — Graphite** : gris foncé, sobre ; se détache peu sur le fond sombre ;
- **C — Couleur d'accent de l'app** (Réglages › Apparence : orange par défaut, bleu, vert, violet) —
  **recommandé** depuis la remarque de l'utilisateur du 2026-10-19 : le téléphone prend la couleur
  choisie (le bleu donne l'aspect Pixel 10), il est « l'appareil de Bobine » plutôt que l'imitation
  d'un modèle, et se distingue de l'iPhone noir. Dégradé métallique calculé à partir de `--accent`
  (`color-mix`, plus clair et plus foncé), donc juste pour les quatre couleurs, en clair et en sombre ;
- **D — Porcelaine** : blanc cassé.

## Ce que ça change

- **Clair et sombre** : le cadre est un objet, mêmes couleurs dans les deux thèmes (avec la couleur
  d'accent retenue, la teinte suit celle de l'app, un peu plus claire en sombre). Un tour coloré ou
  clair reste visible sur le fond sombre ; le graphite moins.
- **Paysage** : il faut d'abord que l'app suive l'orientation (aujourd'hui elle ne la lit pas, voir
  plus haut) : taille courante (`cur=` de `dumpsys window displays`) et rotation lues à chaque
  rafraîchissement, et non plus une fois pour toutes. Le cadre tourne avec l'appareil (perforation à
  gauche, boutons en haut). Sans cela, un cadre paysage n'a pas de sens.
- **Clics et gestes** : l'écran est posé exactement à l'échelle (comme iOS), un point = (position −
  boîte de l'écran) / taille × dp ; plus de bandes vides. La perforation de la caméra laisse passer
  les clics (on touche l'écran dessous) ; un clic sur le tour ne fait rien. Les coins arrondis
  (8 % de la largeur, 33 dp sur 411) cachent au plus une dizaine de dp en diagonale dans chaque coin ;
  un appareil qui déclare ses coins (`mRoundedCorners`) donne son propre rayon. Glisser = balayage,
  molette = défilement, appui long = appui long, comme l'onglet iOS.
- **Planche contact, capture jointe, `android_screenshot`** : inchangées — écran seul, sans cadre
  (l'agent n'a pas besoin du cadre : ce seraient des pixels perdus). En paysage, elles suivront
  l'orientation réelle (aujourd'hui écrasées).

## Choix tranchés

Tranchés par l'utilisateur le 2026-10-19 : les recommandations, avec la couleur d'accent qu'il a
proposée lui-même (« c'est une bonne idée la couleur Accent de l'app non ? »).

1. **Approche** : cadre dessiné par l'app (et non les images d'Android Studio).
2. **Finition** : couleur d'accent de l'app.
3. **Périmètre** : cadre, paysage et gestes (glisser, molette, appui long) comme l'onglet iOS.

Défauts retenus, sans question : téléphone ou tablette d'après le plus petit côté (≥ 600 dp) ;
perforation centrée en haut de l'écran pour un téléphone, caméra dans le cadre pour une tablette ;
boutons de la tranche cliquables (marche/arrêt, volume +/−, avec infobulle) ; Retour, Accueil, Apps
récentes restent dans la barre ; montre et télévision : hors périmètre (cadre de téléphone) ; pas
d'ADR (même approche que la fiche 044).

## Critères d'acceptation

- [x] L'onglet Android montre l'écran dans un cadre d'appareil : téléphone (plus petit côté < 600 dp)
      ou tablette, tour de la couleur d'accent, net en clair et en sombre, qui tient dans le panneau
      quelle que soit sa taille.
- [x] En paysage, le cadre tourne (caméra et boutons du bon côté) ; captures, vidéo, planche contact
      et touchers (onglet et agent) suivent l'orientation réelle, y compris quand elle change pendant
      la vidéo.
- [x] Clic = toucher au bon endroit (vérifié au dp près en e2e et sur l'émulateur) ; glisser =
      balayage ; molette = défilement ; appui long ; boutons de la tranche.
- [x] Testé : unitaires (géométrie du cadre, lecture de `dumpsys window displays`, gestes) ; e2e
      `android` en clair et en sombre (faux SDK : téléphone, paysage, tablette), captures regardées ;
      essai réel sur `Medium_Phone_API_36.0`.

## Plan

- `main/android/adb.ts` : `orientation(serial)` = `dumpsys window displays` filtré sur l'appareil
  (`cur=`, `mCurrentRotation`, `mRoundedCorners`, ≈ 30 ms) ; `parseOrientation` pure, testée sur
  des relevés réels (portrait, paysage).
- `AndroidManager` : taille et densité physiques toujours en cache, orientation relue à chaque état,
  capture, toucher, balayage, lecture de l'écran, film et démarrage de la vidéo ; taille courante
  (en dp, orientation comprise) pour tout. Pendant la vidéo, orientation relue chaque seconde :
  si elle change, nouvel état et `screenrecord` relancé à la nouvelle taille (sinon il met l'image
  paysage en bandes dans un cadre portrait — relevé le 2026-10-19). `AndroidState` : `rotation`
  (0 à 3, sens de `Surface.ROTATION_*`), `cornerRadius` (dp, s'il est déclaré).
- IPC `android:swipe` (id, de, à, durée en ms) ; `android:tap` prend une durée d'appui facultative ;
  `android:key` accepte aussi `power`, `volume_up`, `volume_down`.
- Renderer :
  - `android-chassis.ts` (pur, testé) : type d'appareil, rayon, cadre, tour, caméra, boutons,
    d'après la taille en dp et la rotation ;
  - `screen-gestures.ts` : gestes au pointeur sortis de `SimulatorTab` (toucher, balayage, molette)
    et partagés, plus l'appui long (Android seulement) ;
  - `AndroidTab` : cadre dimensionné par `ResizeObserver`, écran exactement à l'échelle, gestes ;
    `screen-point.ts` (clic sur une image en `object-fit: contain`) n'a plus d'usage : supprimé ;
  - CSS : tour en dégradé tiré de `--accent` (`color-mix`), cadre noir, perforation, boutons.
- i18n : infobulles des boutons de la tranche (fr, en).
- e2e `android` : faux `adb` qui répond à `dumpsys window displays` (portrait, puis paysage, puis
  tablette) ; clic, glisser, molette, appui long ; captures `29-android` (portrait),
  `29c-android-paysage`, `29d-android-tablette`, en clair et en sombre.
- Docs : fiche 032 amendée, `docs/README.md` (gestes dans l'onglet Android), CHANGELOG fr et en.

## Journal

- 2026-10-19 — Fiche créée après la recette avec Bob 2.0.6. Relevés sur `Medium_Phone_API_36.0`
  (`config.ini`, `dumpsys window displays`, `getprop`), inventaire des habillages du SDK et d'Android
  Studio, maquette des quatre finitions (HTML jetable, rendu par Chrome sans fenêtre, non versionné).
  Choix soumis à l'utilisateur ; rien n'est codé.
- 2026-10-19 — Choix tranchés (voir plus haut). Relevé en paysage sur l'émulateur (`adb emu rotate`,
  puis retour en portrait) : `wm size` reste `1080x2400`, `cur=2400x1080`,
  `mCurrentRotation=ROTATION_270` ; `screencap` donne 2400×1080 ; `screenrecord --size 304x672`
  (taille portrait) met l'écran paysage en bande au milieu d'une image portrait, `--size 672x304`
  donne la bonne image. `dumpsys window displays | grep` : ≈ 30 ms.
- 2026-10-19 — **Implémenté comme prévu.** `adb.ts` (`parseOrientation`, `orientation`), `AndroidManager`
  (taille courante partout, relecture chaque seconde pendant la vidéo, état signalé quand l'écran
  tourne ; c'est l'onglet qui relance la vidéo, avec un décodeur neuf), `AndroidState.rotation` et
  `cornerRadius`, IPC `android:swipe`, `android:tap` avec durée, `android:key` élargi (bornes et
  touches vérifiées dans le main), `renderer/android-chassis.ts`, `renderer/screen-gestures.ts`
  (sorti de `SimulatorTab`, plus l'appui long), `renderer/device-room.ts`, `AndroidTab` (cadre,
  gestes, boutons de la tranche avec infobulles fr/en), CSS (tour en `color-mix` de `--accent`).
  `screen-point.ts` supprimé. Tests unitaires : orientation (relevés réels), paysage côté outils,
  géométrie du cadre (portrait, quatre rotations, tablette, coins déclarés), gestes, IPC.
- 2026-10-19 — **Écarts au plan.**
  - La place du cadre se mesurait marges intérieures comprises (16 px de trop de chaque côté) :
    corrigé pour Android **et pour l'iPhone** (fiche 044), qui était coupé en bas dans la capture de
    la recette (`09-ios-light.png`). Mesure commune dans `device-room.ts`.
  - **Images d'essai floues** (question de l'utilisateur) : la vidéo `e2e/fixtures/android.h264`
    faisait 176×384 px, agrandie trois fois ; `simulateur.jpg` était floue dans le fichier même.
    Les captures e2e paraissaient floues pour cette raison, pas à cause de l'app (celles de la
    recette, sur de vrais appareils, sont nettes). Remplacées par des images nettes de vrais
    appareils : vidéo de l'émulateur à la taille de la vidéo de l'app (544×1200, 1,5 Mbit/s,
    32 images, 164 Ko), captures `android-portrait.jpg`, `android-paysage.jpg` (émulateur),
    `android-tablette.jpg` (écran d'accueil dessiné pour l'essai, 975×610 dp), `simulateur.jpg`
    (iPhone Air du simulateur, ramenée à 402×874).
  - Tablette en e2e : même appareil dont la taille courante passe à 2560×1600 (comme un pliable
    qu'on déplie), plutôt qu'un troisième lancement de l'app.
- 2026-10-19 — **Vérifié.** `./scripts/verify` vert ; e2e `android` et `simulator` en clair et en
  sombre, captures regardées (`29-android`, `29c-android-paysage`, `29d-android-tablette`,
  `28-simulateur`). **Essai réel** (app buildée pilotée par le harnais e2e, SDK de la machine,
  `Medium_Phone_API_36.0`) : cadre de téléphone, vidéo 544×1200 ; toucher sur « Battery » → sa
  page s'ouvre, Retour du panneau → Paramètres ; glisser et molette → la liste défile ;
  `adb emu rotate` → `ROTATION_270`, cadre tourné (caméra à droite, boutons en bas), vidéo
  relancée en 1200×544, toucher en paysage → page ouverte ; émulateur remis en portrait.
  Non essayés sur l'appareil réel : appui long, boutons de la tranche (vérifiés en e2e : appel
  `adb` attendu) ; tablette réelle (pas d'AVD tablette sur la machine).
- 2026-10-19 — **Retours de l'utilisateur sur l'app en marche**, trois points :
  - **Pas de débit sur Android** : ajouté comme sur iOS (images dessinées dans la dernière
    seconde, `android-fps`, valeur `panel.device.fps` désormais commune aux deux onglets).
    L'émulateur n'envoie une image que quand l'écran change : 0 à 1 fps sur un écran immobile,
    ≈ 30 pendant un défilement ; l'infobulle le dit.
  - **Boutons sous le téléphone**, comme le simulateur de Claude Code : `DeviceControls`, barre
    en pastille sous l'appareil, pour Android (Retour, Accueil, Apps récentes | joindre) et iOS
    (Accueil, verrouillage | joindre). L'appareil et sa barre sont centrés ensemble ;
    `useDeviceRoom` retire la hauteur de la barre de la place du cadre. L'ombre de l'appareil
    n'est plus coupée par sa zone (un rectangle plus clair se voyait autour de l'iPhone).
  - **Courbure de l'écran différente de celle du châssis** : mesuré au pixel sur la capture de
    l'utilisateur, les coins étaient bien concentriques (bande noire de 17 px partout, coin
    compris) ; c'est l'écart entre les rayons (75 px dehors, 47 px pour l'écran, cadre noir épais)
    qui donnait l'impression. Cadre affiné : bord noir 1,5 % de la largeur (au lieu de 3 %), tour
    1 % (au lieu de 1,2 %), écran arrondi à 8,5 % (au lieu de 8 %) — 6 + 4 dp autour d'un écran
    de 411 dp, rayon 35 dp ; tablette : bord 2,5 %, écran 4 %. Un rayon plus grand rognerait
    l'heure de la barre d'état de l'émulateur (aucun coin déclaré, l'heure est à 15 dp du bord).
  - Vérifié : `./scripts/verify`, e2e `android` et `simulator` en clair et en sombre (débit,
    barre sous l'appareil), captures regardées. Essai réel : cadre et débit sur le vrai flux
    (1 fps écran immobile) ; touchers non rejoués, l'émulateur étant alors utilisé ailleurs
    (premier lancement de Chrome à l'écran) — les coordonnées ne dépendent pas de ces changements
    (même élément d'écran), l'e2e les vérifie.
