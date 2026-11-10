# ADR-0015 — Ce qu'un agent fait hors d'ACP : des adaptateurs portés par son profil

- **Statut** : accepté
- **Date** : 2026-10-20

## Contexte

L'ADR-0002 range les différences entre agents dans leur profil, et l'ADR-0011 accepte des fonctions
propres à un agent si son profil les déclare. Mais le profil ne déclarait qu'une étiquette
(`costSource: 'bob-db'`, `subagentStream: 'opencode'`), et c'est l'hôte d'agent (`AgentHost`) qui la
comparait pour appeler le code de Bob ou d'OpenCode. L'hôte, le suivi des sous-agents et le main
process connaissaient donc les deux agents, devise `bobcoins` comprise, et l'interface testait
`profileId === 'bob'` (audit du 2026-10-20, fiche 088). Chaque agent de plus aurait ajouté des cas
dans l'hôte.

## Décision

Le profil d'un agent porte l'objet qui fait le travail, derrière un point d'extension générique de
`src/main/agent/adapters.ts` : `costSource` (coût de la session, de ses sous-agents, dépense
récente, devise), `subagentStream` (travail des sous-agents dans le flux de la conversation),
`trust` et `license` (motif du refus, et ce que l'app peut proposer). Le code de chaque agent reste
dans ses modules (`bob-*.ts`, `opencode-*.ts`), que seul `profiles.ts` importe. L'hôte d'agent et
l'interface n'appellent que ces points d'extension, ou lisent ce que le profil a mis dans le
blocker et l'instantané. ESLint refuse un import de `bob-*` ou `opencode-*` ailleurs, et un test
`profileId === '…'` dans le renderer.

## Alternatives écartées

- **Profil déclaratif et module de correspondance** : le profil garde ses étiquettes, un module
  unique les traduit en code. Deux endroits par agent, et le « si c'est `bob-db` » est seulement
  déplacé.
- **Fonctions injectées par le gestionnaire de conversations** : l'entorse passe de l'hôte d'agent
  au gestionnaire, sans disparaître.
- **Greffons par agent** (déjà écartés par l'ADR-0011) : les adaptateurs ne sont pas chargés au
  lancement. Ce sont des objets typés, choisis dans le code de `profiles.ts`.

## Conséquences

- Ajouter un agent, ou suivre un changement de Bob, ne touche plus que ses modules et son profil.
  Un nouveau besoin hors d'ACP commence par un point d'extension dans `adapters.ts`.
- Le profil contient du code, plus seulement des données : il se teste comme tel. Les essais
  passent leur propre adaptateur (ex. `bobDbCosts(<base d'essai>)`) au lieu d'options de l'hôte.
- Les repères de « Propre à <agent> » (ADR-0011) sont tirés de ces adaptateurs : `costSource.id`
  choisit les textes, un nouvel `id` demande les siens.
- Les fichiers de contrat lus par les sondes (`bob-contract.ts`, `opencode-contract.ts`) restent
  sans import de valeur : leurs adaptateurs n'en importent que des types.
