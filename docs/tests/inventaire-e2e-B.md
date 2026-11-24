# Inventaire des vérifications e2e — groupe B

Étape 1 de la remise à l'endroit de la pyramide des tests (ADR-0069, fiche 277) : **rien n'est
supprimé**. Ce document classe chaque vérification des 42 suites du groupe B et dit où elle
irait. Il faut le relire avant toute suppression. Établi le 2026-11-24 en lisant le code, sans
rien lancer.

Classes : `parcours` (reste en e2e), `composant` (test Vitest + Testing Library sans l'app),
`unitaire-main` (logique du main sans fenêtre), `capture` (rendu seul : capture nocturne),
`doublon` (déjà vérifié ailleurs). « Déjà couvert ? » cite le test trouvé
(`fichier › describe › it`). « partiel » veut dire qu'une partie seulement du contrat est
vérifiée ailleurs : souvent la logique du main, sans le câblage ni le rendu.

## Résumé chiffré

- **Suites** : 42 (dont 2 journées types, `parcours-deleguer` et `parcours-outils`).
- **Vérifications** : 688.
  - `parcours` : 148
  - `composant` : 201
  - `unitaire-main` : 64
  - `capture` : 23
  - `doublon` : 252
- **Déjà couvertes ailleurs** : 562 sur 688, dont 271 entièrement et 291 en partie. 126 ne sont
  couvertes nulle part.
- **Suites qui pourraient disparaître entièrement** (8) : `astuces`, `commands`, `export`,
  `memoire`, `providers`, `relecture-commits`, `roles-meme-icone`, `textes-plateforme`. Pour
  certaines, il faut d'abord écrire un test de composant : `CommandsSettings`, la section
  Astuces, le gestionnaire IPC d'export, `NetworkSettings`.
- **Suites à garder telles quelles** (2) : `parcours-deleguer`, `parcours-outils`.
- **Suites à réduire** (32) : toutes les autres. Ce qui y reste, ce sont les lignes `parcours`
  (148 en tout). Elles se regroupent dans une journée type ou dans une suite courte (voir le
  verdict de chaque suite).
- **Sans le reclassement en `parcours` ni les captures**, environ 517 vérifications quitteraient
  l'e2e : 201 `composant`, 64 `unitaire-main` et 252 `doublon`.

### Par suite

| Suite | Total | parcours | composant | unitaire-main | capture | doublon | couvert | verdict |
|---|---|---|---|---|---|---|---|---|
| `acp` | 14 | 1 | 7 | 0 | 0 | 6 | 10 | reduire |
| `android` | 29 | 9 | 9 | 0 | 3 | 8 | 24 | reduire |
| `astuces` | 12 | 0 | 3 | 1 | 0 | 8 | 10 | disparaitre |
| `auth` | 30 | 6 | 14 | 5 | 0 | 5 | 23 | reduire |
| `bob` | 9 | 2 | 2 | 0 | 0 | 5 | 7 | reduire |
| `browser-view` | 21 | 16 | 2 | 0 | 0 | 3 | 16 | reduire |
| `changes` | 14 | 1 | 7 | 3 | 0 | 3 | 11 | reduire |
| `commands` | 17 | 0 | 10 | 0 | 2 | 5 | 13 | disparaitre |
| `composer` | 53 | 5 | 18 | 0 | 7 | 23 | 39 | reduire |
| `custom-agent` | 9 | 3 | 5 | 1 | 0 | 0 | 8 | reduire |
| `diagnostic` | 28 | 7 | 9 | 10 | 0 | 2 | 19 | reduire |
| `export` | 5 | 0 | 0 | 3 | 0 | 2 | 5 | disparaitre |
| `filles-fusion` | 14 | 4 | 0 | 0 | 0 | 10 | 13 | reduire |
| `filles-visibilite` | 7 | 2 | 0 | 0 | 0 | 5 | 6 | reduire |
| `fresh-start` | 11 | 3 | 0 | 0 | 1 | 7 | 10 | reduire |
| `gitlab` | 16 | 1 | 5 | 0 | 0 | 10 | 15 | reduire |
| `history` | 17 | 1 | 9 | 0 | 1 | 6 | 14 | reduire |
| `launch` | 5 | 3 | 1 | 0 | 0 | 1 | 5 | reduire |
| `links` | 17 | 3 | 8 | 0 | 0 | 6 | 16 | reduire |
| `memoire` | 17 | 0 | 7 | 0 | 0 | 10 | 13 | disparaitre |
| `network` | 6 | 1 | 1 | 0 | 0 | 4 | 6 | reduire |
| `onboarding` | 43 | 14 | 12 | 4 | 1 | 12 | 35 | reduire |
| `panel` | 25 | 3 | 8 | 0 | 1 | 13 | 17 | reduire |
| `parcours-deleguer` | 11 | 11 | 0 | 0 | 0 | 0 | 6 | garder |
| `parcours-outils` | 9 | 8 | 1 | 0 | 0 | 0 | 9 | garder |
| `pendant-tour` | 9 | 2 | 1 | 0 | 1 | 5 | 9 | reduire |
| `pilote` | 43 | 14 | 0 | 21 | 0 | 8 | 37 | reduire |
| `platform` | 5 | 1 | 3 | 0 | 0 | 1 | 5 | reduire |
| `pr-ci` | 19 | 6 | 6 | 0 | 0 | 7 | 17 | reduire |
| `providers` | 13 | 0 | 4 | 2 | 0 | 7 | 11 | disparaitre |
| `quick` | 17 | 4 | 8 | 4 | 0 | 1 | 11 | reduire |
| `relecture-commits` | 7 | 0 | 0 | 0 | 1 | 6 | 6 | disparaitre |
| `replay-changes` | 12 | 1 | 2 | 3 | 0 | 6 | 10 | reduire |
| `resume` | 7 | 2 | 3 | 1 | 0 | 1 | 4 | reduire |
| `roles-meme-icone` | 4 | 0 | 1 | 0 | 0 | 3 | 4 | disparaitre |
| `scheduled` | 18 | 3 | 8 | 1 | 1 | 5 | 12 | reduire |
| `simulator` | 24 | 3 | 11 | 1 | 3 | 6 | 17 | reduire |
| `subagents` | 29 | 4 | 4 | 3 | 0 | 18 | 28 | reduire |
| `textes-plateforme` | 9 | 0 | 9 | 0 | 0 | 0 | 9 | disparaitre |
| `travaux-groupe` | 12 | 1 | 1 | 0 | 1 | 9 | 11 | reduire |
| `user-commands` | 6 | 1 | 2 | 0 | 0 | 3 | 5 | reduire |
| `worktree-setup` | 15 | 2 | 0 | 1 | 0 | 12 | 15 | reduire |

### Tests de remplacement à créer (fichiers absents aujourd'hui)

Il faut les écrire **avant** de supprimer les vérifications qui y migrent :
- `src/renderer/src/components/panel/` : `AcpTab`, `AndroidTab`, `SimulatorTab`, `SidePanel`,
  `TasksTab`, `WorktreeBar`, `PrCard`, `PageNotesBar` (`.test.tsx`) ;
- `src/renderer/src/components/settings/` : `Diagnostics`, `ApiKeys`, `CommandsSettings`,
  `NetworkSettings`, `SettingsPlatform` (`.test.tsx`) ;
- `src/renderer/src/components/composer/QuickEntry.test.tsx`,
  `src/renderer/src/components/Welcome.test.tsx`,
  `src/renderer/src/components/dialogs/ResumeDialog.test.tsx`,
  `src/renderer/src/components/thread/Thread.test.tsx` et `ToolCard.test.tsx`, un test de
  `ChangesToggle`, des classes de plateforme et du mouvement réduit ;
- `src/main/simulator/simulator-manager.test.ts`.

## Risques repérés (ce qu'un test de composant ne verrait pas)

1. **Il n'y a pas de mise en page dans jsdom.** Plusieurs contrats ne passeraient plus que par
   les captures nocturnes, qu'il faudrait alors vraiment regarder : repli de la barre,
   troncatures, débordements à 640/900 px, coordonnées avec zoom (simulateur, Android), marge
   des feux, position du menu « / », `-webkit-app-region`, `CSS.highlights` (⌘F), couleurs
   calculées depuis la palette.
2. **Focus et pointeur réels.** jsdom simule mal les menus et infobulles Radix, le focus rendu
   après un choix, le clic à travers une infobulle, et le glissement réel de la poignée. Les
   menus natifs (Édition › Rechercher, Affichage › Agrandir le panneau) et le menu contextuel
   natif n'existent qu'en e2e. Il faut garder au moins un vrai clic et une vraie frappe après un
   menu dans une journée type.
3. **Câblage de bout en bout.** Beaucoup de « partiel » testent la logique du main, mais ni
   l'IPC ni le rendu. Ces enchaînements ne sont vus que dans ces suites :
   - clé enregistrée, puis agent relancé avec sa variable (`auth`) ;
   - `available_commands_update` jusqu'au menu « / » (`commands`) ;
   - `session/load` puis rejeu (`resume`) ;
   - bascule `no-resume` après redémarrage (`custom-agent`) ;
   - journal changé à chaud sur de vrais échanges ACP et MCP (`diagnostic`) ;
   - rejeu ACP des diffs après redémarrage (`replay-changes`) ;
   - sous-agents finis et réponses hors tour (`subagents`) ;
   - `start_child` simultanés et dans le désordre.

   Il faut les loger dans une journée type (`parcours-reglages`, `parcours-outils`,
   `parcours-matinee`) ou les couvrir par des traces rejouées avant de supprimer quoi que ce
   soit.
4. **Processus et système réels.** Seul un vrai lancement voit :
   - les processus orphelins après une annulation, une fermeture, ⌘Q, un SSO abandonné ou
     `pilote arreter` (comptage `ps`) ;
   - l'agent tenace à tuer à la sortie ;
   - le trousseau lent, le shell de connexion, `shell.openPath` ;
   - la vue native du navigateur (bornes, `sendInputEvent`) : `browser-view` reste donc e2e à
     16 vérifications sur 21 ;
   - le pty du terminal.
5. **Sécurité et temps réel.** Une tâche planifiée n'accorde jamais une autorisation à la place
   de l'utilisateur, et le plafond d'étapes arrête un vrai tour (`scheduled`). Il faut aussi
   tenir compte des courses async : `files:existing` qui répond tard pendant le streaming, une
   relève de PR rapprochée, une forge qui répond après coup. Ces vérifications restent en e2e.
6. **Aucune journée type ne passe par l'accueil du premier lancement.** Il faut garder un
   `onboarding` court ou créer un `parcours-premier-lancement`.
7. **Le report dans `parcours-deleguer` est impossible pour l'instant.** Cette journée est rouge
   à l'étape 8 et sa relance n'est pas jouée (fiche 277, défaut 2). Rien de `filles-fusion` ni
   de `filles-visibilite` ne doit disparaître avant sa correction.
8. **Tests sur un DOM écrit à la main.** `scripts/pilote/*.test.mjs` et quelques tests de
   composant ne suivent pas les testid ou libellés réels. Il faut garder au moins un e2e du
   pilote contre l'app réelle.

## Détail par suite

### `acp.mjs` — onglet « Échanges ACP » du panneau : lignes, regroupement, JSON, filtre, pause

<!-- stats suite=acp total=14 parcours=1 composant=7 unitaire-main=0 capture=0 doublon=6 couvert=10 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | onglet ouvert par le « + », démarrage de l'agent déjà là | les échanges d'avant l'ouverture (`initialize`, `session/new`) sont gardés par le main et livrés au renderer à l'ouverture | `parcours` | `parcours-outils` (nouvelle étape : ouvrir « Échanges ACP », démarrage présent) | partiel : `src/main/agent/acp-exchanges.test.ts › tampon borné…` ; `› lots envoyés seulement aux conversations regardées…` |
| 2 | pied : clés et jetons masqués, messages en mémoire seulement | texte du pied de l'onglet | `composant` | `src/renderer/src/components/panel/AcpTab.test.tsx` (à créer) | non |
| 3 | → session/prompt avec son identifiant | ligne sortante d'une requête : flèche et `#id` | `doublon` | — | `src/renderer/src/acp-view.test.ts › méthode ou type de mise à jour, détail, durée de la réponse depuis sa requête` |
| 4 | ← session/request_permission | ligne entrante d'une requête de l'agent | `doublon` | — | même test que #3 |
| 5 | réponse à la permission : → option choisie et durée | réponse liée à sa requête, durée calculée | `doublon` | — | même test que #3 |
| 6 | tool_call et ses mises à jour, heure à la ms | heure `hh:mm:ss.mmm` | `doublon` | — | `acp-view.test.ts › heure à la milliseconde, taille et durée dans la langue de l’interface` |
| 7 | morceaux de texte regroupés | `agent_message_chunk ×N` regroupés | `doublon` | — | `acp-view.test.ts › sans regroupement, un morceau par ligne ; messages différents jamais regroupés` ; `src/main/agent/acp-log.test.ts › morceaux de texte regroupés par message…` |
| 8 | aucun morceau seul quand « Regrouper » est actif | deux morceaux consécutifs jamais sur deux lignes | `doublon` | — | même test que #7 |
| 9 | clic : JSON brut déplié, indenté et coloré | un clic sur une ligne montre le JSON en jetons | `composant` | `AcpTab.test.tsx` (à créer) | partiel : `acp-view.test.ts › JSON indenté en jetons : clés, chaînes, littéraux` (sans le clic) |
| 10 | groupe déplié : ses N morceaux | déplier un groupe montre un morceau par ligne | `composant` | `AcpTab.test.tsx` (à créer) | non |
| 11 | « Regrouper » décoché : un morceau par ligne | la case change la présentation | `composant` | `AcpTab.test.tsx` (à créer) | partiel : `acp-view.test.ts › sans regroupement, un morceau par ligne…` |
| 12 | filtre : seule la méthode cherchée reste | le champ filtre les lignes | `composant` | `AcpTab.test.tsx` (à créer) | partiel : `acp-view.test.ts › filtre (méthode, outil, texte) et copie en NDJSON` |
| 13 | en pause : la liste ne bouge plus | pause : les nouveaux messages attendent | `composant` | `AcpTab.test.tsx` (à créer) | non |
| 14 | reprise : les messages arrivés entre-temps apparaissent | reprise : la file d'attente est vidée dans la liste | `composant` | `AcpTab.test.tsx` (à créer) | non |

**Verdict** : reduire. Garder #1 (tampon du main livré par IPC à l'ouverture) comme étape de `parcours-outils` ; le reste dans un `AcpTab.test.tsx` à créer, la logique étant déjà dans `acp-view.test.ts`.
**Risques** :
- les vrais messages de l'agent factice (forme exacte, morceaux) ne passeraient plus par le formatage ;
- la pause avec un flux IPC réel (lots regroupés du main) : à simuler fidèlement dans le test.

### `android.mjs` — émulateur Android par un faux SDK : outils de l'agent, vidéo H.264, gestes, cadre, zoom, rotation, planche contact

<!-- stats suite=android total=29 parcours=9 composant=9 unitaire-main=0 capture=3 doublon=8 couvert=24 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | appareil trouvé (nom de l'AVD), app lancée par son activité | agent → MCP de l'app → `adb` réel (faux SDK) → réponse | `parcours` | garder ici | partiel : `src/main/android/android-tools.test.ts › appareils : émulateur en marche nommé par son AVD` ; `src/main/android/adb.test.ts › lancement par l’activité résolue…` |
| 2 | écran lu, toucher au centre du bouton (dp → px), saisie | conversion dp → px et saisie | `doublon` | — | `android-tools.test.ts › lire l’écran puis toucher par référence : dp convertis en pixels` ; `› capture en dp ; saisie ASCII seulement ; touche nommée` |
| 3 | aucune autorisation ; onglet « Android » ouvert tout seul | outils autorisés d'office et ouverture de l'onglet par le main | `parcours` | garder ici | partiel : `android-tools.test.ts › proposés seulement pour un projet Android, autorisés d’office, onglet « Android »` |
| 4 | débit de la vidéo affiché (fps) (waitFor) | la vidéo arrive et s'affiche, avec son débit | `parcours` | garder ici | non |
| 5 | vidéo H.264 décodée par Chromium et dessinée | flux screenrecord → main → décodage dans le renderer | `parcours` | garder ici | partiel : `src/main/android/h264.test.ts › SPS + PPS + IDR forment une image clé avec son codec…` |
| 6 | écran de l'émulateur joint au message | capture du main jointe à la saisie du renderer | `parcours` | garder ici | non |
| 7 | vidéo : rien du faux `adb` ne survit à l'app | les enfants d'`adb` sont tués à la fermeture | `parcours` | garder ici | partiel : `src/main/process-group.test.ts › en quittant : SIGKILL des groupes arrêtés (fiche 195)` |
| 8 | clic au centre de la vidéo : toucher au centre | conversion position → coordonnées appareil | `composant` | `src/renderer/src/screen-gestures.test.ts` (+ conversion élément → pixels) | partiel : `screen-gestures.test.ts › a short click is a tap, wherever the pointer ended` ; `src/main/ipc.test.ts` (`android:tap`) |
| 9 | bouton Retour du panneau | le bouton envoie `KEYCODE_BACK` | `composant` | `src/renderer/src/components/panel/AndroidTab.test.tsx` (à créer) | partiel : `android-tools.test.ts › capture en dp ; saisie ASCII seulement ; touche nommée` ; `ipc.test.ts` (`android:key`) |
| 10 | cadre de téléphone : proportions, perforation en haut au centre | géométrie du cadre en portrait | `doublon` | — | `src/renderer/src/android-chassis.test.ts › phone in portrait: rounded screen, thin bezel, camera at the top, buttons on the right` |
| 11 | commandes dans la barre sous le téléphone | place de la barre de commandes | `capture` | capture nocturne `29-android` | non |
| 12 | zoom : « ajuster » au départ, niveau affiché | état initial du zoom | `composant` | `AndroidTab.test.tsx` (à créer) | partiel : `src/renderer/src/device-zoom.test.ts › « ajuster » suit la place disponible…` |
| 13 | taille réelle : 1 pt par pt, défilement, barre visible | mise en page à 100 % | `capture` | capture nocturne `29e-android-zoom` | partiel : `device-zoom.test.ts › palier suivant et précédent…` |
| 14 | zoom depuis « ajuster » : le milieu reste au centre | ancrage du défilement au centre lors du zoom | `composant` | fonction pure d'ancrage + `device-zoom.test.ts` | non |
| 15 | zoomé : un clic touche le point correspondant | conversion des coordonnées avec zoom et défilement | `composant` | `screen-gestures.test.ts` | partiel : `screen-gestures.test.ts › a short click is a tap…` |
| 16 | zoomé : la molette déplace la vue, sans balayage | molette zoomée = défilement local, pas de swipe | `composant` | `AndroidTab.test.tsx` (à créer) | non |
| 17 | zoomer : palier suivant (125 %) | paliers de zoom | `doublon` | — | `device-zoom.test.ts › palier suivant et précédent d’après l’échelle affichée, même hors palier` |
| 18 | « ajuster » : l'appareil tient en entier | retour au mode ajusté | `capture` | capture nocturne | partiel : `device-zoom.test.ts › « ajuster » suit la place disponible…` |
| 19 | glisser : balayage de bas en haut, au bon endroit | glissé → swipe | `doublon` | — | `screen-gestures.test.ts › a drag is a swipe lasting as long as the gesture, within bounds` |
| 20 | molette : balayage court vers le bas | molette → swipe court | `doublon` | — | `screen-gestures.test.ts › scrolling down pushes the content up from the pointer, away from the edges` |
| 21 | appui long : toucher tenu à l'endroit du pointeur | appui tenu → appui long | `doublon` | — | `screen-gestures.test.ts › a click held still is a long press only where the device supports it` |
| 22 | bouton de volume de la tranche | `KEYCODE_VOLUME_UP` envoyé | `composant` | `AndroidTab.test.tsx` (à créer) | partiel : `ipc.test.ts` (`android:key`) |
| 23 | paysage : cadre tourné, perforation à gauche | rotation relevée par le main (`dumpsys`) en continu, cadre redessiné | `parcours` | garder ici | partiel : `adb.test.ts › orientation : taille courante, rotation et coins…` ; `android-chassis.test.ts › phone turned left (ROTATION_90)…` |
| 24 | paysage : vidéo relancée à la taille tournée | le main relance screenrecord à la nouvelle taille | `parcours` | garder ici | partiel : `android-tools.test.ts › en paysage : écran, capture et touchers dans l’orientation courante (fiche 081)` |
| 25 | paysage : clic au quart → toucher au quart en px | conversion en paysage | `composant` | `screen-gestures.test.ts` | partiel : `android-tools.test.ts › en paysage : …touchers dans l’orientation courante` |
| 26 | tablette : cadre plus large, caméra dans le cadre | géométrie tablette | `doublon` | — | `android-chassis.test.ts › tablet from 600 dp on the short side: camera in the bezel, buttons on the top edge` |
| 27 | planche contact : balayage filmé en images brutes | second screenrecord en `frames`, geste pendant le film | `doublon` | — | `android-tools.test.ts › filme avec un second screenrecord en images brutes, à la taille en dp` ; `› fait le geste pendant le film…` |
| 28 | planche contact affichée dans la carte de l'outil | l'image rendue par l'outil s'affiche | `composant` | `src/renderer/src/components/thread/Transcript.test.tsx` | partiel : `Transcript.test.tsx` (`tool-images`) |
| 29 | planche : rien du faux `adb` ne survit | même contrat que #7, second flux | `parcours` | garder ici | partiel : `process-group.test.ts › en quittant : SIGKILL des groupes arrêtés (fiche 195)` |

**Verdict** : reduire. Garder ici une suite courte (#1, #3–#7, #23, #24, #29 : chaîne agent → MCP → adb → vidéo → panneau, rotation relevée en continu, processus) ; les gestes, le zoom et le cadre sont déjà dans `screen-gestures`, `device-zoom` et `android-chassis`, ou passent dans un `AndroidTab.test.tsx` à créer.
**Risques** :
- décodage H.264 par Chromium (WebCodecs) : impossible dans jsdom ;
- coordonnées réelles (`getBoundingClientRect` avec zoom et défilement) : un test de composant ne verrait qu'une fonction pure ;
- processus enfants qui survivent : seul un vrai lancement le montre.

### `astuces.mjs` — astuces de Bobine : aparté pendant le tour, contexte plein, « Ne plus montrer », Réglages, « Planifier… » au troisième jour

<!-- stats suite=astuces total=12 parcours=0 composant=3 unitaire-main=1 capture=0 doublon=8 couvert=10 verdict=disparaitre -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | pas d'astuce avant deux secondes | délai de 2 s de texte tapé | `doublon` | — | `src/renderer/src/components/tips/ComposerTip.test.tsx › aparté : offerte après 2 s de texte tapé pendant que l’agent travaille, pas avant` |
| 2 | astuce de l'aparté sur la saisie (/btw, ⇧⌘A) | contenu de l'astuce | `doublon` | — | `ComposerTip.test.tsx › aparté montrée : « Essayer »…, « En savoir plus », « Ne plus montrer », ×` |
| 3 | × : astuce fermée | × ferme l'astuce | `doublon` | — | même test que #2 |
| 4 | après relance : l'astuce fermée ne revient pas | « une par jour » écrit sur le disque et relu au lancement | `unitaire-main` | `src/shared/tips.test.ts` + `src/main/settings.test.ts` | partiel : `src/shared/tips.test.ts › au plus une par jour, toutes confondues` ; `src/main/settings.test.ts` (relecture de `tipsState`) |
| 5 | contexte presque plein : astuce avec le pourcentage | au-delà de 85 %, l'astuce du contexte | `doublon` | — | `ComposerTip.test.tsx › contexte : au-delà de 85 %, une fois ; le pourcentage affiché` |
| 6 | « Ne plus montrer » : masquée pour toujours | `hidden` contient `context` | `doublon` | — | `src/renderer/src/useTips.test.ts › « Ne plus montrer » et fonction utilisée : jamais plus` ; `tips.test.ts › « Ne plus montrer » ou fonction utilisée : jamais plus` |
| 7 | Réglages › Général : astuces activées, compte des masquées | ligne des réglages : case cochée et « 1 astuce masquée » | `composant` | test de la section astuces des Réglages › Général (à créer) | non |
| 8 | « Tout réafficher » : plus rien de masqué | le bouton vide `hidden` | `composant` | même test que #7 | partiel : `useTips.test.ts › « Tout réafficher » ailleurs : l’état suit sans remonter le composant` |
| 9 | même message un troisième jour, fin du tour : « Planifier… » | empreinte du message, troisième jour, offre en fin de tour | `doublon` | — | `tips.test.ts › troisième jour différent, une fois ce jour-là…` ; `useTips.test.ts › pas pendant le tour ; à sa fin, « Planifier… » ; rien ailleurs` |
| 10 | « Planifier… » : tâche préremplie avec le message | ouverture de la page des tâches avec la consigne | `doublon` | — | `src/renderer/src/components/scheduled/ScheduledPage.test.tsx › ouvre une nouvelle tâche préremplie ; enregistrée, l’astuce ne reviendra plus` |
| 11 | tâche préremplie : rien d'enregistré | pas d'enregistrement avant « Enregistrer » | `doublon` | — | `ScheduledPage.test.tsx › nouvelle tâche : enregistrée seulement quand la consigne et le dossier sont là` |
| 12 | « Annuler » ramène à la conversation | Annuler ferme le formulaire | `composant` | `ScheduledPage.test.tsx` (nouveau it) | non |

**Verdict** : disparaitre. Tout est déjà couvert par `ComposerTip`, `useTips`, `tips` et `ScheduledPage`, sauf la section des Réglages et « Annuler » (2 tests de composant à écrire).
**Risques** :
- l'empreinte HMAC calculée par le main (clé de l'installation) qui doit correspondre entre deux jours : seule la logique partagée est testée ;
- l'usage du contexte venu de l'agent factice jusqu'à l'astuce (chaîne réelle).

### `auth.mjs` — connexion aux agents : clé d'API (enregistrement, suppression, illisible, trousseau lent), connexion dans un terminal, SSO sans retour, licence

<!-- stats suite=auth total=30 parcours=6 composant=14 unitaire-main=5 capture=0 doublon=5 couvert=23 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | SSO proposé | La carte « Connexion requise » propose la méthode SSO annoncée par l'agent | `composant` | `src/renderer/src/components/composer/BlockerPanel.test.tsx` (méthodes d'auth rendues) | partiel : `src/renderer/src/components/onboarding/Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` (clic `auth-mock-sso`) |
| 2 | SSO : libellé traduit | Le libellé anglais de l'agent est remplacé par celui du profil, dans la langue de l'app | `doublon` | — | `src/main/agent/profiles.test.ts › Bob : « sso », la méthode relevée par la sonde, libellée dans la langue de l'app` |
| 3 | clé d'API : agent relancé avec, plus de connexion | Clé saisie dans la carte → main la stocke, relance l'agent avec la variable, l'agent s'authentifie | `parcours` | garder ici (ou `parcours-reglages`, nouvelle étape « clé d'API ») | non |
| 4 | clé d'API : la conversation fonctionne | Après relance, un tour ACP aboutit avec l'agent authentifié | `parcours` | garder ici (fusionné avec #3) | non |
| 5 | clé chiffrée sur disque (ou D4 : en clair marquée `plain:`, 0600) | Jamais de clé en clair sur disque avec trousseau ; sans trousseau, marquée et fichier 600 | `unitaire-main` | `src/main/agent-config/api-keys.test.ts` | `src/main/agent-config/api-keys.test.ts › enregistre chiffré (fichier 0600)…` et `› en clair et marquée, jamais un faux chiffrement…` |
| 6 | la clé ne revient jamais à l'interface | Ni `settings.get` ni le DOM ne contiennent la valeur | `unitaire-main` | `src/main/agent-config/api-keys.test.ts` (+ assertion sur le payload IPC `settings:get`) | partiel : `src/main/agent-config/api-keys.test.ts › info : jamais la valeur…` |
| 7 | Réglages › page de l'agent : « Enregistrée » (ou « en clair » + avis D4) | L'état de la clé et l'avis sans trousseau sont affichés | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` (état `api-key-state`, `api-key-plaintext`) | non |
| 8 | Réglages : clé supprimée | Supprimer + confirmer remet l'état « Aucune » | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` | partiel : `src/main/agent-config/api-keys.test.ts › supprime ; refuse une clé vide…` (main seul) |
| 9 | clé invalide refusée, message sans « Error » | Une clé avec espaces est refusée, seule la cause est affichée | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` | partiel : `SettingsDialog.test.tsx › « Définir » toujours actif ; trousseau indisponible…` (nettoyage du préfixe) + `api-keys.test.ts › supprime ; refuse une clé vide, avec espaces…` |
| 10 | rouverte, clé illisible : conversation d'avant, connexion demandée dès la réouverture | Après redémarrage, la conversation est rouverte et le `session/load` refusé affiche la carte sans attendre de message | `parcours` | garder ici | partiel : `src/main/agent/turn-auth.test.ts › réouverture refusée elle aussi (N2)…` |
| 11 | rouverte : clé ressaisie, la même conversation continue | La clé ressaisie relance l'agent et la même session reprend (2 messages) | `parcours` | garder ici (fusionné avec #10) | non |
| 12 | clé illisible : l'agent démarre sans, connexion demandée | Une clé indéchiffrable est ignorée, pas d'échec de lancement | `unitaire-main` | `src/main/agent-config/api-keys.test.ts` | `src/main/agent-config/api-keys.test.ts › clé indéchiffrable (trousseau changé) : ignorée, signalée à ressaisir…` |
| 13 | Réglages : clé illisible signalée | L'état « illisible » est affiché dans la page de l'agent | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` (`unreadable: true`) | non |
| 14 | clé ressaisie : de nouveau enregistrée | Ressaisir une clé illisible la remet à « Enregistrée » | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` | partiel : `api-keys.test.ts › clé indéchiffrable… signalée à ressaisir` (main) |
| 15 | connexion dans un terminal : commande lancée dans le terminal de l'app | L'étape « Se connecter » du profil s'exécute dans le pty intégré | `parcours` | garder ici | non |
| 16 | terminal : « Réessayer » relance l'agent, connecté | Après la connexion faite hors app, Réessayer relance l'agent qui relit sa connexion | `parcours` | garder ici (fusionné avec #15) | non |
| 17 | carte de connexion : pas de question | Sans attente du navigateur, pas de « rien ne se passe ? » | `composant` | — | `src/renderer/src/components/composer/BlockerPanel.test.tsx › pas d'attente du navigateur : ni question ni « Réessayer »` |
| 18 | attente du navigateur : la question et « Réessayer » | SSO cliqué sans retour : la carte le dit et propose Réessayer | `composant` | — | `BlockerPanel.test.tsx › en attente du navigateur : la question, et « Réessayer » (principal) relance l'agent` |
| 19 | SSO sans retour : « Réessayer » relance, connecté | Réessayer relance l'agent, qui se retrouve connecté | `doublon` | — | partiel : même relance que #16 ; `Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` |
| 20 | Réglages, trousseau lent : champ et bouton désactivés, « Enregistrement… », attente dite | Pas de double envoi ni de silence pendant que le trousseau tarde | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` (ou `KeySave.test.tsx`) | partiel : `BlockerPanel.test.tsx › trousseau qui tarde : désactivé, « Enregistrement… »…` (même hook `useKeySave`) |
| 21 | Réglages : délai dépassé dit, valeur gardée, rien d'enregistré | Le délai du trousseau produit le message, garde la saisie, n'écrit rien | `composant` | idem #20 | partiel : `BlockerPanel.test.tsx › délai dépassé : le message, la valeur gardée, « Réessayer »` + `api-keys.test.ts › délai dépassé : erreur reconnaissable, rien d'enregistré…` |
| 22 | Réglages : délai dépassé → « Réessayer » | Le bouton devient « Réessayer » | `composant` | idem #20 | partiel : `BlockerPanel.test.tsx › délai dépassé : le message, la valeur gardée, « Réessayer »` |
| 23 | Réglages : « Réessayer » repose la même question, clé enregistrée | Pas de seconde question au trousseau ; la clé finit écrite | `unitaire-main` | — | `src/main/agent-config/api-keys.test.ts › Réessayer attend la même question au trousseau, sans en poser une autre` |
| 24 | carte : trousseau attendu dit | Dans la carte, l'attente du trousseau est affichée | `composant` | — | `BlockerPanel.test.tsx › trousseau qui tarde : désactivé, « Enregistrement… », puis l'attente du trousseau dite` |
| 25 | carte : délai dépassé, valeur gardée, « Réessayer » | Même comportement que Réglages dans la carte | `composant` | — | `BlockerPanel.test.tsx › délai dépassé : le message, la valeur gardée, « Réessayer »` |
| 26 | carte : « Réessayer », clé enregistrée, agent relancé | La clé finit enregistrée et l'agent relancé avec | `doublon` | — | partiel : même enchaînement que #3 ; `api-keys.test.ts › Réessayer attend la même question…` |
| 27 | licence : panneau dédié avec le message de l'agent | Le blocage licence a sa carte et cite le message (`--accept-license`) | `composant` | `src/renderer/src/components/composer/BlockerPanel.test.tsx` (kind `license`) | partiel : `src/main/diagnostics.test.ts › blocages : dossier, connexion, licence…` (diagnostic, pas la carte) |
| 28 | licence : « Lire la licence » lance la commande dans le terminal | L'étape du profil part dans le pty | `doublon` | — | partiel : même mécanisme d'étape → terminal que #15 |
| 29 | licence : jamais acceptée par l'app | L'app n'exécute jamais l'acceptation à la place de l'utilisateur | `unitaire-main` | `src/main/agent/capabilities.test.ts` / profil Bob : aucune étape `--accept-license` | partiel : `src/main/agent/capabilities.test.ts` (texte `bob --show-license`) |
| 30 | licence acceptée : « Réessayer » relance l'agent | Réessayer après acceptation externe débloque | `doublon` | — | partiel : même relance que #16 |

**Verdict** : reduire — garder 6 vérifications en 3 enchaînements : clé saisie → agent relancé → tour (#3-4), redémarrage avec clé illisible → carte à la réouverture → ressaisie → même conversation (#10-11), connexion dans le terminal → Réessayer (#15-16). Le reste (états de clé, trousseau lent, cartes, licence) passe en composant/main, dont une bonne part existe déjà.
**Risques** :
- Le trousseau réel (safeStorage, faux trousseau Chromium avec délai) n'est plus traversé de bout en bout : seul `api-keys.test.ts` le simule.
- La relance de l'agent avec la variable d'env posée et sa relecture (`MOCK_AGENT_API_KEY`) ne serait vue que par les 3 enchaînements gardés.
- L'avis D4 (Linux sans trousseau) n'est joué qu'en e2e Linux : la version composant doit le couvrir explicitement.

### `bob.mjs` — premier lancement de Bob simulé : dossier, connexion, formulaires de l'agent, licence

<!-- stats suite=bob total=9 parcours=2 composant=2 unitaire-main=0 capture=0 doublon=5 couvert=7 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | dossier non approuvé : panneau dédié | le blocage `trust` montre sa carte | `doublon` | — | `src/renderer/src/components/composer/BlockerPanel.test.tsx › panneau « Dossier non approuvé » (fiche 088)` |
| 2 | agent bloqué : changer d'agent ou de dossier reste possible | `agent-menu` et `workspace-menu` actifs pendant un blocage | `composant` | `Composer.test.tsx` ou `BlockerPanel.test.tsx` (nouveau it) | non |
| 3 | confiance pour la session → l'agent demande la connexion | ordre réel de Bob : dossier puis connexion | `doublon` | — | `src/main/agent/agent-host.test.ts › premier lancement de Bob : dossier d’abord, PUIS connexion (ordre réel)` |
| 4 | connexion SSO (simulée) → agent prêt | bouton du renderer → `authenticate` ACP → agent prêt (parcours de Bob, cible finale) | `parcours` | `parcours-pannes` (nouvelle étape « Bob : dossier puis connexion ») ou garder ici | partiel : même test que #3 (→ `ready`) |
| 5 | formulaire vide : erreurs, rien de transmis | validation avant l'envoi | `doublon` | — | `src/renderer/src/components/thread/ElicitationCard.test.tsx › formulaire : champs requis et bornes vérifiés avant l’envoi, contenu propre envoyé` |
| 6 | formulaire rempli → réponse transmise à l'agent | aller-retour d'une élicitation ACP complète | `parcours` | même étape que #4 | partiel : `src/mock-agent/mock-agent.test.ts › bob-elicitation : le formulaire accepté oriente la réponse` ; `ElicitationCard.test.tsx` |
| 7 | page web demandée : refus transmis | refus d'une élicitation URL | `doublon` | — | `ElicitationCard.test.tsx › page à ouvrir : hôte affiché, accord ou refus` |
| 8 | licence : message de l'agent sur ses quatre lignes | `.elicitation-message` en `white-space: pre-line` | `composant` | `ElicitationCard.test.tsx` (message multiligne) | non |
| 9 | licence refusée : explication au lieu de l'erreur | erreur de licence traduite | `doublon` | — | `agent-host.test.ts › licence demandée au message (Bob 2.0.9) : formulaire refusé → explication, pas l’erreur brute` |

**Verdict** : reduire. Garder #4 et #6 (premier lancement de Bob et un formulaire de bout en bout) dans une étape de journée type ; le reste est couvert ou passe en 2 tests de composant.
**Risques** :
- l'enchaînement réel des blocages (`trust` puis `auth`) affiché à l'écran pendant le démarrage ;
- `white-space` : jsdom calcule mal le style, préférer vérifier la classe ou la règle CSS.

### `browser-view.mjs` — navigateur intégré (WebContentsView) : la vue native suit la zone (colonne, panneau agrandi, zoom de l'interface), défilement, zoom de la page, raccourcis, clic de l'agent, taille imposée par l'agent

<!-- stats suite=browser-view total=21 parcours=16 composant=2 unitaire-main=0 capture=0 doublon=3 couvert=16 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | la page couvre la zone, innerWidth = sa largeur | Les bornes de la vue native coïncident avec la zone CSS × zoom, et la page se met en page à cette largeur | `parcours` | garder ici | partiel : `src/main/browser/page-view.test.ts › zone en CSS de l'interface → bornes de la vue en pixels de la fenêtre, de 80 à 150 %` (calcul seul) |
| 2 | molette : la page défile | Les événements de molette atteignent la page native (pas avalés par l'interface ou la couche d'annotation) | `parcours` | garder ici | non |
| 3 | clavier (espace, flèche) : la page défile | Les touches de défilement arrivent à la page | `parcours` | garder ici (fusionné avec #2) | non |
| 4 | colonne élargie à la poignée : innerWidth suit | Redimensionner le panneau propage les nouvelles bornes à la vue (renderer → IPC → main) | `parcours` | garder ici | partiel : `page-view.test.ts › zone en CSS…` (calcul) |
| 5 | panneau agrandi : la page prend toute la largeur | Le panneau agrandi repousse les bornes de la vue | `doublon` | — | partiel : même synchronisation des bornes que #4 |
| 6 | panneau réduit : la page suit | Retour du panneau à sa taille, la vue suit | `doublon` | — | partiel : même synchronisation que #4 |
| 7 | interface à 80 / 150 % : vue exacte (×2, boucle ; repli du panneau à 150 % puis réouverture) | Les bornes restent exactes quel que soit le zoom de l'interface ; à 150 % le panneau se replie (fiche 173) | `parcours` | garder ici | partiel : `page-view.test.ts › zone en CSS… de 80 à 150 %` |
| 8 | menu « Taille réelle », interface au focus : retour à 100 % | Le menu natif agit sur l'interface quand elle a le focus | `parcours` | garder ici | partiel : `src/main/menu.test.ts` (accélérateur `reset-zoom` seulement) |
| 9 | ⌘+ dans la page : la page seule à 110 %, puce | Le raccourci tapé dans la page native zoome la page (pas l'interface) et la puce s'affiche dans le champ d'adresse | `parcours` | garder ici | partiel : `page-view.test.ts › paliers de zoom de Chrome…` et `› raccourcis de la page : ⌘ sur macOS, Ctrl ailleurs…` |
| 10 | ⌘− dans la page : retour à 100 %, plus de puce | Le dézoom revient au palier 100 % et retire la puce | `doublon` | — | partiel : même chemin que #9 ; `page-view.test.ts › paliers de zoom…` |
| 11 | menu « Zoom avant », page au focus : la page zoome, pas l'interface | Le menu natif cible la page quand elle a le focus natif (non joué si l'app est au second plan) | `parcours` | garder ici | non |
| 12 | page à 150 % : l'agent clique juste, en pixels CSS | Un clic MCP de l'agent par coordonnées CSS tombe au bon endroit sur une page zoomée | `parcours` | garder ici | partiel : `page-view.test.ts › fenêtre de la page en pixels CSS…` + `src/main/browser/browser-tools.test.ts › clic par référence (position calculée dans la page) ou par coordonnées` |
| 13 | clic sur la puce de zoom : retour à 100 % | La puce est un bouton qui remet le zoom de la page à 100 % | `composant` | `src/renderer/src/components/browser/…test.tsx` (clic `browser-zoom` → appel API reset) | non |
| 14 | ⌘L dans la page : le champ d'adresse prend le clavier | Le focus passe de la vue native au champ d'adresse du renderer | `parcours` | garder ici | partiel : `page-view.test.ts › raccourcis de la page…` (routage seul) |
| 15 | ⌘R dans la page : elle se recharge | Le raccourci recharge réellement la page | `parcours` | garder ici (fusionné avec #14, #16) | partiel : `page-view.test.ts › raccourcis de la page…` |
| 16 | ⌘[ et ⌘] : précédent, suivant | Navigation d'historique de la page par raccourcis | `parcours` | garder ici (fusionné avec #14) | partiel : `page-view.test.ts › raccourcis de la page…` |
| 17 | taille mobile : l'agent clique juste et fait défiler | `browser_resize` 375×812 puis clic et défilement MCP, réponse de l'outil qui dit l'affichage réduit et le retour en fin de tour | `parcours` | garder ici | partiel : `browser-tools.test.ts › taille imposée : l'agent apprend la réduction à l'affichage et la fin au tour suivant` |
| 18 | taille imposée : 375 × 812 tient entier, puce affichée | La vue émulée est réduite à l'échelle, jamais coupée, centrée en haut ; puce visible | `parcours` | garder ici | partiel : `page-view.test.ts › taille imposée par l'agent : réduite pour tenir entière, centrée en haut de la zone` |
| 19 | taille imposée : défile à la molette et jusqu'en bas | La page émulée reçoit la molette et reste entièrement atteignable | `parcours` | garder ici | non |
| 20 | fin du tour : la page reprend la largeur du panneau | L'émulation est annulée à la fin du tour de l'agent | `parcours` | garder ici | partiel : `browser-tools.test.ts › taille d'écran et thème : préréglages, tailles libres, retour au panneau` |
| 21 | clic sur la puce de taille : la page reprend la largeur | La puce d'émulation annule la taille sans attendre la fin du tour | `composant` | `src/renderer/src/components/browser/…test.tsx` (clic `browser-emulation` → API) | partiel : `browser-tools.test.ts › … retour au panneau` (main) |

**Verdict** : reduire — garder 16 vérifications regroupées en ~8 étapes (géométrie de la vue #1/#4/#7, entrées #2-3, menus selon le focus #8/#11, zoom de page #9/#12, raccourcis #14-16, taille imposée #17-20) ; #5, #6, #10 sont des doublons, #13 et #21 passent en composant. C'est une suite légitimement e2e : tout passe par la vue native.
**Risques** :
- La synchronisation des bornes (ResizeObserver → IPC → `setBounds`) n'est vue qu'en vrai : si #5/#6 disparaissent, un oubli propre au panneau agrandi passerait.
- Le routage du focus natif (menus, ⌘L) dépend du premier plan de l'app : #11 est déjà sauté en parallèle.
- Les entrées passent par `sendInputEvent`, pas une vraie souris (dit par la suite).

### `changes.mjs` — onglet Modifications : en-tête, vues Conversation et Git, annuler une modification, « Ouvrir » (exécutable montré, jamais lancé), remarques sur les lignes envoyées à l'agent

<!-- stats suite=changes total=14 parcours=1 composant=7 unitaire-main=3 capture=0 doublon=3 couvert=11 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | pas de raccourci tant que rien n'est modifié | Le bouton `changes-toggle` de l'en-tête n'existe pas sans modification | `composant` | `src/renderer/src/components/…/ChangesToggle.test.tsx` (ou test de l'en-tête de conversation) | non |
| 2 | en-tête : 2 fichiers, +6 −1 | Le résumé de l'en-tête compte fichiers et lignes | `composant` | idem #1 | partiel : `src/shared/changes.test.ts › totaux, chemins` (calcul) |
| 3 | vue « Conversation » : README.md, puis src/app.js créé | Liste des fichiers modifiés par l'agent, ordre, marque « A » d'un fichier créé | `composant` | `src/renderer/src/components/panel/ChangesTab.test.tsx` | partiel : `src/shared/changes.test.ts › regroupe par fichier, fusionne les modifications enchaînées…` et `› fichier créé par Bob : ancien texte vide…` |
| 4 | deux modifications du README fusionnées en un seul diff | Modifications enchaînées d'un même fichier = un diff | `doublon` | — | `src/shared/changes.test.ts › regroupe par fichier, fusionne les modifications enchaînées, ignore les outils non aboutis` |
| 5 | vue « Git » : aussi le fichier non suivi de l'utilisateur | La vue Git liste l'état réel du dépôt, non suivis compris | `unitaire-main` | — | `src/main/changes/git-context.test.ts › état et diff depuis le dernier commit, fichiers non suivis listés` |
| 6 | diff git chargé à la demande (contenu sur le disque) | Déplier un fichier de la vue Git charge son diff depuis le disque | `doublon` | — | `e2e/suites/parcours-matinee.mjs` étape 5 « Modifications : README.md et src/app.js, le diff de README sur le disque » ; partiel `ChangesTab.test.tsx › relu pendant le chargement…` |
| 7 | annuler une modification : README remis, dit dans le fil | Confirmation en place → main remet le fichier réel dans son état d'avant la conversation → avis dans le fil | `parcours` | `parcours-matinee`, étape 5 (ajouter « Annuler » sur un fichier) | partiel : `src/main/conversations/manager.test.ts › annuler une modification (fiche 021, levée par la 043) : fichier remis, créé supprimé, conflit laissé` + `src/main/ipc.test.ts › export, sauvegarde et annulation d'une modification (fiche 043)` |
| 8 | vue « Git » à jour : README n'est plus modifié | Après l'annulation, la vue Git relit le dépôt | `doublon` | — | partiel : `src/main/changes/git-changed.test.ts` (signal « dépôt changé ») + `ChangesTab.test.tsx › vue Git relue après un commit fait hors du panneau…` |
| 9 | Ouvrir : fichier ordinaire, app par défaut | Un fichier ordinaire du dossier s'ouvre dans son application | `unitaire-main` | — | `src/main/files/file-links.test.ts › fichier ordinaire : app par défaut ; chemin absolu ou relatif` |
| 10 | Ouvrir : un .command est montré dans le Finder, jamais lancé | Aucun fichier exécutable n'est lancé par « Ouvrir » | `unitaire-main` | — | `src/main/files/file-links.test.ts › jamais rien d'exécuté : .command, .terminal sans bit x, script exécutable → Finder` |
| 11 | l'onglet dit pourquoi le fichier n'a pas été ouvert | La note `changes-note` explique le refus (exécutable) | `composant` | `src/renderer/src/components/panel/ChangesTab.test.tsx` | non |
| 12 | remarques : une ligne, puis une plage (Maj-clic, ⌘↩), gardées pour la conversation | Ajout de remarques sur ligne et plage, compteur, persistance par conversation | `composant` | `src/renderer/src/components/thread/DiffView.test.tsx` (ou `DiffNotes.test.tsx`) | partiel : `src/renderer/src/diff-notes-store.test.ts › gardées par conversation, retrouvées après rechargement, effacées si vides` |
| 13 | remarque supprimée puis modifiée | Supprimer et modifier une remarque met à jour la liste et le compteur | `composant` | idem #12 | non |
| 14 | Envoyer : un message avec chaque remarque, fichier et lignes ; remarques effacées | Le message composé cite fichier/plage/remarque et vide la barre | `composant` | idem #12 (envoi : `onSend` appelé avec le texte) | partiel : `src/shared/diff-notes.test.ts › message : fichier, lignes, code cité et remarque, numérotés` |

**Verdict** : reduire — garder la seule vérification de bout en bout (#7, annulation d'une modification sur le vrai fichier), de préférence déplacée dans `parcours-matinee` étape 5, ce qui ferait disparaître la suite. Le reste est du rendu ou de la logique déjà testée en unitaire.
**Risques** :
- Le refus d'exécuter (#10) passe aujourd'hui par le vrai `shell.openPath` journalisé (`BOBINE_OPEN_LOG`) : en unitaire, seul le choix est testé, pas le câblage IPC du bouton.
- La sélection de plage au Maj-clic dépend d'événements DOM que jsdom simule mal (sélection, focus) : à écrire avec soin.
- L'agrégation des modifications depuis un vrai flux ACP (`modifications`) n'est plus vue qu'en `parcours-matinee`.

### `commands.mjs` — menu des commandes « / » (agent et app), complétion, envoi, et commandes de l'app (/context, /cost, /mode, /help, /compact, /compress, /clear)

<!-- stats suite=commands total=17 parcours=0 composant=10 unitaire-main=0 capture=2 doublon=5 couvert=13 verdict=disparaitre -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | « / » : commandes de l'agent (3) et de l'app (11), origine affichée | Le menu fusionne les commandes annoncées par l'agent et celles de l'app, avec leur origine | `composant` | `src/renderer/src/components/composer/Composer.test.tsx` | partiel : `Composer.test.tsx › menu « / » : commandes de l'agent et de l'app filtrées ; Entrée complète une commande à argument` + `src/shared/app-commands.test.ts › fusionnées avec celles de l'agent ; l'agent gagne à nom égal` |
| 2 | commande de l'app : l'agent de la conversation seul (pas « Bobine ») | La pastille de source des commandes de l'app nomme l'agent de la conversation | `composant` | `Composer.test.tsx` (`.command-source`) | non |
| 3 | pastilles des commandes de l'app compactes | La pastille ne s'étire pas sur toute la ligne (largeur < 1/3) | `capture` | capture nocturne `16-commandes` | non |
| 4 | menu entier dans la fenêtre, sous la saisie sur l'accueil | Placement du menu (sous/au-dessus) sans sortir de la fenêtre ni couvrir l'en-tête | `capture` | capture nocturne `16-commandes` (+ test unitaire de la fonction de placement si elle est isolée) | non |
| 5 | Tab complète « /scenario » et rappelle l'argument | Complétion au Tab et rappel de l'argument attendu | `composant` | — | `src/renderer/src/useCommandMenu.test.ts › commande complétée : rappel de l'argument attendu ; surlignage remis en tête` |
| 6 | commande envoyée avec son argument | `/scenario refus` part tel quel, saisie vidée | `composant` | — | partiel : `Composer.test.tsx › menu « / » : … Entrée complète une commande à argument` |
| 7 | Entrée sur une commande sans argument : envoyée directement | Une commande sans argument part à l'Entrée | `composant` | — | `Composer.test.tsx › commande de l'agent sans argument : envoyée telle quelle ; commande de l'app : traitée par l'app` |
| 8 | aucune correspondance : message dans le menu | Le menu affiche `commandMenu.empty` | `composant` | `Composer.test.tsx` | non |
| 9 | Échap ferme le menu sans effacer la saisie | Échap ferme le menu, la saisie reste | `composant` | — | `useCommandMenu.test.ts › ouvert pendant la saisie du nom, filtré ; Échap le referme…` + `Composer.test.tsx › Échap ferme le menu, sans envoyer` |
| 10 | /context : bilan dans le fil, rien envoyé à l'agent | Commande de l'app traitée localement | `composant` | — | `src/renderer/src/app-commands.test.ts › /context et /cost : chacun son encadré titré, sans rien envoyer (fiche 126)` |
| 11 | /context et /cost : deux encadrés, chacun son titre | Chaque bilan a son encadré titré | `doublon` | — | `app-commands.test.ts › /context et /cost : chacun son encadré titré, sans rien envoyer (fiche 126)` |
| 12 | /mode : liste des modes, l'actuel marqué | `/mode` sans argument liste les modes | `composant` | `src/renderer/src/app-commands.test.ts` (`/mode` comme `/model`) | partiel : `app-commands.test.ts › /model sans argument : la liste des choix, le choix courant marqué` |
| 13 | /mode plan : mode changé par son nom, puce à jour | Le mode est demandé à l'agent et la puce suit sa confirmation | `doublon` | — | `src/shared/app-commands.test.ts › option choisie par son nom, exact ou unique` + `e2e/suites/parcours-matinee.mjs` étape 11 (mode changé, appliqué) |
| 14 | /help : commandes de l'agent et de l'app | `/help` liste les deux | `doublon` | — | `app-commands.test.ts › /help liste les commandes de l'agent puis celles de l'app` |
| 15 | /compact : commande de compaction de l'agent, compaction affichée | `/compact` envoie la commande de l'agent ; la compaction s'affiche | `doublon` | — | `app-commands.test.ts › /compact envoie la commande de l'agent, ou dit qu'il ne sait pas` + `src/shared/transcript.test.ts › compaction : élément créé, résumé en morceaux, statut mis à jour` |
| 16 | /compress répondu en texte : carte « Conversation résumée » | Réponse texte à une compaction = carte, pas un message | `doublon` | — | `src/shared/transcript.test.ts › réponse en texte à la commande de compaction : carte « Conversation résumée » (fiche 126)` |
| 17 | /clear : nouvelle conversation vide, même agent, même dossier | `/clear` ouvre une conversation neuve avec les mêmes réglages | `composant` | — | `app-commands.test.ts › /clear ouvre une conversation avec le même agent et le même dossier` |

**Verdict** : disparaitre — aucune vérification ne dépend d'un enchaînement réel que les parcours ne couvrent pas déjà ; 3 tests de composant à écrire (#2, #8, #12), 2 captures (#3, #4).
**Risques** :
- La réception réelle de `available_commands_update` (ACP) jusqu'au menu n'est plus vue nulle part si aucun parcours ne tape « / » : en ajouter un passage dans `parcours-matinee`.
- Le placement du menu (#4) dépend de la vraie mise en page : jsdom ne le calcule pas.

### `composer.mjs` — zone de saisie : focus après les menus, infobulles, liste des modèles, repli de la barre, mode Plan visible, premier envoi pendant le démarrage de l'agent

<!-- stats suite=composer total=53 parcours=5 composant=18 unitaire-main=0 capture=7 doublon=23 couvert=39 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | accueil : dossier sur la ligne sous la saisie, plus dans la barre | `workspace-menu` est rendu dans `.composer-context`, pas dans `.composer-bar` | `composant` | `src/renderer/src/components/composer/Composer.test.tsx` (nouveau it) | non |
| 2 | après un choix de mode, focus rendu à la saisie | fermer le menu du mode par un choix rend le focus à la zone de saisie | `composant` | `src/renderer/src/components/composer/Composer.test.tsx` (choix dans le menu du mode, puis `activeElement`) | non |
| 3 | … sans infobulle ouverte | le focus rendu ne laisse pas d'infobulle ouverte sur la puce | `composant` | même test que #2 | non |
| 4 | clic dans la saisie juste au-dessus de la puce, frappe : texte dans la saisie | un vrai clic de souris à l'endroit où s'ouvrait l'infobulle atteint la saisie (bug du 2026-10-20) | `parcours` | `parcours-matinee`, étape 11 (après le choix du mode : vrai clic dans la saisie et frappe, au lieu de `ui.send`) | non |
| 5 | Entrée envoie le message | Entrée envoie et vide la saisie | `doublon` | — | `src/renderer/src/components/composer/Composer.test.tsx › Entrée envoie le message, Maj+Entrée non` |
| 6 | fil remonté, message envoyé : retour en bas, bulle visible | envoyer avec le fil remonté ramène en bas, sans la flèche | `doublon` | — | `src/renderer/src/useThreadScroll.test.ts › message envoyé fil remonté : retour en bas tout de suite, la bulle et la réponse suivies (D26)` ; `parcours-longue`, étape 3 |
| 7 | … réponse suivie jusqu'en bas (waitFor) | la réponse qui arrive reste suivie | `doublon` | — | même test que #6 |
| 8 | une infobulle ouverte sur la saisie ne prend pas le pointeur | `.tooltip` en `pointer-events: none` : le point sous l'infobulle est la saisie | `composant` | test qui lit la règle CSS `.tooltip` (à côté de `src/renderer/src/title-tooltips.test.ts`) | non |
| 9 | un clic à travers l'infobulle met le curseur dans la saisie | même contrat que #4/#8 (clic réel à travers l'infobulle) | `doublon` | — | partiel : même contrat que #4 et #8 |
| 10 | Échap ferme le menu et rend le focus à la puce | fermer le menu du mode au clavier rend le focus à la puce | `composant` | `src/renderer/src/components/composer/Composer.test.tsx` (nouveau it) | non |
| 11 | liste longue : curseur dans la recherche | la liste longue s'ouvre avec la recherche focalisée | `doublon` | — | `src/renderer/src/components/common/ModelChip.test.tsx › longue liste : recherche focalisée, filtre, ↑ ↓ Entrée` |
| 12 | liste longue (≥30) : dans la fenêtre, avec défilement | le menu tient dans la fenêtre et sa liste défile | `composant` | `src/renderer/src/components/composer/menu-placement.test.ts` | partiel : `menu-placement.test.ts › caps the height to the room above when above is the larger side but too small` |
| 13 | ouverte sur le modèle en cours, visible et en surbrillance | le modèle en cours est sélectionné, en surbrillance et amené dans la partie visible de la liste | `composant` | `src/renderer/src/components/common/ModelChip.test.tsx` (vérifier l'appel à `scrollIntoView`) | partiel : `ModelChip.test.tsx › longue liste : recherche focalisée…` (surbrillance, pas la visibilité) |
| 14 | ligne : nom court, fournisseur à part | chaque option montre le nom court et le fournisseur séparément | `doublon` | — | `ModelChip.test.tsx › courte liste : pas de recherche, ouverte sur le modèle en cours, groupes affichés` ; `› nom court : ce qui suit le dernier « / »…` |
| 15 | recherche, ↓, Entrée : modèle choisi, focus rendu à la saisie | le choix au clavier règle le modèle puis rend le focus à la saisie | `composant` | `ModelChip.test.tsx` + focus rendu dans `Composer.test.tsx` | partiel : `ModelChip.test.tsx › longue liste : recherche focalisée, filtre, ↑ ↓ Entrée` (sans le focus rendu) |
| 16 | le modèle choisi est appliqué par l'agent | le changement de modèle va jusqu'à l'agent par ACP | `doublon` | — | `parcours-matinee`, étape 11 (modèle et mode changés, appliqués par `echo`) |
| 17 | fenêtre large : barre complète (capture, %, nom du mode) | niveau de repli 0 quand tout tient | `composant` | `src/renderer/src/components/composer/useBarFold.test.ts` | partiel : `useBarFold.test.ts › premier niveau auquel la barre tient` |
| 18 | … aucun nom tronqué | à pleine largeur, aucune étiquette de puce n'est coupée (métrique réelle des polices) | `capture` | capture nocturne `composer-4-barre-large` | non |
| 19 | 760 px : la capture passe sous 📎, la barre tient | au premier repli la capture passe dans 📎, l'envoi reste dans la barre | `composant` | `useBarFold.test.ts` + `AttachButton.test.tsx` | partiel : `useBarFold.test.ts › essaie les niveaux dans l’ordre…` ; `AttachButton.test.tsx › avec capture d’écran, replié : un menu` |
| 20 | 760 px : rien de tronqué, sauf le modèle une fois tout replié | seul le modèle peut se tronquer, au dernier niveau | `capture` | capture nocturne `composer-5-barre-760` | partiel : `useBarFold.test.ts › le modèle cède d’abord (110 px au plus serré…)` |
| 21 | 📎 replié : « Joindre des fichiers… » et « Capturer une zone » | le menu de 📎 replié contient les deux entrées | `composant` | `src/renderer/src/components/composer/AttachButton.test.tsx` (ouvrir le menu, lire les entrées) | partiel : `AttachButton.test.tsx › avec capture d’écran, replié : un menu` (aria-haspopup seulement) |
| 22 | 📎 replié sans capture : bouton simple, sans menu | sans `screenCapture`, 📎 reste un bouton | `doublon` | — | `AttachButton.test.tsx › sans capture d’écran : bouton simple « Joindre des fichiers… »…` |
| 23 | le mode plan a son icône, distincte des autres | l'icône de la puce change en mode Plan | `composant` | `Composer.test.tsx` (classe du `svg` de `mode-chip` selon le mode) | non |
| 24 | 640 px : mode en icône, anneau seul, envoi visible | niveau ≥ 3 : libellé du mode et pourcentage masqués | `composant` | `useBarFold.test.ts` + rendu de la barre par niveau | partiel : `useBarFold.test.ts › essaie les niveaux dans l’ordre, sans dépasser le dernier` |
| 25 | 640 px : réglages sous 📎 avant que modèle et agent cèdent | ordre de repli : réglages de session avant le modèle et l'agent | `doublon` | — | `useBarFold.test.ts › les réglages de la session passent sous 📎 avant que le modèle ne cède (fiche 276, T10)` |
| 26 | 📎 replié : « Réglages de la session » en sous-menu | au dernier niveau, l'entrée des réglages est dans le menu de 📎 | `composant` | `AttachButton.test.tsx` (nouveau it) | non |
| 27 | 500 px : barre sur deux lignes, envoi visible | niveau 5 quand rien ne tient | `doublon` | — | `useBarFold.test.ts › même au plus serré, rien ne tient : la barre passe sur deux lignes` |
| 28 | 500 px, Plan : invite entière | la hauteur de la zone suit son invite quand la largeur change | `composant` | `src/renderer/src/useTextareaLayout.test.tsx` | partiel : `useTextareaLayout.test.tsx › suit la largeur : une ligne de plus quand la zone rétrécit, sans attendre le texte` |
| 29 | 500 px, Code : invite entière | même contrat que #28, autre invite | `doublon` | — | partiel : même test que #28 |
| 30 | 500 px : texte tapé entier, sans défilement | un texte tapé large garde toutes ses lignes une fois la zone rétrécie | `composant` | `useTextareaLayout.test.tsx` | partiel : même test que #28 |
| 31 | accueil à 760 px : saisie et envoi dans la fenêtre | rien ne dépasse à droite sur l'accueil étroit | `capture` | capture nocturne `composer-9-accueil-760` | non |
| 32 | accueil à 760 px : suggestions dans la fenêtre | les suggestions ne dépassent pas | `capture` | capture nocturne `composer-9-accueil-760` | non |
| 33 | accueil : dossier et branche sous la saisie | même contrat que #1 | `doublon` | — | partiel : même contrat que #1 |
| 34 | accueil à 760 px : le bouton d'envoi se clique | un clic sur Envoyer envoie le message | `composant` | `Composer.test.tsx` | partiel : `Composer.test.tsx › double Entrée, ou Entrée puis clic sur Envoyer : un seul envoi` |
| 35 | mode Code : saisie habituelle, sans rappel (transitions 150 ms) | hors Plan : pas de teinte ni de ligne de rappel | `doublon` | — | `Composer.test.tsx › hors mode Plan : ni teinte, ni ligne de rappel, invite habituelle` |
| 36 | « réduire les animations » : aucune transition du mode Plan | une règle `prefers-reduced-motion` couvre `.composer`, `.mode-chip`, `.composer-plan-hint` | `composant` | test qui lit la feuille CSS (nouveau, `src/renderer/src/…/reduced-motion.test.ts`) | non |
| 37 | Plan : bordure et halo de la couleur du plan, fond teinté | rendu visuel de la zone en mode Plan | `capture` | capture nocturne `composer-10-plan` | partiel : `Composer.test.tsx › mode Plan (fiche 098)…` (`data-plan`) |
| 38 | la puce devient une pastille « Plan » colorée | rendu de la puce en mode Plan | `capture` | capture nocturne `composer-10-plan` | partiel : `Composer.test.tsx › mode Plan (fiche 098)…` |
| 39 | invite du mode Plan | placeholder « Explorer et planifier avec … » | `doublon` | — | `Composer.test.tsx › mode Plan (fiche 098) : zone teintée, invite et ligne de rappel, Maj+Tab vers le mode suivant` |
| 40 | ligne de rappel sous la saisie, au-dessus du dossier | texte de `plan-hint` (et sa place) | `doublon` | — | même test que #39 (texte ; la place reste à la capture) |
| 41 | contraste AA : ligne de rappel et pastille | couleurs du Plan lisibles | `doublon` | — | `src/shared/themes.test.ts › ${palette}, accent ${accent} : contrastes AA` (paires `plan`/`bg` et `plan`/`planSoft`) |
| 42 | l'envoi garde l'accent, distinct du Plan | le Plan ne recolore pas l'envoi, Plan ≠ accent | `doublon` | — | partiel : `themes.test.ts › le mode Plan reste distinct de l’accent` |
| 43 | en conversation : toujours Plan, même invite | après un tour réel (`plan-fichier`), le mode courant renvoyé par l'agent reste Plan | `parcours` | `parcours-matinee`, étape 11 (passer en Plan, un tour, le mode reste) | partiel : `parcours-matinee`, étapes 11 et 13 (mode gardé, mais pas Plan) |
| 44 | fenêtre étroite : la puce repliée en icône garde la couleur | rendu replié en Plan | `capture` | capture nocturne `composer-12-plan-640` | non |
| 45 | Maj+Tab : en Code, la saisie redevient normale | Maj+Tab mène au mode suivant, rendu hors Plan | `doublon` | — | `Composer.test.tsx › mode Plan (fiche 098)…` + `› hors mode Plan…` |
| 46 | Maj+Tab deux fois : de nouveau en Plan (waitFor) | Maj+Tab boucle sur les modes | `doublon` | — | `src/renderer/src/composer-keys.test.ts › mode suivant (Maj+Tab) › option suivante, en boucle` |
| 47 | « Exécuter le plan » : en Code, saisie normale | le bouton du plan change le mode côté agent puis envoie | `parcours` | `parcours-matinee` (nouvelle étape : plan puis « Exécuter le plan ») | non |
| 48 | (×4, boucle) thème : Plan bleu ou violet, distinct de l'accent | sous accent violet le Plan passe au bleu, sinon violet, pour 4 thèmes | `doublon` | — | partiel : `themes.test.ts › le mode Plan reste distinct de l’accent` (pas le bleu/violet) |
| 49 | (×4, boucle) thème : contraste AA ligne et pastille | contraste du Plan par thème | `doublon` | — | `themes.test.ts › ${palette}, accent ${accent} : contrastes AA` |
| 50 | (×2, boucle) nouveau fil (code, discussion) : Entrée pendant le démarrage, texte reste | course réelle avec un agent qui démarre lentement : Entrée retient l'envoi | `parcours` | garder ici (une passe), ou `parcours-matinee`, étape 8 (nouvelle conversation) | partiel : `Composer.test.tsx › Entrée pendant le démarrage : le texte reste, puis part une seule fois quand l’agent est prêt` |
| 51 | (×2, boucle) … puis part tout seul, une fois, saisie vidée | une fois l'agent prêt (état venu du main), le message part une fois | `parcours` | garder ici avec #50 | partiel : même test que #50 |
| 52 | connexion demandée : Entrée pendant le démarrage | précondition (agent pas prêt) | `doublon` | — | `Composer.test.tsx › démarrage fini en connexion demandée (needs-action) : rien ne part, le texte reste` |
| 53 | … rien ne part : texte gardé, fil vide | démarrage fini en connexion demandée : pas d'envoi | `doublon` | — | même test que #52 |

**Verdict** : reduire. Garder 5 vérifications (#4, #43, #47, #50/#51) dans des étapes de journées types ; le reste passe en tests de composant, en captures nocturnes, ou est déjà couvert (useBarFold, ModelChip, Composer, themes).
**Risques** :
- le repli de la barre et les troncatures dépendent des vraies polices ; jsdom n'a pas de mise en page, seules les captures le verront ;
- focus réel et infobulles Radix (délais, pointeur) : jsdom les simule mal (#2, #4, #8) ;
- couleurs calculées (`color-mix`, transparence) : `themes.test` vérifie les jetons, pas le rendu.

### `custom-agent.mjs` — agent ACP déclaré par l'utilisateur dans Réglages › Agents : formulaire, page, conversation, session neuve après redémarrage (agent sans reprise), modifier, supprimer

<!-- stats suite=custom-agent total=9 parcours=3 composant=5 unitaire-main=1 capture=0 doublon=0 couvert=8 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Réglages › Agents : « Ajouter un agent ACP… » en dernière ligne | L'entrée d'ajout existe en bas de la liste des agents | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` | partiel : `SettingsDialog.test.tsx › agents ACP déclarés (fiche 141) › « Ajouter un agent ACP… » : erreurs sous leur champ, « Ajouter » grisé, puis envoyé` |
| 2 | formulaire : ligne de variable mal formée signalée sous son champ, « Ajouter » grisé | Validation en direct du formulaire | `composant` | — | `SettingsDialog.test.tsx › agents ACP déclarés (fiche 141) › « Ajouter un agent ACP… » : erreurs sous leur champ, « Ajouter » grisé, puis envoyé` + `src/shared/custom-agents.test.ts › rend la première ligne mal formée` |
| 3 | page de l'agent déclaré : clé d'API, « Modifier… », « Déclaré dans Bobine » | La page d'un agent déclaré montre ses éléments propres | `composant` | `SettingsDialog.test.tsx` (agent déclaré avec `apiKeyEnv`) | partiel : `SettingsDialog.test.tsx › agents ACP déclarés (fiche 141) › introuvable mais listé ; sa page : modifier, puis supprimer après confirmation` |
| 4 | déclaration enregistrée dans settings.json : commande, arguments, variables | Le formulaire devient une déclaration persistée (args découpés, env lu) | `unitaire-main` | — | `src/main/settings-store.test.ts › ajouté, modifié, retiré : réglage enregistré et liste des profils tenue à jour` + `src/shared/custom-agents.test.ts › sans erreur : l'agent, et son formulaire à l'identique` |
| 5 | l'agent déclaré répond | La commande déclarée par l'utilisateur est réellement lancée (args, env) et parle ACP | `parcours` | garder ici, ou `parcours-reglages` (nouvelle étape « déclarer un agent ») | non |
| 6 | après redémarrage : « Nouvelle session avec Agent maison », pas de lecture seule | Un agent sans `session/load` ni `resume` rouvert après redémarrage donne une session neuve dans la même conversation, repère « no-resume » | `parcours` | garder ici (fusionné avec #5, #7) | partiel : `src/main/agent/agent-host.test.ts` (raison `no-resume`) + `src/shared/handover.test.ts › contexte joint au prochain message, dit comme une session d'avant` |
| 7 | la session neuve reçoit l'échange d'avant avec le message | Le contexte de la session d'avant est joint au premier message (ADR-0030) | `parcours` | garder ici | partiel : `src/main/conversations/handover.test.ts › même conversation, nouvelle session, modèle réglé, contexte joint une seule fois` + `src/main/agent/turn-auth.test.ts › session neuve (agent sans reprise, ADR-0030)…` |
| 8 | modifier : le formulaire reprend la déclaration | « Modifier… » préremplit titre et ligne de commande | `composant` | — | `SettingsDialog.test.tsx › agents ACP déclarés (fiche 141) › introuvable mais listé ; sa page : modifier, puis supprimer après confirmation` |
| 9 | supprimé : retiré de la liste des agents | Supprimer après confirmation retire l'agent | `composant` | — | `SettingsDialog.test.tsx › … sa page : modifier, puis supprimer après confirmation` + `settings-store.test.ts › ajouté, modifié, retiré…` |

**Verdict** : reduire — garder #5-7 (déclarer → converser → redémarrer → session neuve qui reçoit le contexte), idéalement comme une étape de `parcours-reglages` ; formulaire, page, modifier et supprimer sont déjà couverts en composant.
**Risques** :
- Le découpage réel de la ligne de commande (guillemets, chemins avec espaces) jusqu'au `spawn` n'est vu qu'ici.
- Le seul agent « sans historique » joué de bout en bout est celui-ci : la bascule `no-resume` après redémarrage disparaîtrait avec la suite.

### `diagnostic.mjs` — Réglages › Diagnostic : vérifications (agents essayés hors conversation, PATH, MCP), carte Journal, rapport copié, « Signaler un problème », blocage de connexion, quitter pendant l'essai, niveaux du journal

<!-- stats suite=diagnostic total=28 parcours=7 composant=9 unitaire-main=10 capture=0 doublon=2 couvert=19 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | groupes : app, environnement, chaque agent, MCP, fournisseurs, simulateurs | Liste et ordre des groupes, iOS seulement là où le simulateur existe | `unitaire-main` | `src/main/diagnostics.test.ts` (ordre des groupes) | partiel : `src/main/diagnostics.test.ts › tout va bien : versions, dossier, PATH, Xcode, simulateurs, AXe, SDK Android` et `› sans simulateur (Linux, fiche 145) : ni groupe iOS ni commande Xcode` |
| 2 | agent factice : démarré, session d'essai prête | L'agent est réellement lancé hors conversation, `initialize` + `session/new` aboutissent | `parcours` | garder ici | partiel : `diagnostics.test.ts › prête : commande, version, session supprimée, modèles` (mise en forme seule) |
| 3 | Bob absent du PATH : facultatif, installation et « Relire le PATH » | Un agent absent n'est pas une erreur si un autre est installé, avec l'action | `unitaire-main` | — | `diagnostics.test.ts › introuvable : facultatif si un autre agent est installé, en erreur sinon` |
| 4 | PATH du shell de connexion lu | Le PATH du shell de connexion est relu (`zsh -ilc`) | `unitaire-main` | — | partiel : `src/main/shell-env.test.ts › repli : zsh de connexion interactif sous macOS, sh de connexion ailleurs` et `› extrait les variables malgré le bruit des fichiers rc…` |
| 5 | facultatifs : AXe absent, aucun serveur MCP | Absences non bloquantes marquées « facultatif » | `unitaire-main` | `diagnostics.test.ts` (cas « aucun MCP ») | partiel : `diagnostics.test.ts › facultatifs : ni Xcode ni AXe` |
| 6 | la carte Journal suit le résumé | Position de la carte Journal dans la page | `composant` | `src/renderer/src/components/settings/Diagnostics.test.tsx` (à créer) | non |
| 7 | main.log et agents.log, « Afficher dans le Finder », puis le niveau | Contenu de la carte Journal | `composant` | idem #6 | non |
| 8 | plus de chemin des journaux dans « Bobine » | Le groupe « app » ne répète plus le chemin des journaux | `unitaire-main` | `diagnostics.test.ts` (pas de vérification `log`) | non |
| 9 | l'icône du Finder montre main.log | Le bouton demande au main de montrer `main.log` | `composant` | idem #6 (clic → API `revealLog('main')`) | non |
| 10 | rapport copié : une ligne par vérification | Le rapport texte copié a une ligne par vérification et les marques ✓/– | `composant` | idem #6 (copie) | partiel : `src/shared/diagnostics.test.ts › une ligne par vérification, la marche à suivre dessous` |
| 11 | « Signaler un problème » : issue préremplie, version, rapport, ≤ 8 000 car. | Lien GitHub avec gabarit, version et rapport | `doublon` | — | `src/shared/issue-url.test.ts › gabarit bug.yml, version et rapport dans les champs du gabarit` et `› rapport trop long : coupé…` |
| 12 | clic : ouvert dans le navigateur système, pas dans l'app | Les liens externes passent par `shell.openExternal` | `unitaire-main` | — | partiel : `src/main/ipc.test.ts › liens web (fiche 154) : adresse locale dans le navigateur intégré, le reste dans celui du Mac` |
| 13 | aucune conversation dans l'historique | L'essai du diagnostic ne crée pas de conversation | `unitaire-main` | `src/main/diagnostics.test.ts` (ou test de l'essai d'agent) | non |
| 14 | session d'essai supprimée chez l'agent | La session ouverte pour l'essai est supprimée côté agent (liste de reprise vide) | `parcours` | garder ici (fusionné avec #2) | partiel : `diagnostics.test.ts › prête : commande, version, session supprimée, modèles` |
| 15 | Aide › Diagnostic… ouvre la page | Le menu natif ouvre la page via l'IPC | `parcours` | garder ici (une ligne) ou étape de `parcours-reglages` | partiel : `src/main/menu.test.ts` (élément de menu) |
| 16 | « Relancer » refait les vérifications | Le bouton relance la série, états « en cours » puis finis | `composant` | idem #6 | non |
| 17 | connexion requise : en erreur, avec les façons de se connecter | Le blocage d'auth devient une vérification en erreur avec SSO et clé d'API | `unitaire-main` | — | `diagnostics.test.ts › blocages : dossier, connexion, licence, avec la marche à suivre` |
| 18 | résumé : 1 problème | Le résumé compte les erreurs | `composant` | — | `src/shared/diagnostics.test.ts › résumé et pastille d'un groupe` |
| 19 | action « Réglages › Agents » : la page de l'agent, avec ses clés | L'action de la vérification ouvre la bonne page de Réglages | `composant` | idem #6 / `SettingsDialog.test.tsx` | non |
| 20 | essai de l'agent en cours (2 agents : conversation et essai) | Deux processus agents réels coexistent pendant l'essai | `parcours` | garder ici | non |
| 21 | quitter pendant l'essai : aucun agent ne survit à l'app | Même un agent qui ignore SIGTERM est tué à la sortie de l'app | `parcours` | garder ici | partiel : `src/main/process-registry.test.ts › reapOrphans : un SIGTERM par groupe retenu…` + `src/main/jobs/command-job.test.ts › en quittant (fiche 195)…` |
| 22 | journal : Normal par défaut, réglable | Valeur par défaut du sélecteur de niveau | `composant` | idem #6 | partiel : `src/shared/preferences.test.ts › niveau du journal (fiche 080) : Normal ou Détaillé enregistrés, jamais Trace` |
| 23 | Détaillé, à chaud : échanges ACP et appels MCP dans agents.log, sans contenu | Le niveau changé dans l'UI s'applique sans relance aux vrais échanges ACP et outils MCP | `parcours` | garder ici | partiel : `src/main/log.test.ts › agents.log (fiche 080) : rien au niveau Normal, une ligne par échange en Détaillé…` + `src/main/agent/agent-process.test.ts › journal Détaillé : échanges et sortie d'erreur dans agents.log…` |
| 24 | Trace : extraits du contenu (message, arguments des outils) | Au niveau Trace, le contenu apparaît | `parcours` | garder ici (fusionné avec #23) | partiel : `agent-process.test.ts › journal sur Trace : variables du profil pour le journal de l'agent (fiche 165)` |
| 25 | main.log : agent lancé, tours, niveau changé | Lignes attendues dans main.log | `unitaire-main` | `src/main/log.test.ts` | partiel : `agent-process.test.ts › journal Détaillé : … lancement et arrêt dans main.log` |
| 26 | Trace n'est pas enregistré (Détaillé l'est) | Trace n'est jamais persisté | `unitaire-main` | — | `src/shared/preferences.test.ts › niveau du journal (fiche 080) : Normal ou Détaillé enregistrés, jamais Trace` |
| 27 | relancée : de nouveau Détaillé, pas Trace | Après redémarrage, le niveau persistant revient | `doublon` | — | `preferences.test.ts › niveau du journal…jamais Trace` + `src/main/settings.test.ts › préférences lues avant que l'app soit prête…` |
| 28 | BOBINE_LOG impose le niveau : réglage grisé, et dit pourquoi | Une variable d'env impose le niveau, l'UI le montre | `composant` | idem #6 (prop « imposé ») | non |

**Verdict** : reduire — garder 7 vérifications en 3 blocs : essai réel de l'agent hors conversation et session supprimée (#2, #14, #15), quitter pendant l'essai sans survivant (#20-21), journal à chaud sur de vrais échanges ACP/MCP (#23-24). Une page `Diagnostics.test.tsx` (à créer) reprend la carte Journal, le rapport, Relancer, l'action et `BOBINE_LOG`.
**Risques** :
- Aucun test de composant n'existe aujourd'hui pour la page Diagnostic : 9 lignes reposent sur un fichier à écrire.
- Le PATH réduit et le shell de connexion simulé (`SHELL`) ne sont joués qu'ici : la lecture réelle de `zsh -ilc` n'a pas d'autre essai.
- L'agent « tenace » qui ignore SIGTERM ne se reproduit pas sans vrais processus.

### `export.mjs` — export Markdown et JSON d'une conversation (fenêtre native remplacée) et sauvegarde de l'historique

<!-- stats suite=export total=5 parcours=0 composant=0 unitaire-main=3 capture=0 doublon=2 couvert=5 verdict=disparaitre -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | export Markdown : fichier écrit | le menu « … » écrit un `.md` du fil | `doublon` | — | `parcours-outils`, étape 7 (export Markdown de toute la journée) |
| 2 | export Markdown : une seule extension malgré la fenêtre | le main retire l'extension doublée par la fenêtre de macOS | `unitaire-main` | test du gestionnaire IPC d'export (main, `showSaveDialog` simulé) | partiel : `src/shared/export.test.ts › withExtension (fiche 247, D14) › une seule extension, casse ignorée` |
| 3 | export JSON : fichier `bobine-conversation` | l'export JSON écrit le fil complet | `unitaire-main` | même test IPC que #2 | partiel : `src/shared/export.test.ts › JSON : fil complet, réimportable` |
| 4 | export JSON : une seule extension | idem #2 pour `.json` | `unitaire-main` | même test IPC que #2 | partiel : `export.test.ts › withExtension…` |
| 5 | sauvegarde de l'historique : dossier avec `index.json` | Réglages › Données › Sauvegarder copie les conversations | `doublon` | — | `src/main/conversations/backup.test.ts › copie datée de tout le profil, sans clés d’API ni fichier temporaire, avec sa description` |

**Verdict** : disparaitre. Le Markdown est déjà dans `parcours-outils` ; il manque un test du gestionnaire IPC d'export (main) qui branche `withExtension` sur le chemin rendu par la fenêtre.
**Risques** :
- le câblage réel bouton des Réglages → IPC → sauvegarde (aucun test de composant du bouton `settings-backup` n'existe).

### `filles-fusion.mjs` — fusion enchaînée des trois travaux d'une carte de groupe dans un vrai dépôt : recouvrement, fille non commitée, dossier principal non commité (« Committer d'abord », « Mettre de côté »), conflit résolu par la fille, « Puis nettoyer », redémarrage

<!-- stats suite=filles-fusion total=14 parcours=4 composant=0 unitaire-main=0 capture=0 doublon=10 couvert=13 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | trois travaux sur les lignes de leur carte : ni « Sous-tâches » ni compte rendu séparé | Les travaux lancés restent des lignes de la carte de groupe | `doublon` | — | `src/renderer/src/components/thread/WorkGroup.test.tsx › « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé` |
| 2 | trois filles, chacune dans son worktree | « Tout lancer » crée trois filles, chacune dans son worktree | `doublon` | — | `e2e/suites/parcours-deleguer.mjs` étape 1 (« trois travaux finis, chacun dans son worktree ») |
| 3 | pied de carte : deux prêtes, recouvrement sur README.md, la troisième non commitée et dite | Le plan lu dans le vrai git donne la phrase d'état et « Fusionner les 2 » | `doublon` | — | `SubtasksMerge.test.tsx › pied de carte : phrase d'état, « Fusionner les N »…` ; `src/main/conversations/children-merge.test.ts › recouvrement détecté…` et `› fille avec des modifications non commitées : exclue du plan, sautée si demandée` |
| 4 | « Fusionner les 3 dans main », « Puis nettoyer » décoché par défaut | Une fois les trois commitées, le bouton les compte toutes ; le nettoyage n'est pas coché par défaut | `doublon` | — | `SubtasksMerge.test.tsx › pied de carte : … « Puis nettoyer » en bascule` ; `parcours-deleguer.mjs` étape 3 |
| 5 | fusion refusée d'avance : dossier principal non commité (fichiers) | Si le dossier de la mère n'est pas commité, la carte dit pourquoi, avec les fichiers, et ne propose pas de fusionner | `doublon` | — | `SubtasksMerge.test.tsx › dit pourquoi avec les fichiers ; pas de « Fusionner »…` ; `children-merge.test.ts › plan refusé avec les fichiers ; départ refusé ; rien n'avance` |
| 6 | « Committer d'abord » : message rédigé par l'agent de la mère | Le brouillon de commit est demandé à l'agent de la mère par ACP et reste modifiable | `parcours` | `parcours-deleguer`, étape 4 (à enrichir) ou garder ici | partiel : `SubtasksMerge.test.tsx › « Committer d'abord » : message proposé modifiable…` ; `parcours-matinee` étape 7 (message rédigé par l'agent, autre écran) |
| 7 | en cours : celles d'avant fusionnées, une en conflit résolu par son travail, les suivantes en attente | L'état passager pendant la résolution du conflit par la fille (vrai tour ACP) arrive bien à l'écran | `parcours` | garder ici | partiel : `children-merge.test.ts › conflit sur la deuxième : la fille le résout…` ; `SubtasksMerge.test.tsx › en cours : état de chaque ligne…` ; `WorkGroup.test.tsx › conflit pendant la fusion : le travail (occupé) le résout…` |
| 8 | pendant la fusion : modifications de la mère mises de côté, c'est dit | La carte dit la mise de côté pendant la fusion | `doublon` | — | `SubtasksMerge.test.tsx › mise de côté dite pendant la fusion, puis à la fin…` ; `children-merge.test.ts › « Mettre de côté » : une mise de côté pour la chaîne…` |
| 9 | fin : « … fusionnés … nettoyées … revenues » | Texte de fin : durée, nettoyage, modifications revenues | `doublon` | — | `SubtasksMerge.test.tsx › finie : « 2 travaux fusionnés dans main en 12 s »…` et `› fin : modifications revenues` |
| 10 | consigne de conflit partie au travail, avec sa provenance | La consigne de conflit est envoyée à la fille avec `from: merge` | `doublon` | — | `children-merge.test.ts › conflit sur la deuxième…` (vérifie `prompts[0].from` = merge) |
| 11 | main a les trois filles, conflit résolu ; modifications de la mère revenues | Résultat réel sur le disque : fichiers fusionnés, TODO/brouillon rendus, stash vide | `parcours` | `parcours-deleguer`, étape 4 (ajouter la mise de côté) | partiel : `parcours-deleguer.mjs` étape 4 (sans mise de côté) ; `children-merge.test.ts › « Mettre de côté »…` |
| 12 | « Puis nettoyer » : worktrees et branches supprimés | Après la fusion, les branches `bobine/*` et les worktrees disparaissent | `doublon` | — | `children-merge.test.ts › « Puis nettoyer » : filles fusionnées archivées, worktrees et branches supprimés` (vrai git) |
| 13 | chaque ligne : « fusionné » seul | Chaque ligne n'affiche que « fusionné » | `doublon` | — | `WorkGroup.test.tsx › une colonne d'état : « fusionné » seul remplace « a répondu »…` |
| 14 | après redémarrage : la carte dit toujours la fusion faite | Le résultat de la fusion survit à un redémarrage dans le fil de la mère | `parcours` | `parcours-deleguer`, étape 10 (relance) | non |

**Verdict** : reduire — garder 6, 7, 11 et 14. On peut les verser dans `parcours-deleguer` (étape 4 avec un dossier principal non commité, étape 10 avec la carte relue après la relance), puis faire disparaître la suite. Ce n'est pas possible tant que `parcours-deleguer` reste rouge à l'étape 8 et que sa relance n'est pas jouée (fiche 277, défaut 2).
**Risques** :
- L'état « résout » ne dure parfois qu'un instant : seul l'e2e voit qu'il atteint l'écran au milieu d'un vrai enchaînement main ↔ agent ↔ git.
- Le verrou `index.lock` entre l'app et des commits faits au même moment.

### `filles-visibilite.mjs` — fille lancée depuis le menu du titre avec un worktree volontairement lent : préparation visible, fille publiée, Récents ou dossier repliés révélés

<!-- stats suite=filles-visibilite total=7 parcours=2 composant=0 unitaire-main=0 capture=0 doublon=5 couvert=6 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | préparation visible pendant la création du worktree (×3, boucle) | Pendant la création du worktree (lente, vrai hook git), une ligne provisoire « Création du worktree… » apparaît sans attendre la première réponse | `parcours` | garder ici (un seul lancement suffit) ou `parcours-deleguer` | partiel : `src/renderer/src/components/sidebar/Sidebar.test.tsx › la préparation révèle la section, sans commande sur la ligne provisoire ; remplacement sans doublon` |
| 2 | fille publiée à la fermeture du dialogue (×3, boucle) | À la fermeture du dialogue, la fille est une vraie conversation (pas un brouillon), qui passe ensuite à busy | `parcours` | garder ici | non |
| 3 | section ouverte : fille visible sous sa mère pendant son premier tour | La fille s'affiche, imbriquée sous sa mère, avant la fin de son tour | `doublon` | — | `Sidebar.test.tsx › nouvelle fille : visible dès la liste reçue, même sous le pointeur (diagnostic 149)` |
| 4 | Récents replié : le lancement révèle immédiatement la fille | Une nouvelle fille rouvre Récents | `doublon` | — | `Sidebar.test.tsx › une nouvelle fille révèle Récents replié` |
| 5 | la nouvelle fille reste sous sa mère dans Récents | Imbrication gardée après le dépliage | `doublon` | — | `Sidebar.test.tsx › une nouvelle fille révèle Récents replié` (`m ↳new`) |
| 6 | dossier replié : le lancement révèle immédiatement la fille | En regroupement par dossier, une nouvelle fille déplie son dossier | `doublon` | — | `Sidebar.test.tsx › une nouvelle fille révèle son dossier et reste sous sa mère quand elle attend` |
| 7 | les trois filles en cours restent sous leur mère | Plusieurs filles en cours restent toutes imbriquées | `doublon` | — | `Sidebar.test.tsx › sous sa mère, son état à droite ; plus d'icône git (fiche 131)` |

**Verdict** : reduire — garder 1 et 2, en un seul lancement (pas trois). Les révélations de section sont déjà testées dans `Sidebar.test.tsx`. On peut aussi déplacer ce lancement dans une journée type : « Lancer en parallèle… » depuis le menu du titre, avec un hook lent, dans `parcours-deleguer`.
**Risques** :
- L'ordre des évènements quand le worktree est lent : la ligne provisoire arrive avant la liste publiée, puis la remplace sans doublon. Un test de composant ne joue que des rendus successifs choisis à la main.

### `fresh-start.mjs` — Recommencer à neuf : profil temporaire (pastille, dossier temporaire supprimé à la fermeture), puis réinitialisation (confirmation, Bobine quitte, dossier en corbeille avec un LISEZ-MOI)

<!-- stats suite=fresh-start total=11 parcours=3 composant=0 unitaire-main=0 capture=1 doublon=7 couvert=10 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | profil temporaire : la pastille dans la barre de titre | `--profil-temporaire` affiche la pastille « Profil temporaire » | `doublon` | — | `src/renderer/src/components/settings/FreshStart.test.tsx › profil temporaire : pas de section, une pastille dans la barre de titre` ; `src/main/fresh-start.test.ts › profil temporaire : dossier neuf…` |
| 2 | pastille : fiole seule dans un en-tête étroit, entière sinon | Dans un en-tête étroit (700 px), la pastille se réduit à son icône, avec le texte en infobulle | `capture` | capture nocturne (en-tête étroit) | non |
| 3 | dossier de données dans les fichiers temporaires | userData est créé sous `tmpdir()/bobine-profil-` | `doublon` | — | `fresh-start.test.ts › profil temporaire : dossier neuf dans les fichiers temporaires, supprimé à la fermeture` |
| 4 | profil temporaire : pas de « Recommencer à neuf » dans Données | La section est masquée en profil temporaire | `doublon` | — | `FreshStart.test.tsx › profil temporaire : pas de section…` |
| 5 | fermée, la Bobine temporaire ne laisse rien | Quand l'app quitte vraiment, son dossier temporaire est supprimé | `parcours` | garder ici | partiel : `fresh-start.test.ts › profil temporaire : … supprimé à la fermeture` et `› will-quit émis deux fois (attente des processus, fiche 195) : un seul nettoyage` |
| 6 | confirmation : les conversations comptées, avec leur taille | Le nombre de conversations annoncé est celui des fichiers sur le disque | `doublon` | — | `src/main/reset.test.ts › tailles par groupe, nombre de conversations, dossiers hors du dossier de données` ; `FreshStart.test.tsx › « Réinitialiser… » : ce qui part, avec les tailles…` |
| 7 | confirmation : conversations, réglages, consommation, navigateur, le reste | Les cinq groupes, dans cet ordre | `doublon` | — | `FreshStart.test.tsx › « Réinitialiser… » : ce qui part…` ; `reset.test.ts › chaque entrée du dossier de données dans son groupe` |
| 8 | app non installée, dossier imposé : ni désinstallation, ni trousseau, « Tout effacer et fermer » | En développement, avec un dossier imposé : pas de désinstallation, pas de trousseau, et le bouton dit « fermer » | `doublon` | — | `FreshStart.test.tsx › app non installée (développement) : pas de case, Bobine se ferme sans relance` |
| 9 | « Garder » : rien n'est effacé | « Garder » referme la confirmation sans rien effacer | `doublon` | — | `FreshStart.test.tsx › « Réinitialiser… » : … « Garder » n'efface rien` |
| 10 | confirmé : Bobine quitte, son dossier part dans un dossier daté de la corbeille | Une fois confirmé, l'app quitte et l'assistant détaché (/bin/sh) déplace le dossier de données | `parcours` | garder ici | partiel : `reset.test.ts › lancé détaché par /bin/sh, jamais en mode Node (fusible RunAsNode coupé)` |
| 11 | corbeille : dossier de données et LISEZ-MOI qui dit d'où il vient | Le vrai script écrit le LISEZ-MOI avec le chemin d'origine | `parcours` | garder ici | partiel : `reset.test.ts › dossier daté sans « : »…` ; `src/main/reset-windows.test.ts` (Windows seulement) |

**Verdict** : reduire — garder 5, 10 et 11 (quitter pour de bon, assistant détaché, fichiers réels). Le reste est déjà couvert par `FreshStart.test.tsx`, `fresh-start.test.ts` et `reset.test.ts`. La pastille étroite (2) passe en capture.
**Risques** :
- L'assistant détaché tourne après la mort de l'app : seul un vrai lancement montre qu'il finit son travail (déplacement, LISEZ-MOI).
- Le ménage de `will-quit` sur un vrai arrêt d'Electron.

### `gitlab.mjs` — « Ouvrir une MR » sur un GitLab auto-hébergé avec un faux `glab` : non connecté, MR ouverte, « Pousser vers la MR », hôte injoignable, forge inconnue (fiche 189)

<!-- stats suite=gitlab total=16 parcours=1 composant=5 unitaire-main=0 capture=0 doublon=10 couvert=15 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | waitFor bouton « Ouvrir une MR » | Hôte déclaré dans la config de glab → forge GitLab, libellé « MR » (pas « PR ») | `composant` | `src/renderer/src/components/panel/WorktreeBar.test.tsx` (à créer : libellé selon `forge.kind`) | partiel : `src/main/changes/forge.test.ts › configuration de glab et de gh lue sans rien lancer` ; `src/main/changes/worktree-cycle-forge.test.ts › branche poussée, MR vers la base…` (côté main, pas le libellé) |
| 2 | waitFor raison `notLogged_mr` sous le bouton | glab pas connecté : la commande à lancer est dite avec l'hôte | `composant` | `WorktreeBar.test.tsx` (à créer) | partiel : `src/renderer/src/components/panel/worktree-outcome.test.ts › grisé avec la raison quand l’utilisateur peut y remédier` ; `worktree-cycle-forge.test.ts › glab absent, non connecté, révoqué, injoignable…` |
| 3 | « Ouvrir une MR » désactivé (glab non connecté) | Bouton grisé tant que glab n'est pas connecté | `composant` | `WorktreeBar.test.tsx` (à créer) | partiel : `worktree-outcome.test.ts › grisé avec la raison quand l’utilisateur peut y remédier` |
| 4 | une seule issue sous les boutons (non connecté) | Jamais plus d'une erreur/note sous les boutons | `doublon` | — | `src/renderer/src/components/panel/worktree-outcome.test.ts › gardée tant que le worktree, l’état de la forge et « Actualiser » sont les mêmes` ; `WorktreeBarOutcome.test.tsx › issue unique…` |
| 5 | formulaire : « Pousser et ouvrir la MR » | Libellé du bouton de confirmation en variante MR | `composant` | `WorktreeBar.test.tsx` (à créer) | non |
| 6 | une seule issue (formulaire) | idem 4 | `doublon` | — | `worktree-outcome.test.ts › une seule issue dans la barre du worktree…` |
| 7 | MR ouverte : branche poussée, MR vers main, lien, pas de carte de suivi | Bout en bout : commit rédigé par l'agent, `git push` réel vers le dépôt nu, `glab mr create --source-branch --target-branch=main --yes`, lien affiché, pas de `pr-card` pour GitLab | `parcours` | garder ici (ou variante GitLab de `pr-ci`) | partiel : `worktree-cycle-forge.test.ts › branche poussée, MR vers la base (-R du dépôt poussé), lien, MR retrouvée…` (main seul) |
| 8 | une seule issue (MR ouverte) | idem 4 | `doublon` | — | `worktree-outcome.test.ts › une seule issue…` |
| 9 | waitFor « Pousser vers la MR » après commit au terminal + Actualiser | Commit fait hors de l'app vu par « Actualiser » | `doublon` | `pr-ci` (même contrat côté GitHub) | `e2e/suites/pr-ci.mjs › « Actualiser » : le commit fait dans un terminal est vu…` ; `src/renderer/src/useWorktreeCycle.test.ts › « Actualiser » demande au main de relire aussi gh (D7)` |
| 10 | une seule issue (pousser) | idem 4 | `doublon` | — | `worktree-outcome.test.ts › une seule issue…` |
| 11 | « Pousser vers la MR » : branche poussée, MR existante retrouvée | Seconde poussée, MR existante réutilisée, note « existed » | `doublon` | — | `worktree-cycle-forge.test.ts › branche poussée, MR vers la base…, MR retrouvée, « Pousser vers la MR »` |
| 12 | hôte injoignable : message clair, pas la sortie brute | Erreur réseau traduite, sans `dial tcp` | `doublon` | — | `worktree-cycle-forge.test.ts › glab absent, non connecté, révoqué, injoignable, certificat…` ; `src/main/changes/forge.test.ts › ligne utile de glab, sans cadre ni fichier de reprise` |
| 13 | une seule issue (injoignable) | idem 4 | `doublon` | — | `worktree-outcome.test.ts › une seule issue…` |
| 14 | waitFor raison `unknownForge` avec l'hôte | Forge inconnue après changement d'URL : raison et hôte dits | `composant` | `WorktreeBar.test.tsx` (à créer : rendu du texte) | partiel : `worktree-cycle-forge.test.ts › hôte inconnu : GitHub comme avant… « Actualiser » le dit inconnu` |
| 15 | forge inconnue : pas de bouton | Aucun bouton PR/MR pour une forge inconnue | `doublon` | — | `worktree-outcome.test.ts › forge inconnue : pas de bouton, la raison seulement avec des commits à proposer` |
| 16 | après « Actualiser » : plus d'erreur ni de note d'avant | Issue effacée par « Actualiser » / autre hôte | `doublon` | — | `worktree-outcome.test.ts › effacée par « Actualiser » et par un autre worktree, quelle que soit sa source` |

**Verdict** : reduire — garder la seule vérification 7 (MR ouverte de bout en bout), idéalement comme variante GitLab dans `pr-ci` ou une étape de journée type. Le reste est déjà couvert côté main (`worktree-cycle-forge`, `forge`) et côté règle d'issue ; il manque un `WorktreeBar.test.tsx` pour les libellés MR.
**Risques** :
- La détection GitLab par le vrai fichier `config.yml` lu par le main avec `GLAB_CONFIG_DIR` (environnement du processus packagé) ne serait plus vue qu'en 7.
- Les 5 `ISSUES ≤ 1` mesurent le DOM réel après de vraies réponses asynchrones de la forge ; le test de la règle pure ne verrait pas un second composant qui afficherait sa propre erreur.

### `history.mjs` — Historique : infobulle, recherche dans le contenu et ⌘F, brouillons, ligne et clic droit, épinglage, dossiers, suppression (fiches 026, 086, 131, 149, 155, 276)

<!-- stats suite=history total=17 parcours=1 composant=9 unitaire-main=0 capture=1 doublon=6 couvert=14 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | infobulle : titre complet, identique survol/clavier, une seule | La bulle de l'app remplace la native, au survol comme au focus | `composant` | `src/renderer/src/title-tooltips.test.ts` (ajouter : focus clavier) | partiel : `src/renderer/src/title-tooltips.test.ts › remplace l’infobulle native au survol, puis rend le title` ; `src/renderer/src/components/sidebar/Sidebar.test.tsx › questions, autorisations… ; détails dans l’infobulle` |
| 2 | recherche dans le contenu : bonne conversation, extrait, mots surlignés | Le mot présent seulement dans un message est trouvé, extrait et `mark` | `doublon` | `parcours-outils`, étape « retrouver la première par la recherche » | `src/shared/conversation-search.test.ts › extrait autour du premier mot, mots surlignés…` ; `src/main/conversations/content-search.test.ts › fils sur le disque lus une fois…` ; `e2e/suites/parcours-outils.mjs` étape 6 |
| 3 | ⌘K → ⌘F : recherche reprise, premier résultat surligné, focus | Ouvrir un résultat de ⌘K ouvre la barre ⌘F avec la même requête | `composant` | `src/renderer/src/useThreadFind.test.tsx` (ajouter : requête transmise depuis la recherche) | partiel : `src/renderer/src/useThreadFind.test.tsx › le contenu d’une carte change pendant la recherche : le compte suit` |
| 4 | « PÔINTE » trouve « pointe » (waitFor) | Recherche dans le fil sans casse ni accents | `doublon` | — | `src/renderer/src/thread-find.test.ts › sans casse ni accents, positions dans le texte d’origine` |
| 5 | Échap : barre fermée, surlignage retiré | Les surlignages CSS sont nettoyés à la fermeture | `composant` | `src/renderer/src/useThreadFind.test.tsx` (à compléter) | non |
| 6 | Édition › Rechercher… (⌘F) rouvre la barre sur la dernière recherche | Commande du menu natif → IPC → renderer, dernière requête gardée | `parcours` | `parcours-longue` (étape « le sommaire… ») ou garder ici | non |
| 7 | plusieurs résultats : Entrée suivant, ⇧Entrée précédent | Navigation clavier entre résultats, bouclage | `composant` | `src/renderer/src/useThreadFind.test.tsx` (à compléter) | non |
| 8 | autre conversation : zone de saisie vide | Le brouillon est attaché à sa conversation | `composant` | `src/renderer/src/components/composer/Composer.test.tsx` (à créer) ou `drafts.test.ts` | partiel : `src/renderer/src/drafts.test.ts › garde texte et pièces jointes, en mémoire puis après un redémarrage` |
| 9 | brouillon retrouvé en revenant | Le texte non envoyé revient | `composant` | idem 8 | partiel : `src/renderer/src/drafts.test.ts › garde texte et pièces jointes…` |
| 10 | brouillon : la pièce jointe (texte collé) revient | Le long texte collé reste avec le brouillon | `composant` | idem 8 | partiel : `src/renderer/src/drafts.test.ts › garde texte et pièces jointes…` ; `e2e/suites/attachments.mjs` (collage) |
| 11 | titres au bord, « … » dans la ligne, survol ≠ sélection | Géométrie de la ligne et couleurs calculées distinctes | `capture` | capture nocturne `91-historique` | partiel : `Sidebar.test.tsx › plus de colonne d’icône vide…` |
| 12 | clic droit : le menu de ⋯ au pointeur, aucun mot sélectionné | Menu contextuel = menu ⋯, placé au pointeur, sans menu natif | `composant` | `Sidebar.test.tsx` (ajouter position) | partiel : `src/renderer/src/components/sidebar/Sidebar.test.tsx › clic droit sur une ligne : le menu de ⋯, mêmes éléments dans le même ordre, sans menu natif (fiche 276)` |
| 13 | conversation épinglée, en tête (waitFor) | Épingler la met dans « Épinglées » | `doublon` | — | `Sidebar.test.tsx › dans l’ordre : Épinglées, Récents, Archivées…` ; `e2e/suites/restart.mjs` (épinglage) |
| 14 | regroupement par projet : nom, chevron, ni icône ni compteur | Rendu de l'en-tête de dossier | `composant` | `Sidebar.test.tsx` | partiel : `Sidebar.test.tsx › deux filles en worktree sous leur mère, dans son dossier ; pas de compteur` |
| 15 | un dossier se replie et se déplie | Repli au clic sur le nom | `doublon` | — | `Sidebar.test.tsx › un dossier se replie (seul son nom reste), et le reste au redémarrage` |
| 16 | confirmation : corbeille, « aussi chez l’agent » jamais coché | Fenêtre de suppression, option décochée d'office | `doublon` | — | `src/renderer/src/components/sidebar/DeleteDialog.test.tsx › « aussi chez l’agent » proposé seulement s’il sait le faire, jamais coché d’office` |
| 17 | conversation supprimée (waitFor) | Suppression par IPC, ligne retirée | `doublon` | `parcours-deleguer`, étape « supprimer un travail » | `e2e/suites/parcours-deleguer.mjs` étapes 5–6 ; `src/main/conversations/trash.test.ts` |

**Verdict** : reduire — garder 6 (menu natif Édition › Rechercher), à déplacer dans une journée type. Le reste passe en composant (`useThreadFind`, `Composer`, `Sidebar`) ou est déjà couvert.
**Risques** :
- `CSS.highlights` (Custom Highlight API) n'existe pas dans jsdom : 3 et 5 demanderont un faux ou se contenteront de l'état du hook.
- Infobulle et clic droit (1, 12) passent par de vrais évènements CDP (survol long, `contextmenu` natif d'Electron) : un test de composant ne verrait pas le menu natif « Copier » revenir.

### `launch.mjs` — lancer l'app du projet : `.bob/launch.json`, serveur de dev, navigateur intégré, journal, arrêt

<!-- stats suite=launch total=5 parcours=3 composant=1 unitaire-main=0 capture=0 doublon=1 couvert=5 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | commande montrée avant le lancement | l'accord est demandé avec la commande | `doublon` | — | `src/main/preview/preview-tools.test.ts › commande montrée une fois, serveur démarré puis ouvert dans le navigateur` |
| 2 | serveur démarré, journal lu, page ouverte et lue par l'agent | vrai processus sur un vrai port, page chargée dans le navigateur intégré, lue par l'agent via MCP | `parcours` | `parcours-outils` (nouvelle étape « lancer l'app ») ou garder ici | partiel : `preview-tools.test.ts › commande montrée une fois…` ; `src/main/preview/dev-servers.test.ts › démarre, attend le port, journalise…` |
| 3 | navigateur sur l'app ; serveur « web » en marche sous la barre d'adresse | WebContentsView sur l'URL et état du serveur relayé au renderer | `parcours` | même étape que #2 | partiel : `preview-tools.test.ts › commande montrée une fois…` |
| 4 | journal du serveur visible dans l'onglet (waitFor) | le journal s'affiche à la demande | `composant` | test de la barre du serveur de dev (à créer) | partiel : `preview-tools.test.ts › journaux et arrêt` |
| 5 | serveur arrêté depuis l'onglet (waitFor) | bouton → arrêt du vrai processus → état `exited` | `parcours` | même étape que #2 | partiel : `dev-servers.test.ts › démarre, attend le port, journalise ; arrêt du groupe de processus` |

**Verdict** : reduire. Garder #2, #3, #5 en une étape de `parcours-outils` (vrai serveur, navigateur intégré, arrêt) ; #4 en test de composant.
**Risques** :
- le chargement réel dans la WebContentsView et la lecture de la page par l'agent ;
- l'arrêt d'un vrai groupe de processus (port libéré).

### `links.mjs` — Liens vers des fichiers et liens web dans la conversation : aperçu .md, app par défaut, Finder, exécutable, page HTML dans le navigateur intégré, adresses locales/externes (fiches 052, 064, 154, 272)

<!-- stats suite=links total=17 parcours=3 composant=8 unitaire-main=0 capture=0 doublon=6 couvert=16 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | 6 liens de fichiers reconnus (le lien web reste web) | Classement des liens du Markdown rendu | `composant` | `src/renderer/src/components/thread/Markdown.test.tsx` (à créer) | partiel : `src/shared/file-links.test.ts › chemins relatifs, absolus, file://, lignes citées` ; `› liens web, ancres, courriels : pas des fichiers` |
| 2 | code vers fichier inexistant : pas un lien ; existant : un lien | `files:existing` décide si le `code` devient un lien | `composant` | `Markdown.test.tsx` (à créer, `api.files.existing` simulé) | partiel : `src/main/ipc.test.ts › files:existing (fiche 272, rc.3)…` |
| 3 | .md du dossier : aperçu dans le panneau, rien d'ouvert ailleurs | Un .md s'ouvre en aperçu | `doublon` | — | `src/renderer/src/useFileLinks.test.ts › un .md s’ouvre en aperçu dans le panneau…` ; `src/main/files/file-links.test.ts › .md du dossier : aperçu, avec son dossier comme base de ses liens` |
| 4 | lien relatif dans l'aperçu : depuis le dossier du document | Base des liens = dossier du document | `doublon` | — | `file-links.test.ts › .md du dossier : aperçu, avec son dossier comme base…` ; `useFileLinks.test.ts › les liens du document en aperçu s’ouvrent dans sa conversation` |
| 5 | code : app par défaut | Bout en bout renderer → IPC → `shell.openPath` (journal `BOBINE_OPEN_LOG`) | `parcours` | garder ici (une seule route vers le système) | partiel : `file-links.test.ts › autre fichier du dossier : app par défaut…` |
| 6 | chemin sans dossier (`liste.js:2`) : app par défaut | `liste.js:` pas pris pour un schéma | `doublon` | — | `src/shared/file-links.test.ts › fichier sans dossier suivi d’une ligne ; jamais une adresse hôte:port` |
| 7 | fichier absent cliqué deux fois : un seul avis, pied du tour reste | Avis non dupliqué, `turn-summary` gardé | `composant` | `src/renderer/src/components/thread/Thread.test.tsx` (à créer) ou `useFileLinks.test.ts` | partiel : `useFileLinks.test.ts › fichier absent : avertissement…` |
| 8 | dossier : montré dans le Finder | Dossier → `showItemInFolder` | `doublon` | — | `file-links.test.ts › autre fichier du dossier : app par défaut ; dossier, ⌥-clic : Finder` |
| 9 | exécutable : Finder, jamais ouvert | Sécurité : rien d'exécuté | `doublon` | — | `file-links.test.ts › jamais rien d’exécuté : exécutable, hors du dossier, lien symbolique…` |
| 10 | le fil dit pourquoi l'exécutable n'a pas été ouvert | Avis `fileLink.executable` | `composant` | `useFileLinks.test.ts` | partiel : `useFileLinks.test.ts › … montré dans le Finder hors du dossier : information` |
| 11 | ⌥-clic : Finder | Le renderer transmet ⌥ au main | `composant` | `useFileLinks.test.ts` (ajouter altKey) | partiel : `file-links.test.ts › … dossier, ⌥-clic : Finder` (main) |
| 12 | aperçu fermé : l'onglet disparaît | ✕ de l'aperçu ferme l'onglet document | `doublon` | — | `src/renderer/src/usePanel.test.ts › document en aperçu : onglet ouvert, document remplacé, fermé par ✕` |
| 13 | page HTML : navigateur intégré, style, module, fetch, .env refusé | Serveur local réel + WebContentsView : page servie depuis son dossier, fichier caché refusé | `parcours` | garder ici | partiel : `src/main/files/html-preview.test.ts › sert la page et ses voisines, sans cache` ; `› refuse : fichier caché, hors du dossier…` |
| 14 | page HTML : rien d'ouvert dans une autre app | La page ne part pas dans une app externe | `parcours` | garder ici (même passage que 13) | partiel : `useFileLinks.test.ts › une page HTML s’ouvre dans le navigateur de la conversation (fiche 064)` |
| 15 | adresse locale : navigateur intégré, rien dans le navigateur du Mac | localhost → onglet navigateur du panneau | `composant` | `Markdown.test.tsx` / `useFileLinks.test.ts` | partiel : `src/shared/file-links.test.ts › adresses du poste : navigateur intégré` |
| 16 | autre adresse : navigateur du Mac | http(s) externe → `openExternal` | `composant` | idem 15 | partiel : `file-links.test.ts (shared) › autres http(s) : navigateur du Mac…` |
| 17 | ⌥-clic sur une adresse locale : navigateur du Mac | ⌥ force l'externe même pour localhost | `composant` | idem 15 | non |

**Verdict** : reduire — garder 5 (route vers le système) et 13–14 (page HTML servie dans le navigateur intégré) ; 1, 2, 7, 10, 11, 15–17 en composant (Markdown + `useFileLinks`).
**Risques** :
- La garde de navigation de la fenêtre (« la fenêtre de l'app ne navigue jamais ») n'est vérifiée qu'implicitement par les clics réels.
- Le rendu en streaming du Markdown, puis la réponse asynchrone de `files:existing` (2), créent une course réelle qu'un composant simulé ne reproduit pas.

### `memoire.mjs` — Mémoire commune contre l'agent factice : carte « Retenir ? », Non/Retenir, contenu externe, index, onglet Session, Réglages › Mémoire, mémoire coupée (fiche 182)

<!-- stats suite=memoire total=17 parcours=0 composant=7 unitaire-main=0 capture=0 doublon=10 couvert=13 verdict=disparaitre -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | waitFor carte proposée après le tour | Outil MCP `remember` appelé par l'agent → carte dans le fil, tour fini | `doublon` | `parcours-reglages`, étape « la mémoire : retenir… » | `e2e/suites/parcours-reglages.mjs` étape « la mémoire : retenir, puis la retrouver ailleurs » ; `src/main/memory/memory-flow.test.ts › propose, le tour continue…` |
| 2 | carte : Retenir en avant, aucun focus pris | Rendu de la carte ordinaire | `doublon` | — | `src/renderer/src/components/thread/MemoryProposalCard.test.tsx › carte ordinaire : texte entier, portée, Retenir en avant, aucun focus pris` |
| 3 | pastille neutre « Mémoire » sur la conversation | Ligne de la barre latérale signale une carte en attente | `composant` | `src/renderer/src/components/sidebar/Sidebar.test.tsx` (ajouter) | non |
| 4 | pas de type sur la carte, seulement la portée | Le type n'est pas affiché | `composant` | `MemoryProposalCard.test.tsx` | partiel : `MemoryProposalCard.test.tsx › carte ordinaire : texte entier, portée…` |
| 5 | carte de l'outil : « Propose de retenir : … » | Titre lisible de l'outil `remember` (`appTools.remember.value`) | `composant` | `src/renderer/src/components/thread/ToolCard.test.tsx` (à créer) ou test de `src/shared/app-tools.ts` | non |
| 6 | « Non » : ligne « Non retenu », pastille retirée | Décision refusée affichée, pastille partie | `composant` | `MemoryProposalCard.test.tsx` + `Sidebar.test.tsx` | partiel : `MemoryProposalCard.test.tsx › décidée : une ligne, « Voir » pour un souvenir gardé` ; `src/main/mcp/memory-tools.test.ts › « Non » : rien d’écrit, « declined »` |
| 7 | issue dite au message suivant, pas de carte | L'issue part avec le message suivant | `doublon` | — | `memory-tools.test.ts › « Retenir » : écrit, carte « kept », issue jointe une seule fois au message suivant` ; `memory-flow.test.ts › propose… ; issue au message suivant…` |
| 8 | waitFor « Retenu » après « Retenir » | Acceptation écrite, ligne « kept » | `doublon` | — | `parcours-reglages.mjs` étape « la mémoire : retenir… » ; `memory-tools.test.ts › « Retenir » : écrit, carte « kept »…` |
| 9 | contenu externe : bandeau, commande surlignée, corps déplié, aucun bouton en avant | Proposition à risque (`curl … \| sh`) signalée | `doublon` | — | `MemoryProposalCard.test.tsx › contenu externe avec commande : un bandeau, commande surlignée, aucun bouton en avant` ; `memory-tools.test.ts › contenu externe dans le tour : proposition marquée…` |
| 10 | Entrée dans la saisie : message envoyé, la carte attend | Entrée ne valide jamais la carte | `composant` | `MemoryProposalCard.test.tsx` + composer (à créer) | partiel : `MemoryProposalCard.test.tsx › … aucun focus pris` |
| 11 | conversation suivante : index reçu | Index de la mémoire joint au premier message | `doublon` | — | `parcours-reglages.mjs › retenu : la conversation suivante (autre agent) le reçoit` ; `memory-flow.test.ts` |
| 12 | onglet Session : ligne « Mémoire » (waitFor) | Ligne présente, mène aux réglages | `composant` | `src/renderer/src/components/panel/SessionTab.test.tsx` (ajouter) | non |
| 13 | modification : un secret est refusé | Validation des secrets à l'écriture depuis l'écran | `doublon` | — | `src/main/memory/memory-ipc.test.ts › modifier : mêmes validations que l’outil, secret refusé…` ; `src/renderer/src/components/settings/MemoryEntryRow.test.tsx › « Garder » refusé pour un secret…` |
| 14 | souvenir supprimé après confirmation | Suppression depuis Réglages › Mémoire | `doublon` | — | `parcours-reglages.mjs › souvenir oublié` |
| 15 | fichier modifié hors de Bobine : signalé, puis gardé | Fichier non validé jusqu'à « Garder ces modifications » | `doublon` | — | `memory-tools.test.ts › fichier écrit hors de Bobine : ni index ni recall, jusqu’à « Garder… »` ; `src/main/memory/store.test.ts › écrit par Bobine : validé ; modifié à la main : plus validé…` ; `MemoryEntryRow.test.tsx` |
| 16 | famille « Mémoire » sans interrupteur, avec le chemin du réglage | Pas de second interrupteur dans Outils de Bobine | `composant` | `src/renderer/src/components/settings/McpSettings.test.tsx` (ajouter) | non |
| 17 | mémoire coupée : pas d'outil | Réglage coupé → ni outil ni index | `doublon` | — | `memory-flow.test.ts › mémoire coupée : ni outil ni index pour les sessions suivantes` ; `memory-tools.test.ts › mémoire coupée : module absent…` |

**Verdict** : disparaitre — le flux réel (proposer, retenir, index dans une autre conversation, modifier, oublier) est déjà dans `parcours-reglages` ; le reste est couvert en main ou passe en composant (3, 4, 5, 6, 10, 12, 16, à écrire avant la suppression).
**Risques** :
- Contenu externe (injection) de bout en bout : seul cet e2e fait passer le marquage « risqué » par l'agent, le MCP et le rendu ; `parcours-reglages` ne le fait pas.
- Fichier posé sur le disque, relu par la vraie IPC (15) : le test du store ne voit pas le rafraîchissement du sélecteur.
- Fil étroit (900 px) : la mise en page de la carte n'aura plus que la capture.

### `network.mjs` — pannes réseau : reconnexion en 5 tentatives, « Connexion impossible », « Réessayer », Échap

<!-- stats suite=network total=6 parcours=1 composant=1 unitaire-main=0 capture=0 doublon=4 couvert=6 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | bandeau « Connexion perdue » à la place de l'indicateur, Stop proposé | pendant une attente de reconnexion : bandeau, pas d'indicateur de travail, Stop | `composant` | `src/renderer/src/components/thread/TurnRetryBanner.test.tsx` + rendu du fil (indicateur masqué) | partiel : `TurnRetryBanner.test.tsx › décompte la prochaine tentative, et « Réessayer maintenant »` |
| 2 | décompte de la deuxième tentative | « dans 4 s (2/5) » | `doublon` | — | `TurnRetryBanner.test.tsx › décompte la prochaine tentative…` ; `src/main/agent/turn-retry.test.ts › cinq tentatives après 2, 4, 8, 16 puis 32 s, puis plus rien` |
| 3 | réseau revenu : le message part, sans nouvelle bulle ni erreur | erreur `fetch failed` réelle de l'agent → nouvelle tentative du main → une seule bulle à l'écran | `parcours` | `parcours-pannes` (nouvelle étape « réseau instable ») | partiel : `src/main/agent/agent-host-retry.test.ts › deux tentatives, puis le message part, sans nouvelle bulle ni erreur` |
| 4 | cinq échecs : « Connexion impossible », seul « Réessayer » | état épuisé du bandeau | `doublon` | — | `TurnRetryBanner.test.tsx › limite de débit, puis tentatives épuisées : « Réessayer » seul` |
| 5 | cinq échecs : une seule bulle, un seul avis d'erreur | pas de doublon de bulle ni d'erreur | `doublon` | — | `agent-host-retry.test.ts › cinq échecs : « Connexion impossible », une seule erreur, puis « Réessayer » repart` |
| 6 | Échap pendant l'attente : plus de tentative, tour arrêté | Échap annule les tentatives | `doublon` | — | `turn-retry.test.ts › Échap ou Stop annule les tentatives` ; `src/renderer/src/composer-keys.test.ts › Échap arrête la réponse…` |

**Verdict** : reduire. Garder #3 en étape de `parcours-pannes` ; le reste est couvert par `TurnRetryBanner`, `turn-retry` et `agent-host-retry`.
**Risques** :
- le format réel de l'erreur réseau écrite par l'agent (sortie d'erreur) reconnue de bout en bout ;
- minuteries réelles (2 s, 4 s) et « Réessayer maintenant » cliqué pendant une attente réelle.

### `onboarding.mjs` — accueil du premier lancement (Agent → Connexion → Dossier → Essai) : parcours complet, aucun agent, connexion dans le terminal, SSO sans retour, connexion expirée, annulation, fermeture, Cmd+Q, plantage, coût « comme Bob »

<!-- stats suite=onboarding total=43 parcours=14 composant=12 unitaire-main=4 capture=1 doublon=12 couvert=35 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | accueil : bienvenue, agent trouvé présélectionné | L'étape Agent s'ouvre avec l'agent disponible coché | `doublon` | — | `src/renderer/src/components/onboarding/Onboarding.test.tsx › agent trouvé présélectionné, introuvable grisé ; pas de « Passer cette étape »` |
| 2 | agent introuvable grisé, avec le conseil du profil | Un profil absent est désactivé et dit quoi installer | `doublon` | — | même test (`Onboarding.test.tsx › agent trouvé présélectionné…`) |
| 3 | étape Agent : pas de « Passer cette étape » | L'étape Agent n'a pas de bouton pour la passer | `doublon` | — | même test |
| 4 | connexion : « {agent} est prêt », sans message au modèle | Après Continuer, l'état « prêt » est montré, et la vérification n'envoie rien au modèle | `composant` | `Onboarding.test.tsx` (ajouter le texte `readyTitle`) | partiel : `Onboarding.test.tsx › Continuer : agent configuré, vérification sans message…` ; `src/main/onboarding/agent-readiness.test.ts › « connecté ? » : session ouverte sans aucun message au modèle` |
| 5 | focus sur le bouton principal du nouvel état | Le focus passe sur « Continuer » quand la connexion est prête | `composant` | `Onboarding.test.tsx` | partiel : le focus n'est vérifié que sur `onboarding-cancel` (`Onboarding.test.tsx › Continuer : agent configuré…`) |
| 6 | barre latérale : l'agent choisi | Le choix fait dans l'accueil (configure → main → conversation) arrive jusqu'au pied de la barre latérale | `parcours` | garder ici (accueil réduit) | non |
| 7 | essai : le message à envoyer montré tel quel | Le texte exact envoyé à l'agent (« Answer with the single word OK ») est affiché | `composant` | `Onboarding.test.tsx` | non |
| 8 | essai : la réponse de l'agent | L'essai fait un vrai tour ACP avec l'agent factice et montre sa réponse | `parcours` | garder ici | partiel : `agent-readiness.test.ts › répond : texte, coût et jetons annoncés ; session d'essai supprimée, agent arrêté` |
| 9 | essai réussi : « Commencer » a le focus | Le focus passe sur « Commencer » après la réponse | `composant` | `Onboarding.test.tsx` | non |
| 10 | première conversation : « Lance les tests » avec pnpm | La suggestion tirée du dossier choisi reprend son gestionnaire de paquets | `composant` | `src/renderer/src/components/Welcome.test.tsx` (à créer) | partiel : `src/main/onboarding/trial-folder.test.ts › commande des tests selon le gestionnaire du dossier` |
| 11 | première conversation : liens vers l'aide | L'accueil de la première conversation montre Premiers pas et Autorisations | `composant` | `Welcome.test.tsx` (à créer) | non |
| 12 | la suggestion remplit la saisie sans l'envoyer | Cliquer une suggestion remplit la zone de saisie sans rien envoyer | `composant` | `Welcome.test.tsx` (à créer) | non |
| 13 | marque « fini » enregistrée | « Commencer » écrit `onboarding.outcome = finished` dans settings.json | `unitaire-main` | `src/main/onboarding/onboarding.test.ts` + `Onboarding.test.tsx` (finish('finished')) | partiel : `onboarding-state.test.ts › fini ou passé : posé une fois, jamais défait` ; `Onboarding.test.tsx › « Passer l'accueil » : marqué passé` (côté skipped seulement) |
| 14 | relancée : l'accueil ne revient pas | Après un redémarrage, l'accueil fini n'est plus montré | `parcours` | garder ici (redémarrage) | partiel : `src/main/onboarding/onboarding.test.ts › fini puis passé : la première marque reste, l'accueil ne revient plus` |
| 15 | accueil ouvert, rien choisi : aucun agent de conversation lancé | Tant que rien n'est choisi, aucun processus d'agent ne démarre (6 s d'observation) | `parcours` | garder ici | partiel : `src/main/conversations/agentless.test.ts › accueil dû en essai : aucun dossier, l'agent attend le choix (fiche 242, D17)` |
| 16 | accueil ouvert, rien choisi : aucun quota lu | Aucun quota n'est lu au lancement avant le choix | `unitaire-main` | `src/main/agent/quota-setup.test.ts` | partiel : `quota-setup.test.ts › agent installé mais pas utilisé : son quota n'est pas lu au lancement` |
| 17 | agent choisi et essayé, pas de dossier : l'agent attend | Après la connexion vérifiée, l'agent de la conversation n'est pas lancé sans dossier | `parcours` | garder ici | partiel : `agentless.test.ts › accueil dû en essai…` |
| 18 | dossier choisi : l'agent démarre, dans ce dossier | Le dossier choisi dans l'accueil devient le cwd du vrai processus d'agent | `parcours` | garder ici | non |
| 19 | aucun agent : sous-titre et conseils des profils | Sans agent, l'écran explique et liste quoi installer, sans alerte | `composant` | `Onboarding.test.tsx` | partiel : `Onboarding.test.tsx › aucun agent : « Chercher à nouveau » sans résultat le dit` (contient « bob ») |
| 20 | « Chercher à nouveau » sans résultat | La recherche sans résultat affiche « Toujours aucun agent trouvé. » | `doublon` | — | `Onboarding.test.tsx › aucun agent : « Chercher à nouveau » sans résultat le dit` |
| 21 | explorer sans agent : marqué passé | « Explorer » sans agent marque l'accueil comme passé | `composant` | `Onboarding.test.tsx` | partiel : `Onboarding.test.tsx › « Passer l'accueil » : marqué passé, l'accueil disparaît` (autre bouton) |
| 22 | connexion à faire : la carte, avec la commande du profil | La carte de connexion montre la commande de connexion venue du profil | `composant` | `src/renderer/src/components/composer/BlockerPanel.test.tsx` | partiel : `agent-readiness.test.ts › connexion à faire : carte de connexion avec l'étape du profil, sans message` |
| 23 | 900 px, terminal ouvert : étapes en numéros, carte ≥ 360 px | Mise en page étroite avec le terminal ouvert : la carte reste lisible | `capture` | capture nocturne `188-8-connexion-terminal-900` | non |
| 24 | connecté depuis le terminal : « Réessayer », puis prêt | La commande lancée dans le vrai terminal (pty) connecte l'agent, et la nouvelle vérification le voit | `parcours` | garder ici | partiel : `agent-readiness.test.ts › connexion faite (dans le dossier réservé, où l'agent est lancé) : connecté` |
| 25 | vérification simple : pas de « rien ne se passe ici ? » | La sortie « SSO bloqué » n'apparaît pas sans SSO | `doublon` | — | `Onboarding.test.tsx › SSO qui ne revient pas (fiche 207)…` |
| 26 | attente du navigateur : « waitBrowser » | Pendant le SSO, l'attente dit qu'elle attend le navigateur | `doublon` | — | même test |
| 27 | « Réessayer » : nouvelle vérification sans connexion, prêt | « Réessayer » relance une vérification sans `authenticate`, puis l'état prêt | `doublon` | — | même test |
| 28 | l'agent resté en attente du navigateur est arrêté | Le processus de l'ancienne vérification est vraiment tué | `parcours` | garder ici | partiel : `onboarding.test.ts › un seul essai à la fois : le suivant, Annuler et la fin annulent celui en cours` |
| 29 | dossier d'essai créé dans le dossier prévu | « Dossier d'essai » crée un dossier neuf sous `BOBINE_TRIAL_DIR` | `unitaire-main` | `src/main/onboarding/trial-folder.test.ts` | partiel : `trial-folder.test.ts › créé avec son parent, toujours neuf…` |
| 30 | connexion expirée à l'essai : carte « Connexion expirée », pas l'erreur brute | Un refus d'authentification pendant l'essai devient la carte, pas le message brut | `composant` | `Onboarding.test.tsx` (état expired) | partiel : `agent-readiness.test.ts › connexion expirée : session ouverte, message refusé → carte de connexion au tour (D10)` ; `BlockerPanel.test.tsx` (« Connexion expirée ») |
| 31 | commande du profil dans le dossier réservé, pas dans le projet | La commande de connexion tourne (pty réel) dans le dossier réservé de l'app | `parcours` | garder ici | partiel : `onboarding.test.ts › étape de connexion : seulement celle du profil, dans le terminal de la conversation` |
| 32 | reconnecté : « Réessayer » relance l'essai, l'agent répond | Après reconnexion, l'essai repart et aboutit | `parcours` | garder ici | non |
| 33 | pendant l'essai : un agent de plus | L'essai lance son propre processus d'agent | `parcours` | garder ici | partiel : `agent-readiness.test.ts › répond : …agent arrêté` |
| 34 | Échap pendant l'essai : annulé | Échap annule l'essai en cours | `doublon` | — | `Onboarding.test.tsx › Continuer : … Échap annule, ne passe pas` |
| 35 | aucun agent d'essai laissé derrière | Après annulation, le processus de l'essai est tué (SIGTERM puis SIGKILL) | `parcours` | garder ici | partiel : `agent-readiness.test.ts › annulé pendant la réponse : session/delete envoyé quand même, magasin vide, agent arrêté` |
| 36 | rien écrit dans le dossier pendant l'essai | La session d'essai ne touche jamais le dossier choisi | `doublon` | — | `agent-readiness.test.ts › session d'essai toujours dans un dossier jetable de l'app, supprimé ; jamais le dossier de lancement` |
| 37 | fenêtre fermée pendant l'essai : son agent arrêté | Fermer la fenêtre native arrête l'agent de l'essai | `parcours` | garder ici | partiel : `onboarding.test.ts › stop() : agent arrêté sur-le-champ, essai annulé…` |
| 38 | essai en cours : son agent (Cmd+Q) | Préalable : un agent d'essai tourne | `doublon` | — | ligne 33 (même suite) |
| 39 | Cmd+Q pendant l'essai : aucun agent restant | Quitter l'app ne laisse aucun processus d'agent orphelin | `parcours` | garder ici | partiel : `agent-readiness.test.ts › arrêt immédiat (fermeture de l'app) : l'agent est arrêté sans attendre` |
| 40 | plantage : détails repliés, « Réessayer » a le focus | Un agent qui plante montre l'erreur repliée et donne le focus à « Réessayer » | `composant` | `Onboarding.test.tsx` | partiel : côté main `agent-readiness.test.ts › plantage en plein tour : code et fin de la sortie d'erreur, processus arrêté` |
| 41 | essai « comme Bob » : coût lu dans la base de l'agent | Le coût écrit par l'agent dans sa base est montré sur l'écran de succès | `doublon` | — | `agent-readiness.test.ts › agent « comme Bob » (coût dans sa base, rien par ACP) : lu avant la suppression, montré et rapporté` ; formatage : `Onboarding.test.tsx › essai répondu par un autre modèle…` |
| 42 | « Mon activité » : tour d'essai et coût gardés | Le tour d'essai est écrit dans usage.sqlite avec son coût | `unitaire-main` | `onboarding.test.ts` | partiel : `onboarding.test.ts › tour d'essai : une ligne du journal de consommation, sur la conversation de l'accueil` |
| 43 | session d'essai supprimée de la base de l'agent | La session d'essai ne reste pas chez l'agent | `doublon` | — | `agent-readiness.test.ts › répond : … session d'essai supprimée, agent arrêté` |

**Verdict** : reduire — garder les 14 `parcours` (6, 8, 14, 15, 17, 18, 24, 28, 31, 32, 33, 35, 37, 39) et regrouper les lancements (aujourd'hui 9 apps). Aucune journée type de la fiche 277 ne passe par l'accueil : il faut garder une suite d'accueil courte (ou créer un `parcours-premier-lancement`). Le reste passe en tests de composant (`Onboarding.test.tsx`, un `Welcome.test.tsx` à créer) ou est déjà couvert.
**Risques** :
- Processus orphelins (annulation, fenêtre fermée, Cmd+Q) : seul un comptage `ps` réel les voit.
- La chaîne de connexion « pty → fichier → nouvelle vérification » et le cwd de l'agent après le choix du dossier.
- La suggestion « pnpm test » dépend du dossier réel lu par le main, puis de son rendu : aucun test ne relie les deux.

### `panel.mjs` — Panneau latéral à onglets : ouverture, Tâches, largeur, menu « + », agrandi, ✕ et clic molette, état de l'agent (fiches 029, 035, 082, 154, 166, 185, 226)

<!-- stats suite=panel total=25 parcours=3 composant=8 unitaire-main=0 capture=1 doublon=13 couvert=17 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | panneau fermé au départ | État initial | `doublon` | — | `src/renderer/src/usePanel.test.ts › par défaut : fermé, sur « Session », 320 px…` |
| 2 | ouvert à la main : sur « Session » | Premier onglet = Session | `doublon` | — | `usePanel.test.ts › par défaut : fermé, sur « Session »…` |
| 3 | « Tâches » choisi dans « + » : pas encore de tâches | État vide de l'onglet Tâches | `composant` | `src/renderer/src/components/panel/TasksTab.test.tsx` (à créer) | non |
| 4 | en-tête : progression du plan (3 / 3) | Compteur du plan sur le bouton du panneau | `doublon` | — | `e2e/suites/pinned-plan.mjs` (même vérification `'3 / 3'`) |
| 5 | onglet Tâches : dernier plan avec sa progression | 3 `li.completed`, texte `sidePanel.progress` | `composant` | `TasksTab.test.tsx` (à créer) | non |
| 6 | 320 px par défaut, largeur non enregistrée | Défaut et pas d'écriture sans glissement | `doublon` | — | `src/renderer/src/panel-width.test.ts › 320 px par défaut…` ; `› enregistrée seulement si elle a été tirée à la main` |
| 7 | panneau redimensionné à la souris | Glissement réel de la poignée (pointer capture, mise en page) | `parcours` | `parcours-longue`, étape « le panneau ouvert puis refermé » | partiel : `usePanel.test.ts › tirée à la main : retenue, et relue au lancement suivant` (état seul) |
| 8 | largeur tirée : enregistrée (customWidth) | Persistance de la largeur réglée | `doublon` | — | `usePanel.test.ts › tirée à la main : retenue…` |
| 9 | onglets nommés : « Session » puis « Tâches 3/3 » | Seuls les outils qui ont servi sont en onglet | `composant` | `src/renderer/src/components/panel/SidePanelTabs.test.tsx` | partiel : `src/renderer/src/panel-tabs.test.ts › outils de l’app appelés…; liste de tâches non vide` |
| 10 | menu « + » : les autres outils (simulateur selon la plateforme) | Liste du menu selon la capacité `simulator` | `doublon` | — | `panel-tabs.test.ts › outil absent de la plateforme (fiche 145)…` ; `› utilisés, actif, ouverts…` |
| 11 | outil choisi dans « + » : onglet à droite, Tâches ne bouge pas | Ordre stable des onglets | `doublon` | — | `panel-tabs.test.ts › onglet qui apparaît (fiche 154) : à droite, les autres ne bougent plus` |
| 12 | agrandi : à la place de la conversation, barre latérale reste, fil inert | Géométrie de l'agrandi, `main.inert` | `capture` | capture `23c-panneau-agrandi` (+ `inert` en composant dans `App.test.tsx`) | partiel : `usePanel.test.ts › réduit en fermant le panneau` (état maximized) |
| 13 | agrandi : la barre de la conversation dessous ne déplace pas la fenêtre | `-webkit-app-region` : pas de zone de déplacement macOS sous le panneau | `parcours` | garder ici (ou étape d'une journée type) | non |
| 14 | Affichage › Agrandir le panneau : réduit, largeur d'avant | Menu natif → IPC → renderer ; largeur restaurée | `parcours` | journée type (`parcours-longue`) | partiel : `src/main/menu.test.ts` (entrée `maximize-panel` ⇧⌘J) |
| 15 | poignée : infobulle « glisser · double-clic » | `title` de la poignée | `composant` | `src/renderer/src/components/panel/SidePanel.test.tsx` (à créer) | non |
| 16 | double-clic sur la poignée : 320 px, plus rien d'enregistré | Retour au défaut | `doublon` | — | `usePanel.test.ts › double-clic sur le bord : retour au défaut, plus rien d’enregistré` |
| 17 | agrandi sans barre latérale : bouton pour la rouvrir, place des feux | Classe `with-lights` et bouton | `composant` | `SidePanel.test.tsx` (à créer) | non |
| 18 | agrandi : « Attend votre réponse » pendant la demande | État de l'agent dans l'en-tête du panneau agrandi | `composant` | `SidePanel.test.tsx` (à créer) | non |
| 19 | clic sur l'état de l'agent : retour au fil, demande là | Clic réduit le panneau | `composant` | `SidePanel.test.tsx` (à créer) | non |
| 20 | ✕ sur l'onglet affiché : il disparaît, le voisin s'affiche | Fermeture d'un onglet | `doublon` | — | `usePanel.test.ts › ✕ : l’onglet disparaît, le voisin s’affiche, et c’est mémorisé` |
| 21 | onglet fermé : rouvert par « + », il revient à droite | Réouverture | `doublon` | — | `panel-tabs.test.ts › onglet fermé : caché même si l’outil a servi…` ; `› onglet qui apparaît… à droite` |
| 22 | clic molette sur un onglet : il se ferme | `auxclick` bouton 1 | `composant` | `SidePanelTabs.test.tsx` (ajouter) | non |
| 23 | dernier onglet fermé : le panneau se ferme | Fermeture du panneau | `doublon` | — | `usePanel.test.ts › le dernier onglet fermé ferme le panneau…` |
| 24 | panneau rouvert : l'onglet fermé ne revient pas, retenu | Persistance `bobine.panel.closedTabs` | `doublon` | — | `panel-tabs.test.ts › onglets fermés gardés d’un lancement à l’autre…` |
| 25 | nouvelle conversation : le panneau se réduit | Agrandi annulé au changement | `doublon` | — | `usePanel.test.ts › réduit en changeant de conversation` |

**Verdict** : reduire — garder 7 (glissement réel), 13 (régions de déplacement macOS) et 14 (menu natif), de préférence dans `parcours-longue`. Le reste est couvert par `usePanel`/`panel-tabs` ou passe en composant (Tâches, en-tête du panneau agrandi, molette).
**Risques** :
- Le glissement de la poignée a déjà connu un échec rare en parallèle (journal de pointeur dans la suite) : seul le vrai Chromium le reproduit.
- `-webkit-app-region` ne se calcule pas dans jsdom ; une régression déplacerait la fenêtre au clic dans la barre d'adresse.
- L'arrivée en glissement (animations) et la géométrie de l'agrandi n'auraient plus que la capture.

### `parcours-deleguer.mjs` — Journée type « Déléguer » : trois travaux lancés, réponse dans un travail, commits, fusion avec conflit résolu, suppression, corbeille, restauration, relance (fiche 277)

<!-- stats suite=parcours-deleguer total=11 parcours=11 composant=0 unitaire-main=0 capture=0 doublon=0 couvert=6 verdict=garder -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | trois travaux finis, chacun dans son worktree ; la mère reste affichée | Lancement réel de 3 agents, worktrees créés sur disque, focus gardé | `parcours` | garder ici (étape 1) | partiel : `e2e/suites/travaux-groupe.mjs › en cours : la même carte, « 3 en cours »…` |
| 2 | le travail répond dans sa conversation, lien vers la mère | Message envoyé à une fille par ACP, lien `title-origin` | `parcours` | garder ici (étape 2) | non |
| 3 | retour à la mère : la ligne dit qu'il a répondu (waitFor) | L'état de la fille remonte à la carte de la mère (détail descendable : état de ligne) | `parcours` | garder ici ; détail d'état : `src/renderer/src/components/thread/WorkGroup.test.tsx` | partiel : `WorkGroup.test.tsx` / `WorkCard.test.tsx` (états de ligne) |
| 4 | « Fusionner les 3 dans main » proposé (waitFor) | Les branches commitées hors app sont relues au retour sur la mère (le libellé seul est du composant) | `parcours` | garder ici ; libellé : `SubtasksMerge.test.tsx` | partiel : `src/renderer/src/components/thread/SubtasksMerge.test.tsx › pied de carte : phrase d’état, « Fusionner les N »…` |
| 5 | main a les trois travaux, conflit résolu, dossier propre | Chaîne de fusion réelle, conflit résolu par l'agent de la fille | `parcours` | garder ici (étape 4) | partiel : `src/main/conversations/children-merge.test.ts › conflit sur la deuxième : la fille le résout, la fusion reprend…` ; `e2e/suites/filles-fusion.mjs` |
| 6 | travail supprimé : quitte la barre latérale, la mère reste affichée | Suppression d'une fille sans changer de conversation | `parcours` | garder ici (étape 5) | non |
| 7 | mère et travaux à la corbeille | Suppression en famille de bout en bout | `parcours` | garder ici (étape 6) | partiel : `src/main/conversations/family-delete.test.ts › « Supprimer aussi ses filles » : descendance arrêtée proprement puis supprimée` |
| 8 | restaurée : de retour dans la barre latérale | Restauration depuis Réglages › Données › Corbeille | `parcours` | garder ici (étape 7) | partiel : `family-delete.test.ts › restaurer la mère restaure les filles supprimées avec elle…` ; `src/main/conversations/trash.test.ts` |
| 9 | mère restaurée : son fil, et l'agent répond | Fil rechargé, session ACP reprise après corbeille | `parcours` | garder ici (étape 8) | non |
| 10 | app quittée (check(true)) | Quitter proprement avec des worktrees | `parcours` | garder ici | non |
| 11 | après relance : la mère restaurée garde son fil et répond | Persistance après redémarrage, agent relancé | `parcours` | garder ici (étape 10) | non |

**Verdict** : garder — c'est une journée type ; chaque check porte un enchaînement réel (agents, git, corbeille, redémarrage). Détails qui pourraient descendre : l'état « répondu » d'une ligne (3) et le libellé « Fusionner les 3 dans main » (4), déjà en partie dans `WorkGroup`/`SubtasksMerge`.
**Risques** : —

### `parcours-outils.mjs` — Journée type « Outils de l'app » : terminal (à la main puis par l'agent), navigateur intégré annoté, panneaux par conversation, fenêtre rapide, recherche, export (fiche 277)

<!-- stats suite=parcours-outils total=9 parcours=8 composant=1 unitaire-main=0 capture=0 doublon=0 couvert=9 verdict=garder -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | ⌃` : terminal ouvert dans le dossier, commande lancée à la main | pty réel, focus xterm, sortie lue | `parcours` | garder ici (étape 1) | partiel : `src/renderer/src/usePanel.test.ts › ⌃\` ouvre le terminal avec le clavier…` ; `e2e/suites/terminal.mjs` |
| 2 | commande montrée puis lancée dans un onglet de l'agent, qui lit sa sortie | Outil MCP terminal : question, lancement dans le pty, sortie rendue à l'agent | `parcours` | garder ici (étape 2) | partiel : `src/main/terminal/terminal-tools.test.ts › commande montrée une fois, lancée dans un onglet neuf, puis lue` ; `terminal.mjs` |
| 3 | la page est affichée dans le navigateur intégré | WebContentsView visible sur l'URL de l'agent | `parcours` | garder ici (étape 3) | partiel : `e2e/suites/browser-view.mjs` |
| 4 | waitFor barre des remarques « 1 remarque » | Compteur après une remarque posée dans la page (détail descendable) | `composant` | `src/renderer/src/components/panel/PageNotesBar.test.tsx` (à créer) | partiel : `src/shared/page-notes.test.ts` |
| 5 | remarque envoyée avec sa capture ; le clic n'a pas atteint la page | Clic natif intercepté par le script d'annotation, capture et texte envoyés à l'agent | `parcours` | garder ici (étape 3) | partiel : `e2e/suites/browser-annotate.mjs › hors du mode Annoter, la page reçoit ses clics` ; `› deux images PNG jointes` |
| 6 | retour à la première : son terminal et son navigateur sont là | Panneaux attachés à la conversation (pty et vue gardés) | `parcours` | garder ici (étape 4) | partiel : `usePanel.test.ts › un onglet affiché garde sa place dans la conversation` |
| 7 | fenêtre rapide : nouvelle conversation dans la fenêtre principale, réponse | Seconde fenêtre native → IPC → nouvelle conversation | `parcours` | garder ici (étape 5) | partiel : `e2e/suites/quick.mjs › Entrée : nouvelle conversation dans la fenêtre principale…` |
| 8 | recherche : une seule conversation trouvée, ouverte | Recherche du contenu sur disque par le main, ouverture | `parcours` | garder ici (étape 6) | partiel : `e2e/suites/history.mjs` ; `src/main/conversations/content-search.test.ts` |
| 9 | export : tout le fil de la journée | Dialogue (remplacé) + fichier Markdown réel écrit, avec outils et terminal | `parcours` | garder ici (étape 7) | partiel : `src/shared/export.test.ts › Markdown : en-tête, messages, outils, tâches, terminal sans codes couleur` ; `e2e/suites/export.mjs` |

**Verdict** : garder — journée type, chaque étape traverse pty, WebContentsView, une seconde fenêtre ou le disque. Seul le compteur de la barre des remarques (4) peut descendre en composant.
**Risques** : —

### `pendant-tour.mjs` — Pendant le tour : commande sans sortie interrompue, « Compacter » à 85 %, plafond de coût (dollars puis jetons), réglages (fiche 157)

<!-- stats suite=pendant-tour total=9 parcours=2 composant=1 unitaire-main=0 capture=1 doublon=5 couvert=9 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | commande sans sortie : « Aucune sortie depuis 1 min » sur sa carte | Avis au-delà du seuil | `doublon` | — | `src/renderer/src/components/thread/TurnGuards.test.tsx › minutes à signaler au-delà du seuil…` ; `› « Aucune sortie depuis 3 min » et « Interrompre »…` |
| 2 | Interrompre : commande interrompue, avis disparu | `session/cancel` réel vers l'agent, outil `cancelled` | `parcours` | `parcours-pannes`, étape « un agent silencieux, arrêté » (ou garder ici) | partiel : `TurnGuards.test.tsx › « Aucune sortie… » et « Interrompre »` (bouton seul) |
| 3 | contexte à 85 % : puce et « Compacter » en orange (jeton warn) | Couleur calculée = jeton `warn` du thème | `capture` | capture `157-compacter` | partiel : `src/renderer/src/components/composer/UsageGuards.test.tsx › « Compacter » à 80 %…` (classe `warn`) |
| 4 | Compacter : conversation résumée, bouton disparu | Commande de compaction envoyée à l'agent, compaction `completed` | `parcours` | journée type (`parcours-longue`) ou garder ici | partiel : `UsageGuards.test.tsx › « Compacter » à 80 % quand l’agent a une commande de compaction` |
| 5 | plafond franchi en plein outil : il finit, le suivant ne part pas, carte | Interruption après l'outil en cours | `doublon` | — | `src/main/conversations/cost-cap.test.ts › coût qui monte : attend la fin de l’outil en cours, interrompt, puis « Continuer » relance` (agent factice réel) |
| 6 | Continuer : plafond relevé à 2 $, agent relancé | « Continuer » relève et relance | `doublon` | — | `cost-cap.test.ts › coût qui monte… « Continuer » relance` ; `TurnGuards.test.tsx › une fois répondue : le plafond relevé, plus de boutons` |
| 7 | détail : « Aucun » plafond pour la conversation | Choix « Aucun » dans le détail | `doublon` | — | `UsageGuards.test.tsx › plafond de la conversation : celui des réglages, une valeur propre, « Aucun »` ; `cost-cap.test.ts › « Aucun » pour la conversation…` |
| 8 | réglages : plafond activé, 1 dans l'unité de l'agent | Réglages › Conversations reflètent les préférences | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` | partiel : `SettingsDialog.test.tsx` (préférences du plafond) |
| 9 | sans coût connu : plafond de 1 000 jetons, carte en fin de tour, sans interruption | Plafond en jetons | `doublon` | — | `cost-cap.test.ts › sans coût connu : plafond en jetons, carte à la fin du tour, sans interruption` ; `UsageGuards.test.tsx › sans coût connu : en jetons…` |

**Verdict** : reduire — garder 2 (interruption réelle d'une commande) et 4 (compaction par l'agent), à placer dans une journée type ; le plafond est déjà testé côté main avec l'agent factice, et côté composants.
**Risques** :
- Seuil raccourci par `BOBINE_STALLED_COMMAND_MS` : l'env lu par l'app réelle n'est plus vu que si 2 reste en e2e.
- La couleur `warn` (3) ne se vérifie plus contre la palette réelle en clair et en sombre, seulement par capture.

### `pilote.mjs` — la commande `pnpm pilote` (lancer, cliquer, attendre, etat, envoyer, repondre, capture, note, journal, arreter) contre l'app buildée et l'agent factice

<!-- stats suite=pilote total=43 parcours=14 composant=0 unitaire-main=21 capture=0 doublon=8 couvert=37 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | lancer : Bobine démarrée | `pilote lancer` démarre une vraie Bobine (profil temporaire, port) | `parcours` | garder ici | partiel : `scripts/pilote/pilote.test.mjs › lancement : profil temporaire par défaut, débogage local, accessibilité, trousseau simulé` |
| 2 | lancer : l'état montre l'accueil | La lecture du vrai DOM reconnaît l'accueil (testids réels) | `parcours` | garder ici | partiel : `pilote.test.mjs › accueil, blocage, avis, panneau, conversations et saisie` (DOM simulé) |
| 3 | attendre : étape suivante de l'accueil (code 14) | `attendre` rend « accueil » quand l'étape change | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › délai, carte, accueil qui change d'étape` |
| 4 | accueil : « Choisir… » | `cliquer` trouve un bouton par son libellé traduit dans la vraie fenêtre | `parcours` | garder ici | partiel : `pilote.test.mjs › zone précisée, ou libellé unique : un seul clic` |
| 5 | lancer --dossier : l'accueil travaille dans ce dossier | `--dossier` remplace le dialogue natif : la conversation de l'accueil prend ce dossier | `parcours` | garder ici | non |
| 6 | accueil : essai fini, « Commencer » proposé | `attendre`/`etat` listent les boutons de l'accueil après l'essai | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › accueil, blocage, avis…` |
| 7 | etat : agent prêt, accueil fini | `etat` dit « Prêt (ready) » et plus l'accueil | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › écran calme : quelques lignes, sans ligne vide de sens` |
| 8 | envoyer : message parti | `envoyer` tape et envoie dans le vrai compositeur | `parcours` | garder ici | partiel : `scripts/pilote/cible.test.mjs › envoyer un texte ordinaire : pas d'Échap` |
| 9 | envoyer : zone vidée d'abord, le brouillon ne part pas | Un brouillon déjà là est effacé avant l'envoi | `unitaire-main` | `cible.test.mjs` | partiel : `cible.test.mjs › envoyer « /scenario … » : le menu « / » fermé d'abord, le message part tel quel` (DOM jsdom, pas React) |
| 10 | attendre → carte | `attendre` rend le code 10 sur une carte d'autorisation | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › délai, carte, accueil qui change d'étape` |
| 11 | etat : titre, fichier et boutons de la carte | `etat` lit la question, le fichier et les boutons de la carte | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › carte en attente : titre, commande, dossier, boutons` |
| 12 | capture de la carte (demi-taille) | `capture --zone carte --demi` écrit un PNG par CDP | `parcours` | garder ici | non |
| 13 | repondre « Autoriser une fois » | `repondre` clique le bon bouton de la carte réelle | `parcours` | garder ici | partiel : `cible.test.mjs › repondre vise la carte en attente, pas une carte de groupe décidée plus bas` |
| 14 | attendre → tour-fini | `attendre` rend 0 en fin de tour | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › tour fini après un écran calme, pas avant` |
| 15 | etat : dernier message de l'agent | `etat` montre le dernier message de l'agent | `unitaire-main` | `pilote.test.mjs` | `pilote.test.mjs › message de l'agent : extrait et nombre de mots ; en entier avec --long` |
| 16 | etat --json : genre de l'outil, onglet Modifications | La sortie JSON donne le genre de l'outil et les onglets du panneau | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › outils : par genre, groupés compris` |
| 17 | panneau modifications : onglet ouvert, compte affiché | `panneau modifications` ouvre l'onglet ; `etat` dit son compte | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › onglets du panneau, en français ou en anglais` |
| 18 | attendre → calme | `attendre --calme` rend 15 sur un tour qui ne bouge plus | `doublon` | — | `pilote.test.mjs › calme : un tour qui ne bouge plus ; l'horloge du tour ne compte pas` |
| 19 | cliquer « Arrêter » | `cliquer` trouve le bouton Arrêter par son nom accessible | `parcours` | garder ici | partiel : `pilote.test.mjs › zone précisée, ou libellé unique : un seul clic` |
| 20 | après Arrêter : tour-fini | `attendre` voit la fin d'un tour arrêté | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › tour : en cours, fini, ou rien` |
| 21 | note avec capture | `note --capture` écrit la note et sa capture | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › écrit les entrées (Markdown et JSONL) et les résume` |
| 22 | note : gravité inconnue refusée | Une gravité inconnue sort avec le code 1 | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › refuse une commande, une option ou une valeur manquante` |
| 23 | intervention notée | `intervention` écrit une entrée | `unitaire-main` | `pilote.test.mjs` | partiel : `pilote.test.mjs › écrit les entrées…` |
| 24 | journal --resume : notes, interventions, tours, fins d'attente | Le résumé compte notes, gravités, tours et fins d'attente | `unitaire-main` | `pilote.test.mjs` | `pilote.test.mjs › écrit les entrées (Markdown et JSONL) et les résume` |
| 25 | journal : note, capture et état | Le journal Markdown contient la note et le chemin de la capture | `unitaire-main` | `pilote.test.mjs` | `pilote.test.mjs › écrit les entrées…` |
| 26 | panneau navigateur ouvert | `panneau navigateur` ouvre le vrai navigateur intégré | `parcours` | garder ici | non |
| 27 | navigateur intégré : la maquette est une cible DevTools | La page du WebContentsView apparaît dans `/json/list` à côté de Bobine | `parcours` | garder ici | non |
| 28 | etat, navigateur ouvert : la fenêtre de Bobine | `etat` vise la fenêtre principale, pas la page du navigateur | `doublon` | — | `cible.test.mjs › navigateur intégré ouvert : etat, envoyer et capture visent la fenêtre de Bobine` |
| 29 | envoyer, navigateur ouvert | `envoyer` vise la fenêtre de Bobine | `doublon` | — | même test |
| 30 | attendre, navigateur ouvert : tour-fini | `attendre` vise la fenêtre de Bobine | `doublon` | — | même test |
| 31 | capture, navigateur ouvert : la fenêtre entière | La capture a la largeur réelle de la fenêtre de Bobine | `parcours` | garder ici | partiel : même test de `cible.test.mjs` (cibles simulées, pas de pixels) |
| 32 | etat, onglet fermé : la fenêtre de Bobine | Après la fermeture de l'onglet, la cible reste Bobine | `doublon` | — | `cible.test.mjs › onglet fermé : oublié ; la commande suivante relit la liste` |
| 33 | attendre → carte souvenir | `attendre` voit la carte « Retenir ce souvenir ? » | `doublon` | — | `cible.test.mjs › carte « Retenir ce souvenir ? » : lue par etat, attendre rend « carte »` |
| 34 | repondre « Retenir » | `repondre` décide la carte souvenir | `unitaire-main` | `cible.test.mjs` | partiel : `cible.test.mjs › repondre vise la carte en attente…` |
| 35 | souvenir décidé : plus de carte | Une fois la carte décidée, `attendre` ne la voit plus | `unitaire-main` | `cible.test.mjs` | partiel : `cible.test.mjs › repondre rend la main une fois la carte décidée ; toujours là, une erreur le dit (fiche 250)` |
| 36 | attendre → tâches proposées | `attendre` voit une carte « Tâches proposées » en attente | `unitaire-main` | `cible.test.mjs` | partiel : `cible.test.mjs › carte de groupe en attente : une carte, les boutons de la ligne en attente et « Tout lancer »` |
| 37 | repondre « Lancer » | `repondre` lance la proposition | `unitaire-main` | `cible.test.mjs` | partiel : `cible.test.mjs › repondre vise la carte en attente, pas une carte de groupe décidée plus bas` |
| 38 | « Tâches proposées » traitée : pas une carte en attente | Une carte de groupe décidée ne bloque plus `attendre` | `doublon` | — | `cible.test.mjs › carte de groupe toute décidée : pas en attente, même avec son bouton « Lancer »` |
| 39 | envoyer dans la conversation fille | `envoyer` marche dans une fille ouverte (vrai worktree) | `parcours` | garder ici | non |
| 40 | envoyer : le message est dans la fille | Le message arrive dans la fille affichée, pas dans la mère | `parcours` | garder ici | non |
| 41 | attendre dans la fille : tour-fini | `attendre` voit la fin du tour de la fille | `doublon` | — | ligne 14 (même suite) |
| 42 | arreter : cette Bobine-là seulement | `arreter` tue le processus lancé par le pilote, et lui seul | `parcours` | garder ici | partiel : `pilote.test.mjs › arrêt : seulement le processus lancé par le pilote (pid réutilisé : jamais tué)` |
| 43 | etat sans Bobine : erreur claire | Sans instance, `etat` sort avec le code 1 | `unitaire-main` | `cible.test.mjs` | partiel : `cible.test.mjs › fenêtre absente ou ambiguë : erreur qui le dit, avec les pages vues` |

**Verdict** : reduire — garder un essai court du pilote contre l'app réelle : 1, 2, 4, 5, 8, 12, 13, 19, 26, 27, 31, 39, 40, 42 (lancer, lecture de l'accueil, clic par libellé, envoi, carte, capture, navigateur, fille, arrêt). Le reste est la logique de `etat`/`attendre`/`journal`, déjà testée sur DOM simulé dans `pilote.test.mjs` et `cible.test.mjs`.
**Risques** :
- Les tests du pilote lisent des DOM écrits à la main. Seul l'e2e voit qu'un testid ou un libellé a changé dans l'app sans que `lecture.mjs` suive.
- Le brouillon vidé avant l'envoi dépend du `value` contrôlé par React, que jsdom ne reproduit pas.
- La largeur réelle de la capture et la liste réelle des cibles DevTools quand le WebContentsView est ouvert.

### `platform.mjs` — même app lancée avec les capacités de macOS, Linux et Windows (`BOBINE_PLATFORM`) : menu et cadre de fenêtre, notation des raccourcis, capture, simulateur dans le « + », groupe iOS du Diagnostic

<!-- stats suite=platform total=5 parcours=1 composant=3 unitaire-main=0 capture=0 doublon=1 couvert=5 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | menu de la plateforme : macOS 7 menus, rôles, feux à (18, 19) ; ailleurs ☰, 5 menus, barre d'Electron jamais montrée (×3, boucle) | Le vrai menu natif et le cadre de la vraie fenêtre suivent la plateforme | `parcours` | garder ici (fenêtre native) | partiel : `src/main/menu.test.ts › menus, rôles, identifiants et raccourcis du Mac, à l'identique` et `› menus des apps Linux : ni menu « Bobine » ni Fenêtre` + `src/main/window-chrome.test.ts › macOS : sans barre de titre, feux sur le contenu…` et `› Linux : décorations du système…` |
| 2 | raccourcis notés selon la plateforme, ☰, cadre natif, barres fines, sans verre, marge des feux (×3, boucle) | Le renderer reçoit les capacités par la ligne de commande et pose classes et notation | `composant` | `src/renderer/src/…/platform-classes.test.ts` (classes de `<html>` selon les capacités) | partiel : `src/shared/key-notation.test.ts › ailleurs : Ctrl, Alt, Maj dans cet ordre…` + `src/main/platform.test.ts › relues telles quelles depuis la ligne de commande du renderer` |
| 3 | capture d'écran proposée (macOS) / masquée (×3, boucle) | Le bouton de capture de la zone de saisie n'existe que sur macOS | `composant` | `src/renderer/src/components/composer/Composer.test.tsx` (capacité `screenCapture` absente) | partiel : `src/main/platform.test.ts › sous Linux, rien de ce que seul macOS a` (capacités seules) |
| 4 | simulateur iOS proposé / absent dans le « + » du panneau (×3, boucle) | L'onglet simulateur n'est proposé qu'avec la capacité | `composant` | — | `src/renderer/src/panel-tabs.test.ts › outil absent de la plateforme (fiche 145) : ni onglet ni entrée du menu « + »` |
| 5 | groupe iOS du Diagnostic présent / absent (×3, boucle) | Le diagnostic n'a de groupe iOS qu'avec le simulateur | `doublon` | — | `src/main/diagnostics.test.ts › sans simulateur (Linux, fiche 145) : ni groupe iOS ni commande Xcode` (+ `diagnostic.mjs` #1) |

**Verdict** : reduire — garder #1 (menu et cadre de la vraie fenêtre, trois plateformes simulées) avec une vérification légère que les capacités arrivent au renderer (une classe `native-frame` par exemple) ; #2-#5 passent en composant, déjà en grande partie couverts.
**Risques** :
- La transmission réelle des capacités main → renderer (argument de ligne de commande, `BOBINE_PLATFORM`) n'est vue que par un e2e : la garder dans la vérification restante.
- La marge des feux (84 px) et les barres fines sont du CSS calculé : jsdom ne le voit pas, capture nocturne nécessaire.

### `pr-ci.mjs` — Suivi de la PR et de la CI avec un faux `gh` : carte, contrôles, « Corriger », poussées, onglet Session, fusion d'office, « Nettoyer » (fiche 176)

<!-- stats suite=pr-ci total=19 parcours=6 composant=6 unitaire-main=0 capture=0 doublon=7 couvert=17 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | sans PR : pas de carte (gh interrogé) | Pas de PR → pas de suivi | `doublon` | — | `src/main/changes/pr-watch.test.ts › pas de PR : pas de relève ; relu par status après une minute` |
| 2 | PR neuve, CI dans le dépôt : « Contrôles en attente » | Contrôles attendus après poussée (D16) | `doublon` | — | `pr-watch.test.ts › juste après un push : relève toutes les 10 s pendant 2 min, contrôles « attendus » (D16)` |
| 3 | PR ouverte : note du lien non répétée, pas de bouton sans rien à pousser | Une seule issue, bouton caché | `composant` | `src/renderer/src/components/panel/WorktreeBar.test.tsx` (à créer) | partiel : `src/renderer/src/components/panel/worktree-outcome.test.ts › PR ouverte sans rien à pousser, ou fusionnée : pas de bouton` |
| 4 | carte : contrôles en cours, choix d'office décochés | Rendu de `PrCard` (lien, état, ligne, cases) | `composant` | `src/renderer/src/components/panel/PrCard.test.tsx` (à créer) | partiel : `src/shared/pr-tracking.test.ts › résumé des contrôles` |
| 5 | contrôle en échec d'abord, avec son lien ; commentaires, relecture, conflit | Ordre et méta de la carte | `composant` | `PrCard.test.tsx` (à créer) | partiel : `pr-tracking.test.ts › lit la PR : état, contrôles en échec d’abord, commentaires, relecture, conflits` |
| 6 | fusion d'office cochée en conflit : la raison, rien ne part | Raison d'attente, pas de `gh pr merge` | `doublon` | — | `pr-tracking.test.ts › pourquoi la fusion d’office attend…` ; `pr-watch.test.ts › « Fusionner quand tout est vert » : décochée, rien ; cochée, fusion une fois quand c’est prêt` |
| 7 | rien n'est envoyé à l'agent sans clic | Pas de consigne automatique | `doublon` | — | `pr-watch.test.ts › « Corriger les contrôles en échec » : consigne avec extraits, sur clic seulement` |
| 8 | consigne envoyée : contrôle, lien, extrait sans couleurs (`gh run view --log-failed`) | Clic → main → `gh run view` → message dans le fil de l'agent | `parcours` | garder ici | partiel : `pr-watch.test.ts › « Corriger… » : consigne avec extraits…` ; `pr-tracking.test.ts › extrait du journal : sans les couleurs du terminal (0.9.1, D18)` |
| 9 | « Pousser vers la PR » : branche poussée, PR gardée, bouton caché | Commit rédigé par l'agent puis `git push` réel, PR existante | `parcours` | garder ici | partiel : `src/main/changes/worktree-cycle.test.ts › PR par gh simulé : poussée, création, PR déjà là…` |
| 10 | commit hors de la barre : pas encore vu sans relecture | Pas de relecture spontanée (contrat négatif, minuté) | `composant` | `src/renderer/src/useWorktreeCycle.test.ts` | partiel : `useWorktreeCycle.test.ts › relit l’état quand la fenêtre reprend la main…` |
| 11 | « Actualiser » : commit fait au terminal vu, « Pousser vers la PR » revient | Commit git réel hors de l'app, relu par IPC | `parcours` | garder ici | partiel : `useWorktreeCycle.test.ts › « Actualiser » demande au main de relire aussi gh (D7)` |
| 12 | onglet Session : ligne « Pull request » avec l'état des contrôles | Ligne `session-pr-line` | `composant` | `src/renderer/src/components/panel/SessionTab.test.tsx` (ajouter) | non |
| 13 | tout vert, case décochée : rien fusionné ; note « envoyé à l'agent » partie (D17) | Pas de fusion sans accord, note effacée | `doublon` | — | `pr-watch.test.ts › « Fusionner quand tout est vert » : décochée, rien…` ; `› la note « envoyé à l’agent » s’efface quand les contrôles changent (0.9.1, D17)` |
| 14 | cochée : fusionnée par `gh pr merge --squash`, méthode dite, « Nettoyer » proposé | Fusion d'office de bout en bout, barre mise à jour | `parcours` | garder ici | partiel : `pr-watch.test.ts › méthode de fusion : celle que le dépôt permet, dite d’avance sur la carte` |
| 15 | PR fusionnée : plus de relève | Arrêt du suivi | `doublon` | — | `pr-watch.test.ts › cadence : 30 s tant que ça tourne… arrêt à la fusion` |
| 16 | question « Nettoyer » : la branche part aussi sur GitHub | Texte de confirmation | `composant` | `src/renderer/src/components/panel/WorktreeBar.test.tsx` (à créer) | non |
| 17 | nettoyée : worktree et branche distante supprimés, c'est dit | Suppression réelle (dépôt nu) | `parcours` | garder ici | partiel : `worktree-cycle.test.ts › branche distante après la fusion : bail, refus du dépôt…` ; `src/renderer/src/components/panel/WorktreeCleaned.test.tsx › dit la branche supprimée, gardée, ou l’erreur` |
| 18 | après « Nettoyer » : conversation dans le dépôt principal, sans erreur git | Conversation affichée rebasculée sur le dépôt (D21) | `parcours` | garder ici | partiel : `src/main/conversations/manager.test.ts › nettoyage d’un worktree (0.9.1, D21) : la conversation suivante part du dépôt…` |
| 19 | « Nouvelle conversation » après nettoyage : dans le dépôt principal | Conversation suivante pas dans le worktree supprimé | `doublon` | — | `manager.test.ts › nettoyage d’un worktree (0.9.1, D21)…` |

**Verdict** : reduire — garder 8, 9, 11, 14, 17, 18 (un seul fil PR de bout en bout : consigne, poussées, fusion, nettoyage) ; écrire `PrCard.test.tsx` et `WorktreeBar.test.tsx` pour 3, 4, 5, 12, 16 ; le reste est déjà couvert par `pr-watch`/`pr-tracking`.
**Risques** :
- `PrCard` n'a aucun test de composant aujourd'hui : il faut écrire les remplaçants avant de supprimer 4 et 5.
- L'enchaînement relève rapprochée → minuteurs du main → évènement IPC → carte n'est vu qu'en e2e (`pr-watch` simule le temps).

### `providers.mjs` — Réglages › Agents › Fournisseurs de modèles sur un vrai `opencode.jsonc` jetable : clé, ajout, « Tester » contre un faux serveur OpenAI, liste blanche, proxy, Diagnostic, suppression

<!-- stats suite=providers total=13 parcours=0 composant=4 unitaire-main=2 capture=0 doublon=7 couvert=11 verdict=disparaitre -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | fournisseur du fichier listé, clé en clair signalée, fichier nommé | Le fournisseur écrit à la main est lu, sa clé en clair est signalée, le chemin du fichier est affiché | `doublon` | — | `src/main/agent-config/providers-settings.test.ts › clé en clair dans le fichier : signalée…` ; `src/renderer/src/components/settings/ProvidersSettings.test.tsx › liste : nom, identifiant, adresse, modèles, clé…` |
| 2 | clé du fournisseur « enregistrée » (ou avis sans trousseau) | Après saisie, l'état de la clé passe à « enregistrée », ou « en clair » avec l'avis si pas de trousseau | `composant` | `src/renderer/src/components/settings/ProvidersSettings.test.tsx` (ajouter le cas sans trousseau) | partiel : `ProvidersSettings.test.tsx › clé : définie depuis la ligne (jamais affichée), puis « enregistrée »` (pas l'avis sans trousseau) |
| 3 | clé définie : `{env:VAR}` dans le fichier, commentaire et champs gardés, `.bak` | La clé n'est jamais écrite dans le fichier, le reste du JSONC est préservé, une copie est faite | `doublon` | — | `src/main/agent-config/provider-files.test.ts › fichier existant : commentaires… gardés ; .bak écrit` ; `providers-settings.test.ts › « Définir » la remplace par {env:VAR} et la chiffre` |
| 4 | fournisseur ajouté au format d'OpenCode, deux modèles | Le formulaire écrit un fournisseur compatible OpenAI avec `id = libellé` | `doublon` | — | `provider-files.test.ts › nouveau fournisseur : compatible OpenAI, clé attendue en {env:VAR}` ; `ProvidersSettings.test.tsx › formulaire : ajout avec les modèles « id = libellé »…` |
| 5 | « Tester » : répond, 2 modèles, GET /models sans clé | La sonde HTTP réelle compte les modèles et n'envoie pas de clé absente | `unitaire-main` | `src/main/agent-config/provider-probe.test.ts` (ajouter le cas sans clé) | partiel : `provider-probe.test.ts › répond : nombre de modèles, clé envoyée en Bearer…` (avec clé seulement) |
| 6 | « Tester » : connexion refusée, marche à suivre | Un point d'accès injoignable est classé `refused` et la ligne dit quoi faire | `doublon` | — | `provider-probe.test.ts › clé refusée, adresse sans /models, connexion refusée…` ; `ProvidersSettings.test.tsx › « Tester » : … erreur avec la marche à suivre` |
| 7 | « Seulement ces fournisseurs » : `enabled_providers` = les activés | Liste blanche écrite d'après les cases cochées | `doublon` | — | `provider-files.test.ts › activation : disabled_providers sans liste blanche, enabled_providers avec` ; `ProvidersSettings.test.tsx › activation, « seulement ces fournisseurs »…` |
| 8 | réseau d'entreprise : « Avancé » fermé résume ce qui est défini | Le `<summary>` fermé résume proxy/exceptions saisis | `composant` | `src/renderer/src/components/settings/NetworkSettings.test.tsx` (à créer) | non |
| 9 | réseau : proxy enregistré, « Tester » passe par lui | Le proxy saisi dans les réglages est appliqué à la sonde « Tester » (cause `proxy`) | `unitaire-main` | `src/main/agent-config/providers-settings.test.ts` (sonde avec réseau du SettingsStore) | partiel : `provider-probe.test.ts › proxy : tunnel CONNECT… proxy injoignable classés` ; `parcours-reglages › proxy injoignable : une nouvelle conversation le dit` (agent, pas la sonde) |
| 10 | diagnostic : fournisseur désactivé facultatif, l'autre joint | Diagnostic : une ligne par fournisseur, niveau `optional` si désactivé, `ok` si joint | `doublon` | — | `providers-settings.test.ts › « Tester » avec la clé enregistrée… ; Diagnostic ligne par ligne` |
| 11 | fournisseur supprimé, le reste du fichier intact | La suppression confirmée retire le fournisseur sans toucher `model` | `doublon` | — | `provider-files.test.ts › renommage… ; suppression nettoie les listes` ; `ProvidersSettings.test.tsx › … suppression confirmée dans la ligne (fiche 126)` |
| 12 | réglages › agents : la page de l'agent toujours là | Après suppression, on reste sur la page de l'agent (pas de retour intempestif) | `composant` | `src/renderer/src/components/settings/SettingsDialog.test.tsx` | non |
| 13 | proxy effacé (espace) : champ vidé, résumé « aucun » (waitFor) | Une saisie blanche efface le réglage et le résumé redevient « aucun » | `composant` | `NetworkSettings.test.tsx` (à créer) | partiel : `src/main/agent-config/network-env.test.ts › saisie nettoyée : espaces, vides omis…` |

**Verdict** : disparaitre. Tout le contrat est déjà dans les tests main (fichiers, sonde HTTP réelle, Diagnostic) et le composant ; il manque trois petits tests de composant (résumé réseau, page conservée, avis sans trousseau) et le cas « sans clé » de la sonde.
**Risques** :
- L'aller-retour réglage réseau → IPC → sonde n'est vérifié de bout en bout nulle part ailleurs (`parcours-reglages` passe par l'agent, pas par « Tester »).
- `BOBINE_CONFIG_HOME` (dossier personnel) résolu par l'app packagée : seulement en unitaire.

### `quick.mjs` — Fenêtre rapide (menu, raccourci global, capture d'écran simulée et ses refus, envoi dans une nouvelle conversation, Échap, agent bloqué)

<!-- stats suite=quick total=17 parcours=4 composant=8 unitaire-main=4 capture=0 doublon=1 couvert=11 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | raccourci global ⌥⌘B enregistré | Le raccourci est vraiment enregistré auprès du système au lancement | `unitaire-main` | `src/main/quick-entry.test.ts` | partiel : `quick-entry.test.ts › un seul raccourci à la fois, réenregistré quand le réglage change` (globalShortcut simulé) |
| 2 | Fichier › Fenêtre rapide : ouverte, rappelle où part le message | Le menu ouvre une vraie fenêtre visible, qui nomme l'agent cible | `parcours` | `parcours-outils`, étape « la fenêtre rapide envoie dans une nouvelle conversation » (ajouter la cible) | partiel : `parcours-outils › la fenêtre rapide envoie…` (ouverte par le menu, cible non lue) ; `quick-entry.test.ts › macOS (hiddenPaint) : montrée à ready-to-show` |
| 3 | capture annulée : rien de joint, la fenêtre revient | Échap pendant la sélection : fenêtre masquée puis remontrée, aucune image | `unitaire-main` | `src/main/screen-capture.test.ts` | `screen-capture.test.ts › zone choisie : fichier lu, fenêtres masquées puis remises ; Échap : rien` |
| 4 | capture annulée : aucun message | Échap n'est pas présenté comme un échec dans la fenêtre rapide | `composant` | `src/renderer/src/components/composer/QuickEntry.test.tsx` (à créer) | non |
| 5 | capture refusée par macOS après la sélection : rien de joint, le dit | Échec après sélection → raison `failed` et texte dans la fenêtre rapide | `composant` | `QuickEntry.test.tsx` (à créer) | partiel : `screen-capture.test.ts › échec sans annulation : refus de macOS après la sélection…` (côté main) |
| 6 | autorisation refusée : pas de screencapture, fenêtre gardée, message | Sans autorisation, la commande n'est pas lancée ni la fenêtre masquée | `unitaire-main` | `src/main/screen-capture.test.ts` + `QuickEntry.test.tsx` pour le message | partiel : `screen-capture.test.ts › refusée ou restreinte : indisponible, sans lancer la commande ni masquer les fenêtres` |
| 7 | bouton : ouvre Réglages Système › Enregistrement de l'écran | Le bouton ouvre l'adresse `Privacy_ScreenCapture` | `composant` | `QuickEntry.test.tsx` (à créer) | partiel : `Composer.test.tsx › capture impossible (fiche 124)…` ; `src/main/diagnostics.test.ts` (adresse) |
| 8 | autorisation rendue : capture jointe, le message s'en va | Une capture réussie efface l'avis d'échec | `composant` | `QuickEntry.test.tsx` (à créer) | partiel : `Composer.test.tsx › capture impossible (fiche 124)…` (zone de saisie) |
| 9 | capture jointe comme image (waitFor img) | L'image renvoyée par le main apparaît dans la fenêtre rapide | `composant` | `QuickEntry.test.tsx` (à créer) | non |
| 10 | sans capture d'écran : pas de bouton dans la fenêtre rapide | Sans capacité `screenCapture`, pas de bouton | `composant` | `QuickEntry.test.tsx` (à créer) | non |
| 11 | Entrée : nouvelle conversation dans la fenêtre principale, image comprise, réponse sans doublon | Fenêtre rapide → main → fenêtre principale : une conversation, l'image jointe, une seule réponse | `parcours` | `parcours-outils`, étape « la fenêtre rapide envoie… » (y joindre une capture) | partiel : `parcours-outils › fenêtre rapide : nouvelle conversation affichée dans la fenêtre principale, réponse` (sans image) |
| 12 | zone de saisie : capture jointe (waitFor) | Le bouton capture de la zone de saisie joint l'image | `composant` | `src/renderer/src/components/composer/Composer.test.tsx` | partiel : `Composer.test.tsx › capture impossible (fiche 124)…` |
| 13 | zone de saisie, autorisation refusée : message sous la zone, rien de plus joint | Refus dit sous la zone de saisie avec le réglage à ouvrir | `doublon` | — | `Composer.test.tsx › capture impossible (fiche 124) : dit sous la zone de saisie, réglage de macOS à ouvrir` |
| 14 | sans capture d'écran : pas de bouton dans la zone de saisie | Sans capacité, pas de bouton capture | `composant` | `Composer.test.tsx` | non |
| 15 | réglage : raccourci désactivé, puis remis | Le réglage désenregistre puis réenregistre le raccourci global | `unitaire-main` | `src/main/quick-entry.test.ts` | `quick-entry.test.ts › un seul raccourci à la fois, réenregistré quand le réglage change` |
| 16 | Échap : fenêtre rapide refermée | Échap masque la vraie fenêtre native | `parcours` | `parcours-outils`, étape « la fenêtre rapide… » | non |
| 17 | agent qui attend une connexion : message et image dans la zone de saisie, sous son panneau | Agent bloqué : le message de la fenêtre rapide est rangé dans la zone de saisie, pas envoyé | `parcours` | garder ici, ou `parcours-pannes` (nouvelle étape) | non |

**Verdict** : reduire. Garder 2, 11, 16, 17 (fenêtre native et passage fenêtre rapide → main → fenêtre principale), à fondre dans l'étape de `parcours-outils` ; le reste dans un `QuickEntry.test.tsx` à créer (aucun test de composant aujourd'hui) et les tests main existants.
**Risques** :
- `QuickEntry.tsx` n'a aucun test de composant : supprimer avant de le créer perd 6 vérifications.
- Visibilité réelle de la fenêtre (Linux, `ready-to-show`, fiche 250) : seul l'e2e la voit.
- `screencapture` réel et l'autorisation macOS restent simulés partout.

### `relecture-commits.mjs` — `@code-reviewer` après une fusion : portée = commits de la conversation, diff relu ouvert depuis `fichier:ligne`, « corrigé depuis », « rien à signaler », fichier hors portée

<!-- stats suite=relecture-commits total=7 parcours=0 composant=0 unitaire-main=0 capture=1 doublon=6 couvert=6 verdict=disparaitre -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | le dernier commit est la fusion (contre son premier parent : le thème seul) | Prérequis du dépôt jetable : reproduit la recette N1 | `doublon` | — | `src/main/conversations/review-target.test.ts › recette N1 : après une fusion de main dans la branche du travail…` |
| 2 | la carte dit ce qui a été relu, d'où (4 commits, 3 fichiers, plage) | Portée d'office = commits de la conversation, pas la fusion seule, et la carte l'affiche | `doublon` | — | `review-target.test.ts › recette N1…` ; `src/renderer/src/components/thread/WorkReview.test.tsx › fiche 267 (recette N1) : la carte dit ce qui a été relu…` |
| 3 | clic sur `fichier:ligne` : le diff relu, jamais « Aucune modification » | Le clic ouvre le diff de la plage relue, ligne mise en avant | `doublon` | — | `WorkReview.test.tsx › fiche 267 (N2) : une portée commitée ouvre le diff de la portée relue` ; `src/renderer/src/components/panel/ChangesTab.test.tsx › remarque d'une branche ou d'un commit relus : le diff depuis ce point…` |
| 4 | onglet Modifications : aucun débordement horizontal (×4, boucle) | Rien ne dépasse du panneau (diff relu, après « Actualiser », 900 px, lignes citées) | `capture` | capture nocturne `267-relecture-*` | non |
| 5 | corrigé depuis : le diff relu reste, la vue dit que le fichier a changé | Un fichier modifié après la relecture garde le diff relu et un avis | `doublon` | — | `ChangesTab.test.tsx › fiche 267 (N2) : portée commitée, le diff relu même corrigé depuis, et la vue le dit` |
| 6 | rien à signaler, et sur quoi : depuis la dernière relecture | La relecture suivante part du dernier commit relu et le dit | `doublon` | — | `review-target.test.ts › depuis le dernier commit relu, s'il est un ancêtre de HEAD` ; `WorkReview.test.tsx › rien à signaler : dit dans l'en-tête et la carte…` |
| 7 | fichier hors de la portée relue : dit, lignes citées mises en avant | Remarque sur un fichier hors portée : avis + lignes citées | `doublon` | — | `ChangesTab.test.tsx › fiche 267 (N2) : avec du non commité relu… ; inchangé : dit` |

**Verdict** : disparaitre. Les contrats sont couverts côté main (git réel dans `review-target.test.ts`) et côté composant ; la relecture de bout en bout reste dans `parcours-matinee` (étape « faire relire par le Code reviewer »).
**Risques** :
- Le chemin `@code-reviewer` tapé dans la saisie (et non le bouton) n'est plus joué de bout en bout.
- Les débordements horizontaux ne seront vus qu'en capture (jsdom ne calcule pas la mise en page).

### `replay-changes.mjs` — Modifications après redémarrage : diffs d'OpenCode refaits depuis le patch, `write` sans diff (créé, réécrit), création par Bob 2.0.9

<!-- stats suite=replay-changes total=12 parcours=1 composant=2 unitaire-main=3 capture=0 doublon=6 couvert=10 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | en direct : 3 fichiers, +20 −1 | Les modifications d'un patch OpenCode sont comptées en direct | `doublon` | — | `parcours-matinee › Modifications : README.md et src/app.js…` ; `src/shared/changes.test.ts › totaux, chemins` |
| 2 | après redémarrage (rejeu) : mêmes fichiers et totaux qu'en direct | Au rejeu ACP après relance, l'app refait les diffs absents depuis `rawOutput.metadata.files[].patch` | `parcours` | garder ici (une seule phase), ou `parcours-longue` étape « relancer » avec le scénario `patch-opencode` | partiel : `src/main/agent/opencode-diffs.test.ts › un diff par bloc du patch, chemin résolu…` (sans redémarrage) |
| 3 | diff refait depuis le patch : avant et après | Le diff reconstruit contient l'ancienne et la nouvelle ligne | `doublon` | — | `opencode-diffs.test.ts › un diff par bloc du patch…` |
| 4 | pied du tour : 2 fichiers, dont 1 sans totaux | Fichier réécrit sans diff : compté, « sans totaux » | `doublon` | — | `src/renderer/src/components/thread/TurnSummary.test.tsx › jamais « +0 −0 » : « sans totaux »…` ; `changes.test.ts › le fichier réécrit compte comme modifié, sans totaux inventés` |
| 5 | en direct : README.md réécrit compte | `write` sans diff (« Wrote file successfully ») compte comme modification | `doublon` | — | `changes.test.ts › le fichier réécrit compte comme modifié…` ; `src/main/agent/trace-replay.test.ts › OpenCode, réécriture par write…` |
| 6 | README.md : « modifié », sans totaux inventés | Le badge `changes.unknownBadge` remplace les totaux | `composant` | `src/renderer/src/components/panel/ChangesTab.test.tsx` | non |
| 7 | pas d'« Annuler cette modification » sans ancien texte | Pas de bouton d'annulation quand l'ancien texte est inconnu | `composant` | `ChangesTab.test.tsx` | non |
| 8 | après redémarrage : README.md réécrit compte toujours | La modification sans diff survit au rejeu | `unitaire-main` | `src/main/agent/trace-replay.test.ts` (trace de rejeu `reecriture-opencode`) | partiel : `changes.test.ts › écriture sans diff…` (sans rejeu) |
| 9 | en direct : nouveau.txt et autorise.txt créés comptent avec README.md | Fichiers créés par `write` (fin sans diff) comptent, avec ou sans autorisation | `doublon` | — | `opencode-diffs.test.ts › « Created file successfully » : tout en ajout, depuis l'entrée de l'outil` |
| 10 | après redémarrage : mêmes fichiers créés et mêmes totaux | Les créations survivent au rejeu | `unitaire-main` | `trace-replay.test.ts` (trace de rejeu `ecriture-opencode`) | partiel : `opencode-diffs.test.ts › fichier créé par write (fiche 202)` |
| 11 | Bob, en direct : « Création de … alpha.txt » | Diff `oldText: ""` sur fichier absent = création | `doublon` | — | `src/main/agent/new-files.test.ts › absent quand il est proposé : création…` ; `trace-replay.test.ts › Bob 2.0.9, fichier neuf…` |
| 12 | Bob, après redémarrage (le fichier existe) : toujours « Création » | La décision « création » est gardée, pas recalculée depuis le disque | `unitaire-main` | `new-files.test.ts` / `trace-replay.test.ts` | partiel : `new-files.test.ts › outil déjà lancé, autre genre, chemin relatif, rejeu : le disque n'est pas regardé` |

**Verdict** : reduire. Garder 2 (un vrai rejeu après redémarrage) ; 8, 10, 12 deviennent des traces rejouées côté main, 6 et 7 des tests de `ChangesTab`.
**Risques** :
- Le chemin persistance → relance → `session/load` → reconstruction n'a pas d'équivalent unitaire complet.
- La décision « création » de Bob (12) dépend de l'état enregistré du fil ; un test unitaire pourrait ne pas voir une perte à l'enregistrement.

### `resume.mjs` — reprendre une session commencée ailleurs (stockée par l'agent) : liste du dossier, tous les dossiers, filtre, reprise et rejeu, plus proposée ensuite

<!-- stats suite=resume total=7 parcours=2 composant=3 unitaire-main=1 capture=0 doublon=1 couvert=4 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | reprendre : la session du dossier, pas celle d'un autre dossier ni celles déjà connues | La liste (`session/list` filtrée par dossier) exclut les autres dossiers et les sessions déjà dans l'historique | `unitaire-main` | — | `src/main/conversations/manager.test.ts › reprendre une session commencée ailleurs : liste filtrée, rejeu, pas de doublon (fiche 055)` |
| 2 | tous les dossiers : sessions groupées par dossier | « Tous les dossiers » élargit la liste et groupe par dossier | `composant` | `src/renderer/src/components/dialogs/ResumeDialog.test.tsx` (à créer) | partiel : `src/main/agent/session-list.test.ts › fusionne la liste sans dossier et celles des dossiers demandés, sans doublon` |
| 3 | filtre « parser » puis « postgres » : une session (waitFor) | Le champ filtre la liste par titre | `composant` | idem #2 | non |
| 4 | reprise : conversation ouverte, échange rejoué | `session/load` réel : l'agent rejoue l'échange, la conversation apparaît active dans l'historique | `parcours` | garder ici, ou nouvelle étape de `parcours-outils` | partiel : `manager.test.ts › reprendre une session commencée ailleurs : liste filtrée, rejeu, pas de doublon (fiche 055)` |
| 5 | reprise : on continue la conversation | Un message après la reprise part dans la session reprise | `parcours` | garder ici (fusionné avec #4) | non |
| 6 | fenêtre refermée : le menu de l'historique se rouvre | La boîte de reprise refermée ne laisse pas de modal qui bloque le menu | `composant` | idem #2 / `AppDialogs.test.tsx` | non |
| 7 | menu Fichier (⇧⌘O) : la session reprise n'est plus proposée | Une session reprise n'est plus listée | `doublon` | — | `manager.test.ts › reprendre une session commencée ailleurs : … pas de doublon (fiche 055)` |

**Verdict** : reduire — garder #4-5 (reprise réelle par `session/load` puis on continue), idéalement comme une étape d'une journée type ; la liste, le filtre et le groupement passent dans un `ResumeDialog.test.tsx` à créer.
**Risques** :
- La boîte de reprise n'a aucun test de composant aujourd'hui (3 lignes à écrire).
- Le rejeu d'une session stockée par l'agent (format de l'historique, chunks) jusqu'au fil n'est vu qu'ici.

### `roles-meme-icone.mjs` — deux rôles personnels de même icône et même couleur (deux fichiers, deux tuiles) ; identifiant d'un rôle fourni refusé à l'étape 1, identifiant libre proposé

<!-- stats suite=roles-meme-icone total=4 parcours=0 composant=1 unitaire-main=0 capture=0 doublon=3 couvert=4 verdict=disparaitre -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | deux rôles de même icône et même couleur : deux fichiers, deux tuiles dans l'Équipe | Une même icône ne fait pas écraser un rôle par l'autre | `doublon` | — | `src/main/roles/library.test.ts › deux rôles de même icône et même couleur, noms différents : tous deux gardés` ; `src/renderer/src/components/roles/RoleWizard.test.tsx › même icône qu'un rôle connu, autre identifiant : rien n'est signalé, création normale` ; tuiles après création par l'assistant : `e2e/suites/roles-gestion.mjs` |
| 2 | Réglages › Rôles : les deux rôles personnels listés | Les deux rôles apparaissent dans le groupe « personnels » | `composant` | `src/renderer/src/components/roles/RolesSettings.test.tsx` | partiel : `RolesSettings.test.tsx › trois groupes, rôle de projet qui en remplace un autre, rôle désactivé, fichier écarté` |
| 3 | identifiant d'un rôle fourni : refusé dès l'étape 1, le rôle qui le porte est nommé | « code-reviewer » est refusé à l'étape 1 avec un message qui nomme le rôle fourni | `doublon` | — | `RoleWizard.test.tsx › identifiant d'un rôle connu : dit dès l'étape 1, « Utiliser @… » propose celui du main` |
| 4 | « Utiliser @code-reviewer-2 » : rôle créé à côté du fourni, rien de remplacé | L'identifiant suggéré crée un nouveau fichier et laisse le rôle fourni et les autres rôles intacts | `doublon` | — | `library.test.ts › identifiant d'un rôle fourni : refusé à la création, sauf « Enregistrer en personnel »` et `› suggestion du main : rôles cachés et fichiers non lus compris…` ; `RoleWizard.test.tsx › identifiant d'un rôle connu…` |

**Verdict** : disparaitre — chaque contrat est déjà testé au bon niveau : bibliothèque du main sur un vrai disque, assistant en test de composant. Seule la liste de Réglages › Rôles avec deux rôles de même icône mérite un cas de plus dans `RolesSettings.test.tsx`.
**Risques** :
- Le rafraîchissement des tuiles de l'Équipe après la création (enregistrement par IPC, puis relecture du dossier `roles/`) reste couvert par `roles-gestion.mjs`, à garder.

### `scheduled.mjs` — Tâches planifiées : échéance au lancement, autorisation qui attend, manquées sans rattrapage, formulaire, « Lancer maintenant » arrêté au plafond

<!-- stats suite=scheduled total=18 parcours=3 composant=8 unitaire-main=1 capture=1 doublon=5 couvert=12 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | échéance atteinte : conversation « Revue du matin » dans la barre latérale, avec le repère | Au lancement, le planificateur du main crée et lance la conversation, marquée dans la barre | `parcours` | garder ici (ou nouvelle étape de `parcours-matinee`) | partiel : `src/main/scheduler/scheduler.test.ts › à l'échéance : une conversation marquée « planifiée »…` ; `src/renderer/src/components/sidebar/Sidebar.test.tsx › … une exécution planifiée a son repère` |
| 2 | la tâche en retard sans rattrapage ne lance rien | Sans rattrapage, aucune exécution ne part | `doublon` | — | `scheduler.test.ts › sans rattrapage : notée manquée, rien ne part` |
| 3 | autorisation en attente : l'exécution reste « en cours » (waitFor) | Une exécution sans surveillance ne s'accorde rien : la demande ACP attend l'utilisateur | `parcours` | garder ici | non |
| 4 | titre de la page dans la barre de titre | « Tâches planifiées » dans `activity-title` | `composant` | `src/renderer/src/components/scheduled/ScheduledPage.test.tsx` | non |
| 5 | l'exécution de la tâche à l'heure est terminée | Fin du tour → issue `done` notée | `unitaire-main` | `scheduler.test.ts` | `scheduler.test.ts › fin du tour : issue et coût réel notés` |
| 6 | échéances manquées sans rattrapage : une seule ligne « manquée » | Plusieurs échéances manquées → une ligne | `doublon` | — | `scheduler.test.ts › sans rattrapage : notée manquée…` ; `src/shared/schedule.test.ts › sans rattrapage : notée manquée, rien ne part` |
| 7 | … qui compte les quatre échéances | Le texte dit le nombre d'échéances manquées | `composant` | `ScheduledPage.test.tsx` | partiel : `scheduler.test.ts › sans rattrapage…` (`missed` compté, affichage non testé) |
| 8 | la page dit que les tâches ne tournent que Bobine ouverte | Avis `scheduled.openOnly` affiché | `composant` | `ScheduledPage.test.tsx` | non |
| 9 | plafond affiché dans la devise connue des exécutions passées | Plafond formaté dans l'unité des exécutions | `composant` | `ScheduledPage.test.tsx` | `ScheduledPage.test.tsx › liste la tâche : fréquence, prochaine échéance, coût estimé, plafond, exécutions` ; `schedule.test.ts › unité connue d'une exécution passée…` |
| 10 | actions de la tâche sur une seule ligne | Boutons alignés verticalement | `capture` | capture nocturne `178-taches-planifiees` | non |
| 11 | nouvelle tâche : dossier de la conversation ouverte proposé d'office, en tête du menu | Préremplissage du dossier et menu des récents | `doublon` | — | `ScheduledPage.test.tsx › nouvelle tâche : dossier de la conversation ouverte prérempli, les récents au menu (fiche 276)` |
| 12 | nouvelle tâche : l'agent des nouvelles conversations choisi d'office (check true) | Agent par défaut du formulaire = celui des nouvelles conversations | `composant` | `ScheduledPage.test.tsx` | non |
| 13 | toutes les 4 heures sans plafond : avertissement (waitFor) | Tâche fréquente sans plafond → avertissement | `doublon` | — | `ScheduledPage.test.tsx › nouvelle tâche : enregistrée seulement quand…` (`scheduled-no-cap-warning`, « 6 exécutions ») |
| 14 | tâche enregistrée, nommée d'après sa consigne | Nom par défaut tiré de la consigne | `doublon` | — | `schedule.test.ts › nettoie, nomme d'après la consigne…` ; `ScheduledPage.test.tsx › nouvelle tâche : enregistrée…` |
| 15 | pendant l'exécution, « Lancer maintenant » désactivé | Jamais deux exécutions à la fois depuis la page | `composant` | `ScheduledPage.test.tsx` | partiel : `scheduler.test.ts › jamais deux exécutions à la fois : l'échéance est sautée` |
| 16 | plafond franchi : exécution « arrêtée au plafond » (waitFor) | Le gardien de coût (fiche 157) arrête un vrai tour ACP et le planificateur note `capped` | `parcours` | garder ici | partiel : `scheduler.test.ts › plafond de la tâche : posé à la première consommation…` |
| 17 | coût réel de l'exécution affiché | Le coût de l'exécution apparaît sur sa ligne | `composant` | `ScheduledPage.test.tsx` | partiel : `ScheduledPage.test.tsx › liste la tâche… exécutions` |
| 18 | la conversation de l'exécution s'ouvre sur la carte « Plafond atteint » (waitFor) | Ouvrir l'exécution mène à sa conversation et sa carte de plafond | `composant` | `ScheduledPage.test.tsx` + `TurnGuards.test.tsx` | partiel : `ScheduledPage.test.tsx › liste la tâche…` (clic `scheduled-run-open`) ; `src/renderer/src/components/thread/TurnGuards.test.tsx` (`cost-cap-card`) |

**Verdict** : reduire. Garder 1, 3, 16 (minuterie du main au lancement, demande ACP non accordée, plafond qui arrête un vrai tour) ; le reste va dans `ScheduledPage.test.tsx` et `scheduler.test.ts`.
**Risques** :
- « Rien n'est accordé à sa place » (3) est un contrat de sécurité sans test unitaire aujourd'hui.
- Le fichier `scheduled-tasks.json` relu au démarrage réel, et la minuterie à l'heure locale, ne sont vus qu'ici.

### `simulator.mjs` — Simulateur iOS avec faux `xcrun`/`axe` : outils MCP de l'agent, flux vidéo BGRA, gestes, zoom, flux perdu, planche contact

<!-- stats suite=simulator total=24 parcours=3 composant=11 unitaire-main=1 capture=3 doublon=6 couvert=17 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | appareil démarré trouvé, app lancée | L'agent, par MCP, trouve l'appareil démarré et lance l'app | `parcours` | garder ici, ou nouvelle étape de `parcours-outils` | partiel : `src/main/simulator/simulator-tools.test.ts › installer et lancer un .app…` ; `src/main/simulator/simctl.test.ts › lancement : pid lu…` |
| 2 | écran lu par l'accessibilité, toucher au centre du bouton désigné | `describe-ui` puis `tap` au centre du cadre | `doublon` | — | `simulator-tools.test.ts › lire l'écran puis toucher par référence…` ; `src/main/simulator/axe.test.ts › une ligne par élément nommé, référence = centre du cadre` |
| 3 | saisie « Zoé » collée (presse-papiers + ⌘V) | Texte passé par `simctl pbcopy` puis ⌘V | `doublon` | — | `simulator-tools.test.ts › … saisie et bouton passent par AXe` ; `simctl.test.ts › texte encodé en MacRoman pour le presse-papiers` |
| 4 | aucune autorisation demandée ; onglet « Simulateur » ouvert tout seul | Outils autorisés d'office et ouverture de l'onglet par le main | `parcours` | idem 1 | partiel : `simulator-tools.test.ts › proposés seulement pour un projet Apple, autorisés d'office, onglet « Simulateur »` |
| 5 | version d'AXe affichée avant le passage aux FPS | La barre affiche la version d'AXe au démarrage | `composant` | `src/renderer/src/components/panel/SimulatorTab.test.tsx` (à créer) | non |
| 6 | flux vidéo démarré (BGRA → JPEG) et dessiné | Processus `axe stream-video` → main → canevas du renderer, à la bonne taille | `parcours` | idem 1 | partiel : `src/main/simulator/bgra-frames.test.ts › streamGeometry…` / `FixedFrames…` |
| 7 | débit en direct affiché, version d'AXe dans l'infobulle | « N fps » remplace la version, qui passe en infobulle | `composant` | `SimulatorTab.test.tsx` (à créer) | non |
| 8 | écran du simulateur joint au message (check true) | « Joindre au message » met l'image dans la zone de saisie | `composant` | `SimulatorTab.test.tsx` (à créer) | non |
| 9 | châssis d'iPhone : coins arrondis, proportions, pas de bouton d'accueil | Châssis choisi d'après le type d'appareil | `composant` | `src/renderer/src/device-chassis.test.ts` + `SimulatorTab.test.tsx` | partiel : `device-chassis.test.ts › gives recent iPhones rounded corners and a thin, even bezel` |
| 10 | commandes (accueil, verrouillage, joindre) sous l'iPhone | Barre de commandes placée sous l'appareil | `capture` | capture nocturne `28-simulateur` | non |
| 11 | clic sur la vidéo : toucher au point correspondant | Conversion clic → coordonnées en points de l'appareil | `composant` | `src/renderer/src/screen-gestures.test.ts` | partiel : `screen-gestures.test.ts › a short click is a tap, wherever the pointer ended` |
| 12 | glisser : balayage entre les deux points, durée du geste | Glisser = `swipe` aux bons points et à la bonne durée | `doublon` | — | `screen-gestures.test.ts › a drag is a swipe lasting as long as the gesture, within bounds` |
| 13 | molette : balayage vers le haut à l'endroit du pointeur | Molette = court balayage au pointeur | `doublon` | — | `screen-gestures.test.ts › scrolling down pushes the content up from the pointer…` |
| 14 | flux interrompu : retour aux captures successives, raison affichée | Mort du flux AXe → repli sur les captures, raison dite | `unitaire-main` | `src/main/simulator/simulator-manager.test.ts` (à créer) | non |
| 15 | capture de l'appareil affichée dans l'onglet | Nom de l'appareil et capture affichés | `composant` | `SimulatorTab.test.tsx` (à créer) | non |
| 16 | zoom : « ajuster » au départ, niveau affiché | État initial du zoom | `composant` | `src/renderer/src/device-zoom.test.ts` | partiel : `device-zoom.test.ts › « ajuster » suit la place disponible…` |
| 17 | taille réelle : 1 point par point, défile, barre visible | Zoom 100 % et défilement, commandes visibles | `capture` | capture nocturne `28e-simulateur-zoom` | partiel : `device-zoom.test.ts › palier suivant et précédent…` |
| 18 | zoom depuis « ajuster » : le milieu reste au centre | Le zoom s'ancre au centre de la partie visible | `composant` | `device-zoom.test.ts` (extraire le calcul d'ancrage) | partiel : `device-zoom.test.ts` (paliers, pas l'ancrage) |
| 19 | zoomé : un clic touche le point correspondant | Conversion des coordonnées juste une fois zoomé | `composant` | `screen-gestures.test.ts` | partiel : `screen-gestures.test.ts › a short click is a tap…` |
| 20 | zoomé : la molette déplace la vue, sans faire défiler l'app | Zoomé, la molette ne produit pas de `swipe` | `composant` | `SimulatorTab.test.tsx` (à créer) | non |
| 21 | zoomer : palier suivant (125 %) | Paliers de zoom | `doublon` | — | `device-zoom.test.ts › palier suivant et précédent d'après l'échelle affichée` |
| 22 | « ajuster » : l'appareil tient de nouveau en entier | Retour à « ajuster » après zoom | `capture` | capture nocturne | partiel : `device-zoom.test.ts › « ajuster » suit la place disponible` |
| 23 | planche contact iOS : balayage filmé dans le flux d'AXe | Outil `planche` : geste pendant le film, images différentes | `doublon` | — | `simulator-tools.test.ts › fait le geste pendant le film du flux, rend une planche…` |
| 24 | planche contact iOS affichée dans la carte de l'outil | Image de l'outil rendue dans la carte | `composant` | `src/renderer/src/components/thread/Transcript.test.tsx` | partiel : `Transcript.test.tsx` (`tool-images`) |

**Verdict** : reduire. Garder 1, 4, 6 (agent → MCP → faux binaires → onglet ouvert → flux dessiné) en une étape courte ; les gestes, le zoom et l'affichage vont dans un `SimulatorTab.test.tsx` à créer, et le repli de flux dans un test de `simulator-manager`.
**Risques** :
- `SimulatorTab.tsx` et `simulator-manager.ts` n'ont aucun test : 8 vérifications ne valent que si on les crée d'abord.
- La conversion pointeur → points dépend de vraies tailles de rendu (canevas, zoom) que jsdom ne calcule pas.
- La gestion de la mort du processus de flux n'est vue qu'ici.

### `subagents.mjs` — Carte « Sous-agents » : Bob (autorisation, coût relu dans sa base), OpenCode 1.19/2/2.3.0, arrière-plan, parallèles, réponse hors tour, redémarrages

<!-- stats suite=subagents total=29 parcours=4 composant=4 unitaire-main=3 capture=0 doublon=18 couvert=28 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Bob : « Lancer ce sous-agent ? » sous la carte, avec sa consigne | Autorisation d'un sous-agent placée sous sa carte | `doublon` | — | `src/renderer/src/components/thread/SubagentsCard.test.tsx › autorisation en attente : sous la carte, avec la consigne…` |
| 2 | Bob : durée et coût du sous-agent pendant qu'il travaille | Coût relu en direct dans la base SQLite de Bob (veille du fichier) jusqu'à la carte | `parcours` | garder ici | partiel : `src/main/agent/bob-costs.test.ts › sous-agents Bob (fiche 053)` ; `… › vrai dossier : une écriture du coût par l'agent factice est signalée` |
| 3 | indicateur « Sous-agent : … » et sa durée | Indicateur sous le fil nommé d'après la carte | `doublon` | — | `src/renderer/src/components/thread/WorkingIndicator.test.tsx › le sous-agent en cours, et le temps depuis l'envoi du message` |
| 4 | Bob : coût final du sous-agent sur sa ligne (check true) | Coût final relu à la fin | `unitaire-main` | `bob-costs.test.ts` | partiel : `bob-costs.test.ts › lignes subagent de la conversation… coût s'il est lisible` |
| 5 | Bob : carte « Sous-agent · 1 fini », ligne « explore · consigne » | Reconnaissance du sous-agent Bob et rendu de la carte | `doublon` | — | `src/main/agent/bob-subagents.test.ts › Bob 2.0.6…` ; `SubagentsCard.test.tsx › sous-agents consécutifs : une carte, une ligne chacun, comptes et coût total` |
| 6 | Bob : réponse mise en forme, sans `<task_result>` | Balises retirées, Markdown rendu | `doublon` | — | `src/shared/subagent.test.ts › résultat sans balises (Bob, OpenCode), texte libre inchangé` |
| 7 | OpenCode : consigne complète et réponse, sans `<task>` | Consigne complète gardée, balises retirées | `doublon` | — | `src/main/agent/opencode-subagents.test.ts › OpenCode 1.19 : rawInput.subagent_type, consigne complète gardée à part` ; `subagent.test.ts › résultat sans balises…` |
| 8 | OpenCode : « Voir son travail » rejoue la session du sous-agent | Clic → IPC → main recharge la session fille par ACP → travail affiché | `parcours` | garder ici | partiel : `src/main/agent/subagent-works.test.ts › rejoué une fois, sans la consigne déjà sur la carte` |
| 9 | OpenCode 2 : seule la réponse de l'agent dans le fil | Rien du sous-agent collé dans la réponse | `doublon` | — | `src/shared/transcript.test.ts › outils et texte rangés sous la carte, réflexion écartée, rien dans le fil` |
| 10 | OpenCode 2 : ses outils ne sont pas dans le fil | Outils du sous-agent rangés sous la carte | `doublon` | — | `transcript.test.ts › outils et texte rangés sous la carte…` ; `src/main/agent/trace-replay.test.ts › OpenCode : … travail du sous-agent sous sa carte` |
| 11 | OpenCode 2 : son travail sous la carte, sans bouton de rejeu | Travail reçu en direct affiché, pas de « Voir son travail » | `composant` | `SubagentsCard.test.tsx` | partiel : `transcript.test.ts › outils et texte rangés sous la carte…` |
| 12 | arrière-plan : « en cours » après la fin du tour | Sous-agent en arrière-plan pas « fini, < 1 s » | `doublon` | — | `src/shared/subagent-background.test.ts › reste « en cours » après son outil et après la fin du tour` |
| 13 | arrière-plan : fini quand sa session finit, avec sa réponse finale | La fin vient de la session fille, avec la vraie réponse | `doublon` | — | `subagent-background.test.ts › fini avec sa réponse quand sa session a fini` ; `src/main/agent/subagent-tracker.test.ts` |
| 14 | arrière-plan : « 1 fini » dans l'en-tête | Compte de l'en-tête mis à jour | `doublon` | — | `SubagentsCard.test.tsx › sous-agents consécutifs : … comptes et coût total` |
| 15 | deux sous-agents : une carte, deux lignes, « 2 en cours », coût total en direct | Regroupement de sous-agents lancés ensemble | `doublon` | — | `SubagentsCard.test.tsx › sous-agents consécutifs…` |
| 16 | le premier finit d'abord | Statuts indépendants par ligne | `composant` | `SubagentsCard.test.tsx` | partiel : `SubagentsCard.test.tsx › sous-agents consécutifs…` |
| 17 | « Réponse » déplie la réponse du premier, mise en forme | Dépliage et rendu Markdown de la réponse | `composant` | `SubagentsCard.test.tsx` | partiel : `subagent.test.ts › résultat sans balises…` |
| 18 | arrière-plan : un autre message part avant sa fin, carte toujours « en cours » | D25 : un message n'interrompt pas le sous-agent | `doublon` | — | `src/main/agent/agent-host-background.test.ts › un autre message pendant que le sous-agent travaille : il part tout de suite…` |
| 19 | arrière-plan : fini dans le tour précédent, avec sa réponse (check true) | La carte d'un tour plus ancien se termine quand même | `doublon` | — | `subagent-background.test.ts › fini même si d'autres messages sont partis depuis (D25, fiche 127)` |
| 20 | arrière-plan : toujours fini, avec sa réponse, après redémarrage | L'état fini du sous-agent est enregistré et relu | `parcours` | garder ici (fusionner avec 29 en un seul redémarrage) | partiel : `subagent-background.test.ts › suivi perdu, agent arrêté ou fil relu du disque : interrompu` (cas non fini) |
| 21 | 2.3.0 : deux sous-agents « en cours » après la fin du tour | Sous-agents toujours en arrière-plan d'OpenCode 2.3.0 | `doublon` | — | `subagent-background.test.ts › OpenCode 2.3.0 : sous-agents toujours en arrière-plan` ; `src/main/agent/agent-host-opencode-2-3.test.ts` |
| 22 | 2.3.0 : pied de la barre « en cours », pas de bilan | Statut de la barre `background` et pas de bilan tant que ça travaille | `composant` | `src/renderer/src/components/sidebar/Sidebar.test.tsx` + `TurnSummary.test.tsx` | partiel : `TurnSummary.test.tsx › sous-agent en arrière-plan encore au travail (D1) : pas de « Terminé »…` |
| 23 | 2.3.0 : « Travaille encore… · N s » sous la réponse, sans indicateur en bas | Travail après le tour dit une fois, au pied de la réponse | `doublon` | — | `TurnSummary.test.tsx › travail après le tour : « Travaille encore… » sous la dernière réponse` ; `… › « Travaille encore… · 32 s »…` |
| 24 | 2.3.0 : chaque ligne montre le travail de son sous-agent | Travail en direct attribué à la bonne session fille | `unitaire-main` | `agent-host-opencode-2-3.test.ts` | partiel : `subagent-background.test.ts › à sa fin, son travail relu dans sa session remplace celui reçu en direct` |
| 25 | 2.3.0 : à leur fin, réponse et travail complet | Travail relu en fin, plus d'outil « en cours » | `doublon` | — | `subagent-background.test.ts › à sa fin, son travail relu dans sa session remplace celui reçu en direct (incomplet)` |
| 26 | 2.3.0 : réponse du parent hors tour = message à part | `messageId` : nouveau message, pas collé au précédent | `doublon` | — | `agent-host-opencode-2-3.test.ts › réponse hors tour : … la réponse est un message à part` ; `subagent-background.test.ts › le parent répond hors tour…` |
| 27 | 2.3.0 : bilan à la fin du travail, sous la réponse hors tour ; « Prêt » ensuite | Le tour se clôt quand le travail de fond finit | `unitaire-main` | `agent-host-background.test.ts` | partiel : `agent-host-background.test.ts › sous-agent en arrière-plan : « travaille encore » jusqu'à la réponse hors tour, qui finit le tour` |
| 28 | 2.3.0 : à la fin, le pied devient le bilan, une seule durée | Un seul pied, celui du bilan | `doublon` | — | `TurnSummary.test.tsx › un seul pied : « heure · durée · 2 fichiers +2 −1 »… (fiche 261)` |
| 29 | 2.3.0 : après redémarrage, mêmes lignes finies, même travail, mêmes deux messages | Persistance complète des sous-agents 2.3.0 et des messages hors tour | `parcours` | garder ici (avec 20) | non |

**Verdict** : reduire. Garder 2, 8, 20, 29 (base de Bob réelle, rejeu ACP d'une session fille, persistance après redémarrage) ; les deux redémarrages peuvent n'en faire qu'un. Le reste est déjà couvert (18 doublons).
**Risques** :
- L'enchaînement en temps réel tracker → hors tour → bilan (27) dépend de minuteries réelles ; l'unitaire les simule.
- La persistance après redémarrage du travail des sous-agents n'a aucun test unitaire.

### `textes-plateforme.mjs` — Réglages lancés avec les capacités de Linux puis de Windows (`BOBINE_PLATFORM`) : ni Mac, ni Finder, ni Dock, ni trousseau macOS ; clé d'API en clair sous Linux sans trousseau

<!-- stats suite=textes-plateforme total=9 parcours=0 composant=9 unitaire-main=0 capture=0 doublon=0 couvert=9 verdict=disparaitre -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | Réglages › Général, section « settings.general.mac » de la plateforme (×2, boucle) | La section prend le titre propre à la plateforme | `composant` | `src/renderer/src/components/settings/SettingsPlatform.test.tsx` (à créer : chaque page rendue avec les capacités LINUX et WINDOWS) | partiel : `src/shared/i18n/system-texts.test.ts › chaque variante remplace un texte existant, avec les mêmes variables` |
| 2 | Général sans texte du Mac (×2, boucle) | Aucun mot propre au Mac dans la page rendue | `composant` | idem | partiel : `system-texts.test.ts › hors du Mac, plus de Mac, de Finder ni de Dock (sauf textes de capacités du Mac)` (les textes, pas les sections affichées) |
| 3 | Notifications : libellé du rebond (×2, boucle) | Le réglage du rebond a son libellé propre à la plateforme | `composant` | idem | partiel : `src/renderer/src/components/settings/NotificationsSettings.test.tsx › proposé là où la plateforme l'a, réglage et recherche` |
| 4 | Notifications sans texte du Mac (×2, boucle) | Idem dans Notifications | `composant` | idem | partiel : `system-texts.test.ts › hors du Mac…` |
| 5 | Données : « agentsLabel » de la plateforme (×2, boucle) | Le libellé « agents neufs » est celui de la plateforme | `composant` | idem | partiel : `system-texts.test.ts › chaque variante remplace…` |
| 6 | Données sans texte du Mac (×2, boucle) | Idem dans Données | `composant` | idem | partiel : `system-texts.test.ts › hors du Mac…` |
| 7 | Clés d'API : « keysHint » de la plateforme (×2, boucle) | L'aide des clés nomme le bon trousseau (DPAPI, gestionnaire de Linux) | `composant` | idem | partiel : `system-texts.test.ts › Windows nomme l'Explorateur et DPAPI ; Linux, le gestionnaire de fichiers` |
| 8 | Linux sans trousseau : « en clair » et de quoi la chiffrer / Windows : chiffrée, pas d'avis (×2, boucle) | Avec le backend `basic_text`, la clé est marquée en clair et la page le dit ; sinon, pas d'avis | `composant` | `src/renderer/src/components/settings/ApiKeys.test.tsx` (à créer : `info.plaintext`) | partiel : `src/main/agent-config/api-keys.test.ts › en clair et marquée, jamais un faux chiffrement ; dit par info ; posée à l'agent` (côté main) |
| 9 | Agents sans texte du Mac (×2, boucle) | Idem dans la page de l'agent | `composant` | idem `SettingsPlatform.test.tsx` | partiel : `system-texts.test.ts › hors du Mac…` |

**Verdict** : disparaitre — c'est de l'i18n et du rendu conditionnel par capacités, à tester en composant. Il faut d'abord un `SettingsPlatform.test.tsx` (chaque page des Réglages rendue avec `withSystemTexts` et les capacités LINUX/WINDOWS, contrôlée par l'expression `MAC`) et un `ApiKeys.test.tsx` pour l'avis « en clair ».
**Risques** :
- La transmission des capacités du main au renderer (argv) : déjà testée en unitaire (`src/main/platform.test.ts › relues telles quelles depuis la ligne de commande du renderer`) et en e2e par `platform.mjs`.
- Le vrai `safeStorage` d'Electron en `basic_text` : le test du main le simule.

### `travaux-groupe.mjs` — Carte de groupe (proposés, en cours, finis, recommandés), fusion dans la carte, travail qui écrit + « Faire relire », conflit qui reste

<!-- stats suite=travaux-groupe total=12 parcours=1 composant=1 unitaire-main=0 capture=1 doublon=9 couvert=11 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | proposés : une carte de groupe, trois lignes (rôle, sans rôle, avis), « Tout lancer » | Trois `start_child` simultanés → une seule carte | `doublon` | — | `src/renderer/src/components/thread/WorkGroup.test.tsx › une carte, ses lignes, « par OpenCode »… « Tout lancer »` ; `src/shared/work-groups.test.ts › propositions d'un tour : une carte…` |
| 2 | en cours : la même carte, « 3 en cours », ni « Sous-tâches » ni lancement séparé | La carte change sur place quand les travaux tournent | `doublon` | — | `WorkGroup.test.tsx › « 3 travaux · 1 en cours, 1 a répondu », à la place des propositions ; rien de séparé` ; `parcours-deleguer › demander, puis lancer trois travaux` |
| 3 | finis : « 3 finis », avis déplié en entier, « Fusionner le recommandé » | Fin des filles → réveil de la mère → recommandations reçues par MCP → pied de carte | `parcours` | `parcours-deleguer`, étape « demander, puis lancer trois travaux » (ajouter le réveil/recommandation) | partiel : `WorkGroup.test.tsx › une ligne se déplie sur la carte-réponse…` ; `SubtasksMerge.test.tsx › sur la ligne seulement ; seule la recommandée part…` |
| 4 | une colonne d'état : « Recommandé », « Pas encore prêt », « a répondu » ; « Inclure l'autre… » | Verdicts par ligne et action secondaire | `doublon` | — | `WorkGroup.test.tsx › une colonne d'état : « fusionné » seul remplace « a répondu » ; « Recommandé » neutre` ; `SubtasksMerge.test.tsx › … les autres après confirmation` |
| 5 | conseil : « n'est pas encore recommandé », sans « attend son avis » | Le conseil ne promet pas d'avis futur (D9) | `doublon` | — | `WorkGroup.test.tsx › conseil : « pas encore prêt selon lui » quand l'agent l'a dit…` ; `… › conseil : sans avis sur l'autre…` |
| 6 | pied : aucun bouton ne dépasse la carte (×3, boucle) | Pied de carte sans débordement (normal, 900 px, confirmation) | `capture` | captures nocturnes `264-groupe-*` | non |
| 7 | fusion : les deux branches dans main, le résultat dans la carte | Fusion git réelle depuis la carte | `doublon` | — | `parcours-deleguer › main a les trois travaux, conflit résolu, dossier propre` ; `src/main/conversations/children-merge.test.ts › deux filles sans recouvrement : fusionnées dans l'ordre de lancement` |
| 8 | travail qui écrit : « Voir les modifications », « Faire relire », « Fusionner dans main » | Actions d'une carte de travail qui écrit | `doublon` | — | `WorkGroup.test.tsx › « Fusionner dans main » (cleanup), « Faire relire », « Voir les modifications »` |
| 9 | Faire relire un travail : sa branche relue | Le dialogue de relecture annonce la branche du travail | `composant` | `src/renderer/src/components/panel/ReviewDialog.test.tsx` (ajouter la portée « branche ») | partiel : `review-target.test.ts › non commité sur une branche : la branche contre sa base…` |
| 10 | relecture d'un travail : dans sa carte, remarques sur sa branche | Relecture rangée dans la carte du travail, actions hiérarchisées | `doublon` | — | `WorkReview.test.tsx › relecture d'un travail : dans sa carte, pas à sa place ; « corriger » le fait corriger` |
| 11 | fusionné dans la carte : branche supprimée, aucune étape inventée | Fusion + nettoyage réels, étapes réelles seulement | `doublon` | — | `WorkGroup.test.tsx › fusionné : « Fusionné dans main · branche supprimée »…` ; `… › en cours : les étapes réelles seulement…` ; `children-merge.test.ts › « Puis nettoyer » : … worktrees et branches supprimés` |
| 12 | conflit qui reste : Réessayer, Abandonner, Voir le conflit ; rien d'autre fusionné | Conflit non résolu : la chaîne s'arrête, actions dans la carte | `doublon` | — | `WorkGroup.test.tsx › conflit qui reste : Réessayer, Abandonner, Voir le conflit, dans la carte` ; `children-merge.test.ts › conflit qui reste après le tour de la fille : la chaîne s'arrête et le dit` |

**Verdict** : reduire. Garder 3 (réveil de la mère et recommandation de bout en bout) dans `parcours-deleguer` ; tout le reste est couvert par `WorkGroup.test.tsx`, `children-merge.test.ts` (git réel) et `parcours-deleguer`.
**Risques** :
- Les trois `start_child` qui arrivent en même temps par HTTP/MCP, dans le désordre (CI macOS du 2026-11-23), ne sont vus qu'en e2e.
- Le verrou de fin de tour de l'agent factice (tours retenus) n'a pas d'équivalent ailleurs.

### `user-commands.mjs` — Commandes « / » personnelles et du projet (`.bobine/commands`, ancien `.bob-desktop`) : réglages, menu, consigne développée reçue par l'agent

<!-- stats suite=user-commands total=6 parcours=1 composant=2 unitaire-main=0 capture=0 doublon=3 couvert=5 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | réglages : commande du projet listée (revue.md, lecture seule) | Les commandes du projet apparaissent dans Réglages › Commandes | `composant` | `src/renderer/src/components/settings/CommandsSettings.test.tsx` (à créer) | partiel : `src/main/user-commands.test.ts › reads the Markdown files of .bobine/commands…` (lecture, pas l'affichage) |
| 2 | réglages : ancien dossier `.bob-desktop/commands` encore lu | Compatibilité d'avant le renommage | `doublon` | — | `src/main/user-commands.test.ts › still reads the old .bob-desktop/commands folder; .bobine wins on the same name` |
| 3 | commande personnelle « /salut » enregistrée (check true) | Le formulaire crée et enregistre une commande | `composant` | `CommandsSettings.test.tsx` (à créer) | non |
| 4 | menu « / » : « /revue <fichier> » (Projet) et « /salut » (Vous) | Menu avec indice d'argument et origine | `doublon` | — | `src/shared/user-commands.test.ts › lists project commands first, then global ones, with their origin` ; `src/renderer/src/components/composer/Composer.test.tsx › menu « / » : commandes de l'agent et de l'app filtrées…` |
| 5 | « /salut Jérôme » : l'agent reçoit la consigne développée | Commande personnelle développée avant l'envoi | `doublon` | — | `Composer.test.tsx › commande personnelle : consigne développée envoyée, sauf si l'agent a le même nom` ; `shared/user-commands.test.ts › replaces $ARGUMENTS or appends the argument` |
| 6 | « /revue src/app.js » : consigne du projet développée, reçue par l'agent | Fichier du projet sur disque → menu (Tab complète) → consigne développée → agent par ACP | `parcours` | `parcours-matinee`, étape « ouvrir le projet git et faire une première demande » (projet avec `.bobine/commands`) | partiel : `Composer.test.tsx › … Entrée complète une commande à argument` (pas Tab, pas le fichier réel) |

**Verdict** : reduire. Garder 6 en une étape de journée type ; 1 et 3 vont dans un `CommandsSettings.test.tsx` à créer.
**Risques** :
- `CommandsSettings.tsx` n'a aucun test de composant.
- La relecture des commandes du projet quand le dossier change (IPC) n'est vérifiée que de bout en bout.

### `worktree-setup.mjs` — Préparation des worktrees : `.worktreeinclude`, commandes de `.bobine/worktree.json` à autoriser, D1 à D6, tâche planifiée qui n'attend pas (D3)

<!-- stats suite=worktree-setup total=15 parcours=2 composant=0 unitaire-main=1 capture=0 doublon=12 couvert=15 verdict=reduire -->

| # | Vérification | Ce qu'elle garantit | Classe | Remplaçant proposé | Déjà couvert ? |
|---|---|---|---|---|---|
| 1 | worktree : `.env` ignoré copié, commande du dépôt à autoriser, pas lancée | Nouveau worktree depuis le menu : copie réelle, carte à autoriser, rien lancé | `parcours` | garder ici (une étape), ou `parcours-deleguer` | partiel : `src/main/conversations/manager.test.ts › worktree préparé (fiche 175) : fichier ignoré copié…` ; `src/main/changes/worktree-setup.test.ts › pas encore autorisée…` |
| 2 | les deux commandes « à la création » et « à la suppression » (D1) | L'accord couvre les deux commandes, montrées | `doublon` | — | `src/renderer/src/components/thread/WorktreeSetup.test.tsx › les deux commandes que l'accord couvre, chacune avec son moment (D1)` |
| 3 | à autoriser : message en attente, action principale pleine, « Continuer sans préparer », fichier listé | Message retenu tant que non autorisé | `doublon` | — | `WorktreeSetup.test.tsx › à autoriser : « Autoriser et lancer » en action principale…` ; `src/main/changes/worktree-setup-wiring.test.ts › à autoriser : le message attend sur la carte…` |
| 4 | fichier changé avant l'accord : rien lancé, nouvelle commande, message en attente (D2) | Empreinte vérifiée à l'accord | `doublon` | — | `worktree-setup.test.ts › fichier changé entre l'affichage et l'accord… (D2)` ; `worktree-setup-wiring.test.ts › fichier changé avant « Autoriser »… (D2)` |
| 5 | préparation autorisée : lancée, réussie, sortie gardée, message envoyé ensuite | Commande réelle puis message libéré | `doublon` | — | `worktree-setup-wiring.test.ts › « Autoriser » avec l'empreinte montrée : la commande tourne, le message part à sa fin` ; `worktree-setup.test.ts › lancement réel par le shell` |
| 6 | worktree suivant : préparation lancée d'office (accord retenu) | Accord mémorisé par dépôt et empreinte | `doublon` | — | `src/main/approvals.test.ts › préparation des worktrees (fiche 175) : par dépôt et empreinte, révocable` |
| 7 | dépôt principal intact | Ni copie ni commande ne touchent le dépôt principal | `unitaire-main` | `src/main/changes/worktree-include.test.ts` | partiel : `worktree-include.test.ts › copie les fichiers ignorés retenus, jamais un lien, ni hors dépôt…` |
| 8 | commande en cours : « Votre message attend… », « Arrêter », « Continuer sans attendre » (D4) | Message retenu pendant la commande | `doublon` | — | `WorktreeSetup.test.tsx › commande en cours : … (D4)` ; `worktree-setup-wiring.test.ts › commande autorisée en cours : le message attend…` |
| 9 | « Arrêter » : commande arrêtée, carte « Arrêtée », message envoyé (D4) | Arrêt réel et libération du message | `doublon` | — | `worktree-setup-wiring.test.ts › … « Arrêter » l'envoie avec l'arrêt (D4)` ; `WorktreeSetup.test.tsx › arrêtée par l'utilisateur…` |
| 10 | « Continuer sans attendre » : message envoyé, commande tourne encore (D4) | Le message part, la commande continue | `doublon` | — | `worktree-setup-wiring.test.ts › commande en cours : « Continuer sans attendre »… (D4)` |
| 11 | « Continuer sans préparer » : commande non lancée, message envoyé | Refus de la préparation | `doublon` | — | `worktree-setup.test.ts › « Continuer sans préparer »…` ; `worktree-setup-wiring.test.ts › « Continuer sans » le libère…` |
| 12 | `archive` seule : carte à autoriser, sans commande à la création (D6) | Carte de la seule commande de suppression | `doublon` | — | `WorktreeSetup.test.tsx › archive seule… (D6)` ; `worktree-setup-wiring.test.ts › archive seule… (D6)` |
| 13 | archive autorisée : lancée à la suppression du worktree (D6) | Suppression par le dialogue → commande `archive` réellement lancée | `parcours` | garder ici, ou `parcours-deleguer` étape « supprimer un travail » | partiel : `worktree-setup.test.ts › archive : lancée seulement si autorisée…` |
| 14 | tâche planifiée, préparation non autorisée : finit sans l'attendre, historique le dit (D3) | Une exécution sans surveillance ne bloque jamais sur l'accord | `doublon` | — | `scheduler.test.ts › échéance passée, nouveau worktree à préparer non autorisé… (fiche 175)` ; `worktree-setup-wiring.test.ts › tâche planifiée : n'attend jamais l'accord… (D3)` |
| 15 | sa conversation : carte « non lancée », exécution planifiée dite, sans bouton | Rendu de la carte en exécution sans surveillance | `doublon` | — | `WorktreeSetup.test.tsx › arrêtée par l'utilisateur ; exécution planifiée non autorisée` |

**Verdict** : reduire. Garder 1 et 13 (création et suppression réelles d'un worktree avec la préparation) ; les D1 à D6 sont déjà tous testés en branchement (`worktree-setup-wiring.test.ts`), en logique et en composant.
**Risques** :
- La création d'un worktree par le menu du dossier, avec copie et shell réels, n'est enchaînée que par l'e2e.
- La commande `archive` lancée depuis le dialogue de suppression (D6) n'a qu'un test partiel.
