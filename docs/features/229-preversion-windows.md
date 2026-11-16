# 229 — Préversion Windows

- **Statut** : en cours (2026-11-15 : lots 0, 1, 3, 3b, 4 et 5 faits, lot 2 en grande partie — voir « Avancement » ;
  lot 6, packaging, fait : installeurs NSIS x64 et arm64, installés et lancés dans la VM ; CI Windows
  expérimentale ; lot 8 en partie : textes de Linux et Windows, `e2e:packaged` de l'app installée)
- **Dépend de** : 145 (préversion Linux : capacités de la plateforme, menu ☰, e2e par capacités),
  012 et 059 (packaging, publication), 034 (terminal), 138 et 195 (processus), 211 (écritures des
  commandes), 224 (discussion, zone d'écriture)
- **Agents** : les deux, sans code propre à un agent. OpenCode publie des binaires Windows ; la
  documentation d'IBM cite Windows parmi les systèmes de Bob Shell (voir « Agents sous Windows »).

## Pourquoi

ADR-0032 a rendu Bobine multiplateforme (macOS, puis Linux en préversion) et renvoyé Windows à
plus tard, avec un ADR à part. Une bonne part des développeurs visés travaille sous Windows, où
OpenCode et Bob s'installent. Le travail Linux a posé les capacités de la plateforme, le menu ☰ et
les e2e par capacités, mais Windows n'est pas « un Unix de plus » : pas de groupes de processus,
pas de shell de connexion, des scripts `.cmd` qu'on ne lance pas comme un exécutable, des chemins
à lettre de lecteur et insensibles à la casse, des jonctions NTFS. Le relevé ci-dessous dit où.

## Périmètre

**Dans la préversion** : comme Linux (fiche 145) — conversations, agents (Bob, OpenCode, agents
personnalisés), permissions, discussion et sa zone d'écriture, diffs, git et worktrees, terminal
intégré (ConPTY), navigateur intégré, notifications, réglages, journal.

**Hors préversion** : simulateur iOS, installation par l'app (`selfInstall`), langue des
dialogues par app, capture d'écran jointe (comme Linux), aperçu Word/RTF (`textutil`, déjà
absent sous Linux), compteur sur l’icône (overlay de la barre des tâches plus tard, section 6), WSL (D6), mise à jour automatique.

## Critères d'acceptation

- [x] Décisions D1 à D9 tranchées par Jérôme (2026-11-15).
- [x] ADR « Bobine sous Windows en préversion » écrit
      (ADR-0032 l'annonçait) : [ADR-0050](../adr/0050-bobine-sous-windows-en-preversion.md),
      accepté (`koffi` accepté par Jérôme le 2026-11-15).
- [x] Un installeur (D1) x64 et arm64 (D2) s'installe sans droits d'administrateur sur Windows 11
      et démarre ; désinstallation propre (données gardées, comme sur le Mac). Lot 6, VM ARM64
      (l'installeur x64 sous émulation) ; reste à voir sur un vrai PC x64.
- [ ] Même sécurité que sur macOS : `contextIsolation`, `sandbox`, CSP, `electronFuses`, agent
      factice absent de l'app packagée.
- [ ] Aucune fenêtre de console ne s'ouvre quand l'app lance un agent, une sonde, git ou un
      serveur de développement.
- [ ] Bob et OpenCode installés par npm (scripts `.cmd`) ou par leur binaire `.exe` sont trouvés et
      lancés ; arguments avec espaces, guillemets, `&`, `%` passés intacts (essais unitaires).
- [ ] Un agent arrêté, ou l'app qui plante puis redémarre, ne laisse aucun processus (arbre
      complet, `npx` → adaptateur → agent).
- [x] **Zone d'écriture d'une discussion** : chaque contournement de la section « Sécurité » est
      refusé ou posé à l'utilisateur, jamais accordé seul (essais unitaires en `path.win32`, qui
      tournent aussi sur le Mac, et essais réels NTFS dans la VM). Lot 3, 2026-11-15.
- [x] Risques des permissions (hors du dossier, dossiers du système, fichiers de démarrage, droits
      d'administrateur) signalés pour des chemins Windows ; ce qu'on ne sait pas lire est dit
      « inconnu », jamais « sans risque ». Lot 3, 2026-11-15 (« écritures inconnues »).
- [x] Rien de propre au Mac visible : ni ⌘, ni Finder, ni Dock, ni Trousseau ; Explorateur,
      Ctrl, barre des tâches. Lot 8, 2026-11-15 (textes de Réglages › Apparence : fiche des polices).
- [ ] Terminal intégré : PowerShell (D5) dans ConPTY, couleurs, Ctrl+C, redimensionnement.
- [ ] git : Git for Windows trouvé (sinon message clair), diffs justes avec `core.autocrlf=true`,
      worktrees à chemins longs.
- [ ] e2e sur `windows-latest` (job manuel), suites par capacités ; captures regardées.
- [ ] Essai réel dans la VM Windows 11 ARM64 : installation, OpenCode avec un modèle gratuit,
      discussion, terminal, notification ; Bob installé par le script d'IBM, `pnpm bob-probe`
      (0 bobcoin) ; essai de Jérôme.
- [ ] `./scripts/verify` passe ; aucune régression macOS ni Linux (e2e `--changed` sur le Mac,
      `pnpm e2e:linux` des suites touchées) ; docs, `CHANGELOG.md`, `CHANGELOG.en.md` à jour.

## Inventaire : ce qui dépend de macOS ou d'Unix

Relevé du 2026-11-15 sur `main` (`bcca473`) : `grep` de `process.platform`, `/bin/`, `/usr/`,
`kill(`, `detached`, `spawn`, `execFile`, `split('/')`, `startsWith('/')`, `SHELL`, `ps`. Les
fonctions déjà masquées par une capacité (simulateur, installation par l'app, capture, compteur
du Dock) ne sont citées que si elles cassent quand même.

### 1. Lancer un programme : `.cmd`, consoles, PATH

| Fichier | Aujourd'hui | Sous Windows |
|---|---|---|
| `agent/agent-process.ts` (`spawnAgent`) | `spawn(profile.command, args, { detached: true })` | `bob` et `opencode` installés par npm sont des **scripts `.cmd`** (`%APPDATA%\npm\bob.cmd`) : `spawn` sans shell échoue en `EINVAL` (Node ≥ 18.20.2/20.12.2, CVE-2024-27980) ou en `ENOENT` (pas de `PATHEXT`). `detached: true` **ouvre une console** par agent (doc de Node) sans `windowsHide`. |
| `agent/profiles.ts` (`findExecutable`) | PATH coupé sur `:`, `accessSync(X_OK)`, chemin si `/` | `C:\…` coupé en deux par `:` ; ni `PATHEXT` (`.exe`, `.cmd`) ni `\` ; `X_OK` ne veut rien dire : « agent introuvable » partout. |
| `shell-env.ts` | `$SHELL -ilc printf …`, défaut `/bin/zsh` ; `mergePath` sur `:` | Ni `SHELL` ni shell de connexion : lancé depuis le menu Démarrer, l'app a déjà le PATH de l'utilisateur (registre). À sauter ; mais un agent installé **après** le lancement n'est vu qu'en relisant `HKCU\Environment` et `HKLM\…\Session Manager\Environment`. Séparateur `;` (`path.delimiter`). |
| partout où l'on copie `process.env` (`{ ...process.env, … }`) | clé `PATH` | Sous Windows la variable s'appelle `Path` ; `process.env` ignore la casse, **pas sa copie** : écrire `env['PATH']` crée une deuxième clé, et l'enfant reçoit l'une ou l'autre. À normaliser à un seul endroit. |
| `preview/dev-servers.ts` | `/bin/sh -c <commande>` | `cmd.exe /d /s /c` (ou `shell: true`), `windowsHide`. |
| `fresh-start.ts`, `reset.ts` | relance et nettoyage par un script `/bin/sh` (`security`, `defaults`, `/usr/bin/open`) | Rien de cela n'existe : relais à réécrire (Electron en mode node, ou PowerShell), sans trousseau à vider (DPAPI, voir 6). |
| `thread-ipc-electron.ts`, `mcp-probe.ts`, `jobs/command-job.ts`, `android/*.ts`, `changes/worktree-setup.ts` | `spawn(…, { detached: true })` | Consoles ouvertes ; `worktree-setup.ts` évite déjà `detached` sous `win32` (seul endroit). |
| `editors/editors.ts` | `/usr/bin/open -na <App>.app`, `/Applications` | `code.cmd`, `cursor.cmd`… dans le PATH ou `App Paths` du registre. |
| `terminal/terminal-app.ts` | `open -a Terminal` | `wt.exe -d <dossier>` (présent sur Windows 11, vu dans la VM), sinon `powershell.exe` dans une console. |
| `notifications/chime.ts`, `system-alerts.ts` | `afplay` | Pas de lecteur en ligne de commande ; sons de `C:\Windows\Media\*.wav` à jouer par l'app (élément audio d'une fenêtre, fichier lu par le main). |
| `fonts.ts` | `osascript` (AppKit), `fc-list` (Linux) | Polices du registre (`HKLM` et `HKCU\…\Windows NT\CurrentVersion\Fonts`) ; chasse fixe à lire dans le fichier (table `post`/`OS/2`) ou liste connue. Nouvelle source pour `fontSource`. |
| `documents/ipc.ts` | `/usr/bin/textutil` | Déjà sauté hors macOS : pas d'aperçu Word/RTF, comme Linux. |
| `self-install*.ts`, `diagnostics.ts` (`xattr`, `xcrun`), `simulator/*` | macOS | Masqués par capacité ; à confirmer par la suite `platform`. |

### 2. Arrêter des processus : groupes, `kill(-pid)`, registre

| Fichier | Aujourd'hui | Sous Windows |
|---|---|---|
| `process-group.ts` | `process.kill(-pid, SIGTERM)` puis `SIGKILL` à 3 s ; repli sur le pid seul | **Pas de groupes** : `kill(-pid)` lève, le repli tue le **seul** chef (`TerminateProcess`, brutal, sans délai de grâce). `npx` → adaptateur → agent : les petits-enfants survivent. |
| `agent/process-utils.ts` (`killTree`) | groupe | même chose |
| `process-registry.ts` | `ps -A -ww -o pid=,ppid=,pgid=,lstart=,command=` au démarrage et en quittant | `ps` n'existe pas. Équivalent : `Win32_Process` (CIM : `ProcessId`, `ParentProcessId`, `CreationDate`, `CommandLine`), lent par PowerShell (≈ 1 s) ; pas de `pgid`, reconnaître l'arbre par les parents (et un parent mort ne rattache pas ses enfants à 1). |
| `terminal/foreground.ts` | `ps -o tpgid=` puis `kill(-group)` | Sort déjà sous `win32` (`undefined`) : « Arrêter » s'en tient à Ctrl+C. |
| `user-data-migration.ts` | `process.kill(pid, 0)` | Marche sous Windows. |
| `index.ts:1009` | `window-all-closed` : quitte hors `darwin` | Bon comportement sous Windows. |

Pistes, à trancher au lot 2 : **objets de tâche** (Job Object, `KILL_ON_JOB_CLOSE`) qui emportent
tout l'arbre même si le main plante — le plus sûr, mais il faut du code natif (petit module, ou
binaire relais) ; sinon `taskkill /T /F /PID` (arbre par les parents, brutal, rate un enfant dont
le parent est déjà mort). Arrêt « poli » d'un agent ACP : fermer son entrée standard d'abord
(`SIGTERM` n'existe pas). Sous Linux aussi, les enfants héritent de descripteurs (fiche 145, fd de
Chromium) ; sous Windows, `spawn` ne transmet que les poignées marquées héritables : à vérifier.

### 3. Terminal intégré (node-pty, ConPTY)

- `terminal/node-pty.ts` : node-pty 1.1.0 livre `prebuilds/win32-x64` et `win32-arm64` (constat
  dans `node_modules`) : **pas de compilation**, contrairement à Linux. `ensureSpawnHelper` ne
  concerne que les Unix. `electron-builder.yml` exclut aujourd'hui `prebuilds/win32-*` (pour
  macOS) : à garder pour la cible `win`.
- `terminal/terminal-manager.ts` : `process.env.SHELL ?? '/bin/zsh'` et argument `-l` ; sous
  Windows, shell de D5 sans `-l` (`powershell.exe -NoLogo`), `COLORTERM` et `TERM` sans effet
  sur ConPTY mais inoffensifs. `SHELLS` (noms de shells reconnus) : ajouter `pwsh`,
  `powershell`, `cmd`.
- ConPTY : Ctrl+C, redimensionnement et couleurs à vérifier ; `term.process` donne le nom du
  programme (pas de premier plan par groupe).

### 4. Chemins

Une soixantaine de fichiers manipulent des chemins en texte avec `/` (`split('/')`,
`lastIndexOf('/')`, `startsWith('/')`, `join('/')`), dont `shared/path-display.ts` (`~`, nom du
dossier), `shared/file-links.ts` (chemins cliquables dans les réponses), `shared/command-view.ts`
(`normalizePath`, POSIX), `shared/attachments.ts`, `shared/changes.ts`, `workspace-files.ts`,
`agent/permission-risk.ts`, `agent/command-writes.ts`, et une quinzaine de composants du renderer
(Composer, FileMenu, ChangesTab, SessionFolders…). Le renderer n'a pas `node:path` : il faut un
petit module partagé « chemin de la plateforme » (séparateur, racine, comparaison) choisi par
capacité, plutôt que des `replace(/\\/g, '/')` éparpillés.

| Sujet | Ce qui casse |
|---|---|
| Séparateurs | `C:\Users\…` affiché en entier, liens de fichiers non reconnus, nom du dossier faux ; un agent peut aussi écrire `C:/Users/…` (les deux sont valides). |
| `~` | `homedir()` = `C:\Users\<nom>` ; `path-display` remplace un préfixe `/` ; `~` n'a pas de sens dans `cmd`. |
| Lettres de lecteur | `C:\` et `c:\` sont le même chemin ; `relative('C:\a', 'D:\b')` rend un chemin absolu (bien géré par `isInside`). `C:foo` (relatif au lecteur) n'est pas absolu ; `\foo` l'est pour `path.win32` (racine du lecteur courant). |
| UNC et préfixes | `\\serveur\partage\…`, `\\?\C:\…` (chemins longs), `\\.\…` (périphériques), `\\wsl$\…` : à refuser ou à poser à l'utilisateur, jamais à comparer comme un chemin ordinaire. |
| Casse | NTFS ignore la casse (sauf dossiers marqués sensibles à la casse, WSL) : clés de l'historique, des autorisations retenues (`approvals.json`), des dossiers de conversation, des worktrees : comparer sans casse, garder l'orthographe affichée. |
| Noms courts 8.3 | `C:\Users\JEROME~1\…` désigne le même dossier (création 8.3 **activée** sur `C:` dans la VM). |
| Noms interdits | `CON`, `NUL`, `AUX`, `COM1`…, caractères `<>:"|?*`, points et espaces finaux retirés en silence (`a.txt.` = `a.txt`). |
| Longueur | `MAX_PATH` 260 sauf `LongPathsEnabled` (à **0** dans la VM) et manifeste de l'app ; Electron le déclare, git non (`core.longpaths`), node_modules dans un worktree le dépasse vite. |
| Données de l'app | `userData` = `%APPDATA%\Bobine` (Roaming : suit un profil itinérant en entreprise). Discussions sous `<données>\discussions\<id>`. |

### 5. Sécurité de la zone d'écriture et des permissions (le point sensible)

**Ce qui existe.** Dans une discussion (fiche 224), `agent/write-area.ts` décide seul d'une demande
d'écrire (`edit`, `delete`, `move`, via `permission-answers.ts`) : refus si une cible sort du
dossier (par son chemin, `isInside` sur `path.relative`, ou par un lien : `realpathSync` de
l'ancêtre existant) ; accord une fois si chaque cible est un document visible du premier niveau,
pas un lien (`lstat().isFile()`) ; tout le reste est posé. `agent/permission-risk.ts` et
`agent/command-writes.ts` signalent ce qu'une permission risque (hors du dossier, dossiers du
système, fichiers cachés du dossier personnel, `sudo`).

**Ce qui tient sous Windows**, d'après le code (à prouver par des essais `path.win32`) :
`path.relative` de `win32` compare sans casse et rend un chemin absolu entre deux lecteurs
(rattrapé par `isAbsolute(rel)`) ; `\\?\C:\…` et `\\.\…` ont une autre racine, donc « hors du
dossier » ; un flux de données alternatif sur le dossier lui-même (`C:\…\<id>:flux`) donne
`..\<id>:flux`, hors du dossier.

**Ce qui est à traiter :**

1. **Jonctions NTFS** (`mklink /J`) : se créent **sans aucun droit** (contrairement aux liens
   symboliques, qui demandent le mode développeur ou un compte administrateur — le privilège
   `SeCreateSymbolicLinkPrivilege` est actif dans la session SSH de la VM, élevée, pas forcément
   dans le bureau). Un agent peut poser `<discussion>\docs` → `C:\Users\<nom>\.ssh` puis écrire
   `docs\x`. Le code s'en remet à `realpathSync` (version JS : `lstat` + `readlink`, que libuv
   applique aux jonctions comme aux liens) et à `lstat().isFile()` (une jonction n'est pas un
   fichier, donc posé) : **probablement bon, jamais vérifié**. Essai réel obligatoire, avec
   jonction, lien symbolique de fichier, de dossier, et `realpathSync.native` en comparaison.
2. **Liens physiques** (`mklink /H`, sans droit, même volume) : le fichier de la discussion **est**
   le fichier d'ailleurs ; `lstat().isFile()` dit vrai, l'écriture est accordée et modifie l'autre
   fichier. Même trou sous macOS et Linux (`ln`) : refuser l'accord automatique si
   `lstat().nlink > 1`. Corrigé à part, sur toutes les plateformes, par la fiche 230 (voir lot 3).
3. **Chemins « absolus » ambigus** : `\Windows\x` ou `/Users/x` sont absolus pour `path.win32`
   (racine du lecteur courant de **l'app**, pas de l'agent) ; `C:x` ne l'est pas. Un agent sous Git
   Bash peut envoyer `/c/Users/…`. Règle : n'accepter seul qu'un chemin à lettre de lecteur
   complet (`X:\`), le reste posé.
4. **Préfixes et noms spéciaux** : `\\?\`, `\\.\`, UNC, `\\wsl$\`, noms réservés (`NUL`, `CON`),
   points ou espaces finaux, flux alternatifs (`doc.docx:Zone.Identifier`, `doc.docx::$DATA`) :
   jamais d'accord automatique ; `isDocument` doit refuser tout `:` après la lettre de lecteur.
5. **Noms 8.3 et casse** : un chemin court (`JEROME~1`) ne correspond pas lexicalement au long :
   refus (sûr), mais refus à tort d'une écriture légitime ; normaliser par `realpathSync.native`
   (`GetFinalPathNameByHandle`), qui rend aussi la vraie casse.
6. **Fichiers « cachés »** : sous Windows, un attribut, pas un point. `.bob\` et `.opencode\`
   restent des points (bien). S'y ajoutent des noms qui agissent : `desktop.ini`, `*.lnk`, `*.url`,
   `*.library-ms`, `autorun.inf` — à poser, jamais accorder seuls.
7. **Points de reprise du nuage** (OneDrive « fichiers à la demande ») : si `%APPDATA%` ou le dossier
   choisi est synchronisé, `lstat` voit d'autres points d'analyse ; à relever dans la VM.
8. **Course entre contrôle et écriture** : comme sous Unix (l'agent écrit lui-même après
   l'accord) ; rien de nouveau, à garder dans l'ADR.

**Risques des permissions** (`permission-risk.ts`, `command-writes.ts`) — **échec ouvert** sous
Windows aujourd'hui : `absolute()` ne connaît que `/` et `~` ; un `C:\…` ne donne aucun chemin, donc
**aucun signalement** (ni « hors du dossier », ni « système »), sans erreur. Il faut : dossiers du
système Windows (`%SystemRoot%`, `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%ProgramData%`),
emplacements qui s'exécutent seuls (`…\Start Menu\Programs\Startup`, profils PowerShell
`Documents\PowerShell\*.ps1` et `WindowsPowerShell\*.ps1`, `%APPDATA%\npm`), et l'équivalent de
« fichiers cachés du dossier personnel » (`.ssh`, `.gitconfig`, `AppData`). `command-writes.ts` lit
du shell POSIX ; un agent sous Windows lance du PowerShell (`Set-Content`, `Out-File`,
`Remove-Item`, `>`) ou du `cmd` (`copy`, `del`). Ne pas tenter de tout lire : sous Windows, une
commande non lue est dite « écritures inconnues » au lieu de « aucune écriture ». Droits
d'administrateur : `sudo` (Windows 11 24H2 l'a), `runas`, `Start-Process -Verb RunAs`, `gsudo`.

### 6. Trousseau, notifications, compteur, raccourcis

- **Clés d'API** (`agent-config/keychain-cipher.ts`, `memory/approval-key.ts`, `memory/setup.ts`) :
  `safeStorage` = **DPAPI**, toujours disponible sous Windows (lié au compte, pas de
  « basic_text ») : plus simple que Linux (D4 de la fiche 145 sans objet). `memory/setup.ts` teste
  `linux` pour `basic_text` : inchangé. `reset.ts` (`security delete-generic-password`) : rien à
  vider sous Windows.
- **Notifications** : toasts Windows ; il faut `app.setAppUserModelId` et un raccourci du menu
  Démarrer portant le même identifiant (créé par l'installeur NSIS). Sans raccourci (zip portable,
  `pnpm dev`), pas de toast.
- **Compteur** : pas de badge chiffré ; `BrowserWindow.setOverlayIcon` (petite image sur le bouton
  de la barre des tâches) en remplace l'idée. Capacité `dockBadge` absente d'abord, overlay plus
  tard si demandé.
- **Attirer l'attention** : `flashFrame` (comme prévu pour Linux).
- **Raccourcis** : Ctrl, déjà converti hors macOS (`displayKeys`, lot 2 de la fiche 145). Fenêtre
  rapide `Ctrl+Alt+B` : sous Windows, **AltGr = Ctrl+Alt** ; sur certains claviers (polonais,
  tchèque…) AltGr+B tape un caractère. Alt seul ouvre ☰ (usage Windows : Alt donne le menu).
- **Mise en veille** : `powerSaveBlocker`, sans changement.

### 7. git, worktrees, fins de ligne

- `git/git-queue.ts` : `GIT_MISSING` reconnaît `spawn git ENOENT` (bon) ; git n'est **pas** livré
  avec Windows (absent de la VM) : message « installez Git for Windows ». `gitEnv` (`LANGUAGE=C`)
  vaut aussi pour Git for Windows, traduit (VM en `fr-FR`).
- **CRLF** : l'installeur de Git for Windows règle `core.autocrlf=true` ; les fichiers du dossier
  sont en CRLF, l'index en LF. Diffs, compteurs de lignes et comparaisons « avant/après » d'un tour
  (`writes-without-asking`) doivent ignorer `\r` en fin de ligne ; le visualiseur ne doit pas
  montrer `^M`.
- **Worktrees** dans `<dépôt>\.worktrees\` (`changes/worktrees.ts`) : chemins longs (`core.longpaths`),
  fichiers verrouillés par un processus (un serveur de dev, un antivirus) qui empêchent `git
  worktree remove` : réessayer, puis le dire.
- Hooks : exécutés par le `sh` de Git for Windows ; `core.filemode=false`.
- `changes/forge-gitlab.ts`, `agent/quota.ts` : dossiers de configuration selon la plateforme
  (paramètre `platform` déjà injecté) : vérifier la branche `win32` (`%APPDATA%`).

### 8. Navigateur intégré, Android, terminal externe

- **Navigateur** (`browser/cdp-tab.ts`, `browser-manager.ts`, `page-view.ts`) : raccourcis déjà en
  Ctrl hors `darwin` ; rien d'autre de propre au système relevé.
- **Android** (`android/sdk.ts`, `adb.ts`, `android-manager.ts`) : SDK sous
  `%LOCALAPPDATA%\Android\Sdk`, `adb.exe`, `emulator.exe`, Java d'Android Studio sous
  `C:\Program Files\Android\Android Studio\jbr` ; l'émulateur demande l'hyperviseur Windows (WHPX)
  ; sur un **hôte ARM64**, la prise en charge de l'émulateur est à vérifier (VM).
- **Terminal externe** : voir 1 (`wt.exe`).

### 9. Fenêtres, polices, textes

- `window-chrome.ts` : feux et `hiddenInset` sur macOS, cadre natif ailleurs : voir D4.
- `--font-ui` sans police Windows : ajouter `"Segoe UI Variable", "Segoe UI"` ; code : `Cascadia
  Mono` n'est **pas** une police du système (absente de `C:\Windows\Fonts` dans la VM, livrée avec
  Windows Terminal) ; `Consolas` l'est.
- Barres de défilement : classiques sous Windows (`overlayScrollbars` absent, comme Linux).
- Textes : Finder → Explorateur de fichiers, Corbeille, « Afficher dans l'Explorateur » ; le reste
  du lot 2 de la fiche 145 (textes Mac) sert aux deux.

### 10. Installeur et mise à jour

`electron-builder.yml` n'a pas de section `win` ; `scripts/package` est en bash et ne connaît que
macOS et `--linux`. Icône `.ico` à produire (`scripts/make-icon.mjs`). Pas de mise à jour
automatique sur le Mac non plus : même chemin (nouvelle version téléchargée depuis GitHub).
`third-party-notices` : node-pty `win32` ajoute `conpty.dll` / `OpenConsole.exe` (licence MIT de
Microsoft) aux composants livrés.

### 11. Outillage, e2e et lanceur

- `scripts/verify`, `scripts/package`, `scripts/e2e-linux`, `predev`/`prepreview`
  (`./scripts/check-electron`, `./scripts/fetch-axe`), `guide-shortcuts` (`VAR=1 cmd`) : **bash**.
  Sous Windows, pnpm lance les scripts par `cmd` : rien de cela ne marche hors de Git Bash. CI :
  `shell: bash` (Git Bash présent sur `windows-latest`) ; poste de développement : `script-shell`
  de pnpm vers bash, ou portage en node au fil de l'eau.
- `e2e/lib.mjs` : faux outils en `#!/bin/sh` (`xcrun`, `adb`, `emulator`, `gh`, `glab`,
  `agentless-shell`), `chmodSync`, `SHELL` d'essai : à écrire en node (`.cmd` qui appelle node, ou
  `.exe` relais), puisque Windows n'exécute pas un script sans extension.
- `e2e/run.mjs` : capacités lues par `currentPlatformFeatures` (réutilisable tel quel), arrêt des
  apps d'essai par groupe : même problème qu'au 2.
- **Agent factice** : lancé par `ctx.execPath` (Electron en mode node) : portable. Mais des scénarios
  lancent de vraies commandes (`sleep`, `touch`, `bash -lc`, `spawn` détaché de
  `scenarios-pannes.mts`) : à remplacer par `process.execPath -e …` là où un essai Windows les joue.
- 103 suites e2e ; un passage complet sous Windows coûte autant que sous Linux (≈ 16 min sur
  GitHub au premier passage Linux).

## Agents sous Windows

- **OpenCode** (documentation publique, opencode.ai/docs, lue le 2026-11-15) : binaires CLI en
  `.zip` pour **x64**, **x64 « baseline »** et **ARM64**, et application de bureau en `.exe` (x64,
  ARM64). La page dit aussi « Windows package managers are not supported » et ne cite ni WSL, ni
  Scoop, ni Chocolatey, ni winget. Le paquet npm (`opencode-ai`) est listé sans mention de Windows.
  Conséquence pour Bobine : trouver `opencode.exe` (zip) **et** `opencode.cmd` (npm). Sonde
  `pnpm opencode-probe --offline` à jouer sous Windows.
- **Bob** (documentation publique d'IBM, bob.ibm.com/docs/shell, page « Install and setup », lue le
  2026-11-15) : Windows figure dans la liste des systèmes pris en charge (« macOS, Linux, Windows,
  z/OS UNIX System Services… ») ; installation par un script PowerShell
  (`powershell -ep Bypass "iwr https://bob.ibm.com/download/bobshell.ps1 …"`) ou par npm
  (`@ibm/bob`, Node.js 24 ou plus) ; clé d'API par `$env:BOB_API_KEY` ou variable d'utilisateur.
  La page **ne dit rien** des versions de Windows, des architectures (x64, ARM64), de WSL, du
  dossier d'installation, ni du shell qu'emploie Bob pour ses commandes. Rien n'est supposé
  au-delà : à relever par `pnpm bob-probe` dans la VM, puis noté dans « Compatibilité Bob » de
  `docs/acp.md`. Installé par npm, `bob` sera un `.cmd` (voir 1).
- **Agent factice** : portable (Electron en mode node) ; scénarios à commandes réelles à adapter
  (voir 11). Aucun scénario nouveau pour Bob : rien de propre à Bob sous Windows n'est documenté.

## Décisions (tranchées par Jérôme le 2026-11-15)

Toutes retenues telles que recommandées (« ok pour toutes »).

| N° | Question | Décision | Pourquoi |
|---|---|---|---|
| D1 | Format d'installeur : NSIS, MSI, Squirrel, zip portable | **Tranchée par Jérôme le 2026-11-15.** **NSIS, installation pour l'utilisateur seul** (`%LOCALAPPDATA%\Programs\Bobine`, sans droits d'administrateur), raccourci du menu Démarrer ; pas de zip portable dans la préversion | Cible par défaut d'electron-builder, la plus essayée ; le raccourci porte l'identifiant d'app sans lequel les notifications ne s'affichent pas. MSI vise le déploiement en entreprise (droits d'administrateur, plus rigide). Squirrel.Windows n'est plus maintenu par electron-builder. Un zip portable n'a ni raccourci (pas de toasts) ni désinstallation : plus tard si on le demande. |
| D2 | Architectures | **Tranchée par Jérôme le 2026-11-15.** **x64 + arm64** | node-pty livre les deux binaires (pas de compilation) ; x64 pour la majorité, arm64 pour la VM du Mac et les PC Snapdragon. GitHub fournit `windows-latest` (x64) et `windows-11-arm` pour les dépôts publics. |
| D3 | Signature de code | **Tranchée par Jérôme le 2026-11-15.** **Constat, pas de recommandation appuyée.** Sans signature : au premier lancement de l'installeur téléchargé, SmartScreen affiche « Windows a protégé votre ordinateur » ; il faut cliquer « Informations complémentaires », puis « Exécuter quand même ». La réputation se gagne au fil des téléchargements, par fichier : chaque version repart de zéro. Sur une installation neuve de Windows 11 où **Smart App Control** est actif, un programme non signé est bloqué sans bouton pour passer outre (il faut désactiver Smart App Control, sans retour possible). Les antivirus d'entreprise peuvent aussi bloquer. | Comme le Mac sans notarisation : un geste de plus pour l'utilisateur, dit dans la page d'installation. Existent si un jour on le veut : Azure Trusted Signing (abonnement mensuel, identité vérifiée), certificat OV ou EV. Somme SHA-256 publiée avec la version dans tous les cas, comme Linux. |
| D4 | Barre de titre et menu | **Tranchée par Jérôme le 2026-11-15.** **Barre intégrée** (`titleBarStyle: 'hidden'` + `titleBarOverlay` aux couleurs du thème, boutons de Windows à droite, dispositions d'ancrage au survol du bouton Agrandir) **et menu ☰ de Linux** (variante D, Alt l'ouvre) ; barre de menu d'Electron jamais montrée. Étape intermédiaire permise : cadre natif + ☰, comme Linux, sans travail. | Les applications Windows récentes (VS Code, Windows Terminal, Teams) intègrent leur barre de titre ; la barre native de Windows 11 ne suit que clair/sombre du système, pas les thèmes de Bobine (Aurore). La barre de menu d'Electron ne se style pas (rejetée pour Linux, D8). Coût : zone de glisser, marge à droite pour les boutons (≈ 140 px, `navigator.windowControlsOverlay`), couleurs à remettre à chaque changement de thème. |
| D5 | Shell du terminal intégré | **Tranchée par Jérôme le 2026-11-15.** **PowerShell** : `pwsh` (7) s'il est installé, sinon `powershell.exe` (5.1, toujours là) ; réglage pour choisir `cmd` ou Git Bash plus tard | `cmd` est l'ancien shell ; PowerShell est celui de Windows Terminal par défaut et celui que la doc de Bob emploie. La VM n'a que PowerShell 5.1. |
| D6 | WSL | **Tranchée par Jérôme le 2026-11-15.** **Hors périmètre** de la préversion : Bobine sous Windows lance des agents Windows ; un dossier `\\wsl$\…` est refusé (ou posé) par la zone d'écriture | Un agent dans WSL parle en chemins Linux (`/home/…`) à une app qui pense en `C:\` : il faudrait traduire tous les chemins ACP. Possible plus tard par un agent personnalisé (`wsl.exe -- opencode acp`, fiche 141), sans promesse. |
| D7 | Publication | **Tranchée par Jérôme le 2026-11-15.** **Même version que le Mac** (même tag), installeurs joints à la Release, « préversion Windows » dans les notes et l'À propos ; job GitHub conditionné par une variable `BOBINE_WINDOWS_RELEASE`, comme Linux | Un seul numéro (ADR-0032). |
| D8 | Versions de Windows | **Tranchée par Jérôme le 2026-11-15.** **Windows 11** (x64, arm64) promis ; Windows 10 22H2 « devrait marcher », sans promesse | Windows 10 n'a plus de mises à jour grand public depuis octobre 2025 ; Electron 45 le prend encore. |
| D9 | Arbre de processus | **Tranchée par Jérôme le 2026-11-15.** **Objet de tâche** (Job Object, arrêt de tout l'arbre quand l'app le ferme ou plante) (module natif ou petit binaire relais), registre par `Win32_Process` ; ADR au lot 0 | Seul l'objet de tâche garantit « aucun orphelin » même si le main plante (critère de la fiche 138). Nouvelle dépendance native ou petit binaire : ADR. |

**D4, mise à jour (décision de Jérôme le 2026-11-15)** : l'étape « cadre natif + ☰ » est retenue comme **définitive** (« ça me va comme ça, juste avec le burger ») : barre de titre de Windows et menu ☰ de Bobine tels qu'ils sont, sans `titleBarOverlay`. La barre intégrée n'est plus prévue.

## Plan

Pas de code dans cette fiche. Lots dans l'ordre ; chaque lot garde le Mac et Linux inchangés
(`./scripts/verify`, e2e `--changed`, `pnpm e2e:linux` des suites touchées).

**Réutilisable du travail Linux** : capacités injectées (`platform.ts`, `BOBINE_PLATFORM`,
`renderer/platform-features.ts`) ; suites e2e par capacités (`needs`, `FEATURES`) et lanceur ;
menu ☰ (`serializeMenu`, `appMenuModel`, `app:menu`, `AppMenuButton`, Alt seul) ; menu Linux sans
menu « Bobine » ; raccourcis Ctrl (`displayKeys`, `keyNotation`) ; barres de défilement classiques
; classe `native-frame` ; `systemName` et `fontSource` (abstractions, une source de plus) ;
`gitEnv` (`LANGUAGE=C`) ; textes Mac du lot 2 (une seule passe pour les deux) ; `flashFrame` ;
capacité `dockBadge` ; `release.yml` conditionné par variable ; pas-à-pas de VM.

| Lot | Contenu | Taille |
|---|---|---|
| 0 | ADR « Bobine sous Windows en préversion » (D1-D9, dont l'objet de tâche de D9 et sa dépendance native), qui complète ADR-0032 | S (½ j) |
| 1 | `platformFeatures('win32')`, `systemName` (« Windows 11 »), `BOBINE_PLATFORM=win32` ; suite `platform` avec les capacités de Windows simulées sur le Mac | S (½-1 j) |
| 2 | **Lancer et arrêter** : un seul module `spawnProgram` (recherche `PATHEXT`, `.cmd` par `cmd.exe /d /s /c` avec échappement sûr, `windowsHide`, pas de `detached` qui ouvre une console), `findExecutable`, `Path`/`PATH` et `;`, environnement relu du registre au lieu du shell de connexion ; arbre de processus (D9), `process-registry` par `Win32_Process` ; serveurs de dev ; terminal (ConPTY, D5) ; relais de `fresh-start`/`reset` | L (4-6 j) |
| 3 | **Chemins et sécurité** : module de chemins partagé (renderer compris) ; `write-area.ts` (points 1 et 3 à 7 de la section 5 ; liens physiques, `nlink > 1`, par la fiche 230, toutes plateformes) ; `permission-risk.ts` et `command-writes.ts` (dossiers Windows, échec fermé « inconnu ») ; clés sans casse (autorisations, conversations) ; essais `path.win32` sur le Mac, puis NTFS dans la VM ; relecture du tech lead | L (4-5 j) |
| 4 | **git** : Git for Windows absent, CRLF dans les diffs et comparaisons, worktrees longs et verrouillés, dossiers des forges | M (2 j) |
| 5 | **Bureau Windows** : D4 (rien de plus : cadre natif + ☰, définitif), polices (registre), sons, `flashFrame`, notifications (AUMID), terminal externe (`wt.exe`), éditeurs, Explorateur dans les textes, Android (chemins, WHPX), raccourci de la fenêtre rapide | M-L (3-4 j) |
| 6 | **Packaging** : section `win` (NSIS par utilisateur, x64/arm64, `.ico`, fuses, `asarUnpack` de node-pty `win32`), `pnpm package --windows` (portage en node de la branche Windows), avis de licence, À propos « préversion Windows ». Workflows (`release.yml`) à la fin, quand l'autre session a fini les siens | M (2-3 j) |
| 7 | **Essais** : faux outils en node, scénarios factices sans commandes Unix, `e2e.yml` Système `windows` (`windows-latest`, puis `windows-11-arm`), suites rouges triées comme pour Linux ; VM : installation, OpenCode, discussion, jonctions, Bob | L (4-6 j, selon les rouges) |
| 8 | **Clore** : `docs/installation.md` (Windows, SmartScreen), `docs/architecture.md`, `docs/agents.md`, « Compatibilité Bob », AGENTS.md (commandes), index, journaux des modifications | S (1 j) |

Total : ≈ 4 semaines de travail d'agent, relecture comprise ; les lots 2 et 3 sont le cœur et
peuvent avancer en parallèle (fichiers distincts), le 7 se fait au fil de l'eau.

Nouvelles dépendances possibles (à dire dans l'ADR) : module natif ou binaire relais pour
l'objet de tâche (D9) ; aucune autre prévue (échappement `cmd.exe` écrit dans l'app plutôt que
`cross-spawn`, à rediscuter au lot 2).

## Avancement

**Lot 0 — ADR.** Fait : [ADR-0050](../adr/0050-bobine-sous-windows-en-preversion.md) (proposé),
qui complète ADR-0032 sans le modifier. D1 à D8 repris ; lancement (`PATHEXT`, `.cmd` par
`cmd.exe`, règles de citation écrites), environnement, et D9 : **un objet de tâche par arbre**,
obtenu par **`koffi`** (FFI, binaires précompilés win32 x64/arm64), repli `taskkill /T`. Options
comparées dans l'ADR (aucun addon N-API maintenu pour les jobs ; relais PowerShell `Add-Type`
écarté : lent, bloqué par AppLocker/WDAC, motif signalé par les antivirus ; binaire relais à
compiler écarté). `koffi` soumis à Jérôme puis **accepté** le 2026-11-15 (« Ok pour koffi »),
à trois conditions : rien ne change dans l'app Mac, avis de licence à jour, seul son script
d'installation autorisé dans pnpm. ADR passé à « accepté ».

**Dépendance ajoutée : `koffi` 3.3.8** (MIT, Niels Martignène), version exacte, dans
`dependencies`. FFI vers `kernel32.dll` pour les objets de tâche (`job-api-koffi.ts`), sans rien
compiler : binaires précompilés en paquets optionnels par plateforme (`@koromix/koffi-<os>-<arch>`,
tous au lockfile ; pnpm n'installe que celui de la machine). `allowBuilds: koffi: true` (son script
`cnoke` choisit le binaire), rien d'autre d'ajouté. Chargée **sous Windows seulement** :
`process-safety.ts` fait `import('./process-safety-windows')` dans la seule branche Windows, et ce
module (avec `job-api-koffi.ts`, `process-tree-windows.ts`, `process-registry-windows.ts`) est
un fichier à part du build (`out/main/process-safety-windows-*.js`) jamais chargé sur macOS ni
sous Linux. Exclue des apps Mac et Linux par `files` (racine) d'`electron-builder.yml` et
`EXCLUDED_FROM_APP` des avis de licence ; l'app Windows (lot 6) devra l'y remettre, avec
`asarUnpack` de son `.node` et ses avis (koffi + `@koromix/koffi-win32-*`).

**Lot 1 — capacités.** Fait.
- `platformFeatures('win32')` = celles de Linux : rien de ce que seul macOS a ; cadre natif et
  menu ☰ (D4, définitif), raccourcis en Ctrl, barres fines. Essai unitaire dédié.
- `systemName('win32')` = « Windows » (infos techniques, À propos).
- `BOBINE_PLATFORM=win32` simule les capacités de Windows sur le Mac ; il ne change **pas** le
  lancement des processus, qui suit le vrai système (ADR-0050).
- Suite e2e `platform` : sur le Mac, Mac, Linux **et Windows** (menu dans la fenêtre sans barre,
  cadre natif, ☰, Ctrl, pas de capture, pas de simulateur, pas de groupe iOS).

**Lot 2 — processus.** Fait, sauf ce qui est listé « reste ».
- ✅ `process-launch.ts` (nouveau, seul endroit qui sait lancer) : `processSystem(platform)`,
  `findProgram` (PATH coupé sur `;` sous Windows, guillemets d'un dossier retirés, `PATHEXT` dans
  son ordre, `.ps1` en dernier recours, **jamais le dossier courant** : un `bob.cmd` posé dans le
  dossier d'une conversation ne remplace pas celui de l'utilisateur), `planLaunch` (`.exe` direct ;
  `.cmd`/`.bat` par `cmd.exe /d /s /v:off /c "<ligne>"` + `windowsVerbatimArguments` ; `.ps1` par
  `powershell.exe -NoLogo -NoProfile -NonInteractive -File`, sans `-ExecutionPolicy Bypass`),
  `cmdLine` (citation CRT puis double `^` des caractères spéciaux, retours à la ligne et nul
  refusés), `planShellCommand` (`/bin/sh -c` ou `cmd.exe /d /s /c` pour une ligne de
  l'utilisateur), `launchOptions` (Unix : `detached` comme avant ; Windows : jamais `detached`,
  `windowsHide`, environnement à une clé par nom), `normalizeEnv`, `pathKey` (`Path`).
  `findExecutable` (profils, `gh`, `glab`, onboarding…) passe par `findProgram`.
- ✅ `process-tree.ts` (point d'entrée unique) : `startProcess` (lancement + job + registre),
  `stopTree`, `treesStopping`, `settleStoppedTrees`, `stopRemainingTrees`. Sans configuration
  (Unix, essais, sondes) : **exactement** `process-group.ts` et `stopTrackedChildren` d'avant.
  Passent par lui : agents (`spawnAgent`, `killTree`), sondes MCP, travaux (`command-job`),
  serveurs de développement, préparation des worktrees (plus de `process.platform` dans
  `worktree-setup.ts`), enregistrement Android, sortie de l'app (`app-failures`, `index.ts`).
- ✅ `process-tree-windows.ts` : `WindowsTrees` (un job par arbre posé juste après `spawn` ;
  arrêt : entrée standard fermée, puis job arrêté au bout de 3 s, tout de suite sans entrée
  standard ; chef sorti pendant l'arrêt : le reste du job tout de suite ; sorti de lui-même : job
  rendu s'il est vide, gardé sinon ; en quittant : `settle` puis `stopAll`). Interface `JobApi`
  (créer, placer, compter, arrêter, fermer) simulée dans les essais ; **sans `koffi`, repli
  `taskkill /T /F` sur le chef vivant**, jamais sur un pid sorti.
- ✅ Registre sous Windows (`process-registry-windows.ts`) : `Win32_Process` par `Get-CimInstance`
  (≈ 1 s dans la VM, en tâche de fond au démarrage), même commande sans casse ni extension, même
  heure (±3 s), sinon pid réattribué laissé ; chef disparu : ses enfants créés après lui sont les
  racines (`taskkill /T`).
- ✅ `process-safety.ts` pose le système (lancement, arbres, registre) une fois, depuis `index.ts`
  (`processSystem(process.platform)`) ; le journal dit « objets de tâche » ou « repli taskkill ».
- ✅ Environnement : sous Windows, variables enregistrées (machine puis utilisateur, comme
  Windows les assemble ; `REG_EXPAND_SZ` développées par .NET, vérifié dans la VM) lues par
  PowerShell (≈ 1 s) au lieu du shell de connexion, aussi pour « Relire le PATH » ;
  `mergePath` sur `;` sans casse ni `\` final en double ; `applyShellEnv` écrit sous `Path`.
  Unix : mêmes lignes de journal qu'avant.
- ✅ Terminal (D5) : `terminal-shell.ts` : `pwsh.exe` s'il est dans le PATH, sinon
  `powershell.exe` de `SystemRoot`, `-NoLogo` ; `pwsh`, `powershell`, `cmd` comptent comme
  l'invite (sans `.exe` ni casse). Unix : rien d'imposé, `$SHELL -l` comme avant.
- ✅ `runCommand` (git, adb, outils) : `windowsHide`.
- ✅ `job-api-koffi.ts` : `JobApi` réel (`CreateJobObjectW`, `SetInformationJobObject` avec
  `KILL_ON_JOB_CLOSE` seul, `OpenProcess` + `AssignProcessToJobObject`,
  `QueryInformationJobObject` pour compter, `TerminateJobObject`, `CloseHandle`) ; koffi qui ne se
  charge pas : repli `taskkill`, dit au journal.
- Reste : relais `fresh-start` / `reset` (scripts
  `/bin/sh`) ; `editors.ts`, `terminal-app.ts`, `chime.ts`, `fonts.ts`, `documents/ipc.ts`
  (`spawn` directs propres au bureau : lot 5) ; émulateur Android détaché (lot 5) ;
  `simulator/*` (macOS seulement) ; ConPTY réel (Ctrl+C, couleurs, redimensionnement) à essayer
  avec l'app dans la VM (lot 7).

**Essais du lot 2.**
- Unitaires (tournent sur le Mac et dans `ci.yml`) : `process-launch.test.ts` (recherche
  `PATHEXT` simulée, insensible à la casse ; citation relue par une implémentation de référence de
  `CommandLineToArgvW` et de la lecture de `cmd.exe` : **aucun caractère spécial actif** après
  chacune des deux lectures, 23 arguments piégés retrouvés), `process-tree-windows.test.ts`
  (jobs simulés : arrêt poli, délai, chef sorti, quitter, repli taskkill, job refusé),
  `process-registry-windows.test.ts`, `process-tree.test.ts` (sans configuration : les fonctions
  Unix d'avant), `shell-env.test.ts`, `terminal-shell.test.ts`, `terminal-manager.test.ts`.
  Les essais Unix existants (`process-group`, `process-registry`, `shell-env`, terminaux réels)
  sont inchangés et passent.
- VM Windows 11 ARM64 (SSH), primitives seules, avec le code du dépôt empaqueté par esbuild :
  - **citation** : un script npm (`cmd-shim`) lancé par `launchProgram` avec 27 arguments piégés
    (espaces, `"`, `\` finaux, `&`, `|`, `<>`, `%PATH%`, `%~dp0`, `%1`, `%*`, `!USERNAME!`, `^`,
    `^^`, `(x)`, `;,=`, `*?[]`, accents, CJK, vide…) : **tous reçus à l'identique** ; idem quand le
    dossier du script contient `%PATH%`. Un dossier contenant `&` ou `)` casse **le script npm
    lui-même** (`SET dp0=%~dp0` non cité) : hors de notre portée, noté ;
  - **job de libuv seul** (enfant non `detached`) : au plantage simulé du parent
    (`Stop-Process -Force`), l'enfant direct meurt, mais le `node` lancé par un `.cmd` **survit** ;
    avec `detached`, tout survit ;
  - **job à nous** (`KILL_ON_JOB_CLOSE`, sans sortie, posé par P/Invoke depuis PowerShell, pour
    l'essai seulement) : propriétaire tué → `cmd.exe` et le `node` lancé par le `.cmd` meurent,
    aussi quand l'enfant était déjà dans le job de libuv (imbrication), et un petit-enfant dont le
    parent est déjà sorti est arrêté par `TerminateJobObject` ; un descendant lancé **avant** la
    pose du job y échappe (d'où la pose synchrone juste après `spawn`) ;
  - **repli taskkill** : `WindowsTrees` arrête `cmd.exe → slow-agent.cmd → node` en entier ;
  - variables du registre (`WINDOWS_ENV_SCRIPT`) et `Win32_Process` : lus et analysés (≈ 1 s
    chacun).
  - **koffi dans la VM** (paquets `koffi-3.3.8.tgz` et `@koromix/koffi-win32-arm64-3.3.8.tgz`
    obtenus par `npm pack`, intégrité SHA-512 identique au lockfile, vérifiée aussi par
    `Get-FileHash` dans la VM ; décompressés dans le dossier d'essai, rien d'installé ailleurs) :
    `WindowsTrees` en mode `jobs` avec le vrai `JobApi` — arrêt de `cmd.exe → .cmd → node` en
    entier, sans `taskkill` ; **plantage simulé du main** (`Stop-Process -Force` du `node` qui
    tient les jobs) : `cmd.exe` et le `node` de l'agent meurent ; enfant sorti en laissant un
    petit-enfant : job gardé (compté actif), puis arrêté par `stop`.
- Installé dans la VM : **Node 24.22.3** (zip officiel `node-v24.22.3-win-arm64.zip` de
  nodejs.org, SHA-256 `b3cc74a2…434f14` vérifié contre `SHASUMS256.txt` sur le Mac puis par
  `Get-FileHash` dans la VM), décompressé dans `C:\Users\jerome\bobine-229`, PATH du système
  non modifié. git non installé (pas nécessaire à ces essais).

**Ce qui change sur macOS et Linux** (consigne de Jérôme : « ne casse pas la version macOS ») :
rien dans le comportement. Les appels à `spawn` reçoivent exactement les mêmes arguments et
options qu'avant (`process-start-posix.test.ts` les fige : commande telle quelle, `detached`,
aucune option de Windows ; `/bin/sh -c` pour les lignes de shell ; mêmes commandes notées au
registre), les arrêts passent par les mêmes fonctions de `process-group.ts` et `process-registry.ts`
(inchangés, `process-tree.test.ts`), le shell de connexion et ses lignes de journal sont les
mêmes, le terminal garde `$SHELL -l` et sa reconnaissance de l'invite, les capacités de `darwin`
et `linux` sont identiques (suite `platform`). Différences de code sans effet : un appel de plus
(`configureProcessLaunch('posix')`, valeur déjà par défaut) ; `findExecutable` réécrit sur
`findProgram` (même algorithme : PATH sur `:`, `X_OK`, fichier ordinaire) ; la préparation des
worktrees passe `/bin/sh -c` explicitement au lieu de `shell: true` (ce que Node fait lui-même) ;
`out/main/index.js` contient les fonctions pures de Windows (`process-launch.ts`, lecture du
registre de `shell-env.ts`), jamais appelées hors Windows. Paquet Mac reconstruit : `app.asar` =
`out/`, `package.json`, `node_modules/{@xterm, jsonc-parser, node-pty, yaml}`, aucun fichier
`koffi` ni `@koromix` dans le `.app`.

**Vérifications** (2026-11-15) : `./scripts/verify` vert ; `pnpm third-party-notices --check`
vert (inventaire inchangé : koffi exclu des apps Mac et Linux) ; `pnpm install --frozen-lockfile`
vert sur le Mac et sous Linux x64 (Docker `node:24-bookworm`, vrai lockfile, `koffi` se charge) ;
e2e : campagne complète `--changed` 203/204 (seul `about dark`, presse-papiers écrit au même
moment par la suite `command` lancée en parallèle, vert rejoué seul), puis `session`, `terminal`,
`commands`, `command-output`, `filles`, `pannes-visibles`, `restart`, `platform`, `about` en clair
et sombre : 16/16 sur le build final ; `platform --verbose` : Mac inchangé, Linux et Windows
simulés sur le Mac. Captures du terminal regardées.
### Lot 6 — packaging (fait le 2026-11-15)

- **electron-builder** (`electron-builder.yml`, section `win` et `nsis`) : NSIS `oneClick`,
  `perMachine: false` (D1 : `%LOCALAPPDATA%\Programs\bobine`, jamais d'élévation), raccourcis du
  menu Démarrer et du bureau, données gardées à la désinstallation ; `Bobine-<version>-<arch>.exe`
  comme le Mac et Linux ; ni `latest.yml` ni `.blockmap` (pas de mise à jour automatique) ; fuses
  et intégrité de l'asar comme sur le Mac (écrites dans `Bobine.exe`). **makensis 3.12**
  (`toolsets.nsis: 1.2.1`, paquet unifié d'electron-builder, encore dit « beta ») au lieu du 3.0.4
  par défaut, dont le makensis pour macOS n'existe qu'en x86_64 (Rosetta absent) : même outil sur
  le Mac et sur les runners Windows.
- **Identifiant d'app** : l'installeur pose le raccourci avec `appId` (`dev.bobine.app`) ; sans
  `app.setAppUserModelId`, Electron prend `electron.app.Bobine` et Windows n'affiche aucune
  notification. **Une ligne dans `src/main/index.ts`** (strictement nécessaire à l'empaquetage) :
  `applyAppUserModelId` (`src/main/app-user-model-id.ts`), sous Windows seulement, d'après le vrai
  système (comme le lancement des processus, ADR-0050), jamais `BOBINE_PLATFORM` ; un test vérifie
  l'égalité avec `appId`. Sur le Mac : une fonction qui ne fait rien.
- **`pnpm package --win`** (`--x64`, `--arm64`, `--dir`) : `scripts/package` passe la main à
  `scripts/package-win.mts` (en node : sous Windows, pnpm lance les scripts par `cmd` ; la CI
  l'appelle directement). Electron : l'archive Windows officielle de la version installée,
  téléchargée par `@electron/get` et vérifiée par `electron/checksums.json`, jamais l'Electron du
  système (`electronDist` est celui du Mac). Une construction `dir` par architecture, puis
  l'installeur à partir de ce dossier (`--prepackaged`) une fois contrôlé : architecture de
  `Bobine.exe` (en-tête PE), binaires de node-pty et de koffi de cette architecture seulement,
  licences, restes de l'archive d'Electron retirés (`default_app.asar`), **contenu de l'asar**
  limité à `out/`, `node_modules/` et `package.json`, koffi présent. Essais : `scripts/package-win.test.ts`.
- **Icône** : `build/icon.ico` (16 à 256 px, PNG dans l'ICO), `pnpm exec electron
  scripts/make-icon.mjs --win`, réduite depuis `build/icon.png` (`scripts/windows-icon.mjs`, essai
  `scripts/windows-icon.test.ts`) ; aucune dépendance.
- **Fichiers** : aucune liste `files` dans la section `win` (une liste de seules exclusions par
  plateforme y fait entrer tout le dépôt). `scripts/package-win.mts` reprend la liste `files` de
  la racine (`windowsFiles`) dans une configuration temporaire : elle retire les trois exclusions
  faites pour le Mac et Linux (binaires Windows de node-pty, `koffi`, `@koromix`) — electron-builder
  ne garde que les exclusions pour `node_modules`, une ligne de la section `win` ne pourrait pas
  les remettre — et ajoute celles de Windows : node-pty et koffi de l'architecture construite
  seulement (macro `${arch}`), sans les `.pdb` (≈ 25 Mo) ni **winpty** (repli des Windows d'avant
  ConPTY, build 18309 : hors D8 ; `pty.node` de Windows est le module winpty), sans les sources C
  ni la doc de koffi. Une exclusion de la racine renommée fait échouer la construction (et un essai).
  Racine d'`electron-builder.yml` identique à `main`.
- **koffi** (ADR-0050) : `asarUnpack` de son `.node` (section `win`), texte de licence livré dans
  `resources/licenses/koffi/LICENSE.txt` (koffi est dans `EXCLUDED_FROM_APP` des avis, absent des
  apps Mac et Linux). Ses binaires `@koromix/koffi-win32-<arch>` sont des paquets optionnels que
  pnpm n'installe **que pour la machine qui construit** : construit depuis le Mac, l'installeur
  n'a pas les objets de tâche (repli `taskkill`) et le contrôle l'**avertit** ; sous Windows de la
  même architecture (`release.yml` : une machine par architecture), c'est une **erreur**.
- **Avis de licence** : ConPTY (`conpty.dll`, `OpenConsole.exe`, de Windows Terminal, MIT de
  Microsoft) a son texte livré dans `resources/licenses/conpty/LICENSE.txt`
  (`scripts/third-party/texts/microsoft-terminal-LICENSE.txt`) ; `THIRD-PARTY-NOTICES.md` est
  inchangé (livré aussi sur le Mac). Le `LICENSES.chromium.html` de l'archive Windows reste à côté
  de `Bobine.exe`, en plus de celui de `licenses/electron/`.
- **CI** : `ci.yml`, job `verify (Windows, expérimental)` sur `windows-latest`, `continue-on-error`
  ; `release.yml`, job `windows` (x64 sur `windows-latest`, arm64 sur `windows-11-arm`) derrière
  `BOBINE_WINDOWS_RELEASE` comme Linux, SHA-256 publiée, `verify` obligatoire seulement pour un tag
  ; `e2e.yml`, Système `windows` (Git Bash, `script-shell` de pnpm vers bash). Fins de ligne :
  `core.autocrlf false` avant le checkout (sinon Prettier refuse chaque fichier). Actions épinglées
  par SHA, aucun secret.
- **Essais réels** (VM Windows 11 ARM64, SSH) : installeurs construits **sur le Mac** ; chacun
  installé en silence (`/S`, 40 s), sans entrée HKLM, raccourcis posés avec l'AUMID
  `dev.bobine.app`, `Bobine.exe` de la bonne architecture, lancé sur le bureau (tâche planifiée
  interactive, `--profil-temporaire`) jusqu'à l'écran d'accueil (captures dans les notes de
  session), puis désinstallé (`/currentuser /S`) : dossier, raccourcis et entrée de
  désinstallation retirés. Rien d'autre installé ; VM rendue dans son état. L'installeur x64 tourne
  sous l'émulation d'ARM64.
- **Mac inchangé** : app reconstruite depuis `main` (`7d3add3`) et depuis cette branche : mêmes
  fichiers, mêmes tailles, même liste de l'asar (koffi absent) ; seule différence de contenu,
  `applyAppUserModelId` (sans effet) dans `out/main/index.js`, donc l'empreinte de l'asar dans
  `Info.plist`. Même comparaison faite avant le rebase, `.dmg` compris.
- **Écarts au plan** : option `--win` (plus `--windows` accepté) comme demandé ; seule la branche
  Windows est en node ; « préversion Windows » dans l'À propos et les notes de version : notes
  faites (`release.yml`), À propos laissé au lot 8 (interface). `verify` sous Windows non lancé
  (pas de Node dans la VM, rien n'y est installé sans accord) : à lire sur le premier passage du
  job ; ≈ 41 des 462 fichiers d'essais emploient `sh`/`bash`, `chmod`, des liens symboliques ou
  des groupes de processus.
- **Essais réels refaits après le rebase** (lots 0 à 3 dans `main`, koffi ajouté) : mêmes
  résultats pour les deux installeurs (sans le binaire de koffi, construits sur le Mac).

## Lots 4 et 5 — git et bureau (faits le 2026-11-15)

Branche `claude/229-windows-lots-4-5` (depuis `main` `0ba4163`). Tout passe par le système des
processus (`launchSystem()`, ADR-0050) ou par une capacité ; sur macOS et sous Linux, chaque
fonction touchée rend exactement ce qu'elle rendait (essais « Unix : comme avant » dans chaque
fichier d'essai).

### Lot 4 — git

- **`git/git-platform.ts`** (nouveau) : `isGitProgram` (`git` ou `git.exe`, sans casse, `\` ou
  `/`), `nativeGitPath` (`C:/Users/x` de git → `C:\Users\x`, lecteur en majuscule, UNC), `samePath`
  (sans casse), `windowsGitConfig` (`core.longpaths=true` par `GIT_CONFIG_COUNT`, à la suite de
  ceux de l'utilisateur, sans toucher à sa configuration).
- **Chemins rendus par git** passés par `nativeGitPath` : `rev-parse --show-toplevel` (puce de
  branche, vue Git, worktrees, orphelins), `--git-common-dir`, `worktree list` ; comparaison des
  worktrees connus par `samePath`.
- **CRLF** : avec `core.autocrlf=true` (posé par Git for Windows, et par MinGit) ou un attribut
  `text`, le fichier est en CRLF sur le disque et en LF au dernier commit. `GitChangesReader.fileDiff`
  le compare comme git (`gitConvertsEol` : `ls-files --eol`, puis `core.autocrlf`), sinon toutes
  les lignes paraissaient changées. Comptes `+/-` : ceux de `git diff --numstat`, déjà justes ;
  fichiers non suivis : `\n` comptés, justes en CRLF. Sous Unix : aucune commande de plus.
- **Langue** : `LANGUAGE=C` gardé ; `LC_ALL=C` **pas ajouté**. MinGit n'a pas de traductions
  (messages en anglais avec ou sans), l'essai ne départage donc rien ; la doc de gettext dit que
  `LANGUAGE` suffit quand la langue n'est pas « C ». À revoir avec Git for Windows complet (il
  livre des traductions) si un message français apparaît.
- **git absent** : `spawn git(.exe) ENOENT` → « git est introuvable sur ce PC. Installez Git for
  Windows… » (`git.missingWindows`), aussi pour la vue Git et la puce de branche.
- **Worktrees** : chemins longs par `core.longpaths` (un worktree à 345 caractères créé et lu
  dans la VM ; sans le réglage, `git status` y répond « Filename too long »). **Fichier
  verrouillé** au retrait : git a déjà désinscrit le worktree et effacé ce qu'il pouvait (le
  relancer répond « is not a working tree », vu dans la VM) ; Bobine attend, efface le reste du
  dossier (dans `.worktrees` seulement), puis `worktree prune` ; encore verrouillé :
  « Un programme garde des fichiers du worktree ouverts… » (`worktrees.lockedWindows`). Retrait
  rapide en quittant (`removeIfUntouchedSync`) : environnement de git de l'app sous Windows.
- Non fait : dossiers de configuration des forges (`forge-gitlab.ts`, `quota.ts`) sous `%APPDATA%`
  (paramètre `platform` déjà injecté, branche `win32` à relire) ; hooks par le `sh` de Git for
  Windows (rien à faire côté app).

### Lot 5 — bureau

- **Notifications** : réglages de Windows (`ms-settings:notifications`) au lieu de ceux de macOS ;
  un clic ramène la fenêtre (`revealWindow` : restaurée si réduite, puis au premier plan) et ouvre
  la conversation, comme sur le Mac. L'identifiant d'app est déjà posé (lot 6). **Pas essayé dans
  la VM** (il faut l'app installée) ; limite connue d'Electron : un toast cliqué depuis le Centre
  de notifications, après sa disparition, ne rappelle pas l'app (pas d'activateur COM).
- **Clés d'API** : `safeStorage` = DPAPI sous Windows, rien à changer ; le repli existant (refus
  d'enregistrer, clé lisible par la variable d'environnement de l'agent) dit « Le chiffrement de
  Windows (DPAPI) n'est pas disponible… » au lieu du trousseau de macOS. Pas essayé dans la VM.
- **Explorateur** : capacité **`explorer`** (Windows seulement) → « Afficher dans l'Explorateur de
  fichiers » là où le Finder était nommé par capacité (menu du dossier, onglet Session, profil).
  Les textes qui disent encore « Finder » en dur (fiches 145, 158) restent à reprendre (lot 8).
- **Ouvrir un fichier** : sous Windows, le disque ne dit pas qu'un fichier s'exécute (pas de bit
  `x`) ; une liste d'extensions de Windows (`exe`, `bat`, `cmd`, `ps1`, `vbs`, `js`, `lnk`,
  `msi`, `iso`, `reg`, `hta`, `scr`… , `WINDOWS_RISKY_EXTENSIONS`) fait **montrer** ces fichiers
  dans l'Explorateur au lieu de les ouvrir (un `.bat` ouvert se serait exécuté). macOS : liste et
  bit `x` comme avant.
- **Ouvrir dans un terminal** (`terminal-app.ts`) : `wt.exe -d <dossier>` s'il est là, sinon une
  console PowerShell créée par `Start-Process` dans le dossier. `findProgram` reconnaît désormais
  les **alias d'exécution d'app** (`%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe`, `winget.exe`,
  `python.exe` du Store) : `stat` les refuse (`EACCES`), `lstat` les voit comme liens (vu dans la
  VM) ; sans ce correctif, `wt` n'était jamais trouvé.
- **Polices** (sans dépendance) : source `gdi`, PowerShell + `System.Drawing` (livré avec
  Windows) ; chasse fixe = `iiiiiiiiii` et `WWWWWWWWWW` de même largeur ; polices d'icônes
  (Marlett, Segoe Fluent Icons, MDL2…) écartées. Dans la VM : 136 familles, Cascadia, Consolas,
  Courier New, Lucida Console… en 1,8 s, une fois par lancement. Bloqué (mode de langage
  restreint) : listes vides, comme avant.
- **Données** : `%APPDATA%\bobine` d'office (nom du paquet, lu avant `app.setName`), journal dans
  `%APPDATA%\bobine\logs` : rien à changer.
- **Recommencer à neuf** (fiches 148, 187) : assistant et ménage du profil temporaire en
  PowerShell (`reset-windows.ts`), même contrat que les scripts `sh` : attendre la fin de Bobine,
  tout ou rien (déplacements remis en place au premier échec, raison écrite dans le dossier de
  données), LISEZ-MOI en UTF-8 avec BOM. Le dossier daté est créé à côté du dossier de données
  (même volume : un déplacement est un renommage), puis envoyé dans la **Corbeille de Windows**
  seulement si un fichier témoin y est d'abord bien arrivé ; sinon il reste là, visible. Relance :
  `Bobine.exe` (avec le `--user-data-dir` imposé s'il y en a un) ; pas de « désinstaller » d'ici
  (Paramètres de Windows). `resetPaths` compare avec le séparateur du système.
- **Instance unique, `Bobine.exe <dossier>`** : `requestSingleInstanceLock` et
  `second-instance` déjà en place ; `parseLaunchArgs` résout le dossier avec `path` du système.
  La commande `bobine` du terminal (script `sh`) est masquée sous Windows (Réglages › Général).
  Pas essayé avec l'app dans la VM.
- **À propos** : « Préversion Windows » sous la version (`AppInfo.preview`, décidé par le main).

### Constats dans la VM (Windows 11 ARM64, 2026-11-15)

- **PowerShell 5.1 lancé `detached` ne fait rien** (sans console, il sort aussitôt avec 0, même
  `Set-Content` seul), par SSH comme dans la session de bureau ; un enfant attaché meurt avec
  Bobine (job de libuv). D'où, pour les assistants, un **relais** : un PowerShell caché, attaché,
  attendu (≈ 0,8 s), lance l'assistant par `Start-Process -WindowStyle Hidden` ; l'assistant
  survit à son parent. Le script (≈ 5 Ko, deux fois encodé : 37 419 caractères) dépassait la
  ligne de commande de Windows (32 767) : il est écrit dans un fichier temporaire, chargé par
  `[ScriptBlock]::Create` (non soumis à la stratégie d'exécution `Restricted`, contrairement à
  `-File`), et s'efface d'abord.
- **`SendToRecycleBin` supprime sans rien dire quand la Corbeille n'est pas utilisable** (session
  SSH : dossier parti, Corbeille vide). D'où le fichier témoin. Dans la session de bureau (tâche
  planifiée interactive), le dossier daté arrive bien dans la Corbeille, le témoin en est retiré ;
  par SSH, le dossier reste en place, rien n'est supprimé.
- Réinitialisation essayée pour de vrai (vrai `launchReset`, relais compris) : cas normal
  (accents, apostrophe, LISEZ-MOI), cas d'un fichier ouvert sans partage par un autre processus
  (tout remis en place, raison écrite : « Le processus ne peut pas accéder au fichier… »), cas de
  la Corbeille. Écueil corrigé en route : `Remove-Item` d'un dossier non vide demande une
  confirmation, impossible en mode non interactif, et arrêtait le script avant d'écrire la raison.
- git réel (**MinGit 2.56.1 arm64**, release officielle de git-for-windows, SHA-256
  `96571e44…b4cc8c` lue dans les notes de la release et dans le `digest` de GitHub, vérifiée sur le
  Mac et par `Get-FileHash` ; décompressé dans `C:\Users\jerome\bobine-229\git`, PATH du système
  non modifié) : hors dépôt → `null` ; git absent → message Git for Windows ; dépôt `dépôt é`,
  fichier remis en CRLF par git puis une ligne changée : vue Git `1+ 1−`, diff sans `\r`,
  `1+ 1−` ; racine en `C:\…` ; worktree long créé ; retrait verrouillé : réussi après la levée du
  verrou (5 s), sinon message clair (16 s, dont ≈ 10 s de relances de git lui-même).
- `openTerminal` dans la session de bureau : repli PowerShell — console `-NoLogo -NoExit` vivante
  5 s après, `openTerminal` rendu en 0,9 s ; `wt.exe -d` lancé sans erreur (fenêtre non relevée à
  l'écran). **Incident** : le premier essai fermait les processus `WindowsTerminal` après coup ;
  Windows 11 tient toutes ses fenêtres dans un seul processus (la console de la tâche d'essai y
  était aussi) : une fenêtre Windows Terminal ouverte par Jérôme dans la VM, s'il y en avait une,
  a été fermée. Essais suivants : seuls les processus créés par l'essai sont fermés.
- Non essayé dans la VM (il faudrait l'app installée, hors consigne) : toasts et leur clic,
  DPAPI, instance unique et `Bobine.exe <dossier>`, polices dans Réglages, « Recommencer à neuf »
  depuis l'interface.

### Ce qui change sur macOS et Linux

Rien dans le comportement. Différences de code sans effet : `gitEnv`, `explainMissingGit`,
`isGitProgram`, `nativeGitPath`, `fileDiff`, `Worktrees.remove`, `mayExecute`, `openTerminal`,
`launchReset`, le ménage du profil temporaire et `relaunchAfterReset` prennent une branche Windows
et gardent la leur à l'identique (essais « Unix : comme avant ») ; `resetPaths` compare avec
`path.sep` (`/` sur le Mac, même résultat) ; `fonts.ts` n'ajoute `windowsHide` que sous Windows ;
`SystemNotifier` reçoit l'adresse des réglages (celle de macOS par défaut) ; nouvelle capacité
`explorer`, fausse sur le Mac et sous Linux (libellés inchangés) ; `AppInfo.preview` absent hors
Windows ; `ApiKeyStore` garde le message du trousseau hors Windows.

### Décisions (Jérôme, 2026-11-15)

1. **Commande `bobine` sous Windows** : « Plus tard ». Masquée dans la préversion ; travail futur :
   un `bobine.cmd` posé dans le PATH de l'utilisateur par l'installeur NSIS.
2. **Corbeille inutilisable** : « Le dire au lancement ». Fait : l'assistant laisse une note
   (`reinitialisation-hors-corbeille.txt`, `RESET_KEPT_NAME`) avec le chemin du dossier daté ; la
   Bobine suivante la lit une fois (`takeResetKept`) et le dit (« Bobine a été réinitialisée, mais
   la Corbeille de Windows n'a pas accepté ses anciennes données : elles sont restées dans … »).
   Essai unitaire, et essai réel dans la VM par SSH (Corbeille inutilisable) : note écrite, lue une
   fois, dossier daté à côté du dossier de données.
3. **`LC_ALL=C` pour git** : à essayer au lot 7 avec Git for Windows complet.

### Essais de l'app installée dans la VM (2026-11-15)

Installeur arm64 construit sur le Mac (`pnpm package --win --arm64`, quatre fois au fil des
correctifs), copié avec son empreinte SHA-256 vérifiée dans la VM, installé en silence (`/S`),
puis mis à jour par-dessus. Pilotage : Bobine lancée sur le bureau de la VM (tâche planifiée
interactive) avec `--remote-debugging-port`, pilotée depuis le Mac par un tunnel SSH vers ce port
(`scripts/pilote/cdp.mjs`) ; écran relu par captures de la fenêtre de VMware. Agent : l'agent
factice empaqueté en un fichier (esbuild), lancé par le `node.exe` de la VM comme **agent
personnalisé** (l'agent factice intégré passe par `ELECTRON_RUN_AS_NODE`, coupé dans l'app
packagée).

- **Toasts** : émis pour de vrai (base `wpndatabase.db` de Windows : expéditeur `dev.bobine.app`,
  « Factice VM · Bonjour depuis la ligne de commande / Demande une autorisation : Modification de
  config.json »), avec l'icône et le nom « Bobine » dans le centre de notifications. **Clic** :
  depuis le centre de notifications, le toast disparaît mais la fenêtre réduite **ne revient pas**
  (suivi 15 s, après un témoin de 28 s sans clic) : limite d'Electron sans activateur COM (le
  raccourci de l'installeur n'a pas de `ToastActivatorCLSID`). Le clic sur le toast qui surgit à
  l'écran n'a pas pu être saisi à temps : **non vérifié**. Suite : activateur d'Electron avec un
  CLSID fixe et raccourci mis à jour (journal, 2026-11-15) ; clic à revérifier au lot 7.
- **DPAPI** : clé d'API d'un agent personnalisé enregistrée (« Enregistrée ») ; dans
  `api-keys.json`, valeur chiffrée (préfixe `v10` de Chromium), pas de texte clair ; **après
  redémarrage de l'app**, l'agent a reçu la clé (empreinte SHA-256 notée par un relais, identique
  à celle de la clé saisie). Clé de test, jamais un vrai secret.
- **Instance unique, `Bobine.exe "<dossier>" "<message>"`** : la seconde exécution sort (code 0),
  toujours 5 processus Bobine ; la fenêtre ouverte reçoit le dossier (`projet é`) et le message est
  posé dans la saisie, pas envoyé.
- **Polices** dans Réglages › Apparence : 136 familles, 21 à chasse fixe (Cascadia, Consolas,
  Courier New, Lucida Console…), polices d'icônes écartées.
- **Recommencer à neuf** depuis Réglages › Données : plan affiché, « Tout effacer et fermer » ;
  Bobine se ferme, le dossier daté (`bobine` + LISEZ-MOI) arrive dans la **Corbeille** (session de
  bureau : témoin accepté), Bobine se relance d'elle-même sur un profil neuf (sans clés). Scripts
  temporaires effacés.
- **Essayer Bobine comme neuve** : seconde Bobine sur un profil temporaire ; fermée, son dossier
  est **effacé en moins de 6 s** (après correctif, voir plus bas).
- Au passage : l'app installée dit « git est introuvable sur ce PC. Installez Git for Windows… »
  (git n'est pas dans le PATH du système de la VM).
- **Défauts trouvés et corrigés** dans cette passe (chacun avec son essai) :
  - **Commande d'un agent personnalisé** découpée selon les règles du shell Unix : `\` y échappe,
    `C:\Users\…\node.exe` devenait `C:Users…node.exe` (« Commande introuvable »). Capacité
    **`windowsPaths`** (Windows seulement) : formulaire et main découpent à la Windows (`\`
    littéral ; règle de `CommandLineToArgvW` devant `"` entre guillemets doubles). Revérifié dans
    la VM : commande collée sans guillemets, agent « Prêt ».
  - **Profil temporaire jamais effacé** : à la fermeture, l'app efface d'abord le dossier
    elle-même ; sous Windows, un fichier encore ouvert fait lever `EPERM`, et l'exception sortait
    avant le lancement de l'assistant. Rattrapée ; l'assistant attend aussi les processus
    auxiliaires de Chromium (enfants directs de l'app, 10 s au plus), puis réessaie l'effacement.
  - **Plan de réinitialisation** : « Et la clé Bobine Safe Storage du trousseau » ne s'affiche plus
    sous Windows (la clé DPAPI est dans `Local State`, déjà dans le dossier de données).
- **Textes « Mac » vus à l'écran** (à reprendre au lot 8 ; 29 clés de `fr.json` parlent du Mac ou
  du trousseau, et Linux les montre déjà) : accueil « agent de code installé sur ce Mac »,
  « chiffrée dans le trousseau macOS », « Agents comme sur un Mac neuf », « Serif (New York) »,
  « SF Mono (système) ».
- **Installations dans la VM** : l'app (installée, mise à jour, puis désinstallée par sa commande
  enregistrée : dossier, raccourcis et entrée de désinstallation retirés ; un premier essai de
  désinstallation, lancé autrement, n'avait rien fait). Dossier de données d'essai, élément de
  Corbeille, tâches planifiées et dossier `bobine-229-lot5` effacés ensuite. **Gardé** : MinGit
  (`C:\Users\jerome\bobine-229\git`), pour le lot 7.
- **À signaler** : la fenêtre PowerShell administrateur ouverte dans la VM depuis 15 h 21 n'y
  était plus vers 19 h 58 ; aucun de mes essais ne l'a visée (seuls des processus repérés par leur
  ligne de commande, ou les fenêtres de Bobine, ont été fermés). Six profils `bobine-profil-*` de
  16 h 49 à 17 h 24 (essais du lot 6, avant le ménage Windows) et d'autres créés par les essais
  vitest du lot 7a restent dans `%TEMP%` : pas à moi, laissés.

### Lot 8 (en partie) — textes de Linux et de Windows, `e2e:packaged` (2026-11-15)

- **Textes** : `fr.json` et `en.json` restent écrits pour le Mac, à l'identique ; une section
  `systemTexts` (ajoutée en fin de fichier, rien de réorganisé) donne 54 textes de remplacement
  hors du Mac (`withoutFinder` : « cet ordinateur », gestionnaire de fichiers, trousseau de la
  session, `sudo apt install git`…) et 33 pour Windows par-dessus (`explorer` : Explorateur de
  fichiers, Windows (DPAPI), Git for Windows). Appliqués par `withSystemTexts`
  (`shared/i18n/system-texts.ts`) dans le main, le renderer et `L()` des e2e, d'après les
  capacités `finder` et `explorer`, jamais le nom du système. Essais : chaque variante remplace un
  texte existant avec les mêmes variables ; hors du Mac, plus aucun « Mac », « Finder », « Dock »,
  « trousseau macOS », sauf 12 textes montrés seulement avec une capacité du Mac (capture d'écran,
  simulateur, installation par l'app, compteur du Dock) ou de Réglages › Apparence (polices, autre
  fiche) ; sur le Mac, les ressources sont le même objet.
- **Aide** : lignes conditionnelles dans le guide (`<!-- si: finder -->`, variantes cachées à
  GitHub `<!-- si: !finder` … `-->`), filtrées par `forSystem` (`help/guide.ts`) ; 12 pages par
  langue. Rendu du Mac comparé à celui d'avant : identique. Essai : hors du Mac, aucune page ne
  parle du Mac, du Finder, du Dock ni du trousseau macOS. Les astuces n'en parlaient pas (⌘ déjà
  converti).
- **Réinitialisation** (fiche 148) : « Et la clé Bobine Safe Storage du trousseau » n'est plus
  annoncée sous Linux (seul `security` de macOS l'efface) : `keychain` du plan seulement sur macOS.
- **Clés d'API sous Linux sans trousseau** (D4 de la fiche 145) : voir son journal.
- **Suite `textes-plateforme`** : Réglages › Général, Notifications, Données, Agents avec les
  capacités de Linux puis de Windows ; clé en clair dite sous Linux (`basic_text` simulé). Captures
  `textes-{linux,windows}-{general,notifications,cles}`.
- **`e2e:packaged` sous Linux et Windows** (`e2e/packaged-installed.mjs`, autonome, copiable seul
  dans une VM ; `packaged.mjs` lui passe la main hors du Mac) : l'app installée démarre sur un profil
  temporaire, s'ouvre sur l'accueil du premier lancement, isolée, sans agent factice, sans texte du
  Mac, ouvre un terminal, aucune alerte d'erreur interne, puis quitte (code 0), sans processus
  restant, profil effacé ; capture et journal du main à côté. Windows : vert sur le build `dir`
  arm64 de cette branche copié dans un dossier à moi (l'installeur d'une autre session était
  installé ; l'installation NSIS elle-même est essayée au lot 6), lancé par SSH (les tâches
  planifiées interactives ne partaient plus) ; Node 24 officiel (zip ARM64, SHA-256 vérifiée) dans
  `%USERPROFILE%\bobine-finitions`.
- **Défaut trouvé (Windows, non corrigé)** : fermer un terminal fait lever dans le main
  « `child_process.fork()` is not supported when the runAsNode fuse is disabled » — node-pty liste
  les processus de la console par un `fork` (`conpty_console_list_agent`) quand il tue un terminal
  sans `useConptyDll`, et le fusible `runAsNode: false` l'interdit dans l'app packagée. Effet :
  bandeau « Bobine a rencontré un problème interne », et les processus de la console ne sont pas
  listés. Piste : `useConptyDll: true` sous Windows (conpty.dll et OpenConsole.exe livrés ; `kill`
  sans `fork`), à essayer au lot 7. `e2e:packaged` le détecte (« aucune alerte de l'app »).

## Essais

**GitHub** : `windows-latest` (x64) et `windows-11-arm` sont gratuits pour un dépôt public. Job
manuel dans `e2e.yml` (Système : `windows`), comme Linux ; `ci.yml` (`verify`) pourrait aussi
tourner sous Windows une fois le lot 2 fait. Pas de `xvfb` : la session du runner a un bureau.
Captures en artefact, regardées.

**Unitaires** : tout ce qui touche aux chemins se teste avec `path.win32` injecté, donc aussi sur
le Mac et dans `ci.yml` ; idem pour la recherche `PATHEXT` et l'échappement `cmd.exe` (cas :
espaces, `"`, `&`, `|`, `%VAR%`, `^`, `!`).

### Machine virtuelle Windows (pas-à-pas d'accès)

Faits relevés en lecture seule le 2026-11-15 : **Windows 11 Professionnel**, build 26300,
**ARM64**, sous VMware Fusion (réseau NAT), langue `fr-FR` ; PowerShell **5.1** seul (ni `pwsh`,
ni `bash`) ; **ni git, ni node, ni npm, ni OpenCode, ni Bob** ; `wt.exe`, `winget.exe` et
`wsl.exe` présents ; `LongPathsEnabled` = 0 ; noms 8.3 actifs sur `C:` ; pas de mode développeur ;
`Consolas` et `Segoe UI` présentes, `Cascadia` absente. Le serveur OpenSSH ouvre **PowerShell**
(`DefaultShell`). La session SSH tourne **élevée** (compte administrateur, privilège de lien
symbolique actif) : pas représentative d'un utilisateur ordinaire pour les essais de liens.

1. La VM démarrée dans VMware Fusion, sur le Mac.
2. Depuis le Mac : `ssh -F <dossier>/config-win win`, où `config-win` contient l'hôte `win`
   (`HostName 172.16.206.129`, `User jerome`, `IdentityFile <dossier>/id_ed25519`,
   `IdentitiesOnly yes`, `UserKnownHostsFile <dossier>/known_hosts`). Le dossier d'origine est
   un dossier temporaire de session (effacé au redémarrage) : à copier vers `~/.ssh/bobine-win/`
   par Jérôme. L'adresse NAT peut changer : `ipconfig` dans la VM.
3. Commandes en PowerShell : `Get-Command git`, `where.exe git`, `$PSVersionTable`.
4. **À installer, avec l'accord de Jérôme** (rien n'est installé à ce jour) :
   `winget install Git.Git OpenJS.NodeJS` (Node 24), `corepack enable`, puis le dépôt
   (`git clone`), `pnpm install` (node-pty : binaires `win32-arm64` fournis, sans compilation).
   OpenCode : zip ARM64 de la doc, ou `npm i -g opencode-ai`. Bob : script PowerShell d'IBM.
   Essais de la zone d'écriture dans une session **non élevée** (utilisateur ordinaire créé pour
   ça, ou `runas /trustlevel:0x20000`).
5. **Fenêtres depuis SSH** : un programme lancé par SSH tourne hors du bureau (session de service),
   sa fenêtre est invisible. Pour lancer Bobine sur le bureau de Jérôme : tâche planifiée
   interactive (`schtasks /create /it …` puis `/run`), ou lancement à la main dans la VM ; ensuite
   `pnpm pilote` s'attache par son port DevTools.
6. Vérifier : `./scripts/verify` (Git Bash), `pnpm build && pnpm e2e platform`, `pnpm package
   --windows`, installeur lancé (SmartScreen vu), `pnpm opencode-probe --offline`, `pnpm bob-probe`.

## Risques

1. **Sécurité des écritures** : la zone d'écriture et les risques des permissions sont écrits pour
   des chemins POSIX. Aujourd'hui, `permission-risk.ts` **échoue ouvert** sur un chemin Windows
   (aucun signalement), et la zone d'écriture repose sur un comportement de `realpathSync` face
   aux jonctions jamais vérifié. Les jonctions se créent sans droit. Lot 3 relu par le tech lead,
   essais réels NTFS dans une session non élevée.
2. **Processus** : `.cmd` (Bob et OpenCode par npm) qui ne se lancent pas, consoles qui s'ouvrent,
   orphelins faute de groupes. Touche tous les lancements de l'app ; le critère « aucun orphelin »
   de la fiche 138 demande sans doute du code natif (D9).
3. **Outillage et coût** : scripts en bash, faux outils en `sh`, scénarios factices à commandes
   Unix, troisième système à vérifier à chaque fiche qui touche les processus, les chemins ou
   l'interface. Le passage e2e Windows sera d'abord très rouge, comme Linux (90/125 au premier).
4. Adoption : SmartScreen et Smart App Control sans signature (D3) ; Bob sous Windows non
   relevé (doc muette sur ARM64).

## Lot 3 — chemins et sécurité (fait le 2026-11-15)

Branche `claude/229-windows-lot-3-dff2a0`, partie de `main` (`193f9de`). Ne touche ni au lancement
des processus, ni au terminal, ni au packaging (lots 0 à 2 et 6).

**Principe** : les règles Windows ne s'appliquent qu'à un chemin de forme Windows (lettre de
lecteur, `\\…`) ou quand le système l'est (`process.platform === 'win32'`, injecté) ; macOS et
Linux suivent exactement le code d'avant (essais existants inchangés, et un essai « inchangé » par
module).

| Endroit | Ce qui a été fait |
|---|---|
| `shared/windows-paths.ts` (nouveau, renderer compris) | formes (`isDriveAbsolute`, `isWindowsPath`), noms spéciaux (`windowsNameProblem` : réservé, flux, point/espace final, nom court 8.3, caractère interdit), noms qui agissent dans l'Explorateur (`actsWhenShown`), comparaison sans casse (`windowsWithin`), nom du dossier (`folderName`, `lastSegment`) |
| `agent/write-area.ts` | système injecté (`WriteAreaSystem` : `path`, `realpath`, `lstat`, `windows`) ; sous Windows, posé : tout chemin qui n'est pas `X:\…` (UNC, `\\?\`, `\\.\`, `\\wsl$\`, `\…`, `/c/…`), tout segment au nom spécial, `desktop.ini`/`*.lnk`/`*.url`…, `/` dans le nom relatif ; diffs et emplacements comparés sans casse |
| `conversations/discussion-space.ts` (`openDocument`) | **trou réel corrigé** : sous Windows `O_NOFOLLOW` n'existe pas (`undefined`, donc 0) et l'ouverture suivait un lien symbolique vers un fichier extérieur à un seul nom (accepté par `fstat`). Désormais, sans `O_NOFOLLOW` : `lstat` du nom (fichier, `nlink` 1) puis même `dev`/`ino` sur le descripteur ouvert. macOS et Linux : drapeaux identiques à avant |
| `agent/permission-risk-windows.ts` (nouveau) | appelé par `permissionRisks` sous Windows seulement : `~`, `%VAR%`, `$env:VAR`, `${env:VAR}`, `\…`, `/c/…`, `\\?\` ; dossiers du système (`%SystemRoot%`, `%ProgramFiles%` et `(x86)`/`(Arm)`, `%ProgramData%`, `\Recovery`, `\$Recycle.Bin`, `\System Volume Information`, `\Boot`, périphériques `\\.\`) ; configuration personnelle (`.ssh`, `.gitconfig`, `AppData` — dont Démarrage et `npm` —, profils PowerShell, OneDrive compris ; `%TEMP%` exclu) ; `realpath.native` (noms 8.3 et casse résolus) |
| `agent/windows-command-writes.ts` (nouveau) | lecture étroite de PowerShell et `cmd` : redirections, cmdlets et commandes qui écrivent, `cd` absolu, registre (`reg add/delete/import…`, `regedit`, `*-ItemProperty HKCU:\…`), droits (`sudo`, `runas`, `gsudo`, `Start-Process -Verb RunAs`, même imbriqué) ; **échec fermé** : toute autre commande (`npm`, script, shell imbriqué, bloc `{}`, `` ` ``, `^`, `$(`) ou chemin non résolu donne « écritures inconnues » |
| `shared/permissions.ts`, `PermissionRisks.tsx`, `fr.json`/`en.json` | deux genres : `registry` (« Modifie le registre de Windows : ») et `unknown-writes` (« Bobine ne sait pas lire ce que cette commande modifie : relisez-la avant d'autoriser. ») ; `via` élargi aux commandes Windows. Jamais produits sur macOS ni Linux |
| Affichage : `path-display.ts`, `presentation.ts`, `tool-label.ts` | `~` pour `%USERPROFILE%` (sans casse, `\` et `/`), dossier personnel accepté par `setHomeFolder`/`homeFromArgv`, chemin relatif au dossier de la conversation, coupe dossier/nom, mode présentation (`C:\Users\<nom>`) |
| Libellés de dossiers (13 fichiers du renderer, `plan-doc`, `app-tools`) | les `split('/').filter(Boolean).at(-1)` dupliqués remplacés par `folderName`/`lastSegment` : identiques pour un chemin POSIX, `livres` pour `C:\Users\ada\livres` |

**Essais** : `write-area-windows.test.ts` (18, disque NTFS simulé d'après les constats ; 7 rouges
si l'on retire la règle Windows), `permission-risk-windows.test.ts` (26), `windows-paths.test.ts`
(affichage, noms, et cas POSIX inchangés), `discussion-space.test.ts` (`openDocument` sans
`O_NOFOLLOW` : lien symbolique, lien physique, absent refusés). Le **vrai code** (`write-area`,
`openDocument`, `listDocuments`, `permissionRisks`, empaqueté par esbuild) a aussi tourné sur NTFS
dans la VM : tous les verdicts ci-dessous.

### Constats dans la VM (Windows 11 ARM64, Node 24.22.3, 2026-11-15)

Script node jetable, joué en session SSH **élevée** puis en session **non élevée** (tâche planifiée
`/rl LIMITED /it` sur le bureau de Jérôme, supprimée aussitôt) ; tout effacé ensuite.

| Primitive | Constat |
|---|---|
| Jonction `mklink /J` et `fs.symlinkSync(…, 'junction')` | créées **sans droit** (non élevé compris) ; `lstat` : `isSymbolicLink()` vrai, `isFile()` et `isDirectory()` faux ; `realpathSync` (JS et `.native`) suit vers la cible |
| Lien symbolique de fichier et de dossier | `EPERM` en session non élevée (pas de mode développeur) ; en session élevée : comme une jonction (`lstat` lien, `realpath` suit) |
| Lien physique (`fsutil hardlink create`, `fs.linkSync`) | sans droit ; `lstat().nlink` = 3 pour trois noms, `ino` commun : la règle de la fiche 230 vaut sous Windows |
| `O_NOFOLLOW` | **absent** (`undefined`) : `openSync` suit le lien, `fstat` décrit la cible (corrigé, voir plus haut) |
| Casse, 8.3, `\\?\` | `realpathSync` JS garde la casse et le nom court donnés (`BOBINE~1`), et le préfixe `\\?\` ; `.native` rend le nom long et la vraie casse, sans préfixe. Noms 8.3 créés même pour un dossier neuf (`LOT3-F~1`) |
| UNC `\\localhost\C$\…` | `realpath` le garde tel quel : ne se compare pas au chemin `C:\…` (posé) |
| Point ou espace final | Node crée `b.txt.` tel quel et `lstat('doc.txt.')` = `ENOENT` (Node ne retire rien) ; PowerShell (`Remove-Item`) **ne sait pas effacer** `b.txt.` : l'API Win32 retire le point. D'où la règle : posé |
| `NUL`, `CON.txt` dans le dossier | `lstat` = `ENOENT` : sans règle, « à créer », donc accordé ; posé désormais |
| Flux `doc.txt:flux` | écrit et relu ; `lstat` rend celui de `doc.txt` (même `ino`) ; `realpath` le garde ; `area:flux` (sur le dossier) aussi |
| `rmSync(dossier, { recursive })` | ne traverse pas une jonction (cible intacte) ni ne touche l'autre nom d'un lien physique : l'effacement d'une discussion est sûr |
| OneDrive | `%OneDrive%` existe (dossier ordinaire, 1 entrée) ; pas de fichiers à la demande à essayer : point 7 non relevé |
| Environnement | `%USERPROFILE%` `C:\Users\jerome`, `%APPDATA%` `…\AppData\Roaming`, `%SystemRoot%` `C:\WINDOWS` (majuscules), `%ProgramFiles(x86)%` présent sur ARM64 |

Verdicts du vrai code dans la VM : document existant ou neuf → accordé ; à travers une jonction ou
un lien (fichier, dossier) → refusé ; lien physique, `hard.txt.`, `lien.txt.`, `NUL`, `CON.txt`,
`doc.txt:flux`, `BOBINE~1`, `desktop.ini`, zone en nom court, `\\?\`, UNC → posé ; casse différente
→ accordé ; `openDocument` : lien symbolique, lien physique, jonction refusés ; risques :
`C:\Windows\x` et `C:\PROGRA~1\x` système, `~\.ssh\config` configuration, jonction du dossier hors
du dossier, lien physique `shared-file`, `%TEMP%` hors du dossier, `reg add` registre, `npm test`
inconnu, `dir` rien.

### Écarts au plan et ce qui reste

- **Fait en plus** : `openDocument` (fiche 230) n'était pas sûr sous Windows.
- **Pas fait ici** : clés sans casse (`approvals.json`, historique, dossiers de conversation,
  worktrees) — lot 3 du plan, à reprendre (aucun code des lots 0 à 2 touché) ; `command-writes.ts`
  POSIX inchangé (un agent qui lance `bash` sous Windows est lu par la version Windows, donc souvent
  « inconnu ») ; `file-links.ts` (chemins cliquables `C:\…` dans les réponses), `command-view.ts`
  (`normalizePath`, `outsideWorkspace`) et `shortenPath` restent POSIX ; `listDocuments` montre un
  fichier `b.txt.` créé par Node (lisible par Bobine, pas par l'Explorateur) ; longueur
  (`MAX_PATH`) sans règle : une écriture trop longue échoue, sans risque ; OneDrive (point 7).
- **Conséquence à trancher par le tech lead** : sous Windows, presque toute commande porte
  « écritures inconnues », donc un bandeau et pas de « Toujours » (fiche 211 : une carte signalée
  ne le propose pas ; fiche 042 : un accord retenu exige zéro risque). C'est l'échec fermé voulu
  par cette fiche ; l'adoucir (liste de commandes sûres plus longue) est un choix d'UX.
- **Seule différence possible sur macOS** : en mode présentation, un texte qui contient un chemin
  de forme Windows `X:\Users\<nom>` le montre `~` (`abbreviateHome`/`abbreviateHomeIn` sans
  dossier personnel) ; aucun chemin réel du Mac n'a cette forme.

## Lot 3b — lire les commandes Windows courantes (fait le 2026-11-15)

Décision de Jérôme, 2026-11-15 : **« Apprendre les courantes »**. Le lot 3 disait « écritures
inconnues » de presque toute commande Windows (donc ni « Toujours », ni accord retenu). La prudence
reste la règle par défaut ; Bobine lit désormais une liste bornée de commandes PowerShell et `cmd`,
qui retrouvent « Toujours » quand elles n'écrivent que dans le dossier ; le reste reste inconnu.
Branche `claude/229-windows-lot-3b`, partie de `main` local (`d3fcc5a`).

| Fichier | Rôle |
|---|---|
| `agent/windows-shell-words.ts` (nouveau) | découpage commun : `'…'` (`''`), `"…"` (`""`), listes `a, b`, séparateurs `;` `&&` `\|\|` `\|`, redirections ; illisible : `` ` ``, `^`, `$(`, `@(`, `(` `)`, `{` `}`, `&` seul, `<`, `[` ou `#` en début de mot, guillemet non fermé |
| `agent/windows-cmdlets.ts` (nouveau) | table des cmdlets qui écrivent : paramètres (genre), positions, paramètres communs ; liage à la PowerShell (nom exact ou abréviation sans ambiguïté, `-Nom:valeur`, `-LiteralPath` qui prend la place de `-Path`) |
| `agent/windows-command-writes.ts` | réécrit : cmdlets, `cmd`, programmes courants, `cd`, registre, droits ; un nom commun aux deux shells sans option `/x` est lu des deux façons, et les deux doivent réussir |
| `agent/permission-risk-windows.ts` | variables développées limitées aux emplacements connus (`USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `TEMP`, `TMP`, `SystemRoot`, `windir`, `SystemDrive`, `ProgramFiles*`, `ProgramData`, `ALLUSERSPROFILE`, `PUBLIC`, `OneDrive`, `HOMEDRIVE`, `HOMEPATH`, et `$HOME`/`~`) |

**Reconnu** :

- *PowerShell, lectures* (tous arguments) : `Get-ChildItem` (`gci`, `ls`, `dir`), `Get-Content`
  (`gc`, `cat`, `type`), `Select-String` (`sls`), `Test-Path`, `Get-Location` (`gl`, `pwd`),
  `Get-Command` (`gcm`), `Measure-Object` (`measure`), `Get-Process` (`gps`, `ps`),
  `Write-Output` (`write`, `echo`), `Write-Host`, `Get-Item` (`gi`), `Get-ItemProperty` (`gp`),
  `Resolve-Path`, `Get-Date`, `Get-FileHash`, `Get-Acl`, `Get-Help`, `Get-Member`,
  `Select-Object`, `Where-Object` (sans bloc), `Sort-Object` (et `sort` sans argument),
  `Format-Table`/`-List`/`-Wide`, `Out-String`, `Out-Host`, `Out-Null`, `ConvertTo-Json`,
  `ConvertFrom-Json`, `Get-PSDrive`, `Get-Volume`, `Get-Alias`, `Get-Unique`, `Compare-Object`,
  `Group-Object`, `Start-Sleep`, `Clear-Host`, `exit`.
- *PowerShell, écritures* : `Set-Content`, `Add-Content` (`ac`), `Clear-Content` (`clc`),
  `Out-File`, `Tee-Object` (`tee`), `Export-Csv` (`epcsv`), `New-Item` (`ni`, fichier ou dossier ;
  `-Name`), `mkdir`/`md`, `Remove-Item` (`rm`, `del`, `erase`, `rd`, `rmdir`, `ri`), `Copy-Item`
  (`cp`, `copy`, `cpi`), `Move-Item` (`mv`, `move`, `mi` ; source et destination), `Rename-Item`
  (`ren`, `rni`), `Expand-Archive`, `Compress-Archive` ; registre : `Set-ItemProperty` (`sp`),
  `New-ItemProperty`, `Remove-ItemProperty` (`rp`), et toute écriture vers `HKCU:\…`,
  `Registry::…`.
- *cmd* : `dir`, `type`, `echo`, `where`, `findstr`, `tree`, `more`, `fc`, `comp`, `whoami`,
  `hostname`, `ver`, `tasklist`, `ipconfig`, `systeminfo` (lectures) ; `copy`, `xcopy`,
  `robocopy`, `move`, `del`, `erase`, `rd`, `rmdir`, `md`, `mkdir`, `ren`, `rename` ; `reg`
  (`query` lit, `add`/`delete`/`import`… registre, `export` fichier), `regedit`.
- *Programmes courants*, comme sous Unix : `git`, `npm`, `npx`, `pnpm`, `node`, `python`,
  `python3`, `py`, `cargo`, `dotnet` (`.exe`, `.cmd`, `.bat` acceptés).
- Redirections `>`, `>>`, `2>`, `*>`… (sauf `$null`, `NUL`), `2>&1` ; tuyaux vers `Out-File`,
  `Set-Content`, `Tee-Object` ; `cd`/`Set-Location`/`pushd` (absolu, ou relatif depuis un dossier
  connu), `popd`.

**Toujours inconnu** (essais en table) : commande hors liste (scripts, `iex`/`Invoke-Expression`,
`powershell`/`pwsh`/`cmd` imbriqués, `-EncodedCommand`, `Start-Process`, `sc`, `curl`,
`Invoke-WebRequest`, `fsutil`, `mklink`, `icacls`, `sort /o`) ; `&` ; paramètre inconnu (`-Pth`) ou
abrégé de façon ambiguë (`-Pa`, `-P`) ; paramètre répété, valeur manquante, opérande de trop ;
cmdlet qui écrit sans chemin (`gci | Remove-Item`) ; `New-Item` de lien (`SymbolicLink`,
`Junction`, `HardLink`) ; session distante (`-ToSession`) ; autre fournisseur (`Cert:\`, `Env:\`,
`Function:\`) ; variable hors liste (`$profile`, `$env:FOO`, `%PATH%`) ; `'` dans une commande
lue à la façon de `cmd` ; une chaîne seule en tête (`"x" | …` : programme lancé pour `cmd`) ;
segment générique suivi de `..`.

**Essais** : `windows-command-writes.test.ts` (201 cas en table : lectures, programmes, écritures
PowerShell et `cmd`, pièges, registre et droits, risques nuls qui rendent « Toujours »), plus les
essais du lot 3 mis à jour (`npm test` n'est plus inconnu ; `cd ..` se suit). macOS et Linux : la
lecture bash (`command-writes.ts`) et ses essais sont inchangés.

## Journal

- 2026-11-15 — Fiche de cadrage écrite (sans code) : relevé du code sur `main` (`bcca473`),
  documentation publique d'OpenCode et d'IBM Bob, constats en lecture seule dans la VM Windows 11
  ARM64 (rien installé ni modifié). Décisions D1 à D9 en attente de Jérôme.
- 2026-11-15 — **D1 à D9 tranchées par Jérôme** telles que recommandées (« ok pour toutes ») :
  D4 barre intégrée + ☰, étape « cadre natif + ☰ » permise ; D9 objet de tâche, ADR au lot 0.
  Liens physiques de la zone d'écriture confiés à la fiche 230 (toutes plateformes).
- 2026-11-15 — **Lots 0 à 2** (session fille, worktree `229-windows-lots-0-2`) : ADR-0050 écrit
  (proposé), après essais dans la VM du job de libuv et d'un job à nous ; `koffi` soumis à Jérôme,
  pas ajouté. Lot 1 : capacités de Windows et suite `platform`. Lot 2 : `process-launch.ts`,
  `process-tree.ts`, `process-tree-windows.ts`, `process-registry-windows.ts`, environnement du
  registre, PowerShell dans le terminal ; repli `taskkill` actif tant que `koffi` manque. Écarts
  au plan : pas de module `spawnProgram` unique mais deux (`process-launch` pur, `process-tree`
  pour le cycle de vie) ; `cross-spawn` écarté (règles réécrites, `/v:off` en plus, retours à la
  ligne refusés) ; relais `fresh-start`/`reset` et `spawn` du bureau (lot 5) pas encore portés.
- 2026-11-15 — **`koffi` accepté** par Jérôme : ajouté (3.3.8 exacte, `allowBuilds` limité à
  lui), `JobApi` réel essayé dans la VM (arbre, plantage du main, orphelin), code Windows chargé
  par `import()` sous Windows seulement, exclu des apps Mac et Linux. ADR-0050 accepté. Écueil
  évité : une liste `files` de seules exclusions sous `mac:` faisait entrer tout le dépôt dans
  l'app (vu en listant l'`app.asar`) ; exclusions remises à la racine. La section `linux:` a déjà
  une telle liste (`!node_modules/node-pty/prebuilds/**`) : paquets Linux à vérifier (fiche 145).
- 2026-11-15 — Rebasée sur `main` (`193f9de` : fiches 228, 230, menu opaque, CI Linux ; nouvelle
  capacité `glass`, absente sous Windows comme sous Linux). `./scripts/verify` vert ; e2e
  `session`, `terminal`, `commands`, `command-output`, `filles`, `pannes-visibles`, `restart`,
  `platform`, `about` en clair et sombre : 16/16.
- 2026-11-15 — **Lot 3 (chemins et sécurité)** fait, voir sa section : module `windows-paths`,
  zone d'écriture et risques Windows, `openDocument` sans `O_NOFOLLOW` (trou réel corrigé),
  affichage `~` et libellés. Essais réels NTFS dans la VM (élevée et non élevée), fichiers jetables
  effacés, rien installé. `./scripts/verify` vert ; `pnpm e2e discussion autorisation-commande` :
  4/4 verts (clair et sombre), captures regardées, identiques à avant (bandeaux de risque du Mac).
- 2026-11-15 — **Lot 3b** (« apprendre les courantes », décision de Jérôme) : lecture bornée de
  PowerShell et `cmd`, voir sa section. `./scripts/verify` vert ; `pnpm e2e autorisation-commande`
  vert en clair et en sombre, captures regardées (inchangées).
- 2026-11-15 — **Lot 6 (packaging) fait** : installeurs NSIS x64 et arm64 construits sur le Mac
  (`pnpm package --win`), installés, lancés et désinstallés dans la VM ; `.ico`, AUMID, CI Windows
  expérimentale (`ci.yml`, `release.yml` derrière `BOBINE_WINDOWS_RELEASE`, `e2e.yml`) ; `.dmg`
  du Mac inchangé (comparé). Rebasé sur `main` (`7d3add3`, lots 0 à 3, koffi, `linux.files`) :
  liste `files` de Windows tirée de la racine par `package-win.mts`, koffi remis pour Windows.
  Détail : « Lot 6 — packaging ».
  `./scripts/verify` vert ; `pnpm e2e --changed` (suite complète, `src/main/index.ts` touché) :
  202/204, les deux échecs (infobulles au survol de `history` clair et `roles-gestion` sombre)
  verts en relance seule (4/4).
- 2026-11-15 — **Lots 4 et 5 (git, bureau)** (branche `claude/229-windows-lots-4-5`) : chemins de
  git natifs, CRLF comme git, chemins longs, worktree verrouillé, git absent ; notifications,
  DPAPI, Explorateur, fichiers exécutables de Windows montrés au lieu d'ouverts, terminal (`wt`,
  alias d'app), polices GDI+, « Recommencer à neuf » en PowerShell (relais, Corbeille vérifiée
  par un témoin), À propos. Essais réels dans la VM (MinGit installé, empreinte vérifiée) ;
  incident : une fenêtre Windows Terminal de la VM a pu être fermée par un essai. Écarts : pas de
  `LC_ALL=C` ; commande `bobine` masquée sous Windows ; forges et `quota.ts` non relus.
  `./scripts/verify` vert (492 fichiers, 4 570 essais) ; `pnpm e2e git changes notifications
  settings about worktree-cycle worktree-setup platform fresh-start` : 17/17 (clair et sombre),
  captures regardées (Mac inchangé).
- 2026-11-15 — **Lots 4-5, essais de l'app installée dans la VM** : toasts émis (clic depuis le
  centre de notifications sans retour de la fenêtre : limite d'Electron, à traiter), DPAPI relu
  après redémarrage, instance unique et `Bobine.exe <dossier>`, polices, réinitialisation vers la
  Corbeille et profil temporaire depuis l'interface. Trois défauts trouvés et corrigés (commande
  d'agent personnalisé à la Windows, capacité `windowsPaths` ; profil temporaire jamais effacé ;
  trousseau dans le plan). Décisions de Jérôme : commande `bobine` plus tard ; dossier hors
  Corbeille dit au lancement (fait) ; `LC_ALL=C` au lot 7. App désinstallée, VM rangée (git
  gardé).
  `./scripts/verify` vert (4 574 essais) ; `pnpm e2e custom-agent fresh-start platform settings`
  7/7 (clair et sombre).
- 2026-11-15 — **Lot 8 en partie** (avec la fiche 145, lots 2 et 3) : textes de Linux et Windows
  par capacités (`systemTexts`, guide `<!-- si: … -->`), clés d'API sans trousseau sous Linux (D4),
  `e2e:packaged` de l'app installée (`packaged-installed.mjs`), suite `textes-plateforme`. Défaut
  `fork` de node-pty à la fermeture d'un terminal relevé (voir « Lot 8 »).
- 2026-11-15 — **D4 close** : Jérôme garde la barre de titre de Windows et le menu ☰ (« ça me va
  comme ça, juste avec le burger ») ; l'étape « cadre natif + ☰ » devient définitive, la barre
  intégrée (`titleBarOverlay`) est abandonnée, ses maquettes effacées.
- 2026-11-15 — **Clic sur un toast et descripteurs hérités** (branche `claude/fds-et-toasts`).
  Toasts : Electron 45 a son propre activateur COM (`app.setToastActivatorCLSID`), sans module
  natif ; Bobine lui donne un **CLSID fixe** (`TOAST_ACTIVATOR_CLSID`, sinon tiré au hasard à
  chaque lancement) et vérifie au lancement que le raccourci du menu Démarrer le porte
  (`ensureToastShortcut`, `shell.writeShortcutLink(…, 'update')` ; l'installeur NSIS n'y met que
  l'AUMID). Vu dans la VM (app installée) : au premier toast, Electron inscrit
  `HKCU\Software\Classes\CLSID\{55D36188-…}\LocalServer32 = …\Bobine.exe`, et le raccourci porte
  déjà le CLSID au lancement suivant (journal : « Raccourci des notifications : up-to-date »).
  **Clic non revérifié** : le bureau de la VM était occupé par une autre activité (connexion à
  Claude dans Edge) ; un Win+N d'essai y a ouvert le centre de notifications, puis plus aucun
  geste n'y a été fait. À vérifier au lot 7 (cliquer un toast depuis le centre, fenêtre réduite).
  Descripteurs (pendant Windows de la fiche 145) : l'app installée arrêtée de force
  (`Stop-Process -Force`, sans objet de tâche : installeur construit sur le Mac, sans koffi),
  l'agent (enfant direct) meurt avec elle (job de libuv) et le port DevTools est libéré ; les
  sockets de Chromium sont créés non héritables (`WSA_FLAG_NO_HANDLE_INHERIT`). Handles de
  l'agent non listés (pas d'outil installé) : héritage non prouvé absent, symptôme absent.
  App désinstallée, inscription COM et dossiers d'essai effacés.
- 2026-11-15 — **Essai réel avec IBM Bob et OpenCode sous Windows** (VM Windows 11 ARM64, app
  installée depuis `claude/fds-et-toasts`, `pnpm package --win --arm64` construit sur le Mac, donc
  **sans koffi** : arrêt des arbres par le repli `taskkill`). Captures dans les notes de session
  (`229-bob-windows/`).
  - **Bob** (2.1.0, commit `8afc0007b`, installé par npm dans un dossier du PATH utilisateur,
    connecté en SSO par Jérôme) : profil temporaire, l'accueil dit « IBM Bob trouvé » sans
    réglage ; Bob prêt en 5,1 s ; message d'essai « OK » en 3,8 s (0,0229 Bobcoin). Tâche : créer
    `bonjour.txt` puis `cmd /c ver`. Deux cartes « Autoriser une fois » : création du fichier
    (diff +1) puis la commande, avec l'avertissement Windows « Bobine ne sait pas lire ce que
    cette commande modifie : relisez-la avant d'autoriser » et « Toujours » retiré (lot 3b) ;
    dossier affiché `C:\Users\jerome\Bobine\essai`. Fichier écrit, « Windows version:
    10.0.26300.9457 », terminé en 1 min 31 s, ≈ 0,106 Bobcoin pour la conversation. Bob lancé
    par `cmd.exe /d /s /v:off /c "…\bob.cmd …"` puis `node` ; à la fermeture de Bobine, **aucun
    processus restant** (ni `cmd` ni `node` de Bob, 12 s après).
  - **OpenCode** (zip officiel `opencode-windows-arm64.zip` de la release v2.2.5
    d'anomalyco/opencode, SHA-256 `4e426a39…f242d8` lu dans le `digest` de la release, vérifié
    sur le Mac et dans la VM ; `opencode.exe` copié dans le dossier du PATH utilisateur où est
    Bob) : « OpenCode trouvé », prêt en 1,4 s, essai « OK » en 3,4 s (opencode/Big Pickle,
    0 $). Même tâche (`bonjour-opencode.txt`, `$PSVersionTable.PSVersion` → 5.1.26100.9457) en
    6 s, **sans carte** : OpenCode écrit et lance sans demander (son réglage par défaut, déclaré
    dans son profil). À la fermeture : `opencode acp` et `opencode serve` arrêtés, rien ne reste.
  - Petit défaut vu : l'accueil propose « ~\Bobine/essai » (séparateurs mélangés).
  - Rangé : app désinstallée, dossiers d'essai (`~\Bobine\essai`, `essai-2`), tâches planifiées et
    inscription COM effacés. **Gardés** : Bob et sa connexion, OpenCode (`opencode.exe` dans
    `C:\Users\jerome\bobine-229\node-v24.22.3-win-arm64`, pour le lot 7), MinGit.
- 2026-11-15 — **Fermer un terminal sous Windows** : « Bobine a rencontré un problème interne »
  dans l'app installée. Cause : sans `useConptyDll`, `kill()` de node-pty 1.1.0 lance
  `child_process.fork(conpty_console_list_agent)`, qui passe par `ELECTRON_RUN_AS_NODE` ; le
  fusible RunAsNode de l'app empaquetée l'interdit. Correctif : `useConptyDll: true` sous Windows
  seulement (`windowsPtyOptions`, `terminal/node-pty.ts`) ; node-pty prend alors ses propres
  `conpty.dll` et `OpenConsole.exe`, déjà livrés hors de l'asar (lot 6), sans `fork`. macOS et
  Linux : aucune option de plus (essai). Rejoué dans la VM : `node e2e/packaged-installed.mjs`
  dans la session de bureau, app installée depuis `claude/fds-et-toasts` (rebasée sur `main`
  9f42391) : **tout est bon** (fenêtre, accueil, IBM Bob et OpenCode trouvés, aucun texte du Mac,
  terminal qui exécute une commande, **aucune alerte**, quitte avec le code 0, aucun processus
  restant, profil temporaire effacé). App désinstallée ensuite ; Bob, OpenCode et MinGit gardés.
- 2026-11-15 — Branche `claude/fds-et-toasts` prête à relire (rebasée sur `main` 9f42391) :
  `./scripts/verify` vert ; Mac `pnpm e2e pannes-visibles terminal session restart fresh-start
  startup notifications` 13/13 ; Linux (Docker) `pannes-visibles`, `fresh-start`, `startup`,
  `restart` verts, `terminal` avec le seul échec connu des icônes Nerd Font (fiche 145). Reste :
  le clic sur un toast depuis le centre de notifications, à revérifier quand le bureau de la VM
  est libre (il était en service).
- 2026-11-15 — **Installeur construit dans la VM et essai réel** (`main` b137697 ; branche
  `claude/relais-linux`). Construction comme le job Windows de `release.yml` : sources de `main`
  copiées, pnpm 12.11.2 par corepack (Node 24 de la VM), `pnpm install --frozen-lockfile`, `node
  scripts/package-win.mts --arm64` ; tout (shims, magasin pnpm, caches d'Electron) dans
  `C:\Users\jerome\bobine-229-build`, gardé pour reconstruire. **Deux défauts trouvés et
  corrigés** :
  - **Avis de licence** : la construction s'arrêtait (« @floating-ui/react-dom@2.1.9 introuvable
    ») : sous Windows, pnpm raccourcit les dossiers du magasin et les termine par un hachage,
    parfois avant la version (`@radix-ui+react-compose-ref_b3d765…`). `findPackageDir` cherche
    désormais le paquet par son contenu (`node_modules/<nom>/package.json` à la bonne version),
    plus par le nom du dossier. Le job Windows de la CI aurait échoué de même.
  - **koffi absent de l'app** : l'installeur excluait tout `koffi/src/`, où est aussi son code
    (`src/koffi/index.cjs`, `src/static.cjs`) ; l'app installée retombait sur `taskkill` (« Cannot
    find module './src/koffi/index.cjs' »). Seules les sources C sont exclues désormais, et le
    contrôle de l'asar exige les fichiers que koffi charge (`KOFFI_LOADER`).
  Essai réel avec l'installeur corrigé (`~/.bob` sauvegardé puis restauré à l'identique, 13
  fichiers, rien lu ; profil temporaire) : journal « Arbres de processus : objets de tâche
  (Windows) ». **Bob** : « IBM Bob trouvé », prêt en 5,7 s, essai « OK » (0,023 Bobcoin) ; tâche
  `bonjour.txt` + `cmd /c ver`, deux cartes accordées (la seconde avec l'avertissement Windows et
  « Toujours » retiré), ≈ 0,106 Bobcoin ; **terminal** ouvert, commande lancée, fermé : **aucune
  alerte** (ConPTY de node-pty) ; fermeture de Bobine en **3 s** avec les objets de tâche (plus
  de 12 s avec le repli `taskkill`), aucun processus de Bob restant, profil effacé. **OpenCode** :
  essai « OK » en 2,4 s (0 $), tâche faite en 5 s sans carte, fermeture en 4 s, ses deux
  processus arrêtés. **Toast** : émis pour la carte de la commande (« IBM Bob · … Demande une
  autorisation : cmd /c ver », base de Windows) ; le raccourci a été mis à jour par l'app («
  Raccourci des notifications : updated ») ; **le clic depuis le centre de notifications n'a pas pu
  être fait** : l'affichage de la VM est resté noir (Mac en veille), Win+N ne montrait rien et
  l'automatisation d'interface restait bloquée. Reste à vérifier, bureau allumé. Rangé : app
  désinstallée, dossiers d'essai, tâches planifiées et inscription COM effacés ; Bob, OpenCode,
  MinGit et le dossier de construction gardés.
- 2026-11-16 — **Polices sous Windows, installeur reconstruit dans la VM** (`main` 7f89c9b, mêmes
  étapes que le 15 ; `Bobine-1.0.0-beta.5-arm64.exe`, contrôle du paquet passé). Polices
  relevées par Chromium (`CSS.getPlatformFontsForNode`, polices réellement dessinées) : interface
  en **Inter Variable (livrée)**, blocs de code en **JetBrains Mono (livrée)**, aucune police du
  système en repli ; le grand titre de l'accueil prend Georgia (sa pile `ui-serif`, voulue).
  **Ligatures** : coupées par défaut (`font-variant-ligatures: none`, `=>` et `!=` dessinés tels
  quels) ; Réglages › Apparence › « Ligatures du code » les active (`⇒ ≠ ≥` dans le bloc), le
  texte de l'interface restant sans. Écart vu : l'aide de « Police du terminal » dit « sinon SF
  Mono » sous Windows aussi. **Fermeture** : Bob (`bob.cmd acp` → node) arrêté, Bobine fermée en
  5,8 s ; OpenCode (`opencode acp` et son `serve`) arrêtés, fermée en 4 s (commande `cmd /c ver`
  faite) ; aucun processus restant, profils temporaires effacés. **Clic sur un toast : toujours
  non vérifié** : le Mac était verrouillé (`caffeinate -d` empêche la veille, pas le verrou) ; la
  VM ne dessine plus son bureau tant que le Mac est verrouillé (une capture d'écran faite dans la
  session Windows reste bloquée). `~/.bob` : 6 fichiers modifiés par Bob pendant l'essai, remis
  depuis la sauvegarde (13 fichiers, identiques, rien lu) ; `bob --version` répond.
