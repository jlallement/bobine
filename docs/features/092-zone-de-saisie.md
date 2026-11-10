# 092 — Zone de saisie : texte perdu, barre qui se replie, menu des modèles

- **Statut** : fait
- **Dépend de** : 090 (puce du modèle), 062 (capture d'écran), 049 (puce de la branche)
- **Agents** : les deux, générique — rien de propre à un agent : le mode plan est reconnu comme pour
  « Exécuter le plan » (`isPlanMode`), le menu des modèles suit le réglage ACP de catégorie `model`.

## Pourquoi

L'essai réel du 2026-10-20 avec OpenCode + GPT-6.1 Sol
(`docs/recettes/2026-10-20-essai-libre-opencode-gpt.md`, hors git) a relevé quatre défauts dans la
zone de saisie :

1. **Texte perdu** après un choix dans un menu de la barre (reproduit 3 fois avec le mode) : Radix
   rend le focus à la puce, son infobulle s'ouvre au focus **par-dessus la zone de saisie**, et le
   clic suivant dans la saisie tombe sur l'infobulle ; la frappe est perdue, Entrée n'envoie rien.
2. **Puces illisibles** : toutes rétrécissent ensemble. Avec « GPT-6.1 Sol Fast », même en plein
   écran : « car… », « m… », « Bu… », « OpenCo… » ; en demi-écran : « c », « GP… », « O… ».
3. **Accueil en fenêtre étroite** (760 px) : la zone de saisie dépasse (bord droit à 873 px), le
   bouton d'envoi est hors de l'écran.
4. **Menu des modèles** : avec OpenCode, ~40 modèles en liste plate qui déborde au-dessus de la
   fenêtre et s'ouvre en haut de la liste, pas sur le modèle choisi.

## Maquettes

Faites par la session principale en injectant du DOM dans l'app buildée (aucun code produit),
dans `e2e/captures/` du dépôt principal (hors git) : `m092-final-planche-barre-*`,
`m092-final-barre{,-etroit,-accueil,-accueil-etroit}-*`, `m092-final-planche-modeles-liste-*`
(deux colonnes de gauche) ; l'état d'avant : `m092-comparaison-barre-*`.

**Variante retenue : B, avec repli** (choix d'UX de la session principale) : dossier et branche sur
une ligne discrète sous la zone de saisie ; dans la barre, les puces se replient l'une après
l'autre au lieu de rétrécir ensemble.

## Critères d'acceptation

- [x] Les infobulles ne captent plus le pointeur : un clic à travers une infobulle ouverte atteint
      ce qu'il y a dessous.
- [x] Après un choix dans un menu de la barre (mode, modèle, agent, dossier, réglages), le focus
      revient à la zone de saisie et aucune infobulle ne s'ouvre ; Échap rend toujours le focus à la
      puce (clavier).
- [x] e2e à la souris (`Input.dispatchMouseEvent`, sans `ui.send`) : choisir un mode, cliquer dans
      la saisie là où s'ouvrait l'infobulle, taper : le texte est dans la saisie.
- [x] Dossier (`WorkspaceMenu`) et branche (`BranchChip`) sur une ligne discrète sous la zone de
      saisie, à l'accueil comme en conversation, mêmes menus au clic ; en worktree, la puce du
      dossier montre la branche.
- [x] La barre garde 📎, capture, mode, ⚙, espace, consommation, modèle, agent, envoyer (l'agent
      juste après le modèle).
- [x] Repli quand la place manque, une étape après l'autre, sans rétrécissement commun :
      1. la capture passe dans un petit menu sous 📎 (« Joindre des fichiers… », « Capturer une
         zone de l'écran ») ;
      2. la consommation ne garde que son anneau, le pourcentage passe dans l'infobulle ;
      3. le mode ne garde que son icône ; le mode plan a une icône distincte des autres ;
      4. le modèle se tronque (≈ 110 px au moins), puis l'agent (≈ 64 px au moins).
- [x] Accueil à 760 px de large : la zone de saisie et le bouton d'envoi tiennent dans la fenêtre
      (e2e en largeur étroite).
- [x] Menu des modèles : au-delà de 10 options, un champ de recherche en tête (curseur dedans à
      l'ouverture, filtre insensible à la casse, ↑ ↓ Entrée) ; s'ouvre sur l'option en cours,
      hauteur bornée à la place disponible, défilement ; chaque ligne : nom court + préfixe
      fournisseur estompé à droite ; groupes ACP pris en charge.
- [x] Testé contre l'agent factice : scénario `demo` / `echo`, et `MOCK_MODELS=long` (≈ 40 modèles
      façon OpenCode) pour le menu des modèles et la barre repliée.

## Plan

Fichiers (tous dans le périmètre de la session, sauf mention) :

1. **Infobulles et focus** — `components/common/Menus.tsx` :
   - `Tip` : `disableHoverableContent` ; `styles.css` (section menus/infobulles) :
     `pointer-events: none` sur `.tooltip` et sur son enveloppe Radix
     (`[data-radix-popper-content-wrapper]:has(> .tooltip)`).
   - Contexte `ComposerFocus` (fonction qui rend le focus à la saisie), fourni par `Composer`.
     `MenuContent` : `onCloseAutoFocus` rend le focus à la saisie après un **choix** (pas après Échap
     ni un clic ailleurs, que Radix gère déjà), et seulement si le focus n'est pas parti ailleurs
     (fenêtre de dialogue ouverte par l'élément choisi).
2. **Ligne du dossier** — nouveau `components/composer/ComposerContext.tsx` (`WorkspaceMenu` +
   `BranchChip`), rendu par `Composer.tsx` sous le formulaire ; retirés de `ComposerBar.tsx`.
   Styles : `.composer-context` (petite taille, couleur atténuée).
3. **Repli de la barre** — `ComposerBar.tsx` + nouveau `components/composer/useBarFold.ts` :
   un `ResizeObserver` sur la barre et un `MutationObserver` sur son contenu. La mesure
   pose `data-measure` (aucune puce ne rétrécit) et essaie `data-fold` = 0, 1, 2, 3 jusqu'à ce que
   la barre tienne (`scrollWidth ≤ clientWidth`), dans le DOM, sans rendu intermédiaire.
   Le CSS cache la capture (≥ 1), le pourcentage (≥ 2), le nom du mode (3). Au-delà : le modèle
   rétrécit seul (`flex-shrink` très fort), puis l'agent ; minimums ≈ 110 et 64 px, plafonnés à leur
   largeur naturelle (variables CSS posées par la mesure).
   - 📎 : bouton simple au niveau 0 ; menu « Joindre des fichiers… / Capturer une zone de l'écran »
     à partir du niveau 1 (si l'app propose la capture).
   - `UsageMeter.tsx` : `compact` → infobulle avec le pourcentage.
   - `ModeChip` : icône `ClipboardList` pour un mode plan (`isPlanMode`, `@shared/plan-doc`),
     `ShieldCheck` sinon.
4. **Accueil étroit** — `App.tsx` : la colonne de l'accueil prend toute la largeur disponible
   (`width: 100%`, comme `thread-dock`) au lieu de la largeur de son contenu.
5. **Menu des modèles** — nouveau `components/common/ModelMenu.tsx` (Menus.tsx approche des
   800 lignes) : `ModelChip` passe sur un `Popover` Radix avec une liste à la manière d'une
   combobox (`role="listbox"`, `aria-activedescendant`) ; recherche au-delà de 10 options, filtre
   sans casse ni accents sur le nom et le groupe, ↑ ↓ Entrée, ouverture sur l'option en cours
   (centrée), hauteur bornée par `--radix-popover-content-available-height`. Lignes : nom court,
   fournisseur estompé, coche. `.menu` borné aussi par la place disponible (tous les menus).
6. **Agent factice** — `src/mock-agent/agent.mts`, autour de `MODELS` seulement : `MOCK_MODELS=long`
   → liste plate de ~40 modèles façon OpenCode (« openai/GPT-6.1 Sol »…), dont les deux modèles
   factices. `docs/mock-agent.md` : la variable.
7. **Essais** :
   - unitaires : `ModelChip.test.tsx` (recherche, clavier, groupes, ouverture sur l'option en
     cours), `useBarFold` (choix du niveau), `Composer.test.tsx` si besoin ;
   - e2e : nouvelle suite `composer` (`e2e/suites/composer.mjs`, inscrite dans `e2e/run.mjs`) : bug
     du texte perdu à la souris, clic à travers une infobulle, repli de la barre en largeur étroite,
     accueil à 760 px, menu des modèles (`MOCK_MODELS=long`). `e2e/lib.mjs` : `ui.viewport()`,
     `ui.mouse()`. Mise à jour de `e2e/suites/git.mjs` (la branche n'est plus dans `.composer-bar`).
8. i18n : `composer.attach.*`, `composer.capture.*`, `usage.compactTip`, `modelMenu.*` (fr, en).

Pas de nouvelle dépendance. Hors périmètre : `docs/features/README.md`, `CHANGELOG*.md` (lignes
proposées dans le journal), `e2e/suites/git.mjs` (une ligne, à cause du déplacement de la branche).

## Journal

- 2026-10-20 — Fiche créée (session 1 de l'essai réel du 2026-10-20), plan écrit.
- 2026-10-20 — Fait.
  - **Texte perdu** : `Tip` sans contenu survolable, `.tooltip` et son enveloppe Radix en
    `pointer-events: none` ; `useReturnFocus` (`Menus.tsx`) sur tous les menus de la barre et la
    liste des modèles : après un choix, focus à la saisie (contexte `ComposerFocus` fourni par
    `Composer`) ; Échap et clic ailleurs : comportement de Radix inchangé.
  - **Barre** : `ComposerContext.tsx` (dossier, branche) sous la saisie ; `useBarFold.ts` (mesure,
    `fitFold`, `squeeze`) ; `AttachButton.tsx` (📎 simple ou menu) ; `UsageMeter` `compact` ;
    `ModeChip` : `ClipboardList` pour un mode plan (`isPlanMode`), `ShieldCheck` sinon. Consommation,
    modèle, agent et envoi forment un bloc (`.composer-bar-end`), qui seul rétrécit.
  - **Accueil** : la colonne prend toute la largeur (`App.tsx`) ; à 760 px, bord droit de la zone
    de saisie à 736 px (873 avant).
  - **Modèles** : `ModelMenu.tsx` (`ModelChip`, `shortModelName`, `modelProvider`,
    `modelOptions`), `Popover` + liste `listbox` ; `.menu` borné par la place disponible pour tous
    les menus.
  - **Agent factice** : `MOCK_MODELS=long` (38 modèles, « factice/Factice rapide » en tête).
  - **Essais** : unitaires `ModelChip.test.tsx` (7), `useBarFold.test.ts` (6) ; e2e nouvelle suite
    `composer` (clair et sombre, 27 vérifications par thème, captures `composer-1` à `-9`
    regardées) ; `base`, `git`, `usage`, `attachments`, `parallel`, `questions`, `commands` verts.
    `./scripts/verify` : lint, typecheck et tests verts ; seule l'étape « Documentation » échoue,
    la fiche n'étant pas dans l'index `docs/features/README.md`, réservé à l'intégration.
  - **Essai réel** (app buildée, vraie fenêtre, vraie souris, agent factice avec
    `MOCK_MODELS=long`) : choix du mode « Question », clic dans la saisie juste au-dessus de la
    puce, frappe, Entrée : message envoyé ; liste des modèles : recherche « sol fast », ↓, Entrée,
    modèle réglé et texte tapé ensuite dans la saisie ; fenêtre réduite à sa largeur minimale
    (800) : barre repliée (capture sous 📎, mode en icône, anneau seul), modèle et agent en
    entier, menu 📎 et menu du dossier ouverts à la souris ; accueil à 800 px : tout tient, envoi
    au clic.
  - **Suite e2e complète** (`pnpm e2e`, clair et sombre) : verte en 545 s.
  - **Écarts au plan** :
    - au-delà du repli prévu, deux étapes pour une conversation très étroite (fenêtre à 800 px, son
      minimum, panneau ouvert à 280 px : ~256 px de conversation) : l'agent ne garde que son
      chevron (nouvelle infobulle « Agent : … » sur sa puce, son nom reste aussi en bas de la
      barre latérale), puis le modèle descend à 56 px ; si cela ne suffit pas, la barre passe sur
      deux lignes (outils, puis consommation, modèle, agent et envoi à droite) ;
    - liste des modèles avec recherche : hauteur fixe (sinon le menu changeait de côté pendant la
      frappe, à l'accueil, quand la liste filtrée raccourcissait) ;
    - à 760 px, avec « Agent factice » (plus long qu'« OpenCode » des maquettes), tout est replié
      et le modèle tronqué à ~126 px : la règle est respectée, la maquette avait un nom d'agent
      plus court ;
    - hors périmètre, au plus court : `e2e/run.mjs` (inscription de la suite), `e2e/suites/git.mjs`
      (la branche est dans `.composer-context`, plus dans `.composer-bar`), `src/mock-agent/agent.mts`
      (autour de `MODELS` et `configOptions` seulement), `docs/mock-agent.md` (la variable),
      `src/shared/i18n/fr.generated.d.ts` (régénéré).
  - **CHANGELOG proposé** (à reporter à l'intégration) :
    - fr :
      - « Le texte tapé après un choix dans un menu de la zone de saisie (mode, modèle…) n'est plus
        perdu : le curseur revient dans la saisie, et les infobulles ne bloquent plus le clic. »
      - « Le dossier et la branche passent sous la zone de saisie. Quand la place manque, la barre
        se replie étape par étape (capture dans le menu 📎, anneau seul pour la consommation,
        icône seule pour le mode) au lieu de tronquer toutes les puces ; le mode plan a sa propre
        icône. »
      - « Le menu des modèles s'ouvre sur le modèle choisi, tient dans la fenêtre et propose une
        recherche au-delà de 10 modèles (OpenCode) ; le fournisseur est estompé à droite. »
      - « L'accueil tient dans une fenêtre étroite. »
    - en :
      - "Text typed after picking from a menu in the message box (mode, model…) is no longer lost:
        the cursor returns to the message box, and tooltips no longer block clicks."
      - "The folder and branch move below the message box. When space runs out, the bar folds
        step by step (screenshot in the 📎 menu, usage ring only, mode icon only) instead of
        truncating every chip; plan mode has its own icon."
      - "The model menu opens on the selected model, fits in the window and offers a search
        beyond 10 models (OpenCode); the provider is dimmed on the right."
      - "The home screen fits a narrow window."
