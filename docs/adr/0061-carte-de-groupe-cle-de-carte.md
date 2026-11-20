# ADR-0061 — Carte de groupe : une clé de carte sur chaque lancement, la fusion dans la carte

- **Statut** : proposé (fiche 264, maquettes de la fiche 260, écrans C et D, validées le 2026-11-19)
- **Date** : 2026-11-20
- **Complète** : ADR-0060 (bulle et carte-réponse), ADR-0019 et ADR-0020 (conversations filles),
  fiche 120 (fusion enchaînée)

## Contexte

Des travaux proposés par l'agent (`start_child`) donnaient trois choses dans le fil : la carte
« N tâches proposées », une ligne « L'agent a lancé… » par travail, et la carte « Sous-tâches »
accrochée au **dernier** lancement du fil, qui sautait vers le bas à chaque nouveau lancement et
portait la fusion de toutes les filles, loin du bas du fil. Rien ne reliait un lancement à la ligne
de proposition qui l'avait demandé : le titre d'une fille peut changer, et une proposition expirée
se relance par « Lancer en parallèle… ».

## Décision

1. **Clé de carte, posée par le main.** `start_child` donne une clé à sa proposition
   (`ChildProposal.key`, enregistrée dans l'élicitation) ; le lancement qui en vient la reprend
   (`ChildStart.card`), même tardif. Une proposition expirée relancée la repasse par
   `conversation:startChild` (`card`, vérifiée). « Lancer en parallèle… » reçoit une clé neuve :
   une carte seule. Un lancement sans clé ni bulle (conversations d'avant) s'affiche comme avant :
   aucune migration.
2. **Le fil se range sans nouvel état** (`shared/work-groups.ts`, `workLayout`) : les propositions
   d'un tour forment une carte de groupe à la place de la première ; chaque travail lancé va sur
   sa ligne (par la clé) ; une bulle à plusieurs rôles forme la même carte, sans « proposés »
   (décision 5 de la fiche 260) ; un lancement avec une clé qu'aucune proposition ne porte : une
   carte seule à sa place. Les lancements, réponses, messages de l'agent au travail
   (`child-instruction`) et recommandations de fusion d'un travail rangé sont cachés à leur place.
3. **Chaque ligne se déplie sur la carte-réponse du travail** (`WorkCard` de l'ADR-0060,
   généralisée : rôle et bulle facultatifs) ; la réponse entière est gardée pour tout travail qui a
   sa carte (bulle ou clé).
4. **La fusion se fait dans la carte qui montre les travaux.** `children:mergePlan` prend la liste
   des travaux de la carte (`ids`) : le main ne lit que ces branches, et les recouvrements entre
   elles. Chaque carte montre la dernière fusion qui touche ses travaux (`lastMergeFor`). Un travail
   qui écrit, seul, se fusionne depuis sa carte (« Fusionner dans main ») : la fusion enchaînée de
   la fiche 120 sur ce seul travail, avec « Puis nettoyer ». La carte ne montre que les étapes que
   la fusion fait (fusion de la branche, conflit que le travail résout), jamais de vérification
   inventée (décision 8 de la fiche 260).
5. **La consigne de conflit dit sa provenance** dans le fil du travail (`MessageOrigin`
   `merge`), sans rien changer de ce que reçoit son agent.

## Conséquences

- « Sous-tâches » ne montre plus que les filles d'avant (sans clé) ; elle disparaît des
  conversations nouvelles. La vue « Filles » de Modifications garde toutes les filles ; chaque ligne
  y lit la dernière fusion qui la touche.
- Plusieurs fusions par mère (une par carte) : le main n'en fait toujours tourner qu'une à la fois ;
  une autre carte le dit et attend.
- Fusionner un travail seul archive sa conversation (comme « Puis nettoyer ») : elle reste ouvrable.
