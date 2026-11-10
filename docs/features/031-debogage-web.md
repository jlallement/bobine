# 031 — Outils de débogage web : console, réseau, tailles d'écran, onglets

- **Statut** : fait
- **Dépend de** : 007

## Pourquoi

Ce que Claude Code fait pendant ses essais de non-régression : lire la console et les requêtes
réseau, exécuter du JavaScript, tester en mobile et en mode sombre, ouvrir plusieurs onglets.

## Critères d'acceptation

- [x] `browser_console` (erreurs seulement, motif, vider), `browser_network` (liste filtrée et corps
      d'une réponse), `browser_javascript` (inspection, `await` permis).
- [x] `browser_resize` : préréglages mobile / tablette / bureau et tailles libres ; clair / sombre
      (`prefers-color-scheme`).
- [x] Onglets : créer, choisir, fermer, lister (`browser_tabs`) ; bandeau d'onglets dans l'UI.
- [x] Testé : agent factice ; e2e.

## Plan

- **Pilotage par le protocole DevTools (CDP)** de chaque page (`webContents.debugger`, celui
  qu'utilise Playwright) au lieu des entrées Electron : relevé sur Electron 44 (sonde `cdp.cjs`),
  clics, saisie, touches et molette marchent **sans prendre le focus** à l'interface (le passage de
  focus de la fiche 007 disparaît) ; capture possible page masquée ; le débogueur ne s'attache
  qu'après une première page (`about:blank`), sinon ses commandes restent sans réponse.
- `BrowserManager` : plusieurs **onglets** par conversation (une `WebContentsView` chacun, un actif
  affiché) ; les liens « nouvelle fenêtre » ouvrent un onglet ; par onglet : console (300 dernières
  entrées : `console.*`, exceptions) et réseau (300 dernières requêtes, corps à la demande).
- Outils : `browser_console` (erreurs seulement, motif, vider), `browser_network` (liste filtrée par
  adresse, ou corps d'une réponse), `browser_javascript` (évaluation dans la page, `await` permis,
  dernière expression renvoyée), `browser_resize` (mobile 375×812, tablette 768×1024, bureau = taille
  du panneau, tailles libres ; clair / sombre), `browser_tabs` (lister, nouveau, choisir, fermer ;
  un nouvel onglet vers un site extérieur passe par l'accord par site).
- Captures et coordonnées en pixels CSS de la fenêtre émulée.
- UI : bandeau d'onglets au-dessus de la barre d'adresse dès qu'il y en a plusieurs (choisir,
  fermer) ; IPC `browser:selectTab`, `browser:closeTab`.

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-11 — Implémenté comme prévu. Tout le pilotage passe par le CDP (`cdp-tab.ts`) ; décision
  consignée dans l'ADR-0006 (pourquoi pas Playwright). `BrowserManager` gère les onglets. Tests des
  outils (console, réseau, JavaScript, taille, onglets avec accord par site) ; e2e `browserSuite`
  étendue (scénario `debogage-web` : erreur de console, requête 500 et son corps, 3 éléments comptés,
  « 375 px, sombre : true », deux onglets puis fermeture) — les vérifications de la fiche 007 passent
  telles quelles avec le CDP.
- 2026-10-11 — **Bob réel** (« vérifie qu'il n'y a aucune erreur dans la console, puis regarde s'il
  s'affiche bien sur mobile en mode sombre ») : `preview_start` → `browser_console` →
  `browser_screenshot` → `browser_resize` → `browser_screenshot`, aucune autorisation demandée ;
  « L'affichage mobile (375×812) en mode sombre est propre ». Coût : 0,150 bobcoin. Bob avait relevé
  un avertissement de sécurité d'Electron dans la console de la page : bruit de l'app non
  empaquetée, désormais filtré.
- 2026-10-11 — Lecture de la page par l'**arbre d'accessibilité de Chromium** au lieu d'un parcours
  maison du DOM (`ax-tree.ts`, testé sur un arbre type) : `browser_read_page` et `browser_find`
  renvoient rôles et noms calculés par le navigateur ; `ref_N` = nœud DOM (`backendDOMNodeId`),
  valable jusqu'à la navigation ; clic au centre du nœud (`DOM.getContentQuads`), saisie de champ
  par le setter natif (`Runtime.callFunctionOn`). Sur la page d'essai :
  `textbox "Nom" valeur="Ada"`, `button "Valider"`, `link "Page deux" → …/deux`. Limite : contenu
  des iframes non lu.
