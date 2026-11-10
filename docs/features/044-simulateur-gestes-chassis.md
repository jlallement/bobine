# 044 — Simulateur iOS : gestes à la souris, châssis, flux fluide

- **Statut** : fait
- **Dépend de** : 008, 009

## Pourquoi

Trois défauts vus à l'usage dans l'onglet « Simulateur » :

- **On ne peut que toucher.** Un clic est un toucher, mais un glisser ne fait rien : impossible de
  changer de page sur l'écran d'accueil ou de faire défiler une liste à la souris. L'agent, lui,
  dispose d'`ios_swipe`.
- **Pas de châssis.** L'écran est affiché nu, sans le tour du téléphone ni les coins arrondis :
  on ne reconnaît pas un iPhone.
- **Flux saccadé.** `axe stream-video --format mjpeg` enchaîne des captures d'écran ; relevé sur
  l'iPhone Air (iOS 26) de l'utilisateur : **9,5 images/s** (et 17–18 sur l'appareil plus petit de
  la fiche 009). Le format `bgra` d'AXe lit directement l'image de l'appareil (IOSurface,
  `FBSimulatorVideoStream`) : **30 images/s** sur le même appareil, première image en 140 ms.

## Critères d'acceptation

- [x] Glisser à la souris sur l'écran = balayage (`axe swipe`) entre les deux points, de la durée
      du geste ; un clic court reste un toucher. Molette / trackpad = défilement à l'endroit du
      pointeur. Vérifié sur un vrai simulateur : la page d'accueil change.
- [x] Châssis dessiné autour de l'écran : coins arrondis à la bonne proportion pour les iPhone
      récents, bezel, bouton d'accueil pour les appareils qui en ont un (iPhone SE…), iPad plus
      carré. L'écran garde ses proportions ; les coordonnées des touchers restent justes.
- [x] Flux vidéo par `--format bgra` (image de l'appareil, 30 images/s demandées), encodé en JPEG
      dans le main (`nativeImage`, ≈ 3 ms par image à l'échelle 0,5), poussé comme aujourd'hui ;
      repli sur le MJPEG de la fiche 009 si la taille en pixels est inconnue ou impaire, ou si le
      flux `bgra` tombe avant la première image. `pnpm simulator-smoke` relève les deux débits.
- [x] Testé contre l'agent factice (scénario `simulateur`, faux `axe` diffusant des images BGRA) ;
      tests unitaires du découpage des images et du choix du châssis.

## Plan

- `shared/simulator.ts` : `deviceType` (identifiant `SimDeviceType` de `simctl`) sur `SimDevice` ;
  `simctl.parseDevices` le garde.
- `main/simulator/bgra-frames.ts` : découpage d'un flux d'octets en images de taille fixe (pure,
  testé). `SimulatorManager.startStream` : taille en pixels de l'écran (capture `simctl`, en cache
  par appareil) ; `bgra` à l'échelle 0,5 si elle est paire, image la plus récente encodée par
  `options.encodeBgra` (injecté : `nativeImage.createFromBitmap(...).toJPEG(60)`), sinon ou en
  cas d'échec précoce, MJPEG comme avant.
- IPC `simulator:swipe` (id, de, à, durée) → `SimulatorManager.swipe` (déjà là pour l'agent).
- Renderer : `device-chassis.ts` (pure, testé) : rayon des coins et bezels d'après `deviceType` et
  la taille en points ; `SimulatorTab` : cadre dimensionné pour tenir dans le panneau
  (`ResizeObserver`), écran exactement à l'échelle (plus de `object-fit`), gestes au pointeur
  (appui, déplacement, relâchement → toucher ou balayage ; molette → balayage court, regroupée).
- e2e `simulator` : image de test aux proportions de l'écran (402×874), faux `axe` qui diffuse
  des images BGRA, glisser sur la vidéo → `axe swipe`, châssis présent ; capture `28-simulateur`.
- `scripts/simulator-smoke.mts` : débit MJPEG et BGRA ; option `--keep` documentée sans `--`
  (pnpm 12 transmet `--` au script).
- Docs : fiches 008 et 009 amendées, `docs/README.md` (gestes dans l'onglet).

## Journal

- 2026-10-13 — Fiche créée après les retours de l'utilisateur. Relevés sur l'iPhone Air (iOS 26) :
  `mjpeg` 9,5 i/s (0,9 Mo/s à l'échelle 0,5), `raw` et `ffmpeg` idem (captures PNG), `bgra`
  30,7 i/s (100 Mo/s à l'échelle 0,5 : 630×1368×4 octets par image). Encodage JPEG d'une image
  BGRA 630×1368 par `nativeImage` dans le main : 3,4 ms (2,6 ms réduite à 400 px). Balayage
  `axe swipe` de 0,2 s sur 300 points : la page d'accueil change (« Page 2 sur 2 »), 1,1 s en tout
  avec le lancement du processus. Le simulateur iOS 26 dessine lui-même la Dynamic Island dans
  l'image : le châssis n'a à dessiner que le tour et les coins.
- 2026-10-13 — **Forme des images BGRA** : pas d'en-tête, pas de remplissage final, mais des
  lignes de largeur × 4 octets arrondie au multiple de 64 (CoreVideo) : à l'échelle 0,5 un iPhone 17
  donne 603 pixels de large, soit 2 432 octets par ligne au lieu de 2 412, et l'image décodée est
  de travers. Relevé sur deux échelles (période exacte entre deux images identiques d'un écran
  immobile). Parade : `streamGeometry` choisit une échelle qui donne une largeur multiple de 16
  pixels (608 pour un iPhone 17, échelle 0,504561) ; les lignes sont alors exactement pleines. La
  première image est vérifiée (4ᵉ octet de chaque pixel = FF) avant d'être encodée ; sinon repli
  MJPEG. `nativeImage.createFromBitmap` attend bien du BGRA : couleurs justes à l'essai.
- 2026-10-13 — **Implémenté comme prévu.** `shared/simulator.ts` (`deviceType`), `simctl.parseDevices`,
  `main/simulator/bgra-frames.ts` (`streamGeometry`, `looksLikeOpaqueBgra`, `FixedFrames`, testés),
  `SimulatorManager.startStream` (BGRA puis MJPEG, image la plus récente seulement, délai de
  4 s sans image → MJPEG), `encodeBgra` injecté depuis `main/index.ts`, IPC `simulator:swipe`,
  `renderer/device-chassis.ts` (testé), `SimulatorTab` (châssis dimensionné par `ResizeObserver`,
  gestes au pointeur, molette regroupée sur 120 ms, bouton d'accueil cliquable sur les appareils
  qui en ont un). e2e `simulator` : image de test 402×874, faux `axe` BGRA, flux, châssis, toucher,
  balayage, molette ; capture `28-simulateur` regardée. `pnpm e2e` passe le drapeau
  `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` (la suite importe `bgra-frames.ts`).
  **Essai réel** (app buildée pilotée par le harnais e2e contre un simulateur iPhone 17 créé pour
  l'occasion, AXe enveloppé pour noter ses appels) : 148–150 images reçues par l'onglet en 5 s
  (≈ 30 i/s, contre 9,3 en MJPEG sur le même appareil), châssis et couleurs justes, glisser à la
  souris → `axe swipe --start-x 322 … --end-x 80 … --duration 0.05` → « Page 2 sur 2 » sur
  l'écran d'accueil. `pnpm simulator-smoke` relève les deux débits. Simulateur d'essai supprimé.
  **Écart** : la molette n'a été vérifiée que par l'e2e (appel `axe swipe` attendu), pas sur un
  vrai appareil.
- 2026-10-13 — Demande de l'utilisateur : le débit en direct (images dessinées par seconde) remplace
  la version d'AXe dans la barre pendant le flux (`simulator-fps`, la version reste dans l'infobulle
  et réapparaît sans flux), écrit « 30 fps » à la demande de l'utilisateur. e2e : débit affiché
  entre 8 et 30 fps avec le faux flux.
- 2026-10-19 — Fiche 081 : les gestes au pointeur sortent de `SimulatorTab` dans
  `renderer/screen-gestures.ts` (communs avec l'onglet Android, même comportement) ; la place du
  châssis se mesure sans les marges intérieures de la zone (`renderer/device-room.ts`) : l'iPhone
  débordait de 16 px de chaque côté et était coupé en bas. Image d'essai `simulateur.jpg`
  remplacée par une capture nette (iPhone Air, 402×874) : l'ancienne était floue par construction.
  Accueil, verrouillage et « Joindre » passent de la barre du haut à une barre sous l'iPhone
  (`DeviceControls`), comme l'onglet Android.
