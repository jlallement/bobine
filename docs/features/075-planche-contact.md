# 075 — Planche contact : ce qui se passe pendant un geste, en une image

- **Statut** : fait (navigateur et iOS ; Android : fiche 076)
- **Dépend de** : 029 (socle des outils de l'app), 007 (navigateur), 008 et 044 (simulateur iOS,
  flux d'images d'AXe), 032 (émulateur Android)
- **Agents** : les deux — outil MCP de l'app, rien ne dépend de l'agent.

## Pourquoi

L'agent ne voit que des images fixes, et plusieurs secondes passent entre deux de ses appels
d'outils. Il ne voit donc jamais ce qui se passe *pendant* un geste : un défilement qui saute,
un en-tête collant qui tremble, une mise en page qui bouge au chargement, une fenêtre qui
s'ouvre de travers, une animation saccadée, le clavier qui recouvre un champ. L'utilisateur, lui,
le voit tout de suite.

La planche contact : en un seul appel, l'app fait le geste et prend une image toutes les
~100 ms, puis rend une seule image en grille (images numérotées dans l'ordre de lecture) et, en
texte, le moment de chaque image. Ni Claude Desktop ni Codex ne le proposent.

Ce que ça apporte vraiment : le **moment** des images (impossible en enchaînant des captures,
trop espacées), et une **lecture d'un coup d'œil** de l'enchaînement. L'économie de contexte vient
de la réduction des images (une planche de 12 images au tiers coûte environ une capture et
demie), pas de la grille elle-même.

## Questions tranchées

Tranchées par l'utilisateur le 2026-10-16 : les trois recommandations (mises en premier).

1. **Forme de l'outil**
   - **Un appel = le geste et les images** (recommandé) : `browser_filmstrip`, `ios_filmstrip`
     (et `android_filmstrip`) font une ou plusieurs actions du panneau (défiler, glisser,
     toucher, cliquer, ou rien pour regarder un chargement) en filmant. Moment exact, un seul
     appel.
   - Démarrer puis arrêter le film autour des outils habituels : plus souple, mais l'attente de
     l'agent entre ses appels (des secondes) remplit la planche d'images identiques.
2. **Android**
   - **Navigateur et iOS d'abord, Android ensuite** (recommandé). Le main n'a pas d'images
     Android décodées : le flux H.264 est décodé dans la fenêtre (WebCodecs). Pistes pour plus
     tard : images brutes de `screenrecord` (à essayer), ou décodage par la fenêtre.
   - Android tout de suite, avec des captures `adb` enchaînées : environ 2 images par seconde,
     trop lent pour une animation.
3. **Fabrication de la grille**
   - **Maison, sans dépendance** (recommandé) : chaque image en pixels bruts (`nativeImage`
     d'Electron), recopiée dans une grande image, numéros dessinés avec une petite police de
     chiffres intégrée, puis JPEG. Rapide, testable sans Electron.
   - Une fenêtre cachée avec un `<canvas>` : textes et mise en forme libres, mais une fenêtre de
     plus à lancer, plus lent.
   - Pas de grille : renvoyer les images une à une. Rien à fabriquer, mais plus lourd pour le
     contexte et moins lisible.

## Critères d'acceptation

- [x] `browser_filmstrip` et `ios_filmstrip` : actions du panneau (ou aucune), durée (1,5 s par
      défaut, 5 s au plus), nombre d'images (8 par défaut, 16 au plus) ; rendent une image en
      grille et un texte : moment de chaque image, échelle pour revenir aux coordonnées des
      clics.
- [x] Une image au moins toutes les 100 ms pendant le geste (navigateur : images de Chromium à
      chaque changement ; iOS : flux d'AXe) ; images identiques écartées, les autres réparties
      sur la durée ; sans changement, la planche le dit au lieu de répéter la même image.
- [x] Grille lisible : images numérotées dans l'ordre de lecture, séparées, réduites pour tenir
      dans 1 568 px de côté ; un écran de téléphone en hauteur donne plusieurs colonnes.
- [x] L'utilisateur voit la planche dans la carte de l'outil, comme une capture ; le libellé de
      l'outil est dans les deux langues.
- [x] Autorisé d'office comme les autres outils du panneau ; aucune nouvelle dépendance.
- [x] Sans AXe (iOS), l'outil le dit et propose `ios_screenshot` ; il ne fabrique pas une planche
      vide.
- [x] Testé : unitaires (choix des images, grille, numéros) ; agent factice, scénario
      `planche-contact` sur une page d'essai avec une animation CSS (e2e `browser` : planche
      affichée, images différentes) ; iOS contre le faux `xcrun` et un faux flux d'AXe.

## Plan

Environ deux à trois jours :

1. **Grille** (`src/main/filmstrip/`, pur) : `select.ts` (images différentes, réparties sur la
   durée), `grid.ts` (colonnes et taille d'après le format et le nombre, recopie des pixels,
   numéros avec une police de chiffres 5 × 7), tests.
2. **Navigateur** : `cdp-tab.ts` filme avec `Page.startScreencast` (images à chaque changement,
   avec leur moment) pendant les actions ; `browser-tools.ts` ajoute `browser_filmstrip`, qui
   reprend les actions de `browser_batch`.
3. **iOS** : `simulator-manager.ts` laisse plusieurs lecteurs suivre le flux d'AXe (le panneau et
   la planche), et le démarre le temps de la planche s'il ne tourne pas ; `simulator-tools.ts`
   ajoute `ios_filmstrip` (glisser, toucher, ou rien).
4. **Interface** : libellés `appTools.*_filmstrip` dans `fr.json` et `en.json` ; la carte d'outil
   affiche déjà les images.
5. **Essais** : scénario `planche-contact` de l'agent factice, page d'essai animée, e2e
   `browser` et `simulator`, en français et en anglais.
6. **Clore** : `docs/architecture.md` (outils de l'app), `CHANGELOG.md` et `CHANGELOG.en.md`,
   index.

Android : fiche à part une fois la piste des images brutes essayée.

## Journal

- 2026-10-16 — Fiche créée à partir d'une discussion avec l'utilisateur : l'agent ne voit que des
  images fixes, une vidéo ne lui sert à rien, une planche d'images prises pendant le geste, si.
  Questions 1 à 3 posées à l'utilisateur avant de coder.
- 2026-10-16 — L'utilisateur retient les trois recommandations : un appel fait le geste et les
  images ; navigateur et iOS d'abord, Android dans une fiche à part ; grille fabriquée par l'app,
  sans dépendance.
- 2026-10-16 — **Fait** (navigateur et iOS).
  - **Grille** (`main/filmstrip/`) : `select.ts` écarte les images qui ne changent rien (écart
    moyen sur une vignette de 32 px de large) et en garde au plus N, la première et la dernière
    comprises, au plus près de moments également espacés ; `grid.ts` choisit les colonnes qui
    donnent les plus grandes cases, recopie les pixels et dessine les numéros (police de chiffres
    5 × 7, blanc sur noir) ; `sheet.ts` assemble, avec un `ImageCodec` (`native-codec.ts` :
    `nativeImage` d'Electron ; un faux dans les tests) ; `sheetText` écrit le texte pour l'agent
    (en anglais, comme les autres résultats d'outils).
  - **Navigateur** : `CdpTab.film` prend une image avant, celles de `Page.startScreencast` (à
    chaque changement, acquittées une à une), une image à la fin. Essai : 78 à 80 images reçues
    en 1,2 s, une vingtaine d'écrans différents pour un carré qui glisse en 0,8 s.
    `browser_filmstrip` reprend les actions de `browser_batch` (sauf la capture).
  - **iOS** : le flux d'AXe a désormais plusieurs lecteurs (l'onglet et les planches) :
    `ios_filmstrip` reprend celui de l'onglet ou en démarre un le temps du film, l'onglet qui se
    ferme ne coupe pas une planche en cours. Gestes filmables : toucher, balayer, saisir,
    boutons, liens. Sans AXe, l'erreur renvoie vers `ios_screenshot`.
  - **Écarts** : planche de 1 568 px de côté au plus (et 1,15 million de pixels), pas 2 000 : au-delà,
    le modèle la réduit lui-même. Le moment des images iOS part de la première image reçue (le
    flux peut mettre quelques secondes à démarrer).
  - **Essais** : unitaires (choix des images, grille, numéros, planche, outils des deux panneaux) ;
    agent factice, scénarios `planche-contact` (page d'essai animée) et `planche-ios` (faux flux
    d'AXe qui alterne deux couleurs) ; e2e `browser` et `simulator` en clair et en sombre, en
    français et en anglais, captures regardées (`28-planche-contact`, `28c-planche-simulateur`).
    La suite `simulator` compare désormais le nom de la capture jointe avec `L()`.
  - **Reste** : Android (fiche à part : images brutes de `screenrecord`, ou décodage par la
    fenêtre) ; essai sur un vrai simulateur avec AXe.
- 2026-10-17 — **Essai avec les vrais agents.**
  - **Bob 2.0.6** (`pnpm bob-probe` d'abord : contrat inchangé depuis le 14) : dans une page
    animée, Bob a ouvert la page, appelé `browser_filmstrip` sur un clic au milieu, puis décrit
    les 8 images avec leurs moments (18 à 942 ms) : le carré qui glisse vers la droite, puis à
    moitié sorti du cadre — juste. Tour complet : 25 s.
  - **OpenCode 1.19** : pas d'essai possible. Les modèles gratuits de Zen (`big-pickle`,
    `mimo-v2.6-flash-free`) répondent « Rate limit exceeded », même à un appel direct
    (`opencode run`). À refaire plus tard, ou avec un compte.
  - Trouvé en route : le fil ne suivait pas l'image arrivée dans la carte (corrigé, fiche 050).
