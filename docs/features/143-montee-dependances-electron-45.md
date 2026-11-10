# 143 — Montée des dépendances : Electron 45, outillage, SDK ACP, outils externes

- **Statut** : fait (suite e2e complète de l'état final à rejouer)
- **Dépend de** : 012 (packaging), 022 et 100 (clés d'API, trousseau), 065 (Electron hors réseau)
- **Agents** : les deux (aucun code propre à un agent ; OpenCode et Bob ne sont que sondés)

## Pourquoi

Electron 45 est sorti le 2026-10-21 (Chromium 156, Node 24.22) et la plupart des dépendances ont
avancé depuis leur installation. Rester à jour garde les correctifs de sécurité de Chromium, évite
une marche trop haute plus tard (Electron 46 retire les méthodes synchrones de `safeStorage`), et
vérifie que les agents réels (OpenCode, Bob) et AXe n'ont pas de nouvelle version à confronter au
contrat.

## Critères d'acceptation

- [x] Electron 45 : changements cassants relus, code adapté (clés d'API par les méthodes
      asynchrones de `safeStorage`), preload sandboxé sans `Buffer` / `events` / `timers` / `url`.
- [x] Le reste des dépendances à la dernière version compatible ; chaque version laissée en arrière
      est dite, avec sa raison.
- [x] Outils externes (OpenCode, AXe, Bob Shell, binaires des scripts) : version installée ou
      épinglée comparée à la dernière publiée ; sonde jouée ou à jouer.
- [ ] `./scripts/verify`, `pnpm build && pnpm e2e --if-needed` (suite complète, clair et sombre) et
      `pnpm package --dry-run` passent.
- [x] Testé contre l'agent factice : un arrêt pendant la lecture des clés (trousseau asynchrone)
      n'en lance aucun (`agent-host.test.ts`) ; lancements simultanés, un seul déchiffrement ; clé
      renouvelée par le trousseau, rechiffrée (`api-keys.test.ts`).

## Plan

Lots successifs, chacun vérifié et commité à part :

1. **Electron 44.7.2 → 45.0.0**
   - Notes de version relues ; ce qui touche Bobine :
     - `safeStorage` : `isEncryptionAvailable`, `encryptString`, `decryptString` dépréciés (retirés en
       46). `Cipher` (`agent-config/api-keys.ts`) devient asynchrone ; `ApiKeyStore.set`,
       `credentials` aussi, et tout ce qui les appelle (`settings-store.ts`,
       `providers-settings.ts`, `quota*.ts`, `agent-host.ts`, `agent-check.ts`,
       `conversations/manager.ts`, `ipc.ts`, `index.ts`). `shouldReEncrypt` : valeur rechiffrée.
     - `AgentHost.doStart` attend les clés avant de lancer l'agent : un `stop()` pendant ce temps
       annule le lancement (jeton `launchToken`).
     - Preload sandboxé : plus de `Buffer`, `events`, `timers`, `url` → le bundle `out/preload`
       n'en utilise pas (vérifié).
     - Sans effet ici : `window.open` (ouvreur et popup du navigateur intégré tous deux sandboxés),
       permissions de capture (`display-capture` : l'app ne capture pas par les API web),
       descripteurs ASAR (node-pty est hors de l'archive), `openAsHidden`, `enableHeapProfiling`,
       32 bits.
2. **Mineures et correctifs** (dans leur branche).
3. **Outillage** : `electron-vite` 6 + Vite 8 (Rolldown) + `@vitejs/plugin-react` 6, ensemble.
4. **Mermaid 12**, rendu d'avant gardé.

Aucune nouvelle dépendance.

## Versions

| Paquet | Avant | Après | Note |
|---|---|---|---|
| `electron` | 44.7.2 | **45.0.0** | Chromium 156, Node 24.22 |
| `electron-vite` | 5.0.0 | **6.0.0** | exige Vite 8 |
| `vite` | 7.3.7 | **8.3.5** | Rolldown remplace Rollup et esbuild |
| `@vitejs/plugin-react` | 5.2.0 | **6.1.2** | exige Vite 8 |
| `@agentclientprotocol/sdk` | 1.8.0 | 1.9.0 | 2.0.2 écartée (voir Journal) |
| `mermaid` | 11.17.2 | **12.2.0** | exact ; `look: 'classic'`, `layout: 'dagre'` |
| `electron-builder` | 26.17.0 | 26.18.0 | exact |
| `@radix-ui/react-dialog` | 1.1.23 | 1.3.1 | exact |
| `@radix-ui/react-dropdown-menu` / `popover` / `tooltip` | 2.1.25 / 1.2.0 / 1.3.0 | 2.2.1 / 1.3.1 / 1.4.1 | |
| `i18next` / `react-i18next` | 26.4.5 / 17.0.16 | 26.5.6 / 17.1.4 | exacts |
| `react` / `react-dom` | 19.3.0 | 19.3.1 | |
| `vitest` / `@vitest/coverage-v8` | 5.0.3 | 5.0.5 | |
| `eslint` / `typescript-eslint` | 10.12.0 / 8.71.1 | 10.13.0 / 8.72.0 | |
| `jsdom` / `lucide-react` | 30.1.2 / 1.55.0 | 30.1.3 / 1.61.0 | |

Laissés en arrière, avec leur raison :

- **`typescript` 6.0.3** (7.0.2 publiée) : `typescript-eslint` 8.72 n'accepte que `<6.1.0`. À
  reprendre quand il suivra.
- **`@agentclientprotocol/sdk` 1.9.0** (2.0.2 publiée) : écartée par Jérôme le 2026-10-24 (voir
  Journal), à reprendre dans sa propre fiche.
- **`@types/node` 24.x** (26.x publiée) : les types suivent le Node qui exécute le main, celui
  d'Electron 45 (24.22), et `engines.node` (>= 24).

Outils externes :

| Outil | Installé / épinglé | Dernier publié | Suite |
|---|---|---|---|
| OpenCode | 2.0.32 (`~/.opencode/bin`) | **2.1.4** (2026-10-23, npm `@opencode/cli`, dépôt anomalyco/opencode) | sonde avec modèle à jouer sur la 2.1.4 (voir Journal) |
| AXe | 1.8.0 (`scripts/fetch-axe`) | 1.8.0 (2026-07-20) | à jour |
| IBM Bob Shell | 2.0.6 | 2.0.6 (journal de Bob, octobre 2026) | à jour ; `pnpm bob-probe` inutile tant que Bob ne change pas |
| Electron (binaire, `check-electron`) | suit `package.json` | — | 45.0.0 téléchargé par `install.js` |

## Journal

- 2026-10-24 — Fiche ouverte, tous les lots faits sur la branche `claude/deps-electron-45`
  (worktree `.claude/worktrees/deps-electron-45`), rien de poussé ni de fusionné.
  - **Electron 45** : clés d'API par le `safeStorage` asynchrone. Les clés déjà enregistrées par
    `encryptString` se lisent avec `decryptStringAsync` (documenté par Electron). Deux lancements
    simultanés n'ouvrent qu'une fois le trousseau ; une clé que le trousseau demande de rechiffrer
    est réécrite. **Non vérifié en vrai** : l'invite du trousseau macOS avec l'app packagée (fiche
    100) — à regarder au prochain essai à la souris (saisir une clé, relancer l'app, lancer Bob).
  - **Vite 8 / Rolldown** : le filtre `onwarn` qui masquait l'avertissement de zod est retiré (plus
    émis). Main et preload restent en CommonJS ; le main garde désormais les commentaires JSDoc
    (1,73 Mo au lieu de 1,63 Mo), sans effet. Nouvel avertissement de Vite 8 au chargement de
    `vitest.config.ts` (« ESM syntax in a file loaded as CommonJS », `configLoader: 'native'`
    futur) : sans effet aujourd'hui. `pnpm dev` n'a pas été lancé (l'essai à la souris en cours
    tenait l'app) : seul le build l'est, par les e2e.
  - **SDK ACP 2** (2.0.0 du 2026-10-19), essayé puis **retiré à la demande de Jérôme** :
    - l'app utilisait déjà `client()` / `agent()`, mais l'entrée par défaut du SDK 2 ne connaît
      plus que le protocole stable, et sa validation retirerait ce que l'app lit des fonctions
      instables d'ACP v1 (`usage` en fin de tour, `fork`, `subagent_update`) : il faudrait tout
      importer depuis `@agentclientprotocol/sdk/unstable` (et une règle ESLint contre l'entrée
      par défaut). verify vert, sonde OpenCode hors ligne identique ;
    - mais la suite e2e `filles` échoue alors sous charge (2 fois sur 3, contre 0 sur 3 juste
      avant, bissection par lot) à « propositions en rafale » : la pause du fil sous le pointeur
      (fiche 124) est levée par un `pointerover` sur la zone de saisie reçu juste après le
      survol de « Lancer ». Cause exacte non établie (rythme de Chromium et du pilote d'essai,
      que le SDK 2 change) ;
    - à reprendre dans sa propre fiche, avec ce défaut.
  - **Mermaid 12** : la fiche 063 l'avait écarté comme trop récent ; six semaines et trois versions
    plus tard, il passe en gardant le rendu (thème `base` de l'app, `look: 'classic'`,
    `layout: 'dagre'`). Captures `m0-mermaid` claire et sombre comparées : mêmes couleurs, mêmes
    formes ; « Processus principal » passe sur deux lignes. Le morceau chargé au premier diagramme
    passe de 1,23 Mo à 174 ko (ELK n'est chargé que si un diagramme le demande).
  - **OpenCode 2.1.4** : récupéré à part (npm `@opencode/cli`, dans le dossier temporaire de la
    session) pour ne pas toucher à l'installation de Jérôme ; lancer ce binaire téléchargé a été
    refusé par le garde-fou d'exécution de l'agent. Reste à faire par Jérôme :
    `opencode upgrade 2.1.4` puis `pnpm opencode-probe` (modèle gratuit), et `--accept` + mise à
    jour de `docs/acp.md` si la sonde voit un écart.
  - **Échec intermittent connu** de `verify` (déjà sur `main`, noté par la fiche 141) :
    `EnvironmentTeardownError … onUserConsoleLog` attribué à `handover.test.ts` (journaux « Agent
    arrêté » et « Tour fini » écrits après la fin du fichier d'essai), tous les tests verts. Vu
    deux fois sur une dizaine de passages ; hors de cette fiche. Même chose pour l'étape « En-tête
    2 » (délai dépassé) de la suite e2e `filles`, vue 2 fois sur 4 sur `main` (Electron 44).
  - **e2e** : suite complète 124/124 verte après le lot Electron ; après les lots suivants,
    seulement les suites `filles`, `subagents`, `inbox` (bissection) et `mermaid`, vertes hors
    des instabilités ci-dessus. **Suite complète à rejouer sur l'état final** quand le Mac est
    libre (`pnpm build && pnpm e2e --if-needed`, ≈ 7 min), au plus tard avant le tag.
