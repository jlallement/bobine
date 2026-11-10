# 065 — Installation hors ligne : Electron et AXe déjà sur la machine

- **Statut** : fait
- **Dépend de** : 012, 043, 058, 059
- **Agents** : aucun (installation de l'app)

## Pourquoi

Retour de l'utilisateur (2026-10-15) : sur un Mac au réseau verrouillé, le `.dmg` ne se télécharge
pas, et depuis le zip des sources il a fallu bricoler à la main. Le script d'installation
d'Electron n'a pas tourné, d'où ni `Electron.app` ni `path.txt` dans `node_modules/electron`, et
AXe était bloqué par l'attribut de quarantaine. L'utilisateur a pourtant récupéré Electron à côté
et a un AXe qui marche. L'app doit savoir s'en servir, et se construire sur place.

## Critères d'acceptation

- [x] `pnpm electron-local <archive .zip | Electron.app>` installe un Electron obtenu ailleurs :
      archive vérifiée par son empreinte SHA-256 (celles livrées avec le paquet `electron`),
      version vérifiée, extraite sans quarantaine (`ditto --noqtn`, rien à retirer), `path.txt`
      écrit. Mauvaise version ou empreinte : refusé, avec la raison.
- [x] Electron absent : `pnpm dev` / `pnpm preview` / `pnpm package` le disent tout de suite,
      avec le nom exact de l'archive à récupérer et la commande, au lieu d'une erreur obscure ; si
      pnpm ne lance aucun script d'installation (`ignore-scripts=true`, fréquent en entreprise),
      ils le disent aussi.
- [x] AXe extrait sans quarantaine même quand le zip des sources en portait une (archive recopiée
      sans ses attributs avant `tar`), toujours vérifié (SHA-256, signature). Un AXe qui marche
      déjà ailleurs : `BOB_AXE`, ou dans le `PATH`.
- [x] `pnpm package` construit l'app avec l'Electron de `node_modules` (`electronDist`) : rien à
      télécharger, l'app construite sur place n'est pas en quarantaine.
- [x] Doc : `docs/installation.md`, parcours « depuis le zip des sources, sans réseau ».
- [x] Testé : `electron-local` (archive valide, empreinte fausse, mauvaise version, `Electron.app`),
      `fetch-axe` sur une archive en quarantaine, `pnpm package --dir` sans téléchargement.

## Plan

1. `scripts/electron-local` (+ script `pnpm electron-local`) ; `scripts/check-electron` appelé par
   `predev`, `prepreview` et `scripts/package`.
2. `scripts/fetch-axe` : archive copiée par `cat` (sans attributs étendus) avant extraction.
3. `electron-builder.yml` : `electronDist: node_modules/electron/dist`.
4. Tests (`scripts/*.test.ts`, projet `node` de Vitest) ; doc.

Pas de nouvelle dépendance (`ditto`, `shasum` et `PlistBuddy` de macOS).

## Journal

- 2026-10-15 — Fait.
  - **Cause du script d'Electron sauté** : pas pnpm 10 (le projet exige pnpm 12, `engines` : pnpm 10
    refuse d'installer, vérifié), mais très probablement une configuration npm d'entreprise
    `ignore-scripts=true`, ou un téléchargement bloqué. `check-electron` (avant `pnpm dev`,
    `preview`, `package`) le dit, avec l'archive exacte, son adresse et la commande ; il signale
    `ignore-scripts=true` quand pnpm l'a.
  - `scripts/electron-local` : archive → empreinte comparée à `checksums.json` du paquet
    `electron`, recopiée par `cat` puis extraite par `ditto -x -k --noqtn` (le module natif de
    l'extracteur d'Electron peut être bloqué par une politique de l'entreprise : on s'en passe),
    version lue dans `dist/version` ; `Electron.app` → version de son `Info.plist`, copié par
    `ditto --noqtn`. Puis `dist/`, `electron.d.ts`, `path.txt` comme le script d'Electron.
  - **AXe** : `fetch-axe` copiait l'archive par `cp`, qui garde l'attribut de quarantaine, et
    `tar` le reportait sur chaque fichier. Vérifié : copie par `cp` → `axe` en quarantaine ;
    copie par `cat` → aucune. Le retrait par `xattr` reste en plus, mais n'est plus nécessaire.
  - `electron-builder.yml` : `electronDist: node_modules/electron/dist` — `pnpm package --dir`
    annonce « using custom unpacked Electron distribution », rien de téléchargé ;
    `pnpm e2e:packaged` vert (fenêtre, renderer isolé, agents trouvés, terminal, AXe embarqué).
  - Tests : `scripts/electron-local.test.ts` (projet `node` de Vitest, qui inclut maintenant
    `scripts/**/*.test.ts`) : absent → message ; archive en quarantaine → installée sans
    quarantaine ; empreinte fausse et mauvaise version → refusées ; `Electron.app` → installé avec
    avertissement. **Essai réel** : vraie archive Electron 44.7.0 (cache), mise en quarantaine,
    installée dans un paquet jetable, Electron lancé (`44.7.0`) ; archive d'AXe du dépôt mise en
    quarantaine, `fetch-axe --force` → `vendor/axe/axe` sans quarantaine, `--version` 1.8.0.
  - Doc : `docs/installation.md` (Electron sans accès à GitHub, AXe, « Construire l'app sur
    place »).
