# 094 — Navigateur et images : téléchargements, branche, retours, annotation

- **Statut** : fait
- **Dépend de** : 007 (navigateur intégré), 023 (repartir d'un message), 066 (joindre la page),
  067 (annotation), 072 (popups et autorisations), 082 (panneau agrandi)
- **Agents** : les deux — rien de propre à un agent (outils de l'app, interface).

## Pourquoi

Essai libre du 2026-10-20 avec OpenCode + GPT-6.1 Sol (rapport :
`docs/recettes/2026-10-20-essai-libre-opencode-gpt.md`, dépôt principal) : quatre accrocs du
navigateur intégré et des images.

1. **Téléchargements bloqués en silence** (`will-download` → `preventDefault`) : le bouton
   « Exporter » (CSV) d'une page du projet ne fait rien, sans un message. Pour qui teste un export,
   c'est une impasse.
2. **Navigateur vide dans une branche** (« Repart de ce message ») : panneau vide, barre d'adresse
   effacée, alors que le serveur de dev du projet tourne.
3. **« Joindre cette page au message » en panneau agrandi** : aucun retour, la zone de saisie étant
   cachée ; on ne sait pas que ça a marché.
4. **Annotation** : un texte long ne revient pas à la ligne et sort de l'image, à l'écran comme dans
   l'image envoyée.

## Décision de l'utilisateur (2026-10-20)

Téléchargements : une **fenêtre native « Enregistrer sous » à chaque téléchargement**. Rien n'arrive
sur le disque sans un clic de l'utilisateur, même si c'est l'agent qui déclenche le téléchargement.
Annuler ne fait rien. Le blocage venait des fiches 007 et 072 (« comme Claude Code »), pas d'un
ADR : la nouvelle règle est posée par l'**ADR-0018**.

## Critères d'acceptation

- [x] Téléchargement lancé par la page (clic de l'utilisateur ou action de l'agent) : fenêtre native
      « Enregistrer sous » sur la fenêtre de l'app, dossier Téléchargements et nom proposé par la
      page ; son message dit d'où vient le fichier et si c'est l'agent qui l'a lancé.
- [x] Rien n'arrive dans un dossier de l'utilisateur avant « Enregistrer » (les données attendent
      dans le dossier de l'app, voir l'ADR-0018) ; « Annuler » ne laisse rien et n'affiche rien.
- [x] Fichier enregistré : retour bref sous la barre d'adresse (« Fichier enregistré : export.csv »),
      avec « Afficher dans le Finder » ; échec : un message.
- [x] Téléchargement déclenché par une action de l'agent : le résultat de l'outil lui dit (en
      anglais) que la décision revient à l'utilisateur et qu'il ne sert à rien de réessayer ; à
      l'outil suivant, ce que l'utilisateur a fait (enregistré, et où ; annulé ; échec).
- [x] ADR-0018 écrit (accepté), index des ADR à jour.
- [x] Branche : le panneau Navigateur reprend la page de l'onglet actif de la conversation d'origine.
- [x] Panneau agrandi : « Joindre cette page au message » (ou l'écran d'un appareil) affiche « Page
      jointe au message » dans l'en-tête du panneau ; un clic dessus revient à la conversation.
- [x] Annotation : un texte long revient à la ligne (au plus 20 fois la taille du texte, jamais
      au-delà du bord de l'image), pareil à l'écran et dans l'image envoyée ; Maj+Entrée pour aller
      à la ligne soi-même.
- [x] Testé contre l'agent factice : scénario `telechargement` (clic sur « Exporter », note rendue à
      l'agent, fichier enregistré ou annulé) ; e2e `browser` (téléchargement, annulation, clic de
      l'utilisateur, branche, retour « Page jointe » agrandi) et `annotate` (texte long), clair et
      sombre.
- [x] Essai réel à la souris : vraie fenêtre « Enregistrer sous » (enregistrer, annuler), clic réel
      sur « Page jointe au message » dans l'en-tête agrandi (zone de déplacement de la fenêtre).
      Fait après la fusion, le 2026-10-20 (voir le journal).

## Plan

**Téléchargements** (ADR-0018)
- `src/main/browser/downloads.ts` (nouveau) : suivi d'un `DownloadItem` — options de la fenêtre
  « Enregistrer sous » (`setSaveDialogOptions` : titre, message selon l'origine ; dossier et nom par
  défaut d'Electron, Téléchargements), fin (`done` : enregistré, annulé, échec). La fenêtre est celle
  d'Electron : il n'écrit rien avant le choix (le chemin cible n'est fixé qu'après), alors qu'une
  fenêtre ouverte par nous obligerait à télécharger d'abord dans un dossier temporaire.
  *Revu à la mesure, voir le journal : c'est notre fenêtre, avec un dossier d'attente de l'app.*
- `browser-manager.ts` : `will-download` ne bloque plus ; retrouve l'onglet (ou la popup) et donc la
  conversation ; action de l'agent si l'onglet est dans sa fenêtre de grâce (comme les popups,
  fiche 072). Notes pour l'agent par conversation (`takeDownloads`), chemins enregistrés retenus
  pour « Afficher dans le Finder ». `inherit(branche, originale)` pour la branche (plus bas).
- `browser-tools.ts` : `BrowserDriver.downloads()` ; la note des popups devient « notes de la page »
  (popups bloquées, téléchargements), en anglais.
- `browser-setup.ts` : évènement `browser:download` vers l'interface ; `showDownload` (le chemin
  doit être un fichier enregistré depuis cette conversation) → `shell.showItemInFolder`.
- `src/shared/browser.ts` : `BrowserDownload` ; `src/shared/ipc.ts`, `src/preload/api.ts`,
  `src/main/ipc.ts` : `browser:download` (évènement), `browser:showDownload` (une entrée chacun).
- `BrowserTab.tsx` : bandeau bref sous la barre d'adresse (comme `browser-error`) : nom du fichier,
  « Afficher dans le Finder », fermeture ; il s'efface seul.

**Branche**
- `BrowserManager.inherit(to, from)` : si la branche n'a pas encore de page et que l'originale en a
  une (http/https), un onglet s'ouvre sur l'adresse de son onglet actif.
- Appelé à la création de la branche : `src/main/ipc.ts`, `conversation:branch` (une ligne), via
  `BrowserController.inherit`. Pas de changement dans `conversations/manager.ts`.

**« Page jointe au message »**
- `SidePanel.tsx` : en panneau agrandi, l'image jointe (page ou écran) affiche un retour dans
  l'en-tête, à côté de l'état de l'agent (même place : ce qui arrive à la conversation qu'on ne voit
  plus) ; un clic revient à la conversation ; s'efface au bout de quelques secondes. Pas dans le
  corps de l'onglet : la page native du navigateur le couvrirait.

**Annotation**
- `src/renderer/src/annotation.ts` : `wrapText` (mots, puis caractères pour un mot trop long ;
  retours à la ligne gardés), `textFrame` (début et largeur du bloc : 20 em au plus, borné par le
  bord droit de l'image ; décalé à gauche s'il reste moins de 8 em), dessin ligne par ligne, bloc
  remonté s'il dépasse en bas. `DrawContext` gagne `measureText`.
- `ImageAnnotator.tsx` : saisie en `textarea` (même police, même largeur que le dessin, hauteur qui
  suit le texte) ; Entrée valide, Maj+Entrée va à la ligne.

**Tests et docs**
- Unitaires : `annotation.test.ts` (retour à la ligne, cadre), `browser-tools.test.ts` (notes de
  téléchargement), `mock-agent.test.ts` (scénario).
- Agent factice : scénario `telechargement` (`src/mock-agent/scenarios.mts`, après `popup`) ;
  `docs/mock-agent.md`.
- e2e : `browser` (page `/export` ; dans le main, `dialog.showSaveDialog` remplacé joue le choix
  de l'utilisateur — enregistrer, annuler — et note ce qu'il y a sur le disque à ce moment-là ;
  branche ; retour « Page jointe » agrandi), `annotate` (texte long). La vraie fenêtre « Enregistrer
  sous » ne se pilote pas par le CDP : essai à la souris.
- Docs : ADR-0018 et son index, `docs/architecture.md` (ligne du navigateur), fiche.
- Pas de nouvelle dépendance.

**Hors de mes fichiers** (sessions parallèles 092 à 096) : `src/main/ipc.ts`, `src/shared/ipc.ts`,
`src/preload/api.ts` (une entrée chacun), `src/renderer/src/annotation.ts`,
`src/mock-agent/scenarios.mts`, `docs/mock-agent.md`, `docs/architecture.md`.

## Journal

- 2026-10-20 — Fiche créée (session 3 de la suite de l'essai libre). Le raccourci ⌥⌘J cité pour
  « Joindre cette page » n'existe pas dans l'app (`shared/shortcuts.ts`) : seul le bouton de la
  barre d'adresse est concerné (⇧⌘J agrandit le panneau).
- 2026-10-20 — **Fait** (branche `claude/fiche-094-navigateur-images-d6f5d3`).
  - **Téléchargements** : `downloads.ts` (`saveDownload`, dépendances injectées, testé sans
    Electron) ; `BrowserManager` : `will-download` → onglet ou popup d'origine, action de l'agent si
    l'onglet est dans sa fenêtre de grâce (comme les popups), `dialog.showSaveDialog` en feuille sur
    la fenêtre, notes pour l'agent (`takeDownloads`), fichiers enregistrés retenus par conversation
    pour `showDownload` (« Afficher dans le Finder » n'ouvre rien d'autre). Outils : la note des
    popups devient `withPageNotes` (popups et téléchargements). IPC : évènement `browser:download`,
    `browser:showDownload`. Bandeau `DownloadNotice` sous la barre d'adresse, effacé au bout de 8 s ;
    le nom du fichier passe à la ligne dans un panneau étroit plutôt que d'être coupé.
  - **Écart au plan, mesuré** : la fenêtre « Enregistrer sous » d'Electron (sans `setSavePath`)
    laisse Chromium écrire les données dans un fichier caché de ~/Downloads
    (`.com.github.Electron.XXXX`, 200 Ko vus pendant que la fenêtre était ouverte), supprimé à
    l'annulation mais laissé si l'app s'arrête ; `session.setDownloadPath` ne le déplace pas. D'où
    notre propre fenêtre : `setSavePath` vers `<données>/downloads-pending/<uuid>/`, décision, puis
    déplacement (ou copie entre volumes) à l'endroit choisi ; dossier vidé à l'annulation et au
    démarrage. Rien n'arrive dans un dossier de l'utilisateur sans son clic ; au sens strict, les
    octets en cours de téléchargement touchent le disque de l'app avant (comme dans tout
    navigateur) — dit dans l'ADR-0018. Bonus : la fenêtre se remplace dans les e2e.
  - **ADR** : le blocage venait des fiches 007 et 072, pas d'un ADR ; aucun ADR à remplacer.
    ADR-0018 (accepté, décision de l'utilisateur du 2026-10-20).
  - **Branche** : `BrowserManager.inherit` ouvre l'adresse de l'onglet actif de l'originale (http
    ou https) si la branche n'a pas de page ; appelé par `conversation:branch` dans `ipc.ts`, sans
    toucher à `conversations/manager.ts`. La page se recharge (GET) : un formulaire envoyé n'est pas
    rejoué.
  - **« Page jointe au message »** : pastille dans l'en-tête du panneau agrandi, à côté de l'état de
    l'agent, 3 s, un clic revient à la conversation ; « Écran joint au message » pour le simulateur
    et Android (même bouton). Annoncée aussi aux lecteurs d'écran (`aria-live`).
  - **Annotation** : `wrapText` et `textFrame` dans `annotation.ts`, dessin ligne par ligne (contours
    d'abord), bloc remonté s'il dépasserait en bas, demi-interligne comme en CSS ; saisie en
    `textarea` (`field-sizing: content`, même police et même largeur que le dessin), Entrée valide,
    Maj+Entrée va à la ligne. `drawShapes` prend la taille de l'image (largeur et hauteur).
  - **Découpage** : `ipc.ts` passait à 806 lignes (plafond 800) ; l'interface `BrowserController`
    en sort vers `browser/browser-controller.ts`.
  - **Tests** : unitaires `downloads.test.ts` (enregistré, annulé, échec), `browser-tools.test.ts`
    (notes de téléchargement), `ipc.test.ts` (branche, « Afficher dans le Finder »),
    `annotation.test.ts` (retour à la ligne, cadre, dessin). Agent factice : scénario
    `telechargement`. e2e `browser` et `annotate` verts en clair et en sombre ; captures regardées
    (`28e-telechargement`, `28f-page-jointe-agrandi`, `28g-branche-navigateur`, `n0-annotation`).
    La page d'essai `/export` révoque son `blob:` aussitôt, comme une bibliothèque d'export.
  - **Essai réel à la souris : pas fait.** L'app d'essai (isolée) était lancée, mais l'accès
    computer-use à « Electron » a été refusé ; je n'ai pas insisté. Restent à essayer à la main : la
    vraie fenêtre « Enregistrer sous » (feuille sur la fenêtre, enregistrer, annuler) et le clic réel
    sur la pastille « Page jointe au message », posée dans l'en-tête déplaçable (`no-drag`).
  - **Vu en passant** : le premier contrôle de la suite `browser` (« l'agent a saisi, cliqué et lu »)
    a échoué 2 fois sur 7 (« Bonjour, ! » : la saisie de l'agent perdue après le clic sur le champ),
    pendant que deux autres sessions lançaient leurs e2e ; rien de touché par cette fiche sur ce
    chemin, passé aux autres lancements.
  - **Pour le CHANGELOG** (à reporter à la fusion) :
    - fr, « Nouveau » : « Le navigateur intégré accepte les téléchargements : chaque fichier demande
      « Enregistrer sous », même quand c'est l'agent qui clique, et rien n'est enregistré sans votre
      accord ; un bandeau confirme, avec « Afficher dans le Finder ». »
    - fr, « Corrections » : « Une branche de conversation (« Repartir de ce message ») reprend la
      page ouverte dans le navigateur. » ; « Panneau agrandi : « Joindre cette page au message »
      affiche « Page jointe au message » dans l'en-tête. » ; « Annotation d'une image : un texte long
      revient à la ligne au lieu de sortir de l'image ; Maj+Entrée pour aller à la ligne. »
    - en, “New”: “The built-in browser now allows downloads: every file asks “Save As”, even when
      the agent clicks, and nothing is saved without your consent; a banner confirms, with “Show in
      Finder”.”
    - en, “Fixes”: “A conversation branch (“Branch from this message”) keeps the page open in the
      browser.” ; “Maximized panel: “Attach this page to the message” now shows “Page attached to
      the message” in the panel header.” ; “Image annotation: long text wraps instead of running off
      the image; Shift+Return for a new line.”
- 2026-10-20 — **Essai réel à la souris**, après la fusion dans `main`, sur l'app construite (OpenCode,
  projet « carnet », page servie en local) :
  - « Exporter » ouvre la vraie feuille « Enregistrer sous » (« Fichier proposé par
    localhost:4321. », Téléchargements, `carnet-de-lecture.csv`). « Annuler » : rien dans
    Téléchargements, dossier d'attente vide, aucun bandeau.
  - Enregistré sous un autre nom (`essai-bobine-carnet.csv`) : le fichier porte bien ce nom, avec
    le contenu de la page. **Défaut trouvé** : le bandeau affichait le nom proposé par la page
    (`carnet-de-lecture.csv`). Corrigé dans `browser-manager.ts` (nom du fichier enregistré) ; l'e2e
    `browser` choisit désormais un autre nom dans « Enregistrer sous » et vérifie le bandeau (il
    échouait avant le correctif, vert après, clair et sombre).
  - Panneau agrandi, « Joindre cette page » : la pastille « Page jointe au message » s'affiche dans
    l'en-tête ; un vrai clic dessus ramène à la conversation, la page jointe dans la saisie. Au
    premier essai, elle avait disparu juste avant le clic : elle reste peu de temps.
- 2026-10-21 — **Essai réel de la fiche 097** (une conversation fille teste le carnet dans le
  navigateur, en arrière-plan) : après « Exporter », les outils du navigateur sont restés sans
  réponse (`browser_click` jamais revenu, `browser_javascript` bloqué jusqu'à « Annuler »). Corrigé
  sur la branche de la fiche 097.
  - **Cause** : pas la fenêtre « Enregistrer sous » (l'export avait rendu la main en 1,6 s, comme le
    prévoit l'ADR-0018). Le clic suivant était sur « Supprimer », qui appelle
    `window.confirm('Supprimer « … » ?')`. Une boîte JavaScript bloque la page jusqu'à la réponse de
    l'utilisateur, et toute commande du protocole DevTools vers la page attend sans fin.
    Reproduit avec l'agent factice.
  - **Corrigé** (`browser/page-dialogs.ts`) :
    - l'app suit les boîtes de chaque onglet (`Page.javascriptDialogOpening` / `Closed`) ;
    - tant qu'une boîte est ouverte, une commande vers la page échoue tout de suite, avec un
      texte qui explique la situation à l'agent ;
    - une action qui ouvre une boîte (clic, touche, saisie) a eu lieu, et l'outil rend la main ;
    - l'agent apprend ce que la page attend, puis ce que l'utilisateur a répondu.
  - **Choix** : l'utilisateur répond toujours lui-même, dans la boîte d'Electron. Répondre par le
    protocole laisse la boîte d'Electron affichée (relevé sur Electron 44.7). L'agent n'a donc pas
    d'outil pour répondre.
  - **Quelle conversation demande** :
    - « Enregistrer sous » cite maintenant la conversation : « Téléchargement lancé par l'agent de
      « … » depuis … » ;
    - pendant « Enregistrer sous » ou une boîte de la page, la conversation est « attend votre
      réponse » dans la liste, avec une notification (nouvel évènement `waiting-user`, sans rien
      dans le fil) ;
    - le texte de la boîte d'une page, lui, ne se change pas (boîte d'Electron).
  - **Essais** :
    - `page-dialogs.test.ts`, `browser-tools.test.ts`, `attention.test.ts` ;
    - e2e `browser` : « Enregistrer sous » laissé ouvert (l'outil et le suivant reviennent, la
      conversation attend) ; boîte `confirm()` de la page (nouveau scénario `boite-page`), en
      clair, en sombre et en anglais.

