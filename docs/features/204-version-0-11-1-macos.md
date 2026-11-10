# 204 — Version 0.11.1 macOS

- **Statut** : fait
- **Dépend de** : 059, 199, 166, 200 à 203
- **Agents** : les deux.

## Pourquoi

Corrections trouvées en essayant la 0.11.0 : Bob dont la connexion expire en pleine
conversation (fiche 200), icônes des invites du terminal (201), « En cours » qui listait tout
terminal ouvert (166), fichiers créés par OpenCode absents de Modifications (202), cartes
d'autorisation plus lisibles (203).

## Critères d'acceptation

- [x] Chaque correctif part du contrat réel (traces Bob 2.0.9 / OpenCode 2.2.5) avec un essai
      qui le rejoue ; recettes réelles avec OpenCode et avec Bob connecté.
- [x] Version 0.11.1 dans `package.json`, notes FR/EN datées du 8 novembre 2026.
- [x] `./scripts/verify`, build et suite complète `pnpm e2e --if-needed` verts sur le commit de
      version.
- [x] `main` poussé, tag `v0.11.1` publié, workflow Release vert, seul le DMG macOS joint.
- [x] DMG publié téléchargé, monté en lecture seule : version 0.11.1, arm64.

## Plan

Même chemin que la 0.11.0 (fiche 199).

## Journal

- 2026-11-08 — Recette réelle avec Bob connecté (0,15 bobcoin) : commande, terminal, « En
  cours », carte « Connexion expirée » bons ; une création de fichier par Bob se lisait
  « Modification » (`oldText: ""`), corrigée (fiche 203, trace réelle rejouée, 0,08 bobcoin).
  Restent, hors de cette version : l'attente de la connexion SSO à l'accueil sans message ni
  « revérifier », « Enregistrer » la clé d'API sans retour quand le trousseau attend,
  « Log in with SSO » non traduit (nom donné par Bob), Modifications de l'onglet Session d'une
  conversation neuve qui reprend l'état git du dossier, plafond de bobcoins non relu après un
  échec.

- 2026-11-08 — Sur `c1d51abc` : verify (3361 tests), build, suite complète 187/187 verte du
  premier coup. Vérification réelle avec Bob sur l'app 0.11.1 empaquetée (0,16 bobcoin) :
  « Création de notes/beta.txt » sur la carte, en fin de tour et à la réouverture ; un fichier
  existant réécrit reste « Modification ». `trustedFolders.json` inchangé.
- 2026-11-08 — `main` et tag `v0.11.1` poussés, workflow Release vert (run 42462760373), seul le
  DMG macOS joint. Recette du livrable :
  - `Bobine-0.11.1-arm64.dmg`, 146 406 590 octets ;
  - SHA-256 `1316450784836df356f9523d5203b18cdbf03bab0e936f2e399a6c164be3b805` ;
  - `hdiutil verify` valide ;
  - monté en lecture seule : version 0.11.1, arm64, signature ad hoc (runtime renforcé).

## Écarts au plan

- Aucun.

