# 264 — Carte de groupe à place fixe, fusion dans la carte

- **Statut** : fait (relecture du tech lead)
- **Dépend de** : 260 (lot 3, écrans C et D des maquettes `docs/maquettes/260-travail-delegue.html`),
  263 (bulle @rôle, carte-réponse `WorkCard`, ADR-0060), 262 (ligne de lancement, « Changer… »),
  261 (repère), 258 (états, pastille « fusionnée »), 120 (fusion enchaînée), 160 (recommandations)
- **Agents** : les deux — tout est générique (propositions `start_child`, filles, fusion git) ; rien
  de propre à un agent (ADR-0011).

## Pourquoi

Recette du 2026-11-19 (écran D de la fiche 260) : des travaux proposés par l'agent donnent une
carte « 2 tâches proposées », puis deux lignes « L'agent a lancé la conversation fille… », puis une
deuxième carte « Sous-tâches » pour les mêmes travaux, qui saute vers le bas à chaque lancement ; la
fusion se déroule dans cette carte, loin au-dessus du bas du fil (écran C). Règle 3 de la fiche 260 :
un travail qui écrit déroule sa fusion **dans sa carte** ; plusieurs travaux lancés ensemble forment
**une carte de groupe** à place fixe.

## Critères d'acceptation

- [x] Les propositions d'un tour (`start_child`) forment une seule carte, à leur place, qui change
      d'état sur place : **proposés** (par ligne : avatar ou icône, « Rôle — titre », méta, Lancer,
      Faire ici, Refuser, Agent et modèle, consigne dépliable ; ligne de lancement de la 262 ; pied
      « Tout lancer ») → **en cours / finis** (« 3 travaux · 1 en cours, 2 finis », coût une fois) →
      chaque ligne se déplie sur la carte-réponse du travail (réponse entière, transmission,
      Appliquer, Répondre, Ouvrir).
- [x] Pied de la carte : « Fusionner les N prêts dans main », recommandation de l'agent,
      « Inclure les autres… », « Puis nettoyer » ; progression et résultat dans la carte.
- [x] Plus de carte « Sous-tâches », de ligne « L'agent a lancé… » ni de compte rendu séparé pour
      ces travaux.
- [x] Plusieurs @rôles dans un message : la bulle, puis la même carte de groupe, sans « proposés ».
- [x] Travail qui écrit (bulle @rôle seule, ou « Lancer en parallèle… ») : à la fin, branche,
      « N fichiers +a −r », « Voir les modifications », « Faire relire » (relecture actuelle),
      « Fusionner dans main » ; la fusion se déroule dans la carte (étapes réelles seulement,
      « Arrêter »), puis « Fusionné dans main · branche supprimée » ; conflits comme aujourd'hui
      (Réessayer, Abandonner, Voir le conflit). Ni « main n'a pas bougé » ni « tests de la
      branche » (décision 8 de la fiche 260).
- [x] Anciennes conversations : `child-started`, `child-report`, « Sous-tâches », `children-merge`
      enregistrés s'affichent comme avant ; aucune migration.
- [x] Inchangé : filles d'une fille, relecture, réveil de la mère (`WakeLine`), recommandations de
      fusion ; consigne de conflit envoyée à un travail avec sa provenance.
- [x] Doublons : `message_child` (une seule mention : dans la carte du travail),
      `recommend_merge` (la pastille sur la ligne), cartes d'outils repliées dans le groupe d'outils.
- [x] Modifications › Filles : mêmes données, toujours juste. Repère (261) : vise la ligne ou la
      carte du travail. Pilote : voit la carte de groupe (état, lignes, fusion).
- [x] Textes : « travail », « rôle », « réponse », « fusionner » (fr, en) ; jamais « fille »,
      « sous-tâche » ni « compte rendu » dans les nouveaux textes.
- [x] Testé contre l'agent factice : réducteur, composants, main, e2e (`filles`, `filles-fusion`,
      `filles-tech-lead`, `filles-non-commite`, `roles-travail`…), captures `264-*` clair et sombre.

## Plan

**Modèle (ADR-0061, proposé)**

1. Lien explicite carte ↔ lancement : `ChildStart.card` (clé de la ligne de sa carte).
   `start_child` donne une clé à sa proposition (`ChildProposal.key`) et la passe au lancement ;
   « Lancer » d'une proposition expirée la repasse (`ChildStartRequest.card`) ; « Lancer en
   parallèle… » en reçoit une neuve (travail seul). Un lancement sans `card` ni `request` est une
   ancienne conversation : affiché comme avant.
2. `role-request.ts` : `WorkCardData` généralisée (rôle et bulle facultatifs : titre, heure de la
   demande, lancé par l'agent) ; `workCards` range aussi les travaux d'une carte (`byCard`) ; un
   `child-instruction` d'un travail rangé devient une étape de sa carte ; sa `child-recommendation`
   est cachée (pastille).
3. `work-groups.ts` (nouveau, pur) : `workLayout(items)` — cartes de groupe (propositions d'un tour,
   bulle à plusieurs rôles), cartes seules (lancement sans proposition), éléments cachés, travaux
   rangés ; `lastMergeFor(items, ids)` : dernière fusion qui touche ces travaux.

**Main**

4. `children-tools.ts` : clé de proposition, passée au lancement (aussi tardif) ; `children.ts` :
   `ChildRequest.card` posé sur le lancement ; IPC `conversation:startChild` (clé vérifiée, sinon
   neuve) ; réponse entière et « Répondre » aussi pour un travail d'une carte.
5. `children-merge.ts` : `plan(motherId, ids?)` limité aux lignes de la carte (IPC
   `children:mergePlan`, vérifié) ; consigne de conflit avec sa provenance (`from: merge`).

**Renderer**

6. `WorkGroup.tsx` (nouveau) : la carte de groupe (en-tête, lignes proposées réutilisant
   `ProposalRow`, lignes lancées dépliables sur `WorkCard`, « Tout lancer », pied de fusion).
   `ChildProposals.tsx` découpé (ligne, lieu de lancement) ; sa carte disparaît.
7. `WorkCard.tsx` : sans rôle (icône de l'agent, titre), dans un groupe (sans en-tête), pastille de
   la recommandation ; `WorkMerge.tsx` (nouveau) : « Fusionner dans main » et la fusion dans la
   carte ; `WorkFoot.tsx` : « Faire relire », « Fusionner dans main ».
8. `SubtasksMerge.tsx` : fusion limitée aux travaux donnés (`ids`), textes « travaux » pour la
   carte de groupe ; « Sous-tâches » seulement pour les anciennes conversations.
9. `Transcript.tsx` : un seul calcul (`workLayout`) ; cartes de groupe et cartes seules à leur
   place ; recommandations et consignes rangées cachées.
10. `work-cue-targets.ts` : ancre de chaque travail rangé ; pilote (`lecture.mjs`) : `shot.groups`.
11. i18n `workGroup.*`, `workMerge.*` (fr, en), CSS.

**Essais, docs** : réducteur, composants, main, e2e et captures ; architecture, ADR, changelogs.

Pas de nouvelle dépendance.

## Journal

- 2026-11-20 : fiche et plan.
- 2026-11-20 : fait.
  - **Lien carte ↔ lancement** (ADR-0061) : `start_child` donne une clé à chaque proposition
    (`ChildProposal.key`, dans l'élicitation) et la repasse au lancement (`ChildStart.card`), même
    tardif ; « Lancer » d'une proposition expirée la repasse (`conversation:startChild`, `card`
    vérifiée, 100 caractères au plus) ; « Lancer en parallèle… » reçoit une clé neuve (carte seule).
    Sans clé ni bulle : conversation d'avant, rendue comme avant (« Sous-tâches », lancement, compte
    rendu), aucune migration.
  - **Rangement** (`shared/work-groups.ts`, `workLayout`) sur `workCards` généralisé
    (`WorkCardData` : rôle et bulle facultatifs, `title`, `askedAt`, `asked`, `byAgent`, `card` ;
    étape `note` pour `child-instruction` ; `child-recommendation` cachée) : propositions d'un tour
    → une carte de groupe à la place de la première ; bulle à plusieurs rôles → la bulle puis la
    même carte (décision 5) ; clé sans proposition → carte seule à la place du lancement.
  - **Décision : bulle à plusieurs rôles = carte de groupe** (remplace les cartes individuelles de
    la 263 sous une telle bulle) : décision 5 de la fiche 260 et tableau « qui affiche quoi, où » de
    la maquette ; une seule carte qui compte « N travaux · x en cours, y finis » et fusionne ses
    branches prêtes ensemble, au lieu de N cartes empilées. Une bulle à un rôle garde sa carte.
  - **Carte de groupe** (`WorkGroup.tsx`) : en-tête (« 3 travaux proposés · par OpenCode », puis
    « 3 travaux · 1 en cours, 2 finis, 1 refusé », coût total une fois, « gratuit » si nul) ; lignes
    proposées (`ProposalRow`, ligne de lancement de la 262 par `useProposalsLaunch`, ligne sans
    rôle « un autre <agent> · écrit dans sa branche », issues « Lancé / Fait ici / Refusé /
    Expiré ») ; « Tout lancer » (dès deux lignes à lancer : chaque ligne inscrit son lancement avec
    le choix affiché) ; clavier ↑ ↓ Entrée gardé ; lignes lancées : avatar à l'état, « Rôle —
    titre », méta (outil en cours et temps écoulé, ou branche et fichiers, ou lecture seule),
    pastille (fusion, sinon recommandation « Recommandé »), état ; dépliée : la `WorkCard` du
    travail sans en-tête (réponse entière, consigne repliée, message de l'agent, transmission —
    « quand ses travaux auront tous fini » pour un travail lancé par l'agent —, Répondre, Ouvrir) ;
    pied : `SubtasksMergeFooter` en « travaux » (« Fusionner les N prêts dans main », recommandés,
    « Inclure les autres… », « Puis nettoyer », progression, résultat, conflit).
  - **Fusion dans la carte d'un travail** (`WorkMerge.tsx`) : plan lu pour ce seul travail ;
    « Fusionner dans main » (fusion de la fiche 120 sur ce travail, avec « Puis nettoyer ») ;
    étapes réelles seulement (fusion de la branche ; conflit, puis « <rôle> résout le conflit… » ;
    « En attente : une autre fusion passe avant ») et « Arrêter » ; résultat « Fusionné dans main ·
    branche supprimée » et « Sa conversation est archivée… », dit aussi après le nettoyage ;
    conflit : Réessayer, Abandonner, Voir le conflit ; échec dit ; dossier principal non commité :
    la carte de la fiche 123 ; autre fusion en cours : dit. En-tête « fusion… », puis « fusionné ·
    heure ». « Faire relire » ouvre la relecture actuelle (`SubtasksInfo.onReview`, un seul point
    d'entrée pour la 265). « Enregistrer comme rôle » passe du compte rendu à la carte d'un travail
    sans rôle.
  - **Main** : `ChildrenMerger.plan(motherId, ids)` (canal `children:mergePlan`, liste vérifiée) :
    seulement ces branches, dans l'ordre des lignes, et leurs recouvrements ; `start` fusionne dans
    l'ordre reçu ; consigne de conflit avec `from: { kind: 'merge' }` (« Consigne de la fusion
    lancée depuis « … » », sans « Modifier » ; rien de changé pour l'agent) ; réponse entière et
    « Répondre » pour tout travail qui a sa carte ; cartes `start_child` en parallèle reliées
    chacune à son appel (`AppToolsBridge`, elles s'affichaient dans le groupe d'outils).
  - **Doublons** : `child-instruction` d'un travail rangé → dans sa carte (repliée) ;
    `child-recommendation` → la pastille seule (aussi pour une ligne de « Sous-tâches ») ; les
    cartes d'outils `message_child` / `recommend_merge` restent dans le groupe d'outils.
  - **Vue « Filles »** : chaque ligne lit la dernière fusion qui la touche (`rowMerge(…, items)`) :
    avec une fusion par carte, une fille fusionnée avant la dernière fusion du fil n'était plus
    dite « fusionnée » (essai qui échoue sans le correctif).
  - **Repère** : ancre de tout travail rangé (ligne de groupe ou carte seule). **Pilote** :
    `shot.groups` (titre, comptes, lignes, fusion), carte de groupe en attente = `propositions`
    (boutons des lignes et « Tout lancer »), `attendre` attend une ligne en cours.
  - **Agent factice** : `travaux-groupe` (trois travaux de la maquette D, recommandations au
    réveil), `rayons`, `tests-stockage`, `fusion-trois` ; `conflits` répond au réveil d'une mère
    sans rien modifier.
  - **Essais** : `work-groups.test.ts` (rangement, ancienne conversation, fil abîmé,
    `lastMergeFor`) ; `WorkGroup.test.tsx` (proposés, Tout lancer, en cours, déplié, message et
    recommandation, pied lu et lancé pour la carte seulement, fusion en cours, finie, conflit, autre
    carte ; travail qui écrit : bouton, étapes, conflit en cours, fusionné après nettoyage, conflit,
    échec ; carte seule ; ancienne conversation) ; `ChildrenView.test.tsx` (deux fusions) ;
    `Transcript.test.tsx` (provenance `merge`) ; main : `children-merge.test.ts` (plan limité et
    ordonné, provenance), `children-tools.test.ts` (clé reprise, aussi tardive),
    `children.test.ts` (IPC, clé sur le lancement), `app-tools-bridge.test.ts` (appels en
    parallèle) ; pilote (`cible.test.mjs`). Essais mis à jour : `ChildProposals`, `RoleWork`,
    `WorkCard` (plusieurs rôles), `SubtasksMerge`.
  - **e2e** : nouvelle suite `travaux-groupe` (captures `264-groupe-proposes`, `-en-cours`,
    `-finis`, `-fusionne-carte`, `264-travail-ecrit`, `264-travail-ecrit-fusion`) ; `filles-fusion`
    passe par la carte de groupe (`fusion-trois`, « Tout lancer » ; captures
    `264-groupe-fusion-en-cours`, `264-groupe-fusionne`) ; `filles`, `filles-tech-lead`,
    `filles-non-commite`, `roles-travail`, `roles-gestion`, `commit-redige` mis à jour.
  - `repere` : un travail compté comme une carte seule ou une ligne de carte de groupe.
- 2026-11-20 : `./scripts/verify` vert ; `pnpm build && pnpm e2e --changed` (toutes les suites
  touchées, clair et sombre) : 220 tâches vertes sur 222 en 19 min 50 s, `repere` (2) rouge,
  corrigé puis vert seul (clair et sombre). Captures `264-*` regardées.
- 2026-11-23 : **travail fini dont la réponse attend (maquette
  `docs/maquettes/rc4-travail-fini-en-attente.html`, variante 1, validée le 2026-11-23)**.
  - État `pending` (fini pendant que la mère répond encore) : la ligne dit « a répondu »
    (`STATE_KEYS.pending` → `workGroup.state.replied`, couleur de `replied`), la précision
    existante `workCard.pendingLine` en infobulle de l'état et dans la ligne dépliée (déjà là) ;
    `groupCounts` le compte dans « N a répondu », et « a répondu » se dit désormais aussi quand
    d'autres travaux restent proposés (« 2 travaux proposés · par … · 1 a répondu »). Aucune clé
    nouvelle.
  - Activité de la ligne : chemins relatifs au dossier du travail (« Modification de README.md »),
    hors de ce dossier avec `~`, le chemin complet en infobulle (`workToolText`, `tool-label.ts`).
    Écart au brief : la méta de la ligne ne vient pas de `useWorkActivity` (carte seule) mais de
    `useChildActivity` ; il est découpé en `useChildTools` (l'outil entier, libellé par la ligne
    selon le dossier de sa conversation), `useChildActivity` (« Sous-tâches ») inchangé.
  - Essais : `WorkGroup.test.tsx` (fr, en ; infobulle ; ligne dépliée ; activité),
    `tool-label.test.ts` (`workToolText`) ; e2e `filles` (« Import CSV » fini pendant que la mère
    attend « Page d'aide » : « a répondu », compté, infobulle ; capture
    `filles-5c-travail-fini-en-attente`).

## Limites connues

- Capture `264-groupe-fusion-en-cours` : prise pendant la fusion, mais souvent au nettoyage (« 3
  sur 3 faits », « Arrêter ») ; la fusion de l'agent factice est trop rapide pour figer l'étape
  « résout le conflit » à l'image (l'essai la vérifie, sans la photographier).
- Fusionner un travail seul archive sa conversation (« Puis nettoyer », branche supprimée, comme
  la maquette C) ; elle reste ouvrable. Pas d'option « garder la branche » dans la carte d'un
  travail seul.
- Ligne « N fichiers +a −r » d'un travail : celle de sa dernière réponse ; des commits faits à la
  main après (comme dans les essais) n'y paraissent pas.
- Textes repris de la fiche 120 et encore au vocabulaire d'avant (« fille », « Sous-tâches ») :
  phrases de résumé et d'erreur de la fusion (`childrenMerge.summary.*`, `childrenMerge.error.*`),
  `children.from.*`, réveil groupé ; lot 266 (vocabulaire unique).
- Plusieurs fusions par conversation : une seule tourne à la fois dans le main ; une autre carte
  dit « Une autre fusion est en cours ici ».
- « Tout lancer » n'apparaît qu'à partir de deux lignes à lancer (une seule : son « Lancer ») ; la
  note « où partent les travaux » n'est pas répétée quand la ligne de lancement de la 262 le dit.

### Décisions du tech lead (2026-11-20)

- Cartes seules pour « Lancer en parallèle… », archivage après la fusion d'un travail seul (le
  résultat dit que sa conversation reste ouvrable), capture de la fusion en cours : acceptés.
- Vocabulaire repris de la fiche 120 : lot 266.
- **Ordre de fusion** : `start` fusionne dans l'ordre reçu, celui des lignes de la carte (lui-même
  l'ordre de lancement, revue UX) ; « Sous-tâches » envoie toujours l'ordre de lancement.
- **« N fichiers +a −r »** (corrigé) : calculé sur la branche du travail contre sa base
  (`git diff --numstat <base>...<branche>`, lu avec le plan de fusion), plus sur la dernière
  réponse ; rien une fois fusionné. Essais : `lineCounts`, plan (`children-merge.test.ts`), carte.

### Revue UX (2026-11-20), tout appliqué sauf le point 18

1. Bilan réel de la branche : « N fichiers +a −r · part de main <sha> » (`MergeCandidate.from`) ;
   une branche vide dit « rien à fusionner », sans « Fusionner » ; captures refaites avec un vrai
   diff.
2. « Puis nettoyer (archiver, supprimer les branches) » : une vraie case, avant le bouton
   principal (carte de groupe).
3. Une seule colonne d'état par ligne : la fusion, sinon la recommandation (pastille neutre, sans
   icône), sinon l'état. 4. La pastille de ligne dit seulement « fusionné ».
5. Lignes lancées : plus de « un autre <agent> » ; méta sur une ligne, branche coupée par « … ».
6. Une seule méta, en texte gris séparé par « · » (`workGroup.place.*`), aussi pour les lignes
   proposées ; plus de « worktree » à l'écran.
7. Titre seul en gras, rôle dans la méta ; sous 520 px (`@container`), les boutons d'une ligne
   passent sous son texte ; captures `264-groupe-proposes-900`, `264-groupe-finis-900`.
8. Pli « Lire la suite » 8 px sous la réponse (carte seule et groupe) ; la consigne sous la réponse,
   12 px d'écart.
9. « Tous les travaux ont fini : l'agent reprend avec leurs réponses. » ; « …relisez la carte des
   travaux ».
10. Fusion d'un travail seul : « commit <sha> · N fichiers +a −r » (retenus par le main pendant la
    fusion) ; « Voir les modifications » reste. La transmission ne dit **pas** « avec le résultat
    de la fusion » : ce n'est pas vrai (le résultat d'une fusion ne part pas à l'agent).
11. Pied du groupe : la transmission en tête (« Réponses pas encore transmises à … »), « Voir les
    modifications » en bouton secondaire (Modifications › Filles).
12. Progression « Fusion dans main : 2 sur 3… » ; la phrase du conflit seulement s'il y en a un ;
    captures `264-groupe-inclure-autres`, `264-groupe-conflit`.
13. « en cours » d'une seule couleur ; 14. fond de ligne seulement au clavier (`:focus-visible`) ;
    15. `whereMixed` reformulé ; 16. pas de coût dans la ligne dépliée (dit une fois en tête) ;
    17. lignes lancées dans l'ordre de lancement (celui de la barre latérale et de la fusion) ;
    19. écran C : ligne de branche en texte simple ; 20. « dossiers de travail ».
18. **Noms de branche datés** : lot à part (non traité ici).

### Revue QA (2026-11-20), tout corrigé ; chaque défaut a un essai qui échoue sans son correctif

1. Nettoyage sans perte : `start` refuse un travail qui travaille ou attend un accord
   (`childrenMerge.error.busy`) ; `mergeRow` retient la tête fusionnée de chaque branche
   (`WorktreeCycle.worktreeHead`) ; `cleanup` saute un travail occupé, dont la tête a bougé ou dont
   le dossier a des modifications, et le dit (`cleanupSkipped`), sans `force`. « Répondre » et
   « Relancer » (et l'« Arrêter » du tour) masqués pendant la fusion d'un travail. Essais contre un
   vrai dépôt git (`children-merge.test.ts`).
2. Carte seule pendant la résolution d'un conflit : le contrôle de fusion reste actif (la fusion du
   travail est active) ; « résout le conflit » et l'« Arrêter » de la fusion, pas celui du tour
   (essai avec `status: 'busy'`).
3. Clé de relecture du plan : toutes les fusions de la mère (`runId:status:états`).
4. Le plan dit quelle fusion tourne (`ChildrenMergePlan.runId`) : une fusion d'une carte n'est « en
   cours » que si c'est celle-là ; `stop(motherId, runId)` n'arrête jamais celle d'une autre carte.
5. Un seul plan par mère et par état, partagé par toutes les cartes (`merge-plan-store.ts`) ; la
   carte en garde ses travaux (`planFor`) ; relu quand la conversation est réaffichée.
6. Recommandations et dernière fusion de chaque travail lues une fois dans `workLayout` (contexte
   `WorkLayoutContext`).
7. `AppToolsBridge` : une file par titre, vidée à la fin du tour ; un appel fini (refusé par le
   plafond) en sort.
8. Anciennes conversations : la note de recommandation reste lisible sur la pastille (infobulle et
   texte pour les lecteurs d'écran) ; CHANGELOG.
9. Un message `message_child` ouvre un échange (état, temps écoulé, rangement des réponses).
10. Pilote : `busy()` voit une fusion en cours (`shot.merging`) ; les cartes dépliées d'un groupe ne
    sont plus comptées en double ; JSDoc remis à sa place.
11. Fil abîmé : une clé de proposition en double ne lance qu'une ligne.

### Limites (revues)

- Deux mères du même dépôt peuvent fusionner en même temps (une fusion par mère) : pas une
  régression de ce lot, limite connue.
- « Voir les modifications » d'un travail fusionné et nettoyé ouvre sa conversation archivée (sa vue
  Git n'a plus de dossier de travail).
- Pli « Lire la suite » : 8 px sous le fondu, aussi pour la carte seule (revue UX, écart à la
  maquette A de la 263).

### En appliquant les revues (2026-11-20)

- Une ligne lancée dont l'appel `start_child` (caché derrière la carte) a échoué ne reste plus
  « démarre… » : « pas lancé », la raison en infobulle (essai).
- Branche avec des modifications non commitées : « N modifications non commitées » (la fusion ne
  les prendra pas), plus « rien modifié » ; une branche vide : « rien à fusionner ».
- Plan partagé : le dernier plan lu reste montré pendant qu'un nouvel état se lit (pas de
  clignotement) ; seul un plan lu pour l'état exact dit qu'une fusion a été interrompue.
- Pied de la carte de groupe en colonne : « Voir les modifications » passait sous le bouton de
  fusion quand la ligne se repliait (vu en e2e : le clic ouvrait Modifications au lieu de fusionner).
- e2e : les lignes lancées suivant l'ordre de lancement, les essais lisent les lignes par leur
  titre ; `filles-fusion` suit la ligne en conflit, quelle qu'elle soit.

### Dernière relecture des captures (2026-11-20)

- **Pied de fusion** : « Fusionner le recommandé dans main » débordait de la carte (coupé à
  droite). La case « Puis nettoyer » a désormais sa propre ligne, puis une rangée de boutons
  [Voir les modifications] [Inclure l'autre…] [Fusionner …], principal en dernier, qui passe à la
  ligne dans la carte (`flex-wrap`, boutons bornés à sa largeur). « Voir les modifications » est
  passé au pied de fusion (`extra`) ; seul, il garde sa rangée. L'essai `travaux-groupe` vérifie
  qu'aucun bouton du pied ne dépasse la carte, en largeur normale, à 900 px et en confirmation.
- **Conseil (constat D9)** : « l'autre attend son avis » promettait un avis que rien ne réveille
  l'agent à donner. La phrase dit ce qu'il a vraiment dit : « … ; « X » n'est pas encore prêt
  selon lui. » (avis « pas prêt » à jour), sinon « … n'a pas encore d'avis de l'agent. » (aucun
  avis, ou un avis caduc). « Sous-tâches » (fiche 160) garde son texte.
