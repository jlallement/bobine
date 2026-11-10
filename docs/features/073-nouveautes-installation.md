# 073 — Nouveautés dans « À propos », .dmg illustré, installation par l'app elle-même

- **Statut** : fait
- **Dépend de** : 012, 058, 059, 069
- **Agents** : les deux — rien ne dépend de l'agent.

## Pourquoi

L'utilisateur (2026-10-16) : aucune trace de ce qui change d'une version à l'autre ; la fenêtre du
`.dmg` est nue (deux icônes sur fond blanc) ; et sur son Mac, sans droits d'administrateur, il ne
peut installer que dans `~/Applications`, alors que le `.dmg` ne montre que `/Applications`, puis
il faut retirer la quarantaine à la main (`xattr`).

Décisions de l'utilisateur : nouveautés **seulement dans Réglages › À propos** (rien ne s'ouvre
tout seul) ; l'app **s'installe elle-même** (dans `~/Applications` sans droits d'administrateur).
Puis, sur la première version (2026-10-16) : fenêtre du `.dmg` peu soignée et texte coupé en bas ;
**choisir directement** entre « pour tous les utilisateurs » et « pour moi seulement ».
Un `.pkg` a été écarté : il demande d'ordinaire un mot de passe administrateur, et un certificat
« Developer ID Installer » (compte Apple payant) pour ne pas être bloqué.

## Critères d'acceptation

- [x] `CHANGELOG.md` en français, du point de vue de l'utilisateur (« Prochaine version », puis
      0.1.1) ; affiché dans Réglages › À propos, sous « Nouveautés » ; trouvé par la recherche des
      réglages. AGENTS.md dit quand le tenir à jour et comment le renommer à la publication.
- [x] Fenêtre du `.dmg` illustrée (Retina), rien de coupé : glisser sur Applications (pour tous
      les utilisateurs), ou, sans droits d'administrateur, double-cliquer sur Bobine.
- [x] Ouverte hors d'un dossier Applications (`.dmg`, Téléchargements), l'app demande où
      s'installer : **pour tous les utilisateurs** (`/Applications`, grisé avec la marche à suivre
      si on ne peut pas y écrire) ou **pour moi seulement** (`~/Applications`) ; coché d'office :
      là où elle est déjà installée, sinon le premier possible. Copie sans quarantaine, version
      déjà installée à la corbeille, relance depuis la copie, `.dmg` éjecté. « Plus tard » (cette
      fois), « Ne plus proposer » (retenu).
- [x] Rien proposé en développement, ni avec un dossier de données d'essai (`--user-data-dir`), sauf
      `BOBINE_INSTALL_ROOT` (racine imposée aux deux dossiers Applications, pour les essais).
- [x] Testé : unitaires (logique d'installation, bandeau, À propos), e2e `settings` et `base`,
      `pnpm e2e:packaged`, et essai réel depuis le vrai `.dmg`.

## Plan

1. `CHANGELOG.md` ; `SettingsDialog` (À propos) l'importe en `?raw` (`env.d.ts`) et le rend avec
   `Markdown` ; styles ; `settings-search.ts` ; AGENTS.md.
2. `build/background.svg` → `scripts/make-dmg-background.mjs` (rendu par Electron, comme l'icône) →
   `build/background.png` et `@2x` ; `electron-builder.yml` : positions, taille des icônes.
3. `src/main/self-install.ts` (+ test) : `SelfInstaller` (proposition, installation), entrées-sorties
   injectées ; `ejectDiskImage`. `index.ts` : `ditto --noqtn`, corbeille, `app.relaunch` (mêmes
   arguments, plus `--ejecter-volume`), marqueur `installation-refusee`. IPC `app:installOffer`,
   `app:install` (pour qui), `app:dismissInstall` ; fenêtre `InstallDialog` (+ test).
4. Doc : `docs/installation.md`, `docs/architecture.md`.

Aucune nouvelle dépendance.

## Journal

- 2026-10-27 — La fiche 153 / ADR-0034 remplace la fenêtre illustrée par un DMG simple pour
  supprimer le téléchargement de l’auxiliaire dmg-builder. L’app, le lien Applications et
  l’installation au choix par l’app restent disponibles. Les sources du fond illustré restent
  comme historique, mais ne sont plus utilisées dans la construction.
- 2026-10-16 — Fait.
  - **Nouveautés** : la section commence par l'icône et la version, puis « Nouveautés » (le titre
    du fichier et sa phrase d'introduction ne sont pas répétés). En route : une section des
    réglages s'ouvre maintenant par son début (avant, elle gardait le défilement de la précédente,
    ce qui cachait l'en-tête d'« À propos »).
  - **Fenêtre du `.dmg`** : bandeau « Installer Bobine », flèche, encadré « Pas les droits
    d'administrateur ? ». Fond clair : macOS écrit en noir le nom des icônes. dmg-builder assemble
    `background.png` et `@2x` en `.background.tiff` ; la fenêtre fait 640 × 420 (vérifié dans le
    Finder). Pas de capture automatique : le terminal n'a pas l'autorisation d'enregistrer l'écran.
  - **Installation** : bandeau dans la fenêtre plutôt que dialogue natif (ne bloque pas le
    démarrage, même style que l'app, cliquable dans les essais). Comparaison des chemins réels
    (`/var` → `/private/var`), sinon la copie relancée se proposait encore de s'installer (vu par
    l'essai réel). La copie garde la signature ad hoc ; l'app avait déjà été autorisée à s'ouvrir
    quand elle se copie sans quarantaine.
  - **Essai réel** (`.dmg` construit, monté en `/Volumes/Bobine 1`, dossier cible jetable) :
    bandeau proposé (« dossier Applications de votre dossier personnel »), copie, relance depuis la
    copie, sans quarantaine, `codesign --verify --deep --strict` valide, disque image éjecté, plus de
    bandeau une fois installée.
  - **Essais** : `verify` (117 fichiers, 697 tests), e2e `settings` et `base` (clair et sombre ;
    captures `85-a-propos` regardées), `pnpm e2e:packaged`. Un lancement de `settings` est resté
    bloqué 5 min sans démarrer (aucune vérification faite), puis a passé deux fois : noté.
  - **Non fait** : premier lancement depuis un `.dmg` téléchargé par un navigateur (quarantaine :
    macOS bloque avant que l'app ne tourne ; la doc dit de retirer la quarantaine du `.dmg`).
- 2026-10-16 — Reprise après retour de l'utilisateur (capture du `.dmg`).
  - **Texte coupé** : electron-builder donne à la fenêtre la taille de l'image **barre de titre
    comprise** (`dmg.window` est ignoré quand il y a une image de fond) : les ~31 points du bas
    étaient cachés. L'image fait maintenant 640 × 450 ; icônes et texte s'arrêtent à plus de 80
    points du bas.
  - **Nouveau fond** : dégradé crème, fils de la bobine en filigrane, halos sous les icônes, flèche
    en points de couture avec « Glissez sur Applications — pour tous les utilisateurs », pastille
    « Pas les droits d'administrateur ? Double-cliquez sur Bobine. » Plus de bandeau sombre ni de
    paragraphe. Jugé sur un aperçu qui pose les icônes comme le Finder (fond, icônes, barre de
    titre de 32 points), puis dans le vrai Finder (capture de la fenêtre du `.dmg` monté : rien de
    coupé).
  - **Choix pour qui** : un raccourci vers `~/Applications` dans le `.dmg` n'est pas possible (un
    lien pointe vers un chemin fixe, le même pour tous ; `~` n'y est pas compris). Un petit
    installeur en plus dans le `.dmg` a été écarté : deuxième app non signée, bloquée elle aussi
    par macOS. Le choix se fait donc dans l'app, au double-clic : le bandeau devient une fenêtre
    (`InstallDialog`) avec les deux choix. « Pour tous » sans droits d'écriture sur
    `/Applications` est grisé et renvoie au Finder (qui demande le mot de passe d'un
    administrateur) : l'app ne demande pas elle-même de mot de passe administrateur.
  - `BOBINE_INSTALL_DIR` devient `BOBINE_INSTALL_ROOT` : une racine pour les deux dossiers
    (`<racine>/Applications`, `<racine>/<dossier personnel>/Applications`).
  - **Essais** : `verify` (117 fichiers, 700 tests), e2e `base`, `pnpm e2e:packaged`, et essai réel
    depuis le `.dmg` construit (racine jetable) : fenêtre de choix, « pour tous » grisé et
    « pour moi » coché, captures claire et sombre regardées, copie sans quarantaine, signature
    intacte, relance depuis la copie, disque image éjecté, plus rien proposé ensuite.
