# 190 — Version 0.9.1 macOS

- **Statut** : fait
- **Dépend de** : 059, 183, 184, 185, 176, 187
- **Agents** : les deux.

## Pourquoi

Version de corrections et de finitions décidée avec l'utilisateur le 2026-11-06 (« tout dans une
0.9.1 ») :
- réinitialisation dans l'app installée (fiche 187, R2) et relance sur le bon profil (D24) ;
- carte de PR fiabilisée (fiche 176 : D7, D15 à D20, D23) ;
- connexion expirée (D10) et recherche de modèle par identifiant (D11) ;
- corrections git (D18, D21, D22) ;
- finitions de l'interface (fiche 185), onglets en fenêtre étroite (D25, D26).

## Critères d'acceptation

- [x] Rejeu final de la recette (fiche 183), sur le vrai GitHub et le vrai OpenCode : « peut
      partir ».
- [x] Version 0.9.1 dans `package.json`, notes FR/EN datées du 7 novembre 2026.
- [x] Build et suite complète `pnpm e2e --if-needed` verte sur le commit de version.
- [x] `main` poussé, tag `v0.9.1` publié, workflow Release vert, seul le DMG macOS joint.
- [x] DMG publié téléchargé, monté en lecture seule : version 0.9.1, arm64, signature ad hoc.

## Plan

Même chemin que la 0.9.0 (fiche 184). Publication « normale » par le workflow Release, accord de
l'utilisateur du 2026-11-06 (« Publie normalement »).

## Journal

- 2026-11-06 — Contenu relu par la session mère et fusionné sur `main` (`bd015c4`) ; suite
  complète 165/165 sur `6c306ce` (même contenu, hors rapport de recette). Version et notes datées.
- 2026-11-07 — `pnpm build && pnpm e2e --if-needed` sur `7b0f830` : 163/165, échecs dans
  `filles` et `filles-tech-lead` seulement, machine très chargée (charge 22, cinq sessions de
  travail lancées en parallèle). Les deux suites, relancées seules : vertes. Instabilité sous
  charge déjà connue (R9, fiche 187), pas un défaut de la version.
- 2026-11-07 — `main` et tag `v0.9.1` poussés, workflow Release vert (run 42310453611), seul le
  DMG macOS joint. Recette du livrable :
  - `Bobine-0.9.1-arm64.dmg`, 142 145 668 octets ;
  - SHA-256 `f4a33669047adf7721e8df922aa11c098c5726da5c7d8aa0b5098db99a20d230` ;
  - `hdiutil verify` valide ;
  - monté en lecture seule : version 0.9.1, arm64, signature ad hoc (runtime renforcé).

## Écarts au plan

- Suite complète verte en deux temps (voir journal) au lieu d'un seul passage.
