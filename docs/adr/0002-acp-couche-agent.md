# ADR-0002 — ACP comme unique interface avec les agents

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte

La cible est IBM Bob, qui parle ACP nativement (`bob acp`), mais on n'y a pas accès sur la machine
de développement. On veut pouvoir développer et tester avec d'autres agents.

## Décision

L'application ne parle aux agents **que** via ACP. Chaque agent est décrit par un **profil**
(commande, arguments, environnement, particularités). Aucun code spécifique à un agent dans l'UI.

## Alternatives écartées

- **Intégration directe d'une API de modèle** — on perdrait les outils, MCP, permissions et modes
  fournis par l'agent, et on s'éloignerait de Bob.
- **Adaptateur spécifique à Bob** — inutile puisque Bob parle ACP.

## Conséquences

- Basculer vers Bob = ajouter un profil et gérer son flux d'authentification et de confiance.
- Les extensions non standard (`_meta`, sous-agents) passent par des adaptateurs isolés par profil.
