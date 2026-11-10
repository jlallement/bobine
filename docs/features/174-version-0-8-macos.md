# 174 — Version 0.8.0 macOS

- **Statut** : fait
- **Dépend de** : 059, 111, 162, 163 à 173
- **Agents** : les deux ; aucun changement du protocole ACP.

## Pourquoi

Depuis la 0.7.0, `main` a reçu les fiches 163 à 173 : compatibilité Bob 2.0.9, coût de toutes les
sessions, indices des outils, onglet « Session », thème Fjord, règle de l'action principale et
jetons de rayon, comptes rendus des filles allégés, défilement horizontal et sommaire du fil,
dépendances (Electron 45.2.3, lots A et B). L'utilisateur veut publier une 0.8.0 macOS, comme la
0.7.0 (fiche 162) : Linux reste expérimental et absent de la publication.

## Critères d'acceptation

- [x] Version 0.8.0 dans `package.json`, notes FR/EN datées du 6 novembre 2026.
- [x] Sonde du contrat de Bob 2.0.9 (`pnpm bob-probe`) verte, réponses identiques à la référence.
- [x] Vrai trousseau de macOS dans l'app packagée : clé chiffrée, puis déchiffrée après relance.
- [x] Build et suite complète `pnpm e2e --if-needed` verte sur le commit de version ; suite
      anglaise complète verte.
- [x] `main` poussé, tag `v0.8.0` publié, workflow Release vert, seul le DMG macOS joint.
- [x] DMG publié téléchargé, monté en lecture seule : version 0.8.0, arm64, signature ad hoc.

## Plan

1. Version et notes, sans changement fonctionnel ni dépendance nouvelle.
2. Avec l'accord de l'utilisateur (donné le 2026-11-05 : « on peut faire une version ») :
   `git push origin main`, puis `git tag v0.8.0 && git push origin v0.8.0`.
3. Recette du DMG publié (comme la 0.7.0, fiche 059) et journal ci-dessous.

## Journal

- 2026-11-05 — Fiches 166 à 173 relues par la session mère (tech lead) et fusionnées. La suite
  e2e complète a révélé après fusion un vrai défaut (panneau Session ouvert d'office qui
  n'écrasait plus la conversation qu'au moment de s'ouvrir) : corrigé (fiche 173, le panneau cède
  puis se replie). Suite complète verte sur `main` : 145/145 en clair et sombre. En anglais, quatre
  essais comparaient du français écrit en dur : corrigés (essais seulement), suite anglaise
  complète verte (145/145).
- 2026-11-05 — `pnpm bob-probe` (Bob 2.0.9) : contrat de l'app vert sur les 10 points, réponses
  identiques à la référence 2.0.9 (déjà enregistrée par la fiche 163).
- 2026-11-05 — Trousseau réel dans l'app packagée (DMG de `main`, profil temporaire, sans
  `--use-mock-keychain`) : agent personnalisé de test et clé de test enregistrés (fichier des clés
  chiffré, élément « Bobine Safe Storage » créé sans boîte de dialogue), relance, conversation
  avec l'agent : clé reçue identique. Élément du trousseau et profil supprimés ensuite (ils
  n'existaient pas avant l'essai).
- 2026-11-05 — Suite complète `pnpm e2e --if-needed` verte sur le commit de version `e0c787f`
  (9 min 09 s). Premier push refusé par GitHub (« fatal error in commit_refs_rules », sur toute
  référence, sans incident annoncé) : rien de notre côté, le même push est passé le lendemain.
- 2026-11-06 — `main` et le tag `v0.8.0` poussés ; workflow Release vert (4 min 48 s) et CI de
  `main` verte. Release « Bobine 0.8.0 » (ni brouillon ni préversion), seul
  `Bobine-0.8.0-arm64.dmg` joint (142 Mo, SHA-256 `6752eddc…98471b`, identique au condensé
  annoncé par GitHub). DMG téléchargé : `hdiutil verify` valide, monté en lecture seule :
  `Bobine.app` et lien `Applications`, version 0.8.0, arm64, `dev.bobine.app`, signature ad hoc,
  `codesign --verify --deep --strict` correct.
- Reste hors de cette version : sonde d'OpenCode avec un modèle gratuit non relancée ; signature
  Developer ID toujours sans certificat (fiche 111). L'essai `AboutWindow` (titre de la fenêtre) a
  échoué une fois sur la CI Linux le 2026-11-05 sur un commit de doc seule, puis passé : instable.
