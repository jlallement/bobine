# ADR-0042 — Format du profil versionné, champs inconnus gardés, lecture seule si plus récent

- **Statut** : proposé
- **Date** : 2026-11-07

## Contexte

Fiche 187, R10 : le profil (`~/Library/Application Support/bobine`) n'a pas de version. Une
Bobine plus ancienne ne lit que les champs qu'elle connaît (réglages, autorisations, entrées de
l'index) et efface le reste à la première écriture ; un fil d'une version future était remplacé
par un fil vide. Seuls `scheduled-tasks.json` et `usage.sqlite` refusent d'écrire un format plus
récent. Une V1 distribuable doit permettre de descendre de version sans rien perdre, et ne
jamais abîmer un profil qu'elle ne sait pas lire.

Il faut décider où vit la version, et ce que fait une app devant un profil plus récent.

## Décision

- **Une marque par profil**, `profile.json` à la racine du dossier de données :
  `{ "formatVersion": 1, "app": "0.11.0" }`. Pas de marque : profil d'avant la 0.11, format 1.
  `index.json` reste une liste (une Bobine plus ancienne le lit toujours) ; les fils gardent leur
  `version` (fiche 103).
- **Format plus récent que celui de l'app : lecture seule.** Rien n'est écrit, renommé ni
  supprimé sous le dossier de données (un seul point de contrôle : `storage.ts`, sauf le registre
  des processus des agents) ; un message est refusé avant de partir, les tâches planifiées ne se
  lancent pas, les réglages et la corbeille refusent les changements. Un avis le dit avec « Mettre
  à jour Bobine » (la page des versions).
- **Même format, version plus récente de l'app (descente) : rien à faire.** Les champs inconnus
  sont gardés tels quels à la réécriture : réglages et autorisations (clés de premier niveau),
  entrées de l'index qu'elle ne comprend pas, champs d'un fil. Une ligne au journal.
- **`formatVersion` ne monte que pour un changement qu'une version plus ancienne ne saurait pas
  lire sans abîmer** (renommage, type d'un champ changé, autre structure de fichiers). Ajouter un
  champ ou un fichier ne la change pas.

## Conséquences

- La 0.11 et les suivantes n'effacent plus ce qu'elles ne connaissent pas. Les 0.10 et antérieures
  restent sans protection : elles ne lisent pas la marque (dit dans la fiche 196).
- Monter le format est une décision qui demande un nouvel ADR : elle met en lecture seule toutes
  les versions d'avant.
- Les sauvegardes (fiche 197) portent la marque ; une sauvegarde d'un format plus récent n'est pas
  restaurée.
- Écarté : une version par fichier (`settings.json`, `approvals.json`…). Plus fin, mais une app
  qui en accepte un et refuse l'autre laisse un profil à moitié écrit ; et `index.json` aurait dû
  devenir un objet, illisible pour les versions d'avant.
