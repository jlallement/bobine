# 168 — Thème Fjord (clair et sombre)

- **Statut** : fait (reste l'essai à la vraie souris)
- **Dépend de** : 134 (jetons de thème, contrastes), 136 (page Apparence, thèmes par mode)
- **Agents** : les deux. Rien ne dépend de l'agent : ce sont des jetons de couleur.

## Pourquoi

Les quatre palettes de Bobine sont chaudes (papier de Claude Desktop, Sépia) ou neutres (Sombre,
Nuit noire). Il manque une palette **froide et calme** pour ceux qui passent la journée devant le
fil : gris bleutés, fonds légèrement teintés, contrastes doux mais conformes AA. On ajoute un thème,
« Fjord », en deux variantes : **Fjord** (mode clair) et **Fjord nuit** (mode sombre). Le thème par
défaut ne change pas (Système : Clair le jour, Sombre la nuit).

## Critères d'acceptation

- [x] Deux palettes `fjord` (clair) et `fjordNight` (sombre) dans `src/shared/themes.ts`, avec les
      trois couches (neutres, teintes, six accents) ; aucune couleur ailleurs.
- [x] Le test de contrastes (`themes.test.ts`) couvre les deux palettes et les six accents, et
      passe (texte 4,5:1, éléments d'interface 3:1, grille d'activité, Plan distinct de l'accent).
- [x] `pnpm themes-css` les pose sur `:root[data-palette='fjord']` (dans `prefers-color-scheme:
      light`) et `:root[data-palette='fjordNight']` (dans `dark`) ; le test de fraîcheur du CSS
      généré passe.
- [x] Réglages › Apparence › Thème : deux vignettes de plus, « Fjord » après Sépia et « Fjord
      nuit » après Nuit noire ; elles fixent le mode et son thème comme Sépia / Nuit noire ;
      « Système » reste Clair + Sombre ; la rangée de vignettes passe à la ligne si la place manque.
- [x] Préférences : `lightTheme` accepte `fjord`, `darkTheme` accepte `fjordNight` (lecture et
      choix testés) ; une valeur inconnue est toujours ignorée.
- [x] Le fond des fenêtres au lancement (`windowBackground`), le terminal et Mermaid
      (`themeTokens` via `paletteOf`) suivent la palette.
- [x] Textes dans `fr.json` et `en.json` (« Fjord », « Fjord nuit » / « Fjord Night »).
- [x] e2e `settings` (clair et sombre) : la vignette du mode est cochée, la palette posée et le
      fond `--bg` celui de Fjord ; captures `81-apparence-fjord` regardées.
- [x] Le thème par défaut est inchangé (test des préférences par défaut).

## Choix de la palette

- **Neutres** : gris bleutés (teinte ≈ 210°, saturation basse). Clair : fond `#f5f7fa`, cartes
  blanches, barre latérale `#ebeff4` ; texte encre `#1c2733`. Sombre : fond ardoise `#1a2028`,
  cartes `#222932`, barre latérale `#151a21` ; texte `#e6ebf1`. Les ombres restent celles du mode.
- **Teintes** : celles de Clair / Sombre décalées vers le froid (rouge un peu framboise, vert
  sapin, cyan glacier), recalées pour le contraste sur les nouveaux fonds.
- **Accents** : les six de l'app, ajustés à ces fonds (l'orange par défaut garde sa chaleur, qui
  ressort bien sur le froid).
- **Typographie** : inchangée (police système de l'app, police des réponses au choix). Une police
  web incluse (par exemple Inter ou IBM Plex Sans, licence OFL) donnerait plus de caractère, mais
  c'est une dépendance (fichiers de police dans le paquet, ~300 Ko par graisse) : **proposée, pas
  ajoutée** — à décider, avec un ADR si on l'accepte.

## Plan

Fichiers touchés :
- `src/shared/themes.ts` : `PALETTES`, `TINTS.fjord`, `TINTS.fjordNight`, `paletteOf`.
- `src/shared/preferences.ts` : `LightTheme`, `DarkTheme`, listes, `THEME_CHOICES`,
  `themeChoicePreferences`.
- `scripts/themes-css.mts` puis `pnpm themes-css` (`themes.generated.css`).
- `src/renderer/src/appearance.ts` : `data-palette` pour toute palette autre que Clair / Sombre.
- `src/renderer/src/styles.css` : `.theme-choices` en `flex-wrap`, vignettes 58 × 40 px.
- `src/shared/i18n/locales/fr.json`, `en.json`.
- Tests : `themes.test.ts`, `preferences.test.ts` ; e2e `settings.mjs`.
- Doc : cette fiche, index, `CHANGELOG.md`, `CHANGELOG.en.md`.

Pas de nouvelle dépendance. Pas d'ADR : on reste dans le cadre de l'ADR-0027 (palettes fermées,
contrastes testés).

## Journal

- 2026-11-05 : fiche créée (numéro 168 : la 167 est peut-être prise par une autre session).
- 2026-11-05 : fait. Palettes `fjord` et `fjordNight` (neutres, teintes, six accents) ; contrastes
  AA verts du premier coup pour les douze combinaisons. `VARIANT_PALETTES` remplace la liste
  « Sépia ou Nuit noire » codée à deux endroits (`paletteOf`, `applyPalette`). Écart au plan :
  identifiant `fjordNight` en camelCase (comme les clés de préférences), pas `fjord-night`. Essais :
  `settings` coche Fjord / Fjord nuit selon le mode et vérifie `--bg` (capture
  `81-apparence-fjord`) ; `composer` ajoute une capture du mode Plan en Fjord
  (`composer-16-plan-fjord` / `-fjordNight`) avec ses contrastes. Reste : essai à la vraie souris
  (sept vignettes sur une ligne à la largeur minimale des Réglages, lisibilité sur un long fil),
  et la décision sur une police incluse (voir « Choix de la palette »).
- 2026-11-05 : sept vignettes de 64 px serraient l'aide « Système : Clair le jour… » sur quatre
  lignes (capture `81-apparence-fjord-light`) : vignettes ramenées à 58 × 40 px, écart 8 px, et
  170 px gardés à la colonne de texte de cette ligne ; deux lignes en français comme en anglais.
  Essais : suite complète (`--changed` = tout, fichiers partagés) verte sauf `base` clair, hors
  délai sur le menu des modèles pendant que d'autres sessions chargeaient la machine ; repassée
  verte avec `--jobs 1` (`base settings composer fun`, clair et sombre). `--lang en` : `settings`
  et `composer` verts ; `base` échoue sur le nom de l'agent factice (« Agent factice » attendu
  « Mock agent »), sans lien avec ce thème, signalé dans l'audit UX du 5/11.
- 2026-11-05 : police incluse écartée par l'utilisateur : Fjord garde la police système (pas de
  dépendance, pas d'ADR). Fiche relue par la session mère et fusionnée dans `main`.
