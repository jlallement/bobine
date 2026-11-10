# 032 — Émulateur Android : compiler, lancer, captures, interactions

- **Statut** : fait
- **Dépend de** : 029

## Pourquoi

Le pendant Android de la fiche 008 : l'agent compile l'app, la lance dans l'émulateur et la vérifie
lui-même ; l'utilisateur suit dans le panneau.

## Critères d'acceptation

- [x] Outils : appareils et AVD, démarrage d'un AVD, `android_build` (Gradle en tâche de fond, commande
      montrée la première fois), `android_launch` (installer et lancer un APK, ou relancer un paquet),
      `android_screenshot`, `android_describe` (lecture de l'écran), `android_tap` (référence ou
      point, appui long), `android_swipe`, `android_type`, `android_key`, `android_open_url`,
      `android_logcat`.
- [x] Onglet « Android » du panneau (l'onglet iOS s'appelle désormais « iOS ») : vidéo en direct
      (fiche 033), captures sinon ; clic = toucher ; Retour, Accueil, Apps récentes. Depuis la
      fiche 081 : cadre de téléphone ou de tablette, gestes à la souris, paysage.
- [x] Erreurs lisibles : SDK absent, pas d'appareil prêt, caractères non ASCII, erreurs Gradle.
- [x] Testé : unitaires ; e2e avec un faux SDK (`ANDROID_HOME`) ; essais réels (émulateur, Bob).

## Plan

**Aucun outil externe** (demande de l'utilisateur) : tout vient du SDK Android, indispensable pour
développer sur Android et déjà présent (`~/Library/Android/sdk`, ou `ANDROID_HOME` /
`ANDROID_SDK_ROOT`) — l'app le trouve même s'il n'est pas dans le PATH. Rien n'est réinventé :
- `adb` : appareils, installation, lancement (`cmd package resolve-activity`, `am start`), touchers et
  gestes (`input tap / swipe / keyevent / text`), capture (`exec-out screencap -p`), taille et densité
  (`wm size / density`), journaux (`logcat`), liens profonds (`am start -a VIEW`) ;
- `uiautomator dump` (dans Android) : lecture de l'écran (texte, description, identifiant, cadre) ;
- `emulator` : liste et démarrage des appareils virtuels ;
- Gradle du projet (`./gradlew assembleDebug`) en tâche de fond, comme `xcodebuild` (attente
  plafonnée, l'agent rappelle l'outil) ; `aapt2` du SDK pour le nom du paquet d'un APK ; Java : celui
  d'Android Studio si `JAVA_HOME` n'est pas défini ;
- vidéo (fiche 033, si le temps le permet ici) : `screenrecord --output-format=h264`, décodée par
  Chromium (WebCodecs) dans l'app.

Coordonnées de l'agent en **dp** (comme les points d'iOS) : capture mise à l'échelle des dp, touchers
convertis en pixels (densité de l'appareil). Module actif si le dossier contient un projet Android
(`settings.gradle(.kts)`, `AndroidManifest.xml`, dossier `android/` d'un projet Flutter / React
Native). Onglet « Android » du panneau ; l'onglet iOS devient « iOS ». Essais réels sur un appareil
virtuel créé pour l'occasion (« Bob_Desktop_Test », supprimé ensuite).

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-12 — Implémenté comme prévu : `main/android/` (`sdk.ts`, `adb.ts`, `ui-dump.ts`,
  `gradle.ts`, `h264.ts`, `android-manager.ts`, `android-tools.ts`), `main/jobs/command-job.ts`
  (tâches de fond partagées avec Xcode), `AndroidTab`, `screen-point.ts` (clic dans une image en
  `object-fit: contain`), IPC `android:*`, scénario `android`. **Rien à installer** : le SDK est
  trouvé dans `~/Library/Android/sdk` même hors du PATH. Tests : appareils, lecture d'écran (extrait
  réel de Réglages), Gradle (faux `gradlew`), H.264, outils ; e2e `androidSuite` (faux SDK qui rejoue
  un extrait H.264 réel : capture `29-android`).
  - Relevés (émulateur de test, Android 16, 1080×2400 à 420 ppp) : capture `screencap` 0,8 s,
    `uiautomator dump` 2,3 s ; `screenrecord` en H.264 Baseline (`avc1.42c029`), **≈ 55 images/s**
    pendant un défilement, décodé par WebCodecs : **50 images/s** reçues dans l'app, toile 544×1200.
    `screenrecord` n'envoie que les changements : la dernière image part après 30 ms sans données.
  - Lecture de l'écran : 75 nœuds → 11 lignes utiles (une ligne cliquable prend le texte de ses
    enfants : « Network & internet — Mobile, Wi‑Fi, hotspot »).
  - **Saisie** : `input text` refuse les caractères non ASCII (exception Java) et Android n'a pas de
    commande de presse-papiers par adb : saisie limitée à l'ASCII, erreur claire sinon. Piste : une
    petite app d'aide livrée avec Bob Desktop et installée sur l'émulateur.
  - **Disque** : l'émulateur a refusé de démarrer (12 Go exigés pour les données, 8,8 Go libres) ;
    AVD de test réglé à 2 Go. Gradle hors ligne n'a pas pu compiler un projet de test (bibliothèques
    Kotlin absentes du cache ; pas de téléchargement sans accord) : APK de test fabriqué avec les
    outils du SDK (`aapt2`, `javac`, `d8`, `zipalign`, `apksigner`, clé de débogage standard).
    `android_build` n'est donc testé qu'avec un faux `gradlew`.
  - **Bob réel** (APK de `~/bob-essai/android-demo`, émulateur « Bob_Desktop_Test » créé puis
    supprimé) : `android_devices`, `android_launch`, `android_describe`, `android_tap`,
    `android_type`, 2 × `android_tap`, `android_describe` ; aucune autorisation ; vidéo en direct ;
    « L'écran affiche un compteur à 2, le champ de texte contient « Ada », et le message de bienvenue a
    changé en « Bonjour, Ada ! » ». Coût : 0,330 bobcoin.
- 2026-10-19 — Fiche 081 : l'orientation n'était jamais lue (`wm size` donne la taille physique) ;
  en paysage, captures écrasées et touchers à côté. La taille courante vient désormais de
  `dumpsys window displays` ; l'onglet a un cadre d'appareil et les gestes de l'onglet iOS.
