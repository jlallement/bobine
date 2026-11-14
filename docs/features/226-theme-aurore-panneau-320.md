# 226 — Thème Aurore à la place de Sépia, panneau de droite à 320 px

- **Statut** : fait (reste : suite e2e complète par le tech lead, essai à la vraie souris)
- **Dépend de** : 134 (jetons de thème, contrastes), 136 (Apparence, thème par mode), 168 (Fjord),
  113 (barre latérale réglable), 029 / 082 / 173 (panneau de droite)
- **Agents** : les deux. Rien ne dépend de l'agent : couleurs, décor et largeur du panneau.

## Pourquoi

Sépia est peu choisi et date d'avant les jetons ; il manque un thème « plus fun » qui reste calme
pour une journée devant le fil. Les maquettes v3 (« Touches légères », validées par l'utilisateur
le 14/11) gardent une base presque neutre et posent six touches d'aurore à des endroits choisis.
Dans le même lot, le panneau de droite passe de 380 à 320 px par défaut : à 1280 px, la taille du
premier lancement, le texte du fil gagne 60 px par ligne.

## Critères d'acceptation

### Thème

- [x] Deux palettes `aurora` (clair, « Aurore » / « Aurora ») et `auroraNight` (sombre,
      « Aurore nuit » / « Aurora Night ») dans les jetons, avec les trois couches et six accents ;
      base presque neutre (nuit `#15171d`, jour `#fbfcfe`), dégradés de base de 1 à 2 % de
      luminosité (barre latérale, haut du fil, panneau, cartes).
- [x] Les six touches, dosage « légères » seulement (pas de filet de 2 px en haut du fil) :
      1. lueur d'aurore confinée en haut de la barre latérale ;
      2. bulle de l'utilisateur en dégradé deux tons ;
      3. liseré dégradé de la saisie, au focus seulement ;
      4. un même dégradé doux pour l'action principale (bouton principal, envoi, « + » de
         « Nouvelle conversation », conversation active en pastille) ;
      5. ombre teintée sous les cartes d'autorisation et de plan ;
      6. verre (`backdrop-filter`) seulement sur ce qui flotte : menus, popovers, Réglages.
- [x] Jetons de « touche » (`--touch-*`, `--glass-*`) neutres dans les autres thèmes : Clair,
      Sombre, Nuit noire, Fjord et Fjord nuit ne changent pas d'un pixel (vérifié aux captures).
- [x] Test de contraste étendu : les deux extrémités de chaque dégradé, la lueur composée en tout
      point de la barre latérale sous les traits du feu (trois largeurs de barre), le verre composé
      sur le contenu flouté derrière lui ; texte 4,5:1, texte sur l'action 4,5:1 pour chaque accent.
- [x] Repli « Réduire la transparence » / « Augmenter le contraste » de macOS
      (`prefers-reduced-transparency: reduce`, `prefers-contrast: more`, exposés par Chromium dans
      Electron 45) : verre opaque, lueur retirée, dégradés unis ; aucun réglage de plus.
- [x] Aucun `backdrop-filter` ni dégradé animé sur ce qui défile dans le fil.
- [x] Sépia retiré ; un thème enregistré `sepia` (ancien `theme` ou `lightTheme`) devient Clair.
- [x] Réglages › Apparence : vignettes en deux rangées (Système, Clair, Fjord, Aurore / Sombre,
      Nuit noire, Fjord nuit, Aurore nuit), celles d'Aurore avec leur lueur et le trait dégradé,
      marquées « Nouveau ».
- [x] ADR : les dégradés et le verre sortent du « couleurs seulement » de l'ADR-0027 (ADR-0049).

### Panneau de droite (planches P1–P3)

- [x] Largeur par défaut 320 px (au lieu de 380).
- [x] La largeur n'est enregistrée qu'après un glissement du bord par l'utilisateur, plus à chaque
      changement du panneau.
- [x] Une largeur enregistrée égale à 380 (l'ancien défaut, enregistré d'office) vaut « jamais
      réglée » : 320. **Écart assumé** : quelqu'un qui avait choisi exactement 380 à la main repart
      à 320.
- [x] Double-clic sur le bord : retour à la largeur par défaut, comme la barre latérale (fiche
      113) ; il n'agrandit plus le panneau (le bouton et le menu Affichage le font toujours).
      Infobulle du bord : « Glisser pour régler la largeur · double-clic : largeur par défaut ».
- [x] Tests unitaires de chaque point.

### Essais

- [x] `./scripts/verify` vert.
- [x] e2e des suites touchées (thèmes, Apparence, panneau), clair et sombre, en français puis en
      anglais ; captures de la fenêtre en Aurore et Aurore nuit et de la page Apparence, comparées
      aux maquettes.

## Plan

Maquettes de référence : `07-aurore-v3.html` + `touches.css` (dosage « légères », planches V1, V2,
V5, V6), planches P1–P3, scripts `contrast3.py` et `contrast3-lueur.py`.

1. **Jetons** (`src/shared/`)
   - `themes.ts` : retirer `sepia`, ajouter `aurora` et `auroraNight` à `PALETTES` et
     `VARIANT_PALETTES` ; les teintes vivent dans un nouveau `theme-aurora.ts` (taille des
     fichiers, ESLint 800 lignes), avec les données des touches (`AURORA_TOUCHES` : couleurs et
     opacités, pas de chaîne CSS) et `touchVariables(palette, accent)` qui en tire les variables
     CSS ; les autres palettes reçoivent les valeurs neutres (`none`, `var(--surface)`…).
   - `ThemeTokens.touch` : variables de touche, posées par `cssVariables` comme les autres.
   - `scripts/themes-css.mts` : blocs `[data-palette='aurora']` / `'auroraNight'` ; bloc de repli
     sous `prefers-reduced-transparency: reduce` et `prefers-contrast: more`.
   - `theme-aurora.test.ts` : contrastes des touches (voir critères) ; `themes.test.ts` reste le
     test des palettes (Aurore y passe comme les autres).
2. **Préférences** (`preferences.ts`) : `LightTheme` = `light | fjord | aurora`, `DarkTheme` =
   `dark | black | fjordNight | auroraNight` ; `THEME_CHOICES` dans l'ordre des deux rangées ;
   `sepia` (ancien `theme` ou `lightTheme`) → Clair. Tests.
3. **Apparence** : grille de quatre colonnes, vignette d'Aurore (lueur, trait dégradé), « Nouveau »
   (`settings.appearance.theme.new`), textes fr/en, mots de la recherche des réglages.
4. **Touches dans le CSS** : les variables `--touch-*` / `--glass-*` lues dans les règles de base
   de `styles.css` (écart : pas de `aurora.css`, voir le journal) ; aucune couleur en dur.
5. **Panneau** : `panel-width.ts` (défaut 320, lecture de l'ancien `width` sauf 380, `customWidth`
   écrit seulement après un glissement, retour au défaut) ; `usePanel` expose `resize` et
   `resetWidth` ; `SidePanel` : double-clic → largeur par défaut, infobulle. Tests unitaires.
6. **e2e** : suites `settings`, `fun`, `composer`, `panel` (et celles qui glissent le bord) mises à
   jour ; captures Aurore et Aurore nuit (fenêtre, Apparence).
7. **Clore** : CHANGELOG fr/en, `docs/architecture.md`, `docs/traduction.md`, index des fiches.

Aucune nouvelle dépendance.

## Journal

- 2026-11-14 — Fiche et plan écrits d'après les maquettes v3 validées (« Touches légères ») et
  les planches P1–P3.
- 2026-11-14 — Fait.
  - **Jetons** : `src/shared/theme-aurora.ts` (palettes, touches en données, `touchVariables`,
    `touchFallbackVariables`, vignette) ; `themes.ts` sans Sépia ; `ThemeTokens.touch` posé par
    `cssVariables` ; `themes-css.mts` écrit Aurore et Aurore nuit et leur repli sous
    `(prefers-reduced-transparency: reduce)` / `(prefers-contrast: more)`. Accents d'Aurore
    autres que l'orange et teintes vives non montrées dans les maquettes : repris de Fjord /
    Fjord nuit, ajustés à la base, vérifiés par le test. Fin du dégradé d'action pour chaque
    accent : vers le rose la nuit, le prune le jour (question 3 des maquettes, réponse par défaut).
  - **Test de contraste** (`theme-aurora.test.ts`) : lueur composée en tout point de la barre
    latérale à partir de 8 px sous le haut (feux au-dessus), pour 220, 300 et 440 px, sur chacun des
    trois arrêts du fond ; pastille posée sur ces points ; deux bouts du haut du fil, du panneau,
    de la carte, de son pied, de la bulle ; verre composé sur le fond, une carte, la barre
    latérale ou le texte flouté ; texte sur l'action aux deux bouts, survol compris, pour les six
    accents. Contrôle : le test échoue si la lueur du jour passe à 45 % ou si la bulle de nuit
    s'éclaircit. `scripts/glass-guard.test.ts` : `backdrop-filter` seulement sur `.menu` et
    `.settings-dialog`, aucune étape d'animation ne lit une touche.
  - **CSS** : touches lues en place dans les règles de base de `styles.css` plutôt que dans un
    `aurora.css` à part : une règle à part, de même spécificité et chargée après, aurait écrasé les
    variantes plus spécifiques (carte à risque, saisie en mode Plan ou vers un rôle, bouton
    désactivé). Les valeurs neutres rendent exactement l'aspect d'avant (bordure transparente du
    bouton principal sur un fond de l'accent = bordure de l'accent).
  - **Préférences** : `theme: 'sepia'` → Clair (mode et thème) ; `lightTheme: 'sepia'` ignoré →
    Clair. Apparence : grille de quatre colonnes, « Nouveau » sous Aurore et Aurore nuit.
  - **Panneau** : `panel-width.ts` ; `bobine.panel` n'écrit plus `width` mais `customWidth`,
    seulement après un glissement ; ancien `width` lu une fois (380 = jamais réglé) ; double-clic
    → 320 et plus rien d'enregistré ; infobulle du bord.
  - **Effet de bord corrigé** : à 320 px, « Ajouter au message » du terminal passait sur deux
    lignes, la barre grandissait, xterm se recalibrait et perdait la sélection (e2e `terminal`) :
    bouton gardé sur une ligne, les onglets cèdent la place.
  - **e2e** : nouvelle suite `aurore` (vignette, six touches, verre, repli émulé par
    `Emulation.setEmulatedMedia`, nouveau `ui.media` dans `e2e/lib.mjs`) ; `panel` (320 par défaut,
    largeur enregistrée après le glissement seulement, double-clic) ; `settings`, `fun`, `composer`
    et `palette.mjs` passent de Sépia à Aurore. Suites jouées, clair et sombre, en français et en
    anglais : aurore, settings, fun, composer, panel, command-output, tables, mermaid, terminal,
    onglets-etroits, browser-view, session, debordements — vertes. Captures `a1-apparence-aurore`,
    `a2-aurore-fenetre`, `a2b-aurore-menu`, `a3-aurore-repli` (`-light` : Aurore, `-dark` : Aurore
    nuit) regardées et comparées aux planches V1, V2, V5, V6.
  - **Écarts aux maquettes** :
    - le menu en verre capturé est le menu « + » du panneau, pas celui des modèles (grisé pendant
      que l'agent attend l'accord) ; le liseré au focus et le menu ouvert sont donc sur deux
      captures ;
    - la carte d'autorisation garde un bord `--border` en Aurore comme la maquette, mais
      `--border-strong` revient avec « Augmenter le contraste » ;
    - le voile derrière les Réglages reste celui de l'app (noir à 28 %), la maquette du jour avait un
      voile bleuté plus clair ;
    - l'app a depuis la fiche 224 le sélecteur Code | Discussion en haut de la barre latérale : il
      est sous la lueur (contraste couvert par le test, qui mesure toute la surface) ;
    - ombres des menus : celles du mode (`--shadow-menu`), pas celles, un peu plus marquées, de la
      maquette ;
    - le liseré au focus n'a pas de seuil de contraste (décoratif, ADR-0049) : le jour, le bout
      sarcelle est très pâle sur blanc, comme dans la maquette.
- 2026-11-14 — Après la fusion (suite e2e complète du tech lead), deux régressions du panneau à
  320 px, corrigées :
  - **Modifications** : à 320 px, les trois actions de chaque ligne (annuler, ouvrir, montrer dans
    le Finder) prenaient la place du nom (« configuration-par-d… »). Le CSS donnait déjà la
    priorité au nom sur le dossier, mais il n'y avait plus de place. Dans une liste de 380 px ou
    moins (requête de conteneur `changes`), les actions se posent par-dessus les chiffres, au survol
    de la ligne ou quand l'une d'elles a le clavier (elles restent dans l'ordre de tabulation), et
    pendant « Annuler ? ». Le nom tient entier, le dossier se coupe d'abord.
  - **Documents** (espace Discussion) : l'aperçu réduisait le nom du document à « S… » ; les boutons
    passent maintenant à la ligne sous le nom.
  - **Onglets du panneau en icônes seules** à 320 px : c'est le comportement prévu par la fiche 185
    (crans `compact` puis `tight`, nom accessible et infobulle gardés). Il est jugé acceptable avec
    deux ou trois onglets, et n'est pas changé. La suite `discussion` trouve l'onglet par son nom
    accessible (et passe par « + » s'il y est rangé), plus par son texte affiché.
  - Listes vérifiées aux captures : Session, Tâches, Documents, Modifications.
  - e2e `discussion`, `autorisation-commande`, `panel`, `onglets-etroits`, `aurore` en clair et en
    sombre, en français et en anglais : vertes.
