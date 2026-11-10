# 083 — Tourner le simulateur iOS et l'émulateur Android

- **Statut** : reporté (décision de l'utilisateur, 2026-10-19 : le zoom seulement pour l'instant,
  fiche 084 ; l'essai ci-dessous reste pour une reprise)
- **Dépend de** : 008, 032, 044, 081
- **Agents** : les deux — outils de l'app (serveur MCP) et onglets du panneau, rien de propre à un
  agent

## Pourquoi

Tester une app en paysage est courant, mais rien ne permet de tourner un appareil depuis Bobine :
ni bouton, ni outil pour l'agent. Sur iOS, l'onglet ne connaît même pas l'orientation (le cadre
est toujours en portrait).

## Existant (relevé du 2026-10-19)

- **Android** : l'app suit l'orientation de l'émulateur (fiche 081) — cadre tourné, captures,
  vidéo, planche contact et touchers justes. Pour tourner : fenêtre de l'émulateur, ou `adb`.
- **iOS** : rien ne lit l'orientation ; le cadre (`device-chassis.ts`) est dessiné d'après la seule
  largeur de l'écran, en portrait. Le simulateur est démarré sans fenêtre (`simctl boot`), donc
  sans l'app Simulator ni son menu Device › Rotate. `simctl` n'a aucune commande de rotation.
- **AXe 1.8.0** (embarqué) : pas de commande de rotation, mais il lit l'orientation du simulateur
  (`SimulatorKit.SimDeviceScreen`, `uiOrientation`) et convertit tout seul les touchers donnés en
  coordonnées du paysage (depuis mai 2026). Ses captures suivent probablement l'orientation (il en
  compare le rapport largeur/hauteur) — à vérifier.
- **Comment d'autres font** : idb (Meta) puis serve-sim (Expo, Apache-2.0) envoient au simulateur
  un évènement « orientation » (GSEvent n° 50) par le port `PurpleWorkspacePort` du simulateur,
  interface privée d'Apple ; serve-sim signale que l'app Simulator doit peut-être tourner. Octant
  passe par serve-sim pour iOS et par `adb` (`user_rotation`) pour Android.

## Options à trancher

1. **Bouton sous l'appareil** : un bouton « Tourner » (portrait ↔ paysage) ; deux boutons ↺ ↻
   (comme le menu de l'app Simulator) ; ou un menu des quatre orientations.
2. **Moyen de tourner un iPhone** (choix structurant → ADR) : petit outil natif embarqué (Swift)
   qui envoie l'évènement d'orientation, comme idb et serve-sim ; ajouter `rotate` à AXe (projet
   ouvert, MIT, déjà bâti sur les briques d'idb) ; ou piloter le menu de l'app Simulator
   (AppleScript, autorisation d'accessibilité, fenêtre Simulator ouverte).
3. **Moyen de tourner un Android** : `settings put system user_rotation` (rotation automatique
   coupée ; orientation précise ; émulateur et appareil branché) ou `adb emu rotate` (émulateur
   seulement, un quart de tour à chaque appel).

**Décisions de l'utilisateur (2026-10-19)** : 1. **A**, un seul bouton « Tourner » (portrait ↔
paysage) ; l'agent a les quatre orientations. 2. **Petit outil natif embarqué** pour iOS, après un
essai ; la même commande sera proposée ensuite à AXe. 3. **Orientation imposée** sur Android
(`user_rotation`, rotation automatique coupée).

**Suite (2026-10-19)** : l'utilisateur a ajouté le zoom des appareils, en précisant « si le
paysage est une grosse galère, on ne le fait pas ». Après l'essai ci-dessous, estimation
présentée : tourner Android ≈ ½ jour, zoom ≈ ½ jour, paysage iOS ≈ 1,5 à 2 jours (brique native
compilée avec l'app, images à redresser à quatre endroits, cadre en paysage ; interface privée
d'Apple). **Décision : le zoom seulement** (fiche 084) ; la rotation, Android compris, est
reportée.

## Essai du moyen iOS (2026-10-19)

Programme Swift d'essai (scratchpad, non versionné), simulateur jetable iPhone Air / iOS 26.5,
Xcode 26.6, **app Simulator non lancée** (comme dans Bobine) :
- **Tourner marche** : GSEvent n° 50 sur `PurpleWorkspacePort` (`-[SimDevice lookup:error:]`),
  le port existe sans l'app Simulator ; Safari passe en paysage. Valeur 4 : haut de l'appareil
  (Dynamic Island) à droite.
- **Captures** (`simctl io screenshot` comme `axe screenshot`) : **toujours en portrait**
  (1260 × 2736), contenu couché. Bobine doit redresser l'image (onglet, capture de l'agent,
  planche contact, vidéo).
- **AXe** : `describe-ui` donne les cadres dans le repère du paysage (écran 912 × 420) ; un toucher
  en coordonnées paysage (`axe tap -x 469 -y 33`) tombe juste (barre d'adresse de Safari).
- **Orientation affichée ≠ orientation de l'appareil** : appareil tourné, l'écran d'accueil reste
  en portrait (`uiOrientation` = 1, AXe 420 × 912), Safari passe en paysage (`uiOrientation` = 3).
  Lue par `SimulatorKit.SimDeviceScreen` → `screen` → `screenProperties` → `uiOrientation`
  (appels directs : l'objet est un relais vers un autre processus, pas de `valueForKey:`).
- Simulateur d'essai supprimé ; aucun autre simulateur touché.

## Critères d'acceptation

À écrire une fois les options tranchées. Au minimum : bouton sous l'appareil (iOS et Android),
outils `ios_rotate` / `android_rotate` pour l'agent, cadre iOS qui suit le paysage (captures,
vidéo, planche contact et touchers justes, comme Android), agent factice et e2e, essai réel.

## Plan

À écrire après les choix (et un essai du moyen retenu pour iOS).

## Journal

- 2026-10-19 — Fiche créée : état des lieux et options (demande de l'utilisateur, feuille de route
  après la version 0.3.0).
- 2026-10-19 — Essai du moyen iOS (résultats ci-dessus), estimation présentée ; reporté par
  l'utilisateur au profit du zoom (fiche 084). Pour reprendre : écrire l'ADR de la brique native
  (Swift : tourner + lire `uiOrientation`), redresser les captures (onglet, `ios_screenshot`,
  planche contact, vidéo), cadre iOS en paysage, outils `ios_rotate` / `android_rotate`.
