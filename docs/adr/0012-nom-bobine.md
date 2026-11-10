# ADR-0012 — Nom affiché « Bobine », identifiants internes inchangés

- **Statut** : remplacé par ADR-0013
- **Date** : 2026-10-15

## Contexte

L'app pilote Bob et OpenCode ; « Bob Desktop » la réduisait à Bob. Nouveau nom choisi par
l'utilisateur : **Bobine** (fiche 069). Le nom d'avant est inscrit à plusieurs endroits qui
servent de clé : dossier de données (`~/Library/Application Support/bob-desktop`), identifiant de
bundle (`dev.bob-desktop.app`), serveur MCP de l'app (`bob-desktop`, vu par les agents), dossier
des commandes de projet (`.bob-desktop/commands`), format d'export (`bob-desktop-conversation`),
variables d'environnement `BOB_*`, nom du dépôt.

## Décision

Seul le **nom affiché** change : nom de l'app (`productName`, `app.setName`), fenêtres, menus,
notifications, Dock, `.dmg`, textes de l'interface, documentation vivante. Tous les identifiants
ci-dessus restent tels quels.

## Alternatives écartées

- **Tout renommer** (`bobine` partout) — l'historique, les réglages, les commandes de projet et les
  exports existants seraient perdus ou à migrer ; les agents verraient un autre serveur MCP ; les
  autorisations de macOS liées à l'identifiant de bundle seraient à redonner. Beaucoup de risque
  pour un gain invisible.
- **Garder « Bob Desktop » pour l'entrée du trousseau** (en appelant `app.setName` avec l'ancien
  nom avant que Chromium ne lise le trousseau, puis le nouveau) — repose sur l'ordre interne
  d'Electron, peut casser sans bruit à une mise à jour ; une clé à ressaisir une fois est préférable.

## Conséquences

- Les **clés d'API enregistrées deviennent illisibles** : `safeStorage` les chiffre avec l'entrée
  du trousseau « <nom de l'app> Safe Storage ». L'app le signale (Réglages › Agents : « Illisible,
  à saisir de nouveau ») au lieu de les dire « Enregistrée » ; la doc d'installation le dit.
- L'ancienne `Bob Desktop.app` reste installée à côté : à supprimer (même dossier de données, donc
  une seule des deux ouverte à la fois).
- Journal dans `~/Library/Logs/Bobine/` (chemin tiré du nom de l'app).
- Les fiches et ADR passés gardent « Bob Desktop » : ce sont des traces datées.
