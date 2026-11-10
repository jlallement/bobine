# 220 — Version 1.0.0-beta.1 (bêta publique)

- **Statut** : fait
- **Dépend de** : 059, 212, 213 à 219
- **Agents** : les deux.

## Pourquoi

Première bêta publique : le dépôt devient public (216 à 219 : nettoyage, licences, chemin de
préversion, README), et la bêta ouvre le point 16 de la barre V1 (fiche 187 : bêta de deux
semaines avec au moins cinq utilisateurs). Contenu depuis la 0.11.2 : règles d'approbation de Bob
(213 à 215), « projet indépendant » dans À propos (216), licences livrées avec l'app (217).

Décision du propriétaire : les notes de la Release GitHub sont en **anglais puis en français**
(le dépôt public est en anglais, l'app d'abord en français).

## Critères d'acceptation

- [x] Notes de Release FR/EN : `release.yml` (job `publish`) prend la section de la version dans
      `CHANGELOG.en.md` (« English ») puis dans `CHANGELOG.md` (« Français »), séparées par un
      trait ; une langue sans section est omise ; aucune des deux : `--generate-notes`. Extraction
      rejouée en local sur les vrais fichiers ; `actionlint` sans remarque.
- [x] Version `1.0.0-beta.1` dans `package.json` ; notes FR/EN datées du 10 novembre 2026, avec
      une ligne d'introduction « première bêta publique » (comme le README).
- [x] `./scripts/verify`, build et suite complète `pnpm e2e --if-needed` verts sur le commit de
      version ; capture `o2-nouveautes` (clair, sombre) regardée.
- [x] `pnpm package` et `pnpm e2e:packaged` (ad hoc) : `Bobine-1.0.0-beta.1-arm64.dmg`,
      Info.plist `CFBundleShortVersionString` = `1.0.0`, `CFBundleVersion` = `1.0.0-beta.1`,
      dossier `licenses` présent.
- [x] (Tech lead) Nouveau dépôt public, `main` poussé, tag `v1.0.0-beta.1`, workflow Release
      vert, Release marquée **préversion** (`gh release view v1.0.0-beta.1 --json isPrerelease`),
      `releases/latest` inchangé, notes FR/EN lisibles.
- [x] (Tech lead) DMG publié téléchargé, monté en lecture seule : version 1.0.0-beta.1, arm64,
      SHA-256 relevé.

## Plan

Même chemin que la 0.11.2 (fiche 212), avec le chemin de préversion de la fiche 218 :

1. `release.yml` : notes bilingues (checkout clairsemé des deux changelogs, même `awk` pour les
   deux : titres `## X.Y.Z — 10 novembre 2026` et `## X.Y.Z — November 10, 2026`).
2. Version : `package.json`, « Prochaine version » / « Next version » renommées (pas de section
   vide laissée derrière, comme aux versions précédentes).
3. Vérifications locales, puis publication par le tech lead.

## Journal

- 2026-11-10 — Fiche créée. Notes bilingues dans `release.yml` (`c5d7bde1`) ; version
  1.0.0-beta.1 (`32b23860`). Extraction rejouée sur les vrais changelogs : `v1.0.0-beta.1` →
  « English » puis « Français » ; `v0.11.2` → les deux sections ; `v9.9.9` → `--generate-notes`.
  `actionlint` : aucune remarque.
- 2026-11-10 — Sur `32b23860` : `./scripts/verify` vert (422 fichiers, 3 802 tests).
  `pnpm build && pnpm e2e --if-needed`, premier passage : 189/192 en 15 min 23 s — `history
  light` (infobulle, délai dépassé), `filles dark` (pointeur, propositions en rafale), `command
  dark` (presse-papiers, course connue) ; second passage complet : 192/192 en 14 min 53 s.
  Captures `o2-nouveautes` (clair, sombre) regardées : « 1.0.0-beta.1 · 10 novembre 2026 »,
  ligne d'introduction de la bêta, version de l'app « 1.0.0-beta.1 ».
- 2026-11-10 — `pnpm package` (ad hoc) : `Bobine-1.0.0-beta.1-arm64.dmg`, 146 241 755 octets ;
  Info.plist `CFBundleShortVersionString` = `1.0.0`, `CFBundleVersion` = `1.0.0-beta.1` ;
  `Resources/licenses` présent (LICENSE, NOTICE, THIRD-PARTY-NOTICES.md, electron, fonts) ;
  `codesign --verify --deep --strict` valide ; `pnpm e2e:packaged` vert.
- 2026-11-10 — Publication (tech lead). Dépôt public `jlallement/bobine` créé depuis l'instantané
  de `main` (arbre identique, gitleaks : aucune fuite) ; CI du premier push verte (`verify`
  Linux, gitleaks). Réglages : signalement privé des failles, secret scanning et push protection,
  alertes et correctifs Dependabot, approbation des workflows des contributeurs externes, jeton
  des workflows en lecture, règles « `main` protégée » (ni suppression ni push forcé) et « tags de
  version » (`v*` réservés aux administrateurs), description et topics. Tag `v1.0.0-beta.1` :
  workflow Release vert (run 42794342882 : garde, .dmg, publication ; Linux sauté). Release
  **préversion**, aucune « Latest » ; notes « English » puis « Français ». DMG publié téléchargé :
  `Bobine-1.0.0-beta.1-arm64.dmg`, 147 687 131 octets, SHA-256
  `5134d71131b3258bd12c47aa3aad23434f60619a1c768de1274a71ea961cab8b` ; `hdiutil verify` valide ;
  monté en lecture seule : `CFBundleShortVersionString` 1.0.0, `CFBundleVersion` 1.0.0-beta.1,
  arm64, `licenses/` présent, signature ad hoc valide. Reste : ouvrir le DMG publié sur un Mac
  (Gatekeeper, libellés du README) ; point 16 de la barre V1 (bêta de deux semaines).

## Écarts au plan

- Le dépôt public part d'un instantané en un seul commit (`2fc3d444`, adresse noreply) ; l'ancien
  dépôt, historique complet, devient `jlallement/bobine-private`. Avant de le créer, les fausses
  clés des tests ont été marquées `gitleaks:allow` dans le code (`3ae68e32` côté privé) : les
  empreintes de `.gitleaksignore` dépendent des commits et n'auraient plus valu.
- Publication Linux non activée : job sauté, comme prévu.
