# ADR-0035 — Plafond de coût : état dans le fil, décision dans le main

- **Statut** : proposé
- **Date** : 2026-10-28

## Contexte

La fiche 157 ajoute un plafond de coût par conversation : un défaut dans les réglages, une valeur
propre à chaque conversation, et, une fois dépassé, une interruption du tour à la fin de l'outil en
cours suivie d'une question « Continuer (plafond + X) » / « Arrêter ». Il faut décider où vivent le
plafond d'une conversation et la question posée, et qui décide d'interrompre. Contraintes : seul le
main parle ACP (`session/cancel`, `session/prompt`) ; la consommation est déjà calculée, des deux
côtés, par le réducteur du fil (`ConversationUsage`, fiches 019, 109, 130) ; l'unité dépend de
l'agent (bobcoins pour Bob par son adaptateur, dollars, ou jetons sans coût) ; aucun cas « si
Bob » hors des adaptateurs (ADR-0011, ADR-0028).

## Décision

- Le plafond propre à une conversation (`costCap`) et la carte « Plafond atteint » (élément
  `cost-cap`, avec la réponse) vivent **dans le fil** (`TranscriptState`), posés par trois
  évènements de l'app (`cost-cap-set`, `cost-cap-reached`, `cost-cap-answer`) que le réducteur
  partagé applique. Le plafond par défaut est une préférence (`costCapEnabled`, `costCapAmount`,
  `costCapTokens`) qui vaut pour les **nouvelles** conversations : au premier message, s'il est
  activé, il est figé dans le fil (`costCap: 'settings'`, montants lus dans les réglages) ; une
  conversation sans plafond posé n'en a pas.
- La décision est prise **dans le main**, par un gardien (`CostCapGuard`) abonné au gestionnaire
  de conversations comme les conversations filles : il relit le fil après chaque évènement utile,
  attend la fin de l'outil en cours, interrompt par le même chemin que ■, pose la carte à la fin du
  tour et relance l'agent sur « Continuer ». Tant que le plafond est atteint, il retient aussi
  tout nouveau message (`promptGate` du gestionnaire, avant l'envoi) avec une nouvelle carte :
  « Continuer » relève le plafond et l'envoie, « Arrêter » ne l'envoie pas. Les règles
  (`capDecision`, `capReached`) sont des fonctions pures partagées.
- L'unité est celle du coût que la conversation connaît (sa devise), sinon les jetons ; un plafond
  propre posé dans une autre unité est ignoré au profit du défaut.

## Alternatives écartées

- **Champ dans l'index des conversations** (`ConversationRecord`) — un champ de plus à valider, à
  résumer pour le renderer et à garder en phase avec le fil ; la carte, elle, serait de toute façon
  dans le fil. Le fil est déjà persisté, rejoué au renderer et relu au lancement.
- **Décision dans le renderer** — il ne parle pas ACP, n'est pas toujours affiché (conversation en
  arrière-plan, fenêtre fermée), et plusieurs fenêtres décideraient chacune.
- **Dans `AgentHost`** — l'hôte ne connaît ni les réglages ni la consommation calculée par le fil ;
  et le gestionnaire est déjà à son plafond de lignes.

## Conséquences

- Une carte par tour au plus pour un même plafond, et rien ne part au-delà sans accord : « Arrêter »
  n'ouvre pas de dépense libre.
- Le plafond suit la conversation dans ses rejeux (`reset` le garde) et quand elle continue avec
  un autre agent (même fil, fiche 108), tant que l'unité est la même ; une branche (nouvelle
  conversation) repart du défaut.
- Le dépassement n'est vu que quand l'agent annonce sa consommation : en cours de tour pour un coût
  par `usage_update`, à la fin pour des jetons (`usage` de `session/prompt`) ou un coût relu hors
  protocole (Bob : relu aussi à la fin de chaque outil, à vérifier qu'il l'écrit en cours de tâche,
  `docs/acp.md`). Bobine ne double pas le budget de l'agent : c'est une information et un arrêt
  côté client.
- Le message retenu est gardé en mémoire dans le main (pièces jointes comprises) le temps de la
  réponse ; un redémarrage l'oublie (son début reste lisible sur la carte).
- Activer le réglage ne pose pas de plafond aux conversations existantes : on le leur donne dans
  le détail de leur consommation (« Par défaut »).
