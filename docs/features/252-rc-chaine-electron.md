# 252 — rc-D, chaîne d'approvisionnement : Electron, SDK ACP figé, politique de montée de version

- **Statut** : fait (B7 levé le 2026-11-19 : Electron 45.4.1 par l'exception de l'ADR-0057,
  à retirer après le 2026-11-20 02 h 04 UTC)
- **Dépend de** : 233 (lot 2, Electron 45.3.3, SDK 2.7), 231 (lot 1), 169 (précédente exception au
  délai de pnpm), 217 (avis de licence), 218 (Dependabot) ; audit du 2026-11-19 (B7, LCM-1, 3, 6,
  10, 11)
- **Agents** : les deux (aucun code propre à un agent)

## Pourquoi

L'audit avant la 1.0.0-rc.1 bloque sur Electron (B7 / LCM-1 : 45.3.3 a des correctifs de retard,
la 45.4.1 du 2026-11-19 reprend des correctifs Chromium et V8) ; sans mise à jour automatique, le
binaire de la rc vivra longtemps chez les testeurs. Il demande aussi de figer le SDK ACP pendant la
rc (LCM-6), d'écrire la politique de montée de version (LCM-3) et d'épingler `node` et l'image
Docker des essais Linux (LCM-10/11).

## Critères d'acceptation

- [x] Electron monté à la plus récente 45.x autorisée par le délai `minimumReleaseAge` de pnpm
      (45.3.4) ; `pnpm build`, `./scripts/verify`, `pnpm package`, `pnpm e2e:packaged` et
      `pnpm third-party-notices --check` verts.
- [x] B7 levé : Electron 45.4.1 (correctifs Chromium/V8), par l'exception de l'ADR-0057.
- [x] `@agentclientprotocol/sdk` en version exacte `2.7.0` (pas de montée en 2.8).
- [x] ADR-0057 « politique de montée de version », statut proposé, dans l'index.
- [x] `.nvmrc` à 24 ; `ubuntu:24.04` épinglée par digest ; Dependabot suit l'écosystème `docker`.
- [x] Une ligne dans les deux journaux des nouveautés.

## Plan

Fichiers touchés : `package.json`, `pnpm-lock.yaml`, `scripts/third-party/inventory.json`,
`THIRD-PARTY-NOTICES.md` (régénérés), `.nvmrc` (nouveau), `docker/e2e-linux/Dockerfile`,
`.github/dependabot.yml`, `docs/adr/0057-…`, `docs/adr/README.md`, `CHANGELOG.md`,
`CHANGELOG.en.md`, cette fiche et l'index. Hors périmètre : `electron-builder.yml`, `e2e.yml`,
`release.yml` (lots A et B).

1. **Electron** : `pnpm add -D electron@<version>` ; relire les notes de version ; binaire relu
   (Chromium, Node) ; `pnpm build`, `verify`, `pnpm package`, `pnpm e2e:packaged`, avis de licence.
2. **SDK ACP** : `"2.7.0"` exact dans `package.json`, verrou inchangé.
3. **ADR-0057**.
4. **`.nvmrc`, Dockerfile, Dependabot**.
5. Journaux des nouveautés, fiche, index.

Aucune nouvelle dépendance. Changements de version listés ci-dessous.

### Décision sur la version d'Electron (délai de pnpm)

pnpm 12 refuse une version publiée depuis moins d'un jour (`minimumReleaseAge`, réglage par
défaut ; rien dans `pnpm-workspace.yaml`). Aucune règle écrite ne prévoit d'exception pour un
correctif de sécurité : la fiche 169 en a gardé une pour Electron 45.2.3 (posée d'elle-même par
pnpm, consigne de ce lot-là), la fiche 221 pose « pas d'exception pour une montée de dépendance ».
La 45.4.1 est publiée sur npm le 2026-11-19 à 02 h 04 UTC : refusée jusqu'au 2026-11-20 à 02 h 04
UTC. Consigne du lot : sans règle, la plus récente autorisée, **45.3.4** (2026-11-17). Elle ne porte
**pas** les correctifs Chromium/V8 : B7 reste ouvert jusqu'à la montée en 45.4.1 (voir Reste).
L'ADR-0057 propose la règle qui manquait.

## Versions

| Paquet | Avant | Après | Note |
|---|---|---|---|
| `electron` | 45.3.3 | **45.3.4** puis **45.4.1** | voir ci-dessous ; 45.4.1 prise avant la fin du délai de pnpm par l'exception de l'ADR-0057 |
| `@agentclientprotocol/sdk` | `^2.7.0` (2.7.0) | **`2.7.0` exact** | même version installée ; 2.8.0 non prise |

`pnpm add` écrit la version exacte : `electron` passe aussi de `^45.3.3` à `45.3.4`, ce qui va
dans le sens du gel pendant la rc. Verrou : seuls Electron et les deux spécificateurs changent.

## Electron 45.3.4 et 45.4.1

Notes relues (GitHub, `electron/electron`) :

- **45.3.4** (npm, 2026-11-17) : un élément cliqué du bouton droit restait vivant après son
  retrait (fuite). Binaire relu : **Chromium 156.0.8078.100, Node 24.22.3**, comme 45.3.3 ; **aucun
  correctif de sécurité**.
- **45.4.1** (npm, 2026-11-19 02 h 04 UTC ; pas de 45.4.0) : correctifs rétroportés d'ANGLE,
  Chromium, Dawn, FFmpeg, PDFium et V8. C'est elle que B7 demande. Binaire relu
  (`ELECTRON_RUN_AS_NODE` sur le binaire d'origine de `node_modules`, pas sur l'app) :
  **Chromium 156.0.8078.100, Node 24.22.3, V8 15.6.75.57-electron** : numéros inchangés, les
  correctifs sont des rétroportages.

## SDK ACP 2.8.0 (non prise)

Publiée le 2026-11-18 : schéma 1.33.0 (et 2.0.0-alpha.17) ; correctif « notifications reçues
avant que le pair ferme son flux » désormais distribuées ; les aides du protocole sortent du paquet
du validateur. À reprendre après la version finale (ADR-0057, point 4), avec le recensement du
schéma 1.33 comme à la fiche 233.

## `.nvmrc`, image Docker, Dependabot

- `.nvmrc` : `24` (Node d'Electron 45 ; `engines.node` dit déjà `>=24`).
- `docker/e2e-linux/Dockerfile` : `ubuntu:24.04@sha256:73b9993…c4d6a8`, digest de l'index
  multi-architecture relevé par `docker buildx imagetools inspect ubuntu:24.04` le 2026-11-19.
  Image non reconstruite ici (`pnpm e2e:linux` non lancé).
- `.github/dependabot.yml` : écosystème `docker` sur `/docker/e2e-linux`, hebdomadaire ; une autre
  version d'Ubuntu (mineure ou majeure) ignorée : seule la mise à jour du digest est proposée.

## Suites à faire

- [x] **Retirer l'exception** `minimumReleaseAgeExclude: [electron@45.4.1]` de
      `pnpm-workspace.yaml` après le 2026-11-20 02 h 04 UTC (ADR-0057, point 2), puis
      `pnpm install` : verrou inchangé. Fait le 2026-11-21 (fiche 273).

## Journal

- 2026-11-19 : fiche créée ; départ de `2918018`, branche `rc/d-chaine` (worktree
  `bobine-oss-rc-d`).
  - Electron 45.3.4 et SDK 2.7.0 exact (un commit), ADR-0057, `.nvmrc` / Docker / Dependabot.
  - `pnpm third-party-notices` écrit `inventory.json` hors du format de Prettier : reformaté par
    `prettier --write` (seule la ligne d'Electron change), puis `--check` vert.
  - `./scripts/verify` : code 0 (523 fichiers, 4908 essais). `pnpm package` : code 0 (avis de
    licence vérifiés contre le build, DMG vérifié). `pnpm e2e:packaged` : code 0.
  - `pnpm build && pnpm e2e --changed` (le verrou et `package.json` = suite complète, 218 tâches,
    21 min 46 s) : **217/218**. Échec : `commit-redige` sombre, « délai dépassé puis Arrêter :
    aucun agent de rédaction ne survit » avec **un seul** PID relevé sur deux attendus (le second
    agent de rédaction pas encore relevé 500 ms après « Réessayer », sous trois jobs en
    parallèle) ; clair vert dans la même campagne ; `pnpm e2e commit-redige` relancée trois fois
    seule : 6/6 vert. Fragilité de l'essai de la fiche 246, sans lien avec Electron ; non corrigée
    ici (hors périmètre), à reprendre.
  - Incident : en relisant la version d'Electron du `.app` construit avec `ELECTRON_RUN_AS_NODE`
    (refusé par les fusibles, c'est voulu), l'app s'est lancée **sur le profil réel**
    (`~/Library/Application Support/bobine`) environ 3 minutes, sans action dans l'interface ;
    arrêtée par son PID (SIGTERM ignoré, puis SIGKILL). Version relue dans son journal :
    « Electron 45.3.4 ». Pour relire un binaire packagé : `Info.plist`, jamais le lancer.
  - **Reste (B7)** : à partir du 2026-11-20 02 h 04 UTC, `pnpm add -D electron@45.4.1` (aucune
    exception au délai), `./scripts/check-electron`, binaire relu, `pnpm build`,
    `pnpm third-party-notices` + `prettier --write scripts/third-party/inventory.json`, `verify`,
    `pnpm package`, `pnpm e2e:packaged`, suite complète ; remplacer la ligne des nouveautés par
    « correctifs de sécurité de Chromium et de V8 ».
- 2026-11-19 : **B7 levé** sur décision de Jérôme : Electron 45.4.1 tout de suite, sans attendre
  la fin du délai de pnpm, par l'exception de l'ADR-0057 (point 2 : correctif de sécurité
  Chromium/V8, version exacte, commentée, retirée dès le délai écoulé). Branche
  `rc/g-electron-45-4-1` (worktree `bobine-oss-rc-g`), départ de `2a2301d`.
  - `pnpm-workspace.yaml` : `minimumReleaseAgeExclude: [electron@45.4.1]` (forme `nom@version`
    acceptée par pnpm 12 : l'exception ne couvre que cette version), commentée, **à retirer après
    le 2026-11-20 02 h 04 UTC** (voir Suites à faire).
  - `pnpm add -D electron@45.4.1` : seules les lignes d'Electron changent dans le verrou ;
    `./scripts/check-electron` télécharge le binaire ; Chromium 156.0.8078.100, Node 24.22.3.
  - Avis de licence régénérés, `inventory.json` repassé par Prettier (seule la ligne d'Electron
    change), `--check` : code 0. Nouveautés : la ligne d'Electron dit 45.4.1 et les correctifs de
    sécurité de Chromium et de V8.
  - `./scripts/verify` : code 0 (526 fichiers, 4957 essais). `pnpm build` : code 0.
    `pnpm package` : code 0 (avis vérifiés contre le build, DMG vérifié ; `Info.plist` du
    framework : 45.4.1). `pnpm e2e:packaged` : code 0.
  - Suite e2e complète non lancée ici : à la charge du tech lead.
