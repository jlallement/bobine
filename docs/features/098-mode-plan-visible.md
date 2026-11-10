# 098 — Mode Plan visible : la zone de saisie change de couleur

- **Statut** : fait
- **Dépend de** : 092 (barre de saisie, icône du mode plan, `isPlanMode`)
- **Agents** : les deux. Le mode plan est reconnu de façon générique (`isPlanMode`, comme
  « Exécuter le plan ») ; aucun code propre à un agent.

## Pourquoi

En mode Plan, l'agent lit et propose sans rien modifier. Aujourd'hui, seule la puce du mode le dit,
dans la même couleur que tout le reste. Une fois la puce repliée en icône (fiche 092), on ne le voit
plus du tout. Il faut que ça se voie au premier coup d'œil, à l'endroit où l'on tape. Il y a un
double enjeu :

- **confiance** : on sait que rien ne sera touché ;
- **clarté** : on sait pourquoi l'agent ne modifie rien.

L'utilisateur a retenu cette idée après la revue d'interface du 2026-10-20.

## Maquette

`e2e/captures/m097-planche-accueil-plan-{dark,light}.png`, partie basse « 3 · Mode Plan visible ».
Captures brutes : `m097-mode-plan-*.png` (hors git).

## Choix d'interface

Tranchés par la session principale, en tant qu'UX senior :

- **La couleur du mode Plan** est un violet propre au mode (`--plan`, `--plan-soft`), défini dans
  chaque thème : clair, sombre, sépia, nuit noire.
  - Si l'accent choisi dans les Réglages est déjà le violet, le mode Plan passe au bleu, pour rester
    distinct de l'accent.
  - Le bouton d'envoi garde l'accent : c'est la marque de l'app, pas un état.
- **La zone de saisie en mode Plan** : bordure et halo de focus `--plan`, fond très légèrement
  teinté (`--plan-soft`). Le passage d'un mode à l'autre est animé en 150 ms, sans animation si
  macOS demande de réduire les animations (`prefers-reduced-motion`).
- **La puce du mode** devient une pastille pleine `--plan-soft`, texte `--plan`, avec l'icône du
  plan (fiche 092) et « Plan ». Repliée en icône par manque de place, elle garde la couleur.
- **Le texte d'invite** devient « Explorer et planifier avec {agent}… ».
- **Une ligne de rappel**, courte, sous la zone de saisie et au-dessus de la ligne du dossier : « Mode
  Plan : l'agent lit et propose, il ne modifie rien. Maj+Tab pour repasser en exécution. » Elle est
  en `--plan`, en petit.
  - La couleur n'est pas le seul signal : le libellé et la ligne le disent aussi (accessibilité).
- **La sortie du mode Plan** se fait sans geste nouveau : « Exécuter le plan » (carte du plan), la
  puce, ou Maj+Tab. La couleur part avec le mode.
- **Ailleurs** : la fenêtre rapide suit la même règle si elle montre le mode, et rien ne change dans
  la liste des conversations.

## Critères d'acceptation

- [x] En mode Plan, la zone de saisie a la bordure, le halo et le fond `--plan`. La puce est une
      pastille « Plan » colorée. Le texte d'invite et la ligne de rappel sont ceux ci-dessus.
- [x] En passant en exécution (puce, Maj+Tab, « Exécuter le plan »), tout revient à la normale.
- [x] Les couleurs existent dans les quatre thèmes, en clair et en sombre. Avec l'accent violet, le
      mode Plan est bleu.
- [x] Le contraste du texte en `--plan` sur le fond reste lisible (WCAG AA pour le texte de la ligne
      de rappel).
- [x] La puce repliée en icône (fenêtre étroite) garde la couleur du mode Plan.
- [x] Ça marche avec Bob et avec OpenCode (leurs modes plan, reconnus par `isPlanMode`).
- [x] Testé contre l'agent factice (scénario avec un mode plan) : e2e `composer`, clair et sombre,
      captures regardées, plus un passage en anglais (`--lang en`).

## Plan

Fichiers (tous dans le périmètre de la session ; aucun dans `sidebar/`, `thread/`, `src/main/`) :

1. **Jetons** — `styles.css`, juste après la section « Couleur d'accent » : `--plan` (violet) en
   clair et en sombre, `--plan` bleu sous `:root[data-accent='violet']` (clair et sombre),
   `--plan-soft` = `--plan` mélangé à `--surface` : il suit Sépia et Nuit noire, qui redéfinissent
   `--surface`. Teintes choisies pour le contraste AA de la ligne de rappel (12 px) sur `--bg` des
   quatre thèmes, accent violet compris (calcul fait avant de coder : ≥ 4,8:1 partout ; revu
   ensuite pour la pastille, voir le journal).
2. **État** — `composer-view.ts` : `planMode` (mode courant reconnu par `isPlanMode`, avec le nom de
   l'option comme `ModeChip`) et `nextModeName` (le mode où mène Maj+Tab, `nextOption`).
3. **Zone de saisie** — `Composer.tsx` : `data-plan` sur `.composer`, invite
   `composer.plan.placeholder` (les invites d'état — démarrage, réponse en cours… — restent
   prioritaires), ligne de rappel `.composer-plan-hint` entre la zone de saisie et
   `ComposerContext`, reliée à la saisie par `aria-describedby`. `styles.css` (section « Zone de
   saisie ») : bordure `--plan`, halo au focus, fond teinté ; transitions de 150 ms (bordure, fond,
   halo, puce), apparition de la ligne en fondu ; rien de tout ça sous `prefers-reduced-motion`.
4. **Puce** — `ModeChip` porte déjà `data-plan` et l'icône du plan (fiche 092) : seulement du CSS
   (`.mode-chip[data-plan]` : fond `--plan-soft`, texte `--plan`), qui vaut aussi repliée en icône.
   `Menus.tsx` ne change que si le CSS ne suffit pas.
5. **Textes** — `composer.plan.placeholder`, `composer.plan.hint`, `composer.plan.hintNoNext`
   (fr, en).
6. **Essais** — unitaires : `composer-view.test.ts` (`planMode`, `nextModeName`), `Composer.test.tsx`
   (invite, ligne, `data-plan`). e2e `composer` (scénario `plan-fichier`, comme la suite `plan`) :
   passage en Plan à la souris (bordure, halo, fond, pastille, invite, ligne, contraste calculé dans
   la page), fenêtre étroite (pastille repliée colorée), Maj+Tab puis « Exécuter le plan » (retour à
   la normale), accent violet (Plan bleu), Sépia / Nuit noire selon le thème de la passe.

Pas de nouvelle dépendance. La fenêtre rapide ne montre pas le mode : rien à y changer. Hors
périmètre : `docs/features/README.md` et les `CHANGELOG` (lignes proposées dans le journal).

## Journal

- 2026-10-20 — Fiche créée après la revue d'interface. Maquette `m097-mode-plan`, choix tranchés par
  la session principale. Rien n'est codé.
- 2026-10-20 — Fait (session de la fiche 098, branche `claude/fiche-098-mode-plan-97945c`).
  - **Jetons** (`styles.css`, après la couleur d'accent) : `--plan` violet `#6b47d6` en clair,
    `#b8a4f8` en sombre ; bleu avec l'accent violet, `#1f5bbf` en clair, `#8ab4f8` en sombre ;
    `--plan-soft` = 13 % (clair) ou 14 % (sombre) de `--plan` dans `--surface`, donc juste en Sépia
    et en Nuit noire sans jeton de plus.
  - **Zone de saisie** : `composer-view.ts` donne `planMode` (`isPlanMode`, comme `ModeChip`) et
    `nextModeName` ; `Composer.tsx` pose `data-plan` sur `.composer`, l'invite
    `composer.plan.placeholder` (les invites d'état restent prioritaires ; le choix de l'invite est
    passé dans `placeholderOf`, la fonction `Composer` touchant les 300 lignes) et la ligne
    `PlanHint`, reliée à la saisie par `aria-describedby`. CSS : bordure `--plan`, halo de 3 px au
    focus, fond à 4 % de `--plan` ; transitions de 150 ms, fondu de la ligne ; rien de tout ça sous
    `prefers-reduced-motion`. Le bouton d'envoi garde l'accent.
  - **Puce** : seulement du CSS (`.mode-chip[data-plan]`), `ModeChip` posant déjà `data-plan` et
    l'icône du plan : `Menus.tsx` n'a pas changé. Repliée en icône, elle garde sa pastille.
  - **Contraste** (WCAG, mesuré dans la page par l'e2e, pixel de canevas) : ligne de rappel sur le
    fond 5,1 à 9,96:1 ; texte de la pastille sur son fond 4,61 à 6,83:1, dans les quatre thèmes,
    avec et sans accent violet. Les premières teintes (`#a993f5`, `#7aa7f5`, `#2563c9`) donnaient une
    ligne AA mais une pastille à 3,93, 4,12 et 4,39:1 : texte éclairci en sombre, bleu foncé en
    clair, fond de pastille un peu moins teinté en sombre.
  - **Essais** : unitaires `composer-view.test.ts` (modes de Bob — agent, plan, ask — et d'OpenCode
    — build, plan —, un seul mode), `Composer.test.tsx` (zone teintée, invite, ligne, Maj+Tab ;
    hors Plan ; pendant une réponse). e2e `composer`, nouveau volet « mode Plan visible » (scénario
    `plan-fichier`) : 19 vérifications par thème, clair et sombre verts, captures `composer-10` à
    `composer-15` regardées ; passage `--lang en` vert (captures `en-composer-*` regardées). Suites
    qui passent en mode Plan : `plan`, `commands`, `questions` vertes, clair et sombre.
    `./scripts/verify` vert (1077 tests). Suite complète (`pnpm e2e`) non lancée : elle tourne
    avant le push, à l'intégration.
  - **Écarts au plan / aux choix** :
    - la ligne de rappel nomme le mode où mène Maj+Tab (« Maj+Tab pour passer en Code. »), comme
      la maquette (« pour repasser en Build »), au lieu de « repasser en exécution » : Maj+Tab
      passe au mode **suivant**, et avec Bob (agent, plan, ask) c'est « Ask », pas l'exécution.
      Si le mode suivant est lui aussi un mode plan (ou s'il n'y en a qu'un), la ligne s'arrête à
      la première phrase ;
    - la pastille montre le nom du mode donné par l'agent (« Plan » pour l'agent factice et Bob),
      comme le menu, plutôt qu'un « Plan » écrit par l'app ;
    - pendant une réponse, la puce est désactivée (fiche 092) et sa pastille passe à 50 %
      d'opacité, comme les autres puces ; la bordure et la ligne restent.
  - **Hors périmètre touché** : `src/shared/i18n/fr.generated.d.ts` (régénéré par `typecheck`).
  - **Reste** : essai à la vraie souris à l'intégration (session principale) ; index
    `docs/features/README.md` et CHANGELOG à l'intégration. Lignes proposées :
    - fr (« Nouveau ») : « En mode Plan, la zone de saisie prend la couleur du mode (bordure, halo,
      fond teinté), la puce du mode devient une pastille « Plan » et une ligne rappelle que l'agent
      lit et propose sans rien modifier, et comment en sortir. »
    - en (“New”): “In Plan mode, the message box takes the mode’s color (border, glow, tinted
      background), the mode chip becomes a “Plan” pill, and a line reminds you that the agent
      reads and proposes without changing anything, and how to leave the mode.”
- 2026-10-20 — **Essai sur l'app assemblée** (098 + 097, OpenCode, projet « carnet »), piloté par le
  port de débogage. Le contrôle de l'écran n'était pas accordé, donc pas à la vraie souris.
  - Mode Plan : bordure violette, pastille « Plan », invite « Explorer et planifier avec
    OpenCode… », ligne de rappel « Maj+Tab pour passer en Build ». Retour en Build : tout redevient
    normal.
  - En sombre, la bordure est plus discrète que sur la maquette ; le halo n'apparaît qu'au focus.
    Acceptable, à revoir si l'usage le demande.
