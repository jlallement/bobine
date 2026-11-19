# 252 — rc-D, chaîne d'approvisionnement : Electron, SDK ACP figé, politique de montée de version

- **Statut** : en cours
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

- [ ] Electron monté à la plus récente 45.x autorisée par le délai `minimumReleaseAge` de pnpm ;
      `pnpm build`, `./scripts/verify`, `pnpm package`, `pnpm e2e:packaged` et
      `pnpm third-party-notices --check` verts.
- [ ] `@agentclientprotocol/sdk` en version exacte `2.7.0` (pas de montée en 2.8).
- [ ] ADR-0057 « politique de montée de version », statut proposé, dans l'index.
- [ ] `.nvmrc` à 24 ; `ubuntu:24.04` épinglée par digest ; Dependabot suit l'écosystème `docker`.
- [ ] Une ligne dans les deux journaux des nouveautés.

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
| `electron` | 45.3.3 | **45.3.4** | voir ci-dessous ; 45.4.1 refusée par le délai de pnpm jusqu'au 2026-11-20 02 h 04 UTC |
| `@agentclientprotocol/sdk` | `^2.7.0` (2.7.0) | **`2.7.0` exact** | même version installée ; 2.8.0 non prise |

## Journal

- 2026-11-19 : fiche créée ; départ de `2918018`, branche `rc/d-chaine` (worktree
  `bobine-oss-rc-d`).
