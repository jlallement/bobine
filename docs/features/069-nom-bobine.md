# 069 — Nouveau nom : Bobine, et sa nouvelle icône

- **Statut** : fait
- **Dépend de** : 012, 022, 059
- **Agents** : les deux (nom de l'app, rien de propre à un agent)

## Pourquoi

« Bob Desktop » ne dit rien d'OpenCode ni des autres agents. **Bobine** garde un clin d'œil à Bob,
et l'icône (une bobine dont le fil s'enroule, une invite de commande gravée dans la flasque) dit
« outil pour le code ». Choisis par l'utilisateur ; icône dessinée par lui, retouchée ici.

## Critères d'acceptation

- [x] Nom affiché « Bobine » : app (Dock, menus, fenêtre, notifications), `.dmg`
      (`Bobine-<version>-arm64.dmg`, titre), textes de l'interface, diagnostic, export,
      documentation vivante.
- [x] **Tout renommé** (ADR-0013, à la demande de l'utilisateur) : dépôt GitHub `bobine`, paquet,
      dossier de données (`~/Library/Application Support/bobine`), identifiant de bundle
      (`dev.bobine.app`), serveur MCP `bobine`, `.bobine/commands`, variables `BOBINE_*`, format
      d'export `bobine-conversation`, nom du client ACP. Les noms d'IBM Bob (`BOB_API_KEY`,
      `~/.bob`, `.bobignore`) ne changent pas.
- [x] Rien de perdu : au premier lancement, le dossier `bob-desktop` devient `bobine` (historique,
      réglages) ; pas tant que l'ancienne app est ouverte (elle écrit dedans) : l'app le dit et
      s'arrête. Les commandes encore dans `.bob-desktop/commands` restent lues.
- [x] Clé d'API que le trousseau ne sait plus déchiffrer (entrée liée à l'ancien nom) : affichée
      « Illisible, à saisir de nouveau » dans Réglages › Agents, et non « Enregistrée ».
- [x] Icône : fond pétrole, bobine crème, invite `>_` assez épaisse pour se lire à la taille du
      Dock ; dans le gabarit macOS (carré de 824 sur 1024, ombre).
- [x] Doc d'installation : « Venir de Bob Desktop » (ancienne app à supprimer, clés à ressaisir).
- [x] La bobine dans l'app, de la couleur d'accent : à côté du message d'accueil (le fil s'enroule
      à l'ouverture, puis le curseur clignote) ; pendant que l'agent travaille (le fil s'enroule et
      se déroule en boucle, immobile quand l'agent attend l'utilisateur) ; immobile si macOS
      réduit les animations. Réglages › À propos : l'icône, le nom et la version.
- [x] Testé : unitaire (clé illisible signalée, puis lisible une fois ressaisie ; textes) ; e2e
      (suites touchées, puis toutes avant le push) : bobine de l'accueil animée puis arrêtée,
      animée en boucle pendant la réponse, immobile pendant une demande d'autorisation ; icône
      dans À propos.

## Plan

1. `build/icon.svg` d'après le dessin de l'utilisateur (grille de 256), mis au gabarit macOS,
   invite épaissie (trait 4 → 6,5) ; `build/icon.png` régénérée (`scripts/make-icon.mjs`).
2. `app.setName('Bobine')`, `electron-builder.yml` (`productName`, `.dmg`), titre de la page,
   textes de l'interface et du main, tests et e2e qui les vérifient, flux de publication.
3. `ApiKeyInfo.unreadable` (`ApiKeyStore.info`), affiché dans Réglages › Agents.
4. ADR-0012, doc vivante (README, AGENTS.md, docs/README, installation, acp, agents).
5. (Ajout du même jour, choisi par l'utilisateur sur maquette.) `shared/spool.ts` (dessin),
   `components/SpoolMark.tsx` (`SpoolMark`, `AppIcon`) ; accueil (`App.tsx`), `WorkingIndicator`,
   À propos (`SettingsDialog`) ; animations en CSS.
6. **Tout renommer** (demandé ensuite par l'utilisateur, ADR-0013 remplace l'ADR-0012) :
   `package.json` `name`, `appId`, `APP_TOOLS_SERVER_NAME`, `PROJECT_COMMANDS_DIR` (+ ancien
   dossier lu), format d'export, `clientInfo`, variables `BOBINE_*` (dont `BOBINE_CONFIG_HOME`),
   marqueur du shell, `TERM_PROGRAM`, user agent du navigateur intégré, clé `localStorage`,
   scénarios et e2e, doc vivante ; `main/user-data-migration.ts` (renommage du dossier de données,
   refus si l'ancienne app tourne : verrou `SingletonLock` de Chromium) ; dépôt GitHub renommé et
   `origin` mis à jour.

Pas de nouvelle dépendance.

## Journal

- 2026-10-15 — Fait selon le plan.
  - Icône : dessin de l'utilisateur (fond `#165C63`, crème `#F4F0E5`) repris tel quel, deux
    retouches convenues : carré ramené au gabarit macOS (il occupait 87 % de l'image, les icônes
    voisines du Dock 80 %), ombre portée comme l'ancienne icône ; invite `>_` épaissie (trait 4
    → 6,5 sur 256) : elle disparaissait sous 64 px. L'invite est dessinée en couleur du fond
    plutôt que découpée par un masque : même rendu sur un fond uni, plus simple.
  - Nom : le trousseau (`safeStorage`) range sa clé sous « <nom de l'app> Safe Storage » ; le
    changement de nom rend les clés enregistrées illisibles. Elles étaient alors ignorées en
    silence, et l'interface les disait « Enregistrée » : désormais signalées. Le dossier de
    sauvegarde de l'historique s'appelle `bobine-sauvegarde-<date>`.
  - Gardés : fiches et ADR passés (traces datées), nom du simulateur de `simulator-smoke`
    (appareil d'essai), nom de l'artefact de la CI.
- 2026-10-15 — La bobine dans l'app (maquette animée présentée, emplacements et couleur choisis par
  l'utilisateur : accueil, agent au travail, À propos ; orange de l'app plutôt que pétrole, pour
  garder une seule couleur vive dans l'interface).
  - Animation : chaque tour de fil (forme pleine de l'icône) est révélé par un masque dont le trait
    épais suit son milieu ; `stroke-dashoffset` animé en CSS (accueil : 0,6 s puis 0,45 s, curseur
    trois fois ; au travail : boucle de 2,8 s, enroulé puis déroulé). Un masque par tour, sinon le
    trait d'un tour dévoilait un bout de l'autre. L'invite `>_` n'est gravée qu'au-dessus de 28 px.
  - Remplace l'étincelle (Lucide `Sparkles`) de l'accueil et de l'indicateur ; sa pulsation
    (`working-pulse`) retirée. Quand l'agent attend une réponse, la bobine s'arrête, estompée.
  - Dessin partagé (`shared/spool.ts`) ; un test vérifie qu'il est celui de `build/icon.svg`.
  - Captures regardées : `1-accueil` (clair, sombre), `1b-agent-ecrit`, `85-a-propos`.
- 2026-10-15 — **Tout renommé**, à la demande de l'utilisateur (ADR-0013 remplace l'ADR-0012).
  - Dépôt GitHub renommé (`gh repo rename`) : `jlallement/bobine`, l'ancienne adresse redirige ;
    `origin` mis à jour.
  - Paquet `bobine` (d'où le dossier de données `…/bobine`), `appId` `dev.bobine.app`, serveur MCP
    et client ACP `bobine`, `.bobine/commands`, `bobine-conversation`, variables `BOBINE_*`
    (`BOB_DESKTOP_CONFIG_HOME` → `BOBINE_CONFIG_HOME`), marqueur du shell, `TERM_PROGRAM`, user
    agent du navigateur intégré (nom de l'app retiré), clé `localStorage`, dossiers temporaires,
    noms d'essai (`fr.bobine.demo`, simulateur « Bobine Smoke »), artefact de la CI. Gardés : les
    noms d'IBM Bob, et les fiches et ADR passés.
  - `main/user-data-migration.ts` : `bob-desktop` renommé `bobine` au premier lancement, lien
    laissé à l'ancienne place (chemins enregistrés : dossier de travail par défaut, sessions des
    agents) ; refusé si le verrou `SingletonLock` de l'ancien dossier nomme un processus vivant
    (dialogue, puis arrêt). Rien n'est tenté avec `--user-data-dir` (essais). Testé sur des
    dossiers jetables ; pas lancé sur le vrai dossier de l'utilisateur (son app tourne en
    parallèle) : la reprise se fera à son premier lancement de Bobine.
  - `.bob-desktop/commands` encore lu (une commande de `.bobine/commands` l'emporte) : unitaire et
    e2e `user-commands`.
  - Essais : `verify`, e2e (suites touchées, puis toutes), app packagée (`dev.bobine.app`).
- 2026-10-15 — **Reprise sans effet en vrai** (trouvé par l'audit, fiche 071) : Electron crée le
  dossier de données, vide, avant que le code de l'app ne tourne ; `bobine` existait donc toujours
  et l'ancien dossier n'était jamais repris (les tests unitaires utilisaient des dossiers
  jetables). Corrigé dans la fiche 071.
