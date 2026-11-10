# 002 — Agent ACP factice à scénarios

- **Statut** : fait
- **Dépend de** : 001

## Pourquoi

Voir [ADR-0004](../adr/0004-agent-factice-pour-tests.md) : tester l'app de façon rapide,
gratuite et déterministe, et simuler Bob sans y avoir accès.

## Critères d'acceptation

- [x] Exécutable ACP sur stdio, écrit avec `@agentclientprotocol/sdk`.
- [x] Scénario choisi par variable d'environnement ou argument (`--scenario streaming-texte`).
- [x] Scénarios de base : texte en streaming, appel d'outil, demande de permission, diff, erreur.
- [x] Scénarios Bob : workspace non approuvé, authentification requise, élicitation.
- [x] Format de scénario documenté ([docs/mock-agent.md](../mock-agent.md)) — scénarios en TS dans `src/mock-agent/scenarios.mts`.
- [x] Tests d'intégration : un client ACP minimal lance l'agent et vérifie chaque scénario.

## Plan

**Exécution** : fichiers `.mts` exécutés directement par Node (suppression native des types, Node ≥ 22.18
— Node 26 en local, Node 24.21 embarqué dans Electron 44). Pas d'étape de build.
→ tsconfig : `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`.

**Fichiers** (`src/mock-agent/`) :
- `scenario.mts` — types des scénarios (étapes) + interpréteur (streaming, annulation, délais).
- `scenarios.mts` — catalogue des scénarios.
- `agent.mts` — handlers ACP (`initialize`, `authenticate`, `session/new`, `session/set_mode`,
  `session/prompt`, `session/cancel`) et comportements de session (auth, confiance).
- `main.mts` — point d'entrée CLI : `--scenario`, `--delay`, variables `MOCK_AGENT_*`.
- `testing.mts` — utilitaires de test réutilisables (lancer l'agent, jouer un tour, collecter les updates).
- `mock-agent.test.ts` — tests d'intégration par vrai processus + vrai protocole.

**Choix d'un scénario** : `--scenario`, sinon `MOCK_AGENT_SCENARIO`, sinon `demo`. Dans une session,
un prompt `/scenario <nom>` joue ce scénario pour ce tour (pratique depuis l'UI).

**Dépendance** : `@agentclientprotocol/sdk` 1.8 (déjà prévue par l'ADR-0002).

## Journal

- 2026-10-11 — Fiche créée.
- 2026-10-11 — Implémenté : 15 scénarios, 38 tests (vrai sous-processus, vrai protocole), ~6 s.
  - En plus du prévu : scénarios `pensee`, `plan`, `sous-agent`, `echo`, `lent`, `refus`, `demo`,
    modes de session (`code` / `ask`), commande `/scenario` en cours de session.
  - Découverte : le SDK 1.8 a un événement **`subagent_update`** (instable) ; les updates de la session
    enfant arrivent sur la même connexion. Base pour la fiche 010.
  - Élicitation : méthode ACP `elicitation/create` (mode `form`), capacité client `elicitation.form`.
  - Le code d'erreur réel de Bob pour un workspace non approuvé est inconnu : `-32001` provisoire.
  - Vérifié que les tests échouent bien sur un scénario cassé (2 mutations → 2 échecs), et que l'agent
    tourne sous le Node embarqué d'Electron (`ELECTRON_RUN_AS_NODE=1`).
