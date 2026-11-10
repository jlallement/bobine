# 001 — Squelette Electron + React + outillage

- **Statut** : fait
- **Dépend de** : —

## Pourquoi

Poser une base saine sur laquelle les agents peuvent travailler en autonomie : l'app démarre, et
`./scripts/verify` vérifie réellement le code.

## Critères d'acceptation

- [x] `pnpm dev` ouvre une fenêtre avec une UI React minimale (zone de conversation + panneau latéral vide).
- [x] Découpage `src/main`, `src/preload`, `src/renderer`, `src/shared` (types IPC partagés).
- [x] Sécurité : `contextIsolation`, `sandbox`, pas de `nodeIntegration`, CSP stricte.
- [x] IPC typé minimal de bout en bout (ex. `app:getVersion`), testé.
- [x] ESLint, Prettier, TypeScript strict, Vitest configurés.
- [x] `./scripts/verify` lance lint + typecheck + tests et échoue si l'un échoue.
- [x] `docs/architecture.md` et le « Démarrer » de `docs/README.md` mis à jour.

## Plan

**Outillage** (versions choisies pour compatibilité, octobre 2026) :
- Electron 44, electron-vite 5 → impose **Vite 7** (pas encore Vite 8), donc `@vitejs/plugin-react` 5.2.
- **TypeScript 6.0** (typescript-eslint ne supporte pas encore TS 7).
- React 19, Vitest 5, ESLint 10 + typescript-eslint + react-hooks, Prettier.
- Pas de `"type": "module"` : les preloads en `sandbox: true` doivent être en CommonJS.

**Fichiers** :
- `src/shared/ipc.ts` — contrat IPC : canaux, types des requêtes/réponses.
- `src/main/index.ts` — création de fenêtre durcie ; `src/main/ipc.ts` — enregistrement des handlers
  à partir d'une table typée (testable sans Electron).
- `src/preload/index.ts` + `src/preload/api.ts` — `createApi(invoke)` (testable) exposé via `contextBridge`.
- `src/renderer/` — `index.html` (CSP stricte), `App.tsx` : conversation vide + panneau latéral vide.
- Config : `electron.vite.config.ts`, `tsconfig.{json,node,web}.json`, `eslint.config.mjs`, `.prettierrc`.
- Tests : `src/main/ipc.test.ts`, `src/preload/api.test.ts`.

## Journal

- 2026-10-11 — Fiche créée. Node.js n'est pas encore installé sur la machine (`brew install node`, puis `corepack enable` pour pnpm).
- 2026-10-11 — Implémenté. Node 26 + pnpm 12 installés via Homebrew (corepack n'est plus fourni
  avec Node ≥ 25). Écarts et notes :
  - pnpm bloque les scripts d'installation : `esbuild` et `electron` autorisés dans `pnpm-workspace.yaml` (`allowBuilds`).
  - Electron 44 télécharge son binaire au premier lancement, pas à l'installation.
  - TS 6 : `baseUrl` déprécié → retiré, `paths` en relatif suffit.
  - Vérifié en lançant le build : fenêtre chargée, IPC `app:getInfo` OK, `require`/`process`
    absents du renderer, seul `window.api.app` exposé (contrôle via CDP).
  - Reste : le bundle renderer fait ~640 ko (React non minifié séparément) — sans importance pour l'instant.
