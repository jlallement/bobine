# 047 — Outils regroupés, titres lisibles, fil long fluide

- **Statut** : fait
- **Dépend de** : 003, 029

## Pourquoi

Revue du 2026-10-14 : chaque appel d'outil occupait sa ligne, sous le titre technique de l'agent
(« Running Browser Type (bob-desktop) » cinq fois de suite dans la capture 24). Une longue session
Bob devient un mur de lignes. Et aucun élément du fil n'était mémoïsé : chaque morceau de réponse
refaisait le rendu de tous les outils déjà affichés.

## Critères d'acceptation

- [x] Les appels d'outils consécutifs (au moins deux) forment un bloc repliable avec un résumé
      (« 3 lectures et 2 recherches », « 5 actions dans le navigateur ») et un état agrégé (en
      cours avec le nom de l'outil courant, échecs, annulations) ; déplié, les cartes habituelles.
- [x] Ce qui attend l'utilisateur reste visible hors des blocs : autorisation en attente, plan à
      valider ; de même les sous-agents et les outils auxquels une carte de plan est rattachée.
- [x] La dernière capture renvoyée par un outil de l'app reste visible sans déplier le bloc.
- [x] Les outils de l'app (serveur MCP `bob-desktop`) ont un libellé lisible d'après leurs
      arguments (« Saisit « Ada » », « Touche « Ajouter un » », « Lance « pnpm test » dans le
      terminal ») ; le titre de l'agent reste en infobulle. Aucun cas particulier d'agent.
- [x] Un morceau de réponse ne refait le rendu d'aucun outil déjà affiché (test de composant) ;
      surcoût du renderer mesuré sur un fil de 300 outils, avant et après.
- [x] Testé contre l'agent factice (scénario `fil-long`, suites e2e existantes) ; e2e vert, captures
      claires et sombres regardées.

## Plan

1. `shared/app-tools.ts` : `appToolLabel(nom, arguments)` → libellé + panneau.
2. Fil : évènement `tool-app` (`shared/agent.ts`), champ `appTool` de la carte d'outil, cas du
   réducteur (`shared/transcript.ts`) ; `AppToolsBridge.call` l'émet pour la carte reliée.
3. `shared/tool-groups.ts` : `groupTools`, `toolGroupSummary`, `toolGroupState` (fonctions pures).
4. Interface : `ToolGroup.tsx` (mémoïsé, comparaison des outils un à un), `Transcript.tsx`
   (regroupement, éléments mémoïsés, fonctions stables), `ToolCall.tsx` (libellé, captures au
   niveau du groupe), styles.
5. Mesure : scénario `fil-long` de l'agent factice, suite e2e `long-thread` (métriques du
   renderer par le protocole DevTools), avant et après.
6. Tests : libellés, regroupement, réducteur, pont, composant (rendus comptés) ; e2e adaptés.

Aucune nouvelle dépendance.

## Journal

- 2026-10-14 — Fiche créée (revue du projet, chantier 2 sur 3).
- 2026-10-14 — **Fait.**
  - `shared/app-tools.ts` : un libellé par outil de l'app (navigateur, simulateur iOS, émulateur
    Android, terminal, serveurs de dev, `ask_user`), d'après ses arguments ; les références
    d'accessibilité (`ref_12`) ne sont pas citées, illisibles pour l'utilisateur.
  - `AppToolsBridge.call` émet `tool-app` pour la carte reliée à l'appel (même liaison que les
    captures) ; le libellé arrive donc à l'appel MCP, un instant après la carte.
  - `shared/tool-groups.ts` : regroupement (outils consécutifs, au moins deux ; jamais une
    autorisation en attente, un plan à valider, un sous-agent ou un outil porteur d'une carte de
    plan), résumé (« 4 lectures, 3 recherches et 3 commandes », « 8 actions dans le
    navigateur »), état (en cours avec l'outil courant, échecs, annulations).
  - `ToolGroup.tsx` (mémoïsé : mêmes outils un à un, mêmes terminaux) ; `Transcript.tsx` :
    `Item` et `MessageItem` mémoïsés, fonctions stables (ref mise à jour dans un
    `useLayoutEffect`, la règle `react-hooks/refs` interdisant de l'écrire pendant le rendu),
    `NO_TERMINALS` constant ; `ToolCall` : libellé lisible, titre de l'agent en infobulle,
    captures montrées par le groupe.
  - **Mesures** (suite e2e `long-thread`, 200 morceaux de réponse, temps du renderer par le
    protocole DevTools) : avec 300 outils dans le fil, **18,6 ms par morceau avant** (script
    1 733 ms), **≈ 10 ms après** (script ≈ 630 ms) ; conversation vide ≈ 8,3 ms. Le surcoût des
    300 outils passe d'environ 10 ms à environ 2 ms par morceau. Aucune tâche longue (> 50 ms)
    ni avant ni après sur cette machine : le seuil est trop grossier, d'où les métriques DevTools
    (`ui.metrics()` ajouté au harnais e2e).
  - **Écarts au plan** : `content-visibility` et virtualisation écartées, la mesure ne les
    justifie pas et elles risquaient de dérégler le défilement automatique. La suite
    `long-thread` vérifie aussi le regroupement et prend deux captures (36 : fil, 37 : groupe
    déplié).
  - Tests : `app-tools.test.ts`, `tool-groups.test.ts`, réducteur (`tool-app`), pont
    (`app-tools-bridge.test.ts`), composant (`Transcript.test.tsx` : regroupement, libellé,
    capture unique ; un morceau de réponse ne refait aucun rendu d'outil — le test échoue bien
    sans `memo` : 40 rendus au lieu de 0). e2e : passe complète avec 3 échecs — `browser` en
    clair et en sombre (il cherchait le titre brut « Read Page », adapté au libellé lisible « Lit
    la structure de la page », vert ensuite) et `user-commands` en clair seulement (bouton
    « Commandes » des réglages pas trouvé à temps ; vert en clair et en sombre au passage suivant :
    instable, sans lien avec cette fiche). Captures 24, 36, 37 regardées en clair et en sombre.
  - Reste : les ≈ 8 ms par morceau d'une conversation vide viennent du message en cours lui-même
    (Markdown entièrement réanalysé à chaque morceau) ; à reprendre si de très longues réponses
    se font sentir.
- 2026-10-23 (écart, fiche 126) : l'état `cancelled` d'une carte se lit « interrompu » (et non
  plus « annulé »), et un outil qui échoue après que l'utilisateur a arrêté le tour (Échap, ■)
  est interrompu, pas en échec.
