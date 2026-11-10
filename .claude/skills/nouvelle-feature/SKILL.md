---
name: nouvelle-feature
description: Crée ou démarre une fiche de fonctionnalité dans docs/features/ (spec, critères, plan). À utiliser quand on commence une nouvelle fonctionnalité ou qu'on demande d'implémenter une fiche.
---

# Nouvelle fonctionnalité

1. Lire `docs/features/README.md` pour trouver le prochain numéro libre (ou la fiche existante).
2. Si la fiche n'existe pas : copier `docs/features/_modele.md` vers `docs/features/NNN-nom-court.md`,
   remplir « Pourquoi » et les « Critères d'acceptation » (vérifiables, dont un scénario d'agent factice).
   Ajouter la ligne dans l'index.
3. Lire `docs/architecture.md` et les ADR concernés.
4. Écrire le **Plan** dans la fiche : fichiers touchés, étapes, nouvelles dépendances.
   Si la tâche dépasse ~3 fichiers ou introduit une dépendance, présenter le plan à l'utilisateur
   avant de coder.
5. Passer le statut à « en cours » (fiche + index), puis implémenter par petits incréments avec
   `./scripts/verify` entre chaque.
6. À la fin : cocher les critères, ajouter une entrée datée au Journal (fait, écarts, reste à faire),
   statut « fait » si tous les critères sont remplis.
