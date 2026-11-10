# ADR-0023 — Pas de mise à jour automatique pour l'instant

- **Statut** : accepté
- **Date** : 2026-10-21

## Contexte

L'audit du 2026-10-21 (point 6) voulait que personne ne reste sur une vieille version : un contrôle
au démarrage et depuis Réglages › À propos, qui compare à la dernière Release GitHub, puis
télécharge et installe. La fiche 111 a préparé la signature Developer ID et la notarisation, sans
compte Apple pour l'instant.

Deux faits pèsent :

- sur macOS, seule une app signée avec un vrai certificat peut se remplacer proprement elle-même
  (Squirrel.Mac, le moteur intégré à Electron, refuse une mise à jour dont l'identité ne correspond
  pas : l'exigence d'une app ad hoc est son empreinte, qui change à chaque version) ;
- sur un poste géré, l'utilisateur n'a pas toujours les droits d'installer lui-même une nouvelle
  version : l'installation passe alors par d'autres circuits que l'app.

## Décision

Pas de mise à jour automatique, ni de contrôle de version dans l'app : aucun appel réseau pour cela.
Une nouvelle version se récupère sur la page Releases du dépôt (« Watch › Custom › Releases » sur
GitHub pour être prévenu) et s'installe comme la première (fiche 073 : l'ancienne va à la
corbeille). Décision de l'utilisateur, le 2026-10-21.

## Alternatives écartées

Étudiées pour le jour où la question reviendra (app signée, bêta publique) :

- **electron-updater** : dépendance livrée dans l'app (≈ 8 paquets), cible `.zip` et
  `latest-mac.yml` à publier ; notes de la Release seulement (en français). Éprouvé, téléchargement
  différentiel.
- **Contrôle maison + `autoUpdater` d'Electron** (la recommandation de la fiche 111) : aucune
  dépendance ; `releases/latest` de l'API GitHub par `net.fetch` (proxy du système), notes du
  `CHANGELOG` de la langue ; installation par Squirrel.Mac quand l'app est signée (un `.zip` et un
  petit JSON attachés à la Release), sinon ouverture de la page de la version.
- **Remplacement maison** (télécharger le `.dmg`, vérifier sa signature, réutiliser
  l'auto-installation de la fiche 073) : réécrit ce que Squirrel fait de façon sûre.

## Conséquences

- Les utilisateurs peuvent rester sur une vieille version sans le savoir ; Réglages › À propos
  donne la version installée, la page Releases la dernière.
- Rien à surveiller côté réseau : l'app ne contacte pas GitHub d'elle-même.
- Si la question revient, partir de la deuxième alternative, une fois l'app signée (fiche 111).

---

Texte expurgé le 2026-11-10 pour la publication du dépôt ; la décision est inchangée.
