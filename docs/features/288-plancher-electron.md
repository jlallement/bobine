# 288 — Plancher d'Electron : construire avec une archive un peu plus ancienne

- **Statut** : en cours (1.2)
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

- [ ] Une seule source pour le plancher (`scripts/electron-floor.json` : version et empreintes
      SHA-256 officielles des archives macOS), lue par les scripts et par la CI. Deux versions
      acceptées, pas une plage : celle du projet (comportement inchangé) et le plancher.
- [ ] `pnpm electron-local <archive>` accepte l'archive du plancher, empreinte vérifiée hors ligne
      contre celles du dépôt ; refuse, avec la raison, une autre version, une autre majeure, une
      empreinte fausse. Un `Electron.app` nu du plancher : accepté sur sa version, avec
      l'avertissement d'aujourd'hui.
- [ ] Construire sur le plancher ne salit pas le dépôt (`git status` propre : ni `package.json`,
      ni lockfile, ni `THIRD-PARTY-NOTICES.md`) et ne télécharge rien de plus qu'une construction
      normale.
- [ ] L'app construite sur le plancher embarque des avis de licence qui nomment l'Electron
      réellement livré ; `third-party-notices --check` reste strict pour la version fixée.
- [ ] `check-electron` et `pnpm package` disent que l'Electron installé est le plancher et qu'une
      app construite dessus n'a pas les correctifs de sécurité de la version fixée.
- [ ] Fumée sur le plancher sur un Mac de GitHub (`electron-floor.yml`, lançable à la main) :
      plancher installé par la commande de l'utilisateur, journées `parcours-*` (fumée, ADR-0069),
      `pnpm package --dir`, `pnpm e2e:packaged`. Rien d'ajouté à la CI des pull requests.
- [ ] Essais : `scripts/electron-local.test.ts` (plancher accepté, sous le plancher refusé, autre
      majeure refusée, empreinte fausse refusée, version fixée inchangée), cohérence du plancher
      avec `package.json`, avis de licence du plancher, configuration de construction.
- [ ] Essai réel du parcours de l'utilisateur dans une copie des sources avec la vraie archive
      45.2.3 : `pnpm package --dir`, `pnpm e2e:packaged` vert, framework en 45.2.3, `git status`
      propre. Construction normale (45.4.1) inchangée : `pnpm package --dir` + `pnpm e2e:packaged`.
- [ ] Docs : ADR-0074, `docs/installation.md`, `AGENTS.md`, nouveautés.

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
