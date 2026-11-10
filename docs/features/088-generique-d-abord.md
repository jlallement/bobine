# 088 — Générique d'abord : plus de « si c'est Bob » hors des profils

- **Statut** : fait
- **Dépend de** : 011, 019, 053, 054, 078 ; ADR-0002, ADR-0011
- **Agents** : les deux. Le code propre à Bob et à OpenCode quitte l'interface et l'hôte d'agent
  pour leurs profils ; aucune fonction ajoutée ni retirée (matrice de `docs/agents.md` inchangée).

## Pourquoi

L'audit qualité du 2026-10-20 a relevé deux entorses à la règle « Aucun code spécifique à un agent
dans l'UI » (`AGENTS.md`) et à l'ADR-0011 : un test sur l'identifiant `'bob'` dans un composant
React, et un hôte d'agent (`AgentHost`) qui connaît les deux agents. Chaque nouvel agent, ou chaque
changement de Bob, obligerait à retoucher l'hôte au lieu du seul profil.

## Existant

- `BlockerPanel.tsx` : `profileId === 'bob'` choisit le texte du panneau « Dossier non approuvé »
  (« lancez `bob`… » ou « approuvez ce dossier dans l'agent »). Le blocker `trust` porte déjà
  `canTrustForSession` et `trustRemembered`, tirés du profil.
- `App.tsx` : `profileId === 'mock'` affiche l'astuce « tapez `/scenario` » de l'agent factice.
- `agent-host.ts` importe `bob-contract`, `bob-costs` et `opencode-contract`, compare
  `costSource === 'bob-db'`, `subagentCosts === 'bob-db'`, `subagentStream === 'opencode'`, et
  écrit `currency: 'bobcoins'` en dur. Même entorse dans `subagent-tracker.ts` (`'bobcoins'` en
  dur, types de Bob et d'OpenCode) et dans `index.ts` (`costSource === 'bob-db'` → `readBobSpend`).
  Le chemin de la base de Bob traverse `index.ts` → `ConversationManager` → `AgentHost`.
- Le message « not trusted » de Bob est reconnu pour tous les agents, OpenCode compris.
  `AUTH_REQUIRED` (-32000) est le code ACP standard, rangé dans `bob-contract.ts`.

## Décision (2026-10-20)

Trois options soumises à l'utilisateur : adaptateurs portés par le profil (A), profil déclaratif et
module de correspondance (B), correction minimale qui déplace l'entorse vers le manager (C).
Choix : **A**, et l'astuce de l'agent factice corrigée dans la même fiche. Voir ADR-0015.

## Critères d'acceptation

- [x] Plus aucun identifiant d'agent comparé dans le renderer (`profileId === …`) ; ESLint le
      refuse désormais.
- [x] `agent-host.ts`, `subagent-tracker.ts` et `index.ts` n'importent plus rien de Bob ni
      d'OpenCode : ils n'appellent que les points d'extension génériques du profil. ESLint refuse un
      import de `bob-*` ou `opencode-*` hors de `profiles.ts` et de ces modules.
- [x] Aucune devise écrite en dur hors des modules de l'agent (`bob-costs.ts`).
- [x] Le panneau « Dossier non approuvé » propose la commande déclarée par le profil (Bob : `bob`),
      sinon le texte générique (`BlockerPanel.test.tsx`).
- [x] La reconnaissance du refus « dossier non approuvé » est déclarée par le profil (Bob, factice).
- [x] Les repères de « Propre à <agent> » et la matrice de `docs/agents.md` sont inchangés
      (`capabilities.test.ts`).
- [x] Testé contre l'agent factice : `pnpm e2e auth bob subagents usage base settings`, clair et
      sombre.

## Plan

Points d'extension (`src/main/agent/adapters.ts`, types seuls) :

- `CostSource` : repère (`bob-db`), devise, `session(id)`, `subagents?(id)`, `spend?(now)`.
  Remplace `costSource: 'bob-db'` et `subagentCosts: 'bob-db'`.
- `SubagentStream` : `childOf(update)`, `forCard(update, child)` ; `ChildSession` y devient
  générique. Remplace `subagentStream: 'opencode'`.

Profil (`profiles.ts`) :

- `costSource: bobDbCosts(<home>/.bob/db/bob.db)` pour Bob (et pour le factice avec
  `MOCK_AGENT_COST_SOURCE=bob-db`), `home` = `BOBINE_CONFIG_HOME` sinon `~`.
- `subagentStream: { childOf: childSessionOf, forCard: childUpdateForCard }` pour OpenCode et le
  factice.
- `trust: { pattern, flag, remembered, approveCommand }` remplace `trustFlag` et
  `trustRemembered`, sur le modèle de `license: { pattern, steps }`.
- `welcomeHint` : astuce de la page d'accueil (factice : « tapez `/scenario` »), passée par
  `AgentInfo`.

Fichiers :

1. `adapters.ts` (nouveau), `bob-costs.ts` (`bobDbCosts`, `SubagentCost`),
   `opencode-contract.ts` (`ChildSession` importé en type).
2. `profiles.ts`, `capabilities.ts` (`specificItems` lit `costSource.id`, `costSource.subagents`,
   `subagentStream`, `trust`).
3. `agent-host.ts` (option `bobDb` retirée, code d'auth tiré du SDK), `subagent-tracker.ts`
   (devise reçue avec le lecteur de coûts), `manager.ts` (option `bobDb` retirée), `index.ts`
   (`agentSpend` → `costSource.spend`).
4. `shared/agent.ts` (`approveCommand` du blocker `trust`, `welcomeHint` d'`AgentInfo`),
   `BlockerPanel.tsx` (prop `profileId` retirée), `App.tsx`, `withCode` sorti de
   `SettingsDialog.tsx` pour l'astuce d'accueil, textes `fr.json` / `en.json`.
5. Tests : `agent-host`, `subagent-tracker`, `profiles`, `capabilities`, `BlockerPanel` si
   besoin.
6. Docs : `architecture.md`, `agents.md` (« Ajouter une fonction propre à un agent »), `acp.md`,
   ADR-0015.

Pas de nouvelle dépendance.

## Journal

- 2026-10-20 : existant relevé, options soumises, option A choisie par l'utilisateur.
- 2026-10-20 : fait comme prévu. `adapters.ts` (`CostSource`, `SubagentCost`, `ChildSession`,
  `SubagentStream`) ; Bob : `bobDbCosts(bobDbIn(home))` et `trust` (motif, `--trust`, mémorisé,
  `approveCommand: 'bob'`) ; OpenCode et factice : `OPENCODE_SUBAGENT_STREAM`
  (`opencode-contract.ts`, qui n'importe que des types et reste chargeable par sa sonde) ; factice :
  `welcomeHint`. `AgentHost` lit le code « connexion requise » dans le SDK
  (`RequestError.authRequired().code`) ; `bob-contract.ts` garde `AUTH_REQUIRED` pour la sonde.
  Options `bobDb` d'`AgentHost` et de `ConversationManager` retirées ; `agentSpend` (`index.ts`)
  appelle `costSource.spend`.
- Écarts au plan : `withCode` devenu le composant `CodeText` (`components/CodeText.tsx`), partagé
  par `SettingsDialog` et `App` ; garde-fous ESLint ajoutés (`eslint.config.mjs` : `AGENT_MODULES`,
  `NO_PROFILE_ID_TEST`), vérifiés sur un fichier d'essai qui les enfreint ; contrôle de l'astuce
  d'accueil ajouté à la suite e2e `base`.
- Ce qui change pour l'utilisateur, à la marge : le panneau « Dossier non approuvé » de Bob dit
  « lancez `bob` et faites confiance au dossier » (au lieu de « choisissez un niveau de
  confiance ») ; le message « not trusted » n'est plus reconnu chez OpenCode, qui ne l'envoie
  jamais. Pas de ligne dans le CHANGELOG pour si peu.
- `./scripts/verify` vert (855 tests). E2E `auth bob subagents usage` : tout vert sauf, une fois,
  « connexion dans un terminal : Réessayer » en clair (le shell de l'essai a mis plus de 5 s à
  lancer `touch`, l'essai a réessayé trop tôt ; même étape verte en sombre). Relancé avec `base`
  et `settings` : tout vert, clair et sombre. Captures regardées : `7-dossier`, `1-accueil`
  (astuce), `g1-sous-agent-bob` (bobcoins), `g3-sous-agent-opencode2`, `84-agents-propre`
  (détails avec `CodeText`). Suite complète (`pnpm e2e`) non lancée : elle tourne avant le push du
  lot 087-089.
- `App.tsx` : `snapshot?.info.profileId === 'mock'` remplacé par `snapshot?.info.welcomeHint` ;
  l'astuce n'est pas listée dans « Propre à <agent> » : elle ne concerne que l'agent factice,
  absent de l'app installée et de la matrice.
