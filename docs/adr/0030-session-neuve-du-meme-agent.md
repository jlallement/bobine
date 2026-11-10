# ADR-0030 — Agent qui ne sait pas reprendre : session neuve dans la même conversation, échange en texte

- **Statut** : proposé
- **Date** : 2026-10-24
- **Précise** : ADR-0024 (continuer avec un autre agent), ADR-0021 (le fil de Bobine fait foi)

## Contexte

À la réouverture d'une conversation (redémarrage de l'app, « Relancer » après une panne), l'hôte
d'agent demande `session/load`, sinon `session/resume`. Un agent qui n'annonce ni l'un ni l'autre
était abandonné : la conversation passait en lecture seule, avec « Continuer dans une nouvelle
conversation » (fiche 015). Avec la fiche 141, l'utilisateur peut déclarer n'importe quel agent
ACP ; un agent minimal (ni `loadSession` ni `resume`) verrait alors **toutes** ses conversations
figées à chaque redémarrage de l'app (défaut 3 de la fiche 139).

Cas voisin : un agent qui sait reprendre mais a perdu la session (plantage avant de l'enregistrer).
« Relancer » ouvrait une session neuve **sans rien lui dire** de l'échange d'avant : il répondait
comme à un inconnu, seul un avis dans le fil le signalait.

## Décision

**Quand une conversation continue dans une session neuve du même agent, c'est une bascule vers
lui-même** (ADR-0024) :

- la conversation et son fil restent (ADR-0021) ; une session neuve s'ouvre (`session/new`) ;
- un repère est posé dans le fil (élément `handover`, `from` = `to`, `reason` : `no-resume` ou
  `session-lost`), affiché « Nouvelle session avec <agent> » avec la raison ;
- l'échange d'avant part en texte avec le prochain message de l'utilisateur, déduit du fil comme
  après une bascule (même borne, même résumé des outils), avec une ouverture propre (« an earlier
  session of yours that could not be resumed ») ; la consommation et la réconciliation du rejeu
  repartent du repère ;
- le repère est posé à l'ouverture de la session neuve, pour que l'utilisateur voie tout de suite
  ce qui se passe ; s'il est déjà le dernier et qu'aucun message ne le suit (deux redémarrages sans
  écrire), il n'est pas répété.

Générique : la décision ne dépend que des capacités annoncées à `initialize`. Bob et OpenCode, qui
savent reprendre, ne sont concernés que par une session perdue.

## Alternatives écartées

- **Garder la lecture seule** — un agent déclaré minimal deviendrait inutilisable d'un lancement à
  l'autre, et « Continuer dans une nouvelle conversation » disperse le travail sur deux lignes.
- **Envoyer l'échange tout de suite** (un tour « voici le contexte ») — coûte un tour sans rien
  demander, au simple affichage d'une conversation ; déjà écarté par l'ADR-0024.
- **Session neuve sans contexte** (l'ancien comportement après une session perdue) — l'agent a tout
  oublié sans que l'utilisateur le mesure ; réponses hors sujet.
- **Un élément de fil à part** (`renewal`) — dupliquerait tout ce que la bascule sait déjà faire
  (contexte, consommation, rejeu, branche, export) pour la même idée.

## Conséquences

- Complément (fiche 209) : troisième raison, `turn-limit`, quand l'utilisateur choisit « Nouvelle
  session avec le résumé » après un agent qui refuse de continuer dans sa session (limite d'étapes
  comptée sur toute la session, Bob 2.0.9).
- Plus de lecture seule pour un agent qui ne sait pas reprendre ; elle reste pour un agent retiré
  (profil plus proposé) et pour une session qui ne peut pas être reprise hors « Relancer ».
- L'agent ne reçoit qu'un résumé des outils (titre, statut, fichiers touchés), pas leurs
  résultats : il relit les fichiers s'il en a besoin (comme après une bascule).
- Une conversation peut compter plusieurs sessions du même agent ; seule la dernière est dans son
  enregistrement, les autres restent chez l'agent (s'il les garde).
- L'avis « session perdue » disparaît du fil (le repère le remplace) ; l'erreur va au journal.
- La grille de conformité (fiche 139) vérifie ce comportement : persona « ACP minimal », cases
  « panne » et « reprise ».
