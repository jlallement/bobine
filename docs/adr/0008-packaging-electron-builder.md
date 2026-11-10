# ADR-0008 — Packaging macOS avec electron-builder, signature ad hoc par défaut

- **Statut** : accepté
- **Date** : 2026-10-12

## Contexte

Fiche 012 : une vraie application (`.app`, `.dmg`) à installer dans `/Applications`. L'app embarque
un module natif (node-pty, ADR-0007) et doit rester aussi sûre qu'en développement. L'utilisateur a
des certificats « Apple Development » dans son trousseau, dont un professionnel.

## Décision

- **electron-builder** (dépendance de dev, version figée) : un seul fichier de configuration
  (`electron-builder.yml`), `.dmg` et signature / notarisation intégrés, gestion de pnpm et de
  l'archive asar (`asarUnpack` pour node-pty). Pas de recompilation des modules natifs
  (`npmRebuild: false`) : node-pty est livré en N-API précompilé.
- **Signature ad hoc par défaut** (`scripts/package`) : la recherche automatique d'un certificat est
  coupée, pour ne jamais signer avec une identité prise au hasard dans le trousseau. Un certificat se
  désigne explicitement (`CSC_NAME`, ou `CSC_LINK` + `CSC_KEY_PASSWORD`) ; la notarisation s'active
  avec les identifiants Apple (`APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`, ou clé
  d'API `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`).
- **Hardened runtime** et **verrous Electron** (fuses) : pas de `ELECTRON_RUN_AS_NODE`, de
  `NODE_OPTIONS` ni de `--inspect` dans l'app packagée ; elle ne charge que son archive, dont
  l'intégrité est vérifiée.
- **Même dossier de données qu'en développement** (`bob-desktop`) : l'app packagée retrouve
  l'historique et les réglages ; le nom affiché « Bob Desktop » est posé par `app.setName`.

## Alternatives écartées

- **Electron Forge** : plus de pièces (makers, plugins) pour le même résultat ; son intégration avec
  electron-vite est moins directe.
- **Script maison** (copie d'Electron.app, `codesign`, `hdiutil`) : réécrire ce qu'electron-builder
  fait déjà (asar, icônes, fuses, notarisation).
- **Signer d'office avec le certificat trouvé** : comportement par défaut d'electron-builder, écarté
  (voir Contexte).

## Conséquences

- `pnpm package` produit `dist/mac-arm64/Bob Desktop.app` et `dist/Bob-Desktop-<version>-arm64.dmg` ;
  `pnpm e2e:packaged` essaie l'app construite comme si elle était ouverte depuis le Finder.
- Le premier `pnpm package` télécharge des outils de construction (cache d'electron-builder).
- Signée ad hoc, l'app ne s'ouvre que sur la machine qui l'a construite ; la distribuer demande un
  certificat « Developer ID Application » et la notarisation.
- Signée ad hoc, l'app **ne peut pas afficher de notifications** : macOS 27 les refuse d'emblée
  (constaté le 2026-10-12, fiche 024). Il faut un vrai certificat, même de développement.
- Un nouveau module natif devra lui aussi être livré précompilé (ou réactiver la recompilation).
