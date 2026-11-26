# Bobine — feuille de route vers la V1 (6 novembre 2026)

But fixé par l'utilisateur le 2026-11-06 : **une jolie V1 qu'on peut distribuer à d'autres**,
« sans 1000 bugs ». Trois axes, dans cet ordre de priorité quand ils se disputent le temps :
1. **Robustesse et compatibilité** : rien de perdu, rien de bloqué, des erreurs compréhensibles,
   sur les Mac et avec les versions d'outils que les gens ont vraiment.
2. **Beauté et finition** : chaque écran au niveau d'une app Mac soignée.
3. **Fonctions** : peu de nouvelles, bien finies.

## Étapes

| Version | Contenu | Fiches |
|---|---|---|
| **0.9.1** — finitions | Audit de l'interface : défauts classés du plus visible au moins visible, idées « pour faire plaisir » choisies par l'utilisateur ; défauts mineurs de la recette 0.9 (D7 à D11) | 185, 183 |
| **0.10** — prise en main | Aide intégrée (guide fr/en, recherche, liens « ? ») ; premier lancement soigné ; mémoire commune aux agents | 186, 188, 182 |
| **0.11** — solidité | GitLab auto-hébergé : ouvrir une MR (fiche 189) ; lots tirés de l'audit de robustesse : écritures sûres du profil, reprise après plantage, compatibilité, performances des longues sessions, essais d'endurance | 189, 187 (puis ses lots) |
| **1.0.0-beta.1** — bêta publique (10 novembre 2026) | Dépôt public, Release préversion ; ouvre le point 16 de la barre V1 (bêta de deux semaines, au moins cinq utilisateurs) | 220 |
| **1.0** | Barre de qualité de la V1 atteinte (définie par la fiche 187), recette complète par un rôle QA, second passage de l'audit d'interface | — |
| **1.0.x** — ligne stable | Publiée (1.0.0 puis 1.0.1, marquée « Latest » sur la page des versions) ; correctifs depuis `main` | — |
| **1.1** — versions candidates | Onglet Fichiers, montées de version ; préversions publiées depuis la branche `1.1` (ADR-0068) | fiches sur la branche `1.1` |
| **1.2** — versions candidates | Tour de table (`/roundtable`) ; préversions publiées depuis la branche `1.2` | fiches sur la branche `1.2` |

État au 2026-11-26 (lignes 1.0.x, 1.1 et 1.2 ajoutées d'après la page des versions de GitHub ;
aucune date annoncée).

Chaque version passe par le même chemin que la 0.9 :
1. relecture de chaque fiche par la session mère (tech lead) ;
2. recette QA distincte, avec un vrai agent borné (OpenCode ; IBM Bob seulement sur décision de
   l'utilisateur) ;
3. corrections ;
4. suite complète ;
5. publication et recette du DMG.

## Décidé

- Aide : une seule source Markdown, embarquée et lisible sur GitHub (fiche 186). Présentation
  (fenêtre à part comme les Réglages, préférée par l'utilisateur, ou autre) proposée par l'audit
  d'interface.
- Premier lancement soigné retenu pour la V1 (fiche 188).

## Proposé, non retenu pour l'instant (2026-11-06)

- **Remonter le temps** : instantané git à chaque tour, revenir avant un tour. ADR-0029 est
  réservé.
- **Signature Apple, notarisation et « nouvelle version disponible »** : non choisis comme
  fonctions. L'audit de robustesse (fiche 187) dira s'ils font partie de la barre de qualité
  d'une V1 distribuée, et l'utilisateur tranchera.
  Depuis : l'avis de nouvelle version est fait (fiche 274, ADR-0066) ; il ne télécharge ni
  n'installe rien.
- **L'arène** : même consigne à deux agents, fusion du gagnant.
- Le reste de la réserve de la feuille de route du 28 octobre.
