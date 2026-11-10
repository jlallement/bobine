# 199 — Version 0.11.0 macOS

- **Statut** : fait
- **Dépend de** : 059, 182, 186, 187, 188, 189, 191 à 198
- **Agents** : les deux.

## Pourquoi

Les travaux prévus pour la 0.10 (prise en main : aide intégrée, astuces, premier lancement,
mémoire commune) et pour la 0.11 (solidité : GitLab, gros contenus et longs fils, pannes
visibles, versions des agents, intégrité du profil) sortent ensemble, en une seule version
(décision de l'utilisateur du 2026-11-07 : « on prend tout pour la 0.11, y compris les tests
réels avec Bob »).

## Critères d'acceptation

- [x] Chaque fiche relue par la session mère et par des relecteurs indépendants ; maquettes
      validées par l'expert UX (nuit du 6 au 7 novembre, délégation de l'utilisateur) puis par
      l'utilisateur (carte d'autorisation M1, finitions).
- [x] Recette réelle avec IBM Bob 2.0.9 et OpenCode 2.2.5 : verdict « peut partir », aucun
      défaut bloquant ni majeur (rapport `nuit-qa/RAPPORT.md`, section « Recette 0.11 finale »).
- [x] Version 0.11.0 dans `package.json`, notes FR/EN datées du 7 novembre 2026.
- [x] Build et suite complète `pnpm e2e --if-needed` verte sur le commit de version.
- [x] `main` poussé, tag `v0.11.0` publié, workflow Release vert, seul le DMG macOS joint.
- [x] DMG publié téléchargé, monté en lecture seule : version 0.11.0, arm64, signature ad hoc.

## Plan

Même chemin que la 0.9.1 (fiche 190).

## Journal

- 2026-11-07 — Intégration (`claude/integration-0-10-0-11`) fusionnée dans `main` : verify
  3240 tests, e2e complète 187 tâches verte, en français et en anglais (une suite corrigée).
- 2026-11-07 — Recettes réelles : nuit (OpenCode + Bob, 0,26 bobcoin), matin (Bob, 0,88),
  finale (Bob sur tout, 1,40). Défauts trouvés et corrigés avant la sortie : D1 à D7, D10,
  D11, M1 (sécurité : la carte d'autorisation montre la commande entière et exacte), M2, D4,
  finitions. Restent pour une 0.11.1 : F1 (processus détachés par Bob lui-même, documenté),
  F2 (la confirmation de restauration ne dit pas que l'historique de l'agent n'est pas
  restauré), C1 à C3 (cosmétiques).
- 2026-11-07 — `pnpm build && pnpm e2e --if-needed` sur `4016c645` : un seul échec, `history`
  clair (infobulle, sensible au temps), vert relancé seul ; même instabilité que celles déjà
  suivies (R9).
- 2026-11-07 — `main` et tag `v0.11.0` poussés, workflow Release vert (run 42372002197), seul le
  DMG macOS joint. Recette du livrable :
  - `Bobine-0.11.0-arm64.dmg`, 144 708 647 octets ;
  - SHA-256 `b4f8215448b4ae7de79727911444f3b624fc5d66240425a91ddc68c69c26de0f` ;
  - `hdiutil verify` valide ;
  - monté en lecture seule : version 0.11.0, arm64, signature ad hoc (runtime renforcé).
  Installé sur le Mac de l'utilisateur à la place de la 0.9.1 (sauvegardée).

## Écarts au plan

- 0.10 et 0.11 publiées ensemble en 0.11.0.
- Suite complète verte en deux temps (une suite instable relancée seule).
