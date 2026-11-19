# ADR-0060 — Demande à un rôle : une bulle à part dans le fil, une carte-réponse par travail

- **Statut** : proposé (fiche 263, maquettes de la fiche 260 validées le 2026-11-19)
- **Date** : 2026-11-19
- **Complète** : ADR-0019, ADR-0020 (conversations filles), fiche 223 (rôles)

## Contexte

Une demande `@rôle` de la saisie ne laissait aucune trace d'elle-même dans le fil de la mère : le
texte partait dans la fille, et le fil recevait un lancement (`child-started`), une ligne de
« Sous-tâches » accrochée au dernier lancement, puis un compte rendu (`child-report`) qui n'avait
gardé que les 400 premiers caractères de la réponse. Trois cartes pour un avis, l'avis caché
(recette du 2026-11-19, écran A de la fiche 260).

Il faut une bulle de la demande, à sa place, et sous elle une carte qui montre la réponse entière
et ne bouge plus.

## Décision

1. **La bulle est un élément de fil à part, `role-request`** (`shared/role-request.ts`), jamais un
   message `user`. Un `user` ouvre un tour (pied de la réponse, durée, fiche 261), compte pour le
   rejeu d'une session (`replayTail`, ADR-0021) et borne ce qui reste à transmettre à l'agent de la
   mère (`childNews`) ; la bulle ne fait rien de cela : elle ne part pas à l'agent de la mère.
   Elle porte `requestId`, le texte, les travaux partis (`works` : fille et badge du rôle) et,
   pour « Répondre à <rôle> », `followUp`.
2. **Posée par le main, juste avant le lancement de chaque travail parti** (`ChildConversations.start`
   avec `ask`), complétée à chaque rôle du même message (même `requestId`, élément remplacé à sa
   place) : un rôle refusé n'y paraît jamais, et la bulle précède toujours ses lancements. Le
   lancement porte `request` (le `requestId`).
3. **La carte se lit du fil, sans nouvel état** (`workCards`) : sous la bulle, une carte par
   travail ; le lancement, les comptes rendus et les bulles de suite de ce travail y sont rangés et
   cachés à leur place. Un lancement sans bulle (ancienne conversation, travail de l'agent) s'affiche
   comme avant : aucune migration.
4. **La réponse entière est gardée dans le compte rendu** (`reply`, 20 000 caractères au plus,
   `replyCut` au-delà), seulement pour un travail lancé par une bulle. Elle est affichée, jamais
   envoyée à l'agent de la mère : il reçoit toujours l'extrait borné (`reportLine`, fiche 160) et
   peut lire le reste par `child_status`.
5. **« Répondre à <rôle> »** : canal `roles:reply` ; le main pose la bulle de suite puis envoie le
   message à la même conversation, sans provenance ni réveil de la mère. Elle va dans la même
   carte (décision 2 de la fiche 260).

## Conséquences

- Le fil enregistré grossit de la réponse entière des travaux d'une bulle (borne de 20 000
  caractères par réponse).
- « Sous-tâches » et la fusion groupée restent pour les travaux lancés par l'agent ; ceux d'une
  bulle n'y ont plus de ligne (fiche 264 : carte de groupe et fusion dans la carte).
- Une bulle posée pendant une réponse de la mère s'intercale dans son fil, comme le faisait déjà
  `child-started`.
