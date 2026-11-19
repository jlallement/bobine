# 264 — Carte de groupe à place fixe, fusion dans la carte

- **Statut** : en cours
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

- [ ] Les propositions d'un tour (`start_child`) forment une seule carte, à leur place, qui change
      d'état sur place : **proposés** (par ligne : avatar ou icône, « Rôle — titre », méta, Lancer,
      Faire ici, Refuser, Agent et modèle, consigne dépliable ; ligne de lancement de la 262 ; pied
      « Tout lancer ») → **en cours / finis** (« 3 travaux · 1 en cours, 2 finis », coût une fois) →
      chaque ligne se déplie sur la carte-réponse du travail (réponse entière, transmission,
      Appliquer, Répondre, Ouvrir).
- [ ] Pied de la carte : « Fusionner les N prêts dans main », recommandation de l'agent,
      « Inclure les autres… », « Puis nettoyer » ; progression et résultat dans la carte.
- [ ] Plus de carte « Sous-tâches », de ligne « L'agent a lancé… » ni de compte rendu séparé pour
      ces travaux.
- [ ] Plusieurs @rôles dans un message : la bulle, puis la même carte de groupe, sans « proposés ».
- [ ] Travail qui écrit (bulle @rôle seule, ou « Lancer en parallèle… ») : à la fin, branche,
      « N fichiers +a −r », « Voir les modifications », « Faire relire » (relecture actuelle),
      « Fusionner dans main » ; la fusion se déroule dans la carte (étapes réelles seulement,
      « Arrêter »), puis « Fusionné dans main · branche supprimée » ; conflits comme aujourd'hui
      (Réessayer, Abandonner, Voir le conflit). Ni « main n'a pas bougé » ni « tests de la
      branche » (décision 8 de la fiche 260).
- [ ] Anciennes conversations : `child-started`, `child-report`, « Sous-tâches », `children-merge`
      enregistrés s'affichent comme avant ; aucune migration.
- [ ] Inchangé : filles d'une fille, relecture, réveil de la mère (`WakeLine`), recommandations de
      fusion ; consigne de conflit envoyée à un travail avec sa provenance.
- [ ] Doublons : `message_child` (une seule mention : dans la carte du travail),
      `recommend_merge` (la pastille sur la ligne), cartes d'outils repliées dans le groupe d'outils.
- [ ] Modifications › Filles : mêmes données, toujours juste. Repère (261) : vise la ligne ou la
      carte du travail. Pilote : voit la carte de groupe (état, lignes, fusion).
- [ ] Textes : « travail », « rôle », « réponse », « fusionner » (fr, en) ; jamais « fille »,
      « sous-tâche » ni « compte rendu » dans les nouveaux textes.
- [ ] Testé contre l'agent factice : réducteur, composants, main, e2e (`filles`, `filles-fusion`,
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
