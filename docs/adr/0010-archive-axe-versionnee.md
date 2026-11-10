# ADR-0010 — Archive d'AXe versionnée dans le dépôt

- **Statut** : accepté
- **Date** : 2026-10-14

## Contexte

L'ADR-0009 fait télécharger AXe par `scripts/fetch-axe` dans `vendor/axe/`, ignoré par git. Chaque
machine doit donc joindre les « releases » GitHub (servies par un autre domaine que github.com) et
le dépôt d'AXe pour les licences. Derrière un proxy, ce n'est pas acquis, alors que le dépôt
(privé) y est cloné. Demande de l'utilisateur, 2026-10-14.

## Décision

Remplace le seul point « `vendor/axe/` (ignoré par git) » de l'ADR-0009 : **l'archive officielle**
d'AXe (`AXe-macOS-v1.8.0-universal.tar.gz`, 8,4 Mo) et ses avis de licence sont versionnés dans
`vendor/archives/`. `scripts/fetch-axe` les prend là s'ils y sont, sinon les télécharge et les y
range ; mêmes vérifications à chaque fois (SHA-256 de l'archive, signature Developer ID du binaire,
`--version`). Le dossier extrait `vendor/axe/` reste ignoré par git. Le reste de l'ADR-0009 tient.

## Alternatives écartées

- **Committer `vendor/axe/` extrait (37 Mo)** — quatre fois plus lourd, frameworks et liens
  symboliques d'un binaire signé à faire passer par git ; aucun gain sur l'archive, qui s'extrait en
  une seconde.
- **Git LFS** — un service et une étape de plus pour un seul fichier qui change rarement.
- **Laisser le téléchargement** — suppose l'accès aux releases GitHub sur chaque machine.

## Conséquences

- +8,4 Mo dans l'historique, puis autant à chaque nouvelle version d'AXe (retirer l'ancienne
  archive du dossier ; elle reste dans l'historique). AXe change rarement.
- `pnpm fetch-axe` marche sans réseau une fois le dépôt cloné.
- AXe est sous licence MIT, ses avis sont versionnés avec l'archive ; le dépôt est privé.
