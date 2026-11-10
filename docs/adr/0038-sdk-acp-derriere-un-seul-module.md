# ADR-0038 — Le SDK ACP derrière un seul module

- **Statut** : accepté
- **Date** : 2026-11-06

## Contexte

Bobine importait `@agentclientprotocol/sdk` depuis une soixantaine de fichiers (main, types
partagés, renderer, agent factice, sondes). Le SDK 2 change d'entrée : l'entrée par défaut ne
connaît plus que le protocole stable, et sa validation retire ce que Bobine lit des fonctions
instables (`usage` en fin de tour, `fork`, `subagent_update`) ; il faut l'entrée
`@agentclientprotocol/sdk/unstable` partout, sans oubli (fiche 143). L'utilisateur veut aussi
pouvoir **revenir en arrière en un geste** si une version du SDK ne marche plus avec Bob ou
OpenCode (fiche 181).

## Décision

Un seul module importe le SDK : `src/shared/acp-sdk.mts`, qui le réexporte en entier
(`export * from …`). Tout le reste importe depuis ce module ; une règle ESLint
(`no-restricted-imports`, motif `ACP_SDK` de `eslint.config.mjs`) refuse tout autre import du
paquet, et le renderer n'en lit que des types. Une montée (ou un retour) de version du SDK tient
dans un commit qui ne touche que `package.json`, `pnpm-lock.yaml` et ce module.

## Alternatives écartées

- **Changer chaque import à chaque montée** — soixante fichiers par montée, un oubli possible
  (un seul import de l'entrée stable suffit à mélanger deux surfaces de protocole), et un retour
  arrière qui défait autant de fichiers.
- **Module dans `src/main/acp/`** — le renderer en lit des types et l'agent factice, les sondes et
  leurs essais en importent du code : seul `src/shared` est vu par tous les `tsconfig`.
- **Alias de bundler (`resolve.alias`)** — l'agent factice et les sondes sont lancés par Node sans
  bundler ; un alias ne vaudrait que pour une partie du code.
- **Adaptateur qui retype l'API** (fonctions et types propres à Bobine) — beaucoup plus de code
  pour un gain nul tant que l'API du SDK suit : le module reste un simple réexport ; si une version
  change l'API, l'écart s'absorbe d'abord dans ce module.

## Conséquences

- En `.mts` (et non `.ts`) : Node le charge comme module ES sans avertissement quand il lance
  l'agent factice. Les imports écrivent l'extension (`…/shared/acp-sdk.mts`), comme ceux de
  l'agent factice.
- Le choix de l'entrée du SDK (stable, `unstable`, plus tard `experimental/v2`) se lit à un seul
  endroit.
- Procédure de retour arrière : fiche 181.
