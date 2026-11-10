# 154 — Trois défauts : clic droit, liens locaux, ordre des onglets

- **Statut** : fait
- **Dépend de** : 030, 052, 064, 082
- **Agents** : les deux ; rien ne touche au protocole ni aux profils d'agent.

## Pourquoi

Lot A de la feuille de route du 28/10 : trois défauts de finition.

1. **Clic droit** : aucun menu contextuel n'existait, donc les fautes soulignées dans la saisie ne
   se corrigeaient pas. Exigence explicite : un menu **réduit à l'essentiel**.
2. **Liens locaux** : `http://localhost:3000` dans une réponse ne faisait rien au clic
   (`setWindowOpenHandler` n'ouvrait que `https://`).
3. **Onglets du panneau** : rangés dans l'ordre fixe de `PANEL_TABS`, un Navigateur ouvert après
   Terminal et Tâches passait en premier et décalait tout.

## Critères d'acceptation

- [x] Clic droit dans un champ éditable : suggestions d'orthographe (5 au plus), puis Couper,
      Copier, Coller, Tout sélectionner. Sur une sélection hors champ : Copier. Sur un lien :
      Copier l'adresse. Sur une image : Copier l'image. Rien d'autre ; libellés traduits.
- [x] Lien `localhost`, `127.0.0.1`, `[::1]` ou `*.localhost` : navigateur intégré du panneau ;
      ⌥-clic : navigateur du Mac. Autre `http(s)` : navigateur du Mac. La fenêtre de l'app ne
      navigue jamais.
- [x] Un onglet qui apparaît s'ajoute à droite, les autres ne bougent plus ; ordre retenu par
      conversation, déduit au lancement de la première utilisation dans le fil puis des onglets
      ouverts à la main.
- [x] Testé : fonctions pures (menu, cible d'un lien, ordre des onglets), IPC, e2e `links` (scénario
      `liens-web`) et `panel` adaptée.

## Plan

1. `src/main/context-menu.ts` : `contextMenuTemplate` (fonction pure, testée) et
   `attachContextMenu`, branché dans `loadRenderer` (donc fenêtre principale, rapide, À propos).
   Clés `menu.copyLink` et `menu.copyImage` ; Couper / Copier / Coller / Tout sélectionner
   réutilisent `menu.*`.
2. `webLinkTarget` (`shared/file-links.ts`) : `integrated` / `system` / rien. `files:openLink`
   (`ipc.ts`) l'essaie avant les fichiers : local → `openTab` du navigateur de la conversation
   (le panneau l'affiche comme pour une page HTML, fiche 064) ; sinon `openExternal`
   (journal `BOBINE_OPEN_LOG` en essai : `external <url>`). `MarkdownLink` confie les liens web au
   fil (`data-testid=web-link`, ⌥-clic = navigateur du Mac) ; sans fil, ils restent de simples
   liens. `setWindowOpenHandler` ouvre aussi `http://` dans le navigateur du Mac.
3. `visiblePanelTabs` reçoit `arrival` (ordre retenu) ; `usePanel` le garde par conversation et le
   met à jour en rendu (nouveaux à droite, partis oubliés).
4. Agent factice : scénario `liens-web`. Essais : suite `links` complétée, `panel` adaptée.

## Journal

- 2026-10-28 : fait. Écarts au plan :
  - un lien web passe par le canal `files:openLink` existant (résultat `browser` ou `opened`)
    plutôt que par un nouveau canal : le renderer et le preload ne changent pas.
  - `*.test`, que `isLocalHost` accepte pour l'agent, n'est **pas** traité comme local ici
    (la consigne ne liste que `localhost`, `127.0.0.1`, `[::1]`, `*.localhost`).
  - fiche 082 : l'ordre n'est plus fixe (voir son écart).
  - Essais e2e écrits (`links`, `panel`) mais non lancés par cette branche : à lancer à la fusion
    (`pnpm build && pnpm e2e links panel`).
- 29/10, intégration des lots 154 à 160 (tech lead) : un lien `localhost` vers un serveur arrêté
  affichait l'erreur brute de l'IPC ; le navigateur intégré s'ouvre maintenant quand même, sur la page
  d'erreur, à recharger (test `ipc.test.ts`). Suite e2e complète verte (clair et sombre).
