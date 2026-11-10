# ADR-0004 — Agent ACP factice pour les tests

- **Statut** : accepté
- **Date** : 2026-10-11

## Contexte

Les agents de code qui développent l'app doivent pouvoir prouver que leur travail fonctionne, sans
dépendre d'un vrai modèle (coût, lenteur, non-déterminisme) ni de Bob (pas d'accès).

## Décision

On développe un **agent ACP factice** avec le SDK TypeScript, piloté par des **scénarios scriptés**
(texte en streaming, appels d'outil, demandes de permission, diffs, images, erreurs, et les
particularités de Bob : échec de confiance du workspace, demande d'auth, élicitation).
Tous les tests automatisés utilisent cet agent.

## Alternatives écartées

- **Tester contre Claude Code / Codex** — utile manuellement, mais coûteux et non déterministe.
- **Mocker le client ACP** — ne testerait pas le vrai protocole ni le cycle de vie du processus.

## Conséquences

- Chaque nouvelle fonctionnalité ACP de l'UI s'accompagne d'un scénario factice.
- L'agent factice doit suivre l'évolution du protocole.
