# 116 — Fenêtre « À propos de Bobine »

- **Statut** : fait (essai à la vraie souris à faire : glisser la fenêtre, feu rouge, ⌘W)
- **Dépend de** : 027 (menu), 062 (fenêtre secondaire), 105 (« Signaler un problème »), 058 et 054 (agents installés, version annoncée)
- **Agents** : les deux (rien ne touche les agents ; leur version est lue dans ce que l'app sait déjà)

## Pourquoi

Bobine › « À propos de Bobine » ouvre le panneau natif de macOS : l'icône et la version, rien
d'autre, et aucun moyen de signaler un problème ou de retrouver les nouveautés. L'utilisateur veut
une vraie fenêtre À propos, sobre : pas d'étalage d'informations techniques, mais de quoi les
copier d'un geste pour un signalement.

## Critères d'acceptation

- [x] Bobine › « À propos de Bobine » ouvre une fenêtre de l'app (plus le panneau natif) :
      ≈ 400 × 420 px, attachée à la fenêtre principale et centrée sur elle, non redimensionnable,
      barre de titre masquée avec les feux, claire ou sombre selon le thème (variantes et accent
      compris). Échap, ⌘W ou le feu rouge la ferment ; une seconde ouverture ramène la même.
- [x] Contenu : grande icône de l'app, « Bobine », « Version 0.4.0 · 22 octobre 2026 » (version de
      `package.json`, date de build ; en développement la date du jour), la phrase de
      présentation (`settings.about.description`).
- [x] « Nouveautés » ferme la fenêtre et ouvre Réglages › À propos dans la fenêtre principale
      (section où se lisent les nouveautés).
- [x] « Signaler un problème » ouvre dans le navigateur l'issue GitHub préremplie, comme la
      fiche 105 (gabarit `bug.yml`, version), avec le bloc d'infos techniques comme rapport.
- [x] Ligne discrète : « GitHub » (dépôt), « Licence Apache 2.0 » (`LICENSE` sur GitHub),
      « Copier les infos techniques » : version, commit et date de build, Electron, Chromium,
      Node, macOS (version lisible), architecture, langue de l'interface, agents installés avec
      leur version connue ; puis « Copié » deux secondes.
- [x] Aucune information technique affichée dans la fenêtre (commit injecté au build, jamais
      affiché). Réglages › À propos inchangé.
- [x] Tout passe par l'IPC typé ; le renderer ne lance rien.
- [x] Testé : unitaires (menu, bloc d'infos, fenêtre, vue), suite e2e `about` (menu, copie,
      Nouveautés, signalement, Échap), clair, sombre et `--lang en`, captures regardées.

## Plan

Décisions (2026-10-22) :

- **Attachée, pas une feuille** : `modal: true` d'Electron fait sur macOS une *feuille* (sheet)
  glissée sous la barre de titre, sans feux, ce qui contredit la maquette (feu rouge). La fenêtre
  est donc une **fenêtre enfant** (`parent` = fenêtre principale) : toujours au-dessus d'elle,
  centrée sur elle, elle la suit si on la déplace, avec ses feux (rouge seul actif). Sans fenêtre
  principale ouverte (fermée, l'app vit encore), elle s'ouvre seule, centrée sur l'écran.
- **Date et commit du build** : `define` d'electron-vite pour le main (`__BOBINE_BUILD__` :
  date locale `AAAA-MM-JJ`, commit court par `git rev-parse --short HEAD`) ; `pnpm dev` : date du
  jour et `dev`. Lus par `main/build-info.ts` (repli « dev » hors build : tests). `app:getInfo`
  rend en plus `buildDate` et `commit`.
- **Bloc d'infos techniques** : construit dans le main (`main/technical-info.ts`, fonction pure
  testée ; faits lus par `about-window.ts`). En anglais, non traduit : il part dans une issue
  GitHub, comme le journal (ADR-0014). Agents : ceux que l'app trouve installés, avec la version
  annoncée à leur dernier démarrage (fiche 054, `capabilities.announced`), sinon « version
  unknown (not started yet) ». macOS : `process.getSystemVersion()`.
- **Copie** : le renderer demande le bloc (`about:technicalInfo`) et l'écrit avec
  `navigator.clipboard` comme les autres boutons « Copier » ; pas de canal de copie.
- **Liens** : `<a target="_blank">` et `window.open` vers `https://github.com/…` ; le main ouvre
  déjà tout `https://` dans le navigateur système (`loadRenderer`). « Signaler un problème » :
  `issueUrl()` de la fiche 105 avec le bloc d'infos techniques comme rapport. Écart assumé : la
  fiche 105 joint le rapport de Réglages › Diagnostic, qui démarre les agents et interroge Xcode
  (plusieurs secondes) ; la fenêtre À propos se veut instantanée, et le gabarit renvoie au
  rapport complet.
- **Canaux** : `about:technicalInfo` (bloc texte), `about:close` (Échap), `about:showChangelog`
  (ferme, ramène la fenêtre principale, évènement `app:showChangelog` → Réglages › À propos).
- **Plafonds d'ESLint** : `main/index.ts` (842/850) et `main/ipc.ts` (798/800) sont au bord.
  Découpage plutôt qu'exception : préférences durcies, `loadRenderer` et les fenêtres
  secondaires (rapide, À propos) passent dans `main/renderer-windows.ts` ; les canaux `app:*` et
  `about:*` dans `main/app-ipc.ts`.

Fichiers :

1. `electron.vite.config.ts` (`define`), `src/main/build-info.ts`.
2. `src/main/technical-info.ts` (+ test), `src/main/about-window.ts` (`AboutWindow`, `centerOn`,
   faits du système ; + test), `src/main/renderer-windows.ts` (sorti d'`index.ts`).
3. `src/shared/ipc.ts` (`AppInfo.buildDate`, `commit`, canaux, évènement), `src/main/app-ipc.ts`
   (sorti d'`ipc.ts`), `src/preload/api.ts` (`about`, `app.onShowChangelog`).
4. `src/main/menu.ts` (entrée `about` qui appelle l'app, + test), `src/main/index.ts` (branchement).
5. Renderer : `main.tsx` (`#about`), `components/about/AboutWindow.tsx` (+ test),
   `App.tsx` (`app:showChangelog`), `styles.css` (section « Fenêtre À propos », en fin de
   fichier), clés `about.*` en FR et EN.
6. e2e : `e2e/suites/about.mjs`, inscrite dans `e2e/run.mjs`.
7. Doc : `docs/architecture.md`, `CHANGELOG.md`, `CHANGELOG.en.md`, index des fiches.

Pas de nouvelle dépendance.

## Journal

- 2026-10-22 — Fiche créée d'après la maquette validée par l'utilisateur.
- 2026-10-22 — Implémentée selon le plan, dans le worktree `claude/fiche-116-a-propos-1a5ce7`.
  - **Main** : `build-info.ts` (date et commit du build par `define`), `technical-info.ts` (bloc
    en anglais), `about-window.ts` (`AboutWindow`, `centerOn`, faits du système),
    `renderer-windows.ts` (sorti d'`index.ts` : préférences durcies, `loadRenderer`, fenêtres
    rapide et À propos), `app-ipc.ts` (sorti d'`ipc.ts` : canaux `app:*` et `about:*`). Menu :
    `MenuOptions.about` remplace le rôle `about` (panneau natif gardé si l'option manque).
  - **Renderer** : page `#about` → `components/about/AboutWindow.tsx` (icône 96 px, nom, version et
    date en toutes lettres dans la langue de l'interface, présentation, « Nouveautés »,
    « Signaler un problème », ligne GitHub · Licence · Copier ; « Copié » 2 s ; Échap ; titre de la
    fenêtre « À propos de Bobine » pour le menu Fenêtre) ; `App.tsx` ouvre Réglages › À propos sur
    `app:showChangelog`. Clés `aboutWindow.*` et `ipc.unavailable.about` en FR et EN ; reprises :
    `settings.about.description`, `diagnostics.reportIssue`, `menu.about`.
  - **Écarts** : fenêtre enfant attachée plutôt que `modal` (feuille sans feux sur macOS, voir le
    plan) ; « Signaler un problème » joint le bloc d'infos techniques, pas le rapport complet du
    Diagnostic (qui démarre les agents). Découpage d'`index.ts` et d'`ipc.ts` (au bord de leur
    plafond ESLint) au lieu d'une exception. Version de macOS telle que la donne
    `process.getSystemVersion()` (ex. `27.0.0`).
  - **Essais** : unitaires (`technical-info`, `build-info`, `about-window`, `app-ipc`, `menu`,
    `AboutWindow.test.tsx`) ; `./scripts/verify` vert ; suite e2e `about` (nouvelle) verte en
    clair, sombre et `--lang en` : menu → une seule fenêtre, attachée, 400 × 420, non
    redimensionnable ; version et date ; rien de technique affiché ; copie (presse-papiers relu
    puis rendu) ; GitHub, licence et issue ouverts dans le navigateur (`shell.openExternal`
    remplacé) ; Nouveautés → Réglages › À propos ; Échap. Captures `o0-a-propos`,
    `o1-a-propos-copie`, `o2-nouveautes` (et `en-…`) regardées. Lancée à la main : fenêtre
    centrée sur la principale (556, 166 pour une principale en 116, 33), feux : fermer seul actif.
  - **Pas vérifié** : l'essai à la vraie souris (glisser la fenêtre par son fond, feu rouge, ⌘W),
    que le CDP ne sait pas faire ; l'accès à l'app pour computer-use a été refusé. ⌘W et le feu
    rouge sont le comportement standard de macOS (rôle `close`, `closable`), le glisser vient de
    `-webkit-app-region: drag` sur le fond, boutons et liens exclus.
  - La suite e2e complète (`pnpm e2e`) n'a pas tourné : pas de push demandé.

