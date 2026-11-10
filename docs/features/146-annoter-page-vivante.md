# 146 — Annoter une page vivante : défiler et zoomer en mode Annoter

- **Statut** : fait (essai à la vraie souris à faire, voir le journal)
- **Dépend de** : 132 (annoter la page au clic), 129 (navigateur : défilement, zoom, taille
  imposée), 067 (moteur d'annotation), 020 (file des messages), 114 (émetteur des IPC vérifié)
- **Agents** : les deux (et tout agent ACP) : tout se passe entre Bobine et Chromium (monde isolé,
  `Runtime.addBinding`, `capturePage`) ; l'agent reçoit un message ordinaire, texte et images
  (ADR-0011, rien dans les profils).
- **Maquette** : planche « Annoter une page vivante » validée par Jérôme le 24/10
  (maquette privée, non publiée), DOM dans
  `e2e/maquettes/screens-annoter.mjs`.
- **Décision** : ADR-0033 (remplace le dernier point de l'ADR-0026).

## Pourquoi

Retour de Jérôme après un essai réel (24/10) : « quand on passe en mode annotation il n'est plus
possible de scroller, zoomer etc. Donc on arrive pas à bien annoter ». La fiche 132 fige la page
sur une capture au premier clic : on n'annote qu'un écran. La page doit rester vivante (molette,
trackpad, pincement, ⌘+ / ⌘−) ; seul le clic change de sens.

## Critères d'acceptation

- [x] En mode Annoter, la vue native reste affichée : molette, trackpad, pincement et ⌘+ / ⌘− /
      ⌘0 agissent sur la page comme hors du mode. Bandeau : « Cliquez là où vous voulez laisser une
      remarque. La page défile et zoome comme d'habitude. » et « Échap pour finir ».
- [x] Un clic dans la page n'atteint pas la page (ni ses gestionnaires, ni un lien, ni un champ) :
      il pose une remarque. Curseur en croix ; l'élément sous le pointeur est entouré d'un contour
      d'accent.
- [x] Le clic fige la page le temps d'écrire (capture à la place de la vue, sans saut visible) :
      épingle du brouillon et bulle (« Annuler », « Ajouter ⌘↩ »), comme aujourd'hui ; « Ajouter »,
      « Annuler » ou Échap rendent la page vivante.
- [x] Les épingles enregistrées et leurs bulles sont dessinées sur la page, accrochées à leur
      élément : elles suivent le défilement (page et boîtes qui défilent), le zoom et les
      changements de mise en page ; élément disparu : dernière position connue. Un clic sur une
      épingle ou sa bulle rouvre la remarque (« Enregistrer », « Supprimer la remarque »).
- [x] Ce que l'app ajoute à la page vit dans un monde isolé et une racine fermée, n'existe qu'en
      mode Annoter et disparaît en le quittant ; le texte des remarques ne passe jamais par un
      champ de la page.
- [x] Échap, clavier dans la page ou dans l'onglet : ferme la bulle, sinon quitte le mode.
      Remarques gardées en quittant le mode, l'onglet ou la conversation ; « Annoter » les
      réaffiche sur la page vivante. Autre adresse : les épingles ne s'affichent que sur la page
      où elles ont été posées ; la barre les compte toutes.
- [x] Envoi : un message ; une capture par écran annoté, sans rien de ce que l'app dessine dans la
      page, chacune avec toutes les épingles qui y étaient visibles ; le plus petit nombre de
      captures qui montre chaque remarque. Le texte dit quelle remarque est sur quelle capture,
      avec le défilement et le zoom ; point, élément (jamais la valeur d'un champ), remarque, comme
      à la fiche 132.
- [x] Générique : Chromium seulement (monde isolé, binding CDP, `capturePage`) ; nouvelles IPC
      par le contrôle d'émetteur commun (fiche 114), messages de la page vérifiés dans le main.
- [x] Testé : unitaires (script de la page sous jsdom : clic intercepté, message, épingles
      placées ; messages vérifiés ; choix des captures ; message envoyé ; IPC) ; e2e
      `browser-annotate` réécrite contre l'agent factice (`echo`) : page qui défile en mode
      Annoter, clic qui n'atteint pas la page, deux remarques à deux hauteurs, épingle dessinée
      dans la page, page à 150 %, Échap depuis la page, envoi → deux images et les remarques.
      Captures clair et sombre.

## Plan

### Principe

Pendant le mode Annoter, la vue native reste posée. Un script lancé dans un **monde isolé créé par
le CDP** (`Page.createIsolatedWorld`, nom `bobine-annoter`) intercepte les clics en phase de
capture sur `window` et parle au main par un **binding** (`Runtime.addBinding`, limité à ce monde :
la page ne le voit pas). Il dessine épingles, bulles et contour dans un élément hôte à racine
fermée, repositionnés à chaque image d'après l'élément visé. Au clic, la page est figée comme à la
fiche 132 (capture avec les épingles, vue masquée) pour la bulle de saisie, qui reste dans Bobine.
La capture envoyée à l'agent est prise vue masquée, script caché : `capturePage({ stayHidden })`
redessine une page masquée (sondé sur Electron 45 ; `Page.captureScreenshot` et
`Input.dispatchMouseEvent` du CDP restent bloqués sur une page masquée).

### Main

1. **`src/main/browser/page-layer.ts`** (nouveau) :
   - `LAYER_SCRIPT` : le script de la page (sans `innerHTML`, pour les pages à Trusted Types) —
     écouteurs en capture (`pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`, `dblclick`,
     `auxclick`, `contextmenu` : `preventDefault` + `stopImmediatePropagation` ; `touchstart` /
     `touchend` : propagation arrêtée), survol (`mousemove`), feuille de style du curseur, hôte
     `<bobine-notes>` à racine fermée ; ancres (élément + fraction de sa boîte, position dans le
     document) gardées dans le monde tant que le document vit ; boucle `requestAnimationFrame`
     pendant le mode ; API `__bobineLayer` : `start(theme)`, `stop()`, `pins(list)`, `hide()`,
     `show()`. Élément décrit par la fonction `ELEMENT_AT` de la fiche 132, sur la cible du clic.
   - `parseLayerMessage(raw)` (pur, testé) : `place` (identifiant, point, position dans le
     document, élément, positions des épingles visibles) ou `open` (identifiant, positions) ;
     nombres finis, textes bornés, sinon `null`.
   - `PageLayer` (un par onglet) : crée le monde et le binding, réinstalle après une navigation
     (contexte perdu → recréé), `start` / `stop` / `pins` / `hidden(run)` avec délai maximal.
2. **`cdp-tab.ts`** : `Runtime.bindingCalled` → `onBinding(name, payload, contextId)`.
3. **`browser-manager.ts`** (peu de lignes : il délègue) : `annotate(id, on, theme)`,
   `pagePins(id, pins)`, `noteShot(id)` (capture propre, vue masquée, script caché) ; `freeze`
   rend aussi le zoom et redonne le clavier à l'interface ; Échap dans la page en mode Annoter →
   commande `annotate-escape` ; messages du script → `emitAnnotate`. `elementAt` disparaît (le
   script décrit lui-même l'élément cliqué).
4. **IPC** (`shared/ipc.ts`, `browser-ipc.ts`, `browser-controller.ts`, `browser-setup.ts`,
   préload) : `browser:annotate`, `browser:pagePins`, `browser:noteShot` (arguments vérifiés) ;
   évènement `browser:annotate` ; `browser:elementAt` retiré ; `BrowserCommand` gagne
   `annotate-escape`.

### Partagé

5. **`shared/page-notes.ts`** : `PageFreeze` gagne `zoom` ; `PageNote` gagne `url`, `doc` (position
   dans le document) et `shotId` ; `PageShot` (capture propre et positions des épingles visibles) ;
   `PagePin`, `PageLayerEvent`, `PageLayerTheme` ; `pageImages(shots, notes)` (le plus petit
   ensemble de captures, les plus récentes d'abord, qui montre chaque remarque) ;
   `pageFeedback(images, notes)` au format de la maquette (« Capture 1 (haut de la page) : »,
   « Capture 2 (défilée de 0 × 400 px, zoom 150 %) : »).

### Renderer

6. **`page-notes-store.ts`** : remarques et captures par conversation ; captures attendues comme
   les éléments (`settled`).
7. **`usePageAnnotation.ts`** : mode vivant, brouillon (page figée), évènements du script (`place`,
   `open`), capture propre demandée dès le clic, épingles envoyées au script (celles de l'adresse
   affichée) avec les couleurs du thème ; envoi : `pickShots`, une image par capture
   (`composePageImage`), `pageFeedback`.
8. **`PageAnnotator.tsx`** : n'affiche plus que la page figée du brouillon (capture, épingle du
   brouillon, bulle) ; bandeau et barre inchangés. **`BrowserTab.tsx`** : la vue reste posée en
   mode Annoter, masquée seulement pendant le brouillon ; Échap venu de la page.
   **`App.tsx`** : `onSendPageNotes(text, images)`.
9. Clés `browser.annotate.*` (fr, en) : le bandeau.

### Tests, e2e, docs

10. Unitaires : `page-layer.test.ts` (jsdom : clic intercepté, gestionnaire de la page non
    appelé, message ; épingles placées et suivies ; arrêt), `page-notes.test.ts` (`pickShots`,
    `pageFeedback`), `page-annotation.test.ts`, `ipc.test.ts`, `browser-ipc` (arguments).
11. e2e `browser-annotate` réécrite (clics et molette dans la vue par `sendInputEvent`, pixel
    d'une épingle dans la page) ; suites voisines si touchées (`browser`, `browser-view`).
12. Docs : cette fiche, ADR-0033, `architecture.md`, index, CHANGELOG fr et en, fiche 132 (renvoi).

Pas de nouvelle dépendance.

## Journal

### 2026-10-24 — plan

Maquette validée, deux sondes sur Electron 45 (journal de la planche) : page masquée — molette à
8 px sur 400, image inchangée, CDP bloqué ; page vivante — clic intercepté avant la page, binding
reçu, défilement de 300 px ; `capturePage({ stayHidden })` d'une page masquée suit le DOM
(43 ms).

### 2026-10-24 — fait

- **Fait** : tout le plan. Main : `page-layer.ts` (script de la page `LAYER_SCRIPT`, `PageLayer`,
  `parseLayerMessage`, `parsePins`, `parseTheme`, `pageSnapshot`), binding relayé par `cdp-tab.ts`,
  `browser-manager.ts` (`annotate`, `pagePins`, `noteShot`, `freeze` qui rend le clavier à
  l'interface, Échap dans la page), IPC `browser:annotate` / `browser:pagePins` /
  `browser:noteShot` et évènement `browser:annotate`, `browser:elementAt` retiré. Partagé :
  `PageFreeze.zoom`, `PageNote.url` et `doc`, `PageShot`, `pageImages`, `pageFeedback`. Renderer :
  `page-notes-store.ts` (remarques et captures), `usePageAnnotation.ts` (mode vivant, brouillon,
  évènements de la page, envoi en plusieurs images), `PageAnnotator.tsx` (page figée du brouillon
  seulement), `BrowserTab.tsx` (vue posée en mode Annoter, masquée pendant le brouillon). Bandeau
  et nom des images (« Page annotée 2 ») en fr et en.
- **Tests** : `page-layer.test.ts` (script sous jsdom : clic arrêté, gestionnaire de la page non
  appelé, élément décrit sans valeur de champ, épingles dans une racine fermée et rouvertes,
  page zoomée, caché puis rendu, arrêt ; messages et paramètres vérifiés ; couche avec un faux CDP :
  monde isolé, binding limité, navigation, contexte perdu, capture propre), `page-notes.test.ts`
  (choix des captures, message), `page-annotation.test.ts`, `ipc.test.ts`.
- **e2e** `browser-annotate` réécrite (entrées réelles dans la vue par `sendInputEvent`) : script
  dans la page, curseur en croix, la page défile en mode Annoter, le clic n'atteint pas le bouton
  (son compteur reste à 0), bulle sur page figée, ⌘↩, épingle d'accent lue au pixel dans la page,
  Échap dans la bulle, champ de saisie, remarque 1 300 px plus bas, page à 150 % (bouton sous le
  clic, épingle de 26 px à l'écran), Échap tapé dans la page (script parti, la page reçoit de
  nouveau ses clics), envoi : 3 blocs (texte, deux PNG), « en 2 captures jointes », capture 1
  défilée de 0 × 1300 px, capture 2 à 150 % avec les remarques 1, 2 et 4, pas de « secret-123 ».
  Captures `28p` à `28r` regardées en clair et en sombre.
- **`pnpm build && pnpm e2e --changed`** (124 tâches, toutes les suites : `App.tsx`, le préload et
  les traductions sont des sources globales) : 123 vertes ; `subagents` clair en échec (délai
  dépassé sur l'état « en cours » d'un sous-agent, suite sans lien avec la fiche), verte rejouée
  seule.
- **Écarts au plan**
  - La capture propre est prise à « Ajouter », page encore masquée, et non dès le clic : cacher le
    script pendant que la vue est encore affichée ferait clignoter les épingles. « Ajouter » attend
    la capture (une centaine de millisecondes) avant de rendre la page.
  - Le script suit lui-même le zoom de la page (`devicePixelRatio`, calé sur le zoom que le main
    lui donne au départ) : le menu Présentation, ⌘+, le pincement et `setZoomFactor` sont tous
    couverts sans évènement du main.
  - Bulles de la page réduites (jusqu'à 120 px) quand la page zoomée est plus étroite qu'elles.
  - L'élément du clic est décrit par le script de la page (même `ELEMENT_AT`) : plus de
    `DOM.getNodeForLocation`, qui aurait touché l'hôte des épingles.
  - Un clic à côté de la bulle vide rend la page vivante (avant : il posait une autre épingle sur
    la page figée).
  - Deux épingles au même point se recouvrent (remarques 1 et 4 de l'e2e) : laissé tel quel.
- **Non couvert par un essai automatique** : épingles réservées à leur adresse (filtre par
  `url`, sans e2e) ; page à taille imposée par l'agent ; mode mobile émulé (événements tactiles
  arrêtés) ; cadres.
- **À essayer à la vraie souris** (sur l'app buildée, page locale puis vrai site, clair et sombre) :
  1. « Annoter », puis défiler au trackpad (inertie), pincer, ⌘+ / ⌘− : la page suit, épingles et
     bulles collées à leur élément, même taille à l'écran.
  2. Survol : contour d'accent sur l'élément sous le pointeur, curseur en croix partout (liens
     compris).
  3. Clic : aucun saut entre la page vivante et la page figée ; bulle, ⌘↩ ; la page revient sans
     clignoter ; un lien ou un bouton de la page n'est jamais suivi.
  4. Clic sur une épingle ou sa bulle : la remarque se rouvre (« Enregistrer », corbeille).
  5. Échap, clavier dans la page puis dans l'onglet ; changer d'onglet ou de conversation et
     revenir : remarques gardées, « Annoter » les réaffiche.
  6. Envoyer avec Bob ou OpenCode : l'agent comprend quelle remarque est sur quelle capture.
