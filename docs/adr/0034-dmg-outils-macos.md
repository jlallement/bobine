# ADR-0034 — DMG simple avec les outils de macOS

- **Statut** : accepté
- **Date** : 2026-10-27

## Contexte

La construction de Bobine.app fonctionne sur le Mac professionnel, mais le téléchargement de
l’auxiliaire dmg-builder échoue. L’utilisateur accepte une présentation d’installation simplifiée.
L’ADR-0008 garde son intérêt pour l’asar, les modules natifs, les fuses et la signature de l’app.

## Décision

Compléter ADR-0008 : electron-builder produit seulement le `.app`. Un hook `afterSign` crée le
DMG avec `ditto` et `hdiutil` fournis par macOS, puis le signe avec `codesign` quand la signature
Developer ID/notarisation est configurée. Le hook utilise l’identité choisie et le trousseau
temporaire d’electron-builder avant sa fermeture. La notarisation du DMG reste dans `signing.mts`.

La fenêtre contient l’app et le lien Applications, sans fond illustré ni disposition Finder
imposée. L’installation proposée par Bobine elle-même (fiche 073) reste disponible.

## Alternatives écartées

- **Changer de miroir ou précharger l’auxiliaire** : garde un téléchargement supplémentaire
  inutile pour le besoin et impose sa gestion sur les postes d’entreprise.
- **Refaire tout l’empaquetage** : réécrire asar, fuses et signature ne répond pas au problème.
- **Signer le DMG après electron-builder** : le trousseau temporaire d’un certificat `.p12` est
  alors déjà supprimé ; la signature doit précéder son nettoyage.
- **Reproduire le fond illustré via Finder/AppleScript** : complexité et dépendance à une session
  graphique pour un bénéfice de présentation que l’utilisateur accepte de laisser de côté.

## Conséquences

- `pnpm package` et `--dir` restent les points d’entrée ; seuls les outils auxiliaires DMG ne
  sont plus nécessaires. Electron, les dépendances npm et les autres outils de packaging restent
  requis ; il ne s’agit pas de rendre toute l’installation des dépendances hors ligne.
- Le DMG reste construit sur macOS. HFS+ et UDZO assurent la compatibilité du conteneur.
- L’architecture par défaut suit l’Electron local ; le runner de publication ARM64 garde le
  même nom de livrable. Aucun changement aux signatures par défaut ni au contrôle natif en CI.
- dmg-builder peut rester une dépendance transitive d’electron-builder ; son auxiliaire n’est
  plus exécuté ni téléchargé par notre parcours de construction.
