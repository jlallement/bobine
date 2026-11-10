# 218 — Publier une préversion (1.0.0-beta.1) depuis un dépôt public

- **Statut** : fait (sauf l'essai réel du workflow Release, au premier tag)
- **Dépend de** : 059, 105, 111, 145
- **Agents** : aucun (générique)

## Pourquoi

La prochaine version sera la **1.0.0-beta.1**, une bêta publique, et le dépôt devient public.
L'audit d'ouverture a relevé que le chemin de publication refusait un numéro de préversion
(`verify` cassé par le titre `## 1.0.0-beta.1 — date`, Release marquée « Latest », Info.plist au
format non Apple, comparaison de versions qui ignore le suffixe), et que les workflows n'étaient
pas prêts pour un dépôt public (jeton en écriture pour tout le job, actions non épinglées, entrée
interpolée dans un `run:`, base gitleaks périmée).

## Critères d'acceptation

- [x] Réglages › Nouveautés et ses tests acceptent un titre `## 1.0.0-beta.1 — date` (et `-rc.2`) ;
      `verify` passe avec un tel titre en tête des deux changelogs.
- [x] Un tag `vX.Y.Z-suffixe` crée une Release **préversion**, jamais « Latest » ; un tag
      `vX.Y.Z` reste une Release normale.
- [x] App macOS d'une préversion : `CFBundleShortVersionString` = `1.0.0` (trois entiers),
      `CFBundleVersion` et `app.getVersion()` = `1.0.0-beta.1`.
- [x] Ordre semver des versions de l'app : `1.0.0-beta.1 < 1.0.0-beta.2 < 1.0.0` (marque du
      profil), testé.
- [x] `release.yml` : jeton en lecture partout sauf le job `publish` ; `persist-credentials:
      false` ; une Release ne part que d'un commit de `main`.
- [x] Actions tierces épinglées par SHA complet (commentaire `# vX.Y.Z`) dans tous les workflows ;
      `.github/dependabot.yml` (npm, github-actions ; hebdomadaire, groupé).
- [x] `e2e.yml` : `inputs.suites` passe par `env:`, validé.
- [x] `gitleaks` sur tout l'historique : 0 alerte (empreintes factices dans `.gitleaksignore`) ;
      job gitleaks dans `ci.yml`.
- [x] `SECURITY.md` : pendant la bêta, la dernière préversion est la version suivie.
- [x] `actionlint` sans erreur sur les workflows.

## Plan

Fichiers :

1. **Nouveautés** — `AboutSettings.tsx` : `parseChangelog(texte)` pure (le découpage existant,
   qui accepte déjà `1.0.0-beta.1 — date`), `changelogVersions` l'utilise ; tests dans
   `SettingsDialog.test.tsx` (titre de préversion, regex des titres réels élargies au suffixe
   semver, comparaison FR/EN version pour version, suffixe compris).
2. **Ordre des versions** — l'ordre semver d'`agent/agent-version.ts` (déjà juste : préversion
   avant finale, identifiants numériques comparés en nombres) déplacé dans `src/main/semver.ts`,
   ré-exporté par `agent-version.ts` ; `profile-format.ts › compareVersions` s'en sert (texte
   illisible : égal, comme avant). AXe (`simulator/axe.ts`) : versions `x.y.z` d'un outil, sans
   préversion, laissé tel quel. Pas de nouvelle dépendance.
3. **Info.plist** — `scripts/package` passe `-c.mac.bundleShortVersion=<X.Y.Z>` (partie numérique
   de la version) à electron-builder ; `CFBundleVersion` reste la version complète (défaut
   d'electron-builder : `bundleVersion` ← `buildVersion` ← `version`), `app.getVersion()` lit
   `package.json` (Electron). Version finale : rien ne change.
4. **`release.yml`** — `permissions: contents: read` en tête ; job `guard` (Ubuntu) : tag ↔
   `package.json` (déplacé) et commit tagué sur `origin/main` (`git merge-base --is-ancestor`) ;
   `dmg` et `linux` construisent et déposent leurs fichiers en artefacts (7 jours), sans jeton en
   écriture ; job `publish` (`contents: write`, seulement au tag) : télécharge les artefacts,
   notes tirées de `CHANGELOG.md`, `gh release create` avec `--prerelease --latest=false` si la
   version a un suffixe. Linux ne dépend plus du `.dmg` (en parallèle). `persist-credentials:
   false` partout.
5. **Épinglage** — `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`,
   `actions/download-artifact`, `pnpm/action-setup` : SHA de la version que résout aujourd'hui
   l'étiquette `v4` (comportement inchangé ; Dependabot proposera les versions majeures).
6. **Dependabot** — `.github/dependabot.yml`.
7. **`e2e.yml`** — `SUITES` en `env:`, refus de tout caractère hors `[a-z0-9 -]`.
8. **gitleaks** — `.gitleaksignore` (10 empreintes factices relevées par l'audit) ; job `secrets`
   dans `ci.yml` : binaire gitleaks 8.30.1 officiel, SHA-256 vérifié, historique complet (pas
   l'action `gitleaks-action` : licence exigée pour les organisations, et un binaire suffit).
9. **Docs** — `SECURITY.md`, fiche 059 (procédure : préversion, `main` poussé avant le tag),
   `AGENTS.md` (ligne « Publier une version »), index des fiches.

## Journal

- 2026-11-10 — Fiche créée, plan écrit.
- 2026-11-10 — Fait (branche de travail, rien poussé). Vérifications :
  - `./scripts/verify` vert (421 fichiers, 3 787 tests). Avec les titres des deux changelogs
    renommés `1.0.0-beta.1 — …` (essai, non gardé) : tests de Nouveautés verts ; extraction des
    notes par l'`awk` de `release.yml` : section de la bêta trouvée, rien pour `1.0.0`.
  - `pnpm package` avec `package.json` en `1.0.0-beta.1` (essai, non gardé) :
    `Bobine-1.0.0-beta.1-arm64.dmg`, Info.plist `CFBundleShortVersionString` = `1.0.0`,
    `CFBundleVersion` = `1.0.0-beta.1`, `package.json` de l'asar en `1.0.0-beta.1`,
    `codesign --verify --deep --strict` valide ; `pnpm e2e:packaged` vert.
  - `pnpm build && pnpm e2e --changed` dans le même état (tout, `package.json` touché) :
    191/192 en 15 min 28 s ; seul échec `command light`, presse-papiers écrit au même moment par
    « Copier les infos techniques » de la suite `about` (jobs parallèles) ; `pnpm e2e command
    about` relancé seul : 4/4. Capture `o2-nouveautes` (clair, sombre) regardée : « 1.0.0-beta.1 »
    et sa date séparés, version de l'app « 1.0.0-beta.1 ».
  - `actionlint` 1.7.12 (avec shellcheck) : aucune remarque sur les quatre workflows.
  - `gitleaks detect --log-opts=--all` (8.30.1) : 814 commits, aucune fuite (10 alertes avant
    `.gitleaksignore`, toutes relues : valeurs factices des tests).
  - SHA des actions résolus par `gh api …/git/ref/tags/…` : l'étiquette `v4` de `checkout`,
    `setup-node`, `upload-artifact`, `download-artifact` pointe sur le même commit que
    `v4.4.0`, `v4.4.0`, `v4.6.2`, `v4.3.0` ; `pnpm/action-setup` : étiquettes annotées
    déréférencées, `v4` = `v4.3.0` (`b906aff`), pas `v4.4.0` (qui passe à Node 24) — épinglé sur
    `v4.3.0` pour ne rien changer.

- 2026-11-10 — Première passe de Dependabot sur le dépôt public (10 PR). Fusionnées : actions
  `checkout` 7, `setup-node` 7, `upload-artifact` 7, `download-artifact` 8, `pnpm/action-setup` 6
  (CI verte ; `release.yml` pas encore rejoué avec elles : à surveiller au prochain tag),
  `react-i18next` 17.1.13, `lucide-react` 1.70.0 et `vite` 8.3.6 (avis de licence régénérés et
  poussés sur la PR, puis `verify` ; e2e `base` et `startup` pour vite). Fermée : `@types/node` 26
  (Electron 45 embarque Node 24) — majeures de `@types/node` ignorées dans `dependabot.yml`.
  Laissées ouvertes : `i18next` 27 (typage de `t()` cassé, à monter avec `react-i18next` 18) et
  `jsdom` 31 (trois tests du pilote, clic par libellé). Le générateur d'avis écrit
  `inventory.json` sans le format de Prettier : passer `prettier --write` après lui.

## Écarts au plan

- Le contrôle tag ↔ `package.json` a quitté le job `dmg` pour `guard` (Ubuntu, avant le Mac).
- `release.yml` vérifie aussi Info.plist après la construction (`test` sur les deux clés).
- Pas de ligne au CHANGELOG : rien ne change dans l'app pour l'utilisateur.

## Reste à faire / à vérifier

- **Non vérifié en vrai** : le workflow Release lui-même (jobs `guard` et `publish`, artefacts,
  `gh release create --prerelease --latest=false --verify-tag`) ne tournera qu'au premier tag.
  Conseil : un lancement à la main (onglet Actions) avant le tag vérifie `guard`, `dmg` et les
  artefacts ; `publish` ne se voit qu'au tag. Après la Release : `gh release view
  v1.0.0-beta.1 --json isPrerelease`, et `releases/latest` toujours sur 0.11.2.
- Dependabot npm avec pnpm 12 : prise en charge du lockfile à confirmer à la première passe.
- ~~Notes de Release toujours en français (`CHANGELOG.md`) ; anglais ou les deux : décision.~~
  Décidé : anglais puis français (fiche 220).
- Réglages GitHub (jour J, propriétaire) : rulesets `main` et tags `v*`, signalement privé,
  secret scanning, approbation des workflows de forks, actions autorisées / `sha_pinning_required`.
- Paquet `.deb` d'une préversion (`1.0.0~beta.1`) si Linux est publié pendant la bêta.
