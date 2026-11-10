# 124 — Capture indisponible dite, boutons et lignes qui ne glissent plus sous le pointeur

- **Statut** : fait (essai à la vraie souris de D10 et D13 pas fait : accès refusé, voir le journal)
- **Dépend de** : 062 (fenêtre rapide, capture d'écran), 066 (joindre l'écran), 040 (plan annoté),
  112 (carte « Tâches proposées »), 061 (Diagnostic)
- **Agents** : les deux. La capture est l'outil de macOS, la carte du plan et celle des
  propositions sont génériques ; rien de propre à un agent (ADR-0011).

## Pourquoi

La campagne de recette du 2026-10-23 (`docs/recettes/2026-10-23-synthese-campagne.md`, défauts
D3, D10, D13, vus avec OpenCode et avec Bob) a trouvé trois pièges :

- **D3 (majeur)** : sans l'autorisation « Enregistrement de l'écran », le bouton appareil photo
  (fenêtre rapide ⌥⌘B, zone de saisie) laisse choisir une zone, puis rien n'est joint et rien
  n'est dit. L'utilisateur croit à un raté et recommence ; il ne sait ni que l'autorisation manque,
  ni où la donner. C'est le cas de toute installation neuve où elle a été refusée.
- **D10** : sur la carte du plan, après « Ajouter la remarque », le texte d'aide raccourcit et les
  boutons glissent vers la gauche : « Exécuter le plan » arrive sous le pointeur, là où était
  « Envoyer mes remarques ». Un clic a lancé une exécution non voulue (fichiers écrits).
- **D13** : sur la carte « Tâches proposées », chaque proposition que l'agent ajoute pendant son
  tour repousse la ligne qu'on s'apprêtait à lancer ; le clic tombe à côté.

## Critères d'acceptation

- [x] Autorisation « Enregistrement de l'écran » refusée ou restreinte : pas de `screencapture` ;
      dans la fenêtre rapide, ou sous la zone de saisie, un message dit que la capture est
      indisponible et pourquoi, avec un bouton qui ouvre le réglage de macOS (même adresse que la
      commande du Diagnostic).
- [x] Autorisation jamais demandée (« inconnue ») : la capture part, macOS la demande.
- [x] Capture qui échoue alors que l'utilisateur n'a pas annulé (`screencapture` sort en erreur,
      ou fichier vide) : le même message, qui parle d'un refus probable de macOS. Échap reste
      silencieux.
- [x] Carte du plan : les boutons « Envoyer mes remarques » et « Exécuter le plan » gardent leur
      place quand le texte d'aide change (avant / après une remarque), carte large ou étroite.
- [x] Carte « Tâches proposées » : une proposition qui arrive s'ajoute sous les lignes affichées ;
      la ligne dépliée garde son ouverture et ses boutons ; tant que le pointeur est sur la carte,
      le fil ne défile pas tout seul (la ligne sous le pointeur ne bouge pas) ; il rattrape le bas
      quand le pointeur sort.
- [x] Textes en français et en anglais (`fr.json`, `en.json`).
- [x] Testé contre l'agent factice : suites e2e `quick` (accès refusé, capture en échec), `plan`
      (position des boutons), `filles` (propositions en rafale, scénario `filles-rafale`).
- [ ] Essai à la vraie souris pour D10 et D13 : pas fait (accès à l'app d'essai refusé).

## Plan

**Constat** (lecture du code et essai de `screencapture` sur ce Mac, 2026-10-23) :

- `screencapture -i` puis Échap : code 0, pas de fichier. Sans autorisation, après la sélection :
  code 1, « could not create image from rect » sur la sortie d'erreur, pas de fichier. Le code de
  sortie distingue donc l'annulation de l'échec ; `captureScreen` les confondait (`null`).
  L'agent factice des e2e simulait Échap par `exit 1` : faux, corrigé en `exit 0`.
- D10 : la barre du plan a un `<span className="grow" />` entre le texte d'aide et les boutons,
  mais aucune règle CSS ne donne `flex: 1` à `.plan-document-actions .grow` (chaque barre a la
  sienne) : l'espaceur est vide, les boutons suivent le texte d'aide et bougent avec sa longueur.
- D13 : les lignes s'ajoutent déjà en dessous (ordre d'arrivée, clé `requestId`). Ce qui bouge,
  c'est le fil : collé en bas (`useThreadScroll`), il défile de la hauteur de chaque ligne ajoutée
  (et du texte que l'agent écrit après la carte), et toute la carte remonte sous le pointeur.

**D3** — main :
- `src/shared/attachments.ts` : `ScreenCaptureResult` = image, `null` (annulée) ou
  `{ kind: 'unavailable', reason: 'denied' | 'restricted' | 'failed' }`.
- `src/main/screen-capture.ts` : `captureScreen` reçoit `access()` (statut de macOS) ; refusé ou
  restreint → `unavailable` sans lancer la commande ; code ≠ 0 sans fichier, ou fichier vide →
  `failed` (sortie d'erreur au journal) ; code 0 sans fichier → `null`. `SCREEN_RECORDING_SETTINGS`
  (adresse du réglage) partagée avec le Diagnostic.
- `src/main/index.ts` : `screenAccess()` = `BOBINE_SCREEN_ACCESS` (essais), sinon `granted` si la
  capture est simulée (`BOBINE_SCREENCAPTURE`), sinon `systemPreferences.getMediaAccessStatus`.
  Canal `capture:openSettings` (`shell.openExternal` de l'adresse du Diagnostic).
- renderer : `CaptureProblem` (texte selon la raison, bouton « Ouvrir les Réglages Système »,
  fermer), dans `QuickEntry` (à la place de l'erreur) et sous la zone de saisie (`Composer`).

**UX D10** (décision) : **boutons alignés à droite**, pas de largeur fixe pour le texte d'aide.
Une largeur fixe dépend de la langue (le texte anglais n'a pas la même longueur) et de la largeur
de la carte (panneau à côté, fenêtre étroite) : elle finirait par couper le texte ou par laisser
glisser les boutons à nouveau. L'alignement à droite ancre les boutons au bord de la carte, quel
que soit le texte : c'est la convention des barres d'action de l'app (cartes d'accord, propositions,
dialogues) et de macOS (action principale tout à droite). Le texte d'aide prend la place qui reste
et passe à la ligne s'il le faut (`min-width: 0`), les boutons ne rétrécissent pas
(`flex-shrink: 0`, pas de retour à la ligne dans leur libellé).

**UX D13** (décision) : les nouvelles lignes restent **en dessous** (ordre d'arrivée, déjà le
cas) ; le **pointeur sur la carte suspend le suivi du bas du fil**. On ne réordonne rien et on ne
gèle pas la carte elle-même : une proposition qui arrive est visible tout de suite, en dessous ;
seul le défilement automatique, qui déplaçait tout ce qui est au-dessus, attend que le pointeur
sorte de la carte. La suspension est générique (`data-scroll-hold` sur la carte, lu par
`useThreadScroll`) ; seule la carte des propositions la demande ici.

**Agent factice** : étape `parallel` (branches jouées en même temps, comme les appels d'outils
parallèles d'OpenCode) et scénario `filles-rafale` : un long texte (fil qui défile), puis trois
`start_child` qui arrivent l'un après l'autre pendant que les premières attendent.

**Tests** (rouges d'abord) : `screen-capture.test.ts` (refusé, restreint, inconnu, code ≠ 0,
fichier vide, Échap) ; `PlanDocument.test.tsx` (barre : boutons dans un groupe à droite, mêmes
nœuds avant / après une remarque) ; `ChildProposals.test.tsx` (ordre après une arrivée, ligne
dépliée gardée, `data-scroll-hold`) ; `useThreadScroll.test.ts` (pas de suivi sous le pointeur,
rattrapage à la sortie) ; e2e `quick`, `plan`, `filles`. jsdom ne calcule pas de mise en page :
les positions réelles des boutons et des lignes sont mesurées dans les e2e
(`getBoundingClientRect`), et à la vraie souris.

Pas de nouvelle dépendance.

## Journal

- 2026-10-23 — Fiche ouverte, plan ci-dessus.
- 2026-10-23 — Fait selon le plan, trois commits (un par défaut). Écarts et détails :
  - **D3** : comportement réel de `screencapture` relevé sur ce Mac avant de coder (Échap : code 0
    sans fichier ; sans autorisation, une zone choisie : code 1, « could not create image from
    rect »). L'agent factice des e2e simulait Échap par `exit 1` : passé à `exit 0`, et un mode
    « refuser » ajouté. `screenAccessOf` (dans `screen-capture.ts`, pour garder `index.ts` sous sa
    limite de taille) lit `BOBINE_SCREEN_ACCESS` à chaque capture : la suite `quick` la change à
    chaud dans le main. Le message de la zone de saisie passe par un petit hook
    (`useScreenCapture`), pour garder `Composer` sous 300 lignes. Message en orange (avertissement,
    pas erreur) : c'est un réglage à faire, pas une panne. « Restreinte » garde le bouton : le
    réglage grisé dit lui aussi qu'il est géré ailleurs.
  - **D10** : cause plus simple que prévu (espaceur sans règle CSS). Le test de composant charge la
    vraie feuille de style (jsdom applique la cascade, pas la mise en page) : Vitest rendait les CSS
    vides, `styles.css` est désormais lu tel quel dans le projet « renderer » (`css.include` de
    `vitest.config.ts`). Les positions réelles sont mesurées par l'e2e `plan` (large et 760 px),
    rouge sur l'ancien code (« Exécuter le plan » de x = 925 à x = 727), vert après.
  - **D13** : la pause du suivi du fil est générique (`data-scroll-hold`, lu par `useThreadScroll`
    avec des écouteurs natifs `pointerover` / `pointerout`, comme la liste figée de la fiche 095) ;
    seule la carte des propositions la demande, et seulement tant qu'elle a des lignes à décider.
    Contrepartie assumée : pendant la pause, une proposition qui arrive sous le bas de l'écran
    n'est pas montrée ; elle l'est dès que le pointeur quitte la carte. Agent factice : étape
    `parallel` et scénario `filles-rafale` ; identifiants d'appels MCP rendus uniques (deux appels
    dans la même milliseconde avaient le même). e2e `filles` rouge sur l'ancien code (« Lancer »
    remonté de 222 px sous le pointeur), vert après.
  - **Écart sur un essai** : la clé `data-testid="plan-hint"` donnée d'abord au texte d'aide de la
    carte du plan existait déjà (rappel du mode Plan sous la zone de saisie) ; l'e2e `composer`
    l'a vu (vert sur `main`, rouge ici). Renommée `plan-document-hint`.
- 2026-10-23 — Vérifications :
  - `./scripts/verify` vert.
  - `pnpm build && pnpm e2e --changed` (suite complète : `styles.css` et l'agent factice sont des
    sources globales) : 35 échecs au premier passage, pendant que trois autres worktrees faisaient
    tourner leurs propres e2e sur la même machine (« fenêtre de l'app absente au bout d'une
    minute », AXe) plus `composer` (vrai défaut, ci-dessus). Rejouées une à une ensuite : `composer`,
    `plan`, `filles`, `quick`, puis `simulator`, `changes`, `replay-changes`, `git`, `settings`,
    `language`, `history`, `parallel`, `worktree-cycle`, `filles-fusion`, `failures`, `branch`,
    `handover`, `mcp`, `about` : toutes vertes en clair et en sombre (`handover` clair vert au
    second essai). Les autres suites étaient vertes au premier passage.
  - Rouge avant la correction, vert après : tests unitaires et de composants des trois défauts ;
    e2e `plan` et `filles` (code d'origine reconstruit le temps d'un essai).
  - Captures regardées, clair et sombre : `l0a-capture-sans-image`, `l0b-capture-autorisation-refusee`,
    `l2b-capture-refusee-zone-de-saisie`, `97-plan-barre-etroite`, `98-plan-annote`,
    `filles-6c-propositions-en-rafale`.
  - **Pas fait : l'essai à la vraie souris** de D10 et D13. L'app d'essai était lancée et gardée
    ouverte (script avec `withApp` et `keep`), mais l'accès à « Electron » (nom de l'app de
    développement) demandé par computer-use a été refusé. D10 et D13 ne sont donc vérifiés que
    par les e2e (souris simulée par le CDP : `mouseMoved`, `elementFromPoint` à l'ancienne place
    du bouton) et les tests de composants. À refaire à la main : sur la carte du plan, commenter
    un passage puis cliquer là où était « Envoyer mes remarques » ; avec `/scenario filles-rafale`,
    laisser le pointeur sur « Lancer » de la première ligne dépliée pendant que les deux autres
    arrivent.
  - Vrai `screencapture` sans autorisation (code 1, « could not create image from rect ») et Échap
    (code 0, pas de fichier) relevés sur ce Mac ; la capture réelle par l'app, autorisation
    refusée, n'a pas été rejouée à la main (même refus d'accès).
- 2026-10-23, écart (fiche 127, D27) : le glissement horizontal était corrigé, pas le vertical :
  à la première remarque, le formulaire replié faisait remonter la barre sous le pointeur. La zone
  des remarques garde désormais sa hauteur tant que le pointeur est sur la carte (fiche 127).
