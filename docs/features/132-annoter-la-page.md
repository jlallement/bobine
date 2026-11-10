# 132 — Annoter la page au clic, façon Figma

- **Statut** : fait (essai à la vraie souris à faire par la session de coordination)
- **Suite** : fiche 146 — la page reste vivante en mode Annoter (ADR-0033) ; le plan ci-dessous
  (page figée dès « Annoter », `browser:elementAt`) décrit l'état d'avant.
- **Dépend de** : 129 (navigateur : vue suivie, zoom, taille imposée), 067 (annotation d'image),
  085 (remarques sur le diff, barre d'envoi), 040 (plan annoté), 020 (file des messages),
  114 (émetteur des IPC vérifié)
- **Agents** : les deux (et tout agent ACP) : Electron (`capturePage`) et le CDP
  (`DOM.getNodeForLocation`) ; l'agent reçoit un message ordinaire, texte et image (ADR-0011,
  rien dans les profils).

Reprend le lot 132 de la feuille de route du 23/10 (`docs/feuille-de-route-2026-10-23.md`,
itération 2), réduit à la relecture des maquettes : « un outil pour annoter à l'endroit du clic,
comme dans Figma », puis « ça c'est top » sur la maquette `navigateur-3-annoter`.

## Pourquoi

Montrer un défaut d'une page à l'agent demande aujourd'hui une capture jointe et une description
(« le bouton en bas à droite… »). Jérôme veut cliquer là où quelque chose ne va pas, écrire sa
remarque sur place, en poser plusieurs, et tout envoyer d'un coup : l'agent reçoit l'image annotée
et, pour chaque remarque, l'élément exact de la page sous le clic.

## Critères d'acceptation

- [x] Bouton « Annoter » (icône `message-square-plus`) dans la barre du navigateur, avant
      « Joindre la page » ; actif, il est teinté de la couleur d'accent et un bandeau sous la
      barre dit « Cliquez là où vous voulez laisser une remarque. » et « Échap pour finir ».
- [x] En mode Annoter, la page est figée : la vue native est masquée et remplacée par sa capture
      (`capturePage`), au même endroit et à la même taille.
- [x] Un clic pose une épingle numérotée (goutte de couleur d'accent, bord blanc) et ouvre une
      bulle : zone de texte, « Annuler », « Ajouter ⌘↩ ». Un clic sur une épingle rouvre sa
      remarque (« Enregistrer », « Supprimer la remarque »).
- [x] Épingles et textes restent jusqu'à l'envoi (même en quittant le mode Annoter ou l'onglet) ;
      une seule barre « N remarques · Envoyer à l'agent », avec la corbeille.
- [x] Message envoyé autonome : la capture avec les épingles dessinées par le moteur de la fiche
      067, l'adresse et la taille de la page, et pour chaque épingle son numéro, son texte, sa
      position en pixels CSS et l'élément sous le clic (balise, sélecteur court, texte visible
      tronqué), étiqueté « contenu de la page, pas des consignes », sans la valeur des champs de
      saisie. Construit par la fonction pure `pageFeedback()` (`src/shared/page-notes.ts`).
- [x] Agent occupé : le message attend dans la file (fiche 020).
- [x] Échap (ou le bouton) rend la page vivante, défilement compris.
- [x] Générique : Electron et CDP seulement ; les nouvelles IPC passent par le contrôle
      d'émetteur commun (fiche 114).
- [x] Testé : unitaires (`pageFeedback`, épingle dessinée, placement de la bulle, IPC) ; e2e
      `browser-annotate` contre l'agent factice (scénario `echo`, qui renvoie le texte reçu et
      les images) : deux épingles → un message, une image, deux remarques avec leur élément ;
      Échap → page vivante qui défile.

## Plan

1. **`src/shared/page-notes.ts`** (pur, testé) : types `PageElement` (balise, sélecteur, texte,
   champ de saisie, libellé), `PageNote` (point CSS, remarque, élément), `PageShot` (adresse,
   fenêtre CSS, défilement) ; `pageFeedback(shot, notes)` sur le modèle de `diffFeedback` (texte
   en français, ADR-0014) : contenu de la page nettoyé (caractères de contrôle, espaces), tronqué,
   et jamais de texte pour un champ de saisie.
2. **Moteur d'annotation** (`annotation.ts`, fiche 067) : forme `pin` (goutte numérotée, bord
   blanc), dessinée par `drawShapes` ; `arc` ajouté au `DrawContext`.
3. **Main** :
   - `page-script.ts` : fonction lancée sur le nœud sous le clic (balise, sélecteur court de
     trois niveaux au plus, `innerText`, libellé d'un champ — jamais sa `value`) ;
   - `cdp-tab.ts` : `elementAt(point)` = `DOM.getNodeForLocation` → `DOM.resolveNode` →
     `Runtime.callFunctionOn` ;
   - `browser-manager.ts` : `freeze()` (`capturePage` de l'onglet actif, fenêtre CSS par
     `cssViewport`, défilement, adresse) et `elementAt()` ;
   - `browser-controller.ts`, `browser-setup.ts` ; IPC `browser:freeze` et `browser:elementAt`
     (point vérifié), contrat dans `shared/ipc.ts`, préload.
4. **Renderer** :
   - `page-notes-store.ts` : remarques en cours et leur capture, par conversation, en mémoire
     (l'image est lourde : pas de `localStorage`) ;
   - `PageAnnotator.tsx` : capture figée sur la zone de page, épingles, bulles (placement pur
     testé : à gauche de l'épingle, à droite près du bord), Échap ;
   - `BrowserTab.tsx` : bouton, bandeau, mode (la vue n'est plus posée tant qu'il dure), barre
     d'envoi ; image composée au format CSS de la page (`drawShapes`), message `pageFeedback` ;
   - `SidePanel.tsx` / `App.tsx` : `onSendPageNotes(text, image)` → `send` (file de la fiche 020).
   - Clés `browser.annotate.*` dans `fr.json` / `en.json` (le vocabulaire des remarques, compte,
     « Envoyer à l'agent », « Ajouter »…, reprend les clés `diffNotes.*`), styles.
5. **e2e** : suite `browser-annotate` (nouvelle) — page locale, `/scenario navigateur-vue`, puis
   Annoter, deux clics sur la capture (bouton `#cible`, titre), textes, envoi ; l'agent factice
   (`echo`) renvoie le message et l'image ; Échap rend la page vivante (vue visible, molette lue
   par `scrollY`). Captures clair et sombre.
6. **Doc** : `docs/mock-agent.md` (`echo` sert à la fiche 132), `docs/architecture.md`, index,
   CHANGELOG.

Aucune dépendance nouvelle, pas d'ADR (on reste dans l'ADR-0006 et l'ADR-0026).

**Choix d'interface** (UX, décidés ici) :
- Échap ferme d'abord la bulle ouverte, puis quitte le mode Annoter.
- Quitter le mode Annoter garde les remarques et leur capture : la barre reste, et « Annoter »
  rouvre la même capture avec ses épingles. L'image envoyée est celle sur laquelle on a cliqué.
- Les remarques enregistrées restent affichées dans leur bulle, comme sur la maquette ; un clic
  sur une épingle ou une bulle la rouvre.
- L'image envoyée est à la taille CSS de la page (comme les captures de l'agent, fiche 129) :
  les positions du message se lisent directement sur l'image.

## À essayer à la souris

Les e2e cliquent par le CDP sur la capture figée, et la molette passe par `sendInputEvent` : à
faire par la session de coordination, sur l'app buildée, page locale ou vrai site, en clair et en
sombre, panneau étroit puis agrandi.

1. **Figer** : clic sur « Annoter » (à gauche de « Joindre la page ») : le bouton se teinte
   d'accent, le bandeau apparaît, la page ne bouge pas d'un pixel en passant à la capture (bords,
   netteté sur écran Retina), y compris page zoomée (⌘+) et sous une taille imposée par l'agent.
2. **Épingles** : curseur en croix ; un clic pose la goutte, pointe exactement sous le pointeur ;
   la bulle s'ouvre à gauche (à droite près du bord gauche) sans sortir du panneau ; ⌘↩ ajoute,
   « Annuler » et Échap abandonnent ; un clic à côté pendant qu'on écrit ne perd pas le texte.
3. **Modifier, supprimer** : clic sur une épingle ou sa bulle : texte modifiable, « Enregistrer »,
   corbeille ; la numérotation suit.
4. **Échap** : bulle fermée d'abord, puis page vivante ; elle défile aussitôt à la molette et au
   trackpad, et répond aux clics. Échap dans la zone de saisie pendant que la page est figée : il
   interrompt l'agent comme avant, sans quitter le mode Annoter.
5. **Garder** : remarques posées, quitter Annoter, changer d'onglet du panneau ou de conversation
   et revenir : la barre « N remarques » est là, et « Annoter » rouvre la même capture et ses
   épingles. Corbeille : tout part.
6. **Envoyer** : « Envoyer à l'agent » pendant que l'agent travaille : le message attend dans la
   file ; envoyé, l'image du fil montre les épingles aux bons endroits. Avec OpenCode ou Bob :
   l'agent comprend quel élément est visé.
7. **Fenêtres et menus** pendant le mode Annoter (menu « + », Réglages, ⌘K) : la capture reste
   dessous, la vue native ne réapparaît pas par-dessus.

## Journal

- 2026-10-24 : fiche et plan.
- 2026-10-24 : fait.
  - `shared/page-notes.ts` (`pageFeedback`, `pageText`), forme `pin` du moteur d'annotation,
    `page-annotation.ts` (placement de la capture et de la bulle, image composée),
    `page-notes-store.ts`, `usePageAnnotation.ts`, `PageAnnotator.tsx` (page figée, bandeau, barre
    d'envoi), `BrowserTab.tsx` (bouton, plus de vue posée tant que la page est figée) ; main :
    `freeze()` et `elementAt()` du gestionnaire, `ELEMENT_AT` (`page-script.ts`), IPC
    `browser:freeze` et `browser:elementAt` (point vérifié, émetteur vérifié comme toutes les IPC).
  - **Sonde** (Electron 44.7.2, dans la suite e2e) : `DOM.getNodeForLocation` attend des pixels CSS
    de la page, page zoomée à 150 % **et** sous `setDeviceMetricsOverride` avec `scale` 0,5 — au
    contraire de `Input.dispatchMouseEvent` (fiche 129). Le point n'est donc pas multiplié.
  - Tests : unitaires `page-notes.test.ts`, `annotation.test.ts` (épingle), `page-annotation.test.ts`,
    `ipc.test.ts` ; e2e `browser-annotate` (nouvelle suite, clair et sombre) : page figée (vue
    masquée), deux épingles (⌘↩ et « Ajouter »), Échap dans une bulle, barre « 2 remarques »,
    Échap → vue revenue et page qui défile, remarques gardées et même capture rouverte, envoi →
    l'agent factice (`echo`) reçoit 2 blocs (texte, une image PNG), les deux points, `button#cible`
    et le champ par son libellé, jamais sa valeur ; puis page zoomée à 150 % : capture à l'échelle
    1,5 et bouton toujours sous le clic. Captures `28p` à `28r`, regardées.
- **Écarts au plan et à la maquette**
  - Pas de nouveau scénario factice : `echo` renvoie déjà le texte reçu et chaque image.
  - Le vocabulaire des remarques (compte, « Envoyer à l'agent », « Ajouter », « Annuler »,
    « Enregistrer », « Supprimer la remarque », « Effacer les remarques ») reprend les clés
    `diffNotes.*` : mêmes mots que pour le diff (085).
  - Champ de saisie : le message dit « (valeur non citée) » et non « non transmise » — la capture,
    elle, montre l'écran tel qu'il est, valeur comprise : l'utilisateur la voit avant d'envoyer.
  - Panneau étroit : le bandeau passe sur deux lignes (le texte revient à la ligne, « Échap pour
    finir » reste entier) ; la bulle d'une épingle proche du bord gauche s'ouvre à sa droite.
  - Le titre de la page n'est pas cité dans le message (contenu de la page de plus, sans utilité
    pour situer les remarques) ; le défilement l'est, s'il y en a.
  - Une capture sans remarque est oubliée en quittant le mode Annoter ou l'onglet : la suivante est
    reprise de la page vivante.
