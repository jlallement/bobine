# 009 — Simulateur iOS — flux vidéo fluide

- **Statut** : fait
- **Dépend de** : 008

## Pourquoi

Remplacer les captures par un flux continu pour suivre animations et transitions.

## Critères d'acceptation

- [x] Flux vidéo du simulateur dans le panneau (≥ 15 images/s), sans bloquer l'interface.
- [x] Interaction directe possible (clic → toucher).
- [x] Testé : essai réel ; repli sur les captures si le flux échoue.

## Notes

Piste : `simctl io recordVideo` en flux, ou capture d'écran ciblée de la fenêtre Simulator.

## Plan

- Flux : `axe stream-video --format mjpeg --fps 30 --scale 0.5 --quality 60` (relevé : AXe enchaîne des
  captures, ≈ 17–18 images/s réelles quelle que soit l'échelle ; ≈ 73 Ko par image à 0,5). Sortie
  HTTP « multipart/x-mixed-replace » : `main/simulator/mjpeg.ts` découpe les images
  (`Content-Length`), fonction pure testée. **Depuis la fiche 044**, ce flux n'est plus que le
  secours : l'app lit d'abord l'image de l'appareil en BGRA (30 images/s), voir là-bas.
- Un seul flux à la fois (l'onglet visible) : `simulator:startStream` / `simulator:stopStream`,
  images poussées par `simulator:frame` (octets, pas de base64), fin par `simulator:streamEnded`.
  Processus arrêté à la fermeture de l'onglet, au changement d'appareil et à la sortie de l'app.
- Renderer : décodage hors du fil principal (`createImageBitmap`) dans un `<canvas>`, image la plus
  récente seulement (les images en retard sont sautées). Clic → toucher en points (taille de l'écran
  connue par l'état du simulateur).
- Repli sur les captures successives (fiche 008) sans AXe ou si le flux s'arrête.

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-11 — Implémenté comme prévu : `main/simulator/mjpeg.ts` (testé : images coupées en morceaux
  quelconques, longueur absurde), `SimulatorManager.startStream` / `stopStream`, IPC
  `simulator:startStream` / `stopStream` / `frame` / `streamEnded`, `SimulatorTab` (toile, décodage
  par `createImageBitmap`, badge « en direct », repli sur les captures). e2e : faux `axe` qui diffuse
  60 images puis s'arrête en erreur (« Simulateur perdu ») → vidéo dessinée, clic = toucher, repli
  avec la raison affichée.
  - **Essai réel** (simulateur de test, Réglages, agent factice) : 96 images reçues en 5 s
    (**19,2 images/s**), toile 603×1311 ; clic sur « Général » dans la vidéo → la page Général
    s'ouvre ; aucun processus `stream-video` restant après la fermeture.
  - Limite : AXe enchaîne des captures (≈ 18–19 images/s) ; au-delà (60 images/s comme Simulator.app),
    il faudra l'outil natif livré avec l'app (lecture directe de l'écran du simulateur).
- 2026-10-13 — Fiche 044 : relevé sur l'iPhone Air (iOS 26) de l'utilisateur, ce flux MJPEG ne
  tient que 9,5 images/s (captures plus lentes sur un grand écran). Remplacé par le format `bgra`
  d'AXe (image de l'appareil, 30 images/s), encodé en JPEG dans le main ; le MJPEG reste le repli.
