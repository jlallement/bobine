# 134 — Jetons de thème, terminal qui suit le thème, contrastes

- **Statut** : fait (reste l'essai à la vraie souris, par la session de coordination)
- **Dépend de** : 014 (jetons clair / sombre), 027 (accent, Sépia, Nuit noire), 034 (terminal),
  018 (sortie de commande), 063 (Mermaid), 070 (style des réponses), 098 (couleur du mode Plan)
- **Agents** : les deux. Rien ne dépend de l'agent : ce sont les couleurs de l'interface.
- **Reprend** : lots 136 (« Le terminal suit le thème ») et 142 (« Jetons de thème ») de l'étude du
  23 octobre (`docs/feuille-de-route-2026-10-23.md`). ADR-0027. La page Réglages › Apparence
  (thème clair et thème sombre au choix, migration des préférences) relève de la fiche 136.

## Pourquoi

Les couleurs vivent à trois endroits de `styles.css` (clair et sombre, accents et mode Plan,
Sépia et Nuit noire), plus des valeurs en dur dans le terminal, Mermaid et le main. Résultat :

- les blocs de code sont toujours en `github-dark`, même en Clair et en Sépia ;
- la sortie de commande du fil est toujours sombre ;
- xterm n'écoute que `prefers-color-scheme` : ni Sépia, ni Nuit noire, ni l'accent, et sa palette
  ANSI par défaut est faite pour un fond sombre (le jaune ne se lit pas sur blanc) ;
- Sépia et Nuit noire ne changent que les gris (accent, ok / warn / err, diff du clair ou du sombre) ;
- la fenêtre s'ouvre sur le fond clair ou sombre, même en Sépia ou Nuit noire ;
- `--muted` et l'accent en texte passent sous le contraste AA.

## Critères d'acceptation

- [x] **Source unique** `src/shared/themes.ts`, en trois couches : teintes de base, rôles, jetons de
      domaine (`--code-*`, `--syn-*`, `--ansi-0…15`), pour les 4 palettes et les 4 accents.
- [x] **Généré** : `pnpm themes-css` écrit `src/renderer/src/themes.generated.css` ; un test unitaire
      (lancé par `./scripts/verify`) échoue si le fichier n'est pas à jour.
- [x] **Coloration syntaxique** : une feuille `.hljs-*` branchée sur les `--syn-*` remplace
      `github-dark` ; les blocs de code suivent la palette.
- [x] **Sortie de commande du fil** : fond, texte et couleurs ANSI tirés des jetons.
- [x] **xterm** : couleurs et palette ANSI des jetons ; elles changent dès que la palette ou l'accent
      change, sans rouvrir l'onglet.
- [x] **Mermaid** : couleurs tirées des jetons de la palette en cours (Sépia et Nuit noire compris).
- [x] **Au lancement** : la fenêtre principale et la fenêtre À propos s'ouvrent sur le `--bg` du
      thème enregistré.
- [x] **Contrastes** (test unitaire, chaque palette × accent) : 4,5:1 pour le texte (`--text`,
      `--text-2`, `--muted`, ok / warn / err, accent en lien, `--syn-*`, ANSI sur leurs fonds),
      3:1 pour les bordures fortes et les éléments d'interface, 4,5:1 pour `--on-accent` sur l'accent.
- [x] **Sépia et Nuit noire** ont leurs propres accents, ok / warn / err et couleurs de diff.
- [x] Préférences enregistrées inchangées (`theme`, `accent`) ; pas d'interface de réglage nouvelle.
- [x] e2e : `fun`, `terminal`, `command-output`, `mermaid`, `tables`, `composer`, `changes`, `base`
      en clair et en sombre, avec des captures Sépia et Nuit noire ; captures regardées.

## Plan

**Fichiers** :

| Fichier | Rôle |
|---|---|
| `src/shared/themes.ts` (nouveau) | Teintes, rôles, jetons de domaine des 4 palettes et 4 accents ; `themeTokens(palette, accent)`, `paletteOf(theme, dark)`, `windowBackground(theme, dark)`, `themesCss()` (texte du CSS) ; aucune dépendance |
| `src/shared/contrast.ts` (nouveau) | Luminance et rapport de contraste WCAG 2.x, mélange sRGB (`color-mix`) |
| `src/shared/themes.test.ts` (nouveau) | Contrastes de chaque palette × accent ; le CSS généré est à jour |
| `scripts/themes-css.mts` (nouveau) + script `pnpm themes-css` | Écrit `themes.generated.css`, mis en forme par Prettier |
| `src/renderer/src/themes.generated.css` (généré) | Variables CSS : `:root`, `@media (prefers-color-scheme: dark)`, `[data-palette]`, `[data-accent]` |
| `src/renderer/src/syntax.css` (nouveau) | Classes `.hljs-*` sur les `--syn-*`, remplace `github-dark` |
| `src/renderer/src/theme.ts` (nouveau) | Palette et accent en cours lus sur la page, abonnement aux changements (média + `data-palette` / `data-accent`) |
| `styles.css` | Les trois blocs de couleurs retirés (le reste en place) ; sortie de commande, bouton « Copier » du code, `color: white` sur l'accent → jetons |
| `Markdown.tsx`, `main.tsx` | Imports des deux feuilles |
| `TerminalTab.tsx` | Thème xterm des jetons (ANSI compris), rethème au changement de palette ou d'accent |
| `mermaid-render.ts`, `MermaidBlock.tsx` | Variables Mermaid tirées des jetons, abonnement partagé |
| `renderer-windows.ts`, `index.ts` (main) | `backgroundColor` du thème enregistré |
| `GeneralSettings.tsx` | Pastilles d’accent tirées des jetons, dans la teinte de la palette affichée |
| e2e `command-output`, `terminal`, `mermaid`, `tables` | Une capture de plus en Sépia (clair) ou Nuit noire (sombre) |

**Étapes** :

1. `themes.ts` avec les valeurs actuelles, `contrast.ts`, le test de contrastes : relevé « avant ».
2. Générateur, feuille générée, retrait des blocs de `styles.css` (sans réordonner le reste).
3. Feuille `.hljs-*`, sortie de commande, xterm, Mermaid, fond de fenêtre.
4. Corriger les valeurs qui échouent (`--muted` d'abord), puis Sépia et Nuit noire.
5. ADR-0027, `docs/architecture.md`, CHANGELOG, e2e nommées et captures.

**Règles du test de contrastes** :

- Texte 4,5:1 : `--text`, `--text-2`, `--muted` sur `--bg`, `--sidebar`, `--surface`, `--surface-2` ;
  ok / warn / err sur `--bg`, `--surface`, `--surface-2` et leur fond doux ; l'accent (liens) sur
  `--bg` et `--surface` ; `--text` sur les fonds du diff ; `--code-fg` et les `--syn-*` sur
  `--code-bg` ; les ANSI sur `--code-bg` (sortie du fil) et sur `--surface` (xterm).
- ANSI : une couleur par palette est le « papier » du terminal, gardée pour les fonds (texte noir sur
  jaune, vidéo inverse) : `--ansi-0` (noir) en sombre, `--ansi-15` (blanc vif) en clair. Elle n'est
  pas comptée comme texte.
- Éléments d'interface 3:1 : `--border-strong` sur `--bg` et `--surface` ; l'accent (interrupteurs,
  pastilles) sur `--bg` et `--surface` ; `--plan` sur `--bg`.
- Texte sur l'accent 4,5:1 : `--on-accent` sur `--accent` et sur `--accent-hover`.

**Dépendances** : aucune nouvelle ; `highlight.js` perd seulement sa feuille `github-dark`.

## Journal

- **2026-10-24** — Fiche créée, plan écrit.
- **2026-10-24** — Fait, selon le plan.
  - `shared/themes.ts` : couche 1 par palette (`neutrals`, `hues`, une teinte par accent), couches 2
    et 3 par `themeTokens(palette, accent)`, la même pour toutes les palettes (`--err` = rouge,
    `--syn-keyword` = rouge, `--ansi-1` = rouge…). Le mode Plan est le violet de la palette, ou son
    bleu quand l'accent est violet (le bleu vif en sombre). `PLAN_SOFT_PERCENT` y est aussi :
    `--plan-soft` est généré, et le test le recalcule.
  - `themes.generated.css` : 280 lignes ; un accent autre que l'orange ne pose que ce qui change.
    `styles.css` perd ses trois blocs de couleurs, sans autre déplacement ; la sortie de commande,
    les classes `.ansi-*`, le bouton « Copier » du code et les `color: white` sur l'accent passent
    aux jetons (`--code-*`, `--ansi-*`, `--on-accent`).
  - Restent en dur, voulues indépendantes du thème : châssis des appareils (simulateur, Android),
    bouton des interrupteurs (blanc), surlignage de la recherche dans le fil (jaune), fond du texte
    d'annotation (sur la capture), logo.
  - xterm : thème et 16 couleurs ANSI tirés des jetons ; abonné au mode, à `data-palette` et à
    `data-accent` (`renderer/theme.ts`, partagé avec Mermaid et les pastilles d'accent).
  - Fond au lancement : `windowBackground(theme, nativeTheme.shouldUseDarkColors)` pour la fenêtre
    principale (qui n'en avait pas : blanc) et la fenêtre À propos. La création de la fenêtre
    principale passe dans `renderer-windows.ts` (`createMainBrowserWindow`) : `index.ts` restait
    ainsi sous son plafond de 850 lignes, sans le relever.

**Contrastes, avant → après** (accent orange ; « pire cas » : le plus faible sur les fonds du test) :

| Couple | Clair | Sombre | Sépia | Nuit noire |
|---|---|---|---|---|
| `--muted` sur `--bg` | 4,07 → 5,06 | 5,66 → 6,01 | 3,73 → 5,25 | 7,84 → 7,84 |
| `--muted`, pire cas (dont `--surface-2`) | 3,69 → 4,59 | 4,39 → 4,66 | 3,37 → 4,75 | 6,36 → 6,36 |
| Accent en texte (lien), pire cas | 3,70 → 4,57 | 4,24 → 4,58 | 3,31 → 4,94 | 5,90 → 7,35 |
| Texte sur l'accent | 3,90 → 4,81 | 3,12 → 6,08 | 3,90 → 5,82 | 3,12 → 8,38 |
| Texte sur l'accent, pire accent | 3,90 → 4,81 | 2,44 → 6,08 | 3,90 → 5,82 | 2,44 → 8,38 |
| `--border-strong` sur `--bg` | 1,46 → 3,23 | 1,76 → 3,58 | 1,61 → 3,32 | 1,69 → 3,88 |
| `--ok` sur `--bg` | 4,00 → 6,41 | 6,80 → 7,84 | 3,58 → 5,86 | 9,42 → 12,91 |
| `--warn` sur `--bg` | 3,46 → 5,20 | 7,14 → 7,14 | 3,09 → 5,33 | 9,88 → 12,21 |
| Coloration syntaxique, la plus faible | `github-dark` partout → 4,76 | → 5,74 | → 5,02 | → 4,77 |
| ANSI du terminal, la plus faible | 1,35 (jaune de xterm sur blanc) → 4,55 | → 4,56 | → 4,54 | → 4,55 |

**Écarts au plan et choix faits en route** :

- **Texte sur l'accent en sombre** : foncé (`#1a1918`, noir en Nuit noire) au lieu de blanc. Un
  accent assez clair pour se lire en lien sur le fond sombre (4,5:1) ne peut pas porter du blanc à
  4,5:1 : il fallait choisir, et le texte sur l'accent est rare (bouton d'envoi, pastilles).
- **`--border-strong`** passe à 3:1 : bordures des champs, de la zone de saisie active, des en-têtes
  de tableau plus marquées, surtout en Sombre et Nuit noire. C'est le changement le plus visible.
- **ANSI** : le « papier » (`--ansi-0` en sombre, `--ansi-15` en clair) n'est pas compté comme
  texte. Le noir des palettes sombres redevient sombre (`#1a1918`, `#000000` ; il était gris
  `#6b6a66` dans la sortie du fil), pour le texte noir sur une couleur. Le bleu ANSI des palettes
  sombres est le plus foncé qui passe 4,5:1 : l'invite powerlevel10k de Jérôme pose le dossier en
  blanc sur ce bleu (blanc à 2,9:1 en Sombre, 4,1:1 en Nuit noire ; ses parties grisées, couleur
  250 des 256, restent peu lisibles sur tout bleu clair). Le test l'a vu : le premier réglage
  faisait passer le Plan bleu sous 4,5:1 sur sa pastille, d'où le bleu vif pour le Plan en sombre.
- `--diff-old` et `--diff-new` sont désormais les fonds doux de `--err` et `--ok` (`--err-soft`,
  `--ok-soft`, ce dernier nouveau). `--syn-type` prend l'orange de la palette, distinct de l'accent.
- Pastilles d'accent des Réglages : la teinte de la palette affichée (Sépia : ses accents bruns).
- **e2e** : `e2e/palette.mjs` (variante du mode : Sépia en clair, Nuit noire en sombre ; couleurs
  attendues lues dans `themes.ts`) ; captures `20-commande-*`, `31-terminal-*`, `m0-mermaid-*`,
  `h2-code-*` dans la variante, contrôles des couleurs calculées ; scénario factice `code-colore`
  (suite `tables`). `catalog.mjs` : les jetons et `syntax.css` sont globaux.
- `color-mix` dans `styles.css` (survols, fonds légers) n'est pas vérifié par le test, sauf
  `--plan-soft`.

**Vérifications** : `./scripts/verify` vert. e2e : `pnpm build && pnpm e2e fun terminal
command-output mermaid tables composer changes base`, clair et sombre, 3 suites en parallèle,
deux passages. Premier passage : `terminal` en échec sur « commande lancée … écran lu par l'agent »
(l'agent lit l'écran avant que le vrai shell, powerlevel10k, ait affiché la sortie : délai sous la
charge, pas les couleurs), verte seule (`--jobs 1`). Second passage, après le réglage du bleu ANSI :
15 / 16, `base` sombre en délai dépassé sur l'ouverture du menu d'agent, verte rejouée seule (clair
et sombre). Captures regardées dans les 4 palettes (`h2-code-*`, `20-commande-*`, `31-terminal-*`,
`m0-mermaid-*`, `composer-14/15-plan-*`, `e0-nuit-noire`). La suite complète n'a pas été jouée
(prévue à la fin des vagues).

**À vérifier à la vraie souris** (session de coordination) :

1. Réglages › Général, un terminal ouvert : Clair → Sépia → Sombre → Nuit noire → Système. Le
   terminal change de couleurs aussitôt, sans se vider ni clignoter ; curseur et sélection à l'accent.
2. Changer d'accent, terminal et un diagramme Mermaid affichés : curseur, sélection et diagramme
   suivent ; pastilles d'accent dans la teinte de la palette.
3. Quitter et relancer en Sépia, puis en Nuit noire : la fenêtre principale et « À propos » s'ouvrent
   sur leur fond, sans éclair blanc ni gris.
4. Terminal avec le vrai shell (powerlevel10k) en Sombre, Nuit noire et Clair : segment du dossier,
   `ls -G`, `git diff --color`, `git log --oneline --graph`, un programme plein écran (`htop`, `vim`).
5. Blocs de code (TypeScript, JSON, shell, diff) et bouton « Copier » au survol, dans les 4 palettes.
6. Bordures plus marquées (zone de saisie active, champs des Réglages, tableaux) : juger en Sombre et
   Nuit noire si elles pèsent trop.
7. Bouton d'envoi et pastilles sur l'accent en Sombre : icône foncée sur l'accent, lisible.
8. Mode Plan avec l'accent violet dans les 4 palettes : pastille et ligne de rappel lisibles.
9. Thème « Système » : basculer macOS clair / sombre, l'app et le terminal suivent en direct.
