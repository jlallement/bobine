# 049 — Barre de titre allégée, branche dans la zone de saisie, vue Git retirée

- **Statut** : fait
- **Dépend de** : 021, 027, 034, 037

## Pourquoi

Retours de l'utilisateur (2026-10-14) : la barre de titre est chargée (titre centré qui se décale,
branche, pastille des modifications, bouton terminal, panneau) et le fil défile dessous sans
séparation. La branche n'y a pas sa place : c'est un contexte de travail, comme le dossier. Le
bouton terminal fait doublon (⌃`, onglet Terminal du panneau). La vue Git (fiche 037) est jugée
trop incomplète : on la retire, l'onglet « Modifications » montre déjà l'état du dépôt.

## Critères d'acceptation

- [x] Barre de titre : titre **aligné à gauche** avec un menu ⌄ (épingler, renommer en place,
      exporter en Markdown ou JSON, archiver, supprimer avec la même confirmation que la barre
      latérale) ; à droite, la pastille des modifications, les tâches et le panneau. Plus de
      branche ni de bouton terminal (⌃` et l'onglet Terminal restent).
- [x] Dégradé discret sous la barre, seulement quand le fil défile dessous ; clair et sombre.
- [x] Branche dans la barre de la zone de saisie, à côté du dossier (point si le dossier a des
      modifications non commitées) ; un clic ouvre « Modifications » sur l'état git. Relue au
      changement de conversation, au début et à la fin de chaque tour, et au retour dans l'app.
- [x] Vue Git retirée : onglet, commit, poussée, pull / merge request, CI, `git init`, forges
      `gh` / `glab` et leur code ; seul `git:status` (branche, avance / retard, fichiers modifiés)
      reste.
- [x] Menu des conversations partagé entre la barre latérale et le titre (un seul composant).
- [x] Testé : unités (`repo.test.ts`, IPC) ; e2e adaptés (`terminal` par ⌃`, `git` réécrite pour
      le titre, la branche et le dégradé) ; captures claires et sombres regardées. Pas de test de
      composant pour le titre et la puce : couverts par l'e2e.

## Plan

1. Retrait de Git : `GitTab.tsx`, `main/git/forge.ts` (+ tests), `main/git/service.ts` ;
   `main/git/repo.ts` réduit à `status` (et ses analyses) ; `shared/git.ts` réduit à `GitStatus` ;
   IPC `git:*` sauf `git:status` (`shared/ipc.ts`, `main/ipc.ts`, `preload/api.ts`, tests) ;
   onglet `git` de `shared/panel.ts`, `PanelIcons`, `SidePanel` ; `BOB_GH` / `BOB_GLAB`
   (`main/index.ts`, `e2e/lib.mjs`).
2. `ConversationMenu.tsx` : éléments du menu d'une conversation (barre latérale et titre) ;
   `DeleteDialog` sorti de `Sidebar.tsx`, ouvert depuis `App` pour les deux.
3. En-tête (`App.tsx`, styles) : titre à gauche avec menu ⌄ et renommage en place, dégradé selon
   le défilement, bouton terminal retiré.
4. Branche : `BranchChip` dans la barre de `Composer` ; `useGitStatus` sans rafraîchissement
   périodique, relu au retour dans la fenêtre ; ouverture de « Modifications » sur la vue git
   (`ChangesTab` : vue initiale demandée).
5. Docs : fiche 037 (statut, journal), fiche 034 (bouton retiré), `architecture.md`, index.

Aucune nouvelle dépendance.

## Journal

- 2026-10-14 — Fiche créée ; choix de l'utilisateur : branche dans la zone de saisie, titre aligné
  à gauche, vue Git supprimée.
- 2026-10-14 — **Fait.**
  - Retrait de Git : `GitTab.tsx`, `main/git/forge.ts` (+ tests), `main/git/service.ts`,
    `shared/git.test.ts` supprimés ; `GitRepo` réduit à `status` (deux commandes git) ;
    `shared/git.ts` réduit à `GitStatus` ; canaux `git:init|commit|push|pr|prDraft|createPr`
    retirés ; onglet `git` du panneau, `BOB_GH` / `BOB_GLAB` et faux `gh` / `glab` des e2e retirés ;
    ≈ 240 lignes de CSS en moins.
  - `ConversationMenu.tsx` : `ConversationMenuItems` (barre latérale et titre) et `DeleteDialog`,
    tenu par `App` (la barre latérale demande la suppression par `onRequestDelete`).
  - `ConversationTitle.tsx` : titre à gauche, menu ⌄, renommage en place. Bouton terminal retiré.
  - Dégradé : animation CSS liée au défilement du fil (`timeline-scope` sur `.main`,
    `scroll-timeline` sur le fil, `animation-timeline` sur `.main-header::after`) : rien en haut
    du fil, opacité pleine après 32 px ; inactif sans défilement possible. Aucun script.
  - Branche : `BranchChip` à côté du dossier dans la zone de saisie (infobulle : fichiers
    modifiés, commits à pousser / à récupérer) ; clic → « Modifications » sur la vue git
    (`ChangesTab` reçoit une vue initiale, remonté à chaque demande) ; la pastille des
    modifications de l'en-tête ouvre la vue de la conversation. `useGitStatus` : plus de relecture
    toutes les 30 s, mais au retour dans la fenêtre.
  - **Bug trouvé par l'e2e** : « Supprimer » ouvert depuis le menu du titre puis « Annuler »
    laissait `pointer-events: none` sur la page (plus aucun clic possible) — piège connu de Radix
    quand un menu **modal** ouvre une boîte de dialogue. Menus des conversations passés en
    `modal={false}` (titre et barre latérale, qui ouvre la même boîte ; pas reproduit côté barre
    latérale, corrigé par précaution).
  - e2e : suite `git` réécrite (titre à gauche, renommer et supprimer depuis le titre, branche →
    vue git avec 2 fichiers, pastille → vue de la conversation, dégradé 0 → 1, pas de bouton
    terminal), suite `terminal` par ⌃`. Passe complète verte (319 s). Captures regardées : 38
    (menu du titre, clair), 39 (dégradé, clair et sombre, agrandies), 73 (branche → Modifications,
    clair), 30 (terminal, sombre). Dégradé renforcé en sombre ensuite (0,35 → 0,5), plus discret
    qu'en clair à l'agrandissement.
  - Écart au plan : aucun.
