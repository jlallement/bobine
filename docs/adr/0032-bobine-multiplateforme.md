# ADR-0032 — Bobine multiplateforme : macOS, puis Linux en préversion

- **Statut** : accepté (décisions prises avec Jérôme le 2026-10-24, fiche 145)
- **Date** : 2026-10-24

## Contexte

Bobine n'est livrée que pour macOS (Apple Silicon, ADR-0008). Une partie des développeurs visés
travaille sous Linux, où Bob (IBM le livre en `.deb`) et OpenCode tournent. Le relevé du
2026-10-24 (fiche 145) montre une base déjà largement portable : Electron, client ACP générique,
`./scripts/verify` vert sous Linux en CI. Ce qui est propre au Mac tient en peu d'endroits : 8
tests de `process.platform`, une quinzaine de commandes macOS (`osascript`, `afplay`,
`screencapture`, `open -a Terminal`, `ditto`, `hdiutil`, `xcrun`, `plutil`), la barre de titre
`hiddenInset` et le packaging. node-pty n'a pas de binaire précompilé pour Linux.

Sans règle, ces différences se disperseraient dans le code au fil des fiches, comme celles des
agents avant les profils (ADR-0011, ADR-0028).

## Décision

Bobine devient **multiplateforme** : macOS reste la plateforme principale, **Linux** est livré en
**préversion**, Windows plus tard (ADR à part).

- **Capacités de la plateforme** : un seul module du main (`src/main/platform.ts`) lit
  `process.platform` pour décider d'une fonction et rend des capacités (`simulator`,
  `selfInstall`, `dock`, `nativeLanguage`, `screenCapture`…). Le renderer reçoit ces capacités par
  l'IPC typé, jamais le nom du système, et masque ce qui manque. Ce qui ne peut pas marcher sous
  Linux est masqué, pas laissé en panne.
- **Cible Linux** (D6) : Ubuntu 24.04 GNOME, sessions Wayland et X11. Les autres bureaux
  « devraient marcher », sans promesse.
- **Formats** (D1) : AppImage et `.deb`. **Architectures** (D2) : x64 et arm64.
- **Construction** (D3) : sous Linux seulement (machine virtuelle ou GitHub Actions
  `ubuntu-24.04` et `ubuntu-24.04-arm`) ; node-pty y est compilé pour Electron. Pour Linux, cela
  remplace le « pas de recompilation » (`npmRebuild: false`) d'ADR-0008, qui reste valable sur
  macOS.
- **Clés d'API** (D4), comme VS Code et Bob IDE : chiffrées par le trousseau de la session
  (GNOME Keyring, KWallet) s'il existe ; sinon fichier des clés en droits 600, non chiffré, dit
  en une ligne dans Réglages › Agents, sans boîte de dialogue bloquante ; rechiffrées dès qu'un
  trousseau apparaît.
- **Agents** (D5) : Bob et OpenCode annoncés sous Linux, sans code propre à un agent ni à une
  plateforme dans leurs profils.
- **Publication** (D7) : AppImage et `.deb` joints à la même version GitHub que le `.dmg` (même
  numéro, même tag), « préversion Linux » dit dans les notes et la fenêtre À propos. Première
  version visée : 0.6.0.

## Alternatives écartées

- **Rester macOS seulement** — écarte des utilisateurs dont les agents tournent déjà sous Linux,
  alors que le portage est court.
- **Linux et Windows ensemble** — Windows demande bien plus (arrêt des groupes de processus,
  scripts `.cmd`, shells, signature SmartScreen) ; il profitera des capacités posées ici.
- **Flatpak ou Snap** — leur bac à sable empêche de lancer les agents, le terminal et git de la
  machine.
- **`.rpm` dès la préversion** — un format de plus à essayer, sans demande pour l'instant.
- **Construction croisée depuis le Mac** — impossible proprement avec node-pty compilé.
- **Tests de `process.platform` là où ils servent** — disperse la règle ; un oubli laisse une
  fonction en panne au lieu de la masquer.
- **Clés d'API jamais enregistrées sans trousseau** — plus strict que tous les outils relevés
  (Claude Code et OpenCode gardent les leurs en clair, droits 600, sous Linux) pour un gain faible.
- **Version Linux sur un tag à part** — deux numérotations à suivre pour une même base de code.

## Conséquences

- Toute nouvelle fonction propre à un système passe par une capacité de `platform.ts`, comme une
  fonction propre à un agent passe par son profil.
- Chaque fiche qui touche l'interface, les processus ou le packaging se vérifie aussi sous Linux :
  suites e2e marquées par plateforme, lancées sous `xvfb` (job manuel, comme sur le Mac), et essai
  réel dans une machine virtuelle Ubuntu.
- Une montée d'Electron ou de node-pty peut casser la construction Linux sans toucher au Mac : la
  fiche de montée des dépendances la vérifie.
- Sous Linux sans trousseau, une clé d'API est lisible par les programmes de l'utilisateur, comme
  celles des agents eux-mêmes ; l'interface le dit.
- Pas de signature pour AppImage et `.deb` : la somme SHA-256 est publiée avec la version.
- Écarts assumés en préversion (simulateur iOS, installation par l'app, compteur du Dock, langue
  des dialogues, capture d'écran) : tableau de la fiche 145.
