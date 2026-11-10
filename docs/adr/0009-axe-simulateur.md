# ADR-0009 — AXe pour piloter le simulateur iOS, livré avec l'app

- **Statut** : accepté — stockage de l'archive (« ignoré par git ») remplacé par ADR-0010
- **Date** : 2026-10-13

## Contexte

Fiche 008 : l'agent doit toucher l'écran du simulateur, le lire et le filmer. `xcrun simctl` sait
démarrer, installer, lancer et capturer, mais ni injecter un toucher ni lire l'accessibilité :
seules des API privées de CoreSimulator le permettent. Jusqu'à l'audit du 2026-10-13, AXe était un
binaire à installer à la main, trouvé par le PATH, sans contrôle de version ni décision écrite.

## Décision

- **AXe** (MIT, Cameron Cooke) : CLI Swift signé Developer ID qui embarque `FBSimulatorControl`,
  `FBControlCore`, `FBDeviceControl` et `XCTestBootstrap` (fork épinglé d'idb de Meta) : touchers
  par le HID privé de CoreSimulator, écran par l'accessibilité privée, flux vidéo par captures
  successives (≈ 19 images/s).
- **Version épinglée** (1.8.0) téléchargée et vérifiée (SHA-256 de l'archive, signature Developer ID
  du binaire, `--version`) par `scripts/fetch-axe` dans `vendor/axe/` (ignoré par git) : utilisée en
  développement et copiée dans l'app packagée (`extraResources` → `Contents/Resources/axe`,
  re-signée avec l'app, dont elle a déjà les droits). Repli : un `axe` du PATH s'il est au moins en
  1.8.0 ; sinon touchers et vidéo refusés avec la marche à suivre (agent et onglet « Simulateur »).
- **Accès isolé** dans `main/simulator/axe.ts` ; version vérifiée au premier usage
  (`axe --version`), revérifiée après un délai si elle manquait.
- **Essai manuel** `pnpm simulator-smoke` (simulateur créé pour l'occasion, jamais celui de
  l'utilisateur) avant une version de l'app et après une mise à jour d'Xcode ou d'AXe.

## Alternatives écartées

- **idb (Meta) directement** — même base privée, client Python ou gRPC à relier, flux vidéo H.264
  rapporté cassé par des tiers : aucun gain sur AXe, qui l'embarque déjà.
- **XCUITest / WebDriverAgent** — API publique, mais 1 à 3 s par action, runner à recompiler à
  chaque version d'Xcode, pas de vidéo.
- **Événements souris sur la fenêtre Simulator (CGEvent)** — prend la souris, exige Simulator.app
  visible et la permission Accessibilité.
- **Helper natif Swift maison** — même exposition aux API privées, plusieurs semaines de travail ;
  reste la cible si la vidéo fluide (IOSurface) devient nécessaire (décision : plus tard).
- **`axe batch`** (plusieurs gestes en un processus) — évalué : un appel d'outil de l'agent = un
  geste, le gain n'existerait qu'avec un outil « séquence » qui coûterait du contexte ; écarté.

## Conséquences

- +37 Mo dans l'app (binaire universel et quatre frameworks) ; une nouvelle version d'AXe = une
  nouvelle version de l'app (version et empreinte dans `scripts/fetch-axe`).
- `pnpm package` télécharge AXe s'il manque ; en développement, `pnpm fetch-axe` une fois. Les liens
  symboliques cassés des frameworks (convention Apple vers des dossiers absents) sont retirés au
  téléchargement : electron-builder s'arrêtait dessus à la signature.
- Dépendance à des API privées d'Apple : une version majeure d'Xcode peut casser AXe (une seule
  version motivée par une cassure en treize, juillet 2026 pour Xcode 27) ; `scripts/simulator-smoke`
  le dit vite, et l'app le dit à l'utilisateur quand AXe ne répond plus.
- Avis de licence MIT (AXe, idb) livrés dans `Resources/axe/LICENSES.txt`.
- La saisie exacte passe toujours par le presse-papiers (`simctl pbcopy` en MacRoman puis ⌘V) :
  `axe type` reste limité au clavier américain ; les emoji ne passent pas.
