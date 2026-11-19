# ADR-0058 — Réglages de session propres à chaque conversation

- **Statut** : proposé
- **Date** : 2026-11-19

## Contexte

Depuis la fiche 013, le dernier choix de mode, de modèle ou d'option fait avec un profil
(`settings.controls[profil]`) était réappliqué à **toute** ouverture de session de ce profil,
réouverture comprise. La recette OpenCode du 2026-11-19 (D3, reproduit 3 fois, trace réelle) en
montre l'effet : passer une conversation en Plan et en modèle X fait passer en Plan et en X toute
autre conversation rouverte ensuite (relance, mise en veille). Dans l'autre sens, une conversation
laissée en Plan peut être rouverte en Build et écrire sans que l'utilisateur l'ait voulu.

## Décision

Chaque conversation garde **ses** réglages de session : toutes les valeurs courantes (mode,
modèle, options), relevées dans sa fiche quand la session est stable (`ready`, `busy`), pour
l'agent qui les a annoncées. À l'ouverture d'une session :

1. la conversation a des réglages relevés avec cet agent → ceux-là (réouverture, session neuve dans
   la même conversation, aparté) ;
2. sinon, à une **réouverture** → rien : ce que la session rouverte annonce ;
3. sinon (**nouvelle** conversation) → le dernier choix du profil, sinon ses défauts, puis le mode
   de départ (inchangé).

Le dernier choix global reste mémorisé à chaque choix de l'utilisateur, et ne sert qu'au cas 3.
Une branche part avec les réglages de la conversation d'origine ; une fille, un rôle, une relecture
sont de nouvelles conversations (cas 3, puis leur modèle ou mode propre) ; une bascule vers un autre
agent oublie ceux de l'ancien (identifiants propres à chaque agent).

## Alternatives écartées

- **Ne plus rien appliquer à la réouverture** — simple, mais dépend de ce que l'agent rend à
  `session/load`, non documenté pour Bob : un agent qui oublie le mode rouvrirait en Build une
  conversation laissée en Plan.
- **Ne mémoriser que les choix de l'utilisateur** (pas les valeurs courantes) — rate les
  changements faits par l'agent (`current_mode_update`, sortie du mode plan) et rejouerait un mode
  périmé.
- **Mémoire par session ACP plutôt que par conversation** — une conversation change de session
  (session perdue, limite d'étapes, ADR-0030) ; c'est la conversation que l'utilisateur voit.

## Conséquences

- Fiche de conversation : champ `controls` (`{ profileId, values }`), vérifié à la lecture
  (retiré s'il est abîmé, pas la conversation).
- `AgentHostOptions.initialControls` devient une fonction relue à chaque ouverture, qui sait si la
  session est rouverte ou neuve : une relance dans le même hôte (« Réessayer ») n'applique plus de
  réglages figés à sa création.
- Une valeur mémorisée que la session ne propose plus donne l'avis « Réglage non appliqué » une
  fois, puis la valeur effective est relevée.
- Conversations d'avant : rien envoyé à leur première réouverture, puis relevées.
- À surveiller : ordre d'application (celui des réglages annoncés par l'agent ; un effort dépendant
  du modèle est appliqué après lui s'il est annoncé après) ; ce que Bob rend réellement à
  `session/load` (à relever à la prochaine recette Bob).
