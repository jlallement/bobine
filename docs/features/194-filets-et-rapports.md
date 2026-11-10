# 194 — Pannes visibles (1/2) : filets d'erreur et rapports

- **Statut** : fait (relecture du tech lead à venir)
- **Dépend de** : 187 (lot C : R7, R8, R15), 041 (robustesse du cœur), 080 (journal), 142
  (bandeau de reprise réseau)
- **Agents** : les deux : rien de propre à un agent (le silence est mesuré sur les octets reçus)

## Pourquoi

Quand quelque chose casse, l'utilisateur doit le voir et savoir quoi faire, sans qu'une panne
emporte la fenêtre. Avant : un agent figé faisait tourner la roue sans fin, un message qui casse
le rendu remplaçait toute l'interface, une erreur interne du main était seulement écrite au
journal, et un plantage ne laissait aucune trace proposée au lancement suivant.

## Critères d'acceptation

- [x] Agent silencieux pendant un tour (aucun octet depuis 5 min, hors attente d'une réponse de
      l'utilisateur) : bandeau neutre à la fin du fil, « L'agent n'a rien envoyé depuis N min »,
      avec « Attendre » et « Arrêter », `role="status"`, sans prendre le focus. Il part dès que
      l'agent reparle ; jamais de coupure automatique.
- [x] Un élément du fil qui ne s'affiche pas est remplacé par une ligne qui le nomme (« Ce
      message… », « Cette action de l'agent… », « Ces modifications… »), détail technique replié
      avec « Afficher le journal » ; le reste du fil et la fenêtre restent utilisables. Même filet
      pour le panneau latéral et les pages de réglages, avec « Réessayer ».
- [x] Erreur interne du main (exception ou promesse non rattrapée) : un seul avis par lancement en
      haut de la fenêtre (ambre, compte des suivantes), détail replié, « Afficher le journal » ;
      fermé, il ne revient pas avant le prochain lancement.
- [x] Marque « en cours » (`running.json`) : restée au lancement suivant (plantage, `kill -9`),
      Bobine le dit une fois et range un rapport local (`crash-reports/<date>/rapport.txt` :
      version, système, fin du journal, minidumps de `crashReporter`), **sans aucun envoi**
      (`uploadToServer: false`). « Afficher le rapport » le sélectionne dans le Finder. Phrase sur
      la vie privée (extraits de conversations possibles).
- [x] Interface plantée trois fois en une minute : dialogue natif « Relancer Bobine / Afficher le
      journal / Quitter » (Échap = Quitter) ; la relance repart de l'accueil.
- [x] Messages compréhensibles par un non-technicien, détail technique replié ; fr et en.
- [x] Testé contre l'agent factice (`muet` avec un seuil court, agent tenace, `kill -9`) et par un
      fil abîmé (e2e `pannes-visibles`, clair et sombre).

## Plan

Maquettes d'abord (`nuit-0-11/pannes/maquettes/`), validées sous réserve par l'expert UX avec 12
corrections (`VERDICT-expert-ux.md`), toutes appliquées.

1. `silence-watch.ts` : seuil du bandeau (5 min, `BOBINE_SILENCE_MS` pour les essais) ;
   `AgentSnapshot.silentSince` ; `SilenceBanner.tsx` sous l'indicateur d'activité.
2. `SafeBoundary.tsx` : `ItemBoundary` autour de chaque élément du fil, `PaneBoundary` autour du
   panneau et des pages de réglages. Le filet de la fenêtre entière reste le dernier recours.
3. `app-failures.ts` (sorti d'`index.ts`) : erreurs non rattrapées → `AppAlerts` ; `crash-marker.ts`
   (marque, rapport local, minidumps) ; `watchRendererCrashes` (dialogue après trois plantages).
   `AppAlertsBar` monté hors d'`App`.
4. Essais : unitaires (seuil à l'horloge simulée, filets, avis, marque, dialogue) ; e2e.

## Ce qui a été fait

- Bandeau de silence : `watchSilence` appelle `onSilent` (heure du dernier octet, puis `undefined`)
  ; l'hôte d'agent le met dans l'instantané et l'efface au premier octet reçu ou à la fin du tour.
  `TurnFooter.tsx` (sorti d'`App.tsx`, qui tient ainsi son plafond) groupe reprise, indicateur et
  silence. « Attendre » masque jusqu'au prochain silence ; « Arrêter » = ■ (un agent figé est
  arrêté 8 s plus tard, puis « Relancer » existe déjà).
- Filets : `SafeBoundary` (journal de l'app, source `react:item`, `react:panel`, `react:page`),
  nom de l'élément tiré de son genre (`entryKind`, robuste à un fil abîmé), clé de remise à zéro
  par onglet et par page.
- Avis de l'app : `AppAlerts` (main) et `app:alerts`, `app:dismissAlert`, `app:showCrashReport` ;
  `AppAlertsBar` en haut de la fenêtre principale, par-dessus le fil.
- Rapports : `crashReporter.start({ uploadToServer: false })`, minidumps dans
  `<données>/crash-dumps` ; `startRunMark` au début de `start()`, `endRunMark` au `quit` (et avant
  `app.exit` de l'installation par l'app elle-même) ; dix rapports au plus, de moins de 30 jours.
- Dialogue après trois plantages : décision dans `RendererCrashes` / `askAfterCrashes` (testés) ;
  « Relancer » = `app.relaunch()` puis `quit` : le lancement suivant ouvre une conversation vierge.
- Correction 12 (contraste des avis `.notice`, composant partagé, commit à part) : texte en
  `--text-2` sur le fond teinté, icône seule colorée, variante `.notice-success` ajoutée (fond
  `--ok-soft`, icône `--ok`). Contraste du texte, mesuré sur les six thèmes de
  `themes.generated.css` (WCAG 2) :

  | Thème | Avertissement avant → après | Erreur avant → après | Succès avant → après |
  |---|---|---|---|
  | Clair (défaut) | 4,89 → 7,79 | 5,49 → 7,33 | 5,95 → 7,68 |
  | Sombre (défaut) | 5,89 → 8,19 | 5,39 → 8,59 | 6,35 → 8,04 |
  | Pire des six thèmes | 4,89 → **6,69** | | |

  L'icône garde l'ancien contraste (≥ 4,89:1, au-delà des 3:1 demandés pour un élément graphique).

## Écarts au plan et à la maquette

- Seuil du bandeau : 5 min au lieu de 3 (verdict UX) ; texte neutre du verdict.
- Dialogue natif au lieu d'une « page après trois rechargements » (fiche 187) : une page servie
  par l'interface qui vient de planter n'est pas un filet fiable (validé par l'expert UX).
- « Relancer » ne figure pas dans le bandeau de silence : « Arrêter » mène à « Relancer ».
- Le dialogue après trois plantages n'a pas d'essai e2e (dialogue natif bloquant) : sa décision
  est testée en unitaire. Les filets du panneau et des pages aussi (aucun déclencheur réaliste
  dans l'app) ; celui des éléments du fil a son e2e (fil abîmé : pièces jointes qui ne sont plus
  une liste). Une réponse dont le texte n'est plus une chaîne s'affiche vide, sans erreur.

## Captures

`nuit-0-11/pannes/apres/` (e2e, clair et sombre) : `194-silence`, `194-element-illisible`,
`194-erreur-interne`, `194-plantage-precedent`. Essais réels : `nuit-0-11/pannes/essai-reel/`.

## Journal

- 2026-11-07 : fiche créée (lot C de la fiche 187, avec la fiche 195), maquettes, verdict UX
  (validé sous réserve, 12 corrections), fait. Unitaires et e2e `pannes-visibles` verts.
- 2026-11-07 : relecture indépendante (« à corriger »), tout repris et testé :
  - avis « ne répondait plus à Stop » en double : l'instantané n'est plus réémis hors tour par le
    bandeau de silence, et le réducteur n'ajoute un avis qu'au passage vers `exited` ou `error`
    (`halted`) ; e2e qui compte les avis ;
  - dialogue des trois plantages : la confirmation « un agent travaille » ne revient pas
    (`leaveAfterCrashes` passe par `QuitFlow.confirm`), plus de fenêtre blanche ni de relance armée ;
  - silence compté depuis le dernier octet **ou** la fin de la dernière attente de l'utilisateur ;
  - rapport et avis : les minidumps contiennent la mémoire de Bobine (conversations, voire
    secrets) ; rapport dans la langue de l'interface ;
  - niveau d'avis `success` (icône ✓ en `--ok`) pour la variante `.notice-success`.

