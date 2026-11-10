---
name: nouvel-adr
description: Rédige un ADR (décision d'architecture) dans docs/adr/. À utiliser quand un choix structurant est fait ou remis en cause (techno, protocole, dépendance majeure, découpage).
---

# Nouvel ADR

1. Lire `docs/adr/README.md` : vérifier qu'aucun ADR ne couvre déjà la décision.
2. Copier `docs/adr/_modele.md` vers `docs/adr/NNNN-titre-court.md` (numéro suivant, 4 chiffres).
3. Remplir Contexte, Décision, Alternatives écartées, Conséquences. Rester court et factuel.
4. Statut « proposé » tant que l'utilisateur n'a pas validé ; « accepté » ensuite.
5. Si l'ADR en remplace un autre : ne pas modifier le contenu de l'ancien, seulement son statut
   (« remplacé par ADR-NNNN »).
6. Mettre à jour l'index `docs/adr/README.md`, puis `./scripts/verify`.
