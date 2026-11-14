# 226 — Thème Aurore à la place de Sépia, panneau de droite à 320 px

- **Statut** : en cours
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

- [ ] Deux palettes `aurora` (clair, « Aurore » / « Aurora ») et `auroraNight` (sombre,
      « Aurore nuit » / « Aurora Night ») dans les jetons, avec les trois couches et six accents ;
      base presque neutre (nuit `#15171d`, jour `#fbfcfe`), dégradés de base de 1 à 2 % de
      luminosité (barre latérale, haut du fil, panneau, cartes).
- [ ] Les six touches, dosage « légères » seulement (pas de filet de 2 px en haut du fil) :
      1. lueur d'aurore confinée en haut de la barre latérale ;
      2. bulle de l'utilisateur en dégradé deux tons ;
      3. liseré dégradé de la saisie, au focus seulement ;
      4. un même dégradé doux pour l'action principale (bouton principal, envoi, « + » de
         « Nouvelle conversation », conversation active en pastille) ;
      5. ombre teintée sous les cartes d'autorisation et de plan ;
      6. verre (`backdrop-filter`) seulement sur ce qui flotte : menus, popovers, Réglages.
- [ ] Jetons de « touche » (`--touch-*`, `--glass-*`) neutres dans les autres thèmes : Clair,
      Sombre, Nuit noire, Fjord et Fjord nuit ne changent pas d'un pixel (vérifié aux captures).
- [ ] Test de contraste étendu : les deux extrémités de chaque dégradé, la lueur composée en tout
      point de la barre latérale sous les traits du feu (trois largeurs de barre), le verre composé
      sur le contenu flouté derrière lui ; texte 4,5:1, texte sur l'action 4,5:1 pour chaque accent.
- [ ] Repli « Réduire la transparence » / « Augmenter le contraste » de macOS
      (`prefers-reduced-transparency: reduce`, `prefers-contrast: more`, exposés par Chromium dans
      Electron 45) : verre opaque, lueur retirée, dégradés unis ; aucun réglage de plus.
- [ ] Aucun `backdrop-filter` ni dégradé animé sur ce qui défile dans le fil.
- [ ] Sépia retiré ; un thème enregistré `sepia` (ancien `theme` ou `lightTheme`) devient Clair.
- [ ] Réglages › Apparence : vignettes en deux rangées (Système, Clair, Fjord, Aurore / Sombre,
      Nuit noire, Fjord nuit, Aurore nuit), celles d'Aurore avec leur lueur et le trait dégradé,
      marquées « Nouveau ».
- [ ] ADR : les dégradés et le verre sortent du « couleurs seulement » de l'ADR-0027 (ADR-0049).

### Panneau de droite (planches P1–P3)

- [ ] Largeur par défaut 320 px (au lieu de 380).
- [ ] La largeur n'est enregistrée qu'après un glissement du bord par l'utilisateur, plus à chaque
      changement du panneau.
- [ ] Une largeur enregistrée égale à 380 (l'ancien défaut, enregistré d'office) vaut « jamais
      réglée » : 320. **Écart assumé** : quelqu'un qui avait choisi exactement 380 à la main repart
      à 320.
- [ ] Double-clic sur le bord : retour à la largeur par défaut, comme la barre latérale (fiche
      113) ; il n'agrandit plus le panneau (le bouton et le menu Affichage le font toujours).
      Infobulle du bord : « Glisser pour régler la largeur · double-clic : largeur par défaut ».
- [ ] Tests unitaires de chaque point.

### Essais

- [ ] `./scripts/verify` vert.
- [ ] e2e des suites touchées (thèmes, Apparence, panneau), clair et sombre, en français puis en
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
4. **Touches dans le CSS** : nouveau `src/renderer/src/aurora.css` (importé après `styles.css`),
   qui ne lit que les variables `--touch-*` / `--glass-*` ; aucune couleur en dur.
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
