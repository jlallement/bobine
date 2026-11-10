# 008 — Simulateur iOS : compiler, lancer, captures, interactions

- **Statut** : fait
- **Dépend de** : 029

## Pourquoi

Comme le simulateur iOS de Claude Code Desktop : l'agent compile l'app, l'installe et la lance dans
le simulateur, prend des captures, touche, glisse et tape pour vérifier son travail ; l'utilisateur
suit dans le panneau « Simulateur ».

## Critères d'acceptation

- [x] Outils : lister / démarrer un simulateur, `ios_build` (xcodebuild en tâche de fond),
      `ios_launch` (installer et lancer un `.app`), `ios_screenshot`, `ios_describe` (lecture de
      l'écran), `ios_tap` (point, référence, libellé, appui long), `ios_swipe`, `ios_type`,
      `ios_button` (Home, verrouillage…), `ios_open_url` (liens profonds).
- [x] Coordonnées en points de l'appareil ; taille donnée au lancement ; captures à cette échelle.
- [x] Onglet « Simulateur » : dernière capture, rafraîchie après chaque action et chaque seconde ;
      un clic dans la capture = un toucher ; boutons Accueil et Verrouiller.
- [x] Erreurs lisibles : pas d'appareil démarré, AXe absent, schéma à choisir, erreurs du compilateur.
- [x] Testé : outils simulés en test ; e2e avec de faux `xcrun` / `axe` ; essai réel (Bob).

## Notes

macOS uniquement ; Xcode requis. Pas de dépendance au simulateur dans la CI. Captures :
`xcrun simctl io booted screenshot` ; touchers : à étudier (`simctl` n'a pas de toucher natif ;
pistes : idb, XCTest, ou événements vers la fenêtre Simulator).

## Plan

- **Touchers : AXe** (outil libre MIT, binaire signé et notarié, v1.8.0, installé dans
  `~/.local/share/axe` avec l'accord de l'utilisateur — Homebrew exige Xcode 27). Il envoie de vrais
  événements tactiles au simulateur (sans prendre la souris) et lit l'écran par l'accessibilité.
  Décision : AXe maintenant, outil natif livré avec l'app plus tard (comme Claude Desktop) ; l'accès
  aux touchers est isolé derrière une interface. Sans AXe : tout le reste marche, les touchers
  répondent « AXe absent » avec la marche à suivre.
- `main/simulator/simctl.ts` : appareils (`simctl list -j`), démarrage (attente plafonnée),
  installation, lancement, arrêt d'une app, liens profonds, capture (`io screenshot -` en JPEG).
- `main/simulator/axe.ts` : lecture de l'écran (`describe-ui` → une ligne par élément avec `ref_N`
  = centre de son cadre, en points), toucher (point, référence ou libellé, appui long), glisser,
  saisie, boutons matériels.
- `main/simulator/xcode.ts` : projet Xcode du dossier, compilation `xcodebuild` **en tâche de fond**
  (attente plafonnée à 40 s comme `preview_start`, l'agent rappelle l'outil), erreurs extraites,
  `.app` et identifiant de bundle trouvés ; DerivedData dans le cache de l'app (pas dans le projet).
- Outils `ios_*` (module actif si le dossier contient un projet Xcode ou un `Package.swift`) :
  `ios_devices`, `ios_boot`, `ios_build` (commande montrée à l'utilisateur la première fois),
  `ios_launch`, `ios_screenshot`, `ios_describe`, `ios_tap`, `ios_swipe`, `ios_type`, `ios_button`,
  `ios_open_url`. Coordonnées en points ; capture mise à l'échelle des points.
- Appareil par conversation : celui choisi par `ios_boot`, sinon le premier démarré.
- Onglet « Simulateur » du panneau : dernière capture rafraîchie (après chaque action, et chaque
  seconde onglet visible), clic = toucher, bouton Accueil.
- Essais réels sur un simulateur créé pour l'occasion (jamais celui de l'utilisateur).

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-11 — Implémenté comme prévu : `main/simulator/` (`run.ts`, `simctl.ts`, `axe.ts`,
  `xcode.ts`, `simulator-manager.ts`, `simulator-tools.ts`), `SimulatorTab`, IPC `simulator:*`,
  scénario `simulateur` ; `BOB_XCRUN` / `BOB_AXE` pour les essais sans simulateur. Tests : appareils,
  lecture d'écran (extrait réel de Réglages), compilation (faux `xcodebuild`), outils (faux
  environnement) ; e2e `simulatorSuite` (capture `28-simulateur`, clic = toucher).
  - **AXe** : Homebrew refuse (exige Xcode 27, machine en 26.6) ; binaire officiel 1.8.0 téléchargé
    avec l'accord de l'utilisateur, signé et notarié (Developer ID Cameron Cooke), installé dans
    `~/.local/share/axe` (lien `~/.local/bin/axe`). Essai : capture 0,4 s, `describe-ui` donne les
    éléments et leurs cadres en points, toucher par libellé OK.
  - **Saisie** : `axe type` n'accepte que les caractères du clavier américain (pas d'accents), et la
    correction automatique d'iOS a changé « Ada » en « Ads » pendant l'essai de Bob. Par défaut, le
    texte exact est donc **collé** : presse-papiers de l'appareil (`simctl pbcopy`, qui lit son
    entrée en **MacRoman** — relevé : UTF-8 et UTF-16 arrivent mal décodés —, d'où `toMacRoman`)
    puis ⌘V (`axe key-combo`). Vérifié sur le simulateur : « Zoé « ça » € œ » arrive exact. Les
    emoji ne passent pas. Option `keystrokes` : touche par touche. Attention : ⌘A envoyé comme
    touche matérielle a renvoyé à l'écran d'accueil ; non utilisé.
  - **Bob réel** (projet SwiftUI minimal `~/bob-essai/ios-demo`, simulateur « Bob Desktop Test »
    créé pour l'essai puis supprimé) : « Compile l'app iOS du dossier ios-demo et lance-la… tape
    « Ada »… appuie deux fois sur « Ajouter un » » → `ios_devices`, `ios_boot`, `ios_build` (carte
    de confirmation de la commande), `ios_launch`, `ios_describe`, `ios_tap`, `ios_type`, 2 ×
    `ios_tap`, `ios_describe` ; aucune autorisation de Bob ; « Le compteur affiche « Compteur : 2 » »
    (et « Bonjour, Ads ! » : correction automatique, corrigée depuis). Coût : 0,408 bobcoin.
  - Reste : outil natif livré avec l'app pour remplacer AXe (décision de l'utilisateur : plus tard) ;
    gestes à deux doigts ; flux vidéo (fiche 009 — `axe stream-video` existe).
- 2026-10-12 — **Captures `simctl` cassées avec Xcode 27** : `simctl io … screenshot --type=jpeg -`
  n'écrit plus sur la sortie standard (contrairement à son aide) mais dans un fichier nommé « - »
  du dossier courant (« Wrote screenshot to: …/- »). Deux fois, ce fichier a fini dans le dépôt ;
  dans l'app packagée, le dossier courant est `/`. La vidéo AXe masquait le problème dans le
  panneau. Correction : capture dans un fichier temporaire, lu puis supprimé (test unitaire) ; le
  faux `xcrun` des essais e2e écrit lui aussi dans le fichier demandé. Les essais e2e démarrent
  désormais tous avec des outils neutres (`xcrun`, AXe, SDK Android sans appareil) : seules les
  suites dédiées utilisent leurs faux outils, aucune ne touche les appareils réels de la machine.
- 2026-10-13 — Fiche 043, ADR-0009 : version d'AXe vérifiée au premier usage (1.8.0 au moins,
  message clair sinon, version dans l'onglet), AXe embarqué dans l'app (`pnpm fetch-axe` →
  `vendor/axe`, `extraResources`), essai manuel `pnpm simulator-smoke`.
- 2026-10-13 — Fiche 044 : dans l'onglet, un glisser à la souris est un balayage (`axe swipe`), la
  molette un défilement ; l'écran est dessiné dans un châssis (coins arrondis, bouton d'accueil
  pour les appareils qui en ont un). `simctl list` fournit aussi le type d'appareil (`deviceType`).
