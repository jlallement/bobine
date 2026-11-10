# ADR-0007 — Terminal intégré : node-pty et xterm.js

- **Statut** : accepté
- **Date** : 2026-10-12

## Contexte

Fiche 034 : des onglets de terminal à côté de la conversation, comme Claude Desktop, que l'agent peut
lire et où il peut lancer une commande sous les yeux de l'utilisateur. Un vrai terminal (invite,
couleurs, édition de ligne, programmes plein écran) exige un pseudo-terminal ; l'utilisateur veut que
tout soit livré dans l'app, sans outil externe.

## Décision

- **node-pty** (Microsoft, celui de VS Code) dans le main pour les pseudo-terminaux. Module natif en
  N-API livré avec ses binaires précompilés (macOS arm64 et x64) : pas de compilation, il marche tel
  quel dans Node (tests) et dans Electron. Son script d'installation n'est pas exécuté
  (`allowBuilds: node-pty: false`) : l'app rend elle-même `spawn-helper` exécutable.
- **xterm.js** (`@xterm/xterm` + `addon-fit`) pour l'affichage dans le renderer, et
  **`@xterm/headless`** + **`addon-serialize`** dans le main : un double de chaque terminal qui sait ce
  qui est à l'écran (lecture par l'agent, effacements et programmes plein écran compris) et en refait
  l'image pour un affichage qui s'ouvre plus tard.

## Alternatives écartées

- **Processus sans pseudo-terminal** (`spawn` avec des tubes) : pas d'invite, pas de couleurs, pas de
  programmes interactifs. Pas un terminal.
- **Ouvrir Terminal.app** : hors de l'app, l'agent ne peut pas le lire.
- **Lire la sortie brute** pour l'agent : les séquences d'effacement et de déplacement du curseur la
  rendent illisible ; `@xterm/headless` fait exactement le rendu de l'écran.

## Conséquences

- Premier module natif de l'app : l'empaquetage (fiche 012) devra le sortir de l'archive asar
  (`asarUnpack`) et garder `spawn-helper` exécutable.
- Les tests du gestionnaire de terminaux utilisent un faux pseudo-terminal ; un test réel lance un
  shell.
