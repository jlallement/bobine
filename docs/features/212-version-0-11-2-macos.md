# 212 — Version 0.11.2 macOS

- **Statut** : fait
- **Dépend de** : 059, 204, 205 à 211
- **Agents** : les deux.

## Pourquoi

Suites de la recette de la 0.11.1 et de la session longue : plafond de bobcoins relu et SSO
traduit (205), outil de pilotage en texte (206), recette SSO / trousseau / Modifications (207),
rien ne survit à l'app en quittant (208), limite d'étapes de l'agent (209), modèle refusé faute
de connexion (210), cartes d'autorisation à risque (211). Recettes réelles de 209, 210 et 211
faites avec Bob et OpenCode.

## Critères d'acceptation

- [x] Chaque correctif part du contrat réel (traces Bob / OpenCode) avec un essai qui le rejoue.
- [x] Version 0.11.2 dans `package.json`, notes FR/EN datées du 9 novembre 2026.
- [x] `./scripts/verify`, build et suite complète `pnpm e2e --if-needed` verts sur le commit de
      version.
- [x] `main` poussé, tag `v0.11.2` publié, workflow Release vert, seul le DMG macOS joint.
- [x] DMG publié téléchargé, monté en lecture seule : version 0.11.2, arm64.

## Plan

Même chemin que la 0.11.1 (fiche 204).

## Journal

- 2026-11-09 — Sur `34fe52d6` : build et suite complète 190/190 verte (14 min 51 s).
- 2026-11-09 — Version `4bd8907e` : verify vert. `main` et tag `v0.11.2` poussés, workflow Release
  vert (run 42600235541), seul le DMG macOS joint. Recette du livrable :
  - `Bobine-0.11.2-arm64.dmg`, 146 366 892 octets ;
  - SHA-256 `8b1038fb6183c5c857a0a50ec710804a406a72620c0d875d759d8bbe4e731037` ;
  - `hdiutil verify` valide ;
  - monté en lecture seule : version 0.11.2, arm64, signature ad hoc (runtime renforcé).

## Écarts au plan

- Aucun.
