---
name: verifier
description: Vérifie qu'une tâche est réellement terminée selon la définition de « fini » d'AGENTS.md. À utiliser avant de déclarer une tâche finie ou de committer.
---

# Vérifier

1. Lancer `./scripts/verify`. S'il échoue : corriger la cause, jamais désactiver la vérification.
2. Contrôler la définition de « fini » d'`AGENTS.md` point par point :
   - comportement testé contre l'agent factice ;
   - interface changée : suites e2e touchées vertes sur GitHub (`e2e.yml` sur la branche,
     macOS + Linux) et captures regardées ; suite complète locale seulement avant un tag
     (ADR-0069) ;
   - fiche `docs/features/` à jour (critères cochés, journal daté) ;
   - ADR si décision structurante ;
   - `docs/architecture.md` à jour si l'architecture a bougé.
3. Relire le diff (`git diff`) en cherchant : secrets, code spécifique à un agent dans l'UI,
   accès Node depuis le renderer, `any`/`@ts-ignore` non justifiés.
4. Rendre compte honnêtement : ce qui est vert, ce qui n'a pas pu être vérifié et pourquoi.
