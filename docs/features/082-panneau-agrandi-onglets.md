# 082 — Panneau de droite : agrandi, onglets nommés

- **Statut** : fait
- **Dépend de** : 029, 035, 077
- **Agents** : les deux (interface seulement, rien ne passe par ACP)

## Pourquoi

Le panneau de droite (navigateur, simulateurs, terminal, tâches, modifications, aperçu) reste à
l'étroit : la conversation garde toujours 720 px, on ne peut pas regarder une page ou un diff en
grand. Et sa rangée de sept icônes est chargée : toujours les mêmes outils, même ceux qui ne
servent pas dans la conversation, et il faut survoler une icône pour savoir ce qu'elle est.

Décisions prises avec l'utilisateur (2026-10-19) :
- **Agrandi** : le panneau prend la place de la conversation et la sienne ; la barre latérale de
  gauche reste telle quelle. Pour reparler à l'agent, on réduit d'abord. (Écartée : une colonne
  étroite de conversation à côté du panneau agrandi.)
- **Onglets nommés** : seulement les outils qui servent dans la conversation, avec leur nom ; les
  autres dans un menu « + ». Revient sur le choix « icônes seules » de la fiche 029 (2026-10-12).
- Écarté pour ce lot : une largeur retenue par outil ; deux outils visibles à la fois.

## Critères d'acceptation

- [x] Bouton « Agrandir » dans l'en-tête du panneau : le panneau occupe la place de la conversation
      et la sienne, la barre latérale reste ; le même bouton (« Réduire ») rend la conversation.
      Double-clic sur la poignée de redimensionnement : même bascule.
- [x] Menu Affichage › « Agrandir le panneau » (⇧⌘J), dans la liste des raccourcis des réglages.
- [x] Agrandi, la conversation reste montée (fil, zone de saisie et brouillon intacts au retour),
      mais hors d'atteinte du clavier.
- [x] Agrandi, l'en-tête du panneau dit si l'agent travaille ou attend une réponse (autorisation,
      question, connexion) ; un clic réduit le panneau et ramène en bas du fil.
- [x] Changer de conversation, en créer une ou fermer le panneau le réduit. Agrandi ne survit pas
      au redémarrage.
- [x] Barre latérale masquée et panneau agrandi : le bouton pour la rouvrir est dans l'en-tête du
      panneau, qui laisse la place des boutons de la fenêtre.
- [x] Onglets avec leur nom (et un compte : modifications, tâches faites) pour les outils qui
      servent dans la conversation : outils de l'app appelés par l'agent (navigateur, iOS, Android,
      terminal), liste de tâches, modifications, aperçu ouvert ; plus l'onglet actif et ceux ouverts
      à la main. Ordre fixe. Panneau étroit : les onglets inactifs n'affichent que leur icône.
- [x] Menu « + » : les autres outils ; en choisir un l'ouvre et lui donne un onglet.
- [x] ✕ sur chaque onglet (toujours sur l'actif, au survol des autres) et clic molette : l'onglet
      quitte le panneau, l'outil continue (page, terminaux) et retourne dans « + ». Onglet affiché
      fermé : son voisin s'affiche ; dernier onglet fermé : le panneau se ferme. Un onglet fermé
      le reste, même après un redémarrage, jusqu'à ce qu'on le rouvre ou que l'agent se resserve
      de l'outil.
- [x] La page du navigateur intégré (vue native) ne recouvre pas le menu « + ».
- [x] Textes en français et en anglais.
- [x] Testé : tests unitaires (onglets visibles) ; e2e `panel` (onglets, menu « + », agrandi,
      état de l'agent pendant une demande d'autorisation de l'agent factice), captures claires et
      sombres ; suites qui montrent le panneau rejouées.

## Plan

- `src/renderer/src/panel-tabs.ts` (+ test) : `panelTabsUsed(items)` (groupes des outils de l'app
  du fil, sous-agents compris, liste de tâches) et `visiblePanelTabs(...)` (utilisés + actif +
  ouverts à la main + modifications + aperçu, dans l'ordre de `PANEL_TABS`).
  **Écart (fiche 154)** : l'ordre n'est plus celui de `PANEL_TABS` mais l'ordre d'arrivée, retenu
  par conversation : un onglet qui apparaît s'ajoute à droite et les autres ne bougent plus.
- `SidePanel.tsx` : onglets nommés avec compte, menu « + » (Radix, comme les autres menus), bouton
  Agrandir / Réduire, état de l'agent quand agrandi, bouton de la barre latérale, double-clic sur
  la poignée.
- `App.tsx` : `maximized` dans l'état du panneau (non mémorisé), onglets ouverts à la main par
  conversation (en mémoire), réduction au changement de conversation ; `main`, `BesidePane` et le
  panneau dans une zone commune : agrandi, le panneau la recouvre (`position: absolute`) et la
  conversation, dessous, reçoit `inert` — elle reste montée, sans `display: none` qui perdrait la
  position du fil.
- `shortcuts.ts` : commande `maximize-panel` (⇧⌘J, menu Affichage).
- `BrowserTab.tsx` : vue native masquée quand un menu ouvert la chevauche.
- `styles.css`, `fr.json` / `en.json`.
- e2e : `panel.mjs` (nouvelles vérifications et captures) ; captures des suites qui montrent le
  panneau (navigateur, simulateur, Android, terminal, modifications, aperçu) regardées.
- Pas de nouvelle dépendance.

## Journal

- 2026-10-19 — Fiche créée après discussion des maquettes avec l'utilisateur (décisions ci-dessus).
- 2026-10-19 — Implémenté comme prévu : `panel-tabs.ts` (+ test), `SidePanel` (onglets nommés,
  menu « + », Agrandir / Réduire, état de l'agent, bouton de la barre latérale, double-clic sur la
  poignée), `App` (zone `.workarea`, `maximized` non mémorisé, onglets ouverts par conversation en
  mémoire, `inert` sur la conversation et celle d'à côté), commande `maximize-panel` (⇧⌘J),
  `BrowserTab` (vue native masquée sous un menu ouvert), textes FR / EN, glossaire.
  - Choix de détail : l'état de l'agent reprend l'attention de la fiche 024 (`request` : demande
    en cours) et l'état « occupé » de l'agent ; une demande passe avant. L'onglet de l'agent
    (`panel-open`) et ceux choisis à la main restent dans la conversation jusqu'au redémarrage ;
    après, les onglets se déduisent du fil (outils de l'app appelés, tâches, modifications).
  - Panneau étroit : les onglets inactifs rétrécissent (nom coupé par « … ») jusqu'à leur seule
    icône, comme des onglets de navigateur ; l'actif garde son nom.
  - Agrandi, la liste de tâches garde la largeur du fil.
  - e2e `panel` : onglets, menu « + », agrandi (bouton, menu Affichage par le process principal,
    double-clic), barre latérale masquée, état « Attend votre réponse » (scénario `liste-taches`),
    retour au fil, réduction en changeant de conversation. Captures `23b` à `23e`, regardées.
  - e2e `browser` : la page native se masque sous le menu « + » et suit le panneau agrandi
    (largeur relevée dans le process principal : la page native n'est pas sur les captures).
  - Suite e2e complète passée (clair et sombre) ; captures des suites qui montrent le panneau
    (navigateur, iOS, terminal, modifications, aperçu) regardées.
  - Non couvert par un essai : le rétrécissement des onglets quand le panneau est étroit et
    plusieurs outils servent (pas de scénario qui en ouvre beaucoup) ; c'est du CSS seul.
- 2026-10-19 — **Bogue trouvé par l'utilisateur** au premier essai : en agrandi, impossible de
  saisir une adresse dans le navigateur. Cause : le fondu sous la barre de titre de la
  conversation (`.main-header::after`, 28 px) hérite de `-webkit-app-region: drag` ; macOS traite
  les zones `.drag` avant la page, quel que soit l'empilement. En agrandi, la conversation passe
  sous le panneau et cette bande tombe sur la barre d'adresse : le clic déplace la fenêtre au lieu
  de donner le focus. Les essais e2e ne pouvaient pas le voir : leurs clics (CDP) arrivent dans la
  page sans passer par la fenêtre macOS.
  - Correctif : le panneau agrandi est `no-drag` (posé après la conversation dans la page, il
    annule ses zones ; son en-tête redevient déplaçable), comme les fenêtres et menus de l'app ; et
    le fondu lui-même est `no-drag` (il rendait aussi « déplaçables » les 28 premiers pixels du fil
    en temps normal).
  - Vérifié à la vraie souris et au vrai clavier (app lancée par un script d'essai, pilotée par
    macOS) : sans le correctif, le clic dans la barre d'adresse ne prend pas le focus et ⌘A
    sélectionne la fenêtre ; avec, saisie et Entrée marchent, ainsi que onglets, menu « + »,
    Réduire / Agrandir (bouton et ⇧⌘J) et le déplacement de la fenêtre par l'en-tête du panneau.
  - e2e `panel` : vérifie la règle (zones `drag` / `no-drag` calculées) — un garde-fou, pas la
    preuve : seul un vrai clic la donne.
- 2026-10-19 — **Fermer un onglet** (demande de l'utilisateur après essai : un outil ouvert par
  « + » ne pouvait plus quitter le panneau ; le ✕ était dans la première maquette et avait été
  oublié). `panel-tabs.ts` : onglets fermés (`closed`, l'onglet affiché passe toujours),
  `tabAfterClose`, onglets fermés gardés dans `localStorage` (100 conversations au plus) ;
  `App` : un onglet affiché n'est plus fermé (rouvert par « + », un bouton de l'en-tête, ou
  demandé par l'agent) ; l'aperçu se ferme par le même chemin (onglet voisin au lieu de fermer le
  panneau). `SidePanel` : l'onglet devient un groupe (bouton de l'onglet + bouton ✕, un bouton ne
  pouvant en contenir un autre), clic molette.
  - Panneau étroit : les onglets inactifs réduits à leur icône n'ont pas la place du ✕ ; le clic
    molette les ferme, ou on les active d'abord.
  - Vérifié : tests unitaires, e2e `panel` (✕ sur l'onglet affiché, rouvert par « + », clic
    molette, dernier onglet, retenu), capture `23f` ; à la vraie souris : clic molette sur une
    icône, ✕ au survol d'un onglet inactif, ✕ du dernier onglet puis réouverture du panneau.
  - Suite e2e complète rejouée : tout passe sauf `rules` (« règle personnelle ouverte en
    aperçu »), instable **avant ce lot** : sur la version commitée, 3 échecs sur 6 (le clic du
    menu des réglages de la session ouvre `tests.md`, la ligne au-dessus de `style.md`). Corrigé
    à part, dans l'app (journal de la fiche 056).
