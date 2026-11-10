# 129 — Navigateur : défilement, zoom, la page suit le panneau, `browser_resize` de l'agent

- **Statut** : fait (essai à la vraie souris à faire par la session de coordination)
- **Dépend de** : 007 (navigateur intégré), 031 (pilotage par le CDP, ADR-0006), 072 (popups),
  082 (panneau agrandi), 094 (navigateur et images)
- **Agents** : les deux (et tout agent ACP) : tout passe par Electron et le CDP, l'agent ne voit
  que les outils `browser_*` de l'app (ADR-0011, rien dans les profils).

Reprend les lots 129 et 130 de l'étude (`docs/feuille-de-route-2026-10-23.md`, itération 1),
réduits à la relecture des maquettes du 23/10 (maquettes `navigateur-1-panneau` et
`navigateur-2-agrandi` validées). Le bouton « Annoter » est la fiche 132 (vague 2).

## Pourquoi

Verdict de Jérôme après usage réel : « impossible de scroller, pas de zoom, il ne prend pas en
compte le responsive… pas utilisable ». Il veut le comportement de Claude Code : la page défile, et
son contenu suit la largeur de la colonne quand on la redimensionne, quand on agrandit ou réduit le
panneau. ⌘+ grossit la page qui a le focus (pas toute l'app, qui décalait la vue). Une taille
d'écran imposée par l'agent (`browser_resize`) ne coupe plus la page, et s'annule à la fin de son
tour. Pas de menu de tailles d'écran.

## Critères d'acceptation

- [x] Défilement à la molette, au trackpad et au clavier (espace, flèches) — vérifié par entrées
      natives simulées (`sendInputEvent`) ; à confirmer à la vraie souris.
- [x] Vue exacte avec l'interface zoomée de 80 à 150 % : la page native couvre exactement la zone.
- [x] Après un redimensionnement de la colonne ou un agrandissement du panneau, `innerWidth` de la
      page vaut la largeur de la zone de page.
- [x] ⌘+, ⌘− et ⌘0 agissent sur la page quand elle a le focus (zoom propre à l'onglet) ; la puce
      « 110 % » n'apparaît dans le champ d'adresse que hors de 100 %, et un clic la remet à 100 %.
- [x] Quand la page a le focus : ⌘L va au champ d'adresse, ⌘R recharge, ⌘[ et ⌘] reculent et
      avancent.
- [x] L'agent clique au bon endroit avec la page zoomée à 150 % (coordonnées en pixels CSS).
- [x] Après un `browser_resize`, la page entière est visible (réduite pour tenir) et se fait
      défiler ; au tour suivant, elle a repris la largeur du panneau.
- [x] Les captures e2e composent la vraie page (plus de zone blanche).
- [x] Générique : Electron et CDP, aucun code propre à un agent.
- [x] Testé : unitaires (conversions, paliers de zoom, raccourcis) et e2e avec l'agent factice
      (scénario `navigateur-vue` : défilement lu par `scrollY`, ⌘+, redimensionnement,
      `browser_resize`).

## Sonde (Electron 44.7.2, 23/10)

Deux scripts Electron jetables (une fenêtre, une ou deux `WebContentsView`, une page locale de
4 000 px de haut) ; entrées « natives » par `webContents.sendInputEvent`, celles de l'agent par le
CDP. Résultats :

| Question | Résultat |
|---|---|
| Molette native, focus sur l'UI / sur la page | défile dans les deux cas (3 crans = 360 px) |
| Effet de `Emulation.setFocusEmulationEnabled` | aucun sur la molette (avec ou sans) |
| Clavier natif (espace, ↓), focus UI / page | défile dans les deux cas : `sendInputEvent` vise la page quel que soit le focus. Au vrai clavier, la page doit avoir le focus (un clic dedans), comme dans Chrome |
| ⌘= envoyé par `sendInputEvent` | ne passe pas par le menu (aucun zoom) ; `before-input-event` de la page le voit (`keyDown`, `=`, `meta`) |
| Rôle `zoomIn` du menu, page au focus | zoome le webContents qui a le focus (la page) de +0,5 niveau (×1,095) |
| Zoom par défaut | par hôte : la page 2 du même hôte prend le zoom de la page 1 |
| `webPreferences.zoomMode: 'isolated'` (Electron 44) | zoom propre à l'onglet, gardé après navigation |
| Page zoomée à 150 % | `innerWidth` = 333 pour une vue de 500 ; `DOM.getContentQuads` et `Input.dispatchMouseEvent` en pixels CSS (le clic CSS tombe juste) ; `Page.captureScreenshot` en pixels de l'écran (1000 × 1200) |
| `setDeviceMetricsOverride` 375 × 812 avec `scale` 0,6 | `innerWidth` 375, page dessinée réduite en haut à gauche de la vue ; un clic natif en (x × 0,6, y × 0,6) tombe en (x, y) ; **le CDP aussi attend des coordonnées × `scale`** (en CSS non réduites, il tombe à côté) ; `getContentQuads` reste en CSS ; capture du CDP et `capturePage` : l'écran émulé entier, non réduit |
| Molette native sous émulation | défile ; le bas de la page s'atteint |
| `capturePage()` d'une vue masquée | marche (image de la dernière taille) |
| Zoom de l'interface 1,25 | `innerWidth` de l'UI 800 pour 1 000 DIP : le renderer parle en CSS, la vue se pose en DIP |

Conclusions :
- **Défilement** : la page native reçoit molette et clavier sans réglage de focus ; ce qui
  bloquait, c'est l'émulation de taille sans réduction (bas et droite de la page hors d'atteinte,
  relevé de la recette avec Bob) et la vue décalée par le zoom de l'interface. À confirmer à la
  vraie souris (voir « À essayer à la souris »).
- **Zoom** : `zoomMode: 'isolated'` à la création de la vue ; ⌘+ / ⌘− / ⌘0 pris dans
  `before-input-event` de la page (qui empêche aussi le raccourci du menu), et les entrées du menu
  Présentation choisissent leur cible (page au focus, sinon l'interface comme avant).
- **Coordonnées** : l'agent parle en pixels CSS de la page (captures redimensionnées à la fenêtre
  CSS, `innerWidth`) ; seul l'envoi au CDP multiplie par le `scale` de l'émulation.
- **`browser_resize`** : `scale` = min(1, largeur de la zone / largeur émulée, hauteur / hauteur),
  et la vue native est réduite à l'écran émulé × `scale`, centrée en haut de la zone.

## Plan

1. `src/main/browser/page-view.ts` (nouveau, fonctions pures, testées) : paliers de zoom de Chrome
   (25 % à 500 %), bornes CSS → DIP selon le zoom de l'interface, cadre d'une émulation (`scale`,
   bornes centrées), fenêtre CSS de la page, raccourcis de la page (`before-input-event`).
2. `cdp-tab.ts` : `Emulation` porte `scale` ; `setDeviceMetricsOverride` avec `scale` ; souris et
   molette du CDP multipliées par `scale`.
3. `browser-manager.ts` : vues en `zoomMode: 'isolated'` ; `show` convertit selon le zoom de
   l'interface ; `layout` pose la vue (zone entière, ou cadre réduit sous émulation, `scale`
   recalculé quand la zone change) ; zoom de la page, raccourcis, onglet au focus, fin de tour de
   l'agent ; `BrowserState` porte `zoom` et `emulation`. Le pilote de l'agent (`createDriver`)
   part dans `browser-driver.ts` (le fichier passerait 800 lignes) ; `viewport()` rend la fenêtre
   CSS.
4. `browser-tools.ts` : `browser_resize` dit la taille, la réduction et la fin au tour suivant.
5. `index.ts` : fin de tour (`turn-end`, `turn-error`) → émulation annulée. `menu.ts` : zoom
   avant / arrière / taille réelle par des entrées qui choisissent leur cible (plus de rôles), et
   ⌘= en plus de ⌘+.
6. IPC (fiche 114 : émetteur vérifié, comme toutes) : `browser:zoom`, `browser:clearEmulation`,
   évènement `browser:command` (⌘L). Préload et contrats.
7. `BrowserTab.tsx` : suivi par `ResizeObserver` (+ `resize` de la fenêtre, et un court suivi
   image par image quand un menu ou une fenêtre de l'app s'ouvre) ; puce de zoom et puce de taille
   imposée dans le champ d'adresse ; ⌘L. Styles, clés `fr.json` / `en.json`.
8. e2e : `ui.shot` compose les vues natives (`capturePage` dans le main) quand l'app a son
   inspecteur ; suite `browser-view` et scénario factice `navigateur-vue` (+ `docs/mock-agent.md`).
9. ADR-0026 (complète l'ADR-0006), `docs/architecture.md`, CHANGELOG.

Aucune dépendance nouvelle.

## À essayer à la souris

Les essais par le CDP ne voient pas la page native, et `sendInputEvent` ne passe ni par macOS ni
par le menu : à faire par la session de coordination, sur l'app buildée, page
`http://localhost:…` longue (ou un vrai site), en clair et en sombre.

1. **Molette et trackpad**, pointeur sur la page, *sans* avoir cliqué dedans (clavier resté dans
   la zone de saisie) : la page défile. Puis après un clic dans la page : idem. Défilement
   horizontal au trackpad sur une page plus large.
2. **Clavier** : clic dans la page, puis espace, ↓, ⇟ : elle défile. Clic dans la zone de saisie :
   espace écrit un espace dans le message, la page ne bouge pas.
3. **Colonne** : glisser la poignée du panneau lentement, puis vite : la page suit sans trou ni
   débord (aucune bande de l'interface visible entre la page et le bord), et son texte se remet en
   page. Agrandir puis réduire le panneau (bouton ⤢) : idem. Redimensionner la fenêtre ; replier
   la barre latérale panneau agrandi.
4. **Zoom de l'interface** : clavier dans la zone de saisie, ⌘+ deux fois, ⌘− trois fois, ⌘0 : la
   page reste exactement sur sa zone à chaque palier (bords de la barre d'adresse et du panneau).
5. **Zoom de la page** : clic dans la page, ⌘+ (et ⌘= sans Maj), ⌘−, ⌘0 : seule la page zoome,
   la puce « 110 % » apparaît dans l'adresse hors de 100 % ; un clic sur la puce revient à 100 %.
   Menu Présentation › Zoom avant à la souris, page au focus : la page zoome ; clavier dans la
   zone de saisie : l'interface zoome. Pincer au trackpad et Ctrl + molette : la puce suit.
   Deux onglets du même site : le zoom de l'un ne change pas l'autre.
6. **Raccourcis de la page**, clic dans la page d'abord : ⌘L sélectionne l'adresse (et ne va
   pas à la zone de saisie) ; ⌘R recharge la page (pas l'interface, même en `pnpm dev`) ; ⌘[ et ⌘]
   reculent et avancent. Hors de la page, ⌘L va toujours à la zone de saisie.
7. **Clics avec la page zoomée à 150 %** : demander à l'agent (OpenCode ou Bob) de cliquer sur un
   bouton par sa capture ou par sa référence : il tombe juste.
8. **`browser_resize`** : demander « essaie la page en mobile » : l'écran 375 × 812 apparaît
   réduit, centré en haut du panneau, entier ; il défile à la molette jusqu'en bas ; la puce
   « 375 × 812 » est dans l'adresse ; vrais clics justes dans la page réduite. Au message suivant
   (tour fini), la page a repris la largeur du panneau. Clic sur la puce pendant le tour : idem
   tout de suite.
9. **Menus et fenêtres** sur la page (menu « + » du panneau, Réglages, ⌘K) : la page se masque
   pendant qu'ils sont ouverts et revient ensuite, à la bonne place.

## Journal

- 2026-10-23 : fiche, sonde et plan.
- 2026-10-23 : fait.
  - `page-view.ts` (paliers de zoom de Chrome, bornes, cadre d'une émulation, fenêtre CSS,
    raccourcis), `browser-driver.ts` (pilote de l'agent sorti du gestionnaire), gestionnaire et
    `cdp-tab.ts` comme prévu ; `BrowserTab.tsx` suit la zone par `ResizeObserver`, `resize` de la
    fenêtre, et un suivi de 20 images quand un menu ou une fenêtre de l'app apparaît
    (`MutationObserver` filtré sur `.dialog-overlay` et `[role=menu]`) : plus de boucle à chaque
    image.
  - Tests : unitaires `page-view.test.ts`, `menu.test.ts` (entrées de zoom), `browser-tools.test.ts`
    (texte de `browser_resize`) ; e2e `browser-view` (clair et sombre) : vue exacte, molette et
    clavier lus par `scrollY`, colonne élargie, panneau agrandi et réduit, interface à 80 et
    150 %, « Taille réelle », ⌘+ / ⌘− dans la page, « Zoom avant » du menu page au focus, clic de
    l'agent à 150 %, puce, ⌘L, ⌘R, ⌘[, ⌘], `browser_resize` (page entière, défilement jusqu'en
    bas, fin du tour, puce de taille). Captures `28v` à `28z`, regardées.
  - Captures e2e : `ui.shot` (et la capture d'échec) compose les vues natives visibles quand l'app
    a l'inspecteur du main (`--inspect`) ; les suites sans lui gardent la capture seule.
- **Écarts au plan**
  - Défilement : la sonde n'a montré aucune dépendance au focus (molette et clavier natifs
    arrivent à la page dans les deux cas, `setFocusEmulationEnabled` sans effet) ; aucun code
    propre au focus. Ce qui empêchait de défiler : l'émulation non réduite et la vue décalée.
    À confirmer à la vraie souris (point 1).
  - **Puce de taille imposée** (« 375 × 812 ») dans l'adresse, en plus de celle du zoom, avec
    l'IPC `browser:clearEmulation` : sans elle, une page réduite sans explication ressemblerait à
    un défaut. Un clic rend la largeur du panneau. Hors maquette, même dessin que la puce de zoom.
  - Le **thème** imposé par l'agent (`color_scheme`) s'annule aussi à la fin de son tour, comme la
    taille : même problème d'état invisible qui survit.
  - Le menu Présentation garde ses entrées, sans les rôles d'Electron ; ⌘= (sans Maj) zoome aussi,
    par une entrée cachée.
  - Page au focus, ⌘L va à l'adresse et non plus à la zone de saisie (raccourci de l'app), comme
    dans un navigateur.
- **Vérifications** : `./scripts/verify` vert. `pnpm build && pnpm e2e --changed` (toutes les
  suites, des fichiers communs ayant changé), clair et sombre : premier passage, `browser-view`
  dépendait du focus natif (menu « Zoom avant ») et `about` s'est bloquée 5 min en parallèle
  (clic d'`attachPage` sur la fenêtre À propos qui se ferme, sans délai : fragilité antérieure,
  verte seule) ; second passage 111 / 112, le seul échec (`browser-view` : défilement doux de
  l'agent pas fini, machine chargée) corrigé, puis `browser-view`, `browser` et `panel` verts deux
  fois de suite en parallèle. Le contrôle du menu « Zoom avant », page au focus, ne se fait que
  si l'app a le focus natif (sinon une ligne le dit) : point 5 de l'essai à la souris.
- **Reste** : l'essai à la souris (section ci-dessus), par la session de coordination.
