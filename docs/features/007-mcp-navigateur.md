# 007 — Navigateur intégré piloté par l'agent

- **Statut** : fait
- **Dépend de** : 029

## Pourquoi

Comme le navigateur intégré de Claude Code Desktop : l'agent ouvre une page, la lit, clique, remplit
des formulaires, prend des captures ; l'utilisateur suit en direct dans le panneau et peut reprendre
la main. C'est ce qui permet à l'agent de vérifier lui-même ce qu'il vient de coder.

## Critères d'acceptation

- [x] Panneau « Navigateur » (`WebContentsView`) avec barre d'adresse, précédent / suivant,
      rechargement ; l'utilisateur peut cliquer et taper dans la même page.
- [x] Session Electron séparée et persistante pour le navigateur (pas les cookies de l'UI).
- [x] Outils (préfixe `browser_`) : `navigate` (URL, back / forward / reload), `screenshot` (avec
      réduction d'échelle), `read_page` (arbre d'accessibilité avec `ref_N`), `get_page_text`,
      `find`, `click` / `type` / `key` / `scroll` / `hover` / `drag` (coordonnées ou `ref`),
      `form_input`, `batch`.
- [x] Autorisation par site : la première visite d'un domaine externe par l'agent demande l'accord
      (carte de questions) ; local autorisé d'office ; un site ouvert par l'utilisateur est accordé.
- [x] Les captures apparaissent dans le fil (fiche 029).
- [x] Testé : agent factice qui pilote une page locale ; e2e ; Bob réel.

## Notes

ADR-0003. Bob annonce MCP `http`. Ne rien imposer à Bob (`--disable-mcp` existe).

## Plan

- `shared/browser.ts` : état d'une page (URL, titre, chargement, précédent / suivant), saisie de
  l'adresse → URL (`localhost:3000` → `http://`, sinon `https://`), hôtes locaux autorisés d'office.
- `main/browser/page-script.ts` : scripts exécutés dans un **monde isolé** de la page (le JavaScript
  de la page ne les voit pas) : arbre d'accessibilité avec références `ref_N`, texte de la page,
  recherche, position d'une référence, saisie de formulaire.
- `main/browser/browser-tools.ts` : module d'outils (`autoAllow`, onglet `browser`) écrit contre une
  interface `BrowserDriver` → testable sans Electron. Accord par site : carte de questions
  (« Autoriser l'agent à ouvrir exemple.com ? »), mémorisé pour la conversation.
- `main/browser/browser-manager.ts` : une `WebContentsView` par conversation, session
  `persist:bob-browser` (séparée de l'UI, permissions et téléchargements refusés, nouvelles fenêtres
  ouvertes dans la même vue), affichée par-dessus l'onglet du panneau ; entrées souris / clavier
  réelles (`sendInputEvent`, `insertText`) ; captures même vue cachée (`stayHidden`), mises à
  l'échelle des pixels CSS (coordonnées de la capture = coordonnées des clics).
- IPC : `browser:show` / `browser:hide` (emplacement de l'onglet), `browser:navigate`, `browser:go`,
  `browser:getState`, événement `browser:state`.
- Renderer : onglet « Navigateur » (précédent, suivant, recharger, barre d'adresse, zone réservée à
  la page).
- Hôte : `ToolContext` reçoit l'identifiant de conversation et `ask` (question à l'utilisateur, avec
  réponse tardive comme `ask_user`).
- Agent factice : scénario `navigateur` (page locale donnée par `MOCK_BROWSER_URL`).

## Journal

- 2026-10-11 — Fiche créée (inventaire des fonctionnalités manquantes, à trier).
- 2026-10-11 — Recentrée sur l'expérience Claude Code Desktop ; le serveur MCP générique passe dans
  la fiche 029.
- 2026-10-11 — Implémenté comme prévu (`shared/browser.ts`, `main/browser/page-script.ts`,
  `browser-tools.ts`, `browser-manager.ts`, `BrowserTab`, IPC `browser:*`, `ToolContext.ask` /
  `tellAgent`). Tests : adresses, outils contre une page simulée (accord par site, réponse tardive,
  références, lot), IPC ; e2e `browserSuite` (page locale : saisie, clic, lecture, capture, barre
  d'adresse, Précédent).
  - Relevé Electron 44 (sonde) : `insertText` et les événements clavier / molette ne sont traités
    que par une page qui a le focus. Saisie par `execCommand('insertText')` dans le monde isolé (sans
    focus) ; touches et molette : focus donné à la page le temps de l'action, puis rendu à l'UI.
    Molette : delta négatif = vers le bas. `capturePage` marche page masquée ou détachée.
  - Les captures e2e (CDP du renderer) ne montrent pas la vue native de la page : la vérification
    visuelle passe par la capture de l'agent dans sa carte d'outil.
  - **Bob réel** (quiz de `~/bob-essai` servi en local) : sans consigne sur les outils, Bob enchaîne
    `browser_navigate`, `browser_screenshot`, `browser_find`, `browser_click`, `browser_screenshot`,
    sans aucune demande d'autorisation, et conclut « après avoir cliqué sur "Canberra", le bouton
    s'est coloré en vert et un message "✅ Bonne réponse !" est apparu ». Coût : 0,160 bobcoin.
  - Remplacé par la fiche 031 : tout le pilotage passe désormais par le CDP (ADR-0006), qui n'a
    pas besoin du focus ; le passage de focus ci-dessus a disparu.
  - Limites : la navigation déclenchée par un clic dans la page n'est pas soumise à l'accord par site
    (seule l'est `browser_navigate`) ; un menu de l'UI qui déborde sur le panneau passe sous la page.
- 2026-10-14 — **Correctif** (trouvé par l'e2e `browser`, fiche 052) : fenêtre de l'app en
  arrière-plan (l'utilisateur dans une autre app), un clic de l'agent sur un champ ne lui donnait
  pas le focus : `browser_type` échouait (« No text field has focus ») et la page restait sans
  saisie. Le pilotage par le CDP n'a pas besoin que la fenêtre soit au premier plan, mais la page,
  si : `Emulation.setFocusEmulationEnabled` est maintenant activé pour chaque page du navigateur
  intégré (`cdp-tab.ts`). Reproduit à chaque passage avant (fenêtre d'essai derrière l'app de
  l'utilisateur), vert deux fois sur deux après.
- 2026-10-15 — Fiche 072 : popups (celles de l'utilisateur s'ouvrent, liées à leur page ; celles
  d'une action de l'agent sont bloquées et signalées), « Toujours autoriser » un site (retenu sur
  ce Mac), « Effacer les données du navigateur », cookies gardés ou non.

