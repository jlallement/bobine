# Travailler avec les agents de code

Ce dépôt est conçu pour être développé en grande partie par des agents de code (Claude Code,
Codex, et Bob plus tard). Ce document explique aux humains comment ça s'organise.

## Les fichiers que lisent les agents

| Fichier | Lu par | Rôle |
|---|---|---|
| `AGENTS.md` | Codex, Claude (via import), la plupart des agents | **Source unique** des consignes |
| `CLAUDE.md` | Claude Code | Importe `AGENTS.md` + spécificités Claude |
| `.claude/skills/` | Claude Code | Workflows répétables |
| `.claude/settings.json` | Claude Code | Permissions (commandes autorisées sans confirmation) |
| Règles Bob | Bob | **À configurer** quand on aura accès (vérifier s'il lit `AGENTS.md`) |

Règle d'or : une consigne n'existe qu'à **un seul endroit**. Les autres fichiers y renvoient.

## Le cycle d'une fonctionnalité

1. **Fiche** : on crée `docs/features/NNN-nom.md` à partir de `_modele.md` (skill
   `nouvelle-feature` dans Claude Code). On y écrit le *pourquoi* et les critères d'acceptation.
2. **Plan** : l'agent propose un plan dans la fiche. L'humain le relit si la tâche est importante.
3. **Implémentation** par petits incréments, `./scripts/verify` entre chaque.
4. **Clôture** : l'agent met à jour la fiche (statut, journal, écarts) et l'index.

La fiche sert de **mémoire entre sessions** : un nouvel agent peut reprendre là où le précédent
s'est arrêté en la lisant.

## Les décisions (ADR)

Toute décision structurante (techno, protocole, découpage) fait l'objet d'un ADR dans
`docs/adr/`. Un ADR accepté n'est jamais modifié : on en écrit un nouveau qui le remplace.
Ça évite que chaque nouvel agent rouvre le débat « et si on passait à Tauri ? ».

## La vérification

`./scripts/verify` est le **contrat** : lint, typecheck, tests. Un agent ne déclare une tâche
finie que s'il est vert. Les tests tournent contre l'**agent ACP factice**, jamais contre un vrai
modèle : c'est rapide, gratuit et déterministe.

## Conseils pour lancer un agent

- Donner la fiche en entrée : « Implémente la fiche 002 ».
- Une session = une fiche. Pour paralléliser, utiliser des worktrees git séparés.
- Relire les diffs, surtout dans `src/main/` (sécurité, processus) et le preload (surface IPC).
