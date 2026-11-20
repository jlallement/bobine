# ADR-0062 — Relecture : « Faire relire » lance le rôle Code reviewer, ses remarques dans sa carte

- **Statut** : proposé (fiche 265, maquettes de la fiche 260, écran G, validées le 2026-11-19)
- **Date** : 2026-11-20
- **Complète** : ADR-0060 (bulle et carte-réponse), ADR-0061 (carte de groupe), fiche 177
  (relecture avant fusion : relecteur dans le dossier de l'auteur, `report_findings`, empreinte)

## Contexte

Deux chemins de relecture coexistaient (recette du 19/11, constat R10) : le rôle intégré Code
reviewer (`@code-reviewer` dans la saisie, carte-réponse de la fiche 263) et « Faire relire… »
(fiche 177 : une conversation fille à part, sa carte « Relecture » dans le fil de la conversation
relue, qui ne disait que le nombre de remarques). Le relecteur de la fiche 177 n'avait ni bulle, ni
lancement dans le fil de sa mère : sa réponse ne partait pas à l'agent, on ne pouvait pas lui
répondre, et sa consigne interne s'affichait en clair comme un message de l'utilisateur (D33).

## Décision

1. **Un seul chemin.** « Faire relire » (Modifications, vue « Filles », carte d'un travail, astuce
   de la barre du worktree : toujours `ReviewDialog` → `conversation:startReview`) lance le **rôle
   Code reviewer** : celui du projet s'il le remplace, celui de Bobine s'il est désactivé, toujours
   en lecture seule. Le mécanisme de la fiche 177 reste dessous : relecteur dans le dossier de
   l'auteur (`reviewOf`), portée (branche contre sa base, ou non commité), `report_findings`,
   empreinte du dossier, notes de diff.
2. **Comme toute demande à un rôle**, dans le fil de la mère du relecteur : une bulle
   `role-request` (« Relis la branche … », « Relis les modifications non commitées (N
   fichiers). », ou le texte tapé avec `@code-reviewer`) dont le travail du relecteur porte la
   conversation relue (`RoleRequestWork.review.of`), puis le lancement qui
   la nomme (`ChildStart.request`). La carte-réponse de l'ADR-0060 en découle : sa réponse entière,
   sa transmission avec le prochain message, « Répondre », « Relancer », « Ouvrir sa conversation ».
3. **Premier message** : la demande, puis le bloc du rôle (`<bobine_role>`) qui contient la consigne
   du rôle **et** celle de la relecture (`reviewBrief`) ; son fil montre la demande, la consigne
   repliée (« Consigne du rôle »).
4. **La carte de relecture (`review`) va dans deux fils** quand ce sont deux conversations : celui
   de la conversation relue (ses remarques y deviennent des remarques de diff, comme avant) et celui
   de la mère (la carte du Code reviewer y lit ses remarques). `Review.authorId` dit la conversation
   relue ; une conversation n'importe en remarques de diff que les relectures de son propre travail.
   Dans le fil de la mère, l'élément `review` est caché et dit dans la carte du relecteur
   (`WorkCardData.review`).
5. **La relecture d'un travail qui a sa carte se range dans cette carte** (`workLayout().reviews`) :
   au bas de sa carte seule, ou juste sous sa ligne d'une carte de groupe, repliée ou non ; la bulle
   n'est pas montrée à sa place. La conversation affichée relue (Modifications) : la bulle et sa
   carte à leur place, en bas du fil.
6. **Ses remarques partent à l'agent avec sa réponse** (`childContext` : gravité, `fichier:ligne`,
   titre, raison, 20 au plus). « Demander à <agent> de corriger » envoie un message préparé qui
   nomme le relecteur, avec la réponse visée (`about`, ADR-0060).
7. **Lecture seule par le garde-fou commun** (revue QA) : le relecteur est un rôle en lecture seule
   comme un autre pour `ReadOnlyWatch` (empreinte avant chaque message, exclusion quand une autre
   conversation du dossier écrit, avis neutre, `watchFailed`) ; l'écart est aussi dit sur sa carte.

## Conséquences

- Les relectures d'avant (élément `review` sans lancement, sans `authorId`) s'affichent comme avant
  (`ReviewCard`) ; aucune migration. Leur relecteur n'a ni réponse ni « Répondre ».
- `@code-reviewer` tapé dans la saisie, et `start_child` de l'agent avec ce rôle, passent par le
  même chemin (décisions du tech lead) : portée
  d'office — le non commité s'il y en a, sinon la branche courante contre sa base si ce n'est pas
  la branche principale, sinon le dernier commit (portée `commit`) —, le texte tapé en points à
  surveiller, la bulle du message partagée avec les autres rôles cités. Le lien de relecture est
  donc porté par chaque travail de la bulle (`RoleRequestWork.review.of`), pas par la bulle.
- Les points à surveiller sont gardés avec la carte de relecture (`Review.focus`) : « Relancer »
  les renvoie, même après un redémarrage.
- Un clic sur `fichier:ligne` montre et met en avant la ligne dans le diff s'il la contient.
- La conversation relue qui n'est pas celle de la demande (un travail) garde la carte « Relecture »
  dans son propre fil, avec « Voir sur le diff ».
