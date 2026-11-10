# 012 — Packaging macOS (.app + .dmg)

- **Statut** : fait
- **Dépend de** : 001

## Pourquoi

Aujourd'hui l'app se lance uniquement depuis le dépôt (`pnpm dev`, ou `pnpm build && pnpm preview`).
On veut une vraie application à installer dans `/Applications` et à distribuer.

## Critères d'acceptation

- [x] `pnpm package` produit `Bob Desktop.app` et un `.dmg` (arm64 ; universel écarté, voir journal).
- [x] Icône et nom d'application corrects ; identifiant de bundle défini (`dev.bob-desktop.app`).
- [x] L'app packagée démarre, et la sécurité (sandbox, CSP) est identique au mode dev.
- [x] L'agent factice n'est **pas** embarqué dans l'app packagée (profil réservé au développement).
- [x] Signature et notarisation Apple préparées (variables d'environnement documentées, désactivées
      sans certificat).
- [x] Doc « Démarrer » mise à jour.
- [x] Essai automatique de l'app packagée (`pnpm e2e:packaged`).

## Plan

- **electron-builder 26.17.0** (dépendance de dev, ADR-0008) : `electron-builder.yml`, cible `dmg`
  arm64 ; `pnpm package --dir` pour la seule `.app`.
- Contenu : `out/**` et les dépendances de production (node-pty, `@xterm/headless`,
  `addon-serialize`) ; `@xterm/xterm` et `addon-fit` passent en dépendances de dev (Vite les met dans
  le bundle du renderer). Ni `src/`, ni l'agent factice, ni les sources et binaires Windows de
  node-pty, ni `node-addon-api`.
- node-pty : binaires N-API précompilés, donc `npmRebuild: false` ; `prebuilds/` hors de l'archive
  asar (`asarUnpack`) pour que `pty.node` et `spawn-helper` soient chargeables et exécutables.
  `ensureSpawnHelper` cherche dans `app.asar.unpacked`.
- Signature (`scripts/package`) : ad hoc par défaut, jamais un certificat pris d'office dans le
  trousseau ; certificat désigné par `CSC_NAME` ou `CSC_LINK` ; notarisation si `APPLE_ID…` ou
  `APPLE_API_KEY…`. Hardened runtime + `build/entitlements.mac.plist` (JIT, bibliothèques).
- Verrous Electron (« fuses ») : pas de `ELECTRON_RUN_AS_NODE`, pas de `NODE_OPTIONS` ni
  `--inspect`, archive seule et vérifiée.
- Nom affiché « Bob Desktop » (`app.setName`) sans déplacer le dossier de données
  (`~/Library/Application Support/bob-desktop`, partagé avec `pnpm dev`).
- Icône : `build/icon.svg` → `build/icon.png` (1024 px) par `scripts/make-icon.mjs`, rendu par
  Electron lui-même ; electron-builder en tire `icon.icns`.

## Journal

- 2026-10-27 — Suite : fiche 153 / ADR-0034. electron-builder produit désormais le `.app`
  (`dir`, architecture locale) ; le DMG simple est créé avec les outils de macOS dans `afterSign`,
  sans téléchargement de l’auxiliaire dmg-builder. Les choix de sécurité restent ceux de cette fiche.
- 2026-10-11 — Fiche créée à la demande de l'utilisateur.
- 2026-10-12 — Fait. `.app` de 262 Mo, `.dmg` de 117 Mo (arm64). `pnpm e2e:packaged` lance l'app
  construite avec l'environnement d'une app ouverte depuis le Finder (PATH réduit à `/usr/bin:/bin…`),
  sur un dossier de données jetable : fenêtre et interface, nom, renderer isolé, agent factice absent,
  Bob et OpenCode trouvés grâce au PATH du shell de connexion (`shell-env.ts`), terminal node-pty
  fonctionnel. `.dmg` monté : app et raccourci Applications, signature valide (`codesign --verify`).
- Écarts au plan :
  - electron-builder voulait recompiler node-pty (échec de l'éditeur de liens avec le SDK macOS 27) :
    inutile avec les binaires N-API, d'où `npmRebuild: false`.
  - Pas de binaire universel : il faudrait fusionner les deux `pty.node` et doubler le poids ; un
    `.dmg` x64 séparé reste possible (ajouter `x64` aux architectures de la cible), non essayé.
  - Le premier `pnpm package` télécharge des outils de construction (Electron pour l'empaquetage,
    outils d'icône et de `.dmg`), dans le cache d'electron-builder. Rien n'est téléchargé par l'app.
- Limites : signée ad hoc, l'app se lance sur la machine qui l'a construite ; sur une autre, macOS la
  bloque tant qu'elle n'est pas signée avec un certificat « Developer ID Application » et notarisée.
  Pas de mise à jour automatique.
- 2026-10-14 — **App reconstruite et essayée** après les fiches 046 à 052 et l'ADR-0010 (le `.dmg`
  datait du 12) : `pnpm package` (signature ad hoc, aucun certificat du trousseau ; AXe extrait de
  l'archive du dépôt), `.dmg` de 126 Mo ; `pnpm e2e:packaged` vert. **Trou comblé** : l'essai
  vérifiait qu'un AXe était trouvé, sans dire lequel ; or l'app retombe sur `~/.local/bin/axe`
  même avec un PATH réduit, et l'utilisateur en a un. L'état du simulateur donne maintenant le
  chemin d'AXe (aussi en infobulle dans l'onglet), et l'essai exige le binaire du paquet
  (`Contents/Resources/axe/axe`) : vérifié. Essai réel avec ce binaire embarqué (re-signé ad hoc)
  — `pnpm simulator-smoke --axe …` : lecture d'écran, toucher, saisie « Zoé ça », capture, flux
  BGRA 29,7 i/s, simulateur jetable supprimé : tout vert. Pas besoin de désinstaller l'AXe de
  l'utilisateur pour le prouver.
