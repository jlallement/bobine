# ADR-0013 — « Bobine » partout, dépôt et identifiants compris

- **Statut** : accepté
- **Date** : 2026-10-15
- **Remplace** : ADR-0012 ; le point « même dossier de données (`bob-desktop`) » de l'ADR-0008

## Contexte

L'ADR-0012 ne changeait que le nom affiché et gardait les identifiants internes en
`bob-desktop`. L'utilisateur veut que **tout** soit renommé, dépôt GitHub compris (fiche 069).
Plusieurs de ces identifiants désignent des données déjà sur le disque : dossier de données de
l'app, commandes rangées dans les projets.

## Décision

Tout ce qui appartient à l'app s'appelle `bobine` : dépôt GitHub (`jlallement/bobine`), nom du
paquet, dossier de données (`~/Library/Application Support/bobine`), identifiant de bundle
(`dev.bobine.app`), serveur MCP de l'app (`bobine`, vu par les agents), nom du client ACP,
dossier des commandes de projet (`.bobine/commands`), format d'export (`bobine-conversation`),
variables d'environnement de l'app (`BOBINE_*`, dont `BOBINE_CONFIG_HOME`), dossiers temporaires
et noms d'essai.

Ne changent pas : ce qui appartient à IBM Bob (`BOB_API_KEY`, `BOBSHELL_API_KEY`, `~/.bob`,
`.bob/`, `.bobignore`, `bob.db`), et les fiches et ADR passés (traces datées).

Rien n'est perdu :
- **Dossier de données** : au premier lancement, `bob-desktop` est renommé `bobine`, et un lien
  `bob-desktop` → `bobine` reste à sa place, pour les chemins déjà enregistrés (dossier de travail
  par défaut, sessions des agents rattachées à leur dossier). Pas tant que l'ancienne app est
  ouverte (verrou `SingletonLock` de Chromium, processus vivant) : Bobine le dit et s'arrête.
- **Commandes de projet** : `.bob-desktop/commands` reste lu ; une commande du même nom dans
  `.bobine/commands` l'emporte.

## Alternatives écartées

- **Garder les identifiants internes** (ADR-0012) — écarté par l'utilisateur.
- **Copier le dossier de données** au lieu de le renommer — deux historiques qui divergent, et
  l'espace disque doublé (données du navigateur intégré comprises).
- **Réécrire les chemins enregistrés** au lieu de laisser un lien — les sessions des agents sont
  rattachées au chemin de leur dossier, hors des fichiers de l'app.
- **Accepter aussi les anciennes variables `BOB_*`** — elles ne servent qu'au développement et aux
  essais ; leur double nom entretiendrait la confusion avec les variables d'IBM Bob.

## Conséquences

- macOS rattache certaines autorisations à l'identifiant de bundle : notifications et
  « Enregistrement de l'écran » sont à redonner à Bobine. Les clés d'API sont à ressaisir (déjà
  vrai avec l'ADR-0012 : entrée du trousseau au nom de l'app).
- L'ancienne app et Bobine ne s'ouvrent pas en même temps (même dossier, par le lien).
- GitHub redirige l'ancienne adresse du dépôt ; `origin` est mis à jour.
- Un lien `bob-desktop` reste dans `~/Library/Application Support` ; il peut être supprimé une
  fois l'ancienne app désinstallée, si aucune conversation n'utilise le dossier de travail par
  défaut d'avant.
