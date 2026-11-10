# 145 — Préversion Linux (sans simulateur iOS)

- **Statut** : en cours, **expérimental dans `main`** (2026-10-25), pas encore publié. Le code
  Linux est masqué par les capacités de la plateforme (rien ne change sur le Mac) ; un tag ne
  construit Linux que si la variable du dépôt `BOBINE_LINUX_RELEASE` vaut `true`
  (`release.yml`) ; e2e Linux à la main (`e2e.yml`, Système : `linux`). Première publication
  reportée après la 0.6.0 macOS, sans numéro ni date fixés.
- **Dépend de** : 012 (packaging), 034 (terminal), 041 et 080 (journal), 059 (publication), 115
  (lanceur e2e), 138 (processus), 143 (Electron 45)
- **Agents** : les deux, sans code propre à un agent. OpenCode tourne sous Linux ; Bob aussi,
  IBM le livre en `.deb` (D5).

## Reste avant la première préversion Linux (par priorité)

Le détail est dans les lots du plan et les critères ; ici, l'ordre.

1. **Décisions à revoir après l'essai réel** : D1 (l'AppImage ne démarre pas sur un Ubuntu
   récent : `.deb` seul en préversion ?) et D6 (essai fait sur Ubuntu 26.04, pas 24.04).
2. **e2e Linux verts** (`e2e.yml`, Système : `linux` ; 90/125 au premier passage, voir le
   journal) : conditionner les suites mêlées (lot 5), gestionnaire de fenêtres dans le job,
   corriger ce qu'elles trouvent.
3. **Lot 2** — barre de titre et menu Linux, raccourcis Ctrl, textes Mac/Finder/Dock/⌘,
   `desktopName`.
4. **Lot 3** — intégration au bureau (git en langue fixe : fait), clés d'API sans trousseau (D4) ;
   vérifier aussi la réinitialisation de la fiche 148 (trousseau, corbeille) sous Linux.
5. **Lot 4** — « préversion Linux » dans l'À propos, node-pty pour `pnpm dev`, `e2e:packaged`.
6. **Essais réels** : X11 en plus de Wayland ; Bob par son `.deb`, `pnpm bob-probe`, essai de
   Jérôme.
7. **Lot 6** — doc (installation, agents, « Compatibilité Bob »), puis `BOBINE_LINUX_RELEASE` à
   `true` pour une version Mac ultérieure, une fois Linux validé.

## Pourquoi

Bobine ne s'installe aujourd'hui que sur un Mac (Apple Silicon). Une partie des développeurs visés
travaille sous Linux, et les agents ACP (Bob, OpenCode) y tournent. La base est déjà
largement portable : Electron, client ACP générique, panneaux navigateur et Android, et
`./scripts/verify` passe déjà sous Linux en CI (`ci.yml`, `ubuntu-latest`). Ce qui reste propre au
Mac se trouve dans quelques modules du main, dans la barre de titre et dans le packaging. Une
**préversion** (annoncée comme telle) donne l'app aux utilisateurs Linux sans promettre la parité :
ce qui ne peut pas marcher est masqué, pas laissé en panne.

## Périmètre

**Dans la préversion** : tout ce qui ne dépend pas de macOS. Conversations, agents (Bob, OpenCode,
agents personnalisés), permissions, diffs, git et worktrees, terminal
intégré, navigateur intégré et ses outils, émulateur Android, lancement des serveurs de
développement, notifications, mise en veille empêchée, réglages, journal.

**Hors préversion** : simulateur iOS (Xcode n'existe que sur macOS), installation par l'app
elle-même (`/Applications`), langue « par app » de macOS, compteur du Dock, Windows (fiche à
part, plus tard). Capture d'écran jointe au message : voir les écarts.

## Critères d'acceptation

- [x] Décisions D1 à D7 tranchées par Jérôme (2026-10-24).
- [x] ADR « Bobine multiplateforme : macOS, puis Linux en préversion » écrit
      ([ADR-0032](../adr/0032-bobine-multiplateforme.md)).
- [ ] Une construction Linux produit une AppImage et un `.deb`, x64 et arm64 (D1, D2), qui
      s'installent et démarrent sur Ubuntu 24.04 GNOME (D6), sessions Wayland et X11.
- [ ] Publiés avec la version du Mac (même tag, même numéro) ; « préversion Linux » dit dans les
      notes de version et la fenêtre À propos (D7).
- [ ] L'app packagée sous Linux a la même sécurité que sur macOS : `contextIsolation`, `sandbox`,
      CSP, verrous Electron (`electronFuses`), agent factice absent.
- [ ] Rien de propre à macOS n'est visible ni proposé sous Linux : pas d'onglet ni d'outils
      `ios_*`, pas de ligne Xcode au Diagnostic, pas d'installation dans `/Applications`, pas de
      réglage de langue du système, pas de textes « Finder », « Dock », « Trousseau » ni de « ⌘ ».
- [ ] Barre de titre Linux : boutons de fenêtre du système dessinés à droite par Electron
      (`titleBarOverlay`), sans la marge de 84 px réservée aux boutons de fenêtre de macOS ;
      barre de menu masquée, affichée par Alt, raccourcis du menu actifs (`CmdOrCtrl` → Ctrl).
- [ ] Polices installées (Réglages › Apparence) lues par `fc-list` ; « Ouvrir dans un terminal »
      lance le terminal de la machine ou disparaît s'il n'y en a pas ; son d'attente joué avec les
      sons du système freedesktop, réglage masqué s'il n'y en a aucun ; « attire l'attention »
      par `flashFrame` à la place du rebond du Dock.
- [ ] Clés d'API (D4) : chiffrées par le trousseau de la session (GNOME Keyring ou KWallet) ;
      sans trousseau, fichier en droits 600 non chiffré, et Réglages › Agents le dit en une ligne
      (installer un trousseau pour chiffrer), sans boîte de dialogue bloquante.
- [ ] Processus : un agent arrêté, ou l'app qui plante puis redémarre, ne laisse aucun processus
      (registre `agents.pids` et `ps` de procps).
- [ ] Le PATH du shell de connexion est lu au lancement depuis le menu des applications (pas
      seulement depuis un terminal) : `npx`, `opencode` sont trouvés.
- [ ] Testé contre l'agent factice, sous Linux : conversation, permission, diff, terminal, arrêt
      de l'agent sans orphelin (suites e2e marquées pour Linux, sous `xvfb`, clair et sombre,
      captures regardées).
- [ ] Essai réel dans une machine virtuelle Ubuntu (mémoire « essayer à la vraie souris ») :
      installation, OpenCode avec un modèle gratuit, navigateur intégré, terminal, notification.
- [ ] Bob installé par son `.deb` dans la même machine virtuelle : `pnpm bob-probe` (0 bobcoin)
      donne le même contrat que sur le Mac ; essai réel avec Bob fait par Jérôme.
- [ ] `./scripts/verify` passe ; `pnpm build && pnpm e2e --changed` passe sur le Mac (aucune
      régression macOS) ; `docs/installation.md`, `docs/architecture.md`, `CHANGELOG.md` et
      `CHANGELOG.en.md` à jour.

## Décisions (tranchées par Jérôme le 2026-10-24)

| N° | Question | Décision | Pourquoi |
|---|---|---|---|
| D1 | Formats livrés | **AppImage + `.deb`** | AppImage marche partout sans droits, `.deb` couvre Ubuntu et Debian. Flatpak et Snap enferment l'app dans un bac à sable qui empêche de lancer les agents, le terminal et git de la machine : écartés. `.rpm` plus tard si on le demande. |
| D2 | Architectures | **x64 + arm64** | x64 pour la majorité, arm64 pour les essais dans une machine virtuelle sur le Mac (UTM) et les machines ARM. Deux jobs GitHub (`ubuntu-24.04`, `ubuntu-24.04-arm`). |
| D3 | Où construire | **Sur Linux seulement** (constat, pas un choix) | node-pty n'a pas de binaire précompilé pour Linux (`prebuilds/` : darwin et win32 seulement), il se compile avec les outils de la machine. Job `release.yml` sous Ubuntu, et machine virtuelle pour construire à la main. |
| D4 | Clés d'API que Bobine pose aux agents (`BOB_API_KEY`, fournisseurs de la fiche 104, agents personnalisés de la fiche 141) | **Comme VS Code / Bob IDE** : trousseau s'il existe ; sinon fichier en droits 600 non chiffré, dit en une ligne dans Réglages › Agents, sans boîte de dialogue bloquante | Usage relevé : sous Linux, Claude Code garde toujours ses identifiants en clair, droits 600 (`~/.claude/.credentials.json`), OpenCode aussi (`auth.json`) ; VS Code, donc Bob IDE, chiffre par le trousseau et propose sinon un « chiffrement faible » (`--password-store=basic`, clé fixe de Chromium, presque du clair). Refuser d'enregistrer ne protégerait guère plus que ce que font les agents eux-mêmes. |
| D5 | Bob sous Linux | **Annoncé** | Bob fonctionne sous Linux, IBM le livre en `.deb` (Jérôme). Contrat vérifié par `pnpm bob-probe` dans la machine virtuelle ; noté dans « Compatibilité Bob » de `docs/acp.md`. |
| D6 | Bureau visé | **Ubuntu 24.04 GNOME**, Wayland et X11 | Le plus répandu ; essais dans UTM sur le Mac. Les autres bureaux « devraient marcher », sans promesse. |
| D7 | Publication | **Même version que le Mac** : AppImage et `.deb` joints à la version GitHub du `.dmg` | Un seul numéro, un seul tag ; « préversion Linux » dit dans les notes et l'À propos. Première publication après la 0.6.0 macOS, une fois Linux validé. |

Choix d'interface tranchés ici (UX) : boutons de fenêtre du système à droite par
`titleBarOverlay`, aux couleurs du thème, plutôt qu'un cadre natif qui casserait les barres de
52 px ; barre de menu masquée (`autoHideMenuBar`) comme les apps Electron courantes sous Linux, le
menu reste joignable par Alt et ses raccourcis restent actifs.

## Plan

Pas de nouvelle dépendance npm. Pour construire, electron-builder télécharge ses outils
(`appimagetool`, `fpm`) sur la machine Linux ; il faut aussi `build-essential` et `python3` pour
node-pty.

**Lot 0 — ADR.** Fait : [ADR-0032](../adr/0032-bobine-multiplateforme.md).

**Lot 1 — capacités de la plateforme (main).** Fait (2026-10-24), sauf la dernière ligne.
- ✅ `src/shared/platform.ts` (`PlatformFeatures` : `simulator`, `selfInstall`, `nativeLanguage`,
  `screenCapture`) et `src/main/platform.ts` (`platformFeatures(platform)`, fonction pure testée ;
  `currentPlatformFeatures(env, platform)` : `BOBINE_PLATFORM` impose un système aux essais).
- ✅ **Injection** (consigne de Jérôme) : `index.ts` lit le système une fois et passe les capacités
  aux fenêtres (`renderer-windows.ts`), à l'installateur, au diagnostic et aux outils de l'agent ;
  aucun module ne teste le système lui-même. Les tests de `process.platform` d'avant (`fonts.ts`,
  `cdp-tab.ts`, `browser-manager.ts`, `page-view.ts`, `node-pty.ts`, `window-all-closed`) passent
  à l'injection au lot 3, quand chacun change.
- ✅ Renderer : capacités passées sur sa ligne de commande comme la langue (fiche 074), lues par le
  preload (`window.api.app.features`, `renderer/platform-features.ts`) ; connues dès le premier
  rendu, sans canal `app:platform`. Onglet du simulateur absent du panneau et du « + », bouton de
  capture d'écran absent.
- ✅ Sans `simulator` : outils `ios_*` non servis à l'agent, pas de groupe iOS au Diagnostic (ni
  `xcode-select` ni `xcrun` lancés). Le gestionnaire du simulateur reste créé (rien ne l'appelle).
- ✅ `managesNativeLanguage` et `SelfInstaller` suivent leurs capacités ; mise en place de
  l'installateur sortie dans `self-install-setup.ts` (`index.ts` restait sous ses 850 lignes).
- Section « Compatibilité Bob » de `docs/acp.md` : Bob sous Linux (`.deb` d'IBM, D5), version
  sondée par `pnpm bob-probe` dans la machine virtuelle.

**Lot 2 — fenêtres et textes (renderer).**
- `renderer-windows.ts` : sous Linux, `titleBarStyle: 'hidden'` + `titleBarOverlay` (couleurs
  `themeBackground` / texte du thème, hauteur 52), recalé au changement de thème ; fenêtre rapide
  : `transparent` seulement si le compositeur le permet (sinon fond opaque arrondi).
- `styles.css` (lignes 140, 442, 3763) : marge des boutons de fenêtre par variable (`--chrome-left`
  84 px sur macOS, 0 sous Linux ; `env(titlebar-area-width)` à droite), classe posée sur `<html>`
  d'après les capacités.
- `menu.ts` : `autoHideMenuBar` sous Linux, menu de l'app sans le menu « Bobine » de macOS
  (À propos, Réglages et Quitter rangés dans Fichier et Aide).
- Raccourcis affichés par plateforme (`shared/shortcuts.ts`, champ `keys` : `Ctrl+K` au lieu
  de `⌘K`) ; gestionnaires clavier du renderer qui n'écoutent que `metaKey` (ex. recherche des
  Réglages, `SettingsDialog.tsx`) passés à « ⌘ sur macOS, Ctrl ailleurs ».
- `fr.json` / `en.json` : relire les 33 textes qui citent Mac, Finder, Dock, Trousseau ou ⌘ ;
  version générique quand elle suffit, sinon variante par capacité (`…FileManager`). Glossaire de
  `docs/traduction.md` complété.

**Lot 3 — intégration au bureau Linux (main).**
- `fonts.ts` : `fc-list : family spacing` (chasse fixe : `spacing=100`).
- `terminal/terminal-app.ts` : premier trouvé parmi `xdg-terminal-exec`, `x-terminal-emulator`,
  `gnome-terminal`, `konsole`, `xterm` ; aucun → capacité absente.
- `notifications/chime.ts`, `system-alerts.ts` : sons de `/usr/share/sounds/freedesktop/stereo`
  joués par `pw-play` ou `paplay` ; liste des sons par plateforme dans `shared/preferences.ts`.
- `notifications/dock-bounce.ts` : remplaçant `flashFrame` (attention demandée à la fenêtre).
- `android/sdk.ts` : `~/Android/Sdk` (Android Studio sous Linux) et Java d'Android Studio du
  dossier choisi ; KVM requis par l'émulateur, dit par le Diagnostic.
- `screen-capture.ts` : voir écarts (masquée en préversion).
- `quick-entry.ts` : raccourci global ; sous Wayland, `GlobalShortcutsPortal` (option de Chromium)
  ; s'il ne s'enregistre pas, Réglages le disent au lieu d'un raccourci muet.
- Clés d'API (`index.ts`, `agent-config/api-keys.ts`) : `safeStorage.getSelectedStorageBackend()`
  ; `basic_text` (pas de trousseau) → valeur en clair dans le fichier des clés, gardé en droits
  600, et une ligne dans Réglages › Agents (D4). Le fichier dit, par clé, si elle est chiffrée :
  une clé en clair est rechiffrée dès qu'un trousseau apparaît.
- Vérifier sous Linux, sans changement attendu : `shell-env.ts` (`$SHELL -ilc`),
  `process-group.ts` (groupes POSIX), `process-registry.ts` (`ps -A -ww -o …` de procps),
  `preview/dev-servers.ts` (`/bin/sh -c`), `terminal-manager.ts` (`-l`), `keep-awake.ts`
  (`powerSaveBlocker`, inhibition par D-Bus), notifications (libnotify).

**Lot 4 — packaging.** Squelette fait (2026-10-24), jamais lancé sous Linux : à essayer dans la
machine virtuelle, puis par le job GitHub (branche à pousser).
- ✅ `electron-builder.yml` : section `linux` (cibles de D1 et D2, `category: Development`, icône
  `build/icon.png`, `executableName: bobine`, `.desktop` avec `StartupWMClass`) ; `files` :
  exclure les `prebuilds/` de node-pty sous Linux ; `extraResources` AXe sous `mac` seulement.
  `maintainer` du `.deb` : « Bobine <https://github.com/jlallement/bobine> », à confirmer.
- ✅ node-pty compilé sous Linux comme dans `ci.yml` (`node-gyp rebuild` dans son dossier, N-API :
  valable pour Electron), s'il manque ; `asarUnpack` de `build/Release`.
- ✅ `pnpm package --linux` : demandé explicitement, jamais deviné d'après la machine (pas de
  signature ni de notarisation, pas de `.dmg`, pas d'AXe) ; sans `--linux`, rien ne change.
  `--dry-run` reste l'essai à blanc de la signature Mac, quelle que soit la machine.
- ✅ `.github/workflows/release.yml` : job `linux` (x64 `ubuntu-24.04`, arm64 `ubuntu-24.04-arm`)
  après le `.dmg`, qui joint AppImage, `.deb` et `SHA256SUMS-linux-<arch>.txt` à la Release du
  tag ; à la main, artefacts 7 jours.
- À propos et `technical-info.ts` disent « préversion Linux ».
- `pnpm dev` sous Linux : node-pty n'y est pas compilé (`allowBuilds: node-pty: false`) ; à
  régler (compilation dans `predev` sous Linux), sinon le terminal intégré ne marche pas en dev.
- `e2e/packaged.mjs` : version Linux (démarrage de l'AppImage sous `xvfb-run`).

**Lot 5 — essais.**
- Unitaires : `platform.ts`, `fonts.ts` (sortie de `fc-list`), `terminal-app.ts`, `chime.ts`,
  `sdk.ts`, D4, avec plateforme et commandes injectées (tournent aussi sur le Mac).
- ✅ e2e : une suite déclare les **capacités** dont elle a besoin (`needs`, pas un nom de
  système) ; le lanceur lit celles de la machine (`BOBINE_PLATFORM` compris), saute et nomme les
  suites qui en demandent une absente (`simulator`), et ne note pas vert un passage qui en a
  sauté. Nouvelle suite `platform` : l'app avec les capacités du Mac puis de Linux, sur le Mac.
  Le faux `xcrun` reste tel quel (script `sh`, sans effet sans simulateur).
- Suites mêlées, à conditionner quand Linux tournera : `quick` et `annotate` (capture d'écran),
  `inbox` et `notifications` (compteur du Dock), `settings` (rebond du Dock), `mcp` (outils
  `ios_*`). Sous `BOBINE_PLATFORM=linux`, elles échoueraient sur ces vérifications.
- Job manuel `e2e.yml` sous `ubuntu-24.04` avec `xvfb-run`.
- Essai réel : Ubuntu 24.04 arm64 dans UTM sur le Mac, sessions Wayland puis X11.

**Lot 6 — clore.** `docs/installation.md` (section Linux : AppImage, `.deb`, trousseau, KVM),
`docs/architecture.md` (capacités de la plateforme), `docs/agents.md` (Bob et OpenCode sous Linux),
index, journaux des modifications, fiche.

## Machine virtuelle Linux (pas-à-pas)

Pour les lots 2 et 3 et l'essai réel. Installer la machine est fait par Jérôme (téléchargements,
mot de passe d'administration) ; le reste peut se faire depuis un terminal de la machine.

1. **UTM** sur le Mac (`brew install --cask utm`, ou le Mac App Store).
2. **Image** : Ubuntu 24.04 LTS pour arm64 (ubuntu.com). Desktop si elle est proposée pour arm64 ;
   sinon Server, puis `sudo apt install ubuntu-desktop` et redémarrer.
3. **Machine** : « Virtualiser » (pas « Émuler »), Linux, 4 cœurs, 8 Go de mémoire, 40 Go de
   disque, affichage `virtio-gpu`. Après l'installation : `sudo apt install spice-vdagent`
   (presse-papiers et taille d'écran partagés avec le Mac).
4. **Outils** :
   ```bash
   sudo apt update
   sudo apt install -y build-essential python3 git curl xvfb libfuse2t64 gnome-keyring
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo corepack enable
   ```
   `libfuse2t64` : sans elle, une AppImage ne démarre pas sur Ubuntu 24.04.
5. **Dépôt** : `git clone https://github.com/jlallement/bobine.git`, branche
   `feat/145-preversion-linux` (poussée d'abord), `pnpm install`, puis
   `(cd node_modules/node-pty && npx --yes node-gyp@12 rebuild && node scripts/post-install.js)`
   (node-pty, voir lot 4 ; `pnpm package --linux` le fait aussi s'il manque).
6. **Agents** : OpenCode (installateur officiel ou `npm install -g opencode-ai`), Bob par son
   `.deb` (`sudo apt install ./<fichier>.deb`), puis `pnpm opencode-probe --offline` et
   `pnpm bob-probe`.
7. **Vérifier** : `./scripts/verify` ; `pnpm build && xvfb-run -a pnpm e2e platform` ;
   `pnpm package --linux`, puis `sudo apt install ./dist/Bobine-<version>-arm64.deb` et l'AppImage
   (`chmod +x`).
8. **Sessions** : Wayland par défaut ; X11 par la roue dentée de l'écran de connexion
   (« Ubuntu sur Xorg »). Essayer les deux.
9. **Sans trousseau** (D4) : créer un autre utilisateur, ou arrêter `gnome-keyring-daemon`, puis
   lancer l'app depuis un terminal.

## Écarts assumés par rapport à macOS

| Fonction | Sous Linux en préversion | Pourquoi |
|---|---|---|
| Simulateur iOS | absent | Xcode n'existe que sur macOS |
| Installation par l'app | absente | AppImage et `.deb` suffisent |
| Compteur « À traiter » sur l'icône | absent | pas d'API commune (seul Unity l'affichait) |
| Langue des dialogues du système | celle du bureau | pas d'équivalent à `AppleLanguages` par app |
| Capture d'écran jointe | masquée | sous Wayland, seul le portail de bureau capture, sans choix de zone ; à reprendre dans une fiche à part (`desktopCapturer` + recadrage dans l'app) |
| Fenêtre rapide sous Wayland | si le portail l'accepte | les raccourcis globaux passent par le portail, que tous les bureaux n'ont pas |
| Signature | aucune | pas d'équivalent à Developer ID pour AppImage et `.deb` ; somme SHA-256 publiée avec la version |

## Risques

- **Coût dans la durée** : chaque fiche qui touche l'interface ou les processus se vérifie sur
  deux systèmes. La suite e2e Linux reste manuelle, comme celle du Mac.
- **Diversité des bureaux** (GNOME, KDE, Wayland, X11) : la préversion vise Ubuntu 24.04 GNOME ;
  le reste est « devrait marcher », sans promesse.
- **node-pty compilé** : une montée d'Electron ou de node-pty peut casser la construction Linux
  sans toucher au Mac ; à ajouter aux vérifications de la fiche de montée des dépendances.

## Journal

- 2026-10-24 — Fiche rédigée après le relevé du code propre au Mac : 8 tests de
  `process.platform`, une quinzaine de commandes macOS (`osascript`, `afplay`, `screencapture`,
  `open -a Terminal`, `ditto`, `hdiutil`, `xcrun`, `plutil`), barre de titre `hiddenInset`,
  node-pty sans binaire Linux. Les groupes de processus, `ps`, le shell de connexion et le
  terminal sont POSIX et devraient marcher tels quels. Rien de codé, décisions D1 à D5 en attente.
- 2026-10-24 — Numéro 144 pris entre-temps par « Mon activité » : fiche renumérotée 145.
  Décisions prises avec Jérôme : D1, D2, D6 (Ubuntu 24.04 GNOME), D7 (même version que le Mac,
  après le tag v0.5.0) comme recommandé ; D5 : Bob tourne sous Linux (`.deb` d'IBM). D4 revue
  après la question « pourquoi Bobine a des clés ? » : elles servent aux agents qui ne lisent leur
  clé que dans l'environnement (Bob : `BOB_API_KEY`), aux fournisseurs (fiche 104) et aux agents
  personnalisés (fiche 141) ; sous Linux, Claude Code et OpenCode gardent les leurs en clair
  (droits 600), VS Code chiffre par le trousseau s'il existe. Choix : faire comme VS Code / Bob
  IDE, sans boîte de dialogue bloquante. ADR-0032 écrit (accepté). Reste : le lot 1.
- 2026-10-24 — Préparation dans le worktree `feat/145-preversion-linux` (depuis `main`), sans
  push. Lot 1 fait. Consigne de Jérôme en cours de route : peu de tests de plateforme dans le
  code, de l'injection ; d'où `index.ts` seul lecteur du système et des capacités passées aux
  modules et aux fenêtres. Écarts au plan : capacités passées au renderer sur sa ligne de
  commande (comme la langue) plutôt que par un canal `app:platform` ; `dock` et
  `fileManagerName` laissés aux lots 2 et 3 ; e2e par capacités (`needs`) plutôt que par système
  (`platforms`) ; faux `xcrun` inchangé. La suite `platform` a trouvé un défaut aussitôt : la liste
  vide de Linux arrivait au renderer comme `--bobine-features` (Chromium retire le `=`), donc
  « toutes les capacités » ; passée comme `none`. Packaging Linux et job GitHub écrits, jamais
  lancés sous Linux. Vérifié sur le Mac : `./scripts/verify`, `pnpm package --dir` puis
  `pnpm e2e:packaged` (AXe toujours livré), e2e `simulator`, `diagnostic`, `panel`, `about` et
  `platform`. Pas joué : la suite complète (les fichiers touchés en sélectionnent 61, à lancer
  avant de pousser). Reste : machine virtuelle, lots 2 et 3, Bob sous Linux dans `docs/acp.md`.
- 2026-10-25 — Branche poussée après `pnpm e2e --changed` (123/125 ; `terminal` bloquée par la
  question de mise à jour d'oh-my-zsh du shell de Jérôme, verte après `omz update`). Workflow
  Release lancé à la main sur la branche (run 40175350225) : `.dmg` vert ; les deux jobs Linux
  arrêtés à `./scripts/verify`, avant toute construction. Mes causes : (1) la branche Linux de
  `scripts/package` devinait le système (`uname`) et prenait `--dry-run`, donc `signing.test.ts`
  ne voyait plus le plan de signature (aurait aussi cassé `ci.yml`) → `--linux` explicite, plus
  de détection ; (2) node-pty non compilé dans le job (étape de `ci.yml` oubliée) → ajoutée, et
  `install-app-deps` remplacé par la même compilation. Pas de ma branche : `android-tools.test.ts`
  (« sans image de l'appareil ») échoue déjà sur `main` dans `ci.yml` depuis le 24/10 ;
  `manager.test.ts` (« réponse longue », délai de 1 s) a échoué sur x64 seulement, test lié au
  temps. Ces deux-là bloqueront encore le job x64 tant qu'ils ne sont pas réglés.
- 2026-10-25 — Premier essai réel, dans une VM UTM de Jérôme : **Ubuntu 26.04.1 LTS** arm64
  (pas 24.04 : D6 à revoir), GNOME sous Wayland, 2 cœurs, 3 Go. Branche envoyée par `git bundle`
  (dépôt privé), `pnpm install`, node-pty compilé, `pnpm package --linux` : AppImage (134 Mo) et
  `.deb` (104 Mo) construits. Release (run 40176743007) : job **arm64 vert** ; x64 arrêté à
  `verify` sur `conformance-bob.test.ts` › « annulation » (test lié au temps, pas de ce lot).
  **`.deb` installé par Jérôme, Bobine lancée et utilisée : une vraie conversation avec OpenCode
  2.1.4** (modèle gratuit), sonde `opencode-probe --offline` verte sous Linux. Constats :
  - **AppImage inutilisable sur Ubuntu récent** : son lanceur cherche `libz.so` (paquet
    `zlib1g-dev`), puis le bac à sable de Chromium exige un profil AppArmor que seul le `.deb`
    installe (`/etc/apparmor.d/bobine`, posé par electron-builder). Jamais de `--no-sandbox`.
    D1 (« AppImage partout sans droits ») est à rediscuter.
  - **git en français** (`LANG=fr_FR.UTF-8`) : Bobine ne reconnaît « pas un dépôt » qu'au
    message anglais (`notARepoOrError`, `git/repo.ts`) ; dans l'app, erreurs `git:status` à
    chaque dossier hors dépôt ; deux tests de `verify` échouent (`git.test.ts` : dossier sur un
    autre système de fichiers, « Arrêt à la limite du système de fichiers » ;
    `worktree-cycle.test.ts` : message de git attendu en anglais). Git d'Apple n'est pas traduit,
    d'où un défaut invisible sur le Mac. **Priorité du lot 3** : lancer git avec une langue fixe
    (`LC_ALL=C`) là où l'app lit sa sortie, et reconnaître la limite de système de fichiers.
  - Journal sous Linux : `~/.config/bobine/logs/main.log` (doc et AGENTS.md à compléter).
  - electron-builder demande `desktopName` (rattacher la fenêtre à l'icône sous GNOME) : lot 2.
  - Erreurs EGL au démarrage : carte graphique de la VM sans OpenGL ES 3, Chromium dessine sans
    accélération ; propre à la VM.
- 2026-10-25 — **Fusionnée dans `main` en mode expérimental**, à la demande de Jérôme : ne pas
  garder de branche qui traîne, et pouvoir jouer les e2e dans une machine Linux de GitHub.
  Branche `feat/145-linux-experimental` (depuis `feat/145-preversion-linux`, commits locaux
  compris), `main` fusionnée dedans : conflit avec la fiche 148 dans `index.ts` (le profil isolé
  passe à `setupSelfInstall` par injection). Ajouts : `release.yml` ne construit Linux sur un tag
  que si `BOBINE_LINUX_RELEASE` vaut `true` ; `e2e.yml` choisit le système (macOS, Linux, les
  deux), le job Linux joue la suite sous `xvfb` sur Ubuntu 24.04 x64, en français, captures en
  artefact (réglage `kernel.apparmor_restrict_unprivileged_userns=0` de la machine de CI pour le
  bac à sable de Chromium, jamais `--no-sandbox`). Les deux tests de `main` qui bloquaient le job
  x64 sont réglés (PR #3), et `conformance-bob` › « annulation » aussi : nouveau scénario
  `attend-stop` au lieu de `lent`, que l'annulation pouvait manquer.
- 2026-10-25 — **Premier passage des e2e sous Linux** (GitHub, Ubuntu 24.04 x64, `xvfb`, run
  40180168152) : **90 tâches vertes sur 125** en 16 min, `simulator` sautée (capacité absente).
  L'app démarre, le terminal (node-pty), git, le navigateur et l'agent factice marchent. Les
  66 échecs, par cause :
  - **Vérifications propres au Mac, à conditionner** (lot 5, attendu) : compteur du Dock
    (`inbox`, `notifications`), capture d'écran (`quick`, `composer`, `annotate`), outils et
    groupe iOS (`mcp`, `diagnostic`, menu « + » de `panel`), police Menlo, menu « Bobine ›
    À propos » et « macOS » dans les infos techniques (`about`), AXe facultatif.
  - **Pas de gestionnaire de fenêtres sous `xvfb` nu** : fenêtre jamais agrandie (`startup`),
    focus et notifications de fenêtre sans focus (`notifications`), sans doute plusieurs délais
    dépassés (`questions`, `plan`, `user-commands`, `filles-fusion`, `subagents`) : essayer avec
    un gestionnaire léger (`openbox`, `fluxbox`) dans le job.
  - **Lancement** : `android` et `diagnostic` (fenêtre absente au bout d'une minute), `about`
    bloquée 5 min, `ENOTEMPTY` au nettoyage d'un dossier de données.
  - À regarder une par une : `browser-view` (zoom), `usage-board` (infobulle), `fun`.

- 2026-10-27 — Jérôme retient la **0.6.0 macOS uniquement**, sans attendre Linux (fiche 152).
  La première préversion Linux est reportée, sans nouveau numéro décidé. Le commutateur GitHub
  `BOBINE_LINUX_RELEASE` reste désactivé. Le principe de l’ADR-0032 reste valable : lorsque Linux
  sera prêt, ses paquets accompagneront une version ultérieure du Mac sous le même numéro/tag.
- 2026-10-27 — Contrôle des capacités (fiche 152) : `platform` adopte le shell/PATH neutre
  déjà employé par `diagnostic`, exposé dans `NEUTRAL_AGENT_ENV` du pilote commun. Le diagnostic
  des capacités ne lance plus les vrais agents installés. Les contrôles darwin/Linux simulés
  passent, sans changement des capacités ni de l’interface du produit.
