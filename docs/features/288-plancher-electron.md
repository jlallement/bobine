# 288 — Plancher d'Electron : construire avec une archive un peu plus ancienne

- **Statut** : fait (1.2)
- **Dépend de** : 065, 217, ADR-0057
- **Agents** : aucun (installation et construction de l'app)

## Pourquoi

Constaté le 2026-11-26 sur le Mac du bureau de l'utilisateur : ni Electron ni le `.dmg` ne se
téléchargent. Il y dispose de l'archive officielle d'**Electron 45.2.3** ; le projet est fixé sur
**45.4.1** (correctifs de sécurité, ADR-0057) et `pnpm electron-local` refuse toute autre version.
Le 45.2.3 a été essayé sur le tag `v1.2.0-beta.3` : suite e2e complète verte (131/131), app
construite et `pnpm e2e:packaged` vert, mais au prix de modifications du dépôt (`package.json`,
lockfile, avis de licence régénérés).

Décision de l'utilisateur (2026-11-26) : **« Plancher tenu »** (ADR-0074) — une version minimale
d'Electron écrite dans le dépôt, une seule commande pour construire avec cette archive, et une
fumée de nuit rejouée sur ce plancher. Pas de version de Bobine ni de `.dmg` à part.

## Critères d'acceptation

- [x] Une seule source pour le plancher (`scripts/electron-floor.json` : version et empreintes
      SHA-256 officielles des archives macOS), lue par les scripts et par la CI. Deux versions
      acceptées, pas une plage : celle du projet (comportement inchangé) et le plancher.
- [x] `pnpm electron-local <archive>` accepte l'archive du plancher, empreinte vérifiée hors ligne
      contre celles du dépôt ; refuse, avec la raison, une autre version, une autre majeure, une
      empreinte fausse. Un `Electron.app` nu du plancher : accepté sur sa version, avec
      l'avertissement d'aujourd'hui.
- [x] Construire sur le plancher ne salit pas le dépôt (`git status` propre : ni `package.json`,
      ni lockfile, ni `THIRD-PARTY-NOTICES.md`) et ne télécharge rien de plus qu'une construction
      normale.
- [x] L'app construite sur le plancher embarque des avis de licence qui nomment l'Electron
      réellement livré ; `third-party-notices --check` reste strict pour la version fixée.
- [x] `check-electron` et `pnpm package` disent que l'Electron installé est le plancher et qu'une
      app construite dessus n'a pas les correctifs de sécurité de la version fixée.
- [x] Fumée sur le plancher sur un Mac de GitHub (`electron-floor.yml`, chaque nuit sur `1.2` et
      à la main) : plancher installé par la commande de l'utilisateur, journées `parcours-*`
      (fumée, ADR-0069), `pnpm package --dir`, `pnpm e2e:packaged`. Rien d'ajouté à la CI des
      pull requests. (Pas encore jouée sur GitHub à la clôture.)
- [x] Essais : `scripts/electron-local.test.ts` (plancher accepté, sous le plancher refusé, autre
      majeure refusée, empreinte fausse refusée, version fixée inchangée), cohérence du plancher
      avec `package.json`, avis de licence du plancher, configuration de construction.
- [x] Essai réel du parcours de l'utilisateur dans une copie des sources avec la vraie archive
      45.2.3 : `pnpm package --dir`, `pnpm e2e:packaged` vert, framework en 45.2.3, `git status`
      propre. Construction normale (45.4.1) inchangée : `pnpm package --dir` + `pnpm e2e:packaged`.
- [x] Docs : ADR-0074, `docs/installation.md`, `AGENTS.md`, nouveautés.

## Plan

1. **Source unique** : `scripts/electron-floor.json` (`version`, `checksums` des deux archives
   `darwin-arm64` et `darwin-x64`, recopiées du `SHASUMS256.txt` publié par Electron ; celle
   d'arm64 recoupée avec l'archive du cache local). `scripts/electron-floor.mts` : lecture, statut
   d'une version (`project` / `floor` / refusée avec la raison), sous-commandes pour les scripts
   bash (`version`, `checksum`, `status`, `notices`, `builder-config`). Test de cohérence :
   même majeure que `package.json`, strictement plus ancien, noms et empreintes bien formés.
2. **`scripts/electron-local`** : version annoncée par l'archive (`version`, lue sans extraire) ;
   version du projet → empreinte de `checksums.json` du paquet (inchangé) ; plancher → empreinte
   du dépôt ; autre → refusée (autre majeure ou version non acceptée). Après extraction, la
   version est revérifiée (inchangé). `Electron.app` : version du projet ou du plancher.
3. **`scripts/check-electron`** : Electron installé ; si `dist/version` est le plancher, un
   avertissement (pas les correctifs de la version fixée) ; ni l'un ni l'autre : refus, avec quoi
   faire. Version du projet : rien ne change.
4. **`scripts/package` (macOS)** : si l'Electron installé est le plancher, avertissement, avis de
   licence pour cet Electron écrits dans un dossier temporaire (jamais dans le dépôt), et
   configuration d'electron-builder temporaire (celle du dépôt, l'entrée de
   `THIRD-PARTY-NOTICES.md` remplacée) + `-c.electronVersion=<plancher>`. `--check` inchangé et
   toujours lancé. Construction normale : aucune option ajoutée.
5. **Avis de licence** : `noticesFor` accepte la version d'Electron réellement livrée (texte de
   licence MIT du paquet, identique à celui de l'archive) ; `e2e/packaged.mjs` lit la version du
   framework de l'app : version fixée → avis égaux à ceux du dépôt (inchangé) ; plancher → avis
   égaux à ceux générés pour le plancher, et nommant 45.2.3 ; autre → échec.
6. **CI** : `.github/workflows/electron-floor.yml` (`workflow_dispatch`), Mac de GitHub.
7. **Docs** : ADR-0074 (+ index), `docs/installation.md`, `AGENTS.md`, `CHANGELOG*.md`, index des
   fiches.

À vérifier par l'expérience avant de choisir (point 4) : garder le paquet npm `electron@45.4.1`
avec un `dist/` en 45.2.3 est-il sain ? (version lue par electron-builder, `Info.plist`, fuses,
typages `electron.d.ts`).

Pas de nouvelle dépendance (`yaml`, déjà là, pour la configuration temporaire ; `unzip`,
`shasum`, `ditto`, `PlistBuddy` de macOS).

## Journal

- 2026-11-26 — Fiche et plan.
- 2026-11-26 — Fait (branche `1.2-electron-plancher`).
  - **Paquet npm 45.4.1 + `dist/` 45.2.3 : sain, vérifié.** electron-builder lit la version dans
    `node_modules/electron/package.json` (sauf `electronVersion` de la configuration) ; sous macOS,
    avec `electronDist` et `npmRebuild: false`, elle ne sert qu'aux journaux (pas de téléchargement,
    pas de recompilation, fuses posés sur le binaire quelle que soit la version). On passe quand
    même `-c.electronVersion=45.2.3` : le journal dit `electron=45.2.3`. App construite :
    framework `CFBundleVersion` 45.2.3, `CFBundleShortVersionString` de l'app inchangé (1.2.0),
    fuses lus sur l'app identiques à ceux d'une construction normale, `codesign --verify --deep
    --strict` ok. L'archive ne contient pas `electron.d.ts` : les typages restent ceux de 45.4.1
    (réserve écrite dans l'ADR-0074 : une API apparue après 45.2.3 passerait `typecheck`, seule la
    fumée sur le plancher la verrait).
  - **Rien de plus téléchargé** : dans la copie d'essai, `pnpm install --frozen-lockfile
    --offline` passe ; `electron-local` lit l'archive locale ; `pnpm package` prend Electron dans
    `node_modules` (« using custom unpacked Electron distribution ») et AXe dans
    `vendor/archives/`.
  - **Avis de licence** : `noticesFor(root, inventaire, electronLivré)` ; même texte MIT (celui
    du paquet npm, identique octet pour octet au `LICENSE` de l'archive 45.2.3), version de
    l'Electron livré. `pnpm package` sur le plancher les écrit dans un dossier temporaire et passe
    à electron-builder une configuration temporaire (celle du dépôt, seule l'entrée
    `THIRD-PARTY-NOTICES.md` changée) ; `--check` tourne toujours, contre la version fixée.
    `e2e/packaged.mjs` vérifie désormais dans tous les cas que l'avis livré nomme l'Electron du
    framework de l'app, puis : version fixée → fichier du dépôt (inchangé) ; plancher → avis
    régénérés pour le plancher ; autre → échec.
  - **Écarts au plan** : empreintes du plancher pour `darwin-arm64` et `darwin-x64` seulement
    (`electron-local` est propre à macOS ; Windows prend ses archives par `package-win.mts`, Linux
    n'a pas de chemin hors ligne). `check-electron` refuse maintenant un `dist/` d'une troisième
    version (avant : accepté sans rien dire) ; la version du projet, et un `dist/` sans fichier
    `version`, passent comme avant. Fumée de la CI : `startup`, `about` et les journées
    `parcours-*` sauf `parcours-outils` (navigateur intégré instable sur la VM Mac, indicative
    dans `e2e.yml`).
  - **Preuves** (2026-11-26) : `./scripts/verify` 0 ; `pnpm build && pnpm e2e --changed` 0
    (237 tâches, suite complète clair et sombre, 10 min) ; normal : `pnpm package --dir` 0,
    framework 45.4.1, avis livrés = fichier du dépôt, `pnpm e2e:packaged` 0. Copie `git archive`
    (dépôt git initialisé) avec l'archive 45.2.3 du cache (sha256 `4d7c4290…f55f`, celle du
    `SHASUMS256.txt` officiel) : `pnpm install --frozen-lockfile --offline` 0,
    `pnpm electron-local` 0, `pnpm package --dir` 0, framework 45.2.3, `pnpm e2e:packaged` 0,
    fumée de la CI (`startup about parcours-*` sauf outils) 9/9, `pnpm package` (.dmg) 0,
    `git status --porcelain` vide après tout cela. Archives réelles 45.3.4 et 45.0.0 refusées.
  - **Nuit** : `schedule` ne part que de la branche par défaut (`main`) ; aujourd'hui la ligne `1.2`
    n'a **aucune** suite de nuit (`e2e.yml` de nuit joue `main`). `electron-floor.yml` est
    lançable à la main sur `1.2`. Choix restant (Jérôme) : voir « Reste à faire ».

- 2026-11-26 — Nuit. Après la poussée de la branche, `gh workflow run electron-floor.yml --ref
  1.2-electron-plancher` répond « HTTP 404: workflow electron-floor.yml not found on the default
  branch » : même lancé à la main, un workflow doit exister sur `main`. Choix de Jérôme
  (2026-11-26) : **« Workflow seul sur main »**. Un seul fichier, identique octet pour octet sur
  `main` (commit qui n'ajoute que lui, branche `ci/electron-floor-nuit`) et sur `1.2` :
  `schedule` à 05:43 UTC (après la nuit d'`e2e.yml` à 03:17 et ses 90 min au plus sur le Mac,
  hors heure pile) et `workflow_dispatch` ; `checkout` sur `1.2` la nuit (en dur : `schedule` ne
  part que de `main`, et la ligne 1.2 n'y est jamais fusionnée, ADR-0073), sinon sur la branche
  choisie ; sans `scripts/electron-floor.json` (cas de `main`), arrêt immédiat qui le dit.
  L'ADR-0074 (« choix laissé ouvert dans la fiche 288 ») n'est pas modifié : il renvoie à cette
  fiche, qui porte la réponse.

## Reste à faire

- Fusionner `1.2-electron-plancher` dans `1.2` : d'ici là, la nuit (qui joue `1.2`) s'arrête à
  l'étape « Plancher défini sur cette branche ».
- Première exécution de `electron-floor.yml` sur GitHub, puis cocher dans le journal.
- Quand la 1.2 deviendra `main` : retirer la branche `1.2` en dur du `checkout` de la nuit.
