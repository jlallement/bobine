# 148 — Recommencer à neuf : profil temporaire et réinitialisation façon désinstalleur

- **Statut** : fait (essayé sur l'app packagée depuis la fiche 187 : `pnpm e2e:packaged`)
- **Dépend de** : 136 (Réglages › Données), 126 (confirmation dans la ligne), 073 (installation par
  l'app), 069 (ancien dossier `bob-desktop`), 041 (journal), 138 (processus)
- **Agents** : les deux (et tout agent ACP) : « Agents comme sur un Mac neuf » lance les agents avec
  un dossier personnel vide (`HOME`, `XDG_*`), sans rien supposer de leur rangement (ADR-0011) ; la
  réinitialisation ne touche jamais aux données des agents.
- **Maquette** : planche « Recommencer à neuf » validée par Jérôme le 24/10, avec les deux
  propositions (maquette privée, non publiée), DOM dans
  `e2e/maquettes/screens-reinitialiser.mjs`.

## Pourquoi

Jérôme veut pouvoir relancer Bobine « comme si je venais de l'installer » — refaire l'accueil, la
découverte des agents, le SSO —, à la façon d'un désinstalleur, et un profil temporaire pour tester.
Aujourd'hui : seulement `--user-data-dir`, l'option des essais, qui change aussi le comportement de
l'app ; et des traces hors du dossier de données (trousseau, journaux, préférences de macOS).

## Critères d'acceptation

- [x] Réglages › Données, en bas : section « Recommencer à neuf » (« Essayer Bobine comme neuve »,
      « Agents comme sur un Mac neuf », « Réinitialiser Bobine ») ; absente dans un profil
      temporaire.
- [x] « Ouvrir » lance une seconde Bobine sur un profil vide (dossier dans les fichiers
      temporaires, supprimé à sa fermeture), comme une vraie première installation (pas comme un
      essai) ; la vôtre reste ouverte et intacte. Pastille « Profil temporaire · effacé à la
      fermeture » dans sa barre de titre.
- [x] « Agents comme sur un Mac neuf » (décochée par défaut) : les agents de la seconde Bobine ont
      un dossier personnel vide (`HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME`,
      `XDG_CACHE_HOME`), posé après la lecture du shell (le `PATH` reste le vôtre).
- [x] « Réinitialiser… » ouvre la confirmation dans la carte : ce qui part à la corbeille, avec les
      tailles (conversations et leur nombre, réglages, consommation, navigateur, journaux et cache),
      la clé du trousseau, ce qui reste ; case « Mettre aussi l'app à la corbeille (désinstaller) » ;
      « Garder » a le focus ; « Tout effacer et redémarrer » / « Tout effacer et désinstaller ».
- [x] Confirmé : Bobine quitte sans autre question ; un assistant (le binaire d'Electron en mode
      Node) attend sa fin, met dans un dossier daté de la corbeille le dossier de données, l'ancien
      `bob-desktop`, les journaux, l'état des fenêtres et (case cochée) l'app, avec un `LISEZ-MOI.txt`
      qui dit d'où vient chaque élément ; supprime la clé « Bobine Safe Storage » et les préférences
      de macOS de l'app (app installée seulement) ; relance Bobine (sans la case).
- [x] Jamais touchés : projets et worktrees, dossiers des agents (`~/.bob`, OpenCode), et, avec un
      dossier de données imposé (essais), ni le trousseau ni les préférences de macOS.
- [x] Ligne de commande : `--profil-temporaire` (et `--agents-neufs`), `--reinitialiser` (ouvre
      Réglages › Données sur la confirmation).
- [x] Testé : unitaires (classement et tailles, plan de l'assistant, assistant lancé pour de vrai
      sur des dossiers d'essai, profil temporaire, IPC, section des réglages) ; e2e (profil
      temporaire : pastille, dossier temporaire supprimé à la fermeture ; confirmation avec ses
      lignes) ; captures clair et sombre.

## Plan

1. **`src/main/fresh-start.ts`** (nouveau) : options de lancement, dossier temporaire (créé avant
   tout usage du dossier de données, supprimé à `will-quit`), agents isolés, seconde Bobine lancée
   détachée ; `isolated` (dossier imposé : essais ou profil temporaire).
2. **`src/main/reset.ts`** (nouveau) : `classifyEntry` et `resetInventory` (tailles, nombre de
   conversations), `resetJob` (chemins, trousseau, préférences, relance), `RESET_HELPER` (script
   Node autonome, lancé par `ELECTRON_RUN_AS_NODE` — remplacé par un script `sh`, voir le journal
   du 2026-11-06) ; `BOBINE_TRASH_DIR` et
   `BOBINE_RESET_RELAUNCH=off` pour les essais.
3. **`index.ts`** : `userData` et les tests « dossier imposé » passent par `freshStart` ; agents isolés
   après la lecture du shell ; dépendance IPC. `appLanguage` part dans `native-language.ts` (plafond
   de lignes de `index.ts`).
4. **IPC** (`app-ipc.ts`, `shared/ipc.ts`, préload) : `AppInfo.freshStart` (`temporary`,
   `askReset`), `app:resetPlan`, `app:reset`, `app:openTemporaryProfile`.
5. **Renderer** : `settings/FreshStart.tsx` (section, confirmation), pastille dans la barre de titre
   (`App.tsx`), `--reinitialiser` → Réglages › Données ; textes fr et en, recherche des réglages.
6. **Tests, e2e** (`fresh-start.mjs`, nouvelle suite), **docs** (fiche, index, `architecture.md`,
   `AGENTS.md`, CHANGELOG fr et en).

Pas de nouvelle dépendance.

## Journal

### 2026-10-24 — plan

Maquette et deux propositions validées ; plan écrit avant de coder.

### 2026-10-24 — fait

- **Fait** : tout le plan. Main : `fresh-start.ts` (options, profil temporaire, agents isolés,
  seconde Bobine, `TEMPORARY_CLEANUP`), `fresh-start-app.ts` (Electron, IPC), `reset.ts`
  (`classifyEntry`, `sizeOf`, `resetInventory`, `resetFolderName`, `resetPaths`, `RESET_HELPER`,
  `launchReset`) ; `index.ts` passe par `freshStart` (dossier de données, tests « dossier imposé »,
  agents isolés après le shell) et `appLanguage` part dans `native-language.ts`
  (`systemAppLanguage`) pour tenir le plafond de lignes ; canaux `app:resetPlan`, `app:reset`,
  `app:openTemporaryProfile`, `AppInfo.freshStart`. Renderer : `settings/FreshStart.tsx`
  (section, confirmation, pastille), `fresh-start.ts` (infos du lancement, demande unique),
  `App.tsx` (pastille, `--reinitialiser` → Données) ; textes fr et en, recherche des réglages.
- **Tests** : `fresh-start.test.ts` (options, dossier temporaire supprimé, agents isolés, seconde
  Bobine, assistant de ménage lancé pour de vrai), `reset.test.ts` (classement, tailles, nom daté,
  chemins, lancement de l'assistant, assistant lancé pour de vrai : corbeille datée, LISEZ-MOI,
  relance, second dossier le même jour), `app-ipc.test.ts`, `FreshStart.test.tsx` (ouvrir, agents
  neufs, confirmation et tailles, désinstaller, app non installée, `--reinitialiser` une fois,
  profil temporaire).
- **e2e** `fresh-start` (nouvelle suite, clair et sombre) : profil temporaire (pastille, dossier
  dans les fichiers temporaires, pas de section, dossier supprimé une fois l'app fermée) ;
  réinitialisation d'une Bobine d'essai (`BOBINE_TRASH_DIR`, `BOBINE_RESET_RELAUNCH=off`) :
  conversations comptées, cinq groupes, ni désinstallation ni trousseau (dossier imposé), « Garder »
  n'efface rien, confirmé : l'app quitte, son dossier part dans la corbeille d'essai avec le
  LISEZ-MOI. Captures `148-…` regardées.
- **Écarts au plan**
  - Chromium et le registre des processus écrivent encore après `will-quit` : le dossier
    temporaire est vidé à `will-quit` puis supprimé par un petit assistant détaché qui attend la fin
    de l'app (vu dans l'e2e : `Local State`, `agents.pids` réapparaissaient).
  - L'app ne se relance que si elle est installée (dans Applications) : en développement, la
    relance d'`electron .` perdrait le serveur de `pnpm dev`. La confirmation dit alors « Tout
    effacer et fermer » et « relancez-la ensuite ».
  - Textes de l'interface génériques (« Les agents… ») plutôt que « Bob et OpenCode » (ADR-0011) ;
    aides des réglages raccourcies à 90 caractères (fiche 133).
  - La confirmation prolonge sa ligne : même fond pour la ligne « Réinitialiser Bobine » et elle,
    jusqu'au bas de la carte, sans titre répété ni trait entre elles (relevé par Jérôme : la maquette en faisait un bloc
    bordé et arrondi, titré « Réinitialiser Bobine ? », dont les coins touchaient le trait).
  - Défaut trouvé en chemin : un bouton rouge survolé passait au gris avec un texte blanc
    (`.btn:hover:not(:disabled)` plus spécifique que `.btn.danger`) ; corrigé pour tous.
- **À essayer pour de vrai** (pas en e2e : trousseau, préférences, app installée, relance) :
  1. App installée : « Réinitialiser… », confirmé : Bobine se ferme, un dossier « Bobine — données
     du … » apparaît dans la corbeille avec le LISEZ-MOI, la clé « Bobine Safe Storage » a quitté le
     trousseau, Bobine se relance sur l'accueil.
  2. Même chose, case « désinstaller » cochée : l'app est aussi dans le dossier daté, pas de relance.
  3. « Ouvrir », avec puis sans « Agents comme sur un Mac neuf » : la seconde Bobine a la pastille ;
     avec la case, Bob redemande le SSO et OpenCode n'a plus de fournisseur (si Bob garde son jeton
     dans le trousseau, il reste connecté : à noter dans `docs/acp.md`).
  4. `open -n -a Bobine --args --reinitialiser` : Réglages › Données, confirmation ouverte.

### 2026-10-24 — suite complète, échec intermittent de `filles` corrigé

- `pnpm build && pnpm e2e --changed` sur cette branche (126 tâches) : 124 vertes ; `filles` en échec
  en clair et en sombre, rejouée seule : encore en échec (« En-tête 2 », délai dépassé). Verte sur
  `main` une fois, en échec une fois sur deux sur la branche 147 : c'est l'échec intermittent déjà
  noté par la fiche 143 (« vu 2 fois sur 4 sur `main` »), pas une régression de ces fiches.
- **Cause** : une proposition qui arrive déplace la mise en page sous le pointeur immobile ;
  Chromium y voit un survol de la zone de saisie, qui lève la pause du fil sous le pointeur
  (fiche 124) ; le fil redescend après que l'essai a visé « Lancer », et l'appui tombe à côté.
  Une instrumentation qui lisait `scrollTop` (mise en page forcée) faisait tout passer.
- **Correction** (essai seulement, `e2e/suites/filles.mjs`, `approve`) : le pointeur est d'abord
  amené sur le bouton, puis l'essai vise de nouveau et clique, comme une main qui vise une cible qui
  vient de bouger. `filles` verte 6 fois sur 6 (trois passages, clair et sombre).
- Non traité : « propositions en rafale » (« Lancer » qui remonte sous le pointeur), vu une fois
  dans la suite complète, même famille, déjà décrit par la fiche 143.

### 2026-11-06 — L'assistant ne marchait pas dans l'app packagée (fiche 187, R2)

- **Constat** (audit de la fiche 187) : « Réinitialiser Bobine » et le ménage du profil temporaire
  lançaient leur assistant par `ELECTRON_RUN_AS_NODE=1 Bobine -e <script>`. Dans l'app packagée,
  le fusible RunAsNode est coupé (`electron-builder.yml`) : la variable est ignorée et c'est une
  **seconde Bobine graphique** qui démarrait, avec le script pris pour un dossier. Rien n'était mis
  à la corbeille ; quitter un profil temporaire ouvrait une Bobine. Les essais ne le voyaient pas :
  ils tournent sur l'Electron de développement, sans fusibles.
- **Correction**, fusible gardé coupé :
  - les deux assistants sont des scripts `sh` lancés par `/bin/sh -c`, détachés. Ils reçoivent leur
    travail en arguments, sans fichier JSON (`resetHelperArgs`) ;
  - la réinitialisation est **tout ou rien** :
    - le script attend la fin de Bobine. Si elle tourne encore au bout de 60 s, il ne touche à rien
      (avant, il déplaçait quand même) ;
    - il déplace chaque chemin par `mv`. D'un volume à l'autre, `mv` ne supprime l'original
      qu'après une copie réussie ;
    - au premier échec, ce qui a déjà été déplacé est remis en place, et ni le trousseau ni les
      préférences ne sont touchés ;
    - la raison est écrite dans `reinitialisation-echouee.txt`, dans le dossier de données. La
      Bobine relancée la lit une fois (`takeResetFailure`) et l'affiche dans la conversation de
      l'accueil : « La réinitialisation de Bobine n'a pas pu se faire : rien n'a été supprimé… » ;
    - le LISEZ-MOI est écrit d'un coup : un fichier temporaire, puis `mv` ;
  - le ménage du profil temporaire ne supprime qu'un dossier `bobine-profil-*`, et seulement
    après la fin de l'app.
- **Essais** :
  - `reset.test.ts` : lancement par `/bin/sh` sans mode Node, réussite (chemin avec espace et
    accent), déplacement impossible (tout remis en place, raison lue une fois, relance), corbeille
    impossible à créer, Bobine encore ouverte (rien, pas de relance) ;
  - `fresh-start.test.ts` : ménage pour de vrai ; refus d'un autre dossier ; refus tant que l'app
    tourne ;
  - **`pnpm e2e:packaged`**, qui tourne aussi dans `release.yml` sur le DMG :
    - profil temporaire supprimé à la fermeture ;
    - réinitialisation vers une corbeille d'essai ;
    - corbeille en lecture seule : rien d'effacé, avis au lancement suivant, capture
      `packaged-reinitialisation-echouee.png` ;
    - après chaque cas, **aucune autre Bobine** lancée.

### 2026-11-06 — La relance rouvrait le vrai profil (fiche 187, D24 de la recette 183)

- **Constat** (recette 0.9.1, déduit du code sans être joué, pour ne pas ouvrir le vrai profil) :
  une Bobine **installée**, lancée avec `--user-data-dir`, se réinitialisait puis se rouvrait par
  `open -n <app>` sans l'option, donc sur le profil habituel de l'utilisateur.
- **Correction** : `resetRelaunch` (`fresh-start.ts`) construit la relance. Un dossier de données
  imposé la suit (`open -n <app> --args --user-data-dir=<chemin absolu>`) ; le dossier remis à
  zéro est ainsi rouvert neuf. Profil temporaire : pas de relance, la réinitialisation y est déjà
  refusée (« fermez-le, il est effacé ») et `resetRelaunch` ne rend rien non plus.
  `--agents-neufs` ne vaut qu'avec le profil temporaire : rien à transmettre.
- **Essais** : `fresh-start.test.ts` (relance sans option, avec un dossier imposé à espace et
  accent, rien pour un profil temporaire) ; `pnpm e2e:packaged` remplace `open` par un
  enregistreur (`BOBINE_RESET_RELAUNCH=<chemin>`, essais seulement, aussi pour l'app packagée non
  installée) et vérifie les arguments de la relance, réussie ou non : jamais le vrai profil.
