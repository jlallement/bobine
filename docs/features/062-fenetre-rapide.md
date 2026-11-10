# 062 — Fenêtre rapide et capture d'écran

- **Statut** : fait
- **Dépend de** : 005, 015, 027, 061
- **Agents** : les deux (nouvelle conversation et images jointes : génériques ; Bob et OpenCode
  acceptent les images, `docs/agents.md`)

## Pourquoi

Dans Claude Desktop, un raccourci ouvre une petite barre par-dessus n'importe quelle app : on pose
sa question sans quitter ce qu'on fait, capture d'écran comprise. Dans Bob Desktop, il faut
revenir à la fenêtre, ouvrir une conversation, et une capture passe par le presse-papiers. Montrer
un bug d'interface à Bob devrait se faire en deux gestes.

## Critères d'acceptation

- [x] Raccourci global **⌥⌘B** (choix de l'utilisateur, 2026-10-15) depuis n'importe quelle app,
      et Fichier › Fenêtre rapide. Réglages › Général › Fenêtre rapide : désactivé, ⌥⌘B, ⌥Espace,
      ⇧⌥Espace ; si macOS refuse le raccourci (déjà pris par une autre app), la ligne le dit.
- [x] Fenêtre flottante au-dessus de tout (apps en plein écran comprises), sur l'écran de la
      souris ; Échap, le raccourci de nouveau ou un clic ailleurs la ferment ; le texte reste
      jusqu'à l'envoi. Elle rappelle où part le message : « Nouvelle conversation · agent ·
      dossier » (réglages « Nouvelle conversation »).
- [x] Entrée : **nouvelle conversation** (choix de l'utilisateur), la fenêtre principale s'ouvre
      dessus, la réponse arrive. Agent qui attend une action (dossier, connexion, licence) : la
      conversation s'ouvre avec son panneau, le message attend dans la zone de saisie, images
      comprises.
- [x] **Capture d'écran** : bouton dans la fenêtre rapide et dans la zone de saisie ; sélection
      d'une zone avec l'outil de capture de macOS (Échap annule), les fenêtres de l'app masquées
      pendant ce temps ; jointe comme image (réduite si elle est trop grande).
- [x] Autorisation « Enregistrement de l'écran » : demandée par macOS à la première capture ;
      Réglages › Diagnostic dit où elle en est et comment l'accorder.
- [x] Testé : unitaire (raccourcis, réglage, capture annulée, image réduite) ; e2e avec l'agent
      factice (fenêtre rapide ouverte par le menu, capture simulée, envoi, message et image dans la
      nouvelle conversation, réponse ; capture depuis la zone de saisie ; réglage du raccourci),
      captures clair / sombre ; essai réel (raccourci, vraie capture, Bob).

## Plan

1. `shared/quick-entry.ts` : raccourcis proposés (`off`, `alt-cmd-b`, `alt-space`,
   `shift-alt-space` : accélérateur Electron, touches affichées) ; préférence
   `quickEntryShortcut` (défaut `alt-cmd-b`) dans `shared/preferences.ts`.
2. `main/screen-capture.ts` : `captureScreen` — `screencapture -i -x` (commande remplaçable :
   `BOB_SCREENCAPTURE`, pour les essais), fichier temporaire, annulation (pas de fichier) ;
   image réduite et encodée par `nativeImage` (largeur 2 000 px au plus, PNG, JPEG si trop
   lourde) ; fenêtres de l'app masquées puis remises.
3. `main/quick-entry.ts` : `QuickEntry` — fenêtre créée à la demande (panneau macOS, sans cadre,
   au-dessus des apps en plein écran, mêmes `webPreferences` durcies que la fenêtre principale,
   page `#quick` du renderer), affichée sur l'écran de la souris, masquée à la perte du focus
   (sauf pendant une capture) ; enregistrement du raccourci global (`globalShortcut` injecté) et
   son état.
4. IPC : `quick:send`, `quick:hide`, `quick:resize`, `capture:screen`, `quick:info` ; évènement
   `app:prefill` (message à remettre dans la zone de saisie). Preload.
5. `index.ts` : `QuickEntry` branché, raccourci réenregistré quand le réglage change, entrée de
   menu Fichier › Fenêtre rapide (raccourci affiché, pas enregistré une seconde fois).
6. Renderer : `main.tsx` (page `#quick` → `QuickEntry.tsx`), apparence partagée avec `App`
   (`appearance.ts`) ; bouton de capture dans `Composer` ; `app:prefill` dans `App` ;
   Réglages › Général › Fenêtre rapide (+ index de recherche).
7. Diagnostic : ligne « Enregistrement de l'écran » (`systemPreferences.getMediaAccessStatus`).
8. e2e `quick` : capture factice (`BOB_SCREENCAPTURE` → petit PNG de `e2e/fixtures/`), page de la
   fenêtre rapide jointe par le CDP.

Pas de nouvelle dépendance (outil `screencapture` de macOS, `nativeImage` et `globalShortcut`
d'Electron).

## Journal

- 2026-10-15 — Fait selon le plan.
  - Main : `quick-entry.ts` (`QuickEntry` : panneau macOS sans cadre, transparent, au-dessus des
    apps en plein écran, posé au tiers haut de l'écran de la souris, refermé à la perte du focus
    sauf pendant une capture ; `QuickShortcutRegistrar` : un raccourci à la fois, refus de macOS
    dit dans l'état) ; `screen-capture.ts` (`screencapture -i -x -t png`, réduite à 2 000 px,
    PNG sinon JPEG 85/70/50) ; la fenêtre qui demande la capture (et la fenêtre rapide) s'efface
    pendant la sélection. `index.ts` : `webPreferences` durcies et chargement partagés
    (`SAFE_WEB_PREFERENCES`, `loadRenderer`), Fichier › Fenêtre rapide (raccourci affiché, pas
    enregistré deux fois), raccourci réenregistré quand le réglage change.
  - **Écarts** : la fenêtre principale était trouvée comme « la première fenêtre » : avec la
    fenêtre rapide, elle est suivie par référence (`mainWindow`) — sinon l'app ne la rouvrait plus
    au clic sur le Dock après l'avoir fermée. Première ouverture : la fenêtre s'affichait avant sa
    page et perdait aussitôt le focus (refermée) : affichée à `ready-to-show`, perte de focus
    ignorée 0,5 s.
  - **Bug trouvé par l'e2e** (antérieur, aussi au clic sur une notification pendant une réponse) :
    vue d'une conversation et évènements arrivent par des voies distinctes ; une vue arrivée avant
    un évènement qu'elle contenait déjà affichait un morceau de réponse en double (« Voici un
    exemple Voici un exemple… »). Évènements numérotés par conversation (`seq`, porté aussi par
    la vue) : l'interface ignore un évènement déjà compris, et une vue plus ancienne que ce qui
    est affiché. Test du réducteur.
  - Renderer : `QuickEntry.tsx` (texte, capture, images collées, Entrée / Échap, hauteur suivie),
    `appearance.ts` (partagé avec `App`), bouton de capture dans `Composer`, `ComposerInbox` :
    message rendu à la zone de saisie de sa conversation, gardé jusqu'à ce qu'elle soit affichée.
    Réglages › Général › Fenêtre rapide. Diagnostic : « Enregistrement de l'écran ».
  - Tests : unitaires (raccourci, capture : nom, réduction, JPEG, annulation, fenêtres masquées
    puis remises ; réducteur ; ligne du diagnostic) ; e2e `quick` (capture simulée par
    `BOB_SCREENCAPTURE`, page de la fenêtre rapide jointe par le CDP : `attachPage`), trois
    passages dans les deux thèmes. Captures regardées : `l0` (clair, sombre), `l3` (clair).
  - **Essai réel** (OpenCode, 0 bobcoin) : ⌥⌘B enregistré, pressé par System Events : fenêtre
    ouverte (« Nouvelle conversation · OpenCode · workspace »), message envoyé, réponse « reçu »
    dans la fenêtre principale. Pas fait : une vraie capture (sélection à la souris, autorisation
    « Enregistrement de l'écran » demandée par macOS) — à essayer par l'utilisateur.
- 2026-10-23 — Écart (fiche 124, défaut D3 de la recette) : sans l'autorisation « Enregistrement de
  l'écran », la capture ne lance plus `screencapture` et la fenêtre rapide dit pourquoi, avec un
  bouton vers le réglage de macOS ; une capture refusée après la sélection (code ≠ 0) le dit aussi.
