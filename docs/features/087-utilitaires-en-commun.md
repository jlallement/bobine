# 087 — Utilitaires en commun : arguments des outils, attentes, dossiers, messages d'erreur

- **Statut** : fait
- **Dépend de** : —
- **Agents** : les deux — refactorisation interne ; seuls les messages d'erreur d'IPC changent

## Pourquoi

L'audit qualité du 2026-10-20 trouve l'architecture en couches saine, mais des petits utilitaires
recopiés d'un module d'outils à l'autre : la lecture des arguments d'un outil, la fabrique des
outils d'un panneau, l'attente, le test « est-ce un dossier », le message d'une erreur. Une
correction faite dans une copie ne profite pas aux autres. Pour l'utilisateur, seuls les messages
d'erreur venus du main changent : la cause, sans préfixe technique (demande du 2026-10-20).

## Existant

- `argsOf` : 6 copies (`filmstrip/device-tool.ts`, `terminal/terminal-tools.ts`,
  `browser/browser-tools.ts`, `simulator/simulator-tools.ts`, `android/android-tools.ts`,
  `preview/preview-tools.ts`).
- `pointArg` : 3 copies (navigateur, simulateur, émulateur) ; seule la fin du message d'erreur
  change (« attendu », « in points », « in dp »).
- Fabrique locale `tool()` (outil autorisé d'office, qui ouvre son onglet du panneau) : 4 copies
  (terminal, simulateur, émulateur, lancer l'app) ; celles du simulateur et de l'émulateur
  acceptent aussi une liste de contenus.
- `delay`/`sleep` : 5 fonctions (`agent/session-replay.ts`, `browser/browser-manager.ts`,
  `simulator/simulator-tools.ts`, `android/android-manager.ts`, `preview/dev-servers.ts`), dont
  trois qui ne retiennent pas le processus (`unref`) ; plus 6 attentes écrites en ligne
  (`cdp-tab.ts`, `simulator-manager.ts` ×2, `simctl.ts`, `android-tools.ts`, `self-install.ts`).
- `isDirectory` : `agent/process-utils.ts` (importé par `agent-host.ts`), `conversations/manager.ts`
  (exporté, importé par personne), `agent-config/rules.ts` ; celui de `user-data-migration.ts`
  n'est pas une copie : il ne suit pas les liens (`lstat`).
- `e instanceof Error ? e.message : String(e)` : 33 occurrences (main, renderer, shared).
  `errorMessage` de `agent/process-utils.ts` n'est pas l'équivalent : il ajoute le détail qu'un
  agent joint à une erreur JSON-RPC (`data.details`, fiche 078), et `agent-host.ts` l'appelle onze
  fois.
- Imports en double : `conversations/manager.test.ts` (`node:fs`, `vitest`),
  `files/file-links.test.ts` (`node:fs`), `components/Sidebar.tsx` (`./Menus`).
- JSDoc en double au-dessus de `ConversationManager.delete`.

## Critères d'acceptation

- [x] Une seule définition de `argsOf`, `pointArg` (unité en paramètre) et de la fabrique des
      outils d'un panneau, dans `src/main/mcp/tools.ts`.
- [x] Une seule `delay` (`src/main/delay.ts`), avec `unref` en option là où les copies l'avaient.
- [x] Une seule `isDirectory` qui suit les liens (`agent/process-utils.ts`) ; celle de la
      migration renommée pour dire qu'elle ne les suit pas.
- [x] `messageOf(error)` dans `src/shared/errors.ts` (sans `node:*` ni `electron`), utilisé par les
      33 occurrences ; `errorMessage` de `process-utils.ts` s'appuie dessus.
- [x] Règle ESLint `no-duplicate-imports` (`allowSeparateTypeImports`) active, les fichiers
      corrigés ; JSDoc en double retiré.
- [x] `ipcErrorText` (`src/renderer/src/ipc-errors.ts`) pour toutes les erreurs d'IPC affichées :
      préfixe d'Electron et « Error: » retirés partout.
- [x] Aucun autre changement de comportement : tests unitaires inchangés et verts, e2e `browser`,
      `simulator`, `android`, `terminal`, `launch` verts (agent factice).

## Plan

1. `src/shared/errors.ts` (+ test) : `messageOf(error: unknown): string`. Remplacer les 33
   occurrences ; dans `process-utils.ts`, `errorMessage` part de `messageOf`. Nom distinct de
   `errorMessage` : le riche reste propre aux erreurs d'agent, et `agent-host.ts` (modifié en
   parallèle par la fiche 088) ne change pas.
2. `src/main/mcp/tools.ts` (+ test) : type `ToolArgs`, `argsOf`, `pointArg(value, key, unit?)`,
   `panelToolFactory(panel)` ; les 6 modules d'outils s'en servent (le commentaire qui justifie
   l'autorisation d'office reste dans chaque module).
3. `src/main/delay.ts` (+ test) : `delay(ms, { unref })` ; les 5 fonctions et les 6 attentes en
   ligne s'en servent, `unref` gardé là où il était.
4. `isDirectory` : celle de `process-utils.ts` sert à `manager.ts` et `rules.ts` ; celle de
   `user-data-migration.ts` devient `isDirectoryNotLink`. `agent-host.ts` : rien à changer.
5. `eslint.config.mjs` : `no-duplicate-imports` ; corriger les trois fichiers. JSDoc de `delete`.
6. `./scripts/verify`, `pnpm build && pnpm e2e browser simulator android terminal launch`.

Pas de nouvelle dépendance. Pas d'entrée au CHANGELOG (rien de visible).

## Journal

- 2026-10-20 — Fiche créée : état des lieux, plan.
- 2026-10-20 — Fait comme prévu : `src/shared/errors.ts` (`messageOf`), `src/main/delay.ts`,
  `argsOf` / `pointArg` / `panelToolFactory` / type `ToolArgs` dans `src/main/mcp/tools.ts`, avec
  leurs tests ; règle `no-duplicate-imports` dans `eslint.config.mjs` ; `architecture.md` (ligne
  « Utilitaires communs »).
  - `messageOf` plutôt qu'`errorMessage` : celui de `process-utils.ts` n'est pas l'équivalent (il
    ajoute le `data` d'une erreur JSON-RPC) et `agent-host.ts` l'appelle onze fois ; il reste là,
    bâti sur `messageOf`. Le remplacer partout aurait changé des messages.
  - `isDirectory` reste dans `process-utils.ts` : la déplacer obligeait à ajouter un import dans
    `agent-host.ts`, que la fiche 088 modifie en même temps. `manager.ts` et `rules.ts` l'importent
    de là ; l'export de `manager.ts` n'était importé par personne.
  - Fabrique commune aussi pour le terminal et « lancer l'app », qui avaient la même ; leurs outils
    ne renvoient jamais de liste, et un appel devient `async` (une erreur levée devient une
    promesse rejetée : les deux appelants, `tool-server.ts` et `app-tools-bridge.ts`, l'attendent
    déjà avec `await`).
  - Attentes : en plus des 5 fonctions, les 6 attentes écrites en ligne passent par `delay` ;
    `unref` gardé exactement là où il était (navigateur, simulateur, serveurs de dev). Pas
    d'`unref` partout : `simctl.ts` sert aussi au script `pnpm simulator-smoke`, qui sortirait
    pendant l'attente entre deux sondages.
  - Seul écart visible, et seulement par l'agent : `pointArg` du navigateur disait « [x, y]
    attendu », il dit maintenant « [x, y] expected », comme le simulateur et l'émulateur (aucun
    test ne le lisait ; ce qui va à l'agent n'est pas traduit, ADR-0014).
  - La règle ESLint a trouvé un quatrième fichier : `Composer.tsx` (deux `import type` de
    `@shared/agent`).
  - Suite possible, à décider : les copies du renderer qui retirent le préfixe des erreurs d'IPC
    (« Error invoking remote method '…': ») — réunir changerait un texte visible.
  - Vérifié : `./scripts/verify` vert (854 tests) ; `pnpm build && pnpm e2e browser simulator
    android terminal launch` vert en clair et en sombre (191 vérifications, agent factice).
- 2026-10-20 — Préfixe des erreurs d'IPC, à la demande de l'utilisateur (« en retirant « Error: »
  partout ») : `ipcErrorText` (`src/renderer/src/ipc-errors.ts`, + test) remplace 18 copies dans
  14 fichiers du renderer, qui avaient quatre expressions : 7 retiraient « Error: », 8 le
  gardaient (`SimulatorTab`, `ChangesTab`, `BrowserTab`, `AndroidTab`, `SettingsDialog` ×3,
  `DocumentTab`), celle de la reprise d'une session ne retirait rien (`/^Error invoking[^:]+: /`
  bute sur le « : » des canaux comme `conversation:resumeSession`), et `BlockerPanel` /
  `SettingsDialog` (clé d'API) retiraient tout jusqu'au dernier « Error: ».
  - Expression retenue : le préfixe d'Electron, puis le nom de l'erreur s'il y en a un
    (`\w*Error: ` : « Error: », « TypeError: »…), comme le faisaient les deux dernières sur les cas
    réels ; rien d'autre n'est retiré.
  - Changement visible : ligne au CHANGELOG (Corrections). e2e `auth` : le message de la clé
    invalide est vérifié sans « Error » (« Clé invalide. »).
  - `BlockerPanel.tsx` (une ligne) et `SettingsDialog.tsx` (quatre endroits), modifiés aussi par la
    fiche 088 : imports placés loin de leurs changements, pas de chevauchement avec leur branche.
  - Vérifié : `./scripts/verify` vert (856 tests) ; e2e `browser simulator android changes settings
    mcp diagnostic resume quick auth links` vert en clair et en sombre.
