# ADR-0028 — Indépendance aux agents : marques génériques, sources dans le profil, noms interdits

- **Statut** : proposé
- **Date** : 2026-10-24

## Contexte

L'ADR-0015 range dans le profil d'un agent les adaptateurs de ce qu'il fait hors d'ACP. L'audit de
la fiche 140 a trouvé ce qui y échappait encore : la reconnaissance des sous-agents de Bob et
d'OpenCode dans `shared` (lue par le réducteur du fil, donc aussi dans le renderer), des `_meta` de
Claude Code et de Codex lus par `shared/questions.ts`, des étiquettes `'bob' | 'opencode'`
traduites par des tables pour les règles, les serveurs MCP et les fournisseurs, et le nom des
commandes de compaction dans le réducteur. La fiche 141 doit pouvoir brancher un agent ACP déclaré
sans code.

## Décision

1. **Marque générique posée par le main.** Ce que seul le profil sait reconnaître dans une mise à
   jour (aujourd'hui : un appel d'outil qui lance un sous-agent, `SubagentFormat`) est traduit par
   l'hôte d'agent en une marque de l'app, `_meta["bobine/subagent"]`, avant tout tri. `shared` et
   le renderer ne lisent que cette marque, jamais un format d'agent. Même principe pour un message
   envoyé qui demande la compaction (`compaction: true`, posé par l'hôte).
2. **Sources dans le profil.** `RulesSource`, `McpConfigSource`, `ProvidersSource` (dans
   `agent/adapters.ts`) sont des objets portés par le profil, implémentés dans `agent-config/bob-*.ts`
   et `agent-config/opencode-*.ts`. Le code commun (lecture, écriture sûre, copie de secours,
   dédoublonnage) reste dans `rules.ts`, `mcp-files.ts`, `provider-files.ts`. Chaque source dit en
   clair ce qu'elle lit (`summary()`), repris dans « Propre à <agent> ».
3. **Pas de forme d'un agent non ciblé.** Une forme propre à un agent qui n'est pas une cible
   (Claude Code, Codex) n'est ni lue ni mise derrière un adaptateur : un adaptateur que seul l'agent
   factice utiliserait serait du code mort. Les formes communes à plusieurs agents restent si elles
   tiennent sans `_meta` (ex. champ « Autre » `<clé>_custom`).
4. **Noms interdits.** ESLint refuse les littéraux `'bob'` et `'opencode'` hors de `profiles.ts`,
   `bob-*.ts`, `opencode-*.ts`, des tests et de l'agent factice.
5. **Versions vérifiées.** Le profil déclare `testedVersions` ; le Diagnostic prévient quand
   l'agent en annonce une autre. Un test les tient alignées sur les fichiers des sondes.

## Alternatives écartées

- **Passer le profil au renderer** pour qu'il reconnaisse lui-même les sous-agents : le renderer
  connaîtrait les formats des agents, ce qu'interdit AGENTS.md.
- **Adaptateurs Claude Code et Codex** pour les questions : branchés sur aucun profil réel.
- **Garder les étiquettes avec un module de correspondance unique** : déjà écarté par l'ADR-0015.

## Conséquences

- Un agent sans `subagentFormat` n'a pas de carte de sous-agent : ses sous-agents restent des
  appels d'outil. Les fils déjà enregistrés gardent leurs cartes (on enregistre les éléments).
- La carte de questions perd l'aperçu d'option, qui n'avait que Claude Code pour source.
- Un nouveau besoin propre à un agent dans le fil commence par une marque posée par le main, pas
  par une lecture dans `shared`.
- Brancher un agent ACP : son profil (commande, arguments, environnement), et seulement les
  sources ou formats qu'il a en propre. Le cahier des charges est dans la fiche 140.
