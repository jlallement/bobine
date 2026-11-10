# 076 — Planche contact sur l'émulateur Android

- **Statut** : fait
- **Dépend de** : 075 (planche contact : navigateur et iOS), 032 et 033 (émulateur Android, vidéo)
- **Agents** : les deux — outil MCP de l'app, rien ne dépend de l'agent.

## Pourquoi

La fiche 075 donne à l'agent la planche contact pour le navigateur et le simulateur iOS : en un
appel, l'app fait un geste en filmant l'écran et rend une image en grille (images numérotées dans
l'ordre de lecture) et le moment de chaque image. Il manque Android, mis de côté parce que le main
n'a pas d'images Android décodées : le flux de l'onglet est du H.264 de `screenrecord`, décodé dans
la fenêtre (WebCodecs, `AndroidTab.tsx`).

`android_filmstrip` : même outil que `ios_filmstrip`, avec les gestes Android (`android_tap`,
`android_swipe`, `android_type`, `android_key`, `android_open_url`, ou rien pour regarder un
chargement).

## Relevés (2026-10-16, émulateur Android 16 / API 36, arm64, 1080 × 2400 à 420 ppp)

Piste 1 de la fiche 075 essayée sur un vrai émulateur : `adb exec-out screenrecord
--output-format=frames`.

- L'option existe (cachée : absente de `--help`, comme `--output-format=h264` que l'onglet utilise
  déjà, donc même disponibilité). `--size` est respecté, y compris une largeur impaire
  (`411x914`, la taille en dp).
- **Format `frames`** : pour chaque image, un en-tête de 5 entiers de 32 bits (petit-boutiste) —
  longueur de la suite (16 + octets des pixels), largeur, hauteur, octets par ligne (largeur × 3),
  format (3 = `RGB_888`) — puis les pixels **RGB**, 3 octets, sans remplissage. `raw-frames` : les
  mêmes pixels sans en-tête (taille à deviner) ; `frames` est donc préférable. Pas de moment dans
  l'en-tête : celui de l'arrivée dans le main (comme pour iOS).
- **Cadence** : première image 75 à 95 ms après le lancement, même écran immobile ; ensuite
  seulement quand l'écran change — **≈ 30 images/s** pendant un balayage (une toutes les 15 à
  55 ms : 25 images entre 1,13 s et 1,96 s), aucune quand rien ne bouge.
- **Poids** : 1,1 Mo par image en 411 × 914 → ≈ 34 Mo/s par `adb` pendant un mouvement. Aucun
  souci sur l'émulateur ; sur un appareil réel en USB, non essayé (moins d'images si le débit ne
  suit pas : `screenrecord` saute alors des images, il ne prend pas de retard).
- `--time-limit` est ignoré dans ce format : le processus tourne jusqu'à ce qu'on l'arrête ; tuer
  `adb` côté Mac l'arrête aussi dans l'appareil (aucun `screenrecord` restant).
- **Deux `screenrecord` en même temps** (le H.264 de l'onglet et les images de la planche) :
  les deux reçoivent leurs images.

## Question tranchée

Tranchée par l'utilisateur le 2026-10-16 : option A (recommandée).

**Source des images de la planche Android**

- **A. Un second `screenrecord --output-format=frames`, le temps du film** (recommandé). Le main
  lance ce processus pendant le geste, à la taille en dp (assez : une case de la planche n'est
  jamais plus grande que l'écran en dp), lit les images RGB et les met en JPEG à leur arrivée
  (≈ 60 Ko au lieu de 1,1 Mo), puis réutilise la planche de la fiche 075 telle quelle.
  - Pour : tout dans le main, comme iOS ; marche que l'onglet « Android » soit ouvert ou non ;
    rien à décoder (pas de dépendance) ; ≈ 30 images/s mesurées ; testable avec un faux `adb`.
  - Contre : un second processus et du débit `adb` pendant 1,5 à 5 s ; débit non vérifié sur un
    appareil réel en USB.
- **B. Décodage par la fenêtre** : l'onglet décode déjà le H.264 (WebCodecs) ; pendant le film, le
  renderer renverrait au main une image JPEG à chaque image décodée, par un nouveau canal IPC.
  - Pour : un seul `screenrecord`, mêmes images que celles que l'utilisateur voit.
  - Contre : l'outil dépend de la fenêtre (onglet monté, décodeur prêt ; sinon il faut un décodeur
    caché), un canal IPC de plus dans le sens renderer → main pour des images, moments moins sûrs
    (décodage, IPC), plus de pièces à tester ; va contre l'esprit « le main fait le travail ».
- **C. Décoder le H.264 dans le main** (ffmpeg ou un décodeur) : une dépendance lourde (binaire
  ou WebAssembly) pour ce qu'Android sait déjà fournir en images brutes. Écarté.
- **D. Captures `adb screencap` enchaînées** : ≈ 1 à 2 images/s (0,8 s par capture), trop lent
  pour une animation. Écarté (déjà dit dans la fiche 075).

## Critères d'acceptation

- [x] `android_filmstrip` : gestes Android (ou aucun), durée (1,5 s par défaut, 5 s au plus),
      nombre d'images (8 par défaut, 16 au plus) ; rend une image en grille et un texte : moment
      de chaque image, échelle pour revenir aux coordonnées de `android_tap` (dp).
- [x] Une image au moins toutes les 100 ms pendant un mouvement ; images identiques écartées ;
      sans changement, la planche le dit.
- [x] Marche que l'onglet « Android » montre la vidéo ou non, sans la couper.
- [x] Sans image de l'appareil (ancien Android, format refusé), l'outil le dit et propose
      `android_screenshot` ; pas de planche vide.
- [x] L'utilisateur voit la planche dans la carte de l'outil ; libellé dans les deux langues.
- [x] Autorisé d'office comme les autres outils du panneau ; aucune nouvelle dépendance.
- [x] Testé : unitaires (découpage du format `frames`, RGB → BGRA, outil) ; agent factice,
      scénario `planche-android` contre un faux SDK dont le faux `adb` envoie des images au format
      `frames` (e2e `android`, clair et sombre, français et anglais).

## Plan

Option A, environ une journée :

1. **Format `frames`** (`main/android/raw-frames.ts`, pur) : découpage du flux en images (en-tête
   de 20 octets, morceaux reçus n'importe comment), RGB → BGRA opaque (ordre de `nativeImage`),
   tests.
2. **Film** (`android-manager.ts`) : `film(conversationId, run, durationMs)` comme celui d'iOS —
   lance `adb -s <série> exec-out screenrecord --output-format=frames --size <dp> -`, attend la
   première image (6 s au plus), fait les gestes, attend la fin de la durée, arrête le processus ;
   chaque image passe en JPEG à son arrivée (`encodeBgra` injecté, comme pour iOS), 300 au plus.
3. **Outil** : la partie commune de `ios_filmstrip` (actions filmables, bornes, assemblage du
   résultat) passe dans `main/filmstrip/` pour servir aux deux ; `android-tools.ts` ajoute
   `android_filmstrip` avec les gestes Android ; `index.ts` passe `imageCodec` et `encodeBgra`.
4. **Interface** : libellé `appTools.android_filmstrip` dans `fr.json` et `en.json`,
   `shared/app-tools.ts`.
5. **Essais** : scénario `planche-android` de l'agent factice ; le faux `adb` de la suite `android`
   envoie quelques images de deux couleurs au format `frames`, espacées de 100 ms ; e2e `android`
   en clair et en sombre, en français et en anglais.
6. **Clore** : `docs/architecture.md`, `docs/mock-agent.md`, `CHANGELOG.md` et `CHANGELOG.en.md`,
   index.

## Journal

- 2026-10-16 — Fiche créée. Piste des images brutes essayée sur l'émulateur local (relevés
  ci-dessus) : elle marche. Options présentées à l'utilisateur avant de coder.
- 2026-10-16 — L'utilisateur retient l'option A : un second `screenrecord` en images brutes,
  dans le main, le temps du film.
- 2026-10-16 — **Fait**, comme prévu.
  - **Format `frames`** (`main/android/raw-frames.ts`) : découpage du flux (une image n'est
    recopiée qu'une fois, entière, quels que soient les morceaux reçus), RGB → BGRA opaque ;
    formats sur 4 octets (RGBA, RGBX, BGRA) acceptés aussi, les autres refusés avec leur numéro.
  - **Film** (`AndroidManager.film`) : `adb -s <série> exec-out screenrecord
    --output-format=frames --size <dp> -` le temps du film, à côté du flux de l'onglet ; chaque
    image en JPEG à son arrivée (`encodeBgra`, celui du flux iOS), 300 au plus ; sans première
    image en 6 s (ou processus arrêté, format refusé), erreur qui renvoie vers
    `android_screenshot`, **avant** les gestes : rien n'est fait.
  - **Outil commun** (`main/filmstrip/device-tool.ts`) : `ios_filmstrip` et `android_filmstrip`
    partagent arguments, bornes, actions filmables et résultat ; `browser_filmstrip` y prend ses
    bornes et son schéma (ses actions restent celles de `browser_batch`).
  - **Essai réel** (émulateur Android 16, l'app construite, agent factice `planche-android`) :
    balayage vers le haut sur l'écran d'accueil, 18 images reçues, 6 écrans différents ; le
    tiroir d'apps s'ouvre entre 246 et 470 ms (la première image change 0,25 s après le début :
    temps de démarrage de `input swipe`). Appel complet : 2,6 s. Couleurs justes.
  - **Essais** : unitaires (découpage, RGB → BGRA, film contre un faux `adb` qui écrit des
    images brutes, erreur sans image, outil) ; scénario `planche-android` ; e2e `android` (faux
    `screenrecord --output-format=frames` : une bande qui descend), en clair et en sombre, en
    français et en anglais, captures `29b-planche-android` regardées. Suites `simulator` et
    `browser` repassées (outil commun). La suite `android` compare désormais le nom de la capture
    jointe et le bouton Retour avec `L()`.
  - **Reste** : appareil réel en USB non essayé (débit d'`adb` : moins d'images possible).
