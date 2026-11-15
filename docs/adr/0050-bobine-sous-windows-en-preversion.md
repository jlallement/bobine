# ADR-0050 — Bobine sous Windows en préversion

- **Statut** : proposé (décisions D1 à D9 tranchées par Jérôme le 2026-11-15, fiche 229 ; le
  moyen d'obtenir l'objet de tâche de D9, et sa dépendance, attendent son accord)
- **Date** : 2026-11-15
- **Complète** : [ADR-0032](0032-bobine-multiplateforme.md) (qui annonçait « Windows plus tard,
  ADR à part ») ; ne le remplace pas

## Contexte

ADR-0032 a rendu Bobine multiplateforme par des **capacités de la plateforme** injectées depuis
`index.ts`, et livré Linux en préversion. Windows n'est pas « un Unix de plus » (relevé de la
fiche 229, sections 1 à 11) :

- **Lancer** : Bob et OpenCode installés par npm sont des scripts `.cmd` (`%APPDATA%\npm\bob.cmd`) ;
  depuis la CVE-2024-27980, Node refuse de les lancer sans shell (`EINVAL`), et `shell: true` passe
  les arguments à `cmd.exe` sans les protéger. `detached: true` ouvre une console par processus.
  Le PATH se coupe sur `;`, la variable s'appelle `Path`, `PATHEXT` dit quelles extensions
  s'exécutent ; il n'y a ni `$SHELL` ni shell de connexion.
- **Arrêter** : pas de groupes de processus ni de signaux. `kill(-pid)` lève ; le repli tue le seul
  chef. La chaîne `npx` → adaptateur → agent, ou `cmd.exe` → `node bob.js`, laisse des orphelins.
- **Le filet de libuv ne suffit pas** (essai dans la VM Windows 11 ARM64, Node 24.22.3, fiche 229,
  journal) : un enfant lancé sans `detached` est mis par libuv dans un objet de tâche
  « tuer à la fermeture », donc il meurt si le main plante ; mais ce job autorise la sortie
  silencieuse (`SILENT_BREAKAWAY_OK`) : le `node` lancé par `cmd.exe` pour `bob.cmd` **survit** au
  plantage du main. Seul l'agent compte, et c'est lui qui reste.
- **Un objet de tâche à nous suffit** (même essai) : un job sans sortie autorisée, avec
  `KILL_ON_JOB_CLOSE`, où l'on place l'enfant juste après son lancement, emporte tout ce que
  l'enfant lance ensuite — à travers `cmd.exe`, à travers un `node` qui a son propre job de libuv
  (job imbriqué), et même un petit-enfant dont le parent est déjà sorti (`TerminateJobObject`). Le
  noyau ferme le job quand le main meurt, plantage compris.

## Décision

Bobine est livrée pour **Windows en préversion**, avec la même règle qu'ADR-0032 : ce qui diffère
passe par des capacités ou des abstractions injectées depuis `index.ts`, jamais par des
`process.platform` dans les modules ; ce qui ne peut pas marcher est masqué.

**Ce que la fiche 229 a tranché (D1 à D8)** :

- **D1 Installeur** : NSIS, installation pour l'utilisateur seul (`%LOCALAPPDATA%\Programs\Bobine`,
  sans droits d'administrateur), raccourci du menu Démarrer portant l'identifiant d'app (sans lui,
  pas de notification). Pas de zip portable, pas de mise à jour automatique (comme le Mac).
- **D2 Architectures** : x64 et arm64 (node-pty livre `win32-x64` et `win32-arm64` : pas de
  compilation).
- **D3 Signature** : aucune pour la préversion ; SmartScreen (« Exécuter quand même ») et Smart App
  Control dits dans la page d'installation ; somme SHA-256 publiée, comme Linux.
- **D4 Fenêtre** : cible, barre de titre intégrée (`titleBarStyle: 'hidden'` + `titleBarOverlay`
  aux couleurs du thème) et menu ☰ de Linux ; **étape intermédiaire** retenue pour les premiers
  lots : cadre natif + ☰, comme Linux (capacités `appMenu` et `insetTitleBar` absentes).
- **D5 Terminal intégré** : PowerShell dans ConPTY, `pwsh` (7) s'il est dans le PATH, sinon
  `powershell.exe` (5.1, toujours présent) ; `cmd` ou Git Bash par un réglage, plus tard.
- **D6 WSL** : hors périmètre ; un dossier `\\wsl$\…` n'est pas un dossier ordinaire (fiche 229,
  sécurité, lot 3).
- **D7 Publication** : même version et même tag que le Mac, installeurs joints à la Release,
  « préversion Windows » dans les notes et l'À propos ; job conditionné par
  `BOBINE_WINDOWS_RELEASE`.
- **D8 Systèmes** : Windows 11 x64 et arm64 promis ; Windows 10 22H2 « devrait marcher ».

**Lancer un programme** (lot 2) : un seul module (`process-launch.ts`) décide comment lancer, par
une fonction pure qui reçoit le système, le PATH, `PATHEXT` et l'accès aux fichiers :

- recherche dans le PATH coupé sur le séparateur du système ; sous Windows, avec chaque extension
  de `PATHEXT` (`.COM;.EXE;.BAT;.CMD` par défaut), un chemin à lettre de lecteur ou à `\` n'étant
  pas coupé ;
- `.exe` / `.com` : lancés directement ;
- `.cmd` / `.bat` : `cmd.exe /d /s /v:off /c "<ligne>"` avec `windowsVerbatimArguments`, la ligne
  composée par l'app (règles de citation ci-dessous), jamais `shell: true` ;
- `.ps1` (seulement s'il n'y a ni `.exe` ni `.cmd` du même nom) : `powershell.exe -NoLogo
  -NoProfile -NonInteractive -File <script> <args>` ; la stratégie d'exécution de l'utilisateur
  n'est **pas** contournée (pas de `-ExecutionPolicy Bypass`) : si elle refuse, l'erreur est dite ;
- sous Windows, jamais `detached` (il ouvre une console et sort l'enfant du job de libuv), toujours
  `windowsHide` ; sur macOS et Linux, rien ne change (`detached`, groupe de processus).

**Règles de citation de `cmd.exe`** (pour un `.cmd` ou `.bat`) — documentées dans le module et
essayées dans la VM :

1. Chaque argument est d'abord cité pour le programme final (règles de `CommandLineToArgvW` / du
   CRT : entre guillemets ; `\` doublés devant un `"` et en fin d'argument ; `"` écrit `\"`).
2. Puis chaque caractère spécial de `cmd.exe` (`( ) % ! ^ " < > & |` et `,;=` , espace et
   tabulation compris dans la ligne citée) est précédé de `^`, **deux fois** : une passe pour la
   ligne `/c`, une pour la réexpansion de `%*` dans le script npm. Un `^` devant chaque `"` empêche
   `cmd.exe` de voir une zone entre guillemets, donc aucun caractère n'échappe à l'échappement.
3. `%` : `^%VAR^%` empêche l'expansion de `%VAR%` (le nom lu devient `VAR^`) ; `/v:off` coupe
   l'expansion retardée (`!VAR!`), même si le registre l'active ; `/d` ignore les commandes
   `AutoRun` du registre.
4. Un argument qui contient un retour à la ligne (`\r`, `\n`) ou un caractère nul **est refusé**
   (erreur claire) : `cmd.exe` ne sait pas le transmettre, et le couper changerait la commande.
5. Le chemin du script lui-même suit les mêmes règles (un dossier `C:\Users\A&B\…`).

**Environnement** : sous Windows, l'app n'interroge pas de shell de connexion (lancée par le menu
Démarrer, elle a déjà le PATH de l'utilisateur) ; un agent installé après le lancement est vu en
relisant les variables du registre (`HKCU\Environment`, puis `HKLM\…\Session Manager\Environment`,
`REG_EXPAND_SZ` développées), au même endroit que « Relire le PATH » (fiche 043). La clé du PATH
est normalisée à un seul endroit (une seule clé, celle que l'environnement emploie déjà : `Path`
sous Windows), et les fusions coupent sur `path.delimiter` du système.

**Arbre de processus (D9)** — moyen retenu, sous réserve de l'accord sur la dépendance :

- **Un objet de tâche par processus lancé** (agent, sonde MCP, serveur de développement, commande
  d'un travail), créé par l'app avec `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, **sans** sortie
  autorisée (`BREAKAWAY_OK` et `SILENT_BREAKAWAY_OK` absents), l'enfant y est placé
  (`AssignProcessToJobObject`) **de façon synchrone** dès que `spawn` rend son pid. Le job reste
  ouvert par le main jusqu'à la fin de l'arbre.
- **Arrêt** : « poli » d'abord (entrée standard fermée pour un agent ACP, qui sort à la fin de son
  flux ; Ctrl+Break n'est pas employé, il demande une console partagée), puis
  `TerminateJobObject` au bout du délai de grâce (3 s, comme `SIGKILL`). L'arbre entier est
  arrêté, orphelins compris.
- **Plantage du main** : le noyau ferme ses poignées, donc ses jobs : tout l'arbre meurt. Le
  registre `agents.pids` reste tenu (journal, diagnostic, repli) ; au démarrage suivant, il est
  vérifié par `Win32_Process` (`ProcessId`, `ParentProcessId`, `CreationDate`, `CommandLine`, lus
  par `Get-CimInstance` en PowerShell) avec les mêmes règles qu'avec `ps` (même commande, même
  heure de départ, sinon pid réattribué), au lieu des groupes.
- **Obtenir les appels Win32 sans module à compiler** : **`koffi`** (FFI, MIT), dépendance chargée
  seulement sous Windows, par `require` paresseux, derrière une interface (`JobApi`) que les essais
  simulent. Ses binaires précompilés (`@koromix/koffi-win32-x64`, `-win32-arm64`) sont des paquets
  optionnels par plateforme : rien n'est compilé, et le `.dmg` n'en contient pas.
- **Repli** si `koffi` ne se charge pas (antivirus, paquet absent) : `taskkill /T /F /PID` pour
  arrêter, plus le job de libuv (enfants directs tués si le main plante) et le registre relu au
  démarrage. Le repli est dit dans le journal et dans le Diagnostic, jamais en silence.

### Options comparées pour l'objet de tâche

| Option | Pour | Contre |
|---|---|---|
| **`koffi`** (retenue) | Maintenue (version 3.3.8 du 2026-11-13, sorties régulières), binaires précompilés win32 x64 et arm64, aucun outil de compilation ; appel synchrone, juste après `spawn` (fenêtre de course de quelques microsecondes) ; 5 fonctions de `kernel32` à déclarer | Une dépendance native de plus (un mainteneur principal) ; un script `install` (`cnoke`, choix du binaire précompilé) à autoriser dans `pnpm` ; appels Win32 écrits à la main (structures à aligner, essai réel obligatoire) |
| Module N-API précompilé existant | Le moins de code | **Aucun trouvé de maintenu** pour les objets de tâche (recherche npm du 2026-11-15 : paquets alpha ou de bac à sable, `@deepseek-ai/dsh-win32-process` 0.1.x, `@rtq/sandbox` 0.1.x). `@vscode/windows-process-tree` (Microsoft) liste l'arbre, ne crée pas de job |
| `ffi-napi` | Connu | Plus maintenu depuis 2022, compilé à l'installation |
| `ffi-rs` | Précompilé (Rust) | Moins répandu ; même rôle que `koffi` |
| Relais PowerShell (`Add-Type` + P/Invoke), sans dépendance | Rien à installer ; essayé dans la VM, le mécanisme marche | ≈ 1,5 s de compilation C# au démarrage, puis une aller-retour par lancement (course de quelques ms avec `cmd.exe`) ; ≈ 70 Mo de mémoire en permanence ; **refusé** en entreprise par le mode de langage restreint (AppLocker, WDAC), et du P/Invoke compilé par PowerShell vers `kernel32` est un motif que les antivirus signalent : mauvais signal pour une app non signée |
| Petit binaire relais (C ou Rust) | Pas de FFI dans le main | Code à compiler en CI pour deux architectures, à livrer et, un jour, à signer : ce qu'on cherche à éviter |
| `taskkill /T /F` + job de libuv + registre (sans dépendance) | Rien de nouveau | Ne tient pas « aucun orphelin si l'app plante » : l'agent derrière un `.cmd` survit (essai) jusqu'au prochain démarrage ; `taskkill /T` rate un enfant dont le parent est déjà sorti ; c'est le **repli**, pas la cible |
| Mettre le main lui-même dans un job | Une seule poignée | Tout ce que l'app ouvre (éditeur, fichier ouvert par l'Explorateur, relance de `fresh-start`) mourrait en quittant Bobine |

## Alternatives écartées

- **`shell: true`** — `cmd.exe` relit la ligne : un argument avec `&`, `|` ou `%VAR%` lance autre
  chose (la CVE-2024-27980 est née de là).
- **`cross-spawn`** — bonnes règles (l'échappement ci-dessus en reprend l'idée), mais il décide
  seul du système et du PATH : pas d'injection, pas de refus des retours à la ligne, pas de
  `/v:off` ; une dépendance pour quelques dizaines de lignes testées.
- **Lire le script npm (`bob.cmd`) pour lancer `node bob.js` directement** — évite `cmd.exe`, mais
  devine un format qui n'est pas un contrat (shims de `npm`, `pnpm`, `volta`, `nvm`…).
- **Le shell de connexion de Git Bash comme source du PATH** — Git for Windows n'est pas toujours
  là, et le PATH du registre est celui que voient les autres programmes de l'utilisateur.
- **Une console cachée partagée et Ctrl+Break pour l'arrêt poli** — un agent ACP sort déjà à la fin
  de son entrée standard ; une console partagée ferait remonter un Ctrl+C du terminal intégré.

## Conséquences

- `BOBINE_PLATFORM=win32` sur un Mac simule les **capacités** de Windows (interface), jamais le
  lancement des processus : celui-ci suit le vrai système (comme `fontSource`). Les règles de
  Windows (PATHEXT, citation, choix du shell, lecture de `Win32_Process`) sont des fonctions
  pures, essayées sur le Mac et dans `ci.yml`, puis dans la VM.
- Sur macOS et Linux, rien ne change : mêmes groupes de processus, mêmes signaux, mêmes essais.
- Une nouvelle façon de lancer un programme passe par `process-launch.ts` ; un `spawn` direct
  ailleurs est une régression sous Windows (console, `.cmd`, orphelins).
- La dépendance `koffi` : version épinglée, suivie par la fiche de montée des dépendances, son
  binaire Windows ajouté aux avis de licence (`third-party-notices`) ; le paquet Windows doit
  embarquer le binaire de son architecture (`asarUnpack`, lot 6).
- Si `koffi` venait à manquer (abandon, refus d'un antivirus), le repli tient tout sauf
  « aucun orphelin au plantage » ; un ADR remplacerait alors le moyen, pas la décision D9.
- Le terminal intégré ne connaît pas de groupe au premier plan sous Windows : « Arrêter » s'en
  tient à Ctrl+C (déjà le cas).
- Les relais de `fresh-start` et `reset` (scripts `/bin/sh`) restent à porter (fiche 229) ; avant
  la préversion, ils sont portés ou masqués par une capacité, jamais laissés en panne.
