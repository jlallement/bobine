# ADR-0026 — Navigateur intégré : on garde la vue native ; taille et annotation passent par le CDP

- **Statut** : accepté
- **Date** : 2026-10-23
- **Complète** : ADR-0006 (navigateur piloté par le protocole DevTools)

## Contexte

Après usage réel, le navigateur intégré a été jugé « pas utilisable » : page coupée, impossible à
faire défiler jusqu'en bas, pas de zoom, vue décalée quand l'interface est zoomée (fiche 129). La
page est une `WebContentsView` posée par le main au-dessus de l'onglet du panneau ; l'interface ne
peut rien dessiner par-dessus. Deux questions se posaient avant les fiches 129 et 132 (annoter la
page) : garder cette vue native, ou afficher la page autrement ; et comment faire tenir une taille
d'écran imposée par l'agent (`browser_resize`) dans un panneau plus petit.

La sonde de la fiche 129 (Electron 44.7.2) a montré que la vue native reçoit molette et clavier
sans réglage de focus, que `zoomMode: 'isolated'` donne un zoom propre à l'onglet, et que
`Emulation.setDeviceMetricsOverride` accepte un `scale` qui réduit l'écran émulé tout en gardant
clics natifs et défilement justes.

## Décision

- **On garde la vue native** (`WebContentsView`, une par onglet) : c'est un vrai Chromium, avec
  son défilement, sa sélection, ses popups et ses performances. Le main la pose en pixels de la
  fenêtre (zone mesurée en CSS par le renderer × zoom de l'interface).
- **La taille d'écran imposée par l'agent passe par le CDP** : `setDeviceMetricsOverride` avec
  `scale` ≤ 1 pour que l'écran émulé tienne entier dans la zone ; la vue native est ramenée à
  l'écran réduit, centrée en haut. L'émulation s'annule à la fin du tour de l'agent. Pas de menu de
  tailles pour l'utilisateur (décision de Jérôme, 23/10).
- **L'agent parle en pixels CSS de la page** (captures redimensionnées à la fenêtre CSS, clics,
  références) ; seule la couche CDP (`cdp-tab.ts`) convertit, en multipliant par `scale`.
- **Ce que l'interface doit dessiner sur la page** (annotation, fiche 132) se fait sur une image
  figée de la page (`capturePage`) affichée à la place de la vue native, et ce qu'il faut savoir
  de la page vient du CDP (`DOM.getNodeForLocation`…).

## Alternatives écartées

- **Afficher la page par `Page.startScreencast` dans un `<canvas>` de l'interface** — l'interface
  pourrait dessiner par-dessus, mais il faudrait réécrire entrées, défilement fluide, sélection,
  curseurs, champs de saisie natifs (IME), menus contextuels ; images JPEG en retard et floues.
  Beaucoup de code pour un résultat moins bon que Chromium.
- **`<webview>` dans le renderer** — déconseillé par Electron, et contraire à la règle
  « seul le main parle aux pages » (le renderer n'a pas de processus à piloter).
- **Redimensionner la vue native à la taille émulée, sans réduction** — c'était l'existant : la
  page déborde de la zone, son bas et sa droite deviennent inaccessibles.
- **Menu de tailles d'écran (Mobile, Tablette…) pour l'utilisateur** — écarté à la relecture des
  maquettes : la page suit la largeur du panneau, comme dans Claude Code.

## Conséquences

- L'interface ne peut toujours rien poser sur la page vivante : tout ce qui la recouvre (menus,
  fenêtres de l'app) masque la vue le temps de son ouverture, et l'annotation fige la page.
- Les essais par le CDP du renderer ne voient pas la vue native : les captures e2e la composent
  depuis le main (`capturePage`), et le comportement à la souris reste à essayer à la main.
- Sous émulation réduite, une page sans `<meta viewport>` en mode mobile a une échelle de page
  propre (980 px de large) : les coordonnées tirées d'une capture et celles de `getContentQuads`
  peuvent alors différer ; à surveiller si un agent s'y perd.
- Le zoom de la page (`isolated`) ne suit plus le site d'un onglet à l'autre, comme Chrome le fait
  par site : choix assumé, chaque onglet garde le sien.
