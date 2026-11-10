# 158 — Menu du dossier et commande `bobine` du terminal

- **Statut** : fait
- **Dépend de** : 092 (dossier sous la zone de saisie), 093 (dossier choisi d'abord, confiance),
  034 (panneau terminal), 145 (capacités de la plateforme), 052 (liens de fichiers, « Afficher
  dans le Finder »), 073 (installation par l'app), 148 (arguments propres à l'app)
- **Agents** : les deux — rien de propre à un agent : le dossier et le terminal sont ceux de la
  conversation, la commande ouvre une conversation comme « Choisir un dossier ».

## Pourquoi

Le dossier est affiché sous la zone de saisie, mais on ne peut rien en faire sinon en changer :
pas le montrer dans le Finder, copier son chemin, ni y ouvrir un terminal. Et il manque l'équivalent
de `code .` : depuis un terminal, `bobine .` devrait ouvrir Bobine sur ce dossier, avec au besoin
un premier message déjà écrit.

## Critères d'acceptation

- [x] Le menu de la puce du dossier gagne, sous les dossiers récents, « Afficher dans le Finder »
      (le dossier lui-même, par l'IPC `files:openLink` avec `reveal`), « Copier le chemin » et
      « Ouvrir un terminal ici » (panneau terminal de Bobine, ouvert et au clavier, dans le dossier
      de la conversation). Absents tant qu'aucun dossier n'est choisi.
- [x] Sous Linux (capacité `finder` absente) : « Afficher dans le gestionnaire de fichiers ».
- [x] `bobine <dossier> ["premier message"]` ouvre une nouvelle conversation dans ce dossier, au
      premier lancement **et** par une seconde instance (`second-instance`). Les options (`--…`,
      `-psn_…`, dont `--profil-temporaire`, `--reinitialiser`, `--agents-neufs`) ne sont jamais
      prises pour le dossier ou le message.
- [x] Le premier message est posé dans la zone de saisie, **jamais envoyé** tout seul.
- [x] Le dossier suit le parcours de « Choisir un dossier » (`ConversationManager.create` : dossier
      récent, démarrage de l'agent, « Dossier non approuvé » si Bob ne le connaît pas). Un dossier
      absent donne un message d'erreur et n'ouvre rien.
- [x] Réglages › Général › « Commande bobine » : installer (dans `/usr/local/bin` si on peut y
      écrire, sinon `~/.local/bin`), réinstaller quand l'app a été déplacée, désinstaller ; dit si
      le dossier est dans le `PATH`. Un `bobine` qui n'est pas le nôtre n'est jamais écrasé.
- [x] Tests unitaires : analyse des arguments, contrôleur de lancement, script et installation.
- [x] Essai e2e `command` (non jouée par l'auteur) : menu (macOS puis Linux imposé), premier
      lancement avec message, seconde instance, installation / désinstallation sous
      `BOBINE_INSTALL_ROOT`.

## Plan

- `src/shared/command-line.ts` : `CommandLineStatus`, `LaunchPrefill`.
- `src/main/launch-request.ts` (pur) : `userArguments`, `parseLaunchArgs`, `LaunchController`
  (file d'attente avant l'app, message gardé tant que l'interface n'est pas prête).
- `src/main/launch-app.ts` : branchement Electron (`readLaunchArguments`, `attachLaunch`,
  `commandLineDeps`) ; `index.ts` : lecture des arguments au démarrage et dans `second-instance`.
- `src/main/command-line.ts` : script `sh`, installation, état, désinstallation (E/S injectées).
- IPC : `app:takeLaunch`, `app:commandStatus`, `app:installCommand`, `app:uninstallCommand`.
- Interface : `WorkspaceMenu` (3 entrées), `usePanel.showTerminal`, `CommandLineRow`, capacité
  `finder`, clés i18n fr / en, `settings-search`.
- Aucune dépendance nouvelle.

## Journal

### 2026-10-28

Fait. Choix :

- **Première instance, message** : l'interface réclame le message à son montage (`app:takeLaunch`),
  parce qu'un évènement envoyé avant l'abonnement de React se perdrait ; ensuite (seconde instance)
  il arrive par `app:openConversation` + `app:prefill`, comme la fenêtre rapide.
- **Script** : `open -n -a <Bobine.app> --args <dossier> [message]` (`-n` : sans lui, `open` ne
  transmet pas les arguments à une app déjà ouverte) ; le dossier est résolu en chemin absolu par le
  script (la relance d'`open` n'a pas le dossier courant du terminal). Hors `.app` (Linux, sources
  avec `BOBINE_INSTALL_ROOT`) : le binaire, détaché. Le chemin de l'app est écrit dans le script :
  déplacée, Réglages propose « Réinstaller ».
- **Réglage masqué** dans l'app lancée depuis les sources (pas d'app à rouvrir), sauf racine
  d'essai `BOBINE_INSTALL_ROOT` (`<racine>/usr/local/bin`, `<racine>/<home>/.local/bin`).
- **Écarts** : le terminal « ici » est le panneau de Bobine, qui s'ouvre dans le dossier de la
  conversation (pas Terminal.app, resté pour la carte « Dossier non approuvé »). Le libellé
  « Finder » des autres menus (fichiers du fil, modifications) n'est pas encore passé à la capacité
  `finder` : seul le nouveau menu l'est.
- `./scripts/verify` vert ; e2e à lancer à la fusion : `pnpm build && pnpm e2e command` (puis
  `platform`, `startup`, `terminal`, `settings` : fichiers partagés `Menus.tsx`, `platform.ts`).
- 29/10, intégration (tech lead) : depuis les sources, une seconde instance prenait le chemin de l'app
  pour le dossier demandé (Chromium place les options en tête de l'`argv`) : `userArguments` saute
  le premier argument qui n'est pas une option, test à l'appui ; e2e `command` lancé avec
  `--inspect`, presse-papiers relu patiemment et verrou `presse-papiers`. Suite e2e complète verte.
