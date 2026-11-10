# 153 — DMG construit avec les outils de macOS

- **Statut** : fait (signature Developer ID du DMG à essayer avec le compte Apple, comme la fiche 111)
- **Dépend de** : 012, 059, 073, 111, 152
- **Agents** : les deux — empaquetage commun, aucun changement ACP

## Pourquoi

Sur un réseau filtré, le téléchargement du binaire auxiliaire de dmg-builder est bloqué alors que la
construction du `.app` fonctionne. L’utilisateur accepte une fenêtre d’installation plus simple,
à condition de garder la même application et le glisser-déposer vers Applications.

## Critères d’acceptation

- [x] `pnpm package` produit un DMG compressé avec Bobine.app et un lien vers `/Applications`,
      sans exécuter ni télécharger l’auxiliaire dmg-builder.
- [x] `pnpm package --dir` continue à produire seulement l’app ; l’architecture du nom correspond
      à celle de l’Electron local, comme celle de l’app.
- [x] Droits, fuses, signature de l’app et installation par l’app préservés. Avec les identifiants
      Apple, le DMG est signé avant la fermeture du trousseau temporaire, puis notarisé et agrafé
      (couvert par les tests ; jamais essayé avec un vrai certificat, voir « Écarts »).
- [x] Une erreur native ne remplace pas un ancien DMG par un résultat incomplet ; les fichiers
      temporaires sont nettoyés et l’échec remonte à la construction.
- [x] Tests de construction/signature, `verify`, E2E touchés et essai de l’app depuis le DMG
      monté avec un agent factice ; captures regardées.
- [x] Doc, ADR, index et notes FR/EN mis à jour. Aucune dépendance ajoutée.

## Plan

1. Compléter ADR-0008 par ADR-0034 : electron-builder reste responsable du `.app` et de sa
   signature ; `ditto`, `hdiutil` et `codesign` fabriquent le DMG simple.
2. `electron-builder.yml` : cible `dir`, architecture locale, hook `afterSign` natif. Le script
   `package` demande un DMG via un manifeste temporaire (absent avec `--dir`) et garde la
   notarisation de la fiche 111 ; ne jamais chercher une ancienne app ou un ancien DMG dans dist.
3. `scripts/native-dmg.mts` : copie respectant les liens et métadonnées, lien Applications,
   image HFS+ compressée et vérifiée, signature Developer ID avec l’identité et le trousseau
   d’electron-builder encore ouverts ; publication locale atomique du fichier final.
4. Tests sans outils Apple réels en CI Linux : contenu préparé, arguments séparés, échecs,
   nettoyage, signature dans le trousseau temporaire, hook inactif pour `--dir`/Linux.
5. Construire réellement sur le Mac disponible, monter le DMG en lecture seule, vérifier app,
   lien et signature, lancer `e2e/packaged-ci.mjs` depuis le montage et regarder la capture.
   Signature Developer ID réelle non testable sans certificat ; ne pas publier de version.

## Écarts au plan

- Signature Developer ID, notarisation et agrafage du DMG : vérifiés par les tests seulement
  (arguments, trousseau temporaire encore ouvert), faute de certificat. Comme pour la fiche 111,
  à essayer au premier jeu de secrets Apple.
- Le fond illustré et la disposition Finder de l’ancienne fenêtre sont abandonnés (ADR-0034).
  Décision confirmée le 2026-11-05 : l’apparence importe peu, un DMG sans outil téléchargé
  importe plus. Pistes écartées pour la retrouver : `.DS_Store` modèle commité, `dmgbuild` fourni
  à la main via `CUSTOM_DMGBUILD_PATH` (à la façon de `pnpm electron-local`), paquet `.pkg`.

## Journal

- 2026-10-27 — Fiche et plan écrits avant l’implémentation. Dépôt propre sur `main` au départ.
- 2026-10-29 — Implémenté (`091ca0a`) : ADR-0034, cible `dir` et hook `afterSign`,
  `scripts/native-dmg.mts` (`ditto`, `hdiutil`, `codesign`) et ses tests, sans dépendance.
- 2026-10-30 — Essai réel par la Release 0.7.0 (fiches 059 et 162) : DMG construit en CI par ce
  chemin, app essayée depuis le DMG monté ; le démontage refusé (« Resource busy ») réessaie
  puis force (`09a496c`). DMG publié téléchargé et monté en lecture seule : 0.7.0, arm64, ad hoc.
- 2026-11-05 — Recette locale (macOS 27) : `pnpm package` → `Bobine-0.7.0-arm64.dmg` vérifié
  par `hdiutil`, dossier temporaire nettoyé ; monté en lecture seule : `Bobine.app` et lien
  `Applications → /Applications`, `codesign --verify --deep --strict` valide, ad hoc ;
  `pnpm e2e:packaged` depuis le montage vert, capture regardée. `pnpm package --dir` ne refait
  que l’app. À noter : `hdiutil attach`/`detach` affichent désormais un avertissement
  d’obsolescence (remplacés par `diskutil image attach` / `diskutil eject`) ; sans effet pour
  l’instant, `create` et `verify` n’en ont pas. Fiche close.
